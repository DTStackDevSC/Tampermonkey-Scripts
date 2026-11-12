using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>The option lists of the Policy Naming Helper.</summary>
public sealed class PolicyNamingPage : PageBase
{
    public PolicyNamingPage(MainViewModel main) : base(main, false)
    {
        Geos = CodeLabels(BlockCatalog.Geos);
        AppliesTo = CodeLabels(BlockCatalog.AppliesTo);
        PolicyChannelTypes = CodeLabels(BlockCatalog.PolicyChannelTypes);
        DlpCriteria = CodeLabels(BlockCatalog.DlpCriteria);
        PolicyTypes = TextList(v => StringList.Save(Doc, BlockCatalog.PolicyTypes, v));
        DlpPolicyTypes = TextList(v => StringList.Save(Doc, BlockCatalog.DlpPolicyTypes, v));
    }

    public EditableList<CodeLabelRow> Geos { get; }
    public EditableList<TextRow> PolicyTypes { get; }
    public EditableList<TextRow> DlpPolicyTypes { get; }
    public EditableList<CodeLabelRow> AppliesTo { get; }
    public EditableList<CodeLabelRow> PolicyChannelTypes { get; }
    public EditableList<CodeLabelRow> DlpCriteria { get; }

    EditableList<CodeLabelRow> CodeLabels(BlockRef b) =>
        new(rows => { CodeLabel.Save(Doc, b, rows.Select(r => r.Model)); Edited(); },
            () => new CodeLabelRow(new CodeLabel("NEW", "New option")),
            r => new CodeLabelRow(new CodeLabel(r.Code, r.Label + " (copy)")));

    protected override string? Load()
    {
        Geos.Load(CodeLabel.Read(Doc, BlockCatalog.Geos).Select(m => new CodeLabelRow(m)));
        AppliesTo.Load(CodeLabel.Read(Doc, BlockCatalog.AppliesTo).Select(m => new CodeLabelRow(m)));
        PolicyChannelTypes.Load(CodeLabel.Read(Doc, BlockCatalog.PolicyChannelTypes).Select(m => new CodeLabelRow(m)));
        DlpCriteria.Load(CodeLabel.Read(Doc, BlockCatalog.DlpCriteria).Select(m => new CodeLabelRow(m)));
        PolicyTypes.Load(Rows(StringList.Read(Doc, BlockCatalog.PolicyTypes)));
        DlpPolicyTypes.Load(Rows(StringList.Read(Doc, BlockCatalog.DlpPolicyTypes)));
        return null;
    }
}
