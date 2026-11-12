using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.Core.Release;

public sealed record ChangeItem(BlockRef Block, string ToolName, string Bullet);

/// <summary>Turns the edited blocks into plain English, user facing changelog bullets.</summary>
public static class ChangeSummary
{
    static readonly Dictionary<BlockRef, string> OptionKinds = new()
    {
        [BlockCatalog.Geos] = "region",
        [BlockCatalog.PolicyTypes] = "policy type",
        [BlockCatalog.DlpPolicyTypes] = "DLP policy type",
        [BlockCatalog.AppliesTo] = "applies to",
        [BlockCatalog.PolicyChannelTypes] = "channel type",
        [BlockCatalog.DlpCriteria] = "DLP criteria",
        [BlockCatalog.MfOptions] = "member firm",
        [BlockCatalog.ProductOptions] = "product",
        [BlockCatalog.TenantGroups] = "tenant group",
    };

    public static IReadOnlyList<ChangeItem> Build(ConfigDocument original, ConfigDocument edited)
    {
        var items = new List<ChangeItem>();
        foreach (var b in BlockCatalog.All)
        {
            var before = original.Get(b);
            var after = edited.Get(b);
            if (before == null || after == null || before.Canonical() == after.Canonical()) continue;
            var tool = BlockCatalog.ToolName(b);
            var bullets = new List<string>();
            if (b == BlockCatalog.SdTeams) ShortDescription(original, edited, bullets);
            else if (b == BlockCatalog.ResponseTeams) Responses(original, edited, bullets);
            else if (b == BlockCatalog.NoteTemplates) Notes(original, edited, bullets);
            else if (b == BlockCatalog.MfCodeMap) MfCodes(original, edited, bullets);
            else if (b == BlockCatalog.DtTeams)
            {
                var dt = new List<string>();
                DtTeams(original, edited, dt);
                if (dt.Count == 0) dt.Add("Updated the team list.");
                foreach (var t in new[] { "Short Description Helper", "Ticket Response Helper" })
                    items.AddRange(dt.Select(x => new ChangeItem(b, t, x)));
                continue;
            }
            else if (OptionKinds.TryGetValue(b, out var kind)) Options(before, after, kind, null, bullets);
            if (bullets.Count == 0) bullets.Add($"Updated the {tool} settings.");
            items.AddRange(bullets.Select(x => new ChangeItem(b, tool, x)));
        }
        return items.Distinct().ToList();
    }

    static string TeamLabel(string name) =>
        name.TrimEnd().EndsWith("team", StringComparison.OrdinalIgnoreCase) ? name.Trim() : name.Trim() + " Team";

    static void TeamDiff<T>(List<T> before, List<T> after, Func<T, string> key, Func<T, string> name, List<string> bullets, Action<T, T, string> changed)
    {
        foreach (var a in after.Where(a => before.All(x => key(x) != key(a)))) bullets.Add($"Added the {TeamLabel(name(a))}.");
        foreach (var r in before.Where(r => after.All(x => key(x) != key(r)))) bullets.Add($"Removed the {TeamLabel(name(r))}.");
        foreach (var a in after)
        {
            var o = before.FirstOrDefault(x => key(x) == key(a));
            if (o == null) continue;
            if (name(o) != name(a)) bullets.Add($"Renamed the {TeamLabel(name(o))} to {TeamLabel(name(a))}.");
            changed(o, a, TeamLabel(name(a)));
        }
    }

    static void ListDiff(IReadOnlyList<string> before, IReadOnlyList<string> after, string kind, string team, List<string> bullets)
    {
        var added = after.Where(x => !before.Contains(x)).Distinct().ToList();
        var removed = before.Where(x => !after.Contains(x)).Distinct().ToList();
        foreach (var a in added) bullets.Add(team == null ? $"Added the {kind} option \"{a}\"." : $"Added the {kind} option \"{a}\" for the {team}.");
        foreach (var r in removed) bullets.Add(team == null ? $"Removed the {kind} option \"{r}\"." : $"Removed the {kind} option \"{r}\" for the {team}.");
        if (added.Count == 0 && removed.Count == 0 && !before.SequenceEqual(after))
            bullets.Add(team == null ? $"Updated the {kind} options." : $"Updated the {kind} options for the {team}.");
    }

    static void ShortDescription(ConfigDocument original, ConfigDocument edited, List<string> bullets) =>
        TeamDiff(ShortDescriptionTeam.ReadAll(original), ShortDescriptionTeam.ReadAll(edited), t => t.Key, t => t.Name, bullets, (o, a, team) =>
        {
            ListDiff(o.MfOptions.Select(x => x.Label).ToList(), a.MfOptions.Select(x => x.Label).ToList(), "member firm", team, bullets);
            if (o.MfOptions.Select(x => x.Label).SequenceEqual(a.MfOptions.Select(x => x.Label)) && !o.MfOptions.Select(x => x.Value).SequenceEqual(a.MfOptions.Select(x => x.Value)))
                bullets.Add($"Updated the member firm options for the {team}.");
            ListDiff(o.ProductOptions, a.ProductOptions, "product", team, bullets);
            ListDiff(o.StatusOptions, a.StatusOptions, "status", team, bullets);
            ListDiff(o.TypeOptions, a.TypeOptions, "type", team, bullets);
            ListDiff(o.ComplexityOptions, a.ComplexityOptions, "complexity", team, bullets);
            if (o.ShowVendor != a.ShowVendor || o.ShowPER != a.ShowPER || o.ComplexityNote != a.ComplexityNote)
                bullets.Add($"Updated the settings of the {team}.");
        });

    static void Responses(ConfigDocument original, ConfigDocument edited, List<string> bullets) =>
        TeamDiff(ResponseTeam.ReadAll(original), ResponseTeam.ReadAll(edited), t => t.Key, t => t.Name, bullets, (o, a, team) =>
        {
            foreach (var r in a.Responses)
            {
                var old = o.Responses.FirstOrDefault(x => x.Key == r.Key);
                if (old == null) { bullets.Add($"Added the {team} response \"{r.Label}\"."); continue; }
                if (old.BodyRaw != r.BodyRaw) bullets.Add($"Updated the text of the {team} response \"{r.Label}\".");
                if (old.Label != r.Label || old.Category != r.Category || old.FieldType != r.FieldType || old.Enabled != r.Enabled ||
                    old.StatusAfter != r.StatusAfter || old.HasSubmenu != r.HasSubmenu || old.ParentItem != r.ParentItem)
                    bullets.Add($"Updated the settings of the {team} response \"{r.Label}\".");
            }
            foreach (var r in o.Responses.Where(r => a.Responses.All(x => x.Key != r.Key)))
                bullets.Add($"Removed the {team} response \"{r.Label}\".");
            var keep = a.Responses.Select(x => x.Key).Where(k => o.Responses.Any(x => x.Key == k)).ToList();
            if (!keep.SequenceEqual(o.Responses.Select(x => x.Key).Where(keep.Contains)))
                bullets.Add($"Changed the order of the {team} responses.");
            if (!o.DefaultSectionOrder.SequenceEqual(a.DefaultSectionOrder))
                bullets.Add($"Changed the section order of the {team}.");
        });

    static void Notes(ConfigDocument original, ConfigDocument edited, List<string> bullets)
    {
        var before = NoteTemplate.ReadAll(original);
        foreach (var n in NoteTemplate.ReadAll(edited))
        {
            var o = before.FirstOrDefault(x => x.EntryType == n.EntryType);
            if (o == null || o.WorkNoteHeader != n.WorkNoteHeader || o.CommentsHeader != n.CommentsHeader ||
                (o.CommentsCloser ?? "") != (n.CommentsCloser ?? ""))
                bullets.Add($"Updated the ticket note texts for \"{n.EntryType}\" entries.");
        }
    }

    static void MfCodes(ConfigDocument original, ConfigDocument edited, List<string> bullets)
    {
        var before = MfCodeEntry.ReadAll(original);
        var after = MfCodeEntry.ReadAll(edited);
        foreach (var a in after)
        {
            var o = before.FirstOrDefault(x => x.Name == a.Name);
            if (o == null) bullets.Add($"Added the member firm \"{a.Name}\" with code {a.Code}.");
            else if (o.Code != a.Code) bullets.Add($"Changed the code of the member firm \"{a.Name}\" to {a.Code}.");
        }
        foreach (var r in before.Where(r => after.All(x => x.Name != r.Name)))
            bullets.Add($"Removed the member firm \"{r.Name}\".");
    }

    static void DtTeams(ConfigDocument original, ConfigDocument edited, List<string> bullets)
    {
        var names = ShortDescriptionTeam.ReadAll(edited).Concat(ShortDescriptionTeam.ReadAll(original))
            .GroupBy(t => t.Key).ToDictionary(g => g.Key, g => g.First().Name);
        string Name(TeamInfo t) => names.TryGetValue(t.Key, out var n) ? n : t.ShortLabel;
        TeamDiff(Teams.List(original), Teams.List(edited), t => t.Key, Name, bullets, (o, a, team) =>
        {
            if (o.ShortLabel != a.ShortLabel) bullets.Add($"Changed the short name of the {team} to {a.ShortLabel}.");
        });
    }

    /// <summary>Generic list diff for flat option blocks: items are compared by their visible text.</summary>
    static void Options(JsNode before, JsNode after, string kind, string? team, List<string> bullets)
    {
        var b = Labels(before);
        var a = Labels(after);
        ListDiff(b, a, kind, team!, bullets);
        if (b.SequenceEqual(a) && bullets.Count == 0) bullets.Add($"Updated the {kind} options.");
    }

    static List<string> Labels(JsNode n) => n switch
    {
        JsArray arr => arr.Items.Select(Label).ToList(),
        JsObject obj => obj.Props.Select(p => p.Value is JsObject o && Text(o) is { } t ? t : p.Key).ToList(),
        _ => new List<string>()
    };

    static string Label(JsNode n) => n switch
    {
        JsString s => s.Value,
        JsObject o => Text(o) ?? o.Canonical(),
        JsArray a => string.Join(", ", JsEdit.Strings(a)),
        _ => n.Canonical()
    };

    static string? Text(JsObject o)
    {
        foreach (var k in new[] { "label", "name", "value", "code" })
            if (o[k] is JsString s) return s.Value;
        return null;
    }
}
