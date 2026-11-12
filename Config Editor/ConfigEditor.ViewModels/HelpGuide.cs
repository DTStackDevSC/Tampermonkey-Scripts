using System.Reflection;

namespace ConfigEditor.ViewModels;

/// <summary>One section of the left menu, explained for the Feature Guide.</summary>
public sealed record SectionGuide(string Title, string Group, string Icon, bool PerTeam,
    string Changes, string WhereUsersSeeIt, IReadOnlyList<string> Parts);

/// <summary>What the Feature Guide window shows.</summary>
public sealed record HelpGuide(string Version, bool PublishEnabled, IReadOnlyList<SectionGuide> Sections)
{
    static readonly Dictionary<string, (string Icon, string Changes, string Where, string[] Parts)> Texts = new()
    {
        ["shortDescription"] = ("📝",
            "The choices the Short Description Helper offers each team, and whether the Vendor and PER fields show.",
            "ServiceNow ticket: the Short Description Helper dropdowns.",
            new[] { "⚙️ General", "🏢 Member firms", "📦 Products", "🚦 Statuses", "🏷️ Types", "📊 Complexities" }),
        ["responses"] = ("💬",
            "The ready made replies of the Ticket Response Helper: menu text, where each one sits, comments or work notes, and the reply text.",
            "ServiceNow ticket: the Ticket Response menu.",
            new[] { "📋 Response list", "🧭 Menu text, section, submenu", "✍️ Writes into", "🚦 Status after inserting", "📄 Text with placeholders", "👀 Preview" }),
        ["policyNaming"] = ("🛡️",
            "The codes the Policy Naming Helper uses to build Netskope policy names.",
            "Netskope: the Policy Naming Helper dropdowns.",
            new[] { "🌍 Regions (GEO)", "🛡️ Policy types", "🔒 DLP policy types", "👥 Applies to", "📡 Channel types", "🎯 DLP criteria" }),
        ["ticketSubject"] = ("🏷️",
            "Member firms, products and the Netskope tenant of each member firm, used to build ticket subjects.",
            "Netskope support portal: the Ticket Subject Helper on a new support ticket.",
            new[] { "🏢 Member firms", "📦 Products", "🔗 Netskope tenants" }),
        ["noteTexts"] = ("🗒️",
            "The headings the Change Tracker writes into the ticket for each kind of entry. The entry details follow automatically.",
            "ServiceNow ticket: work notes and comments written by the Change Tracker.",
            new[] { "Work note heading (internal)", "Comment heading (the requester sees it)", "Comment closing sentence" }),
        ["mfCodes"] = ("🏢",
            "Which assignment group code goes with each member firm name read from the ticket.",
            "ServiceNow ticket: the Ticket Assignment Tool of the Tools Toolbar.",
            new[] { "🏢 Member firm codes" }),
    };

    public static string AppVersion
    {
        get
        {
            var v = typeof(HelpGuide).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "0.0.0";
            var plus = v.IndexOf('+');
            return plus < 0 ? v : v[..plus];
        }
    }

    public static HelpGuide For(IEnumerable<NavItem> nav, bool publishEnabled) => new(AppVersion, publishEnabled,
        nav.Select(n =>
        {
            var t = Texts[n.Id];
            return new SectionGuide(n.Title, n.Group, t.Icon, n.IsPerTeam, t.Changes, t.Where, t.Parts);
        }).ToList());
}
