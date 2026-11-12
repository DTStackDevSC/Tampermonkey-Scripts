using System.Collections.ObjectModel;
using System.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>The texts the Change Tracker writes into tickets, one card per entry type.</summary>
public sealed class NoteTextsPage : PageBase
{
    bool loading;

    public NoteTextsPage(MainViewModel main) : base(main, false) { }

    public ObservableCollection<NoteTemplateRow> Notes { get; } = new();

    void OnChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (loading) return;
        NoteTemplate.Save(Doc, Notes.Select(n => n.Model));
        Edited();
    }

    protected override string? Load()
    {
        loading = true;
        foreach (var n in Notes) n.PropertyChanged -= OnChanged;
        Notes.Clear();
        foreach (var n in NoteTemplate.ReadAll(Doc))
        {
            var row = new NoteTemplateRow(n);
            row.PropertyChanged += OnChanged;
            Notes.Add(row);
        }
        loading = false;
        return null;
    }
}
