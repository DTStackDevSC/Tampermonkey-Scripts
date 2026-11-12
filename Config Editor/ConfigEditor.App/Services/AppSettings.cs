using System.IO;
using System.Net.Http;
using System.Text.Json;
using ConfigEditor.Core.Session;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App.Services;

public static class AppPaths
{
    public static readonly string Root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ConfigEditor");
}

public sealed class AppSettings : IAppSettings
{
    static readonly string FilePath = Path.Combine(AppPaths.Root, "settings.json");

    sealed record Stored(bool PublishEnabled, bool EmailReminderShown);

    public AppSettings()
    {
        try
        {
            if (File.Exists(FilePath) && JsonSerializer.Deserialize<Stored>(File.ReadAllText(FilePath)) is { } s)
            {
                PublishEnabled = s.PublishEnabled;
                EmailReminderShown = s.EmailReminderShown;
            }
        }
        catch (Exception e) when (e is IOException or JsonException) { }
    }

    public bool PublishEnabled { get; set; }
    public bool EmailReminderShown { get; set; }
    public string WorkFolder { get; } = Path.Combine(AppPaths.Root, "work");

    public void Save()
    {
        Directory.CreateDirectory(AppPaths.Root);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(new Stored(PublishEnabled, EmailReminderShown)));
    }
}

public sealed class SourceFactory : IScriptSourceFactory
{
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };
    public IScriptSource GitHub() => new GitHubRawSource(Http);
    public IScriptSource Folder(string path) => new FolderSource(path);
}
