using ConfigEditor.Core.Js;
using ConfigEditor.Core.Script;

namespace ConfigEditor.Core.Sections;

/// <summary>The editable blocks of both suites: what was read, what the user changed, and the patched texts.</summary>
public sealed class ConfigDocument
{
    readonly Dictionary<BlockRef, JsNode> original = new();
    readonly Dictionary<BlockRef, JsNode> current = new();

    ConfigDocument(string ticketHelpers, string toolbar) { TicketHelpersText = ticketHelpers; ToolbarText = toolbar; }

    public string TicketHelpersText { get; }
    public string ToolbarText { get; }

    /// <summary>Blocks that could not be read, with the reason shown to the user.</summary>
    public Dictionary<BlockRef, string> Unavailable { get; } = new();

    public static ConfigDocument Load(string ticketHelpers, string toolbar)
    {
        var doc = new ConfigDocument(ticketHelpers, toolbar);
        foreach (var b in BlockCatalog.All)
        {
            var text = b.Suite == SuiteId.TicketHelpers ? ticketHelpers : toolbar;
            try
            {
                var span = BlockLocator.FindValue(text, b);
                var node = JsReader.Parse(text.Substring(span.Start, span.Length));
                if (node is JsRaw) { doc.Unavailable[b] = $"{b.ConstName} has a shape the editor does not understand."; continue; }
                doc.original[b] = node;
                doc.current[b] = node.Clone();
            }
            catch (BlockNotFoundException) { doc.Unavailable[b] = $"{b.ConstName} was not found in {SuitePaths.DisplayName(b.Suite)}."; }
            catch (JsParseException e) { doc.Unavailable[b] = $"{b.ConstName} could not be read: {e.Message}"; }
        }
        return doc;
    }

    public JsNode? Get(BlockRef b) => current.TryGetValue(b, out var n) ? n : null;

    public void Set(BlockRef b, JsNode node)
    {
        if (!current.ContainsKey(b)) throw new InvalidOperationException($"{b.ConstName} is not available.");
        current[b] = node;
    }

    public IReadOnlyList<BlockRef> Changed =>
        BlockCatalog.All.Where(b => current.ContainsKey(b) && !JsNode.DeepEquals(original[b], current[b])).ToList();

    /// <summary>Discards every change to one block.</summary>
    public void Revert(BlockRef b)
    {
        if (original.TryGetValue(b, out var n)) current[b] = n.Clone();
    }

    public (string ticketHelpers, string toolbar) Render()
    {
        var changed = Changed;
        Dictionary<BlockRef, JsNode> Of(SuiteId s) => changed.Where(b => b.Suite == s).ToDictionary(b => b, b => current[b]);
        return (ScriptPatcher.Apply(TicketHelpersText, Of(SuiteId.TicketHelpers)),
                ScriptPatcher.Apply(ToolbarText, Of(SuiteId.Toolbar)));
    }
}
