using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ConfigEditor.Core.Js;

/// <summary>Reads a JS config value (object and array literals, strings, numbers, booleans, template functions).</summary>
public static class JsReader
{
    public static JsNode Parse(string valueText)
    {
        var p = new Parser(valueText);
        var i = p.SkipWs(0);
        var node = p.ParseValue(ref i);
        if (p.SkipWs(i) < valueText.Length && valueText[p.SkipWs(i)] != ';')
            throw new JsParseException("Unexpected text after value", i);
        return node;
    }

    /// <summary>Parses the value starting at <paramref name="start"/> and returns where it ends.</summary>
    public static int ParseAt(string text, int start, out JsNode node)
    {
        var p = new Parser(text);
        var i = start;
        node = p.ParseValue(ref i);
        return i;
    }

    sealed class Parser
    {
        static readonly Regex Number = new(@"\G-?(0[xX][0-9a-fA-F_]+|(\d[\d_]*(\.\d*)?|\.\d+)([eE][+-]?\d+)?)", RegexOptions.Compiled);
        static readonly Regex Arrow = new(@"\G(?:\(\s*([A-Za-z_$][\w$]*)?\s*\)|([A-Za-z_$][\w$]*))\s*=>\s*(?=`)", RegexOptions.Compiled);
        const string Terminators = ",}];";

        readonly string t;
        public Parser(string text) { t = text; }

        public int SkipWs(int i)
        {
            while (i < t.Length && char.IsWhiteSpace(t[i])) i++;
            return i;
        }

        int SkipWsAndComments(int i)
        {
            while (true)
            {
                i = SkipWs(i);
                var e = i < t.Length ? JsScan.SkipComment(t, i) : -1;
                if (e < 0) return i;
                i = e;
            }
        }

        bool AtTerminator(int i)
        {
            i = SkipWsAndComments(i);
            return i >= t.Length || Terminators.IndexOf(t[i]) >= 0;
        }

        public JsNode ParseValue(ref int i)
        {
            var start = i;
            JsNode? node = null;
            var end = i;
            try
            {
                node = ParseLiteral(ref end);
                if (!AtTerminator(end)) node = null;
            }
            catch (JsParseException)
            {
                node = null;
            }
            if (node == null)
            {
                end = JsScan.SkipExpression(t, start, Terminators);
                while (end > start && char.IsWhiteSpace(t[end - 1])) end--;
                if (end == start) throw new JsParseException("Expected a value", start);
                node = new JsRaw(t.Substring(start, end - start));
            }
            node.Origin = t.Substring(start, end - start);
            node.OriginKey = node.Canonical();
            i = end;
            return node;
        }

        JsNode? ParseLiteral(ref int i)
        {
            if (i >= t.Length) throw new JsParseException("Expected a value", i);
            var c = t[i];
            if (c == '{') return ParseObject(ref i);
            if (c == '[') return ParseArray(ref i);
            if (c == '\'' || c == '"') return new JsString(ReadString(ref i));
            var m = Arrow.Match(t, i);
            if (m.Success)
            {
                var bodyStart = m.Index + m.Length;
                var bodyEnd = JsScan.SkipTemplate(t, bodyStart);
                i = bodyEnd;
                var param = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Success ? m.Groups[2].Value : "";
                return new JsTemplateFn(param, t.Substring(bodyStart + 1, bodyEnd - bodyStart - 2).ReplaceLineEndings("\n"));
            }
            if (Word(i, "true")) { i += 4; return new JsBool(true); }
            if (Word(i, "false")) { i += 5; return new JsBool(false); }
            var n = Number.Match(t, i);
            if (n.Success && (i + n.Length >= t.Length || !JsScan.IsIdentPart(t[i + n.Length])))
            {
                i += n.Length;
                return new JsNumber(n.Value);
            }
            return null;
        }

        bool Word(int i, string w) =>
            string.CompareOrdinal(t, i, w, 0, w.Length) == 0 &&
            (i + w.Length >= t.Length || !JsScan.IsIdentPart(t[i + w.Length]));

        sealed record Trivia(List<string> Comments, bool BlankBefore, bool BlankAfterComment, bool NewLine);

        Trivia ReadTrivia(ref int i)
        {
            var comments = new List<string>();
            bool blankBefore = false, blankAfter = false, newLine = false;
            while (true)
            {
                var nl = 0;
                while (i < t.Length && char.IsWhiteSpace(t[i])) { if (t[i] == '\n') nl++; i++; }
                if (nl > 0) newLine = true;
                if (nl >= 2) { if (comments.Count == 0) blankBefore = true; else blankAfter = true; }
                else if (nl == 1 && comments.Count > 0) blankAfter = false;
                var e = i < t.Length ? JsScan.SkipComment(t, i) : -1;
                if (e < 0) break;
                comments.Add(t.Substring(i, e - i).TrimEnd().ReplaceLineEndings("\n"));
                blankAfter = false;
                i = e;
            }
            return new Trivia(comments, blankBefore, blankAfter, newLine);
        }

        string LineIndent(int i)
        {
            var ls = t.LastIndexOf('\n', Math.Max(0, i - 1)) + 1;
            var s = t.Substring(ls, i - ls);
            return s.Trim().Length == 0 ? s.TrimStart('\r') : "";
        }

        JsObject ParseObject(ref int i)
        {
            var o = new JsObject();
            var start = i;
            i++;
            var lastComma = false;
            while (true)
            {
                var gapStart = i;
                var tv = ReadTrivia(ref i);
                var gap = !tv.NewLine && tv.Comments.Count == 0 ? t.Substring(gapStart, i - gapStart) : null;
                if (i >= t.Length) throw new JsParseException("Unterminated object", start);
                if (t[i] == '}')
                {
                    if (tv.Comments.Count > 0) o.TrailingComment = string.Join("\n", tv.Comments);
                    if (tv.NewLine) o.CloseIndent = LineIndent(i);
                    o.BlankLineBeforeClose = tv.BlankBefore && tv.Comments.Count == 0;
                    o.BlankLineBeforeTrailingComment = tv.BlankBefore && tv.Comments.Count > 0;
                    o.CloseGap = gap;
                    i++;
                    break;
                }
                if (o.Props.Count > 0 && !lastComma) throw new JsParseException("Expected ,", i);
                if (o.Props.Count == 0 && tv.NewLine) o.ChildIndent = LineIndent(i);
                if (o.Props.Count == 0) o.OpenGap = gap;
                else if (o.Props.Count == 1) o.SeparatorGap = gap;
                string key;
                var quoted = t[i] == '\'' || t[i] == '"';
                if (quoted) key = ReadString(ref i);
                else if (JsScan.IsIdentStart(t[i]) || char.IsDigit(t[i]))
                {
                    var k = i;
                    while (i < t.Length && JsScan.IsIdentPart(t[i])) i++;
                    key = t.Substring(k, i - k);
                }
                else throw new JsParseException("Expected a property name", i);
                i = SkipWs(i);
                if (i >= t.Length || t[i] != ':') throw new JsParseException("Expected :", i);
                var colon = i;
                i = SkipWs(i + 1);
                var valueGap = t.Substring(colon + 1, i - colon - 1);
                var v = ParseValue(ref i);
                o.Props.Add(new JsProperty(key, v)
                {
                    LeadingComment = tv.Comments.Count > 0 ? string.Join("\n", tv.Comments) : null,
                    BlankLineBefore = tv.BlankBefore,
                    BlankLineAfterComment = tv.BlankAfterComment,
                    InlineGap = o.Props.Count > 0 ? gap : null,
                    ValueGap = valueGap.Contains('\n') ? null : valueGap,
                    KeyQuoted = quoted
                });
                var afterValue = SkipWs(i);
                lastComma = afterValue < t.Length && t[afterValue] == ',';
                if (lastComma) i = afterValue + 1;
            }
            o.TrailingComma = lastComma && o.Props.Count > 0;
            o.Inline = t.IndexOf('\n', start, i - start) < 0;
            return o;
        }

        JsArray ParseArray(ref int i)
        {
            var a = new JsArray();
            var start = i;
            i++;
            var lastComma = false;
            while (true)
            {
                var gapStart = i;
                var tv = ReadTrivia(ref i);
                var gap = !tv.NewLine && tv.Comments.Count == 0 ? t.Substring(gapStart, i - gapStart) : null;
                if (i >= t.Length) throw new JsParseException("Unterminated array", start);
                if (t[i] == ']')
                {
                    if (tv.Comments.Count > 0) a.TrailingComment = string.Join("\n", tv.Comments);
                    if (tv.NewLine) a.CloseIndent = LineIndent(i);
                    a.BlankLineBeforeClose = tv.BlankBefore && tv.Comments.Count == 0;
                    a.BlankLineBeforeTrailingComment = tv.BlankBefore && tv.Comments.Count > 0;
                    a.CloseGap = gap;
                    i++;
                    break;
                }
                if (a.Items.Count > 0 && !lastComma) throw new JsParseException("Expected ,", i);
                if (a.Items.Count == 0 && tv.NewLine) a.ChildIndent = LineIndent(i);
                if (a.Items.Count == 0) a.OpenGap = gap;
                else if (a.Items.Count == 1) a.SeparatorGap = gap;
                var v = ParseValue(ref i);
                v.LeadingComment = tv.Comments.Count > 0 ? string.Join("\n", tv.Comments) : null;
                v.BlankLineBefore = tv.BlankBefore;
                v.InlineGap = a.Items.Count > 0 ? gap : null;
                a.Items.Add(v);
                var afterValue = SkipWs(i);
                lastComma = afterValue < t.Length && t[afterValue] == ',';
                if (lastComma) i = afterValue + 1;
            }
            a.TrailingComma = lastComma && a.Items.Count > 0;
            a.Inline = t.IndexOf('\n', start, i - start) < 0;
            return a;
        }

        string ReadString(ref int i)
        {
            var start = i;
            var end = JsScan.SkipString(t, i);
            i = end;
            return Unescape(t, start + 1, end - 1);
        }

        static string Unescape(string t, int s, int e)
        {
            var sb = new StringBuilder(e - s);
            for (var i = s; i < e; i++)
            {
                var c = t[i];
                if (c != '\\') { sb.Append(c); continue; }
                var n = t[++i];
                switch (n)
                {
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'v': sb.Append('\v'); break;
                    case '0': sb.Append('\0'); break;
                    case 'x':
                        sb.Append((char)int.Parse(t.AsSpan(i + 1, 2), NumberStyles.HexNumber));
                        i += 2;
                        break;
                    case 'u':
                        if (t[i + 1] == '{')
                        {
                            var close = t.IndexOf('}', i);
                            sb.Append(char.ConvertFromUtf32(int.Parse(t.AsSpan(i + 2, close - i - 2), NumberStyles.HexNumber)));
                            i = close;
                        }
                        else
                        {
                            sb.Append((char)int.Parse(t.AsSpan(i + 1, 4), NumberStyles.HexNumber));
                            i += 4;
                        }
                        break;
                    case '\r':
                        if (i + 1 < e && t[i + 1] == '\n') i++;
                        break;
                    case '\n': break;
                    default: sb.Append(n); break;
                }
            }
            return sb.ToString();
        }
    }
}
