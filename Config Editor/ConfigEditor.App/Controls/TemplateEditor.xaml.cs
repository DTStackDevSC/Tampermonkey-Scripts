using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using ConfigEditor.Core.Js;

namespace ConfigEditor.App.Controls;

/// <summary>Multi line text box for response texts. Typing "{" offers the placeholders the scripts fill in.</summary>
public partial class TemplateEditor : UserControl
{
    public static readonly DependencyProperty TextProperty = DependencyProperty.Register(
        nameof(Text), typeof(string), typeof(TemplateEditor),
        new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, OnTextChanged));

    public static readonly DependencyProperty IsReadOnlyProperty = DependencyProperty.Register(
        nameof(IsReadOnly), typeof(bool), typeof(TemplateEditor), new PropertyMetadata(false, (d, e) => ((TemplateEditor)d).Box.IsReadOnly = (bool)e.NewValue));

    public TemplateEditor()
    {
        InitializeComponent();
        Options.ItemsSource = new[] { TemplateText.OpenedByName, TemplateText.TicketType };
    }

    public string Text { get => (string)GetValue(TextProperty); set => SetValue(TextProperty, value); }
    public bool IsReadOnly { get => (bool)GetValue(IsReadOnlyProperty); set => SetValue(IsReadOnlyProperty, value); }

    static void OnTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        var ed = (TemplateEditor)d;
        var text = (string?)e.NewValue ?? "";
        if (ed.Box.Text != text) ed.Box.Text = text;
    }

    void OnBoxChanged(object sender, TextChangedEventArgs e)
    {
        if (Text != Box.Text) SetCurrentValue(TextProperty, Box.Text);
    }

    void OnTextInput(object sender, TextCompositionEventArgs e)
    {
        if (e.Text != "{" || Box.IsReadOnly) return;
        Dispatcher.BeginInvoke(() =>
        {
            var r = Box.GetRectFromCharacterIndex(Box.CaretIndex);
            Picker.HorizontalOffset = r.Left;
            Picker.VerticalOffset = r.Bottom + 2;
            Options.SelectedIndex = 0;
            Picker.IsOpen = true;
            Options.Focus();
        });
    }

    void OnBoxKey(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape) Picker.IsOpen = false;
    }

    void OnPickKey(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter || e.Key == Key.Tab) { Insert(); e.Handled = true; }
        else if (e.Key == Key.Escape) { Picker.IsOpen = false; Box.Focus(); e.Handled = true; }
    }

    void OnPick(object sender, MouseButtonEventArgs e) => Insert();

    void Insert()
    {
        if (Options.SelectedItem is not string placeholder) return;
        Picker.IsOpen = false;
        var at = Box.CaretIndex;
        // Replace the "{" the user just typed with the whole placeholder.
        var start = at > 0 && Box.Text[at - 1] == '{' ? at - 1 : at;
        Box.Text = Box.Text[..start] + placeholder + Box.Text[at..];
        Box.CaretIndex = start + placeholder.Length;
        Box.Focus();
    }
}
