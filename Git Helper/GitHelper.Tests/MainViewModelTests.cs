using System.Text.RegularExpressions;
using GitHelper.Core;
using GitHelper.ViewModels;

namespace GitHelper.Tests;

sealed class FakeSettings : IAppSettings
{
    public List<string> RecentRepos { get; } = new();
    public string? LastRepo { get; set; }
    public string? IdentityName { get; set; }
    public string? IdentityEmail { get; set; }
    public bool CheckIdentity { get; set; }
    public bool PullRebase { get; set; } = true;
    public string? CloneFolder { get; set; }
    public int Saves;
    public void Save() => Saves++;
}

sealed class FakeDialogs : IDialogs
{
    public bool ConfirmAnswer = true;
    public List<string> Confirms = new();
    public List<string> Urls = new();
    public string? Folder;
    public string? PickFolder(string title, string? start = null) => Folder;
    public bool Confirm(string title, string message) { Confirms.Add(message); return ConfirmAnswer; }
    public void OpenUrl(string url) => Urls.Add(url);
    public void OpenFolder(string path) { }
    public void ShowSettings(SettingsViewModel vm) { }
    public void ShowClone(CloneViewModel vm) { }
    public void ShowHelp(HelpGuide guide) { }
    public Task<int> RunInConsoleAsync(string exe, IReadOnlyList<string> args) => Task.FromResult(1);
}

sealed class ManualClock : TimeProvider
{
    public DateTimeOffset Now = DateTimeOffset.UnixEpoch;
    public override DateTimeOffset GetUtcNow() => Now;
}

public class MainViewModelTests
{
    static (MainViewModel vm, FakeDialogs dialogs, FakeSettings settings, ManualClock clock) Make()
    {
        var d = new FakeDialogs();
        var s = new FakeSettings();
        var c = new ManualClock();
        return (new MainViewModel(new ProcessRunner(), d, s, c), d, s, c);
    }

    [Fact]
    public async Task OpenCommitAndPushWithFeedback()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "one.txt", "1\n");
        TestRepo.Write(a, "two.txt", "2\n");
        var (vm, dialogs, settings, _) = Make();
        dialogs.Folder = a;
        await vm.OpenRepoCommand.ExecuteAsync(null);
        Assert.StartsWith("✅ Opened a.", vm.Status);
        Assert.Equal(vm.RepoPath, settings.LastRepo);
        Assert.Equal("a", Path.GetFileName(settings.LastRepo));
        Assert.Equal(2, vm.Files.Count);
        Assert.Equal("Write a short message that says what you changed.", vm.CommitHint);
        Assert.False(vm.CommitCommand.CanExecute(null));

        vm.Files.Single(f => f.Path == "two.txt").IsChecked = false;
        Assert.Null(vm.AllChecked);
        vm.CommitMessage = "Add one";
        Assert.True(vm.CommitCommand.CanExecute(null));
        await vm.CommitAndPushCommand.ExecuteAsync(null);
        Assert.Equal(StatusKind.Success, vm.StatusKind);
        Assert.Contains("Committed 1 file", vm.Status);
        Assert.Contains("Pushed to origin/main", vm.Status);
        Assert.Equal("", vm.CommitMessage);
        Assert.Equal(["two.txt"], vm.Files.Select(f => f.Path));
        Assert.Contains("In step with origin/main", vm.SyncText);
        Assert.Contains("> git", vm.OutputText);
        Assert.False(vm.IsBusy);

        await vm.PushCommand.ExecuteAsync(null);
        Assert.Equal("ℹ️ Nothing to push: GitHub already has all your commits.", vm.Status);
    }

    [Fact]
    public async Task FetchThenPullReportsTheNewCommits()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        TestRepo.Write(a, "x.txt", "x\n"); TestRepo.CommitAll(a, "x"); TestRepo.Git(a, "push", "-q");
        var (vm, _, _, _) = Make();
        await vm.Busy_Open(b);
        await vm.FetchCommand.ExecuteAsync(null);
        Assert.Contains("GitHub has 1 new commit", vm.Status);
        Assert.Contains("↓ 1 to pull", vm.SyncText);
        await vm.PullCommand.ExecuteAsync(null);
        Assert.Equal("✅ Pulled 1 new commit from GitHub.", vm.Status);
        await vm.PullCommand.ExecuteAsync(null);
        Assert.Equal("ℹ️ Already up to date: nothing new on GitHub.", vm.Status);
    }

    [Fact]
    public async Task IdentityCheckAsksAndFixesTheRepository()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "x.txt", "x\n");
        var (vm, dialogs, settings, _) = Make();
        settings.IdentityName = "DTStackDevSC";
        settings.IdentityEmail = "276983346+DTStackDevSC@users.noreply.github.com";
        settings.CheckIdentity = true;
        await vm.Busy_Open(a);
        Assert.True(vm.IdentityWarning);
        vm.CommitMessage = "x";

        dialogs.ConfirmAnswer = false;
        await vm.CommitCommand.ExecuteAsync(null);
        Assert.StartsWith("ℹ️ Commit cancelled", vm.Status);
        Assert.Single(vm.Files);

        dialogs.ConfirmAnswer = true;
        await vm.CommitCommand.ExecuteAsync(null);
        Assert.Equal(StatusKind.Success, vm.StatusKind);
        Assert.Equal("DTStackDevSC <276983346+DTStackDevSC@users.noreply.github.com>",
            TestRepo.Git(a, "log", "-1", "--format=%an <%ae>").Trim());
        Assert.False(vm.IdentityWarning);
        Assert.Equal(2, dialogs.Confirms.Count);
    }

    [Fact]
    public async Task DiscardNeedsASecondClick()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "changed\n");
        var (vm, _, _, clock) = Make();
        await vm.Busy_Open(a);
        vm.SelectedFile = vm.Files.Single();
        Assert.True(vm.DiscardCommand.CanExecute(null));
        await vm.DiscardCommand.ExecuteAsync(null);
        Assert.Equal("Click again to discard readme.txt", vm.DiscardText);
        Assert.Single(vm.Files);
        clock.Now += TimeSpan.FromSeconds(6);
        await vm.DiscardCommand.ExecuteAsync(null); // too late: arms again
        Assert.Single(vm.Files);
        await vm.DiscardCommand.ExecuteAsync(null);
        Assert.Empty(vm.Files);
        Assert.Equal("✅ Discarded the changes to readme.txt.", vm.Status);
    }

    [Fact]
    public async Task UndoLastCommitPutsTheMessageBack()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "changed\n"); TestRepo.CommitAll(a, "Oops message");
        var (vm, _, _, _) = Make();
        await vm.Busy_Open(a);
        Assert.Equal("", vm.UndoHint);
        await vm.UndoLastCommitCommand.ExecuteAsync(null);
        await vm.UndoLastCommitCommand.ExecuteAsync(null);
        Assert.Equal(StatusKind.Success, vm.StatusKind);
        Assert.Equal("Oops message", vm.CommitMessage);
        Assert.Single(vm.Files);
        Assert.Equal("The last commit is already on GitHub, so it cannot be taken back here.", vm.UndoHint);
    }

    [Fact]
    public async Task ConflictShowsTheBarAndContinueChecksTheMarks()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        TestRepo.Write(a, "readme.txt", "A\n"); TestRepo.CommitAll(a, "a"); TestRepo.Git(a, "push", "-q");
        TestRepo.Write(b, "readme.txt", "B\n"); TestRepo.CommitAll(b, "b");
        var (vm, _, _, _) = Make();
        await vm.Busy_Open(b);
        await vm.PullCommand.ExecuteAsync(null);
        Assert.True(vm.ShowOperation);
        Assert.Equal(StatusKind.Warning, vm.StatusKind);
        Assert.False(vm.CommitCommand.CanExecute(null));
        await vm.ContinueCommand.ExecuteAsync(null);
        Assert.Contains("still have conflict marks", vm.Status);
        TestRepo.Write(b, "readme.txt", "A and B\n");
        await vm.ContinueCommand.ExecuteAsync(null);
        Assert.Equal("✅ Pull finished. ⬆ Push to send your commits.", vm.Status);
        Assert.False(vm.ShowOperation);
    }

    [Fact]
    public async Task NotARepositoryIsExplained()
    {
        using var t = new TestRepo();
        var (vm, dialogs, _, _) = Make();
        dialogs.Folder = t.Dir;
        await vm.OpenRepoCommand.ExecuteAsync(null);
        Assert.Equal(StatusKind.Error, vm.StatusKind);
        Assert.Contains("is not inside a git repository", vm.Status);
        Assert.False(vm.HasRepo);
    }

    [Fact]
    public async Task NewBranchIsCreatedAndPushedWithUpstream()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var (vm, _, _, _) = Make();
        await vm.Busy_Open(a);
        vm.NewBranchName = "bad name";
        await vm.CreateBranchCommand.ExecuteAsync(null);
        Assert.Contains("cannot be a branch name", vm.Status);
        vm.NewBranchName = "feature/y";
        await vm.CreateBranchCommand.ExecuteAsync(null);
        Assert.Equal("feature/y", vm.SelectedBranch?.Name);
        Assert.Contains("not on GitHub yet", vm.SyncText);
        await vm.PushCommand.ExecuteAsync(null);
        Assert.Equal(StatusKind.Success, vm.StatusKind);
        Assert.Contains("origin/feature/y", vm.SyncText);
    }

    [Fact]
    public void HelpDescribesEveryButtonOfTheMainWindow()
    {
        var xaml = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "MainWindow.xaml"));
        var guide = HelpGuide.Build("1.0.0");
        var labels = guide.Sections.SelectMany(s => s.Items).Select(i => i.Label).ToHashSet();
        var buttons = Regex.Matches(xaml, "<Button[^>]*?Content=\"([^\"{]+)\"").Select(m => m.Groups[1].Value)
            .Where(c => c is not ("✕" or "Clear")).ToList();
        Assert.NotEmpty(buttons);
        foreach (var b in buttons) Assert.Contains(b, labels);
    }
}

static class VmTestExtensions
{
    public static async Task Busy_Open(this MainViewModel vm, string path)
    {
        await vm.OpenPathAsync(path);
        Assert.Equal(StatusKind.Success, vm.StatusKind);
    }
}
