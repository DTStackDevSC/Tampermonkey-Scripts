using System.ComponentModel;
using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>Base of every section page: reads its data when a session opens (and when the team changes for team pages).</summary>
public abstract partial class PageBase : ObservableObject
{
    protected PageBase(MainViewModel main, bool perTeam)
    {
        Main = main;
        main.SessionOpened += Reload;
        if (perTeam)
            main.PropertyChanged += (_, e) => { if (e.PropertyName == nameof(MainViewModel.SelectedTeamKey)) Reload(); };
    }

    public MainViewModel Main { get; }
    protected ConfigDocument Doc => Main.Session!.Edited;

    /// <summary>False while there is nothing to show; <see cref="EmptyText"/> says why.</summary>
    [ObservableProperty] private bool hasData;
    [ObservableProperty] private string emptyText = "Nothing opened yet.";

    void Reload()
    {
        if (Main.Session == null) { HasData = false; EmptyText = "Nothing opened yet."; return; }
        try
        {
            var why = Load();
            HasData = why == null;
            EmptyText = why ?? "";
        }
        catch (InvalidOperationException e)
        {
            HasData = false;
            EmptyText = "This section could not be read: " + e.Message;
        }
    }

    /// <summary>Reads the page data from the document. Returns null when loaded, or the reason it shows nothing.</summary>
    protected abstract string? Load();

    /// <summary>Called by the page after it wrote to the document.</summary>
    protected void Edited() => Main.NotifyEdited();

    protected static List<TextRow> Rows(IEnumerable<string> values) => values.Select(v => new TextRow(v)).ToList();

    protected EditableList<TextRow> TextList(Action<List<string>> save) =>
        new(rows => { save(rows.Select(r => r.Text).ToList()); Edited(); }, () => new TextRow("New option"), r => new TextRow(r.Text));
}
