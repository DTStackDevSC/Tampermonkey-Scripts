using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Windows;
using System.Windows.Controls;

namespace AppUpdate;

/// <summary>
/// Runs at app start, before the main window: a small window checks GitHub, downloads a newer version,
/// replaces the exe and restarts. When it cannot replace itself, the new exe goes to Downloads and the user is told.
/// </summary>
public static class StartupUpdate
{
    /// <returns>False when the app restarted into the new version and this copy must exit.</returns>
    public static async Task<bool> RunAsync(Application app, UpdateTarget target, string[] args)
    {
        var exe = Environment.ProcessPath;
        if (!AppUpdater.CanSelfUpdate(exe, target.ExeName, args)) return true;
        AppUpdater.CleanUp(exe!, target.ExeName);

        // The update window must not count as the main window, or closing it would end the app.
        var mode = app.ShutdownMode;
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        using var http = AppUpdater.CreateHttp();
        var updater = new AppUpdater(http, target);
        using var cts = new CancellationTokenSource();
        var ui = new UpdateWindow(target.DisplayName, cts.Cancel);
        ui.Show();
        try
        {
            AppRelease? release;
            try
            {
                using var check = CancellationTokenSource.CreateLinkedTokenSource(cts.Token);
                check.CancelAfter(TimeSpan.FromSeconds(8));
                release = await updater.FindNewerAsync(check.Token);
            }
            catch (Exception e) when (e is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException)
            {
                return true; // offline, GitHub busy or skipped: start the current version
            }
            if (release == null) return true;

            ui.Say($"⬇ Downloading {target.DisplayName} {release.Version} (you have {target.Current})…");
            var fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            UpdateResult result;
            try
            {
                result = await updater.InstallAsync(release, exe!, fallback, new Progress<double>(ui.Progress), cts.Token);
            }
            catch (OperationCanceledException)
            {
                return true;
            }
            catch (Exception e) when (e is HttpRequestException or IOException or UnauthorizedAccessException or InvalidDataException)
            {
                ui.Close();
                var open = MessageBox.Show(
                    $"{target.DisplayName} {release.Version} is available, but it could not be downloaded:\n{e.Message}\n\n" +
                    "This version starts now. Click Yes to open the release page and download it yourself.",
                    $"{target.DisplayName}: update not downloaded", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (open == MessageBoxResult.Yes) Shell(release.PageUrl);
                return true;
            }

            if (result.Outcome == UpdateOutcome.Replaced)
            {
                ui.Say($"✅ Updated to {release.Version}. Restarting…");
                ui.Progress(1);
                await Task.Delay(900);
                AppUpdater.Restart(exe!, target.Current.ToString());
                app.Shutdown();
                return false;
            }

            ui.Close();
            MessageBox.Show(
                $"{target.DisplayName} {release.Version} is available, but this copy could not replace itself" +
                (result.Reason != null ? $" ({result.Reason})" : "") + ".\n\n" +
                $"The new version was downloaded to:\n{result.Path}\n\n" +
                "Close this app and use the new file from now on (you can move it where the old one was). " +
                "Explorer opens on it now. This version starts meanwhile.",
                $"{target.DisplayName}: new version downloaded", MessageBoxButton.OK, MessageBoxImage.Information);
            Shell("explorer.exe", $"/select,\"{result.Path}\"");
            return true;
        }
        finally
        {
            if (ui.IsLoaded) ui.Close();
            app.ShutdownMode = mode;
        }
    }

    static void Shell(string target, string? args = null)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true, Arguments = args ?? "" }); }
        catch (Exception) { /* nothing more we can do; the message already said where the file is */ }
    }

    sealed class UpdateWindow : Window
    {
        readonly TextBlock text;
        readonly ProgressBar bar;

        public UpdateWindow(string name, Action skip)
        {
            Title = $"{name}: update";
            Width = 440; SizeToContent = SizeToContent.Height; ResizeMode = ResizeMode.NoResize;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            text = new TextBlock { Text = "🔄 Checking for a new version…", TextWrapping = TextWrapping.Wrap, FontSize = 14 };
            bar = new ProgressBar { IsIndeterminate = true, Height = 6, Margin = new Thickness(0, 12, 0, 12), Maximum = 1 };
            var skipButton = new Button { Content = "Skip this time", HorizontalAlignment = HorizontalAlignment.Right, Padding = new Thickness(12, 4, 12, 4),
                ToolTip = "Start the version you have now; the update is offered again next time" };
            skipButton.Click += (_, _) => { skipButton.IsEnabled = false; skipButton.Content = "Skipping…"; skip(); };
            Content = new StackPanel { Margin = new Thickness(20, 16, 20, 16), Children = { text, bar, skipButton } };
        }

        public void Say(string message) => text.Text = message;

        public void Progress(double value)
        {
            bar.IsIndeterminate = false;
            bar.Value = value;
        }
    }
}
