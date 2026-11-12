using System.Text.RegularExpressions;
using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Script;

public static class BlockLocator
{
    const string Marker = "/* === TOOL: ";

    public static TextSpan SectionBounds(string text, string? section)
    {
        var first = text.IndexOf(Marker, StringComparison.Ordinal);
        if (section == null) return new TextSpan(0, first < 0 ? text.Length : first);
        var start = text.IndexOf(Marker + section + " ===", StringComparison.Ordinal);
        if (start < 0) return new TextSpan(0, -1);
        var next = text.IndexOf(Marker, start + Marker.Length, StringComparison.Ordinal);
        return new TextSpan(start, (next < 0 ? text.Length : next) - start);
    }

    /// <summary>Span of the value after <c>const NAME =</c>, without the closing semicolon.</summary>
    public static TextSpan FindValue(string text, BlockRef r)
    {
        var sec = SectionBounds(text, r.Section);
        if (sec.Length < 0) throw new BlockNotFoundException(r);
        var re = new Regex(@"^[ \t]*const[ \t]+" + Regex.Escape(r.ConstName) + @"[ \t]*=[ \t]*", RegexOptions.Multiline);
        var m = re.Match(text, sec.Start, sec.Length);
        if (!m.Success) throw new BlockNotFoundException(r);
        var start = m.Index + m.Length;
        try
        {
            var end = JsReader.ParseAt(text, start, out _);
            return new TextSpan(start, end - start);
        }
        catch (JsParseException)
        {
            throw new BlockNotFoundException(r);
        }
    }

    /// <summary>Indentation of the line holding <c>const NAME =</c>.</summary>
    public static string IndentAt(string text, int valueStart)
    {
        var ls = text.LastIndexOf('\n', Math.Max(0, valueStart - 1)) + 1;
        var i = ls;
        while (i < text.Length && (text[i] == ' ' || text[i] == '\t')) i++;
        return text.Substring(ls, i - ls);
    }
}
