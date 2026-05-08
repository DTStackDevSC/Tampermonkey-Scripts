// ==UserScript==
// @name         |Toolbar| Policy Deletion Reminder
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyDeletionScheduler.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyDeletionScheduler.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0
// @description  Registers a policy deletion reminder by opening a pre-filled form with the policy URL, name, and expiry date - Integrated with Toolbar
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('🗑️ Policy Deletion Reminder loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0';
    const CHANGELOG = `Version 1.0:
- Added version tracking and changelog system with collapsible version cards.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 0.9.1:
- Initial release.`;

    function getStoredVersion()    { return GM_getValue('pdrVersion', null); }
    function saveVersion(v)        { GM_setValue('pdrVersion', v); }
    function hasSeenChangelog()    { return GM_getValue('pdrChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue('pdrChangelogSeen', SCRIPT_VERSION); }

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
        if (document.getElementById('pdr-changelog-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pdr-changelog-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000',
        });

        const modal = document.createElement('div');
        modal.id = 'pdr-changelog-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '1000001',
            background:   '#ffffff',
            border:       '2px solid #333333',
            borderRadius: '10px',
            padding:      '20px',
            boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '520px',
            width:        '90vw',
            maxHeight:    '80vh',
            overflowY:    'auto',
            color:        '#333333',
            boxSizing:    'border-box',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New — v${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            marginTop:     '0', marginBottom: '15px',
            color:         '#333333',
            borderBottom:  '2px solid #667eea',
            paddingBottom: '10px',
            fontSize:      '18px', fontWeight: 'bold',
            fontFamily:    'Arial, sans-serif',
        });

        const info = document.createElement('div');
        info.textContent = `You've been updated to v${SCRIPT_VERSION}!`;
        Object.assign(info.style, {
            background:   '#f0f4ff',
            color:        '#333333',
            padding:      '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            borderLeft:   '4px solid #667eea',
            fontFamily:   'Arial, sans-serif',
            fontSize:     '13px',
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
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding:    '9px 12px',
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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Got it!';
        Object.assign(closeBtn.style, {
            display: 'block', marginTop: '15px',
            padding: '10px 20px', background: '#667eea', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontFamily: 'Arial, sans-serif', fontSize: '14px',
            boxSizing: 'border-box',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#5568d3'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#667eea'; });
        closeBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            const notif = document.getElementById('pdr-changelog-notif');
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

        // ── Footer: version + changelog badge ────────────────
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginTop:      '8px',
            paddingTop:     '8px',
            borderTop:      '1px solid #e0e0e0',
        });

        const versionLabel = document.createElement('span');
        Object.assign(versionLabel.style, { fontSize: '11px', color: '#999', fontFamily: 'Arial, sans-serif' });
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        footer.appendChild(versionLabel);

        if (isNewVersion() && !hasSeenChangelog()) {
            const notif = document.createElement('span');
            notif.id = 'pdr-changelog-notif';
            Object.assign(notif.style, {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
            });
            notif.addEventListener('mouseenter', () => { notif.style.backgroundColor = '#e0e0e0'; });
            notif.addEventListener('mouseleave', () => { notif.style.backgroundColor = 'transparent'; });

            const dot = document.createElement('span');
            Object.assign(dot.style, {
                display: 'inline-block', width: '8px', height: '8px',
                borderRadius: '50%', background: '#007bff', flexShrink: '0',
            });
            let dotBlue = true;
            setInterval(() => {
                dotBlue = !dotBlue;
                dot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);

            const notifText = document.createElement('span');
            notifText.textContent = "What's new";
            Object.assign(notifText.style, {
                fontSize: '11px', color: '#0066cc', textDecoration: 'underline',
                fontFamily: 'Arial, sans-serif', fontWeight: 'normal',
            });

            notif.appendChild(dot);
            notif.appendChild(notifText);
            notif.onclick = showChangelogModal;
            footer.appendChild(notif);
        }

        modal.appendChild(footer);

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
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOLBAR_DOT_CLASS = 'pdr-notif-dot';

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
                position:      'absolute',
                top:           '2px', right: '2px',
                width:         '8px', height: '8px',
                borderRadius:  '50%',
                background:    '#007bff',
                pointerEvents: 'none',
                zIndex:        '10',
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
            addToolbarNotificationDot();
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