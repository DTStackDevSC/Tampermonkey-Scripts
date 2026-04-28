// ==UserScript==
// @name         |Toolbar| Change Tracker (Online)
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory_Online.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory_Online.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.4.0
// @description  Structured per-ticket change audit log for ServiceNow / Netskope tickets — shared team-wide via Cloudflare Worker + D1
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

    const SCRIPT_VERSION = '1.4.0';
    const CHANGELOG = `Version 1.4.0:
- Shared team model: every authenticated user reads and writes the same
  entries. Each entry shows who last wrote it ("by <Author>").
- New Configure button (top-right ⚙) reopens the setup modal so you can
  change the Worker URL or token at any time.
- Removed the Notes Browser — entries now load directly from D1 per ticket.
- Clear-all wording strengthened (it now wipes everyone's entries on the ticket).

Version 1.3.0:
- Cloud sync via Cloudflare Worker + D1 (optional, configured on first run)
- GM storage used as local read cache — sidebar always loads instantly
- Offline mode: read-only with reconnect button; auto-reconnect on sidebar open
- Five connectivity states: INIT / ONLINE / OFFLINE / INVALID_TOKEN / SETUP
- First-run setup prompt for Worker URL + token (one-time, stored in GM)
- Token invalid (401) surfaced separately from network errors
- Notes Browser fetches ticket list from D1 when online

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

    function showChangelogModal() {
        const overlay = mk('div', { id: 'ct-changelog-overlay' });
        const modal   = mk('div', { id: 'ct-changelog-modal'   });

        const h2 = mk('h2');
        h2.textContent = `What's New — v${SCRIPT_VERSION}`;

        const info = mk('div', { className: 'ct-cl-info' });
        info.textContent = `Updated to version ${SCRIPT_VERSION}!`;

        const body = mk('div', { className: 'ct-cl-body' });
        body.textContent = CHANGELOG;

        const btn = mk('button', { className: 'ct-cl-ok' });
        btn.textContent = 'Got it!';
        btn.onclick = () => {
            overlay.remove(); modal.remove();
            markChangelogAsSeen(); saveVersion(SCRIPT_VERSION);
            document.getElementById('ct-changelog-dot')?.remove();
        };

        modal.append(h2, info, body, btn);
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
         * Edit / Setup modal             : 1050000
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

    /* ──────────────────────────────────────────────────────────
     *  CONNECTIVITY STATE  (must be initialised before initializeSidebar())
     *  States: 'INIT' | 'ONLINE' | 'OFFLINE' | 'INVALID_TOKEN' | 'SETUP'
     *
     *  INIT          → no token/URL in GM → sidebar open shows setup prompt
     *  ONLINE        → Worker reachable, token valid → full functionality
     *  OFFLINE       → Worker unreachable or 5xx → read-only, offline banner
     *  INVALID_TOKEN → Worker returned 401 → read-only, token-invalid banner
     *  SETUP         → user is in the first-run setup form
     * ─────────────────────────────────────────────────────────*/
    let connState = 'INIT';

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
     *
     *  v1.3.0: GM storage now serves as a local read cache. The Worker
     *  (api object below) is the source of truth when ONLINE. Local cache
     *  is updated optimistically on every mutation so the sidebar feels
     *  instant even when the API is slow or unreachable.
     * ==========================================================*/

    const PREFIX = 'changeTracker_notes_';

    function storeKey(ticket) { return PREFIX + ticket; }

    // Sync read from GM cache — never blocks
    function loadEntries(ticket) {
        try { return JSON.parse(GM_getValue(storeKey(ticket), '[]')); }
        catch { return []; }
    }

    // Internal: update GM cache only (no API call)
    function _cacheEntries(ticket, entries) {
        GM_setValue(storeKey(ticket), JSON.stringify(entries));
    }

    /* ==========================================================
     *  API CLIENT  (Cloudflare Worker proxy to D1)
     *  Single fetch surface. All errors return { ok: false, ... }
     *  rather than throwing, so callers can route them through
     *  handleApiResponse() without try/catch.
     * ==========================================================*/

    const api = {

        // Read Worker URL and token from GM storage
        getConfig() {
            return {
                url:   GM_getValue('changeTrackerWorkerUrl', ''),
                token: GM_getValue('changeTrackerToken',     ''),
            };
        },

        // Returns true if both url and token are set
        isConfigured() {
            const { url, token } = api.getConfig();
            return Boolean(url && token);
        },

        // Shared fetch wrapper.
        // Returns { ok: true, data } or { ok: false, status, network: bool }
        async request(method, path, body) {
            const { url, token } = api.getConfig();
            try {
                const res = await fetch(`${url}${path}`, {
                    method,
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: body ? JSON.stringify(body) : undefined,
                });
                if (res.ok) {
                    return { ok: true, data: await res.json() };
                }
                return { ok: false, status: res.status, network: false };
            } catch (e) {
                return { ok: false, status: 0, network: true };
            }
        },

        async ping() {
            const { url } = api.getConfig();
            if (!url) return false;
            try {
                const res = await fetch(`${url}/ping`);
                return res.ok;
            } catch { return false; }
        },

        async fetchEntries(ticket) {
            return api.request('GET', `/entries/${encodeURIComponent(ticket)}`);
        },

        async pushEntries(entries) {
            return api.request('POST', '/entries', { entries });
        },

        async deleteTicket(ticket) {
            return api.request('DELETE', `/entries/${encodeURIComponent(ticket)}`);
        },

        async deleteEntry(ticket, id) {
            return api.request('DELETE',
                `/entries/${encodeURIComponent(ticket)}/${encodeURIComponent(id)}`);
        },
    };

    /* ==========================================================
     *  CONNECTIVITY STATE TRANSITIONS
     * ==========================================================*/

    function setConnState(newState) {
        connState = newState;
        renderConnBanner();
        renderInputLock();
    }

    function handleApiResponse(res) {
        if (res.ok) return;
        if (res.status === 401) {
            setConnState('INVALID_TOKEN');
        } else if (res.network || res.status >= 500) {
            setConnState('OFFLINE');
        }
    }

    /* ==========================================================
     *  ENTRY CRUD  (cache-first, write-through to Worker when online)
     *
     *  All mutations update the GM cache synchronously, then push to
     *  the Worker if connState === 'ONLINE'. This keeps the sidebar
     *  instant and lets the offline mode degrade gracefully.
     * ==========================================================*/

    async function addEntry(ticket, type, fields, note) {
        const entry   = {
            id:     uid(),
            ts:     nowStamp(),
            type,
            fields: fields || null,
            note:   note   || null,
        };
        const current = loadEntries(ticket);
        current.push(entry);
        _cacheEntries(ticket, current);                          // optimistic local update

        if (connState === 'ONLINE') {
            const res = await api.pushEntries([{ ...entry, ticket }]);
            handleApiResponse(res);
        }
        return current;
    }

    async function updateEntry(ticket, entryId, type, fields, note) {
        const entries = loadEntries(ticket);
        const idx     = entries.findIndex(e => e.id === entryId);
        if (idx !== -1) {
            entries[idx] = { ...entries[idx], type, fields: fields || null, note: note || null };
            _cacheEntries(ticket, entries);

            if (connState === 'ONLINE') {
                const res = await api.pushEntries([{ ...entries[idx], ticket }]);
                handleApiResponse(res);
            }
        }
        return entries;
    }

    async function deleteEntry(ticket, entryId) {
        const entries = loadEntries(ticket).filter(e => e.id !== entryId);
        _cacheEntries(ticket, entries);

        if (connState === 'ONLINE') {
            const res = await api.deleteEntry(ticket, entryId);
            handleApiResponse(res);
        }
        return entries;
    }

    async function clearEntries(ticket) {
        GM_deleteValue(storeKey(ticket));

        if (connState === 'ONLINE') {
            const res = await api.deleteTicket(ticket);
            handleApiResponse(res);
        }
    }

    // Pull authoritative entries from D1 into the cache for one ticket.
    // Called when the sidebar opens, after a successful reconnect, etc.
    async function syncTicket(ticket) {
        if (connState !== 'ONLINE') return;
        const res = await api.fetchEntries(ticket);
        if (res.ok) {
            _cacheEntries(ticket, res.data.entries || []);
        } else {
            handleApiResponse(res);
        }
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
            setTimeout(async () => {
                card.remove();
                await deleteEntry(ticket, entry.id);
                onMutated();
            }, 200);
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

        // Timestamp + author
        const author = entry.author_label || entry.author_user_id || '(unknown)';
        card.appendChild(css(Object.assign(mk('div'), { textContent: `${entry.ts}  ·  by ${author}` }), {
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
        saveBtn.onclick = async () => {
            const newType  = typeSelect.value;
            const schema   = getSchema(newType);
            const newFields = schema ? collectFieldValues(schema, 'ct-edit-field') : null;
            const newNote   = !schema
                ? (document.getElementById('ct-edit-field-note')?.value.trim() || '')
                : null;

            await updateEntry(ticket, entry.id, newType, newFields, newNote);
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

        // Configure button — opens setup modal pre-filled with current values
        const cfgBtn = css(mk('button', { id:'ct-configure-btn', type:'button' }), {
            background:'transparent', color:'#666', border:'none', cursor:'pointer',
            padding:'2px 6px', marginLeft:'auto', fontSize:'11px',
            textDecoration:'underline', fontFamily:'Arial, sans-serif'
        });
        cfgBtn.textContent = '⚙ Configure';
        cfgBtn.title       = 'Change the Worker URL or API token';
        cfgBtn.onclick     = () => {
            const previousToken = GM_getValue('changeTrackerToken', '');
            const previousState = connState;
            openSetupPrompt({ previousToken, previousState });
        };
        verRow.appendChild(cfgBtn);

        sidebar.appendChild(verRow);

        // ── Ticket badge ─────────────────────────────────────────
        sidebar.appendChild(
            css(mk('div', { id:'ct-ticket-badge' }), {
                fontSize:'11px', color:'#444', background:'#e8f5e9', border:'1px solid #a5d6a7',
                borderRadius:'4px', padding:'4px 10px', marginBottom:'14px',
                fontFamily:'monospace', wordBreak:'break-all'
            })
        );

        // ── Connectivity banner (filled by renderConnBanner) ────
        sidebar.appendChild(
            css(mk('div', { id:'ct-conn-banner' }), {
                display:'none', alignItems:'center', justifyContent:'space-between',
                gap:'8px', padding:'7px 10px', borderRadius:'4px',
                marginBottom:'10px', fontSize:'12px', fontFamily:'Arial, sans-serif'
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
            renderInputLock();   // re-apply lock to freshly-rendered inputs
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
            ['🗑️ Clear',       '#dc3545', handleClearAll,      'Delete all entries for this ticket (everyone)'],
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

        // Reflect current connectivity state into the freshly-built DOM
        renderConnBanner();
        renderInputLock();
    }

    /* ==========================================================
     *  CONNECTIVITY BANNER + INPUT LOCK
     *  Called by setConnState() any time connState changes, and
     *  once at the end of initializeSidebar() to apply the initial
     *  state to the freshly-built DOM.
     * ==========================================================*/

    function renderConnBanner() {
        const banner = document.getElementById('ct-conn-banner');
        if (!banner) return;

        // Hide the banner outside of OFFLINE / INVALID_TOKEN
        if (connState !== 'OFFLINE' && connState !== 'INVALID_TOKEN') {
            banner.style.display = 'none';
            banner.innerHTML     = '';
            return;
        }

        banner.innerHTML = '';
        banner.style.display = 'flex';

        if (connState === 'OFFLINE') {
            css(banner, {
                background:'#fff3cd', border:'1px solid #ffc107', color:'#856404'
            });
            const msg = mk('span'); msg.textContent = '⚠ Offline — read only';
            const btn = css(mk('button', { id:'ct-reconnect-btn' }), {
                background:'#ffc107', color:'#333', border:'none', borderRadius:'3px',
                cursor:'pointer', padding:'3px 10px', fontSize:'11px',
                fontWeight:'bold', fontFamily:'Arial, sans-serif'
            });
            btn.textContent = '↺ Reconnect';
            btn.onclick = () => attemptReconnect(getTicketNumber(), false);
            banner.append(msg, btn);

        } else if (connState === 'INVALID_TOKEN') {
            css(banner, {
                background:'#f8d7da', border:'1px solid #f5c6cb', color:'#721c24'
            });
            const msg = mk('span'); msg.textContent = '🔑 Token invalid';
            const btn = css(mk('button'), {
                background:'transparent', color:'#721c24', border:'none',
                cursor:'pointer', padding:'2px 4px', fontSize:'12px',
                textDecoration:'underline', fontFamily:'Arial, sans-serif',
                fontWeight:'bold'
            });
            btn.textContent = 'Reset token';
            btn.onclick = () => {
                const previousToken = GM_getValue('changeTrackerToken', '');
                const previousState = connState;
                GM_deleteValue('changeTrackerToken');
                openSetupPrompt({ previousToken, previousState });
            };
            banner.append(msg, btn);
        }
    }

    function renderInputLock() {
        const select = document.getElementById('ct-snippet-select');
        const fields = document.getElementById('ct-input-fields');
        const addBtn = document.getElementById('ct-add-btn');
        if (!select && !fields && !addBtn) return;

        const locked = connState !== 'ONLINE';

        if (select) select.disabled = locked;
        if (addBtn) {
            addBtn.disabled        = locked;
            addBtn.style.opacity   = locked ? '0.55' : '1';
            addBtn.style.cursor    = locked ? 'not-allowed' : 'pointer';
        }
        if (fields) {
            fields.querySelectorAll('input, textarea, select').forEach(el => {
                el.disabled = locked;
            });
        }
    }

    /* ==========================================================
     *  ADD ENTRY HANDLER
     * ==========================================================*/

    async function handleAddEntry() {
        const select = document.getElementById('ct-snippet-select');
        if (!select) return;

        // Block adding when the API is not currently usable
        if (connState !== 'ONLINE') {
            if (connState === 'OFFLINE')           flashStatus('⚠️ Offline — adding new entries is disabled.', '#e67e22');
            else if (connState === 'INVALID_TOKEN') flashStatus('🔑 Token invalid — reset to add entries.', '#dc3545');
            else                                    flashStatus('⚠️ Not connected yet.', '#e67e22');
            return;
        }

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
        const entries = await addEntry(ticket, type, fields, note);

        // Reset
        select.value = '';
        const fc = document.getElementById('ct-input-fields');
        if (fc) rebuildInputFields('', {}, '', 'ct-field', fc);
        renderInputLock();   // re-apply lock to freshly-rendered inputs

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
        reader.onload = async e => {
            try {
                const data          = JSON.parse(e.target.result);
                const importEntries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : null);
                if (!importEntries) throw new Error('No entries array found in file.');

                const ticket      = getTicketNumber();
                const existing    = loadEntries(ticket);
                const existingIds = new Set(existing.map(e => e.id));
                let added = 0;

                importEntries.forEach(entry => {
                    if (entry.id && entry.ts && entry.type && !existingIds.has(entry.id)) {
                        existing.push(entry); added++;
                    }
                });

                existing.sort((a, b) => a.ts.localeCompare(b.ts));
                _cacheEntries(ticket, existing);
                refreshLog(ticket);
                flashStatus(`✓ Imported ${added} new ${added === 1 ? 'entry' : 'entries'}.`);

                // Push newly added entries to D1 if connected
                if (added > 0 && connState === 'ONLINE') {
                    const newEntries = existing
                        .filter(e => !existingIds.has(e.id))
                        .map(e => ({ ...e, ticket }));
                    // Worker enforces max 50 entries per request — chunk for larger imports
                    for (let i = 0; i < newEntries.length; i += 50) {
                        const chunk = newEntries.slice(i, i + 50);
                        const res   = await api.pushEntries(chunk);
                        handleApiResponse(res);
                        if (!res.ok) break;
                    }
                }
            } catch (err) {
                flashStatus(`✗ Import failed: ${err.message}`, '#dc3545', 4000);
            }
        };
        reader.readAsText(file);
    }

    function handleClearAll() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ Nothing to clear.', '#e67e22'); return; }
        const msg =
            `Delete all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} for ${ticket}?\n` +
            `This wipes the log for EVERYONE on the team — including entries you didn't author.\n` +
            `This cannot be undone.`;
        confirmModal(msg, async () => {
            await clearEntries(ticket);
            refreshLog(ticket);
            flashStatus('✓ All entries cleared.');
        });
    }

    /* ==========================================================
     *  RECONNECT
     *  Pings the Worker, then issues a real authenticated request to
     *  prove the token is still valid. Routes through handleApiResponse
     *  on failure so OFFLINE / INVALID_TOKEN are surfaced consistently.
     * ==========================================================*/

    async function attemptReconnect(ticket, silent = false) {
        const btn = document.getElementById('ct-reconnect-btn');
        if (btn) {
            btn.textContent  = '↺';
            btn.disabled     = true;
            btn.style.opacity = '0.6';
        }

        const reachable = await api.ping();

        if (!reachable) {
            setConnState('OFFLINE');
            if (!silent) flashStatus('Still offline — try again later.', '#e67e22');
            const b = document.getElementById('ct-reconnect-btn');
            if (b) { b.textContent = '↺ Reconnect'; b.disabled = false; b.style.opacity = '1'; }
            return;
        }

        // Ping succeeded — verify token with a real request
        const res = await api.fetchEntries(ticket);
        if (res.ok) {
            _cacheEntries(ticket, res.data.entries || []);
            setConnState('ONLINE');
            refreshLog(ticket);
            if (!silent) flashStatus('✓ Back online!');
        } else {
            handleApiResponse(res);
            if (!silent && connState !== 'ONLINE') {
                flashStatus('Could not reconnect.', '#dc3545');
            }
        }
    }

    /* ==========================================================
     *  FIRST-RUN SETUP PROMPT
     *  Modal overlay (independent of sidebar) for capturing the
     *  Worker URL and bearer token. Reused by the "Reset token"
     *  link in the INVALID_TOKEN banner.
     * ==========================================================*/

    function openSetupPrompt(options = {}) {
        const { previousToken = null, previousState = null } = options;

        document.getElementById('ct-setup-overlay')?.remove();
        document.getElementById('ct-setup-modal')?.remove();

        setConnState('SETUP');

        const overlay = css(mk('div', { id:'ct-setup-overlay' }), {
            position:'fixed', inset:'0', background:'rgba(0,0,0,.5)', zIndex:'1050000'
        });
        const modal = css(mk('div', { id:'ct-setup-modal' }), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1050001', background:'#fff', border:'1px solid #ccc',
            borderRadius:'10px', padding:'20px', width:'480px', maxWidth:'92vw',
            maxHeight:'86vh', overflowY:'auto', fontFamily:'Arial, sans-serif',
            boxShadow:'0 6px 24px rgba(0,0,0,.25)', color:'#333'
        });

        // Header
        const hdr = css(mk('div'), {
            display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'
        });
        const hTitle = css(mk('div'), {
            fontSize:'15px', fontWeight:'bold', color:'#333', fontFamily:'Arial, sans-serif'
        });
        hTitle.textContent = '☁ Connect to Cloud Sync';

        const closeX = css(mk('button'), {
            background:'red', color:'#fff', border:'none', borderRadius:'4px',
            cursor:'pointer', padding:'4px 10px', fontWeight:'bold',
            fontSize:'18px', lineHeight:'1'
        });
        closeX.textContent = '×';

        hdr.append(hTitle, closeX);
        modal.appendChild(hdr);

        // URL field
        modal.appendChild(css(Object.assign(mk('label'), { textContent:'Worker URL', htmlFor:'ct-setup-url' }), {
            display:'block', fontSize:'11px', fontWeight:'bold',
            color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));
        const urlInput = css(mk('input', { id:'ct-setup-url', type:'text' }), {
            width:'100%', padding:'7px 10px', border:'1px solid #ccc',
            borderRadius:'4px', fontSize:'12px', fontFamily:'Arial, sans-serif',
            background:'#fafafa', color:'#333', boxSizing:'border-box',
            outline:'none', marginBottom:'12px'
        });
        urlInput.placeholder = 'https://change-tracker-api.yourname.workers.dev';
        urlInput.value       = GM_getValue('changeTrackerWorkerUrl', '');
        modal.appendChild(urlInput);

        // Token field
        modal.appendChild(css(Object.assign(mk('label'), { textContent:'Your API Token', htmlFor:'ct-setup-token' }), {
            display:'block', fontSize:'11px', fontWeight:'bold',
            color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));
        const tokenInput = css(mk('input', { id:'ct-setup-token', type:'text' }), {
            width:'100%', padding:'7px 10px', border:'1px solid #ccc',
            borderRadius:'4px', fontSize:'12px',
            fontFamily:'"Courier New", Courier, monospace',
            background:'#fafafa', color:'#333', boxSizing:'border-box',
            outline:'none', marginBottom:'12px'
        });
        tokenInput.placeholder = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        tokenInput.value       = GM_getValue('changeTrackerToken', '');
        modal.appendChild(tokenInput);

        // Help text
        const help = css(mk('div'), {
            fontSize:'11px', color:'#666', marginBottom:'14px',
            lineHeight:'1.5', fontFamily:'Arial, sans-serif'
        });
        help.appendChild(document.createTextNode('Ask your administrator for both values. Contact '));
        const mailto = css(mk('a'), {
            color:'inherit', textDecoration:'underline'
        });
        mailto.href        = 'mailto:jrocarolvalls@deloitte.es';
        mailto.textContent = 'jrocarolvalls@deloitte.es';
        help.appendChild(mailto);
        help.appendChild(document.createTextNode(' to request access.'));
        modal.appendChild(help);

        // Inline error area
        const errEl = css(mk('div', { id:'ct-setup-error' }), {
            display:'none', marginBottom:'10px', padding:'7px 10px',
            background:'#f8d7da', border:'1px solid #f5c6cb', color:'#721c24',
            borderRadius:'4px', fontSize:'12px', fontFamily:'Arial, sans-serif'
        });
        modal.appendChild(errEl);

        function showError(msg) {
            errEl.textContent    = msg;
            errEl.style.display  = 'block';
        }
        function hideError() {
            errEl.textContent    = '';
            errEl.style.display  = 'none';
        }

        // Button row
        const btnRow = css(mk('div'), { display:'flex', gap:'10px', marginTop:'4px' });

        const cancelBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#6c757d', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        cancelBtn.textContent = 'Cancel';

        const saveBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        saveBtn.textContent = 'Save & Connect';

        btnRow.append(cancelBtn, saveBtn);
        modal.appendChild(btnRow);

        function close() {
            overlay.remove();
            modal.remove();
        }

        function cancel() {
            if (previousToken) {
                // Restore previous token + state (Reset path)
                GM_setValue('changeTrackerToken', previousToken);
                setConnState(previousState || 'INVALID_TOKEN');
            } else {
                // First-time setup cancelled — clear anything save() may have
                // already written so the next open re-prompts cleanly.
                GM_deleteValue('changeTrackerWorkerUrl');
                GM_deleteValue('changeTrackerToken');
                setConnState('INIT');
                hideSidebar();
            }
            close();
        }

        async function save() {
            hideError();
            const url   = urlInput.value.trim().replace(/\/+$/, '');
            const token = tokenInput.value.trim();
            if (!url)   { showError('Worker URL is required.');  return; }
            if (!token) { showError('API token is required.');   return; }

            saveBtn.disabled    = true;
            saveBtn.textContent = 'Connecting…';

            GM_setValue('changeTrackerWorkerUrl', url);
            GM_setValue('changeTrackerToken',     token);

            // Try to connect using the current ticket
            const ticket = getTicketNumber();
            await attemptReconnect(ticket, /* silent */ true);

            if (connState === 'ONLINE') {
                close();
                showSidebar();           // ensure sidebar slides in
                flashStatus('✓ Connected!');
            } else if (connState === 'INVALID_TOKEN') {
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save & Connect';
                showError('Token rejected. Double-check the token value.');
            } else {
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save & Connect';
                showError('Could not reach the Worker. Check the URL and try again.');
            }
        }

        cancelBtn.onclick = cancel;
        closeX.onclick    = cancel;
        overlay.onclick   = cancel;
        saveBtn.onclick   = save;

        document.body.append(overlay, modal);
        urlInput.focus();
    }

    /* ==========================================================
     *  SHOW / HIDE / TOGGLE
     * ==========================================================*/

    function showSidebar() {
        const sidebar = document.getElementById('ct-sidebar');
        if (!sidebar) return;

        // Not configured yet → setup modal first, sidebar stays hidden
        if (!api.isConfigured()) {
            setConnState('INIT');
            openSetupPrompt();
            return;
        }

        const ticket = getTicketNumber();
        const badge  = document.getElementById('ct-ticket-badge');
        if (badge) badge.textContent = `Ticket: ${ticket}`;

        // Show cached data immediately — never block on network
        refreshLog(ticket);

        // Slide in
        css(sidebar, { right:'0px' });
        sidebarVisible = true;
        setTimeout(() => document.getElementById('ct-snippet-select')?.focus(), 310);

        // Background: attempt reconnect if offline, sync if online
        if (connState === 'OFFLINE' || connState === 'INVALID_TOKEN') {
            attemptReconnect(ticket, /* silent */ true);
        } else if (connState === 'ONLINE') {
            syncTicket(ticket).then(() => refreshLog(ticket));
        } else {
            // First open after config saved (connState still 'INIT' or 'SETUP') → go online
            attemptReconnect(ticket, /* silent */ true);
        }
    }

    function hideSidebar() {
        const sidebar = document.getElementById('ct-sidebar');
        if (sidebar) { css(sidebar, { right:'-460px' }); sidebarVisible = false; }
    }

    function toggleSidebar() { sidebarVisible ? hideSidebar() : showSidebar(); }

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