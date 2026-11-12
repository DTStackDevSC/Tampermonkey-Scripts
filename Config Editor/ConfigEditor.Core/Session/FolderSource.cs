using System.Text;

namespace ConfigEditor.Core.Session;

/// <summary>Reads the scripts from a local copy of the repository.</summary>
public sealed class FolderSource : IScriptSource
{
    public FolderSource(string root) { Root = root; }
    public string Root { get; }
    public string Description => "Folder " + Root;

    public Task<string> ReadAsync(string relativePath, CancellationToken ct) =>
        File.ReadAllTextAsync(Path.Combine(Root, relativePath.Replace('/', Path.DirectorySeparatorChar)), Encoding.UTF8, ct);
}
