using System.Net.Http;
using System.Windows;

namespace Spike;

public partial class MainWindow : Window
{
    private static readonly HttpClient Http = CreateClient();

    public MainWindow() => InitializeComponent();

    private static HttpClient CreateClient()
    {
        var c = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        c.DefaultRequestHeaders.UserAgent.ParseAdd("ConfigEditorConnectivityTest/1.0");
        return c;
    }

    private async void Run_Click(object sender, RoutedEventArgs e)
    {
        RunBtn.IsEnabled = false;
        RunBtn.Content = "⏳ Checking…";
        RawResult.Text = "🔄 Checking raw.githubusercontent.com…";
        ApiResult.Text = "🔄 Checking api.github.com…";
        try
        {
            var raw = Check("raw.githubusercontent.com",
                "https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/main/Standalone%20Scripts/ServiceNowShortDescriptionHelper.user.js");
            var api = Check("api.github.com", "https://api.github.com/rate_limit");
            RawResult.Text = await raw;
            ApiResult.Text = await api;
        }
        finally
        {
            RunBtn.IsEnabled = true;
            RunBtn.Content = "Run checks again";
        }
    }

    private static async Task<string> Check(string name, string url)
    {
        try
        {
            using var resp = await Http.GetAsync(url);
            var bytes = (await resp.Content.ReadAsByteArrayAsync()).Length;
            return resp.IsSuccessStatusCode
                ? $"✅ {name}: reachable (HTTP {(int)resp.StatusCode}, {bytes:N0} bytes)"
                : $"❌ {name}: HTTP {(int)resp.StatusCode}";
        }
        catch (Exception ex)
        {
            return $"❌ {name}: {ex.GetBaseException().Message}";
        }
    }
}
