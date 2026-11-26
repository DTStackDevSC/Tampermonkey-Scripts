using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using GitHelper.App.Services;
using GitHelper.Core;
using GitHelper.ViewModels;

namespace GitHelper.App;

public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        var v = typeof(App).Assembly.GetName().Version ?? new Version(1, 0, 0);
        // A newer release replaces this exe and restarts it before anything opens.
        if (!await AppUpdate.StartupUpdate.RunAsync(this,
                new AppUpdate.UpdateTarget("Git Helper", "git-helper-v", "GitHelper.exe", new Version(v.Major, v.Minor, v.Build)), e.Args))
            return;
        DispatcherUnhandledException += (_, args) =>
        {
            MessageBox.Show(args.Exception.Message, "Git Helper: unexpected error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };
        var vm = new MainViewModel(new ProcessRunner(), new WpfDialogs(), new AppSettings(),
            appFolder: Path.GetDirectoryName(Environment.ProcessPath));
        var window = new MainWindow(vm);
        MainWindow = window;
        window.Show();
    }
}

public sealed class InverseBoolToVisibility : IValueConverter
{
    public object Convert(object value, Type t, object p, CultureInfo c) => value is true ? Visibility.Collapsed : Visibility.Visible;
    public object ConvertBack(object value, Type t, object p, CultureInfo c) => throw new NotSupportedException();
}

/// <summary>Hides a hint while its text is empty.</summary>
public sealed class EmptyToVisibility : IValueConverter
{
    public object Convert(object? value, Type t, object p, CultureInfo c) => string.IsNullOrEmpty(value as string) ? Visibility.Collapsed : Visibility.Visible;
    public object ConvertBack(object value, Type t, object p, CultureInfo c) => throw new NotSupportedException();
}

/// <summary>Colours a status line by how it ended.</summary>
public sealed class StatusBrush : IValueConverter
{
    static readonly Brush Ok = Frozen("#1E8E3E"), Warn = Frozen("#B26A00"), Bad = Frozen("#C62828"), Busy = Frozen("#4F5BD5");

    static Brush Frozen(string hex) { var b = (Brush)new BrushConverter().ConvertFromString(hex)!; b.Freeze(); return b; }

    public object Convert(object value, Type t, object p, CultureInfo c) => value switch
    {
        StatusKind.Success => Ok,
        StatusKind.Warning => Warn,
        StatusKind.Error => Bad,
        StatusKind.Working => Busy,
        _ => Application.Current.TryFindResource("TextFillColorPrimaryBrush") as Brush ?? Brushes.Black,
    };
    public object ConvertBack(object value, Type t, object p, CultureInfo c) => throw new NotSupportedException();
}

/// <summary>Green for added lines, red for removed ones, like GitHub.</summary>
public sealed class DiffBrush : IValueConverter
{
    static readonly Brush Added = Frozen("#3322A045"), Removed = Frozen("#33E5534B"), Hunk = Frozen("#22667EEA");

    static Brush Frozen(string hex) { var b = (Brush)new BrushConverter().ConvertFromString(hex)!; b.Freeze(); return b; }

    public object Convert(object value, Type t, object p, CultureInfo c) => value switch
    {
        DiffLineKind.Added => Added,
        DiffLineKind.Removed => Removed,
        DiffLineKind.Hunk => Hunk,
        _ => Brushes.Transparent,
    };
    public object ConvertBack(object value, Type t, object p, CultureInfo c) => throw new NotSupportedException();
}
