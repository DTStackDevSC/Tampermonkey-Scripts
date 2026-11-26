using System.Diagnostics;
using System.Text;

namespace GitHelper.Core;

/// <summary>What one git or gh call gave back.</summary>
public sealed record CommandResult(int ExitCode, string StdOut, string StdErr, string CommandLine, string Verb = "")
{
    public bool Ok => ExitCode == 0;

    /// <summary>The most useful text to show when the call failed: stderr first, else stdout.</summary>
    public string ErrorText
    {
        get
        {
            var t = string.IsNullOrWhiteSpace(StdErr) ? StdOut : StdErr;
            return string.IsNullOrWhiteSpace(t) ? $"{CommandLine} ended with code {ExitCode}." : t.Trim();
        }
    }
}

/// <summary>Runs a command line tool. The app and the tests use the real one; tests may log every call.</summary>
public interface ICommandRunner
{
    Task<CommandResult> RunAsync(string exe, string workDir, IReadOnlyList<string> args,
        string? stdin = null, TimeSpan? timeout = null, CancellationToken ct = default);

    /// <summary>Raised after every call, so the app can show what ran in its Output pane.</summary>
    event Action<CommandResult>? Ran;
}

public sealed class ProcessRunner : ICommandRunner
{
    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromMinutes(5);

    public event Action<CommandResult>? Ran;

    public async Task<CommandResult> RunAsync(string exe, string workDir, IReadOnlyList<string> args,
        string? stdin = null, TimeSpan? timeout = null, CancellationToken ct = default)
    {
        var psi = new ProcessStartInfo(exe)
        {
            WorkingDirectory = workDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = stdin != null,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        if (stdin != null) psi.StandardInputEncoding = new UTF8Encoding(false);
        // Arguments go one by one, never through a shell, so a commit message or a path can hold any character.
        foreach (var a in args) psi.ArgumentList.Add(a);
        // Never wait for a typed password: a hidden prompt would hang the app. Credential helpers still work.
        psi.Environment["GIT_TERMINAL_PROMPT"] = "0";
        psi.Environment["GH_PROMPT_DISABLED"] = "1";
        psi.Environment["GH_NO_UPDATE_NOTIFIER"] = "1";
        psi.Environment["NO_COLOR"] = "1";
        psi.Environment["LC_ALL"] = "C";

        var line = exe + " " + string.Join(" ", args.Select(Quote));
        var verb = VerbOf(args);
        CommandResult result;
        try
        {
            using var p = new Process { StartInfo = psi };
            p.Start();
            var outTask = p.StandardOutput.ReadToEndAsync();
            var errTask = p.StandardError.ReadToEndAsync();
            if (stdin != null)
            {
                await p.StandardInput.WriteAsync(stdin);
                p.StandardInput.Close();
            }
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeout ?? DefaultTimeout);
            try { await p.WaitForExitAsync(cts.Token); }
            catch (OperationCanceledException)
            {
                try { p.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
                var why = ct.IsCancellationRequested ? "was stopped" : $"took longer than {(timeout ?? DefaultTimeout).TotalMinutes:0.#} minutes and was stopped";
                result = new CommandResult(-1, "", $"{exe} {why}.", line, verb);
                Ran?.Invoke(result);
                return result;
            }
            result = new CommandResult(p.ExitCode, await outTask, await errTask, line, verb);
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            result = new CommandResult(-2, "", $"Could not start {exe}: {e.Message}. Is it installed and on the PATH?", line, verb);
        }
        Ran?.Invoke(result);
        return result;
    }

    /// <summary>The sub command ("push", "commit"...), skipping "-c key=value" options.</summary>
    public static string VerbOf(IReadOnlyList<string> args)
    {
        for (int i = 0; i < args.Count; i++)
        {
            if (args[i] == "-c") { i++; continue; }
            if (!args[i].StartsWith('-')) return args[i];
        }
        return "";
    }

    static string Quote(string a) => a.Length > 0 && a.IndexOfAny([' ', '"', '\t']) < 0 ? a : "\"" + a.Replace("\"", "\\\"") + "\"";
}
