using System.Text.RegularExpressions;
using ConfigEditor.Core.Release;
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

    /// <summary>SCRIPT_VERSION of a section (null = the suite core) in the suite as it is in the repo now.</summary>
    public static string Version(SuiteId suite, string? section = null)
    {
        var text = Read(suite);
        var b = BlockLocator.SectionBounds(text, section);
        return Regex.Match(text.Substring(b.Start, b.Length), @"const SCRIPT_VERSION = '([^']+)'").Groups[1].Value;
    }

    /// <summary>The version a release gives, <paramref name="steps"/> patch bumps after the repo's current one.</summary>
    public static string Next(SuiteId suite, string? section = null, int steps = 1)
    {
        var v = Version(suite, section);
        for (var i = 0; i < steps; i++) v = VersionNumber.NextPatch(v);
        return v;
    }
}
