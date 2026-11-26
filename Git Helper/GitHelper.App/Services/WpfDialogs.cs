using System.Diagnostics;
using System.IO;
using System.Windows;
using GitHelper.App.Views;
using GitHelper.ViewModels;
using Microsoft.Win32;

namespace GitHelper.App.Services;

public sealed class WpfDialogs : IDialogs
{
    static Window? Owner => Application.Current.MainWindow;

    public string? PickFolder(string title, string? start = null)
    {
        var d = new OpenFolderDialog { Title = title };
        if (start != null && Directory.Exists(start)) d.InitialDirectory = start;
        return d.ShowDialog(Owner) == true ? d.FolderName : null;
    }

    public bool Confirm(string title, string message) =>
        MessageBox.Show(Owner!, message, title, MessageBoxButton.OKCancel, MessageBoxImage.Question) == MessageBoxResult.OK;

    public void OpenUrl(string url) => Shell(url);

    public void OpenFolder(string path) => Shell(path);

    static void Shell(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception e) { MessageBox.Show(Owner!, $"Could not open {target}: {e.Message}", "Git Helper"); }
    }

    public void ShowSettings(SettingsViewModel vm) => new SettingsDialog(vm) { Owner = Owner }.ShowDialog();

    public void ShowClone(CloneViewModel vm) => new CloneDialog(vm) { Owner = Owner }.ShowDialog();

    HelpWindow? help;

    public void ShowHelp(HelpGuide guide)
    {
        if (help is { IsLoaded: true }) { help.Activate(); return; }
        help = new HelpWindow(guide) { Owner = Owner };
        help.Closed += (_, _) => help = null;
        help.Show();
    }

    /// <summary>A console tool started from a window app gets its own console window, where the user answers it.</summary>
    public async Task<int> RunInConsoleAsync(string exe, IReadOnlyList<string> args)
    {
        var psi = new ProcessStartInfo(exe) { UseShellExecute = false, CreateNoWindow = false };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var p = Process.Start(psi) ?? throw new InvalidOperationException($"{exe} did not start.");
        await p.WaitForExitAsync();
        return p.ExitCode;
    }
}
