using System.Windows;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App;

public partial class MainWindow : Window
{
    readonly MainViewModel vm;

    public MainWindow(MainViewModel vm)
    {
        InitializeComponent();
        this.vm = vm;
        DataContext = vm;
        Loaded += async (_, _) => await vm.StartAsync();
        Closing += (_, e) =>
        {
            if (vm.HasUnsavedWork &&
                MessageBox.Show(this, "You have edits that are not saved yet. Close anyway?",
                    "Config Editor", MessageBoxButton.OKCancel, MessageBoxImage.Warning) != MessageBoxResult.OK)
                e.Cancel = true;
        };
    }
}
