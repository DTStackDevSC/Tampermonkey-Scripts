using System.Text;
using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

/// <summary>One canned response: its menu entry (responseMetadata), its on/off state (enabledResponses) and its text (responses).</summary>
public sealed class ResponseItem
{
    internal JsObject? SourceMeta;
    internal JsNode? SourceBody;

    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public string Category { get; set; } = "";
    public string? FieldType { get; set; }
    public bool Enabled { get; set; }
    /// <summary>Status the short description switches to after inserting, or null for none.</summary>
    public string? StatusAfter { get; set; }
    public bool HasSubmenu { get; set; }
    public string? ParentItem { get; set; }
    /// <summary>Template literal source of the text, or null when the response has no text of its own.</summary>
    public string? BodyRaw { get; set; }
    /// <summary>False when the text holds code the editor cannot show safely.</summary>
    public bool BodyEditable => SourceBody == null || SourceBody is JsTemplateFn && (BodyRaw == null || TemplateText.IsEditable(BodyRaw));

    internal JsObject MetaNode()
    {
        var o = SourceMeta?.Clone() as JsObject ?? new JsObject();
        JsEdit.SetStr(o, "label", Label);
        JsEdit.SetStr(o, "category", Category);
        if (HasSubmenu) o["hasSubmenu"] = new JsBool(true); else o["hasSubmenu"] = null;
        JsEdit.SetStr(o, "parentItem", string.IsNullOrEmpty(ParentItem) ? null : ParentItem);
        JsEdit.SetStr(o, "fieldType", FieldType);
        SetStatus(o);
        return o;
    }

    void SetStatus(JsObject o)
    {
        var original = o["shortDescTransforms"] as JsArray;
        var items = original?.Items.ToList() ?? new List<JsNode>();
        var i = items.FindIndex(n => n is JsObject t && JsEdit.Str(t, "field") == "status");
        if (StatusAfter == null)
        {
            if (i < 0) return;
            items.RemoveAt(i);
        }
        else if (i >= 0)
        {
            var t = (JsObject)items[i].Clone();
            JsEdit.SetStr(t, "value", StatusAfter);
            items[i] = t;
        }
        else
        {
            var t = new JsObject { Inline = true };
            t["field"] = new JsString("status");
            t["value"] = new JsString(StatusAfter);
            items.Add(t);
        }
        o["shortDescTransforms"] = items.Count == 0 ? null
            : JsEdit.Array(original ?? new JsArray { Inline = true }, items);
    }

    internal JsNode? BodyNode()
    {
        if (BodyRaw == null) return SourceBody;
        if (SourceBody is JsTemplateFn fn)
        {
            var c = (JsTemplateFn)fn.Clone();
            c.RawBody = BodyRaw;
            return c;
        }
        return SourceBody != null && !BodyEditable ? SourceBody : new JsTemplateFn("vars", BodyRaw);
    }
}

/// <summary>One team of the Ticket Response Helper (RESPONSE_TEAMS).</summary>
public sealed class ResponseTeam
{
    JsObject? source;

    public ResponseTeam(string key) { Key = key; }
    public string Key { get; }
    public string Name { get; set; } = "";
    public List<string> DefaultSectionOrder { get; set; } = new();
    /// <summary>Enabled responses in menu order, then the disabled ones.</summary>
    public List<ResponseItem> Responses { get; set; } = new();

    public static ResponseTeam From(string key, JsObject o)
    {
        var team = new ResponseTeam(key)
        {
            source = o,
            Name = JsEdit.Str(o, "name") ?? "",
            DefaultSectionOrder = JsEdit.Strings(o["defaultSectionOrder"])
        };
        var meta = o["responseMetadata"] as JsObject ?? new JsObject();
        var bodies = o["responses"] as JsObject ?? new JsObject();
        var enabled = JsEdit.Strings(o["enabledResponses"]).Where(meta.Has).Distinct().ToList();
        foreach (var k in enabled.Concat(meta.Props.Select(p => p.Key).Where(k => !enabled.Contains(k))))
        {
            if (meta[k] is not JsObject m) continue;
            var transform = (m["shortDescTransforms"] as JsArray)?.Items.OfType<JsObject>()
                .FirstOrDefault(t => JsEdit.Str(t, "field") == "status");
            var body = bodies[k];
            team.Responses.Add(new ResponseItem
            {
                SourceMeta = m,
                SourceBody = body,
                Key = k,
                Label = JsEdit.Str(m, "label") ?? "",
                Category = JsEdit.Str(m, "category") ?? "",
                FieldType = JsEdit.Str(m, "fieldType"),
                Enabled = enabled.Contains(k),
                StatusAfter = transform == null ? null : JsEdit.Str(transform, "value"),
                HasSubmenu = JsEdit.Bool(m, "hasSubmenu"),
                ParentItem = JsEdit.Str(m, "parentItem"),
                BodyRaw = (body as JsTemplateFn)?.RawBody
            });
        }
        return team;
    }

    public JsObject ToNode()
    {
        var o = source?.Clone() as JsObject ?? new JsObject();
        JsEdit.SetStr(o, "name", Name);
        JsEdit.SetStrings(o, "defaultSectionOrder", DefaultSectionOrder);

        var origMeta = o["responseMetadata"] as JsObject;
        var keep = Responses.Select(r => r.Key).ToHashSet();
        var removed = origMeta?.Props.Select(p => p.Key).Where(k => !keep.Contains(k)).ToList() ?? new();

        var meta = origMeta?.Clone() as JsObject ?? new JsObject();
        foreach (var k in removed) meta[k] = null;
        foreach (var r in Responses) meta[r.Key] = r.MetaNode();
        o["responseMetadata"] = meta;

        // The menu shows enabledResponses in its own order, so the editor's order is written there.
        var origEnabled = o["enabledResponses"] as JsArray;
        var origKeys = JsEdit.Strings(origEnabled);
        var orphans = origKeys.Where(k => origMeta == null || !origMeta.Has(k)).Where(k => !removed.Contains(k)).ToList();
        var wanted = Responses.Where(r => r.Enabled).Select(r => r.Key).ToList();
        if (!wanted.SequenceEqual(origKeys.Where(k => !orphans.Contains(k)).Distinct()))
            o["enabledResponses"] = JsEdit.StringArray(origEnabled, wanted.Concat(orphans));

        var bodies = o["responses"] as JsObject;
        var newBodies = bodies?.Clone() as JsObject ?? new JsObject();
        foreach (var k in removed) newBodies[k] = null;
        foreach (var r in Responses)
        {
            var b = r.BodyNode();
            if (b != null) newBodies[r.Key] = b;
        }
        if (bodies != null || newBodies.Props.Count > 0) o["responses"] = newBodies;
        return o;
    }

    /// <summary>A free camelCase key made from a label ("Printer help" gives "printerHelp").</summary>
    public static string NewKey(string label, ResponseTeam team)
    {
        var sb = new StringBuilder();
        var upper = false;
        foreach (var c in label)
        {
            if (!char.IsAsciiLetterOrDigit(c)) { upper = sb.Length > 0; continue; }
            sb.Append(sb.Length == 0 ? char.ToLowerInvariant(c) : upper ? char.ToUpperInvariant(c) : c);
            upper = false;
        }
        if (sb.Length == 0 || char.IsDigit(sb[0])) sb.Insert(0, "response");
        var baseKey = sb.ToString();
        var taken = team.Responses.Select(r => r.Key).ToHashSet();
        if (team.source?["responses"] is JsObject b) taken.UnionWith(b.Props.Select(p => p.Key));
        var key = baseKey;
        for (var n = 2; taken.Contains(key); n++) key = baseKey + n;
        return key;
    }

    public static List<ResponseTeam> ReadAll(ConfigDocument doc) =>
        JsEdit.RequireObject(doc, BlockCatalog.ResponseTeams).Props
            .Where(p => p.Value is JsObject).Select(p => From(p.Key, (JsObject)p.Value)).ToList();

    public static void Save(ConfigDocument doc, ResponseTeam team)
    {
        var root = (JsObject)JsEdit.RequireObject(doc, BlockCatalog.ResponseTeams).Clone();
        root[team.Key] = team.ToNode();
        doc.Set(BlockCatalog.ResponseTeams, root);
    }
}
