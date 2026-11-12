using System.Collections.ObjectModel;
using System.ComponentModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>A list of rows the user can add, copy, remove and reorder. Every change is written back at once.</summary>
public partial class EditableList<T> : ObservableObject where T : ObservableObject
{
    readonly Func<T>? create;
    readonly Func<T, T>? duplicate;
    readonly Action<IReadOnlyList<T>> write;
    bool loading;

    public EditableList(Action<IReadOnlyList<T>> write, Func<T>? create = null, Func<T, T>? duplicate = null)
    {
        this.write = write; this.create = create; this.duplicate = duplicate;
    }

    public ObservableCollection<T> Items { get; } = new();
    public bool CanAdd => create != null;
    public bool CanDuplicate => duplicate != null;

    /// <summary>Raised after every write, so the page can update dependent choices.</summary>
    public event Action? Changed;

    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(RemoveCommand), nameof(DuplicateCommand), nameof(MoveUpCommand), nameof(MoveDownCommand))]
    private T? selected;
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(RemoveText))] private bool removeArmed;
    [ObservableProperty] private string? message;

    public string RemoveText => RemoveArmed ? "Click again to remove" : "🗑 Remove";

    partial void OnSelectedChanged(T? value) => RemoveArmed = false;

    public void Load(IEnumerable<T> rows)
    {
        loading = true;
        foreach (var r in Items) r.PropertyChanged -= OnRowChanged;
        Items.Clear();
        foreach (var r in rows) { r.PropertyChanged += OnRowChanged; Items.Add(r); }
        Selected = Items.FirstOrDefault();
        RemoveArmed = false;
        Message = null;
        loading = false;
    }

    void OnRowChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (!loading) Commit();
    }

    public void Commit()
    {
        write(Items.ToList());
        Changed?.Invoke();
    }

    void Insert(T row)
    {
        row.PropertyChanged += OnRowChanged;
        var at = Selected == null ? Items.Count : Items.IndexOf(Selected) + 1;
        Items.Insert(at, row);
        Selected = row;
        Commit();
    }

    [RelayCommand]
    void Add()
    {
        if (create == null) return;
        Insert(create());
        Message = "➕ Added a new row below the selected one. Fill it in.";
    }

    bool HasSelection() => Selected != null;

    [RelayCommand(CanExecute = nameof(HasSelection))]
    void Duplicate()
    {
        if (duplicate == null || Selected == null) return;
        Insert(duplicate(Selected));
        Message = "📄 Copied. The copy is selected.";
    }

    [RelayCommand(CanExecute = nameof(HasSelection))]
    void Remove()
    {
        if (Selected == null) return;
        if (!RemoveArmed) { RemoveArmed = true; Message = "Click Remove again to delete the selected row."; return; }
        var row = Selected;
        var i = Items.IndexOf(row);
        row.PropertyChanged -= OnRowChanged;
        Items.RemoveAt(i);
        Selected = Items.Count == 0 ? null : Items[Math.Min(i, Items.Count - 1)];
        RemoveArmed = false;
        Commit();
        Message = "🗑 Removed.";
    }

    [RelayCommand(CanExecute = nameof(HasSelection))]
    void MoveUp() => Move(-1);

    [RelayCommand(CanExecute = nameof(HasSelection))]
    void MoveDown() => Move(1);

    void Move(int by)
    {
        if (Selected == null) return;
        var i = Items.IndexOf(Selected);
        var j = i + by;
        if (j < 0 || j >= Items.Count) { Message = by < 0 ? "ℹ️ Already at the top." : "ℹ️ Already at the bottom."; return; }
        var row = Selected;
        Items.Move(i, j);
        Selected = row;
        Commit();
        Message = by < 0 ? "⬆ Moved up." : "⬇ Moved down.";
    }
}
