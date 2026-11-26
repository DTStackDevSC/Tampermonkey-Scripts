using System.IO;
using System.Text.Json;
using GitHelper.ViewModels;

namespace GitHelper.App.Services;

/// <summary>
/// Stored inside the user's own profile, never next to the exe or in Program Files, so no admin rights are needed:
/// %LOCALAPPDATA%\GitHelper\settings.json, or %USERPROFILE%\.githelper\settings.json when that folder cannot be used.
/// </summary>
public sealed class AppSettings : IAppSettings
{
    static readonly string[] Roots =
    [
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GitHelper"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".githelper"),
    ];
    string filePath = Path.Combine(Roots[0], "settings.json");

    sealed class Stored
    {
        public List<string> RecentRepos { get; set; } = new();
        public string? LastRepo { get; set; }
        public string? IdentityName { get; set; }
        public string? IdentityEmail { get; set; }
        public bool CheckIdentity { get; set; }
        public bool PullRebase { get; set; } = true;
        public string? CloneFolder { get; set; }
        public bool PullAppRepoOnStart { get; set; } = true;
    }

    readonly Stored data = new();

    public AppSettings()
    {
        foreach (var root in Roots)
        {
            var path = Path.Combine(root, "settings.json");
            try
            {
                if (File.Exists(path) && JsonSerializer.Deserialize<Stored>(File.ReadAllText(path)) is { } s) { data = s; filePath = path; break; }
            }
            catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException) { }
        }
    }

    public string Location => filePath;

    public List<string> RecentRepos => data.RecentRepos;
    public string? LastRepo { get => data.LastRepo; set => data.LastRepo = value; }
    public string? IdentityName { get => data.IdentityName; set => data.IdentityName = value; }
    public string? IdentityEmail { get => data.IdentityEmail; set => data.IdentityEmail = value; }
    public bool CheckIdentity { get => data.CheckIdentity; set => data.CheckIdentity = value; }
    public bool PullRebase { get => data.PullRebase; set => data.PullRebase = value; }
    public string? CloneFolder { get => data.CloneFolder; set => data.CloneFolder = value; }
    public bool PullAppRepoOnStart { get => data.PullAppRepoOnStart; set => data.PullAppRepoOnStart = value; }

    public string? Save()
    {
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        string? error = null;
        // The current file first, then the other user folder if the first cannot be written.
        foreach (var path in new[] { filePath }.Concat(Roots.Select(r => Path.Combine(r, "settings.json"))).Distinct())
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, json);
                filePath = path;
                return null;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException) { error ??= e.Message; }
        }
        return error;
    }
}
