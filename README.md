# Tampermonkey Scripts

A collection of Tampermonkey userscripts that extend and automate workflows in ServiceNow and Netskope.

Scripts are split into two categories: standalone scripts that run independently on their target pages, and toolbar scripts that attach to a shared floating toolbar.

---

## Ticket Helpers Suite

`ServiceNowShortDescriptionHelper.user.js` is the **Ticket Helpers Suite** (it appears in Tampermonkey as "|| Ticket Helpers ||", called "Short Description Helper" before version 4.2.0): one script with every ticket helper. Each helper only runs on its own pages, and you choose which ones you want.

| Helper | Pages | Description |
|---|---|---|
| Short Description Builder | ServiceNow tickets | Builds and updates the short description in the team format, with tenant detection. |
| Response Templates | ServiceNow tickets and SCTASKs | Inserts team response templates, with @mentions, pinned and custom responses. |
| Formatted Text Editor | ServiceNow tickets | Rich text editor for comments and work notes. |
| SLA Alert Banner | ServiceNow tickets | Colored banner when the SLA due date is close. |
| Policy Name Builder | Netskope tenant | Builds policy names in the team format, with presets. |
| Support Case Subject Builder | Netskope support portal | Builds the subject line of Netskope support cases. |

The **⚙ Suite** button next to Help in every helper (and **⚙ Ticket Helpers settings** in the Tampermonkey menu) opens the shared settings: tools, team, tenant URLs and backups.

### Config Editor (Windows app)

**Config Editor** is a Windows app that lets anyone change the texts and option lists of both suites without touching code: Short Description options, Ticket Response texts, Policy Naming lists, Ticket Subject options, Change Tracker note texts and member firm codes. It replaced the old Python editors.

**Get it:** download `ConfigEditor.exe` from the latest `config-editor-v*` release on the [Releases page](https://github.com/DTStackDevSC/Tampermonkey-Scripts/releases). No install is needed. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.

**Use it:**

1. Open the app. It downloads the current scripts from GitHub on start (or open a local copy with **Open folder**).
2. Pick a section on the left and edit. Every change is checked before it is saved.
3. Click **Save**. The app bumps the script version and adds a changelog entry for you.
4. Upload the saved `.user.js` files on GitHub (the app shows the steps and opens the right page). Tampermonkey then updates everyone.

The **? Help** button at the top right opens a visual guide to the window, every section and the save steps.

**Optional, publish from the app:** in **Settings** turn on publishing and paste a fine grained GitHub token with *Contents: Read and write* on this repository only. **Publish** then commits the change for you under your own GitHub account, using your private noreply email.

The app is built from the `Config Editor/` folder (C# WPF, .NET 10) by the `config-editor.yml` workflow.

---

## Toolbar Scripts

`Toolbar-Suite.user.js` is the **Toolbox Suite**: one script with the floating toolbar and every toolbar tool. Each tool only appears on the pages it supports.

| Tool | Pages | Description |
|---|---|---|
| General Web Toolkit | All pages | Small helpers for any website. Today: highlight a RITM, PER or Netskope case number to open it in a new tab. |
| Domain Checker | ServiceNow | Extract domains from ticket text and check their reputation. |
| Enhancement Request Launcher | ServiceNow | Opens a pre filled enhancement request form for the current RITM. |
| Ticket Summary Panel | ServiceNow | Shows the key fields of the current ticket at a glance. |
| List Highlighter | ServiceNow | Highlights list rows by who updated them, with SLA heat mapping. |
| Change Tracker | ServiceNow | Shared change log per ticket, kept in your team's SharePoint list and written to work notes and comments. |
| ServiceNow Toolkit | ServiceNow | Draft autosave for work notes and comments, SCTASK auto open. |
| Ticket Assignment | ServiceNow | Assigns tickets and fills the related fields in one step. |
| Destination Profile Editor | ServiceNow | Finds, creates, edits and deletes Netskope Destination Profiles from a ticket through the API. |
| Netskope Console Toolkit | Netskope tenant | Copy and open buttons, log entries, steering exception tools and more. |

## Old scripts

The separate scripts used before the two suites (the old toolbar tools, the old helpers and their redirect files) have been retired and are no longer in this repository. Only `Toolbar-Suite.user.js` and `ServiceNowShortDescriptionHelper.user.js` are published and updated.

If Tampermonkey still lists an old script (for example one showing version 99.0.x), open ServiceNow and Netskope once with the suite installed so it can bring that script's data in when it asks, then uninstall the old script. An old script no longer gets updates.

**New users:** install only the Toolbox Suite. Each tool's first setup offers **Import from a backup file** if you have one.

**Moving to another computer:** open the toolbar Settings, under Data click **Export everything**. On the new computer install the Toolbox Suite and use **Import everything**. The backup file contains your tokens, so keep it safe.
