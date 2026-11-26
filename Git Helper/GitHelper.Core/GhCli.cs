using System.Text.Json;

namespace GitHelper.Core;

public sealed record GhUser(string Login, long Id, string? Name)
{
    /// <summary>GitHub's private commit email for this account, as shown on github.com/settings/emails.</summary>
    public string NoreplyEmail => $"{Id}+{Login}@users.noreply.github.com";
}

/// <summary>The GitHub CLI calls the app uses: sign in state, the account, clone.</summary>
public sealed class GhCli(ICommandRunner runner)
{
    public const string Gh = "gh";

    string Dir => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) is { Length: > 0 } h && Directory.Exists(h) ? h : Environment.CurrentDirectory;

    /// <summary>The signed in login, or null when gh is missing or nobody is signed in.</summary>
    public async Task<GhUser?> UserAsync()
    {
        var r = await runner.RunAsync(Gh, Dir, ["api", "user"], timeout: TimeSpan.FromSeconds(30));
        return r.Ok ? ParseUser(r.StdOut) : null;
    }

    public static GhUser? ParseUser(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("login", out var login) || !root.TryGetProperty("id", out var id)) return null;
            var name = root.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
            return new GhUser(login.GetString()!, id.GetInt64(), string.IsNullOrWhiteSpace(name) ? null : name);
        }
        catch (JsonException) { return null; }
    }

    public async Task<IReadOnlyList<string>> RepoListAsync()
    {
        var r = await runner.RunAsync(Gh, Dir, ["repo", "list", "--limit", "200", "--json", "nameWithOwner", "--jq", ".[].nameWithOwner"],
            timeout: TimeSpan.FromSeconds(60));
        return r.Ok ? r.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Order().ToList() : [];
    }

    /// <summary>Clones "owner/name" or a URL into <paramref name="target"/>.</summary>
    public Task<CommandResult> CloneAsync(string repo, string parentFolder, string target) =>
        runner.RunAsync(Gh, parentFolder, ["repo", "clone", repo.Trim(), target], timeout: TimeSpan.FromMinutes(20));

    /// <summary>The folder name a clone of "owner/name" or a URL gets.</summary>
    public static string FolderNameFor(string repo)
    {
        var r = repo.Trim().TrimEnd('/');
        if (r.EndsWith(".git")) r = r[..^4];
        var cut = Math.Max(r.LastIndexOf('/'), r.LastIndexOf(':'));
        return cut >= 0 ? r[(cut + 1)..] : r;
    }
}

/// <summary>Turns git's answers into plain words with the next step.</summary>
public static class Explain
{
    public static string Failure(string action, CommandResult r)
    {
        var t = (r.StdErr + "\n" + r.StdOut).ToLowerInvariant();
        string? hint = null;
        if (t.Contains("could not start")) hint = r.StdErr;
        else if (t.Contains("[rejected]") || t.Contains("non-fast-forward") || t.Contains("fetch first"))
            hint = "GitHub has commits you do not have yet. Click ⬇ Pull first, then ⬆ Push again.";
        else if (t.Contains("terminal prompts disabled") || t.Contains("authentication failed") || t.Contains("could not read username")
                 || t.Contains("permission denied") || t.Contains("error: 403"))
            hint = "GitHub did not accept your sign in. Click 🔑 Sign in to GitHub at the top, then try again.";
        else if (t.Contains("could not resolve host") || t.Contains("unable to access") || t.Contains("timed out"))
            hint = "GitHub could not be reached. Check the network or VPN, then try again.";
        else if (t.Contains("conflict"))
            hint = "Some files changed on both sides. Open them, keep the right lines, remove the <<<<<<< ======= >>>>>>> marks, then use Continue in the yellow bar.";
        else if (t.Contains("would be overwritten") || t.Contains("your local changes"))
            hint = "You have changes that would be lost. Commit them (or discard them) first, then try again.";
        else if (t.Contains("not possible to fast-forward") || t.Contains("diverging branches") || t.Contains("have diverged"))
            hint = "Your branch and GitHub both have new commits. Turn on \"Pull with rebase\" in Settings, then Pull again.";
        else if (t.Contains("nothing to commit"))
            hint = "There is nothing to commit.";
        else if (t.Contains("please tell me who you are") || t.Contains("empty ident"))
            hint = "Git does not know your name and email. Set them in ⚙ Settings, then commit again.";
        else if (t.Contains("does not appear to be a git repository") || t.Contains("no configured push destination"))
            hint = "This repository has no remote on GitHub to push to.";
        var detail = r.ErrorText;
        if (detail.Length > 600) detail = detail[..600] + "…";
        return hint == null ? $"{action} failed: {detail}" : $"{action} failed. {hint}";
    }
}
