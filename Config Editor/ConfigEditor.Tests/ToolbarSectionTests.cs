using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class ToolbarSectionTests
{
    static ConfigDocument Doc() => ConfigDocument.Load(TestRepo.Read(SuiteId.TicketHelpers), TestRepo.Read(SuiteId.Toolbar));

    [Fact]
    public void Note_template_edit_changes_only_NOTE_TEMPLATES_and_validates()
    {
        var d = Doc();
        var notes = NoteTemplate.ReadAll(d);
        var created = notes.Single(n => n.EntryType == "Policy Created");
        Assert.Equal("Netskope Policy has been created:", created.WorkNoteHeader);
        Assert.Equal("We've created the following Netskope policy to help address the issue:", created.CommentsHeader);
        created.CommentsHeader = "We've built the policy below:";
        NoteTemplate.Save(d, notes);
        Assert.Equal(new[] { BlockCatalog.NoteTemplates }, d.Changed);
        var (th, tb) = d.Render();
        Assert.Equal(TestRepo.Read(SuiteId.TicketHelpers), th);
        Assert.True(JsValidator.Check(tb).Ok);
        Assert.Contains("commentsHeader: \"We've built the policy below:\",", tb);
        Assert.Equal("We've built the policy below:", NoteTemplate.ReadAll(ConfigDocument.Load(th, tb)).Single(n => n.EntryType == "Policy Created").CommentsHeader);
    }

    [Fact]
    public void Comments_closer_absent_stays_absent_when_untouched()
    {
        var d = Doc();
        var notes = NoteTemplate.ReadAll(d);
        var removed = notes.Single(n => n.EntryType == "DLP Process Exception Removed");
        Assert.Null(removed.CommentsCloser);
        removed.WorkNoteHeader += " (edited)";
        NoteTemplate.Save(d, notes);
        var again = NoteTemplate.ReadAll(ConfigDocument.Load(d.Render().ticketHelpers, d.Render().toolbar));
        Assert.Null(again.Single(n => n.EntryType == "DLP Process Exception Removed").CommentsCloser);
    }

    [Fact]
    public void Clearing_a_closer_removes_it()
    {
        var d = Doc();
        var notes = NoteTemplate.ReadAll(d);
        notes.Single(n => n.EntryType == "Policy Deleted").CommentsCloser = "";
        NoteTemplate.Save(d, notes);
        var again = NoteTemplate.ReadAll(ConfigDocument.Load(d.Render().ticketHelpers, d.Render().toolbar));
        Assert.Null(again.Single(n => n.EntryType == "Policy Deleted").CommentsCloser);
    }

    [Fact]
    public void MfCodeMap_round_trip_keeps_order()
    {
        var d = Doc();
        var map = MfCodeEntry.ReadAll(d);
        Assert.Equal(("Deloitte Africa", "Africa"), (map[0].Name, map[0].Code));
        MfCodeEntry.Save(d, map);
        Assert.Empty(d.Changed);
        map.Insert(1, new MfCodeEntry("Deloitte Test", "TT"));
        map.Single(m => m.Name == "Deloitte Austria").Code = "AT2";
        MfCodeEntry.Save(d, map);
        var tb = d.Render().toolbar;
        Assert.True(JsValidator.Check(tb).Ok);
        Assert.Contains("        'Deloitte Belgium':                         'BE',", tb);
        Assert.Contains("        'Deloitte Test':                            'TT',", tb);
        Assert.Contains("        'DTTL':                                     'GLB',", tb);
        var again = MfCodeEntry.ReadAll(ConfigDocument.Load(d.Render().ticketHelpers, tb));
        Assert.Equal(new[] { "Deloitte Africa", "Deloitte Test", "Deloitte Austria" }, again.Take(3).Select(m => m.Name));
        Assert.Equal("AT2", again[2].Code);
    }
}
