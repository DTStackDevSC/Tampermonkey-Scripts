// ==UserScript==
// @name         Netskope Ticket Subject Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeTicketSubjectHelper.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeTicketSubjectHelper.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.1.0
// @description  Adds a helper button to the Netskope support ticket form to quickly build a formatted Subject line
// @author       J.R.
// @match        https://support.netskope.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ========================================================== */

    const SCRIPT_VERSION = '1.1.0';
    const CHANGELOG = `Version 1.1.0:
- Added a "? Help" button next to Tenant URLs in the panel header. It opens a visual Feature Guide that explains the subject format, the tenant URL auto fill and every button of the panel.

Version 1.0.7:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.0.6:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.0.5:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.0.4:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.0.3:
- Changed Update URL

Version 1.0.0:
- Initial Release`;

    function getStoredVersion()    { return GM_getValue('nsTktVersion', null); }
    function saveVersion(v)        { GM_setValue('nsTktVersion', v); }
    function hasSeenChangelog()    { return GM_getValue('nsTktChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue('nsTktChangelogSeen', SCRIPT_VERSION); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const a = v1.split('.').map(Number), b = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if ((b[i] || 0) > (a[i] || 0)) return true;
            if ((b[i] || 0) < (a[i] || 0)) return false;
        }
        return false;
    }
    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

    /* ==========================================================
     *  CONFIG
     * ========================================================== */

    const MF_OPTIONS = [
        { label: '--- Select MF ---',                        value: '' },
        { label: 'Deloitte Africa - Africa',                 value: 'Africa'  },
        { label: 'Deloitte Austria - AT',                    value: 'AT'      },
        { label: 'Deloitte Belgium - BE',                    value: 'BE'      },
        { label: 'Deloitte Central Europe - CE',             value: 'CE'      },
        { label: 'Deloitte Central Mediterranean - DCM',     value: 'DCM'     },
        { label: 'Deloitte Cyprus - CY',                     value: 'CY'      },
        { label: 'Deloitte Denmark - DK',                    value: 'DK'      },
        { label: 'Deloitte DKU - DKU',                       value: 'DKU'     },
        { label: 'DTTL (Deloitte Global) - GLB',             value: 'GLB'     },
        { label: 'Deloitte Finland - FI',                    value: 'FI'      },
        { label: 'Deloitte France - FR',                     value: 'FR'      },
        { label: 'Deloitte Germany - DE',                    value: 'DE'      },
        { label: 'Deloitte Iceland - IS',                    value: 'IS'      },
        { label: 'Deloitte Ireland - IE',                    value: 'IE'      },
        { label: 'Deloitte Luxembourg - LU',                 value: 'LU'      },
        { label: 'Deloitte Middle East - DME',               value: 'DME'     },
        { label: 'Deloitte Netherlands - NL',                value: 'NL'      },
        { label: 'Deloitte Nordics - Nordics',               value: 'Nordics' },
        { label: 'Deloitte North and South Europe - NSE',    value: 'NSE'     },
        { label: 'Deloitte Norway - NO',                     value: 'NO'      },
        { label: 'Deloitte Portugal - PT',                   value: 'PT'      },
        { label: 'Deloitte Spain - ES',                      value: 'ES'      },
        { label: 'Deloitte Sweden - SE',                     value: 'SE'      },
        { label: 'Deloitte Switzerland - CH',                value: 'CH'      },
        { label: 'Deloitte Turkey - TR',                     value: 'TR'      },
        { label: 'Deloitte United Kingdom - UK',             value: 'UK'      },
        { label: 'Deloitte South East Asia - SEA',           value: 'SEA'      },
        { label: 'Deloitte South Asia India - SA_IN',        value: 'SA_IN'      },
        { label: 'Deloitte South Asia Mauritius - SA_MU',    value: 'SA_MU'      },
        { label: 'Deloitte Japan - JP',                      value: 'JP'      },
        { label: 'Deloitte Korea - KR',                      value: 'KR'      },
        { label: 'Deloitte Taiwan - TW',                     value: 'TW'      },
        { label: 'Deloitte Australia - AU',                  value: 'AU'      },
        { label: 'Deloitte New Zealand - NZ',                value: 'NZ'      },
        { label: 'Deloitte US - US',                         value: 'US'      },
        { label: 'Deloitte Canada - CA',                     value: 'CA'      },
        { label: 'Deloitte Brazil - BR',                     value: 'BR'      },
        { label: 'Deloitte Caribbean and Bermuda Countries - CBC', value: 'CBC'      },
        { label: 'Deloitte SLATAM - SLATAM',                 value: 'SLATAM'      },
    ];

    const PRODUCT_OPTIONS = ['-- Select Product --', 'SWG', 'DLP', 'CASB'];

    // Maps MF dropdown value -> Netskope tenant URL
    // The 5 logical tenant groups. Keys stored in GM storage.
    const TENANT_GROUPS = [
        { key: 'nsTenantEMA', label: 'EMA',  mfs: ['Africa', 'DKU', 'GLB', 'ES', 'SLAT'] },
        { key: 'nsTenantEU',  label: 'EU',   mfs: ['AT','BE','DCM','CY','DK','FI','IS','IE','LU','DME','NL','Nordics','NSE','NO','SE','CH','UK'] },
        { key: 'nsTenantCE',  label: 'CE',   mfs: ['CE','FR','DE','PT','TR'] },
        { key: 'nsTenantAPA', label: 'APAC', mfs: ['AU','SA_MU','JP','KR','NZ','SA_IN','SEA','TW'] },
        { key: 'nsTenantAME', label: 'AME',  mfs: ['BR','CA','CAR','CL','MU','MX','US','TTL'] },
    ];

    /** Returns true when all 5 tenant URLs have been saved */
    function tenantsConfigured() {
        return TENANT_GROUPS.every(g => !!GM_getValue(g.key, ''));
    }

    /** Build TENANT_MAPPING at runtime from stored GM values */
    function getTenantMapping() {
        const map = {};
        for (const group of TENANT_GROUPS) {
            const url = GM_getValue(group.key, '');
            for (const mf of group.mfs) map[mf] = url;
        }
        return map;
    }

    /* ==========================================================
     *  DOM UTILITIES
     * ========================================================== */

    /** Find the Subject input — pierces LWC shadow DOM layers if needed */
    function getSubjectInput() {
        // 1. Light DOM (synthetic shadow / non-native)
        const direct = document.querySelector('input[name="Subject"]');
        if (direct) return direct;

        // 2. Pierce: lightning-input.subField -> shadow -> lightning-primitive-input-simple -> shadow -> input
        const lwcHost = document.querySelector('lightning-input.subField') ||
                        document.querySelector('lightning-input[class*="subField"]');
        if (lwcHost && lwcHost.shadowRoot) {
            const inp1 = lwcHost.shadowRoot.querySelector('input[name="Subject"]');
            if (inp1) return inp1;
            const prim = lwcHost.shadowRoot.querySelector('lightning-primitive-input-simple');
            if (prim && prim.shadowRoot) {
                const inp2 = prim.shadowRoot.querySelector('input[name="Subject"]');
                if (inp2) return inp2;
            }
        }

        // 3. Broad fallback: walk all LWC shadow roots
        for (const el of document.querySelectorAll('lightning-input, lightning-primitive-input-simple')) {
            if (el.shadowRoot) {
                const inp = el.shadowRoot.querySelector('input[name="Subject"], input[maxlength="255"]');
                if (inp) return inp;
            }
        }

        return null;
    }

    /** Set input value in a way LWC/Aura frameworks will detect */
    function setNativeInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ==========================================================
     *  CSS
     * ========================================================== */

    const style = document.createElement('style');
    style.textContent = `
        #nsTktPanel {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            background: #fff;
            border: 1px solid #ccc;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.22);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            display: none;
            width: 520px;
            font-size: 14px;
        }
        #nsTktOverlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.28);
            z-index: 9998;
            display: none;
        }
        #nsTktPanel .ns-header {
            padding: 6px 40px 10px 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #nsTktPanel .ns-title {
            font-weight: bold;
            font-size: 13px;
            color: #333;
        }
        #nsTktPanel .ns-version {
            font-size: 11px;
            color: #aaa;
        }
        #nsTktPanel .ns-cfg-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #f0f0f0;
            border: 1px solid #ccc;
            cursor: pointer;
            font-size: 11px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            color: #444;
            padding: 3px 8px;
            border-radius: 4px;
            transition: background 0.15s, border-color 0.15s;
            white-space: nowrap;
        }
        #nsTktPanel .ns-cfg-btn:hover { background: #e0e0e0; border-color: #999; color: #222; }
        #nsTktCloseBtn {
            position: absolute;
            top: 6px; right: 6px;
            background: #e53935;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 26px; height: 26px;
            font-weight: bold;
            font-size: 14px;
            line-height: 1;
        }
        #nsTktPreview {
            margin: 10px 10px 4px;
            padding: 7px 10px;
            background: #f0f4ff;
            border-left: 3px solid #667eea;
            border-radius: 4px;
            font-size: 12px;
            color: #444;
            font-family: monospace;
            word-break: break-all;
            min-height: 28px;
        }
        #nsTktPanel .ns-fields {
            margin-top: 10px;
        }
        #nsTktPanel .ns-field {
            display: flex;
            align-items: center;
            margin: 0 0 8px 10px;
        }
        #nsTktPanel .ns-field label {
            display: inline-block;
            width: 110px;
            font-weight: bold;
            color: #222;
            margin-right: 6px;
            flex-shrink: 0;
            font-size: 13px;
        }
        #nsTktPanel select,
        #nsTktPanel input[type="text"] {
            padding: 5px 28px 5px 8px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background: #f9f9f9;
            font-size: 13px;
            width: 300px;
            box-sizing: border-box;
            color: #222;
            appearance: none;
            -webkit-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23444" height="20" width="20" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 14px;
            transition: border-color 0.15s;
        }
        #nsTktPanel input[type="text"] {
            background-image: none;
            padding-right: 8px;
        }
        #nsTktPanel select:focus,
        #nsTktPanel input[type="text"]:focus {
            border-color: #667eea;
            background-color: #fff;
            outline: none;
        }
        #nsTktPanel .ns-btn-row {
            display: flex;
            gap: 8px;
            margin: 12px 10px 6px;
        }
        #nsTktPanel .ns-btn-apply {
            flex: 1;
            padding: 8px 12px;
            background: #667eea;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;
            transition: background 0.15s;
        }
        #nsTktPanel .ns-btn-apply:hover { background: #5568d3; }
        #nsTktPanel .ns-btn-clear {
            padding: 7px 12px;
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            color: #444;
            transition: background 0.15s;
        }
        #nsTktPanel .ns-btn-clear:hover { background: #e0e0e0; }
        .ns-tkt-inject-wrap {
            display: inline-flex;
            align-items: center;
            margin-left: 5px;
            vertical-align: middle;
        }
        .ns-tkt-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px; height: 26px;
            border-radius: 4px;
            border: 1px solid #5568d3;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            background: #667eea;
            padding: 0;
            transition: background 0.15s;
        }
        .ns-tkt-btn:hover { background: #5568d3; }
        /* Tenant setup modal */
        #nsTktSetupOverlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        }
        #nsTktSetupModal {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 24px;
            width: 480px;
            font-family: Arial, sans-serif;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        #nsTktSetupModal h2 {
            margin: 0 0 6px;
            font-size: 16px;
            color: #333;
        }
        #nsTktSetupModal .ns-setup-note {
            font-size: 12px;
            color: #777;
            background: #fffbe6;
            border-left: 3px solid #f0ad00;
            padding: 7px 10px;
            border-radius: 4px;
            margin-bottom: 16px;
        }
        #nsTktSetupModal .ns-setup-field {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        #nsTktSetupModal .ns-setup-field label {
            width: 60px;
            font-weight: bold;
            font-size: 13px;
            color: #333;
            flex-shrink: 0;
        }
        #nsTktSetupModal .ns-setup-field input {
            flex: 1;
            padding: 5px 8px;
            border: 1px solid #ccc;
            border-radius: 6px;
            font-size: 13px;
            font-family: monospace;
        }
        #nsTktSetupModal .ns-setup-field input:focus {
            border-color: #667eea;
            outline: none;
        }
        #nsTktSetupModal .ns-setup-save {
            width: 100%;
            margin-top: 6px;
            padding: 9px;
            background: #667eea;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
        }
        #nsTktSetupModal .ns-setup-save:hover { background: #5568d3; }
        #nsTktSetupModal .ns-setup-save:disabled {
            background: #aaa;
            cursor: not-allowed;
        }

        /* ── Changelog notification badge ── */
        #nsTktChangelogNotif {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }
        #nsTktChangelogNotif:hover { background-color: #f0f0f0 !important; }
        #nsTktChangelogNotif .ns-notif-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: nsTktColorPulse 1s ease-in-out infinite !important;
        }
        @keyframes nsTktColorPulse {
            0%, 100% { background-color: #007bff; }
            50%       { background-color: #ff8c00; }
        }
        #nsTktChangelogNotif .ns-notif-txt {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* ── Changelog modal ── */
        #nsTktChangelogModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 20001 !important;
            background: #ffffff !important;
            border: 2px solid #333333 !important;
            padding: 20px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            font-family: Arial, sans-serif !important;
            border-radius: 10px !important;
            max-width: 600px !important;
            width: 90% !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            color: #333333 !important;
        }
        #nsTktChangelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.4em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }
        #nsTktChangelogModal .ns-cl-info {
            background-color: #f0f4ff !important;
            color: #333333 !important;
            padding: 10px !important;
            border-radius: 5px !important;
            margin-bottom: 15px !important;
            border-left: 4px solid #667eea !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            font-weight: normal !important;
        }
        .ns-cl-card {
            border: 1px solid #e0e0e0 !important;
            border-radius: 6px !important;
            margin-bottom: 8px !important;
            overflow: hidden !important;
        }
        .ns-cl-card.ns-cl-card-latest { border-color: #667eea !important; }
        .ns-cl-card-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 9px 12px !important;
            background: #f8f8f8 !important;
            cursor: pointer !important;
            user-select: none !important;
        }
        .ns-cl-card.ns-cl-card-latest .ns-cl-card-header { background: #f0f0ff !important; }
        .ns-cl-card-version {
            font-weight: bold !important;
            font-size: 13px !important;
            color: #555 !important;
            font-family: Arial, sans-serif !important;
        }
        .ns-cl-card.ns-cl-card-latest .ns-cl-card-version { color: #667eea !important; }
        .ns-cl-latest-tag {
            font-size: 10px !important;
            font-weight: bold !important;
            background: #667eea !important;
            color: #fff !important;
            border-radius: 3px !important;
            padding: 1px 6px !important;
            margin-left: 8px !important;
            font-family: Arial, sans-serif !important;
        }
        .ns-cl-card-chevron {
            font-size: 12px !important;
            color: #999 !important;
            transition: transform 0.2s !important;
            display: inline-block !important;
        }
        .ns-cl-card-body {
            background: #fff !important;
            padding: 10px 14px !important;
        }
        .ns-cl-bullet {
            display: flex !important;
            gap: 8px !important;
            padding: 3px 0 !important;
            font-size: 13px !important;
            font-family: Arial, sans-serif !important;
            color: #444 !important;
            line-height: 1.5 !important;
        }
        .ns-cl-bullet-dot {
            color: #667eea !important;
            flex-shrink: 0 !important;
            font-weight: bold !important;
        }
        #nsTktChangelogModal .ns-cl-close {
            margin-top: 15px !important;
            padding: 10px 20px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            width: 100% !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
        }
        #nsTktChangelogModal .ns-cl-close:hover { background-color: #5568d3 !important; }
        #nsTktChangelogOverlay {
            position: fixed !important;
            inset: 0 !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 20000 !important;
        }
        #nsTicketSubjectHelpModal { background-color: #ffffff !important; color: #333333 !important; }
        #nsTicketSubjectHelpModal input, #nsTicketSubjectHelpModal select, #nsTicketSubjectHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  PANEL
     * ========================================================== */

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
        overlay.id = 'nsTktChangelogOverlay';

        const modal = document.createElement('div');
        modal.id = 'nsTktChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New — v${SCRIPT_VERSION}`;

        const info = document.createElement('div');
        info.className = 'ns-cl-info';
        info.textContent = `You've been updated to v${SCRIPT_VERSION}!`;

        const cardsWrap = document.createElement('div');
        parseChangelog().forEach((entry, index) => {
            const isLatest = index === 0;

            const card = document.createElement('div');
            card.className = 'ns-cl-card' + (isLatest ? ' ns-cl-card-latest' : '');

            const header = document.createElement('div');
            header.className = 'ns-cl-card-header';

            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';

            const versionLabel = document.createElement('span');
            versionLabel.className = 'ns-cl-card-version';
            versionLabel.textContent = `Version ${entry.version}`;
            versionWrap.appendChild(versionLabel);

            if (isLatest) {
                const tag = document.createElement('span');
                tag.className = 'ns-cl-latest-tag';
                tag.textContent = 'Latest';
                versionWrap.appendChild(tag);
            }

            const chevron = document.createElement('span');
            chevron.className = 'ns-cl-card-chevron';
            chevron.textContent = '▾';
            chevron.style.transform = isLatest ? 'rotate(0deg)' : 'rotate(-90deg)';

            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'ns-cl-card-body';
            body.style.display = isLatest ? 'block' : 'none';

            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                row.className = 'ns-cl-bullet';
                const dot = document.createElement('span');
                dot.className = 'ns-cl-bullet-dot';
                dot.textContent = '•';
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
                body.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });

            cardsWrap.appendChild(card);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'ns-cl-close';
        closeBtn.textContent = 'Got it!';
        closeBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            const notif = document.getElementById('nsTktChangelogNotif');
            if (notif) notif.remove();
        };

        modal.appendChild(title);
        modal.appendChild(info);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeBtn);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeBtn.click();
    }

    /* ==========================================================
     *  FEATURE GUIDE  (? Help modal)
     * ========================================================== */

    function showHelpModal() {
        if (document.getElementById('nsTicketSubjectHelpModal')) return;

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
                    lead(body, 'Open a new case on the Netskope support portal. A 📝 button appears next to the Subject label.');
                    const row = hrow([
                        span('Subject', { fontSize: '13px', color: '#333', fontWeight: 'bold' }),
                        chip('📝', '#667eea', { radius: '4px', padding: '2px 6px', fontSize: '12px' })
                    ], { gap: '6px', margin: '0 0 6px 0' });
                    body.appendChild(row);
                    const subj = document.createElement('div');
                    Object.assign(subj.style, { border: '1px solid #ccc', borderRadius: '4px', height: '26px', maxWidth: '320px', background: '#fff', marginBottom: '6px' });
                    body.appendChild(subj);
                    caption(body, 'Click 📝 to open the Subject Helper panel.');
                    bullets(body, [
                        'The first time, a setup window asks for your Netskope tenant URLs.',
                        'Fill in the panel, check the preview and click Insert Subject.'
                    ]);
                }
            },
            {
                icon: '📋', title: 'Building the Subject',
                buildContent(body) {
                    lead(body, 'The subject always follows the same four part format.');
                    const fmt = document.createElement('div');
                    Object.assign(fmt.style, {
                        background: '#f0f4ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#444',
                        marginBottom: '10px'
                    });
                    fmt.textContent = 'MF | RITM | SWG / DLP / CASB | Issue Summary';
                    body.appendChild(fmt);
                    kvGrid(body, [
                        ['MF',      'Your member firm, picked from the list (for example ES or UK).'],
                        ['RITM',    'The ServiceNow ticket number, for example RITM1234567.'],
                        ['Product', 'SWG, DLP or CASB.'],
                        ['Summary', 'A short description of the issue.']
                    ]);
                    const wrap = document.createElement('div');
                    Object.assign(wrap.style, { margin: '4px 0 0 0', borderRadius: '6px', border: '1px solid #d0d0f0', overflow: 'hidden' });
                    [['Preview', '#f8f8ff', '#888', 'ES | RITM | DLP | Issue Summary'], ['Inserted', '#f2fff7', '#2a7d4f', 'ES | RITM1234567 | DLP | Blocked upload to SharePoint']].forEach(([label, bg, color, text], i) => {
                        const r = hrow([
                            span(label, { fontSize: '10px', fontWeight: 'bold', color, textTransform: 'uppercase', width: '58px', flexShrink: '0' }),
                            span(text, { fontFamily: 'monospace', fontSize: '11px', color: '#333' })
                        ], { padding: '7px 12px', background: bg, margin: '0', flexWrap: 'nowrap', borderBottom: i === 0 ? '1px solid #e8e8f0' : 'none' });
                        wrap.appendChild(r);
                    });
                    body.appendChild(wrap);
                    caption(body, 'The preview at the top of the panel updates as you type. Empty parts show their placeholder.');
                }
            },
            {
                icon: '🔗', title: 'Tenant URL Auto Fill',
                buildContent(body) {
                    lead(body, 'Picking an MF also fills the Tenant URL field of the case with the matching tenant.');
                    kvGrid(body, [
                        ['EMA',  'Africa, DKU, Global, Spain, SLATAM'],
                        ['EU',   'Austria, Belgium, Cyprus, Nordics, Ireland, Netherlands, Switzerland, UK and more'],
                        ['CE',   'Central Europe, France, Germany, Portugal, Turkey'],
                        ['APAC', 'Australia, Japan, Korea, New Zealand, South Asia, South East Asia, Taiwan'],
                        ['AME',  'Brazil, Canada, US and more']
                    ]);
                    bullets(body, [
                        'The five tenant URLs are saved in your browser the first time you set them up.',
                        'Enter them exactly as they appear in the General Scripts User Guide, under "Required information & variables".'
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent(body) {
                    lead(body, 'The panel header and the bottom row hold these controls.');
                    badgeRow(body, { bg: '#f0f0f0', color: '#444', border: '1px solid #ccc', label: '⚙️ Tenant URLs', desc: 'Opens the Tenant URL Setup window to view or change the five tenant URLs.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#0066cc', border: 'none', label: "🔵 What's New", desc: 'Appears beside the version number after an update. Opens the changelog.' });
                    badgeRow(body, { bg: '#667eea', color: '#fff', border: 'none', label: '✔ Insert Subject', desc: 'Writes the subject into the Subject field of the case and closes the panel.' });
                    badgeRow(body, { bg: '#f0f0f0', color: '#444', border: '1px solid #ccc', label: 'Clear Fields', desc: 'Empties every field of the panel so you can start again.' });
                    badgeRow(body, { bg: '#e53935', color: '#fff', border: 'none', label: '✕', desc: 'Closes the panel. Clicking outside it does the same.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'nsTicketSubjectHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '20002'
        });

        const modal = document.createElement('div');
        modal.id = 'nsTicketSubjectHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '20003', background: '#fff', border: '2px solid #333', padding: '20px',
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
        titleSub.textContent = `Ticket Subject Helper • v${SCRIPT_VERSION}`;
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

    function closePanel() {
        const p = document.getElementById('nsTktPanel');
        const o = document.getElementById('nsTktOverlay');
        if (p) p.style.display = 'none';
        if (o) o.style.display = 'none';
    }

    function buildSubjectString() {
        const mf      = document.getElementById('nsTktMf').value.trim();
        const ritm    = document.getElementById('nsTktRitm').value.trim();
        const product = document.getElementById('nsTktProduct').value.trim();
        const summary = document.getElementById('nsTktSummary').value.trim();

        return [
            mf      || 'MF',
            ritm    || 'RITM',
            product || 'SWG / DLP / CASB',
            summary || 'Issue Summary',
        ].join(' | ');
    }

    function updatePreview() {
        const el = document.getElementById('nsTktPreview');
        if (el) el.textContent = buildSubjectString();
    }

    /** Fill the TenantURL input on the Netskope form using shadow DOM piercing */
    function fillTenantUrl(value) {
        // TenantURL input sits in a lightning-input.tenantField, same shadow structure
        let tenantInput = document.querySelector('input[name="TenantURL"]');

        if (!tenantInput) {
            const host = document.querySelector('lightning-input.tenantField') ||
                         document.querySelector('lightning-input[class*="tenantField"]');
            if (host && host.shadowRoot) {
                const inp1 = host.shadowRoot.querySelector('input[name="TenantURL"]');
                if (inp1) { tenantInput = inp1; }
                else {
                    const prim = host.shadowRoot.querySelector('lightning-primitive-input-simple');
                    if (prim && prim.shadowRoot) {
                        tenantInput = prim.shadowRoot.querySelector('input[name="TenantURL"]');
                    }
                }
            }
        }

        if (!tenantInput) {
            // Broad fallback: any input named TenantURL in any shadow root
            for (const el of document.querySelectorAll('lightning-input, lightning-primitive-input-simple')) {
                if (el.shadowRoot) {
                    const inp = el.shadowRoot.querySelector('input[name="TenantURL"]');
                    if (inp) { tenantInput = inp; break; }
                }
            }
        }

        if (tenantInput && value) setNativeInputValue(tenantInput, value);
    }

    function initPanel() {
        /* Overlay */
        const overlay = document.createElement('div');
        overlay.id = 'nsTktOverlay';
        overlay.onclick = closePanel;
        document.body.appendChild(overlay);

        /* Panel */
        const panel = document.createElement('div');
        panel.id = 'nsTktPanel';
        document.body.appendChild(panel);

        /* Close button */
        const closeBtn = document.createElement('button');
        closeBtn.id = 'nsTktCloseBtn';
        closeBtn.textContent = '\u2715';
        closeBtn.onclick = closePanel;
        panel.appendChild(closeBtn);

        /* Header */
        const header = document.createElement('div');
        header.className = 'ns-header';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'ns-title';
        titleSpan.textContent = '\uD83D\uDCDD Subject Helper';

        const cfgBtn = document.createElement('button');
        cfgBtn.className = 'ns-cfg-btn';
        cfgBtn.title = 'Configure tenant URLs';
        cfgBtn.innerHTML = '\u2699\uFE0F <span style="font-size:11px;">Tenant URLs</span>';
        cfgBtn.onclick = () => {
            closePanel();
            showTenantSetup(() => {});
        };

        const leftSpan = document.createElement('span');
        leftSpan.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
        leftSpan.appendChild(titleSpan);
        leftSpan.appendChild(cfgBtn);

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        leftSpan.appendChild(helpBtn);
        header.appendChild(leftSpan);

        const rightSpan = document.createElement('span');
        rightSpan.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';

        const verSpan = document.createElement('span');
        verSpan.className = 'ns-version';
        verSpan.textContent = `v${SCRIPT_VERSION}`;
        rightSpan.appendChild(verSpan);

        if (isNewVersion() && !hasSeenChangelog()) {
            const notif = document.createElement('span');
            notif.id = 'nsTktChangelogNotif';
            const dot = document.createElement('span');
            dot.className = 'ns-notif-dot';
            const txt = document.createElement('span');
            txt.className = 'ns-notif-txt';
            txt.textContent = "What's New";
            notif.appendChild(dot);
            notif.appendChild(txt);
            notif.onclick = showChangelogModal;
            rightSpan.appendChild(notif);
        }

        header.appendChild(rightSpan);
        panel.appendChild(header);

        /* Live preview bar */
        const preview = document.createElement('div');
        preview.id = 'nsTktPreview';
        preview.textContent = 'MF | RITM | SWG / DLP / CASB | Issue Summary';
        panel.appendChild(preview);

        /* Fields */
        const fields = document.createElement('div');
        fields.className = 'ns-fields';

        function addDropdown(labelText, options, id) {
            const wrap = document.createElement('div');
            wrap.className = 'ns-field';
            const lbl = document.createElement('label');
            lbl.textContent = labelText + ':';
            lbl.setAttribute('for', id);
            const sel = document.createElement('select');
            sel.id = id;
            options.forEach(o => {
                const opt = document.createElement('option');
                if (typeof o === 'object') { opt.value = o.value; opt.textContent = o.label; }
                else { opt.value = opt.textContent = o; }
                sel.appendChild(opt);
            });
            sel.addEventListener('change', updatePreview);
            wrap.appendChild(lbl);
            wrap.appendChild(sel);
            fields.appendChild(wrap);
            return sel;
        }

        function addTextInput(labelText, id, placeholder) {
            const wrap = document.createElement('div');
            wrap.className = 'ns-field';
            const lbl = document.createElement('label');
            lbl.textContent = labelText + ':';
            lbl.setAttribute('for', id);
            const inp = document.createElement('input');
            inp.id = id;
            inp.type = 'text';
            if (placeholder) inp.placeholder = placeholder;
            inp.addEventListener('input', updatePreview);
            wrap.appendChild(lbl);
            wrap.appendChild(inp);
            fields.appendChild(wrap);
            return inp;
        }

        const mfSel = addDropdown('MF', MF_OPTIONS, 'nsTktMf');
        mfSel.addEventListener('change', () => {
            const url = getTenantMapping()[mfSel.value] || '';
            fillTenantUrl(url);
        });
        addTextInput('RITM',   'nsTktRitm',      'RITM1234567');
        addDropdown('Product', PRODUCT_OPTIONS,  'nsTktProduct');
        addTextInput('Summary','nsTktSummary',    'Brief issue description');

        panel.appendChild(fields);

        /* Action buttons */
        const btnRow = document.createElement('div');
        btnRow.className = 'ns-btn-row';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'ns-btn-apply';
        applyBtn.textContent = '\u2714  Insert Subject';
        applyBtn.onclick = () => {
            const inp = getSubjectInput();
            if (inp) {
                setNativeInputValue(inp, buildSubjectString());
            } else {
                alert('Could not find the Subject input. Please wait for the form to fully load.');
            }
            closePanel();
        };
        btnRow.appendChild(applyBtn);

        const clearBtn = document.createElement('button');
        clearBtn.className = 'ns-btn-clear';
        clearBtn.textContent = 'Clear Fields';
        clearBtn.onclick = () => {
            document.getElementById('nsTktMf').value      = '';
            document.getElementById('nsTktRitm').value    = '';
            document.getElementById('nsTktProduct').value = '';
            document.getElementById('nsTktSummary').value = '';
            updatePreview();
        };
        btnRow.appendChild(clearBtn);

        panel.appendChild(btnRow);
    }

    /* ==========================================================
     *  PRE-FILL FROM EXISTING SUBJECT
     * ========================================================== */

    /* ==========================================================
     *  BUTTON INJECTION
     * ========================================================== */

    function injectButtons() {
        if (document.getElementById('nsTktBtnWrap')) return;

        // Pierce shadow DOM to reach the <label> element directly:
        // lightning-input.subField -> shadowRoot -> lightning-primitive-input-simple
        //   -> shadowRoot -> label
        const lwcHost = document.querySelector('lightning-input.subField') ||
                        document.querySelector('lightning-input[class*="subField"]');
        if (!lwcHost || !lwcHost.shadowRoot) return;

        const prim = lwcHost.shadowRoot.querySelector('lightning-primitive-input-simple');
        if (!prim || !prim.shadowRoot) return;

        const label = prim.shadowRoot.querySelector('label');
        if (!label) return;

        const wrap = document.createElement('span');
        wrap.id        = 'nsTktBtnWrap';
        wrap.className = 'ns-tkt-inject-wrap';

        const openBtn = document.createElement('button');
        openBtn.type        = 'button';
        openBtn.className   = 'ns-tkt-btn';
        openBtn.title       = 'Subject Helper';
        openBtn.textContent = '\uD83D\uDCDD';
        openBtn.onclick = () => {
            const panel   = document.getElementById('nsTktPanel');
            const overlay = document.getElementById('nsTktOverlay');
            panel.style.display   = 'block';
            overlay.style.display = 'block';
        };
        wrap.appendChild(openBtn);

        // Append directly inside the <label> — sits right after "Subject" text
        label.appendChild(wrap);
    }

    /* ==========================================================
     *  TENANT SETUP MODAL
     * ========================================================== */

    function showTenantSetup(onComplete) {
        const overlay = document.createElement('div');
        overlay.id = 'nsTktSetupOverlay';
        document.body.appendChild(overlay);

        const modal = document.createElement('div');
        modal.id = 'nsTktSetupModal';

        modal.innerHTML = `
            <h2>&#x1F527; Tenant URL Setup</h2>
            <div class="ns-setup-note">
                &#x26A0;&#xFE0F; <strong>Where to find the tenant URLs:</strong> The Netskope tenant links for each region are listed in the <em>General Scripts User Guide</em> Word document.<br> Look for the section titled <strong>Required information & variables</strong>.
            </div>`;

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
        for (const group of TENANT_GROUPS) {
            const row = document.createElement('div');
            row.className = 'ns-setup-field';
            const lbl = document.createElement('label');
            lbl.textContent = group.label + ':';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = 'e.g. xx-xx-xx.goskope.com';
            inp.value = GM_getValue(group.key, '');
            inp.addEventListener('input', validate);
            inputs[group.key] = inp;
            row.appendChild(lbl);
            row.appendChild(inp);
            modal.appendChild(row);
        }

        const saveBtn = document.createElement('button');
        saveBtn.className = 'ns-setup-save';
        saveBtn.textContent = 'Save & Continue';
        modal.appendChild(saveBtn);

        document.body.appendChild(modal);

        function validate() {
            const allFilled = TENANT_GROUPS.every(g => inputs[g.key].value.trim() !== '');
            saveBtn.disabled = !allFilled;
        }
        validate();

        saveBtn.onclick = () => {
            for (const group of TENANT_GROUPS) {
                GM_setValue(group.key, inputs[group.key].value.trim());
            }
            overlay.remove();
            modal.remove();
            onComplete();
        };
    }

    /* ==========================================================
     *  BOOT
     * ========================================================== */

    function startInjection() {
        // Poll until the Subject field appears (LWC is async)
        const pollId = setInterval(() => {
            if (getSubjectInput()) { injectButtons(); clearInterval(pollId); }
        }, 600);

        // Re-inject on SPA navigation
        const observer = new MutationObserver(() => {
            if (getSubjectInput() && !document.getElementById('nsTktBtnWrap')) injectButtons();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback
        setTimeout(injectButtons, 3000);
    }

    function boot() {
        if (!tenantsConfigured()) {
            showTenantSetup(() => { initPanel(); startInjection(); });
            return;
        }
        initPanel();
        startInjection();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

})();