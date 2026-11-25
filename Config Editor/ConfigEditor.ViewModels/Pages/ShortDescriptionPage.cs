using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>The Short Description Builder options of one team.</summary>
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
    [ObservableProperty] private string complexityMediumFrom = "";
    [ObservableProperty] private string complexityHighFrom = "";
    [ObservableProperty] private string complexityHint = "";
    [ObservableProperty] private bool complexityHintIsError;

    partial void OnNameChanged(string value) => Write(t => t.Name = value);
    partial void OnShowVendorChanged(bool value) => Write(t => t.ShowVendor = value);
    partial void OnShowPERChanged(bool value) => Write(t => t.ShowPER = value);
    partial void OnComplexityNoteChanged(string value) => Write(t => t.ComplexityNote = value);
    partial void OnComplexityMediumFromChanged(string value) => WriteThresholds();
    partial void OnComplexityHighFromChanged(string value) => WriteThresholds();

    static int? ParseCount(string text) =>
        int.TryParse(text.Trim(), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : null;

    /// <summary>Writes the auto complexity limits only when both are valid; otherwise says what to fix and keeps the saved ones.</summary>
    void WriteThresholds()
    {
        if (loading || team == null) return;
        var medium = ParseCount(ComplexityMediumFrom);
        var high = ParseCount(ComplexityHighFrom);
        var problem = ShortDescriptionTeam.ThresholdProblem(medium, high);
        ComplexityHintIsError = problem != null;
        if (problem != null) { ComplexityHint = "Not saved: " + problem; return; }
        ComplexityHint = RangesText(medium!.Value, high!.Value);
        if (team.ComplexityMediumFrom == medium && team.ComplexityHighFrom == high) return;
        Write(t => { t.ComplexityMediumFrom = medium; t.ComplexityHighFrom = high; });
    }

    public static string RangesText(int medium, int high) =>
        $"0 to {medium - 1} comments = 1, {medium} to {high - 1} = 2, {high} or more = 3";

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
            var medium = team.ComplexityMediumFrom ?? ShortDescriptionTeam.DefaultMediumFrom;
            var high = team.ComplexityHighFrom ?? ShortDescriptionTeam.DefaultHighFrom;
            ComplexityMediumFrom = medium.ToString(System.Globalization.CultureInfo.InvariantCulture);
            ComplexityHighFrom = high.ToString(System.Globalization.CultureInfo.InvariantCulture);
            ComplexityHintIsError = false;
            ComplexityHint = RangesText(medium, high);
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
