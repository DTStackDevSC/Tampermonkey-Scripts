using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ConfigEditor.Core.Publish;

namespace ConfigEditor.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    readonly IAppSettings settings;
    readonly ITokenStore tokens;
    readonly Func<string, GitHubPublisher> publisherFactory;
    readonly Action onSaved;

    public SettingsViewModel(IAppSettings settings, ITokenStore tokens, Func<string, GitHubPublisher> publisherFactory, Action onSaved)
    {
        this.settings = settings; this.tokens = tokens; this.publisherFactory = publisherFactory; this.onSaved = onSaved;
        publishEnabled = settings.PublishEnabled;
        token = tokens.Load() ?? "";
    }

    [ObservableProperty] private bool publishEnabled;
    [ObservableProperty] private string token;
    [ObservableProperty] private string? message;
    [ObservableProperty] private bool messageIsError;

    public event Action? CloseRequested;

    [RelayCommand]
    async Task TestToken()
    {
        if (string.IsNullOrWhiteSpace(Token)) { Show("Paste a token first.", true); return; }
        Show("🔄 Checking the token with GitHub…", false);
        try
        {
            var me = await publisherFactory(Token.Trim()).WhoAmIAsync();
            Show($"✅ Signed in as {me.Login}. Commits will use {me.Id}+{me.Login}@users.noreply.github.com.", false);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            Show("❌ GitHub did not accept the token or could not be reached: " + e.Message, true);
        }
    }

    [RelayCommand]
    void Save()
    {
        var t = Token.Trim();
        if (PublishEnabled && t.Length == 0) { Show("Add a GitHub token to publish, or turn Publish off.", true); return; }
        settings.PublishEnabled = PublishEnabled;
        settings.Save();
        if (t.Length == 0) tokens.Clear(); else tokens.Save(t);
        onSaved();
        Show("✅ Settings saved.", false);
        CloseRequested?.Invoke();
    }

    void Show(string text, bool error) { Message = text; MessageIsError = error; }
}
