using GitHelper.Core;

namespace GitHelper.Tests;

public class StatusParserTests
{
    [Fact]
    public void ParsesBranchAndEveryKindOfEntry()
    {
        var text = string.Join('\0',
            "# branch.oid 0123456789abcdef",
            "# branch.head main",
            "# branch.upstream origin/main",
            "# branch.ab +2 -1",
            "1 .M N... 100644 100644 100644 aaa bbb src/my file.js",
            "1 A. N... 000000 100644 100644 000 ccc added.txt",
            "1 .D N... 100644 100644 000000 ddd ddd gone.txt",
            "2 R. N... 100644 100644 100644 eee eee R100 new name.txt", "old name.txt",
            "u UU N... 100644 100644 100644 100644 a1 a2 a3 both.txt",
            "? untracked dir/file.txt", "");
        var s = StatusParser.Parse(text);
        Assert.Equal("main", s.Branch);
        Assert.Equal("origin/main", s.Upstream);
        Assert.Equal(2, s.Ahead);
        Assert.Equal(1, s.Behind);
        Assert.False(s.NoCommitsYet);
        Assert.Collection(s.Files,
            f => { Assert.Equal("src/my file.js", f.Path); Assert.Equal(ChangeKind.Modified, f.Kind); },
            f => { Assert.Equal("added.txt", f.Path); Assert.Equal(ChangeKind.Added, f.Kind); },
            f => Assert.Equal(ChangeKind.Deleted, f.Kind),
            f => { Assert.Equal("new name.txt", f.Path); Assert.Equal("old name.txt", f.OriginalPath); Assert.Equal(ChangeKind.Renamed, f.Kind); },
            f => Assert.True(f.IsConflict),
            f => { Assert.Equal("untracked dir/file.txt", f.Path); Assert.True(f.IsUntracked); });
    }

    [Fact]
    public void DetachedAndInitialAreRecognised()
    {
        var s = StatusParser.Parse("# branch.oid (initial)\0# branch.head (detached)\0");
        Assert.True(s.Detached);
        Assert.True(s.NoCommitsYet);
        Assert.Null(s.Branch);
        Assert.False(s.HasUpstream);
    }

    [Fact]
    public void DiffLinesGetTheirKind()
    {
        var lines = DiffParser.Parse("diff --git a/x b/x\nindex 1..2\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n");
        Assert.Equal([DiffLineKind.Header, DiffLineKind.Header, DiffLineKind.Header, DiffLineKind.Header, DiffLineKind.Hunk,
            DiffLineKind.Context, DiffLineKind.Removed, DiffLineKind.Added], lines.Select(l => l.Kind));
    }
}

public class HelperTests
{
    [Theory]
    [InlineData("https://github.com/Owner/Repo.git", "https://github.com/Owner/Repo")]
    [InlineData("git@github.com:Owner/Repo.git", "https://github.com/Owner/Repo")]
    [InlineData("https://user@github.com/Owner/Repo", "https://github.com/Owner/Repo")]
    [InlineData("ssh://git@github.com/Owner/Repo.git", "https://github.com/Owner/Repo")]
    [InlineData("https://gitlab.com/Owner/Repo.git", null)]
    [InlineData(null, null)]
    public void WebUrlOfRemote(string? remote, string? web) => Assert.Equal(web, GitRepo.WebUrl(remote));

    [Theory]
    [InlineData("DTStackDevSC/Tampermonkey-Scripts", "Tampermonkey-Scripts")]
    [InlineData("https://github.com/Owner/Repo.git", "Repo")]
    [InlineData("git@github.com:Owner/Repo.git", "Repo")]
    public void CloneFolderName(string repo, string folder) => Assert.Equal(folder, GhCli.FolderNameFor(repo));

    [Fact]
    public void NoreplyEmailFromApiUser()
    {
        var u = GhCli.ParseUser("{\"login\":\"Someone\",\"id\":123,\"name\":null}");
        Assert.NotNull(u);
        Assert.Equal("123+Someone@users.noreply.github.com", u!.NoreplyEmail);
        Assert.Null(GhCli.ParseUser("not json"));
    }

    [Fact]
    public void RejectedPushIsExplained()
    {
        var r = new CommandResult(1, "", " ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs", "git push", "push");
        Assert.Contains("Pull first", Explain.Failure("Push", r));
    }

    [Fact]
    public void VerbSkipsConfigOptions() =>
        Assert.Equal("push", ProcessRunner.VerbOf(["-c", "core.quotepath=false", "-c", "color.ui=false", "push", "-u"]));
}

public class GitRepoTests
{
    static GitRepo Open(string path) => new(TestRepo.Runner, path);

    [Fact]
    public async Task FindsTheRootFromASubfolder()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        Directory.CreateDirectory(Path.Combine(a, "sub", "deep"));
        var root = await GitRepo.FindRootAsync(TestRepo.Runner, a);
        Assert.Equal("a", Path.GetFileName(root));
        Assert.Equal(root, await GitRepo.FindRootAsync(TestRepo.Runner, Path.Combine(a, "sub", "deep")));
        Assert.Null(await GitRepo.FindRootAsync(TestRepo.Runner, t.Dir));
    }

    [Fact]
    public async Task CommitsOnlyTheTickedFiles()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "changed\n");
        TestRepo.Write(a, "new.txt", "brand new\n");
        TestRepo.Write(a, "weird [1] name.txt", "glob characters\n");
        TestRepo.Write(a, "other.txt", "staged but not ticked\n");
        TestRepo.Git(a, "add", "other.txt");
        var repo = Open(a);
        var s = await repo.StatusAsync();
        var ticked = s.Files.Where(f => f.Path is "readme.txt" or "new.txt" or "weird [1] name.txt").ToList();
        var r = await repo.CommitAsync(ticked, "Two files\n\nWith a body line \"quoted\"", merging: false);
        Assert.True(r.Ok, r.ErrorText);
        var after = await repo.StatusAsync();
        Assert.Equal(["other.txt"], after.Files.Select(f => f.Path));
        Assert.Equal("Two files\n\nWith a body line \"quoted\"", await repo.LastMessageAsync());
        Assert.Equal(1, after.Ahead);
    }

    [Fact]
    public async Task CommitsADeletedAndARenamedFile()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "x.txt", "x\n");
        TestRepo.CommitAll(a, "add x");
        TestRepo.Git(a, "mv", "readme.txt", "renamed.txt");
        File.Delete(Path.Combine(a, "x.txt"));
        var repo = Open(a);
        var s = await repo.StatusAsync();
        Assert.Contains(s.Files, f => f.Kind == ChangeKind.Renamed && f.OriginalPath == "readme.txt");
        Assert.Contains(s.Files, f => f.Kind == ChangeKind.Deleted && f.Path == "x.txt");
        var r = await repo.CommitAsync(s.Files, "rename and delete", merging: false);
        Assert.True(r.Ok, r.ErrorText);
        Assert.Empty((await repo.StatusAsync()).Files);
    }

    [Fact]
    public async Task DiscardsEveryKindOfChange()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "changed\n");
        TestRepo.Write(a, "untracked.txt", "u\n");
        TestRepo.Write(a, "added.txt", "a\n");
        TestRepo.Git(a, "add", "added.txt");
        var repo = Open(a);
        foreach (var f in (await repo.StatusAsync()).Files)
        {
            var r = await repo.DiscardAsync(f, false);
            Assert.True(r.Ok, $"{f.Path}: {r.ErrorText}");
        }
        Assert.Empty((await repo.StatusAsync()).Files);
        Assert.Equal("line one\nline two\nline three\n", File.ReadAllText(Path.Combine(a, "readme.txt")));
        Assert.False(File.Exists(Path.Combine(a, "untracked.txt")));
        Assert.False(File.Exists(Path.Combine(a, "added.txt")));

        TestRepo.Git(a, "mv", "readme.txt", "moved.txt");
        var renamed = (await repo.StatusAsync()).Files.Single();
        Assert.True((await repo.DiscardAsync(renamed, false)).Ok);
        Assert.Empty((await repo.StatusAsync()).Files);
        Assert.True(File.Exists(Path.Combine(a, "readme.txt")));
    }

    [Fact]
    public async Task DiffShowsTrackedAndNewFiles()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "line one\nline 2\nline three\n");
        TestRepo.Write(a, "new.txt", "hello\nworld\n");
        var repo = Open(a);
        var files = (await repo.StatusAsync()).Files;
        var d = DiffParser.Parse(await repo.DiffAsync(files.Single(f => f.Path == "readme.txt"), false));
        Assert.Contains(d, l => l.Kind == DiffLineKind.Removed && l.Text == "-line two");
        Assert.Contains(d, l => l.Kind == DiffLineKind.Added && l.Text == "+line 2");
        var n = DiffParser.Parse(await repo.DiffAsync(files.Single(f => f.Path == "new.txt"), false));
        Assert.Equal(["+hello", "+world"], n.Where(l => l.Kind == DiffLineKind.Added).Select(l => l.Text));
    }

    [Fact]
    public async Task PushPullAndANewBranch()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        var ra = Open(a);
        TestRepo.Write(a, "from-a.txt", "a\n");
        TestRepo.CommitAll(a, "from a");
        Assert.True((await ra.PushAsync(false)).Ok);

        var rb = Open(b);
        Assert.True((await rb.FetchAsync()).Ok);
        Assert.Equal(1, (await rb.StatusAsync()).Behind);
        Assert.True((await rb.PullAsync(rebase: true)).Ok);
        Assert.True(File.Exists(Path.Combine(b, "from-a.txt")));

        Assert.True((await rb.CreateBranchAsync("feature/x")).Ok);
        TestRepo.Write(b, "f.txt", "f\n");
        TestRepo.CommitAll(b, "feature");
        Assert.False((await rb.StatusAsync()).HasUpstream);
        Assert.True((await rb.PushAsync(setUpstream: true)).Ok);
        var s = await rb.StatusAsync();
        Assert.Equal("origin/feature/x", s.Upstream);
        Assert.Equal(0, s.Ahead);

        Assert.True((await ra.FetchAsync()).Ok);
        var (_, remoteOnly) = await ra.BranchesAsync();
        Assert.Contains("feature/x", remoteOnly);
        Assert.True((await ra.SwitchAsync("feature/x")).Ok);
        Assert.Equal("feature/x", (await ra.StatusAsync()).Branch);
        Assert.False(await ra.IsValidBranchNameAsync("bad name"));
    }

    [Fact]
    public async Task PushRejectedWhenGitHubHasNewCommits()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        TestRepo.Write(a, "a.txt", "a\n"); TestRepo.CommitAll(a, "a"); TestRepo.Git(a, "push", "-q");
        TestRepo.Write(b, "b.txt", "b\n"); TestRepo.CommitAll(b, "b");
        var r = await Open(b).PushAsync(false);
        Assert.False(r.Ok);
        Assert.Contains("Pull first", Explain.Failure("Push", r));
    }

    [Fact]
    public async Task ConflictDuringPullThenContinue()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        TestRepo.Write(a, "readme.txt", "line one\nA side\nline three\n"); TestRepo.CommitAll(a, "a"); TestRepo.Git(a, "push", "-q");
        TestRepo.Write(b, "readme.txt", "line one\nB side\nline three\n"); TestRepo.CommitAll(b, "b");
        var rb = Open(b);
        var pull = await rb.PullAsync(rebase: true);
        Assert.False(pull.Ok);
        Assert.Equal(RepoOperation.Rebase, await rb.OperationAsync());
        var conflict = (await rb.StatusAsync()).Files.Single();
        Assert.True(conflict.IsConflict);
        Assert.Equal(["readme.txt"], rb.FilesWithMarkers(["readme.txt"]));

        TestRepo.Write(b, "readme.txt", "line one\nA side\nB side\nline three\n");
        Assert.Empty(rb.FilesWithMarkers(["readme.txt"]));
        var cont = await rb.ContinueRebaseAsync(["readme.txt"]);
        Assert.True(cont.Ok, cont.ErrorText);
        Assert.Equal(RepoOperation.None, await rb.OperationAsync());
        var s = await rb.StatusAsync();
        Assert.Equal(1, s.Ahead);
        Assert.Equal(0, s.Behind);
    }

    [Fact]
    public async Task AbortGoesBack()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var b = t.Clone("b");
        TestRepo.Write(a, "readme.txt", "A\n"); TestRepo.CommitAll(a, "a"); TestRepo.Git(a, "push", "-q");
        TestRepo.Write(b, "readme.txt", "B\n"); TestRepo.CommitAll(b, "b");
        var rb = Open(b);
        Assert.False((await rb.PullAsync(rebase: false)).Ok); // ff-only refuses diverged branches
        Assert.False((await rb.RunAsync("pull", "--no-rebase", "--no-edit")).Ok);
        Assert.Equal(RepoOperation.Merge, await rb.OperationAsync());
        Assert.True((await rb.AbortAsync(RepoOperation.Merge)).Ok);
        Assert.Equal(RepoOperation.None, await rb.OperationAsync());
        Assert.Equal("B\n", File.ReadAllText(Path.Combine(b, "readme.txt")));
    }

    [Fact]
    public async Task UndoLastCommitKeepsTheChanges()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        TestRepo.Write(a, "readme.txt", "edited\n"); TestRepo.CommitAll(a, "to undo");
        var repo = Open(a);
        var log = await repo.LogAsync(10, true);
        Assert.True(log[0].Unpushed);
        Assert.False(log[1].Unpushed);
        Assert.True((await repo.UndoLastCommitAsync()).Ok);
        Assert.Equal("edited\n", File.ReadAllText(Path.Combine(a, "readme.txt")));
        Assert.Single((await repo.StatusAsync()).Files);
        Assert.Equal("First commit", (await repo.LogAsync(10, true))[0].Subject);
    }

    [Fact]
    public async Task IdentityIsSetForThisRepositoryOnly()
    {
        using var t = new TestRepo();
        var a = t.Clone("a");
        var repo = Open(a);
        Assert.Equal(new GitIdentity("Test User", "test@example.com"), await repo.IdentityAsync());
        Assert.True((await repo.SetLocalIdentityAsync(new GitIdentity("Me", "1+me@users.noreply.github.com"))).Ok);
        Assert.True((await repo.IdentityAsync()).SameAs(new GitIdentity("Me", "1+ME@users.noreply.github.com")));
        Assert.Equal("Me", TestRepo.Git(a, "config", "--local", "user.name").Trim());
    }
}
