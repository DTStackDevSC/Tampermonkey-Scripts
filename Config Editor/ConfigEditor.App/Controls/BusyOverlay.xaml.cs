using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace ConfigEditor.App.Controls;

/// <summary>Covers the busy block like the scripts' suiteBusy: blocks clicks, wheel and label after 150 ms.</summary>
public partial class BusyOverlay : UserControl
{
    public static readonly DependencyProperty IsActiveProperty = DependencyProperty.Register(
        nameof(IsActive), typeof(bool), typeof(BusyOverlay), new PropertyMetadata(false, (d, _) => ((BusyOverlay)d).Update()));
    public static readonly DependencyProperty TextProperty = DependencyProperty.Register(
        nameof(Text), typeof(string), typeof(BusyOverlay), new PropertyMetadata(null, (d, e) => ((BusyOverlay)d).Label.Text = e.NewValue as string));

    public BusyOverlay() { InitializeComponent(); }

    public bool IsActive { get => (bool)GetValue(IsActiveProperty); set => SetValue(IsActiveProperty, value); }
    public string? Text { get => (string?)GetValue(TextProperty); set => SetValue(TextProperty, value); }

    void Update()
    {
        if (IsActive)
        {
            Visibility = Visibility.Visible;
            Inner.BeginAnimation(OpacityProperty, new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(200)) { BeginTime = TimeSpan.FromMilliseconds(150) });
            Spin.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty,
                new DoubleAnimation(0, 360, TimeSpan.FromSeconds(0.9)) { RepeatBehavior = RepeatBehavior.Forever });
        }
        else
        {
            Inner.BeginAnimation(OpacityProperty, null);
            Inner.Opacity = 0;
            Spin.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty, null);
            Visibility = Visibility.Collapsed;
        }
    }
}
