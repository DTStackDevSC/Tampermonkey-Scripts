using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using GitHelper.ViewModels;

namespace GitHelper.App.Views;

/// <summary>The ? Help guide: one card per section, each button shown as it looks with one line on what it does.</summary>
public sealed class HelpWindow : Window
{
    public HelpWindow(HelpGuide guide)
    {
        Title = $"Git Helper guide · v{guide.Version}";
        Width = 720; Height = 760; MinWidth = 520;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        var stack = new StackPanel { Margin = new Thickness(20, 16, 20, 20) };
        stack.Children.Add(new TextBlock { Text = "📖 Feature guide", FontSize = 20, FontWeight = FontWeights.SemiBold });
        stack.Children.Add(Hint("Every button gives a result line at the bottom of the window: green when it worked, orange for a warning, red for an error with the next step.", new Thickness(0, 4, 0, 12)));
        foreach (var s in guide.Sections)
        {
            var card = new Border
            {
                Padding = new Thickness(14, 10, 14, 12), Margin = new Thickness(0, 0, 0, 10), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1),
            };
            card.SetResourceReference(Border.BackgroundProperty, "CardBackgroundFillColorDefaultBrush");
            card.SetResourceReference(Border.BorderBrushProperty, "ControlStrokeColorDefaultBrush");
            var body = new StackPanel();
            body.Children.Add(new TextBlock { Text = $"{s.Icon}  {s.Title}", FontSize = 15, FontWeight = FontWeights.SemiBold });
            body.Children.Add(Hint(s.Lead, new Thickness(0, 2, 0, 8)));
            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            foreach (var (label, text) in s.Items)
            {
                grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                var chip = new Border
                {
                    Background = new SolidColorBrush(Color.FromRgb(0x66, 0x7E, 0xEA)), CornerRadius = new CornerRadius(4),
                    Padding = new Thickness(8, 3, 8, 3), Margin = new Thickness(0, 3, 12, 3), VerticalAlignment = VerticalAlignment.Top,
                    Child = new TextBlock { Text = label, Foreground = Brushes.White, FontWeight = FontWeights.SemiBold, FontSize = 12 },
                };
                var t = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 4), FontSize = 13 };
                Grid.SetRow(chip, grid.RowDefinitions.Count - 1);
                Grid.SetRow(t, grid.RowDefinitions.Count - 1);
                Grid.SetColumn(t, 1);
                grid.Children.Add(chip);
                grid.Children.Add(t);
            }
            body.Children.Add(grid);
            card.Child = body;
            stack.Children.Add(card);
        }
        var close = new Button { Content = "Close", HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0), IsCancel = true };
        close.Click += (_, _) => Close();
        stack.Children.Add(close);
        Content = new ScrollViewer { Content = stack, VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
    }

    static TextBlock Hint(string text, Thickness margin)
    {
        var t = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, FontSize = 12, Margin = margin };
        t.SetResourceReference(TextBlock.ForegroundProperty, "TextFillColorSecondaryBrush");
        return t;
    }
}
