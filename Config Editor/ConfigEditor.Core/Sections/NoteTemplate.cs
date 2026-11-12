using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

/// <summary>Texts the Change Tracker writes for one entry type (NOTE_TEMPLATES). Entry types are fixed by the code.</summary>
public sealed class NoteTemplate
{
    JsObject? source;

    public NoteTemplate(string entryType) { EntryType = entryType; }
    public string EntryType { get; }
    public string WorkNoteHeader { get; set; } = "";
    public string CommentsHeader { get; set; } = "";
    /// <summary>Optional closing sentence; null or empty means none.</summary>
    public string? CommentsCloser { get; set; }

    public static NoteTemplate From(string entryType, JsObject o) => new(entryType)
    {
        source = o,
        WorkNoteHeader = JsEdit.Str(o, "workNoteHeader") ?? "",
        CommentsHeader = JsEdit.Str(o, "commentsHeader") ?? "",
        CommentsCloser = JsEdit.Str(o, "commentsCloser")
    };

    public JsObject ToNode()
    {
        var o = source?.Clone() as JsObject ?? new JsObject();
        JsEdit.SetStr(o, "workNoteHeader", WorkNoteHeader);
        JsEdit.SetStr(o, "commentsHeader", CommentsHeader);
        JsEdit.SetStr(o, "commentsCloser", string.IsNullOrEmpty(CommentsCloser) ? null : CommentsCloser);
        return o;
    }

    public static List<NoteTemplate> ReadAll(ConfigDocument doc) =>
        JsEdit.RequireObject(doc, BlockCatalog.NoteTemplates).Props
            .Where(p => p.Value is JsObject).Select(p => From(p.Key, (JsObject)p.Value)).ToList();

    public static void Save(ConfigDocument doc, IEnumerable<NoteTemplate> notes)
    {
        var root = (JsObject)JsEdit.RequireObject(doc, BlockCatalog.NoteTemplates).Clone();
        foreach (var n in notes)
            if (root.Has(n.EntryType)) root[n.EntryType] = n.ToNode();
        doc.Set(BlockCatalog.NoteTemplates, root);
    }
}
