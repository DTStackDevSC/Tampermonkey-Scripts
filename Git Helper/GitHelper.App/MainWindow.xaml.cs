using System.Windows;
using GitHelper.ViewModels;

namespace GitHelper.App;

public partial class MainWindow : Window
{
    public MainWindow(MainViewModel vm)
    {
        InitializeComponent();
        DataContext = vm;
        Title = $"Git Helper {MainViewModel.Version}";
        OutputBox.TextChanged += (_, _) => OutputBox.ScrollToEnd();
        Loaded += async (_, _) => await vm.StartCommand.ExecuteAsync(null);
    }
}
