using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Tests;

public class JsWriterTests
{
    public static IEnumerable<object[]> AllBlocks => BlockCatalog.All.Select(b => new object[] { b.Suite, b.Section ?? "", b.ConstName });

    static BlockRef Ref(SuiteId s, string sec, string name) => new(s, sec == "" ? null : sec, name);

    [Theory, MemberData(nameof(AllBlocks))]
    public void Fresh_layout_of_every_block_reparses_equal(SuiteId suite, string section, string name)
    {
        var node = Blocks.Read(TestRepo.Read(suite), Ref(suite, section, name));
        var written = JsWriter.Write(node, "    ", "\n", preserveOriginal: false);
        Assert.Equal(node.Canonical(), JsReader.Parse(written).Canonical());
        Assert.True(JsValidator.Check("const X = " + written + ";").Ok);
    }

    [Fact]
    public void Unchanged_node_is_written_verbatim()
    {
        var src = "{\n        a:   'x',   // keep\n        b: [1,2],\n    }";
        Assert.Equal(src, JsWriter.Write(JsReader.Parse(src), "    ", "\n"));
    }

    [Fact]
    public void Changed_child_keeps_siblings_verbatim()
    {
        var o = (JsObject)JsReader.Parse("{\n    a: { code: 'A',    label: 'x' },\n    b: 'y'\n}");
        o["b"] = new JsString("z");
        Assert.Equal("{\n    a: { code: 'A',    label: 'x' },\n    b: 'z'\n}", JsWriter.Write(o, "", "\n"));
    }

    [Fact]
    public void New_string_array_up_to_100_chars_is_one_line()
    {
        var a = new JsArray();
        a.Items.AddRange(new[] { "N/A", "On Hold" }.Select(s => (JsNode)new JsString(s)));
        Assert.Equal("['N/A', 'On Hold']", JsWriter.Write(a, "", "\n"));
    }

    [Fact]
    public void Strings_with_quotes_and_newlines_are_escaped()
    {
        Assert.Equal("\"We've\"", JsWriter.Write(new JsString("We've"), "", "\n"));
        Assert.Equal("'a\\nb\\\\ \\'\"'", JsWriter.Write(new JsString("a\nb\\ '\""), "", "\n"));
    }

    [Fact]
    public void Leading_comment_gets_blank_line_before()
    {
        var o = new JsObject();
        o.Props.Add(new JsProperty("a", new JsBool(true)));
        o.Props.Add(new JsProperty("b", new JsBool(false)) { LeadingComment = "/// B TEAM ///" });
        Assert.Equal("{\n    a: true,\n\n    /// B TEAM ///\n    b: false\n}", JsWriter.Write(o, "", "\n"));
    }
}
