using ConfigEditor.Core.Script;

namespace ConfigEditor.Tests;

public class BlockLocatorTests
{
    static string Slice(string t, TextSpan s) => t.Substring(s.Start, s.Length);

    [Fact]
    public void Finds_RESPONSE_TEAMS_in_ticket_response_section()
    {
        var t = TestRepo.Read(SuiteId.TicketHelpers);
        var s = BlockLocator.FindValue(t, new(SuiteId.TicketHelpers, "TICKET RESPONSE HELPER", "RESPONSE_TEAMS"));
        Assert.StartsWith("{", Slice(t, s));
        Assert.EndsWith("}", Slice(t, s).TrimEnd());
        Assert.Contains("emeaTeam", Slice(t, s));
    }

    [Fact]
    public void SCRIPT_VERSION_is_found_per_section()
    {
        var t = TestRepo.Read(SuiteId.TicketHelpers);
        var core = Slice(t, BlockLocator.FindValue(t, new(SuiteId.TicketHelpers, null, "SCRIPT_VERSION")));
        var resp = Slice(t, BlockLocator.FindValue(t, new(SuiteId.TicketHelpers, "TICKET RESPONSE HELPER", "SCRIPT_VERSION")));
        Assert.Matches(@"^'\d+\.\d+(\.\d+)?'$", core);
        Assert.Matches(@"^'\d+\.\d+(\.\d+)?'$", resp);
        Assert.NotEqual(core, resp);
    }

    [Fact]
    public void Missing_block_throws_BlockNotFoundException()
    {
        var t = TestRepo.Read(SuiteId.TicketHelpers);
        var ex = Assert.Throws<BlockNotFoundException>(() =>
            BlockLocator.FindValue(t, new(SuiteId.TicketHelpers, "TICKET RESPONSE HELPER", "NO_SUCH_BLOCK")));
        Assert.Equal("NO_SUCH_BLOCK", ex.Block.ConstName);
    }

    [Fact]
    public void Block_outside_section_is_not_found()
    {
        var t = TestRepo.Read(SuiteId.TicketHelpers);
        Assert.Throws<BlockNotFoundException>(() =>
            BlockLocator.FindValue(t, new(SuiteId.TicketHelpers, "SLA ALERT BANNER", "RESPONSE_TEAMS")));
    }

    [Fact]
    public void Brackets_inside_strings_and_templates_do_not_end_block()
    {
        var t = "    /* === TOOL: X === */\n    const X = { a: '}', b: `{${'}'}`, c: /}/g, d: \"};\" /* } */ };\n    const Y = 1;\n";
        var v = Slice(t, BlockLocator.FindValue(t, new(SuiteId.Toolbar, "X", "X")));
        Assert.Equal("{ a: '}', b: `{${'}'}`, c: /}/g, d: \"};\" /* } */ }", v);
    }
}
