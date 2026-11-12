using System.Windows;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App.Views;

public partial class SaveDialog : Window
{
    readonly SaveDialogViewModel vm;

    public SaveDialog(SaveDialogViewModel vm)
    {
        InitializeComponent();
        this.vm = vm;
        DataContext = vm;
        vm.CloseRequested += Close;
        Closing += (_, e) => e.Cancel = vm.IsBusy;
    }
}
