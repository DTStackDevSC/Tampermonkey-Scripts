using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;

namespace ConfigEditor.Core.Sections;

/// <summary>An option shown as "code: label" (GEOS, DLP_CRITERIA, ...).</summary>
public sealed class CodeLabel
{
    internal JsObject? Source;
    public CodeLabel(string code, string label) { Code = code; Label = label; }
    public string Code { get; set; }
    public string Label { get; set; }

    public static List<CodeLabel> Read(ConfigDocument doc, BlockRef b) =>
        JsEdit.RequireArray(doc, b).Items.OfType<JsObject>()
            .Select(o => new CodeLabel(JsEdit.Str(o, "code") ?? "", JsEdit.Str(o, "label") ?? "") { Source = o }).ToList();

    public static void Save(ConfigDocument doc, BlockRef b, IEnumerable<CodeLabel> rows) =>
        doc.Set(b, JsEdit.Array(JsEdit.RequireArray(doc, b), rows.Select(r => r.ToNode())));

    public JsObject ToNode()
    {
        var o = Source?.Clone() as JsObject ?? new JsObject { Inline = true };
        JsEdit.SetStr(o, "code", Code);
        JsEdit.SetStr(o, "label", Label);
        return o;
    }
}

/// <summary>A dropdown option with a shown label and a stored value (MF lists).</summary>
public sealed class LabelValue
{
    internal JsObject? Source;
    public LabelValue(string label, string value) { Label = label; Value = value; }
    public string Label { get; set; }
    public string Value { get; set; }

    public static List<LabelValue> FromArray(JsNode? n) =>
        n is JsArray a
            ? a.Items.OfType<JsObject>().Select(o => new LabelValue(JsEdit.Str(o, "label") ?? "", JsEdit.Str(o, "value") ?? "") { Source = o }).ToList()
            : new();

    public static List<LabelValue> Read(ConfigDocument doc, BlockRef b) => FromArray(JsEdit.RequireArray(doc, b));

    public static void Save(ConfigDocument doc, BlockRef b, IEnumerable<LabelValue> rows) =>
        doc.Set(b, JsEdit.Array(JsEdit.RequireArray(doc, b), rows.Select(r => r.ToNode())));

    public JsObject ToNode()
    {
        var o = Source?.Clone() as JsObject ?? new JsObject { Inline = true };
        JsEdit.SetStr(o, "label", Label);
        JsEdit.SetStr(o, "value", Value);
        return o;
    }
}

/// <summary>A plain list of texts (POLICY_TYPES, PRODUCT_OPTIONS, ...).</summary>
public static class StringList
{
    public static List<string> Read(ConfigDocument doc, BlockRef b) => JsEdit.Strings(JsEdit.RequireArray(doc, b));

    public static void Save(ConfigDocument doc, BlockRef b, IEnumerable<string> values) =>
        doc.Set(b, JsEdit.StringArray(JsEdit.RequireArray(doc, b), values));
}

/// <summary>One Netskope tenant group of the Ticket Subject Helper. The key is the shared storage key and never changes.</summary>
public sealed class TenantGroup
{
    internal JsObject? Source;
    public TenantGroup(string key, string label, List<string> mfs) { Key = key; Label = label; Mfs = mfs; }
    public string Key { get; }
    public string Label { get; set; }
    public List<string> Mfs { get; }

    public static List<TenantGroup> Read(ConfigDocument doc) =>
        JsEdit.RequireArray(doc, BlockCatalog.TenantGroups).Items.OfType<JsObject>()
            .Select(o => new TenantGroup(JsEdit.Str(o, "key") ?? "", JsEdit.Str(o, "label") ?? "", JsEdit.Strings(o["mfs"])) { Source = o })
            .ToList();

    public static void Save(ConfigDocument doc, IEnumerable<TenantGroup> groups) =>
        doc.Set(BlockCatalog.TenantGroups, JsEdit.Array(JsEdit.RequireArray(doc, BlockCatalog.TenantGroups), groups.Select(g => g.ToNode())));

    public JsObject ToNode()
    {
        var o = Source?.Clone() as JsObject ?? new JsObject { Inline = true };
        JsEdit.SetStr(o, "key", Key);
        JsEdit.SetStr(o, "label", Label);
        JsEdit.SetStrings(o, "mfs", Mfs);
        return o;
    }
}
