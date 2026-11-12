using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class TicketHelpersSectionTests
{
    static ConfigDocument Doc() => ConfigDocument.Load(TestRepo.Read(SuiteId.TicketHelpers), TestRepo.Read(SuiteId.Toolbar));

    static string Without(string text, BlockRef changed) // text with the changed block's value blanked, to compare the rest
    {
        var s = BlockLocator.FindValue(text, changed);
        return text[..s.Start] + text[s.End..];
    }

    [Fact]
    public void Every_spec_block_is_found()
    {
        var d = Doc();
        Assert.Empty(d.Unavailable);
        Assert.All(BlockCatalog.All, b => Assert.NotNull(d.Get(b)));
    }

    [Fact]
    public void Short_description_emea_round_trips_unchanged()
    {
        var d = Doc();
        foreach (var team in ShortDescriptionTeam.ReadAll(d)) ShortDescriptionTeam.Save(d, team);
        Assert.Empty(d.Changed);
        Assert.Equal(TestRepo.Read(SuiteId.TicketHelpers), d.Render().ticketHelpers);
    }

    [Fact]
    public void Editing_emea_status_options_changes_only_TEAMS()
    {
        var d = Doc();
        var emea = ShortDescriptionTeam.ReadAll(d).Single(t => t.Key == "emeaTeam");
        Assert.Equal("EMEA Team", emea.Name);
        Assert.True(emea.ShowVendor);
        Assert.Contains(emea.MfOptions, o => o.Label == "Deloitte Spain - ES" && o.Value == "ES");
        emea.StatusOptions.Add("On Hold");
        ShortDescriptionTeam.Save(d, emea);
        Assert.Equal(new[] { BlockCatalog.SdTeams }, d.Changed);
        var (th, tb) = d.Render();
        var original = TestRepo.Read(SuiteId.TicketHelpers);
        Assert.Equal(Without(original, BlockCatalog.SdTeams), Without(th, BlockCatalog.SdTeams));
        Assert.Contains("'Closed', 'On Hold']", th);
        Assert.Equal(TestRepo.Read(SuiteId.Toolbar), tb);
        Assert.True(JsValidator.Check(th).Ok);
        Assert.Contains("On Hold", ShortDescriptionTeam.ReadAll(ConfigDocument.Load(th, tb)).Single(t => t.Key == "emeaTeam").StatusOptions);
    }

    [Fact]
    public void Response_items_follow_menu_order_then_disabled()
    {
        var team = ResponseTeam.ReadAll(Doc()).Single(t => t.Key == "emeaTeam");
        Assert.Equal("EMEA Team", team.Name);
        Assert.Equal(new[] { "teststeps", "unknownreq", "policymgmt" }, team.Responses.Take(3).Select(r => r.Key));
        Assert.True(team.Responses.Take(3).All(r => r.Enabled));
        var firstDisabled = team.Responses.FindIndex(r => !r.Enabled);
        Assert.True(firstDisabled < 0 || team.Responses.Skip(firstDisabled).All(r => !r.Enabled));
        var initial = team.Responses.Single(r => r.Key == "initial");
        Assert.Equal("Initial Contact", initial.Label);
        Assert.Equal("first_contact", initial.Category);
        Assert.Equal("comments", initial.FieldType);
        Assert.Equal("Waiting Requester", initial.StatusAfter);
        Assert.True(initial.BodyEditable);
        Assert.Contains("{Opened by name}", TemplateText.ToFriendly(initial.BodyRaw!));
        var ssl = team.Responses.Single(r => r.Key == "bypassssl");
        Assert.Equal("bypass", ssl.ParentItem);
        Assert.True(team.Responses.Single(r => r.Key == "bypass").HasSubmenu);
    }

    [Fact]
    public void Response_teams_round_trip_unchanged()
    {
        var d = Doc();
        foreach (var t in ResponseTeam.ReadAll(d)) ResponseTeam.Save(d, t);
        Assert.Empty(d.Changed);
    }

    [Fact]
    public void Disabling_a_response_removes_it_from_enabledResponses_only()
    {
        var d = Doc();
        var team = ResponseTeam.ReadAll(d).Single(t => t.Key == "emeaTeam");
        team.Responses.Single(r => r.Key == "unknownreq").Enabled = false;
        ResponseTeam.Save(d, team);
        var emea = (JsObject)((JsObject)d.Get(BlockCatalog.ResponseTeams))["emeaTeam"]!;
        var enabled = ((JsArray)emea["enabledResponses"]!).Items.Cast<JsString>().Select(s => s.Value).ToList();
        Assert.DoesNotContain("unknownreq", enabled);
        Assert.True(((JsObject)emea["responseMetadata"]!).Has("unknownreq"));
        Assert.True(((JsObject)emea["responses"]!).Has("unknownreq"));
        Assert.True(JsValidator.Check(d.Render().ticketHelpers).Ok);
    }

    [Fact]
    public void StatusAfter_edit_keeps_other_transforms()
    {
        var node = (JsObject)JsReader.Parse(@"{ name: 'T', defaultSectionOrder: ['responses'],
            responseMetadata: { a: { label: 'A', category: 'responses', fieldType: 'comments',
                shortDescTransforms: [{ field: 'product', value: 'DLP' }, { field: 'status', value: 'WIP' }] } },
            enabledResponses: ['a'], responses: { a: (vars) => `x` } }");
        var team = ResponseTeam.From("t", node);
        Assert.Equal("WIP", team.Responses[0].StatusAfter);
        team.Responses[0].StatusAfter = "Closed";
        var meta = (JsObject)((JsObject)((JsObject)team.ToNode())["responseMetadata"]!)["a"]!;
        var tr = ((JsArray)meta["shortDescTransforms"]!).Items.Cast<JsObject>().ToList();
        Assert.Equal("DLP", ((JsString)tr[0]["value"]!).Value);
        Assert.Equal("Closed", ((JsString)tr[1]["value"]!).Value);
        team.Responses[0].StatusAfter = null;
        meta = (JsObject)((JsObject)((JsObject)team.ToNode())["responseMetadata"]!)["a"]!;
        Assert.Single(((JsArray)meta["shortDescTransforms"]!).Items);
    }

    [Fact]
    public void New_response_gets_metadata_body_and_enabled_entry()
    {
        var d = Doc();
        var team = ResponseTeam.ReadAll(d).Single(t => t.Key == "ameTeam");
        team.Responses.Insert(0, new ResponseItem
        {
            Key = ResponseTeam.NewKey("Printer help", team), Label = "Printer help", Category = "responses",
            FieldType = "work_notes", Enabled = true, StatusAfter = "WIP", BodyRaw = TemplateText.FromFriendly("Hi {Opened by name}")
        });
        ResponseTeam.Save(d, team);
        var th = d.Render().ticketHelpers;
        Assert.True(JsValidator.Check(th).Ok);
        var again = ResponseTeam.ReadAll(ConfigDocument.Load(th, TestRepo.Read(SuiteId.Toolbar))).Single(t => t.Key == "ameTeam");
        var item = again.Responses[0];
        Assert.Equal("printerHelp", item.Key);
        Assert.Equal(("Printer help", "work_notes", "WIP", true), (item.Label, item.FieldType, item.StatusAfter, item.Enabled));
        Assert.Equal("Hi ${vars.openedByName}", item.BodyRaw);
    }

    [Fact]
    public void Removing_a_response_removes_all_three_parts()
    {
        var d = Doc();
        var team = ResponseTeam.ReadAll(d).Single(t => t.Key == "emeaTeam");
        team.Responses.RemoveAll(r => r.Key == "unknownreq");
        ResponseTeam.Save(d, team);
        var emea = (JsObject)((JsObject)d.Get(BlockCatalog.ResponseTeams))["emeaTeam"]!;
        Assert.False(((JsObject)emea["responseMetadata"]!).Has("unknownreq"));
        Assert.False(((JsObject)emea["responses"]!).Has("unknownreq"));
    }

    [Fact]
    public void Geos_and_dlp_criteria_edit_round_trip()
    {
        var d = Doc();
        var geos = CodeLabel.Read(d, BlockCatalog.Geos);
        Assert.Contains(geos, g => g.Code == "ES" && g.Label == "Spain (ES)");
        CodeLabel.Save(d, BlockCatalog.Geos, geos);
        Assert.Empty(d.Changed);
        geos.Add(new CodeLabel("XX", "Test (XX)"));
        CodeLabel.Save(d, BlockCatalog.Geos, geos);
        var crit = CodeLabel.Read(d, BlockCatalog.DlpCriteria);
        crit[0].Label = "Cloud Apps";
        CodeLabel.Save(d, BlockCatalog.DlpCriteria, crit);
        var types = StringList.Read(d, BlockCatalog.PolicyTypes);
        types.Remove("Web Deny");
        StringList.Save(d, BlockCatalog.PolicyTypes, types);
        var th = d.Render().ticketHelpers;
        Assert.True(JsValidator.Check(th).Ok);
        var d2 = ConfigDocument.Load(th, TestRepo.Read(SuiteId.Toolbar));
        Assert.Equal("Test (XX)", CodeLabel.Read(d2, BlockCatalog.Geos).Last().Label);
        Assert.Equal("Cloud Apps", CodeLabel.Read(d2, BlockCatalog.DlpCriteria)[0].Label);
        Assert.DoesNotContain("Web Deny", StringList.Read(d2, BlockCatalog.PolicyTypes));
        Assert.Contains("        { code: 'TR',     label: 'Turkey (TR)' },", th);
    }

    [Fact]
    public void TenantGroup_key_is_preserved_when_label_and_mfs_change()
    {
        var d = Doc();
        var groups = TenantGroup.Read(d);
        var eu = groups.Single(g => g.Key == "tenantURL_EU");
        eu.Label = "Europe";
        eu.Mfs.Add("XX");
        TenantGroup.Save(d, groups);
        var again = TenantGroup.Read(ConfigDocument.Load(d.Render().ticketHelpers, TestRepo.Read(SuiteId.Toolbar)));
        var eu2 = again.Single(g => g.Key == "tenantURL_EU");
        Assert.Equal("Europe", eu2.Label);
        Assert.Equal("XX", eu2.Mfs.Last());
    }

    [Fact]
    public void Ticket_subject_mf_options_round_trip()
    {
        var d = Doc();
        var mfs = LabelValue.Read(d, BlockCatalog.MfOptions);
        Assert.Equal("", mfs[0].Value);
        mfs.Add(new LabelValue("Deloitte Test - TT", "TT"));
        LabelValue.Save(d, BlockCatalog.MfOptions, mfs);
        var th = d.Render().ticketHelpers;
        Assert.True(JsValidator.Check(th).Ok);
        Assert.Contains("        { label: 'Deloitte SLATAM - SLATAM',                 value: 'SLATAM'      },", th);
    }

    [Fact]
    public void Missing_block_lands_in_Unavailable_not_exception()
    {
        var th = TestRepo.Read(SuiteId.TicketHelpers).Replace("const MF_OPTIONS = [", "const MF_OPTS = [");
        var d = ConfigDocument.Load(th, TestRepo.Read(SuiteId.Toolbar));
        Assert.True(d.Unavailable.ContainsKey(BlockCatalog.MfOptions));
        Assert.Null(d.Get(BlockCatalog.MfOptions));
        Assert.NotNull(d.Get(BlockCatalog.Geos));
    }
    [Fact]
    public void Editing_one_response_team_keeps_the_rest_of_the_block_verbatim()
    {
        var d = Doc();
        var team = ResponseTeam.ReadAll(d).Single(t => t.Key == "ameTeam");
        team.Responses.Single(r => r.Key == "initial").StatusAfter = null;
        ResponseTeam.Save(d, team);
        var original = TestRepo.Read(SuiteId.TicketHelpers);
        var th = d.Render().ticketHelpers;
        var o = BlockLocator.FindValue(original, BlockCatalog.ResponseTeams);
        var n = BlockLocator.FindValue(th, BlockCatalog.ResponseTeams);
        var apac = original.IndexOf("    /// APAC TEAM ///", o.Start);
        Assert.Equal(original[apac..o.End], th[(n.End - (o.End - apac))..n.End]);
    }
}
