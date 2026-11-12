namespace ConfigEditor.Core.Session;

/// <summary>Reads the latest scripts from the main branch on GitHub.</summary>
public sealed class GitHubRawSource : IScriptSource
{
    public const string BaseUrl = "https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/main/";
    readonly HttpClient http;

    public GitHubRawSource(HttpClient http) { this.http = http; }

    public string Description => "GitHub (latest)";

    public static string UrlOf(string relativePath) =>
        BaseUrl + string.Join('/', relativePath.Split('/').Select(Uri.EscapeDataString));

    public async Task<string> ReadAsync(string relativePath, CancellationToken ct)
    {
        // The query defeats the raw CDN cache so a fresh push is seen at once.
        var url = UrlOf(relativePath) + "?t=" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        using var res = await http.GetAsync(url, ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"GitHub answered {(int)res.StatusCode} {res.ReasonPhrase} for {relativePath}.");
        return await res.Content.ReadAsStringAsync(ct);
    }
}
