using System.Text;

namespace ConfigEditor.Core.Js;

/// <summary>Converts response bodies between the template literal source and the text shown to editors.</summary>
public static class TemplateText
{
    public const string OpenedByName = "{Opened by name}";
    public const string TicketType = "{Ticket type}";
    const string OpenedByExpr = "${vars.openedByName}";
    const string TicketTypeExpr = "${vars.pageType}";

    public static string ToFriendly(string rawBody)
    {
        var sb = new StringBuilder(rawBody.Length);
        for (var i = 0; i < rawBody.Length; i++)
        {
            var c = rawBody[i];
            if (c == '\\' && i + 1 < rawBody.Length && "`\\$".IndexOf(rawBody[i + 1]) >= 0) { sb.Append(rawBody[++i]); continue; }
            if (At(rawBody, i, OpenedByExpr)) { sb.Append(OpenedByName); i += OpenedByExpr.Length - 1; continue; }
            if (At(rawBody, i, TicketTypeExpr)) { sb.Append(TicketType); i += TicketTypeExpr.Length - 1; continue; }
            sb.Append(c);
        }
        return sb.ToString();
    }

    public static string FromFriendly(string friendly)
    {
        var sb = new StringBuilder(friendly.Length + 16);
        for (var i = 0; i < friendly.Length; i++)
        {
            var c = friendly[i];
            if (At(friendly, i, OpenedByName)) { sb.Append(OpenedByExpr); i += OpenedByName.Length - 1; continue; }
            if (At(friendly, i, TicketType)) { sb.Append(TicketTypeExpr); i += TicketType.Length - 1; continue; }
            if (c == '`' || c == '\\' || (c == '$' && i + 1 < friendly.Length && friendly[i + 1] == '{')) sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }

    /// <summary>False when the body holds code other than the two known placeholders, or escapes the editor cannot show.</summary>
    public static bool IsEditable(string rawBody)
    {
        for (var i = 0; i < rawBody.Length; i++)
        {
            var c = rawBody[i];
            if (c == '\\')
            {
                if (i + 1 >= rawBody.Length || "`\\$".IndexOf(rawBody[i + 1]) < 0) return false;
                i++;
                continue;
            }
            if (c == '$' && i + 1 < rawBody.Length && rawBody[i + 1] == '{' &&
                !At(rawBody, i, OpenedByExpr) && !At(rawBody, i, TicketTypeExpr)) return false;
        }
        return true;
    }

    static bool At(string s, int i, string w) => string.CompareOrdinal(s, i, w, 0, w.Length) == 0;
}
