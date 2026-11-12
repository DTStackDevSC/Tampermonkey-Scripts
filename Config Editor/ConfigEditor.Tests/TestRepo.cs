using ConfigEditor.Core.Script;

namespace ConfigEditor.Tests;

public static class TestRepo
{
    public static readonly string Root = FindRoot();

    static string FindRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, ".git")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repository root not found");
    }

    public static string Read(SuiteId suite) => File.ReadAllText(Path.Combine(Root, SuitePaths.Of(suite)));
}
