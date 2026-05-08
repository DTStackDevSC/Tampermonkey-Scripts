// ==UserScript==
// @name         |Toolbar| Change Tracker
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.2.9
// @description  Structured per-ticket change audit log for ServiceNow / Netskope tickets
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('📝 Change Tracker loading...');

    /* ==========================================================
     *  VERSION
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.9';
    const CHANGELOG = `Version 1.2.9:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.2.8:
- Added Custom Categories group: Created / URL Lists Added / URL Lists Removed / Removed
  - Fully reconciled in Worknote summary (same net-change model as URL Lists)
  - Fields: category name + URL Lists textarea

Version 1.2.7:
- Added Network Locations group: Created / IPs Added / IPs Removed / Removed
- Renamed "Grouped" button to "Worknote"

Version 1.2.6:
- Grouped Summary reconciles ALL entry type groups (Steering Exceptions, App Exceptions,
  Policies, Steering/Client Configs now fully reconciled)

Version 1.2.3:
- Grouped Summary now reconciles domain-bearing entries (URL Lists, SSL Decryption)
  - Entries for the same named entity are merged into a single net state
  - Domains added and later removed are excluded from the summary output
  - Fully removed entities are shown as [REMOVED] with no domain list

Version 1.2.2:
- "URL List Updated" split into "URLs Added" and "URLs Removed" variants
- SSL Decryption group now mirrors URL Lists: Created / URLs Added / URLs Removed / Removed
- SSL Decryption schema updated to match URL List structure (Policy name + Domains)

Version 1.2.1:
- Replaced old URL type options with URL List Created / Updated / Removed (structured fields)
- Removed generic "Exception added", "Assignment updated", "Note / Comment" types
- Dropdown now uses grouped optgroups for easier navigation (Policies, URL Lists, SSL, etc.)

Version 1.2.0:
- Structured field forms per change type (Policy, SSL, Steering, App Exception, etc.)
- Empty type selection now defaults to "Custom" instead of blocking
- Edit button on every entry — change type or update any field
- Grouped Summary: copies all entries sorted by category for worknote pasting
- Export to JSON + Import from JSON (merge by ID, shareable with colleagues)
- Two-row action buttons: Copy | Summary | TXT | JSON / Import | Browse | Clear

Version 1.1.0:
- Structured append-only log replacing freeform textarea
- Predefined snippet dropdown, Copy All, Download TXT, Notes Browser
- Per-entry two-click inline delete

Version 1.0.0:
- Initial release`;

    /* ==========================================================
     *  FIELD SCHEMAS
     *  Each schema is an array of { key, label, type:'text'|'textarea' }
     * ==========================================================*/

    const FIELD_SCHEMAS = {
        policy_full: [
            { key: 'policyName',    label: 'Policy name',        type: 'text'     },
            { key: 'adGroup',       label: 'AD group',           type: 'text'     },
            { key: 'destination',   label: 'Destination',        type: 'text'     },
            { key: 'description',   label: 'Policy description', type: 'textarea' },
            { key: 'groupPosition', label: 'Group position',     type: 'text'     },
            { key: 'action',        label: 'Action',             type: 'text'     },
        ],
        policy_deleted: [
            { key: 'policyName',    label: 'Policy name',        type: 'text'     },
        ],
        ssl_policy: [
            { key: 'sslPolicyName', label: 'SSL Policy name', type: 'text'     },
            { key: 'domains',       label: 'Domains',          type: 'textarea' },
        ],
        steering_exception: [
            { key: 'urlsOrNetwork',   label: 'URLs / Network Location', type: 'textarea' },
            { key: 'steeringApplied', label: 'Steering/s applied to',   type: 'text'     },
        ],
        app_exception: [
            { key: 'app',             label: 'App',                     type: 'text' },
            { key: 'steeringApplied', label: 'Steering/s applied to',   type: 'text' },
        ],
        steering_config_full: [
            { key: 'configName',    label: 'Steering/Client Config name',      type: 'text' },
            { key: 'adGroup',       label: 'AD group',                         type: 'text' },
            { key: 'partnerTenant', label: 'Partner Tenant Access configured', type: 'text' },
        ],
        steering_config_deleted: [
            { key: 'configName',    label: 'Steering/Client Config name',      type: 'text' },
        ],
        url_list: [
            { key: 'urlListName', label: 'URL List name', type: 'text'     },
            { key: 'domains',     label: 'Domains',       type: 'textarea' },
        ],
        network_location: [
            { key: 'locationName', label: 'Network Location name', type: 'text'     },
            { key: 'ips',          label: 'IPs',                   type: 'textarea' },
        ],
        custom_category: [
            { key: 'categoryName', label: 'Custom Category name', type: 'text'     },
            { key: 'urlLists',     label: 'URL Lists',            type: 'textarea' },
        ],
    };

    /* ==========================================================
     *  SNIPPET GROUPS  (drives dropdown optgroups + all lookups)
     *  schema: null  → freeform textarea
     *  schema: 'key' → renders FIELD_SCHEMAS[key]
     * ==========================================================*/

    const SNIPPET_GROUPS = [
        {
            group: 'Policies',
            items: [
                { label: 'Policy Created',  value: 'Policy Created',  color: '#007bff', schema: 'policy_full'    },
                { label: 'Policy Modified', value: 'Policy Modified', color: '#6610f2', schema: 'policy_full'    },
                { label: 'Policy Deleted',  value: 'Policy Deleted',  color: '#c0392b', schema: 'policy_deleted' },
            ],
        },
        {
            group: 'URL Lists',
            items: [
                { label: 'URL List Created',       value: 'URL List Created',       color: '#28a745', schema: 'url_list' },
                { label: 'URL List — URLs Added',  value: 'URL List — URLs Added',  color: '#20c997', schema: 'url_list' },
                { label: 'URL List — URLs Removed',value: 'URL List — URLs Removed',color: '#fd7e14', schema: 'url_list' },
                { label: 'URL List Removed',       value: 'URL List Removed',       color: '#dc3545', schema: 'url_list' },
            ],
        },
        {
            group: 'Network Locations',
            items: [
                { label: 'Network Location Created',        value: 'Network Location Created',        color: '#28a745', schema: 'network_location' },
                { label: 'Network Location — IPs Added',    value: 'Network Location — IPs Added',    color: '#17a2b8', schema: 'network_location' },
                { label: 'Network Location — IPs Removed',  value: 'Network Location — IPs Removed',  color: '#fd7e14', schema: 'network_location' },
                { label: 'Network Location Removed',        value: 'Network Location Removed',        color: '#dc3545', schema: 'network_location' },
            ],
        },
        {
            group: 'Custom Categories',
            items: [
                { label: 'Custom Category Created',                value: 'Custom Category Created',                color: '#28a745', schema: 'custom_category' },
                { label: 'Custom Category — URL Lists Added',      value: 'Custom Category — URL Lists Added',      color: '#20c997', schema: 'custom_category' },
                { label: 'Custom Category — URL Lists Removed',    value: 'Custom Category — URL Lists Removed',    color: '#fd7e14', schema: 'custom_category' },
                { label: 'Custom Category Removed',                value: 'Custom Category Removed',                color: '#dc3545', schema: 'custom_category' },
            ],
        },
        {
            group: 'SSL Decryption',
            items: [
                { label: 'SSL Decryption Policy Created',       value: 'SSL Decryption Policy Created',       color: '#28a745', schema: 'ssl_policy' },
                { label: 'SSL Decryption — URLs Added',        value: 'SSL Decryption — URLs Added',         color: '#17a2b8', schema: 'ssl_policy' },
                { label: 'SSL Decryption — URLs Removed',      value: 'SSL Decryption — URLs Removed',       color: '#fd7e14', schema: 'ssl_policy' },
                { label: 'SSL Decryption Policy Removed',      value: 'SSL Decryption Policy Removed',       color: '#c0392b', schema: 'ssl_policy' },
            ],
        },
        {
            group: 'Steering Exceptions',
            items: [
                { label: 'Steering Exception Added',   value: 'Steering Exception Added',   color: '#28a745', schema: 'steering_exception' },
                { label: 'Steering Exception Removed', value: 'Steering Exception Removed', color: '#e74c3c', schema: 'steering_exception' },
            ],
        },
        {
            group: 'App Exceptions',
            items: [
                { label: 'App Exception Added',   value: 'App Exception Added',   color: '#20c997', schema: 'app_exception' },
                { label: 'App Exception Removed', value: 'App Exception Removed', color: '#fd7e14', schema: 'app_exception' },
            ],
        },
        {
            group: 'Steering / Client Configs',
            items: [
                { label: 'Steering/Client Config Created',  value: 'Steering/Client Config Created',  color: '#007bff', schema: 'steering_config_full'    },
                { label: 'Steering/Client Config Modified', value: 'Steering/Client Config Modified', color: '#6f42c1', schema: 'steering_config_full'    },
                { label: 'Steering/Client Config Deleted',  value: 'Steering/Client Config Deleted',  color: '#c0392b', schema: 'steering_config_deleted' },
            ],
        },
        {
            group: 'General',
            items: [
                { label: 'Custom', value: 'Custom', color: '#343a40', schema: null },
            ],
        },
    ];

    // Flat SNIPPETS list (for code that needs to iterate all items)
    const SNIPPETS = SNIPPET_GROUPS.flatMap(g => g.items);

    // Fast value → snippet lookup
    const SNIPPET_MAP = {};
    SNIPPETS.forEach(s => { SNIPPET_MAP[s.value] = s; });

    function getSnippet(type)   { return SNIPPET_MAP[type] || null; }
    function getSchemaKey(type) { return getSnippet(type)?.schema || null; }
    function getSchema(type)    { const k = getSchemaKey(type); return k ? (FIELD_SCHEMAS[k] || null) : null; }
    function typeColor(type)    { return getSnippet(type)?.color || '#495057'; }

    /**
     * Populates a <select> element with optgroup-organised options.
     * @param {HTMLSelectElement} selectEl
     * @param {string}  selectedValue  - pre-select this value ('' for none)
     * @param {boolean} addPlaceholder - prepend the "— Select —" blank option
     */
    function populateSnippetSelect(selectEl, selectedValue, addPlaceholder) {
        selectEl.innerHTML = '';
        if (addPlaceholder) {
            const ph = mk('option'); ph.value = ''; ph.textContent = '— Select a change type —';
            selectEl.appendChild(ph);
        }
        SNIPPET_GROUPS.forEach(({ group, items }) => {
            const grp = document.createElement('optgroup');
            grp.label = group;
            items.forEach(s => {
                const opt = mk('option');
                opt.value = s.value; opt.textContent = s.label;
                if (s.value === selectedValue) opt.selected = true;
                grp.appendChild(opt);
            });
            selectEl.appendChild(grp);
        });
    }

    /* ==========================================================
     *  CATEGORY GROUPS  (for grouped summary)
     * ==========================================================*/

    const CATEGORY_GROUPS = [
        { label: 'Policy Changes',              types: ['Policy Created', 'Policy Modified', 'Policy Deleted'] },
        { label: 'URL Lists',                   types: ['URL List Created', 'URL List — URLs Added', 'URL List — URLs Removed', 'URL List Removed'] },
        { label: 'Network Locations',           types: ['Network Location Created', 'Network Location — IPs Added', 'Network Location — IPs Removed', 'Network Location Removed'] },
        { label: 'Custom Categories',           types: ['Custom Category Created', 'Custom Category — URL Lists Added', 'Custom Category — URL Lists Removed', 'Custom Category Removed'] },
        { label: 'SSL Decryption Policies',     types: ['SSL Decryption Policy Created', 'SSL Decryption — URLs Added', 'SSL Decryption — URLs Removed', 'SSL Decryption Policy Removed'] },
        { label: 'Steering Exceptions',         types: ['Steering Exception Added', 'Steering Exception Removed'] },
        { label: 'App Exceptions',              types: ['App Exception Added', 'App Exception Removed'] },
        { label: 'Steering / Client Configs',   types: ['Steering/Client Config Created', 'Steering/Client Config Modified', 'Steering/Client Config Deleted'] },
        { label: 'Other',                       types: ['Custom'] },
    ];

    /* ==========================================================
     *  VERSION MANAGEMENT
     * ==========================================================*/

    function getStoredVersion()    { return GM_getValue('changeTrackerVersion', null); }
    function saveVersion(v)        { GM_setValue('changeTrackerVersion', v); }
    function hasSeenChangelog()    { return GM_getValue('changeTrackerChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue('changeTrackerChangelogSeen', SCRIPT_VERSION); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const p1 = v1.split('.').map(Number), p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            if ((p2[i]||0) > (p1[i]||0)) return true;
            if ((p2[i]||0) < (p1[i]||0)) return false;
        }
        return false;
    }

    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

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
        const overlay = mk('div', { id: 'ct-changelog-overlay' });
        const modal   = mk('div', { id: 'ct-changelog-modal'   });

        const h2 = mk('h2');
        h2.textContent = `What's New — v${SCRIPT_VERSION}`;

        const info = mk('div', { className: 'ct-cl-info' });
        info.textContent = `Updated to version ${SCRIPT_VERSION}!`;

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

        const btn = mk('button', { className: 'ct-cl-ok' });
        btn.textContent = 'Got it!';
        btn.onclick = () => {
            overlay.remove(); modal.remove();
            markChangelogAsSeen(); saveVersion(SCRIPT_VERSION);
            document.getElementById('ct-changelog-dot')?.remove();
            removeToolbarNotificationDot();
        };

        modal.append(h2, info, cardsWrap, btn);
        document.body.append(overlay, modal);
        overlay.onclick = () => btn.click();
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* ── Z-INDEX NOTES ──────────────────────────────────────
         * Toolbar / Mini Summary Sidebar : 999997–999998
         * Change Tracker sidebar         : 999997  (peer)
         * Notes Browser modal            : 999999
         * Edit modal                     : 1050000
         * Confirm modal                  : 1100000
         * Changelog overlay/modal        : 20000/20001
         * ─────────────────────────────────────────────────────*/

        #ct-changelog-dot {
            display: inline-flex !important; align-items: center !important;
            gap: 6px !important; cursor: pointer !important;
            margin-left: 10px !important; padding: 3px 8px !important;
            border-radius: 4px !important; transition: background-color .2s !important;
        }
        #ct-changelog-dot:hover { background: rgba(40,167,69,.1) !important; }
        #ct-changelog-dot .ct-dot {
            width: 8px !important; height: 8px !important; border-radius: 50% !important;
            animation: ctPulse 1s ease-in-out infinite !important;
        }
        @keyframes ctPulse { 0%,100% { background-color:#28a745; } 50% { background-color:#ff8c00; } }
        #ct-changelog-dot .ct-dot-label {
            font-size: 11px !important; color: #28a745 !important;
            text-decoration: underline !important; font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 20001 !important;
            background: #fff !important; border: 2px solid #333 !important;
            padding: 20px !important; border-radius: 10px !important;
            max-width: 600px !important; max-height: 80vh !important; overflow-y: auto !important;
            font-family: Arial, sans-serif !important; color: #333 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,.3) !important;
        }
        #ct-changelog-modal h2 {
            margin: 0 0 14px !important; border-bottom: 2px solid #28a745 !important;
            padding-bottom: 10px !important; font-size: 1.4em !important;
            color: #333 !important; font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal .ct-cl-info {
            background: #f8f9fa !important; border-left: 4px solid #28a745 !important;
            padding: 10px !important; border-radius: 5px !important;
            margin-bottom: 14px !important; font-size: 13px !important;
            font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal .ct-cl-body {
            white-space: pre-wrap !important; font-family: 'Courier New', monospace !important;
            font-size: 12px !important; background: #fafafa !important;
            padding: 10px !important; border-radius: 5px !important; line-height: 1.6 !important;
        }
        #ct-changelog-modal .ct-cl-ok {
            margin-top: 14px !important; padding: 10px 20px !important;
            background: #28a745 !important; color: #fff !important; border: none !important;
            border-radius: 5px !important; cursor: pointer !important;
            font-weight: bold !important; width: 100% !important;
            font-family: Arial, sans-serif !important; font-size: 14px !important;
        }
        #ct-changelog-modal .ct-cl-ok:hover { background: #218838 !important; }
        #ct-changelog-overlay {
            position: fixed !important; inset: 0 !important;
            background: rgba(0,0,0,.5) !important; z-index: 20000 !important;
        }
        #ct-browser-overlay {
            position: fixed !important; inset: 0 !important;
            background: rgba(0,0,0,.55) !important; z-index: 999999 !important;
        }
        #ct-browser-modal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 1000000 !important;
            background: #f9f9f9 !important; border: 1px solid #ccc !important;
            border-radius: 10px !important; padding: 20px !important;
            width: 580px !important; max-width: 90vw !important;
            max-height: 80vh !important; overflow-y: auto !important;
            font-family: Arial, sans-serif !important;
            box-shadow: 0 6px 24px rgba(0,0,0,.25) !important;
        }
    `;
    document.head.appendChild(styleEl);

    /* ==========================================================
     *  TOOL ICON  (pencil)
     * ==========================================================*/

    const TOOL_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>`;

    /* ==========================================================
     *  STATE
     * ==========================================================*/

    let isInitialized        = false;
    let isRegistered         = false;
    let registrationAttempts = 0;
    const MAX_ATTEMPTS       = 10;
    const RETRY_DELAY        = 500;
    let sidebarVisible       = false;

    /* ==========================================================
     *  HELPERS
     * ==========================================================*/

    function mk(tag, props = {}) { const n = document.createElement(tag); Object.assign(n, props); return n; }
    function css(n, s) { Object.assign(n.style, s); return n; }
    function pad(n) { return String(n).padStart(2, '0'); }
    function nowStamp() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    /* ==========================================================
     *  TICKET NUMBER DETECTION
     * ==========================================================*/

    function getTicketNumber() {
        for (const id of ['sc_req_item.number', 'incident.number']) {
            const n = document.getElementById(id);
            if (n?.value?.trim()) return n.value.trim();
        }
        const m = window.location.search.match(/[?&]sys_id=([^&]+)/);
        return m ? `SYS_${m[1].slice(0, 8)}` : 'UNKNOWN';
    }

    /* ==========================================================
     *  STORAGE
     *  Entry format: { id, ts, type, fields: obj|null, note: str|null }
     *  - Structured types  → fields populated, note null
     *  - Freeform types    → fields null, note populated
     *  Backward compat: old v1.1.0 entries only have {id,ts,type,note} — handled gracefully
     * ==========================================================*/

    const PREFIX = 'changeTracker_notes_';

    function storeKey(ticket)        { return PREFIX + ticket; }
    function loadEntries(ticket)     { try { return JSON.parse(GM_getValue(storeKey(ticket), '[]')); } catch { return []; } }
    function saveEntries(t, entries) { GM_setValue(storeKey(t), JSON.stringify(entries)); }
    function clearEntries(ticket)    { GM_deleteValue(storeKey(ticket)); }

    function addEntry(ticket, type, fields, note) {
        const entries = loadEntries(ticket);
        entries.push({ id: uid(), ts: nowStamp(), type, fields: fields || null, note: (note || null) });
        saveEntries(ticket, entries);
        return entries;
    }

    function updateEntry(ticket, entryId, type, fields, note) {
        const entries = loadEntries(ticket);
        const idx     = entries.findIndex(e => e.id === entryId);
        if (idx !== -1) {
            entries[idx] = { ...entries[idx], type, fields: fields || null, note: note || null };
            saveEntries(ticket, entries);
        }
        return entries;
    }

    function deleteEntry(ticket, entryId) {
        const entries = loadEntries(ticket).filter(e => e.id !== entryId);
        saveEntries(ticket, entries);
        return entries;
    }

    function allTicketData() {
        const results = [];
        try {
            GM_listValues().forEach(key => {
                if (!key.startsWith(PREFIX)) return;
                const ticket = key.slice(PREFIX.length);
                if (ticket) results.push({ ticket, entries: loadEntries(ticket) });
            });
        } catch (e) { console.warn('CT: GM_listValues failed', e); }
        results.sort((a, b) => {
            const la = a.entries.length ? a.entries[a.entries.length-1].ts : '';
            const lb = b.entries.length ? b.entries[b.entries.length-1].ts : '';
            return lb.localeCompare(la);
        });
        return results;
    }

    /* ==========================================================
     *  FIELD FORM BUILDERS  (reused in sidebar + edit modal)
     * ==========================================================*/

    /**
     * Renders form inputs for a given schema into a container element.
     * @param {Array}  schema   - array of field defs from FIELD_SCHEMAS
     * @param {Object} values   - prefill values
     * @param {string} prefix   - ID prefix to avoid collisions between sidebar and modal
     * @param {HTMLElement} container - target container (its contents are replaced)
     */
    function buildFieldInputs(schema, values, prefix, container) {
        container.innerHTML = '';
        schema.forEach(f => {
            const wrap = css(mk('div'), { marginBottom: '7px' });

            const lbl = css(mk('label'), {
                display: 'block', fontSize: '11px', fontWeight: 'bold',
                color: '#666', marginBottom: '3px', fontFamily: 'Arial, sans-serif'
            });
            lbl.textContent = f.label;
            lbl.htmlFor = `${prefix}-${f.key}`;

            let input;
            if (f.type === 'textarea') {
                input = css(mk('textarea'), {
                    width: '100%', height: '52px', resize: 'vertical',
                    fontFamily: '"Courier New", Courier, monospace', fontSize: '12px',
                    padding: '6px', border: '1px solid #ccc', borderRadius: '4px',
                    background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none'
                });
            } else {
                input = css(mk('input'), {
                    width: '100%', padding: '6px 8px', border: '1px solid #ccc',
                    borderRadius: '4px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
                    background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none'
                });
                input.type = 'text';
            }
            input.id          = `${prefix}-${f.key}`;
            input.placeholder = f.label;
            if (values && values[f.key]) input.value = values[f.key];

            wrap.append(lbl, input);
            container.appendChild(wrap);
        });
    }

    /** Builds the freeform textarea and appends it into container. */
    function buildFreeformInput(note, prefix, container) {
        container.innerHTML = '';
        const ta = css(mk('textarea', { id: `${prefix}-note` }), {
            width: '100%', height: '60px', resize: 'vertical',
            fontFamily: '"Courier New", Courier, monospace', fontSize: '12px',
            lineHeight: '1.5', padding: '8px', border: '1px solid #ccc',
            borderRadius: '4px', background: '#fafafa', color: '#333',
            boxSizing: 'border-box', outline: 'none'
        });
        ta.placeholder = 'Details (optional) — e.g. domain, user, reason…';
        if (note) ta.value = note;
        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddEntry();
        });
        container.appendChild(ta);
    }

    /** Rebuilds the dynamic input area based on selected type. */
    function rebuildInputFields(type, values, note, prefix, container) {
        const schema = getSchema(type);
        if (schema) {
            buildFieldInputs(schema, values || {}, prefix, container);
        } else {
            buildFreeformInput(note || '', prefix, container);
        }
    }

    /** Collects values from schema field inputs. */
    function collectFieldValues(schema, prefix) {
        const vals = {};
        schema.forEach(f => {
            const el = document.getElementById(`${prefix}-${f.key}`);
            vals[f.key] = el ? el.value.trim() : '';
        });
        return vals;
    }

    /* ==========================================================
     *  ENTRY CONTENT FORMATTER  (for card display + export text)
     * ==========================================================*/

    function formatEntryContent(entry, forExport = false) {
        if (entry.fields && typeof entry.fields === 'object') {
            const schema = getSchema(entry.type);
            if (schema) {
                const lines = schema
                    .filter(f => entry.fields[f.key])
                    .map(f => `${f.label}: ${entry.fields[f.key]}`);
                return lines.join(forExport ? '\n' : '\n') || '(all fields empty)';
            }
            return Object.entries(entry.fields)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n') || '(all fields empty)';
        }
        return entry.note || '(no detail provided)';
    }

    /* ==========================================================
     *  EXPORT / IMPORT
     * ==========================================================*/

    function entriesToText(ticket, entries) {
        const sep  = '─'.repeat(50);
        const head = `Change Log — ${ticket}\nGenerated: ${nowStamp()}\n${sep}\n`;
        if (!entries.length) return head + '\n(no entries)\n';
        return head + '\n' + [...entries].reverse()
            .map(e => `[${e.ts}] ${e.type}\n${formatEntryContent(e, true)}\n`)
            .join('\n');
    }

    async function copyToClipboard(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    }

    function triggerDownload(filename, content, mime) {
        const blob = new Blob([content], { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    /* ==========================================================
     *  GROUPED SUMMARY BUILDER  (with full net-state reconciliation)
     * ==========================================================*/

    // ── Domain-list reconciliation ─────────────────────────────
    // Used for URL Lists, SSL Decryption, Steering Exceptions, App Exceptions.
    // nameKey   : entry.fields key that identifies the entity (e.g. the list name)
    // domainKey : entry.fields key that holds the items to reconcile (domains, apps, etc.)
    // addTypes / removeTypes / deleteTypes : entry type strings for each operation

    const RECONCILE_CONFIG = {
        'URL Lists': {
            nameKey:     'urlListName',
            domainKey:   'domains',
            addTypes:    ['URL List Created', 'URL List — URLs Added'],
            removeTypes: ['URL List — URLs Removed'],
            deleteTypes: ['URL List Removed'],
        },
        'SSL Decryption Policies': {
            nameKey:     'sslPolicyName',
            domainKey:   'domains',
            addTypes:    ['SSL Decryption Policy Created', 'SSL Decryption — URLs Added'],
            removeTypes: ['SSL Decryption — URLs Removed'],
            deleteTypes: ['SSL Decryption Policy Removed'],
        },
        'Steering Exceptions': {
            nameKey:     'steeringApplied',
            domainKey:   'urlsOrNetwork',
            addTypes:    ['Steering Exception Added'],
            removeTypes: ['Steering Exception Removed'],
            deleteTypes: [],
        },
        'App Exceptions': {
            nameKey:     'steeringApplied',
            domainKey:   'app',
            addTypes:    ['App Exception Added'],
            removeTypes: ['App Exception Removed'],
            deleteTypes: [],
        },
        'Network Locations': {
            nameKey:     'locationName',
            domainKey:   'ips',
            addTypes:    ['Network Location Created', 'Network Location — IPs Added'],
            removeTypes: ['Network Location — IPs Removed'],
            deleteTypes: ['Network Location Removed'],
        },
        'Custom Categories': {
            nameKey:     'categoryName',
            domainKey:   'urlLists',
            addTypes:    ['Custom Category Created', 'Custom Category — URL Lists Added'],
            removeTypes: ['Custom Category — URL Lists Removed'],
            deleteTypes: ['Custom Category Removed'],
        },
    };

    // ── Lifecycle reconciliation ───────────────────────────────
    // Used for Policies and Steering/Client Configs.
    // Tracks whether an entity was created, modified, and/or deleted within the ticket.
    // Created + Deleted in same ticket = net zero → skipped entirely in summary.

    const LIFECYCLE_CONFIG = {
        'Policy Changes': {
            nameKey:     'policyName',
            createTypes: ['Policy Created'],
            modifyTypes: ['Policy Modified'],
            deleteTypes: ['Policy Deleted'],
        },
        'Steering / Client Configs': {
            nameKey:     'configName',
            createTypes: ['Steering/Client Config Created'],
            modifyTypes: ['Steering/Client Config Modified'],
            deleteTypes: ['Steering/Client Config Deleted'],
        },
    };

    // ── Shared helpers ─────────────────────────────────────────

    /** Splits a freeform value string (comma / newline / semicolon) into trimmed items. */
    function parseDomains(raw) {
        return (raw || '').split(/[\n,;]+/).map(d => d.trim()).filter(Boolean);
    }

    /**
     * Domain-list reconciliation (firstOp + lastOp net-change model).
     *
     *   firstOp=+, lastOp=+  → [ADDED]    new item, still present
     *   firstOp=-, lastOp=-  → [REMOVED]  pre-existing item, still gone
     *   firstOp=+, lastOp=-  → SKIP       added then removed = net zero
     *   firstOp=-, lastOp=+  → SKIP       pre-existing, removed then re-added = net zero
     *
     * Returns [{ name, items: [{display, op}], deleted }] in first-seen entity order.
     */
    function reconcileEntityEntries(entries, config) {
        const entityOrder = [];
        const entityMap   = {};

        entries.forEach(entry => {
            const name = entry.fields?.[config.nameKey]?.trim() || '(unnamed)';

            if (!entityMap[name]) {
                entityOrder.push(name);
                entityMap[name] = { ops: new Map(), deleted: false };
            }

            const rec   = entityMap[name];
            const items = parseDomains(entry.fields?.[config.domainKey] || '');

            if (config.addTypes.includes(entry.type)) {
                items.forEach(d => {
                    const key = d.toLowerCase(), ex = rec.ops.get(key);
                    rec.ops.set(key, ex
                        ? { ...ex, lastOp: '+' }
                        : { display: d, firstOp: '+', lastOp: '+' });
                });
                rec.deleted = false;

            } else if (config.removeTypes.includes(entry.type)) {
                items.forEach(d => {
                    const key = d.toLowerCase(), ex = rec.ops.get(key);
                    rec.ops.set(key, ex
                        ? { ...ex, lastOp: '-' }
                        : { display: d, firstOp: '-', lastOp: '-' });
                });

            } else if (config.deleteTypes.includes(entry.type)) {
                rec.deleted = true;
            }
        });

        return entityOrder.map(name => {
            const { ops, deleted } = entityMap[name];
            const items = [...ops.values()]
                .filter(({ firstOp, lastOp }) => firstOp === lastOp)  // net-zero pairs dropped
                .map(({ display, lastOp }) => ({ display, op: lastOp }));
            return { name, items, deleted };
        });
    }

    /**
     * Lifecycle reconciliation for Created / Modified / Deleted entities.
     *
     * Rules (evaluated on the sequence of ops in chronological order):
     *   first=create, last=delete → SKIP (created and deleted in same ticket = net zero)
     *   last=delete               → [DELETED]  show entity name only
     *   first=create              → [CREATED]  show latest field values
     *   (only modifications)      → [MODIFIED] show latest field values
     *
     * Returns [{ name, tag, latestFields, latestType }] with net-zero entries removed.
     */
    function reconcileLifecycleEntries(entries, config) {
        const entityOrder = [];
        const entityMap   = {};

        entries.forEach(entry => {
            const name = entry.fields?.[config.nameKey]?.trim() || '(unnamed)';

            if (!entityMap[name]) {
                entityOrder.push(name);
                entityMap[name] = { firstCat: null, lastCat: null, latestFields: null, latestType: null };
            }

            const rec = entityMap[name];
            const cat = config.createTypes.includes(entry.type) ? 'create'
                      : config.modifyTypes.includes(entry.type) ? 'modify'
                      : config.deleteTypes.includes(entry.type) ? 'delete'
                      : null;
            if (!cat) return;

            if (!rec.firstCat) rec.firstCat = cat;
            rec.lastCat      = cat;
            rec.latestFields = entry.fields;
            rec.latestType   = entry.type;
        });

        return entityOrder
            .map(name => {
                const { firstCat, lastCat, latestFields, latestType } = entityMap[name];
                // Determine summary tag
                const tag = lastCat === 'delete' ? '[DELETED]'
                          : firstCat === 'create' ? '[CREATED]'
                          : '[MODIFIED]';
                return { name, firstCat, lastCat, tag, latestFields, latestType };
            })
            // Drop net-zero: created then deleted within the same ticket
            .filter(({ firstCat, lastCat }) => !(firstCat === 'create' && lastCat === 'delete'));
    }

    // ── Summary builder ────────────────────────────────────────

    function buildGroupedSummary(ticket, entries) {
        const bar        = '═'.repeat(50);
        const lines      = [`CHANGE SUMMARY — ${ticket}`, `Generated: ${nowStamp()}`, bar, ''];
        const coveredIds = new Set();

        CATEGORY_GROUPS.forEach(({ label, types }) => {
            const matching = entries.filter(e => types.includes(e.type));
            if (!matching.length) return;

            // Always mark entries as covered so they don't appear in the catch-all
            matching.forEach(e => coveredIds.add(e.id));

            const chronological = [...matching].sort((a, b) => a.ts.localeCompare(b.ts));
            const reconcileConf = RECONCILE_CONFIG[label];
            const lifecycleConf = LIFECYCLE_CONFIG[label];

            if (reconcileConf) {
                // ── Domain-list groups ──────────────────────────
                const reconciled = reconcileEntityEntries(chronological, reconcileConf);
                if (!reconciled.length) return;

                lines.push(`[ ${label} ]`, '');
                reconciled.forEach(({ name, items, deleted }) => {
                    lines.push(`  ${name}${deleted ? '  [REMOVED]' : ''}`);
                    if (items.length) {
                        items.forEach(({ display, op }) =>
                            lines.push(`    • ${display}  ${op === '+' ? '[ADDED]' : '[REMOVED]'}`)
                        );
                    } else if (!deleted) {
                        lines.push(`    • (no items recorded)`);
                    }
                    lines.push('');
                });

            } else if (lifecycleConf) {
                // ── Lifecycle groups (Policies, Steering Configs) ─
                const reconciled = reconcileLifecycleEntries(chronological, lifecycleConf);
                if (!reconciled.length) return; // all entries cancelled out, skip group

                lines.push(`[ ${label} ]`, '');
                reconciled.forEach(({ name, tag, lastCat, latestFields, latestType }) => {
                    lines.push(`  ${name}  ${tag}`);

                    if (lastCat !== 'delete' && latestFields) {
                        // Show latest field values (skip the name field itself — already on the header)
                        const schema = getSchema(latestType);
                        if (schema) {
                            schema
                                .filter(f => f.key !== lifecycleConf.nameKey && latestFields[f.key])
                                .forEach(f => lines.push(`    • ${f.label}: ${latestFields[f.key]}`));
                        }
                    }
                    lines.push('');
                });

            } else {
                // ── Non-reconciled groups (Other / Custom) ────────
                lines.push(`[ ${label} ]`, '');
                chronological.forEach(e => {
                    lines.push(`  ${e.type}  •  ${e.ts}`);
                    formatEntryContent(e, true).split('\n')
                        .forEach(line => lines.push(`    • ${line}`));
                    lines.push('');
                });
            }
        });

        // Catch-all for types not covered by any CATEGORY_GROUP
        const uncovered = entries.filter(e => !coveredIds.has(e.id));
        if (uncovered.length) {
            lines.push('[ Other ]', '');
            uncovered
                .sort((a, b) => a.ts.localeCompare(b.ts))
                .forEach(e => {
                    lines.push(`  ${e.type}  •  ${e.ts}`);
                    formatEntryContent(e, true).split('\n')
                        .forEach(line => lines.push(`    • ${line}`));
                    lines.push('');
                });
        }

        return lines.join('\n').trim();
    }

    /* ==========================================================
     *  FLASH STATUS
     * ==========================================================*/

    function flashStatus(msg, color = '#28a745', ms = 2800) {
        const el = document.getElementById('ct-status');
        if (!el) return;
        el.style.color = color;
        el.textContent = msg;
        setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, ms);
    }

    /* ==========================================================
     *  INLINE TWO-CLICK CONFIRM  (per-entry delete)
     * ==========================================================*/

    function inlineConfirm(btn, onConfirm) {
        if (btn.dataset.confirming === '1') { onConfirm(); return; }
        const origText = btn.textContent, origBg = btn.style.background;
        btn.dataset.confirming = '1';
        btn.textContent = 'Sure?'; btn.style.background = '#c0392b';
        setTimeout(() => {
            if (btn.dataset.confirming === '1') {
                btn.dataset.confirming = ''; btn.textContent = origText; btn.style.background = origBg;
            }
        }, 3000);
    }

    /* ==========================================================
     *  CONFIRM MODAL  (bulk / destructive actions)
     * ==========================================================*/

    function confirmModal(message, onYes) {
        const ov = css(mk('div'), { position:'fixed', inset:'0', background:'rgba(0,0,0,.45)', zIndex:'1100000' });
        const md = css(mk('div'), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1100001', background:'#fff', border:'2px solid #dc3545',
            padding:'24px', borderRadius:'10px', fontFamily:'Arial, sans-serif',
            minWidth:'300px', boxShadow:'0 4px 16px rgba(0,0,0,.3)', textAlign:'center'
        });
        const msg = css(mk('p'), { margin:'0 0 18px', fontSize:'13px', color:'#333', lineHeight:'1.5', whiteSpace:'pre-line' });
        msg.textContent = message;
        const row = css(mk('div'), { display:'flex', gap:'10px', justifyContent:'center' });
        const bs = { padding:'8px 22px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif' };
        const yes = css(mk('button'), { ...bs, background:'#dc3545', color:'#fff' });
        yes.textContent = 'Delete';
        yes.onclick = () => { ov.remove(); md.remove(); onYes(); };
        const no = css(mk('button'), { ...bs, background:'#6c757d', color:'#fff' });
        no.textContent = 'Cancel';
        no.onclick = () => { ov.remove(); md.remove(); };
        row.append(yes, no); md.append(msg, row);
        document.body.append(ov, md);
        ov.onclick = () => no.click();
    }

    /* ==========================================================
     *  ENTRY CARD RENDERER
     * ==========================================================*/

    function renderEntryCard(entry, ticket, onMutated) {
        const color = typeColor(entry.type);

        const card = css(mk('div'), {
            background:'#fff', border:'1px solid #e0e0e0', borderRadius:'6px',
            padding:'10px 12px 10px 16px', marginBottom:'8px', position:'relative'
        });

        // Left colour accent bar
        card.appendChild(css(mk('div'), {
            position:'absolute', left:'0', top:'0', bottom:'0',
            width:'4px', borderRadius:'6px 0 0 6px', background: color
        }));

        // Top row: badge + action buttons
        const topRow = css(mk('div'), { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'6px' });

        const badge = css(mk('span'), {
            display:'inline-block', padding:'2px 8px', background: color, color:'#fff',
            borderRadius:'3px', fontSize:'11px', fontWeight:'bold', fontFamily:'Arial, sans-serif',
            flexShrink: '0'
        });
        badge.textContent = entry.type;

        const btnGroup = css(mk('div'), { display:'flex', gap:'4px', marginLeft:'6px', flexShrink:'0' });

        // Edit button
        const editBtn = css(mk('button'), {
            background:'#667eea', color:'#fff', border:'none', borderRadius:'3px',
            cursor:'pointer', padding:'2px 8px', fontSize:'10px', fontFamily:'Arial, sans-serif', fontWeight:'bold'
        });
        editBtn.textContent = '✎ Edit';
        editBtn.onclick = () => openEditModal(ticket, entry, onMutated);

        // Delete button
        const delBtn = css(mk('button'), {
            background:'#e9ecef', color:'#6c757d', border:'none', borderRadius:'3px',
            cursor:'pointer', padding:'2px 8px', fontSize:'11px', fontFamily:'Arial, sans-serif', fontWeight:'bold'
        });
        delBtn.textContent = '×';
        delBtn.title = 'Delete entry (click twice)';
        delBtn.onclick = () => inlineConfirm(delBtn, () => {
            css(card, { opacity:'0', transition:'opacity .2s' });
            setTimeout(() => { card.remove(); deleteEntry(ticket, entry.id); onMutated(); }, 200);
        });

        btnGroup.append(editBtn, delBtn);
        topRow.append(badge, btnGroup);
        card.appendChild(topRow);

        // Content
        const contentEl = css(mk('div'), {
            fontSize:'12px', color:'#333', lineHeight:'1.6', whiteSpace:'pre-wrap',
            wordBreak:'break-word', fontFamily:'Arial, sans-serif'
        });
        contentEl.textContent = formatEntryContent(entry);
        card.appendChild(contentEl);

        // Timestamp
        card.appendChild(css(Object.assign(mk('div'), { textContent: entry.ts }), {
            fontSize:'10px', color:'#bbb', marginTop:'6px', fontFamily:'monospace'
        }));

        return card;
    }

    /* ==========================================================
     *  LOG REFRESH
     * ==========================================================*/

    function refreshLog(ticket) {
        const container = document.getElementById('ct-log-container');
        const countEl   = document.getElementById('ct-entry-count');
        if (!container) return;

        const entries = loadEntries(ticket);
        container.innerHTML = '';

        if (countEl) countEl.textContent = entries.length
            ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
            : 'No entries yet';

        if (!entries.length) {
            container.appendChild(
                css(Object.assign(mk('div'), { textContent: 'No changes logged yet — add your first entry above.' }), {
                    textAlign:'center', color:'#ccc', fontSize:'12px',
                    padding:'28px 0', fontFamily:'Arial, sans-serif', fontStyle:'italic'
                })
            );
            return;
        }

        [...entries].reverse().forEach(e =>
            container.appendChild(renderEntryCard(e, ticket, () => refreshLog(ticket)))
        );
    }

    /* ==========================================================
     *  EDIT MODAL
     * ==========================================================*/

    function openEditModal(ticket, entry, onSaved) {
        document.getElementById('ct-edit-overlay')?.remove();
        document.getElementById('ct-edit-modal')?.remove();

        const overlay = css(mk('div', { id:'ct-edit-overlay' }), {
            position:'fixed', inset:'0', background:'rgba(0,0,0,.5)', zIndex:'1050000'
        });
        const modal = css(mk('div', { id:'ct-edit-modal' }), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1050001', background:'#f9f9f9', border:'1px solid #ccc',
            borderRadius:'10px', padding:'20px', width:'480px', maxWidth:'92vw',
            maxHeight:'86vh', overflowY:'auto', fontFamily:'Arial, sans-serif',
            boxShadow:'0 6px 24px rgba(0,0,0,.25)'
        });

        // Header
        const hdr = css(mk('div'), { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' });
        const hTitle = css(mk('div'), { fontSize:'15px', fontWeight:'bold', color:'#333', fontFamily:'Arial, sans-serif' });
        hTitle.textContent = '✎ Edit Entry';
        const closeX = css(mk('button'), { background:'red', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', padding:'4px 10px', fontWeight:'bold', fontSize:'18px', lineHeight:'1' });
        closeX.textContent = '×';
        closeX.onclick = () => { overlay.remove(); modal.remove(); };
        hdr.append(hTitle, closeX);
        modal.appendChild(hdr);

        // Timestamp note
        modal.appendChild(css(Object.assign(mk('div'), { textContent: `Created: ${entry.ts}  (timestamp is immutable)` }), {
            fontSize:'10px', color:'#aaa', marginBottom:'12px', fontFamily:'monospace'
        }));

        // Type label
        modal.appendChild(css(Object.assign(mk('div'), { textContent: 'Change type' }), {
            fontSize:'11px', fontWeight:'bold', color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));

        // Type dropdown — all types, grouped, pre-selected to current entry type
        const typeSelect = css(mk('select', { id:'ct-edit-type' }), {
            width:'100%', padding:'7px 10px', borderRadius:'4px', border:'1px solid #ccc',
            fontSize:'12px', fontFamily:'Arial, sans-serif', marginBottom:'12px',
            background:'#fff', boxSizing:'border-box', cursor:'pointer'
        });
        populateSnippetSelect(typeSelect, entry.type, false);
        modal.appendChild(typeSelect);

        // Dynamic fields container
        const fieldsContainer = mk('div', { id:'ct-edit-fields-container' });
        modal.appendChild(fieldsContainer);

        // Build/rebuild fields
        let prevSchemaKey = getSchemaKey(entry.type);
        rebuildInputFields(entry.type, entry.fields, entry.note, 'ct-edit-field', fieldsContainer);

        typeSelect.addEventListener('change', () => {
            const newType      = typeSelect.value;
            const newSchemaKey = getSchemaKey(newType);
            // Preserve values if schema didn't change
            const carry = (prevSchemaKey && newSchemaKey === prevSchemaKey && FIELD_SCHEMAS[prevSchemaKey])
                ? collectFieldValues(FIELD_SCHEMAS[prevSchemaKey], 'ct-edit-field')
                : {};
            rebuildInputFields(newType, carry, null, 'ct-edit-field', fieldsContainer);
            prevSchemaKey = newSchemaKey;
        });

        // Save / Cancel
        const btnRow = css(mk('div'), { display:'flex', gap:'10px', marginTop:'14px' });

        const saveBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        saveBtn.textContent = '✓ Save Changes';
        saveBtn.onclick = () => {
            const newType  = typeSelect.value;
            const schema   = getSchema(newType);
            const newFields = schema ? collectFieldValues(schema, 'ct-edit-field') : null;
            const newNote   = !schema
                ? (document.getElementById('ct-edit-field-note')?.value.trim() || '')
                : null;

            updateEntry(ticket, entry.id, newType, newFields, newNote);
            overlay.remove(); modal.remove();
            refreshLog(ticket);
            flashStatus('✓ Entry updated.');
            if (onSaved) onSaved();
        };

        const cancelBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#6c757d', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        btnRow.append(cancelBtn, saveBtn);
        modal.appendChild(btnRow);

        document.body.append(overlay, modal);
        overlay.onclick = () => cancelBtn.click();
    }

    /* ==========================================================
     *  SIDEBAR INITIALIZATION
     * ==========================================================*/

    function initializeSidebar() {
        if (document.getElementById('ct-sidebar')) return;

        const sidebar = css(mk('div', { id:'ct-sidebar' }), {
            position:'fixed', top:'60px', right:'-460px', width:'445px',
            maxHeight:'calc(100vh - 80px)', backgroundColor:'#f9f9f9',
            border:'1px solid #ccc', borderRight:'none',
            boxShadow:'-4px 4px 12px rgba(0,0,0,.12)', padding:'20px',
            zIndex:'999997', borderRadius:'10px 0 0 10px',
            fontFamily:'Arial, sans-serif', overflowY:'auto', overflowX:'hidden',
            transition:'right .3s ease-in-out', boxSizing:'border-box'
        });

        // ── Close ───────────────────────────────────────────────
        const closeBtn = css(mk('button'), {
            position:'absolute', top:'5px', right:'5px', background:'red', color:'white',
            border:'none', borderRadius:'4px', cursor:'pointer', padding:'4px 10px',
            fontWeight:'bold', fontSize:'18px', lineHeight:'1'
        });
        closeBtn.textContent = '×'; closeBtn.onclick = hideSidebar;
        sidebar.appendChild(closeBtn);

        // ── Title ────────────────────────────────────────────────
        sidebar.appendChild(
            css(Object.assign(mk('div'), { textContent:'✏️ Change Tracker' }), {
                fontSize:'16px', fontWeight:'bold', color:'#333', marginBottom:'4px', paddingRight:'30px'
            })
        );

        // ── Version row ──────────────────────────────────────────
        const verRow = css(mk('div'), { display:'flex', alignItems:'center', fontSize:'11px', color:'#999', marginBottom:'8px', paddingRight:'30px', flexWrap:'wrap' });
        const verSpan = css(mk('span'), { fontFamily:'monospace', fontSize:'10px' });
        verSpan.textContent = `v${SCRIPT_VERSION}`;
        verRow.appendChild(verSpan);

        if (isNewVersion() && !hasSeenChangelog()) {
            const dot = mk('span', { id:'ct-changelog-dot' });
            const d = mk('span', { className:'ct-dot' });
            const l = mk('span', { className:'ct-dot-label' });
            l.textContent = 'Changelog';
            dot.append(d, l); dot.onclick = showChangelogModal;
            verRow.appendChild(dot);
        }
        sidebar.appendChild(verRow);

        // ── Ticket badge ─────────────────────────────────────────
        sidebar.appendChild(
            css(mk('div', { id:'ct-ticket-badge' }), {
                fontSize:'11px', color:'#444', background:'#e8f5e9', border:'1px solid #a5d6a7',
                borderRadius:'4px', padding:'4px 10px', marginBottom:'14px',
                fontFamily:'monospace', wordBreak:'break-all'
            })
        );

        // ══ INPUT AREA ═══════════════════════════════════════════

        const inputArea = css(mk('div'), {
            background:'#fff', border:'1px solid #ddd', borderRadius:'7px',
            padding:'12px', marginBottom:'10px'
        });

        inputArea.appendChild(
            css(Object.assign(mk('div'), { textContent:'New Entry' }), {
                fontSize:'11px', fontWeight:'bold', color:'#888', marginBottom:'8px',
                textTransform:'uppercase', letterSpacing:'.6px', fontFamily:'Arial, sans-serif'
            })
        );

        // Snippet dropdown
        const select = css(mk('select', { id:'ct-snippet-select' }), {
            width:'100%', padding:'7px 10px', borderRadius:'4px', border:'1px solid #ccc',
            fontSize:'12px', fontFamily:'Arial, sans-serif', marginBottom:'8px',
            background:'#fff', color:'#333', boxSizing:'border-box', cursor:'pointer'
        });
        populateSnippetSelect(select, '', true);
        inputArea.appendChild(select);

        // Dynamic fields container (starts as freeform textarea)
        const fieldsContainer = mk('div', { id:'ct-input-fields' });
        rebuildInputFields('', {}, '', 'ct-field', fieldsContainer);
        inputArea.appendChild(fieldsContainer);

        select.addEventListener('change', () => {
            rebuildInputFields(select.value, {}, '', 'ct-field', fieldsContainer);
        });

        // Add Entry button
        const addBtn = css(mk('button', { id:'ct-add-btn' }), {
            width:'100%', marginTop:'8px', padding:'8px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        addBtn.textContent = '+ Add Entry';
        addBtn.title = 'Ctrl+Enter also works inside the detail field';
        addBtn.onclick = handleAddEntry;
        inputArea.appendChild(addBtn);
        sidebar.appendChild(inputArea);

        // ── Status ───────────────────────────────────────────────
        sidebar.appendChild(
            css(mk('div', { id:'ct-status' }), {
                fontSize:'11px', color:'#28a745', minHeight:'16px',
                marginBottom:'8px', fontFamily:'Arial, sans-serif'
            })
        );

        // ══ LOG SECTION ══════════════════════════════════════════

        // Log header: count + button rows
        const logHeader = css(mk('div'), { marginBottom:'8px' });

        const logTop = css(mk('div'), { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' });
        const countEl = css(mk('div', { id:'ct-entry-count' }), {
            fontSize:'12px', fontWeight:'bold', color:'#555', fontFamily:'Arial, sans-serif'
        });
        countEl.textContent = 'No entries yet';
        logTop.appendChild(countEl);
        logHeader.appendChild(logTop);

        function rowOf(buttons) {
            const row = css(mk('div'), { display:'flex', gap:'5px', marginBottom:'4px' });
            buttons.forEach(([label, bg, cb, title]) => {
                const b = css(mk('button'), {
                    flex:'1', padding:'5px 4px', background:bg, color:'#fff', border:'none',
                    borderRadius:'3px', cursor:'pointer', fontSize:'10px', fontWeight:'bold',
                    fontFamily:'Arial, sans-serif', whiteSpace:'nowrap'
                });
                b.textContent = label; if (title) b.title = title; b.onclick = cb;
                row.appendChild(b);
            });
            return row;
        }

        logHeader.appendChild(rowOf([
            ['📋 Copy All',     '#667eea', handleCopyAll,       'Copy full log to clipboard'],
            ['📝 Worknote',     '#5a6268', handleGroupedSummary,'Copy all ticket changes as a closing worknote summary'],
            ['💾 .txt',         '#17a2b8', handleDownloadTxt,   'Download as plain-text file'],
            ['{ } .json',       '#495057', handleExportJSON,    'Export structured JSON (shareable)'],
        ]));
        logHeader.appendChild(rowOf([
            ['📥 Import JSON',  '#e67e22', handleImportClick,   'Import entries from a .json export file'],
            ['🗂️ Browse',      '#fd7e14', openNotesBrowser,    'Browse notes across all tickets'],
            ['🗑️ Clear',       '#dc3545', handleClearAll,      'Delete all entries for this ticket'],
        ]));

        sidebar.appendChild(logHeader);

        // Divider
        sidebar.appendChild(css(mk('div'), { height:'1px', background:'#e0e0e0', marginBottom:'10px' }));

        // Log container
        sidebar.appendChild(mk('div', { id:'ct-log-container' }));

        // Hidden file input for import
        const fileInput = mk('input', { id:'ct-file-import', type:'file', accept:'.json' });
        css(fileInput, { display:'none' });
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) processImport(file);
            fileInput.value = ''; // reset so same file can be re-selected
        });
        sidebar.appendChild(fileInput);

        document.body.appendChild(sidebar);
    }

    /* ==========================================================
     *  ADD ENTRY HANDLER
     * ==========================================================*/

    function handleAddEntry() {
        const select = document.getElementById('ct-snippet-select');
        if (!select) return;

        // Empty selection → treat as "Custom"
        let type = select.value.trim() || 'Custom';

        const schema  = getSchema(type);
        let fields = null, note = null;

        if (schema) {
            fields = collectFieldValues(schema, 'ct-field');
            const hasValue = Object.values(fields).some(v => v !== '');
            if (!hasValue) { flashStatus('⚠️ Fill in at least one field.', '#e67e22'); return; }
        } else {
            const ta = document.getElementById('ct-field-note');
            note = ta ? ta.value.trim() : '';
        }

        const ticket  = getTicketNumber();
        const entries = addEntry(ticket, type, fields, note);

        // Reset
        select.value = '';
        const fc = document.getElementById('ct-input-fields');
        if (fc) rebuildInputFields('', {}, '', 'ct-field', fc);

        refreshLog(ticket);
        flashStatus(`✓ Entry added  (${entries.length} total)`);
    }

    /* ==========================================================
     *  ACTION HANDLERS
     * ==========================================================*/

    async function handleCopyAll() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to copy.', '#e67e22'); return; }
        (await copyToClipboard(entriesToText(ticket, entries)))
            ? flashStatus('✓ Copied to clipboard!')
            : flashStatus('✗ Copy failed.', '#dc3545');
    }

    async function handleGroupedSummary() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to summarize.', '#e67e22'); return; }
        (await copyToClipboard(buildGroupedSummary(ticket, entries)))
            ? flashStatus('✓ Worknote summary copied!')
            : flashStatus('✗ Copy failed.', '#dc3545');
    }

    function handleDownloadTxt() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to download.', '#e67e22'); return; }
        triggerDownload(`ChangeLog_${ticket}.txt`, entriesToText(ticket, entries), 'text/plain');
        flashStatus('✓ Download started!');
    }

    function handleExportJSON() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to export.', '#e67e22'); return; }
        const data = { ticket, exported: nowStamp(), version: SCRIPT_VERSION, entries };
        triggerDownload(`ChangeLog_${ticket}.json`, JSON.stringify(data, null, 2), 'application/json');
        flashStatus('✓ JSON export started!');
    }

    function handleImportClick() {
        document.getElementById('ct-file-import')?.click();
    }

    function processImport(file) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data          = JSON.parse(e.target.result);
                const importEntries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : null);
                if (!importEntries) throw new Error('No entries array found in file.');

                const ticket     = getTicketNumber();
                const existing   = loadEntries(ticket);
                const existingIds = new Set(existing.map(e => e.id));
                let added = 0;

                importEntries.forEach(entry => {
                    if (entry.id && entry.ts && entry.type && !existingIds.has(entry.id)) {
                        existing.push(entry); added++;
                    }
                });

                existing.sort((a, b) => a.ts.localeCompare(b.ts));
                saveEntries(ticket, existing);
                refreshLog(ticket);
                flashStatus(`✓ Imported ${added} new ${added === 1 ? 'entry' : 'entries'}.`);
            } catch (err) {
                flashStatus(`✗ Import failed: ${err.message}`, '#dc3545', 4000);
            }
        };
        reader.readAsText(file);
    }

    function handleClearAll() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ Nothing to clear.', '#e67e22'); return; }
        confirmModal(
            `Delete all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} for ${ticket}?\nThis cannot be undone.`,
            () => { clearEntries(ticket); refreshLog(ticket); flashStatus('✓ All entries cleared.'); }
        );
    }

    /* ==========================================================
     *  NOTES BROWSER MODAL
     * ==========================================================*/

    function openNotesBrowser() {
        document.getElementById('ct-browser-overlay')?.remove();
        document.getElementById('ct-browser-modal')?.remove();

        const overlay = mk('div', { id:'ct-browser-overlay' });
        const modal   = mk('div', { id:'ct-browser-modal'   });

        // Header
        const hdr = css(mk('div'), { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' });
        const hTitle = css(mk('div'), { fontSize:'15px', fontWeight:'bold', color:'#333', fontFamily:'Arial, sans-serif' });
        hTitle.textContent = '🗂️ Notes Browser';
        const closeX = css(mk('button'), { background:'red', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', padding:'4px 10px', fontWeight:'bold', fontSize:'18px', lineHeight:'1' });
        closeX.textContent = '×'; closeX.onclick = () => { overlay.remove(); modal.remove(); };
        hdr.append(hTitle, closeX); modal.appendChild(hdr);

        // Subtitle
        const sub = css(mk('div'), { fontSize:'11px', color:'#999', marginBottom:'12px', fontFamily:'Arial, sans-serif', borderBottom:'1px solid #e0e0e0', paddingBottom:'10px' });
        sub.textContent = 'All tickets with saved change logs. Expand to preview. Deleting is permanent.';
        modal.appendChild(sub);

        const data = allTicketData();

        if (!data.length) {
            modal.appendChild(
                css(Object.assign(mk('div'), { textContent:'No saved notes found for any ticket.' }), {
                    textAlign:'center', padding:'30px 0', color:'#bbb',
                    fontFamily:'Arial, sans-serif', fontSize:'13px', fontStyle:'italic'
                })
            );
        } else {
            const totalEntries = data.reduce((s, d) => s + d.entries.length, 0);
            const summary = css(mk('div'), {
                background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'4px',
                padding:'6px 10px', marginBottom:'10px', fontSize:'11px',
                color:'#444', fontFamily:'Arial, sans-serif'
            });
            summary.textContent = `${data.length} ticket${data.length !== 1 ? 's' : ''} · ${totalEntries} total ${totalEntries === 1 ? 'entry' : 'entries'}`;
            modal.appendChild(summary);

            data.forEach(({ ticket, entries }) =>
                modal.appendChild(buildBrowserRow(ticket, entries, () => {
                    openNotesBrowser();
                    if (ticket === getTicketNumber()) refreshLog(ticket);
                }))
            );
        }

        document.body.append(overlay, modal);
        overlay.onclick = () => closeX.click();
    }

    function buildBrowserRow(ticket, entries, onDeleted) {
        const row = css(mk('div'), {
            background:'#fff', border:'1px solid #e0e0e0', borderRadius:'6px',
            padding:'10px 12px', marginBottom:'8px', fontFamily:'Arial, sans-serif'
        });

        const topLine = css(mk('div'), { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'3px' });

        const left = css(mk('div'), { display:'flex', alignItems:'center', gap:'6px' });
        const ticketLbl = css(mk('span'), { fontWeight:'bold', fontSize:'13px', color:'#333', fontFamily:'monospace' });
        ticketLbl.textContent = ticket;
        const countBadge = css(mk('span'), { fontSize:'11px', color:'#666', background:'#f0f0f0', borderRadius:'3px', padding:'2px 7px' });
        countBadge.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
        left.append(ticketLbl, countBadge);

        const right = css(mk('div'), { display:'flex', gap:'5px' });
        const expandBtn = css(mk('button'), { background:'#667eea', color:'#fff', border:'none', borderRadius:'3px', cursor:'pointer', padding:'3px 9px', fontSize:'11px', fontWeight:'bold', fontFamily:'Arial, sans-serif' });
        expandBtn.textContent = '▶ Preview';
        const delBtn = css(mk('button'), { background:'#dc3545', color:'#fff', border:'none', borderRadius:'3px', cursor:'pointer', padding:'3px 9px', fontSize:'11px', fontWeight:'bold', fontFamily:'Arial, sans-serif' });
        delBtn.textContent = 'Delete All';
        delBtn.onclick = () => confirmModal(
            `Delete all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} for ${ticket}?\nThis cannot be undone.`,
            () => { clearEntries(ticket); onDeleted(); }
        );
        right.append(expandBtn, delBtn);
        topLine.append(left, right); row.appendChild(topLine);

        if (entries.length) {
            const last = entries[entries.length-1];
            row.appendChild(
                css(Object.assign(mk('div'), { textContent:`Last: ${last.ts} — ${last.type}` }), {
                    fontSize:'10px', color:'#bbb', fontFamily:'monospace', marginBottom:'2px'
                })
            );
        }

        // Expandable preview
        const preview = css(mk('div'), { display:'none', marginTop:'8px', borderTop:'1px solid #eee', paddingTop:'8px' });
        const previewEntries = [...entries].reverse().slice(0, 5);
        previewEntries.forEach(entry => {
            const pRow = css(mk('div'), { marginBottom:'7px', paddingLeft:'8px', borderLeft:`3px solid ${typeColor(entry.type)}` });
            const pType = css(mk('div'), { fontSize:'11px', fontWeight:'bold', color:typeColor(entry.type), fontFamily:'Arial, sans-serif' });
            pType.textContent = entry.type;
            const pContent = css(mk('div'), { fontSize:'11px', color:'#555', fontFamily:'Arial, sans-serif', wordBreak:'break-word', whiteSpace:'pre-wrap' });
            pContent.textContent = formatEntryContent(entry);
            const pTs = css(mk('div'), { fontSize:'10px', color:'#bbb', fontFamily:'monospace' });
            pTs.textContent = entry.ts;
            pRow.append(pType, pContent, pTs); preview.appendChild(pRow);
        });
        if (entries.length > 5) {
            preview.appendChild(
                css(Object.assign(mk('div'), { textContent:`…and ${entries.length - 5} more` }), {
                    fontSize:'11px', color:'#999', fontStyle:'italic', fontFamily:'Arial, sans-serif', marginTop:'4px'
                })
            );
        }
        row.appendChild(preview);

        expandBtn.onclick = () => {
            const open = preview.style.display !== 'none';
            preview.style.display = open ? 'none' : 'block';
            expandBtn.textContent  = open ? '▶ Preview' : '▼ Hide';
        };

        return row;
    }

    /* ==========================================================
     *  SHOW / HIDE / TOGGLE
     * ==========================================================*/

    function showSidebar() {
        const sidebar = document.getElementById('ct-sidebar');
        if (!sidebar) return;
        const ticket = getTicketNumber();
        const badge  = document.getElementById('ct-ticket-badge');
        if (badge) badge.textContent = `Ticket: ${ticket}`;
        refreshLog(ticket);
        css(sidebar, { right:'0px' });
        sidebarVisible = true;
        setTimeout(() => document.getElementById('ct-snippet-select')?.focus(), 310);
    }

    function hideSidebar() {
        const sidebar = document.getElementById('ct-sidebar');
        if (sidebar) { css(sidebar, { right:'-460px' }); sidebarVisible = false; }
    }

    function toggleSidebar() { sidebarVisible ? hideSidebar() : showSidebar(); }

    /* ==========================================================
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOL_ID = 'changeTracker';

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'changeTracker-notif-dot';

    function addToolbarNotificationDot() {
        if (!isNewVersion() || hasSeenChangelog()) return;
        const tryAdd = (attempts) => {
            const toolEl = document.querySelector(`[data-tool="${TOOL_ID}"]`);
            if (!toolEl) {
                if (attempts < 10) setTimeout(() => tryAdd(attempts + 1), 300);
                return;
            }
            if (toolEl.querySelector('.' + TOOLBAR_DOT_CLASS)) return;
            toolEl.style.position = 'relative';
            const dot = document.createElement('div');
            dot.className = TOOLBAR_DOT_CLASS;
            Object.assign(dot.style, {
                position: 'absolute', top: '2px', right: '2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#007bff', pointerEvents: 'none', zIndex: '10',
            });
            let dotBlue = true;
            const intervalId = setInterval(() => {
                dotBlue = !dotBlue;
                dot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);
            dot.dataset.intervalId = intervalId;
            toolEl.appendChild(dot);
        };
        setTimeout(() => tryAdd(0), 500);
    }

    function removeToolbarNotificationDot() {
        const dot = document.querySelector(`[data-tool="${TOOL_ID}"] .${TOOLBAR_DOT_CLASS}`);
        if (dot) {
            clearInterval(Number(dot.dataset.intervalId));
            dot.remove();
        }
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_ATTEMPTS) { console.warn('⚠️ Change Tracker: max attempts reached'); return; }
        registrationAttempts++;

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id:'changeTracker', icon:TOOL_ICON, tooltip:'Change Tracker', position:7 }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Change Tracker registered!');
        } else {
            setTimeout(attemptRegistration, RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS + INIT
     * ==========================================================*/

    document.addEventListener('toolbarReady',       ()  => attemptRegistration());
    document.addEventListener('toolbarToolClicked', (e) => { if (e.detail.id === 'changeTracker') toggleSidebar(); });

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;
        isInitialized = true;
        initializeSidebar();
        console.log('✅ Change Tracker ready!');
        setTimeout(attemptRegistration, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => { if (!isRegistered) attemptRegistration(); });

})();