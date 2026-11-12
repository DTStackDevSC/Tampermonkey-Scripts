using System.Text.RegularExpressions;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Core.Release;

/// <summary>Bumps the versions and prepends changelog entries for the changes of one suite.</summary>
public static class ReleaseWriter
{
    const string ShortDescriptionSection = "SHORT DESCRIPTION HELPER";
    static readonly Regex HeaderVersion = new(@"^(// @version[ \t]+)(\S+)", RegexOptions.Multiline);
    static readonly Regex ScriptVersion = new(@"const SCRIPT_VERSION = '([^']+)';");
    const string ChangelogOpen = "const CHANGELOG = `";

    public static string Apply(SuiteId suite, string text, IReadOnlyList<ChangeItem> items)
    {
        var mine = items.Where(i => i.Block.Suite == suite).ToList();
        if (mine.Count == 0) return text;
        var nl = ScriptPatcher.NewlineOf(text);
        var edits = new List<(int Start, int Length, string Text)>();

        var header = HeaderVersion.Match(text);
        if (!header.Success) throw new InvalidOperationException("The script has no @version line.");
        var coreVersion = CurrentVersion(text, null);
        var suiteVersion = VersionNumber.NextPatch(coreVersion);
        edits.Add((header.Groups[2].Index, header.Groups[2].Length, suiteVersion));

        var coreBullets = mine.Select(i => i.ToolName + ": " + i.Bullet).Distinct().ToList();
        AddSection(edits, text, null, suiteVersion, coreBullets, nl);

        var sections = new List<string>();
        foreach (var item in mine)
        {
            var sec = BlockCatalog.SectionOf(item.ToolName);
            if (sec != null && !sections.Contains(sec)) sections.Add(sec);
        }
        if (suite == SuiteId.TicketHelpers)
        {
            // The Short Description section mirrors the suite core version and changelog.
            sections.Remove(ShortDescriptionSection);
            AddSection(edits, text, ShortDescriptionSection, suiteVersion, coreBullets, nl);
        }
        foreach (var sec in sections)
        {
            var bullets = mine.Where(i => BlockCatalog.SectionOf(i.ToolName) == sec).Select(i => i.Bullet).Distinct().ToList();
            AddSection(edits, text, sec, VersionNumber.NextPatch(CurrentVersion(text, sec)), bullets, nl);
        }

        foreach (var e in edits.OrderByDescending(e => e.Start))
            text = text[..e.Start] + e.Text + text[(e.Start + e.Length)..];
        return text;
    }

    static string Escape(string s) => s.Replace("\\", "\\\\").Replace("`", "\\`").Replace("${", "\\${");

    static string CurrentVersion(string text, string? section)
    {
        var m = FindVersion(text, section);
        return m.Groups[1].Value;
    }

    static Match FindVersion(string text, string? section)
    {
        var b = BlockLocator.SectionBounds(text, section);
        if (b.Length < 0) throw new InvalidOperationException($"Section {section} not found.");
        var m = ScriptVersion.Match(text, b.Start, b.Length);
        if (!m.Success) throw new InvalidOperationException($"No SCRIPT_VERSION in {section ?? "the suite core"}.");
        return m;
    }

    static void AddSection(List<(int, int, string)> edits, string text, string? section, string version, List<string> bullets, string nl)
    {
        var m = FindVersion(text, section);
        edits.Add((m.Groups[1].Index, m.Groups[1].Length, version));
        var b = BlockLocator.SectionBounds(text, section);
        var at = text.IndexOf(ChangelogOpen, m.Index, b.End - m.Index, StringComparison.Ordinal);
        if (at < 0) throw new InvalidOperationException($"No CHANGELOG in {section ?? "the suite core"}.");
        var entry = $"Version {version}:{nl}" + string.Concat(bullets.Select(x => "- " + Escape(x) + nl)) + nl;
        edits.Add((at + ChangelogOpen.Length, 0, entry));
    }
}
