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
}
