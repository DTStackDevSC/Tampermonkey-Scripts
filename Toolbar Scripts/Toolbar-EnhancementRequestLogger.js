// ==UserScript==
// @name         |Toolbar| Enhancement Request Logger
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.1
// @description  Opens a pre-filled Office Forms submission with RITM auto-populated from the current ServiceNow ticket - Integrated with Toolbar
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('📋 Enhancement Request Logger loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.1';
    const CHANGELOG = `Version 1.1:
- Service and Region fields converted to dropdowns; Region supports EMEA, APAC, and AME
- Updated Details field placeholder text

Version 1.0:
- Initial release`;

    const GM_KEY_VERSION        = 'erlVersion';
    const GM_KEY_CHANGELOG_SEEN = 'erlChangelogSeen';

    function getStoredVersion()  { return GM_getValue(GM_KEY_VERSION, null); }
    function saveVersion(v)      { GM_setValue(GM_KEY_VERSION, v); }
    function hasSeenChangelog()  { return GM_getValue(GM_KEY_CHANGELOG_SEEN, null) === SCRIPT_VERSION; }
    function markChangelogSeen() { GM_setValue(GM_KEY_CHANGELOG_SEEN, SCRIPT_VERSION); }

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

    /* ==========================================================
     *  CONFIGURATION
     * ==========================================================*/

    const FORM_BASE_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=8UXaNizdH02vE1q-RrmZIfcr6iS62VJHoplKi5KJ73dUNk9ZSzlQQTRJTkFOVk9ZU0xLS0lEVk9MUi4u';

    const PARAM_SERVICE     = 'r496ad1f88f214369bc47b3240310be93';
    const PARAM_CASE_NUMBER = 'r0623f39004cf4c80a1f8b8b7754d45d3';
    const PARAM_RITM        = 're9787aeeab4c449d95cd77040e7c5cc4';
    const PARAM_VENDOR_CASE = 'r89798ae279624de7ad97cb06e2ad8eec';
    const PARAM_REGION      = 'r6304b1498aaa438d9bdebd7d0fc32a14';
    const PARAM_DETAILS     = 'rdcd805e8af324630852bd6daceba1948';

    const DEFAULT_SERVICE = 'Netskope';
    const DEFAULT_REGION  = 'EMEA';

    /* ==========================================================
     *  TOOLBAR REGISTRATION CONFIG
     * ==========================================================*/

    const TOOL_ID       = 'enhancementRequestLogger';
    const TOOL_TOOLTIP  = 'Enhancement Request Logger';
    const TOOL_POSITION = 11;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
    </svg>`;

    /* ==========================================================
     *  GLOBAL FLAGS
     * ==========================================================*/

    let isInitialized        = false;
    let isRegistered         = false;
    let registrationAttempts = 0;

    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY  = 500;

    /* ==========================================================
     *  HELPERS
     * ==========================================================*/

    function getTicketNumber() {
        const el =
            document.querySelector('input[id*="sc_req_item.number"]') ||
            document.querySelector('input[id*="incident.number"]')     ||
            document.querySelector('input[id$=".number"][readonly]');
        return el?.value?.trim() || null;
    }

    function buildFormUrl(service, caseNumber, ritm, vendorCase, region, details) {
        // Service and Region are Choice fields in Office Forms — must be wrapped in quotes.
        // Use encodeURIComponent (not URLSearchParams) to produce %20 for spaces, which
        // Office Forms pre-fill requires; URLSearchParams would produce "+" instead.
        const params = [
            [PARAM_SERVICE,     `"${service}"`],
            [PARAM_CASE_NUMBER, caseNumber],
            [PARAM_RITM,        ritm],
            [PARAM_VENDOR_CASE, vendorCase],
            [PARAM_REGION,      `"${region}"`],
            [PARAM_DETAILS,     details],
        ];
        const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        return `${FORM_BASE_URL}&${qs}`;
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'erl-cl-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '20000', display: 'block'
        });

        const clModal = document.createElement('div');
        clModal.id = 'erl-cl-modal';
        Object.assign(clModal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '20001', background: '#ffffff', border: '2px solid #333', padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial,sans-serif',
            borderRadius: '10px', maxWidth: '600px', width: '90%', maxHeight: '80vh',
            overflowY: 'auto', color: '#333'
        });

        const clTitle = document.createElement('h2');
        clTitle.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(clTitle.style, {
            marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea',
            paddingBottom: '10px', fontSize: '1.5em', fontWeight: 'bold'
        });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa', color: '#333', padding: '10px', borderRadius: '5px',
            marginBottom: '15px', borderLeft: '4px solid #667eea', fontSize: '14px'
        });

        const changelogContent = document.createElement('div');
        changelogContent.textContent = CHANGELOG;
        Object.assign(changelogContent.style, {
            whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333',
            fontFamily: "'Courier New',Courier,monospace", fontSize: '13px',
            backgroundColor: '#fafafa', padding: '10px', borderRadius: '5px'
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            marginTop: '15px', padding: '10px 20px', backgroundColor: '#667eea', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px'
        });
        closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#5568d3'; });
        closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = '#667eea'; });
        closeButton.onclick = () => {
            overlay.remove();
            clModal.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            const n = document.getElementById('erl-changelog-notif');
            if (n) n.remove();
        };

        clModal.appendChild(clTitle);
        clModal.appendChild(versionInfo);
        clModal.appendChild(changelogContent);
        clModal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(clModal);
        overlay.onclick = () => closeButton.click();
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #erl-changelog-notif {
                display: inline-flex; align-items: center; gap: 5px;
                cursor: pointer; padding: 2px 6px;
                border-radius: 4px; transition: background-color 0.2s ease;
            }
            #erl-changelog-notif:hover { background-color: #f0f0f0; }
            #erl-changelog-notif .erl-notif-dot {
                display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                animation: erlColorPulse 1s ease-in-out infinite;
            }
            @keyframes erlColorPulse {
                0%, 100% { background-color: #667eea; }
                50%       { background-color: #5568d3; }
            }
            #erl-changelog-notif .erl-notif-text {
                font-size: 11px; color: #667eea; text-decoration: underline;
                font-family: Arial, sans-serif; font-weight: normal;
            }
        `;
        document.head.appendChild(style);
    }

    /* ==========================================================
     *  MODAL
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('erl-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'erl-modal';
        Object.assign(modal.style, {
            position:        'fixed',
            top:             '60px',
            left:            '50%',
            transform:       'translateX(-50%)',
            backgroundColor: '#f9f9f9',
            border:          '1px solid #ccc',
            boxShadow:       '0px 4px 12px rgba(0,0,0,0.15)',
            padding:         '50px 24px 24px 24px',
            zIndex:          '999998',
            borderRadius:    '10px',
            fontFamily:      'Arial, sans-serif',
            display:         'none',
            flexDirection:   'column',
            alignItems:      'stretch',
            gap:             '14px',
            minWidth:        '460px',
            maxWidth:        '560px'
        });

        // ── Close button ──────────────────────────────────────
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        Object.assign(closeButton.style, {
            position:     'absolute',
            top:          '5px',
            right:        '5px',
            background:   'red',
            color:        'white',
            border:       'none',
            borderRadius: '4px',
            cursor:       'pointer',
            padding:      '4px 8px',
            fontWeight:   'bold'
        });
        closeButton.onclick = () => modal.style.display = 'none';
        modal.appendChild(closeButton);

        // ── Title bar ─────────────────────────────────────────
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            position:   'absolute',
            top:        '10px',
            left:       '12px',
            display:    'flex',
            alignItems: 'center',
            gap:        '8px'
        });

        const titleText = document.createElement('span');
        Object.assign(titleText.style, { fontSize: '12px', color: '#333', fontWeight: 'bold' });
        titleText.textContent = '📋 Enhancement Request Logger';
        titleBar.appendChild(titleText);

        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, { fontSize: '11px', color: '#6b7280' });
        titleBar.appendChild(versionBadge);

        if (isNewVersion() && !hasSeenChangelog()) {
            const clNotif = document.createElement('span');
            clNotif.id = 'erl-changelog-notif';
            const dot = document.createElement('span');
            dot.className = 'erl-notif-dot';
            const txt = document.createElement('span');
            txt.className = 'erl-notif-text';
            txt.textContent = 'Changelog';
            clNotif.appendChild(dot);
            clNotif.appendChild(txt);
            clNotif.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });
            titleBar.appendChild(clNotif);
        }

        modal.appendChild(titleBar);

        // ── Field builders ────────────────────────────────────
        function makeLabel(text) {
            const lbl = document.createElement('label');
            lbl.textContent = text;
            Object.assign(lbl.style, {
                display:      'block',
                fontWeight:   'bold',
                fontSize:     '12px',
                color:        '#555',
                marginBottom: '4px'
            });
            return lbl;
        }

        function makeReadOnlyRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const input = document.createElement('input');
            input.id          = valueId;
            input.type        = 'text';
            input.readOnly    = true;
            input.placeholder = placeholder;
            Object.assign(input.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#555',
                background:   '#efefef',
                boxSizing:    'border-box'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(input);
            return wrap;
        }

        function makeEditableRow(labelText, valueId, placeholder, defaultValue) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const input = document.createElement('input');
            input.id          = valueId;
            input.type        = 'text';
            input.placeholder = placeholder;
            if (defaultValue) input.value = defaultValue;
            Object.assign(input.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(input);
            return wrap;
        }

        function makeSelectRow(labelText, valueId, options, defaultValue) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const sel = document.createElement('select');
            sel.id = valueId;
            Object.assign(sel.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box',
                cursor:       'pointer'
            });
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === defaultValue) o.selected = true;
                sel.appendChild(o);
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(sel);
            return wrap;
        }

        function makeTextareaRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const ta = document.createElement('textarea');
            ta.id          = valueId;
            ta.placeholder = placeholder;
            ta.rows        = 3;
            Object.assign(ta.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box',
                resize:       'vertical',
                fontFamily:   'Arial, sans-serif'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(ta);
            return wrap;
        }

        modal.appendChild(makeSelectRow('Service',     'erl-service',     [DEFAULT_SERVICE], DEFAULT_SERVICE));
        modal.appendChild(makeEditableRow('Case Number', 'erl-case-number', 'e.g. IDEA-12345', ''));
        modal.appendChild(makeReadOnlyRow('RITM',        'erl-ritm',        'Not found — open a RITM ticket first'));
        modal.appendChild(makeEditableRow('Vendor Case', 'erl-vendor-case', 'e.g. 006', ''));
        modal.appendChild(makeSelectRow('Region',      'erl-region',      ['EMEA', 'APAC', 'AME'], DEFAULT_REGION));
        modal.appendChild(makeTextareaRow('Details',     'erl-details',     'Brief description of the Enhancement request'));

        // ── Status message ────────────────────────────────────
        const status = document.createElement('div');
        status.id = 'erl-status';
        Object.assign(status.style, {
            fontSize:  '12px',
            color:     '#c0392b',
            textAlign: 'center',
            minHeight: '16px'
        });
        modal.appendChild(status);

        // ── Open Form button ──────────────────────────────────
        const btnOpen = document.createElement('button');
        btnOpen.id          = 'erl-open-btn';
        btnOpen.textContent = '📋 Open Pre-filled Form';
        Object.assign(btnOpen.style, {
            padding:      '10px 20px',
            border:       'none',
            borderRadius: '6px',
            cursor:       'pointer',
            background:   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color:        'white',
            fontWeight:   'bold',
            fontSize:     '14px',
            width:        '100%'
        });
        btnOpen.onclick = openForm;
        modal.appendChild(btnOpen);

        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  SHOW MODAL — populates fields when opened
     * ==========================================================*/

    function showModal() {
        const modal = document.getElementById('erl-modal');
        if (!modal) {
            console.error('❌ Enhancement Request Logger modal not found!');
            return;
        }

        const ritm = getTicketNumber();

        document.getElementById('erl-service').value = DEFAULT_SERVICE;
        document.getElementById('erl-ritm').value    = ritm ?? '';

        const status = document.getElementById('erl-status');
        const btn    = document.getElementById('erl-open-btn');

        if (!ritm) {
            status.textContent = '⚠️ RITM not found — please open a ticket first.';
            btn.disabled      = true;
            btn.style.opacity = '0.5';
            btn.style.cursor  = 'not-allowed';
        } else {
            status.textContent = '';
            btn.disabled      = false;
            btn.style.opacity = '1';
            btn.style.cursor  = 'pointer';
        }

        modal.style.display = 'flex';
    }

    /* ==========================================================
     *  OPEN FORM
     * ==========================================================*/

    function openForm() {
        const ritm       = document.getElementById('erl-ritm').value.trim();
        const caseNumber = document.getElementById('erl-case-number').value.trim();
        const vendorCase = document.getElementById('erl-vendor-case').value.trim();
        const region     = document.getElementById('erl-region').value.trim() || DEFAULT_REGION;
        const details    = document.getElementById('erl-details').value.trim();

        if (!ritm) {
            document.getElementById('erl-status').textContent = '❌ Cannot open form — RITM is missing.';
            return;
        }

        const url = buildFormUrl(DEFAULT_SERVICE, caseNumber, ritm, vendorCase, region, details);
        console.log(`🔗 Opening form: ${url}`);
        GM_openInTab(url, { active: true, insert: true });

        const modal = document.getElementById('erl-modal');
        if (modal) modal.style.display = 'none';
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ Enhancement Request Logger already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Enhancement Request Logger: Max registration attempts reached. Toolbar may not be available.');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Enhancement Request Logger registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id:       TOOL_ID,
                    icon:     toolIcon,
                    tooltip:  TOOL_TOOLTIP,
                    position: TOOL_POSITION
                }
            }));
            isRegistered = true;
            console.log('✅ Enhancement Request Logger registered successfully!');
        } else {
            console.log(`⏳ Toolbar not ready (toolbar: ${!!toolbarExists}, menu: ${!!menuExists}), will retry...`);
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarReady', function () {
        console.log('✅ Toolbar ready event received');
        attemptRegistration();
    });

    document.addEventListener('toolbarToolClicked', function (e) {
        if (e.detail.id === TOOL_ID) {
            console.log('📋 Enhancement Request Logger clicked!');
            showModal();
        }
    });

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (!document.body) {
            setTimeout(initialize, 50);
            return;
        }

        if (isInitialized) {
            console.log('Enhancement Request Logger already initialized');
            return;
        }

        console.log('Initializing Enhancement Request Logger...');
        isInitialized = true;
        injectStyles();
        initializeModal();
        console.log('✅ Enhancement Request Logger modal ready!');

        setTimeout(() => {
            attemptRegistration();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', function () {
        if (!isRegistered) {
            console.log('🔄 Page loaded, checking registration status...');
            attemptRegistration();
        }
    });

})();
