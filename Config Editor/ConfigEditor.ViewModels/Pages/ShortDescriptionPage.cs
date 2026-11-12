using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>The Short Description Helper options of one team.</summary>
public sealed partial class ShortDescriptionPage : PageBase
{
    ShortDescriptionTeam? team;
    bool loading;

    public ShortDescriptionPage(MainViewModel main) : base(main, true)
    {
        MfOptions = new(rows => Write(t => t.MfOptions = rows.Select(r => r.Model).ToList()),
            () => new LabelValueRow(new LabelValue("New member firm", "")),
            r => new LabelValueRow(new LabelValue(r.Label + " (copy)", r.Value)));
        ProductOptions = TextList(v => Write(t => t.ProductOptions = v, false));
        StatusOptions = TextList(v => Write(t => t.StatusOptions = v, false));
        TypeOptions = TextList(v => Write(t => t.TypeOptions = v, false));
        ComplexityOptions = TextList(v => Write(t => t.ComplexityOptions = v, false));
    }

    public EditableList<LabelValueRow> MfOptions { get; }
    public EditableList<TextRow> ProductOptions { get; }
    public EditableList<TextRow> StatusOptions { get; }
    public EditableList<TextRow> TypeOptions { get; }
    public EditableList<TextRow> ComplexityOptions { get; }

    [ObservableProperty] private string name = "";
    [ObservableProperty] private bool showVendor;
    [ObservableProperty] private bool showPER;
    [ObservableProperty] private string complexityNote = "";

    partial void OnNameChanged(string value) => Write(t => t.Name = value);
    partial void OnShowVendorChanged(bool value) => Write(t => t.ShowVendor = value);
    partial void OnShowPERChanged(bool value) => Write(t => t.ShowPER = value);
    partial void OnComplexityNoteChanged(string value) => Write(t => t.ComplexityNote = value);

    void Write(Action<ShortDescriptionTeam> change, bool notify = true)
    {
        if (loading || team == null) return;
        change(team);
        ShortDescriptionTeam.Save(Doc, team);
        if (notify) Edited();
    }

    protected override string? Load()
    {
        team = ShortDescriptionTeam.ReadAll(Doc).FirstOrDefault(t => t.Key == Main.SelectedTeamKey);
        if (team == null) return "Pick a team at the top.";
        loading = true;
        try
        {
            Name = team.Name;
            ShowVendor = team.ShowVendor;
            ShowPER = team.ShowPER;
            ComplexityNote = team.ComplexityNote;
            MfOptions.Load(team.MfOptions.Select(m => new LabelValueRow(m)));
            ProductOptions.Load(Rows(team.ProductOptions));
            StatusOptions.Load(Rows(team.StatusOptions));
            TypeOptions.Load(Rows(team.TypeOptions));
            ComplexityOptions.Load(Rows(team.ComplexityOptions));
        }
        finally { loading = false; }
        return null;
    }
}
