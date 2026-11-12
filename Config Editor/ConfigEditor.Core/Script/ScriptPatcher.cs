using System.Text;
using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Script;

public static class ScriptPatcher
{
    public static string NewlineOf(string text)
    {
        var i = text.IndexOf('\n');
        return i > 0 && text[i - 1] == '\r' ? "\r\n" : "\n";
    }

    /// <summary>Replaces the value of each changed block; everything else stays byte for byte.</summary>
    public static string Apply(string text, IReadOnlyDictionary<BlockRef, JsNode> changed)
    {
        if (changed.Count == 0) return text;
        var nl = NewlineOf(text);
        var edits = changed
            .Select(kv => (Span: BlockLocator.FindValue(text, kv.Key), Node: kv.Value))
            .OrderByDescending(e => e.Span.Start)
            .ToList();
        var sb = new StringBuilder(text);
        foreach (var (span, node) in edits)
        {
            var written = JsWriter.Write(node, BlockLocator.IndentAt(text, span.Start), nl);
            sb.Remove(span.Start, span.Length).Insert(span.Start, written);
        }
        return sb.ToString();
    }
}
