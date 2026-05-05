// ==UserScript==
// @name         |Toolbar| Enhancement Request Logger
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0
// @description  Opens a pre-filled Office Forms submission with RITM auto-populated from the current ServiceNow ticket - Integrated with Toolbar
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('📋 Enhancement Request Logger loading...');

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

        // ── Title ─────────────────────────────────────────────
        const title = document.createElement('div');
        Object.assign(title.style, {
            position:   'absolute',
            top:        '12px',
            left:       '12px',
            fontSize:   '12px',
            color:      '#333',
            fontWeight: 'bold'
        });
        title.textContent = '📋 Enhancement Request Logger';
        modal.appendChild(title);

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
