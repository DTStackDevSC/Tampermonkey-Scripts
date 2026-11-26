namespace GitHelper.ViewModels;

public interface IAppSettings
{
    /// <summary>Repositories opened before, newest first.</summary>
    List<string> RecentRepos { get; }
    string? LastRepo { get; set; }
    /// <summary>The name and email the user wants on every commit. Empty means "do not check".</summary>
    string? IdentityName { get; set; }
    string? IdentityEmail { get; set; }
    bool CheckIdentity { get; set; }
    bool PullRebase { get; set; }
    string? CloneFolder { get; set; }
    /// <summary>Pull the repository the app runs from when it starts. On by default.</summary>
    bool PullAppRepoOnStart { get; set; }
    /// <summary>Where the settings file lives (inside the user's own profile, no admin rights needed).</summary>
    string Location { get; }
    /// <summary>Writes the settings; returns an error text when it could not.</summary>
    string? Save();
}

/// <summary>Everything that needs a window or the shell; the App implements it, tests fake it.</summary>
public interface IDialogs
{
    string? PickFolder(string title, string? start = null);
    bool Confirm(string title, string message);
    void OpenUrl(string url);
    void OpenFolder(string path);
    void ShowSettings(SettingsViewModel vm);
    void ShowClone(CloneViewModel vm);
    void ShowHelp(HelpGuide guide);
    /// <summary>Runs an interactive console tool (gh auth login) in its own window and waits until it ends.</summary>
    Task<int> RunInConsoleAsync(string exe, IReadOnlyList<string> args);
}

public enum StatusKind { Info, Working, Success, Warning, Error }

public sealed record BranchItem(string Name, bool RemoteOnly)
{
    public string Display => RemoteOnly ? $"{Name}  (on GitHub only)" : Name;
    public override string ToString() => Display;
}
