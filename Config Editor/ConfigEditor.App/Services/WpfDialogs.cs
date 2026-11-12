using System.Diagnostics;
using System.Windows;
using ConfigEditor.App.Views;
using ConfigEditor.ViewModels;
using Microsoft.Win32;

namespace ConfigEditor.App.Services;

public sealed class WpfDialogs : IDialogs
{
    static Window? Owner => Application.Current.MainWindow;

    public string? PickFolder()
    {
        var d = new OpenFolderDialog { Title = "Pick the folder that holds 'Standalone Scripts' and 'Toolbar Scripts'" };
        return d.ShowDialog(Owner) == true ? d.FolderName : null;
    }

    public bool Confirm(string title, string message) =>
        MessageBox.Show(Owner!, message, title, MessageBoxButton.OKCancel, MessageBoxImage.Question) == MessageBoxResult.OK;

    public NewTeamRequest? AskNewTeam(IReadOnlyList<TeamChoice> teams)
    {
        var d = new NewTeamDialog(teams) { Owner = Owner };
        return d.ShowDialog() == true ? d.Result : null;
    }

    public void ShowSave(SaveDialogViewModel vm) => new SaveDialog(vm) { Owner = Owner }.ShowDialog();

    public void ShowSettings(SettingsViewModel vm) => new SettingsDialog(vm) { Owner = Owner }.ShowDialog();

    public void OpenUrl(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception e) { MessageBox.Show(Owner!, $"Could not open {url}: {e.Message}", "Config Editor"); }
    }
}
