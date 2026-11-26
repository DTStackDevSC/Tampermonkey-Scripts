namespace GitHelper.ViewModels;

public sealed record HelpSection(string Icon, string Title, string Lead, IReadOnlyList<(string Label, string Text)> Items);

/// <summary>The content of the ? Help window. Kept here so a test can check every button is described.</summary>
public sealed class HelpGuide
{
    public required string Version { get; init; }
    public required IReadOnlyList<HelpSection> Sections { get; init; }

    public static HelpGuide Build(string version) => new()
    {
        Version = version,
        Sections =
        [
            new("🚀", "Getting started", "Open a folder that holds a git repository, or clone one from GitHub.",
            [
                ("📁 Open repo", "Pick any folder inside a repository. The app remembers it in the list next to the button."),
                ("⬇ Clone", "Copies a repository from GitHub to your PC (you pick it from your list or paste owner/name or a link)."),
                ("🔑 Sign in to GitHub", "Opens the GitHub CLI sign in in a small window. Needed once per PC for Pull and Push."),
                ("📂 Show in Explorer", "Opens the repository folder in Windows Explorer."),
                ("🌐 Open on GitHub", "Opens the repository (on the current branch) in your browser."),
                ("⚙ Settings", "Your commit name and email, and how Pull works."),
                ("? Help", "Opens this guide."),
            ]),
            new("📝", "Commit your changes", "Every changed file is listed on the left. Ticked files go into the next commit.",
            [
                ("Tick boxes", "Only ticked files are committed. Untick a file to keep it out. \"All\" ticks or unticks every file."),
                ("Click a file", "Shows what changed on the right: green lines were added, red lines removed."),
                ("✔ Commit", "Saves the ticked files as one commit on your PC, with your message. Nothing is sent to GitHub yet."),
                ("✔ Commit and push", "Commits, then sends the commit to GitHub in one click."),
                ("↩ Discard", "Throws away your changes to the selected file. Needs a second click, and cannot be undone."),
            ]),
            new("🔄", "Stay in step with GitHub", "The bar under the title says how your branch compares with GitHub.",
            [
                ("🔍 Check GitHub", "Asks GitHub for new commits without changing your files. Then the bar shows ↓ commits to pull."),
                ("⬇ Pull", "Brings the new commits from GitHub into your folder (updates your local repo)."),
                ("⬆ Push", "Sends your commits to GitHub. A branch that was never pushed is created on GitHub."),
                ("⟳ Sync", "Pull, then Push, in one click."),
                ("🔁 Refresh", "Reads the folder again, for example after you edited files in another program."),
            ]),
            new("🌿", "Branches", "The branch box shows where you are. Pick another branch to switch to it.",
            [
                ("Branch list", "Branches on your PC, plus the ones that exist only on GitHub (switching to one downloads it)."),
                ("＋ New branch", "Creates a branch from where you are and switches to it. Your uncommitted changes come along."),
            ]),
            new("🕘", "History", "The History tab lists the last commits. ↑ marks a commit not on GitHub yet.",
            [
                ("↶ Undo last commit", "Takes back the last commit if it was not pushed. Your changes stay in the files and the message comes back in the box. Needs a second click."),
            ]),
            new("⚠️", "When something goes wrong", "A yellow bar appears when a pull stopped halfway because the same lines changed on both sides.",
            [
                ("Fix the files", "Open each file marked !, keep the right lines and remove the <<<<<<< ======= >>>>>>> marks."),
                ("Continue", "Goes on once every file is fixed. The app checks that no marks are left."),
                ("Abort", "Goes back to how things were before the pull. Needs a second click."),
                ("Output", "The Output panel at the bottom shows every git command the app ran and git's answer."),
            ]),
            new("⚙️", "Settings", "Choose who your commits are from and how Pull works. Settings are saved in your own user folder, so no admin rights are needed.",
            [
                ("Commit identity", "The name and email on your commits. \"Fill from my GitHub account\" uses your private noreply email, so your work email is never published."),
                ("Check before each commit", "If a repository would commit under another name or email, the app asks before it commits and can fix it for that repository."),
                ("Update the app's repository", "On by default: when the app starts it pulls the repository it runs from, so that copy is always up to date. A pull that cannot finish is undone and you get a warning."),
                ("Pull with rebase", "On: your local commits are put on top of the new ones from GitHub (no merge commits). Off: Pull only fast forwards."),
            ]),
        ],
    };
}
