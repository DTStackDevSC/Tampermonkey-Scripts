namespace ConfigEditor.Core.Publish;

/// <summary>Keeps the GitHub token between runs (encrypted for the Windows user in the app).</summary>
public interface ITokenStore
{
    string? Load();
    void Save(string token);
    void Clear();
}
