// ==UserScript==
// @name         |Toolbar| Policy Deletion Reminder
// @namespace    https://gitlab.com/-/snippets/4904912
// @version      0.9
// @description  Registers a policy deletion reminder by opening a pre-filled form with the policy URL, name, and expiry date - Integrated with Toolbar
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        GM_openInTab
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('🗑️ Policy Deletion Reminder loading...');

    /* ==========================================================
     *  ⚙️  USER CONFIGURATION — Edit these values as needed
     * ==========================================================*/

    // The base Office Forms URL (everything up to and including the &id= param)
    const FORM_BASE_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=8UXaNizdH02vE1q-RrmZIQgejpGrB1pHvXnKBLeX7j5UOUhQTjA0UTJJRFozMVBVQjEzUVZBTzVZNCQlQCN0PWcu';

    // The exact query parameter keys used by this form's pre-fill system
    const PARAM_PAGE_URL    = 'r04fa97b2e8e8417c9b41f3feb7aed408';
    const PARAM_POLICY_NAME = 'r1e4d11ccef0940378297c0a725b73001';
    const PARAM_EXPIRY_DATE = 'r942cedc03c5c4a339a3bdea4a00f5097';

    // How many days in the future to calculate the date
    const DAYS_OFFSET = 30;

    /* ==========================================================
     *  TOOLBAR REGISTRATION CONFIG
     * ==========================================================*/

    const TOOL_ID       = 'policyDeletionReminder';
    const TOOL_TOOLTIP  = 'Register Policy Deletion Reminder';
    const TOOL_POSITION = 5;

    // Trash / delete clock icon
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 16h4v2h-4zm0-4h7v2h-7zm0-4h7v2h-7zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
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

    /**
     * Returns the full current page URL.
     */
    function getPageUrl() {
        return window.location.href;
    }

    /**
     * Reads the policy name from the Angular input field.
     * Returns the trimmed value, or null if the field isn't found / is empty.
     */
    function getPolicyName() {
        const input = document.querySelector(
            'input.ns-form-input.policy-name-container[placeholder="Policy Name"]'
        );
        if (!input) return null;
        const val = input.value.trim();
        return val.length > 0 ? val : null;
    }

    /**
     * Returns today's date plus DAYS_OFFSET in YYYY-MM-DD format.
     */
    function getFutureDate() {
        const date = new Date();
        date.setDate(date.getDate() + DAYS_OFFSET);
        const yyyy = date.getFullYear();
        const mm   = String(date.getMonth() + 1).padStart(2, '0');
        const dd   = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Builds the full form URL with query parameters.
     */
    function buildFormUrl(pageUrl, policyName, futureDate) {
        // Use encodeURIComponent (always produces %20 for spaces) instead of
        // URLSearchParams (which produces "+" for spaces, breaking Office Forms pre-fill)
        const encodedUrl  = encodeURIComponent(pageUrl);
        const encodedName = encodeURIComponent(policyName);
        const encodedDate = encodeURIComponent(`"${futureDate}"`);
        return `${FORM_BASE_URL}&${PARAM_PAGE_URL}=${encodedUrl}&${PARAM_POLICY_NAME}=${encodedName}&${PARAM_EXPIRY_DATE}=${encodedDate}`;
    }

    /* ==========================================================
     *  MODAL
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('policy-form-opener-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'policy-form-opener-modal';
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
        title.textContent = '🗑️ Policy Deletion Reminder';
        modal.appendChild(title);

        // ── Read-only preview rows ────────────────────────────
        function makeRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';

            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            Object.assign(lbl.style, {
                display:      'block',
                fontWeight:   'bold',
                fontSize:     '12px',
                color:        '#555',
                marginBottom: '4px'
            });

            const val = document.createElement('input');
            val.id          = valueId;
            val.type        = 'text';
            val.readOnly    = true;
            val.placeholder = placeholder;
            Object.assign(val.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box'
            });

            wrap.appendChild(lbl);
            wrap.appendChild(val);
            return wrap;
        }

        modal.appendChild(makeRow('Policy Page URL', 'pfop-page-url', 'Not found'));
        modal.appendChild(makeRow('Policy Name', 'pfop-policy-name', 'Not found — open a policy first'));
        modal.appendChild(makeRow(`Deletion Reminder Date (+${DAYS_OFFSET} days)`, 'pfop-expiry-date', ''));

        // ── Status message ────────────────────────────────────
        const status = document.createElement('div');
        status.id = 'pfop-status';
        Object.assign(status.style, {
            fontSize:  '12px',
            color:     '#c0392b',
            textAlign: 'center',
            minHeight: '16px'
        });
        modal.appendChild(status);

        // ── Open Form button ──────────────────────────────────
        const btnOpen = document.createElement('button');
        btnOpen.id          = 'pfop-open-btn';
        btnOpen.textContent = '🗓️ Register Deletion Reminder';
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
        const modal = document.getElementById('policy-form-opener-modal');
        if (!modal) {
            console.error('❌ Policy Deletion Reminder modal not found!');
            return;
        }

        const pageUrl    = getPageUrl();
        const policyName = getPolicyName();
        const expiryDate = getFutureDate();

        document.getElementById('pfop-page-url').value    = pageUrl;
        document.getElementById('pfop-policy-name').value = policyName ?? '';
        document.getElementById('pfop-expiry-date').value = expiryDate;

        // Show a warning if something is missing
        const status = document.getElementById('pfop-status');
        const btn    = document.getElementById('pfop-open-btn');

        if (!policyName) {
            status.textContent = '⚠️ Policy Name not found — the field may be empty.';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor  = 'not-allowed';
        } else {
            status.textContent = '';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor  = 'pointer';
        }

        modal.style.display = 'flex';
    }

    /* ==========================================================
     *  OPEN FORM
     * ==========================================================*/

    function openForm() {
        const pageUrl    = getPageUrl();
        const policyName = getPolicyName();

        if (!policyName) {
            document.getElementById('pfop-status').textContent =
                '❌ Cannot open form — Policy Name is missing.';
            return;
        }

        const url = buildFormUrl(pageUrl, policyName, getFutureDate());
        console.log(`🔗 Opening form: ${url}`);

        GM_openInTab(url, { active: true, insert: true });

        // Close the modal after opening
        const modal = document.getElementById('policy-form-opener-modal');
        if (modal) modal.style.display = 'none';
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ Policy Deletion Reminder already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Policy Deletion Reminder: Max registration attempts reached. Toolbar may not be available.');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Policy Deletion Reminder registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found, registering Policy Deletion Reminder...');

            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id:       TOOL_ID,
                    icon:     toolIcon,
                    tooltip:  TOOL_TOOLTIP,
                    position: TOOL_POSITION
                }
            }));

            isRegistered = true;
            console.log('✅ Policy Deletion Reminder registered successfully!');
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
            console.log('🗑️ Policy Deletion Reminder clicked!');
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
            console.log('Policy Deletion Reminder already initialized');
            return;
        }

        console.log('Initializing Policy Deletion Reminder...');
        isInitialized = true;
        initializeModal();
        console.log('✅ Policy Deletion Reminder modal ready!');

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