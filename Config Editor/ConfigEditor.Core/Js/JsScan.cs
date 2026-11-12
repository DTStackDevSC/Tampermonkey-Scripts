namespace ConfigEditor.Core.Js;

/// <summary>Low level helpers that step over JS strings, templates, comments, regexes and bracketed code.</summary>
internal static class JsScan
{
    public static bool IsIdentStart(char c) => char.IsLetter(c) || c == '_' || c == '$';
    public static bool IsIdentPart(char c) => char.IsLetterOrDigit(c) || c == '_' || c == '$';

    public static int SkipString(string t, int i)
    {
        var q = t[i++];
        while (i < t.Length)
        {
            var c = t[i];
            if (c == '\\') { i += 2; continue; }
            if (c == q) return i + 1;
            if (c == '\n') throw new JsParseException("Unterminated string", i);
            i++;
        }
        throw new JsParseException("Unterminated string", i);
    }

    public static int SkipTemplate(string t, int i)
    {
        i++;
        while (i < t.Length)
        {
            var c = t[i];
            if (c == '\\') { i += 2; continue; }
            if (c == '`') return i + 1;
            if (c == '$' && i + 1 < t.Length && t[i + 1] == '{')
            {
                i = SkipExpression(t, i + 2, "}");
                i++;
                continue;
            }
            i++;
        }
        throw new JsParseException("Unterminated template literal", i);
    }

    /// <summary>Returns the index after a comment starting at <paramref name="i"/>, or -1 when there is none.</summary>
    public static int SkipComment(string t, int i)
    {
        if (i + 1 >= t.Length || t[i] != '/') return -1;
        if (t[i + 1] == '/')
        {
            var e = t.IndexOf('\n', i);
            return e < 0 ? t.Length : e;
        }
        if (t[i + 1] == '*')
        {
            var e = t.IndexOf("*/", i + 2, StringComparison.Ordinal);
            if (e < 0) throw new JsParseException("Unterminated comment", i);
            return e + 2;
        }
        return -1;
    }

    static bool RegexAllowed(string t, int i)
    {
        var j = i - 1;
        while (j >= 0 && (t[j] == ' ' || t[j] == '\t')) j--;
        if (j < 0 || t[j] == '\n' || t[j] == '\r') return true;
        if ("(,=:[!&|?{};".IndexOf(t[j]) >= 0) return true;
        if (t[j] == '>' && j > 0 && t[j - 1] == '=') return true;
        var k = j;
        while (k >= 0 && IsIdentPart(t[k])) k--;
        var word = t.Substring(k + 1, j - k);
        return word is "return" or "typeof" or "case" or "in" or "of";
    }

    public static int SkipRegex(string t, int i)
    {
        i++;
        var inClass = false;
        while (i < t.Length)
        {
            var c = t[i];
            if (c == '\\') { i += 2; continue; }
            if (c == '\n') throw new JsParseException("Unterminated regex", i);
            if (c == '[') inClass = true;
            else if (c == ']') inClass = false;
            else if (c == '/' && !inClass)
            {
                i++;
                while (i < t.Length && IsIdentPart(t[i])) i++;
                return i;
            }
            i++;
        }
        throw new JsParseException("Unterminated regex", i);
    }

    /// <summary>
    /// Steps over code until a character from <paramref name="stops"/> appears at bracket depth 0,
    /// returning its index (or the end of the text).
    /// </summary>
    public static int SkipExpression(string t, int i, string stops)
    {
        var depth = 0;
        while (i < t.Length)
        {
            var c = t[i];
            if (depth == 0 && stops.IndexOf(c) >= 0) return i;
            switch (c)
            {
                case '\'': case '"': i = SkipString(t, i); continue;
                case '`': i = SkipTemplate(t, i); continue;
                case '(': case '[': case '{': depth++; break;
                case ')': case ']': case '}':
                    if (depth == 0) return i;
                    depth--;
                    break;
                case '/':
                    var e = SkipComment(t, i);
                    if (e >= 0) { i = e; continue; }
                    if (RegexAllowed(t, i)) { i = SkipRegex(t, i); continue; }
                    break;
            }
            i++;
        }
        return i;
    }
}

public sealed class JsParseException : Exception
{
    public JsParseException(string message, int position) : base($"{message} at offset {position}") { Position = position; }
    public int Position { get; }
}
