namespace GitHelper.Core;

public enum ChangeKind { Modified, Added, Deleted, Renamed, Copied, Untracked, Conflict, TypeChanged }

/// <summary>One changed file. X is the staged state, Y the working tree state, as git prints them.</summary>
public sealed record FileChange(string Path, string? OriginalPath, char X, char Y, ChangeKind Kind)
{
    public bool IsUntracked => Kind == ChangeKind.Untracked;
    public bool IsConflict => Kind == ChangeKind.Conflict;

    /// <summary>One letter for the list badge.</summary>
    public string Badge => Kind switch
    {
        ChangeKind.Modified => "M",
        ChangeKind.Added => "A",
        ChangeKind.Deleted => "D",
        ChangeKind.Renamed => "R",
        ChangeKind.Copied => "C",
        ChangeKind.Untracked => "?",
        ChangeKind.Conflict => "!",
        _ => "T",
    };

    public string KindText => Kind switch
    {
        ChangeKind.Modified => "Changed",
        ChangeKind.Added => "New file (staged)",
        ChangeKind.Deleted => "Deleted",
        ChangeKind.Renamed => $"Renamed from {OriginalPath}",
        ChangeKind.Copied => $"Copied from {OriginalPath}",
        ChangeKind.Untracked => "New file",
        ChangeKind.Conflict => "Conflict: fix it in the file, then commit",
        _ => "Type changed",
    };
}

public sealed class RepoStatus
{
    public string? Branch { get; init; }
    public bool Detached { get; init; }
    public bool NoCommitsYet { get; init; }
    public string? Upstream { get; init; }
    public int Ahead { get; init; }
    public int Behind { get; init; }
    public IReadOnlyList<FileChange> Files { get; init; } = [];

    public bool HasUpstream => Upstream != null;
}

public static class StatusParser
{
    /// <summary>Parses <c>git status --porcelain=v2 --branch -z</c>.</summary>
    public static RepoStatus Parse(string text)
    {
        string? branch = null, upstream = null;
        bool detached = false, initial = false;
        int ahead = 0, behind = 0;
        var files = new List<FileChange>();
        var parts = text.Split('\0');
        for (int i = 0; i < parts.Length; i++)
        {
            var e = parts[i];
            if (e.Length == 0) continue;
            if (e.StartsWith("# "))
            {
                var h = e[2..];
                if (h.StartsWith("branch.oid ")) initial = h.EndsWith("(initial)");
                else if (h.StartsWith("branch.head "))
                {
                    var v = h["branch.head ".Length..];
                    if (v == "(detached)") detached = true; else branch = v;
                }
                else if (h.StartsWith("branch.upstream ")) upstream = h["branch.upstream ".Length..];
                else if (h.StartsWith("branch.ab "))
                {
                    var ab = h["branch.ab ".Length..].Split(' ');
                    if (ab.Length == 2)
                    {
                        int.TryParse(ab[0].TrimStart('+'), out ahead);
                        int.TryParse(ab[1].TrimStart('-'), out behind);
                    }
                }
                continue;
            }
            switch (e[0])
            {
                case '1':
                {
                    var f = e.Split(' ', 9);
                    if (f.Length == 9) files.Add(Make(f[8], null, f[1]));
                    break;
                }
                case '2':
                {
                    var f = e.Split(' ', 10);
                    var orig = i + 1 < parts.Length ? parts[++i] : null;
                    if (f.Length == 10) files.Add(Make(f[9], orig, f[1]));
                    break;
                }
                case 'u':
                {
                    var f = e.Split(' ', 11);
                    if (f.Length == 11) files.Add(new FileChange(f[10], null, f[1][0], f[1][1], ChangeKind.Conflict));
                    break;
                }
                case '?':
                    files.Add(new FileChange(e[2..], null, '?', '?', ChangeKind.Untracked));
                    break;
            }
        }
        return new RepoStatus
        {
            Branch = branch, Detached = detached, NoCommitsYet = initial, Upstream = upstream,
            Ahead = ahead, Behind = behind, Files = files,
        };
    }

    static FileChange Make(string path, string? orig, string xy)
    {
        char x = xy[0], y = xy[1];
        char main = x != '.' ? x : y;
        // A file deleted in the working tree counts as deleted, even when an older change is staged.
        if (y == 'D') main = 'D';
        var kind = main switch
        {
            'A' => ChangeKind.Added,
            'D' => ChangeKind.Deleted,
            'R' => ChangeKind.Renamed,
            'C' => ChangeKind.Copied,
            'T' => ChangeKind.TypeChanged,
            _ => ChangeKind.Modified,
        };
        return new FileChange(path, orig, x, y, kind);
    }
}

public sealed record CommitInfo(string Hash, string FullHash, string Author, string Email, string When, string Subject)
{
    /// <summary>True when the commit is on this branch but not yet on the remote.</summary>
    public bool Unpushed { get; init; }
}

public enum DiffLineKind { Context, Added, Removed, Header, Hunk }

public sealed record DiffLine(string Text, DiffLineKind Kind);

public static class DiffParser
{
    public static IReadOnlyList<DiffLine> Parse(string diff)
    {
        var lines = new List<DiffLine>();
        bool inHunk = false;
        foreach (var raw in diff.Replace("\r\n", "\n").Split('\n'))
        {
            if (raw.StartsWith("diff --git")) { inHunk = false; lines.Add(new(raw, DiffLineKind.Header)); continue; }
            if (raw.StartsWith("@@")) { inHunk = true; lines.Add(new(raw, DiffLineKind.Hunk)); continue; }
            if (!inHunk) { if (raw.Length > 0) lines.Add(new(raw, DiffLineKind.Header)); continue; }
            var kind = raw.StartsWith('+') ? DiffLineKind.Added : raw.StartsWith('-') ? DiffLineKind.Removed : DiffLineKind.Context;
            lines.Add(new(raw, kind));
        }
        while (lines.Count > 0 && lines[^1].Kind == DiffLineKind.Context && lines[^1].Text.Length == 0) lines.RemoveAt(lines.Count - 1);
        return lines;
    }
}
