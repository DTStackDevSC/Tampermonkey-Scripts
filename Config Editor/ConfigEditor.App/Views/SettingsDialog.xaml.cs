using System.Diagnostics;
using System.Windows;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App.Views;

public partial class SettingsDialog : Window
{
    readonly SettingsViewModel vm;

    public SettingsDialog(SettingsViewModel vm)
    {
        InitializeComponent();
        this.vm = vm;
        DataContext = vm;
        TokenBox.Password = vm.Token;
        vm.CloseRequested += Close;
    }

    void TokenBox_PasswordChanged(object sender, RoutedEventArgs e) => vm.Token = TokenBox.Password;

    void CreateToken_Click(object sender, RoutedEventArgs e) =>
        Process.Start(new ProcessStartInfo("https://github.com/settings/personal-access-tokens/new") { UseShellExecute = true });
}
