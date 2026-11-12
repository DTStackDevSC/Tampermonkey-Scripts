using System.Windows;
using System.Windows.Controls;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App.Views;

public partial class NewTeamDialog : Window
{
    public NewTeamDialog(IReadOnlyList<TeamChoice> teams)
    {
        InitializeComponent();
        CopyBox.ItemsSource = teams;
        CopyBox.SelectedIndex = teams.Count > 0 ? 0 : -1;
        Loaded += (_, _) => NameBox.Focus();
    }

    public NewTeamRequest? Result { get; private set; }

    void Input_Changed(object sender, TextChangedEventArgs e)
    {
        var ok = NameBox.Text.Trim().Length > 0 && ShortBox.Text.Trim().Length > 0 && CopyBox.SelectedItem != null;
        AddBtn.IsEnabled = ok;
        Hint.Visibility = ok ? Visibility.Collapsed : Visibility.Visible;
    }

    void Add_Click(object sender, RoutedEventArgs e)
    {
        Result = new NewTeamRequest(NameBox.Text.Trim(), ShortBox.Text.Trim(), ((TeamChoice)CopyBox.SelectedItem).Key);
        DialogResult = true;
    }
}
