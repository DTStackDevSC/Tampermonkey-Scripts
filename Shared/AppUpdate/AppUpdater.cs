using System.Diagnostics;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace AppUpdate;

/// <summary>One downloadable version of an app, read from the repository's GitHub releases.</summary>
public sealed record AppRelease(Version Version, string Tag, string AssetUrl, long Size, string? Sha256, string PageUrl);

/// <summary>Which app to update: its release tag prefix (config-editor-v) and its exe name (ConfigEditor.exe).</summary>
public sealed record UpdateTarget(string DisplayName, string TagPrefix, string ExeName, Version Current,
    string Repo = "DTStackDevSC/Tampermonkey-Scripts");

public enum UpdateOutcome
{
    /// <summary>The running exe was swapped for the new one; restart from the same path.</summary>
    Replaced,
    /// <summary>The folder could not be written: the new exe was saved elsewhere (Downloads).</summary>
    SavedElsewhere,
}

public sealed record UpdateResult(UpdateOutcome Outcome, string Path, string? Reason = null);

/// <summary>
/// Checks GitHub for a newer release and replaces the running exe with it.
/// Windows lets a running exe be renamed, so the swap is: download next to it, check the SHA 256 GitHub publishes,
/// rename the running exe to .old, move the new one in its place. The .old copy is removed on the next start.
/// </summary>
public sealed class AppUpdater(HttpClient http, UpdateTarget target)
{
    public UpdateTarget Target { get; } = target;

    public static HttpClient CreateHttp()
    {
        var h = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
        h.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("DTStack-AppUpdater", "1.0"));
        h.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        return h;
    }

    /// <summary>The newest published release of this app, or null when none is newer than the running one.</summary>
    public async Task<AppRelease?> FindNewerAsync(CancellationToken ct = default)
    {
        using var r = await http.GetAsync($"https://api.github.com/repos/{Target.Repo}/releases?per_page=50", ct);
        r.EnsureSuccessStatusCode();
        var latest = Pick(await r.Content.ReadAsStringAsync(ct), Target);
        return latest != null && latest.Version > Target.Current ? latest : null;
    }

    /// <summary>The highest version among published (not draft, not pre) releases with the tag prefix and the exe asset.</summary>
    public static AppRelease? Pick(string releasesJson, UpdateTarget target)
    {
        using var doc = JsonDocument.Parse(releasesJson);
        AppRelease? best = null;
        foreach (var rel in doc.RootElement.EnumerateArray())
        {
            if (Bool(rel, "draft") || Bool(rel, "prerelease")) continue;
            var tag = Str(rel, "tag_name");
            if (tag == null || !tag.StartsWith(target.TagPrefix, StringComparison.OrdinalIgnoreCase)) continue;
            if (!Version.TryParse(tag[target.TagPrefix.Length..], out var v)) continue;
            if (!rel.TryGetProperty("assets", out var assets)) continue;
            foreach (var a in assets.EnumerateArray())
            {
                if (!string.Equals(Str(a, "name"), target.ExeName, StringComparison.OrdinalIgnoreCase)) continue;
                var url = Str(a, "browser_download_url");
                if (url == null || !url.StartsWith($"https://github.com/{target.Repo}/releases/download/", StringComparison.OrdinalIgnoreCase)) continue;
                var digest = Str(a, "digest");
                var sha = digest != null && digest.StartsWith("sha256:") ? digest["sha256:".Length..].ToLowerInvariant() : null;
                var size = a.TryGetProperty("size", out var s) && s.TryGetInt64(out var n) ? n : 0;
                if (best == null || v > best.Version)
                    best = new AppRelease(v, tag, url, size, sha, Str(rel, "html_url") ?? url);
            }
        }
        return best;
    }

    static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    static bool Bool(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    /// <summary>Downloads the release into <paramref name="file"/> and checks its SHA 256. Reports progress from 0 to 1.</summary>
    public async Task DownloadAsync(AppRelease release, string file, IProgress<double>? progress, CancellationToken ct = default)
    {
        using var r = await http.GetAsync(release.AssetUrl, HttpCompletionOption.ResponseHeadersRead, ct);
        r.EnsureSuccessStatusCode();
        var total = r.Content.Headers.ContentLength ?? release.Size;
        await using (var src = await r.Content.ReadAsStreamAsync(ct))
        await using (var dst = new FileStream(file, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            var buffer = new byte[81920];
            long done = 0;
            int read;
            while ((read = await src.ReadAsync(buffer, ct)) > 0)
            {
                await dst.WriteAsync(buffer.AsMemory(0, read), ct);
                done += read;
                if (total > 0) progress?.Report(Math.Min(1, (double)done / total));
            }
        }
        if (release.Sha256 != null)
        {
            if (await HashAsync(file, ct) != release.Sha256)
            {
                TryDelete(file);
                throw new InvalidDataException("The downloaded file does not match the one published on GitHub (checksum differs), so it was not used.");
            }
        }
    }

    /// <summary>
    /// Puts the release in place of <paramref name="exePath"/>. When that folder cannot be written,
    /// saves it in <paramref name="fallbackFolder"/> instead and says why.
    /// </summary>
    public async Task<UpdateResult> InstallAsync(AppRelease release, string exePath, string fallbackFolder,
        IProgress<double>? progress, CancellationToken ct = default)
    {
        var dir = Path.GetDirectoryName(exePath)!;
        var staged = Path.Combine(dir, Target.ExeName + ".download");
        var old = exePath + ".old";
        string? reason = null;
        bool downloaded = false;
        try
        {
            await DownloadAsync(release, staged, progress, ct);
            downloaded = true;
            TryDelete(old);
            File.Move(exePath, old);
            try { File.Move(staged, exePath); }
            catch { File.Move(old, exePath); throw; }
            return new UpdateResult(UpdateOutcome.Replaced, exePath);
        }
        catch (Exception e) when (e is UnauthorizedAccessException or IOException)
        {
            reason = e.Message;
        }

        // The app folder is read only (or the exe is locked): keep the new version in the user's own folder.
        Directory.CreateDirectory(fallbackFolder);
        var name = Path.GetFileNameWithoutExtension(Target.ExeName);
        var target = Path.Combine(fallbackFolder, $"{name}-{release.Version}{Path.GetExtension(Target.ExeName)}");
        // Already downloaded on an earlier start: do not fetch it again.
        if (release.Sha256 != null && File.Exists(target) && await HashAsync(target, ct) == release.Sha256)
        {
            if (downloaded) TryDelete(staged);
            return new UpdateResult(UpdateOutcome.SavedElsewhere, target, reason);
        }
        if (downloaded && File.Exists(staged))
        {
            try { File.Move(staged, target, overwrite: true); return new UpdateResult(UpdateOutcome.SavedElsewhere, target, reason); }
            catch (Exception e) when (e is UnauthorizedAccessException or IOException) { TryDelete(staged); }
        }
        await DownloadAsync(release, target, progress, ct);
        return new UpdateResult(UpdateOutcome.SavedElsewhere, target, reason);
    }

    /// <summary>Removes what an earlier update left next to the exe.</summary>
    public static void CleanUp(string exePath, string exeName)
    {
        TryDelete(exePath + ".old");
        TryDelete(Path.Combine(Path.GetDirectoryName(exePath)!, exeName + ".download"));
    }

    /// <summary>True only for the published single file exe, so a build run from Visual Studio is never touched.</summary>
    public static bool CanSelfUpdate(string? processPath, string exeName, string[] args) =>
        OperatingSystem.IsWindows() && processPath != null &&
        string.Equals(Path.GetFileName(processPath), exeName, StringComparison.OrdinalIgnoreCase) &&
        !args.Contains("--no-update", StringComparer.OrdinalIgnoreCase) &&
        Environment.GetEnvironmentVariable("DTSTACK_NO_UPDATE") is null or "" &&
        File.Exists(processPath) && !File.Exists(Path.Combine(Path.GetDirectoryName(processPath)!, Path.GetFileNameWithoutExtension(exeName) + ".dll"));

    public static void Restart(string exePath, string fromVersion)
    {
        var psi = new ProcessStartInfo(exePath) { UseShellExecute = false };
        psi.ArgumentList.Add("--updated-from");
        psi.ArgumentList.Add(fromVersion);
        Process.Start(psi);
    }

    static async Task<string> HashAsync(string file, CancellationToken ct)
    {
        await using var f = File.OpenRead(file);
        return Convert.ToHexStringLower(await SHA256.HashDataAsync(f, ct));
    }

    static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
    }
}
