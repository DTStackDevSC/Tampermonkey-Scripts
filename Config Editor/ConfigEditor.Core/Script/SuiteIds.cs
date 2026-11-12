namespace ConfigEditor.Core.Script;

public enum SuiteId { TicketHelpers, Toolbar }

public static class SuitePaths
{
    public const string TicketHelpers = "Standalone Scripts/ServiceNowShortDescriptionHelper.user.js";
    public const string Toolbar = "Toolbar Scripts/Toolbar-Suite.user.js";
    public const string ToolbarCopy = "Toolbar Scripts/Toolbar.user.js";

    public static string Of(SuiteId suite) => suite == SuiteId.TicketHelpers ? TicketHelpers : Toolbar;

    public static string DisplayName(SuiteId suite) => suite == SuiteId.TicketHelpers ? "Ticket Helpers" : "Tools Toolbar";
}

/// <summary>A config constant: <paramref name="Section"/> is the text after "=== TOOL: ", or null for the suite core.</summary>
public sealed record BlockRef(SuiteId Suite, string? Section, string ConstName);

public readonly record struct TextSpan(int Start, int Length)
{
    public int End => Start + Length;
}

public sealed class BlockNotFoundException : Exception
{
    public BlockNotFoundException(BlockRef block)
        : base($"Could not find {block.ConstName} in {block.Section ?? "the suite core"}.") { Block = block; }
    public BlockRef Block { get; }
}
