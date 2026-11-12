using System.IO;
using System.Security.Cryptography;
using System.Text;
using ConfigEditor.Core.Publish;

namespace ConfigEditor.App.Services;

/// <summary>Keeps the token encrypted for the current Windows user only.</summary>
public sealed class DpapiTokenStore : ITokenStore
{
    static readonly string FilePath = Path.Combine(AppPaths.Root, "token.bin");

    public string? Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return null;
            return Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(FilePath), null, DataProtectionScope.CurrentUser));
        }
        catch (CryptographicException) { return null; }
    }

    public void Save(string token)
    {
        Directory.CreateDirectory(AppPaths.Root);
        File.WriteAllBytes(FilePath, ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser));
    }

    public void Clear()
    {
        if (File.Exists(FilePath)) File.Delete(FilePath);
    }
}
