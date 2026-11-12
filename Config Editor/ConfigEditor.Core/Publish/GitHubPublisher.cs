using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ConfigEditor.Core.Release;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Session;

namespace ConfigEditor.Core.Publish;

public sealed record Account(long Id, string Login);
public sealed record PublishResult(bool Ok, string? CommitUrl, string? Error);

/// <summary>Publishes prepared files to main as one commit through the Git Data API.</summary>
public sealed class GitHubPublisher
{
    public const string ApiBase = "https://api.github.com/repos/DTStackDevSC/Tampermonkey-Scripts/";
    const string MainChanged = "main changed while publishing. Reopen and try again.";
    readonly HttpClient http;
    readonly string token;
    Account? account;

    public GitHubPublisher(HttpClient http, string token) { this.http = http; this.token = token; }

    sealed class GitHubException : Exception
    {
        public GitHubException(HttpStatusCode status, string message) : base(message) { Status = status; }
        public HttpStatusCode Status { get; }
    }

    async Task<JsonElement> SendAsync(HttpMethod method, string url, object? body = null)
    {
        using var req = new HttpRequestMessage(method, url.StartsWith("https://") ? url : ApiBase + url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.UserAgent.Add(new ProductInfoHeaderValue("ConfigEditor", "1.0"));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        if (body != null) req.Content = JsonContent.Create(body);
        using var res = await http.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            string? msg = null;
            try { msg = JsonDocument.Parse(text).RootElement.GetProperty("message").GetString(); } catch (Exception) { }
            throw new GitHubException(res.StatusCode, $"GitHub answered {(int)res.StatusCode}{(msg == null ? "" : ": " + msg)}");
        }
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    public async Task<Account> WhoAmIAsync()
    {
        var u = await SendAsync(HttpMethod.Get, "https://api.github.com/user");
        return account = new Account(u.GetProperty("id").GetInt64(), u.GetProperty("login").GetString()!);
    }

    /// <summary>
    /// Reads the head of main, lets <paramref name="prepareAt"/> build the files from the scripts at exactly that commit,
    /// and commits them with that commit as parent. If main moves before the ref update, tries once more.
    /// </summary>
    public async Task<PublishResult> PublishAsync(Func<IScriptSource, Task<PrepareResult>> prepareAt)
    {
        try
        {
            var me = account ?? await WhoAmIAsync();
            for (var attempt = 0; ; attempt++)
            {
                var head = (await SendAsync(HttpMethod.Get, "git/ref/heads/main")).GetProperty("object").GetProperty("sha").GetString()!;
                var r = await prepareAt(new CommitSource(this, head));
                if (!r.Ok)
                    return new PublishResult(false, null, r.ConflictSection != null
                        ? $"Someone changed the {r.ConflictSection} section on GitHub while you were editing. Reopen to get the latest version, then redo your edits."
                        : r.Error ?? MainChanged);
                try
                {
                    return new PublishResult(true, await CommitAsync(me, head, r.Files, CommitMessage(r.Files, r.Items)), null);
                }
                catch (GitHubException e) when (e.Status == HttpStatusCode.UnprocessableEntity && attempt == 0) { }
                catch (GitHubException e) when (e.Status == HttpStatusCode.UnprocessableEntity)
                {
                    return new PublishResult(false, null, MainChanged);
                }
            }
        }
        catch (GitHubException e) when (e.Status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return new PublishResult(false, null, $"GitHub refused the token (HTTP {(int)e.Status}). Check the token in Settings: it must be valid and allow writing to the repository.");
        }
        catch (GitHubException e) { return new PublishResult(false, null, e.Message); }
        catch (HttpRequestException e) { return new PublishResult(false, null, "Could not reach GitHub: " + e.Message); }
    }

    /// <summary>The scripts as they are in one commit, read through the contents API (no raw CDN cache).</summary>
    sealed class CommitSource : IScriptSource
    {
        readonly GitHubPublisher owner;
        readonly string sha;
        public CommitSource(GitHubPublisher owner, string sha) { this.owner = owner; this.sha = sha; }
        public string Description => "GitHub main at " + sha;
        public Task<string> ReadAsync(string relativePath, CancellationToken ct) => owner.ReadRawAsync(relativePath, sha, ct);
    }

    async Task<string> ReadRawAsync(string path, string sha, CancellationToken ct)
    {
        var url = ApiBase + "contents/" + string.Join("/", path.Split('/').Select(Uri.EscapeDataString)) + "?ref=" + sha;
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.UserAgent.Add(new ProductInfoHeaderValue("ConfigEditor", "1.0"));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github.raw+json"));
        using var res = await http.SendAsync(req, ct);
        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        if (!res.IsSuccessStatusCode) throw new GitHubException(res.StatusCode, $"GitHub answered {(int)res.StatusCode} reading {path}");
        return new UTF8Encoding(false).GetString(bytes);
    }

    async Task<string> CommitAsync(Account me, string head, IReadOnlyDictionary<string, string> files, string message)
    {
        var baseTree = (await SendAsync(HttpMethod.Get, "git/commits/" + head)).GetProperty("tree").GetProperty("sha").GetString()!;
        var entries = new List<object>();
        foreach (var (path, text) in files)
        {
            var blob = await SendAsync(HttpMethod.Post, "git/blobs",
                new { content = Convert.ToBase64String(new UTF8Encoding(false).GetBytes(text)), encoding = "base64" });
            entries.Add(new { path, mode = "100644", type = "blob", sha = blob.GetProperty("sha").GetString() });
        }
        var tree = await SendAsync(HttpMethod.Post, "git/trees", new { base_tree = baseTree, tree = entries });
        var who = new { name = me.Login, email = $"{me.Id}+{me.Login}@users.noreply.github.com" };
        var commit = await SendAsync(HttpMethod.Post, "git/commits",
            new { message, tree = tree.GetProperty("sha").GetString(), parents = new[] { head }, author = who, committer = who });
        await SendAsync(HttpMethod.Patch, "git/refs/heads/main", new { sha = commit.GetProperty("sha").GetString(), force = false });
        return commit.GetProperty("html_url").GetString()!;
    }

    static readonly Regex HeaderVersion = new(@"^// @version[ \t]+(\S+)", RegexOptions.Multiline);

    /// <summary>"Ticket Helpers 4.3.5 and Tools Toolbar 2.29.3: first change"; <paramref name="fallback"/> when no file names a suite.</summary>
    public static string CommitMessage(IReadOnlyDictionary<string, string> files, IReadOnlyList<ChangeItem> items, string fallback = "Config Editor update")
    {
        var suites = new List<string>();
        foreach (var s in new[] { SuiteId.TicketHelpers, SuiteId.Toolbar })
            if (files.TryGetValue(SuitePaths.Of(s), out var text) && HeaderVersion.Match(text) is { Success: true } m)
                suites.Add(SuitePaths.DisplayName(s) + " " + m.Groups[1].Value);
        if (suites.Count == 0) return fallback;
        var first = items.Count > 0 ? items[0].ToolName + ": " + items[0].Bullet.TrimEnd('.') : "configuration update";
        return string.Join(" and ", suites) + ": " + first;
    }
}
