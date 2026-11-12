using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ConfigEditor.Core.Publish;
using ConfigEditor.Core.Release;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;
using ConfigEditor.Core.Session;

namespace ConfigEditor.ViewModels;

public partial class MainViewModel : ObservableObject
{
    public const string UploadBase = "https://github.com/DTStackDevSC/Tampermonkey-Scripts/upload/main/";
    public const string EmailSettingsUrl = "https://github.com/settings/emails";
    static readonly HttpClient SharedHttp = new() { Timeout = TimeSpan.FromSeconds(60) };
    static readonly TimeSpan ArmWindow = TimeSpan.FromSeconds(5);

    readonly IScriptSourceFactory sources;
    readonly ITokenStore tokens;
    readonly IDialogs dialogs;
    readonly IAppSettings settings;
    readonly TimeProvider clock;
    readonly Func<string, GitHubPublisher> publisherFactory;
    string? openedFolder;
    DateTimeOffset armedAt;

    public MainViewModel(IScriptSourceFactory sources, ITokenStore tokens, IDialogs dialogs, IAppSettings settings,
        TimeProvider? clock = null, Func<string, GitHubPublisher>? publisherFactory = null)
    {
        this.sources = sources; this.tokens = tokens; this.dialogs = dialogs; this.settings = settings;
        this.clock = clock ?? TimeProvider.System;
        this.publisherFactory = publisherFactory ?? (t => new GitHubPublisher(SharedHttp, t));
        const string th = "Ticket Helpers", tb = "Tools Toolbar";
        Nav = new ObservableCollection<NavItem>
        {
            new("shortDescription", "Short Description", th, true, BlockCatalog.SdTeams, BlockCatalog.DtTeams),
            new("responses", "Ticket Response", th, true, BlockCatalog.ResponseTeams, BlockCatalog.SdTeams, BlockCatalog.DtTeams),
            new("policyNaming", "Policy Naming", th, false, BlockCatalog.Geos, BlockCatalog.PolicyTypes, BlockCatalog.DlpPolicyTypes,
                BlockCatalog.AppliesTo, BlockCatalog.PolicyChannelTypes, BlockCatalog.DlpCriteria),
            new("ticketSubject", "Ticket Subject", th, false, BlockCatalog.MfOptions, BlockCatalog.ProductOptions, BlockCatalog.TenantGroups),
            new("noteTexts", "Change Tracker note texts", tb, false, BlockCatalog.NoteTemplates),
            new("mfCodes", "Ticket Assignment member firms", tb, false, BlockCatalog.MfCodeMap),
        };
        Nav[0].Page = new Pages.ShortDescriptionPage(this);
        Nav[1].Page = new Pages.ResponsesPage(this);
        Nav[2].Page = new Pages.PolicyNamingPage(this);
        Nav[3].Page = new Pages.TicketSubjectPage(this);
        Nav[4].Page = new Pages.NoteTextsPage(this);
        Nav[5].Page = new Pages.MfCodesPage(this);
        selectedNav = Nav[0];
    }

    public ObservableCollection<NavItem> Nav { get; }
    public ObservableCollection<TeamChoice> Teams { get; } = new();
    public EditSession? Session { get; private set; }

    /// <summary>Raised after a new session is opened, so pages read their data again.</summary>
    public event Action? SessionOpened;
    /// <summary>Raised whenever the document changes (pages and team list stay in step).</summary>
    public event Action? DocumentEdited;
    public event Action<SaveDialogViewModel>? SaveDialogCreated;

    [ObservableProperty] [NotifyPropertyChangedFor(nameof(ShowTeamPicker))] private NavItem? selectedNav;
    [ObservableProperty] private string? selectedTeamKey;
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(UnsavedText))] private int unsavedCount;
    [ObservableProperty] private string status = "Starting…";
    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private string? busyText;
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(DeleteTeamText))] private bool deleteArmed;
    [ObservableProperty] private string sourceText = "Nothing opened";
    /// <summary>True when there are edits since the last open or successful save.</summary>
    [ObservableProperty] private bool hasUnsavedWork;

    public bool ShowTeamPicker => SelectedNav?.IsPerTeam == true && Session != null;
    public bool ShowPublish => settings.PublishEnabled;
    public string DeleteTeamText => DeleteArmed ? "Click again to delete" : "🗑 Delete team";
    public string UnsavedText => UnsavedCount switch
    {
        0 => "No changes",
        1 => "1 section changed",
        var n => $"{n} sections changed"
    };

    partial void OnSelectedTeamKeyChanged(string? value) => DeleteArmed = false;

    public Task StartAsync() => OpenAsync(sources.GitHub(), null);

    [RelayCommand]
    async Task OpenLatest()
    {
        if (!ConfirmDiscard()) { Status = "ℹ️ Kept your edits. Nothing was reloaded."; return; }
        await OpenAsync(sources.GitHub(), null);
    }

    [RelayCommand]
    async Task OpenFolder()
    {
        if (!ConfirmDiscard()) { Status = "ℹ️ Kept your edits. Nothing was opened."; return; }
        var folder = dialogs.PickFolder();
        if (folder == null) { Status = "ℹ️ No folder chosen."; return; }
        await OpenAsync(sources.Folder(folder), folder);
    }

    bool ConfirmDiscard() => !HasUnsavedWork ||
        dialogs.Confirm("Discard changes?", "You have edits that are not saved yet. Reloading discards them. Continue?");

    async Task OpenAsync(IScriptSource src, string? folder)
    {
        IsBusy = true;
        BusyText = folder == null ? "🔄 Downloading the latest scripts from GitHub…" : "🔄 Reading the scripts from the folder…";
        try
        {
            var session = await EditSession.OpenAsync(src, CancellationToken.None);
            Session = session;
            openedFolder = folder;
            SourceText = folder == null ? "Latest from GitHub" : "Folder: " + folder;
            UpdateAvailability();
            RefreshTeams();
            UnsavedCount = 0;
            HasUnsavedWork = false;
            OnPropertyChanged(nameof(ShowTeamPicker));
            SessionOpened?.Invoke();
            var broken = Nav.Count(n => !n.IsAvailable);
            Status = broken == 0
                ? $"✅ Opened {SourceText.ToLowerInvariant()}. Pick a section on the left."
                : $"⚠️ Opened, but {broken} section(s) could not be read. Point at them for the reason.";
        }
        catch (Exception e) when (e is HttpRequestException or IOException or TaskCanceledException or UnauthorizedAccessException)
        {
            Status = folder == null
                ? $"Could not reach GitHub: {e.Message}. Use Open folder to work on local files."
                : $"Could not open the folder: {e.Message} It must hold the folders 'Standalone Scripts' and 'Toolbar Scripts'.";
            if (Session == null)
                foreach (var n in Nav) { n.IsAvailable = false; n.UnavailableReason = "Nothing opened yet. Use Open latest or Open folder."; }
        }
        finally
        {
            IsBusy = false;
        }
    }

    void UpdateAvailability()
    {
        var doc = Session!.Edited;
        foreach (var n in Nav)
        {
            var reasons = n.Blocks.Where(doc.Unavailable.ContainsKey).Select(b => doc.Unavailable[b]).Distinct().ToList();
            n.IsAvailable = reasons.Count == 0;
            n.UnavailableReason = reasons.Count == 0 ? null : string.Join(" ", reasons);
        }
    }

    void RefreshTeams()
    {
        var keep = SelectedTeamKey;
        Teams.Clear();
        if (Session == null) return;
        var doc = Session.Edited;
        if (doc.Unavailable.ContainsKey(BlockCatalog.DtTeams) || doc.Unavailable.ContainsKey(BlockCatalog.SdTeams)) return;
        var names = ShortDescriptionTeam.ReadAll(doc).ToDictionary(t => t.Key, t => t.Name);
        foreach (var t in Core.Sections.Teams.List(doc))
            Teams.Add(new TeamChoice(t.Key, names.TryGetValue(t.Key, out var n) && n.Length > 0 ? n : t.ShortLabel));
        SelectedTeamKey = Teams.Any(t => t.Key == keep) ? keep : Teams.FirstOrDefault()?.Key;
    }

    /// <summary>Pages call this after writing to the document.</summary>
    public void NotifyEdited()
    {
        UnsavedCount = Session?.Edited.Changed.Count ?? 0;
        HasUnsavedWork = true;
        DocumentEdited?.Invoke();
    }

    [RelayCommand]
    void AddTeam()
    {
        if (Session == null) { Status = "Open the scripts first."; return; }
        var req = dialogs.AskNewTeam(Teams);
        if (req == null) { Status = "ℹ️ No team added."; return; }
        try
        {
            var key = Core.Sections.Teams.Add(Session.Edited, req.DisplayName.Trim(), req.ShortLabel.Trim(), req.CopyFromKey);
            RefreshTeams();
            SelectedTeamKey = key;
            NotifyEdited();
            Status = $"✅ Added {req.DisplayName.Trim()}, copied from {Teams.FirstOrDefault(t => t.Key == req.CopyFromKey)?.Label ?? req.CopyFromKey}. Adjust its texts, then Save.";
        }
        catch (Exception e) when (e is InvalidOperationException or ArgumentException)
        {
            Status = "❌ Could not add the team: " + e.Message;
        }
    }

    [RelayCommand]
    void DeleteTeam()
    {
        if (Session == null || SelectedTeamKey == null) { Status = "Pick a team first."; return; }
        var now = clock.GetUtcNow();
        if (!DeleteArmed || now - armedAt > ArmWindow)
        {
            DeleteArmed = true;
            armedAt = now;
            Status = "Click Delete team again within 5 seconds to delete it from every helper.";
            return;
        }
        DeleteArmed = false;
        var label = Teams.FirstOrDefault(t => t.Key == SelectedTeamKey)?.Label ?? SelectedTeamKey;
        try
        {
            Core.Sections.Teams.Delete(Session.Edited, SelectedTeamKey);
            SelectedTeamKey = null;
            RefreshTeams();
            NotifyEdited();
            Status = $"🗑 Deleted {label}. Save to keep this change.";
        }
        catch (InvalidOperationException e)
        {
            Status = "❌ " + e.Message;
        }
    }

    [RelayCommand]
    void OpenSettings() => dialogs.ShowSettings(CreateSettings());

    public SettingsViewModel CreateSettings() => new(settings, tokens, publisherFactory, () =>
    {
        OnPropertyChanged(nameof(ShowPublish));
        Status = "✅ Settings saved.";
    });

    [RelayCommand]
    Task Save() => SaveOrPublish(SaveMode.Save);

    [RelayCommand]
    Task Publish() => SaveOrPublish(SaveMode.Publish);

    async Task SaveOrPublish(SaveMode mode)
    {
        if (Session == null) { Status = "Open the scripts first."; return; }
        if (UnsavedCount == 0) { Status = "ℹ️ Nothing changed, so there is nothing to save."; return; }
        string? token = null;
        if (mode == SaveMode.Publish)
        {
            token = tokens.Load();
            if (!settings.PublishEnabled || string.IsNullOrEmpty(token)) { Status = "Add your GitHub token in ⚙ Settings first."; return; }
        }

        var session = Session;
        PrepareResult prepared;
        IsBusy = true;
        BusyText = "🔄 Checking GitHub for newer versions…";
        try
        {
            prepared = await session.PrepareAsync(sources.GitHub(), CancellationToken.None);
        }
        finally
        {
            IsBusy = false;
        }
        if (!prepared.Ok) { Status = FailText(prepared); return; }
        if (prepared.Files.Count == 0) { Status = "ℹ️ Nothing changed, so there is nothing to save."; return; }

        var folder = openedFolder ?? settings.WorkFolder;
        var destination = mode == SaveMode.Save
            ? $"Files are written to {folder}. A backup of each old file goes to its backups folder."
            : "One commit to main on GitHub, under your account with its private noreply email.";
        if (prepared.Warning != null) destination += " ⚠️ " + prepared.Warning;

        async Task<PrepareResult?> Reprepare(IReadOnlyList<ChangeItem> items, IProgress<string> progress)
        {
            if (items.SequenceEqual(prepared.Items)) return prepared;
            progress.Report("🔄 Applying your changelog text…");
            return await session.PrepareAsync(sources.GitHub(), CancellationToken.None, items);
        }

        Func<IReadOnlyList<ChangeItem>, IProgress<string>, Task<SaveOutcome>> run = mode == SaveMode.Save
            ? async (items, progress) =>
            {
                var r = await Reprepare(items, progress);
                if (r is not { Ok: true }) return Failed(FailText(r!));
                progress.Report($"💾 Writing {r.Files.Count} file(s)…");
                await EditSession.SaveAsync(folder, r.Files);
                var links = r.Files.Keys.Select(p => p[..p.LastIndexOf('/')]).Distinct()
                    .Select(dir => new LinkItem($"Upload to {dir} on GitHub", UploadBase + Uri.EscapeDataString(dir))).ToList();
                links.Add(new LinkItem("Open the saved folder", folder));
                settings.EmailReminderShown = true;
                settings.Save();
                var names = string.Join(", ", r.Files.Keys.Select(Path.GetFileName));
                return new SaveOutcome(true, $"✅ Saved {names}. Now upload them on GitHub: open the link, drag the files in, then Commit changes.", links, true);
            }
            : async (items, progress) =>
            {
                var r = await Reprepare(items, progress);
                if (r is not { Ok: true }) return Failed(FailText(r!));
                progress.Report("🚀 Publishing to GitHub…");
                var message = GitHubPublisher.CommitMessage(r.Files, r.Items);
                var res = await publisherFactory(token!).PublishAsync(r.Files, message,
                    () => session.PrepareAsync(sources.GitHub(), CancellationToken.None, items));
                if (!res.Ok) return Failed("❌ " + res.Error);
                return new SaveOutcome(true, "✅ Published. Tampermonkey will offer the update to everyone soon.",
                    new[] { new LinkItem("See the commit on GitHub", res.CommitUrl!) }, false);
            };

        var dialog = new SaveDialogViewModel(mode, prepared.Items, destination, run, dialogs);
        SaveDialogCreated?.Invoke(dialog);
        dialogs.ShowSave(dialog);

        if (dialog.Outcome == null) { Status = mode == SaveMode.Save ? "ℹ️ Save cancelled. Your edits are kept." : "ℹ️ Publish cancelled. Your edits are kept."; return; }
        Status = dialog.Outcome.Message;
        if (dialog.Outcome.Ok) HasUnsavedWork = false;
        if (dialog.Outcome.Ok && mode == SaveMode.Publish) await OpenAsync(sources.GitHub(), null);
    }

    static SaveOutcome Failed(string text) => new(false, text, Array.Empty<LinkItem>(), false);

    static string FailText(PrepareResult r) => r.ConflictSection != null
        ? $"⚠️ Someone changed the {r.ConflictSection} section on GitHub since you opened it, so nothing was saved. Note your edits, use ⟳ Open latest, then redo them."
        : "❌ " + (r.Error ?? "Could not prepare the files.");
}
