using System.Collections.ObjectModel;
using System.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>The member firm and product lists of the Ticket Subject Helper, and which tenant each member firm uses.</summary>
public sealed class TicketSubjectPage : PageBase
{
    bool loading;

    public TicketSubjectPage(MainViewModel main) : base(main, false)
    {
        MfOptions = new(rows => { LabelValue.Save(Doc, BlockCatalog.MfOptions, rows.Select(r => r.Model)); Edited(); },
            () => new LabelValueRow(new LabelValue("New member firm", "")),
            r => new LabelValueRow(new LabelValue(r.Label + " (copy)", r.Value)));
        ProductOptions = TextList(v => StringList.Save(Doc, BlockCatalog.ProductOptions, v));
    }

    public EditableList<LabelValueRow> MfOptions { get; }
    public EditableList<TextRow> ProductOptions { get; }
    /// <summary>The five tenant groups are fixed by the code: only their label and member firms change.</summary>
    public ObservableCollection<TenantGroupRow> TenantGroups { get; } = new();

    void OnGroupChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (loading) return;
        TenantGroup.Save(Doc, TenantGroups.Select(g => g.Model));
        Edited();
    }

    protected override string? Load()
    {
        MfOptions.Load(LabelValue.Read(Doc, BlockCatalog.MfOptions).Select(m => new LabelValueRow(m)));
        ProductOptions.Load(Rows(StringList.Read(Doc, BlockCatalog.ProductOptions)));
        loading = true;
        foreach (var g in TenantGroups) g.PropertyChanged -= OnGroupChanged;
        TenantGroups.Clear();
        foreach (var g in TenantGroup.Read(Doc))
        {
            var row = new TenantGroupRow(g);
            row.PropertyChanged += OnGroupChanged;
            TenantGroups.Add(row);
        }
        loading = false;
        return null;
    }
}
