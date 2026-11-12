using System.Text.RegularExpressions;
using ConfigEditor.Core.Release;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class ReleaseTests
{
    static ConfigDocument Doc() => ConfigDocument.Load(TestRepo.Read(SuiteId.TicketHelpers), TestRepo.Read(SuiteId.Toolbar));

    static string VersionIn(string text, string? section)
    {
        var b = BlockLocator.SectionBounds(text, section);
        return Regex.Match(text.Substring(b.Start, b.Length), @"const SCRIPT_VERSION = '([^']+)'").Groups[1].Value;
    }

    static string ChangelogStart(string text, string? section)
    {
        var b = BlockLocator.SectionBounds(text, section);
        var body = text.Substring(b.Start, b.Length);
        var i = body.IndexOf("const CHANGELOG = `", StringComparison.Ordinal) + "const CHANGELOG = `".Length;
        return body.Substring(i, 200);
    }

    static string HeaderVersion(string text) => Regex.Match(text, @"^// @version(\s+)(\S+)", RegexOptions.Multiline).Groups[2].Value;

    static (ConfigDocument original, ConfigDocument edited) EditResponse()
    {
        var original = Doc();
        var edited = Doc();
        var emea = ResponseTeam.ReadAll(edited).Single(t => t.Key == "emeaTeam");
        var item = emea.Responses.First(r => r.BodyEditable);
        item.BodyRaw += " Thanks.";
        ResponseTeam.Save(edited, emea);
        return (original, edited);
    }

    [Theory, InlineData("4.3.4", "4.3.5"), InlineData("1.4", "1.4.1"), InlineData("2.29.2", "2.29.3")]
    public void NextPatch(string from, string to) => Assert.Equal(to, VersionNumber.NextPatch(from));

    [Fact]
    public void Ticket_response_edit_bumps_suite_three_places_and_helper()
    {
        var (original, edited) = EditResponse();
        var items = ChangeSummary.Build(original, edited);
        var item = Assert.Single(items);
        Assert.Equal("Ticket Response Helper", item.ToolName);
        Assert.StartsWith("Updated the text of the EMEA Team response \"", item.Bullet);

        var text = ReleaseWriter.Apply(SuiteId.TicketHelpers, edited.Render().ticketHelpers, items);
        Assert.Equal("4.3.5", HeaderVersion(text));
        Assert.Equal("4.3.5", VersionIn(text, null));
        Assert.Equal("4.3.5", VersionIn(text, "SHORT DESCRIPTION HELPER"));
        Assert.Equal("2.21.5", VersionIn(text, "TICKET RESPONSE HELPER"));
        Assert.Equal("1.5.6", VersionIn(text, "POLICY NAMING HELPER"));
        Assert.StartsWith("Version 4.3.5:\n- Ticket Response Helper: Updated the text", ChangelogStart(text, null));
        Assert.StartsWith("Version 4.3.5:\n- Ticket Response Helper: Updated the text", ChangelogStart(text, "SHORT DESCRIPTION HELPER"));
        Assert.StartsWith("Version 2.21.5:\n- Updated the text", ChangelogStart(text, "TICKET RESPONSE HELPER"));
        Assert.Contains("\n\nVersion 2.21.4:", ChangelogStart(text, "TICKET RESPONSE HELPER"));
        Assert.Contains("// @version      4.3.5\n", text);
        Assert.True(JsValidator.Check(text).Ok);
    }

    [Fact]
    public void Toolbar_note_edit_bumps_suite_and_change_tracker_with_prefix()
    {
        var original = Doc();
        var edited = Doc();
        var notes = NoteTemplate.ReadAll(edited);
        notes[0].CommentsHeader += " Thanks.";
        NoteTemplate.Save(edited, notes);
        var items = ChangeSummary.Build(original, edited);

        var text = ReleaseWriter.Apply(SuiteId.Toolbar, edited.Render().toolbar, items);
        Assert.Equal("2.29.3", HeaderVersion(text));
        Assert.Equal("2.29.3", VersionIn(text, null));
        Assert.Equal("2.13.2", VersionIn(text, "SERVICENOW TICKET HISTORY"));
        Assert.StartsWith("Version 2.29.3:\n- Change Tracker: ", ChangelogStart(text, null));
        Assert.StartsWith("Version 2.13.2:\n- Updated", ChangelogStart(text, "SERVICENOW TICKET HISTORY"));
        Assert.Equal("1.5.3", VersionIn(text, "TICKET ASSIGNMENT TOOL"));
        Assert.True(JsValidator.Check(text).Ok);
        Assert.Equal(TestRepo.Read(SuiteId.TicketHelpers), ReleaseWriter.Apply(SuiteId.TicketHelpers, edited.Render().ticketHelpers, items));
    }

    [Fact]
    public void Two_sections_one_save_is_one_suite_version()
    {
        var (original, edited) = EditResponse();
        var geos = CodeLabel.Read(edited, BlockCatalog.Geos);
        geos.Add(new CodeLabel("XX", "Test (XX)"));
        CodeLabel.Save(edited, BlockCatalog.Geos, geos);
        var items = ChangeSummary.Build(original, edited);
        Assert.Equal(2, items.Count);

        var text = ReleaseWriter.Apply(SuiteId.TicketHelpers, edited.Render().ticketHelpers, items);
        Assert.Equal("4.3.5", VersionIn(text, null));
        Assert.Equal("2.21.5", VersionIn(text, "TICKET RESPONSE HELPER"));
        Assert.Equal("1.5.7", VersionIn(text, "POLICY NAMING HELPER"));
        var core = ChangelogStart(text, null);
        Assert.Contains("- Policy Naming Helper: Added the region option \"Test (XX)\".", core);
        Assert.Single(Regex.Matches(text[..BlockLocator.SectionBounds(text, "SHORT DESCRIPTION HELPER").Start], "Version 4.3.5:"));
    }

    [Fact]
    public void Generated_bullets_have_no_dash_punctuation()
    {
        var original = Doc();
        var edited = Doc();
        Teams.Add(edited, "North America", "NA", "emeaTeam");
        var sd = ShortDescriptionTeam.ReadAll(edited).Single(t => t.Key == "emeaTeam");
        sd.StatusOptions.Add("On Hold");
        ShortDescriptionTeam.Save(edited, sd);
        var map = MfCodeEntry.ReadAll(edited);
        map[1].Code = "ZZ";
        MfCodeEntry.Save(edited, map);

        var items = ChangeSummary.Build(original, edited);
        Assert.Contains(items, i => i.ToolName == "Short Description Helper" && i.Bullet == "Added the North America Team.");
        Assert.Contains(items, i => i.ToolName == "Ticket Response Helper" && i.Bullet == "Added the North America Team.");
        Assert.Contains(items, i => i.Bullet == "Added the status option \"On Hold\" for the EMEA Team.");
        Assert.Contains(items, i => i.ToolName == "Ticket Assignment Tool");
        Assert.Equal(items.Count, items.Distinct().Count());
        Assert.All(items, i => Assert.DoesNotMatch(" - |—|–", i.Bullet));
    }

    [Fact]
    public void No_changes_produces_no_release()
    {
        Assert.Empty(ChangeSummary.Build(Doc(), Doc()));
        var th = TestRepo.Read(SuiteId.TicketHelpers);
        Assert.Equal(th, ReleaseWriter.Apply(SuiteId.TicketHelpers, th, Array.Empty<ChangeItem>()));
    }

    [Fact]
    public void Crlf_file_gets_crlf_changelog_entry()
    {
        var (original, edited) = EditResponse();
        var items = ChangeSummary.Build(original, edited);
        var crlf = edited.Render().ticketHelpers.Replace("\n", "\r\n");
        var text = ReleaseWriter.Apply(SuiteId.TicketHelpers, crlf, items);
        Assert.DoesNotMatch("[^\r]\n", text);
        Assert.Contains("Version 4.3.5:\r\n- Ticket Response Helper: ", text);
    }

    [Fact]
    public void Backtick_and_placeholder_in_a_label_keep_the_changelog_valid()
    {
        var original = Doc();
        var edited = Doc();
        var geos = CodeLabel.Read(edited, BlockCatalog.Geos);
        geos.Add(new CodeLabel("XX", "Odd `name` ${x} \\ (XX)"));
        CodeLabel.Save(edited, BlockCatalog.Geos, geos);
        var text = ReleaseWriter.Apply(SuiteId.TicketHelpers, edited.Render().ticketHelpers, ChangeSummary.Build(original, edited));
        Assert.True(JsValidator.Check(text).Ok);
        Assert.Contains("Odd \\`name\\` \\${x} \\\\ (XX)", text);
    }
}
