using ConfigEditor.ViewModels;

namespace ConfigEditor.Tests;

public class HelpGuideTests
{
    [Fact]
    public void Help_button_opens_the_guide()
    {
        var (vm, _, _, d, _) = MainViewModelTests.Make();
        vm.OpenHelpCommand.Execute(null);
        Assert.Equal(1, d.HelpShown);
    }

    [Fact]
    public void Every_section_in_the_menu_is_explained_in_the_guide()
    {
        var (vm, _, _, _, _) = MainViewModelTests.Make();
        var guide = vm.CreateHelp();
        Assert.Equal(vm.Nav.Select(n => n.Title), guide.Sections.Select(s => s.Title));
        Assert.All(guide.Sections, s =>
        {
            Assert.False(string.IsNullOrWhiteSpace(s.Changes));
            Assert.False(string.IsNullOrWhiteSpace(s.WhereUsersSeeIt));
            Assert.NotEmpty(s.Parts);
        });
    }

    [Fact]
    public void Guide_shows_the_app_version()
    {
        var (vm, _, _, _, _) = MainViewModelTests.Make();
        Assert.Matches(@"^\d+\.\d+\.\d+$", vm.CreateHelp().Version);
    }
}
