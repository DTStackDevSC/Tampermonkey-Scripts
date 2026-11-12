using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ConfigEditor.Core.Release;

namespace ConfigEditor.ViewModels;

public enum SaveMode { Save, Publish }

public sealed record SaveOutcome(bool Ok, string Message, IReadOnlyList<LinkItem> Links, bool ShowEmailReminder);

public partial class BulletRow : ObservableObject
{
    public BulletRow(ChangeItem item) { Item = item; text = item.Bullet; }
    public ChangeItem Item { get; }
    public string Tool => Item.ToolName;
    [ObservableProperty] private string text;
}

/// <summary>Shows what will change, lets the person reword the changelog bullets, then runs the save or publish.</summary>
public partial class SaveDialogViewModel : ObservableObject
{
    readonly IReadOnlyList<ChangeItem> generated;
    readonly Func<IReadOnlyList<ChangeItem>, IProgress<string>, Task<SaveOutcome>> run;
    readonly IDialogs dialogs;

    public SaveDialogViewModel(SaveMode mode, IReadOnlyList<ChangeItem> items, string destination,
        Func<IReadOnlyList<ChangeItem>, IProgress<string>, Task<SaveOutcome>> run, IDialogs dialogs)
    {
        Mode = mode; generated = items; Destination = destination; this.run = run; this.dialogs = dialogs;
        Bullets = new ObservableCollection<BulletRow>(items.Select(i => new BulletRow(i)));
    }

    public SaveMode Mode { get; }
    public string Title => Mode == SaveMode.Save ? "Save changes" : "Publish to GitHub";
    public string ConfirmText => Mode == SaveMode.Save ? "💾 Save files" : "🚀 Publish";
    public string Destination { get; }
    public ObservableCollection<BulletRow> Bullets { get; }
    public ObservableCollection<LinkItem> Links { get; } = new();

    [ObservableProperty] [NotifyPropertyChangedFor(nameof(IsReviewing))] private bool isBusy;
    [ObservableProperty] private string? busyText;
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(IsReviewing))] private bool isDone;
    [ObservableProperty] private string? resultText;
    [ObservableProperty] private bool resultOk;
    [ObservableProperty] private bool showEmailReminder;

    public bool IsReviewing => !IsBusy && !IsDone;
    public SaveOutcome? Outcome { get; private set; }
    public event Action? CloseRequested;

    /// <summary>The bullets as edited; empty rows are dropped, and all empty falls back to the generated ones.</summary>
    public IReadOnlyList<ChangeItem> EditedItems()
    {
        var edited = Bullets.Where(b => !string.IsNullOrWhiteSpace(b.Text))
            .Select(b => b.Item with { Bullet = b.Text.Trim() }).ToList();
        return edited.Count == 0 ? generated : edited;
    }

    [RelayCommand]
    async Task Confirm()
    {
        if (IsBusy || IsDone) return;
        IsBusy = true;
        BusyText = Mode == SaveMode.Save ? "⏳ Saving…" : "⏳ Publishing…";
        try
        {
            Outcome = await run(EditedItems(), new Progress<string>(t => BusyText = t));
        }
        catch (Exception e)
        {
            Outcome = new SaveOutcome(false, "❌ " + e.Message, Array.Empty<LinkItem>(), false);
        }
        finally
        {
            IsBusy = false;
        }
        ResultText = Outcome.Message;
        ResultOk = Outcome.Ok;
        foreach (var l in Outcome.Links) Links.Add(l);
        ShowEmailReminder = Outcome.ShowEmailReminder;
        IsDone = true;
    }

    [RelayCommand]
    void OpenLink(string? url) { if (!string.IsNullOrEmpty(url)) dialogs.OpenUrl(url); }

    [RelayCommand]
    void Close() { if (!IsBusy) CloseRequested?.Invoke(); }
}
