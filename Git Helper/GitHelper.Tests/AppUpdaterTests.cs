using System.Net;
using System.Security.Cryptography;
using System.Text;
using AppUpdate;

namespace GitHelper.Tests;

sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> answer) : HttpMessageHandler
{
    public List<string> Urls = new();
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Urls.Add(request.RequestUri!.ToString());
        return Task.FromResult(answer(request));
    }
}

public class AppUpdaterTests
{
    const string Base = "https://github.com/DTStackDevSC/Tampermonkey-Scripts/releases/download/";
    static readonly UpdateTarget Gh = new("Git Helper", "git-helper-v", "GitHelper.exe", new Version(1, 1, 0));
    static readonly byte[] NewExe = Encoding.UTF8.GetBytes("new exe bytes");
    static string Sha(byte[] b) => Convert.ToHexStringLower(SHA256.HashData(b));

    static string Release(string tag, string asset, string? sha = null, bool draft = false, bool pre = false, string? url = null) =>
        $$"""
        {"tag_name":"{{tag}}","draft":{{(draft ? "true" : "false")}},"prerelease":{{(pre ? "true" : "false")}},
         "html_url":"https://github.com/DTStackDevSC/Tampermonkey-Scripts/releases/tag/{{tag}}",
         "assets":[{"name":"{{asset}}","size":13,"browser_download_url":"{{url ?? Base + tag + "/" + asset}}"{{(sha != null ? $",\"digest\":\"sha256:{sha}\"" : "")}}}]}
        """;

    static string Feed(params string[] releases) => "[" + string.Join(",", releases) + "]";

    [Fact]
    public void PicksTheHighestPublishedReleaseOfThisApp()
    {
        var json = Feed(
            Release("config-editor-v9.0.0", "ConfigEditor.exe"),
            Release("git-helper-v1.10.0", "GitHelper.exe", draft: true),
            Release("git-helper-v1.9.0", "GitHelper.exe", pre: true),
            Release("git-helper-v1.2.0", "GitHelper.exe", sha: "ABC"),
            Release("git-helper-v1.3.0", "Other.exe"),
            Release("git-helper-v1.4.0", "GitHelper.exe", url: "https://evil.example/GitHelper.exe"),
            Release("git-helper-v1.1.0", "GitHelper.exe"));
        var r = AppUpdater.Pick(json, Gh);
        Assert.NotNull(r);
        Assert.Equal(new Version(1, 2, 0), r!.Version);
        Assert.Equal("abc", r.Sha256);
        Assert.EndsWith("/git-helper-v1.2.0/GitHelper.exe", r.AssetUrl);
    }

    [Fact]
    public async Task NothingNewerMeansNull()
    {
        var http = new HttpClient(new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(Feed(Release("git-helper-v1.1.0", "GitHelper.exe"))) }));
        Assert.Null(await new AppUpdater(http, Gh).FindNewerAsync());
    }

    static (AppUpdater updater, FakeHandler handler) Serving(byte[] exe)
    {
        var json = Feed(Release("git-helper-v1.2.0", "GitHelper.exe", sha: Sha(NewExe)));
        var handler = new FakeHandler(req => req.RequestUri!.Host == "api.github.com"
            ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) }
            : new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(exe) });
        return (new AppUpdater(new HttpClient(handler), Gh), handler);
    }

    static string TempDir()
    {
        var d = Path.Combine(Path.GetTempPath(), "githelper-tests", "upd-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(d);
        return d;
    }

    [Fact]
    public async Task ReplacesTheExeAndKeepsTheOldOneUntilNextStart()
    {
        var dir = TempDir();
        var exe = Path.Combine(dir, "GitHelper.exe");
        File.WriteAllText(exe, "old exe");
        var (updater, _) = Serving(NewExe);
        var release = await updater.FindNewerAsync();
        Assert.NotNull(release);
        var seen = new List<double>();
        var result = await updater.InstallAsync(release!, exe, Path.Combine(dir, "Downloads"), new SyncProgress(seen.Add));
        Assert.Equal(UpdateOutcome.Replaced, result.Outcome);
        Assert.Equal(NewExe, File.ReadAllBytes(exe));
        Assert.Equal("old exe", File.ReadAllText(exe + ".old"));
        Assert.Equal(1, seen[^1]);
        AppUpdater.CleanUp(exe, "GitHelper.exe");
        Assert.False(File.Exists(exe + ".old"));
        Assert.Equal(NewExe, File.ReadAllBytes(exe));
    }

    [Fact]
    public async Task AWrongChecksumIsNeverInstalled()
    {
        var dir = TempDir();
        var exe = Path.Combine(dir, "GitHelper.exe");
        File.WriteAllText(exe, "old exe");
        var (updater, _) = Serving(Encoding.UTF8.GetBytes("tampered"));
        var release = await updater.FindNewerAsync();
        await Assert.ThrowsAsync<InvalidDataException>(() => updater.InstallAsync(release!, exe, Path.Combine(dir, "Downloads"), null));
        Assert.Equal("old exe", File.ReadAllText(exe));
        Assert.False(File.Exists(Path.Combine(dir, "GitHelper.exe.download")));
    }

    [Fact]
    public async Task WhenTheExeCannotBeReplacedTheNewOneGoesToDownloads()
    {
        var dir = TempDir();
        var exe = Path.Combine(dir, "GitHelper.exe"); // missing: the swap fails like a locked or read only file
        var (updater, _) = Serving(NewExe);
        var release = await updater.FindNewerAsync();
        var result = await updater.InstallAsync(release!, exe, Path.Combine(dir, "Downloads"), null);
        Assert.Equal(UpdateOutcome.SavedElsewhere, result.Outcome);
        Assert.Equal(Path.Combine(dir, "Downloads", "GitHelper-1.2.0.exe"), result.Path);
        Assert.Equal(NewExe, File.ReadAllBytes(result.Path));
        Assert.NotNull(result.Reason);
        Assert.False(File.Exists(Path.Combine(dir, "GitHelper.exe.download")));

        // Next start: the copy already in Downloads is reused, not downloaded a second time.
        var (again, handler) = Serving(NewExe);
        var second = await again.InstallAsync(release!, exe, Path.Combine(dir, "Downloads"), null);
        Assert.Equal(result.Path, second.Path);
        Assert.Equal(NewExe, File.ReadAllBytes(second.Path));
        Assert.Single(handler.Urls); // only the try next to the exe, nothing more for Downloads
        Assert.False(File.Exists(Path.Combine(dir, "GitHelper.exe.download")));
    }

    [Fact]
    public void OnlyThePublishedExeUpdatesItself()
    {
        Assert.False(AppUpdater.CanSelfUpdate(null, "GitHelper.exe", []));
        Assert.False(AppUpdater.CanSelfUpdate("/x/dotnet", "GitHelper.exe", []));
        Assert.False(AppUpdater.CanSelfUpdate("/x/GitHelper.exe", "GitHelper.exe", ["--no-update"]));
    }

    sealed class SyncProgress(Action<double> report) : IProgress<double>
    {
        public void Report(double value) => report(value);
    }
}
