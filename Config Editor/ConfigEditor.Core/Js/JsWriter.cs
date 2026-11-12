using System.Text;
using System.Text.RegularExpressions;

namespace ConfigEditor.Core.Js;

public static class JsWriter
{
    const string Unit = "    ";
    const int MaxInline = 100;
    static readonly Regex Ident = new(@"^[A-Za-z_$][\w$]*$", RegexOptions.Compiled);

    /// <summary>
    /// Writes <paramref name="node"/> as JS. <paramref name="baseIndent"/> is the indentation of the line the value
    /// starts on. With <paramref name="preserveOriginal"/>, nodes unchanged since they were read keep their source text.
    /// </summary>
    public static string Write(JsNode node, string baseIndent, string newline, bool preserveOriginal = true)
    {
        var sb = new StringBuilder();
        new Emitter(newline, preserveOriginal).Emit(sb, node, baseIndent);
        return sb.ToString();
    }

    public static string Quote(string s)
    {
        var q = s.Contains('\'') && !s.Contains('"') ? '"' : '\'';
        var sb = new StringBuilder(s.Length + 2).Append(q);
        foreach (var c in s)
        {
            switch (c)
            {
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c == q) sb.Append('\\').Append(c);
                    else if (c < 0x20 || c == '\u2028' || c == '\u2029') sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append(q).ToString();
    }

    public static string Key(string k) => Ident.IsMatch(k) ? k : Quote(k);

    sealed class Emitter
    {
        readonly string nl;
        readonly bool preserve;
        public Emitter(string newline, bool preserveOriginal) { nl = newline; preserve = preserveOriginal; }

        string Eol(string s) => s.ReplaceLineEndings(nl);

        public void Emit(StringBuilder sb, JsNode node, string indent)
        {
            if (preserve && node.Origin != null && node.OriginKey == node.Canonical())
            {
                sb.Append(Eol(node.Origin));
                return;
            }
            switch (node)
            {
                case JsString s: sb.Append(Quote(s.Value)); break;
                case JsNumber n: sb.Append(n.Raw); break;
                case JsBool b: sb.Append(b.Value ? "true" : "false"); break;
                case JsRaw r: sb.Append(Eol(r.Text)); break;
                case JsTemplateFn f:
                    sb.Append('(').Append(f.Param).Append(") => `").Append(Eol(f.RawBody)).Append('`');
                    break;
                case JsObject o: EmitContainer(sb, o, indent, '{', '}', o.Props.Count, i => o.Props[i].Value,
                    i => (o.Props[i].LeadingComment, o.Props[i].BlankLineBefore, o.Props[i].BlankLineAfterComment),
                    i => (o.Props[i].KeyQuoted ? Quote(o.Props[i].Key) : Key(o.Props[i].Key)) + ":" + (o.Props[i].ValueGap ?? " "), i => o.Props[i].InlineGap); break;
                case JsArray a: EmitContainer(sb, a, indent, '[', ']', a.Items.Count, i => a.Items[i],
                    i => (a.Items[i].LeadingComment, a.Items[i].BlankLineBefore, false), _ => "", i => a.Items[i].InlineGap); break;
                default: throw new InvalidOperationException("Unknown node " + node.GetType().Name);
            }
        }

        static bool IsPrimitive(JsNode n) => n is JsString or JsNumber or JsBool;

        void EmitContainer(StringBuilder sb, JsContainer c, string indent, char open, char close, int count,
            Func<int, JsNode> value, Func<int, (string? Comment, bool Blank, bool BlankAfter)> trivia, Func<int, string> prefix,
            Func<int, string?> gap)
        {
            if (count == 0 && c.TrailingComment == null) { sb.Append(open).Append(close); return; }
            var anyComment = c.TrailingComment != null || Enumerable.Range(0, count).Any(i => trivia(i).Comment != null);
            string? inline = null;
            if (!anyComment && c.Inline != false)
            {
                var parts = new List<string>();
                for (var i = 0; i < count; i++)
                {
                    var v = value(i);
                    if (c.Inline == null && !IsPrimitive(v)) { parts = null; break; }
                    var part = new StringBuilder(prefix(i));
                    Emit(part, v, indent);
                    if (part.ToString().Contains('\n')) { parts = null; break; }
                    parts.Add(part.ToString());
                }
                if (parts != null)
                {
                    var pad = open == '{' ? " " : "";
                    var line = new StringBuilder().Append(open).Append(c.OpenGap ?? pad);
                    for (var i = 0; i < parts.Count; i++)
                    {
                        if (i > 0) line.Append(',').Append(gap(i) ?? c.SeparatorGap ?? " ");
                        line.Append(parts[i]);
                    }
                    inline = line.Append(c.CloseGap ?? pad).Append(close).ToString();
                    if (c.Inline == null && inline.Length > MaxInline) inline = null;
                }
            }
            if (inline != null) { sb.Append(inline); return; }

            var child = c.ChildIndent ?? indent + Unit;
            var closeIndent = c.CloseIndent ?? indent;
            sb.Append(open);
            for (var i = 0; i < count; i++)
            {
                var (comment, blank, blankAfter) = trivia(i);
                sb.Append(nl);
                if (blank || (comment != null && i > 0)) sb.Append(nl);
                if (comment != null)
                {
                    sb.Append(child).Append(Eol(comment)).Append(nl);
                    if (blankAfter) sb.Append(nl);
                }
                sb.Append(child).Append(prefix(i));
                Emit(sb, value(i), child);
                if (i < count - 1 || c.TrailingComma) sb.Append(',');
            }
            if (c.TrailingComment != null && c.BlankLineBeforeTrailingComment) sb.Append(nl);
            if (c.TrailingComment != null) sb.Append(nl).Append(child).Append(Eol(c.TrailingComment));
            if (c.BlankLineBeforeClose) sb.Append(nl);
            sb.Append(nl).Append(closeIndent).Append(close);
        }
    }
}
