using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GitHelper.Core;

namespace GitHelper.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    readonly IAppSettings settings;
    readonly GhCli gh;

    public SettingsViewModel(IAppSettings settings, GhCli gh)
    {
        this.settings = settings; this.gh = gh;
        identityName = settings.IdentityName ?? "";
        identityEmail = settings.IdentityEmail ?? "";
        checkIdentity = settings.CheckIdentity;
        pullRebase = settings.PullRebase;
    }

    /// <summary>Raised when the window should close (true = saved).</summary>
    public event Action<bool>? CloseRequested;

    [ObservableProperty] private string identityName;
    [ObservableProperty] private string identityEmail;
    [ObservableProperty] private bool checkIdentity;
    [ObservableProperty] private bool pullRebase;
    [ObservableProperty] [NotifyCanExecuteChangedFor(nameof(FillFromGitHubCommand), nameof(SaveCommand))] private bool isBusy;
    [ObservableProperty] private string? message;
    [ObservableProperty] private StatusKind messageKind = StatusKind.Info;

    [RelayCommand(CanExecute = nameof(NotBusy))]
    async Task FillFromGitHubAsync()
    {
        IsBusy = true;
        Say(StatusKind.Working, "🔄 Asking GitHub for your account…");
        try
        {
            var user = await gh.UserAsync();
            if (user == null)
            {
                Say(StatusKind.Warning, "⚠️ GitHub did not answer. Sign in first with 🔑 Sign in to GitHub in the main window, then try again.");
                return;
            }
            IdentityName = user.Login;
            IdentityEmail = user.NoreplyEmail;
            CheckIdentity = true;
            Say(StatusKind.Success, $"✅ Filled from {user.Login}. Click Save to keep it.");
        }
        finally { IsBusy = false; }
    }

    [RelayCommand(CanExecute = nameof(NotBusy))]
    void Save()
    {
        var name = IdentityName.Trim();
        var email = IdentityEmail.Trim();
        if ((name.Length == 0) != (email.Length == 0))
        {
            Say(StatusKind.Error, "❌ Fill in both the name and the email, or leave both empty.");
            return;
        }
        if (email.Length > 0 && (!email.Contains('@') || email.Contains(' ')))
        {
            Say(StatusKind.Error, "❌ The email does not look right (it needs an @ and no spaces).");
            return;
        }
        if (CheckIdentity && name.Length == 0)
        {
            Say(StatusKind.Error, "❌ To check commits, fill in the name and email first (or use Fill from my GitHub account).");
            return;
        }
        settings.IdentityName = name.Length == 0 ? null : name;
        settings.IdentityEmail = email.Length == 0 ? null : email;
        settings.CheckIdentity = CheckIdentity;
        settings.PullRebase = PullRebase;
        settings.Save();
        CloseRequested?.Invoke(true);
    }

    [RelayCommand]
    void Cancel() => CloseRequested?.Invoke(false);

    bool NotBusy() => !IsBusy;

    void Say(StatusKind kind, string text) { MessageKind = kind; Message = text; }
}
