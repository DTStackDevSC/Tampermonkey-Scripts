using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class ScriptPatcherTests
{
    static readonly Dictionary<BlockRef, JsNode> None = new();

    [Theory, InlineData(SuiteId.TicketHelpers), InlineData(SuiteId.Toolbar)]
    public void Rewriting_every_block_unchanged_keeps_file_valid_and_values_equal(SuiteId suite)
    {
        var text = TestRepo.Read(suite);
        var blocks = BlockCatalog.All.Where(b => b.Suite == suite).ToDictionary(b => b, b => Blocks.Read(text, b));
        var result = ScriptPatcher.Apply(text, blocks);
        Assert.Equal(text, result);
        Assert.True(JsValidator.Check(result).Ok);
    }

    [Fact]
    public void Apply_with_empty_dictionary_returns_identical_text()
    {
        var text = TestRepo.Read(SuiteId.Toolbar);
        Assert.Same(text, ScriptPatcher.Apply(text, None));
    }

    [Fact]
    public void Bytes_outside_changed_block_are_identical()
    {
        var text = TestRepo.Read(SuiteId.TicketHelpers);
        var span = BlockLocator.FindValue(text, BlockCatalog.Geos);
        var geos = (JsArray)Blocks.Read(text, BlockCatalog.Geos);
        var item = new JsObject();
        item["code"] = new JsString("XX");
        item["label"] = new JsString("New place (XX)");
        geos.Items.Add(item);
        var result = ScriptPatcher.Apply(text, new Dictionary<BlockRef, JsNode> { [BlockCatalog.Geos] = geos });
        Assert.Equal(text[..span.Start], result[..span.Start]);
        var tail = text[span.End..];
        Assert.EndsWith(tail, result);
        Assert.Contains("        { code: 'XX', label: 'New place (XX)' }\n    ]", result);
        Assert.True(JsValidator.Check(result).Ok);
    }

    [Fact]
    public void Body_with_backtick_still_validates()
    {
        var text = TestRepo.Read(SuiteId.TicketHelpers);
        var teams = (JsObject)Blocks.Read(text, BlockCatalog.ResponseTeams);
        var responses = (JsObject)((JsObject)teams["emeaTeam"]!)["responses"]!;
        ((JsTemplateFn)responses["initial"]!).RawBody = TemplateText.FromFriendly("use `code` and C:\\x and ${y}");
        var result = ScriptPatcher.Apply(text, new Dictionary<BlockRef, JsNode> { [BlockCatalog.ResponseTeams] = teams });
        Assert.True(JsValidator.Check(result).Ok);
        var again = (JsObject)((JsObject)((JsObject)Blocks.Read(result, BlockCatalog.ResponseTeams))["emeaTeam"]!)["responses"]!;
        Assert.Equal("use `code` and C:\\x and ${y}", TemplateText.ToFriendly(((JsTemplateFn)again["initial"]!).RawBody));
    }

    [Fact]
    public void Crlf_file_gets_crlf_in_rewritten_block()
    {
        var text = TestRepo.Read(SuiteId.TicketHelpers).ReplaceLineEndings("\r\n");
        var geos = (JsArray)Blocks.Read(text, BlockCatalog.Geos);
        var item = new JsObject();
        item["code"] = new JsString("XX");
        item["label"] = new JsString("X");
        geos.Items.Add(item);
        var result = ScriptPatcher.Apply(text, new Dictionary<BlockRef, JsNode> { [BlockCatalog.Geos] = geos });
        var block = Blocks.Slice(result, BlockCatalog.Geos);
        Assert.DoesNotMatch("[^\r]\n", block);
        Assert.DoesNotMatch("[^\r]\n", result);
    }

    [Fact]
    public void Validator_reports_line_of_syntax_error()
    {
        var lines = TestRepo.Read(SuiteId.Toolbar).Split('\n').ToList();
        lines.Insert(9, "const = ;");
        var r = JsValidator.Check(string.Join('\n', lines));
        Assert.False(r.Ok);
        Assert.Equal(10, r.Line);
    }
}
