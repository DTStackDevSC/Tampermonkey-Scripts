using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;

namespace ConfigEditor.Tests;

public class JsReaderTests
{
    static JsNode Block(SuiteId suite, string? section, string name)
    {
        var t = TestRepo.Read(suite);
        var s = BlockLocator.FindValue(t, new(suite, section, name));
        return JsReader.Parse(t.Substring(s.Start, s.Length));
    }

    [Fact]
    public void Parses_TEAMS_emeaTeam_name_and_showVendor()
    {
        var teams = (JsObject)Block(SuiteId.TicketHelpers, "SHORT DESCRIPTION HELPER", "TEAMS");
        var emea = (JsObject)teams["emeaTeam"]!;
        Assert.Equal("EMEA Team", ((JsString)emea["name"]!).Value);
        Assert.True(((JsBool)emea["showVendor"]!).Value);
    }

    [Fact]
    public void Parses_response_body_as_JsTemplateFn()
    {
        var teams = (JsObject)Block(SuiteId.TicketHelpers, "TICKET RESPONSE HELPER", "RESPONSE_TEAMS");
        var responses = (JsObject)((JsObject)teams["emeaTeam"]!)["responses"]!;
        var initial = Assert.IsType<JsTemplateFn>(responses["initial"]);
        Assert.Equal("vars", initial.Param);
        Assert.Contains("${vars.openedByName}", initial.RawBody);
    }

    [Fact]
    public void Keeps_unknown_values_as_JsRaw()
    {
        var raw = Assert.IsType<JsRaw>(((JsObject)JsReader.Parse("{ a: SOURCE_EXTRA_FIELDS, b: x => x + 1, c: /a,b/g }"))["a"]);
        Assert.Equal("SOURCE_EXTRA_FIELDS", raw.Text);
        var o = (JsObject)JsReader.Parse("{ a: SOURCE_EXTRA_FIELDS, b: x => ({ y: [x, 1] }), c: /a,b/g }");
        Assert.Equal("x => ({ y: [x, 1] })", ((JsRaw)o["b"]!).Text);
        Assert.Equal("/a,b/g", ((JsRaw)o["c"]!).Text);
    }

    [Fact]
    public void Team_separator_comment_is_LeadingComment()
    {
        var teams = (JsObject)Block(SuiteId.TicketHelpers, "TICKET RESPONSE HELPER", "RESPONSE_TEAMS");
        Assert.Equal("/// AME TEAM ///", teams.Props.First(p => p.Key == "ameTeam").LeadingComment);
    }

    [Fact]
    public void Decodes_string_escapes_and_quoted_keys()
    {
        var o = (JsObject)JsReader.Parse("{ 'Policy Created': { a: 'it\\'s\\n\\u00e9', b: \"We've\" }, n: -1.5, t: true }");
        var p = (JsObject)o["Policy Created"]!;
        Assert.Equal("it's\né", ((JsString)p["a"]!).Value);
        Assert.Equal("We've", ((JsString)p["b"]!).Value);
        Assert.Equal("-1.5", ((JsNumber)o["n"]!).Raw);
    }

    [Fact]
    public void Arrays_with_trailing_commas_parse()
    {
        var a = (JsArray)JsReader.Parse("['a', 'b',\n]");
        Assert.Equal(new[] { "a", "b" }, a.Items.Cast<JsString>().Select(s => s.Value));
    }
}
