using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

/// <summary>One member firm name and its short code in the Ticket Assignment Tool (MF_CODE_MAP).</summary>
public sealed class MfCodeEntry
{
    JsProperty? source;

    public MfCodeEntry(string name, string code) { Name = name; Code = code; }
    public string Name { get; set; }
    public string Code { get; set; }

    public static List<MfCodeEntry> ReadAll(ConfigDocument doc) =>
        JsEdit.RequireObject(doc, BlockCatalog.MfCodeMap).Props
            .Where(p => p.Value is JsString)
            .Select(p => new MfCodeEntry(p.Key, ((JsString)p.Value).Value) { source = p }).ToList();

    public static void Save(ConfigDocument doc, IEnumerable<MfCodeEntry> entries)
    {
        var root = (JsObject)JsEdit.RequireObject(doc, BlockCatalog.MfCodeMap).Clone();
        var others = root.Props.Where(p => p.Value is not JsString).ToList();
        // New rows copy the quoting and the value column of the existing rows.
        var model = root.Props.LastOrDefault(p => p.Value is JsString && p.ValueGap != null);
        var column = model == null ? 0 : JsWriter.Quote(model.Key).Length + 1 + model.ValueGap!.Length;
        root.Props.Clear();
        foreach (var e in entries)
        {
            var p = e.source != null && e.source.Key == e.Name ? e.source.Clone() : new JsProperty(e.Name, new JsString(e.Code))
            {
                LeadingComment = e.source?.LeadingComment, BlankLineBefore = e.source?.BlankLineBefore ?? false,
                KeyQuoted = model?.KeyQuoted ?? true,
                ValueGap = new string(' ', Math.Max(1, column - JsWriter.Quote(e.Name).Length - 1))
            };
            if (p.Value is not JsString s || s.Value != e.Code) p.Value = new JsString(e.Code);
            if (!root.Has(p.Key)) root.Props.Add(p);
        }
        root.Props.AddRange(others);
        doc.Set(BlockCatalog.MfCodeMap, root);
    }
}
