// ==UserScript==
// @name         Ticket Helpers Suite (preview)
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/TicketHelpersSuite.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/TicketHelpersSuite.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      0.1.0
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

    const SCRIPT_VERSION = '0.1.0';
    const CHANGELOG = `Version 0.1.0:
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
