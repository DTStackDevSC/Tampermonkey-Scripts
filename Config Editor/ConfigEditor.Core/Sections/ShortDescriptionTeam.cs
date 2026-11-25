using ConfigEditor.Core.Js;

namespace ConfigEditor.Core.Sections;

/// <summary>One team of the Short Description Builder (TEAMS). Properties the editor does not know are kept.</summary>
public sealed class ShortDescriptionTeam
{
    JsObject? source;

    public ShortDescriptionTeam(string key) { Key = key; }
    public string Key { get; }
    public string Name { get; set; } = "";
    public List<LabelValue> MfOptions { get; set; } = new();
    public List<string> ProductOptions { get; set; } = new();
    public List<string> StatusOptions { get; set; } = new();
    public List<string> TypeOptions { get; set; } = new();
    public List<string> ComplexityOptions { get; set; } = new();
    public bool ShowVendor { get; set; }
    public bool ShowPER { get; set; }
    public string ComplexityNote { get; set; } = "";
    /// <summary>Auto complexity: Additional comments count from which a ticket is Complexity 2 (default 16).</summary>
    public int? ComplexityMediumFrom { get; set; }
    /// <summary>Auto complexity: Additional comments count from which a ticket is Complexity 3 (default 26).</summary>
    public int? ComplexityHighFrom { get; set; }

    public const int DefaultMediumFrom = 16;
    public const int DefaultHighFrom = 26;

    /// <summary>Why the two limits cannot be saved, or null when they are fine. The script falls back to 16 and 26 otherwise.</summary>
    public static string? ThresholdProblem(int? mediumFrom, int? highFrom)
    {
        if (mediumFrom == null || highFrom == null) return "Enter both numbers.";
        if (mediumFrom < 1) return "Complexity 2 must start at 1 comment or more.";
        if (highFrom <= mediumFrom) return "Complexity 3 must start higher than Complexity 2.";
        if (highFrom > 100000) return "Complexity 3 must start at 100000 comments or fewer.";
        return null;
    }

    public static ShortDescriptionTeam From(string key, JsObject o) => new(key)
    {
        source = o,
        Name = JsEdit.Str(o, "name") ?? "",
        MfOptions = LabelValue.FromArray(o["mfOptions"]),
        ProductOptions = JsEdit.Strings(o["productOptions"]),
        StatusOptions = JsEdit.Strings(o["statusOptions"]),
        TypeOptions = JsEdit.Strings(o["typeOptions"]),
        ComplexityOptions = JsEdit.Strings(o["complexityOptions"]),
        ShowVendor = JsEdit.Bool(o, "showVendor"),
        ShowPER = JsEdit.Bool(o, "showPER"),
        ComplexityNote = JsEdit.Str(o, "complexityNote") ?? "",
        ComplexityMediumFrom = JsEdit.Int(o, "complexityMediumFrom"),
        ComplexityHighFrom = JsEdit.Int(o, "complexityHighFrom")
    };

    public JsObject ToNode()
    {
        var o = source?.Clone() as JsObject ?? new JsObject();
        JsEdit.SetStr(o, "name", Name);
        if (MfOptions.Count > 0 || o.Has("mfOptions"))
            o["mfOptions"] = JsEdit.Array(o["mfOptions"] as JsArray, MfOptions.Select(m => m.ToNode()));
        JsEdit.SetStrings(o, "productOptions", ProductOptions);
        JsEdit.SetStrings(o, "statusOptions", StatusOptions);
        JsEdit.SetStrings(o, "typeOptions", TypeOptions);
        JsEdit.SetStrings(o, "complexityOptions", ComplexityOptions);
        JsEdit.SetBool(o, "showVendor", ShowVendor);
        JsEdit.SetBool(o, "showPER", ShowPER);
        JsEdit.SetStr(o, "complexityNote", ComplexityNote);
        JsEdit.SetInt(o, "complexityMediumFrom", ComplexityMediumFrom);
        JsEdit.SetInt(o, "complexityHighFrom", ComplexityHighFrom);
        return o;
    }

    public static List<ShortDescriptionTeam> ReadAll(ConfigDocument doc) =>
        JsEdit.RequireObject(doc, BlockCatalog.SdTeams).Props
            .Where(p => p.Value is JsObject).Select(p => From(p.Key, (JsObject)p.Value)).ToList();

    public static void Save(ConfigDocument doc, ShortDescriptionTeam team)
    {
        var root = (JsObject)JsEdit.RequireObject(doc, BlockCatalog.SdTeams).Clone();
        root[team.Key] = team.ToNode();
        doc.Set(BlockCatalog.SdTeams, root);
    }
}
