using ConfigEditor.Core.Publish;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;
using ConfigEditor.Core.Session;
using ConfigEditor.ViewModels;

namespace ConfigEditor.Tests;

public class MainViewModelTests
{
    internal sealed class MemorySource : IScriptSource
    {
        public Dictionary<string, string> Files { get; } = new()
        {
            [SuitePaths.TicketHelpers] = TestRepo.Read(SuiteId.TicketHelpers),
            [SuitePaths.Toolbar] = TestRepo.Read(SuiteId.Toolbar),
        };
        public bool Offline { get; set; }
        public string Description => "memory";
        public Task<string> ReadAsync(string relativePath, CancellationToken ct) =>
            Offline ? throw new HttpRequestException("proxy refused") : Task.FromResult(Files[relativePath]);
    }

    internal sealed class Factory : IScriptSourceFactory
    {
        public MemorySource Current { get; set; } = new();
        public IScriptSource GitHub() => Current;
        public IScriptSource Folder(string path) => new FolderSource(path);
    }

    internal sealed class Settings : IAppSettings
    {
        public bool PublishEnabled { get; set; }
        public bool EmailReminderShown { get; set; }
        public string WorkFolder { get; } = Directory.CreateTempSubdirectory("ce-work").FullName;
        public void Save() { }
    }

    internal sealed class Tokens : ITokenStore
    {
        public string? Value;
        public string? Load() => Value;
        public void Save(string token) => Value = token;
        public void Clear() => Value = null;
    }

    internal sealed class Dialogs : IDialogs
    {
        public int SaveShown;
        public bool ConfirmInDialog = true;
        public string? PickFolder() => null;
        public bool Confirm(string title, string message) => true;
        public NewTeamRequest? AskNewTeam(IReadOnlyList<TeamChoice> teams) => null;
        public void ShowSave(SaveDialogViewModel vm)
        {
            SaveShown++;
            if (ConfirmInDialog) vm.ConfirmCommand.ExecuteAsync(null).GetAwaiter().GetResult();
        }
        public void ShowSettings(SettingsViewModel vm) { }
        public void OpenUrl(string url) { }
    }

    internal sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UnixEpoch;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    internal static (MainViewModel vm, Factory f, Settings s, Dialogs d, Clock c) Make()
    {
        var f = new Factory(); var s = new Settings(); var d = new Dialogs(); var c = new Clock();
        return (new MainViewModel(f, new Tokens(), d, s, c), f, s, d, c);
    }

    static void EditEmeaResponse(ConfigDocument doc)
    {
        var emea = ResponseTeam.ReadAll(doc).Single(t => t.Key == "emeaTeam");
        emea.Responses.First(r => r.BodyEditable).BodyRaw += " Thanks.";
        ResponseTeam.Save(doc, emea);
    }

    [Fact]
    public async Task Start_offline_shows_reason_and_disables_sections()
    {
        var (vm, f, _, _, _) = Make();
        f.Current.Offline = true;
        await vm.StartAsync();
        Assert.StartsWith("Could not reach GitHub: proxy refused", vm.Status);
        Assert.Contains("Open folder", vm.Status);
        Assert.All(vm.Nav, n => Assert.False(n.IsAvailable));
        Assert.True(vm.OpenFolderCommand.CanExecute(null));
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task Start_online_enables_all_sections()
    {
        var (vm, _, _, _, _) = Make();
        await vm.StartAsync();
        Assert.Equal(6, vm.Nav.Count);
        Assert.All(vm.Nav, n => Assert.True(n.IsAvailable, n.UnavailableReason));
        Assert.Contains(vm.Teams, t => t.Key == "emeaTeam");
        Assert.NotNull(vm.SelectedTeamKey);
        Assert.Equal(0, vm.UnsavedCount);
    }

    [Fact]
    public async Task Delete_team_needs_second_click()
    {
        var (vm, _, _, _, c) = Make();
        await vm.StartAsync();
        var count = vm.Teams.Count;
        var key = vm.SelectedTeamKey;

        vm.DeleteTeamCommand.Execute(null);
        Assert.True(vm.DeleteArmed);
        Assert.Equal("Click again to delete", vm.DeleteTeamText);
        Assert.Equal(count, vm.Teams.Count);

        c.Now += TimeSpan.FromSeconds(6);
        vm.DeleteTeamCommand.Execute(null);
        Assert.Equal(count, vm.Teams.Count);
        Assert.True(vm.DeleteArmed);

        vm.DeleteTeamCommand.Execute(null);
        Assert.False(vm.DeleteArmed);
        Assert.Equal(count - 1, vm.Teams.Count);
        Assert.DoesNotContain(vm.Teams, t => t.Key == key);
        Assert.True(vm.UnsavedCount > 0);
    }

    [Fact]
    public async Task Publish_hidden_until_enabled()
    {
        var (vm, _, s, _, _) = Make();
        await vm.StartAsync();
        Assert.False(vm.ShowPublish);
        var settings = vm.CreateSettings();
        settings.PublishEnabled = true;
        settings.Token = "abc";
        settings.SaveCommand.Execute(null);
        Assert.True(s.PublishEnabled);
        Assert.True(vm.ShowPublish);
    }

    [Fact]
    public async Task Save_reports_conflict_section_in_status()
    {
        var (vm, f, _, d, _) = Make();
        await vm.StartAsync();
        EditEmeaResponse(vm.Session!.Edited);
        vm.NotifyEdited();

        var latest = new MemorySource();
        var other = ConfigDocument.Load(latest.Files[SuitePaths.TicketHelpers], latest.Files[SuitePaths.Toolbar]);
        var ame = ResponseTeam.ReadAll(other).Single(t => t.Key == "ameTeam");
        ame.Name = "AME Team Upstream";
        ResponseTeam.Save(other, ame);
        latest.Files[SuitePaths.TicketHelpers] = other.Render().ticketHelpers;
        f.Current = latest;

        await vm.SaveCommand.ExecuteAsync(null);
        Assert.Contains("Ticket Response Helper", vm.Status);
        Assert.Equal(0, d.SaveShown);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task Save_writes_files_and_offers_upload_page()
    {
        var (vm, _, s, d, _) = Make();
        await vm.StartAsync();
        EditEmeaResponse(vm.Session!.Edited);
        vm.NotifyEdited();
        Assert.Equal(1, vm.UnsavedCount);
        Assert.True(vm.HasUnsavedWork);

        SaveDialogViewModel? dialog = null;
        vm.SaveDialogCreated += x => dialog = x;
        await vm.SaveCommand.ExecuteAsync(null);

        Assert.Equal(1, d.SaveShown);
        var path = Path.Combine(s.WorkFolder, "Standalone Scripts", "ServiceNowShortDescriptionHelper.user.js");
        Assert.Contains(" Thanks.", File.ReadAllText(path));
        Assert.Contains(dialog!.Links, l => l.Url == "https://github.com/DTStackDevSC/Tampermonkey-Scripts/upload/main/Standalone%20Scripts");
        Assert.True(dialog.ShowEmailReminder);
        Assert.StartsWith("✅", vm.Status);
        Assert.False(vm.HasUnsavedWork);
    }

    [Fact]
    public async Task Second_save_after_upload_has_no_false_conflict()
    {
        var (vm, f, s, _, _) = Make();
        await vm.StartAsync();
        EditEmeaResponse(vm.Session!.Edited);
        vm.NotifyEdited();
        await vm.SaveCommand.ExecuteAsync(null);
        Assert.Equal(0, vm.UnsavedCount);

        var path = Path.Combine(s.WorkFolder, "Standalone Scripts", "ServiceNowShortDescriptionHelper.user.js");
        f.Current.Files[SuitePaths.TicketHelpers] = File.ReadAllText(path);
        EditEmeaResponse(vm.Session!.Edited);
        vm.NotifyEdited();
        await vm.SaveCommand.ExecuteAsync(null);

        Assert.StartsWith("✅", vm.Status);
        Assert.Contains(" Thanks. Thanks.", File.ReadAllText(path));
        Assert.Contains("// @version      4.3.6", File.ReadAllText(path));
    }
}
