# Tampermonkey Scripts

A collection of Tampermonkey userscripts that extend and automate workflows in ServiceNow and Netskope.

Scripts are split into two categories: standalone scripts that run independently on their target pages, and toolbar scripts that attach to a shared floating toolbar.

---

## Ticket Helpers Suite

`ServiceNowShortDescriptionHelper.user.js` is the **Ticket Helpers Suite** (it appears in Tampermonkey as "|| Ticket Helpers ||", called "Short Description Helper" before version 4.2.0): one script with every ticket helper. Each helper only runs on its own pages, and you choose which ones you want.

| Helper | Pages | Description |
|---|---|---|
| Short Description Helper | ServiceNow tickets | Builds and updates the short description in the team format, with tenant detection. |
| Ticket Response Helper | ServiceNow tickets and SCTASKs | Inserts team response templates, with @mentions, pinned and custom responses. |
| Formatted Text Helper | ServiceNow tickets | Rich text editor for comments and work notes. |
| SLA Alert Banner | ServiceNow tickets | Colored banner when the SLA due date is close. |
| Policy Naming Helper | Netskope tenant | Builds policy names in the team format, with presets. |
| Ticket Subject Helper | Netskope support portal | Builds the subject line of Netskope support cases. |

The **⚙ Suite** button next to Help in every helper (and **⚙ Ticket Helpers settings** in the Tampermonkey menu) opens the shared settings: tools, team, tenant URLs and backups. The other script files are kept only so existing installs can hand their saved data to the suite.

## Moving to the Ticket Helpers Suite

**If you have || Ticket Helpers || (or the Short Description Helper) installed**
1. Let Tampermonkey update it (or use "Check for userscript updates"). Tampermonkey may open a tab to confirm the update, because the script now also runs on Netskope pages: click **Update**. Do the same for the other helper scripts if tabs open for them.
2. Open a ServiceNow ticket. When asked "Bring your data into Ticket Helpers", click **Import**, then **Reload now**. Then tick your helpers in "Choose your tools" and click **Save**.
3. If you used the Policy Naming Helper, open a Netskope tenant; if you used the Ticket Subject Helper, open the Netskope support portal. Import there too.
4. When everything works, uninstall the old helper scripts that show version 99.0.0 or 99.0.1.

Do not uninstall the old scripts before importing: their saved data is deleted with them.

**If you did not have the Short Description Helper:** install || Ticket Helpers || from the script installer page (card "Ticket Helpers Suite"), then follow steps 2 to 4.

### Configuration Editors

The `Helpers/` subfolder contains PyQt5-based GUI editors for modifying the team configuration blocks inside three of the scripts above, without editing JavaScript directly:

- `ServiceNowTicketResponseHelper_Editor.py`
- `ServiceNowShortDescriptionHelper_Editor.py`
- `NetskopePolicyNameHelper_Editor.py`

These editors were written for the separate scripts. They will be updated to work on the Ticket Helpers Suite file; until then, edit the team blocks in the suite by hand.

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
| Change Tracker | ServiceNow | Shared change log per ticket, kept in your team's SharePoint list and written to work notes and comments. |
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
