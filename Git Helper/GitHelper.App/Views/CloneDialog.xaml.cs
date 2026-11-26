using System.Windows;
using GitHelper.ViewModels;

namespace GitHelper.App.Views;

public partial class CloneDialog : Window
{
    readonly CloneViewModel vm;

    public CloneDialog(CloneViewModel vm)
    {
        InitializeComponent();
        DataContext = this.vm = vm;
        vm.CloseRequested += Close;
        // A clone that is running cannot be left halfway by closing the window.
        Closing += (_, e) => e.Cancel = vm.IsBusy;
    }

    void OnCancel(object sender, RoutedEventArgs e) { if (!vm.IsBusy) Close(); }
}
