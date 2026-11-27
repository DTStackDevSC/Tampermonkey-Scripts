using ConfigEditor.Core.Js;

namespace ConfigEditor.Tests;

public class TemplateTextTests
{
    [Theory, InlineData("a`b"), InlineData("C:\\path"), InlineData("cost ${5}"), InlineData("{Opened by name} hi"), InlineData("{Ticket type} and \\` done")]
    public void Friendly_round_trip(string s) => Assert.Equal(s, TemplateText.ToFriendly(TemplateText.FromFriendly(s)));

    [Fact]
    public void Placeholders_map_to_friendly_names()
    {
        Assert.Equal("Hi @[{Opened by name}], your {Ticket type}", TemplateText.ToFriendly("Hi @[${vars.openedByName}], your ${vars.pageType}"));
        Assert.Equal("Hi ${vars.openedByName} \\` \\${x}", TemplateText.FromFriendly("Hi {Opened by name} ` ${x}"));
    }

    [Fact]
    public void IsEditable_false_for_unknown_expression()
    {
        Assert.False(TemplateText.IsEditable("a ${x.y} b"));
        Assert.True(TemplateText.IsEditable("a ${vars.pageType} \\${not} b"));
    }

    [Fact]
    public void NewPlaceholdersRoundTrip()
    {
        const string friendly = "Hi {Requested for} ({Opened by email}), {Ticket number} ({Short description}) is done in {Tenant} on {Today}. {My name}";
        var raw = TemplateText.FromFriendly(friendly);
        Assert.Equal("Hi ${vars.requestedForName} (${vars.openedByEmail}), ${vars.ticketNumber} (${vars.shortDescription}) is done in ${vars.tenant} on ${vars.today}. ${vars.myName}", raw);
        Assert.True(TemplateText.IsEditable(raw));
        Assert.Equal(friendly, TemplateText.ToFriendly(raw));
        Assert.Equal("Hi Jane Smith (jane.doe@example.com), RITM0123456 (Allow access to example.com) is done in EMA on 2026-11-23. Alex Garcia", TemplateText.Preview(friendly));
    }
}
