using System.Text;

namespace GitHelper.Core;

public enum RepoOperation { None, Rebase, Merge, CherryPick, Revert }

public sealed record GitIdentity(string? Name, string? Email)
{
    public bool IsSet => !string.IsNullOrWhiteSpace(Name) && !string.IsNullOrWhiteSpace(Email);
    public override string ToString() => IsSet ? $"{Name} <{Email}>" : "not set";

    public bool SameAs(GitIdentity other) =>
        string.Equals(Name?.Trim(), other.Name?.Trim(), StringComparison.Ordinal) &&
        string.Equals(Email?.Trim(), other.Email?.Trim(), StringComparison.OrdinalIgnoreCase);
}

/// <summary>Every git action the app offers, on one working folder. Each call returns git's own answer.</summary>
public sealed class GitRepo
{
    public const string Git = "git";
    // No fsmonitor program: a folder's own .git/config could name one, and the app reads status on its own when a folder opens.
    static readonly string[] Common = ["--literal-pathspecs", "-c", "core.fsmonitor=false", "-c", "core.quotepath=false", "-c", "color.ui=false", "-c", "core.pager=cat"];

    readonly ICommandRunner runner;

    public GitRepo(ICommandRunner runner, string root) { this.runner = runner; Root = root; }

    public string Root { get; }
    public string Name => Path.GetFileName(Root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));

    public Task<CommandResult> RunAsync(params string[] args) => RunAsync(args, null);

    public Task<CommandResult> RunAsync(IReadOnlyList<string> args, string? stdin, TimeSpan? timeout = null) =>
        runner.RunAsync(Git, Root, [.. Common, .. args], stdin, timeout);

    /// <summary>The top folder of the repository that holds <paramref name="folder"/>, or null if it is not inside one.</summary>
    public static async Task<string?> FindRootAsync(ICommandRunner runner, string folder)
    {
        if (!Directory.Exists(folder)) return null;
        var r = await runner.RunAsync(Git, folder, ["rev-parse", "--show-toplevel"], timeout: TimeSpan.FromSeconds(30));
        if (!r.Ok) return null;
        var top = r.StdOut.Trim();
        return top.Length == 0 ? null : Path.GetFullPath(top);
    }

    public static async Task<string?> VersionAsync(ICommandRunner runner, string exe)
    {
        var r = await runner.RunAsync(exe, Environment.CurrentDirectory, ["--version"], timeout: TimeSpan.FromSeconds(20));
        return r.Ok ? r.StdOut.Split('\n')[0].Trim() : null;
    }

    public async Task<RepoStatus> StatusAsync()
    {
        var r = await RunAsync("status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all");
        if (!r.Ok) throw new GitException(r);
        return StatusParser.Parse(r.StdOut);
    }

    public async Task<RepoOperation> OperationAsync()
    {
        foreach (var (path, op) in new[] {
            ("rebase-merge", RepoOperation.Rebase), ("rebase-apply", RepoOperation.Rebase),
            ("MERGE_HEAD", RepoOperation.Merge), ("CHERRY_PICK_HEAD", RepoOperation.CherryPick), ("REVERT_HEAD", RepoOperation.Revert) })
        {
            var r = await RunAsync("rev-parse", "--git-path", path);
            if (!r.Ok) continue;
            var p = r.StdOut.Trim();
            if (!Path.IsPathRooted(p)) p = Path.Combine(Root, p);
            if (File.Exists(p) || Directory.Exists(p)) return op;
        }
        return RepoOperation.None;
    }

    public async Task<IReadOnlyList<string>> RemotesAsync()
    {
        var r = await RunAsync("remote");
        return r.Ok ? r.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) : [];
    }

    public async Task<string?> RemoteUrlAsync(string remote = "origin")
    {
        var r = await RunAsync("remote", "get-url", remote);
        return r.Ok ? r.StdOut.Trim() : null;
    }

    /// <summary>The web page of a GitHub remote (https or ssh form), or null for any other host.</summary>
    public static string? WebUrl(string? remoteUrl)
    {
        if (string.IsNullOrWhiteSpace(remoteUrl)) return null;
        var u = remoteUrl.Trim();
        if (u.StartsWith("git@github.com:")) u = "https://github.com/" + u["git@github.com:".Length..];
        else if (u.StartsWith("ssh://git@github.com/")) u = "https://github.com/" + u["ssh://git@github.com/".Length..];
        var at = u.IndexOf('@');
        if (u.StartsWith("https://") && at > 0 && at < u.IndexOf("github.com", StringComparison.Ordinal)) u = "https://" + u[(at + 1)..];
        if (!u.StartsWith("https://github.com/")) return null;
        if (u.EndsWith(".git")) u = u[..^4];
        return u.TrimEnd('/');
    }

    public async Task<(IReadOnlyList<string> Local, IReadOnlyList<string> RemoteOnly)> BranchesAsync()
    {
        var l = await RunAsync("for-each-ref", "--format=%(refname:short)", "refs/heads/");
        var local = l.Ok ? l.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() : [];
        var r = await RunAsync("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/");
        var remote = r.Ok
            ? r.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(b => b.StartsWith("origin/") && b != "origin/HEAD" && b != "origin")
                .Select(b => b["origin/".Length..])
                .Where(b => !local.Contains(b))
                .ToList()
            : [];
        return (local, remote);
    }

    public async Task<bool> IsValidBranchNameAsync(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        var r = await RunAsync("check-ref-format", "--branch", name);
        return r.Ok;
    }

    public Task<CommandResult> SwitchAsync(string branch) => RunAsync("switch", branch);
    public Task<CommandResult> CreateBranchAsync(string branch) => RunAsync("switch", "-c", branch);

    public Task<CommandResult> FetchAsync() => RunAsync(["fetch", "--prune"], null, TimeSpan.FromMinutes(10));

    public Task<CommandResult> PullAsync(bool rebase) =>
        RunAsync(rebase ? ["pull", "--rebase", "--autostash"] : ["pull", "--ff-only"], null, TimeSpan.FromMinutes(10));

    /// <summary>Pushes the current branch; a branch never pushed gets its upstream on origin.</summary>
    public Task<CommandResult> PushAsync(bool setUpstream) =>
        RunAsync(setUpstream ? ["push", "-u", "origin", "HEAD"] : ["push"], null, TimeSpan.FromMinutes(10));

    /// <summary>
    /// Commits only the given files (new, changed or deleted), whatever else is staged.
    /// During a merge git refuses partial commits, so then the files are staged and everything staged is committed.
    /// </summary>
    public async Task<CommandResult> CommitAsync(IReadOnlyList<FileChange> files, string message, bool merging)
    {
        // The old name of a rename is already staged as gone, so only the new name is added; both go into the commit.
        var add = await RunAsync(["add", "-A", "--", .. files.Select(f => f.Path).Distinct()], null);
        var paths = files.SelectMany(f => f.OriginalPath != null ? new[] { f.Path, f.OriginalPath } : [f.Path]).Distinct().ToList();
        if (!add.Ok) return add;
        return merging
            ? await RunAsync(["commit", "-F", "-"], message)
            : await RunAsync(["commit", "-F", "-", "--", .. paths], message);
    }

    public async Task<CommandResult> DiscardAsync(FileChange f, bool noCommitsYet)
    {
        if (f.IsConflict) return new CommandResult(1, "", "A file with a conflict cannot be discarded alone. Use Abort in the yellow bar to go back.", "");
        if (f.IsUntracked) return await RunAsync("clean", "-f", "-q", "--", f.Path);
        if (f.X == 'A' || noCommitsYet) return await RunAsync("rm", "-f", "-q", "--", f.Path);
        if (f.OriginalPath != null)
        {
            var rm = await RunAsync("rm", "-f", "-q", "--", f.Path);
            if (!rm.Ok) return rm;
            return await RunAsync("restore", "--source=HEAD", "--staged", "--worktree", "--", f.OriginalPath);
        }
        return await RunAsync("restore", "--source=HEAD", "--staged", "--worktree", "--", f.Path);
    }

    public async Task<string> DiffAsync(FileChange f, bool noCommitsYet)
    {
        if (f.IsUntracked) return NewFileDiff(f.Path);
        CommandResult r;
        if (noCommitsYet)
        {
            var staged = await RunAsync("diff", "--no-ext-diff", "--no-textconv", "--cached", "--", f.Path);
            var work = await RunAsync("diff", "--no-ext-diff", "--no-textconv", "--", f.Path);
            return staged.StdOut + work.StdOut;
        }
        if (f.IsConflict) r = await RunAsync("diff", "--no-ext-diff", "--no-textconv", "--", f.Path);
        else if (f.OriginalPath != null) r = await RunAsync("diff", "--no-ext-diff", "--no-textconv", "-M", "HEAD", "--", f.OriginalPath, f.Path);
        else r = await RunAsync("diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", f.Path);
        if (!r.Ok) throw new GitException(r);
        return r.StdOut;
    }

    string NewFileDiff(string rel)
    {
        var full = Path.Combine(Root, rel);
        var sb = new StringBuilder($"New file {rel}\n");
        try
        {
            var info = new FileInfo(full);
            if (!info.Exists) return sb.Append("(the file is gone)").ToString();
            if (info.Length > 512 * 1024) return sb.Append($"(too big to show here: {info.Length / 1024} KB)").ToString();
            var bytes = File.ReadAllBytes(full);
            if (bytes.AsSpan().IndexOf((byte)0) >= 0) return sb.Append("(binary file)").ToString();
            var text = Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n");
            var lines = text.Split('\n');
            if (text.EndsWith('\n')) lines = lines[..^1];
            sb.Append($"@@ -0,0 +1,{lines.Length} @@\n");
            foreach (var l in lines) sb.Append('+').Append(l).Append('\n');
        }
        catch (IOException e) { sb.Append($"(could not read it: {e.Message})"); }
        catch (UnauthorizedAccessException e) { sb.Append($"(could not read it: {e.Message})"); }
        return sb.ToString();
    }

    public async Task<IReadOnlyList<CommitInfo>> LogAsync(int count, bool hasUpstream)
    {
        var r = await RunAsync("log", $"-n{count}", "--format=%h%x1f%H%x1f%an%x1f%ae%x1f%ar%x1f%s%x1e");
        if (!r.Ok) return [];
        HashSet<string> unpushed = [];
        var u = await RunAsync(hasUpstream ? ["rev-list", "@{u}..HEAD"] : ["rev-list", "HEAD", "--not", "--remotes"], null);
        if (u.Ok) unpushed = u.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
        var list = new List<CommitInfo>();
        foreach (var rec in r.StdOut.Split('\x1e'))
        {
            var f = rec.Trim('\n', '\r').Split('\x1f');
            if (f.Length < 6) continue;
            list.Add(new CommitInfo(f[0], f[1], f[2], f[3], f[4], f[5]) { Unpushed = unpushed.Contains(f[1]) });
        }
        return list;
    }

    /// <summary>Takes the last commit back; its changes stay in the files. Only for a commit not pushed yet.</summary>
    public async Task<string> LastMessageAsync()
    {
        var r = await RunAsync("log", "-1", "--format=%B");
        return r.Ok ? r.StdOut.TrimEnd() : "";
    }

    public Task<CommandResult> UndoLastCommitAsync() => RunAsync("reset", "--soft", "HEAD~1");

    public Task<CommandResult> AbortAsync(RepoOperation op) => op switch
    {
        RepoOperation.Rebase => RunAsync("rebase", "--abort"),
        RepoOperation.Merge => RunAsync("merge", "--abort"),
        RepoOperation.CherryPick => RunAsync("cherry-pick", "--abort"),
        RepoOperation.Revert => RunAsync("revert", "--abort"),
        _ => Task.FromResult(new CommandResult(0, "", "", "")),
    };

    /// <summary>Marks the fixed files as resolved and goes on with the rebase (no editor opens).</summary>
    public async Task<CommandResult> ContinueRebaseAsync(IReadOnlyList<string> resolved)
    {
        if (resolved.Count > 0)
        {
            var add = await RunAsync(["add", "--", .. resolved], null);
            if (!add.Ok) return add;
        }
        return await RunAsync(["-c", "core.editor=true", "rebase", "--continue"], null);
    }

    /// <summary>Files that still hold conflict markers, so the user is told before git is asked to go on.</summary>
    public IReadOnlyList<string> FilesWithMarkers(IEnumerable<string> paths)
    {
        var left = new List<string>();
        foreach (var p in paths)
        {
            try
            {
                var full = Path.Combine(Root, p);
                if (!File.Exists(full)) continue;
                foreach (var line in File.ReadLines(full))
                    if (line.StartsWith("<<<<<<< ") || line.StartsWith(">>>>>>> ")) { left.Add(p); break; }
            }
            catch (IOException) { }
        }
        return left;
    }

    public async Task<GitIdentity> IdentityAsync()
    {
        var n = await RunAsync("config", "user.name");
        var e = await RunAsync("config", "user.email");
        return new GitIdentity(n.Ok ? n.StdOut.Trim() : null, e.Ok ? e.StdOut.Trim() : null);
    }

    /// <summary>Sets the commit name and email for this repository only (not global).</summary>
    public async Task<CommandResult> SetLocalIdentityAsync(GitIdentity id)
    {
        var n = await RunAsync("config", "--local", "user.name", id.Name!.Trim());
        if (!n.Ok) return n;
        return await RunAsync("config", "--local", "user.email", id.Email!.Trim());
    }
}

public sealed class GitException(CommandResult result) : Exception(result.ErrorText)
{
    public CommandResult Result { get; } = result;
}
