using System.Text;
using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;
using ConfigEditor.Core.Session;

namespace ConfigEditor.Tests;

public class EditSessionTests
{
    sealed class FakeSource : IScriptSource
    {
        public Dictionary<string, string> Files { get; } = new()
        {
            [SuitePaths.TicketHelpers] = TestRepo.Read(SuiteId.TicketHelpers),
            [SuitePaths.Toolbar] = TestRepo.Read(SuiteId.Toolbar),
        };
        public bool Offline { get; set; }
        public string Description => "fake";
        public Task<string> ReadAsync(string relativePath, CancellationToken ct) =>
            Offline ? throw new HttpRequestException("offline") : Task.FromResult(Files[relativePath]);
    }

    static void EditEmeaResponse(ConfigDocument d)
    {
        var emea = ResponseTeam.ReadAll(d).Single(t => t.Key == "emeaTeam");
        emea.Responses.First(r => r.BodyEditable).BodyRaw += " Thanks.";
        ResponseTeam.Save(d, emea);
    }

    static void EditNote(ConfigDocument d)
    {
        var notes = NoteTemplate.ReadAll(d);
        notes[0].CommentsHeader += " Thanks.";
        NoteTemplate.Save(d, notes);
    }

    [Fact]
    public async Task Unrelated_upstream_change_is_kept_and_version_follows_latest()
    {
        var session = await EditSession.OpenAsync(new FakeSource(), default);
        EditNote(session.Edited);

        var latest = new FakeSource();
        var tb = latest.Files[SuitePaths.Toolbar]
            .Replace("// @version      2.29.2", "// @version      2.29.3")
            .Replace("const SCRIPT_VERSION = '2.29.2';", "const SCRIPT_VERSION = '2.29.3';");
        var marker = "/* === TOOL: DOMAIN TOOLS === */";
        tb = tb.Replace(marker, marker + "\n    // upstream line");
        latest.Files[SuitePaths.Toolbar] = tb;

        var r = await session.PrepareAsync(latest, default);
        Assert.True(r.Ok, r.Error);
        var text = r.Files[SuitePaths.Toolbar];
        Assert.Contains("// @version      2.29.4", text);
        Assert.Contains(marker + "\n    // upstream line", text);
        Assert.Contains(" Thanks.", text);
        Assert.False(r.Files.ContainsKey(SuitePaths.TicketHelpers));
    }

    [Fact]
    public async Task Same_block_changed_upstream_is_conflict_with_section_name()
    {
        var session = await EditSession.OpenAsync(new FakeSource(), default);
        EditEmeaResponse(session.Edited);

        var latest = new FakeSource();
        var other = ConfigDocument.Load(latest.Files[SuitePaths.TicketHelpers], latest.Files[SuitePaths.Toolbar]);
        var ame = ResponseTeam.ReadAll(other).Single(t => t.Key == "ameTeam");
        ame.Name = "AME Team Upstream";
        ResponseTeam.Save(other, ame);
        latest.Files[SuitePaths.TicketHelpers] = other.Render().ticketHelpers;

        var r = await session.PrepareAsync(latest, default);
        Assert.False(r.Ok);
        Assert.Equal("Ticket Response Helper", r.ConflictSection);
        Assert.Empty(r.Files);
    }

    [Fact]
    public async Task Toolbar_change_writes_both_toolbar_files_identical()
    {
        var src = new FakeSource();
        var session = await EditSession.OpenAsync(src, default);
        EditNote(session.Edited);
        var r = await session.PrepareAsync(src, default);
        Assert.True(r.Ok, r.Error);
        Assert.Equal(2, r.Files.Count);
        Assert.Equal(r.Files[SuitePaths.Toolbar], r.Files[SuitePaths.ToolbarCopy]);
        Assert.NotEmpty(r.Items);
    }

    [Fact]
    public async Task Offline_folder_session_saves_with_warning()
    {
        var dir = Directory.CreateTempSubdirectory("ce-folder").FullName;
        try
        {
            foreach (var (rel, text) in new FakeSource().Files)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.Combine(dir, rel))!);
                File.WriteAllText(Path.Combine(dir, rel), text);
            }
            var session = await EditSession.OpenAsync(new FolderSource(dir), default);
            EditEmeaResponse(session.Edited);
            var r = await session.PrepareAsync(new FakeSource { Offline = true }, default);
            Assert.True(r.Ok, r.Error);
            Assert.Equal("Could not check GitHub for newer versions.", r.Warning);
            Assert.Contains("// @version      4.3.5", r.Files[SuitePaths.TicketHelpers]);
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public async Task Offline_github_session_is_refused()
    {
        var session = await EditSession.OpenAsync(new FakeSource(), default);
        EditEmeaResponse(session.Edited);
        var r = await session.PrepareAsync(new FakeSource { Offline = true }, default);
        Assert.False(r.Ok);
        Assert.Contains("offline", r.Error);
    }

    [Fact]
    public async Task Save_creates_backup_then_writes()
    {
        var dir = Directory.CreateTempSubdirectory("ce-save").FullName;
        try
        {
            var rel = SuitePaths.Toolbar;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.Combine(dir, rel))!);
            File.WriteAllText(Path.Combine(dir, rel), "old");
            await EditSession.SaveAsync(dir, new Dictionary<string, string> { [rel] = "new ✅", [SuitePaths.ToolbarCopy] = "new ✅" });

            var bytes = File.ReadAllBytes(Path.Combine(dir, rel));
            Assert.Equal("new ✅", Encoding.UTF8.GetString(bytes));
            Assert.NotEqual(0xEF, bytes[0]);
            var backup = Assert.Single(Directory.GetFiles(Path.Combine(dir, "backups")));
            Assert.Matches(@"Toolbar-Suite\.user\.js\.\d{8}-\d{6}\.bak$", backup);
            Assert.Equal("old", File.ReadAllText(backup));
            Assert.True(File.Exists(Path.Combine(dir, SuitePaths.ToolbarCopy)));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public async Task Invalid_result_is_refused()
    {
        var src = new FakeSource();
        var session = await EditSession.OpenAsync(src, default);
        session.Edited.Set(BlockCatalog.Geos, new JsRaw("{"));
        var r = await session.PrepareAsync(src, default);
        Assert.False(r.Ok);
        Assert.NotNull(r.Error);
        Assert.Empty(r.Files);
    }

    [Fact]
    public async Task Nothing_changed_prepares_no_files()
    {
        var src = new FakeSource();
        var session = await EditSession.OpenAsync(src, default);
        var r = await session.PrepareAsync(src, default);
        Assert.True(r.Ok);
        Assert.Empty(r.Files);
        Assert.Empty(r.Items);
    }
}
