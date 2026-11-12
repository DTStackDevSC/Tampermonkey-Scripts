using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>Member firm names and short codes used by the Ticket Assignment Tool.</summary>
public sealed class MfCodesPage : PageBase
{
    public MfCodesPage(MainViewModel main) : base(main, false)
    {
        Entries = new(rows => { MfCodeEntry.Save(Doc, rows.Select(r => r.Model)); Edited(); },
            () => new MfCodeRow(new MfCodeEntry("Deloitte New Firm", "NEW")),
            r => new MfCodeRow(new MfCodeEntry(r.Name + " (copy)", r.Code)));
    }

    public EditableList<MfCodeRow> Entries { get; }

    protected override string? Load()
    {
        Entries.Load(MfCodeEntry.ReadAll(Doc).Select(e => new MfCodeRow(e)));
        return null;
    }
}
