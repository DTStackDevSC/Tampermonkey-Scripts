using System.Globalization;
using System.Text;
using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

public sealed record TeamInfo(string Key, string ShortLabel);

/// <summary>Teams live in three blocks (TEAMS, RESPONSE_TEAMS, DT_TEAMS); these helpers keep them in step.</summary>
public static class Teams
{
    public static List<TeamInfo> List(ConfigDocument doc) =>
        JsEdit.RequireArray(doc, BlockCatalog.DtTeams).Items.OfType<JsArray>()
            .Select(a => JsEdit.Strings(a)).Where(s => s.Count >= 2).Select(s => new TeamInfo(s[0], s[1])).ToList();

    public static string MakeKey(string displayName, IEnumerable<string> existingKeys)
    {
        var plain = new StringBuilder();
        foreach (var c in displayName.Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) plain.Append(c);
        var words = new List<string>();
        var w = new StringBuilder();
        foreach (var c in plain.ToString())
        {
            if (char.IsAsciiLetterOrDigit(c)) { w.Append(c); continue; }
            if (w.Length > 0) { words.Add(w.ToString()); w.Clear(); }
        }
        if (w.Length > 0) words.Add(w.ToString());
        var sb = new StringBuilder();
        foreach (var word in words)
        {
            var lower = word.ToLowerInvariant();
            sb.Append(sb.Length == 0 ? lower : char.ToUpperInvariant(lower[0]) + lower[1..]);
        }
        if (sb.Length == 0 || char.IsDigit(sb[0])) sb.Insert(0, "new");
        var key = sb.ToString();
        if (!key.EndsWith("Team", StringComparison.Ordinal)) key += "Team";
        var taken = existingKeys.ToHashSet();
        var result = key;
        for (var n = 2; taken.Contains(result); n++) result = key + n;
        return result;
    }

    static IEnumerable<string> AllKeys(ConfigDocument doc) =>
        JsEdit.RequireObject(doc, BlockCatalog.SdTeams).Props.Select(p => p.Key)
            .Concat(JsEdit.RequireObject(doc, BlockCatalog.ResponseTeams).Props.Select(p => p.Key))
            .Concat(List(doc).Select(t => t.Key));

    /// <summary>Adds a team copied from <paramref name="copyFromKey"/> and returns its key.</summary>
    public static string Add(ConfigDocument doc, string displayName, string shortLabel, string copyFromKey)
    {
        var key = MakeKey(displayName, AllKeys(doc));
        var comment = $"/// {shortLabel.ToUpperInvariant()} TEAM ///";
        foreach (var block in new[] { BlockCatalog.SdTeams, BlockCatalog.ResponseTeams })
        {
            var root = (JsObject)JsEdit.RequireObject(doc, block).Clone();
            var from = root.Props.FirstOrDefault(p => p.Key == copyFromKey && p.Value is JsObject)
                ?? root.Props.First(p => p.Value is JsObject);
            var team = (JsObject)from.Value.Clone();
            JsEdit.SetStr(team, "name", displayName);
            root.Props.Add(new JsProperty(key, team)
            {
                LeadingComment = comment,
                BlankLineBefore = from.BlankLineBefore,
                BlankLineAfterComment = from.BlankLineAfterComment
            });
            doc.Set(block, root);
        }
        var dt = JsEdit.RequireArray(doc, BlockCatalog.DtTeams);
        doc.Set(BlockCatalog.DtTeams, JsEdit.Array(dt, dt.Items.Append(JsEdit.StringArray(null, new[] { key, shortLabel }))));
        return key;
    }

    public static void Delete(ConfigDocument doc, string key)
    {
        if (List(doc).Count(t => t.Key != key) == 0 ||
            !JsEdit.RequireObject(doc, BlockCatalog.SdTeams).Props.Any(p => p.Key != key && p.Value is JsObject))
            throw new InvalidOperationException("The last team cannot be deleted.");
        foreach (var block in new[] { BlockCatalog.SdTeams, BlockCatalog.ResponseTeams })
        {
            var root = (JsObject)JsEdit.RequireObject(doc, block).Clone();
            root[key] = null;
            doc.Set(block, root);
        }
        var dt = JsEdit.RequireArray(doc, BlockCatalog.DtTeams);
        doc.Set(BlockCatalog.DtTeams, JsEdit.Array(dt, dt.Items.Where(i => !(i is JsArray a && JsEdit.Strings(a).FirstOrDefault() == key))));
    }
}
