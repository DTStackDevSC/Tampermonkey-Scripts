// ==UserScript==
// @name         Netskope Ticket Subject Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeTicketSubjectHelper.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeTicketSubjectHelper.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.3
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

    const SCRIPT_VERSION = '1.0.3';
    const CHANGELOG = `Version 1.0.3:
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
        #nsTktChangelogModal .ns-cl-content {
            white-space: pre-wrap !important;
            line-height: 1.6 !important;
            color: #333333 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            font-weight: normal !important;
            background-color: #fafafa !important;
            padding: 10px !important;
            border-radius: 5px !important;
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
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  PANEL
     * ========================================================== */

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

        const body = document.createElement('div');
        body.className = 'ns-cl-content';
        body.textContent = CHANGELOG;

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
        modal.appendChild(body);
        modal.appendChild(closeBtn);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeBtn.click();
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
            txt.textContent = 'Changelog';
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