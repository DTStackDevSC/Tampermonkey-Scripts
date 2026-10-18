// ==UserScript==
// @name         Ticket Helpers Suite (preview)
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/TicketHelpersSuite.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/TicketHelpersSuite.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      0.4.0
// @description  Preview of the Ticket Helpers Suite: Short Description, Ticket Response, Formatted Text, SLA Alert Banner, Policy Naming and Ticket Subject helpers in one install
// @author       J.R.
// @match        https://*.service-now.com/*
// @match        https://*.goskope.com/*
// @match        https://*.netskope.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '0.4.0';
    const CHANGELOG = `Version 0.4.0:
- Preview: adds the SLA Alert Banner.

Version 0.3.0:
- Preview: adds the Formatted Text Helper.

Version 0.2.0:
- Preview: adds the Ticket Response Helper. It uses the team chosen for the Short Description Helper.

Version 0.1.0:
- Preview of the Ticket Helpers Suite with the Short Description Helper, the tool picker and the shared settings window.`;

    /* ==========================================================
     *  DARK MODE ISOLATION
     *  Dialogs and the ⚙ Suite window live in a closed shadow root, so page styles cannot
     *  reach them. Tools keep their own style blocks inside their sections.
     * ==========================================================*/

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        .th-suite-pill { color: #555555 !important; background-color: transparent !important; }
        /* tool modal IDs appended below */
    `;

    /* ==========================================================
     *  SUITE CORE AND DATA TRANSFER
     * ==========================================================*/

    // The page may not have a <head> yet when a style is added.
    function appendStyleWhenReady(styleEl) {
        const parent = document.head || document.documentElement;
        if (parent) parent.appendChild(styleEl);
        else setTimeout(() => appendStyleWhenReady(styleEl), 10);
    }

    /* ==========================================================
     *  DATA TRANSFER
     *  Moves tool data between the suite, the old separate tool
     *  scripts and backup files.
     * ==========================================================*/

    // Which tool owns each stored key. The suite entry is listed first so its exact keys win.
    // pages are the @match rules of each tool's old separate script: it only runs there.
    const DATA_REGISTRY = [
        { id: 'suite', name: 'Ticket Helpers', site: 'all', script: 'Short Description Helper',
          pages: ['https://*.service-now.com/*', 'https://*.goskope.com/*', 'https://*.netskope.com/*'],
          exact: ['shortDescTeam'], prefixes: ['ticketHelpers', 'tenantURL_'] },
        { id: 'shortDescription', name: 'Short Description Helper', site: 'servicenow', script: 'Short Description Helper',
          description: 'Build and update the short description in the team format',
          pages: ['https://*.service-now.com/sc_req_item.do*', 'https://*.service-now.com/incident.do*'],
          exact: [], prefixes: ['shortDesc'], setupKeys: ['shortDescTeam'] },
        { id: 'ticketResponse', name: 'Ticket Response Helper', site: 'servicenow', script: 'Ticket Response Helper',
          description: 'Insert team response templates with @mentions',
          pages: ['https://*.service-now.com/sc_req_item.do*', 'https://*.service-now.com/incident.do*', 'https://*.service-now.com/sc_task.do*'],
          exact: [], prefixes: ['ticketResponse'], setupKeys: ['ticketResponseCustomResponses', 'ticketResponsePinned', 'ticketResponseFooterText'] },
        { id: 'formattedText', name: 'Formatted Text Helper', site: 'servicenow', script: 'Formatted Text Helper',
          description: 'Rich text editor for comments and work notes',
          pages: ['https://*.service-now.com/sc_req_item.do*', 'https://*.service-now.com/incident.do*'],
          exact: [], prefixes: ['formattedTextHelper'] },
        { id: 'slaBanner', name: 'SLA Alert Banner', site: 'servicenow', script: 'ServiceNow SLA Alert Banner',
          description: 'Colored banner when the SLA due date is close',
          pages: ['https://*.service-now.com/sc_req_item.do*', 'https://*.service-now.com/incident.do*'],
          exact: [], prefixes: ['sla_banner_'], setupKeys: ['sla_banner_date_format'] },
        { id: 'policyNaming', name: 'Policy Naming Helper', site: 'netskope', script: 'Real-time Protection Policy Naming Helper',
          description: 'Build policy names in the team format, with presets',
          pages: ['https://*.goskope.com/*', 'https://*.netskope.com/*'],
          exact: ['netskopePresets'], prefixes: ['netskopeHelper'], setupKeys: ['netskopePresets'] },
        { id: 'ticketSubject', name: 'Ticket Subject Helper', site: 'support', script: 'Netskope Ticket Subject Helper',
          description: 'Subject line builder for Netskope support cases',
          pages: ['https://support.netskope.com/*'],
          exact: [], prefixes: ['nsTkt', 'nsTenant'] }
    ];
    const DT_SITE_LABELS = { servicenow: 'ServiceNow tickets', netskope: 'Netskope tenant', support: 'Netskope support', all: 'All' };
    const DT_TEAMS = [['emeaTeam', 'EMEA'], ['ameTeam', 'AME'], ['apacTeam', 'APAC']];
    const DT_TENANTS = [['EMA', 'tenantURL_EMA'], ['EU', 'tenantURL_EU'], ['CE', 'tenantURL_CE'], ['APAC', 'tenantURL_APA'], ['AME', 'tenantURL_AME']];
    const DT_TEAM_TOOLS = ['shortDescription', 'ticketResponse'];

    function dtCheckValues(tool, values) {
        if (tool.id === 'ticketResponse' && values.ticketResponseCustomResponses !== undefined) {
            let list = null;
            try { list = JSON.parse(values.ticketResponseCustomResponses); } catch (e) { /* not JSON */ }
            if (!Array.isArray(list)) return 'the custom responses are not in the expected format';
        }
        if (tool.id === 'policyNaming' && values.netskopePresets !== undefined) {
            let list = null;
            try { list = JSON.parse(values.netskopePresets); } catch (e) { /* not JSON */ }
            if (!Array.isArray(list)) return 'the presets are not in the expected format';
        }
        for (const [key, value] of Object.entries(values)) {
            if ((key.startsWith('nsTenant') || key.startsWith('tenantURL_')) && value && (typeof value !== 'string' || !/^[a-z0-9.\-/:]+$/i.test(value))) {
                return 'a tenant URL is not valid';
            }
        }
        return '';
    }

    // Copies the old scripts' team and tenant URLs into the shared keys, only where those are empty.
    // Returns a note for the user when the old team differs from the one already saved.
    function dtMapShared(values) {
        let note = '';
        if (values.ticketResponseTeam) {
            const current = GM_getValue('shortDescTeam', null);
            if (!current) GM_setValue('shortDescTeam', values.ticketResponseTeam);
            else if (current !== values.ticketResponseTeam) note = 'The Ticket Response Helper used another team. Your Short Description Helper team is kept: change it in ⚙ Suite if needed.';
        }
        const map = { nsTenantEMA: 'tenantURL_EMA', nsTenantEU: 'tenantURL_EU', nsTenantCE: 'tenantURL_CE', nsTenantAPA: 'tenantURL_APA', nsTenantAME: 'tenantURL_AME' };
        for (const [from, to] of Object.entries(map)) {
            if (values[from] && !GM_getValue(to, '')) GM_setValue(to, values[from]);
        }
        return note;
    }

    // Does a tool run? Each tool section asks this before doing anything.
    function isToolEnabled(id) {
        const choices = dtChoices();
        if (Object.prototype.hasOwnProperty.call(choices, id)) return choices[id] === true;
        if (DT_INSTALL_KIND !== 'upgrade') return false;
        if (id === 'shortDescription') return true;   // its file is the suite, so it was installed
        const detected = GM_getValue(DT_DETECTED_KEY, []);
        return Array.isArray(detected) && detected.includes(id);
    }

    function dtMigrationSite() {
        const host = location.hostname;
        if (host === 'deloitteglobal.service-now.com' || /\.service-now\.com$/.test(host)) return 'servicenow';
        if (host === 'support.netskope.com') return 'support';
        if (/\.goskope\.com$|\.netskope\.com$/.test(host)) return 'netskope';
        return null;
    }


    const DT_MIGRATED_KEY = 'ticketHelpersMigratedTools';
    const DT_DECLINED_KEY = 'ticketHelpersMigrationDeclined';
    const DT_PRIVATE_KEYS = [DT_MIGRATED_KEY, DT_DECLINED_KEY, 'ticketHelpersDetectedTools', 'ticketHelpersPickerLater'];
    // Version and "changelog seen" keys are written on every load, so they never count as data.
    const DT_META_RE = /(version|changelog[-_]?seen)$/i;

    function dtTool(id) { return DATA_REGISTRY.find(t => t.id === id) || null; }
    function dtOwns(tool, key) { return tool.exact.includes(key) || tool.prefixes.some(p => key.startsWith(p)); }
    function dtOwnerOf(key) { return DATA_REGISTRY.find(t => dtOwns(t, key)) || null; }
    function dtIsPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

    // Keeps only the keys the tool owns. Bookkeeping keys of the migration are never accepted.
    function dtFilterValues(tool, values) {
        const kept = {}, dropped = [];
        for (const [key, value] of Object.entries(values)) {
            if (dtOwns(tool, key) && !DT_PRIVATE_KEYS.includes(key)) kept[key] = value;
            else dropped.push(key);
        }
        return { values: kept, dropped };
    }

    // True when the user already set this tool up inside the suite.
    function dtSuiteHasData(tool) {
        return GM_listValues().some(key => {
            if (!dtOwns(tool, key) || DT_PRIVATE_KEYS.includes(key) || DT_META_RE.test(key)) return false;
            return !tool.setupKeys || tool.setupKeys.some(s => key === s || key.startsWith(s));
        });
    }

    // Everything the suite stores, grouped by owning tool.
    function dtCollectAll() {
        const tools = {};
        for (const key of GM_listValues()) {
            if (DT_PRIVATE_KEYS.includes(key)) continue;
            const tool = dtOwnerOf(key);
            if (!tool) continue;
            if (!tools[tool.id]) tools[tool.id] = { name: tool.name, values: {} };
            tools[tool.id].values[key] = GM_getValue(key);
        }
        return tools;
    }

    function dtBuildBackup() {
        return {
            format: 'ticket-helpers-backup',
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            suiteVersion: SCRIPT_VERSION,
            tools: dtCollectAll()
        };
    }

    function dtToday() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /* Tool activation: which tools run, and the Change Tracker beta code. */
    const DT_CHOICES_KEY      = 'ticketHelpersToolChoices';
    const DT_INSTALL_KIND_KEY = 'ticketHelpersInstallKind';
    const DT_DETECTED_KEY     = 'ticketHelpersDetectedTools';
    const DT_PICKER_LATER_KEY = 'ticketHelpersPickerLater';

    // Decided once, the first time the suite runs: 'upgrade' when it found saved data, 'new' when storage was empty.
    const DT_INSTALL_KIND = (() => {
        const saved = GM_getValue(DT_INSTALL_KIND_KEY, null);
        if (saved === 'upgrade' || saved === 'new') return saved;
        const kind = GM_listValues().length ? 'upgrade' : 'new';
        GM_setValue(DT_INSTALL_KIND_KEY, kind);
        return kind;
    })();

    function dtChoices() {
        const v = GM_getValue(DT_CHOICES_KEY, {});
        return dtIsPlainObject(v) ? v : {};
    }
    function dtSaveChoices(update) { GM_setValue(DT_CHOICES_KEY, Object.assign(dtChoices(), update)); }

    // Tampermonkey style @match test against this page, so every tool keeps the pages it had.
    function dtPageMatches(patterns) {
        const url = location.href;
        return patterns.some(p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(url));
    }
    function dtToolRunsHere(id) {
        const tool = dtTool(id);
        return !!tool && dtPageMatches(tool.pages);
    }

    // Kept from the moment the suite loads, before any page script can replace it.
    const dtAttachShadow = Element.prototype.attachShadow;

    // A small dialog above every other window. Lines are plain text or elements. It lives in a
    // closed shadow root and only reacts to real clicks, so page scripts can neither read,
    // change nor press it. Every button closes the dialog, then runs its onClick.
    function dtDialog(title, lines, buttons, onClosed) {
        document.getElementById('ticketHelpersDataHost')?.remove();
        const host = document.createElement('div');
        host.id = 'ticketHelpersDataHost';
        // Inline !important styles win over any page stylesheet, so the page cannot hide,
        // fade or move the dialog to trick the user into clicking it.
        const hostStyle = {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            'z-index': '2147483600', display: 'block', visibility: 'visible', opacity: '1',
            transform: 'none', filter: 'none', 'clip-path': 'none', 'pointer-events': 'auto', margin: '0'
        };
        for (const [prop, value] of Object.entries(hostStyle)) host.style.setProperty(prop, value, 'important');
        const root = dtAttachShadow.call(host, { mode: 'closed' });
        // Buttons only work after a short moment, so a click aimed at something else cannot land on them.
        const readyAt = Date.now() + 600;

        const overlay = document.createElement('div');
        overlay.id = 'ticketHelpersDataModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '2147483600'
        });

        const modal = document.createElement('div');
        modal.id = 'ticketHelpersDataModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '2147483601', background: '#fff', border: '2px solid #333', borderRadius: '10px',
            padding: '20px', width: '460px', maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto',
            boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', color: '#333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', textAlign: 'left'
        });

        const heading = document.createElement('div');
        heading.textContent = title;
        Object.assign(heading.style, {
            fontWeight: 'bold', fontSize: '16px', marginBottom: '12px',
            paddingBottom: '10px', borderBottom: '2px solid #667eea'
        });
        modal.appendChild(heading);

        for (const line of lines) {
            if (line instanceof Node) { modal.appendChild(line); continue; }
            const p = document.createElement('div');
            p.textContent = line;
            Object.assign(p.style, { fontSize: '13px', lineHeight: '1.5', margin: '0 0 8px 0' });
            modal.appendChild(p);
        }

        const close = () => host.remove();
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' });
        for (const b of buttons) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = b.label;
            btn.dataset.dtButton = b.label;
            Object.assign(btn.style, {
                padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
                fontSize: '13px', fontFamily: 'Arial, sans-serif',
                border: b.primary ? 'none' : '1px solid #ccc',
                background: b.primary ? '#667eea' : '#fff', color: b.primary ? '#fff' : '#333'
            });
            btn.onclick = async (e) => {
                if (!e.isTrusted || Date.now() < readyAt) return;
                if (b.check && !(await b.check())) return;   // stays open, the check shows why
                close();
                if (b.onClick) b.onClick();
                if (onClosed) onClosed();
            };
            row.appendChild(btn);
        }
        modal.appendChild(row);

        overlay.onclick = (e) => { if (!e.isTrusted) return; close(); if (onClosed) onClosed(); };
        root.appendChild(overlay);
        root.appendChild(modal);
        document.body.appendChild(host);
        return close;
    }

    function dtDownload(fileName, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function dtPickFile(onText) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onText(String(reader.result));
            reader.readAsText(file);
        };
        input.click();
    }

    // Reads a backup file. Throws an Error with a message for the user when it is not one.
    function dtParseBackup(text) {
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error('This file is not a valid backup file.'); }
        if (!dtIsPlainObject(data) || data.format !== 'ticket-helpers-backup' || data.formatVersion !== 1 || !dtIsPlainObject(data.tools)) {
            throw new Error('This file is not a Ticket Helpers backup.');
        }
        const tools = [], skipped = [];
        for (const [id, entry] of Object.entries(data.tools)) {
            const tool = dtTool(id);
            if (!tool || !dtIsPlainObject(entry) || !dtIsPlainObject(entry.values)) { skipped.push(id); continue; }
            const { values, dropped } = dtFilterValues(tool, entry.values);
            const problem = dtCheckValues(tool, values);
            if (problem) { skipped.push(`${tool.name} (${problem})`); continue; }
            tools.push({ tool, values, dropped });
        }
        return { tools, skipped };
    }

    // Writes each entry and reports the result. Returns the ids that were written and that failed.
    function dtApply(entries, title, options) {
        const doneIds = [], failedIds = [];
        for (const entry of entries) {
            try {
                for (const [key, value] of Object.entries(entry.values)) GM_setValue(key, value);
                doneIds.push(entry.tool.id);
            } catch (e) {
                failedIds.push(entry.tool.id);
            }
        }
        const names = ids => ids.map(id => dtTool(id).name).join(', ');
        const lines = [];
        // Team and tenant URLs of the old scripts go to the shared settings when those are empty.
        const sharedNote = entries.filter(e => doneIds.includes(e.tool.id)).map(e => dtMapShared(e.values)).filter(Boolean)[0] || '';
        if (doneIds.length) lines.push('Imported: ' + names(doneIds) + '.');
        if (failedIds.length) lines.push('Could not import: ' + names(failedIds) + '. Try again later.');
        if (sharedNote) lines.push(sharedNote);
        if (doneIds.length) lines.push('Reload the page to apply it.');
        if (doneIds.length && options && options.uninstallHint) {
            lines.push('You can now uninstall these old scripts in Tampermonkey: ' +
                doneIds.map(id => dtTool(id).script).join(', ') + '.');
        }
        dtDialog(title, lines, doneIds.length
            ? [{ label: 'Reload now', primary: true, onClick: () => location.reload() }, { label: 'Close' }]
            : [{ label: 'Close', primary: true }]);
        return { done: doneIds, failed: failedIds };
    }

    function dtImportEverything() {
        dtPickFile(text => {
            let parsed;
            try { parsed = dtParseBackup(text); }
            catch (e) { dtDialog('Import everything', [e.message], [{ label: 'Close', primary: true }]); return; }
            const usable = parsed.tools.filter(e => Object.keys(e.values).length);
            if (!usable.length) {
                dtDialog('Import everything', ['This backup has no data for Ticket Helpers.'], [{ label: 'Close', primary: true }]);
                return;
            }
            const lines = ['This backup contains:'];
            for (const e of usable) lines.push(e.tool.name + (dtSuiteHasData(e.tool) ? ' (will be replaced)' : ''));
            if (parsed.skipped.length) lines.push('Skipped, not part of Ticket Helpers: ' + parsed.skipped.join(', '));
            dtDialog('Import everything', lines, [
                { label: 'Import', primary: true, onClick: () => dtApply(usable, 'Import everything') },
                { label: 'Cancel' }
            ]);
        });
    }

    // Link for a tool's first setup: restores only this tool from a backup file.
    function createBackupImportLink(toolId) {
        const tool = dtTool(toolId);
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'dt-backup-import-link';
        link.dataset.toolId = toolId;
        link.textContent = '⤒ Import from a backup file';
        link.title = 'Restore this tool from a Ticket Helpers backup file';
        Object.assign(link.style, {
            display: 'block', width: '100%', margin: '0 0 12px 0', padding: '7px 14px',
            background: 'none', border: '1px dashed #aaa', borderRadius: '6px', color: '#555',
            fontSize: '12px', fontFamily: 'Arial, sans-serif', cursor: 'pointer',
            textAlign: 'center', boxSizing: 'border-box'
        });
        link.onmouseover = () => { link.style.borderColor = '#667eea'; link.style.color = '#667eea'; };
        link.onmouseout  = () => { link.style.borderColor = '#aaa'; link.style.color = '#555'; };
        link.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dtPickFile(text => {
                let parsed;
                try { parsed = dtParseBackup(text); }
                catch (err) { dtDialog('Import ' + tool.name, [err.message], [{ label: 'Close', primary: true }]); return; }
                const entry = parsed.tools.find(x => x.tool.id === toolId && Object.keys(x.values).length);
                if (!entry) {
                    dtDialog('Import ' + tool.name, [`This backup has no ${tool.name} data.`], [{ label: 'Close', primary: true }]);
                    return;
                }
                dtApply([entry], 'Import ' + tool.name);
            });
        };
        return link;
    }

    const DT_WAIT_MS = 2000;
    const DT_START_DELAY_MS = 2000;

    function dtMigrated() {
        const v = GM_getValue(DT_MIGRATED_KEY, []);
        return Array.isArray(v) ? v : [];
    }
    function dtMarkMigrated(ids) {
        if (ids.length) GM_setValue(DT_MIGRATED_KEY, [...new Set([...dtMigrated(), ...ids])]);
    }

    // Asks the old separate scripts on this page for their data and calls done(answers)
    // after DT_WAIT_MS. Only answers to this request, from known tools, are kept, and only
    // with the keys that tool owns.
    function dtRequestOldData(done) {
        const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const answers = new Map();
        const payloads = new Map();
        // Each old script answers once. Two different answers for one tool mean something
        // else on the page is answering too, so that tool is not trusted. Answers whose data
        // does not have the expected shape are not trusted either.
        const conflicts = new Set();
        const onAnswer = (e) => {
            const d = e.detail;
            if (!d || d.requestId !== requestId || d.protocol !== 1 || typeof d.payload !== 'string') return;
            const tool = dtTool(d.toolId);
            if (!tool || tool.id === 'suite') return;
            if (payloads.has(tool.id)) {
                if (payloads.get(tool.id) !== d.payload) conflicts.add(tool.id);
                return;
            }
            payloads.set(tool.id, d.payload);
            let values;
            try { values = JSON.parse(d.payload); } catch (err) { return; }
            if (!dtIsPlainObject(values)) return;
            const filtered = dtFilterValues(tool, values);
            if (dtCheckValues(tool, filtered.values)) { conflicts.add(tool.id); return; }
            answers.set(tool.id, { tool, ...filtered });
        };
        document.addEventListener('ticketHelpersDataResponse', onAnswer);
        document.dispatchEvent(new CustomEvent('ticketHelpersDataRequest', { detail: { requestId } }));
        setTimeout(() => {
            document.removeEventListener('ticketHelpersDataResponse', onAnswer);
            done([...answers.values()].filter(a => !conflicts.has(a.tool.id)), [...conflicts].map(id => dtTool(id).name));
        }, DT_WAIT_MS);
    }

    function dtRunMigration(manual) {
        if (!dtMigrationSite()) {
            if (manual) dtDialog('Import from old scripts', ['Open a ServiceNow page or a Netskope tenant page, then try again from there.'], [{ label: 'Close', primary: true }]);
            return;
        }
        if (!manual && GM_getValue(DT_DECLINED_KEY, '') === dtToday()) { dtSettle(); dtMaybeShowPicker(); return; }
        dtRequestOldData((answers, conflicts) => {
            dtMarkDetected(answers.map(a => a.tool.id));
            const migrated = dtMigrated();
            const fresh = manual ? answers : answers.filter(a => !migrated.includes(a.tool.id));
            const hasValues = a => Object.keys(a.values).length > 0;
            const empty = fresh.filter(a => !hasValues(a));
            // Automatic runs never replace what the user set up in the suite. From ⚙ Suite,
            // the user may choose to replace it, and the prompt says so.
            const kept  = manual ? [] : fresh.filter(a => hasValues(a) && dtSuiteHasData(a.tool));
            const todo  = fresh.filter(a => hasValues(a) && (manual || !dtSuiteHasData(a.tool)));
            dtMarkMigrated([...empty, ...kept].map(a => a.tool.id));

            if (!todo.length) {
                dtSettle();
                if (conflicts.length) {
                    dtDialog('Import from old scripts', ['Not imported, because the data received did not look right: ' +
                        conflicts.join(', ') + '. Use a backup file instead.'], [{ label: 'Close', primary: true }]);
                } else if (!manual) {
                    dtMaybeShowPicker();
                } else {
                    dtDialog('Import from old scripts', [
                        fresh.length
                            ? 'Nothing to import: the old scripts on this page have no new data for Ticket Helpers.'
                            : 'No old scripts answered on this page. Open a ServiceNow ticket, a Netskope tenant or the Netskope support portal where they ran, then try again.'
                    ], [{ label: 'Close', primary: true }]);
                }
                return;
            }

            const lines = ['Data found from your previous scripts:'];
            for (const a of todo) lines.push('• ' + a.tool.name +
                (manual && dtSuiteHasData(a.tool) ? ' (replaces what you set up in Ticket Helpers)' : ''));
                        if (conflicts.length) lines.push('Not imported, because the data received did not look right: ' + conflicts.join(', ') + '.');
            const savedTeam = GM_getValue('shortDescTeam', '');
            if (todo.some(a => a.values.ticketResponseTeam && savedTeam && a.values.ticketResponseTeam !== savedTeam)) {
                lines.push('Team: your Ticket Response Helper used another team. The Short Description Helper team is kept.');
            }
            if (kept.length) lines.push('Already set up in Ticket Helpers, left as they are: ' + kept.map(a => a.tool.name).join(', ') + '.');
            lines.push('Import it into Ticket Helpers?');
            dtDialog('Bring your data into Ticket Helpers', lines, [
                { label: 'Import', primary: true, onClick: () => {
                    const result = dtApply(todo, 'Bring your data into Ticket Helpers', { uninstallHint: true });
                    dtMarkMigrated(result.done);
                } },
                { label: 'Not now', onClick: () => { GM_setValue(DT_DECLINED_KEY, dtToday()); dtMaybeShowPicker(); } }
            ], dtSettle);
        });
    }

    // First setups that open by themselves wait until the old scripts had their chance to
    // hand over data on this page, then check again whether they are still needed.
    let dtSettled = false;
    const dtSettleWaiters = [];
    function dtSettle() {
        if (dtSettled) return;
        dtSettled = true;
        for (const fn of dtSettleWaiters.splice(0)) {
            try { fn(); } catch (e) { console.error('Ticket Helpers first setup:', e); }
        }
    }
    function dtWhenMigrationSettled(fn) {
        if (dtSettled) fn(); else dtSettleWaiters.push(fn);
    }

    // Started once per page load on ServiceNow and Netskope tenant pages, while some tool
    // of that site is not migrated yet.
    function dtAutoMigrate() {
        const site = dtMigrationSite();
        if (!site) { dtSettle(); return; }
        const migrated = dtMigrated();
        const pending = DATA_REGISTRY.some(t => t.id !== 'suite' && t.site === site && !migrated.includes(t.id));
        if (!pending) { dtSettle(); setTimeout(dtMaybeShowPicker, DT_START_DELAY_MS); return; }
        setTimeout(() => dtRunMigration(false), DT_START_DELAY_MS);
    }


    // A checkbox list of tools grouped by site. Used by the picker and by Settings > Tools.
    function dtBuildToolList(ids, ticked) {
        const wrap = document.createElement('div');
        const boxes = new Map();
        for (const site of ['servicenow', 'netskope', 'support']) {
            const group = DATA_REGISTRY.filter(t => ids.includes(t.id) && t.site === site);
            if (!group.length) continue;
            const head = document.createElement('div');
            head.textContent = DT_SITE_LABELS[site];
            Object.assign(head.style, {
                fontSize: '10px', fontWeight: 'bold', color: '#888', letterSpacing: '.6px',
                textTransform: 'uppercase', margin: '10px 0 4px 0'
            });
            wrap.appendChild(head);
            for (const tool of group) {
                const row = document.createElement('label');
                Object.assign(row.style, {
                    display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0',
                    cursor: 'pointer', fontSize: '13px', lineHeight: '1.4', color: '#333'
                });
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = ticked.has(tool.id);
                cb.dataset.toolId = tool.id;
                cb.style.marginTop = '2px';
                const text = document.createElement('span');
                const name = document.createElement('strong');
                name.textContent = tool.name;
                text.appendChild(name);
                const desc = document.createElement('span');
                desc.textContent = ' ' + tool.description;
                desc.style.color = '#666';
                text.appendChild(desc);
                row.append(cb, text);
                wrap.appendChild(row);
                boxes.set(tool.id, cb);
            }
        }
        return {
            element: wrap,
            choices: () => {
                const c = {};
                boxes.forEach((cb, id) => { c[id] = cb.checked; });
                return c;
            }
        };
    }

    // Team radio buttons, used by the picker and the ⚙ Suite window.
    function dtTeamRow(name) {
        const row = document.createElement('div');
        const current = GM_getValue('shortDescTeam', '');
        for (const [value, label] of DT_TEAMS) {
            const l = document.createElement('label');
            Object.assign(l.style, { marginRight: '14px', fontSize: '13px', cursor: 'pointer', color: '#333' });
            const r = document.createElement('input');
            r.type = 'radio'; r.name = name; r.value = value; r.checked = current === value;
            l.append(r, document.createTextNode(' ' + label));
            row.appendChild(l);
        }
        row.picked = () => { const r = [...row.querySelectorAll('input')].find(x => x.checked); return r ? r.value : ''; };
        return row;
    }

    function dtShowToolPicker(ids, ticked) {
        const list = dtBuildToolList(ids, ticked);
        const lines = ['Pick the tools you want. You can change this any time with the ⚙ Suite button of any tool.', list.element];
        // Tools that use a team need one: ask for it here when none is saved yet.
        let teamRow = null, teamError = null;
        if (!GM_getValue('shortDescTeam', '') && ids.some(id => DT_TEAM_TOOLS.includes(id))) {
            const head = document.createElement('div');
            head.textContent = 'Your team (used by the Short Description and Ticket Response helpers):';
            Object.assign(head.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', margin: '10px 0 4px 0' });
            teamRow = dtTeamRow('th-picker-team');
            teamError = document.createElement('div');
            Object.assign(teamError.style, { color: '#c0392b', fontSize: '12px', marginTop: '3px' });
            lines.push(head, teamRow, teamError);
        }
        dtDialog('Choose your tools', lines, [
            { label: 'Later', onClick: () => { if (DT_INSTALL_KIND === 'upgrade') GM_setValue(DT_PICKER_LATER_KEY, dtToday()); } },
            { label: 'Save', primary: true,
              check: async () => {
                  const choices = list.choices();
                  if (teamRow && DT_TEAM_TOOLS.some(id => choices[id]) && !teamRow.picked()) {
                      teamError.textContent = 'Please choose your team.';
                      return false;
                  }
                  return true;
              },
              onClick: () => {
                  if (teamRow && teamRow.picked()) GM_setValue('shortDescTeam', teamRow.picked());
                  dtSaveChoices(list.choices());
                  location.reload();
              } }
        ]);
    }

    function dtMarkDetected(ids) {
        if (!ids.length) return;
        const current = GM_getValue(DT_DETECTED_KEY, []);
        GM_setValue(DT_DETECTED_KEY, [...new Set([...(Array.isArray(current) ? current : []), ...ids])]);
    }



    // Shows the picker on ServiceNow, Netskope tenant and support pages while tools there are undecided.
    function dtMaybeShowPicker() {
        const site = dtMigrationSite();
        if (!site || document.getElementById('ticketHelpersDataHost')) return;
        const choices = dtChoices();
        const all = DATA_REGISTRY.filter(t => t.id !== 'suite');
        if (DT_INSTALL_KIND === 'new') {
            if (Object.keys(choices).length) return;
            dtShowToolPicker(all.map(t => t.id), new Set(['shortDescription']));
            return;
        }
        if (GM_getValue(DT_PICKER_LATER_KEY, '') === dtToday()) return;
        const undecided = all.filter(t => t.site === site && !Object.prototype.hasOwnProperty.call(choices, t.id));
        if (!undecided.length) return;
        const detected = GM_getValue(DT_DETECTED_KEY, []);
        const ticked = new Set(undecided
            .filter(t => t.id === 'shortDescription' || (Array.isArray(detected) && detected.includes(t.id)) || dtSuiteHasData(t))
            .map(t => t.id));
        dtShowToolPicker(undecided.map(t => t.id), ticked);
    }

    // "⚙ Suite": the shared settings window. Opened from every tool header and the Tampermonkey menu.
    function dtShowSuiteWindow() {
        const ids = DATA_REGISTRY.filter(t => t.id !== 'suite').map(t => t.id);
        const list = dtBuildToolList(ids, new Set(ids.filter(isToolEnabled)));
        const section = (title) => { const h = document.createElement('div'); h.textContent = title;
            Object.assign(h.style, { fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '12px 0 6px 0', textTransform: 'uppercase', letterSpacing: '.5px' }); return h; };
        const teamRow = dtTeamRow('th-settings-team');
        const tenantRows = document.createElement('div');
        const tenantInputs = {};
        for (const [label, key] of DT_TENANTS) {
            const row = document.createElement('div');
            Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 5px 0' });
            const l = document.createElement('span'); l.textContent = label; Object.assign(l.style, { width: '50px', fontSize: '12px', fontWeight: 'bold' });
            const i = document.createElement('input'); i.type = 'text'; i.value = GM_getValue(key, ''); i.placeholder = 'tenant.goskope.com';
            Object.assign(i.style, { flex: '1', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', background: '#fff', color: '#333' });
            tenantInputs[key] = i;
            row.append(l, i);
            tenantRows.appendChild(row);
        }
        const dataRow = document.createElement('div');
        Object.assign(dataRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap' });
        [['Export everything', dtExportEverything], ['Import everything', dtImportEverything], ['Import from old scripts', () => dtRunMigration(true)]].forEach(([label, fn]) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
            Object.assign(b.style, { padding: '6px 10px', border: '1px solid #ccc', borderRadius: '5px', background: '#f3f4f6', color: '#333', cursor: 'pointer', fontSize: '12px' });
            b.onclick = (e) => { if (e.isTrusted) fn(); };
            dataRow.appendChild(b);
        });
        dtDialog('⚙ Ticket Helpers  v' + SCRIPT_VERSION, [
            section('Tools'), list.element,
            section('Team'), teamRow,
            section('Tenant URLs'), tenantRows,
            section('Data'), dataRow
        ], [
            { label: 'Cancel' },
            { label: 'Save', primary: true, onClick: () => {
                const before = JSON.stringify([dtChoices(), GM_getValue('shortDescTeam', '')]);
                dtSaveChoices(list.choices());
                if (teamRow.picked()) GM_setValue('shortDescTeam', teamRow.picked());
                for (const [key, input] of Object.entries(tenantInputs)) GM_setValue(key, input.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''));
                if (JSON.stringify([dtChoices(), GM_getValue('shortDescTeam', '')]) !== before) location.reload();
            } }
        ]);
    }

    // The "⚙ Suite" pill placed next to every tool's "? Help".
    function createSuitePill() {
        const pill = document.createElement('span');
        pill.textContent = '⚙ Suite';
        pill.className = 'th-suite-pill';
        pill.title = 'Ticket Helpers settings: tools, team, tenant URLs, backup';
        Object.assign(pill.style, {
            color: '#555', cursor: 'pointer', fontSize: '11px', display: 'inline-flex', alignItems: 'center',
            padding: '1px 6px', borderRadius: '3px', border: '1px solid #ccc', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', fontFamily: 'Arial, sans-serif', marginLeft: '4px'
        });
        pill.onmouseover = () => { pill.style.backgroundColor = '#f0f0f0'; };
        pill.onmouseout  = () => { pill.style.backgroundColor = 'transparent'; };
        pill.onclick = (e) => { e.preventDefault(); e.stopPropagation(); dtShowSuiteWindow(); };
        return pill;
    }

    // Fallback: always reachable, even when every tool is off.
    GM_registerMenuCommand('⚙ Ticket Helpers settings', dtShowSuiteWindow);

    function dtExportEverything() {
        dtDialog('Export everything', [
            'This saves the settings and data of Ticket Helpers and every tool into one file.',
            'Keep this file somewhere safe.'
        ], [
            { label: 'Export', primary: true, onClick: () => dtDownload(`ticket-helpers-backup-${dtToday()}.json`, dtBuildBackup()) },
            { label: 'Cancel' }
        ]);
    }
    appendStyleWhenReady(darkModeStyle);

    /* === TOOL: SHORT DESCRIPTION HELPER === */
    (() => {
        'use strict';
        // Turned off in ⚙ Suite, not chosen yet, or not meant for this page: this tool does nothing at all.
        if (!isToolEnabled('shortDescription') || !dtToolRunsHere('shortDescription')) return;


    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '3.3.7';
    const CHANGELOG = `Version 3.3.7:
- The Feature Guide is now visual: it shows the buttons, the panel with its fields, the searchable dropdown and the settings as they look on screen, with short notes. It also explains the Insert Default Short description button.

Version 3.3.6:
- The Feature Guide now explains the Detected Req. MF and Detected Territory lines shown in the panel.

Version 3.3.5:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 3.3.4:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 3.3.3:
- The "Detected Territory:" line is now hidden when no territory is found on the ticket form. It only appears when a territory is detected.

Version 3.3.2:
- Added a "Detected Territory:" line below the Requesting MF indicator. It reads the Territory field on the ticket form and shows the detected country or region.

Version 3.3.1:
- Tenant URL configuration moved into the Settings modal. A new "Tenant URLs" section with a "Configure Tenant URLs" button replaces the old link in the panel header.
- The "What's New" notification now appears directly to the right of the version number in the panel header.

Version 3.3.0:
- Added a dedicated Settings modal. The "Switch Team" control and the searchable dropdowns toggle have moved there, accessed via a new "Settings" button in the panel header.
- The panel header is reorganized: "Settings" and "Help" buttons now sit together at the top right, next to the team name. The version and tenant URL link remain on the row below.

Version 3.2.0:
- Added a "? Help" button in the panel header that opens a full Feature Guide. The guide covers all features: the short description format, panel fields, quick action buttons, auto-complexity, searchable dropdowns, tenant detection, and settings configuration.

Version 3.1.5:
- The team selection modal now has a blue top border and blue title to visually distinguish it from the Ticket Response Helper modal when both scripts are active at the same time.

Version 3.1.4:
- The loading screen shown when switching teams now displays an animated "Reloading page to select team" message with cycling dots.

Version 3.1.3:
- Fixed an issue where the URL setup and team selection modals would appear twice on page load.

Version 3.1.2:
- Saving tenant URLs in the setup and edit modals now applies immediately without reloading the page.

Version 3.1.1:
- Searchable dropdown trigger now shows a chevron arrow on the right side, matching
  the native dropdown style. The arrow rotates 180 degrees when the list is open and
  resets when it closes.

Version 3.1.0:
- All dropdowns now support live text filtering. Clicking any dropdown opens a search
  box with the cursor placed in it automatically. Use Arrow Up/Down to navigate the list
  and Enter to confirm a selection. Escape closes the dropdown without changing the value.
- Added a "Searchable dropdowns" toggle in the panel header to enable or disable the
  feature. The setting is on by default and persists across sessions.

Version 3.0.11:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 3.0.10:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 3.0.9:
- Update URL Changed
    
Version 3.0.8.1:
- Minor changes on fields
- Added Tenant field on Short Description`;

    /* ==========================================================
     *  TENANT MAPPING
     * ==========================================================*/

    const tenantMapping = {
        'Africa': 'EMA Tenant',
        //'Asia Pacific': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Australia': 'APAC Tenant',
        'Austria': 'EU Tenant',
        'Belgium': 'EU Tenant',
        'Brazil': 'AME Tenant',
        'Canada': 'AME Tenant',
        'Caribbean and Bermuda Countries': 'AME Tenant',
        'Central Europe': 'CE Tenant',
        'Central Mediterranean': 'EU Tenant',
        'Chile': 'EMA Tenant',
        //'China': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Cyprus': 'EU Tenant',
        'Denmark': 'EU Tenant',
        'DKU': 'EMA Tenant',
        'Finland': 'EU Tenant',
        'France': 'CE Tenant',
        'Germany': 'CE Tenant',
        //'Hong Kong': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Iceland': 'EU Tenant',
        'Ireland': 'EU Tenant',
        'Israel': 'EMA Tenant',
        'Japan': 'APAC Tenant',
        'Korea': 'APAC Tenant',
        'Luxembourg': 'EU Tenant',
        'Mauritius': 'APAC Tenant',
        'Mexico': 'EMA Tenant',
        'Middle East': 'EU Tenant',
        'Netherlands': 'EU Tenant',
        'New Zealand': 'APAC Tenant',
        'Nordics': 'EU Tenant',
        'North and South Europe': 'EU Tenant',
        'Norway': 'EU Tenant',
        'Portugal': 'CE Tenant',
        'S-LATAM': 'EMA Tenant',
        'South Asia(India)': 'APAC Tenant',
        'Southeast Asia': 'APAC Tenant',
        'Spain': 'EMA Tenant',
        'Sweden': 'EU Tenant',
        'Switzerland': 'EU Tenant',
        'Taiwan': 'APAC Tenant',
        'Touche Tohmatsu Limited': 'AME Tenant',
        'Turkey': 'CE Tenant',
        'United Kingdom': 'EU Tenant',
        'United States': 'AME Tenant',
    };

    /* ==========================================================
     *  TENANT URL KEYS & DEFAULTS
     * ==========================================================*/

    const TENANT_KEYS = [
        { key: 'tenantURL_EMA', label: 'EMA Tenant URL' },
        { key: 'tenantURL_EU',  label: 'EU Tenant URL'  },
        { key: 'tenantURL_CE',  label: 'CE Tenant URL'  },
        { key: 'tenantURL_APA', label: 'APA Tenant URL' },
        { key: 'tenantURL_AME', label: 'AME Tenant URL' },
    ];

    // Map from tenant name → GM storage key
    const TENANT_NAME_TO_KEY = {
        'EMA Tenant': 'tenantURL_EMA',
        'EU Tenant':  'tenantURL_EU',
        'CE Tenant':  'tenantURL_CE',
        'APAC Tenant': 'tenantURL_APA',
        'AME Tenant': 'tenantURL_AME',
    };

    function getTenantURLs() {
        const urls = {};
        for (const [tenantName, gmKey] of Object.entries(TENANT_NAME_TO_KEY)) {
            const stored = GM_getValue(gmKey, null);
            if (stored) urls[tenantName] = stored;
        }
        return urls;
    }

    function areTenantURLsConfigured() {
        return TENANT_KEYS.every(({ key }) => {
            const val = GM_getValue(key, null);
            return val && val.trim() !== '';
        });
    }

    function saveTenantURLs(urlMap) {
        for (const [gmKey, url] of Object.entries(urlMap)) {
            GM_setValue(gmKey, url.trim());
        }
    }

    /* ==========================================================
     *  TENANT URL SETUP MODAL
     * ==========================================================*/

    function showTenantURLSetup(onComplete) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '10000'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10001',
            background: '#fff',
            border: '2px solid #333',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            minWidth: '460px',
            maxWidth: '520px'
        });

        const title = document.createElement('h2');
        title.textContent = 'Configure Netskope Tenant URLs';
        Object.assign(title.style, { marginTop: '0', marginBottom: '6px', color: '#333' });
        modal.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Short Description Helper Script — First-time setup';
        Object.assign(subtitle.style, {
            margin: '0 0 14px 0',
            color: '#666', fontSize: '13px', fontStyle: 'italic'
        });
        modal.appendChild(subtitle);

        const note = document.createElement('div');
        Object.assign(note.style, {
            background: '#fff8e1',
            border: '1px solid #ffe082',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#5a4200',
            lineHeight: '1.5'
        });
        note.innerHTML = '📄 <strong>Where to find the tenant URLs:</strong> The Netskope tenant links for each region are listed in the <em>General Scripts User Guide</em> Word document.<br> Look for the section titled <strong>Required information & variables</strong>.';
        modal.appendChild(note);

        // Warning note
        const warning = document.createElement('div');
        Object.assign(warning.style, {
            background: '#fff0f0',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#c0392b',
            lineHeight: '1.5'
        });
        warning.innerHTML = '⚠️ <strong>Important:</strong> Enter the URLs <strong>exactly</strong> as they appear in the Word document. Do not add, remove, or modify any characters — including trailing slashes, subpaths, or query parameters.';
        modal.appendChild(warning);

        const inputs = {};

        for (const { key, label } of TENANT_KEYS) {
            const fieldWrapper = document.createElement('div');
            Object.assign(fieldWrapper.style, {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '10px'
            });

            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.setAttribute('for', `tenantSetup_${key}`);
            Object.assign(lbl.style, {
                width: '140px',
                fontWeight: 'bold',
                fontSize: '13px',
                color: '#333',
                flexShrink: '0'
            });

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = `tenantSetup_${key}`;
            inp.placeholder = 'https://...';
            inp.value = GM_getValue(key, '');
            Object.assign(inp.style, {
                flex: '1',
                padding: '7px 10px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
            });

            inp.addEventListener('input', () => {
                inp.style.borderColor = inp.value.trim() ? '#4CAF50' : '#e74c3c';
            });

            if (!inp.value.trim()) {
                inp.style.borderColor = '#ccc';
            } else {
                inp.style.borderColor = '#4CAF50';
            }

            inputs[key] = inp;
            fieldWrapper.appendChild(lbl);
            fieldWrapper.appendChild(inp);
            modal.appendChild(fieldWrapper);
        }

        const errorMsg = document.createElement('div');
        Object.assign(errorMsg.style, {
            color: '#e74c3c',
            fontSize: '13px',
            marginBottom: '10px',
            display: 'none'
        });
        errorMsg.textContent = '⚠ All fields are required. Please fill in every tenant URL.';
        modal.appendChild(errorMsg);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Continue';
        Object.assign(saveBtn.style, {
            width: '100%',
            padding: '12px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
            transition: 'background 0.2s ease'
        });
        saveBtn.onmouseover = () => { saveBtn.style.background = '#0056b3'; };
        saveBtn.onmouseout  = () => { saveBtn.style.background = '#007bff'; };

        saveBtn.onclick = () => {
            let allFilled = true;
            for (const { key } of TENANT_KEYS) {
                const val = inputs[key].value.trim();
                if (!val) {
                    inputs[key].style.borderColor = '#e74c3c';
                    allFilled = false;
                }
            }

            if (!allFilled) {
                errorMsg.style.display = 'block';
                return;
            }

            errorMsg.style.display = 'none';

            const urlMap = {};
            for (const { key } of TENANT_KEYS) {
                urlMap[key] = inputs[key].value.trim();
            }
            saveTenantURLs(urlMap);

            overlay.remove();
            modal.remove();

            if (onComplete) {
                onComplete();
            } else {
                showLoadingOverlay();
                setTimeout(() => location.reload(), 100);
            }
        };

        modal.appendChild(saveBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  TEAM CONFIGURATIONS
     * ==========================================================*/

    const TEAMS = {

        /// EMEA TEAM ///

        emeaTeam: {
            name: 'EMEA Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'Deloitte Africa - Africa', value: 'Africa' },
                { label: 'Deloitte Austria - AT', value: 'AT' },
                { label: 'Deloitte Belgium - BE', value: 'BE' },
                { label: 'Deloitte Central Europe - CE', value: 'CE' },
                { label: 'Deloitte Central Mediterranean - DCM', value: 'DCM' },
                { label: 'Deloitte Cyprus - DME', value: 'DME' },
                { label: 'Deloitte Denmark - DK', value: 'DK' },
                { label: 'Deloitte DKU - DKU', value: 'DKU' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' },
                { label: 'Deloitte Finland - FI', value: 'FI' },
                { label: 'Deloitte France - FR', value: 'FR' },
                { label: 'Deloitte Germany - DE', value: 'DE' },
                { label: 'Deloitte Iceland - IS', value: 'IS' },
                { label: 'Deloitte Ireland - IE', value: 'IE' },
                { label: 'Deloitte Luxembourg - LU', value: 'LU' },
                { label: 'Deloitte Middle East - DME', value: 'DME' },
                { label: 'Deloitte Netherlands - NL', value: 'NL' },
                { label: 'Deloitte Nordics - Nordics', value: 'Nordics' },
                { label: 'Deloitte North and South Europe - NSE', value: 'NSE' },
                { label: 'Deloitte Norway - NO', value: 'NO' },
                { label: 'Deloitte Portugal - PT', value: 'PT' },
                { label: 'Deloitte Spain - ES', value: 'ES' },
                { label: 'Deloitte Sweden - SE', value: 'SE' },
                { label: 'Deloitte Switzerland - CH', value: 'CH' },
                { label: 'Deloitte Turkey - TR', value: 'TR' },
                { label: 'Deloitte United Kingdom - UK', value: 'UK' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        },

        /// AME TEAM ///

        ameTeam: {
            name: 'AME Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' },
                { label: 'Deloitte US - US', value: 'US' },
                { label: 'Deloitte Canada - CA', value: 'CA' },
                { label: 'Deloitte Brazil - BR', value: 'BR' },
                { label: 'Deloitte Caribbean and Bermuda Countries - CBC', value: 'CBC' },
                { label: 'Deloitte SLATAM - SLATAM', value: 'SLATAM' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        },

        /// APAC TEAM ///

        apacTeam: {
            name: 'APAC Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'Deloitte South East Asia - SEA', value: 'SEA' },
                { label: 'Deloitte South Asia India - SA_IN', value: 'SA_IN' },
                { label: 'Deloitte South Asia Mauritius - SA_MU', value: 'SA_MU' },
                { label: 'Deloitte Japan - JP', value: 'JP' },
                { label: 'Deloitte Korea - KR', value: 'KR' },
                { label: 'Deloitte Taiwan - TW', value: 'TW' },
                { label: 'Deloitte Australia - AU', value: 'AU' },
                { label: 'Deloitte New Zealand - NZ', value: 'NZ' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        }
    };

    /* ==========================================================
     *  TENANT DETECTION FUNCTIONS
     * ==========================================================*/

    function detectTenant() {
        const inputs = document.querySelectorAll('input.form-control.element_reference_input');
        for (const input of inputs) {
            const value = input.value.trim();
            if (value.startsWith('Deloitte')) {
                const region = value.replace('Deloitte', '').trim();
                const tenant = tenantMapping[region];
                if (tenant) {
                    return tenant;
                }
            }
        }
        return 'Not Detected';
    }

    /* ==========================================================
     *  REQUESTING MEMBER FIRM DETECTION
     * ==========================================================*/

    function detectRequestingMF() {
        const allHiddenInputs = document.querySelectorAll('input[type="hidden"][id*="display_hidden"]');
        for (const input of allHiddenInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                return value;
            }
        }

        const referenceInputs = document.querySelectorAll('input.element_reference_input');
        for (const input of referenceInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                const labelId = input.getAttribute('aria-labelledby');
                if (labelId) {
                    const label = document.getElementById(labelId);
                    if (label && label.textContent.includes('Requesting Member Firm')) {
                        return value;
                    }
                }
                return value;
            }
        }

        const questionSetInputs = document.querySelectorAll('input.questionsetreference');
        for (const input of questionSetInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                return value;
            }
        }

        return 'Not Detected';
    }

    function updateRequestingMFDisplay() {
        const displayElement = document.getElementById('requestingMFDisplay');
        if (!displayElement) return;

        const requestingMF = detectRequestingMF();
        displayElement.textContent = `Detected Req. MF: ${requestingMF}`;
    }

    /* ==========================================================
     *  TERRITORY DETECTION
     * ==========================================================*/

    function detectTerritory() {
        const byId = document.getElementById('sys_display.ni.VEb5c3fb1b2b114358712bf8c2c891bf78');
        if (byId && byId.value.trim()) {
            return byId.value.trim();
        }

        const inputs = document.querySelectorAll('input.questionsetreference');
        for (const input of inputs) {
            const onfocus = input.getAttribute('onfocus') || '';
            if (onfocus.includes('core_country') && input.value.trim()) {
                return input.value.trim();
            }
        }

        return 'Not Detected';
    }

    function updateTerritoryDisplay() {
        const displayElement = document.getElementById('territoryDisplay');
        if (!displayElement) return;
        const territory = detectTerritory();
        if (territory === 'Not Detected') {
            displayElement.style.display = 'none';
        } else {
            displayElement.style.display = '';
            displayElement.textContent = `Detected Territory: ${territory}`;
        }
    }

    /* ==========================================================
     *  AUTO COMPLEXITY FUNCTIONS
     * ==========================================================*/

    function countAdditionalComments() {
        let count = 0;

        const typeLabels = document.querySelectorAll(
            '.sn-card-component-time > span:first-child'
        );

        for (const span of typeLabels) {
            if (span.textContent.trim() === 'Additional comments') {
                count++;
            }
        }

        return count;
    }

    function calculateAutoComplexity(count) {
        if (count <= 15) return '1';
        if (count <= 25) return '2';
        return '3';
    }

    /* ==========================================================
     *  FUNCTIONS
     * ==========================================================*/

    function getFormattedDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function getShortDescriptionInput() {
        return document.getElementById('sc_req_item.short_description') || document.getElementById('incident.short_description');
    }

    function getCurrentTeam() {
        const stored = GM_getValue('shortDescTeam', null);
        return stored && TEAMS[stored] ? stored : null;
    }

    function saveTeam(teamKey) {
        GM_setValue('shortDescTeam', teamKey);
    }

    function getStoredVersion() {
        return GM_getValue('shortDescVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('shortDescVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('shortDescChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('shortDescChangelogSeen', SCRIPT_VERSION);
    }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num2 > num1) return true;
            if (num2 < num1) return false;
        }
        return false;
    }

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    function showTeamSelector() {
        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'shortDescTeamSelector';
        Object.assign(selectorContainer.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10000',
            background: '#fff',
            border: '1px solid #ddd',
            borderTop: '4px solid #007bff',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            textAlign: 'center',
            minWidth: '400px'
        });

        const title = document.createElement('h2');
        title.textContent = 'Select Your Team';
        title.style.marginBottom = '8px';
        title.style.color = '#007bff';
        selectorContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Short Description Helper Script';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#007bff';
        subtitle.style.fontSize = '12px';
        subtitle.style.fontWeight = 'bold';
        subtitle.style.letterSpacing = '0.5px';
        subtitle.style.textTransform = 'uppercase';
        selectorContainer.appendChild(subtitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        for (const [key, team] of Object.entries(TEAMS)) {
            const btn = document.createElement('button');
            btn.textContent = team.name;
            Object.assign(btn.style, {
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: '2px solid #007bff',
                borderRadius: '6px',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
            });

            btn.onmouseover = () => {
                btn.style.backgroundColor = '#0056b3';
                btn.style.borderColor = '#0056b3';
            };

            btn.onmouseout = () => {
                btn.style.backgroundColor = '#007bff';
                btn.style.borderColor = '#007bff';
            };

            btn.onclick = () => {
                saveTeam(key);
                selectorContainer.remove();
                initializePanel();
            };

            buttonContainer.appendChild(btn);
        }

        selectorContainer.appendChild(buttonContainer);
        document.body.appendChild(selectorContainer);
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        #shortDescPanel div.field-wrapper {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            margin-left: 10px;
        }

        #shortDescPanel label {
            display: inline-block;
            width: 130px;
            font-weight: bold;
            color: black !important;
            margin-right: 6px;
        }

        #shortDescPanel .tenant-value {
            display: inline;
            font-size: 14px;
            box-sizing: border-box;
            color: #0066cc !important;
            text-decoration: none;
            font-weight: normal;
        }

        #shortDescPanel .tenant-value:hover {
            text-decoration: underline;
        }

        #shortDescPanel select,
        #shortDescPanel input[type="text"] {
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background-color: #f9f9f9;
            font-size: 14px;
            width: 280px;
            box-sizing: border-box;
            transition: all 0.2s ease;
            appearance: none;
            -webkit-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23333" height="24" width="24" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 12px;
            padding-right: 30px;
        }

        #shortDescPanel select,
        #shortDescPanel input,
        #shortDescPanel select option {
            color: black !important;
        }

        #shortDescPanel select:hover,
        #shortDescPanel select:focus,
        #shortDescPanel input[type="text"]:hover,
        #shortDescPanel input[type="text"]:focus {
            border-color: #888;
            background-color: #fff;
            outline: none;
        }

        #shortDescPanel select:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background-color: #e9e9e9;
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }

        .button-group button {
            flex: 1;
            min-width: 150px;
            padding: 8px 12px;
            border: 3px solid #ccc;
            border-radius: 6px;
            backgroundColor: #f0f0f0;
            cursor: 'pointer';
            font-weight: bold;
        }

        .button-group button:hover {
            background-color: #e0e0e0;
            border-color: #999;
        }

        /* Helper Button Styles */
        #shortDescHelperButton {
            background-color: #667eea !important;
            border: 1px solid #5568d3 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
        }

        #shortDescHelperButton:hover {
            background-color: #5568d3 !important;
            border-color: #4557bb !important;
        }

        #shortDescHelperButton:active {
            background-color: #4557bb !important;
        }

        #shortDescHelperButton::before {
            content: "📝";
            font-size: 16px;
            line-height: 1;
            display: block;
        }

        /* Update Date Button Styles */
        #shortDescUpdateDateButton {
            background-color: #17a2b8 !important;
            border: 1px solid #138496 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
            margin-left: 2px;
        }

        #shortDescUpdateDateButton:hover {
            background-color: #138496 !important;
            border-color: #117a8b !important;
        }

        #shortDescUpdateDateButton:active {
            background-color: #117a8b !important;
        }

        #shortDescUpdateDateButton::before {
            content: "📅";
            font-size: 16px;
            line-height: 1;
            display: block;
        }

        /* Netskope Tenant Link Button Styles */
        #shortDescTenantLinkButton {
            background-color: #343434 !important;
            border: 1px solid #0091c9 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
            margin-left: 2px;
            padding: 0 !important;
            width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
        }

        #shortDescTenantLinkButton:hover {
            background-color: #1b1b1b !important;
            border-color: #007fa8 !important;
        }

        #shortDescTenantLinkButton:active {
            background-color: #007fa8 !important;
        }

        #shortDescTenantLinkButton img {
            width: 20px;
            height: 20px;
            display: block;
        }

        #shortDescTenantLinkButton.disabled {
            background-color: #cccccc !important;
            border-color: #bbbbbb !important;
            cursor: not-allowed !important;
            opacity: 0.6;
        }

        #shortDescTenantLinkButton.disabled:hover {
            background-color: #cccccc !important;
            border-color: #bbbbbb !important;
        }

        /* Changelog Notification Styles */
        #changelogNotification {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            margin-left: 10px;
            padding: 3px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }

        #changelogNotification:hover {
            background-color: #f0f0f0;
        }

        #changelogNotification .notification-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: colorPulse 1s ease-in-out infinite;
        }

        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #changelogNotification .notification-text {
            font-size: 11px;
            color: #0066cc;
            text-decoration: underline;
        }

        /* Changelog Modal Styles */
        #changelogModal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }

        #changelogModal h2 {
            margin-top: 0;
            margin-bottom: 15px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        #changelogModal .version-info {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }

        #changelogModal .changelog-content {
            white-space: pre-wrap;
            line-height: 1.6;
            color: #333;
        }

        #changelogModal .close-changelog {
            margin-top: 15px;
            padding: 10px 20px;
            background-color: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
        }

        #changelogModal .close-changelog:hover {
            background-color: #5568d3;
        }

        #changelogModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
        }

        /* Modal Overlay for Main Panel */
        #shortDescPanelOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 9998;
            display: none;
        }

        /* Loading Overlay Styles */
        #loadingOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .loading-spinner {
            width: 60px;
            height: 60px;
            border: 6px solid #f3f3f3;
            border-top: 6px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Auto-complexity row styles */
        #autoComplexityRow {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            margin-left: 10px;
        }

        #autoComplexityRow .auto-complexity-spacer {
            display: inline-block;
            width: 130px;
            margin-right: 6px;
            flex-shrink: 0;
        }

        #autoComplexityRow .auto-complexity-inner {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        #autoComplexityCheckbox {
            width: 15px !important;
            height: 15px !important;
            cursor: pointer;
            accent-color: #667eea;
            flex-shrink: 0;
            margin: 0 !important;
        }

        #autoComplexityLabel {
            font-size: 13px;
            color: #444;
            cursor: pointer;
            user-select: none;
            font-weight: normal !important;
            width: auto !important;
        }

        #autoComplexityCount {
            font-size: 11px;
            color: #888;
            font-style: italic;
            white-space: nowrap;
        }

        #autoComplexityCount.active {
            color: #667eea;
            font-weight: bold;
            font-style: normal;
        }

        /* Custom searchable dropdown */
        .custom-select-container {
            position: relative;
            display: inline-block;
            width: 280px;
            box-sizing: border-box;
        }

        .custom-select-trigger {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background-color: #f9f9f9;
            font-size: 14px;
            box-sizing: border-box;
            cursor: pointer;
            font-family: Arial, sans-serif;
            color: black;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }

        .custom-select-arrow {
            font-size: 10px;
            color: #666;
            flex-shrink: 0;
            pointer-events: none;
            transition: transform 0.15s ease;
            display: inline-block;
        }

        .custom-select-trigger.open .custom-select-arrow {
            transform: rotate(180deg);
        }

        .custom-select-trigger:hover,
        .custom-select-trigger:focus {
            border-color: #888;
            background-color: #fff;
            outline: none;
        }

        .custom-select-trigger:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background-color: #e9e9e9;
        }

        .custom-select-dropdown {
            position: absolute;
            top: calc(100% + 2px);
            left: 0;
            z-index: 99999;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 100%;
            max-width: 360px;
            overflow: hidden;
        }

        #shortDescPanel .custom-select-search {
            width: 100%;
            padding: 6px 10px;
            border: none;
            border-bottom: 1px solid #eee;
            border-radius: 0;
            font-size: 13px;
            box-sizing: border-box;
            outline: none;
            background-color: #fff;
            color: #333;
            background-image: none;
        }

        .custom-select-list {
            list-style: none;
            margin: 0;
            padding: 4px 0;
            max-height: 200px;
            overflow-y: auto;
        }

        .custom-select-list li {
            padding: 7px 12px;
            font-size: 13px;
            cursor: pointer;
            font-family: Arial, sans-serif;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .custom-select-list li:hover,
        .custom-select-list li.cs-highlighted {
            background-color: #e8f0fe;
            color: #333;
        }

        .custom-select-list li.cs-selected {
            background-color: #667eea;
            color: #fff;
        }

        .custom-select-list li.cs-selected:hover,
        .custom-select-list li.cs-selected.cs-highlighted {
            background-color: #5568d3;
            color: #fff;
        }

        .custom-select-list .cs-no-results {
            color: #999;
            font-style: italic;
            cursor: default;
            pointer-events: none;
        }

        /* Settings Modal Styles */
        #settingsModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
        }

        #settingsModal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            width: 400px;
            max-width: 92vw;
            color: #333333 !important;
        }

        #settingsModal input[type="checkbox"] {
            accent-color: #667eea;
        }

        /* Help Modal Styles */
        #helpModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
        }

        #helpModal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            width: 640px;
            max-width: 92vw;
            max-height: 82vh;
            overflow-y: auto;
            color: #333333 !important;
        }

        #helpModal input, #helpModal select, #helpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';

        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
        });

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        content.appendChild(spinner);

        if (message) {
            const msgEl = document.createElement('div');
            Object.assign(msgEl.style, {
                fontSize: '14px',
                color: '#555',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center'
            });

            const msgText = document.createElement('span');
            msgText.textContent = message;

            const dotsEl = document.createElement('span');
            dotsEl.textContent = '.';

            let dotCount = 1;
            setInterval(() => {
                dotCount = dotCount >= 3 ? 1 : dotCount + 1;
                dotsEl.textContent = '.'.repeat(dotCount);
            }, 500);

            msgEl.appendChild(msgText);
            msgEl.appendChild(dotsEl);
            content.appendChild(msgEl);
        }

        overlay.appendChild(content);
        document.body.appendChild(overlay);
    }

    function parseChangelog() {
        const entries = [];
        let current = null;
        let currentBullet = null;
        for (const line of CHANGELOG.split('\n')) {
            const versionMatch = line.match(/^Version\s+([\d.]+):/);
            if (versionMatch) {
                if (currentBullet !== null && current) current.bullets.push(currentBullet);
                currentBullet = null;
                if (current) entries.push(current);
                current = { version: versionMatch[1], bullets: [] };
            } else if (line.trim().startsWith('-') && current) {
                if (currentBullet !== null) current.bullets.push(currentBullet);
                currentBullet = line.trim().slice(1).trim();
            } else if (line.trim() && current && currentBullet !== null) {
                currentBullet += ' ' + line.trim();
            }
        }
        if (currentBullet !== null && current) current.bullets.push(currentBullet);
        if (current) entries.push(current);
        return entries;
    }

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'changelogModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'changelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '0';
        parseChangelog().forEach((entry, index) => {
            const isLatest = index === 0;
            const card = document.createElement('div');
            Object.assign(card.style, {
                border:       '1px solid ' + (isLatest ? '#667eea' : '#e0e0e0'),
                borderRadius: '6px',
                marginBottom: '8px',
                overflow:     'hidden',
            });
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px',
                background: isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor: 'pointer', userSelect: 'none',
            });
            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';
            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: isLatest ? '#667eea' : '#555',
                fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);
            if (isLatest) {
                const tag = document.createElement('span');
                tag.textContent = 'Latest';
                Object.assign(tag.style, {
                    fontSize: '10px', fontWeight: 'bold',
                    background: '#667eea', color: '#fff',
                    borderRadius: '3px', padding: '1px 6px',
                    marginLeft: '8px', fontFamily: 'Arial, sans-serif',
                });
                versionWrap.appendChild(tag);
            }
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });
            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: isLatest ? '10px 14px' : '0',
                display: isLatest ? 'block' : 'none',
                background: '#fff',
            });
            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '3px 0',
                    fontSize: '13px', fontFamily: 'Arial, sans-serif',
                    color: '#444', lineHeight: '1.5',
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = bullet;
                row.appendChild(dot);
                row.appendChild(text);
                body.appendChild(row);
            });
            card.appendChild(body);
            let expanded = isLatest;
            header.addEventListener('click', () => {
                expanded = !expanded;
                body.style.display  = expanded ? 'block' : 'none';
                body.style.padding  = expanded ? '10px 14px' : '0';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            cardsWrap.appendChild(card);
        });

        const closeButton = document.createElement('button');
        closeButton.className = 'close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);

            const notification = document.getElementById('changelogNotification');
            if (notification) notification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  SETTINGS MODAL
     * ==========================================================*/

    function showSettingsModal() {
        if (document.getElementById('settingsModal')) return;

        const currentTeamKey = getCurrentTeam();
        const currentTeam = currentTeamKey ? TEAMS[currentTeamKey] : null;

        const overlay = document.createElement('div');
        overlay.id = 'settingsModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'settingsModal';

        // Header
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '18px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '⚙';
        titleIcon.style.fontSize = '20px';
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Settings';
        Object.assign(titleMain.style, {
            fontWeight: 'bold', fontSize: '16px', color: '#333', fontFamily: 'Arial, sans-serif'
        });
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleMain);

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };

        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // ── Team section ──
        const teamSection = document.createElement('div');
        Object.assign(teamSection.style, {
            marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid #eee'
        });

        const teamSectionTitle = document.createElement('div');
        teamSectionTitle.textContent = '👥 Team';
        Object.assign(teamSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '10px', fontFamily: 'Arial, sans-serif'
        });
        teamSection.appendChild(teamSectionTitle);

        const teamCurrentRow = document.createElement('div');
        Object.assign(teamCurrentRow.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        });

        const teamCurrentLabel = document.createElement('span');
        teamCurrentLabel.textContent = `Current team: ${currentTeam ? currentTeam.name : 'None'}`;
        Object.assign(teamCurrentLabel.style, {
            fontSize: '13px', color: '#555', fontFamily: 'Arial, sans-serif'
        });

        const switchTeamBtn = document.createElement('button');
        switchTeamBtn.textContent = 'Switch Team';
        Object.assign(switchTeamBtn.style, {
            padding: '6px 14px', background: '#007bff', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
            transition: 'background 0.2s ease', flexShrink: '0'
        });
        switchTeamBtn.onmouseover = () => { switchTeamBtn.style.background = '#0056b3'; };
        switchTeamBtn.onmouseout  = () => { switchTeamBtn.style.background = '#007bff'; };
        switchTeamBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            GM_deleteValue('shortDescTeam');
            showLoadingOverlay('Reloading page to select team');
            setTimeout(() => location.reload(), 100);
        };

        teamCurrentRow.appendChild(teamCurrentLabel);
        teamCurrentRow.appendChild(switchTeamBtn);
        teamSection.appendChild(teamCurrentRow);
        modal.appendChild(teamSection);

        // ── Searchable dropdowns section ──
        const dropdownSection = document.createElement('div');
        Object.assign(dropdownSection.style, {
            marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid #eee'
        });

        const dropdownSectionTitle = document.createElement('div');
        dropdownSectionTitle.textContent = '🔍 Dropdowns';
        Object.assign(dropdownSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '10px', fontFamily: 'Arial, sans-serif'
        });
        dropdownSection.appendChild(dropdownSectionTitle);

        const toggleRow = document.createElement('div');
        Object.assign(toggleRow.style, {
            display: 'flex', alignItems: 'flex-start', gap: '10px'
        });

        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.id = 'settingsSearchableDropdownsToggle';
        toggleCheckbox.checked = GM_getValue('shortDescSearchableDropdowns', true);
        Object.assign(toggleCheckbox.style, {
            width: '15px', height: '15px', margin: '2px 0 0 0',
            cursor: 'pointer', flexShrink: '0'
        });

        const toggleTextWrap = document.createElement('div');
        const toggleLabel = document.createElement('label');
        toggleLabel.htmlFor = 'settingsSearchableDropdownsToggle';
        toggleLabel.textContent = 'Searchable dropdowns';
        Object.assign(toggleLabel.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            cursor: 'pointer', display: 'block', marginBottom: '3px',
            fontFamily: 'Arial, sans-serif'
        });
        const toggleDesc = document.createElement('span');
        toggleDesc.textContent = 'Enable live text filtering in all dropdown fields. Changes take effect after a page reload.';
        Object.assign(toggleDesc.style, {
            fontSize: '12px', color: '#777', lineHeight: '1.4', display: 'block',
            fontFamily: 'Arial, sans-serif'
        });
        toggleTextWrap.appendChild(toggleLabel);
        toggleTextWrap.appendChild(toggleDesc);

        toggleCheckbox.onchange = () => {
            GM_setValue('shortDescSearchableDropdowns', toggleCheckbox.checked);
            overlay.remove();
            modal.remove();
            showLoadingOverlay();
            setTimeout(() => location.reload(), 100);
        };

        toggleRow.appendChild(toggleCheckbox);
        toggleRow.appendChild(toggleTextWrap);
        dropdownSection.appendChild(toggleRow);
        modal.appendChild(dropdownSection);

        // ── Tenant URLs section ──
        const tenantSection = document.createElement('div');
        tenantSection.style.marginBottom = '8px';

        const tenantSectionTitle = document.createElement('div');
        tenantSectionTitle.textContent = '🔗 Tenant URLs';
        Object.assign(tenantSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '10px', fontFamily: 'Arial, sans-serif'
        });
        tenantSection.appendChild(tenantSectionTitle);

        const tenantSectionDesc = document.createElement('div');
        tenantSectionDesc.textContent = 'Used for tenant detection and the Open Tenant button. Find the correct URLs in the General Scripts User Guide under "Required information & variables".';
        Object.assign(tenantSectionDesc.style, {
            fontSize: '12px', color: '#777', lineHeight: '1.4',
            marginBottom: '10px', fontFamily: 'Arial, sans-serif'
        });
        tenantSection.appendChild(tenantSectionDesc);

        const configureTenantBtn = document.createElement('button');
        configureTenantBtn.textContent = 'Configure Tenant URLs';
        Object.assign(configureTenantBtn.style, {
            padding: '6px 14px', background: '#f0f0f0', color: '#333',
            border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
            transition: 'background 0.2s ease'
        });
        configureTenantBtn.onmouseover = () => { configureTenantBtn.style.background = '#e0e0e0'; };
        configureTenantBtn.onmouseout  = () => { configureTenantBtn.style.background = '#f0f0f0'; };
        configureTenantBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            showTenantURLSetup(() => {});
        };
        tenantSection.appendChild(configureTenantBtn);
        modal.appendChild(tenantSection);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '18px', padding: '10px 20px',
            background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();

        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  HELP / FEATURE GUIDE MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('helpModal')) return;

        /* ---- Reusable content helpers. lead/bullets/caption append to the section body;
         *      the others return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        // bullets: a compact list of short usage notes, each prefixed with a purple dot.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const t = document.createElement('span');
                t.textContent = item;
                row.appendChild(dot);
                row.appendChild(t);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        // caption: a small italic note placed directly under a visual to explain it.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        // span: an inline text node with optional extra styles.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: a horizontal, wrapping flex row that holds visual mocks side by side.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: a small colored rounded label. Use for categories and button previews.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: opts.radius || '4px', padding: opts.padding || '3px 8px',
                fontSize: opts.fontSize || '11px', fontWeight: opts.weight || 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block', lineHeight: '1.4'
            });
            return c;
        }

        // badgeRow: a button preview on the left with a one line description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = chip(item.label, item.bg, { color: item.color, border: item.border, padding: '4px 8px', radius: item.radius });
            badge.style.flexShrink = '0';
            if (item.minWidth) { badge.style.minWidth = item.minWidth; badge.style.textAlign = 'center'; }
            row.appendChild(badge);
            row.appendChild(span(item.desc, { fontSize: '12px', color: '#555', lineHeight: '1.5' }));
            body.appendChild(row);
        }

        // kvGrid: a two column key:value grid for field references and named settings.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '0 0 6px 0' });
            for (const [key, val] of pairs) {
                grid.appendChild(span(key, { fontFamily: 'monospace', fontSize: '11px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap' }));
                grid.appendChild(span(val, { fontSize: '12px', color: '#555', padding: '2px 0', lineHeight: '1.4' }));
            }
            body.appendChild(grid);
        }

        // formatBox: a monospace box for a fixed format or a template.
        function formatBox(body, text) {
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                padding: '9px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#333',
                margin: '0 0 8px 0', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5'
            });
            box.textContent = text;
            body.appendChild(box);
        }

        // beforeAfter: labelled rows showing how something changes, e.g. Before / After.
        function beforeAfter(body, rows) {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { margin: '0 0 8px 0', borderRadius: '6px', border: '1px solid #d0d0f0', overflow: 'hidden' });
            rows.forEach(([label, text, good], i) => {
                const row = hrow([
                    span(label, { fontSize: '10px', fontWeight: 'bold', color: good ? '#2a7d4f' : '#888', textTransform: 'uppercase', width: '62px', flexShrink: '0' }),
                    span(text, { fontFamily: 'monospace', fontSize: '11px', color: '#333', whiteSpace: 'pre-wrap' })
                ], { padding: '7px 12px', margin: '0', flexWrap: 'nowrap', alignItems: 'flex-start',
                     background: good ? '#f2fff7' : '#f8f8ff', borderBottom: i < rows.length - 1 ? '1px solid #e8e8f0' : 'none' });
                wrap.appendChild(row);
            });
            body.appendChild(wrap);
        }

        // panelMock: a white card that stands in for a panel or window of the script.
        function panelMock(children, extra) {
            const p = document.createElement('div');
            Object.assign(p.style, {
                border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '400px', margin: '0 0 8px 0'
            }, extra || {});
            children.forEach(c => p.appendChild(c));
            return p;
        }

        // mockField: a labelled input or dropdown as it appears in the real form.
        function mockField(label, value, opts) {
            opts = opts || {};
            const row = hrow([
                span(label, { fontSize: '11px', fontWeight: 'bold', color: '#555', width: opts.labelWidth || '110px', flexShrink: '0' })
            ], { margin: '0 0 5px 0', flexWrap: 'nowrap', gap: '8px' });
            const box = document.createElement('div');
            Object.assign(box.style, {
                flex: '1', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px solid #ccc', borderRadius: '4px', padding: '3px 8px', minHeight: '16px',
                background: opts.locked ? '#efefef' : '#fff'
            });
            box.appendChild(span(value, { fontSize: '11px', color: opts.placeholder ? '#aaa' : '#333', fontStyle: opts.placeholder ? 'italic' : 'normal' }));
            if (opts.caret) box.appendChild(span('▾', { fontSize: '10px', color: '#999' }));
            row.appendChild(box);
            return row;
        }

        // toggle: a ticked or unticked checkbox preview with an optional one line description.
        function toggle(label, on, desc) {
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            const box = span(on ? '✓' : '', {
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: '0', boxSizing: 'border-box',
                border: on ? 'none' : '1px solid #b0b0b0', background: on ? '#667eea' : '#fff', color: '#fff',
                fontSize: '11px', lineHeight: '15px', textAlign: 'center', display: 'inline-block'
            });
            wrap.appendChild(hrow([ box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' }) ], { margin: '0', flexWrap: 'nowrap' }));
            if (desc) wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px', lineHeight: '1.4' }));
            return wrap;
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    lead(body, 'Three buttons appear next to the Short Description field of every RITM and Incident.');
                    body.appendChild(hrow([
                        span('Short description', { fontSize: '12px', color: '#333', fontWeight: 'bold' }),
                        span('01-10-2026 | UK | DLP | WIP | ...', { fontSize: '11px', color: '#555', border: '1px solid #ccc', borderRadius: '3px', padding: '3px 8px', background: '#fff', fontFamily: 'monospace' }),
                        chip('📝', '#667eea', { border: '1px solid #5568d3', padding: '3px 7px' }),
                        chip('📅', '#17a2b8', { border: '1px solid #138496', padding: '3px 7px' }),
                        chip('N', '#343434', { border: '1px solid #0091c9', padding: '3px 8px' })
                    ], { gap: '4px', margin: '0 0 6px 0' }));
                    caption(body, 'Helper panel, Update Date and Open Tenant, from left to right.');
                    bullets(body, [
                        'Click 📝 to open the panel, fill in the fields and click "Change Short description".',
                        'If the ticket already uses the standard format, the panel opens with every field filled in.'
                    ]);
                }
            },
            {
                icon: '📋',
                title: 'Short Description Format',
                buildContent: (body) => {
                    lead(body, 'Every short description follows the same pipe separated format.');
                    formatBox(body, 'DD-MM-YYYY | MF | Product | Status | Vendor | Type | Complexity | PER | MF Tenant');
                    kvGrid(body, [
                        ['DD-MM-YYYY', 'Today\'s date, filled in for you'],
                        ['MF', 'Member Firm abbreviation, for example UK, FR or US'],
                        ['Product', 'DLP, SWG, CASB, DCRM or DCRM Scanner'],
                        ['Status', 'Workflow status, for example WIP or Waiting Requester'],
                        ['Vendor', 'Vendor case reference (only for teams that use it)'],
                        ['Type', 'Request category, for example Access, Policy or Config'],
                        ['Complexity', '1 Low, 2 Medium, 3 High'],
                        ['PER', 'PER reference number, blank when not needed'],
                        ['MF Tenant', 'Netskope tenant detected from the ticket']
                    ]);
                }
            },
            {
                icon: '🖊️',
                title: 'The Panel',
                buildContent: (body) => {
                    lead(body, 'The 📝 button opens this panel. Your team decides which fields and options appear.');
                    const head = hrow([
                        span('Current Team: EMEA Team', { fontSize: '11px', color: '#667eea', fontWeight: 'bold' }),
                        chip('⚙ Settings', 'transparent', { color: '#555', border: '1px solid #ccc', fontSize: '10px' }),
                        chip('? Help', 'transparent', { color: '#667eea', border: '1px solid #c0c8f0', fontSize: '10px' })
                    ], { margin: '0 0 8px 0', gap: '6px' });
                    body.appendChild(panelMock([
                        head,
                        mockField('MF NS Tenant', 'EU Tenant ↗'),
                        mockField('MF', 'UK', { caret: true }),
                        span('Detected Req. MF: United Kingdom', { fontSize: '11px', color: '#555', display: 'block', margin: '0 0 5px 118px' }),
                        mockField('Product', 'DLP', { caret: true }),
                        mockField('Current Status', 'WIP', { caret: true }),
                        mockField('Type', 'Policy', { caret: true }),
                        mockField('Complexity', '2', { caret: true, locked: true }),
                        hrow([ chip('Insert Default Short description', '#fff', { color: '#333', border: '1px solid #ccc', weight: 'normal' }) ], { margin: '8px 0 4px 0' }),
                        hrow([ chip('Change Short description', '#667eea', { padding: '6px 12px' }) ], { margin: '0' })
                    ]));
                    bullets(body, [
                        'Change Short description writes the formatted line to the ticket with today\'s date.',
                        'Insert Default Short description writes the empty template with placeholders, so you can fill it in by hand.',
                        'Vendor Case and PER Number fields only appear for teams that use them.'
                    ]);
                }
            },
            {
                icon: '⚡',
                title: 'Quick Action Buttons',
                buildContent: (body) => {
                    lead(body, 'The two buttons beside 📝 work without opening the panel.');
                    badgeRow(body, { bg: '#17a2b8', label: '📅', minWidth: '28px', desc: 'Update Date: sets the date at the start of the short description to today and leaves the rest as it is. Adds the date if there was none.' });
                    badgeRow(body, { bg: '#343434', border: '1px solid #0091c9', label: 'N', minWidth: '28px', desc: 'Open Tenant: opens the Netskope tenant of the detected Member Firm in a new tab. Needs the tenant URLs set in Settings.' });
                }
            },
            {
                icon: '🤖',
                title: 'Auto Complexity',
                buildContent: (body) => {
                    lead(body, 'Complexity can be worked out for you from the number of comments on the ticket.');
                    body.appendChild(toggle('Auto-calculate complexity', true, 'Below the Complexity field. While it is on, the Complexity dropdown is locked.'));
                    kvGrid(body, [
                        ['0 to 15', 'comments: Complexity 1 (Low)'],
                        ['16 to 25', 'comments: Complexity 2 (Medium)'],
                        ['26 or more', 'comments: Complexity 3 (High)']
                    ]);
                    caption(body, 'Untick the box to choose the complexity yourself. Your choice is remembered.');
                }
            },
            {
                icon: '🔍',
                title: 'Searchable Dropdowns',
                buildContent: (body) => {
                    lead(body, 'When turned on in Settings, every dropdown of the panel can be filtered by typing.');
                    const list = document.createElement('div');
                    Object.assign(list.style, { border: '1px solid #ccc', borderRadius: '4px', background: '#fff', maxWidth: '240px', margin: '0 0 6px 0' });
                    const search = span('🔍 uni', { display: 'block', fontSize: '11px', color: '#333', padding: '4px 8px', borderBottom: '1px solid #e0e0e0' });
                    list.appendChild(search);
                    ['United Kingdom', 'United States'].forEach((t, i) => list.appendChild(span(t, {
                        display: 'block', fontSize: '11px', padding: '4px 8px', color: i === 0 ? '#fff' : '#333', background: i === 0 ? '#667eea' : '#fff'
                    })));
                    body.appendChild(list);
                    bullets(body, [
                        'Type to filter, use the Up and Down arrows to move, Enter to pick, Escape to close.',
                        'Turn it on or off in Settings. The change applies after a page reload.'
                    ]);
                }
            },
            {
                icon: '🔗',
                title: 'Tenant Detection',
                buildContent: (body) => {
                    lead(body, 'The panel reads the Requesting Member Firm and the Territory of the ticket to find the Netskope tenant.');
                    body.appendChild(panelMock([
                        mockField('MF NS Tenant', 'EU Tenant ↗'),
                        span('Detected Req. MF: Spain', { fontSize: '11px', color: '#555', display: 'block', margin: '0 0 2px 118px' }),
                        span('Detected Territory: Portugal', { fontSize: '11px', color: '#555', display: 'block', margin: '0 0 0 118px' })
                    ]));
                    kvGrid(body, [
                        ['EMA', 'Africa, Chile, Israel, Mexico, Spain, S-LATAM, DKU'],
                        ['EU', 'Austria, Belgium, Cyprus, Nordics, Ireland, Luxembourg, Middle East, Netherlands, Switzerland, UK'],
                        ['CE', 'France, Germany, Portugal, Turkey'],
                        ['APAC', 'Australia, Japan, Korea, Mauritius, New Zealand, South Asia, Southeast Asia, Taiwan'],
                        ['AME', 'Brazil, Canada, Caribbean, United States']
                    ]);
                    bullets(body, [
                        'The tenant name is a link that opens the tenant, like the N button.',
                        'The Detected Territory line only shows when the ticket has a territory.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Settings',
                buildContent: (body) => {
                    lead(body, 'The top right of the panel holds these controls.');
                    badgeRow(body, { bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Settings', desc: 'Opens the Settings window described below.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Suite', desc: 'Opens the Ticket Helpers settings: tools, team, tenant URLs and backups. The team and tenant URLs are shared with the other helpers.' });
                    badgeRow(body, { bg: 'transparent', color: '#0066cc', label: "🔵 What's New", desc: 'Appears beside the version after an update. Opens the changelog.' });
                    body.appendChild(span('Inside Settings', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '8px 0 6px 0' }));
                    body.appendChild(toggle('Searchable dropdowns', true, 'Type to filter every dropdown of the panel. Applies after a reload.'));
                    kvGrid(body, [
                        ['👥 Switch Team', 'Changes your team (EMEA, AME or APAC). Each team has its own lists. The page reloads.'],
                        ['🔗 Tenant URLs', 'Configure Tenant URLs: the Netskope tenant address for each region, from the General Scripts User Guide.']
                    ]);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'helpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'helpModal';

        // Modal header row
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📖';
        titleIcon.style.fontSize = '22px';
        const titleText = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, {
            fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif'
        });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Short Description Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, {
            fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif'
        });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };

        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // Section cards
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden'
            });

            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
            });

            const headerLeft = document.createElement('span');
            headerLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
            const iconEl = document.createElement('span');
            iconEl.textContent = section.icon;
            iconEl.style.fontSize = '14px';
            const titleLabel = document.createElement('span');
            titleLabel.textContent = section.title;
            Object.assign(titleLabel.style, {
                fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif'
            });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);

            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block'
            });

            cardHeader.appendChild(headerLeft);
            cardHeader.appendChild(chevron);

            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);

            card.appendChild(cardHeader);
            card.appendChild(cardBody);

            let expanded = true;
            cardHeader.addEventListener('click', () => {
                expanded = !expanded;
                cardBody.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });

            contentWrap.appendChild(card);
        }
        modal.appendChild(contentWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();

        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  MODAL CLOSE FUNCTION
     * ==========================================================*/

    function closeMainPanel() {
        const container = document.getElementById('shortDescPanel');
        const overlay = document.getElementById('shortDescPanelOverlay');
        if (container) container.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }

    /* ==========================================================
     *  SEARCHABLE DROPDOWN COMPONENT
     * ==========================================================*/

    function createSearchableDropdown(labelText, optionsArray, id) {
        const wrapper = document.createElement('div');
        wrapper.className = 'field-wrapper';

        const label = document.createElement('label');
        label.textContent = `${labelText}: `;
        label.setAttribute('for', id + '-trigger');

        const container = document.createElement('div');
        container.className = 'custom-select-container';
        container.id = id;

        const normalized = optionsArray.map(o =>
            typeof o === 'object' ? { value: o.value, label: o.label } : { value: o, label: o }
        );

        let selectedValue = normalized[0] ? normalized[0].value : '';
        let selectedLabel = normalized[0] ? normalized[0].label : '';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = id + '-trigger';
        trigger.className = 'custom-select-trigger';

        const triggerText = document.createElement('span');
        triggerText.textContent = selectedLabel;
        triggerText.style.overflow = 'hidden';
        triggerText.style.textOverflow = 'ellipsis';
        triggerText.style.whiteSpace = 'nowrap';

        const triggerArrow = document.createElement('span');
        triggerArrow.className = 'custom-select-arrow';
        triggerArrow.textContent = '▼';

        trigger.appendChild(triggerText);
        trigger.appendChild(triggerArrow);

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';
        dropdown.style.display = 'none';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'custom-select-search';
        searchInput.placeholder = 'Type to filter...';

        const list = document.createElement('ul');
        list.className = 'custom-select-list';

        function renderList(filter) {
            list.innerHTML = '';
            const q = filter.toLowerCase();
            const filtered = normalized.filter(o => o.label.toLowerCase().includes(q));
            if (filtered.length === 0) {
                const li = document.createElement('li');
                li.className = 'cs-no-results';
                li.textContent = 'No results';
                list.appendChild(li);
                return;
            }
            for (const opt of filtered) {
                const li = document.createElement('li');
                li.textContent = opt.label;
                li.dataset.value = opt.value;
                if (opt.value === selectedValue) li.classList.add('cs-selected');
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    pickOption(opt.value, opt.label);
                    closeDropdown();
                    trigger.focus();
                });
                list.appendChild(li);
            }
        }

        function pickOption(value, lbl) {
            selectedValue = value;
            selectedLabel = lbl;
            triggerText.textContent = lbl;
        }

        function openDropdown() {
            if (trigger.disabled) return;
            document.querySelectorAll('.custom-select-dropdown').forEach(dd => {
                if (dd !== dropdown) {
                    dd.style.display = 'none';
                    const otherTrigger = dd.parentElement && dd.parentElement.querySelector('.custom-select-trigger');
                    if (otherTrigger) otherTrigger.classList.remove('open');
                }
            });
            dropdown.style.display = 'block';
            trigger.classList.add('open');
            searchInput.value = '';
            renderList('');
            setTimeout(() => {
                searchInput.focus();
                const sel = list.querySelector('.cs-selected');
                if (sel) sel.scrollIntoView({ block: 'nearest' });
            }, 0);
        }

        function closeDropdown() {
            dropdown.style.display = 'none';
            trigger.classList.remove('open');
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display === 'none' ? openDropdown() : closeDropdown();
        });

        searchInput.addEventListener('input', () => renderList(searchInput.value));

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
                trigger.focus();
                return;
            }
            const items = [...list.querySelectorAll('li:not(.cs-no-results)')];
            if (items.length === 0) return;
            const highlighted = list.querySelector('.cs-highlighted');
            const idx = highlighted ? items.indexOf(highlighted) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items.forEach(i => i.classList.remove('cs-highlighted'));
                const next = items[Math.min(idx + 1, items.length - 1)];
                if (next) { next.classList.add('cs-highlighted'); next.scrollIntoView({ block: 'nearest' }); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items.forEach(i => i.classList.remove('cs-highlighted'));
                const prev = items[Math.max(idx - 1, 0)];
                if (prev) { prev.classList.add('cs-highlighted'); prev.scrollIntoView({ block: 'nearest' }); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = highlighted || items[0];
                if (target && target.dataset.value !== undefined) {
                    const opt = normalized.find(o => o.value === target.dataset.value);
                    if (opt) { pickOption(opt.value, opt.label); closeDropdown(); trigger.focus(); }
                }
            }
        });

        Object.defineProperty(container, 'value', {
            get() { return selectedValue; },
            set(v) {
                const opt = normalized.find(o => o.value === v);
                if (opt) pickOption(opt.value, opt.label);
            },
            configurable: true
        });

        Object.defineProperty(container, 'disabled', {
            get() { return trigger.disabled; },
            set(v) {
                trigger.disabled = !!v;
                if (v) closeDropdown();
            },
            configurable: true
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) closeDropdown();
        });

        dropdown.appendChild(searchInput);
        dropdown.appendChild(list);
        container.appendChild(trigger);
        container.appendChild(dropdown);
        wrapper.appendChild(label);
        wrapper.appendChild(container);

        return wrapper;
    }

    /* ==========================================================
     *  MAIN PANEL INITIALIZATION
     * ==========================================================*/

    function initializePanel() {
        const currentTeamKey = getCurrentTeam();
        if (!currentTeamKey) {
            showTeamSelector();
            return;
        }

        const currentTeam = TEAMS[currentTeamKey];

        // Create overlay for main panel
        const overlay = document.createElement('div');
        overlay.id = 'shortDescPanelOverlay';
        overlay.onclick = closeMainPanel;
        document.body.appendChild(overlay);

        // Main container
        const container = document.createElement('div');
        container.id = 'shortDescPanel';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '8px',
            display: 'none',
            width: '480px'
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'red',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '25px',
            height: '25px',
            fontWeight: 'bold'
        });
        closeButton.onclick = closeMainPanel;
        container.appendChild(closeButton);

        // Team indicator container
        const teamIndicatorContainer = document.createElement('div');
        Object.assign(teamIndicatorContainer.style, {
            padding: '8px 10px',
            fontSize: '12px',
            color: '#666',
            borderBottom: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        });

        // Top row
        const topRow = document.createElement('div');
        Object.assign(topRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const teamIndicator = document.createElement('span');
        teamIndicator.textContent = `Current Team: ${currentTeam.name}`;

        const topRowRight = document.createElement('div');
        Object.assign(topRowRight.style, {
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            marginRight: '30px'
        });

        const settingsBtn = document.createElement('span');
        Object.assign(settingsBtn.style, {
            color: '#555',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: '3px',
            border: '1px solid #ccc',
            fontWeight: 'bold',
            userSelect: 'none',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease'
        });
        settingsBtn.textContent = '⚙ Settings';
        settingsBtn.title = 'Open settings';
        settingsBtn.onmouseover = () => { settingsBtn.style.backgroundColor = '#f0f0f0'; };
        settingsBtn.onmouseout  = () => { settingsBtn.style.backgroundColor = 'transparent'; };
        settingsBtn.onclick = () => showSettingsModal();

        const helpBtn = document.createElement('span');
        Object.assign(helpBtn.style, {
            color: '#667eea',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            borderRadius: '3px',
            border: '1px solid #c0c8f0',
            fontWeight: 'bold',
            userSelect: 'none',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease'
        });
        helpBtn.textContent = '? Help';
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();

        topRowRight.appendChild(settingsBtn);
        topRowRight.appendChild(helpBtn);
        topRowRight.appendChild(createSuitePill());
        topRow.appendChild(teamIndicator);
        topRow.appendChild(topRowRight);
        teamIndicatorContainer.appendChild(topRow);

        // Version + changelog row
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            flexWrap: 'wrap'
        });

        const versionIndicator = document.createElement('span');
        versionIndicator.textContent = `Version • v${SCRIPT_VERSION}`;
        versionRow.appendChild(versionIndicator);

        // "What's New" notification sits directly after the version number
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = "What's New";

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onclick = () => showChangelogModal();

            versionRow.appendChild(changelogNotification);
        }

        teamIndicatorContainer.appendChild(versionRow);
        container.appendChild(teamIndicatorContainer);

        // Fields container
        const fieldsContainer = document.createElement('div');
        fieldsContainer.style.display = 'none';
        fieldsContainer.style.marginTop = '35px';

        // Helper functions
        const createTenantDisplay = () => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = 'MF NS Tenant: ';

            const tenantLink = document.createElement('a');
            tenantLink.className = 'tenant-value';
            tenantLink.id = 'tenantDisplay';
            tenantLink.textContent = 'Detecting...';
            tenantLink.href = '#';
            tenantLink.target = '_blank';
            tenantLink.rel = 'noopener noreferrer';
            Object.assign(tenantLink.style, {
                color: '#0066cc',
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: 'normal'
            });

            tenantLink.onmouseover = () => {
                if (tenantLink.href !== '#') tenantLink.style.textDecoration = 'underline';
            };
            tenantLink.onmouseout = () => {
                tenantLink.style.textDecoration = 'none';
            };

            wrapper.appendChild(label);
            wrapper.appendChild(tenantLink);
            return wrapper;
        };

        const createDropdown = (labelText, optionsArray, id) => {
            if (GM_getValue('shortDescSearchableDropdowns', true)) {
                return createSearchableDropdown(labelText, optionsArray, id);
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            label.setAttribute('for', id);

            const dropdownContainer = document.createElement('div');
            dropdownContainer.style.position = 'relative';
            dropdownContainer.style.display = 'inline-block';

            const select = document.createElement('select');
            select.id = id;
            select.style.paddingRight = '20px';

            for (const option of optionsArray) {
                const opt = document.createElement('option');
                if (typeof option === 'object') {
                    opt.value = option.value;
                    opt.textContent = option.label;
                } else {
                    opt.value = option;
                    opt.textContent = option;
                }
                select.appendChild(opt);
            }

            const arrow = document.createElement('span');
            arrow.textContent = '▼';
            Object.assign(arrow.style, {
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                fontSize: '12px',
                color: '#666'
            });

            dropdownContainer.appendChild(select);
            dropdownContainer.appendChild(arrow);
            wrapper.appendChild(label);
            wrapper.appendChild(dropdownContainer);
            return wrapper;
        };

        const createTextInput = (labelText, id) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            label.setAttribute('for', id);

            const input = document.createElement('input');
            input.id = id;
            input.type = 'text';

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            return wrapper;
        };

        // Build fields
        fieldsContainer.appendChild(createTenantDisplay());
        fieldsContainer.appendChild(createDropdown('MF', currentTeam.mfOptions, 'mf'));

        const requestingMFDisplay = document.createElement('div');
        requestingMFDisplay.id = 'requestingMFDisplay';
        requestingMFDisplay.style.fontSize = '12px';
        requestingMFDisplay.style.margin = '0 0 4px 140px';
        requestingMFDisplay.style.color = '#555';
        requestingMFDisplay.textContent = 'Detecting Requesting MF...';
        fieldsContainer.appendChild(requestingMFDisplay);

        const territoryDisplay = document.createElement('div');
        territoryDisplay.id = 'territoryDisplay';
        territoryDisplay.style.fontSize = '12px';
        territoryDisplay.style.margin = '0 0 10px 140px';
        territoryDisplay.style.color = '#555';
        territoryDisplay.style.display = 'none';
        fieldsContainer.appendChild(territoryDisplay);

        fieldsContainer.appendChild(createDropdown('Product', currentTeam.productOptions, 'product'));
        fieldsContainer.appendChild(createDropdown('Current Status', currentTeam.statusOptions, 'status'));

        if (currentTeam.showVendor) {
            fieldsContainer.appendChild(createTextInput('Vendor Case', 'vendor'));
        }

        fieldsContainer.appendChild(createDropdown('Type', currentTeam.typeOptions, 'type'));
        fieldsContainer.appendChild(createDropdown('Complexity', currentTeam.complexityOptions, 'complexity'));

        const complexityNote = document.createElement('div');
        complexityNote.style.fontSize = '12px';
        complexityNote.style.margin = '0 0 10px 140px';
        complexityNote.style.color = '#555';
        complexityNote.textContent = currentTeam.complexityNote;
        fieldsContainer.appendChild(complexityNote);

        /* ----------------------------------------------------------
         *  AUTO-COMPLEXITY CHECKBOX ROW
         * ---------------------------------------------------------- */
        const autoComplexityRow = document.createElement('div');
        autoComplexityRow.id = 'autoComplexityRow';

        const autoComplexitySpacer = document.createElement('span');
        autoComplexitySpacer.className = 'auto-complexity-spacer';
        autoComplexityRow.appendChild(autoComplexitySpacer);

        const autoComplexityInner = document.createElement('div');
        autoComplexityInner.className = 'auto-complexity-inner';

        const autoComplexityCheckbox = document.createElement('input');
        autoComplexityCheckbox.type = 'checkbox';
        autoComplexityCheckbox.id = 'autoComplexityCheckbox';
        autoComplexityCheckbox.checked = GM_getValue('shortDescAutoComplexity', true);

        const autoComplexityLabel = document.createElement('label');
        autoComplexityLabel.id = 'autoComplexityLabel';
        autoComplexityLabel.htmlFor = 'autoComplexityCheckbox';
        autoComplexityLabel.textContent = 'Auto-calculate complexity';

        const autoComplexityCount = document.createElement('span');
        autoComplexityCount.id = 'autoComplexityCount';

        autoComplexityInner.appendChild(autoComplexityCheckbox);
        autoComplexityInner.appendChild(autoComplexityLabel);
        autoComplexityInner.appendChild(autoComplexityCount);
        autoComplexityRow.appendChild(autoComplexityInner);
        fieldsContainer.appendChild(autoComplexityRow);

        function applyAutoComplexity() {
            const complexitySelect = document.getElementById('complexity');
            if (!complexitySelect) return;

            const count = countAdditionalComments();
            const val = calculateAutoComplexity(count);

            complexitySelect.value = val;
            autoComplexityCount.textContent =
                `(${count} comment${count !== 1 ? 's' : ''} → ${val})`;
            autoComplexityCount.className = 'active';
        }

        function toggleAutoComplexity(enabled) {
            GM_setValue('shortDescAutoComplexity', enabled);
            const complexitySelect = document.getElementById('complexity');
            if (!complexitySelect) return;

            if (enabled) {
                complexitySelect.disabled = true;
                applyAutoComplexity();
            } else {
                complexitySelect.disabled = false;
                autoComplexityCount.textContent = '';
                autoComplexityCount.className = '';
            }
        }

        autoComplexityCheckbox.onchange = () => {
            toggleAutoComplexity(autoComplexityCheckbox.checked);
        };
        /* ---------------------------------------------------------- */

        if (currentTeam.showPER) {
            fieldsContainer.appendChild(createTextInput('PER Number', 'per'));
        }

        // Buttons
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Change Short description';
        applyButton.className = 'apply-btn';
        Object.assign(applyButton.style, { fontWeight: 'bold' });

        const insertDefaultButton = document.createElement('button');
        insertDefaultButton.textContent = 'Insert Default Short description';
        Object.assign(insertDefaultButton.style, {
            margin: '10px',
            marginBottom: '0px',
            lineHeight: '1',
            fontSize: '12px',
            fontWeight: 'normal',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'block'
        });
        // ── CHANGE 1: updated template to include MF Tenant at the end ──
        insertDefaultButton.onclick = () => {
            const input = getShortDescriptionInput();
            if (input) {
                input.value = `DD-MM-YEAR | MF | Product | Current Status | Vendor Case | Type | Complexity | PER Number | MF Tenant`;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                alert('No se encontró el input con ID sc_req_item.short_description o incident.short_description');
            }
            closeMainPanel();
        };

        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.className = 'button-group';
        buttonsWrapper.style.margin = '10px 0';
        buttonsWrapper.style.flexDirection = 'column';
        buttonsWrapper.appendChild(insertDefaultButton);

        const actionButtonsWrapper = document.createElement('div');
        actionButtonsWrapper.className = 'button-group';
        actionButtonsWrapper.style.margin = '10px 0';
        actionButtonsWrapper.appendChild(applyButton);

        fieldsContainer.appendChild(buttonsWrapper);
        fieldsContainer.appendChild(actionButtonsWrapper);

        container.appendChild(fieldsContainer);
        document.body.appendChild(container);

        window.shortDescCurrentTenantURL = null;

        // Create and insert helper buttons
        function createHelperButton() {
            const shortDescInput = getShortDescriptionInput();
            if (!shortDescInput) return;

            const addonsDivs = document.querySelectorAll('.form-field-addons');
            let addonsDiv = null;
            for (const div of addonsDivs) {
                const lookupBtn = div.querySelector(`[id*="short_description"]`);
                if (lookupBtn) { addonsDiv = div; break; }
            }

            if (!addonsDiv) return;
            if (document.getElementById('shortDescHelperButton')) return;

            const helperButton = document.createElement('a');
            helperButton.id = 'shortDescHelperButton';
            helperButton.tabIndex = '-1';
            helperButton.role = 'button';
            helperButton.className = 'btn btn-default btn-ref';
            helperButton.title = 'Short Description Helper';
            helperButton.setAttribute('data-original-title', 'Short Description Helper');

            helperButton.onclick = (e) => {
                e.preventDefault();
                container.style.display = 'block';
                overlay.style.display = 'block';
                fieldsContainer.style.display = 'block';

                // Detect and display tenant with clickable link
                const detectedTenant = detectTenant();
                const currentTenantURLs = getTenantURLs();
                const tenantDisplay = document.getElementById('tenantDisplay');
                if (tenantDisplay) {
                    tenantDisplay.textContent = detectedTenant;
                    if (currentTenantURLs[detectedTenant]) {
                        tenantDisplay.href = currentTenantURLs[detectedTenant];
                        tenantDisplay.style.cursor = 'pointer';
                        window.shortDescCurrentTenantURL = currentTenantURLs[detectedTenant];
                    } else {
                        tenantDisplay.href = '#';
                        tenantDisplay.style.cursor = 'default';
                        tenantDisplay.onclick = (ev) => ev.preventDefault();
                        window.shortDescCurrentTenantURL = null;
                    }
                }

                updateRequestingMFDisplay();
                updateTerritoryDisplay();

                // Pre-fill fields from existing short description
                // New format: DATE | MF | Product | Status | Vendor | Type | Complexity | PER | MF Tenant
                const input = getShortDescriptionInput();
                if (input && input.value.includes('|')) {
                    const parts = input.value.split('|').map(p => p.trim());

                    // parts[0] = date, parts[1] = MF, parts[2] = Product, ...
                    if (parts.length >= 2) {
                        // MF (parts[1])
                        const mfVal = parts[1];
                        if (currentTeam.mfOptions.find(o => o.value === mfVal)) {
                            document.getElementById('mf').value = mfVal;
                        }

                        let index = 2;

                        // Product (parts[2])
                        if (parts[index] !== undefined) {
                            if (currentTeam.productOptions.includes(parts[index])) {
                                document.getElementById('product').value = parts[index++];
                            } else {
                                index++; // skip unrecognised / placeholder token
                            }
                        }

                        // Status
                        if (parts[index] === 'Current Status') {
                            index++;
                        } else if (parts[index] !== undefined && currentTeam.statusOptions.includes(parts[index])) {
                            document.getElementById('status').value = parts[index++];
                        }

                        // Vendor
                        if (currentTeam.showVendor && parts[index] !== undefined) {
                            if (parts[index] === 'Vendor Case') {
                                index++;
                            } else if (parts[index].startsWith('Vendor Case')) {
                                document.getElementById('vendor').value = parts[index++].replace('Vendor Case', '').trim();
                            } else if (/^[A-Z0-9\-]+$/i.test(parts[index])) {
                                document.getElementById('vendor').value = parts[index++];
                            }
                        }

                        // Type
                        if (parts[index] === 'Type') {
                            index++;
                        } else if (parts[index] !== undefined && currentTeam.typeOptions.includes(parts[index])) {
                            document.getElementById('type').value = parts[index++];
                        }

                        // Complexity — only restore from string if auto-mode is OFF
                        if (!GM_getValue('shortDescAutoComplexity', true)) {
                            if (parts[index] === 'Complexity') {
                                index++;
                            } else if (parts[index] !== undefined && currentTeam.complexityOptions.includes(parts[index])) {
                                document.getElementById('complexity').value = parts[index++];
                            }
                        } else {
                            // Skip the complexity token regardless
                            if (parts[index] === 'Complexity' || (parts[index] !== undefined && currentTeam.complexityOptions.includes(parts[index]))) {
                                index++;
                            }
                        }

                        // PER
                        if (currentTeam.showPER && parts[index] !== undefined && parts[index] !== 'PER Number') {
                            // Only treat as PER if it doesn't look like a tenant name
                            const knownTenants = Object.values(TENANT_NAME_TO_KEY).map((_, i) => Object.keys(TENANT_NAME_TO_KEY)[i]);
                            if (!knownTenants.includes(parts[index]) && !parts[index].includes('Tenant')) {
                                document.getElementById('per').value = parts[index];
                            }
                            index++;
                        } else if (parts[index] === 'PER Number') {
                            index++;
                        }
                    }
                }

                // Apply auto-complexity last so it always wins when enabled
                const isAutoEnabled = GM_getValue('shortDescAutoComplexity', true);
                autoComplexityCheckbox.checked = isAutoEnabled;
                toggleAutoComplexity(isAutoEnabled);
            };

            // Update Date button
            const updateDateButton = document.createElement('a');
            updateDateButton.id = 'shortDescUpdateDateButton';
            updateDateButton.tabIndex = '-1';
            updateDateButton.role = 'button';
            updateDateButton.className = 'btn btn-default btn-ref';
            updateDateButton.title = 'Update Date Only';
            updateDateButton.setAttribute('data-original-title', 'Update Date Only');

            updateDateButton.onclick = (e) => {
                e.preventDefault();
                const input = getShortDescriptionInput();
                if (!input) { alert('Short description field not found'); return; }

                const currentValue = input.value.trim();
                const newDate = getFormattedDate();
                const datePattern = /^\d{2}-\d{2}-\d{4}/;

                let newValue;
                if (datePattern.test(currentValue)) {
                    newValue = currentValue.replace(datePattern, newDate);
                } else if (currentValue) {
                    newValue = `${newDate} | ${currentValue}`;
                } else {
                    newValue = newDate;
                }

                input.value = newValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                updateDateButton.style.backgroundColor = '#4CAF50';
                updateDateButton.style.borderColor = '#45a049';
                setTimeout(() => {
                    updateDateButton.style.backgroundColor = '';
                    updateDateButton.style.borderColor = '';
                }, 500);
            };

            // Tenant Link button
            const tenantLinkButton = document.createElement('a');
            tenantLinkButton.id = 'shortDescTenantLinkButton';
            tenantLinkButton.tabIndex = '-1';
            tenantLinkButton.role = 'button';
            tenantLinkButton.className = 'btn btn-default btn-ref';
            tenantLinkButton.title = 'Open Netskope Tenant';
            tenantLinkButton.setAttribute('data-original-title', 'Open Netskope Tenant');

            const tenantIcon = document.createElement('img');
            tenantIcon.src = 'https://www.netskope.com/wp-content/uploads/2019/04/cropped-favicon-32x32.png';
            tenantIcon.alt = 'Netskope';
            tenantLinkButton.appendChild(tenantIcon);

            tenantLinkButton.onclick = (e) => {
                e.preventDefault();

                if (!window.shortDescCurrentTenantURL) {
                    const detectedTenant = detectTenant();
                    const currentTenantURLs = getTenantURLs();
                    if (currentTenantURLs[detectedTenant]) {
                        window.shortDescCurrentTenantURL = currentTenantURLs[detectedTenant];
                    }
                }

                if (window.shortDescCurrentTenantURL) {
                    window.open(window.shortDescCurrentTenantURL, '_blank', 'noopener,noreferrer');
                    tenantLinkButton.style.backgroundColor = '#4CAF50';
                    tenantLinkButton.style.borderColor = '#45a049';
                    setTimeout(() => {
                        tenantLinkButton.style.backgroundColor = '';
                        tenantLinkButton.style.borderColor = '';
                    }, 500);
                } else {
                    alert('No tenant detected. Please ensure a Member Firm is selected.');
                }
            };

            addonsDiv.appendChild(helperButton);
            addonsDiv.appendChild(updateDateButton);
            addonsDiv.appendChild(tenantLinkButton);
        }

        // ── CHANGE 2: Apply button — MF and Product are now separate pipes,
        //              MF Tenant appended at the end ────────────────────────
        applyButton.onclick = () => {
            const date = getFormattedDate();
            let mf         = document.getElementById('mf').value;
            let product    = document.getElementById('product').value;
            let status     = document.getElementById('status').value;
            let vendor     = currentTeam.showVendor ? document.getElementById('vendor').value.trim() : '';
            let type       = document.getElementById('type').value;
            let complexity = document.getElementById('complexity').value;
            const per      = currentTeam.showPER ? document.getElementById('per').value.trim() : '';
            const tenantDisplay = document.getElementById('tenantDisplay');
            const mfTenant = (tenantDisplay && tenantDisplay.textContent !== 'Detecting...' && tenantDisplay.textContent !== 'Not Detected')
            ? tenantDisplay.textContent.trim()
            : 'MF Tenant';

            // Replace N/A placeholders with readable labels
            mf         = mf         === 'N/A' ? 'MF'             : mf;
            product    = product    === 'N/A' ? 'Product'        : product;
            status     = status     === 'N/A' ? 'Current Status' : status;
            type       = type       === 'N/A' ? 'Type'           : type;
            complexity = complexity === 'N/A' ? 'Complexity'     : complexity;

            const parts = [];
            parts.push(mf);                                            // MF  (separate token)
            parts.push(product);                                       // Product (separate token)
            parts.push(status);
            if (currentTeam.showVendor) parts.push(vendor || 'Vendor Case');
            parts.push(type);
            parts.push(complexity);
            if (currentTeam.showPER) parts.push(per || 'PER Number');
            parts.push(mfTenant);                                      // MF Tenant (new, last)

            const finalText = `${date} | ${parts.join(' | ')}`;

            const input = getShortDescriptionInput();
            if (input) {
                input.value = finalText;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                alert('No se encontró el input con ID sc_req_item.short_description o incident.short_description');
            }

            closeMainPanel();
        };

        const checkAndCreateButton = setInterval(() => {
            const shortDescInput = getShortDescriptionInput();
            if (shortDescInput) {
                createHelperButton();
                clearInterval(checkAndCreateButton);
            }
        }, 500);

        setTimeout(createHelperButton, 1000);
    }

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function startScript() {
        if (!areTenantURLsConfigured() || !getCurrentTeam()) {
            // Waits until the import had its chance to bring the team and tenant URLs.
            dtWhenMigrationSettled(() => {
                if (!areTenantURLsConfigured()) {
                    showTenantURLSetup(() => { if (!getCurrentTeam()) showTeamSelector(); else initializePanel(); });
                } else if (!getCurrentTeam()) {
                    showTeamSelector();
                } else {
                    initializePanel();
                }
            });
            return;
        }
        initializePanel();
    }

    if (document.readyState === 'loading') {
        window.addEventListener('load', startScript);
    } else {
        startScript();
    }

    })();

    /* === TOOL: TICKET RESPONSE HELPER === */
    (() => {
        'use strict';
        // Turned off in ⚙ Suite, not chosen yet, or not meant for this page: this tool does nothing at all.
        if (!isToolEnabled('ticketResponse') || !dtToolRunsHere('ticketResponse')) return;


    // Global flag to prevent multiple initializations
    let isInitialized = false;
    let cachedOpenedByName = null;

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '2.21.2';
    const CHANGELOG = `Version 2.21.2:
- The Feature Guide is now visual: it shows the button, the response list with its sections and colored dots, the pinned and recently used sections, the custom response editor, the footer and every setting as they look on screen. It also explains which field each response goes to, the clipboard paste and the variables you can use in custom responses.

Version 2.21.1:
- The Feature Guide now also explains pinned and recently used responses, the @mention banner shown while names are added, and the Footer Signature setting.

Version 2.21.0:
- New setting "Paste clipboard into responses", off by default. When it is on, inserting a response fills its empty ">" line (for example the list of URLs in a bypass response) with what you have copied. Your browser may ask once for permission to read the clipboard. If the clipboard is empty or access is blocked, the ">" line stays so you can fill it in by hand.

Version 2.20.0:
- New setting "Add Change Tracker summary to Solved Closure", off by default. When it is on, inserting Solved Closure also writes the ticket's Change Tracker summary to the work notes and lists the same changes in the comment, in place of the empty actions line. It needs the Change Tracker script; if it has no entries for the ticket, Solved Closure is inserted as usual.

Version 2.19.0:
- Inserting a response now also updates the status in the short description to match it, the same way Solved Closure already set it to "Closed":
  Waiting Requester: initial contact, information requests, reminders, bypasses, Slack URL added, policy, DLP policy and steering changes, unknown requestor, troubleshooting steps and NPA access.
  WIP: "Working on the request" reminder and SOC Tier 2 task request.
  Waiting Vendor: vendor case opened, recategorization request and IDEA request.
  Waiting SPM: SPM request loaded.
  Closed: Timeout Closure and End User Closure, in addition to Solved Closure.
- Work note responses do not change the status.

Version 2.18.6:
- EMEA: Updated the "First NPA Access for MF" and "Additional NPA Access" response texts with the new wording, required AD group structure and partner/client information fields.

Version 2.18.5:
- EMEA: Removed "Please update the agent & report back with the results." from the Slack URL Added response.

Version 2.18.4:
- EMEA: Restored the original "When you have a moment, please update the agent configuration and run a quick test" sentence to the SSL Bypass, Domain Bypass, SSL to Domain Bypass, Application Bypass, Policy Create, Policy Modify, DLP Policy Create, and DLP Policy Modify responses. The "Please update the agent & report back with the results." line remains only on responses that did not previously include a test instruction.

Version 2.18.3:
- EMEA: Removed the redundant "When you have a moment, please update the agent configuration and run a quick test" sentence from SSL Bypass, Domain Bypass, SSL to Domain Bypass, Application Bypass, Policy Create, Policy Modify, DLP Policy Create, and DLP Policy Modify. These responses already include "Please update the agent & report back with the results."

Version 2.18.2:
- EMEA: Added "Please update the agent & report back with the results." to all change-type responses: SSL Bypass, Domain Bypass, SSL to Domain Bypass, Application Bypass, Policy Create, Policy Modify, Policy Delete, DLP Policy Create, DLP Policy Modify, DLP Policy Delete, Steering/Client Configuration, and Slack URL Added.

Version 2.18.1:
- Fixed footer signature: the separator line now appears correctly when the footer is pre-filled on page load. Fixed an issue where inserting a template would duplicate the footer instead of replacing it.

Version 2.18.0:
- Added a Footer Signature feature. Enable it in Settings to automatically append a separator and footer text to every inserted response. The separator is rendered as a horizontal rule using [code]<hr>[/code] markup. When enabled and the comment field is empty, the footer is pre-filled as a signature when the page loads. The toggle and footer text persist across sessions and can be edited at any time via the Edit button in Settings.

Version 2.17.4:
- Updated the EMEA team first, second, and third reminder response texts.

Version 2.17.3:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 2.17.2:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 2.17.1:
- The Feature Guide now includes visual examples: a button badge showing how the inline button looks, colored field-type badges (Comments and Work Notes) with descriptions, a before-and-after name substitution example, a mock search box, and a grid of editor fields for custom responses. Settings are shown as badge rows matching the Short Description Helper's style.

Version 2.17.0:
- Added a "? Help" button in the dropdown header that opens a Feature Guide modal documenting all script features.
- The "Settings" and "Help" buttons now use a pill style matching the Short Description Helper.

Version 2.16.5:
- The "What's New" notification now appears directly to the right of the version number in the dropdown header.

Version 2.16.4:
- Switch Team moved into the Settings modal. A new "Team" section shows the current team and a "Switch Team" button. The inline link in the dropdown header has been removed.

Version 2.16.3:
- The team selection modal now has a purple top border, purple title, and purple buttons to visually distinguish it from the Short Description Helper modal when both scripts are active at the same time.

Version 2.16.2:
- Selecting a team on first setup now applies immediately without reloading the page.
- The loading screen shown when switching teams now displays an animated "Reloading page to select team" message with cycling dots.

Version 2.16.1:
- The search bar now receives focus automatically when the dropdown is opened, so you can start typing a filter immediately without clicking it first.

Version 2.16.0:
- EMEA: Added "NPA Access" response to the Responses section with two submenu options: "First NPA Access for MF" and "Additional NPA Access".

Version 2.15.0:
- Added short description field transforms: responses can now declare a
  shortDescTransforms array in their metadata to rewrite specific pipe-segment
  fields when the response is inserted.
- Solved Closure now automatically sets the short description status segment
  to "Closed" on insert across all teams.

Version 2.14.0:
- Added a Settings button in the dropdown header that opens a Settings modal.
- New setting: "Auto-update date on insert" updates the short description date
  to today whenever a response is inserted. The setting is on by default and
  persists across sessions.

Version 2.13.2:
- EMEA: Added "SPM Request Loaded" response to the Responses section.

Version 2.13.1:
- Parent items with submenus can now be pinned. When pinned, the full flyout submenu
  is available directly from the Pinned section.

Version 2.13.0:
- Added pinned responses: click the pin icon on any response to keep it at
  the top of the list in a dedicated Pinned section. Pinned items still appear
  in their original category. Click the pin again to unpin.

Version 2.12.3:
- Fixed dark mode compatibility: the response dropdown, custom responses modal, team
  selector, and changelog modal now force light backgrounds and dark text via CSS with
  !important so ServiceNow dark mode cannot override their inputs and controls.

Version 2.12.2:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 2.12.1:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 2.12.0:
- Search bar: filter templates in real time from the top of the dropdown.
- Recently Used: last 3 used templates pinned to the top of the list.

Version 2.11.1:
- EMEA: Added "# Recategorization Request" worknote with URL Requested and Categories requested fields.`;

    /* ==========================================================
     *  TEAM CONFIGURATIONS
     * ==========================================================*/

    const RESPONSE_TEAMS = {

    /// EMEA TEAM ///

    emeaTeam: {
        name: 'EMEA Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            ssltodomain: {
                label: 'SSL Bypass > Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            teststeps: {
                label: 'Initial Troubleshooting Steps',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            unknownreq: {
                label: 'Unknown Requestor',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            vendorcaseloaded: {
                label: 'Vendor Case Opened',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Vendor' }]
            },
            policymgmt: {
                label: 'Policy Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            policycreate: {
                label: 'Create',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            policymodify: {
                label: 'Modify',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            policydelete: {
                label: 'Delete',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            bypasscomments: {
                label: '# SSL/Domain/App Bypass',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            bypasssslcomment: {
                label: '# SSL Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            bypassdomaincomment: {
                label: '# Domain Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            bypassappcomment: {
                label: '# Application Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            slackAddComment: {
                label: 'Slack URL Added',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            tier2SOCreq: {
                label: 'SOC Tier 2 Task Request',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'WIP' }]
            },
            recatRequest: {
                label: 'Recategorization Request',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Vendor' }]
            },
            recatRequestWorknote: {
                label: '# Recategorization Request',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            ideaFeatureRequest: {
                label: 'IDEA Request Opened',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Vendor' }]
            },
            configMgmt: {
                label: 'Configuration Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            configSteering: {
                label: 'Steering/Client Configuration',
                category: 'responses',
                parentItem: 'configMgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            configMgmtWorknotes: {
                label: '# Configuration Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            configSteeringWorknotes: {
                label: '# Steering/Client Configuration',
                category: 'workcomments',
                parentItem: 'configMgmtWorknotes',
                fieldType: 'work_notes'
            },
            policyMgmtWorknote: {
                label: '# Policy Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            policyCreateWorknote: {
                label: '# Create',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            policyModifyWorknote: {
                label: '# Modify',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            policyDeleteWorknote: {
                label: '# Delete',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyMgmt: {
                label: 'DLP Policy Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            dlpPolicyCreate: {
                label: 'Create',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            dlpPolicyModify: {
                label: 'Modify',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            dlpPolicyDelete: {
                label: 'Delete',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            dlpPolicyMgmtWorknote: {
                label: '# DLP Policy Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            dlpPolicyCreateWorknote: {
                label: '# Create',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyModifyWorknote: {
                label: '# Modify',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyDeleteWorknote: {
                label: '# Delete',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            workingOnReminder: {
                label: 'Working on the request Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'WIP' }]
            },
            spmLoaded: {
                label: 'SPM Request Loaded',
                category: 'responses',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting SPM' }]
            },
            npaAccess: {
                label: 'NPA Access',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            npaAccessFirst: {
                label: 'First NPA Access for MF',
                category: 'responses',
                parentItem: 'npaAccess',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            npaAccessAdditional: {
                label: 'Additional NPA Access',
                category: 'responses',
                parentItem: 'npaAccess',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            }
        },

        enabledResponses: [
            'teststeps',
            'unknownreq',
            'policymgmt',
            'policycreate',
            'policymodify',
            'policydelete',
            'dlpPolicyMgmt',
            'dlpPolicyCreate',
            'dlpPolicyModify',
            'dlpPolicyDelete',
            'configMgmt',
            'configSteering',
            'bypass',
            'bypassssl',
            'ssltodomain',
            'bypassdomain',
            'bypassapp',
            'vendorcaseloaded',
            'slackAddComment',
            'recatRequest',
            'recatRequestWorknote',
            'ideaFeatureRequest',
            'first',
            'second',
            'third',
            'workingOnReminder',
            'solved',
            'timeout',
            'enduser',
            'bypasscomments',
            'bypasssslcomment',
            'bypassdomaincomment',
            'bypassappcomment',
            'policyMgmtWorknote',
            'policyCreateWorknote',
            'policyModifyWorknote',
            'policyDeleteWorknote',
            'dlpPolicyMgmtWorknote',
            'dlpPolicyCreateWorknote',
            'dlpPolicyModifyWorknote',
            'dlpPolicyDeleteWorknote',
            'configMgmtWorknotes',
            'configSteeringWorknotes',
            'urlcheck',
            'moreinfo',
            'vpninfo',
            'tier2SOCreq',
            'spmLoaded',
            'npaAccess',
            'npaAccessFirst',
            'npaAccessAdditional',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request

Please note that if the required information is not provided, we will be unable to proceed with your case, and it will unfortunately have to be closed.`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                ssltodomain: (vars) => `Hi @[${vars.openedByName}],
We've switched the following bypasses from SSL Bypass to Domain Bypass to help address the issue:

- Now, currently the Domain Bypass applied is:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                teststeps: (vars) => `Hello @[${vars.openedByName}],

I hope you're doing well.
To help us identify the root cause of the persistent issue, could you please provide more detailed information from your side? For example, if a domain bypass was applied as previously advised, we would greatly appreciate it if you could perform the standard Member Firm troubleshooting steps and share the results.
The recommended troubleshooting includes:

- Temporarily disabling the Netskope client to confirm whether the issue is related to Netskope
- Capturing screenshots of the error
- Collecting HAR files
- Gathering relevant Netskope logs

Performing these steps on your end would significantly reduce back-and-forth and allow us to resolve the issue for the affected user much faster.
Please let me know if you need any guidance on capturing the above information. We're happy to assist.

Thank you in advance for your help!

Kind regards,
Global Data Security Enablement`,
                unknownreq: (vars) => `Hi @[${vars.openedByName}],

We have noticed that you have not previously been listed as a frequent point of contact for submitting requests to our team.
To add you as an approved Member Firm requestor, could you please provide confirmation or approval for this addition?

Kind regards,
Global Data Security Enablement`,
                first: (vars) => `Hi @[${vars.openedByName}],
I hope you're doing well. I'm reaching out as we are waiting for an update on your end regarding the following:

>

Could you please take a moment to get back to us when convenient? Your response will allow us to move your request forward as quickly as possible.

Thank you in advance for your help!

Kind regards,
Global Data Security Enablement`,
                second: (vars) => `Hi @[${vars.openedByName}],
I hope you're doing well. This is a second reminder as we have still not received an update from you regarding the following:

>

Please get back to us at your earliest convenience so we can continue progressing with your request.

If we do not receive a response by the end of the next business day, we will need to close the ticket in accordance with our standard procedure.

Thank you in advance for your cooperation.
Kind regards,
Global Data Security Enablement`,
                third: (vars) => `Hello @[${vars.openedByName}],
I hope you're doing well. This is our third and final reminder as we have yet to receive any update from you regarding the following:

>

Please note that if we do not hear back by the end of the day, we will close this ticket in accordance with our standard procedure.

Thank you very much for your understanding.

Kind regards,
Global Data Security Enablement`,
                solved: (vars) => `Hi @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
If you notice that the ${vars.pageType} has not been fully addressed, please open a new ${vars.pageType} and refer to this ticket.

Best regards,
Global Data Security Enablement`,
                timeout: (vars) => `Hi @[${vars.openedByName}],
After multiple attempts to obtain the additional information required, we still do not have sufficient details to continue working on this ticket. Therefore, we are proceeding with its closure.

Once you have the necessary information available, please open a new ${vars.pageType} and reference this ticket so we can resume support.

Best regards,
Global Data Security Enablement`,
                enduser: (vars) => `Hi @[${vars.openedByName}],
We have determined that this ${vars.pageType} was submitted directly by you rather than through your designated Member Firm (MF) IT Contact.
Please coordinate with your MF IT Contact to ensure the ${vars.pageType} is submitted correctly and includes all mandatory information.
Accordingly, we will proceed with the closure of this case.

Best regards,
Global Data Security Enablement`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`,
                bypasssslcomment: (vars) => `# Added to SSL Decryption policy for:



in:

`,
                bypassdomaincomment: (vars) => `# Added Steering Exception for:



in:

`,
                bypassappcomment: (vars) => `# Added App Bypass for binary:



in:

`,
                vendorcaseloaded: (vars) => `Hi @[${vars.openedByName}],
We have opened vendor case # for further review of this matter. The Netskope team is currently conducting an investigation, and we will keep you informed as soon as updates become available.

Best regards,
Global Data Security Enablement`,
                policycreate: (vars) => `Hi @[${vars.openedByName}],

We've created the following Netskope policy to help address the issue:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                policymodify: (vars) => `Hi @[${vars.openedByName}],

We've modified the following Netskope policy to help address the issue:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                policydelete: (vars) => `Hi @[${vars.openedByName}],

We've scheduled for deletion the following Netskope policy to help address the issue:
- Policy name:

This policy has been disabled and scheduled for deletion in 30 days.
Please update the agent & report back with the results.

Best regards,
Global Data Security Enablement`,
                slackAddComment: (vars) => `Hello @[${vars.openedByName}],

Slack URL:
>

Has been added to the requested MF Slack Allow list.

Kind regards,`,
                tier2SOCreq: (vars) => `Hello,

A MF has requested access to a URL that was blocked by SOC. Could you please take a look?
The URL is:

>

Thanks!`,
                recatRequest: (vars) => `Hello @[${vars.openedByName}],

A recategorization request has been submitted to Netskope. Please allow 24–48 hours for them to review it and apply any necessary changes.

Kind regards,`,
                recatRequestWorknote: (vars) => `# Recategorization request submitted to Netskope.
- URL Requested:
- Categories requested: `,
                ideaFeatureRequest: (vars) => `Hello @[${vars.openedByName}],

An IDEA #### feature request has been opened with Netskope for this functionality. We will update you directly once there is any progress or feedback.
In the meantime, we will proceed with closing this request.

Kind regards,`,
                configMgmt: (vars) => ``,
                configSteering: (vars) => `Hello @[${vars.openedByName}],

We have created/updated/deleted the following Netskope Steering/Client Configuration to meet the requested requirements:

Steering name:
AD group:
Partner Tenant Access configured:

1 –



Please update the agent & report back with the results.

Kind regards,`,
                configMgmtWorknotes: (vars) => ``,
                configSteeringWorknotes: (vars) => `Created/updated/deleted Netskope Steering/Client Configuration:

Steering name:
AD group:
Partner Tenant Access configured:

1 -`,
                policyMgmtWorknote: (vars) => ``,
                policyCreateWorknote: (vars) => `Netskope Policy has been created:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:`,
                policyModifyWorknote: (vars) => `Netskope Policy has been modified:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:`,
                policyDeleteWorknote: (vars) => `Netskope Policy has been scheduled to be deleted (currently disabled):
- Policy name:`,
                dlpPolicyMgmt: (vars) => ``,
                dlpPolicyCreate: (vars) => `Hi @[${vars.openedByName}],

We've created the following Netskope DLP policy to help address the request:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                dlpPolicyModify: (vars) => `Hi @[${vars.openedByName}],

We've modified the following Netskope DLP policy to help address the request:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                dlpPolicyDelete: (vars) => `Hi @[${vars.openedByName}],

We've scheduled for deletion the following Netskope DLP policy:
- Policy name:

This policy has been disabled and scheduled for deletion in 30 days.
Please update the agent & report back with the results.

Best regards,
Global Data Security Enablement`,
                dlpPolicyMgmtWorknote: (vars) => ``,
                dlpPolicyCreateWorknote: (vars) => `Netskope DLP Policy has been created:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:`,
                dlpPolicyModifyWorknote: (vars) => `Netskope DLP Policy has been modified:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:`,
                dlpPolicyDeleteWorknote: (vars) => `Netskope DLP Policy has been scheduled to be deleted (currently disabled):
- Policy name:`,
                workingOnReminder: (vars) => `Hello @[${vars.openedByName}],

Just a quick note to let you know that we are currently working on your request and the ticket is actively in progress.

We’ll keep you updated as we move forward.

Kind regards,
Global Data Security Enablement`,
                spmLoaded: (vars) => `Hi @[${vars.openedByName}],
We have loaded SPM request #. The SPM team will work on it and contact you if additional information is required.

Best regards,
Global Data Security Enablement`,
                npaAccess: (vars) => ``,
                npaAccessFirst: (vars) => `Hi @[${vars.openedByName}],
I hope you are well.

As this is the first NPA configuration for your Member Firm, please provide the information below and arrange for the required AD groups to be created.

Required AD Groups:
1. Firm NPA Parent Group: Parent AD group containing all current and future client-specific NPA groups.
2. Client-Specific NPA Group: AD group containing the users requiring access to a specific partner/client NPA. This group must be nested within the Firm NPA Parent Group.

Example structure:
ES NPA Access
├── Client 1 NPA
├── Client 2 NPA
└── Client 3 NPA

Required client information:
- Partner/Client Name:
- Partner/Client URL:
- Client-Specific NPA AD Group:

Once the AD groups have been created, correctly nested, and populated with the required users, please confirm so we can proceed with the NPA configuration.

Thank you for your cooperation.

Kind regards,
Global Data Security Enablement`,
                npaAccessAdditional: (vars) => `Hi @[${vars.openedByName}],
I hope you are well.

To proceed with the configuration of the new NPA, please provide the following information and complete the required AD group setup.

1. AD Group Setup:
Please create an AD group containing all users who require access to this NPA.
The group must be nested within the following Firm-level AD group, which contains all NPA users for your Member Firm:
<Firm_Level_NPA_AD_Group>

2. Partner/Client Information:
- Partner/Client Name:
- Partner/Client URL:

Once the AD group has been created, populated with the appropriate users, and nested within the Firm-level NPA group, please confirm and we will proceed with the NPA client configuration.

Thank you for your cooperation.

Kind regards,
Global Data Security Enablement`
        }
    },

    /// AME TEAM ///

    ameTeam: {
        name: 'AME Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            }
        },

        enabledResponses: [
            'urlcheck',
            'initial',
            'initialmiss',
            'bypass',
            'bypassssl',
            'bypassdomain',
            'bypassapp',
            'first',
            'second',
            'third',
            'solved',
            'timeout',
            'enduser',
            'moreinfo',
            'vpninfo',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                first: (vars) => `Hello @[${vars.openedByName}],
I'm contacting you to recall we need the following information to continue working on your ${vars.pageType}:

>`,
                second: (vars) => `Hello @[${vars.openedByName}],
This is a second reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of tomorrow, we will have to close the ticket following our procedure.`,
                third: (vars) => `Hello @[${vars.openedByName}],
This is the third reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of the day, we will have to close the ticket following our procedure.

@MF CISO`,
                solved: (vars) => `Hello @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
In case you detect that the ${vars.pageType} is not fully attended, please open a new ${vars.pageType} and refer to this ticket.`,
                timeout: (vars) => `Hello @[${vars.openedByName}],
After several contacts asking for additional information, we have not enough information to continue working on this ticket, so we are closing.

Once you have the required information, please open a new ${vars.pageType} and refer to this ticket.`,
                enduser: (vars) => `Hi @[${vars.openedByName}], hope you are doing fine.
We noticed a ${vars.pageType} was directly raised by you and not by your local Member Firm IT Contact.
To speed up your ${vars.pageType} we encourage you to contact your MF IT Contact providing all necessary evidence.
We will proceed to close this case.
Regards.`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`
        }
    },

    /// APAC TEAM ///

    apacTeam: {
        name: 'APAC Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Waiting Requester' }]
            }
        },

        enabledResponses: [
            'urlcheck',
            'initial',
            'initialmiss',
            'bypass',
            'bypassssl',
            'bypassdomain',
            'bypassapp',
            'first',
            'second',
            'third',
            'solved',
            'timeout',
            'enduser',
            'moreinfo',
            'vpninfo',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                first: (vars) => `Hello @[${vars.openedByName}],
I'm contacting you to recall we need the following information to continue working on your ${vars.pageType}:

>`,
                second: (vars) => `Hello @[${vars.openedByName}],
This is a second reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of tomorrow, we will have to close the ticket following our procedure.`,
                third: (vars) => `Hello @[${vars.openedByName}],
This is the third reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of the day, we will have to close the ticket following our procedure.

@MF CISO`,
                solved: (vars) => `Hello @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
In case you detect that the ${vars.pageType} is not fully attended, please open a new ${vars.pageType} and refer to this ticket.`,
                timeout: (vars) => `Hello @[${vars.openedByName}],
After several contacts asking for additional information, we have not enough information to continue working on this ticket, so we are closing.

Once you have the required information, please open a new ${vars.pageType} and refer to this ticket.`,
                enduser: (vars) => `Hi @[${vars.openedByName}], hope you are doing fine.
We noticed a ${vars.pageType} was directly raised by you and not by your local Member Firm IT Contact.
To speed up your ${vars.pageType} we encourage you to contact your MF IT Contact providing all necessary evidence.
We will proceed to close this case.
Regards.`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`
        }
    }

};

    /* ==========================================================
     *  DUAL / SINGLE INPUT MODE DETECTION & TEXTAREA ROUTING
     * ==========================================================*/

    /**
     * Returns true when ServiceNow is showing both the Work Notes and
     * Additional Comments textareas simultaneously (dual-input mode).
     * The container div #multiple-input-journal-entry has aria-hidden="false"
     * when active; we also verify both textareas are in the DOM.
     */
    function isDualInputMode() {
        const container = document.getElementById('multiple-input-journal-entry');
        if (container && container.getAttribute('aria-hidden') === 'false') {
            const wn = document.getElementById('activity-stream-work_notes-textarea');
            const cm = document.getElementById('activity-stream-comments-textarea');
            return !!(wn && cm);
        }
        return false;
    }

    /**
     * Returns the correct textarea element to write into.
     *
     * @param {'work_notes'|'comments'} fieldType  — the target declared in responseMetadata
     *
     * Dual mode  → routes to the matching specific textarea
     * Single mode → always uses the generic #activity-stream-textarea (original behaviour)
     *
     * A small badge indicator is briefly shown on the chosen field so the user
     * can confirm at a glance which area received the text.
     */
    function getTargetTextarea(fieldType) {
        if (isDualInputMode()) {
            if (fieldType === 'work_notes') {
                return document.getElementById('activity-stream-work_notes-textarea');
            }
            // 'comments' or any unrecognised value → customer-visible comments field
            return document.getElementById('activity-stream-comments-textarea');
        }

        // Single-input mode — original selector
        return (
            document.querySelector('#activity-stream-textarea') ||
            document.querySelector('[data-stream-text-input]')
        );
    }

    /**
     * Briefly highlights the border of the textarea that was written into,
     * so the analyst can confirm routing at a glance.
     */
    function flashTargetField(textarea) {
        if (!textarea) return;
        const prev = textarea.style.outline;
        textarea.style.outline = '2px solid #667eea';
        textarea.style.transition = 'outline 0.3s ease';
        setTimeout(() => {
            textarea.style.outline = prev;
        }, 1500);
    }


    /* ==========================================================
     *  MENTION INSERTION BLOCKER
     *
     *  While @mention picker interactions are in progress the page is
     *  overlaid with a transparent pointer-events blocker so accidental
     *  mouse clicks cannot dismiss the suggestion dropdown.
     *
     *  An animated toast is shown at the top of the viewport.
     *  The blocker is ALWAYS removed via try/finally in insertTextWithMention.
     * ==========================================================*/

    let _mentionBlockerActive = false;
    let _mentionFocusGuardTextarea = null;   // textarea being guarded
    let _mentionFocusGuardHandler  = null;   // its focusout listener ref (for cleanup)

    /**
     * Show the blocker overlay + status toast.
     *
     * @param {number}          total     Total @ mentions to process
     * @param {number}          current   1-based index of current mention
     * @param {string}          fieldType 'work_notes' | 'comments'
     * @param {HTMLTextAreaElement} textarea  The textarea receiving text — kept focused
     */
    function showMentionBlocker(total, current, fieldType, textarea) {
        hideMentionBlocker();
        _mentionBlockerActive = true;

        // ── Full mouse-event blocker overlay ─────────────────────────────
        // Intercepts in capture phase so nothing underneath ever sees these
        // events.  stopImmediatePropagation ensures no other capture listeners
        // on parent nodes can steal focus either.
        const overlay = document.createElement('div');
        overlay.id = 'mention-blocker-overlay';
        Object.assign(overlay.style, {
            position:      'fixed',
            inset:         '0',
            zIndex:        '2147483646',
            pointerEvents: 'all',
            cursor:        'not-allowed',
            background:    'rgba(0, 0, 0, 0.10)',
        });
        const _eatEvent = e => { e.preventDefault(); e.stopImmediatePropagation(); };
        ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'].forEach(type => {
            overlay.addEventListener(type, _eatEvent, true);
        });

        // ── focusout guard on the textarea ───────────────────────────────
        // Even with the overlay in place, some SN internal scripts can trigger
        // a blur.  We immediately re-focus the textarea whenever it loses focus
        // while the blocker is active.
        if (textarea) {
            _mentionFocusGuardTextarea = textarea;
            _mentionFocusGuardHandler  = () => {
                if (_mentionBlockerActive) {
                    // Use a microtask so the blur finishes before we re-focus
                    setTimeout(() => { if (_mentionBlockerActive) textarea.focus(); }, 0);
                }
            };
            textarea.addEventListener('focusout', _mentionFocusGuardHandler, true);
        }

        // Status toast
        const fieldLabel   = fieldType === 'work_notes' ? '\uD83D\uDD12 Work Notes' : '\uD83D\uDCAC Comments';
        const progressText = total > 1 ? ` (1 of ${total})` : '';

        const toast = document.createElement('div');
        toast.id = 'mention-blocker-toast';
        Object.assign(toast.style, {
            position:     'fixed',
            top:          '18px',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       '2147483647',
            background:   'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color:        '#fff',
            padding:      '12px 22px 15px',
            borderRadius: '10px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.5)',
            fontFamily:   'Arial, sans-serif',
            fontSize:     '13px',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
            whiteSpace:   'nowrap',
            userSelect:   'none',
            pointerEvents:'none',
            border:       '1px solid rgba(102,126,234,0.55)',
            minWidth:     '320px',
        });

        const spinner = document.createElement('span');
        spinner.className = 'mention-blocker-spinner';
        Object.assign(spinner.style, {
            display:      'inline-block',
            width:        '16px',
            height:       '16px',
            border:       '2px solid rgba(255,255,255,0.2)',
            borderTop:    '2px solid #818cf8',
            borderRadius: '50%',
            flexShrink:   '0',
        });

        const msg = document.createElement('span');
        msg.id = 'mention-blocker-msg';
        msg.innerHTML =
            `Inserting @mention<strong id="mention-blocker-progress" style="color:#a5b4fc">${progressText}</strong>` +
            ` \u2192 <span style="color:#67e8f9">${fieldLabel}</span>` +
            `<span style="color:#fca5a5;margin-left:10px;font-size:12px">\u26D4 do not click</span>`;

        const barTrack = document.createElement('div');
        Object.assign(barTrack.style, {
            position:     'absolute',
            bottom:       '0',
            left:         '0',
            width:        '100%',
            height:       '4px',
            borderRadius: '0 0 10px 10px',
            overflow:     'hidden',
            background:   'rgba(255,255,255,0.08)',
        });
        const barFill = document.createElement('div');
        barFill.id = 'mention-blocker-bar';
        Object.assign(barFill.style, {
            height:     '100%',
            width:      total > 1 ? `${Math.round(((current - 1) / total) * 100)}%` : '0%',
            background: 'linear-gradient(90deg,#667eea,#a5b4fc)',
            transition: 'width 0.35s ease',
        });
        barTrack.appendChild(barFill);
        toast.appendChild(spinner);
        toast.appendChild(msg);
        toast.appendChild(barTrack);
        document.body.appendChild(overlay);
        document.body.appendChild(toast);
    }

    /** Update progress bar / counter text between mentions. */
    function updateMentionBlocker(total, current) {
        const bar      = document.getElementById('mention-blocker-bar');
        const progress = document.getElementById('mention-blocker-progress');
        if (bar && total > 1)      bar.style.width = `${Math.round(((current - 1) / total) * 100)}%`;
        if (progress && total > 1) progress.textContent = ` (${current} of ${total})`;
    }

    /** Remove the blocker overlay, toast, and focusout guard. Safe to call when already gone. */
    function hideMentionBlocker() {
        _mentionBlockerActive = false;
        // Remove focusout guard from the textarea
        if (_mentionFocusGuardTextarea && _mentionFocusGuardHandler) {
            _mentionFocusGuardTextarea.removeEventListener('focusout', _mentionFocusGuardHandler, true);
        }
        _mentionFocusGuardTextarea = null;
        _mentionFocusGuardHandler  = null;
        document.getElementById('mention-blocker-overlay')?.remove();
        document.getElementById('mention-blocker-toast')?.remove();
    }

    /* ==========================================================
     *  SECTION STATE MANAGEMENT (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getSectionStates() {
        return GM_getValue('ticketResponseSectionStates', {});
    }

    function saveSectionState(categoryKey, isCollapsed) {
        const states = getSectionStates();
        states[categoryKey] = isCollapsed;
        GM_setValue('ticketResponseSectionStates', states);
    }

    /**
     * Returns the saved section order for the given team, falling back to
     * that team's defaultSectionOrder if none is stored yet.
     * The 'custom' category is always guaranteed to be present.
     */
    function getSectionOrder(teamKey) {
        const team = RESPONSE_TEAMS[teamKey];
        const fallback = team ? [...team.defaultSectionOrder] : ['first_contact', 'responses', 'reminders', 'closures', 'workcomments', 'other', 'custom'];
        const storageKey = `ticketResponseSectionOrder_${teamKey}`;
        const order = GM_getValue(storageKey, fallback);

        // Ensure 'custom' is always present
        if (!order.includes('custom')) {
            order.push('custom');
            GM_setValue(storageKey, order);
        }
        return order;
    }

    function saveSectionOrder(order, teamKey) {
        const storageKey = `ticketResponseSectionOrder_${teamKey}`;
        GM_setValue(storageKey, order);
    }

    /* ==========================================================
     *  RECENTLY USED STORAGE
     * ==========================================================*/

    const MAX_RECENTLY_USED = 3;

    function getRecentlyUsed() {
        return GM_getValue('ticketResponseRecentlyUsed', []);
    }

    function trackRecentlyUsed(entry) {
        const recent = getRecentlyUsed().filter(r => r.key !== entry.key);
        recent.unshift(entry);
        GM_setValue('ticketResponseRecentlyUsed', recent.slice(0, MAX_RECENTLY_USED));
    }

    /* ==========================================================
     *  PINNED RESPONSES STORAGE
     * ==========================================================*/

    function getPinnedResponses() {
        return GM_getValue('ticketResponsePinned', []);
    }

    function savePinnedResponses(pinned) {
        GM_setValue('ticketResponsePinned', pinned);
    }

    function isPinned(key) {
        return getPinnedResponses().some(p => p.key === key);
    }

    function togglePinned(entry) {
        const pinned = getPinnedResponses();
        const idx = pinned.findIndex(p => p.key === entry.key);
        if (idx >= 0) pinned.splice(idx, 1);
        else pinned.push(entry);
        savePinnedResponses(pinned);
    }

    /* ==========================================================
     *  CUSTOM RESPONSES STORAGE (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getCustomResponses() {
        return GM_getValue('ticketResponseCustomResponses', []);
    }

    function saveCustomResponses(responses) {
        GM_setValue('ticketResponseCustomResponses', responses);
    }

    function generateCustomId() {
        return 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    function resolveCustomResponseText(rawText, vars) {
        return rawText
            .replace(/\{\{openedByName\}\}/g, vars.openedByName || 'User')
            .replace(/\{\{pageType\}\}/g, vars.pageType || 'ticket');
    }

    /* ==========================================================
     *  SETTINGS STORAGE
     * ==========================================================*/

    function getAutoUpdateDateEnabled() {
        return GM_getValue('ticketResponseAutoUpdateDate', true);
    }

    function setAutoUpdateDateEnabled(val) {
        GM_setValue('ticketResponseAutoUpdateDate', val);
    }

    // Solved Closure + Change Tracker summary: off by default
    function getSolvedChangeSummaryEnabled() {
        return GM_getValue('ticketResponseSolvedChangeSummary', false) === true;
    }

    function setSolvedChangeSummaryEnabled(val) {
        GM_setValue('ticketResponseSolvedChangeSummary', !!val);
    }

    // Paste clipboard into the ">" line of a template: off by default
    function getClipboardPasteEnabled() {
        return GM_getValue('ticketResponseClipboardPaste', false) === true;
    }

    function setClipboardPasteEnabled(val) {
        GM_setValue('ticketResponseClipboardPaste', !!val);
    }

    function getFooterEnabled() {
        return GM_getValue('ticketResponseFooterEnabled', false);
    }

    function setFooterEnabled(val) {
        GM_setValue('ticketResponseFooterEnabled', !!val);
    }

    function getFooterText() {
        return GM_getValue('ticketResponseFooterText', '');
    }

    function setFooterText(text) {
        GM_setValue('ticketResponseFooterText', text);
    }

    /* ==========================================================
     *  DATE UPDATE HELPERS
     * ==========================================================*/

    function getFormattedDate() {
        const today = new Date();
        const day   = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year  = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function getShortDescriptionInput() {
        return document.getElementById('sc_req_item.short_description') ||
               document.getElementById('incident.short_description') ||
               document.getElementById('sc_task.short_description');
    }

    function maybeUpdateShortDescriptionDate() {
        if (!getAutoUpdateDateEnabled()) return;
        const input = getShortDescriptionInput();
        if (!input) return;
        const currentValue = input.value.trim();
        if (!currentValue) return;
        const newDate = getFormattedDate();
        const datePattern = /^\d{2}-\d{2}-\d{4}/;
        const newValue = datePattern.test(currentValue)
            ? currentValue.replace(datePattern, newDate)
            : `${newDate} | ${currentValue}`;
        if (newValue === currentValue) return;
        input.value = newValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Named indices for the pipe-delimited short description format:
    // DD-MM-YYYY | MF | Product | Status | Vendor Case | Type | Complexity | PER | Tenant
    const SHORT_DESC_FIELDS = {
        date: 0, mf: 1, product: 2, status: 3,
        vendorCase: 4, type: 5, complexity: 6, per: 7, tenant: 8
    };

    function applyShortDescTransforms(transforms) {
        if (!transforms || !transforms.length) return;
        const input = getShortDescriptionInput();
        if (!input || !input.value.includes('|')) return;
        const parts = input.value.split('|').map(p => p.trim());
        let changed = false;
        transforms.forEach(t => {
            const idx = SHORT_DESC_FIELDS[t.field];
            if (idx !== undefined && idx < parts.length) {
                parts[idx] = t.value;
                changed = true;
            }
        });
        if (!changed) return;
        input.value = parts.join(' | ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ==========================================================
     *  CHANGE TRACKER SUMMARY (Solved Closure)
     *  Asks the Change Tracker script for this ticket's grouped change
     *  summary through page events (scripts do not share GM storage).
     *  The full summary goes to work notes; the comment gets the summary
     *  without its header, in place of the ">" line of the template.
     * ==========================================================*/

    function getTicketNumberForSummary() {
        for (const id of ['sc_req_item.number', 'incident.number', 'sc_task.number']) {
            const el = document.getElementById(id);
            if (el && el.value && el.value.trim()) return el.value.trim();
        }
        return null;
    }

    function requestChangeTrackerSummary(ticket, timeoutMs = 6000) {
        return new Promise(resolve => {
            const requestId = `trh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const cleanup = () => {
                document.removeEventListener('changeTracker:summaryResponse', onResponse);
                clearTimeout(timer);
            };
            const onResponse = (e) => {
                let data;
                try { data = JSON.parse(e.detail || '{}'); } catch (err) { return; }
                if (data.requestId !== requestId) return;
                cleanup();
                resolve(data);
            };
            const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
            document.addEventListener('changeTracker:summaryResponse', onResponse);
            document.dispatchEvent(new CustomEvent('changeTracker:summaryRequest', {
                detail: JSON.stringify({ requestId, ticket })
            }));
        });
    }

    // Drops "CHANGE SUMMARY ...", "Generated: ..." and the ═══ bar.
    function stripSummaryHeader(summary) {
        const lines = summary.split('\n');
        const bar = lines.findIndex(l => /^═{10,}$/.test(l.trim()));
        return (bar === -1 ? lines : lines.slice(bar + 1)).join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
    }

    function showSummaryNotice(text) {
        document.getElementById('responseHelperSummaryNotice')?.remove();
        const note = document.createElement('div');
        note.id = 'responseHelperSummaryNotice';
        note.textContent = text;
        Object.assign(note.style, {
            position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '100000', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107',
            borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '520px'
        });
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 5000);
    }

    // Returns the comment text to insert. For "solved" with the setting on,
    // also writes the full summary to work notes.
    async function applySolvedChangeSummary(key, text) {
        if (key !== 'solved' || !getSolvedChangeSummaryEnabled()) return text;
        const res = await requestChangeTrackerSummary(getTicketNumberForSummary());
        if (!res) {
            showSummaryNotice('Change Tracker did not answer, so Solved Closure was inserted without the change summary.');
            return text;
        }
        if (!res.summary) {
            showSummaryNotice('No Change Tracker entries for this ticket, so Solved Closure was inserted without a change summary.');
            return text;
        }

        // Work notes and comments only have separate boxes in dual input mode.
        if (isDualInputMode()) {
            const wn = document.getElementById('activity-stream-work_notes-textarea');
            if (wn) await insertTextWithMention(wn, res.summary, 'work_notes');
        } else {
            showSummaryNotice('Work notes and comments share one box on this ticket, so only the comment was filled in.');
        }

        if (!res.customerSummary) return text;
        const body = stripSummaryHeader(res.customerSummary);
        return /^>[ \t]*$/m.test(text) ? text.replace(/^>[ \t]*$/m, body) : text;
    }

    /* ==========================================================
     *  CLIPBOARD PASTE
     *  Replaces the first ">" line of a template with the clipboard
     *  text. Leaves the template as is when the setting is off, the
     *  template has no ">" line, or the clipboard is empty or blocked.
     * ==========================================================*/

    async function applyClipboardPaste(text) {
        if (!getClipboardPasteEnabled() || !/^>[ \t]*$/m.test(text)) return text;
        let clip = '';
        try {
            clip = await navigator.clipboard.readText();
        } catch (e) {
            showSummaryNotice('Could not read the clipboard. Allow clipboard access for this site to paste it into the response.');
            return text;
        }
        clip = (clip || '').replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
        if (!clip) return text;
        return text.replace(/^>[ \t]*$/m, () => clip);
    }

    /* ==========================================================
     *  VERSION CONTROL FUNCTIONS (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('ticketResponseVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('ticketResponseVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('ticketResponseChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('ticketResponseChangelogSeen', SCRIPT_VERSION);
    }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num2 > num1) return true;
            if (num2 < num1) return false;
        }
        return false;
    }

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    /* ==========================================================
     *  UTILITY FUNCTIONS
     * ==========================================================*/

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ==========================================================
     *  PAGE TYPE DETECTION
     * ==========================================================*/

    function getPageType() {
        const url = window.location.href;
        if (url.includes('/sc_req_item.do')) return 'request';
        if (url.includes('/incident.do'))    return 'incident';
        return 'ticket';
    }

    /* ==========================================================
     *  FIELD AVAILABILITY WATCHER
     * ==========================================================*/

    function waitForFieldAvailability() {
        return new Promise((resolve) => {
            const selectors = [
                'sc_req_item.opened_by_label',
                'sys_display.sc_req_item.opened_by',
                'incident.opened_by_label',
                'sys_display.incident.opened_by',
                'sc_req_item.caller_id_label',
                'sys_display.sc_req_item.caller_id',
                'incident.caller_id_label',
                'sys_display.incident.caller_id'
            ];

            for (const selector of selectors) {
                const field = document.getElementById(selector);
                if (field && (field.value || field.textContent)) {
                    console.log('✓ Field already available:', selector);
                    resolve(true);
                    return;
                }
            }

            console.log('⏳ Waiting for form fields to load...');
            const observer = new MutationObserver((mutations, obs) => {
                for (const selector of selectors) {
                    const field = document.getElementById(selector);
                    if (field && (field.value || field.textContent)) {
                        console.log('✓ Field detected via observer:', selector);
                        obs.disconnect();
                        resolve(true);
                        return;
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                console.warn('⚠️ Field availability timeout');
                resolve(false);
            }, 10000);
        });
    }

    /* ==========================================================
     *  ENHANCED NAME DETECTION WITH RETRY
     * ==========================================================*/

    async function getOpenedByName(retries = 5, delay = 300) {
        if (cachedOpenedByName) {
            console.log('✓ Using cached name:', cachedOpenedByName);
            return cachedOpenedByName;
        }

        const selectors = [
            'sc_req_item.opened_by_label',
            'sys_display.sc_req_item.opened_by',
            'incident.opened_by_label',
            'sys_display.incident.opened_by',
            'sc_req_item.caller_id_label',
            'sys_display.sc_req_item.caller_id',
            'incident.caller_id_label',
            'sys_display.incident.caller_id'
        ];

        for (let attempt = 0; attempt < retries; attempt++) {
            for (const selector of selectors) {
                const field = document.getElementById(selector);
                if (field) {
                    const name = field.value || field.textContent;
                    if (name && name.trim() && name.trim().length > 2) {
                        console.log(`✓ Found "Opened by" name on attempt ${attempt + 1}:`, name.trim());
                        cachedOpenedByName = name.trim();
                        return cachedOpenedByName;
                    }
                }
            }

            const labelFields = document.querySelectorAll('[id*="opened_by"], [id*="caller_id"]');
            for (const field of labelFields) {
                const name = field.value || field.textContent;
                if (name && name.trim() && !name.includes('_') && name.length > 2) {
                    console.log(`✓ Found name from fallback on attempt ${attempt + 1}:`, name.trim());
                    cachedOpenedByName = name.trim();
                    return cachedOpenedByName;
                }
            }

            if (attempt < retries - 1) {
                console.log(`⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }

        console.warn('⚠️ Could not find "Opened by" name after all retries, using placeholder');
        return null;
    }

    async function cacheOpenedByName() {
        await waitForFieldAvailability();
        cachedOpenedByName = await getOpenedByName();
        if (cachedOpenedByName) {
            console.log('✓ Cached opened by name:', cachedOpenedByName);
        }
    }

    /* ==========================================================
     *  DEBUG SERVICENOW MENTION SYSTEM
     * ==========================================================*/

    function debugMentionSystem() {
        console.group('🔍 ServiceNow Mention System Debug');
        const textarea = document.querySelector('#activity-stream-textarea');
        console.log('Textarea found:', !!textarea);
        console.log('Dual input mode:', isDualInputMode());
        console.log('Mention blocker active:', _mentionBlockerActive);
        console.log('g_form available:', typeof g_form !== 'undefined');
        console.log('Angular available:', typeof angular !== 'undefined');
        console.log('jQuery available:', typeof $ !== 'undefined');
        if (textarea) {
            const mentionElements = document.querySelectorAll('[class*="mention"], [data-mention], [class*="at-"], .atwho-view');
            console.log('Mention-related elements:', mentionElements.length);
            if (typeof $ !== 'undefined') {
                try { console.log('jQuery data on textarea:', $(textarea).data()); } catch (e) {}
            }
        }
        if (typeof window.SNMention !== 'undefined')    console.log('✓ SNMention found:', window.SNMention);
        if (typeof window.GlideMention !== 'undefined') console.log('✓ GlideMention found:', window.GlideMention);
        console.groupEnd();
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            debugMentionSystem();
        }
    });

    /* ==========================================================
     *  SERVICENOW API MENTION INSERTION
     * ==========================================================*/

    async function insertMentionViaAPI(textarea, name) {
        console.log('🔔 Attempting API-based mention insertion for:', name);
        try {
            if (typeof $ !== 'undefined' && $(textarea).data('atwho')) {
                const atwho = $(textarea).data('atwho');
                if (atwho && atwho.insert) { atwho.insert('@', name); return true; }
            }
            if (typeof angular !== 'undefined') {
                try {
                    const scope = angular.element(textarea).scope();
                    if (scope && scope.insertMention) { await scope.insertMention(name); return true; }
                } catch (e) { console.warn('Angular method failed:', e.message); }
            }
            if (textarea.mentionPlugin || textarea._mentionApi) {
                const api = textarea.mentionPlugin || textarea._mentionApi;
                if (api.insert || api.addMention) { (api.insert || api.addMention).call(api, name); return true; }
            }
            if (typeof window.SNMention !== 'undefined' && window.SNMention.insert) {
                window.SNMention.insert(textarea, name); return true;
            }
            if (typeof window.GlideMention !== 'undefined' && window.GlideMention.insert) {
                window.GlideMention.insert(textarea, name); return true;
            }
        } catch (error) {
            console.warn('⚠️ API insertion failed:', error);
            return false;
        }
        return false;
    }

    /* ==========================================================
     *  TEXT INSERTION HELPERS
     * ==========================================================*/

    function insertTextDirectly(textarea, text) {
        const start = textarea.selectionStart || 0;
        const end   = textarea.selectionEnd   || 0;
        const current = textarea.value;
        textarea.value = current.substring(0, start) + text + current.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input',  { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }

    async function triggerMentionPicker(textarea, name) {
        console.log('🔔 Triggering @ mention picker for:', name);
        textarea.focus();
        await sleep(100);

        insertTextDirectly(textarea, '@');
        await sleep(150);

        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: '@', inputType: 'insertText' }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { key: '@', code: 'Digit2', keyCode: 50, which: 50, shiftKey: true, bubbles: true, cancelable: true }));
        await sleep(400);

        for (const char of name) {
            insertTextDirectly(textarea, char);
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: char, inputType: 'insertText' }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
            await sleep(50);
        }

        await sleep(400);

        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        await sleep(200);

        const suggestionSelectors = ['.mention-suggestion', '.at-view-ul li', '[role="option"]', '.atwho-view li', '.atwho-view-ul li', '.mentions-autocomplete li', '[data-mention-item]'];
        for (const selector of suggestionSelectors) {
            const suggestion = document.querySelector(selector);
            if (suggestion && suggestion.offsetParent !== null) {
                console.log('✓ Found mention suggestion, clicking:', selector);
                suggestion.click();
                await sleep(200);
                return true;
            }
        }

        console.warn('⚠️ No mention suggestion found to click');
        return false;
    }

    /* ==========================================================
     *  MAIN MENTION INSERTION WITH STRATEGIES
     * ==========================================================*/

    async function insertTextWithMention(textarea, text, fieldType = 'comments') {
        // Footer: strip any existing footer from textarea to avoid duplication, then append to text
        if (getFooterEnabled()) {
            const footerText = getFooterText().trim();
            if (footerText) {
                const footerSuffix = FOOTER_SEPARATOR + footerText;
                if (textarea.value.endsWith(footerSuffix)) {
                    textarea.value = textarea.value.slice(0, -footerSuffix.length);
                }
                text = text + footerSuffix;
            }
        }

        console.group('📝 Inserting text with mentions');
        console.log('Text to insert:', text);

        const mentionRegex = /@\[([^\]]+)\]/g;
        const matches = text.match(mentionRegex);

        if (!matches || matches.length === 0) {
            console.log('ℹ️ No mentions detected, inserting as plain text');
            if (textarea.value.trim() !== "") {
                textarea.value += "\n\n" + text;
            } else {
                textarea.value = text;
            }
            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.groupEnd();
            return;
        }

        console.log('🔔 Mentions detected:', matches);

        const mentions = [];
        let match;
        mentionRegex.lastIndex = 0;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({ placeholder: match[0], name: match[1], index: match.index });
        }

        const parts = text.split(mentionRegex);
        console.log('Text parts:', parts);

        // Show blocker before any async work begins
        showMentionBlocker(mentions.length, 1, fieldType, textarea);

        try {
            const existingContent = textarea.value.trim();
            if (existingContent) {
                textarea.value = existingContent + "\n\n";
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            } else {
                textarea.value = '';
            }

            textarea.focus();
            await sleep(100);

            let partIndex = 0;
            for (let i = 0; i < mentions.length; i++) {
                if (i > 0) updateMentionBlocker(mentions.length, i + 1);
                if (parts[partIndex]) {
                    insertTextDirectly(textarea, parts[partIndex]);
                    await sleep(100);
                }
                partIndex++;
                await triggerMentionPicker(textarea, mentions[i].name);
                await sleep(200);
                partIndex++;
            }

            if (partIndex < parts.length && parts[partIndex]) {
                insertTextDirectly(textarea, parts[partIndex]);
            }

            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('✓ Text insertion complete');
        } finally {
            // Always release the blocker, even if an error was thrown
            hideMentionBlocker();
        }

        console.groupEnd();
    }

    /* ==========================================================
     *  CUSTOM RESPONSES MANAGEMENT MODAL
     * ==========================================================*/

    function showCustomResponsesModal(onUpdate) {
        const existingOverlay = document.getElementById('customResponsesModalOverlay');
        if (existingOverlay) existingOverlay.remove();
        const existingModal = document.getElementById('customResponsesModal');
        if (existingModal) existingModal.remove();

        let responses = getCustomResponses();

        const overlay = document.createElement('div');
        overlay.id = 'customResponsesModalOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'customResponsesModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '10001', background: '#fff', border: '2px solid #333', padding: '0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif',
            borderRadius: '10px', width: '640px', maxWidth: '95vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });

        const headerBar = document.createElement('div');
        Object.assign(headerBar.style, { padding: '16px 20px', borderBottom: '2px solid #667eea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', flexShrink: '0' });

        const title = document.createElement('h2');
        title.textContent = 'Custom Responses';
        Object.assign(title.style, { margin: '0', fontSize: '18px', color: '#333' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666', padding: '0 4px', lineHeight: '1' });
        closeBtn.onmouseover = () => closeBtn.style.color = '#333';
        closeBtn.onmouseout  = () => closeBtn.style.color = '#666';

        headerBar.appendChild(title);
        headerBar.appendChild(closeBtn);
        modal.appendChild(headerBar);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, { flex: '1', overflowY: 'auto', padding: '16px 20px' });
        modal.appendChild(contentArea);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, { padding: '12px 20px', borderTop: '1px solid #e0e0e0', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: '0' });

        const responseCount = document.createElement('span');
        Object.assign(responseCount.style, { fontSize: '12px', color: '#888' });

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Response';
        Object.assign(addBtn.style, { padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' });
        addBtn.onmouseover = () => addBtn.style.backgroundColor = '#218838';
        addBtn.onmouseout  = () => addBtn.style.backgroundColor = '#28a745';

        footerBar.appendChild(responseCount);
        footerBar.appendChild(addBtn);
        modal.appendChild(footerBar);

        // Badge helper for the list cards
        function makeFieldTypeBadge(fieldType) {
            const badge = document.createElement('span');
            const isWorkNotes = fieldType === 'work_notes';
            badge.textContent = isWorkNotes ? '🔒 Work Notes' : '💬 Comments';
            Object.assign(badge.style, {
                fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '3px',
                backgroundColor: isWorkNotes ? '#fff3cd' : '#d1ecf1',
                color: isWorkNotes ? '#856404' : '#0c5460',
                border: `1px solid ${isWorkNotes ? '#ffc107' : '#bee5eb'}`,
                whiteSpace: 'nowrap'
            });
            return badge;
        }

        function renderList() {
            responses = getCustomResponses();
            contentArea.innerHTML = '';
            responseCount.textContent = `${responses.length} custom response${responses.length !== 1 ? 's' : ''}`;

            if (responses.length === 0) {
                const empty = document.createElement('div');
                Object.assign(empty.style, { textAlign: 'center', padding: '40px 20px', color: '#999' });
                empty.innerHTML = `<div style="font-size: 36px; margin-bottom: 12px;">📝</div><div style="font-size: 15px; margin-bottom: 6px;">No custom responses yet</div><div style="font-size: 12px;">Click <strong>+ Add Response</strong> to create your first one.</div>`;
                contentArea.appendChild(empty);
                return;
            }

            responses.forEach((resp, index) => {
                const card = document.createElement('div');
                Object.assign(card.style, { border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 14px', marginBottom: '10px', backgroundColor: '#fafbfc', transition: 'box-shadow 0.2s ease' });
                card.onmouseover = () => card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                card.onmouseout  = () => card.style.boxShadow = 'none';

                const cardHeader = document.createElement('div');
                Object.assign(cardHeader.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' });

                const titleAndBadge = document.createElement('div');
                Object.assign(titleAndBadge.style, { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' });

                const titleSpan = document.createElement('span');
                titleSpan.textContent = resp.title;
                Object.assign(titleSpan.style, { fontWeight: 'bold', fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

                titleAndBadge.appendChild(titleSpan);
                titleAndBadge.appendChild(makeFieldTypeBadge(resp.fieldType || 'comments'));

                const btnGroup = document.createElement('div');
                Object.assign(btnGroup.style, { display: 'flex', gap: '6px', flexShrink: '0' });

                if (index > 0) {
                    const upBtn = createIconButton('▲', 'Move up', '#6c757d');
                    upBtn.onclick = () => {
                        [responses[index - 1], responses[index]] = [responses[index], responses[index - 1]];
                        saveCustomResponses(responses);
                        renderList();
                    };
                    btnGroup.appendChild(upBtn);
                }

                if (index < responses.length - 1) {
                    const downBtn = createIconButton('▼', 'Move down', '#6c757d');
                    downBtn.onclick = () => {
                        [responses[index], responses[index + 1]] = [responses[index + 1], responses[index]];
                        saveCustomResponses(responses);
                        renderList();
                    };
                    btnGroup.appendChild(downBtn);
                }

                const editBtn = createIconButton('✎', 'Edit', '#007bff');
                editBtn.onclick = () => showEditorView(resp, renderList);
                btnGroup.appendChild(editBtn);

                const deleteBtn = createIconButton('🗑', 'Delete', '#dc3545');
                deleteBtn.onclick = () => {
                    if (confirm(`Delete "${resp.title}"?`)) {
                        responses = responses.filter(r => r.id !== resp.id);
                        saveCustomResponses(responses);
                        renderList();
                        if (onUpdate) onUpdate();
                    }
                };
                btnGroup.appendChild(deleteBtn);

                cardHeader.appendChild(titleAndBadge);
                cardHeader.appendChild(btnGroup);
                card.appendChild(cardHeader);

                const preview = document.createElement('div');
                Object.assign(preview.style, { fontSize: '12px', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' });
                preview.textContent = resp.text.substring(0, 120) + (resp.text.length > 120 ? '…' : '');
                card.appendChild(preview);
                contentArea.appendChild(card);
            });
        }

        function createIconButton(icon, titleText, color) {
            const btn = document.createElement('button');
            btn.textContent = icon;
            btn.title = titleText;
            Object.assign(btn.style, { background: 'none', border: '1px solid ' + color, color, borderRadius: '4px', cursor: 'pointer', padding: '2px 7px', fontSize: '12px', lineHeight: '1.2' });
            btn.onmouseover = () => { btn.style.backgroundColor = color; btn.style.color = '#fff'; };
            btn.onmouseout  = () => { btn.style.backgroundColor = 'transparent'; btn.style.color = color; };
            return btn;
        }

        function showEditorView(existing, afterSave) {
            const isEdit = !!existing;
            contentArea.innerHTML = '';
            footerBar.style.display = 'none';

            const backRow = document.createElement('div');
            Object.assign(backRow.style, { marginBottom: '14px' });
            const backBtn = document.createElement('button');
            backBtn.textContent = '← Back to list';
            Object.assign(backBtn.style, { background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: '0', fontSize: '13px', textDecoration: 'underline' });
            backBtn.onclick = () => { document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove()); footerBar.style.display = 'flex'; renderList(); };
            backRow.appendChild(backBtn);
            contentArea.appendChild(backRow);

            const editorTitle = document.createElement('h3');
            editorTitle.textContent = isEdit ? 'Edit Response' : 'New Custom Response';
            Object.assign(editorTitle.style, { margin: '0 0 14px 0', fontSize: '16px', color: '#333' });
            contentArea.appendChild(editorTitle);

            // ── Title field ──────────────────────────────────────────────
            const titleLabel = document.createElement('label');
            titleLabel.textContent = 'Response Title';
            Object.assign(titleLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: '#444' });
            contentArea.appendChild(titleLabel);

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.placeholder = 'e.g. Follow-up with logs request';
            titleInput.value = isEdit ? existing.title : '';
            Object.assign(titleInput.style, { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' });
            titleInput.onfocus = () => titleInput.style.borderColor = '#667eea';
            titleInput.onblur  = () => titleInput.style.borderColor = '#ccc';
            contentArea.appendChild(titleInput);

            // ── Target field selector ─────────────────────────────────────
            const fieldTypeLabel = document.createElement('label');
            fieldTypeLabel.textContent = 'Target field';
            Object.assign(fieldTypeLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#444' });
            contentArea.appendChild(fieldTypeLabel);

            const fieldTypeRow = document.createElement('div');
            Object.assign(fieldTypeRow.style, {
                display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap'
            });

            const currentFieldType = (isEdit && existing.fieldType) ? existing.fieldType : 'comments';

            [
                { value: 'comments',   icon: '💬', label: 'Additional comments', sublabel: 'Customer visible' },
                { value: 'work_notes', icon: '🔒', label: 'Work notes',           sublabel: 'Internal only' }
            ].forEach(opt => {
                const pill = document.createElement('label');
                Object.assign(pill.style, {
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    padding: '8px 14px', border: '2px solid #dee2e6', borderRadius: '6px',
                    fontSize: '13px', userSelect: 'none', transition: 'all 0.15s ease',
                    backgroundColor: currentFieldType === opt.value ? '#f0f2ff' : '#fff',
                    borderColor: currentFieldType === opt.value ? '#667eea' : '#dee2e6'
                });

                const radio = document.createElement('input');
                radio.type  = 'radio';
                radio.name  = 'customFieldType';
                radio.value = opt.value;
                radio.checked = (currentFieldType === opt.value);
                Object.assign(radio.style, { margin: '0', cursor: 'pointer' });

                const textWrap = document.createElement('div');
                const mainText = document.createElement('div');
                mainText.textContent = `${opt.icon} ${opt.label}`;
                Object.assign(mainText.style, { fontWeight: '600', color: '#333' });
                const subText = document.createElement('div');
                subText.textContent = opt.sublabel;
                Object.assign(subText.style, { fontSize: '11px', color: '#888', marginTop: '1px' });
                textWrap.appendChild(mainText);
                textWrap.appendChild(subText);

                pill.appendChild(radio);
                pill.appendChild(textWrap);

                pill.addEventListener('change', () => {
                    fieldTypeRow.querySelectorAll('label').forEach(l => {
                        l.style.backgroundColor = '#fff';
                        l.style.borderColor = '#dee2e6';
                    });
                    pill.style.backgroundColor = '#f0f2ff';
                    pill.style.borderColor = '#667eea';
                });

                fieldTypeRow.appendChild(pill);
            });

            // Sync styling when radio changes by any means
            fieldTypeRow.addEventListener('change', () => {
                fieldTypeRow.querySelectorAll('label').forEach(pill => {
                    const r = pill.querySelector('input[type=radio]');
                    pill.style.backgroundColor = r.checked ? '#f0f2ff' : '#fff';
                    pill.style.borderColor      = r.checked ? '#667eea' : '#dee2e6';
                });
            });

            const fieldTypeHint = document.createElement('div');
            fieldTypeHint.textContent = 'In dual-input mode both fields are shown simultaneously — this setting controls which one receives the text.';
            Object.assign(fieldTypeHint.style, { fontSize: '11px', color: '#888', marginTop: '-8px', marginBottom: '14px' });

            contentArea.appendChild(fieldTypeRow);
            contentArea.appendChild(fieldTypeHint);

            // ── Body field ───────────────────────────────────────────────
            const bodyLabel = document.createElement('label');
            bodyLabel.textContent = 'Response Body';
            Object.assign(bodyLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: '#444' });
            contentArea.appendChild(bodyLabel);

            const varBar = document.createElement('div');
            Object.assign(varBar.style, { display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' });

            const varLabelEl = document.createElement('span');
            varLabelEl.textContent = 'Insert variable:';
            Object.assign(varLabelEl.style, { fontSize: '12px', color: '#666', marginRight: '2px' });
            varBar.appendChild(varLabelEl);

            const variables = [
                { label: '@Mention Opened By', value: '@[{{openedByName}}]', tooltip: '@ mention the ticket opener (triggers ServiceNow mention picker)' },
                { label: 'Page Type',           value: '{{pageType}}',        tooltip: 'Inserts "request" or "incident" based on ticket type' }
            ];

            variables.forEach(v => {
                const varBtnWrapper = document.createElement('div');
                Object.assign(varBtnWrapper.style, { position: 'relative', display: 'inline-block' });

                const tooltipEl = document.createElement('div');
                tooltipEl.className = 'custom-response-tooltip';
                tooltipEl.textContent = v.tooltip;
                Object.assign(tooltipEl.style, { position: 'fixed', background: '#333', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', zIndex: '20000', pointerEvents: 'none', display: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' });
                document.body.appendChild(tooltipEl);

                const varBtn = document.createElement('button');
                varBtn.textContent = v.label;
                Object.assign(varBtn.style, { padding: '4px 10px', fontSize: '12px', border: '1px solid #667eea', borderRadius: '4px', backgroundColor: '#f0f2ff', color: '#667eea', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s ease' });
                varBtn.onmouseover = (e) => {
                    varBtn.style.backgroundColor = '#667eea';
                    varBtn.style.color = '#fff';
                    const rect = varBtn.getBoundingClientRect();
                    tooltipEl.style.left = `${rect.left}px`;
                    tooltipEl.style.top  = `${rect.top - 30}px`;
                    tooltipEl.style.display = 'block';
                };
                varBtn.onmouseout = () => { varBtn.style.backgroundColor = '#f0f2ff'; varBtn.style.color = '#667eea'; tooltipEl.style.display = 'none'; };
                varBtn.onclick = () => {
                    const start = bodyTextarea.selectionStart;
                    const end   = bodyTextarea.selectionEnd;
                    const current = bodyTextarea.value;
                    bodyTextarea.value = current.substring(0, start) + v.value + current.substring(end);
                    bodyTextarea.selectionStart = bodyTextarea.selectionEnd = start + v.value.length;
                    bodyTextarea.focus();
                };

                varBtnWrapper.appendChild(varBtn);
                varBar.appendChild(varBtnWrapper);
            });

            contentArea.appendChild(varBar);

            const bodyTextarea = document.createElement('textarea');
            bodyTextarea.placeholder = 'Type your response here...\n\nUse the variable buttons above to insert dynamic values.';
            bodyTextarea.value = isEdit ? existing.text : '';
            Object.assign(bodyTextarea.style, { width: '100%', minHeight: '200px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '13px', fontFamily: 'Consolas, Monaco, "Courier New", monospace', lineHeight: '1.5', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' });
            bodyTextarea.onfocus = () => bodyTextarea.style.borderColor = '#667eea';
            bodyTextarea.onblur  = () => bodyTextarea.style.borderColor = '#ccc';
            contentArea.appendChild(bodyTextarea);

            const previewLabel = document.createElement('label');
            previewLabel.textContent = 'Preview (with sample values)';
            Object.assign(previewLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '12px', marginBottom: '4px', color: '#888' });
            contentArea.appendChild(previewLabel);

            const previewBox = document.createElement('div');
            Object.assign(previewBox.style, { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafbfc', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5', maxHeight: '150px', overflowY: 'auto', color: '#555', marginBottom: '14px' });
            contentArea.appendChild(previewBox);

            function updatePreview() {
                const sampleVars = { openedByName: cachedOpenedByName || 'John Doe', pageType: getPageType() };
                previewBox.textContent = resolveCustomResponseText(bodyTextarea.value, sampleVars) || '(empty)';
            }
            bodyTextarea.addEventListener('input', updatePreview);
            updatePreview();

            // ── Action buttons ────────────────────────────────────────────
            const actionRow = document.createElement('div');
            Object.assign(actionRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            Object.assign(cancelBtn.style, { padding: '8px 18px', backgroundColor: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' });
            cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f5f5f5';
            cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
            cancelBtn.onclick = () => { document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove()); footerBar.style.display = 'flex'; renderList(); };

            const saveBtn = document.createElement('button');
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Response';
            Object.assign(saveBtn.style, { padding: '8px 18px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' });
            saveBtn.onmouseover = () => saveBtn.style.backgroundColor = '#5568d3';
            saveBtn.onmouseout  = () => saveBtn.style.backgroundColor = '#667eea';
            saveBtn.onclick = () => {
                const newTitle = titleInput.value.trim();
                const newText  = bodyTextarea.value.trim();
                const selectedFieldType = fieldTypeRow.querySelector('input[name="customFieldType"]:checked')?.value || 'comments';

                if (!newTitle) { titleInput.style.borderColor = '#dc3545'; titleInput.focus(); return; }
                if (!newText)  { bodyTextarea.style.borderColor = '#dc3545'; bodyTextarea.focus(); return; }

                responses = getCustomResponses();
                if (isEdit) {
                    const idx = responses.findIndex(r => r.id === existing.id);
                    if (idx !== -1) {
                        responses[idx].title     = newTitle;
                        responses[idx].text      = newText;
                        responses[idx].fieldType = selectedFieldType;
                    }
                } else {
                    responses.push({ id: generateCustomId(), title: newTitle, text: newText, fieldType: selectedFieldType });
                }
                saveCustomResponses(responses);
                document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove());
                footerBar.style.display = 'flex';
                renderList();
                if (onUpdate) onUpdate();
            };

            actionRow.appendChild(cancelBtn);
            actionRow.appendChild(saveBtn);
            contentArea.appendChild(actionRow);
            titleInput.focus();
        }

        addBtn.onclick = () => showEditorView(null, renderList);

        const closeModal = () => {
            overlay.remove();
            modal.remove();
            document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove());
            if (onUpdate) onUpdate();
        };

        closeBtn.onclick = closeModal;
        overlay.onclick  = closeModal;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        renderList();
    }

    /* ==========================================================
     *  UI HELPER FUNCTIONS
     * ==========================================================*/

    function getCurrentTeamKey() {
        const stored = GM_getValue('shortDescTeam', null);   // shared with the Short Description Helper
        return stored && RESPONSE_TEAMS[stored] ? stored : null;
    }

    function saveTeam(teamKey) {
        GM_setValue('shortDescTeam', teamKey);
    }

    function showLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: '99999', display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const content = document.createElement('div');
        Object.assign(content.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' });

        const spinner = document.createElement('div');
        Object.assign(spinner.style, { width: '60px', height: '60px', border: '6px solid #f3f3f3', borderTop: '6px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' });
        content.appendChild(spinner);

        if (message) {
            const msgEl = document.createElement('div');
            Object.assign(msgEl.style, { fontSize: '14px', color: '#555', fontFamily: 'Arial, sans-serif', textAlign: 'center' });

            const msgText = document.createElement('span');
            msgText.textContent = message;

            const dotsEl = document.createElement('span');
            dotsEl.textContent = '.';

            let dotCount = 1;
            setInterval(() => {
                dotCount = dotCount >= 3 ? 1 : dotCount + 1;
                dotsEl.textContent = '.'.repeat(dotCount);
            }, 500);

            msgEl.appendChild(msgText);
            msgEl.appendChild(dotsEl);
            content.appendChild(msgEl);
        }

        overlay.appendChild(content);
        document.body.appendChild(overlay);
    }

    function parseChangelog() {
        const entries = [];
        let current = null;
        let currentBullet = null;
        for (const line of CHANGELOG.split('\n')) {
            const versionMatch = line.match(/^Version\s+([\d.]+):/);
            if (versionMatch) {
                if (currentBullet !== null && current) current.bullets.push(currentBullet);
                currentBullet = null;
                if (current) entries.push(current);
                current = { version: versionMatch[1], bullets: [] };
            } else if (line.trim().startsWith('-') && current) {
                if (currentBullet !== null) current.bullets.push(currentBullet);
                currentBullet = line.trim().slice(1).trim();
            } else if (line.trim() && current && currentBullet !== null) {
                currentBullet += ' ' + line.trim();
            }
        }
        if (currentBullet !== null && current) current.bullets.push(currentBullet);
        if (current) entries.push(current);
        return entries;
    }

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'changelogModalOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'changelogModal';
        Object.assign(modal.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '10001', background: '#fff', border: '2px solid #333', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', borderRadius: '10px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, { marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px' });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, { backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '15px', borderLeft: '4px solid #667eea' });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '0';
        parseChangelog().forEach((entry, index) => {
            const isLatest = index === 0;
            const card = document.createElement('div');
            Object.assign(card.style, {
                border:       '1px solid ' + (isLatest ? '#667eea' : '#e0e0e0'),
                borderRadius: '6px',
                marginBottom: '8px',
                overflow:     'hidden',
            });
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px',
                background: isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor: 'pointer', userSelect: 'none',
            });
            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';
            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: isLatest ? '#667eea' : '#555',
                fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);
            if (isLatest) {
                const tag = document.createElement('span');
                tag.textContent = 'Latest';
                Object.assign(tag.style, {
                    fontSize: '10px', fontWeight: 'bold',
                    background: '#667eea', color: '#fff',
                    borderRadius: '3px', padding: '1px 6px',
                    marginLeft: '8px', fontFamily: 'Arial, sans-serif',
                });
                versionWrap.appendChild(tag);
            }
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });
            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: isLatest ? '10px 14px' : '0',
                display: isLatest ? 'block' : 'none',
                background: '#fff',
            });
            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '3px 0',
                    fontSize: '13px', fontFamily: 'Arial, sans-serif',
                    color: '#444', lineHeight: '1.5',
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = bullet;
                row.appendChild(dot);
                row.appendChild(text);
                body.appendChild(row);
            });
            card.appendChild(body);
            let expanded = isLatest;
            header.addEventListener('click', () => {
                expanded = !expanded;
                body.style.display  = expanded ? 'block' : 'none';
                body.style.padding  = expanded ? '10px 14px' : '0';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            cardsWrap.appendChild(card);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, { marginTop: '15px', padding: '10px 20px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%' });
        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#5568d3';
        closeButton.onmouseout  = () => closeButton.style.backgroundColor = '#667eea';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            const changelogNotification = document.getElementById('changelogNotification');
            if (changelogNotification) changelogNotification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = () => closeButton.click();
    }

    function showHelpModal() {
        if (document.getElementById('responseHelperHelpModal')) return;

        /* ---- Reusable content helpers. lead/bullets/caption append to the section body;
         *      the others return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        // bullets: a compact list of short usage notes, each prefixed with a purple dot.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const t = document.createElement('span');
                t.textContent = item;
                row.appendChild(dot);
                row.appendChild(t);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        // caption: a small italic note placed directly under a visual to explain it.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        // span: an inline text node with optional extra styles.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: a horizontal, wrapping flex row that holds visual mocks side by side.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: a small colored rounded label. Use for categories and button previews.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: opts.radius || '4px', padding: opts.padding || '3px 8px',
                fontSize: opts.fontSize || '11px', fontWeight: opts.weight || 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block', lineHeight: '1.4'
            });
            return c;
        }

        // badgeRow: a button preview on the left with a one line description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = chip(item.label, item.bg, { color: item.color, border: item.border, padding: '4px 8px', radius: item.radius });
            badge.style.flexShrink = '0';
            if (item.minWidth) { badge.style.minWidth = item.minWidth; badge.style.textAlign = 'center'; }
            row.appendChild(badge);
            row.appendChild(span(item.desc, { fontSize: '12px', color: '#555', lineHeight: '1.5' }));
            body.appendChild(row);
        }

        // kvGrid: a two column key:value grid for field references and named settings.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '0 0 6px 0' });
            for (const [key, val] of pairs) {
                grid.appendChild(span(key, { fontFamily: 'monospace', fontSize: '11px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap' }));
                grid.appendChild(span(val, { fontSize: '12px', color: '#555', padding: '2px 0', lineHeight: '1.4' }));
            }
            body.appendChild(grid);
        }

        // formatBox: a monospace box for a fixed format or a template.
        function formatBox(body, text) {
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                padding: '9px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#333',
                margin: '0 0 8px 0', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5'
            });
            box.textContent = text;
            body.appendChild(box);
        }

        // beforeAfter: labelled rows showing how something changes, e.g. Before / After.
        function beforeAfter(body, rows) {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { margin: '0 0 8px 0', borderRadius: '6px', border: '1px solid #d0d0f0', overflow: 'hidden' });
            rows.forEach(([label, text, good], i) => {
                const row = hrow([
                    span(label, { fontSize: '10px', fontWeight: 'bold', color: good ? '#2a7d4f' : '#888', textTransform: 'uppercase', width: '62px', flexShrink: '0' }),
                    span(text, { fontFamily: 'monospace', fontSize: '11px', color: '#333', whiteSpace: 'pre-wrap' })
                ], { padding: '7px 12px', margin: '0', flexWrap: 'nowrap', alignItems: 'flex-start',
                     background: good ? '#f2fff7' : '#f8f8ff', borderBottom: i < rows.length - 1 ? '1px solid #e8e8f0' : 'none' });
                wrap.appendChild(row);
            });
            body.appendChild(wrap);
        }

        // panelMock: a white card that stands in for a panel or window of the script.
        function panelMock(children, extra) {
            const p = document.createElement('div');
            Object.assign(p.style, {
                border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '400px', margin: '0 0 8px 0'
            }, extra || {});
            children.forEach(c => p.appendChild(c));
            return p;
        }

        // mockField: a labelled input or dropdown as it appears in the real form.
        function mockField(label, value, opts) {
            opts = opts || {};
            const row = hrow([
                span(label, { fontSize: '11px', fontWeight: 'bold', color: '#555', width: opts.labelWidth || '110px', flexShrink: '0' })
            ], { margin: '0 0 5px 0', flexWrap: 'nowrap', gap: '8px' });
            const box = document.createElement('div');
            Object.assign(box.style, {
                flex: '1', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px solid #ccc', borderRadius: '4px', padding: '3px 8px', minHeight: '16px',
                background: opts.locked ? '#efefef' : '#fff'
            });
            box.appendChild(span(value, { fontSize: '11px', color: opts.placeholder ? '#aaa' : '#333', fontStyle: opts.placeholder ? 'italic' : 'normal' }));
            if (opts.caret) box.appendChild(span('▾', { fontSize: '10px', color: '#999' }));
            row.appendChild(box);
            return row;
        }

        // toggle: a ticked or unticked checkbox preview with an optional one line description.
        function toggle(label, on, desc) {
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            const box = span(on ? '✓' : '', {
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: '0', boxSizing: 'border-box',
                border: on ? 'none' : '1px solid #b0b0b0', background: on ? '#667eea' : '#fff', color: '#fff',
                fontSize: '11px', lineHeight: '15px', textAlign: 'center', display: 'inline-block'
            });
            wrap.appendChild(hrow([ box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' }) ], { margin: '0', flexWrap: 'nowrap' }));
            if (desc) wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px', lineHeight: '1.4' }));
            return wrap;
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    lead(body, 'A blue Quick Response button appears next to the Short Description field of every ticket.');
                    body.appendChild(hrow([
                        span('Short description', { fontSize: '12px', fontWeight: 'bold', color: '#333' }),
                        span('13-10-2026 | UK | DLP | WIP | ...', { fontSize: '11px', fontFamily: 'monospace', color: '#555', border: '1px solid #ccc', borderRadius: '3px', padding: '3px 8px', background: '#fff' }),
                        chip('🗣 Quick Response', '#669bea', { fontSize: '12px', padding: '5px 10px' })
                    ], { gap: '6px', margin: '0 0 6px 0' }));
                    caption(body, 'Click it to open the list of response templates for your team.');
                    bullets(body, [
                        'Pick a template and it is written into the ticket straight away.',
                        'Works on RITMs and Incidents, opened in a new tab or from the dashboard.'
                    ]);
                }
            },
            {
                icon: '📂',
                title: 'The Response List',
                buildContent: (body) => {
                    lead(body, 'Templates are grouped in sections. Type in the search box to filter all of them at once.');
                    const item = (label, color, extra) => hrow([
                        span(label, { fontSize: '12px', color: '#000' }),
                        hrow([
                            extra ? span(extra, { fontSize: '11px', color: '#999' }) : span(''),
                            span('', { width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }),
                            span('📌', { fontSize: '11px', opacity: '0.25' })
                        ], { gap: '6px', margin: '0', flexWrap: 'nowrap' })
                    ], { justifyContent: 'space-between', flexWrap: 'nowrap', padding: '6px 12px', margin: '0', borderBottom: '1px solid #f0f0f0' });
                    const head = (t, bg) => span(t, { display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#555', background: bg, padding: '5px 12px', textTransform: 'uppercase', letterSpacing: '.7px', borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de' });
                    const list = document.createElement('div');
                    Object.assign(list.style, { border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', maxWidth: '400px', background: '#fff', margin: '0 0 8px 0' });
                    list.appendChild(hrow([
                        span('Team: EMEA Team • v2.21', { fontSize: '10px', color: '#888' }),
                        chip('⚙ Settings', 'transparent', { color: '#555', border: '1px solid #ccc', fontSize: '10px' }),
                        chip('? Help', 'transparent', { color: '#667eea', border: '1px solid #c0c8f0', fontSize: '10px' })
                    ], { padding: '6px 12px', margin: '0', gap: '6px', background: '#f8f9fa' }));
                    list.appendChild(span('Filter templates…', { display: 'block', fontSize: '11px', color: '#aaa', fontStyle: 'italic', border: '1px solid #d0d0d0', borderRadius: '4px', padding: '4px 8px', margin: '6px 12px' }));
                    list.appendChild(head('First contact ▼', '#f1f3f5'));
                    list.appendChild(item('Initial Contact', '#17a2b8'));
                    list.appendChild(head('Responses ▼', '#f1f3f5'));
                    list.appendChild(item('SSL/Domain/App Bypass', '#17a2b8', '❯'));
                    list.appendChild(head('Work Notes Comments ▼', '#f1f3f5'));
                    list.appendChild(item('# URL Check', '#ffc107'));
                    body.appendChild(list);
                    bullets(body, [
                        'Click a section header to fold or unfold it.',
                        'Templates with ❯ open a side menu with their variants when you point at them.',
                        'Sections: First contact, Responses, Reminders, Closures, Work Notes Comments, Other and Custom.'
                    ]);
                }
            },
            {
                icon: '🎯',
                title: 'Where a Response Goes',
                buildContent: (body) => {
                    lead(body, 'Each template goes to the customer comments or to the internal work notes.');
                    const dot = (c) => span('', { width: '9px', height: '9px', borderRadius: '50%', background: c, display: 'inline-block' });
                    body.appendChild(hrow([ dot('#17a2b8'), chip('Additional comments', '#0066cc'), span('Customer facing: the requester sees it.', { fontSize: '12px', color: '#555' }) ], { margin: '0 0 6px 0', gap: '8px' }));
                    body.appendChild(hrow([ dot('#ffc107'), chip('Work Notes', '#5a6672'), span('Internal only: your team sees it.', { fontSize: '12px', color: '#555' }) ], { margin: '0 0 6px 0', gap: '8px' }));
                    caption(body, 'The colored dot beside each template shows its target. Dots appear when the ticket shows both fields.');
                }
            },
            {
                icon: '📌',
                title: 'Pinned and Recently Used',
                buildContent: (body) => {
                    lead(body, 'Two sections can appear at the top so your favourite templates are one click away.');
                    const row = (label, pinned) => hrow([ span(label, { fontSize: '12px', color: '#000' }), span('📌', { fontSize: '11px', opacity: pinned ? '1' : '0.25' }) ],
                        { justifyContent: 'space-between', padding: '6px 12px', margin: '0', borderBottom: '1px solid #f0f0f0', flexWrap: 'nowrap' });
                    const head = (t, bg) => span(t, { display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#555', background: bg, padding: '5px 12px', textTransform: 'uppercase', letterSpacing: '.7px' });
                    const list = document.createElement('div');
                    Object.assign(list.style, { border: '1px solid #d4d8de', borderRadius: '6px', overflow: 'hidden', maxWidth: '340px', background: '#fff', margin: '0 0 6px 0' });
                    list.append(head('📌 Pinned', '#eef0ff'), row('SSL Bypass', true), head('⏱ Recently Used', '#fff8e1'), row('Initial Contact', false), row('First Reminder', false));
                    body.appendChild(list);
                    bullets(body, [
                        'Click the faded 📌 of a template to pin it, click again to unpin. Pinned parents keep their variants.',
                        'Recently Used always shows your last 3 templates.'
                    ]);
                }
            },
            {
                icon: '🏷️',
                title: 'Status in the Short Description',
                buildContent: (body) => {
                    lead(body, 'Inserting a response also sets the matching status in the short description.');
                    beforeAfter(body, [
                        ['Before', '01-10-2026 | MF | Product | WIP | ...', false],
                        ['After', '13-10-2026 | MF | Product | Closed | ...', true]
                    ]);
                    kvGrid(body, [
                        ['Waiting Requester', 'Contact, information requests, reminders, bypasses and changes'],
                        ['WIP', '"Working on the request" reminder and SOC Tier 2 task request'],
                        ['Waiting Vendor', 'Vendor case, recategorization and IDEA requests'],
                        ['Waiting SPM', 'SPM request loaded'],
                        ['Closed', 'Solved, Timeout and End User closures']
                    ]);
                    caption(body, 'Work note templates leave the status as it is. The date updates too when that setting is on.');
                }
            },
            {
                icon: '👤',
                title: 'Names and @Mentions',
                buildContent: (body) => {
                    lead(body, 'Templates greet the requester by name, read from the Opened by field, and @mention them.');
                    beforeAfter(body, [
                        ['Template', 'Hi @[Name], our team has taken ownership...', false],
                        ['Inserted', 'Hi @Jane Smith, our team has taken ownership...', true]
                    ]);
                    const bar = hrow([
                        span('Inserting @mention (1 of 2)', { fontSize: '12px', color: '#fff' }),
                        span('→ Comments', { fontSize: '12px', color: '#67e8f9' }),
                        span('⛔ do not click', { fontSize: '11px', color: '#fca5a5' })
                    ], { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '1px solid rgba(102,126,234,0.55)', borderRadius: '8px', padding: '8px 14px', display: 'inline-flex', margin: '4px 0 0 0' });
                    body.appendChild(bar);
                    caption(body, 'This banner shows while the mentions are added. Do not click until it goes away.');
                    bullets(body, [
                        'If the name cannot be read, "User" is used so you can correct it before saving.'
                    ]);
                }
            },
            {
                icon: '📋',
                title: 'Paste Clipboard into Responses',
                buildContent: (body) => {
                    lead(body, 'With this setting on, a template\'s empty ">" line is filled with what you copied.');
                    beforeAfter(body, [
                        ['Template', 'The following URLs have been bypassed:\n>', false],
                        ['Inserted', 'The following URLs have been bypassed:\n> example.com\n> app.example.com', true]
                    ]);
                    caption(body, 'Off by default. Your browser may ask once for clipboard access. If the clipboard is empty, the ">" stays for you to fill in.');
                }
            },
            {
                icon: '✦',
                title: 'Custom Responses',
                buildContent: (body) => {
                    lead(body, 'Write your own templates. They appear in the Custom section and only on your computer.');
                    badgeRow(body, { bg: '#f0f2ff', color: '#667eea', border: '1px solid #667eea', label: '✦ Manage Custom Responses', desc: 'In the list header. Opens the editor.' });
                    body.appendChild(panelMock([
                        mockField('Response Title', 'Escalation update', { labelWidth: '100px' }),
                        hrow([
                            span('Target field', { fontSize: '11px', fontWeight: 'bold', color: '#555', width: '100px', flexShrink: '0' }),
                            chip('💬 Additional comments', '#e8f0fe', { color: '#1d4ed8', border: '1px solid #667eea' }),
                            chip('🔒 Work notes', '#fff', { color: '#555', border: '1px solid #ccc' })
                        ], { margin: '0 0 6px 0', gap: '6px' }),
                        hrow([
                            span('Insert variable:', { fontSize: '11px', color: '#666' }),
                            chip('@Mention Opened By', '#fff', { color: '#667eea', border: '1px solid #c0c8f0', weight: 'normal' }),
                            chip('Page Type', '#fff', { color: '#667eea', border: '1px solid #c0c8f0', weight: 'normal' })
                        ], { margin: '0 0 4px 0', gap: '6px' }),
                        span('Hi @[{{openedByName}}], your {{pageType}} has been escalated.', { display: 'block', fontSize: '11px', fontFamily: 'monospace', border: '1px solid #ccc', borderRadius: '4px', padding: '6px 8px', color: '#333' })
                    ]));
                    caption(body, 'A preview below the body shows the text with sample values.');
                    body.appendChild(hrow([
                        chip('▲', '#6c757d'), chip('▼', '#6c757d'), chip('✎', '#007bff'), chip('🗑', '#dc3545'),
                        span('Reorder, edit or delete a saved response.', { fontSize: '12px', color: '#555' })
                    ], { gap: '4px', margin: '6px 0 0 0' }));
                }
            },
            {
                icon: '📝',
                title: 'Footer Signature',
                buildContent: (body) => {
                    lead(body, 'Turn on "Append footer on insert" in Settings to add your signature under every response.');
                    beforeAfter(body, [
                        ['Before', 'Hi Jane,\nThe bypass is now in place.', false],
                        ['After', 'Hi Jane,\nThe bypass is now in place.\n──────────────\nKind regards, EMEA Netskope Team', true]
                    ]);
                    bullets(body, [
                        'Edit, next to the setting, changes the footer text.',
                        'An empty comment field starts with the footer already in it. A response never adds it twice.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Settings',
                buildContent: (body) => {
                    lead(body, 'The list header holds these buttons.');
                    badgeRow(body, { bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Settings', desc: 'Opens the settings below.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Suite', desc: 'Opens the Ticket Helpers settings: tools, team, tenant URLs and backups. The team is shared with the Short Description Helper.' });
                    badgeRow(body, { bg: 'transparent', color: '#0066cc', label: "🔵 What's New", desc: 'Beside the version after an update. Opens the changelog.' });
                    body.appendChild(span('Inside Settings', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '8px 0 6px 0' }));
                    body.appendChild(toggle('Auto-update date on insert', true, 'Sets the short description date to today whenever you insert a response.'));
                    body.appendChild(toggle('Add Change Tracker summary to Solved Closure', false, 'Solved Closure also writes the ticket\'s Change Tracker summary to the work notes and lists the changes in the comment.'));
                    body.appendChild(toggle('Paste clipboard into responses', false, 'Fills the empty ">" line of a response with what you copied.'));
                    body.appendChild(toggle('Append footer on insert', false, 'Adds your footer signature to every response. Edit changes its text.'));
                    kvGrid(body, [
                        ['👥 Switch Team', 'Changes your team (EMEA, AME or APAC), each with its own templates.']
                    ]);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'responseHelperHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'responseHelperHelpModal';

        // Modal header row
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📖';
        titleIcon.style.fontSize = '22px';
        const titleText = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, {
            fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif'
        });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Ticket Response Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, {
            fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif'
        });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };

        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // Section cards
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden'
            });

            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
            });

            const headerLeft = document.createElement('span');
            headerLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
            const iconEl = document.createElement('span');
            iconEl.textContent = section.icon;
            iconEl.style.fontSize = '14px';
            const titleLabel = document.createElement('span');
            titleLabel.textContent = section.title;
            Object.assign(titleLabel.style, {
                fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif'
            });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);

            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block'
            });

            cardHeader.appendChild(headerLeft);
            cardHeader.appendChild(chevron);

            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);

            card.appendChild(cardHeader);
            card.appendChild(cardBody);

            let expanded = true;
            cardHeader.addEventListener('click', () => {
                expanded = !expanded;
                cardBody.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });

            contentWrap.appendChild(card);
        }
        modal.appendChild(contentWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();

        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  FOOTER SIGNATURE
     * ==========================================================*/

    const FOOTER_SEPARATOR = '\n\n[code]<hr>[/code]\n\n';

    function showFooterEditModal() {
        if (document.getElementById('responseHelperFooterEditOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'responseHelperFooterEditOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: '10002' });

        const modal = document.createElement('div');
        modal.id = 'responseHelperFooterEditModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '10003', background: '#fff', border: '2px solid #333',
            padding: '0', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif', borderRadius: '10px',
            minWidth: '400px', maxWidth: '560px', width: '90vw'
        });

        const headerBar = document.createElement('div');
        Object.assign(headerBar.style, {
            padding: '14px 18px', borderBottom: '2px solid #667eea',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f8f9fa', borderRadius: '8px 8px 0 0'
        });
        const title = document.createElement('h2');
        title.textContent = 'Edit Footer';
        Object.assign(title.style, { margin: '0', fontSize: '15px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666', padding: '0', lineHeight: '1' });
        closeX.onmouseover = () => closeX.style.color = '#333';
        closeX.onmouseout  = () => closeX.style.color = '#666';
        closeX.onclick = () => { overlay.remove(); modal.remove(); };
        headerBar.appendChild(title);
        headerBar.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '16px 18px' });

        const hint = document.createElement('div');
        hint.textContent = 'This text is appended to every inserted response, separated by a horizontal rule.';
        Object.assign(hint.style, { fontSize: '12px', color: '#777', marginBottom: '12px', fontFamily: 'Arial, sans-serif' });
        body.appendChild(hint);

        const ta = document.createElement('textarea');
        ta.value = getFooterText();
        Object.assign(ta.style, {
            width: '100%', minHeight: '120px', padding: '8px 10px',
            border: '1px solid #ccc', borderRadius: '4px',
            fontSize: '12px', fontFamily: 'Arial, sans-serif', lineHeight: '1.5',
            resize: 'vertical', boxSizing: 'border-box', color: '#333', background: '#fff'
        });
        body.appendChild(ta);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, {
            padding: '12px 18px', borderTop: '1px solid #e0e0e0',
            display: 'flex', justifyContent: 'flex-end', gap: '8px',
            background: '#f8f9fa', borderRadius: '0 0 8px 8px'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            padding: '7px 16px', background: '#e9ecef', color: '#555',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'Arial, sans-serif'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.background = '#dee2e6';
        cancelBtn.onmouseout  = () => cancelBtn.style.background = '#e9ecef';
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        Object.assign(saveBtn.style, {
            padding: '7px 16px', background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif'
        });
        saveBtn.onmouseover = () => saveBtn.style.background = '#5568d3';
        saveBtn.onmouseout  = () => saveBtn.style.background = '#667eea';
        saveBtn.onclick = () => {
            setFooterText(ta.value);
            overlay.remove();
            modal.remove();
        };

        footerBar.appendChild(cancelBtn);
        footerBar.appendChild(saveBtn);
        modal.appendChild(headerBar);
        modal.appendChild(body);
        modal.appendChild(footerBar);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); modal.remove(); } };
    }

    function maybeInjectFooterSignature() {
        if (!getFooterEnabled()) return;
        const footerText = getFooterText().trim();
        if (!footerText) return;
        const textarea = getTargetTextarea('comments');
        if (!textarea) {
            setTimeout(maybeInjectFooterSignature, 800);
            return;
        }
        if (textarea.value.trim() === '') {
            textarea.value = FOOTER_SEPARATOR + footerText;
            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function showSettingsModal() {
        if (document.getElementById('responseHelperSettingsOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'responseHelperSettingsOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'responseHelperSettingsModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '10001', background: '#fff', border: '2px solid #333',
            padding: '0', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif', borderRadius: '10px',
            minWidth: '360px', maxWidth: '460px'
        });

        const headerBar = document.createElement('div');
        Object.assign(headerBar.style, {
            padding: '14px 18px', borderBottom: '2px solid #667eea',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f8f9fa', borderRadius: '8px 8px 0 0'
        });
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        Object.assign(title.style, { margin: '0', fontSize: '15px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666', padding: '0', lineHeight: '1' });
        closeX.onmouseover = () => closeX.style.color = '#333';
        closeX.onmouseout  = () => closeX.style.color = '#666';
        closeX.onclick = () => { overlay.remove(); modal.remove(); };
        headerBar.appendChild(title);
        headerBar.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '16px 18px' });

        // Toggle row: auto-update date
        const toggleRow = document.createElement('div');
        Object.assign(toggleRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' });

        const labelCol = document.createElement('div');
        const labelText = document.createElement('div');
        labelText.textContent = 'Auto-update date on insert';
        Object.assign(labelText.style, { fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Arial, sans-serif' });
        const labelDesc = document.createElement('div');
        labelDesc.textContent = 'Updates the short description date to today when a response is inserted.';
        Object.assign(labelDesc.style, { fontSize: '11px', color: '#777', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
        labelCol.appendChild(labelText);
        labelCol.appendChild(labelDesc);

        const toggleLabel = document.createElement('label');
        Object.assign(toggleLabel.style, { position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: '0', marginLeft: '16px' });
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = getAutoUpdateDateEnabled();
        Object.assign(toggleInput.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
        const slider = document.createElement('span');
        Object.assign(slider.style, {
            position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0',
            backgroundColor: toggleInput.checked ? '#667eea' : '#ccc',
            borderRadius: '22px', transition: 'background-color 0.25s'
        });
        const knob = document.createElement('span');
        Object.assign(knob.style, {
            position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px',
            backgroundColor: '#fff', borderRadius: '50%', transition: 'transform 0.25s',
            transform: toggleInput.checked ? 'translateX(18px)' : 'translateX(0)'
        });
        slider.appendChild(knob);
        toggleInput.onchange = () => {
            const on = toggleInput.checked;
            setAutoUpdateDateEnabled(on);
            slider.style.backgroundColor = on ? '#667eea' : '#ccc';
            knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
        };
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(slider);

        toggleRow.appendChild(labelCol);
        toggleRow.appendChild(toggleLabel);
        body.appendChild(toggleRow);

        // Toggle row: Change Tracker summary in Solved Closure
        const summaryRow = document.createElement('div');
        Object.assign(summaryRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0' });

        const summaryLabelCol = document.createElement('div');
        const summaryLabelText = document.createElement('div');
        summaryLabelText.textContent = 'Add Change Tracker summary to Solved Closure';
        Object.assign(summaryLabelText.style, { fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Arial, sans-serif' });
        const summaryLabelDesc = document.createElement('div');
        summaryLabelDesc.textContent = 'Solved Closure also writes the ticket\'s Change Tracker summary to the work notes and lists the changes in the comment. Needs the Change Tracker script.';
        Object.assign(summaryLabelDesc.style, { fontSize: '11px', color: '#777', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
        summaryLabelCol.appendChild(summaryLabelText);
        summaryLabelCol.appendChild(summaryLabelDesc);

        const summaryToggleLabel = document.createElement('label');
        Object.assign(summaryToggleLabel.style, { position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: '0', marginLeft: '16px' });
        const summaryToggleInput = document.createElement('input');
        summaryToggleInput.type = 'checkbox';
        summaryToggleInput.checked = getSolvedChangeSummaryEnabled();
        Object.assign(summaryToggleInput.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
        const summarySlider = document.createElement('span');
        Object.assign(summarySlider.style, {
            position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0',
            backgroundColor: summaryToggleInput.checked ? '#667eea' : '#ccc',
            borderRadius: '22px', transition: 'background-color 0.25s'
        });
        const summaryKnob = document.createElement('span');
        Object.assign(summaryKnob.style, {
            position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px',
            backgroundColor: '#fff', borderRadius: '50%', transition: 'transform 0.25s',
            transform: summaryToggleInput.checked ? 'translateX(18px)' : 'translateX(0)'
        });
        summarySlider.appendChild(summaryKnob);
        summaryToggleInput.onchange = () => {
            const on = summaryToggleInput.checked;
            setSolvedChangeSummaryEnabled(on);
            summarySlider.style.backgroundColor = on ? '#667eea' : '#ccc';
            summaryKnob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
        };
        summaryToggleLabel.appendChild(summaryToggleInput);
        summaryToggleLabel.appendChild(summarySlider);

        summaryRow.appendChild(summaryLabelCol);
        summaryRow.appendChild(summaryToggleLabel);
        body.appendChild(summaryRow);

        // Toggle row: paste clipboard into the ">" line
        const clipRow = document.createElement('div');
        Object.assign(clipRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0' });

        const clipLabelCol = document.createElement('div');
        const clipLabelText = document.createElement('div');
        clipLabelText.textContent = 'Paste clipboard into responses';
        Object.assign(clipLabelText.style, { fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Arial, sans-serif' });
        const clipLabelDesc = document.createElement('div');
        clipLabelDesc.textContent = 'Fills the empty ">" line of a response (for example the list of bypassed URLs) with what you have copied. Your browser may ask once for clipboard access.';
        Object.assign(clipLabelDesc.style, { fontSize: '11px', color: '#777', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
        clipLabelCol.appendChild(clipLabelText);
        clipLabelCol.appendChild(clipLabelDesc);

        const clipToggleLabel = document.createElement('label');
        Object.assign(clipToggleLabel.style, { position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: '0', marginLeft: '16px' });
        const clipToggleInput = document.createElement('input');
        clipToggleInput.type = 'checkbox';
        clipToggleInput.checked = getClipboardPasteEnabled();
        Object.assign(clipToggleInput.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
        const clipSlider = document.createElement('span');
        Object.assign(clipSlider.style, {
            position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0',
            backgroundColor: clipToggleInput.checked ? '#667eea' : '#ccc',
            borderRadius: '22px', transition: 'background-color 0.25s'
        });
        const clipKnob = document.createElement('span');
        Object.assign(clipKnob.style, {
            position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px',
            backgroundColor: '#fff', borderRadius: '50%', transition: 'transform 0.25s',
            transform: clipToggleInput.checked ? 'translateX(18px)' : 'translateX(0)'
        });
        clipSlider.appendChild(clipKnob);
        clipToggleInput.onchange = () => {
            const on = clipToggleInput.checked;
            setClipboardPasteEnabled(on);
            clipSlider.style.backgroundColor = on ? '#667eea' : '#ccc';
            clipKnob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
        };
        clipToggleLabel.appendChild(clipToggleInput);
        clipToggleLabel.appendChild(clipSlider);

        clipRow.appendChild(clipLabelCol);
        clipRow.appendChild(clipToggleLabel);
        body.appendChild(clipRow);

        // Separator
        const separator = document.createElement('div');
        Object.assign(separator.style, { borderTop: '1px solid #e0e0e0', margin: '10px 0' });
        body.appendChild(separator);

        // Footer section
        const footerSectionTitle = document.createElement('div');
        footerSectionTitle.textContent = '📝 Footer Signature';
        Object.assign(footerSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '8px', fontFamily: 'Arial, sans-serif'
        });
        body.appendChild(footerSectionTitle);

        const footerToggleRow = document.createElement('div');
        Object.assign(footerToggleRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' });

        const footerLabelCol = document.createElement('div');
        const footerLabelText = document.createElement('div');
        footerLabelText.textContent = 'Append footer on insert';
        Object.assign(footerLabelText.style, { fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Arial, sans-serif' });
        const footerLabelDesc = document.createElement('div');
        footerLabelDesc.textContent = 'Adds a separator and footer text to every inserted response.';
        Object.assign(footerLabelDesc.style, { fontSize: '11px', color: '#777', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
        footerLabelCol.appendChild(footerLabelText);
        footerLabelCol.appendChild(footerLabelDesc);

        const footerControls = document.createElement('div');
        Object.assign(footerControls.style, { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0', marginLeft: '12px' });

        const editFooterBtn = document.createElement('button');
        editFooterBtn.textContent = 'Edit';
        Object.assign(editFooterBtn.style, {
            padding: '4px 10px', background: 'transparent', color: '#667eea',
            border: '1px solid #c0c8f0', borderRadius: '4px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif'
        });
        editFooterBtn.onmouseover = () => { editFooterBtn.style.background = '#eef0ff'; };
        editFooterBtn.onmouseout  = () => { editFooterBtn.style.background = 'transparent'; };
        editFooterBtn.onclick = () => showFooterEditModal();

        const footerToggleLabel = document.createElement('label');
        Object.assign(footerToggleLabel.style, { position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: '0' });
        const footerToggleInput = document.createElement('input');
        footerToggleInput.type = 'checkbox';
        footerToggleInput.checked = getFooterEnabled();
        Object.assign(footerToggleInput.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
        const footerSlider = document.createElement('span');
        Object.assign(footerSlider.style, {
            position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0',
            backgroundColor: footerToggleInput.checked ? '#667eea' : '#ccc',
            borderRadius: '22px', transition: 'background-color 0.25s'
        });
        const footerKnob = document.createElement('span');
        Object.assign(footerKnob.style, {
            position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px',
            backgroundColor: '#fff', borderRadius: '50%', transition: 'transform 0.25s',
            transform: footerToggleInput.checked ? 'translateX(18px)' : 'translateX(0)'
        });
        footerSlider.appendChild(footerKnob);
        footerToggleInput.onchange = () => {
            const on = footerToggleInput.checked;
            setFooterEnabled(on);
            footerSlider.style.backgroundColor = on ? '#667eea' : '#ccc';
            footerKnob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
        };
        footerToggleLabel.appendChild(footerToggleInput);
        footerToggleLabel.appendChild(footerSlider);

        footerControls.appendChild(editFooterBtn);
        footerControls.appendChild(footerToggleLabel);
        footerToggleRow.appendChild(footerLabelCol);
        footerToggleRow.appendChild(footerControls);
        body.appendChild(footerToggleRow);

        // Separator before Team section
        const separator2 = document.createElement('div');
        Object.assign(separator2.style, { borderTop: '1px solid #e0e0e0', margin: '10px 0' });
        body.appendChild(separator2);

        // Team section
        const teamSectionTitle = document.createElement('div');
        teamSectionTitle.textContent = '👥 Team';
        Object.assign(teamSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '8px', fontFamily: 'Arial, sans-serif'
        });
        body.appendChild(teamSectionTitle);

        const teamRow = document.createElement('div');
        Object.assign(teamRow.style, {
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '12px'
        });

        const currentTeamKey = getCurrentTeamKey();
        const currentTeam = currentTeamKey ? RESPONSE_TEAMS[currentTeamKey] : null;

        const teamLabel = document.createElement('span');
        teamLabel.textContent = `Current team: ${currentTeam ? currentTeam.name : 'None'}`;
        Object.assign(teamLabel.style, {
            fontSize: '13px', color: '#555', fontFamily: 'Arial, sans-serif'
        });

        const switchTeamModalBtn = document.createElement('button');
        switchTeamModalBtn.textContent = 'Switch Team';
        Object.assign(switchTeamModalBtn.style, {
            padding: '6px 14px', background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
            transition: 'background 0.2s ease', flexShrink: '0'
        });
        switchTeamModalBtn.onmouseover = () => { switchTeamModalBtn.style.background = '#5568d3'; };
        switchTeamModalBtn.onmouseout  = () => { switchTeamModalBtn.style.background = '#667eea'; };
        switchTeamModalBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            GM_deleteValue('shortDescTeam');   // shared team: both helpers ask again
            isInitialized = false;
            showLoadingOverlay('Reloading page to select team');
            setTimeout(() => location.reload(), 100);
        };

        teamRow.appendChild(teamLabel);
        teamRow.appendChild(switchTeamModalBtn);
        body.appendChild(teamRow);

        modal.appendChild(headerBar);
        modal.appendChild(body);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); modal.remove(); } };
    }

    function showTeamSelector() {
        if (document.getElementById('ticketResponseTeamSelector')) return;

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'ticketResponseTeamSelector';
        Object.assign(selectorContainer.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '10000', background: '#fff', border: '1px solid #ddd', borderTop: '4px solid #667eea', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', borderRadius: '10px', textAlign: 'center', minWidth: '400px' });

        const title = document.createElement('h2');
        title.textContent = 'Select Your Team';
        title.style.marginBottom = '8px';
        title.style.color = '#667eea';
        selectorContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Ticket Response Helper Script';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#667eea';
        subtitle.style.fontSize = '12px';
        subtitle.style.fontWeight = 'bold';
        subtitle.style.letterSpacing = '0.5px';
        subtitle.style.textTransform = 'uppercase';
        selectorContainer.appendChild(subtitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        for (const [key, team] of Object.entries(RESPONSE_TEAMS)) {
            const btn = document.createElement('button');
            btn.textContent = team.name;
            Object.assign(btn.style, { padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', border: '2px solid #667eea', borderRadius: '6px', backgroundColor: '#667eea', color: 'white', cursor: 'pointer', transition: 'all 0.3s ease' });
            btn.onmouseover = () => { btn.style.backgroundColor = '#5568d3'; btn.style.borderColor = '#5568d3'; };
            btn.onmouseout  = () => { btn.style.backgroundColor = '#667eea'; btn.style.borderColor = '#667eea'; };
            btn.onclick = () => {
                saveTeam(key);
                selectorContainer.remove();
                initializeDropdown();
            };
            buttonContainer.appendChild(btn);
        }

        selectorContainer.appendChild(buttonContainer);
        document.body.appendChild(selectorContainer);
    }

    /* ==========================================================
     *  POSITION DROPDOWN FUNCTION
     * ==========================================================*/

    function positionDropdown(dropdown, button) {
        const rect = button.getBoundingClientRect();
        dropdown.style.top  = `${rect.bottom + window.scrollY + 5}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
    }

    /* ==========================================================
     *  BUILD DROPDOWN MENU WITH COLLAPSIBLE SECTIONS
     * ==========================================================*/

    function buildDropdownMenu(team, teamKey, inlineButton) {
        const categories = {
            first_contact: { label: 'First contact',          items: [] },
            responses:     { label: 'Responses',              items: [] },
            reminders:     { label: 'Reminders',              items: [] },
            closures:      { label: 'Closures',               items: [] },
            workcomments:  { label: 'Work Notes Comments',    items: [] },
            other:         { label: 'Other',                  items: [] },
            custom:        { label: 'Custom',                 items: [] }
        };

        team.enabledResponses.forEach(responseKey => {
            const metadata = team.responseMetadata[responseKey];
            if (metadata && categories[metadata.category] && !metadata.parentItem) {
                categories[metadata.category].items.push({ value: responseKey, label: metadata.label });
            }
        });

        const customResponses = getCustomResponses();
        customResponses.forEach(cr => {
            categories.custom.items.push({ value: cr.id, label: cr.title, isCustom: true, customText: cr.text, fieldType: cr.fieldType || 'comments' });
        });

        const dropdown = document.createElement('div');
        dropdown.id = 'ticket-response-dropdown';
        Object.assign(dropdown.style, { position: 'absolute', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '9999', fontFamily: 'Arial, sans-serif', minWidth: '280px', maxHeight: '500px', display: 'none', flexDirection: 'column' });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, { padding: '12px 15px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' });

        const teamInfo = document.createElement('div');
        Object.assign(teamInfo.style, {
            fontSize: '11px', color: '#666', marginBottom: '6px',
            display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
        });
        const teamInfoText = document.createElement('span');
        teamInfoText.textContent = `Team: ${team.name} • v${SCRIPT_VERSION}`;
        teamInfo.appendChild(teamInfoText);

        // "What's New" notification sits directly after the version number
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';
            Object.assign(changelogNotification.style, { display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '0', background: 'none', border: 'none' });

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';
            Object.assign(notificationDot.style, { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' });

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = "What's New";
            Object.assign(notificationText.style, { fontSize: '11px', color: '#0066cc', textDecoration: 'underline' });

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onmouseover = () => notificationText.style.color = '#0052a3';
            changelogNotification.onmouseout  = () => notificationText.style.color = '#0066cc';
            changelogNotification.onclick = () => showChangelogModal();
            teamInfo.appendChild(changelogNotification);
        }

        const actionButtons = document.createElement('div');
        Object.assign(actionButtons.style, { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' });

        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙ Settings';
        Object.assign(settingsBtn.style, {
            color: '#555', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px', border: '1px solid #ccc',
            fontWeight: 'bold', userSelect: 'none', backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease', fontFamily: 'Arial, sans-serif'
        });
        settingsBtn.onmouseover = () => { settingsBtn.style.backgroundColor = '#f0f0f0'; };
        settingsBtn.onmouseout  = () => { settingsBtn.style.backgroundColor = 'transparent'; };
        settingsBtn.onclick = () => {
            dropdown.style.display = 'none';
            showSettingsModal();
        };
        actionButtons.appendChild(settingsBtn);

        const helpBtn = document.createElement('button');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px', border: '1px solid #c0c8f0',
            fontWeight: 'bold', userSelect: 'none', backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease', fontFamily: 'Arial, sans-serif'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => { dropdown.style.display = 'none'; showHelpModal(); };
        actionButtons.appendChild(helpBtn);
        actionButtons.appendChild(createSuitePill());

        const manageCustomRow = document.createElement('div');
        Object.assign(manageCustomRow.style, { marginTop: '8px' });

        const manageCustomBtn = document.createElement('button');
        manageCustomBtn.textContent = '✦ Manage Custom Responses';
        Object.assign(manageCustomBtn.style, { padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#f0f2ff', color: '#667eea', border: '1px solid #667eea', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s ease', width: '100%' });
        manageCustomBtn.onmouseover = () => { manageCustomBtn.style.backgroundColor = '#667eea'; manageCustomBtn.style.color = '#fff'; };
        manageCustomBtn.onmouseout  = () => { manageCustomBtn.style.backgroundColor = '#f0f2ff'; manageCustomBtn.style.color = '#667eea'; };
        manageCustomBtn.onclick = () => {
            dropdown.style.display = 'none';
            showCustomResponsesModal(() => rebuildDropdownContent(dropdown, team, teamKey, inlineButton));
        };
        manageCustomRow.appendChild(manageCustomBtn);

        header.appendChild(teamInfo);
        header.appendChild(actionButtons);
        header.appendChild(manageCustomRow);
        dropdown.appendChild(header);

        const searchRow = document.createElement('div');
        Object.assign(searchRow.style, { padding: '7px 12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fff' });
        const searchInput = document.createElement('input');
        searchInput.id = 'response-search-input';
        searchInput.type = 'text';
        searchInput.placeholder = 'Filter templates…';
        Object.assign(searchInput.style, {
            width: '100%', padding: '5px 8px', fontSize: '12px',
            border: '1px solid #d0d0d0', borderRadius: '4px',
            fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none', color: '#333',
        });
        searchInput.addEventListener('focus', () => { searchInput.style.borderColor = '#0066cc'; });
        searchInput.addEventListener('blur',  () => { searchInput.style.borderColor = '#d0d0d0'; });
        searchInput.addEventListener('input', () => { filterItems(optionsContainer, searchInput.value); });
        searchRow.appendChild(searchInput);
        dropdown.appendChild(searchRow);

        const optionsContainer = document.createElement('div');
        optionsContainer.id = 'sections-container';
        Object.assign(optionsContainer.style, { overflowY: 'auto', maxHeight: '400px' });
        dropdown.appendChild(optionsContainer);

        buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown);

        return dropdown;
    }

    /* ==========================================================
     *  BUILD SECTIONS CONTENT
     * ==========================================================*/

    function buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown) {
        optionsContainer.innerHTML = '';

        const sectionStates = getSectionStates();
        const sectionOrder  = getSectionOrder(teamKey);
        const rebuildFn     = () => rebuildDropdownContent(dropdown, team, teamKey);

        // ── Pinned section ──
        const pinnedItems = getPinnedResponses();
        if (pinnedItems.length > 0) {
            const pinnedSection = document.createElement('div');
            pinnedSection.className = 'category-section';
            pinnedSection.dataset.categoryKey = 'pinned';

            const pinnedHeader = document.createElement('div');
            Object.assign(pinnedHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: '#eef0ff', borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                textTransform: 'uppercase', letterSpacing: '0.7px',
            });
            pinnedHeader.textContent = '📌 Pinned';

            const pinnedItemsContainer = document.createElement('div');
            pinnedItemsContainer.className = 'category-items';

            pinnedItems.forEach(entry => {
                const ft = entry.fieldType || 'comments';
                if (entry.hasSubmenu) {
                    pinnedItemsContainer.appendChild(buildSubmenuParentOption(entry.key, entry.label, ft, team, dropdown, rebuildFn));
                } else {
                    const option = buildMenuOption(entry.label, ft, async () => {
                        trackRecentlyUsed(entry);
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(ft);
                        if (textarea) {
                            const text = entry.isCustom
                                ? resolveCustomResponseText(entry.customText, vars)
                                : team.responses[entry.key](vars);
                            await insertTextWithMention(textarea, await applyClipboardPaste(entry.isCustom ? text : await applySolvedChangeSummary(entry.key, text)), ft);
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                            if (!entry.isCustom) {
                                const pinnedMeta = team.responseMetadata[entry.key];
                                if (pinnedMeta && pinnedMeta.shortDescTransforms) applyShortDescTransforms(pinnedMeta.shortDescTransforms);
                            }
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, entry, rebuildFn);
                    pinnedItemsContainer.appendChild(option);
                }
            });

            pinnedSection.appendChild(pinnedHeader);
            pinnedSection.appendChild(pinnedItemsContainer);
            optionsContainer.appendChild(pinnedSection);
        }

        // ── Recently Used section ──
        const recentItems = getRecentlyUsed();
        if (recentItems.length > 0) {
            const recentSection = document.createElement('div');
            recentSection.className = 'category-section';
            recentSection.dataset.categoryKey = 'recently_used';

            const recentHeader = document.createElement('div');
            Object.assign(recentHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: '#fff8e1', borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                textTransform: 'uppercase', letterSpacing: '0.7px',
            });
            recentHeader.textContent = '⏱ Recently Used';

            const recentItemsContainer = document.createElement('div');
            recentItemsContainer.className = 'category-items';

            recentItems.forEach(entry => {
                const ft = entry.fieldType || 'comments';
                const option = buildMenuOption(entry.label, ft, async () => {
                    trackRecentlyUsed(entry);
                    const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                    const textarea = getTargetTextarea(ft);
                    if (textarea) {
                        const text = entry.isCustom
                            ? resolveCustomResponseText(entry.customText, vars)
                            : team.responses[entry.key](vars);
                        await insertTextWithMention(textarea, await applyClipboardPaste(entry.isCustom ? text : await applySolvedChangeSummary(entry.key, text)), ft);
                        flashTargetField(textarea);
                        maybeUpdateShortDescriptionDate();
                        if (!entry.isCustom) {
                            const recentMeta = team.responseMetadata[entry.key];
                            if (recentMeta && recentMeta.shortDescTransforms) applyShortDescTransforms(recentMeta.shortDescTransforms);
                        }
                    }
                    dropdown.style.display = 'none';
                });
                recentItemsContainer.appendChild(option);
            });

            recentSection.appendChild(recentHeader);
            recentSection.appendChild(recentItemsContainer);
            optionsContainer.appendChild(recentSection);
        }

        sectionOrder.forEach(catKey => {
            const category = categories[catKey];
            if (!category || category.items.length === 0) return;

            const sectionWrapper = document.createElement('div');
            sectionWrapper.className = 'category-section';
            sectionWrapper.dataset.categoryKey = catKey;

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            Object.assign(categoryHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: catKey === 'custom' ? '#ebe8ff' : '#e9edf2',
                borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                cursor: 'pointer', userSelect: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textTransform: 'uppercase', letterSpacing: '0.7px'
            });

            const categoryLabel = document.createElement('span');
            categoryLabel.textContent = catKey === 'custom' ? `✦ ${category.label}` : category.label;

            const collapseIndicator = document.createElement('span');
            const isCollapsed = sectionStates[catKey] === true;
            collapseIndicator.textContent = isCollapsed ? '▶' : '▼';
            collapseIndicator.style.fontSize = '10px';

            categoryHeader.appendChild(categoryLabel);
            categoryHeader.appendChild(collapseIndicator);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'category-items';
            Object.assign(itemsContainer.style, { display: isCollapsed ? 'none' : 'block', transition: 'all 0.2s ease' });

            category.items.forEach(item => {
                if (item.isCustom) {
                    const option = buildMenuOption(item.label, item.fieldType || 'comments', async () => {
                        trackRecentlyUsed({ key: item.value, label: item.label, fieldType: item.fieldType || 'comments', isCustom: true, customText: item.customText });
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(item.fieldType || 'comments');
                        if (textarea) {
                            await insertTextWithMention(textarea, await applyClipboardPaste(resolveCustomResponseText(item.customText, vars)), item.fieldType || 'comments');
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, { key: item.value, label: item.label, fieldType: item.fieldType || 'comments', isCustom: true, customText: item.customText }, rebuildFn);
                    itemsContainer.appendChild(option);
                    return;
                }

                const metadata = team.responseMetadata[item.value];
                const fieldType = (metadata && metadata.fieldType) ? metadata.fieldType : 'comments';

                if (metadata && metadata.hasSubmenu) {
                    itemsContainer.appendChild(buildSubmenuParentOption(item.value, item.label, fieldType, team, dropdown, rebuildFn));

                } else if (!metadata || !metadata.parentItem) {
                    const option = buildMenuOption(item.label, fieldType, async () => {
                        trackRecentlyUsed({ key: item.value, label: item.label, fieldType });
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(fieldType);
                        if (textarea) {
                            await insertTextWithMention(textarea, await applyClipboardPaste(await applySolvedChangeSummary(item.value, team.responses[item.value](vars))), fieldType);
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                            if (metadata && metadata.shortDescTransforms) applyShortDescTransforms(metadata.shortDescTransforms);
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, { key: item.value, label: item.label, fieldType }, rebuildFn);
                    itemsContainer.appendChild(option);
                }
            });

            categoryHeader.onclick = () => {
                const isCurrentlyCollapsed = itemsContainer.style.display === 'none';
                itemsContainer.style.display = isCurrentlyCollapsed ? 'block' : 'none';
                collapseIndicator.textContent = isCurrentlyCollapsed ? '▼' : '▶';
                saveSectionState(catKey, !isCurrentlyCollapsed);
            };

            sectionWrapper.appendChild(categoryHeader);
            sectionWrapper.appendChild(itemsContainer);
            optionsContainer.appendChild(sectionWrapper);
        });
    }

    /**
     * Tiny coloured dot that appears to the right of each menu item label,
     * indicating whether it targets Work Notes (amber) or Comments (teal).
     * Only visible in dual-input mode to avoid noise; always rendered in the
     * DOM but hidden via opacity when single-input mode is detected at build
     * time — recheck is done each time the dropdown opens via the button.
     */
    function makeFieldTypePip(fieldType) {
        const pip = document.createElement('span');
        pip.className = 'field-type-pip';
        pip.dataset.fieldType = fieldType;
        const isWorkNotes = fieldType === 'work_notes';
        Object.assign(pip.style, {
            display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: isWorkNotes ? '#ffc107' : '#17a2b8',
            opacity: isDualInputMode() ? '1' : '0',
            transition: 'opacity 0.2s ease',
            flexShrink: '0'
        });
        pip.title = isWorkNotes ? 'Goes to: Work Notes' : 'Goes to: Additional comments';
        return pip;
    }

    function filterItems(optionsContainer, query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            const states = getSectionStates();
            optionsContainer.querySelectorAll('.category-section').forEach(section => {
                section.style.display = '';
                section.querySelectorAll('[data-filter-label]').forEach(item => { item.style.display = ''; });
                const itemsEl = section.querySelector('.category-items');
                if (itemsEl) {
                    const catKey = section.dataset.categoryKey;
                    itemsEl.style.display = (catKey !== 'recently_used' && states[catKey]) ? 'none' : 'block';
                }
            });
            return;
        }
        optionsContainer.querySelectorAll('.category-section').forEach(section => {
            let visible = 0;
            section.querySelectorAll('[data-filter-label]').forEach(item => {
                const match = item.dataset.filterLabel.includes(q);
                item.style.display = match ? '' : 'none';
                if (match) visible++;
            });
            section.style.display = visible > 0 ? '' : 'none';
            const itemsEl = section.querySelector('.category-items');
            if (itemsEl) itemsEl.style.display = 'block';
        });
    }

    function buildMenuOption(label, fieldType, onClickHandler) {
        const option = document.createElement('div');
        option.dataset.filterLabel = label.toLowerCase();
        Object.assign(option.style, {
            padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000',
            borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const rightGroup = document.createElement('span');
        rightGroup.className = 'menu-option-right-group';
        Object.assign(rightGroup.style, { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0' });
        rightGroup.appendChild(makeFieldTypePip(fieldType));

        option.appendChild(labelSpan);
        option.appendChild(rightGroup);

        option.onmouseover = () => option.style.backgroundColor = '#f0f0f0';
        option.onmouseout  = () => option.style.backgroundColor = 'transparent';
        option.onclick     = onClickHandler;
        return option;
    }

    function attachPinButton(option, entry, rebuildFn) {
        const rightGroup = option.querySelector('.menu-option-right-group');
        if (!rightGroup) return;
        const pinBtn = document.createElement('span');
        const pinned = isPinned(entry.key);
        pinBtn.textContent = '📌';
        pinBtn.title = pinned ? 'Unpin' : 'Pin to top';
        Object.assign(pinBtn.style, {
            fontSize: '11px', cursor: 'pointer', lineHeight: '1', flexShrink: '0',
            opacity: pinned ? '1' : '0.25', transition: 'opacity 0.15s ease',
        });
        pinBtn.onmouseover = () => { pinBtn.style.opacity = '0.85'; };
        pinBtn.onmouseout  = () => { pinBtn.style.opacity = isPinned(entry.key) ? '1' : '0.25'; };
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            togglePinned(entry);
            rebuildFn();
        };
        rightGroup.appendChild(pinBtn);
    }

    function buildSubmenuParentOption(key, label, fieldType, team, dropdown, rebuildFn) {
        const parentOption = document.createElement('div');
        Object.assign(parentOption.style, { padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const rightGroup = document.createElement('span');
        rightGroup.className = 'menu-option-right-group';
        Object.assign(rightGroup.style, { display: 'flex', alignItems: 'center', gap: '6px' });
        rightGroup.appendChild(makeFieldTypePip(fieldType));
        const arrowSpan = document.createElement('span');
        arrowSpan.textContent = '❯';
        arrowSpan.style.fontSize = '10px';
        arrowSpan.style.color = '#666';
        rightGroup.appendChild(arrowSpan);

        parentOption.appendChild(labelSpan);
        parentOption.appendChild(rightGroup);

        const submenu = document.createElement('div');
        submenu.className = 'bypass-submenu';
        Object.assign(submenu.style, { position: 'fixed', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: '200px', display: 'none', zIndex: '10001' });
        document.body.appendChild(submenu);

        const submenuItems = team.enabledResponses
            .map(responseKey => {
                const subMeta = team.responseMetadata[responseKey];
                return (subMeta && subMeta.parentItem === key)
                    ? { value: responseKey, label: subMeta.label, fieldType: subMeta.fieldType || 'comments' }
                    : null;
            })
            .filter(Boolean);

        parentOption.dataset.filterLabel = [label, ...submenuItems.map(s => s.label)].join(' ').toLowerCase();

        submenuItems.forEach(subItem => {
            const subOption = buildMenuOption(subItem.label, subItem.fieldType, async (e) => {
                e.stopPropagation();
                trackRecentlyUsed({ key: subItem.value, label: subItem.label, fieldType: subItem.fieldType });
                const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                const textarea = getTargetTextarea(subItem.fieldType);
                if (textarea) {
                    await insertTextWithMention(textarea, await applyClipboardPaste(team.responses[subItem.value](vars)), subItem.fieldType);
                    flashTargetField(textarea);
                    maybeUpdateShortDescriptionDate();
                    const subMeta = team.responseMetadata[subItem.value];
                    if (subMeta && subMeta.shortDescTransforms) applyShortDescTransforms(subMeta.shortDescTransforms);
                }
                dropdown.style.display = 'none';
                submenu.style.display = 'none';
            });
            attachPinButton(subOption, { key: subItem.value, label: subItem.label, fieldType: subItem.fieldType }, rebuildFn);
            submenu.appendChild(subOption);
        });

        parentOption.onmouseover = () => {
            parentOption.style.backgroundColor = '#f0f0f0';
            const rect = parentOption.getBoundingClientRect();
            submenu.style.top  = `${rect.top}px`;
            submenu.style.left = `${rect.right}px`;
            submenu.style.display = 'block';
        };
        parentOption.onmouseout = (e) => {
            if (!submenu.contains(e.relatedTarget)) {
                parentOption.style.backgroundColor = 'transparent';
                submenu.style.display = 'none';
            }
        };
        submenu.onmouseleave  = () => { submenu.style.display = 'none'; parentOption.style.backgroundColor = 'transparent'; };
        submenu.onmouseenter  = () => { parentOption.style.backgroundColor = '#f0f0f0'; };

        attachPinButton(parentOption, { key, label, fieldType, hasSubmenu: true }, rebuildFn);
        return parentOption;
    }

    /* ==========================================================
     *  UPDATE PIPS VISIBILITY ON DROPDOWN OPEN
     * =========================================================*/

    /**
     * Called each time the dropdown is shown. Refreshes all pip visibility
     * in case the user switched between single/dual mode between opens.
     */
    function refreshFieldTypePips(dropdown) {
        const dual = isDualInputMode();
        dropdown.querySelectorAll('.field-type-pip').forEach(pip => {
            pip.style.opacity = dual ? '1' : '0';
        });
    }

    /* ==========================================================
     *  REBUILD DROPDOWN CONTENT (after custom responses change)
     * ==========================================================*/

    function rebuildDropdownContent(dropdown, team, teamKey, inlineButton) {
        const optionsContainer = dropdown.querySelector('#sections-container');
        if (!optionsContainer) return;

        document.querySelectorAll('.bypass-submenu').forEach(sm => sm.remove());

        const categories = {
            first_contact: { label: 'First contact',       items: [] },
            responses:     { label: 'Responses',           items: [] },
            reminders:     { label: 'Reminders',           items: [] },
            closures:      { label: 'Closures',            items: [] },
            workcomments:  { label: 'Work Notes Comments', items: [] },
            other:         { label: 'Other',               items: [] },
            custom:        { label: 'Custom',              items: [] }
        };

        team.enabledResponses.forEach(responseKey => {
            const metadata = team.responseMetadata[responseKey];
            if (metadata && categories[metadata.category] && !metadata.parentItem) {
                categories[metadata.category].items.push({ value: responseKey, label: metadata.label });
            }
        });

        getCustomResponses().forEach(cr => {
            categories.custom.items.push({ value: cr.id, label: cr.title, isCustom: true, customText: cr.text, fieldType: cr.fieldType || 'comments' });
        });

        buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown);
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50%       { background-color: #ff8c00; }
        }
        @keyframes spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        /* Mention blocker spinner */
        @keyframes mentionSpin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .mention-blocker-spinner { animation: mentionSpin 0.7s linear infinite; }
        /* Slide-down entrance for the toast */
        @keyframes mentionToastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-14px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #mention-blocker-toast { animation: mentionToastIn 0.2s ease forwards; }
        .notification-dot { animation: colorPulse 1s ease-in-out infinite; }
        #ticket-response-dropdown::-webkit-scrollbar       { width: 8px; }
        #ticket-response-dropdown::-webkit-scrollbar-track { background: #f1f1f1; }
        #ticket-response-dropdown::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
        #ticket-response-dropdown::-webkit-scrollbar-thumb:hover { background: #555; }
        .category-header:hover  { background-color: #e9ecef !important; }
        .category-header:active { background-color: #dee2e6 !important; }

        /* Dark mode isolation */
        #ticket-response-dropdown, #customResponsesModal,
        #teamSelector, #changelogModal,
        #responseHelperSettingsModal,
        #responseHelperFooterEditModal { color: #333333 !important; }
        #responseHelperSummaryNotice { background-color: #fff3cd !important; color: #856404 !important; }
        #ticket-response-dropdown input, #ticket-response-dropdown select,
        #ticket-response-dropdown textarea,
        #customResponsesModal input, #customResponsesModal select,
        #customResponsesModal textarea,
        #teamSelector input, #teamSelector select, #teamSelector textarea,
        #changelogModal input, #changelogModal select, #changelogModal textarea,
        #responseHelperSettingsModal input, #responseHelperSettingsModal select,
        #responseHelperSettingsModal textarea,
        #responseHelperFooterEditModal input, #responseHelperFooterEditModal select,
        #responseHelperFooterEditModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #ticket-response-dropdown { background-color: #ffffff !important; }
        #customResponsesModal { background-color: #ffffff !important; }
        #changelogModal { background-color: #ffffff !important; }
        #responseHelperSettingsModal { background-color: #ffffff !important; }
        #responseHelperFooterEditModal { background-color: #ffffff !important; }

        /* Help Modal */
        #responseHelperHelpModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        }
        #responseHelperHelpModal {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            width: 640px;
            max-width: 92vw;
            max-height: 82vh;
            overflow-y: auto;
            color: #333333 !important;
        }
        #responseHelperHelpModal input, #responseHelperHelpModal select,
        #responseHelperHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  MAIN INITIALIZATION
     * ==========================================================*/

    function initializeDropdown() {
        if (document.getElementById('ticket-response-inline-button')) return;

        const teamKey = getCurrentTeamKey();
        if (!teamKey) { showTeamSelector(); return; }

        const currentTeam = RESPONSE_TEAMS[teamKey];

        const inlineButton = document.createElement('button');
        inlineButton.id = 'ticket-response-inline-button';
        inlineButton.textContent = '🗣 Quick Response';
        inlineButton.type = 'button';
        Object.assign(inlineButton.style, {
            padding: '5px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer',
            background: '#669bea', fontSize: '13px', fontFamily: 'Arial, sans-serif',
            marginLeft: '10px', display: 'inline-block', transition: 'background 0.2s ease',
            color: 'white', position: 'relative'
        });
        inlineButton.onmouseover = () => inlineButton.style.background = '#5568d3';
        inlineButton.onmouseout  = () => inlineButton.style.background = '#669bea';

        const targetDiv = document.querySelector('.col-xs-10.col-md-9.col-lg-8.form-field .pull-left');
        if (targetDiv) {
            targetDiv.appendChild(inlineButton);
        } else {
            console.log('Target div not found, will retry...');
            setTimeout(initializeDropdown, 500);
            return;
        }

        const dropdown = buildDropdownMenu(currentTeam, teamKey, inlineButton);
        document.body.appendChild(dropdown);

        inlineButton.onclick = (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'flex';
            if (isVisible) {
                dropdown.style.display = 'none';
                document.querySelectorAll('.bypass-submenu').forEach(sm => sm.style.display = 'none');
            } else {
                // Rebuild sections to refresh Recently Used from storage
                rebuildDropdownContent(dropdown, currentTeam, teamKey, inlineButton);
                // Reset search input if it had text
                const srchInput = dropdown.querySelector('#response-search-input');
                if (srchInput && srchInput.value) {
                    srchInput.value = '';
                    const sc = dropdown.querySelector('#sections-container');
                    if (sc) filterItems(sc, '');
                }
                positionDropdown(dropdown, inlineButton);
                dropdown.style.display = 'flex';
                refreshFieldTypePips(dropdown);
                if (srchInput) setTimeout(() => srchInput.focus(), 0);
            }
        };

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (dropdown.style.display === 'flex') {
                clearTimeout(scrollTimeout);
                positionDropdown(dropdown, inlineButton);
                scrollTimeout = setTimeout(() => { if (dropdown.style.display === 'flex') positionDropdown(dropdown, inlineButton); }, 50);
            }
        }, true);

        window.addEventListener('resize', () => {
            if (dropdown.style.display === 'flex') positionDropdown(dropdown, inlineButton);
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== inlineButton) {
                dropdown.style.display = 'none';
                document.querySelectorAll('.bypass-submenu').forEach(sm => sm.style.display = 'none');
            }
        });

        maybeInjectFooterSignature();
    }

    /* ==========================================================
     *  SINGLE INITIALIZATION POINT
     * ==========================================================*/

    async function initialize() {
        if (isInitialized) { console.log('Ticket Response Helper already initialized'); return; }
        console.log('Initializing Ticket Response Helper v' + SCRIPT_VERSION + '...');
        isInitialized = true;

        cacheOpenedByName();

        const teamKey = getCurrentTeamKey();
        if (!teamKey) {
            // Waits until the import had its chance to bring the team.
            dtWhenMigrationSettled(() => { if (getCurrentTeamKey()) initializeDropdown(); else showTeamSelector(); });
        } else {
            initializeDropdown();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('✓ Ticket Response Helper v' + SCRIPT_VERSION + ' loaded');
    console.log('💡 Press Ctrl+Shift+D to debug mention system');

    })();

    /* === TOOL: FORMATTED TEXT HELPER === */
    (() => {
        'use strict';
        // Turned off in ⚙ Suite, not chosen yet, or not meant for this page: this tool does nothing at all.
        if (!isToolEnabled('formattedText') || !dtToolRunsHere('formattedText')) return;


    let isInitialized = false;

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.5';
    const CHANGELOG = `Version 1.2.5:
- The Feature Guide is now visual: it shows the editor with its tool rows, the color palettes, the link, image and table windows, the insert choices and the preview as they look on screen.

Version 1.2.4:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.2.3:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.2.2:
- Fixed the single journal field case more reliably. Some tickets keep both the comment and work note fields in the page but only show one at a time. The helper now looks at which field is actually visible on screen, so it no longer asks where to insert when only one is shown, and the text reliably lands in the field you can see.

Version 1.2.1:
- Fixed an issue where clicking Insert did nothing when the ticket showed only one journal field (either comments or work notes, but not both). The script now detects which field is visible and inserts into it automatically, without asking. When both fields are present, the destination choice dialog still appears as before.

Version 1.2.0:
- Added a Table button to the toolbar. Pick the number of rows and columns from a quick grid, choose whether the first row is a header, and the table is dropped in at your cursor ready to fill in.
- Added Text Color and Highlight Color buttons to the toolbar. Select your text, click the button, and pick a swatch to color the text or highlight it in any color, not just yellow.
- Improved dark mode: the editor area and the main editor window now always keep a light background and readable text, so nothing looks washed out or invisible on dark themed instances.

Version 1.1.3:
- When the Quick Response helper is not installed, the editor button now appears in the same place that button would, next to the ticket form actions, instead of above the activity stream.

Version 1.1.2:
- Fixed the editor button not appearing in standalone mode when the ticket showed only work notes or only comments. The button now reliably appears above whichever journal field is visible.

Version 1.1.1:
- The editor button now appears a bit faster while the page is still loading.
- When the Quick Response helper is not installed and the ticket shows work notes and comments at the same time, the button now appears above both fields instead of between them.

Version 1.1.0:
- The Insert button now lets you choose where the text goes: as a Comment, as a Work Note, or as both at once.
- Added a Feature Guide. Click "? Help" in the editor header to see what every toolbar button does.
- The HTML preview now opens in a proper window showing both a live rendered preview and the source, with a one click Copy button, replacing the old popup.
- Inserting a link now opens a dedicated dialog with separate fields for the link text and the address, replacing the old browser prompt.
- Added a "Remove Formatting" option that clears formatting from just the selected text, leaving the rest of your document untouched.
- Pasted content is now cleaned automatically so text copied from Word, Outlook, or web pages no longer brings hidden styling into the editor.
- The editor button now appears even when the Quick Response helper is not installed, and it no longer keeps retrying forever if the page layout is different.
- Fixed dark mode: the What's New window and all new dialogs now keep readable light backgrounds.

Version 1.0.7:
- Fixed dark mode compatibility: the formatting modal and image modal now force light
  backgrounds and dark text via CSS with !important so ServiceNow dark mode cannot
  override their inputs and selects.

Version 1.0.6:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.0.5:
- Fixed comment textarea not being detected in dual mode - now uses activity-stream-comments-textarea matching the dual-input container detection

Version 1.0.3:
- Update URL Changed`;

    /* ==========================================================
     *  VERSION CONTROL FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('formattedTextHelperVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('formattedTextHelperVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('formattedTextHelperChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('formattedTextHelperChangelogSeen', SCRIPT_VERSION);
    }

    function compareVersions(v1, v2) {
        if (!v1) return true;

        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;

            if (num2 > num1) return true;
            if (num2 < num1) return false;
        }

        return false;
    }

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    function parseChangelog() {
        const entries = [];
        let current = null;
        let currentBullet = null;
        for (const line of CHANGELOG.split('\n')) {
            const versionMatch = line.match(/^Version\s+([\d.]+):/);
            if (versionMatch) {
                if (currentBullet !== null && current) current.bullets.push(currentBullet);
                currentBullet = null;
                if (current) entries.push(current);
                current = { version: versionMatch[1], bullets: [] };
            } else if (line.trim().startsWith('-') && current) {
                if (currentBullet !== null) current.bullets.push(currentBullet);
                currentBullet = line.trim().slice(1).trim();
            } else if (line.trim() && current && currentBullet !== null) {
                currentBullet += ' ' + line.trim();
            }
        }
        if (currentBullet !== null && current) current.bullets.push(currentBullet);
        if (current) entries.push(current);
        return entries;
    }

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'changelog-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000'
        });

        const modal = document.createElement('div');
        modal.id = 'changelog-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10001',
            background: '#fff',
            border: '2px solid #333',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto'
        });

        // Header container with title and close button
        const headerContainer = document.createElement('div');
        Object.assign(headerContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '2px solid #28a745',
            paddingBottom: '10px'
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            margin: '0',
            color: '#333'
        });

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
        });
        closeX.onmouseover = () => {
            closeX.style.backgroundColor = '#f0f0f0';
            closeX.style.color = '#000';
        };
        closeX.onmouseout = () => {
            closeX.style.backgroundColor = 'transparent';
            closeX.style.color = '#666';
        };
        closeX.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
        };

        headerContainer.appendChild(title);
        headerContainer.appendChild(closeX);

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `Formatted Text Helper has been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            borderLeft: '4px solid #28a745'
        });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '0';
        parseChangelog().forEach((entry, index) => {
            const isLatest = index === 0;
            const card = document.createElement('div');
            Object.assign(card.style, {
                border:       '1px solid ' + (isLatest ? '#667eea' : '#e0e0e0'),
                borderRadius: '6px',
                marginBottom: '8px',
                overflow:     'hidden',
            });
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px',
                background: isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor: 'pointer', userSelect: 'none',
            });
            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';
            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: isLatest ? '#667eea' : '#555',
                fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);
            if (isLatest) {
                const tag = document.createElement('span');
                tag.textContent = 'Latest';
                Object.assign(tag.style, {
                    fontSize: '10px', fontWeight: 'bold',
                    background: '#667eea', color: '#fff',
                    borderRadius: '3px', padding: '1px 6px',
                    marginLeft: '8px', fontFamily: 'Arial, sans-serif',
                });
                versionWrap.appendChild(tag);
            }
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });
            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: isLatest ? '10px 14px' : '0',
                display: isLatest ? 'block' : 'none',
                background: '#fff',
            });
            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '3px 0',
                    fontSize: '13px', fontFamily: 'Arial, sans-serif',
                    color: '#444', lineHeight: '1.5',
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = bullet;
                row.appendChild(dot);
                row.appendChild(text);
                body.appendChild(row);
            });
            card.appendChild(body);
            let expanded = isLatest;
            header.addEventListener('click', () => {
                expanded = !expanded;
                body.style.display  = expanded ? 'block' : 'none';
                body.style.padding  = expanded ? '10px 14px' : '0';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            cardsWrap.appendChild(card);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            marginTop: '15px',
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
        });

        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#218838';
        closeButton.onmouseout = () => closeButton.style.backgroundColor = '#28a745';

        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
        };

        modal.appendChild(headerContainer);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => {
            closeButton.click();
        };
    }

    /* ==========================================================
     *  COLOR PALETTES
     * ==========================================================*/

    // Word style swatches. Foreground colors for text, brighter set for highlights.
    const TEXT_COLORS = [
        '#000000', '#444444', '#666666', '#999999', '#cccccc', '#ffffff',
        '#cc0000', '#e06666', '#ff9900', '#f1c232', '#6aa84f', '#38761d',
        '#1155cc', '#3d85c6', '#9fc5e8', '#674ea7', '#a64d79', '#85200c'
    ];

    const HIGHLIGHT_COLORS = [
        '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff9900', '#ff6666',
        '#ffd966', '#fff2cc', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#d5a6bd',
        '#f4cccc', '#d9d2e9', '#ead1dc', '#cccccc', '#999999', '#ffffff'
    ];

    /* ==========================================================
     *  RICH TEXT EDITOR MODAL
     * ==========================================================*/

    // Saved selection reference so the image modal can restore it
    let savedRange = null;

    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (!savedRange) return;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }

    /* ----------------------------------------------------------
     *  IMAGE INSERTION MODAL
     * ----------------------------------------------------------*/

    function showImageModal() {
        // Save current cursor/selection inside the editor BEFORE opening modal
        saveSelection();

        // --- Overlay ---
        const imgOverlay = document.createElement('div');
        imgOverlay.id = 'image-modal-overlay';
        Object.assign(imgOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: '10002',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // --- Modal box ---
        const imgModal = document.createElement('div');
        imgModal.id = 'image-modal';
        Object.assign(imgModal.style, {
            backgroundColor: '#fff',
            borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            width: '440px',
            maxWidth: 'calc(100vw - 40px)',
            fontFamily: 'Arial, sans-serif',
            overflow: 'hidden',
            zIndex: '10003'
        });

        // --- Header ---
        const imgHeader = document.createElement('div');
        Object.assign(imgHeader.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0'
        });

        const imgTitle = document.createElement('h3');
        imgTitle.textContent = '🖼️ Insert Image';
        Object.assign(imgTitle.style, { margin: '0', fontSize: '16px', color: '#333' });

        const imgCloseX = document.createElement('button');
        imgCloseX.textContent = '✕';
        imgCloseX.type = 'button';
        Object.assign(imgCloseX.style, {
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#666', padding: '0',
            width: '26px', height: '26px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        imgCloseX.onmouseover = () => { imgCloseX.style.backgroundColor = '#f0f0f0'; imgCloseX.style.color = '#000'; };
        imgCloseX.onmouseout  = () => { imgCloseX.style.backgroundColor = 'transparent'; imgCloseX.style.color = '#666'; };
        imgCloseX.onclick = closeImageModal;

        imgHeader.appendChild(imgTitle);
        imgHeader.appendChild(imgCloseX);

        // --- Body ---
        const imgBody = document.createElement('div');
        Object.assign(imgBody.style, { padding: '18px' });

        // URL label + input
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'Image URL';
        Object.assign(urlLabel.style, {
            display: 'block', fontSize: '13px', fontWeight: 'bold',
            color: '#444', marginBottom: '6px'
        });

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://example.com/image.png';
        Object.assign(urlInput.style, {
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '13px',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'Arial, sans-serif'
        });
        urlInput.onfocus = () => { urlInput.style.borderColor = '#669bea'; urlInput.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
        urlInput.onblur  = () => { urlInput.style.borderColor = '#ccc';    urlInput.style.boxShadow = 'none'; };

        // Size label + row (dropdown + live value)
        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Display Size';
        Object.assign(sizeLabel.style, {
            display: 'block', fontSize: '13px', fontWeight: 'bold',
            color: '#444', marginBottom: '6px', marginTop: '14px'
        });

        const sizeRow = document.createElement('div');
        Object.assign(sizeRow.style, { display: 'flex', alignItems: 'center', gap: '10px' });

        const sizeSelect = document.createElement('select');
        Object.assign(sizeSelect.style, {
            flex: '1',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            cursor: 'pointer',
            outline: 'none',
            boxSizing: 'border-box'
        });
        sizeSelect.onfocus = () => { sizeSelect.style.borderColor = '#669bea'; sizeSelect.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
        sizeSelect.onblur  = () => { sizeSelect.style.borderColor = '#ccc';    sizeSelect.style.boxShadow = 'none'; };

        const sizeOptions = [
            { label: '25% (default)',              value: '25' },
            { label: '50%',              value: '50' },
            { label: '75%',              value: '75' },
            { label: '100%',   value: '100' }
        ];
        sizeOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === '25') o.selected = true;
            sizeSelect.appendChild(o);
        });

        const sizeValueBadge = document.createElement('span');
        sizeValueBadge.textContent = '25%';
        Object.assign(sizeValueBadge.style, {
            fontSize: '13px', fontWeight: 'bold', color: '#28a745',
            minWidth: '40px', textAlign: 'center'
        });
        sizeSelect.onchange = () => { sizeValueBadge.textContent = sizeSelect.value + '%'; };

        sizeRow.appendChild(sizeSelect);
        sizeRow.appendChild(sizeValueBadge);

        // --- Preview area ---
        const previewContainer = document.createElement('div');
        Object.assign(previewContainer.style, {
            marginTop: '14px',
            border: '1px dashed #ccc',
            borderRadius: '6px',
            minHeight: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            overflow: 'hidden',
            maxHeight: '200px'
        });

        const previewPlaceholder = document.createElement('span');
        previewPlaceholder.textContent = 'Image preview will appear here';
        Object.assign(previewPlaceholder.style, { color: '#999', fontSize: '13px', fontStyle: 'italic' });
        previewContainer.appendChild(previewPlaceholder);

        const previewImg = document.createElement('img');
        Object.assign(previewImg.style, { maxWidth: '100%', maxHeight: '180px', display: 'none' });
        previewContainer.appendChild(previewImg);

        // Live-update preview on URL input / size change
        function updatePreview() {
            const url = urlInput.value.trim();
            if (url) {
                previewImg.src = url;
                previewImg.style.width = sizeSelect.value + '%';
                previewImg.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewPlaceholder.style.display = 'block';
            }
        }
        urlInput.oninput  = updatePreview;
        sizeSelect.onchange = () => { sizeValueBadge.textContent = sizeSelect.value + '%'; updatePreview(); };

        previewImg.onerror = () => {
            previewImg.style.display = 'none';
            previewPlaceholder.style.display = 'block';
            previewPlaceholder.textContent = '⚠️ Could not load image';
            previewPlaceholder.style.color = '#dc3545';
        };
        previewImg.onload = () => {
            previewPlaceholder.style.color = '#999';
            previewPlaceholder.style.fontStyle = 'italic';
            previewPlaceholder.textContent = 'Image preview will appear here';
        };

        imgBody.appendChild(urlLabel);
        imgBody.appendChild(urlInput);
        imgBody.appendChild(sizeLabel);
        imgBody.appendChild(sizeRow);
        imgBody.appendChild(previewContainer);

        // --- Footer ---
        const imgFooter = document.createElement('div');
        Object.assign(imgFooter.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 18px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f8f9fa'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = closeImageModal;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Image';
        insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            const url  = urlInput.value.trim();
            const size = sizeSelect.value;

            if (!url) {
                urlInput.style.borderColor = '#dc3545';
                urlInput.style.boxShadow  = '0 0 0 0.2rem rgba(220,53,69,0.25)';
                urlInput.focus();
                return;
            }

            // Restore cursor position inside the editor
            restoreSelection();

            // Build <img> with width percentage as inline style
            const img = document.createElement('img');
            img.src   = url;
            img.style.width = size + '%';
            img.style.maxWidth = '100%';

            // Insert at cursor
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                // Move cursor right after the image
                range.setStartAfter(img);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();

            closeImageModal();
            console.log('✓ Image inserted — ' + size + '%');
        };

        imgFooter.appendChild(cancelBtn);
        imgFooter.appendChild(insertBtn);

        // --- Assemble ---
        imgModal.appendChild(imgHeader);
        imgModal.appendChild(imgBody);
        imgModal.appendChild(imgFooter);
        imgOverlay.appendChild(imgModal);
        document.body.appendChild(imgOverlay);

        // Close helpers
        imgOverlay.addEventListener('click', (e) => { if (e.target === imgOverlay) closeImageModal(); });

        function closeImageModal() {
            imgOverlay.remove();
            savedRange = null;
        }

        // Auto-focus URL input
        setTimeout(() => urlInput.focus(), 60);
    }

    /* ----------------------------------------------------------
     *  LINK INSERTION MODAL
     * ----------------------------------------------------------*/

    function showLinkModal() {
        // Capture the editor selection before the modal steals focus
        saveSelection();
        const preText = savedRange ? savedRange.toString() : '';

        const overlay = document.createElement('div');
        overlay.id = 'link-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'link-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '440px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '🔗 Insert Link';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px' });

        function makeLabel(text, topMargin) {
            const l = document.createElement('label');
            l.textContent = text;
            Object.assign(l.style, {
                display: 'block', fontSize: '13px', fontWeight: 'bold',
                color: '#444', marginBottom: '6px', marginTop: topMargin || '0'
            });
            return l;
        }
        function makeInput(placeholder, value) {
            const i = document.createElement('input');
            i.type = 'text';
            i.placeholder = placeholder;
            if (value) i.value = value;
            Object.assign(i.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc',
                borderRadius: '5px', fontSize: '13px', boxSizing: 'border-box',
                outline: 'none', fontFamily: 'Arial, sans-serif'
            });
            i.onfocus = () => { i.style.borderColor = '#669bea'; i.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
            i.onblur  = () => { i.style.borderColor = '#ccc'; i.style.boxShadow = 'none'; };
            return i;
        }

        const textInput = makeInput('Text to display', preText);
        const urlInput  = makeInput('https://example.com', '');

        body.appendChild(makeLabel('Link Text'));
        body.appendChild(textInput);
        body.appendChild(makeLabel('URL', '14px'));
        body.appendChild(urlInput);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa'
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Link'; insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            const url = urlInput.value.trim();
            if (!url || /^\s*javascript:/i.test(url)) {
                urlInput.style.borderColor = '#dc3545';
                urlInput.style.boxShadow  = '0 0 0 0.2rem rgba(220,53,69,0.25)';
                urlInput.focus();
                return;
            }
            const text = textInput.value.trim() || url;

            restoreSelection();
            const a = document.createElement('a');
            a.href = url;
            a.textContent = text;

            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(a);
                range.setStartAfter(a);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();
            cleanup();
            console.log('✓ Link inserted — ' + url);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(insertBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
        setTimeout(() => urlInput.focus(), 60);

        function cleanup() {
            overlay.remove();
            savedRange = null;
        }
    }

    /* ----------------------------------------------------------
     *  TABLE INSERTION MODAL
     * ----------------------------------------------------------*/

    // Build a table element with inline styles ServiceNow renders inside [code].
    function buildTableElement(rows, cols, hasHeader) {
        const cellStyle = 'border: 1px solid #cccccc; padding: 6px 10px;';
        const table = document.createElement('table');
        table.setAttribute('style', 'border-collapse: collapse; width: 100%;');

        let bodyStart = 0;
        if (hasHeader) {
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            tr.setAttribute('style', 'background-color: #f0f0f0;');
            for (let c = 0; c < cols; c++) {
                const th = document.createElement('th');
                th.setAttribute('style', cellStyle);
                th.appendChild(document.createElement('br'));
                tr.appendChild(th);
            }
            thead.appendChild(tr);
            table.appendChild(thead);
            bodyStart = 1;
        }

        const tbody = document.createElement('tbody');
        for (let r = bodyStart; r < rows; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.setAttribute('style', cellStyle);
                td.appendChild(document.createElement('br'));
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        return table;
    }

    function showTableModal() {
        // Save the editor cursor before the modal steals focus
        saveSelection();

        const MAX_GRID = 10;          // hover grid spans up to 10 x 10
        let selRows = 1, selCols = 1;
        let headerRow = true;

        const overlay = document.createElement('div');
        overlay.id = 'table-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'table-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '380px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '▦ Insert Table';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px' });

        // Live dimension label
        const dimLabel = document.createElement('div');
        dimLabel.textContent = '1 × 1 Table';
        Object.assign(dimLabel.style, {
            fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '8px', textAlign: 'center'
        });

        // Hover grid picker
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid', gridTemplateColumns: `repeat(${MAX_GRID}, 18px)`,
            gap: '3px', justifyContent: 'center', marginBottom: '14px'
        });

        const cells = [];
        function paintGrid(r, c) {
            cells.forEach(cell => {
                const on = cell.dataset.r <= r && cell.dataset.c <= c;
                cell.style.backgroundColor = on ? '#669bea' : '#fff';
                cell.style.borderColor = on ? '#3d6fd0' : '#ccc';
            });
        }
        for (let r = 1; r <= MAX_GRID; r++) {
            for (let c = 1; c <= MAX_GRID; c++) {
                const cell = document.createElement('div');
                cell.dataset.r = r;
                cell.dataset.c = c;
                Object.assign(cell.style, {
                    width: '18px', height: '18px', border: '1px solid #ccc',
                    borderRadius: '2px', backgroundColor: '#fff', cursor: 'pointer'
                });
                cell.addEventListener('mouseover', () => {
                    selRows = r; selCols = c;
                    dimLabel.textContent = `${r} × ${c} Table`;
                    rowsInput.value = r;
                    colsInput.value = c;
                    paintGrid(r, c);
                });
                cell.addEventListener('click', () => { selRows = r; selCols = c; doInsert(); });
                cells.push(cell);
                grid.appendChild(cell);
            }
        }

        // Explicit number inputs for sizes beyond the grid
        const inputsRow = document.createElement('div');
        Object.assign(inputsRow.style, {
            display: 'flex', gap: '10px', alignItems: 'center',
            justifyContent: 'center', marginBottom: '12px'
        });
        function makeNumInput(val) {
            const i = document.createElement('input');
            i.type = 'number'; i.min = '1'; i.max = '50'; i.value = String(val);
            Object.assign(i.style, {
                width: '60px', padding: '6px 8px', border: '1px solid #ccc',
                borderRadius: '5px', fontSize: '13px', boxSizing: 'border-box',
                outline: 'none', fontFamily: 'Arial, sans-serif', textAlign: 'center'
            });
            return i;
        }
        const rowsInput = makeNumInput(1);
        const colsInput = makeNumInput(1);
        function syncFromInputs() {
            selRows = Math.max(1, Math.min(50, parseInt(rowsInput.value, 10) || 1));
            selCols = Math.max(1, Math.min(50, parseInt(colsInput.value, 10) || 1));
            dimLabel.textContent = `${selRows} × ${selCols} Table`;
            if (selRows <= MAX_GRID && selCols <= MAX_GRID) paintGrid(selRows, selCols);
        }
        rowsInput.oninput = syncFromInputs;
        colsInput.oninput = syncFromInputs;
        const rowsLbl = document.createElement('span');
        rowsLbl.textContent = 'Rows'; rowsLbl.style.fontSize = '13px'; rowsLbl.style.color = '#444';
        const colsLbl = document.createElement('span');
        colsLbl.textContent = 'Columns'; colsLbl.style.fontSize = '13px'; colsLbl.style.color = '#444';
        inputsRow.appendChild(rowsLbl);
        inputsRow.appendChild(rowsInput);
        inputsRow.appendChild(colsLbl);
        inputsRow.appendChild(colsInput);

        // Header row toggle
        const headerToggle = document.createElement('label');
        Object.assign(headerToggle.style, {
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            fontSize: '13px', color: '#444', cursor: 'pointer', marginBottom: '4px'
        });
        const headerCheck = document.createElement('input');
        headerCheck.type = 'checkbox';
        headerCheck.checked = true;
        headerCheck.style.cursor = 'pointer';
        headerCheck.onchange = () => { headerRow = headerCheck.checked; };
        const headerText = document.createElement('span');
        headerText.textContent = 'Make the first row a header';
        headerToggle.appendChild(headerCheck);
        headerToggle.appendChild(headerText);

        body.appendChild(dimLabel);
        body.appendChild(grid);
        body.appendChild(inputsRow);
        body.appendChild(headerToggle);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa'
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Table'; insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = doInsert;

        footer.appendChild(cancelBtn);
        footer.appendChild(insertBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
        paintGrid(1, 1);

        function doInsert() {
            syncFromInputs();
            headerRow = headerCheck.checked;

            restoreSelection();
            const table = buildTableElement(selRows, selCols, headerRow);

            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(table);
                // Drop a paragraph after the table so the cursor has somewhere to go
                const after = document.createElement('p');
                after.appendChild(document.createElement('br'));
                table.parentNode.insertBefore(after, table.nextSibling);
                range.setStart(after, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();
            cleanup();
            console.log('✓ Table inserted — ' + selRows + ' x ' + selCols);
        }

        function cleanup() {
            overlay.remove();
            savedRange = null;
        }
    }

    /* ----------------------------------------------------------
     *  HTML PREVIEW MODAL
     * ----------------------------------------------------------*/

    function showPreviewModal() {
        const editor = document.getElementById('formatted-text-editor');
        if (!editor) return;
        const html = cleanHTML(editor.innerHTML);
        const wrapped = `[code]${html}[/code]`;

        const overlay = document.createElement('div');
        overlay.id = 'preview-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'preview-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '660px',
            maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 80px)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0',
            flexShrink: '0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '👁 HTML Preview';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const bodyWrap = document.createElement('div');
        Object.assign(bodyWrap.style, { padding: '18px', overflowY: 'auto', flex: '1 1 auto', minHeight: '0' });

        const renderLabel = document.createElement('div');
        renderLabel.textContent = 'Rendered preview';
        Object.assign(renderLabel.style, { fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '6px' });

        const renderBox = document.createElement('div');
        renderBox.innerHTML = html || '<span style="color:#999;font-style:italic;">(empty)</span>';
        Object.assign(renderBox.style, {
            border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 14px',
            backgroundColor: '#fff', color: '#333', maxHeight: '260px', overflowY: 'auto',
            fontSize: '14px', lineHeight: '1.6', marginBottom: '16px'
        });

        const sourceLabel = document.createElement('div');
        sourceLabel.textContent = 'Source (this is what gets inserted)';
        Object.assign(sourceLabel.style, { fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '6px' });

        const sourceTA = document.createElement('textarea');
        sourceTA.readOnly = true;
        sourceTA.value = wrapped;
        Object.assign(sourceTA.style, {
            width: '100%', minHeight: '120px', maxHeight: '220px', boxSizing: 'border-box',
            padding: '10px 12px', border: '1px solid #ccc', borderRadius: '6px',
            fontFamily: 'monospace', fontSize: '12px', color: '#333',
            backgroundColor: '#f8f9fa', resize: 'vertical', outline: 'none'
        });

        bodyWrap.appendChild(renderLabel);
        bodyWrap.appendChild(renderBox);
        bodyWrap.appendChild(sourceLabel);
        bodyWrap.appendChild(sourceTA);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
            flexShrink: '0'
        });

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy Source'; copyBtn.type = 'button';
        Object.assign(copyBtn.style, {
            padding: '7px 18px', border: '1px solid #6c757d', borderRadius: '5px',
            backgroundColor: '#6c757d', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        copyBtn.onmouseover = () => copyBtn.style.backgroundColor = '#5a6268';
        copyBtn.onmouseout  = () => copyBtn.style.backgroundColor = '#6c757d';
        copyBtn.onclick = () => {
            const done = () => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.textContent = '📋 Copy Source'; }, 1500);
            };
            const fallback = () => {
                sourceTA.removeAttribute('readonly');
                sourceTA.select();
                try { document.execCommand('copy'); } catch (e) { /* ignore */ }
                sourceTA.setAttribute('readonly', 'true');
                done();
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(wrapped).then(done).catch(fallback);
            } else {
                fallback();
            }
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close'; closeBtn.type = 'button';
        Object.assign(closeBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#218838';
        closeBtn.onmouseout  = () => closeBtn.style.backgroundColor = '#28a745';
        closeBtn.onclick = cleanup;

        footer.appendChild(copyBtn);
        footer.appendChild(closeBtn);

        modal.appendChild(header);
        modal.appendChild(bodyWrap);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        function cleanup() { overlay.remove(); }
    }

    /* ----------------------------------------------------------
     *  INSERT TARGET CHOOSER MODAL
     * ----------------------------------------------------------*/

    function showInsertTargetModal(onChoose) {
        const overlay = document.createElement('div');
        overlay.id = 'insert-target-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10006',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'insert-target-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '400px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = 'Insert where?';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' });

        const intro = document.createElement('div');
        intro.textContent = 'Choose which field to add the formatted text to.';
        Object.assign(intro.style, { fontSize: '13px', color: '#555', marginBottom: '4px' });
        body.appendChild(intro);

        const options = [
            { target: 'comments',   bg: '#0066cc', label: 'Insert as Comment',   desc: 'Customer facing. The requester can see this.' },
            { target: 'work_notes', bg: '#5a6672', label: 'Insert as Work Note', desc: 'Internal only. Visible to your team but not the requester.' },
            { target: 'both',       bg: '#667eea', label: 'Insert as Both',       desc: 'Adds the text to the comment and the work note.' }
        ];
        options.forEach(opt => {
            const optBtn = document.createElement('button');
            optBtn.type = 'button';
            Object.assign(optBtn.style, {
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                textAlign: 'left', padding: '10px 14px', border: '1px solid #e0e0e0',
                borderLeft: `4px solid ${opt.bg}`, borderRadius: '6px', backgroundColor: '#fff',
                cursor: 'pointer', transition: 'background 0.15s', width: '100%', boxSizing: 'border-box'
            });
            const lbl = document.createElement('span');
            lbl.textContent = opt.label;
            Object.assign(lbl.style, { fontWeight: 'bold', fontSize: '13px', color: opt.bg });
            const desc = document.createElement('span');
            desc.textContent = opt.desc;
            Object.assign(desc.style, { fontSize: '12px', color: '#666' });
            optBtn.appendChild(lbl);
            optBtn.appendChild(desc);
            optBtn.onmouseover = () => optBtn.style.backgroundColor = '#f5f7ff';
            optBtn.onmouseout  = () => optBtn.style.backgroundColor = '#fff';
            optBtn.onclick = () => { cleanup(); onChoose(opt.target); };
            body.appendChild(optBtn);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            marginTop: '4px', padding: '8px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;
        body.appendChild(cancelBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        function cleanup() { overlay.remove(); }
    }

    /* ----------------------------------------------------------
     *  FEATURE GUIDE (HELP) MODAL
     * ----------------------------------------------------------*/

    function showHelpModal() {
        if (document.getElementById('formattedTextHelpModal')) return;

        /* ---- Reusable content helpers. lead/bullets/caption append to the section body;
         *      the others return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        // bullets: a compact list of short usage notes, each prefixed with a purple dot.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const t = document.createElement('span');
                t.textContent = item;
                row.appendChild(dot);
                row.appendChild(t);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        // caption: a small italic note placed directly under a visual to explain it.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        // span: an inline text node with optional extra styles.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: a horizontal, wrapping flex row that holds visual mocks side by side.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: a small colored rounded label. Use for categories and button previews.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: opts.radius || '4px', padding: opts.padding || '3px 8px',
                fontSize: opts.fontSize || '11px', fontWeight: opts.weight || 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block', lineHeight: '1.4'
            });
            return c;
        }

        // badgeRow: a button preview on the left with a one line description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = chip(item.label, item.bg, { color: item.color, border: item.border, padding: '4px 8px', radius: item.radius });
            badge.style.flexShrink = '0';
            if (item.minWidth) { badge.style.minWidth = item.minWidth; badge.style.textAlign = 'center'; }
            row.appendChild(badge);
            row.appendChild(span(item.desc, { fontSize: '12px', color: '#555', lineHeight: '1.5' }));
            body.appendChild(row);
        }

        // kvGrid: a two column key:value grid for field references and named settings.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '0 0 6px 0' });
            for (const [key, val] of pairs) {
                grid.appendChild(span(key, { fontFamily: 'monospace', fontSize: '11px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap' }));
                grid.appendChild(span(val, { fontSize: '12px', color: '#555', padding: '2px 0', lineHeight: '1.4' }));
            }
            body.appendChild(grid);
        }

        // formatBox: a monospace box for a fixed format or a template.
        function formatBox(body, text) {
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                padding: '9px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#333',
                margin: '0 0 8px 0', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5'
            });
            box.textContent = text;
            body.appendChild(box);
        }

        // beforeAfter: labelled rows showing how something changes, e.g. Before / After.
        function beforeAfter(body, rows) {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { margin: '0 0 8px 0', borderRadius: '6px', border: '1px solid #d0d0f0', overflow: 'hidden' });
            rows.forEach(([label, text, good], i) => {
                const row = hrow([
                    span(label, { fontSize: '10px', fontWeight: 'bold', color: good ? '#2a7d4f' : '#888', textTransform: 'uppercase', width: '62px', flexShrink: '0' }),
                    span(text, { fontFamily: 'monospace', fontSize: '11px', color: '#333', whiteSpace: 'pre-wrap' })
                ], { padding: '7px 12px', margin: '0', flexWrap: 'nowrap', alignItems: 'flex-start',
                     background: good ? '#f2fff7' : '#f8f8ff', borderBottom: i < rows.length - 1 ? '1px solid #e8e8f0' : 'none' });
                wrap.appendChild(row);
            });
            body.appendChild(wrap);
        }

        // panelMock: a white card that stands in for a panel or window of the script.
        function panelMock(children, extra) {
            const p = document.createElement('div');
            Object.assign(p.style, {
                border: '1px solid #ccc', borderRadius: '8px', background: '#fff', padding: '10px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '400px', margin: '0 0 8px 0'
            }, extra || {});
            children.forEach(c => p.appendChild(c));
            return p;
        }

        // mockField: a labelled input or dropdown as it appears in the real form.
        function mockField(label, value, opts) {
            opts = opts || {};
            const row = hrow([
                span(label, { fontSize: '11px', fontWeight: 'bold', color: '#555', width: opts.labelWidth || '110px', flexShrink: '0' })
            ], { margin: '0 0 5px 0', flexWrap: 'nowrap', gap: '8px' });
            const box = document.createElement('div');
            Object.assign(box.style, {
                flex: '1', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px solid #ccc', borderRadius: '4px', padding: '3px 8px', minHeight: '16px',
                background: opts.locked ? '#efefef' : '#fff'
            });
            box.appendChild(span(value, { fontSize: '11px', color: opts.placeholder ? '#aaa' : '#333', fontStyle: opts.placeholder ? 'italic' : 'normal' }));
            if (opts.caret) box.appendChild(span('▾', { fontSize: '10px', color: '#999' }));
            row.appendChild(box);
            return row;
        }

        // toggle: a ticked or unticked checkbox preview with an optional one line description.
        function toggle(label, on, desc) {
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            const box = span(on ? '✓' : '', {
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: '0', boxSizing: 'border-box',
                border: on ? 'none' : '1px solid #b0b0b0', background: on ? '#667eea' : '#fff', color: '#fff',
                fontSize: '11px', lineHeight: '15px', textAlign: 'center', display: 'inline-block'
            });
            wrap.appendChild(hrow([ box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' }) ], { margin: '0', flexWrap: 'nowrap' }));
            if (desc) wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px', lineHeight: '1.4' }));
            return wrap;
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent: (body) => {
                    lead(body, 'A green button on the ticket opens the editor. Write, format, then insert into the ticket.');
                    badgeRow(body, { bg: '#28a745', label: '📝 Formatted Text', desc: 'Next to the Quick Response button, or above the comment field when that helper is not installed.' });
                    bullets(body, [
                        'Type your message in the editor and format it with the toolbar.',
                        'Click Insert. The text is added to the ticket wrapped in [code] tags so ServiceNow shows the formatting.'
                    ]);
                }
            },
            {
                icon: '🖥️', title: 'The Editor',
                buildContent: (body) => {
                    lead(body, 'The editor window has a header, two rows of tools, the writing area and a footer.');
                    const tb = (labels) => hrow(labels.map(l => chip(l, '#f3f4f6', { color: '#333', border: '1px solid #ddd', weight: 'normal', padding: '2px 6px' })), { gap: '3px', margin: '0 0 4px 0' });
                    const area = span('Hello Jane, the policy is now live.', {
                        display: 'block', border: '1px solid #ddd', borderRadius: '4px', padding: '10px', fontSize: '12px', color: '#333', margin: '4px 0 8px 0', minHeight: '30px'
                    });
                    body.appendChild(panelMock([
                        hrow([
                            span('Formatted Text Editor', { fontSize: '13px', fontWeight: 'bold', color: '#333' }),
                            chip('? Help', '#fff', { color: '#667eea', border: '1px solid #c0c8f0', fontSize: '10px' }),
                            chip("📋 What's New", '#ff8c00', { fontSize: '10px' })
                        ], { margin: '0 0 8px 0', gap: '6px' }),
                        tb(['B', 'I', 'U', 'S', 'Size ▾', 'A', 'A', 'H', 'Aa', 'Del', 'Ins', 'X₂', 'X²']),
                        tb(['</>', '"', '🔗', '🖼️', '▦ Table', '• List', '1. List', 'H1', 'H2', 'P', '✕ Selection', '✕ All Format', '🗑 Clear']),
                        area,
                        hrow([
                            chip('👁 Preview HTML', '#6c757d'),
                            chip('Cancel', '#fff', { color: '#333', border: '1px solid #ccc' }),
                            chip('Insert', '#28a745')
                        ], { gap: '6px', margin: '0', justifyContent: 'flex-end' })
                    ], { maxWidth: '520px' }));
                    caption(body, 'Select text first, then click a tool to format it.');
                }
            },
            {
                icon: '🅱️', title: 'Formatting Tools',
                buildContent: (body) => {
                    lead(body, 'What each group of tools does.');
                    const group = (labels, desc) => {
                        const row = hrow([
                            hrow(labels.map(l => chip(l, '#f3f4f6', { color: '#333', border: '1px solid #ddd', weight: 'normal', padding: '2px 6px' })), { gap: '3px', margin: '0', width: '190px', flexShrink: '0' }),
                            span(desc, { fontSize: '12px', color: '#555', lineHeight: '1.4' })
                        ], { flexWrap: 'nowrap', alignItems: 'flex-start', margin: '0 0 8px 0' });
                        body.appendChild(row);
                    };
                    group(['B', 'I', 'U', 'S'], 'Bold, italic, underline and strikethrough. Ctrl+B, Ctrl+I and Ctrl+U work too.');
                    group(['Size ▾'], 'Font size from 8 to 36.');
                    group(['H', 'Aa'], 'Yellow highlight and smaller text.');
                    group(['Del', 'Ins'], 'Mark text as deleted (struck) or inserted (underlined on green).');
                    group(['X₂', 'X²'], 'Subscript and superscript.');
                    group(['</>', '"'], 'Inline code and an indented quote block.');
                    group(['• List', '1. List'], 'Bullet and numbered lists.');
                    group(['H1', 'H2', 'P'], 'Large heading, medium heading, or back to a normal paragraph.');
                }
            },
            {
                icon: '🎨', title: 'Text and Highlight Color',
                buildContent: (body) => {
                    lead(body, 'The two A buttons next to Size open a palette. Select text, then pick a color.');
                    const swatches = (colors) => hrow(colors.map(c => span('', {
                        width: '16px', height: '16px', borderRadius: '3px', background: c, border: '1px solid #ccc', display: 'inline-block', boxSizing: 'border-box'
                    })).concat([chip('✕ Remove', '#fff', { color: '#333', border: '1px solid #ccc', weight: 'normal', fontSize: '10px' })]), { gap: '3px', margin: '0 0 6px 0' });
                    body.appendChild(hrow([chip('A', '#fff', { color: '#cc0000', border: '1px solid #ddd' }), span('Text Color', { fontSize: '11px', color: '#555', fontWeight: 'bold' })], { margin: '0 0 4px 0', gap: '6px' }));
                    body.appendChild(swatches(['#000000', '#666666', '#cc0000', '#ff9900', '#f1c232', '#6aa84f', '#1155cc', '#674ea7', '#a64d79']));
                    body.appendChild(hrow([chip('A', '#ffff00', { color: '#333', border: '1px solid #ddd' }), span('Highlight Color', { fontSize: '11px', color: '#555', fontWeight: 'bold' })], { margin: '8px 0 4px 0', gap: '6px' }));
                    body.appendChild(swatches(['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff9900', '#ffd966', '#b6d7a8', '#a4c2f4', '#f4cccc']));
                    caption(body, 'Remove clears the color of the selected text.');
                }
            },
            {
                icon: '🔗', title: 'Links, Images and Tables',
                buildContent: (body) => {
                    lead(body, 'These three tools open a small window to fill in.');
                    body.appendChild(span('🔗 Insert Link', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '0 0 4px 0' }));
                    body.appendChild(panelMock([
                        mockField('Link Text', 'Netskope status page', { labelWidth: '80px' }),
                        mockField('URL', 'https://status.netskope.com', { labelWidth: '80px' })
                    ], { maxWidth: '360px' }));
                    caption(body, 'Selected text fills Link Text. Addresses starting with javascript are refused.');
                    body.appendChild(span('🖼️ Insert Image', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '10px 0 4px 0' }));
                    body.appendChild(hrow(['25%', '50%', '75%', '100%'].map((w, i) => chip(w, i === 1 ? '#667eea' : '#fff', { color: i === 1 ? '#fff' : '#333', border: '1px solid #ccc' })), { gap: '4px' }));
                    caption(body, 'Paste the image URL, check the live preview, pick a width.');
                    body.appendChild(span('▦ Insert Table', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#667eea', margin: '10px 0 4px 0' }));
                    const grid = document.createElement('div');
                    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(6, 14px)', gap: '2px', margin: '0 0 4px 0' });
                    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
                        grid.appendChild(span('', { width: '14px', height: '14px', display: 'inline-block', border: '1px solid #ccc', background: r < 3 && c < 4 ? '#c0c8f0' : '#fff', boxSizing: 'border-box' }));
                    }
                    body.appendChild(hrow([grid, span('3 × 4 Table', { fontSize: '11px', color: '#555' })], { alignItems: 'flex-start' }));
                    body.appendChild(toggle('Make the first row a header', true));
                    caption(body, 'Hover the grid and click, or type Rows and Columns for bigger tables (up to 50).');
                }
            },
            {
                icon: '⚡', title: 'Where It Gets Inserted',
                buildContent: (body) => {
                    lead(body, 'Insert asks where to put the text when the ticket shows both journal fields.');
                    badgeRow(body, { bg: '#0066cc', label: 'Insert as Comment', minWidth: '130px', desc: 'Customer facing. The requester can see it.' });
                    badgeRow(body, { bg: '#5a6672', label: 'Insert as Work Note', minWidth: '130px', desc: 'Internal only, for your team.' });
                    badgeRow(body, { bg: '#667eea', label: 'Insert as Both', minWidth: '130px', desc: 'Adds the same text to both fields.' });
                    bullets(body, [
                        'When only one field is visible, the text goes there without asking.',
                        'The text is added below anything already written in the field.'
                    ]);
                }
            },
            {
                icon: '👁', title: 'Preview',
                buildContent: (body) => {
                    lead(body, 'Preview HTML shows how the text will look and exactly what gets inserted.');
                    body.appendChild(span('Rendered preview', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#555', margin: '0 0 3px 0' }));
                    body.appendChild(panelMock([ span('Hello Jane, the policy is now live.', { fontSize: '12px', color: '#333' }) ], { maxWidth: '520px' }));
                    body.appendChild(span('Source (this is what gets inserted)', { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#555', margin: '4px 0 3px 0' }));
                    formatBox(body, '[code]<p>Hello Jane, the policy is now <b>live</b>.</p>[/code]');
                    body.appendChild(hrow([ chip('📋 Copy Source', '#667eea') ]));
                }
            },
            {
                icon: '🧹', title: 'Cleanup and Pasting',
                buildContent: (body) => {
                    lead(body, 'Tools at the end of the second row tidy up the text.');
                    badgeRow(body, { bg: '#f3f4f6', color: '#333', border: '1px solid #ddd', label: '✕ Selection', minWidth: '90px', desc: 'Removes formatting from the selected text only.' });
                    badgeRow(body, { bg: '#f3f4f6', color: '#333', border: '1px solid #ddd', label: '✕ All Format', minWidth: '90px', desc: 'Removes all formatting and keeps plain text and line breaks.' });
                    badgeRow(body, { bg: '#f3f4f6', color: '#333', border: '1px solid #ddd', label: '🗑 Clear', minWidth: '90px', desc: 'Empties the editor.' });
                    caption(body, 'Text pasted from Word, Outlook or a web page is cleaned automatically. Bold, italic, lists and links are kept.');
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent: (body) => {
                    lead(body, 'The header and footer of the editor hold these controls.');
                    badgeRow(body, { bg: '#fff', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', minWidth: '110px', desc: 'Opens this Feature Guide.' });
                    badgeRow(body, { bg: '#fff', color: '#555', border: '1px solid #ccc', label: '⚙ Suite', minWidth: '110px', desc: 'Opens the Ticket Helpers settings: tools, team, tenant URLs and backups.' });
                    badgeRow(body, { bg: '#ff8c00', label: "📋 What's New", minWidth: '110px', desc: 'Appears after an update. Shows the changelog.' });
                    badgeRow(body, { bg: '#6c757d', label: '👁 Preview HTML', minWidth: '110px', desc: 'Opens the preview described above.' });
                    badgeRow(body, { bg: '#28a745', label: 'Insert', minWidth: '110px', desc: 'Adds the text to the ticket.' });
                    badgeRow(body, { bg: '#fff', color: '#333', border: '1px solid #ccc', label: 'Cancel', minWidth: '110px', desc: 'Closes the editor without inserting.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'formattedTextHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '10008'
        });

        const modal = document.createElement('div');
        modal.id = 'formattedTextHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '10009', background: '#fff', border: '2px solid #333', padding: '20px',
            borderRadius: '10px', width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333333', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box'
        });

        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📖';
        titleIcon.style.fontSize = '22px';
        const titleText = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, { fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Formatted Text Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };
        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, { border: '1px solid #e8e8f0', borderRadius: '6px', marginBottom: '8px', overflow: 'hidden' });
            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
            });
            const headerLeft = document.createElement('span');
            headerLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
            const iconEl = document.createElement('span');
            iconEl.textContent = section.icon;
            iconEl.style.fontSize = '14px';
            const titleLabel = document.createElement('span');
            titleLabel.textContent = section.title;
            Object.assign(titleLabel.style, { fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif' });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, { fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block' });
            cardHeader.appendChild(headerLeft);
            cardHeader.appendChild(chevron);
            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            let expanded = true;
            cardHeader.addEventListener('click', () => {
                expanded = !expanded;
                cardBody.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            contentWrap.appendChild(card);
        }
        modal.appendChild(contentWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close'; closeBtn.type = 'button';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white', border: 'none',
            borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();
        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ----------------------------------------------------------*/

    function createEditorModal() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'formatted-text-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '9999',
            display: 'none',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                e.stopPropagation();
                overlay.style.display = 'none';
            }
        });

        // Modal container
        const modal = document.createElement('div');
        modal.id = 'formatted-text-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff',
            colorScheme: 'light',
            color: '#333',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            width: 'calc(100vw - 40px)',
            maxWidth: '1063px',
            height: 'calc(100vh - 100px)',
            maxHeight: '1000px',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
            zIndex: '10000',
            overflow: 'visible'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '15px 20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            flexShrink: '0'
        });

        const title = document.createElement('h3');
        title.textContent = 'Formatted Text Editor';
        Object.assign(title.style, {
            margin: '0',
            fontSize: '18px',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        // Add version indicator
        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, {
            fontSize: '11px',
            backgroundColor: '#28a745',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 'normal'
        });
        title.appendChild(versionBadge);

        // Help button (always available)
        const helpBtn = document.createElement('button');
        helpBtn.textContent = '? Help';
        helpBtn.type = 'button';
        helpBtn.title = 'View feature guide and documentation';
        Object.assign(helpBtn.style, {
            fontSize: '11px',
            padding: '4px 10px',
            backgroundColor: '#fff',
            color: '#667eea',
            border: '1px solid #c0c8f0',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = '#fff'; };
        helpBtn.onclick = (e) => {
            e.stopPropagation();
            showHelpModal();
        };
        title.appendChild(helpBtn);
        title.appendChild(createSuitePill());

        // Check if there's a new version and user hasn't seen the changelog
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const changelogBtn = document.createElement('button');
            changelogBtn.textContent = '📋 What\'s New';
            changelogBtn.type = 'button';
            Object.assign(changelogBtn.style, {
                fontSize: '11px',
                padding: '4px 10px',
                backgroundColor: '#ff8c00',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                animation: 'pulse 2s infinite'
            });
            changelogBtn.onmouseover = () => changelogBtn.style.backgroundColor = '#e67e00';
            changelogBtn.onmouseout = () => changelogBtn.style.backgroundColor = '#ff8c00';
            changelogBtn.onclick = (e) => {
                e.stopPropagation();
                showChangelogModal();
            };
            title.appendChild(changelogBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.type = 'button';
        Object.assign(closeBtn.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        closeBtn.onmouseover = () => closeBtn.style.color = '#000';
        closeBtn.onmouseout = () => closeBtn.style.color = '#666';
        closeBtn.onclick = () => {
            overlay.style.display = 'none';
        };

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Apply font size with inline style
        function applyFontSize(fontSize, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            if (range.collapsed) {
                alert('Please select some text first.');
                return;
            }

            // Get the fragment
            const fragment = range.extractContents();

            // Process the fragment to wrap text nodes in spans
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    // Wrap text node in span with font-size
                    const span = document.createElement('span');
                    span.style.fontSize = fontSize;
                    span.textContent = node.textContent;
                    return span;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // For element nodes, process children
                    const clone = node.cloneNode(false);

                    Array.from(node.childNodes).forEach(child => {
                        const processed = processNode(child);
                        clone.appendChild(processed);
                    });

                    return clone;
                } else {
                    return node.cloneNode(true);
                }
            };

            // Create a container for the processed fragment
            const container = document.createDocumentFragment();
            Array.from(fragment.childNodes).forEach(node => {
                const processed = processNode(node);
                container.appendChild(processed);
            });

            // Insert the processed content
            range.insertNode(container);

            editor.focus();
        }

        // Wrap the current selection in a span carrying a color or background color.
        // styleProp is 'color' (text) or 'background-color' (highlight). We set the
        // value as !important inline so ServiceNow dark mode cannot recolor it in the
        // editor preview, and so it survives in the inserted [code] block.
        function applyColor(styleProp, color, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            if (range.collapsed) {
                alert('Please select some text first.');
                return;
            }

            const fragment = range.extractContents();

            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const span = document.createElement('span');
                    span.style.setProperty(styleProp, color, 'important');
                    span.textContent = node.textContent;
                    return span;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const clone = node.cloneNode(false);
                    Array.from(node.childNodes).forEach(child => {
                        clone.appendChild(processNode(child));
                    });
                    return clone;
                }
                return node.cloneNode(true);
            };

            const container = document.createDocumentFragment();
            Array.from(fragment.childNodes).forEach(node => {
                container.appendChild(processNode(node));
            });

            range.insertNode(container);
            editor.focus();
        }

        // Build the swatch popup anchored under a color toolbar button. It is fixed
        // positioned and appended to the body so the scrollable toolbar cannot clip it.
        function buildColorPopup(palette, styleProp, anchorEl, onPicked) {
            const pop = document.createElement('div');
            pop.id = 'color-popup';
            Object.assign(pop.style, {
                position: 'fixed', background: '#fff', border: '1px solid #ccc',
                borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', padding: '8px',
                zIndex: '10010', display: 'grid',
                gridTemplateColumns: 'repeat(6, 20px)', gap: '5px'
            });
            const rect = anchorEl.getBoundingClientRect();
            let left = rect.left;
            const popWidth = 6 * 20 + 5 * 5 + 16; // 6 swatches, gaps, padding
            if (left + popWidth > window.innerWidth - 10) left = window.innerWidth - popWidth - 10;
            if (left < 10) left = 10;
            pop.style.left = left + 'px';
            pop.style.top  = (rect.bottom + 4) + 'px';
            palette.forEach(color => {
                const sw = document.createElement('button');
                sw.type = 'button';
                sw.title = color;
                Object.assign(sw.style, {
                    width: '20px', height: '20px', border: '1px solid #ddd',
                    borderRadius: '3px', cursor: 'pointer', padding: '0',
                    backgroundColor: color
                });
                sw.addEventListener('mousedown', (e) => e.preventDefault());
                sw.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    restoreSelection();
                    applyColor(styleProp, color, editor);
                    onPicked();
                };
                pop.appendChild(sw);
            });

            // Full width row to clear the chosen color/highlight off the selection
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = '✕ Remove';
            Object.assign(clearBtn.style, {
                gridColumn: '1 / -1', marginTop: '4px', padding: '4px',
                border: '1px solid #ccc', borderRadius: '4px', background: '#f8f9fa',
                cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#444'
            });
            clearBtn.addEventListener('mousedown', (e) => e.preventDefault());
            clearBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                restoreSelection();
                applyColor(styleProp, styleProp === 'color' ? 'inherit' : 'transparent', editor);
                onPicked();
            };
            pop.appendChild(clearBtn);

            return pop;
        }

        // Custom command handler for non-standard tags
        function handleCustomCommand(command, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const selectedText = range.toString();

            if (!selectedText) {
                alert('Please select some text first.');
                return;
            }

            let wrapper;

            switch (command) {
                case 'mark':
                    wrapper = document.createElement('mark');
                    break;
                case 'small':
                    wrapper = document.createElement('small');
                    break;
                case 'del':
                    wrapper = document.createElement('del');
                    break;
                case 'ins':
                    wrapper = document.createElement('ins');
                    break;
                case 'sub':
                    wrapper = document.createElement('sub');
                    break;
                case 'sup':
                    wrapper = document.createElement('sup');
                    break;
                case 'code':
                    wrapper = document.createElement('code');
                    break;
                case 'blockquote':
                    wrapper = document.createElement('blockquote');
                    break;
                default:
                    return;
            }

            if (wrapper) {
                try {
                    range.surroundContents(wrapper);
                } catch (e) {
                    // If surroundContents fails (complex selection), use alternate method
                    wrapper.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(wrapper);
                }

                // Clear and restore selection
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(wrapper);
                selection.addRange(newRange);
            }
        }

        // Remove all formatting function - strips ALL formatting from entire editor
        function removeAllFormatting(editor) {
            if (!confirm('Remove ALL formatting from the entire document?')) {
                return;
            }

            // Get plain text from editor (preserves line breaks)
            const plainText = editor.innerText;

            if (!plainText || plainText.trim() === '') {
                alert('Editor is empty.');
                return;
            }

            // Clear the editor
            editor.innerHTML = '';

            // Split by double newlines for paragraphs, single newlines for breaks
            const paragraphs = plainText.split('\n\n');

            paragraphs.forEach((para, index) => {
                if (para.trim()) {
                    const p = document.createElement('p');

                    // Handle single line breaks within paragraph
                    const lines = para.split('\n');
                    lines.forEach((line, lineIndex) => {
                        if (lineIndex > 0) {
                            p.appendChild(document.createElement('br'));
                        }
                        p.appendChild(document.createTextNode(line));
                    });

                    editor.appendChild(p);
                }
            });

            // If editor is still empty, add a blank paragraph
            if (!editor.innerHTML.trim()) {
                editor.innerHTML = '<p><br></p>';
            }

            editor.focus();
            console.log('✓ All formatting removed from document');
        }

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        Object.assign(toolbar.style, {
            padding: '10px 15px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#fff',
            maxHeight: '150px',
            overflowY: 'auto',
            overflowX: 'visible',
            position: 'relative',
            flexShrink: '0'
        });

        // First row - formatting buttons
        const firstRow = document.createElement('div');
        Object.assign(firstRow.style, {
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
        });

        // Second row - utility buttons (right-aligned)
        const secondRow = document.createElement('div');
        Object.assign(secondRow.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        // Hint text for @ mentions
        const hintText = document.createElement('div');
        Object.assign(hintText.style, {
            fontSize: '12px',
            color: '#666',
            fontStyle: 'italic',
            maxWidth: '700px',
            lineHeight: '1.4'
        });
        hintText.innerHTML = '💡 <strong>Tip:</strong> To mention someone, type <code style="background: #f4f4f4; padding: 2px 4px; border-radius: 3px;">@</code> without giving it any formatting, then complete the name after inserting the text into ServiceNow.';

        // Container for utility buttons
        const utilityButtonsContainer = document.createElement('div');
        Object.assign(utilityButtonsContainer.style, {
            display: 'flex',
            gap: '8px'
        });

        // Toolbar buttons configuration
        const toolbarButtons = [
            // First row - formatting
            { command: 'bold', icon: '<b>B</b>', title: 'Bold (Ctrl+B)' },
            { command: 'italic', icon: '<i>I</i>', title: 'Italic (Ctrl+I)' },
            { command: 'underline', icon: '<u>U</u>', title: 'Underline (Ctrl+U)' },
            { command: 'strikeThrough', icon: '<del>S</del>', title: 'Strikethrough' },
            { type: 'fontSize', command: 'fontSize', title: 'Font Size' }, // Font size selector
            { type: 'color', command: 'foreColor', icon: '<span style="border-bottom:3px solid #cc0000;">A</span>', title: 'Text Color' },
            { type: 'color', command: 'backColor', icon: '<span style="background:#ffff00;padding:0 3px;border-radius:2px;">A</span>', title: 'Highlight Color' },
            { type: 'custom', command: 'mark', icon: '<mark>H</mark>', title: 'Highlight' },
            { type: 'custom', command: 'small', icon: '<small>Aa</small>', title: 'Small Text' },
            { type: 'custom', command: 'del', icon: '<del>Del</del>', title: 'Deleted Text' },
            { type: 'custom', command: 'ins', icon: '<ins>Ins</ins>', title: 'Inserted Text' },
            { type: 'custom', command: 'sub', icon: 'X<sub>2</sub>', title: 'Subscript' },
            { type: 'custom', command: 'sup', icon: 'X<sup>2</sup>', title: 'Superscript' },
            { type: 'custom', command: 'code', icon: '&lt;/&gt;', title: 'Inline Code' },
            { type: 'custom', command: 'blockquote', icon: '"', title: 'Blockquote' },
            { type: 'link', command: 'link', icon: '🔗', title: 'Insert Link' },
            { type: 'image', command: 'image', icon: '🖼️', title: 'Insert Image' },   // ← NEW
            { type: 'table', command: 'table', icon: '▦ Table', title: 'Insert Table' },
            { command: 'insertUnorderedList', icon: '• List', title: 'Bullet List' },
            { command: 'insertOrderedList', icon: '1. List', title: 'Numbered List' },
            { command: 'formatBlock', value: 'h3', icon: 'H1', title: 'Heading 1 (H3)' },
            { command: 'formatBlock', value: 'h4', icon: 'H2', title: 'Heading 2 (H4)' },
            { command: 'formatBlock', value: 'p', icon: 'P', title: 'Paragraph' },
            // Second row - utility buttons (will be positioned on right)
            { type: 'utility', command: 'removeFormatSelection', icon: '✕ Selection', title: 'Remove Formatting from Selection' },
            { type: 'utility', command: 'removeFormat', icon: '✕ All Format', title: 'Remove All Formatting' },
            { type: 'utility', command: 'clear', icon: '🗑 Clear', title: 'Clear All Text' }
        ];

        // Create toolbar buttons
        toolbarButtons.forEach(btn => {
            // Handle font size selector separately
            if (btn.type === 'fontSize') {
                const fontSizeContainer = document.createElement('div');
                Object.assign(fontSizeContainer.style, {
                    position: 'relative',
                    display: 'inline-block'
                });

                const fontSizeSelect = document.createElement('select');
                fontSizeSelect.title = btn.title;
                Object.assign(fontSizeSelect.style, {
                    padding: '6px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    outline: 'none'
                });

                // Font size options (like Word)
                const fontSizes = [
                    { label: '8', value: '8px' },
                    { label: '10', value: '10px' },
                    { label: '12', value: '12px' },
                    { label: '14 (default)', value: '14px' },
                    { label: '16', value: '16px' },
                    { label: '18', value: '18px' },
                    { label: '20', value: '20px' },
                    { label: '24', value: '24px' },
                    { label: '28', value: '28px' },
                    { label: '32', value: '32px' },
                    { label: '36', value: '36px' }
                ];

                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Size';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                fontSizeSelect.appendChild(defaultOption);

                // Add font size options
                fontSizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size.value;
                    option.textContent = size.label;
                    fontSizeSelect.appendChild(option);
                });

                fontSizeSelect.onchange = (e) => {
                    e.stopPropagation();
                    if (fontSizeSelect.value) {
                        applyFontSize(fontSizeSelect.value, editor);
                        editor.focus();
                        // Reset to default
                        fontSizeSelect.value = '';
                    }
                };

                fontSizeContainer.appendChild(fontSizeSelect);
                firstRow.appendChild(fontSizeContainer);
                return;
            }

            // Handle the color pickers (text color + highlight) separately
            if (btn.type === 'color') {
                const colorContainer = document.createElement('div');
                Object.assign(colorContainer.style, { position: 'relative', display: 'inline-block' });

                const colorBtn = document.createElement('button');
                colorBtn.type = 'button';
                colorBtn.title = btn.title;
                colorBtn.innerHTML = btn.icon + ' <span style="font-size:9px;">▾</span>';
                Object.assign(colorBtn.style, {
                    padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px',
                    backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px',
                    fontWeight: 'bold', flexShrink: '0', whiteSpace: 'nowrap'
                });
                colorBtn.onmouseover = () => { colorBtn.style.backgroundColor = '#e9ecef'; };
                colorBtn.onmouseout  = () => { colorBtn.style.backgroundColor = '#fff'; };

                const palette   = btn.command === 'foreColor' ? TEXT_COLORS : HIGHLIGHT_COLORS;
                const styleProp = btn.command === 'foreColor' ? 'color' : 'background-color';
                let popup = null;

                function closePopup() {
                    if (popup) { popup.remove(); popup = null; }
                    document.removeEventListener('mousedown', onOutside, true);
                }
                function onOutside(e) {
                    if (popup && !popup.contains(e.target) && !colorContainer.contains(e.target)) closePopup();
                }

                // Keep the editor selection alive while the button takes focus
                colorBtn.addEventListener('mousedown', (e) => { e.preventDefault(); saveSelection(); });
                colorBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (popup) { closePopup(); return; }
                    popup = buildColorPopup(palette, styleProp, colorBtn, () => {
                        closePopup();
                        editor.focus();
                    });
                    document.body.appendChild(popup);
                    document.addEventListener('mousedown', onOutside, true);
                };

                colorContainer.appendChild(colorBtn);
                firstRow.appendChild(colorContainer);
                return;
            }

            const button = document.createElement('button');
            button.innerHTML = btn.icon;
            button.type = 'button';
            Object.assign(button.style, {
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                position: 'relative',
                flexShrink: '0',
                whiteSpace: 'nowrap'
            });

            // Style the image button with a distinct teal accent
            if (btn.type === 'image') {
                button.style.backgroundColor = '#17a2b8';
                button.style.color = '#fff';
                button.style.borderColor = '#17a2b8';
            }

            // Style the table button with a distinct purple accent
            if (btn.type === 'table') {
                button.style.backgroundColor = '#6f42c1';
                button.style.color = '#fff';
                button.style.borderColor = '#6f42c1';
            }

            // Style utility buttons differently
            if (btn.type === 'utility') {
                if (btn.command === 'clear') {
                    button.style.backgroundColor = '#dc3545';
                    button.style.color = '#fff';
                    button.style.borderColor = '#dc3545';
                } else {
                    button.style.backgroundColor = '#6c757d';
                    button.style.color = '#fff';
                    button.style.borderColor = '#6c757d';
                }
            }

            // Create custom tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = btn.title;
            Object.assign(tooltip.style, {
                position: 'fixed',
                padding: '6px 10px',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: '0',
                zIndex: '10001',
                display: 'none'
            });

            // Tooltip arrow
            const arrow = document.createElement('div');
            arrow.className = 'tooltip-arrow';
            Object.assign(arrow.style, {
                position: 'absolute',
                top: '100%',
                width: '0',
                height: '0',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #333'
            });
            tooltip.appendChild(arrow);
            document.body.appendChild(tooltip);

            button.onmouseover = () => {
                if (btn.type === 'image') {
                    button.style.backgroundColor = '#138496';
                } else if (btn.type === 'table') {
                    button.style.backgroundColor = '#5a32a3';
                } else if (btn.type === 'utility') {
                    if (btn.command === 'clear') {
                        button.style.backgroundColor = '#c82333';
                    } else {
                        button.style.backgroundColor = '#5a6268';
                    }
                } else {
                    button.style.backgroundColor = '#e9ecef';
                }

                // Show tooltip first to get accurate dimensions
                tooltip.style.display = 'block';

                // Position tooltip
                const rect = button.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                // Calculate position - center horizontally above button
                let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                const top = rect.top - tooltipRect.height - 8;

                // Store original center position for arrow
                const buttonCenterX = rect.left + (rect.width / 2);

                // Prevent clipping on left edge
                if (left < 10) {
                    left = 10;
                }

                // Prevent clipping on right edge
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }

                // Position arrow to point to button center
                const arrow = tooltip.querySelector('.tooltip-arrow');
                const arrowLeft = buttonCenterX - left - 5; // 5 is half the arrow width
                arrow.style.left = arrowLeft + 'px';

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.style.opacity = '1';
            };
            button.onmouseout = () => {
                if (btn.type === 'image') {
                    button.style.backgroundColor = '#17a2b8';
                } else if (btn.type === 'table') {
                    button.style.backgroundColor = '#6f42c1';
                } else if (btn.type === 'utility') {
                    if (btn.command === 'clear') {
                        button.style.backgroundColor = '#dc3545';
                    } else {
                        button.style.backgroundColor = '#6c757d';
                    }
                } else {
                    button.style.backgroundColor = '#fff';
                }
                tooltip.style.display = 'none';
                tooltip.style.opacity = '0';
            };

            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (btn.command === 'clear') {
                    if (confirm('Are you sure you want to clear all text?')) {
                        editor.innerHTML = '<p><br></p>';
                        editor.focus();
                    }
                    return false;
                }

                if (btn.command === 'removeFormat') {
                    removeAllFormatting(editor);
                    return false;
                }

                if (btn.command === 'removeFormatSelection') {
                    const sel = window.getSelection();
                    if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
                        alert('Please select some text first.');
                        return false;
                    }
                    document.execCommand('removeFormat');
                    document.execCommand('unlink');
                    editor.focus();
                    return false;
                }

                // Open the dedicated image modal
                if (btn.type === 'image') {
                    showImageModal();
                    return false;
                }

                // Open the dedicated table modal
                if (btn.type === 'table') {
                    showTableModal();
                    return false;
                }

                // Open the dedicated link modal
                if (btn.type === 'link') {
                    showLinkModal();
                    return false;
                }

                if (btn.type === 'custom') {
                    handleCustomCommand(btn.command, editor);
                    editor.focus();
                    return false;
                }

                if (btn.value) {
                    document.execCommand(btn.command, false, btn.value);
                    editor.focus();
                    return false;
                }

                document.execCommand(btn.command, false, null);
                editor.focus();
                return false;
            };

            // Append to appropriate row
            if (btn.type === 'utility') {
                utilityButtonsContainer.appendChild(button);
            } else {
                firstRow.appendChild(button);
            }
        });

        // Add hint and utility buttons to second row
        secondRow.appendChild(hintText);
        secondRow.appendChild(utilityButtonsContainer);

        toolbar.appendChild(firstRow);
        toolbar.appendChild(secondRow);

        // Editor container
        const editorContainer = document.createElement('div');
        Object.assign(editorContainer.style, {
            flex: '1 1 auto',
            padding: '15px 20px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
        });

        // Editable div
        const editor = document.createElement('div');
        editor.id = 'formatted-text-editor';
        editor.contentEditable = 'true';
        Object.assign(editor.style, {
            flex: '1',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '1.6',
            outline: 'none',
            backgroundColor: '#fff',
            color: '#333',
            overflowY: 'auto',
            minHeight: '100px'
        });
        editor.innerHTML = '<p>Start typing here...</p>';

        // Focus handler to clear placeholder
        editor.onfocus = () => {
            if (editor.innerHTML === '<p>Start typing here...</p>') {
                editor.innerHTML = '<p><br></p>';
            }
        };

        // Sanitize pasted content so Word/Outlook/web markup does not leak in
        editor.addEventListener('paste', (e) => {
            const cd = e.clipboardData || window.clipboardData;
            if (!cd) return;
            e.preventDefault();
            const pastedHTML = cd.getData('text/html');
            const pastedText = cd.getData('text/plain');
            if (pastedHTML && pastedHTML.trim()) {
                document.execCommand('insertHTML', false, sanitizePastedHTML(pastedHTML));
            } else if (pastedText) {
                document.execCommand('insertText', false, pastedText);
            }
        });

        editorContainer.appendChild(editor);

        // Footer with buttons
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '15px 20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            flexShrink: '0'
        });

        // Preview toggle
        const previewToggle = document.createElement('button');
        previewToggle.textContent = '👁 Preview HTML';
        previewToggle.type = 'button';
        Object.assign(previewToggle.style, {
            padding: '8px 16px',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            backgroundColor: '#6c757d',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        previewToggle.onmouseover = () => previewToggle.style.backgroundColor = '#5a6268';
        previewToggle.onmouseout = () => previewToggle.style.backgroundColor = '#6c757d';
        previewToggle.onclick = () => {
            showPreviewModal();
        };

        // Button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '10px'
        });

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f8f9fa';
        cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = () => {
            overlay.style.display = 'none';
        };

        // Insert button
        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert';
        insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '8px 16px',
            border: '1px solid #28a745',
            borderRadius: '4px',
            backgroundColor: '#28a745',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            // Both split fields can exist in the page yet only one is shown at a time,
            // so we decide by what is actually visible, not by what exists in the DOM.
            const bothVisible = isVisible(document.getElementById('activity-stream-comments-textarea')) &&
                                isVisible(document.getElementById('activity-stream-work_notes-textarea'));
            const doInsert = (target) => {
                const inserted = insertFormattedText(editor, target);
                if (inserted) {
                    overlay.style.display = 'none';
                    editor.innerHTML = '<p>Start typing here...</p>';
                }
            };
            if (bothVisible) {
                showInsertTargetModal(doInsert);
            } else {
                doInsert('auto');
            }
        };

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(insertBtn);

        footer.appendChild(previewToggle);
        footer.appendChild(buttonContainer);

        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(toolbar);
        modal.appendChild(editorContainer);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        return overlay;
    }

    /* ==========================================================
     *  HTML CLEANING AND FORMATTING
     * ==========================================================*/

    function cleanHTML(html) {
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Tags allowed to carry an inline style through to ServiceNow:
        // spans (font size and colors), images (width), and every table part (borders).
        const STYLE_TAGS = ['span', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'];

        // Remove contenteditable and any attribute we do not explicitly keep
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();

            // Capture the few attributes worth keeping before wiping the rest
            const href    = el.getAttribute('href');
            const src     = el.getAttribute('src');
            const alt     = el.getAttribute('alt');
            const title   = el.getAttribute('title');
            const style   = el.getAttribute('style');
            const colspan = el.getAttribute('colspan');
            const rowspan = el.getAttribute('rowspan');

            Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));

            if (href && tag === 'a')   el.setAttribute('href', href);
            if (src  && tag === 'img') el.setAttribute('src', src);
            if (alt  && tag === 'img') el.setAttribute('alt', alt);
            if (title)                 el.setAttribute('title', title);
            if (style && STYLE_TAGS.includes(tag)) el.setAttribute('style', style);
            if (colspan && (tag === 'th' || tag === 'td')) el.setAttribute('colspan', colspan);
            if (rowspan && (tag === 'th' || tag === 'td')) el.setAttribute('rowspan', rowspan);
        });

        // Get cleaned HTML
        let cleaned = temp.innerHTML;

        // Replace div tags with p tags (contenteditable often creates divs)
        cleaned = cleaned.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');

        // Remove empty paragraphs
        cleaned = cleaned.replace(/<p><br><\/p>/gi, '');
        cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');

        // Clean up excessive whitespace
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Trim
        cleaned = cleaned.trim();

        return cleaned;
    }

    /* ==========================================================
     *  PASTE SANITIZATION
     * ==========================================================*/

    // Tags we allow to survive a paste; everything else is unwrapped to its text.
    const PASTE_ALLOWED_TAGS = new Set([
        'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'INS', 'MARK', 'SMALL',
        'SUB', 'SUP', 'CODE', 'PRE', 'BLOCKQUOTE', 'A', 'IMG',
        'UL', 'OL', 'LI', 'H3', 'H4', 'P', 'BR', 'SPAN', 'DIV',
        'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
    ]);

    // Only these inline style properties are kept when pasting.
    const PASTE_ALLOWED_STYLE = [
        'font-size', 'width', 'max-width', 'color', 'background-color',
        'border', 'border-collapse', 'padding', 'text-align', 'vertical-align'
    ];

    // Tags allowed to carry filtered inline styles through a paste.
    const PASTE_STYLE_TAGS = new Set([
        'SPAN', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
    ]);

    function filterStyle(styleValue) {
        const keep = [];
        styleValue.split(';').forEach(part => {
            const idx = part.indexOf(':');
            if (idx === -1) return;
            const prop = part.slice(0, idx).trim().toLowerCase();
            const val  = part.slice(idx + 1).trim();
            if (prop && val && PASTE_ALLOWED_STYLE.includes(prop)) {
                keep.push(`${prop}: ${val}`);
            }
        });
        return keep.join('; ');
    }

    function sanitizePastedHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Drop dangerous or noise containers entirely
        temp.querySelectorAll('script, style, meta, link, title, head, noscript, iframe, object, embed')
            .forEach(el => el.remove());

        // Walk every element (document order, parents before children)
        Array.from(temp.querySelectorAll('*')).forEach(el => {
            const tag = el.tagName;
            if (!PASTE_ALLOWED_TAGS.has(tag)) {
                // Unwrap: lift children into the parent, then drop the element
                const parent = el.parentNode;
                if (parent) {
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                }
                return;
            }

            const keepStyle = PASTE_STYLE_TAGS.has(tag);
            const isCell = (tag === 'TH' || tag === 'TD');
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name === 'href' && tag === 'A') {
                    if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute('href');
                } else if (name === 'src' && tag === 'IMG') {
                    if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute('src');
                } else if (name === 'style' && keepStyle) {
                    const filtered = filterStyle(attr.value);
                    if (filtered) el.setAttribute('style', filtered);
                    else el.removeAttribute('style');
                } else if ((name === 'colspan' || name === 'rowspan') && isCell) {
                    // keep span attributes on table cells
                } else {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return temp.innerHTML;
    }

    /* ==========================================================
     *  INSERT FORMATTED TEXT INTO TEXTAREA
     * ==========================================================*/

    // Append wrapped content to a journal textarea and notify ServiceNow.
    function writeToTextarea(textarea, wrappedHTML) {
        const existingContent = textarea.value.trim();
        textarea.value = existingContent
            ? existingContent + '\n\n' + wrappedHTML
            : wrappedHTML;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        textarea.focus();
    }

    // target is 'comments', 'work_notes', 'both', or 'auto'. Returns true if inserted.
    function insertFormattedText(editor, target) {
        const commentsEl  = document.getElementById('activity-stream-comments-textarea');
        const workNotesEl = document.getElementById('activity-stream-work_notes-textarea');
        const singleEl    = document.getElementById('activity-stream-textarea') ||
                            document.querySelector('[data-stream-text-input]');

        // Resolve to the first VISIBLE candidate. A hidden split textarea can exist in
        // the DOM while a different field is on screen, and writing to the hidden one
        // does nothing, so we always prefer what the user can actually see.
        const pickVisible = (...els) => els.find(el => isVisible(el)) || els.find(Boolean) || null;

        let targets;
        if (target === 'auto') {
            // Single mode: whichever journal field is currently shown
            const available = pickVisible(commentsEl, workNotesEl, singleEl);
            targets = available ? [available] : [];
        } else {
            // Dual mode: fall back to the combined textarea if a split field is absent
            const commentsTA  = pickVisible(commentsEl, singleEl);
            const workNotesTA = pickVisible(workNotesEl, singleEl);
            const wanted = [];
            if (target === 'comments'   || target === 'both') wanted.push(commentsTA);
            if (target === 'work_notes' || target === 'both') wanted.push(workNotesTA);
            // Dedupe: combined mode resolves both to the same element
            targets = [...new Set(wanted.filter(Boolean))];
        }

        if (targets.length === 0) {
            console.error('❌ Journal textarea not found!');
            alert('Could not find the target field. Please make sure you are on a ticket page.');
            return false;
        }

        // Get and clean HTML
        const html = cleanHTML(editor.innerHTML);
        if (!html || html.trim() === '') {
            alert('Please enter some text before inserting.');
            return false;
        }

        const wrappedHTML = `[code]${html}[/code]`;
        targets.forEach(ta => writeToTextarea(ta, wrappedHTML));

        console.log('✓ Formatted text inserted successfully (' + target + ')');
        return true;
    }

    /* ==========================================================
     *  POSITION BUTTON NEXT TO QUICK RESPONSE
     * ==========================================================*/

    let buttonAttempts = 0;
    const MAX_BUTTON_ATTEMPTS = 10;     // ~5s waiting for the preferred anchor
    const MAX_FALLBACK_ATTEMPTS = 20;   // ~10s total before giving up entirely

    function isVisible(el) {
        return !!(el && (el.offsetParent !== null || el.getClientRects().length));
    }

    // Same form actions container the Quick Response button appends itself to
    const QR_TARGET_SELECTOR = '.col-xs-10.col-md-9.col-lg-8.form-field .pull-left';

    function findStandaloneAnchor() {
        // 1. Preferred: the exact spot the Quick Response button uses, so the
        //    Formatted Text button lands in the same place when that helper is absent
        const formActions = document.querySelector(QR_TARGET_SELECTOR);
        if (isVisible(formActions)) return { el: formActions, mode: 'append' };

        // 2. Fallback: above whichever journal field is visible
        const journal = findJournalAnchor();
        if (journal) return { el: journal, mode: 'before' };

        return null;
    }

    function findJournalAnchor() {
        // Ordered candidates: the wrapper that holds both fields first (so the
        // button sits above them in dual mode), then each individual journal
        // textarea. We pick the first VISIBLE one so the button is never placed
        // inside a hidden tab, whether the ticket shows comments, work notes, or both.
        const candidates = [
            document.getElementById('multiple-input-journal-entry'),
            document.getElementById('activity-stream-comments-textarea'),
            document.getElementById('activity-stream-work_notes-textarea'),
            document.getElementById('activity-stream-textarea'),
            document.querySelector('[data-stream-text-input]')
        ].filter(Boolean);

        return candidates.find(isVisible) || candidates[0] || null;
    }

    function addFormattedTextButton() {
        if (document.getElementById('formatted-text-button')) return;

        // Preferred anchor: the Quick Response inline button (from the Response Helper)
        const quickResponseBtn = document.getElementById('ticket-response-inline-button');

        // Wait a while for the preferred anchor before falling back
        if (!quickResponseBtn && buttonAttempts < MAX_BUTTON_ATTEMPTS) {
            buttonAttempts++;
            setTimeout(addFormattedTextButton, 500);
            return;
        }

        // Standalone fallback: place it where the Quick Response button would go,
        // so we work even when the Response Helper is not installed
        const standaloneAnchor = quickResponseBtn ? null : findStandaloneAnchor();

        if (!quickResponseBtn && !standaloneAnchor) {
            if (buttonAttempts < MAX_FALLBACK_ATTEMPTS) {
                buttonAttempts++;
                setTimeout(addFormattedTextButton, 500);
            } else {
                console.log('Formatted Text Helper: no anchor element found, button not added.');
            }
            return;
        }

        // Create the formatted text button
        const formattedTextBtn = document.createElement('button');
        formattedTextBtn.id = 'formatted-text-button';
        formattedTextBtn.textContent = '📝 Formatted Text';
        formattedTextBtn.type = 'button';
        Object.assign(formattedTextBtn.style, {
            padding: '5px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            background: '#28a745',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            marginLeft: '10px',
            display: 'inline-block',
            transition: 'background 0.2s ease',
            color: 'white'
        });

        formattedTextBtn.onmouseover = () => formattedTextBtn.style.background = '#218838';
        formattedTextBtn.onmouseout = () => formattedTextBtn.style.background = '#28a745';

        if (quickResponseBtn) {
            // Insert after Quick Response button
            quickResponseBtn.parentNode.insertBefore(formattedTextBtn, quickResponseBtn.nextSibling);
        } else if (standaloneAnchor.mode === 'append') {
            // Same form actions row the Quick Response button uses (keep its 10px left margin)
            standaloneAnchor.el.appendChild(formattedTextBtn);
        } else {
            // Last resort: above whichever journal field is visible
            Object.assign(formattedTextBtn.style, { marginLeft: '0', marginBottom: '8px' });
            standaloneAnchor.el.parentNode.insertBefore(formattedTextBtn, standaloneAnchor.el);
        }

        // Create modal
        const modal = createEditorModal();

        // Button click handler
        formattedTextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'flex';

            // Focus editor after modal opens
            setTimeout(() => {
                const editor = document.getElementById('formatted-text-editor');
                if (editor) {
                    editor.focus();
                }
            }, 100);
        };

        console.log('✓ Formatted Text button added successfully' + (quickResponseBtn ? '' : ' (standalone fallback)'));
    }

    /* ==========================================================
     *  KEYBOARD SHORTCUTS IN EDITOR
     * ==========================================================*/

    document.addEventListener('keydown', (e) => {
        const editor = document.getElementById('formatted-text-editor');
        if (!editor || document.activeElement !== editor) return;

        // Ctrl+B for Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold');
        }
        // Ctrl+I for Italic
        else if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            document.execCommand('italic');
        }
        // Ctrl+U for Underline
        else if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            document.execCommand('underline');
        }
    });

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.7);
            }
            50% {
                box-shadow: 0 0 0 6px rgba(255, 140, 0, 0);
            }
        }

        #formatted-text-modal {
            box-sizing: border-box;
        }

        .custom-tooltip {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }

        #formatted-text-modal select:hover {
            background-color: #f8f9fa;
            border-color: #999;
        }

        #formatted-text-modal select:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102, 155, 234, 0.25);
        }

        @media (max-height: 800px) {
            #formatted-text-modal {
                height: calc(100vh - 60px) !important;
                maxHeight: calc(100vh - 60px) !important;
            }
        }

        @media (max-height: 600px) {
            #formatted-text-modal {
                height: calc(100vh - 40px) !important;
                maxHeight: calc(100vh - 40px) !important;
            }
        }

        @media (max-width: 600px) {
            #formatted-text-modal {
                width: calc(100vw - 20px) !important;
                height: calc(100vh - 40px) !important;
                maxHeight: calc(100vh - 40px) !important;
            }
        }

        #formatted-text-editor:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102, 155, 234, 0.25);
        }

        #formatted-text-editor b,
        #formatted-text-editor strong {
            font-weight: bold;
        }

        #formatted-text-editor i,
        #formatted-text-editor em {
            font-style: italic;
        }

        #formatted-text-editor u {
            text-decoration: underline;
        }

        #formatted-text-editor mark {
            background-color: yellow;
            padding: 0 2px;
        }

        #formatted-text-editor small {
            font-size: 0.8em;
        }

        #formatted-text-editor del {
            text-decoration: line-through;
        }

        #formatted-text-editor ins {
            text-decoration: underline;
            background-color: #d4edda;
        }

        #formatted-text-editor sub {
            vertical-align: sub;
            font-size: 0.8em;
        }

        #formatted-text-editor sup {
            vertical-align: super;
            font-size: 0.8em;
        }

        #formatted-text-editor code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
        }

        #formatted-text-editor blockquote {
            border-left: 4px solid #ccc;
            padding-left: 15px;
            margin: 10px 0;
            color: #666;
            font-style: italic;
        }

        #formatted-text-editor a {
            color: #007bff;
            text-decoration: underline;
        }

        #formatted-text-editor img {
            max-width: 100%;
            height: auto;
            vertical-align: middle;
        }

        #formatted-text-editor h3 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.5em 0;
        }

        #formatted-text-editor h4 {
            font-size: 1.3em;
            font-weight: bold;
            margin: 0.5em 0;
        }

        #formatted-text-editor ul,
        #formatted-text-editor ol {
            margin: 0.5em 0;
            padding-left: 2em;
        }

        #formatted-text-editor li {
            margin: 0.25em 0;
        }

        #formatted-text-editor p {
            margin: 0.5em 0;
        }

        #formatted-text-editor table {
            border-collapse: collapse;
            margin: 0.5em 0;
        }

        #formatted-text-editor th,
        #formatted-text-editor td {
            border: 1px solid #ccc;
            padding: 6px 10px;
            min-width: 24px;
        }

        #formatted-text-editor th {
            background-color: #f0f0f0;
            font-weight: bold;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar {
            height: 6px;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 3px;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        #formatted-text-editor::-webkit-scrollbar {
            width: 8px;
        }

        #formatted-text-editor::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }

        #formatted-text-editor::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }

        #formatted-text-editor::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        /* Image modal specific */
        #image-modal input:focus,
        #image-modal select:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102,155,234,0.25);
        }

        /* Dark mode isolation */
        #formatted-text-modal, #image-modal, #changelog-modal,
        #link-modal, #preview-modal, #insert-target-modal,
        #table-modal, #color-popup, #formattedTextHelpModal { color: #333333 !important; }
        #formatted-text-modal, #changelog-modal, #link-modal, #preview-modal,
        #insert-target-modal, #table-modal, #color-popup, #formattedTextHelpModal {
            background-color: #ffffff !important;
        }
        /* Keep the editor surface and its chrome readable on dark themed instances */
        #formatted-text-editor {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #formatted-text-modal h3, #formatted-text-modal h4,
        #formatted-text-modal label, #formatted-text-modal p {
            color: #333333 !important;
        }
        #formatted-text-modal input, #formatted-text-modal select, #formatted-text-modal textarea,
        #image-modal input, #image-modal select, #image-modal textarea,
        #link-modal input, #link-modal select, #link-modal textarea,
        #preview-modal input, #preview-modal select, #preview-modal textarea,
        #table-modal input, #table-modal select, #table-modal textarea,
        #formattedTextHelpModal input, #formattedTextHelpModal select, #formattedTextHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (isInitialized) {
            console.log('Formatted Text Helper already initialized');
            return;
        }

        console.log('Initializing Formatted Text Helper v' + SCRIPT_VERSION + '...');
        isInitialized = true;

        // Check if this is a new version
        if (isNewVersion()) {
            console.log('New version detected: ' + SCRIPT_VERSION);
            // Show changelog on first interaction with the modal
            // Don't auto-show to avoid interrupting workflow
        }

        // Add button after Quick Response button loads
        addFormattedTextButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('✓ Formatted Text Helper v' + SCRIPT_VERSION + ' loaded');

    })();

    /* === TOOL: SLA ALERT BANNER === */
    (() => {
        'use strict';
        // Turned off in ⚙ Suite, not chosen yet, or not meant for this page: this tool does nothing at all.
        if (!isToolEnabled('slaBanner') || !dtToolRunsHere('slaBanner')) return;


    const SCRIPT_VERSION = '1.4.0';
    const CHANGELOG = `Version 1.4.0:
- Added a "? Help" button at the bottom of the date format picker. It opens a visual Feature Guide that shows every banner color, explains the date formats and lists the controls.
- The date format picker and the What's New window now stay readable when ServiceNow uses a dark theme.

Version 1.3.6:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.3.5:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.3.4:
- Fixed "What's new" footer not appearing in format picker - version was being
  silently marked as seen on page load before the picker could open.

Version 1.3.3:
- Added a "What's new" link with pulsing dot to the date format picker footer -
  links to the changelog when a new version has not been seen yet.
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.3.1:
- Banner now suppresses on all terminal states (Closed Incomplete, Cancelled, Resolved, Closed) not just Closed Complete.

Version 1.3:
- Added configurable date format picker with ⚙ button next to the Due Date field.`;

    // ─── Version Control ──────────────────────────────────────────────────────

    const SLA_VERSION_KEY   = 'sla_banner_version';
    const SLA_CHANGELOG_KEY = 'sla_banner_changelog_seen';

    function getStoredVersion()    { return GM_getValue(SLA_VERSION_KEY, null); }
    function saveVersion(v)        { GM_setValue(SLA_VERSION_KEY, v); }
    function hasSeenChangelog()    { return GM_getValue(SLA_CHANGELOG_KEY, null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue(SLA_CHANGELOG_KEY, SCRIPT_VERSION); }

    function isNewVersion() {
        const stored = getStoredVersion();
        if (!stored) return true;
        const a = stored.split('.').map(Number);
        const b = SCRIPT_VERSION.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if ((b[i] || 0) > (a[i] || 0)) return true;
            if ((b[i] || 0) < (a[i] || 0)) return false;
        }
        return false;
    }

    function parseChangelog() {
        const entries = [];
        let current = null;
        let currentBullet = null;
        for (const line of CHANGELOG.split('\n')) {
            const versionMatch = line.match(/^Version\s+([\d.]+):/);
            if (versionMatch) {
                if (currentBullet !== null && current) current.bullets.push(currentBullet);
                currentBullet = null;
                if (current) entries.push(current);
                current = { version: versionMatch[1], bullets: [] };
            } else if (line.trim().startsWith('-') && current) {
                if (currentBullet !== null) current.bullets.push(currentBullet);
                currentBullet = line.trim().slice(1).trim();
            } else if (line.trim() && current && currentBullet !== null) {
                currentBullet += ' ' + line.trim();
            }
        }
        if (currentBullet !== null && current) current.bullets.push(currentBullet);
        if (current) entries.push(current);
        return entries;
    }

    function showChangelogModal() {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        const modal = document.createElement('div');
        modal.id = 'sla-changelog-modal';
        Object.assign(modal.style, {
            background: '#fff', borderRadius: '8px',
            padding: '24px', width: '420px', maxWidth: '90vw',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, { margin: '0 0 6px', fontSize: '16px', color: '#1d1d1d' });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `SLA Alert Banner updated to v${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, { fontSize: '13px', color: '#666', marginBottom: '16px' });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '16px';
        parseChangelog().forEach((entry, index) => {
            const isLatest = index === 0;
            const card = document.createElement('div');
            Object.assign(card.style, {
                border:       '1px solid ' + (isLatest ? '#667eea' : '#e0e0e0'),
                borderRadius: '6px',
                marginBottom: '8px',
                overflow:     'hidden',
            });
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px',
                background: isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor: 'pointer', userSelect: 'none',
            });
            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';
            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: isLatest ? '#667eea' : '#555',
                fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);
            if (isLatest) {
                const tag = document.createElement('span');
                tag.textContent = 'Latest';
                Object.assign(tag.style, {
                    fontSize: '10px', fontWeight: 'bold',
                    background: '#667eea', color: '#fff',
                    borderRadius: '3px', padding: '1px 6px',
                    marginLeft: '8px', fontFamily: 'Arial, sans-serif',
                });
                versionWrap.appendChild(tag);
            }
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999',
                transition: 'transform 0.2s', display: 'inline-block',
                transform: isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });
            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: isLatest ? '10px 14px' : '0',
                display: isLatest ? 'block' : 'none',
                background: '#fff',
            });
            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '3px 0',
                    fontSize: '13px', fontFamily: 'Arial, sans-serif',
                    color: '#444', lineHeight: '1.5',
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = bullet;
                row.appendChild(dot);
                row.appendChild(text);
                body.appendChild(row);
            });
            card.appendChild(body);
            let expanded = isLatest;
            header.addEventListener('click', () => {
                expanded = !expanded;
                body.style.display  = expanded ? 'block' : 'none';
                body.style.padding  = expanded ? '10px 14px' : '0';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            cardsWrap.appendChild(card);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            display: 'block', margin: '0 auto',
            padding: '8px 28px', borderRadius: '6px',
            background: '#667eea', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'Arial, sans-serif',
        });
        closeButton.onclick = () => {
            overlay.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeButton.click(); });
    }

    // ─── Feature Guide (? Help modal) ─────────────────────────────────────────

    function showHelpModal() {
        if (document.getElementById('slaBannerHelpModal')) return;

        /* ---- Reusable content helpers. lead/bullets/caption append to the section body;
         *      span/hrow/chip return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        // bullets: a compact list of short usage notes, each prefixed with a purple dot.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const t = document.createElement('span');
                t.textContent = item;
                row.appendChild(dot);
                row.appendChild(t);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        // caption: a small italic note placed directly under a visual to explain it.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        // span: an inline text node with optional extra styles. Returned, not appended.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: a horizontal, wrapping flex row that holds visual mocks side by side.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: a small colored rounded label. Use for categories and button previews.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: opts.radius || '4px', padding: opts.padding || '3px 8px',
                fontSize: opts.fontSize || '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block'
            });
            return c;
        }

        // badgeRow: a button preview on the left with a one line description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = chip(item.label, item.bg, { color: item.color, border: item.border, padding: '4px 8px' });
            badge.style.flexShrink = '0';
            const descEl = span(item.desc, { fontSize: '12px', color: '#555', lineHeight: '1.5' });
            row.appendChild(badge);
            row.appendChild(descEl);
            body.appendChild(row);
        }

        // kvGrid: a two column key:value grid for field references and named settings.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: '10px' });
            for (const [key, val] of pairs) {
                grid.appendChild(span(key, { fontFamily: 'monospace', fontSize: '11px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap' }));
                grid.appendChild(span(val, { fontSize: '12px', color: '#555', padding: '2px 0', lineHeight: '1.4' }));
            }
            body.appendChild(grid);
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Open any RITM or Incident ticket. The banner appears on its own when the Due Date is close.');
                    const steps = [
                        ['1', 'Pick your date format', 'The first time, a setup window asks which date format your ServiceNow uses.'],
                        ['2', 'Open a ticket', 'The script reads the Due Date field and counts down to it.'],
                        ['3', 'Watch the banner', 'A colored banner shows above the activity stream when 3 days or less remain.']
                    ];
                    for (const [n, title, desc] of steps) {
                        const num = chip(n, '#667eea', { radius: '50%', padding: '2px 7px' });
                        const text = document.createElement('div');
                        text.appendChild(span(title, { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333' }));
                        text.appendChild(span(desc, { display: 'block', fontSize: '12px', color: '#555', lineHeight: '1.4' }));
                        body.appendChild(hrow([ num, text ], { alignItems: 'flex-start', flexWrap: 'nowrap', margin: '0 0 8px 0' }));
                    }
                    caption(body, 'Works on tickets opened in a new tab (sc_req_item.do and incident.do pages).');
                }
            },
            {
                icon: '🚦', title: 'Banner Colors',
                buildContent(body) {
                    lead(body, 'The color and the message change as the Due Date gets closer.');
                    const levels = [
                        { bg: '#9370db', text: '⚠️ SLA NOTICE: 3 days remaining (Expires: ...)' },
                        { bg: '#ff8c00', text: '⚠️ SLA NOTICE: 2 days remaining (Expires: ...)' },
                        { bg: '#ff4444', text: '⚠️ SLA WARNING: 1 day remaining (Expires: ...)' },
                        { bg: '#ff4444', text: '🚨 SLA EXPIRES TODAY: 04:12:37 remaining' },
                        { bg: '#ff4444', text: '⚠️ SLA EXPIRED 2 day(s) ago!' }
                    ];
                    for (const l of levels) {
                        const bar = document.createElement('div');
                        bar.textContent = l.text;
                        Object.assign(bar.style, {
                            background: l.bg, color: '#fff', padding: '7px 12px', borderRadius: '3px',
                            fontWeight: 'bold', fontSize: '12px', textAlign: 'center', marginBottom: '6px',
                            fontFamily: 'Arial, sans-serif', boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                        });
                        body.appendChild(bar);
                    }
                    bullets(body, [
                        'On the last day the banner shows a live countdown in hours, minutes and seconds.',
                        'Nothing is shown while more than 3 days remain.',
                        'The banner is hidden on closed tickets: Closed Complete, Closed Incomplete, Cancelled, Resolved and Closed.'
                    ]);
                }
            },
            {
                icon: '📅', title: 'Date Format',
                buildContent(body) {
                    lead(body, 'Click the ⚙ button next to the Due Date field to change the date format at any time.');
                    const dueRow = hrow([
                        span('Due date', { fontSize: '12px', color: '#555', width: '70px' }),
                        span('2026-10-20 17:00:00', { fontSize: '12px', color: '#333', border: '1px solid #ccc', borderRadius: '3px', padding: '3px 8px', background: '#fff' }),
                        chip('⚙', '#f7f7f7', { color: '#555', border: '1px solid #ccc', radius: '3px', padding: '2px 7px', fontSize: '13px' })
                    ], { flexWrap: 'nowrap', gap: '6px', margin: '0 0 10px 0' });
                    body.appendChild(dueRow);
                    const formats = ['MM-dd-yyyy', 'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'];
                    body.appendChild(hrow(formats.map((f, i) => chip(f, i === 4 ? '#e8f0fe' : '#f7f7f7', {
                        color: '#1d1d1d', border: i === 4 ? '2px solid #4a90d9' : '1px solid #ccc', padding: '5px 9px'
                    }))));
                    caption(body, 'The format you use now is outlined in blue. The banner updates as soon as you pick a new one.');
                    bullets(body, [
                        'Not sure which one? Look at the Due Date field of any ticket, or check Date format in your ServiceNow profile.',
                        'If your profile shows None, pick yyyy-MM-dd.'
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent(body) {
                    lead(body, 'The only window is the date format picker. Its controls are:');
                    badgeRow(body, { bg: '#f7f7f7', color: '#555', border: '1px solid #ccc', label: '⚙', desc: 'Next to the Due Date field. Opens the date format picker.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'At the bottom of the date format picker. Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Suite', desc: 'Next to Help. Opens the Ticket Helpers settings: tools, team, tenant URLs and backups.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: 'none', label: "What's new 🔵", desc: 'Appears beside the version number after an update. Opens the changelog.' });
                    badgeRow(body, { bg: 'transparent', color: '#777', border: '1px solid #ccc', label: 'Cancel', desc: 'Closes the picker and keeps your current format.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'slaBannerHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000'
        });

        const modal = document.createElement('div');
        modal.id = 'slaBannerHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000001', background: '#fff', border: '2px solid #333', padding: '20px',
            borderRadius: '10px', width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333', boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', textAlign: 'left'
        });

        // Header
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📖';
        titleIcon.style.fontSize = '22px';
        const titleText = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, { fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const titleSub = document.createElement('div');
        titleSub.textContent = `SLA Alert Banner • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };
        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // Section cards, all start expanded
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, { border: '1px solid #e8e8f0', borderRadius: '6px', marginBottom: '8px', overflow: 'hidden' });
            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
            });
            const headerLeft = document.createElement('span');
            headerLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
            const iconEl = document.createElement('span');
            iconEl.textContent = section.icon;
            iconEl.style.fontSize = '14px';
            const titleLabel = document.createElement('span');
            titleLabel.textContent = section.title;
            Object.assign(titleLabel.style, { fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif' });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, { fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block' });
            cardHeader.appendChild(headerLeft);
            cardHeader.appendChild(chevron);
            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            let expanded = true;
            cardHeader.addEventListener('click', () => {
                expanded = !expanded;
                cardBody.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            contentWrap.appendChild(card);
        }
        modal.appendChild(contentWrap);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white', border: 'none',
            borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();
        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    // ─── Dark Mode Isolation ──────────────────────────────────────────────────

    function injectDarkModeStyles() {
        if (document.getElementById('sla-dark-mode-style')) return;
        const darkModeStyle = document.createElement('style');
        darkModeStyle.id = 'sla-dark-mode-style';
        darkModeStyle.textContent = `
            #sla-format-picker, #sla-changelog-modal, #slaBannerHelpModal {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
            #sla-format-picker input, #sla-format-picker select, #sla-format-picker textarea,
            #sla-changelog-modal input, #sla-changelog-modal select, #sla-changelog-modal textarea,
            #slaBannerHelpModal input, #slaBannerHelpModal select, #slaBannerHelpModal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(darkModeStyle);
    }

    // ─── Date Format Config ───────────────────────────────────────────────────

    const DATE_FORMAT_KEY = 'sla_banner_date_format';

    const DATE_FORMATS = {
        'MM-dd-yyyy': { label: 'MM-dd-yyyy  (e.g. 03-15-2024)', order: ['m','d','y'], sep: '-' },
        'dd/MM/yyyy': { label: 'dd/MM/yyyy  (e.g. 15/03/2024)', order: ['d','m','y'], sep: '/' },
        'dd-MM-yyyy': { label: 'dd-MM-yyyy  (e.g. 15-03-2024)', order: ['d','m','y'], sep: '-' },
        'dd.MM.yyyy': { label: 'dd.MM.yyyy  (e.g. 15.03.2024)', order: ['d','m','y'], sep: '.' },
        'yyyy-MM-dd': { label: 'yyyy-MM-dd  (e.g. 2024-03-15)', order: ['y','m','d'], sep: '-' },
    };

    let activeFormatKey = null;

    function showFormatPicker(isReconfigure, callback) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
        });

        const box = document.createElement('div');
        box.id = 'sla-format-picker';
        Object.assign(box.style, {
            background: '#fff',
            borderRadius: '6px',
            padding: '28px 32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        });

        const title = document.createElement('h2');
        title.textContent = isReconfigure
            ? '⚙️ SLA Banner — Change Date Format'
            : '📅 SLA Banner — First Time Setup';
        Object.assign(title.style, { margin: '0 0 10px', fontSize: '16px', color: '#1d1d1d' });

        // ── Hint paragraph ────────────────────────────────────────────────────
        const hint = document.createElement('p');
        Object.assign(hint.style, {
            margin: '0 0 6px',
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.6',
        });
        hint.innerHTML = isReconfigure
            ? 'Select the date format your ServiceNow instance uses. The banner will update immediately.'
            : 'Select the date format your ServiceNow instance uses.';

        const howTo = document.createElement('p');
        Object.assign(howTo.style, {
            margin: '0 0 20px',
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.6',
            borderLeft: '3px solid #e0e0e0',
            paddingLeft: '10px',
        });
        howTo.innerHTML =
            'Not sure? Check the <strong>Due Date</strong> field on any ticket, or go to your ' +
            '<strong>profile</strong> (top-right picture → <em>Profile</em>) and look for ' +
            '<strong>Date format</strong>. If it shows <strong>None</strong>, your format is ' +
            '<strong>yyyy-MM-dd</strong>.' +
            (isReconfigure ? '' : '<br><br>This can be changed later via the ⚙ button next to the Due Date field.');

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', flexDirection: 'column', gap: '10px' });

        Object.entries(DATE_FORMATS).forEach(([key, { label }]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;

            const isCurrent = isReconfigure && key === activeFormatKey;
            Object.assign(btn.style, {
                padding: '10px 14px',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                border: isCurrent ? '2px solid #4a90d9' : '1px solid #ccc',
                borderRadius: '4px',
                background: isCurrent ? '#e8f0fe' : '#f7f7f7',
                color: '#1d1d1d',
                transition: 'background 0.15s',
            });
            btn.onmouseover = () => { if (!isCurrent) btn.style.background = '#e8f0fe'; };
            btn.onmouseout  = () => { if (!isCurrent) btn.style.background = '#f7f7f7'; };
            btn.onclick = () => {
                GM_setValue(DATE_FORMAT_KEY, key);
                overlay.remove();
                callback(key);
            };
            btnGroup.appendChild(btn);
        });

        if (isReconfigure) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            Object.assign(cancel.style, {
                marginTop: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'transparent',
                color: '#777',
            });
            cancel.onmouseover = () => cancel.style.background = '#f0f0f0';
            cancel.onmouseout  = () => cancel.style.background = 'transparent';
            cancel.onclick = () => overlay.remove();
            btnGroup.appendChild(cancel);
        }

        const versionFooter = document.createElement('div');
        Object.assign(versionFooter.style, {
            marginTop: '16px', fontSize: '11px', color: '#aaa',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
            fontFamily: 'Arial, sans-serif',
        });

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif', marginRight: 'auto'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        versionFooter.appendChild(helpBtn);
        versionFooter.appendChild(createSuitePill());

        if (isNewVersion() && !hasSeenChangelog()) {
            const whatsNewLink = document.createElement('span');
            whatsNewLink.textContent = "What's new";
            Object.assign(whatsNewLink.style, {
                fontSize: '11px', color: '#667eea', cursor: 'pointer',
                textDecoration: 'underline', fontFamily: 'Arial, sans-serif',
            });
            whatsNewLink.onclick = () => { overlay.remove(); showChangelogModal(); };

            const notifDot = document.createElement('span');
            Object.assign(notifDot.style, {
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#007bff', display: 'inline-block', flexShrink: '0',
            });
            let dotBlue = true;
            setInterval(() => {
                dotBlue = !dotBlue;
                notifDot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);

            versionFooter.appendChild(whatsNewLink);
            versionFooter.appendChild(notifDot);
        }

        const versionLabel = document.createElement('span');
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        versionFooter.appendChild(versionLabel);

        box.append(title, hint, howTo, btnGroup, versionFooter);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ─── Date Parsing ─────────────────────────────────────────────────────────

    function parseDueDate(dateStr, formatKey) {
        if (!dateStr) return null;
        dateStr = dateStr.trim();

        const fmt = DATE_FORMATS[formatKey] || DATE_FORMATS['yyyy-MM-dd'];
        const { order } = fmt;

        // Match date part + optional time (supports -, /, . as separators)
        const match = dateStr.match(
            /^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
        );

        if (match) {
            const [, seg1, seg2, seg3, h = '0', min = '0', s = '0'] = match;
            const parts = { [order[0]]: seg1, [order[1]]: seg2, [order[2]]: seg3 };
            return new Date(+parts.y, +parts.m - 1, +parts.d, +h, +min, +s);
        }

        const fallback = new Date(dateStr);
        return isNaN(fallback) ? null : fallback;
    }

    // ─── Core Logic ───────────────────────────────────────────────────────────

    function getTimeRemaining(dueDate, formatKey) {
        const now = new Date();
        const due = parseDueDate(dueDate, formatKey);
        if (!due || isNaN(due)) return null;

        const diffMs = due - now;
        return {
            total:   diffMs,
            days:    Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours:   Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
            isToday: now.toDateString() === due.toDateString(),
            due,
        };
    }

    function getAlertColor(days, isToday) {
        if (isToday || days <= 1) return { bg: '#ff4444', text: '#ffffff' };
        if (days === 2)           return { bg: '#ff8c00', text: '#ffffff' };
        if (days === 3)           return { bg: '#9370db', text: '#ffffff' };
        return null;
    }

    // ─── Config Button (next to Due Date field) ───────────────────────────────

    function injectConfigButton() {
        if (document.getElementById('sla-config-btn')) return;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
        if (!dueDateInput) return;

        const configBtn = document.createElement('button');
        configBtn.id = 'sla-config-btn';
        configBtn.type = 'button';
        configBtn.textContent = '⚙';
        configBtn.title = 'SLA Banner — Change date format';
        Object.assign(configBtn.style, {
            marginLeft: '6px',
            padding: '2px 7px',
            fontSize: '13px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: '3px',
            background: '#f7f7f7',
            color: '#555',
            verticalAlign: 'middle',
            lineHeight: '1.4',
            transition: 'background 0.15s, color 0.15s',
        });
        configBtn.onmouseover = () => { configBtn.style.background = '#e8f0fe'; configBtn.style.color = '#1a73e8'; };
        configBtn.onmouseout  = () => { configBtn.style.background = '#f7f7f7'; configBtn.style.color = '#555'; };
        configBtn.onclick = () => {
            showFormatPicker(true, newFormatKey => {
                activeFormatKey = newFormatKey;
                const input = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
                if (input?.value) createOrUpdateBanner(input.value, newFormatKey);
            });
        };

        dueDateInput.insertAdjacentElement('afterend', configBtn);
    }

    // ─── State Check ─────────────────────────────────────────────────────────

    const TERMINAL_STATES = new Set([
        'closed complete',
        'closed incomplete',
        'cancelled',
        'resolved',
        'closed',
    ]);

    function isTicketClosed() {
        // ServiceNow renders the state as a select (edit mode) or a display span (read-only mode).
        // Try the select first, then fall back to common read-only label selectors.
        const stateSelect = document.querySelector('select[id$=".state"]');
        if (stateSelect) {
            const text = stateSelect.options[stateSelect.selectedIndex]?.text?.trim().toLowerCase() || '';
            return TERMINAL_STATES.has(text);
        }
        // Read-only display variants used by different SNow themes
        const stateLabel =
            document.querySelector('[id$=".state_label"]') ||
            document.querySelector('[id$=".state"] .select2-chosen');
        if (stateLabel) {
            return TERMINAL_STATES.has(stateLabel.textContent.trim().toLowerCase());
        }
        return false;
    }

    // ─── Banner ───────────────────────────────────────────────────────────────

    function createOrUpdateBanner(dueDate, formatKey) {
        if (isTicketClosed()) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const tr = getTimeRemaining(dueDate, formatKey);
        if (!tr) return;

        const { days, hours, minutes, seconds, isToday, total, due } = tr;

        if (days > 3 && !isToday && total > 0) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const colors = getAlertColor(days, isToday);
        if (!colors && total > 0) return;

        const targetElement = document.querySelector('.sn-form-inline-stream-entries')
            || document.querySelector('.activity-form-group')
            || document.querySelector('.tab_section');
        if (!targetElement) return;

        let banner = document.getElementById('sla-alert-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'sla-alert-banner';
            Object.assign(banner.style, {
                padding: '12px 15px',
                marginBottom: '15px',
                borderRadius: '3px',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: '1000',
                fontFamily: 'Arial, sans-serif',
            });
            targetElement.insertBefore(banner, targetElement.firstChild);
        }

        const finalColors = total < 0 ? { bg: '#ff4444', text: '#ffffff' } : colors;
        banner.style.backgroundColor = finalColors.bg;
        banner.style.color = finalColors.text;

        const pad = n => String(n).padStart(2, '0');
        const countdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        const expiryStr = due.toLocaleString();

        if      (total < 0)   banner.textContent = `⚠️ SLA EXPIRED ${Math.abs(days)} day(s) ago!`;
        else if (isToday)     banner.textContent = `🚨 SLA EXPIRES TODAY — ${countdown} remaining`;
        else if (days === 0)  banner.textContent = `🚨 SLA EXPIRES SOON — ${countdown} remaining`;
        else if (days === 1)  banner.textContent = `⚠️ SLA WARNING: 1 day remaining (Expires: ${expiryStr})`;
        else if (days === 2)  banner.textContent = `⚠️ SLA NOTICE: 2 days remaining (Expires: ${expiryStr})`;
        else if (days === 3)  banner.textContent = `⚠️ SLA NOTICE: 3 days remaining (Expires: ${expiryStr})`;
    }

    // ─── Monitor ──────────────────────────────────────────────────────────────

    function monitorDueDate(formatKey) {
        activeFormatKey = formatKey;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');

        if (!dueDateInput || !dueDateInput.value) {
            setTimeout(() => monitorDueDate(formatKey), 500);
            return;
        }

        injectConfigButton();
        createOrUpdateBanner(dueDateInput.value, formatKey);

        setInterval(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }, 1000);

        new MutationObserver(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }).observe(dueDateInput, { attributes: true, attributeFilter: ['value'] });
    }

    // ─── Entry Point ──────────────────────────────────────────────────────────

    function init() {
        injectDarkModeStyles();
        const savedFormat = GM_getValue(DATE_FORMAT_KEY, null);

        if (savedFormat && DATE_FORMATS[savedFormat]) {
            monitorDueDate(savedFormat);
        } else {
            // Waits until the import had its chance to bring the saved date format.
            dtWhenMigrationSettled(() => {
                const imported = GM_getValue(DATE_FORMAT_KEY, null);
                if (imported && DATE_FORMATS[imported]) monitorDueDate(imported);
                else showFormatPicker(false, formatKey => monitorDueDate(formatKey));
            });
        }

    }

    init();

    })();

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    // Tools ran their own start code above (the suite runs at document idle).
    // Now the migration check and the picker start, on ServiceNow and Netskope pages only.
    if (document.body && !document.getElementById('ticket-helpers-suite-marker')) {
        const marker = document.createElement('div');
        marker.id = 'ticket-helpers-suite-marker';
        marker.style.display = 'none';
        document.body.appendChild(marker);
    }
    dtAutoMigrate();
})();
