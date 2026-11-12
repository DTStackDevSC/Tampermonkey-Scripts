namespace ConfigEditor.Core.Release;

public static class VersionNumber
{
    /// <summary>"4.3.4" gives "4.3.5"; a two part version gains a patch: "1.4" gives "1.4.1".</summary>
    public static string NextPatch(string v)
    {
        var parts = v.Trim().Split('.').ToList();
        if (parts.Count < 3) { while (parts.Count < 2) parts.Add("0"); parts.Add("1"); return string.Join('.', parts); }
        parts[^1] = (int.Parse(parts[^1]) + 1).ToString();
        return string.Join('.', parts);
    }
}
