using CommunityToolkit.Mvvm.ComponentModel;
using ConfigEditor.Core.Sections;

namespace ConfigEditor.ViewModels.Pages;

/// <summary>A value with the text shown for it in a dropdown.</summary>
public sealed record Choice(string Value, string Label);

public sealed partial class TextRow : ObservableObject
{
    [ObservableProperty] private string text;
    public TextRow(string text) { this.text = text; }
}

public sealed class CodeLabelRow : ObservableObject
{
    public CodeLabelRow(CodeLabel model) { Model = model; }
    public CodeLabel Model { get; }
    public string Code { get => Model.Code; set => SetProperty(Model.Code, value, Model, (m, v) => m.Code = v); }
    public string Label { get => Model.Label; set => SetProperty(Model.Label, value, Model, (m, v) => m.Label = v); }
}

public sealed class LabelValueRow : ObservableObject
{
    public LabelValueRow(LabelValue model) { Model = model; }
    public LabelValue Model { get; }
    public string Label { get => Model.Label; set => SetProperty(Model.Label, value, Model, (m, v) => m.Label = v); }
    public string Value { get => Model.Value; set => SetProperty(Model.Value, value, Model, (m, v) => m.Value = v); }
}

public sealed class MfCodeRow : ObservableObject
{
    public MfCodeRow(MfCodeEntry model) { Model = model; }
    public MfCodeEntry Model { get; }
    public string Name { get => Model.Name; set => SetProperty(Model.Name, value, Model, (m, v) => m.Name = v); }
    public string Code { get => Model.Code; set => SetProperty(Model.Code, value, Model, (m, v) => m.Code = v); }
}

/// <summary>A tenant group: its member firm codes are edited as one comma separated line.</summary>
public sealed class TenantGroupRow : ObservableObject
{
    public TenantGroupRow(TenantGroup model) { Model = model; }
    public TenantGroup Model { get; }
    public string Key => Model.Key;
    public string Label { get => Model.Label; set => SetProperty(Model.Label, value, Model, (m, v) => m.Label = v); }
    public string Mfs
    {
        get => string.Join(", ", Model.Mfs);
        set
        {
            var list = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (list.SequenceEqual(Model.Mfs)) return;
            Model.Mfs.Clear();
            Model.Mfs.AddRange(list);
            OnPropertyChanged();
        }
    }
}

public sealed class NoteTemplateRow : ObservableObject
{
    public NoteTemplateRow(NoteTemplate model) { Model = model; }
    public NoteTemplate Model { get; }
    public string EntryType => Model.EntryType;
    public string WorkNoteHeader { get => Model.WorkNoteHeader; set => SetProperty(Model.WorkNoteHeader, value, Model, (m, v) => m.WorkNoteHeader = v); }
    public string CommentsHeader { get => Model.CommentsHeader; set => SetProperty(Model.CommentsHeader, value, Model, (m, v) => m.CommentsHeader = v); }
    public string CommentsCloser { get => Model.CommentsCloser ?? ""; set => SetProperty(Model.CommentsCloser ?? "", value, Model, (m, v) => m.CommentsCloser = v.Length == 0 ? null : v); }
}
