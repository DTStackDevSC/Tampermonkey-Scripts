using CommunityToolkit.Mvvm.ComponentModel;
using GitHelper.Core;

namespace GitHelper.ViewModels;

/// <summary>One row of the changes list: the file and its tick for the next commit.</summary>
public partial class FileItem(FileChange change, Action onTick) : ObservableObject
{
    public FileChange Change { get; } = change;
    public string Path => Change.Path;
    public string Badge => Change.Badge;
    public string KindText => Change.KindText;
    public string FileName => System.IO.Path.GetFileName(Change.Path);
    public string Folder => System.IO.Path.GetDirectoryName(Change.Path)?.Replace('\\', '/') ?? "";

    [ObservableProperty] private bool isChecked = true;

    partial void OnIsCheckedChanged(bool value) => onTick();
}
