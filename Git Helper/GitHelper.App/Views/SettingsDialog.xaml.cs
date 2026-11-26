using System.Windows;
using GitHelper.ViewModels;

namespace GitHelper.App.Views;

public partial class SettingsDialog : Window
{
    public SettingsDialog(SettingsViewModel vm)
    {
        InitializeComponent();
        DataContext = vm;
        vm.CloseRequested += _ => Close();
    }
}
