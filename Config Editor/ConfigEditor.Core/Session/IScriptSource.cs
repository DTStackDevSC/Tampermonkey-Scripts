namespace ConfigEditor.Core.Session;

/// <summary>Where the suite scripts are read from.</summary>
public interface IScriptSource
{
    Task<string> ReadAsync(string relativePath, CancellationToken ct);
    string Description { get; }
}
