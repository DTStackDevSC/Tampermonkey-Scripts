using ConfigEditor.Core.Script;

namespace ConfigEditor.Core.Sections;

public static class BlockCatalog
{
    const string Sd = "SHORT DESCRIPTION HELPER";
    const string Resp = "TICKET RESPONSE HELPER";
    const string Pn = "POLICY NAMING HELPER";
    const string Ts = "TICKET SUBJECT HELPER";

    public static readonly BlockRef SdTeams = new(SuiteId.TicketHelpers, Sd, "TEAMS");
    public static readonly BlockRef ResponseTeams = new(SuiteId.TicketHelpers, Resp, "RESPONSE_TEAMS");
    public static readonly BlockRef Geos = new(SuiteId.TicketHelpers, Pn, "GEOS");
    public static readonly BlockRef PolicyTypes = new(SuiteId.TicketHelpers, Pn, "POLICY_TYPES");
    public static readonly BlockRef DlpPolicyTypes = new(SuiteId.TicketHelpers, Pn, "DLP_POLICY_TYPES");
    public static readonly BlockRef AppliesTo = new(SuiteId.TicketHelpers, Pn, "APPLIES_TO");
    public static readonly BlockRef PolicyChannelTypes = new(SuiteId.TicketHelpers, Pn, "POLICY_CHANNEL_TYPES");
    public static readonly BlockRef DlpCriteria = new(SuiteId.TicketHelpers, Pn, "DLP_CRITERIA");
    public static readonly BlockRef MfOptions = new(SuiteId.TicketHelpers, Ts, "MF_OPTIONS");
    public static readonly BlockRef ProductOptions = new(SuiteId.TicketHelpers, Ts, "PRODUCT_OPTIONS");
    public static readonly BlockRef TenantGroups = new(SuiteId.TicketHelpers, Ts, "TENANT_GROUPS");
    public static readonly BlockRef DtTeams = new(SuiteId.TicketHelpers, null, "DT_TEAMS");
    public static readonly BlockRef NoteTemplates = new(SuiteId.Toolbar, "SERVICENOW TICKET HISTORY", "NOTE_TEMPLATES");
    public static readonly BlockRef MfCodeMap = new(SuiteId.Toolbar, "TICKET ASSIGNMENT TOOL", "MF_CODE_MAP");

    public static readonly IReadOnlyList<BlockRef> All = new[]
    {
        SdTeams, ResponseTeams, Geos, PolicyTypes, DlpPolicyTypes, AppliesTo, PolicyChannelTypes, DlpCriteria,
        MfOptions, ProductOptions, TenantGroups, DtTeams, NoteTemplates, MfCodeMap
    };

    /// <summary>User facing tool name of the section a block belongs to.</summary>
    public static string ToolName(BlockRef b) => b.Section switch
    {
        Sd => "Short Description Helper",
        Resp => "Ticket Response Helper",
        Pn => "Policy Naming Helper",
        Ts => "Ticket Subject Helper",
        "SERVICENOW TICKET HISTORY" => "Change Tracker",
        "TICKET ASSIGNMENT TOOL" => "Ticket Assignment Tool",
        null => "Teams",
        _ => b.Section
    };
}
