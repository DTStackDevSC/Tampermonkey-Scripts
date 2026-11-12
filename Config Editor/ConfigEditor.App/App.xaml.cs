using System.Globalization;
using System.Windows;
using System.Windows.Data;
using ConfigEditor.App.Services;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) =>
        {
            MessageBox.Show(args.Exception.Message, "Config Editor: unexpected error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };
        var vm = new MainViewModel(new SourceFactory(), new DpapiTokenStore(), new WpfDialogs(), new AppSettings());
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

public sealed class NullToVisibility : IValueConverter
{
    public object Convert(object? value, Type t, object p, CultureInfo c) =>
        (value == null || value as string == "") ^ (p as string == "invert") ? Visibility.Collapsed : Visibility.Visible;
    public object ConvertBack(object value, Type t, object p, CultureInfo c) => throw new NotSupportedException();
}
