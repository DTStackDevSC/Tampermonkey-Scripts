using ConfigEditor.Core.Session;

namespace ConfigEditor.ViewModels;

public interface IScriptSourceFactory
{
    IScriptSource GitHub();
    IScriptSource Folder(string path);
}

public interface IAppSettings
{
    bool PublishEnabled { get; set; }
    bool EmailReminderShown { get; set; }
    /// <summary>Where "Save" writes when the scripts were opened from GitHub.</summary>
    string WorkFolder { get; }
    void Save();
}

/// <summary>Everything that needs a window or the shell; the App implements it, tests fake it.</summary>
public interface IDialogs
{
    string? PickFolder();
    bool Confirm(string title, string message);
    NewTeamRequest? AskNewTeam(IReadOnlyList<TeamChoice> teams);
    /// <summary>Shows the save or publish dialog modally; the dialog runs the work itself.</summary>
    void ShowSave(SaveDialogViewModel vm);
    void ShowSettings(SettingsViewModel vm);
    void OpenUrl(string url);
    void ShowHelp(HelpGuide guide);
}

public sealed record NewTeamRequest(string DisplayName, string ShortLabel, string CopyFromKey);

public sealed record TeamChoice(string Key, string Label)
{
    public override string ToString() => Label;
}

public sealed record LinkItem(string Title, string Url);
