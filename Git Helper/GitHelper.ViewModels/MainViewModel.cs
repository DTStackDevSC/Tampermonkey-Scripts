using System.Collections.ObjectModel;
using System.Reflection;
using System.Text;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GitHelper.Core;

namespace GitHelper.ViewModels;

public partial class MainViewModel : ObservableObject
{
    static readonly TimeSpan ArmWindow = TimeSpan.FromSeconds(5);
    /// <summary>Calls shown in the Output panel; read only calls (status, log...) would only add noise.</summary>
    static readonly HashSet<string> LoggedVerbs =
        ["push", "pull", "fetch", "commit", "add", "switch", "restore", "rm", "clean", "reset", "rebase", "merge",
         "cherry-pick", "revert", "repo", "auth", "config"];
    const int OutputLimit = 60_000;

    readonly ICommandRunner runner;
    readonly IDialogs dialogs;
    readonly IAppSettings settings;
    readonly TimeProvider clock;
    readonly GhCli gh;
    readonly StringBuilder output = new();
    RepoStatus? repoStatus;
    bool loadingBranches;
    DateTimeOffset discardArmedAt, undoArmedAt, abortArmedAt;
    int diffRequest;

    readonly string? appFolder;

    /// <param name="appFolder">The folder the app runs from; with the setting on, its repository is pulled at start.</param>
    public MainViewModel(ICommandRunner runner, IDialogs dialogs, IAppSettings settings, TimeProvider? clock = null, string? appFolder = null)
    {
        this.runner = runner; this.dialogs = dialogs; this.settings = settings; this.appFolder = appFolder;
        this.clock = clock ?? TimeProvider.System;
        gh = new GhCli(runner);
        runner.Ran += OnRan;
        foreach (var r in settings.RecentRepos) RecentRepos.Add(r);
    }

    public static string Version =>
        typeof(MainViewModel).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "1.0.0";

    public GitRepo? Repo { get; private set; }
    public ObservableCollection<string> RecentRepos { get; } = new();
    public ObservableCollection<FileItem> Files { get; } = new();
    public ObservableCollection<BranchItem> Branches { get; } = new();
    public ObservableCollection<CommitInfo> Commits { get; } = new();
    public ObservableCollection<DiffLine> DiffLines { get; } = new();

    [ObservableProperty] private string title = "No repository open";
    [ObservableProperty] private string? repoPath;
    [ObservableProperty] private string syncText = "";
    [ObservableProperty] private StatusKind syncKind = StatusKind.Info;
    [ObservableProperty] private string identityText = "";
    [ObservableProperty] private bool identityWarning;
    [ObservableProperty] private string ghText = "Checking GitHub sign in…";
    [ObservableProperty] [NotifyPropertyChangedFor(nameof(ShowSignIn))] private GhUser? ghUser;
    [ObservableProperty] private bool ghChecked;
    [ObservableProperty] private string? webUrl;
    [ObservableProperty] private BranchItem? selectedBranch;
    [ObservableProperty] private string newBranchName = "";
    [ObservableProperty] private FileItem? selectedFile;
    [ObservableProperty] private string commitMessage = "";
    [ObservableProperty] private string diffTitle = "Click a file to see what changed.";
    [ObservableProperty] private bool isDiffBusy;
    [ObservableProperty] private RepoOperation operation;
    [ObservableProperty] private string operationText = "";
    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private string? busyText;
    [ObservableProperty] private string status = "Starting…";
    [ObservableProperty] private StatusKind statusKind = StatusKind.Info;
    [ObservableProperty] private string outputText = "";
    [ObservableProperty] private bool gitMissing;
    [ObservableProperty] private bool discardArmed;
    [ObservableProperty] private bool undoArmed;
    [ObservableProperty] private bool abortArmed;
    [ObservableProperty] private string? selectedRecent;

    public bool HasRepo => Repo != null;
    public bool ShowSignIn => GhUser == null;
    public bool ShowOperation => Operation != RepoOperation.None;
    public bool CanContinue => Operation == RepoOperation.Rebase;
    public int CheckedCount => Files.Count(f => f.IsChecked);
    public string FilesHeader => Files.Count == 0 ? "No changes" : $"Changes ({CheckedCount} of {Files.Count} ticked)";
    public bool? AllChecked
    {
        get => Files.Count == 0 ? false : Files.All(f => f.IsChecked) ? true : Files.Any(f => f.IsChecked) ? null : false;
        set
        {
            var v = value != false;
            foreach (var f in Files) f.IsChecked = v;
        }
    }

    public string DiscardText => DiscardArmed && SelectedFile != null ? $"Click again to discard {SelectedFile.FileName}" : "↩ Discard";
    public string UndoText => UndoArmed ? "Click again to undo the commit" : "↶ Undo last commit";
    public string AbortText => AbortArmed ? "Click again to abort" : "✖ Abort";

    /// <summary>Why Commit is off, shown under the button. Empty when it can run.</summary>
    public string CommitHint =>
        GitMissing ? "Git was not found on this PC." :
        Repo == null ? "Open a repository first." :
        Operation == RepoOperation.Rebase ? "A pull is halfway: fix the files, then use Continue in the yellow bar." :
        Files.Count == 0 ? "Nothing to commit: no file changed." :
        CheckedCount == 0 ? "Tick at least one file to commit." :
        string.IsNullOrWhiteSpace(CommitMessage) ? "Write a short message that says what you changed." : "";

    public string PushHint =>
        Repo == null ? "Open a repository first." :
        repoStatus?.Detached == true ? "You are not on a branch. Pick a branch first." :
        repoStatus?.NoCommitsYet == true ? "Commit something first." :
        Operation != RepoOperation.None ? "Finish or abort the pull in the yellow bar first." : "";

    public string UndoHint =>
        Commits.Count == 0 ? "No commits yet." :
        !Commits[0].Unpushed ? "The last commit is already on GitHub, so it cannot be taken back here." :
        Commits.Count < 2 ? "The first commit of a repository cannot be undone here." :
        Operation != RepoOperation.None ? "Finish or abort the pull in the yellow bar first." : "";

    public string DiscardHint => Files.Count == 0 ? "" : SelectedFile == null ? "To discard changes, click a file in the list first." :
        SelectedFile.Change.IsConflict ? "A file with a conflict cannot be discarded alone: use Abort in the yellow bar." : "";

    // ---------------------------------------------------------------- start and open

    [RelayCommand]
    async Task StartAsync()
    {
        await Busy("Checking Git and GitHub on this PC…", async () =>
        {
            var git = await GitRepo.VersionAsync(runner, GitRepo.Git);
            if (git == null)
            {
                GitMissing = true;
                Say(StatusKind.Error, "❌ Git was not found on this PC. Install Git for Windows (git-scm.com), then open the app again.");
                return;
            }
            await CheckGhAsync();
            var update = await UpdateAppRepoAsync();
            if (settings.LastRepo is { } last && Directory.Exists(last))
            {
                BusyText = "Opening the repository…";
                await OpenPathAsync(last);
                if (update != null && StatusKind == StatusKind.Success) Say(update.Value.Kind, $"{update.Value.Text} {Strip(Status)}");
                return;
            }
            if (update != null) { Say(update.Value.Kind, update.Value.Text); return; }
            Say(StatusKind.Info, $"ℹ️ {git} ready. Open a repository or clone one to start.");
        });
        // Just restarted into a new version: say so first, so the user sees the update worked.
        if (UpdatedFrom != null && UpdatedFrom != Version)
            Say(StatusKind == StatusKind.Info ? StatusKind.Success : StatusKind, $"✅ Git Helper updated from {UpdatedFrom} to {Version}. {Strip(Status)}");
    }

    /// <summary>The version the app ran before it updated itself and restarted (from --updated-from), else null.</summary>
    public string? UpdatedFrom { get; set; }

    /// <summary>
    /// Pulls the repository the app runs from, so it is always up to date (setting on by default).
    /// Never leaves it halfway: a pull that stops on a conflict is aborted. Null when there is nothing to say.
    /// </summary>
    public async Task<(StatusKind Kind, string Text)?> UpdateAppRepoAsync()
    {
        if (!settings.PullAppRepoOnStart || string.IsNullOrEmpty(appFolder)) return null;
        var root = await GitRepo.FindRootAsync(runner, appFolder);
        if (root == null) return null;
        var app = new GitRepo(runner, root);
        BusyText = $"Updating {app.Name} from GitHub…";
        var st = await app.StatusAsync();
        if (st.Detached || !st.HasUpstream) return (StatusKind.Info, $"ℹ️ {app.Name} was not updated: its branch is not linked to GitHub.");
        var before = (await app.RunAsync("rev-parse", "HEAD")).StdOut.Trim();
        var r = await app.PullAsync(settings.PullRebase);
        if (!r.Ok)
        {
            var op = await app.OperationAsync();
            if (op != RepoOperation.None) await app.AbortAsync(op);
            return (StatusKind.Warning, $"⚠️ {app.Name} could not be updated, it was left as it was. " + Explain.Failure("Pull", r).Replace("Pull failed. ", ""));
        }
        var after = (await app.RunAsync("rev-parse", "HEAD")).StdOut.Trim();
        var n = before == after ? 0 : int.TryParse((await app.RunAsync("rev-list", "--count", $"{before}..{after}")).StdOut.Trim(), out var c) ? c : 0;
        return n == 0 ? (StatusKind.Success, $"✅ {app.Name} is up to date.")
                      : (StatusKind.Success, $"✅ {app.Name} updated with {n} new commit{(n == 1 ? "" : "s")}.");
    }

    async Task CheckGhAsync()
    {
        var ghVersion = await GitRepo.VersionAsync(runner, GhCli.Gh);
        if (ghVersion == null)
        {
            GhUser = null;
            GhText = "GitHub CLI (gh) not found: Clone and Sign in need it.";
        }
        else
        {
            GhUser = await gh.UserAsync();
            GhText = GhUser != null ? $"GitHub: signed in as {GhUser.Login}" : "GitHub: not signed in";
        }
        GhChecked = true;
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task OpenRepoAsync()
    {
        var folder = dialogs.PickFolder("Pick a folder inside a git repository", RepoPath);
        if (folder == null) { Say(StatusKind.Info, "ℹ️ No folder picked."); return; }
        await Busy("Opening the repository…", () => OpenPathAsync(folder));
    }

    partial void OnSelectedRecentChanged(string? value)
    {
        if (value == null || IsBusy || string.Equals(value, RepoPath, StringComparison.OrdinalIgnoreCase)) return;
        _ = Busy("Opening the repository…", () => OpenPathAsync(value));
    }

    /// <summary>Opens a folder (inside Busy). Public for the tests.</summary>
    public async Task OpenPathAsync(string folder)
    {
        var root = await GitRepo.FindRootAsync(runner, folder);
        if (root == null)
        {
            Say(StatusKind.Error, $"❌ {folder} is not inside a git repository. Pick another folder, or use ⬇ Clone to get one from GitHub.");
            if (string.Equals(settings.LastRepo, folder, StringComparison.OrdinalIgnoreCase)) { settings.LastRepo = null; settings.Save(); }
            return;
        }
        Repo = new GitRepo(runner, root);
        RepoPath = root;
        Title = Repo.Name;
        settings.LastRepo = root;
        settings.RecentRepos.RemoveAll(r => string.Equals(r, root, StringComparison.OrdinalIgnoreCase));
        settings.RecentRepos.Insert(0, root);
        if (settings.RecentRepos.Count > 10) settings.RecentRepos.RemoveRange(10, settings.RecentRepos.Count - 10);
        settings.Save();
        RecentRepos.Clear();
        foreach (var r in settings.RecentRepos) RecentRepos.Add(r);
        SelectedRecent = root;
        OnPropertyChanged(nameof(HasRepo));
        await LoadAsync();
        Say(StatusKind.Success, $"✅ Opened {Repo.Name}. {FilesSummary()}");
    }

    string FilesSummary() => Files.Count switch
    {
        0 => "No uncommitted changes.",
        1 => "1 file changed.",
        _ => $"{Files.Count} files changed.",
    };

    /// <summary>Reads everything again from the folder. Runs inside Busy.</summary>
    public async Task LoadAsync()
    {
        if (Repo == null) return;
        var keep = Files.Where(f => !f.IsChecked).Select(f => f.Path).ToHashSet();
        var selected = SelectedFile?.Path;
        repoStatus = await Repo.StatusAsync();
        Operation = await Repo.OperationAsync();
        OperationText = Operation switch
        {
            RepoOperation.Rebase => "⚠️ A pull stopped halfway because the same lines changed here and on GitHub. Fix the files marked !, then Continue. Or Abort to go back.",
            RepoOperation.Merge => "⚠️ A merge is halfway. Fix the files marked !, then commit them. Or Abort to go back.",
            RepoOperation.CherryPick => "⚠️ A cherry pick is halfway. Fix the files marked !, then commit, or Abort.",
            RepoOperation.Revert => "⚠️ A revert is halfway. Fix the files marked !, then commit, or Abort.",
            _ => "",
        };

        Files.Clear();
        foreach (var f in repoStatus.Files.OrderBy(f => f.Path, StringComparer.OrdinalIgnoreCase))
            Files.Add(new FileItem(f, OnTick) { IsChecked = !keep.Contains(f.Path) });
        SelectedFile = Files.FirstOrDefault(f => f.Path == selected);
        if (SelectedFile == null) { DiffLines.Clear(); DiffTitle = Files.Count == 0 ? "No changes to show." : "Click a file to see what changed."; }

        var remotes = await Repo.RemotesAsync();
        WebUrl = GitRepo.WebUrl(remotes.Contains("origin") ? await Repo.RemoteUrlAsync() : null);
        SyncText = repoStatus switch
        {
            { Detached: true } => "⚠️ Not on a branch (detached). Pick a branch in the list.",
            { NoCommitsYet: true } => "ℹ️ No commits yet.",
            _ when remotes.Count == 0 => "ℹ️ Only on this PC: the repository has no GitHub remote.",
            { HasUpstream: false } => "ℹ️ This branch is not on GitHub yet. ⬆ Push creates it.",
            { Ahead: 0, Behind: 0 } => $"✅ In step with {repoStatus.Upstream} (as of the last check).",
            _ => string.Join(" · ", new[]
            {
                repoStatus.Ahead > 0 ? $"↑ {repoStatus.Ahead} to push" : null,
                repoStatus.Behind > 0 ? $"↓ {repoStatus.Behind} to pull" : null,
            }.Where(s => s != null)) + $" (vs {repoStatus.Upstream})",
        };
        SyncKind = repoStatus.Detached ? StatusKind.Warning : repoStatus.Ahead > 0 || repoStatus.Behind > 0 ? StatusKind.Warning : StatusKind.Info;

        loadingBranches = true;
        try
        {
            var (local, remoteOnly) = await Repo.BranchesAsync();
            Branches.Clear();
            foreach (var b in local) Branches.Add(new BranchItem(b, false));
            foreach (var b in remoteOnly) Branches.Add(new BranchItem(b, true));
            SelectedBranch = Branches.FirstOrDefault(b => !b.RemoteOnly && b.Name == repoStatus.Branch);
        }
        finally { loadingBranches = false; }

        Commits.Clear();
        if (!repoStatus.NoCommitsYet)
            foreach (var c in await Repo.LogAsync(40, repoStatus.HasUpstream)) Commits.Add(c);

        var id = await Repo.IdentityAsync();
        var wanted = WantedIdentity;
        IdentityWarning = !id.IsSet || (wanted != null && !id.SameAs(wanted));
        IdentityText = !id.IsSet ? "⚠️ Commits as: nobody set (fill it in ⚙ Settings)"
            : IdentityWarning ? $"⚠️ Commits as {id} (not your chosen identity)"
            : $"Commits as {id}";

        if (SelectedFile != null) await LoadDiffAsync(SelectedFile);
        NotifyAll();
    }

    GitIdentity? WantedIdentity => settings.CheckIdentity && !string.IsNullOrWhiteSpace(settings.IdentityName) && !string.IsNullOrWhiteSpace(settings.IdentityEmail)
        ? new GitIdentity(settings.IdentityName, settings.IdentityEmail) : null;

    void OnTick()
    {
        OnPropertyChanged(nameof(AllChecked));
        OnPropertyChanged(nameof(FilesHeader));
        OnPropertyChanged(nameof(CheckedCount));
        OnPropertyChanged(nameof(CommitHint));
        CommitCommand.NotifyCanExecuteChanged();
        CommitAndPushCommand.NotifyCanExecuteChanged();
    }

    void NotifyAll()
    {
        OnTick();
        foreach (var p in new[] { nameof(HasRepo), nameof(ShowOperation), nameof(CanContinue), nameof(PushHint), nameof(UndoHint),
                     nameof(DiscardHint), nameof(DiscardText), nameof(UndoText), nameof(AbortText) })
            OnPropertyChanged(p);
        foreach (var c in new IRelayCommand[] { OpenRepoCommand, RefreshCommand, FetchCommand, PullCommand, PushCommand, SyncCommand,
                     CommitCommand, CommitAndPushCommand, DiscardCommand, UndoLastCommitCommand, AbortCommand, ContinueCommand,
                     CreateBranchCommand, OpenOnGitHubCommand, OpenInExplorerCommand, CloneCommand, SettingsCommand, SignInCommand })
            c.NotifyCanExecuteChanged();
    }

    partial void OnCommitMessageChanged(string value) => OnTick();
    partial void OnIsBusyChanged(bool value) => NotifyAll();
    partial void OnOperationChanged(RepoOperation value) => NotifyAll();

    // ---------------------------------------------------------------- diff

    partial void OnSelectedFileChanged(FileItem? value)
    {
        DiscardArmed = false;
        OnPropertyChanged(nameof(DiscardHint));
        OnPropertyChanged(nameof(DiscardText));
        DiscardCommand.NotifyCanExecuteChanged();
        if (value != null && !IsBusy) _ = LoadDiffAsync(value);
    }

    async Task LoadDiffAsync(FileItem item)
    {
        if (Repo == null) return;
        var ticket = ++diffRequest;
        IsDiffBusy = true;
        try
        {
            var text = await Repo.DiffAsync(item.Change, repoStatus?.NoCommitsYet == true);
            if (ticket != diffRequest) return;
            DiffLines.Clear();
            var lines = DiffParser.Parse(text);
            foreach (var l in lines.Take(5000)) DiffLines.Add(l);
            if (lines.Count > 5000) DiffLines.Add(new DiffLine($"… {lines.Count - 5000} more lines not shown.", DiffLineKind.Header));
            DiffTitle = lines.Count == 0 ? $"{item.Path}: no visible change (only file mode or line endings)." : $"{item.Path} · {item.KindText}";
        }
        catch (GitException e)
        {
            if (ticket != diffRequest) return;
            DiffLines.Clear();
            DiffTitle = $"⚠️ Could not show the changes of {item.Path}: {e.Message}";
        }
        finally { if (ticket == diffRequest) IsDiffBusy = false; }
    }

    // ---------------------------------------------------------------- actions

    bool NotBusy() => !IsBusy && !GitMissing;
    bool RepoReady() => NotBusy() && Repo != null;

    [RelayCommand(CanExecute = nameof(RepoReady))]
    Task RefreshAsync() => Busy("Reading the folder again…", async () =>
    {
        await LoadAsync();
        Say(StatusKind.Success, $"✅ Refreshed. {FilesSummary()}");
    });

    [RelayCommand(CanExecute = nameof(RepoReady))]
    Task FetchAsync() => Busy("Asking GitHub for new commits…", async () =>
    {
        var r = await Repo!.FetchAsync();
        await LoadAsync();
        if (!r.Ok) { Say(StatusKind.Error, "❌ " + Explain.Failure("Check GitHub", r)); return; }
        Say(repoStatus!.Behind > 0 ? StatusKind.Warning : StatusKind.Success,
            repoStatus.Behind > 0 ? $"ℹ️ GitHub has {repoStatus.Behind} new commit{(repoStatus.Behind == 1 ? "" : "s")}. Click ⬇ Pull to get {(repoStatus.Behind == 1 ? "it" : "them")}."
            : repoStatus.HasUpstream ? "✅ Checked: nothing new on GitHub." : "✅ Checked GitHub. This branch is not on GitHub yet.");
    });

    bool CanPushPull() => RepoReady() && PushHint.Length == 0;

    [RelayCommand(CanExecute = nameof(CanPushPull))]
    Task PullAsync() => Busy("Pulling the new commits from GitHub…", () => DoPullAsync());

    async Task<bool> DoPullAsync()
    {
        if (!repoStatus!.HasUpstream)
        {
            Say(StatusKind.Info, "ℹ️ Nothing to pull: this branch is not on GitHub yet. ⬆ Push creates it.");
            return true;
        }
        var before = (await Repo!.RunAsync("rev-parse", "HEAD")).StdOut.Trim();
        var r = await Repo.PullAsync(settings.PullRebase);
        await LoadAsync();
        if (!r.Ok)
        {
            Say(Operation != RepoOperation.None ? StatusKind.Warning : StatusKind.Error,
                Operation != RepoOperation.None
                    ? "⚠️ The pull stopped: the same lines changed here and on GitHub. Fix the files marked ! and click Continue, or Abort."
                    : "❌ " + Explain.Failure("Pull", r));
            return false;
        }
        var after = (await Repo.RunAsync("rev-parse", "HEAD")).StdOut.Trim();
        var n = before == after ? 0 : int.TryParse((await Repo.RunAsync("rev-list", "--count", $"{before}..{after}")).StdOut.Trim(), out var c) ? c : 0;
        Say(n == 0 ? StatusKind.Info : StatusKind.Success,
            n == 0 ? "ℹ️ Already up to date: nothing new on GitHub." : $"✅ Pulled {n} new commit{(n == 1 ? "" : "s")} from GitHub.");
        return true;
    }

    [RelayCommand(CanExecute = nameof(CanPushPull))]
    Task PushAsync() => Busy("Sending your commits to GitHub…", () => DoPushAsync());

    async Task<bool> DoPushAsync()
    {
        var remotes = await Repo!.RemotesAsync();
        if (!remotes.Contains("origin"))
        {
            Say(StatusKind.Warning, "⚠️ This repository has no GitHub remote called origin, so there is nowhere to push.");
            return false;
        }
        if (repoStatus!.HasUpstream && repoStatus.Ahead == 0)
        {
            Say(StatusKind.Info, "ℹ️ Nothing to push: GitHub already has all your commits.");
            return true;
        }
        var count = repoStatus.HasUpstream ? repoStatus.Ahead : Commits.Count(c => c.Unpushed);
        var r = await Repo.PushAsync(!repoStatus.HasUpstream);
        await LoadAsync();
        if (!r.Ok) { Say(StatusKind.Error, "❌ " + Explain.Failure("Push", r)); return false; }
        Say(StatusKind.Success, $"✅ Pushed {count} commit{(count == 1 ? "" : "s")} to {repoStatus.Upstream ?? "GitHub"}.");
        return true;
    }

    [RelayCommand(CanExecute = nameof(CanPushPull))]
    Task SyncAsync() => Busy("Syncing with GitHub (pull, then push)…", async () =>
    {
        BusyText = "Step 1 of 2: pulling from GitHub…";
        if (!await DoPullAsync()) return;
        var pulled = Status;
        BusyText = "Step 2 of 2: pushing to GitHub…";
        if (!await DoPushAsync()) return;
        Say(StatusKind.Success, $"✅ Synced. {Strip(pulled)} {Strip(Status)}");
    });

    static string Strip(string s) => s.Length > 2 && (s.StartsWith("✅") || s.StartsWith("ℹ️")) ? s[(s.IndexOf(' ') + 1)..] : s;

    bool CanCommit() => RepoReady() && CommitHint.Length == 0;

    [RelayCommand(CanExecute = nameof(CanCommit))]
    Task CommitAsync() => Busy("Committing…", async () => { await DoCommitAsync(); });

    [RelayCommand(CanExecute = nameof(CanCommit))]
    Task CommitAndPushAsync() => Busy("Committing…", async () =>
    {
        if (!await DoCommitAsync()) return;
        var committed = Status;
        BusyText = "Sending the commit to GitHub…";
        if (await DoPushAsync()) Say(StatusKind.Success, $"{committed} Pushed to {repoStatus!.Upstream ?? "GitHub"}.");
    });

    async Task<bool> DoCommitAsync()
    {
        var picked = Files.Where(f => f.IsChecked).Select(f => f.Change).ToList();
        var marks = Repo!.FilesWithMarkers(picked.Where(f => f.IsConflict).Select(f => f.Path));
        if (marks.Count > 0)
        {
            Say(StatusKind.Error, $"❌ These files still have conflict marks (<<<<<<< or >>>>>>>): {string.Join(", ", marks)}. Fix them first.");
            return false;
        }
        if (!await CheckIdentityAsync()) return false;
        var message = CommitMessage.Trim();
        var r = await Repo.CommitAsync(picked, message, Operation is RepoOperation.Merge or RepoOperation.CherryPick or RepoOperation.Revert);
        if (!r.Ok)
        {
            await LoadAsync();
            Say(StatusKind.Error, "❌ " + Explain.Failure("Commit", r));
            return false;
        }
        CommitMessage = "";
        await LoadAsync();
        var subject = message.Split('\n')[0];
        Say(StatusKind.Success, $"✅ Committed {picked.Count} file{(picked.Count == 1 ? "" : "s")}: \"{subject}\".");
        return true;
    }

    /// <summary>Asks before a commit that would go out under another name or email than the chosen one.</summary>
    async Task<bool> CheckIdentityAsync()
    {
        var wanted = WantedIdentity;
        if (wanted == null) return true;
        var current = await Repo!.IdentityAsync();
        if (current.IsSet && current.SameAs(wanted)) return true;
        var ok = dialogs.Confirm("Commit identity",
            $"This repository would commit as:\n    {current}\n\nYour chosen identity in Settings is:\n    {wanted}\n\n" +
            "Click OK to use your chosen identity for this repository (only this one) and commit.\nClick Cancel to stop without committing.");
        if (!ok)
        {
            Say(StatusKind.Info, "ℹ️ Commit cancelled: nothing was committed. Change the identity in ⚙ Settings if needed.");
            return false;
        }
        var set = await Repo.SetLocalIdentityAsync(wanted);
        if (!set.Ok) { Say(StatusKind.Error, "❌ " + Explain.Failure("Setting the identity", set)); return false; }
        return true;
    }

    bool CanDiscard() => RepoReady() && SelectedFile != null && DiscardHint.Length == 0;

    [RelayCommand(CanExecute = nameof(CanDiscard))]
    Task DiscardAsync()
    {
        var item = SelectedFile!;
        if (!DiscardArmed || clock.GetUtcNow() - discardArmedAt > ArmWindow)
        {
            DiscardArmed = true;
            discardArmedAt = clock.GetUtcNow();
            OnPropertyChanged(nameof(DiscardText));
            Say(StatusKind.Warning, $"⚠️ Click ↩ Discard again within 5 seconds to throw away your changes to {item.Path}. This cannot be undone.");
            return Task.CompletedTask;
        }
        DiscardArmed = false;
        OnPropertyChanged(nameof(DiscardText));
        return Busy($"Discarding the changes to {item.FileName}…", async () =>
        {
            var r = await Repo!.DiscardAsync(item.Change, repoStatus?.NoCommitsYet == true);
            await LoadAsync();
            Say(r.Ok ? StatusKind.Success : StatusKind.Error,
                r.Ok ? $"✅ Discarded the changes to {item.Path}." : "❌ " + Explain.Failure("Discard", r));
        });
    }

    bool CanUndo() => RepoReady() && UndoHint.Length == 0;

    [RelayCommand(CanExecute = nameof(CanUndo))]
    Task UndoLastCommitAsync()
    {
        if (!UndoArmed || clock.GetUtcNow() - undoArmedAt > ArmWindow)
        {
            UndoArmed = true;
            undoArmedAt = clock.GetUtcNow();
            OnPropertyChanged(nameof(UndoText));
            Say(StatusKind.Warning, $"⚠️ Click again within 5 seconds to take back \"{Commits[0].Subject}\". Your changes stay in the files.");
            return Task.CompletedTask;
        }
        UndoArmed = false;
        OnPropertyChanged(nameof(UndoText));
        return Busy("Taking back the last commit…", async () =>
        {
            var message = await Repo!.LastMessageAsync();
            var r = await Repo.UndoLastCommitAsync();
            await LoadAsync();
            if (!r.Ok) { Say(StatusKind.Error, "❌ " + Explain.Failure("Undo", r)); return; }
            if (string.IsNullOrWhiteSpace(CommitMessage)) CommitMessage = message;
            Say(StatusKind.Success, "✅ Commit taken back. Its changes are in the list again and its message is in the box.");
        });
    }

    bool CanAbort() => RepoReady() && Operation != RepoOperation.None;

    [RelayCommand(CanExecute = nameof(CanAbort))]
    Task AbortAsync()
    {
        if (!AbortArmed || clock.GetUtcNow() - abortArmedAt > ArmWindow)
        {
            AbortArmed = true;
            abortArmedAt = clock.GetUtcNow();
            OnPropertyChanged(nameof(AbortText));
            Say(StatusKind.Warning, "⚠️ Click ✖ Abort again within 5 seconds to go back to how things were before.");
            return Task.CompletedTask;
        }
        AbortArmed = false;
        OnPropertyChanged(nameof(AbortText));
        return Busy("Going back to before the pull…", async () =>
        {
            var r = await Repo!.AbortAsync(Operation);
            await LoadAsync();
            Say(r.Ok ? StatusKind.Success : StatusKind.Error,
                r.Ok ? "✅ Aborted: your folder is back to how it was before." : "❌ " + Explain.Failure("Abort", r));
        });
    }

    bool CanContinueOp() => RepoReady() && Operation == RepoOperation.Rebase;

    [RelayCommand(CanExecute = nameof(CanContinueOp))]
    Task ContinueAsync() => Busy("Going on with the pull…", async () =>
    {
        var conflicts = Files.Where(f => f.Change.IsConflict).Select(f => f.Path).ToList();
        var marks = Repo!.FilesWithMarkers(conflicts);
        if (marks.Count > 0)
        {
            Say(StatusKind.Error, $"❌ These files still have conflict marks (<<<<<<< or >>>>>>>): {string.Join(", ", marks)}. Fix them, save, then Continue.");
            return;
        }
        var r = await Repo.ContinueRebaseAsync(conflicts);
        await LoadAsync();
        if (Operation == RepoOperation.Rebase)
            Say(StatusKind.Warning, r.Ok ? "⚠️ One step done, but the next commit also has conflicts. Fix the files marked !, then Continue again."
                                         : "❌ " + Explain.Failure("Continue", r));
        else
            Say(r.Ok ? StatusKind.Success : StatusKind.Error,
                r.Ok ? "✅ Pull finished. ⬆ Push to send your commits." : "❌ " + Explain.Failure("Continue", r));
    });

    partial void OnSelectedBranchChanged(BranchItem? value)
    {
        if (loadingBranches || value == null || Repo == null || (!value.RemoteOnly && value.Name == repoStatus?.Branch)) return;
        _ = Busy($"Switching to {value.Name}…", async () =>
        {
            var r = await Repo.SwitchAsync(value.Name);
            await LoadAsync();
            Say(r.Ok ? StatusKind.Success : StatusKind.Error,
                r.Ok ? $"✅ Switched to {value.Name}." : "❌ " + Explain.Failure($"Switching to {value.Name}", r));
        });
    }

    [RelayCommand(CanExecute = nameof(RepoReady))]
    Task CreateBranchAsync() => Busy("Creating the branch…", async () =>
    {
        var name = NewBranchName.Trim();
        if (name.Length == 0) { Say(StatusKind.Error, "❌ Type a name for the new branch first."); return; }
        if (!await Repo!.IsValidBranchNameAsync(name))
        {
            Say(StatusKind.Error, $"❌ \"{name}\" cannot be a branch name. Use letters, numbers, - _ / and no spaces.");
            return;
        }
        if (Branches.Any(b => b.Name == name)) { Say(StatusKind.Error, $"❌ A branch called {name} already exists. Pick it in the list instead."); return; }
        var r = await Repo.CreateBranchAsync(name);
        await LoadAsync();
        if (!r.Ok) { Say(StatusKind.Error, "❌ " + Explain.Failure("New branch", r)); return; }
        NewBranchName = "";
        Say(StatusKind.Success, $"✅ Created {name} and switched to it. ⬆ Push puts it on GitHub.");
    });

    bool HasWeb() => !IsBusy && WebUrl != null;

    [RelayCommand(CanExecute = nameof(HasWeb))]
    void OpenOnGitHub()
    {
        var url = repoStatus?.Branch != null && repoStatus.HasUpstream ? $"{WebUrl}/tree/{Uri.EscapeDataString(repoStatus.Branch).Replace("%2F", "/")}" : WebUrl!;
        dialogs.OpenUrl(url);
        Say(StatusKind.Info, $"ℹ️ Opened {url} in your browser.");
    }

    [RelayCommand(CanExecute = nameof(RepoReady))]
    void OpenInExplorer()
    {
        dialogs.OpenFolder(Repo!.Root);
        Say(StatusKind.Info, $"ℹ️ Opened {Repo.Root} in Explorer.");
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task CloneAsync()
    {
        var vm = new CloneViewModel(gh, dialogs, settings);
        dialogs.ShowClone(vm);
        if (vm.ClonedPath == null) { Say(StatusKind.Info, "ℹ️ Clone closed, nothing was copied."); return; }
        await Busy("Opening the new copy…", () => OpenPathAsync(vm.ClonedPath));
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task SettingsAsync()
    {
        var vm = new SettingsViewModel(settings, gh);
        var saved = false;
        vm.CloseRequested += s => saved = s;
        dialogs.ShowSettings(vm);
        if (!saved) { Say(StatusKind.Info, "ℹ️ Settings closed without changes."); return; }
        if (Repo != null) await Busy("Applying the settings…", LoadAsync);
        Say(StatusKind.Success, "✅ Settings saved.");
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task SignInAsync()
    {
        Say(StatusKind.Working, "⏳ Finish the sign in in the black window (it opens your browser). This window waits for it.");
        IsBusy = true; BusyText = "Waiting for the GitHub sign in window to close…";
        try
        {
            var code = await dialogs.RunInConsoleAsync(GhCli.Gh, ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"]);
            if (code == 0) await runner.RunAsync(GhCli.Gh, Repo?.Root ?? Environment.CurrentDirectory, ["auth", "setup-git"]);
            BusyText = "Checking the sign in…";
            await CheckGhAsync();
            Say(GhUser != null ? StatusKind.Success : StatusKind.Warning,
                GhUser != null ? $"✅ Signed in to GitHub as {GhUser.Login}. Pull and Push will use this account."
                               : "⚠️ Not signed in. The window was closed before the sign in finished: click 🔑 Sign in to GitHub to try again.");
        }
        catch (Exception e)
        {
            Say(StatusKind.Error, $"❌ Could not start the GitHub sign in: {e.Message}. Is the GitHub CLI (gh) installed?");
        }
        finally { IsBusy = false; BusyText = null; }
    }

    [RelayCommand]
    void Help() => dialogs.ShowHelp(HelpGuide.Build(Version));

    [RelayCommand]
    void ClearOutput() { output.Clear(); OutputText = ""; }

    // ---------------------------------------------------------------- plumbing

    /// <summary>Covers the window, runs the work and always ends with a visible result.</summary>
    async Task Busy(string label, Func<Task> work)
    {
        if (IsBusy) return;
        IsBusy = true; BusyText = label;
        Say(StatusKind.Working, "⏳ " + label);
        try { await work(); }
        catch (GitException e) { Say(StatusKind.Error, "❌ " + Explain.Failure("Git", e.Result)); }
        catch (Exception e) { Say(StatusKind.Error, $"❌ Something went wrong: {e.Message}"); }
        finally
        {
            IsBusy = false; BusyText = null;
            if (StatusKind == StatusKind.Working) Say(StatusKind.Info, "ℹ️ Done.");
        }
    }

    void Say(StatusKind kind, string text) { StatusKind = kind; Status = text; }

    void OnRan(CommandResult r)
    {
        if (!LoggedVerbs.Contains(r.Verb)) return;
        if (r.Verb == "config" && !r.CommandLine.Contains("--local")) return;
        output.Append($"[{DateTime.Now:HH:mm:ss}] > {r.CommandLine}\n");
        foreach (var s in new[] { r.StdOut, r.StdErr })
            if (!string.IsNullOrWhiteSpace(s)) output.Append(s.Length > 4000 ? s[..4000] + "…\n" : s.TrimEnd() + "\n");
        output.Append(r.Ok ? "  (ok)\n\n" : $"  (failed, code {r.ExitCode})\n\n");
        if (output.Length > OutputLimit) output.Remove(0, output.Length - OutputLimit);
        OutputText = output.ToString();
    }
}
