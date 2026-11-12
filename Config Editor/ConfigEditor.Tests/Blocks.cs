using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;

namespace ConfigEditor.Tests;

static class Blocks
{
    public static JsNode Read(string text, BlockRef b)
    {
        var s = BlockLocator.FindValue(text, b);
        return JsReader.Parse(text.Substring(s.Start, s.Length));
    }

    public static string Slice(string text, BlockRef b)
    {
        var s = BlockLocator.FindValue(text, b);
        return text.Substring(s.Start, s.Length);
    }
}
