using System.Text;

namespace ConfigEditor.Core.Js;

/// <summary>Converts response bodies between the template literal source and the text shown to editors.</summary>
public static class TemplateText
{
    public const string OpenedByName = "{Opened by name}";
    public const string TicketType = "{Ticket type}";

    /// <summary>Every placeholder a response body can hold: what the editor shows, the source expression and a sample value.</summary>
    public static readonly IReadOnlyList<(string Friendly, string Expr, string Sample)> Placeholders = new[]
    {
        (OpenedByName,          "${vars.openedByName}",     "Jane Doe"),
        (TicketType,            "${vars.pageType}",         "Request"),
        ("{Ticket number}",     "${vars.ticketNumber}",     "RITM0123456"),
        ("{Requested for}",     "${vars.requestedForName}", "Jane Smith"),
        ("{My name}",           "${vars.myName}",           "Alex Garcia"),
        ("{Today}",             "${vars.today}",            "2026-11-23"),
        ("{Short description}", "${vars.shortDescription}", "Allow access to example.com"),
        ("{Tenant}",            "${vars.tenant}",           "EMA"),
    };

    /// <summary>The body with every placeholder replaced by its sample value.</summary>
    public static string Preview(string friendly)
    {
        var s = friendly ?? "";
        foreach (var p in Placeholders) s = s.Replace(p.Friendly, p.Sample);
        return s;
    }

    public static string ToFriendly(string rawBody)
    {
        var sb = new StringBuilder(rawBody.Length);
        for (var i = 0; i < rawBody.Length; i++)
        {
            var c = rawBody[i];
            if (c == '\\' && i + 1 < rawBody.Length && "`\\$".IndexOf(rawBody[i + 1]) >= 0) { sb.Append(rawBody[++i]); continue; }
            var hit = Placeholders.FirstOrDefault(p => At(rawBody, i, p.Expr));
            if (hit.Expr != null) { sb.Append(hit.Friendly); i += hit.Expr.Length - 1; continue; }
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
            var hit = Placeholders.FirstOrDefault(p => At(friendly, i, p.Friendly));
            if (hit.Friendly != null) { sb.Append(hit.Expr); i += hit.Friendly.Length - 1; continue; }
            if (c == '`' || c == '\\' || (c == '$' && i + 1 < friendly.Length && friendly[i + 1] == '{')) sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }

    /// <summary>False when the body holds code other than the known placeholders, or escapes the editor cannot show.</summary>
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
                !Placeholders.Any(p => At(rawBody, i, p.Expr))) return false;
        }
        return true;
    }

    static bool At(string s, int i, string w) => i + w.Length <= s.Length && string.CompareOrdinal(s, i, w, 0, w.Length) == 0;
}
