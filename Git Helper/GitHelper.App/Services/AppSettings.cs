using System.IO;
using System.Text.Json;
using GitHelper.ViewModels;

namespace GitHelper.App.Services;

/// <summary>Stored in %LOCALAPPDATA%\GitHelper\settings.json.</summary>
public sealed class AppSettings : IAppSettings
{
    static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GitHelper");
    static readonly string FilePath = Path.Combine(Root, "settings.json");

    sealed class Stored
    {
        public List<string> RecentRepos { get; set; } = new();
        public string? LastRepo { get; set; }
        public string? IdentityName { get; set; }
        public string? IdentityEmail { get; set; }
        public bool CheckIdentity { get; set; }
        public bool PullRebase { get; set; } = true;
        public string? CloneFolder { get; set; }
    }

    readonly Stored data = new();

    public AppSettings()
    {
        try
        {
            if (File.Exists(FilePath) && JsonSerializer.Deserialize<Stored>(File.ReadAllText(FilePath)) is { } s) data = s;
        }
        catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException) { }
    }

    public List<string> RecentRepos => data.RecentRepos;
    public string? LastRepo { get => data.LastRepo; set => data.LastRepo = value; }
    public string? IdentityName { get => data.IdentityName; set => data.IdentityName = value; }
    public string? IdentityEmail { get => data.IdentityEmail; set => data.IdentityEmail = value; }
    public bool CheckIdentity { get => data.CheckIdentity; set => data.CheckIdentity = value; }
    public bool PullRebase { get => data.PullRebase; set => data.PullRebase = value; }
    public string? CloneFolder { get => data.CloneFolder; set => data.CloneFolder = value; }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Root);
            File.WriteAllText(FilePath, JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
    }
}
