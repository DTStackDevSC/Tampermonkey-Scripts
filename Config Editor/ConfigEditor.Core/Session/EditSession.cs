using System.Text;
using ConfigEditor.Core.Release;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Core.Session;

/// <param name="Files">Relative path to new full text; includes the Toolbar.user.js copy when the Toolbar changed.</param>
public sealed record PrepareResult(bool Ok, string? ConflictSection, IReadOnlyList<ChangeItem> Items,
    IReadOnlyDictionary<string, string> Files, string? Warning, string? Error = null)
{
    /// <summary>The scripts as read from the source before applying the edits, by relative path; empty when they could not be read.</summary>
    public IReadOnlyDictionary<string, string> Read { get; init; } = new Dictionary<string, string>();
}

/// <summary>One editing round: the opened scripts, the user's edits, and turning them into files to save.</summary>
public sealed class EditSession
{
    readonly IScriptSource source;
    // Saved but maybe not uploaded yet: relative path to (text read from the source then, text saved).
    readonly IReadOnlyDictionary<string, (string Read, string Saved)> saved;

    EditSession(IScriptSource source, ConfigDocument original, ConfigDocument edited,
        IReadOnlyDictionary<string, (string Read, string Saved)>? saved = null)
    {
        this.source = source; Original = original; Edited = edited;
        this.saved = saved ?? new Dictionary<string, (string, string)>();
    }

    public ConfigDocument Original { get; }
    public ConfigDocument Edited { get; }
    public string SourceDescription => source.Description;
    public bool FromFolder => source is FolderSource;

    public static async Task<EditSession> OpenAsync(IScriptSource src, CancellationToken ct)
    {
        var th = src.ReadAsync(SuitePaths.TicketHelpers, ct);
        var tb = src.ReadAsync(SuitePaths.Toolbar, ct);
        await Task.WhenAll(th, tb);
        return new EditSession(src, ConfigDocument.Load(th.Result, tb.Result), ConfigDocument.Load(th.Result, tb.Result));
    }

    static readonly IReadOnlyDictionary<string, string> NoFiles = new Dictionary<string, string>();

    static PrepareResult Fail(string? conflict, string? error, IReadOnlyList<ChangeItem>? items = null) =>
        new(false, conflict, items ?? Array.Empty<ChangeItem>(), NoFiles, null, error);

    /// <summary>Applies the edits onto the latest scripts, bumps versions and validates the result.</summary>
    /// <param name="items">Changelog bullets to use instead of the generated ones (as edited by the user).</param>
    public async Task<PrepareResult> PrepareAsync(IScriptSource latest, CancellationToken ct, IReadOnlyList<ChangeItem>? items = null)
    {
        var changed = Edited.Changed;
        if (changed.Count == 0) return new PrepareResult(true, null, Array.Empty<ChangeItem>(), NoFiles, null);

        string latestTh, latestTb;
        string? warning = null;
        var read = new Dictionary<string, string>();
        try
        {
            var th = latest.ReadAsync(SuitePaths.TicketHelpers, ct);
            var tb = latest.ReadAsync(SuitePaths.Toolbar, ct);
            await Task.WhenAll(th, tb);
            read[SuitePaths.TicketHelpers] = th.Result;
            read[SuitePaths.Toolbar] = tb.Result;
            latestTh = Unuploaded(SuitePaths.TicketHelpers, th.Result);
            latestTb = Unuploaded(SuitePaths.Toolbar, tb.Result);
        }
        catch (Exception e) when (e is HttpRequestException or IOException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            if (!FromFolder) return Fail(null, "Could not check GitHub for newer versions: " + e.Message);
            (latestTh, latestTb) = (Original.TicketHelpersText, Original.ToolbarText);
            warning = "Could not check GitHub for newer versions.";
        }

        foreach (var b in changed)
        {
            var mine = b.Suite == SuiteId.TicketHelpers ? Original.TicketHelpersText : Original.ToolbarText;
            var theirs = b.Suite == SuiteId.TicketHelpers ? latestTh : latestTb;
            if (BlockText(mine, b) != BlockText(theirs, b)) return Fail(BlockCatalog.ToolName(b), null);
        }

        var target = ConfigDocument.Load(latestTh, latestTb);
        foreach (var b in changed) target.Set(b, Edited.Get(b)!);
        var generated = ChangeSummary.Build(Original, Edited);
        items = items == null ? generated
            : items.Concat(generated.Where(g => !items.Any(i => i.Block == g.Block && i.ToolName == g.ToolName))).ToList();
        var (newTh, newTb) = target.Render();

        var files = new Dictionary<string, string>();
        if (changed.Any(b => b.Suite == SuiteId.TicketHelpers))
            files[SuitePaths.TicketHelpers] = ReleaseWriter.Apply(SuiteId.TicketHelpers, newTh, items);
        if (changed.Any(b => b.Suite == SuiteId.Toolbar))
        {
            var text = ReleaseWriter.Apply(SuiteId.Toolbar, newTb, items);
            files[SuitePaths.Toolbar] = text;
            files[SuitePaths.ToolbarCopy] = text;
        }

        foreach (var (path, text) in files)
        {
            var v = JsValidator.Check(text);
            if (!v.Ok) return Fail(null, $"The result would break {path} (line {v.Line}, column {v.Column}: {v.Message}). Nothing was saved.", items);
        }
        return new PrepareResult(true, null, items, files, warning) { Read = read };
    }

    /// <summary>The saved text while the source still shows what it showed when that text was saved.</summary>
    string Unuploaded(string path, string text) =>
        saved.TryGetValue(path, out var s) && s.Read == text ? s.Saved : text;

    /// <summary>The session to keep editing in after <paramref name="result"/> was saved: the saved files become the starting point.</summary>
    public EditSession AfterSave(PrepareResult result)
    {
        var pending = new Dictionary<string, (string Read, string Saved)>(saved);
        foreach (var path in new[] { SuitePaths.TicketHelpers, SuitePaths.Toolbar })
            if (result.Files.TryGetValue(path, out var text) && result.Read.TryGetValue(path, out var was))
                pending[path] = (was, text);
        var th = result.Files.GetValueOrDefault(SuitePaths.TicketHelpers, Original.TicketHelpersText);
        var tb = result.Files.GetValueOrDefault(SuitePaths.Toolbar, Original.ToolbarText);
        return new EditSession(source, ConfigDocument.Load(th, tb), ConfigDocument.Load(th, tb), pending);
    }

    static string? BlockText(string text, BlockRef b)
    {
        try { var s = BlockLocator.FindValue(text, b); return text.Substring(s.Start, s.Length); }
        catch (BlockNotFoundException) { return null; }
    }

    /// <summary>Writes the files under <paramref name="folder"/>, keeping a timestamped backup of each old file.</summary>
    public static async Task SaveAsync(string folder, IReadOnlyDictionary<string, string> files)
    {
        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        var backups = Path.Combine(folder, "backups");
        var utf8 = new UTF8Encoding(false);
        foreach (var (rel, text) in files)
        {
            var path = Path.Combine(folder, rel.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            if (File.Exists(path))
            {
                Directory.CreateDirectory(backups);
                File.Copy(path, Path.Combine(backups, $"{Path.GetFileName(path)}.{stamp}.bak"), true);
            }
            await File.WriteAllTextAsync(path, text, utf8);
        }
    }
}
