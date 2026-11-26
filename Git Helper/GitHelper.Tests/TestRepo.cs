using GitHelper.Core;

namespace GitHelper.Tests;

/// <summary>A throw away bare "GitHub" remote with clones of it, in a temp folder.</summary>
public sealed class TestRepo : IDisposable
{
    public static readonly ProcessRunner Runner = new();
    public string Dir { get; } = Path.Combine(Path.GetTempPath(), "githelper-tests", Guid.NewGuid().ToString("N")[..10]);
    public string Remote => Path.Combine(Dir, "remote.git");

    public TestRepo(bool withFirstCommit = true)
    {
        Directory.CreateDirectory(Dir);
        Git(Dir, "init", "-q", "--bare", "-b", "main", "remote.git");
        if (!withFirstCommit) return;
        var seed = Clone("seed");
        File.WriteAllText(Path.Combine(seed, "readme.txt"), "line one\nline two\nline three\n");
        Git(seed, "add", "readme.txt");
        Git(seed, "commit", "-q", "-m", "First commit");
        Git(seed, "push", "-q", "-u", "origin", "main");
    }

    /// <summary>A new clone with a fixed test identity.</summary>
    public string Clone(string name)
    {
        Git(Dir, "clone", "-q", "-c", "core.autocrlf=false", Remote, name); // same bytes on Windows runners
        var path = Path.Combine(Dir, name);
        Git(path, "config", "user.name", "Test User");
        Git(path, "config", "user.email", "test@example.com");
        Git(path, "config", "pull.rebase", "false");
        return path;
    }

    public static string Git(string dir, params string[] args)
    {
        var r = Runner.RunAsync("git", dir, args).GetAwaiter().GetResult();
        if (!r.Ok) throw new InvalidOperationException($"{r.CommandLine}: {r.ErrorText}");
        return r.StdOut;
    }

    public static void Write(string repo, string rel, string text)
    {
        var p = Path.Combine(repo, rel);
        Directory.CreateDirectory(Path.GetDirectoryName(p)!);
        File.WriteAllText(p, text);
    }

    public static void CommitAll(string repo, string message)
    {
        Git(repo, "add", "-A");
        Git(repo, "commit", "-q", "-m", message);
    }

    public void Dispose()
    {
        try
        {
            foreach (var f in Directory.EnumerateFiles(Dir, "*", SearchOption.AllDirectories)) File.SetAttributes(f, FileAttributes.Normal);
            Directory.Delete(Dir, true);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
