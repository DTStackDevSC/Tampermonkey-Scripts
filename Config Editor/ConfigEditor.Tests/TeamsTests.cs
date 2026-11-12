using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class TeamsTests
{
    static ConfigDocument Doc() => ConfigDocument.Load(TestRepo.Read(SuiteId.TicketHelpers), TestRepo.Read(SuiteId.Toolbar));

    [Theory, InlineData("LATAM Team", "latamTeam"), InlineData("España", "espanaTeam"), InlineData("EMEA Team", "emeaTeam2"), InlineData("north  america", "northAmericaTeam")]
    public void MakeKey_cases(string name, string key) =>
        Assert.Equal(key, Teams.MakeKey(name, new[] { "emeaTeam", "ameTeam", "apacTeam" }));

    [Fact]
    public void Add_team_appears_in_all_three_blocks_and_validates()
    {
        var d = Doc();
        Teams.Add(d, "LATAM Team", "LATAM", "ameTeam");
        var th = d.Render().ticketHelpers;
        Assert.True(JsValidator.Check(th).Ok);
        var d2 = ConfigDocument.Load(th, TestRepo.Read(SuiteId.Toolbar));
        var sd = ShortDescriptionTeam.ReadAll(d2).Single(t => t.Key == "latamTeam");
        Assert.Equal("LATAM Team", sd.Name);
        Assert.Equal(ShortDescriptionTeam.ReadAll(d2).Single(t => t.Key == "ameTeam").StatusOptions, sd.StatusOptions);
        var resp = ResponseTeam.ReadAll(d2).Single(t => t.Key == "latamTeam");
        Assert.Equal("LATAM Team", resp.Name);
        Assert.NotEmpty(resp.Responses);
        Assert.Contains("/// LATAM TEAM ///", th);
        Assert.Contains(Teams.List(d2), t => t.Key == "latamTeam" && t.ShortLabel == "LATAM");
    }

    [Fact]
    public void Delete_team_removes_from_all_three()
    {
        var d = Doc();
        Teams.Delete(d, "apacTeam");
        var d2 = ConfigDocument.Load(d.Render().ticketHelpers, TestRepo.Read(SuiteId.Toolbar));
        Assert.DoesNotContain(ShortDescriptionTeam.ReadAll(d2), t => t.Key == "apacTeam");
        Assert.DoesNotContain(ResponseTeam.ReadAll(d2), t => t.Key == "apacTeam");
        Assert.DoesNotContain(Teams.List(d2), t => t.Key == "apacTeam");
        Assert.True(JsValidator.Check(d.Render().ticketHelpers).Ok);
    }

    [Fact]
    public void Delete_last_team_throws()
    {
        var d = Doc();
        Teams.Delete(d, "apacTeam");
        Teams.Delete(d, "ameTeam");
        Assert.Throws<InvalidOperationException>(() => Teams.Delete(d, "emeaTeam"));
    }
}
