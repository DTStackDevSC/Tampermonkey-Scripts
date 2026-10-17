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

`Toolbar-Suite.user.js` is the **Tools Toolbar**: one script with the floating toolbar and every toolbar tool. Each tool only appears on the pages it supports.

| Tool | Pages | Description |
|---|---|---|
| General Toolkit | All pages | Highlight a RITM, PER or Netskope case number to open it in a new tab. |
| Domain Tools | ServiceNow | Extract domains from ticket text and check their reputation. |
| Enhancement Request Logger | ServiceNow | Opens a pre filled enhancement request form for the current RITM. |
| Mini Summary Sidebar | ServiceNow | Shows the key fields of the current ticket at a glance. |
| Row Highlighter | ServiceNow | Highlights list rows by who updated them, with SLA heat mapping. |
| Change Tracker | ServiceNow | Shared change log per ticket, written to work notes and comments. |
| ServiceNow Toolkit | ServiceNow | Draft autosave for work notes and comments, SCTASK auto open. |
| Ticket Assignment | ServiceNow | Assigns tickets and fills the related fields in one step. |
| URL List Editor | ServiceNow | Creates and updates Netskope URL lists through the API. |
| Policy Deletion Reminder | Netskope tenant | Registers a reminder to delete a temporary policy. |
| NS Policies Toolkit | Netskope tenant | Copy and open buttons, log entries, steering exception tools and more. |

The old `Toolbar-*.user.js` files are kept only so existing installs can hand their saved data to the Tools Toolbar.

## Moving to the Tools Toolbar

All toolbar tools now live inside one script, the **Tools Toolbar**. Your old toolbar scripts update by themselves and hand their saved data to it.

**If you have the Toolbar and some toolbar tools installed**
1. Do nothing: Tampermonkey updates the scripts by itself (or use "Check for userscript updates" in the Tampermonkey menu).
2. Open ServiceNow. When asked "Bring your data into the toolbar", click **Import**, then **Reload now**.
3. Open a Netskope tenant page and do the same.
4. When the toolbar lists old scripts you can uninstall, uninstall them in Tampermonkey.

Do not uninstall the old scripts before importing: their saved data is deleted with them.

**If you only have some toolbar tools, without the Toolbar:** a message tells you to install the Tools Toolbar. Install it from the script installer page, then follow steps 2 to 4.

**New users:** install only the Tools Toolbar. Each tool's first setup offers **Import from a backup file** if you have one.

**Moving to another computer:** open the toolbar Settings, under Data click **Export everything**. On the new computer install the Tools Toolbar and use **Import everything**. The backup file contains your tokens, so keep it safe.
