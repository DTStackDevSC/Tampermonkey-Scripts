using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

/// <summary>Small edits on JS nodes that keep the source layout of everything not touched.</summary>
public static class JsEdit
{
    public static string? Str(JsObject o, string key) => (o[key] as JsString)?.Value;

    public static bool Bool(JsObject o, string key) => o[key] is JsBool { Value: true };

    public static List<string> Strings(JsNode? n) =>
        n is JsArray a ? a.Items.OfType<JsString>().Select(s => s.Value).ToList() : new();

    /// <summary>Sets a string property. Null removes it; a missing property stays missing when the value is empty.</summary>
    public static void SetStr(JsObject o, string key, string? value)
    {
        if (value == null || (value.Length == 0 && !o.Has(key))) { o[key] = null; return; }
        o[key] = new JsString(value);
    }

    public static void SetBool(JsObject o, string key, bool value)
    {
        if (!value && !o.Has(key)) return;
        o[key] = new JsBool(value);
    }

    /// <summary>A copy of <paramref name="original"/> (keeping its layout) holding <paramref name="items"/>.</summary>
    public static JsArray Array(JsArray? original, IEnumerable<JsNode> items)
    {
        var a = original?.Clone() as JsArray ?? new JsArray();
        a.Items.Clear();
        a.Items.AddRange(items);
        return a;
    }

    /// <summary>A string array, reusing the original item nodes (and their comments) where the text is the same.</summary>
    public static JsArray StringArray(JsArray? original, IEnumerable<string> values)
    {
        var pool = original?.Items.ToList() ?? new List<JsNode>();
        var items = new List<JsNode>();
        foreach (var v in values)
        {
            var i = pool.FindIndex(n => n is JsString s && s.Value == v);
            if (i >= 0) { items.Add(pool[i].Clone()); pool.RemoveAt(i); }
            else items.Add(new JsString(v));
        }
        return Array(original, items);
    }

    /// <summary>Sets a string list property; an empty list does not create a missing property.</summary>
    public static void SetStrings(JsObject o, string key, IReadOnlyCollection<string> values)
    {
        if (values.Count == 0 && !o.Has(key)) return;
        o[key] = StringArray(o[key] as JsArray, values);
    }

    public static JsArray RequireArray(ConfigDocument doc, Script.BlockRef b) =>
        doc.Get(b) as JsArray ?? throw new InvalidOperationException($"{b.ConstName} is not available.");

    public static JsObject RequireObject(ConfigDocument doc, Script.BlockRef b) =>
        doc.Get(b) as JsObject ?? throw new InvalidOperationException($"{b.ConstName} is not available.");
}
