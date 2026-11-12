using System.Net;
using System.Text;
using System.Text.Json;
using ConfigEditor.Core.Publish;
using ConfigEditor.Core.Release;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Session;

namespace ConfigEditor.Tests;

public class GitHubPublisherTests
{
    sealed class FakeGitHub : HttpMessageHandler
    {
        public List<(string Method, string Path, string Body)> Requests { get; } = new();
        public Queue<HttpStatusCode> RefAnswers { get; } = new();
        public HttpStatusCode UserStatus { get; set; } = HttpStatusCode.OK;
        int blob;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var body = req.Content == null ? "" : await req.Content.ReadAsStringAsync(ct);
            var path = req.RequestUri!.AbsolutePath.Replace("/repos/DTStackDevSC/Tampermonkey-Scripts/", "");
            Requests.Add((req.Method.Method, path, body));
            Assert.Equal("Bearer tok", req.Headers.Authorization?.ToString());
            Assert.NotEmpty(req.Headers.UserAgent);
            (HttpStatusCode, string) answer = (req.Method.Method, path) switch
            {
                ("GET", "/user") => (UserStatus, """{"id":42,"login":"jane"}"""),
                ("GET", "git/ref/heads/main") => (HttpStatusCode.OK, """{"object":{"sha":"base1"}}"""),
                ("GET", "git/commits/base1") => (HttpStatusCode.OK, """{"tree":{"sha":"tree1"}}"""),
                ("POST", "git/blobs") => (HttpStatusCode.Created, $$"""{"sha":"blob{{++blob}}"}"""),
                ("POST", "git/trees") => (HttpStatusCode.Created, """{"sha":"tree2"}"""),
                ("POST", "git/commits") => (HttpStatusCode.Created, """{"sha":"c2","html_url":"https://github.com/x/commit/c2"}"""),
                ("PATCH", "git/refs/heads/main") => (RefAnswers.Count > 0 ? RefAnswers.Dequeue() : HttpStatusCode.OK, """{"message":"Update is not a fast forward"}"""),
                _ => (HttpStatusCode.NotFound, "{}")
            };
            return new HttpResponseMessage(answer.Item1) { Content = new StringContent(answer.Item2, Encoding.UTF8, "application/json") };
        }
    }

    static readonly IReadOnlyDictionary<string, string> Files = new Dictionary<string, string>
    {
        [SuitePaths.TicketHelpers] = "// @version      4.3.5\nth",
        [SuitePaths.Toolbar] = "// @version      2.29.3\ntb",
        [SuitePaths.ToolbarCopy] = "// @version      2.29.3\ntb",
    };

    static PrepareResult Prepared() => new(true, null, Array.Empty<ChangeItem>(), Files, null);

    static GitHubPublisher Publisher(FakeGitHub gh) => new(new HttpClient(gh), "tok");

    [Fact]
    public async Task One_commit_with_all_files_and_noreply_author()
    {
        var gh = new FakeGitHub();
        var r = await Publisher(gh).PublishAsync(Files, "msg", () => Task.FromResult(Prepared()));
        Assert.True(r.Ok, r.Error);
        Assert.Equal("https://github.com/x/commit/c2", r.CommitUrl);
        Assert.Equal(3, gh.Requests.Count(q => q.Path == "git/blobs"));

        var blob = JsonDocument.Parse(gh.Requests.First(q => q.Path == "git/blobs").Body).RootElement;
        Assert.Equal("base64", blob.GetProperty("encoding").GetString());

        var tree = JsonDocument.Parse(gh.Requests.Single(q => q.Path == "git/trees").Body).RootElement;
        Assert.Equal("tree1", tree.GetProperty("base_tree").GetString());
        Assert.Equal(3, tree.GetProperty("tree").GetArrayLength());
        Assert.Contains(tree.GetProperty("tree").EnumerateArray(), e => e.GetProperty("path").GetString() == SuitePaths.ToolbarCopy);

        var commit = JsonDocument.Parse(gh.Requests.Single(q => q.Path == "git/commits").Body).RootElement;
        Assert.Equal("msg", commit.GetProperty("message").GetString());
        Assert.Equal("base1", commit.GetProperty("parents")[0].GetString());
        foreach (var who in new[] { "author", "committer" })
        {
            Assert.Equal("jane", commit.GetProperty(who).GetProperty("name").GetString());
            Assert.Equal("42+jane@users.noreply.github.com", commit.GetProperty(who).GetProperty("email").GetString());
        }
        var patch = JsonDocument.Parse(gh.Requests.Single(q => q.Method == "PATCH").Body).RootElement;
        Assert.Equal("c2", patch.GetProperty("sha").GetString());
        Assert.False(patch.GetProperty("force").GetBoolean());
    }

    [Fact]
    public async Task Ref_update_conflict_reprepares_once_then_succeeds()
    {
        var gh = new FakeGitHub();
        gh.RefAnswers.Enqueue(HttpStatusCode.UnprocessableEntity);
        var calls = 0;
        var r = await Publisher(gh).PublishAsync(Files, "msg", () => { calls++; return Task.FromResult(Prepared()); });
        Assert.True(r.Ok, r.Error);
        Assert.Equal(1, calls);
        Assert.Equal(2, gh.Requests.Count(q => q.Method == "PATCH"));
    }

    [Fact]
    public async Task Second_conflict_returns_error()
    {
        var gh = new FakeGitHub();
        gh.RefAnswers.Enqueue(HttpStatusCode.UnprocessableEntity);
        gh.RefAnswers.Enqueue(HttpStatusCode.UnprocessableEntity);
        var r = await Publisher(gh).PublishAsync(Files, "msg", () => Task.FromResult(Prepared()));
        Assert.False(r.Ok);
        Assert.Equal("main changed while publishing. Reopen and try again.", r.Error);
    }

    [Fact]
    public async Task Reprepare_conflict_stops_with_the_section_name()
    {
        var gh = new FakeGitHub();
        gh.RefAnswers.Enqueue(HttpStatusCode.UnprocessableEntity);
        var r = await Publisher(gh).PublishAsync(Files, "msg",
            () => Task.FromResult(new PrepareResult(false, "Change Tracker", Array.Empty<ChangeItem>(), new Dictionary<string, string>(), null)));
        Assert.False(r.Ok);
        Assert.Contains("Change Tracker", r.Error);
        Assert.Single(gh.Requests, q => q.Method == "PATCH");
    }

    [Fact]
    public async Task Unauthorized_returns_token_message()
    {
        var gh = new FakeGitHub { UserStatus = HttpStatusCode.Unauthorized };
        var r = await Publisher(gh).PublishAsync(Files, "msg", () => Task.FromResult(Prepared()));
        Assert.False(r.Ok);
        Assert.Contains("token", r.Error);
        Assert.DoesNotContain(gh.Requests, q => q.Method != "GET");
    }

    [Fact]
    public void Commit_message_names_each_suite_with_its_version()
    {
        var items = new[] { new ChangeItem(Core.Sections.BlockCatalog.NoteTemplates, "Change Tracker", "Updated the ticket note texts for \"Policy Created\" entries.") };
        Assert.Equal("Ticket Helpers 4.3.5 and Tools Toolbar 2.29.3: Change Tracker: Updated the ticket note texts for \"Policy Created\" entries",
            GitHubPublisher.CommitMessage(Files, items));
    }
}
