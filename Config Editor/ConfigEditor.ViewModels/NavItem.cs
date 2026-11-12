using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Script;

namespace ConfigEditor.ViewModels;

/// <summary>One entry of the left navigation: a section of a suite and the blocks it edits.</summary>
public partial class NavItem : ObservableObject
{
    public NavItem(string id, string title, string group, bool isPerTeam, params BlockRef[] blocks)
    {
        Id = id; Title = title; Group = group; IsPerTeam = isPerTeam; Blocks = blocks;
    }

    public string Id { get; }
    public string Title { get; }
    public string Group { get; }
    public bool IsPerTeam { get; }
    public IReadOnlyList<BlockRef> Blocks { get; }

    [ObservableProperty] private bool isAvailable;
    [ObservableProperty] private string? unavailableReason = "Not loaded yet.";
    [ObservableProperty] private object? page;
}
