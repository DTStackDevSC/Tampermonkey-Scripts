using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Js;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>One canned response as the editor shows it.</summary>
public sealed class ResponseRow : ObservableObject
{
    public const string ReadOnlyText = "This response has logic and can only be changed in the code.";

    public ResponseRow(ResponseItem item) { Item = item; }
    public ResponseItem Item { get; }

    public string Key => Item.Key;
    public string Label { get => Item.Label; set => SetProperty(Item.Label, value, Item, (m, v) => m.Label = v); }
    public string Category { get => Item.Category; set => SetProperty(Item.Category, value, Item, (m, v) => m.Category = v); }
    public bool Enabled { get => Item.Enabled; set => SetProperty(Item.Enabled, value, Item, (m, v) => m.Enabled = v); }
    public bool HasSubmenu { get => Item.HasSubmenu; set => SetProperty(Item.HasSubmenu, value, Item, (m, v) => m.HasSubmenu = v); }

    /// <summary>"work_notes" or "comments".</summary>
    public string FieldType
    {
        get => Item.FieldType == "work_notes" ? "work_notes" : "comments";
        set => SetProperty(FieldType, value, Item, (m, v) => m.FieldType = v);
    }

    /// <summary>Key of the parent menu item, or "" for none.</summary>
    public string Parent
    {
        get => Item.ParentItem ?? "";
        set => SetProperty(Parent, value ?? "", Item, (m, v) => m.ParentItem = v.Length == 0 ? null : v);
    }

    /// <summary>Status set after inserting, or "" for "Do not change".</summary>
    public string StatusAfter
    {
        get => Item.StatusAfter ?? "";
        set => SetProperty(StatusAfter, value ?? "", Item, (m, v) => m.StatusAfter = v.Length == 0 ? null : v);
    }

    public bool BodyReadOnly => !Item.BodyEditable;
    public string? ReadOnlyNote => BodyReadOnly ? ReadOnlyText : null;

    public string Body
    {
        get => Item.BodyRaw == null ? "" : BodyReadOnly ? Item.BodyRaw : TemplateText.ToFriendly(Item.BodyRaw);
        set
        {
            if (BodyReadOnly || value == Body) return;
            Item.BodyRaw = TemplateText.FromFriendly(value);
            OnPropertyChanged();
            OnPropertyChanged(nameof(Preview));
        }
    }

    public string Preview => Body.Replace(TemplateText.OpenedByName, "Jane Doe").Replace(TemplateText.TicketType, "Request");
}

/// <summary>The Ticket Response Helper menu of one team.</summary>
public sealed partial class ResponsesPage : PageBase
{
    ResponseTeam? team;

    public ResponsesPage(MainViewModel main) : base(main, true)
    {
        Items = new(Write, NewRow, CopyRow);
        Items.Changed += RefreshParents;
    }

    public EditableList<ResponseRow> Items { get; }
    public ObservableCollection<Choice> SectionChoices { get; } = new();
    public ObservableCollection<Choice> ParentChoices { get; } = new();
    public ObservableCollection<Choice> StatusChoices { get; } = new();
    public IReadOnlyList<Choice> FieldTypeChoices { get; } = new[]
    {
        new Choice("comments", "Comment (the requester sees it)"),
        new Choice("work_notes", "Work note (internal only)")
    };
    public string PlaceholderHint => $"Type {{ to insert a placeholder: {TemplateText.OpenedByName} or {TemplateText.TicketType}. The script fills them in for each ticket.";

    void Write(IReadOnlyList<ResponseRow> rows)
    {
        if (team == null) return;
        team.Responses = rows.Select(r => r.Item).ToList();
        ResponseTeam.Save(Doc, team);
        Edited();
    }

    ResponseRow NewRow() => new(new ResponseItem
    {
        Key = ResponseTeam.NewKey("New response", team!),
        Label = "New response",
        Category = Items.Selected?.Category ?? team!.DefaultSectionOrder.FirstOrDefault() ?? "",
        FieldType = "comments",
        Enabled = true,
        BodyRaw = ""
    });

    ResponseRow CopyRow(ResponseRow r) => new(new ResponseItem
    {
        Key = ResponseTeam.NewKey(r.Label + " copy", team!),
        Label = r.Label + " (copy)",
        Category = r.Category,
        FieldType = r.Item.FieldType,
        Enabled = r.Enabled,
        StatusAfter = r.Item.StatusAfter,
        ParentItem = r.Item.ParentItem,
        BodyRaw = r.BodyReadOnly ? null : r.Item.BodyRaw ?? ""
    });

    void RefreshParents()
    {
        var wanted = Items.Items.Where(r => r.HasSubmenu).Select(r => new Choice(r.Key, r.Label)).Prepend(new Choice("", "None (top level)")).ToList();
        if (wanted.SequenceEqual(ParentChoices)) return;
        ParentChoices.Clear();
        foreach (var c in wanted) ParentChoices.Add(c);
    }

    protected override string? Load()
    {
        team = ResponseTeam.ReadAll(Doc).FirstOrDefault(t => t.Key == Main.SelectedTeamKey);
        if (team == null) return "This team has no Ticket Response menu yet.";

        SectionChoices.Clear();
        foreach (var s in team.DefaultSectionOrder.Concat(team.Responses.Select(r => r.Category)).Where(s => s.Length > 0).Distinct())
            SectionChoices.Add(new Choice(s, s));

        StatusChoices.Clear();
        StatusChoices.Add(new Choice("", "Do not change"));
        var sd = ShortDescriptionTeam.ReadAll(Doc).FirstOrDefault(t => t.Key == team.Key);
        var statuses = (sd?.StatusOptions ?? new()).Concat(team.Responses.Select(r => r.StatusAfter ?? "")).Where(s => s.Length > 0).Distinct();
        foreach (var s in statuses) StatusChoices.Add(new Choice(s, s));

        Items.Load(team.Responses.Select(r => new ResponseRow(r)));
        ParentChoices.Clear();
        RefreshParents();
        return null;
    }
}
