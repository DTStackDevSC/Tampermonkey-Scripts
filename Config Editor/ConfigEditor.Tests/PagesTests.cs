using ConfigEditor.Core.Script;
using ConfigEditor.Core.Sections;
using ConfigEditor.ViewModels;
using ConfigEditor.ViewModels.Pages;

namespace ConfigEditor.Tests;

public class PagesTests
{
    static async Task<MainViewModel> Started(Action<MainViewModelTests.MemorySource>? tweak = null)
    {
        var (vm, f, _, _, _) = MainViewModelTests.Make();
        tweak?.Invoke(f.Current);
        await vm.StartAsync();
        return vm;
    }

    static T Page<T>(MainViewModel vm, string id) => (T)vm.Nav.Single(n => n.Id == id).Page!;

    [Fact]
    public async Task Editing_response_body_marks_document_changed_and_preview_updates()
    {
        var vm = await Started();
        vm.SelectedTeamKey = "emeaTeam";
        var page = Page<ResponsesPage>(vm, "responses");
        var row = page.Items.Items.First(r => !r.BodyReadOnly);

        row.Body = "Hello {Opened by name}, your {Ticket type} is done.";

        Assert.Equal("Hello Jane Doe, your Request is done.", row.Preview);
        Assert.Contains(BlockCatalog.ResponseTeams, vm.Session!.Edited.Changed);
        Assert.True(vm.HasUnsavedWork);
        var saved = ResponseTeam.ReadAll(vm.Session.Edited).Single(t => t.Key == "emeaTeam").Responses.Single(r => r.Key == row.Key);
        Assert.Equal("Hello ${vars.openedByName}, your ${vars.pageType} is done.", saved.BodyRaw);
    }

    [Fact]
    public async Task Parent_choices_are_items_with_submenu()
    {
        var vm = await Started();
        vm.SelectedTeamKey = "emeaTeam";
        var page = Page<ResponsesPage>(vm, "responses");

        var expected = page.Items.Items.Where(r => r.HasSubmenu).Select(r => r.Key).ToList();
        Assert.NotEmpty(expected);
        Assert.Equal("", page.ParentChoices[0].Value);
        Assert.Equal(expected, page.ParentChoices.Skip(1).Select(c => c.Value));
    }

    [Fact]
    public async Task Status_after_choices_come_from_team_status_options()
    {
        var vm = await Started();
        vm.SelectedTeamKey = "emeaTeam";
        var page = Page<ResponsesPage>(vm, "responses");
        var sd = ShortDescriptionTeam.ReadAll(vm.Session!.Edited).Single(t => t.Key == "emeaTeam");

        Assert.Equal("Do not change", page.StatusChoices[0].Label);
        Assert.Equal(sd.StatusOptions, page.StatusChoices.Skip(1).Select(c => c.Value).Take(sd.StatusOptions.Count));
    }

    [Fact]
    public async Task Remove_option_needs_second_click()
    {
        var vm = await Started();
        var page = Page<PolicyNamingPage>(vm, "policyNaming");
        var before = page.Geos.Items.Count;
        page.Geos.Selected = page.Geos.Items[1];

        page.Geos.RemoveCommand.Execute(null);
        Assert.Equal(before, page.Geos.Items.Count);
        Assert.Equal("Click again to remove", page.Geos.RemoveText);
        Assert.Empty(vm.Session!.Edited.Changed);

        page.Geos.RemoveCommand.Execute(null);
        Assert.Equal(before - 1, page.Geos.Items.Count);
        Assert.Equal(before - 1, CodeLabel.Read(vm.Session.Edited, BlockCatalog.Geos).Count);
        Assert.False(page.Geos.RemoveArmed);
    }

    [Fact]
    public async Task Readonly_body_cannot_be_edited()
    {
        var vm = await Started(src =>
        {
            var text = src.Files[SuitePaths.TicketHelpers];
            var start = text.IndexOf("const RESPONSE_TEAMS", StringComparison.Ordinal);
            var at = text.IndexOf("${vars.openedByName}", start, StringComparison.Ordinal);
            src.Files[SuitePaths.TicketHelpers] = text[..at] + "${vars.openedByName.toUpperCase()}" + text[(at + "${vars.openedByName}".Length)..];
        });
        var page = vm.Nav.Single(n => n.Id == "responses");
        var rows = vm.Teams.Select(t => { vm.SelectedTeamKey = t.Key; return ((ResponsesPage)page.Page!).Items.Items.FirstOrDefault(r => r.BodyReadOnly); });
        var row = rows.First(r => r != null)!;

        var shown = row.Body;
        row.Body = "replaced";

        Assert.Equal(shown, row.Body);
        Assert.Contains("only be changed in the code", row.ReadOnlyNote);
        Assert.Empty(vm.Session!.Edited.Changed);
    }

    [Fact]
    public async Task Switching_team_reloads_short_description_page()
    {
        var vm = await Started();
        var page = Page<ShortDescriptionPage>(vm, "shortDescription");
        var sd = ShortDescriptionTeam.ReadAll(vm.Session!.Edited);
        vm.SelectedTeamKey = sd[0].Key;
        Assert.Equal(sd[0].Name, page.Name);
        vm.SelectedTeamKey = sd[1].Key;
        Assert.Equal(sd[1].Name, page.Name);

        page.StatusOptions.AddCommand.Execute(null);
        Assert.Equal(sd[1].StatusOptions.Count + 1,
            ShortDescriptionTeam.ReadAll(vm.Session.Edited).Single(t => t.Key == sd[1].Key).StatusOptions.Count);
    }

    /// <summary>Does what a WPF ComboBox does: when its selected value leaves the list, it writes null back to the bound property.</summary>
    static void LikeComboBox(System.Collections.ObjectModel.ObservableCollection<Choice> choices, ResponsesPage page, Action<ResponseRow> clear, Func<ResponseRow, string> value) =>
        choices.CollectionChanged += (_, _) =>
        {
            var row = page.Items.Selected;
            if (row != null && !choices.Any(c => c.Value == value(row))) clear(row);
        };

    [Fact]
    public async Task Switching_team_with_a_selected_response_changes_nothing()
    {
        var vm = await Started();
        vm.SelectedTeamKey = "emeaTeam";
        var page = Page<ResponsesPage>(vm, "responses");
        LikeComboBox(page.SectionChoices, page, r => r.Category = null!, r => r.Category);
        LikeComboBox(page.StatusChoices, page, r => r.StatusAfter = null!, r => r.StatusAfter);
        LikeComboBox(page.ParentChoices, page, r => r.Parent = null!, r => r.Parent);
        page.Items.Selected = page.Items.Items.First(r => r.Parent.Length > 0);

        vm.SelectedTeamKey = "ameTeam";

        Assert.Empty(vm.Session!.Edited.Changed);
        Assert.False(vm.HasUnsavedWork);
    }

    [Fact]
    public async Task Ticking_submenu_keeps_the_parent_of_the_selected_response()
    {
        var vm = await Started();
        vm.SelectedTeamKey = "emeaTeam";
        var page = Page<ResponsesPage>(vm, "responses");
        LikeComboBox(page.ParentChoices, page, r => r.Parent = null!, r => r.Parent);
        var child = page.Items.Items.First(r => r.Parent.Length > 0);
        var parent = child.Parent;
        page.Items.Selected = child;

        page.Items.Items.First(r => !r.HasSubmenu && r != child).HasSubmenu = true;

        Assert.Equal(parent, child.Parent);
    }
}
