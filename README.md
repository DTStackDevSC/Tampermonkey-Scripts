# Tampermonkey Scripts

A collection of Tampermonkey userscripts that extend and automate workflows in ServiceNow and Netskope.

Scripts are split into two categories: standalone scripts that run independently on their target pages, and toolbar scripts that attach to a shared floating toolbar.

---

## Standalone Scripts

| Script | Description |
|---|---|
| `ServiceNowTicketResponseHelper.js` | Dropdown of configurable response templates for populating ticket comment and work note fields. |
| `ServiceNowShortDescriptionHelper.js` | Form-based generator for standardised short description fields with team-specific presets. |
| `ServiceNowFormattedTextHelper.js` | Rich text formatting helper for ServiceNow comment and journal fields. |
| `ServiceNowSLAAlertBanner.js` | Injects a visible alert banner on tickets when an SLA breach is approaching. |
| `NetskopePolicyNameHelper.js` | Standardised policy name builder with support for saving custom presets. |
| `NetskopeTicketSubjectHelper.js` | Generates standardised subject lines for Netskope tickets. |

### Configuration Editors

The `Helpers/` subfolder contains PyQt5-based GUI editors for modifying the team configuration blocks inside three of the scripts above, without editing JavaScript directly:

- `ServiceNowTicketResponseHelper_Editor.py`
- `ServiceNowShortDescriptionHelper_Editor.py`
- `NetskopePolicyNameHelper_Editor.py`

---

## Toolbar Scripts

`Toolbar.js` is the core script that renders a floating toolbar on ServiceNow and Netskope pages. Each of the following scripts registers a tool button into that toolbar:

| Script | Description |
|---|---|
| `Toolbar-MiniSummarySidebar.js` | Sidebar that extracts and displays key ticket field values in a compact view. |
| `Toolbar-ServiceNowToolkit.js` | Collection of common ServiceNow actions accessible from the toolbar. |
| `Toolbar-ServiceNowRowHighlighter.js` | Highlights ticket list rows based on configurable criteria. |
| `Toolbar-ServiceNowTicketHistory_Online.js` | Displays a change audit log for the current ticket. |
| `Toolbar-TicketAssignmentTool.js` | Streamlines ticket assignment with quick-select options. |
| `Toolbar-EnhancementRequestLogger.js` | Logs enhancement requests directly from the ticket view. |
| `Toolbar-NetskopePolicyToolkit.js` | Toolkit for common Netskope policy actions. |
| `Toolbar-NetskopePolicyDeletionScheduler.js` | Schedules Netskope policy deletions with configurable timing. |
| `Toolbar-DomainExtractor.js` | Extracts domain names from ticket fields for quick reference. |
| `Toolbar-DomainSecurityCheck.js` | Runs a security lookup on domains found in the current ticket. |
| `Toolbar-DomainTools.js` | General domain lookup and utility tools. |
| `Toolbar-URLListEditor.js` | Editor for managing lists of URLs stored in script configuration. |
| `Toolbar-GeneralToolkit.js` | Miscellaneous utility tools for general ticket workflow tasks. |
