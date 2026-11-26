using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GitHelper.Core;

namespace GitHelper.ViewModels;

public partial class CloneViewModel : ObservableObject
{
    readonly GhCli gh;
    readonly IDialogs dialogs;
    readonly IAppSettings settings;

    public CloneViewModel(GhCli gh, IDialogs dialogs, IAppSettings settings)
    {
        this.gh = gh; this.dialogs = dialogs; this.settings = settings;
        parentFolder = settings.CloneFolder ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "GitHub");
    }

    public ObservableCollection<string> Repos { get; } = new();

    /// <summary>The folder of the new clone once it worked.</summary>
    public string? ClonedPath { get; private set; }
    public event Action? CloseRequested;

    [ObservableProperty] [NotifyPropertyChangedFor(nameof(TargetText))] [NotifyCanExecuteChangedFor(nameof(CloneCommand))] private string repo = "";
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(TargetText))] [NotifyCanExecuteChangedFor(nameof(CloneCommand))] private string parentFolder;
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(CloneCommand), nameof(LoadReposCommand), nameof(BrowseCommand))] private bool isBusy;
    [ObservableProperty] private string? busyText;
    [ObservableProperty] private string? message;
    [ObservableProperty] private StatusKind messageKind = StatusKind.Info;
    [ObservableProperty] private bool listLoaded;

    public string TargetText => string.IsNullOrWhiteSpace(Repo)
        ? "Pick or type a repository to see where it goes."
        : $"It will be copied to {Path.Combine(ParentFolder, GhCli.FolderNameFor(Repo))}";

    public string CloneHint => "Pick a repository and a folder first.";

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task LoadReposAsync()
    {
        IsBusy = true; BusyText = "Loading your repositories from GitHub…";
        Say(StatusKind.Working, "🔄 Loading your repositories…");
        try
        {
            var list = await gh.RepoListAsync();
            Repos.Clear();
            foreach (var r in list) Repos.Add(r);
            ListLoaded = true;
            Say(list.Count == 0 ? StatusKind.Warning : StatusKind.Info,
                list.Count == 0 ? "⚠️ No repositories came back. Are you signed in to GitHub? You can still paste owner/name or a link."
                                : $"ℹ️ {list.Count} repositories found. Pick one or type another.");
        }
        finally { IsBusy = false; BusyText = null; }
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    void Browse()
    {
        var f = dialogs.PickFolder("Folder that will hold the copy", ParentFolder);
        if (f != null) ParentFolder = f;
    }

    bool CanClone() => !IsBusy && !string.IsNullOrWhiteSpace(Repo) && !string.IsNullOrWhiteSpace(ParentFolder);

    [RelayCommand(CanExecute = nameof(CanClone))]
    async Task CloneAsync()
    {
        var name = GhCli.FolderNameFor(Repo);
        var target = Path.Combine(ParentFolder, name);
        if (Directory.Exists(target) && Directory.EnumerateFileSystemEntries(target).Any())
        {
            Say(StatusKind.Error, $"❌ {target} already exists and is not empty. Open it with 📁 Open repo, or pick another folder.");
            return;
        }
        IsBusy = true; BusyText = $"Cloning {Repo.Trim()}… big repositories take a while.";
        Say(StatusKind.Working, $"⏳ Cloning {Repo.Trim()}…");
        try
        {
            Directory.CreateDirectory(ParentFolder);
            var r = await gh.CloneAsync(Repo, ParentFolder, name);
            if (!r.Ok)
            {
                Say(StatusKind.Error, "❌ " + Explain.Failure("Clone", r));
                return;
            }
            settings.CloneFolder = ParentFolder;
            settings.Save(); // only remembers the folder; the clone itself worked
            ClonedPath = target;
            Say(StatusKind.Success, "✅ Cloned.");
            CloseRequested?.Invoke();
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            Say(StatusKind.Error, $"❌ Could not create the folder: {e.Message}");
        }
        finally { IsBusy = false; BusyText = null; }
    }

    bool NotBusy() => !IsBusy;

    void Say(StatusKind kind, string text) { MessageKind = kind; Message = text; }
}
