using System.Windows.Controls;
using System.Windows.Data;

namespace ConfigEditor.App.Controls;

/// <summary>Grid plus Add, Copy, Move and Remove buttons for any EditableList of the view models.</summary>
public partial class ListEditor : UserControl
{
    static readonly Dictionary<string, string> Headers = new()
    {
        ["Text"] = "Option",
        ["Code"] = "Code",
        ["Label"] = "Shown as",
        ["Value"] = "Stored value",
        ["Name"] = "Member firm name",
    };

    public ListEditor() => InitializeComponent();

    void OnAutoColumn(object? sender, DataGridAutoGeneratingColumnEventArgs e)
    {
        if (!Headers.TryGetValue(e.PropertyName, out var header)) { e.Cancel = true; return; }
        e.Column.Header = header;
        e.Column.Width = new DataGridLength(1, DataGridLengthUnitType.Star);
        // Every key press is kept, so Save never misses a cell that is still being edited.
        if (e.Column is DataGridTextColumn t && t.Binding is Binding b) b.UpdateSourceTrigger = UpdateSourceTrigger.PropertyChanged;
    }
}
