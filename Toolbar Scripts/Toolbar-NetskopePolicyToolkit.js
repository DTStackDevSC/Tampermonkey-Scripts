// ==UserScript==
// @name         |Toolbar| Netskope Policies Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.18
// @description  Copy buttons, DLP profile open buttons, SMTP auto-fill, Save reminder checklist, description log entry tools, URL list history, and DLP entity character counter. Integrated with Toolbar v2.
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('🔧 NS Policies Toolkit loading...');

    // ─────────────────────────────────────────────────────────────
    // SETTINGS  (persisted via GM storage)
    // ─────────────────────────────────────────────────────────────

    const SETTING_KEYS = {
        copyButtons:     'toolkit_copyButtons',
        openButtons:     'toolkit_openButtons',
        smtpAutofill:    'toolkit_smtpAutofill',
        saveReminder:    'toolkit_saveReminder',
        descriptionLog:  'toolkit_descriptionLog',
        urlListHistory:  'toolkit_urlListHistory',
        sslDomainLog:    'toolkit_sslDomainLog',
        dlpCharCounter:  'toolkit_dlpCharCounter',
    };

    function getSetting(key)        { return GM_getValue(SETTING_KEYS[key], true); }
    function setSetting(key, value) { GM_setValue(SETTING_KEYS[key], value); }

    // ─────────────────────────────────────────────────────────────
    // VERSION CONTROL & CHANGELOG
    // ─────────────────────────────────────────────────────────────

    const SCRIPT_VERSION = '1.18';
    const CHANGELOG = `Version 1.18:
- Fixed dark mode compatibility: all toolkit modals now force light backgrounds and
  dark text via injected CSS with !important so ServiceNow dark mode cannot override
  script UI inputs, selects, and textareas.

Version 1.17:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and the changelog hasn't been seen yet.

Version 1.16:
- Added DLP Entity Character Counter feature - shows a live character count
  below the regex/keyword input field in the DLP Edit Entity modal.
- Feature can be toggled on/off from the toolkit settings like all others.`;

    function getStoredVersion()    { return GM_getValue('toolkit_version', null); }
    function saveVersion(v)        { GM_setValue('toolkit_version', v); }
    function hasSeenChangelog()    { return GM_getValue('toolkit_changelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue('toolkit_changelogSeen', SCRIPT_VERSION); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const a = p1[i] || 0, b = p2[i] || 0;
            if (b > a) return true;
            if (b < a) return false;
        }
        return false;
    }

    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

    // ─────────────────────────────────────────────────────────────
    // CHANGELOG MODAL — 100% inline styles, no stylesheet dependency
    // ─────────────────────────────────────────────────────────────

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
        if (document.getElementById('nsToolkitChangelogModal')) return;

        /* ── Overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'nsToolkitChangelogOverlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0',
            left:       '0',
            width:      '100%',
            height:     '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex:     '1000000',
        });

        /* ── Modal card ── */
        const modal = document.createElement('div');
        modal.id = 'nsToolkitChangelogModal';
        Object.assign(modal.style, {
            position:        'fixed',
            top:             '50%',
            left:            '50%',
            transform:       'translate(-50%, -50%)',
            zIndex:          '1000001',
            background:      '#ffffff',
            border:          '2px solid #333333',
            padding:         '20px',
            boxShadow:       '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily:      'Arial, sans-serif',
            borderRadius:    '10px',
            maxWidth:        '600px',
            width:           '90vw',
            maxHeight:       '80vh',
            overflowY:       'auto',
            color:           '#333333',
            boxSizing:       'border-box',
        });

        /* ── Title ── */
        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            marginTop:      '0',
            marginBottom:   '15px',
            color:          '#333333',
            borderBottom:   '2px solid #667eea',
            paddingBottom:  '10px',
            fontFamily:     'Arial, sans-serif',
            fontSize:       '18px',
            fontWeight:     'bold',
        });

        /* ── Version banner ── */
        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa',
            color:           '#333333',
            padding:         '10px',
            borderRadius:    '5px',
            marginBottom:    '15px',
            borderLeft:      '4px solid #667eea',
            fontFamily:      'Arial, sans-serif',
            fontSize:        '13px',
            fontWeight:      'normal',
        });

        /* ── Version cards ── */
        const cardsContainer = document.createElement('div');
        cardsContainer.style.marginBottom = '0';

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
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '9px 12px',
                background:     isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor:         'pointer',
                userSelect:     'none',
            });

            const versionWrap = document.createElement('div');
            Object.assign(versionWrap.style, { display: 'flex', alignItems: 'center', gap: '8px' });

            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold',
                fontSize:   '13px',
                color:      isLatest ? '#667eea' : '#555',
                fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);

            if (isLatest) {
                const latestTag = document.createElement('span');
                latestTag.textContent = 'Latest';
                Object.assign(latestTag.style, {
                    fontSize:     '10px',
                    fontWeight:   'bold',
                    background:   '#667eea',
                    color:        '#fff',
                    borderRadius: '3px',
                    padding:      '1px 6px',
                    fontFamily:   'Arial, sans-serif',
                });
                versionWrap.appendChild(latestTag);
            }

            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize:   '12px',
                color:      '#999',
                transition: 'transform 0.2s',
                display:    'inline-block',
                transform:  isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });

            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);

            const body = document.createElement('div');
            Object.assign(body.style, {
                padding:    isLatest ? '10px 14px' : '0',
                display:    isLatest ? 'block' : 'none',
                background: '#fff',
            });

            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display:    'flex',
                    gap:        '8px',
                    padding:    '3px 0',
                    fontSize:   '13px',
                    fontFamily: 'Arial, sans-serif',
                    color:      '#444',
                    lineHeight: '1.5',
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

            cardsContainer.appendChild(card);
        });

        /* ── Close button ── */
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            display:         'block',
            marginTop:       '15px',
            padding:         '10px 20px',
            backgroundColor: '#667eea',
            color:           '#ffffff',
            border:          'none',
            borderRadius:    '5px',
            cursor:          'pointer',
            fontWeight:      'bold',
            width:           '100%',
            fontFamily:      'Arial, sans-serif',
            fontSize:        '14px',
            boxSizing:       'border-box',
        });
        closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#5568d3'; });
        closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = '#667eea'; });
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            const notification = document.getElementById('nsToolkitChangelogNotification');
            if (notification) notification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsContainer);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeButton.click();
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'nstk-notif-dot';

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
                top:           '2px',
                right:         '2px',
                width:         '8px',
                height:        '8px',
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

    // ─────────────────────────────────────────────────────────────
    // DARK MODE ISOLATION
    // ─────────────────────────────────────────────────────────────
    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        #ns-toolkit-settings-modal, #ns-save-reminder-modal,
        #ns-add-log-modal, #ns-view-log-modal,
        #ns-remove-older-confirm, #ns-ssl-removal-modal,
        #ns-url-log-add-modal, #ns-url-del-modal, #ns-url-log-view-modal,
        #ns-username-overlay, #nsToolkitChangelogModal {
            color: #333333 !important;
        }
        #ns-toolkit-settings-modal input, #ns-toolkit-settings-modal select,
        #ns-toolkit-settings-modal textarea,
        #ns-add-log-modal input, #ns-add-log-modal select,
        #ns-add-log-modal textarea,
        #ns-ssl-removal-modal input, #ns-ssl-removal-modal select,
        #ns-ssl-removal-modal textarea,
        #ns-url-log-add-modal input, #ns-url-log-add-modal select,
        #ns-url-log-add-modal textarea,
        #ns-url-del-modal input, #ns-url-del-modal select,
        #ns-url-del-modal textarea,
        #ns-username-overlay input, #ns-username-overlay select,
        #ns-username-overlay textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(darkModeStyle);

    // TOOLBAR REGISTRATION
    // ─────────────────────────────────────────────────────────────

    const TOOL_ID = 'nsDlpToolkit';

    let isInitialized = false;
    let isRegistered  = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY  = 500;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 3v4h2V8h-2zm0 6v2h2v-2h-2z"/>
    </svg>`;

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ NS Toolkit: max registration attempts reached');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 NS Toolkit registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'NS Policies Toolkit', position: 5 }
            }));
            isRegistered = true;
            console.log('✅ NS Toolkit registered in toolbar');
            addToolbarNotificationDot();
        } else {
            console.log(`⏳ Toolbar not ready, retrying…`);
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    document.addEventListener('toolbarReady', () => {
        console.log('✅ toolbarReady received');
        attemptRegistration();
    });

    document.addEventListener('toolbarToolClicked', (e) => {
        if (e.detail.id === TOOL_ID) {
            console.log('🔧 NS Toolkit toolbar button clicked');
            showSettingsModal();
        }
    });

    // ─────────────────────────────────────────────────────────────
    // SETTINGS MODAL
    // ─────────────────────────────────────────────────────────────

    const MODAL_ID = 'ns-toolkit-settings-modal';

    const FEATURES = [
        {
            key:         'copyButtons',
            label:       '📋 Chirp Copy Buttons',
            description: 'Adds a copy button to every blue tag in policy pickers so you can quickly copy the profile name.',
        },
        {
            key:         'openButtons',
            label:       '↗ DLP Profile Open Buttons',
            description: 'Adds an open-in-new-tab button to tags inside "DLP Profile =" criteria sections.',
        },
        {
            key:         'smtpAutofill',
            label:       '✉ SMTP Header Auto-Fill',
            description: 'Injects a "Fill with Block Headers" button next to "Add SMTP Header" action triggers.',
        },
        {
            key:         'saveReminder',
            label:       '💾 Save Reminder Checklist',
            description: 'Intercepts the Save button on policy pages and shows a reminder to add RITM number, creator name & date, and editor name & modification date.',
        },
        {
            key:         'descriptionLog',
            label:       '📝 Description Log Buttons',
            description: 'Adds "Add Log Entry" and "View Log" buttons below the policy description textarea for structured change tracking (RITM | Date | User | Description).',
        },
        {
            key:         'urlListHistory',
            label:       '📜 URL List History Buttons',
            description: 'On URL list edit pages, adds "+ Log Entry", "Delete Selected", and "View History" buttons. Log format: #RITM | Date | Name. Deleted domains are commented out.',
        },
        {
            key:         'sslDomainLog',
            label:       '🔒 SSL Decryption Removal Entry Button',
            description: 'On SSL Decryption policy pages, adds an "+ Add Removal Entry" button alongside the description log buttons. Inserts a #RITM | Date | Name | Removed marker at cursor. Also adapts the "Add Log Entry" modal label to "Domain Changes".',
        },
        {
            key:         'dlpCharCounter',
            label:       '🔢 DLP Entity Character Counter',
            description: 'Adds a live character count below the regex/keyword input field in the DLP Edit Entity modal.',
        },
    ];

    function buildSettingsModal() {
        if (document.getElementById(MODAL_ID)) return;

        /* ── Backdrop ── */
        const backdrop = document.createElement('div');
        backdrop.id = MODAL_ID + '-backdrop';
        Object.assign(backdrop.style, {
            position:       'fixed',
            inset:          '0',
            background:     'rgba(0,0,0,0.35)',
            zIndex:         '999997',
            display:        'none',
            alignItems:     'center',
            justifyContent: 'center',
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) hideSettingsModal();
        });

        /* ── Modal card (flex column so header/footer stay pinned while body scrolls) ── */
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        Object.assign(modal.style, {
            position:      'relative',
            background:    '#f9f9f9',
            border:        '1px solid #ccc',
            boxShadow:     '0 4px 24px rgba(0,0,0,0.18)',
            borderRadius:  '10px',
            zIndex:        '999998',
            fontFamily:    'Arial, sans-serif',
            minWidth:      '420px',
            maxWidth:      '520px',
            width:         '100%',
            maxHeight:     '90vh',
            display:       'flex',
            flexDirection: 'column',
            boxSizing:     'border-box',
        });

        /* ── Header row (pinned, not scrolled) ── */
        const headerRow = document.createElement('div');
        Object.assign(headerRow.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '12px 14px 10px',
            borderBottom:   '1px solid #e0e0e0',
            flexShrink:     '0',
        });

        const titleEl = document.createElement('div');
        Object.assign(titleEl.style, { fontSize: '12px', fontWeight: 'bold', color: '#333' });
        titleEl.textContent = '🛡 NS Policies Toolkit — Feature Settings';
        headerRow.appendChild(titleEl);

        /* ── Close button ── */
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background:   '#e53935',
            color:        '#fff',
            border:       'none',
            borderRadius: '4px',
            cursor:       'pointer',
            padding:      '4px 9px',
            fontWeight:   'bold',
            fontSize:     '13px',
            flexShrink:   '0',
        });
        closeBtn.addEventListener('click', hideSettingsModal);
        headerRow.appendChild(closeBtn);
        modal.appendChild(headerRow);

        /* ── Scrollable body ── */
        const scrollBody = document.createElement('div');
        scrollBody.id = MODAL_ID + '-body';
        Object.assign(scrollBody.style, {
            overflowY: 'auto',
            flex:      '1',
            padding:   '16px 24px',
        });
        modal.appendChild(scrollBody);

        /* ── Subtitle ── */
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Toggle features on or off. Changes take effect immediately and are saved across sessions.';
        Object.assign(subtitle.style, {
            fontSize:   '12px',
            color:      '#666',
            margin:     '0 0 14px',
            lineHeight: '1.5',
        });
        scrollBody.appendChild(subtitle);

        /* ── Your Name config row ── */
        const nameRow = document.createElement('div');
        Object.assign(nameRow.style, {
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            background:   '#fff',
            border:       '1px solid #e0e0e0',
            borderRadius: '8px',
            padding:      '10px 14px',
            marginBottom: '14px',
        });

        const nameIcon = document.createElement('span');
        nameIcon.textContent = '👤';
        Object.assign(nameIcon.style, { fontSize: '16px', flexShrink: '0' });
        nameRow.appendChild(nameIcon);

        const nameLabelEl = document.createElement('div');
        Object.assign(nameLabelEl.style, { fontWeight: 'bold', fontSize: '13px', color: '#222', flexShrink: '0' });
        nameLabelEl.textContent = 'Your Name';
        nameRow.appendChild(nameLabelEl);

        const nameInput = document.createElement('input');
        nameInput.type        = 'text';
        nameInput.placeholder = 'Your full name';
        nameInput.value       = GM_getValue('toolkit_username', '');
        nameInput.id          = MODAL_ID + '-name-input';
        Object.assign(nameInput.style, {
            flex:         '1',
            padding:      '5px 8px',
            border:       '1px solid #ccc',
            borderRadius: '4px',
            fontSize:     '13px',
            fontFamily:   'Arial, sans-serif',
            boxSizing:    'border-box',
        });
        nameRow.appendChild(nameInput);

        const nameSaveBtn = document.createElement('button');
        nameSaveBtn.textContent = 'Save';
        Object.assign(nameSaveBtn.style, {
            padding:      '5px 12px',
            background:   '#1a73e8',
            color:        '#fff',
            border:       'none',
            borderRadius: '4px',
            cursor:       'pointer',
            fontSize:     '12px',
            fontWeight:   'bold',
            flexShrink:   '0',
        });
        nameSaveBtn.addEventListener('mouseenter', () => { nameSaveBtn.style.background = '#1558b0'; });
        nameSaveBtn.addEventListener('mouseleave', () => { nameSaveBtn.style.background = '#1a73e8'; });
        nameSaveBtn.addEventListener('click', () => {
            const n = nameInput.value.trim();
            if (!n) { nameInput.style.borderColor = '#e53935'; nameInput.focus(); return; }
            nameInput.style.borderColor = '#ccc';
            GM_setValue('toolkit_username', n);
            nameSaveBtn.textContent = '✓';
            nameSaveBtn.style.background = '#4caf50';
            setTimeout(() => { nameSaveBtn.textContent = 'Save'; nameSaveBtn.style.background = '#1a73e8'; }, 1500);
        });
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameSaveBtn.click(); });
        nameRow.appendChild(nameSaveBtn);
        scrollBody.appendChild(nameRow);

        /* ── Helper: build a single feature toggle row ── */
        function buildFeatureRow({ key, label, description }, indented) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '14px',
                background:   '#fff',
                border:       '1px solid #e0e0e0',
                borderRadius: '8px',
                padding:      '12px 14px',
                marginBottom: '8px',
                cursor:       'pointer',
                transition:   'border-color 0.15s',
                ...(indented ? { marginLeft: '18px' } : {}),
            });

            const toggleWrapper = document.createElement('div');
            Object.assign(toggleWrapper.style, { flexShrink: '0', marginTop: '2px' });

            const toggle = document.createElement('input');
            toggle.type    = 'checkbox';
            toggle.id      = `toolkit-toggle-${key}`;
            toggle.checked = getSetting(key);
            Object.assign(toggle.style, {
                width: '36px', height: '20px',
                cursor: 'pointer', accentColor: '#1a73e8',
            });

            toggle.addEventListener('change', () => {
                setSetting(key, toggle.checked);
                updateRowStyle(row, toggle.checked);
                console.log(`[NS Toolkit] ${key} → ${toggle.checked}`);
                if (!toggle.checked) {
                    if (key === 'copyButtons')    removeAll('.dlp-copy-btn');
                    if (key === 'openButtons')    removeAll('.dlp-open-btn');
                    if (key === 'smtpAutofill')   removeAll('#' + SMTP_BTN_ID);
                    if (key === 'descriptionLog') {
                        removeAll('.' + LOG_BTN_CONTAINER_CLASS);
                        document.querySelectorAll('[data-nstk-log-injected]').forEach(ta => {
                            delete ta.dataset.nstkLogInjected;
                        });
                    }
                    if (key === 'urlListHistory') {
                        removeAll('.' + URL_LIST_BTN_CONTAINER_CLASS);
                        document.querySelectorAll('[data-nstk-url-log-injected]').forEach(ta => {
                            delete ta.dataset.nstkUrlLogInjected;
                        });
                    }
                    if (key === 'sslDomainLog') {
                        // Clear description log containers so they re-inject with/without the removal button
                        removeAll('.' + LOG_BTN_CONTAINER_CLASS);
                        document.querySelectorAll('[data-nstk-log-injected]').forEach(ta => {
                            delete ta.dataset.nstkLogInjected;
                        });
                        injectDescriptionLogButtons();
                    }
                    if (key === 'dlpCharCounter') {
                        removeAll('.char-counter');
                        document.querySelectorAll('[data-counter-added]').forEach(el => {
                            delete el.dataset.counterAdded;
                        });
                    }
                }
                showReloadNotice();
            });

            toggleWrapper.appendChild(toggle);
            row.appendChild(toggleWrapper);

            const textBlock = document.createElement('div');

            const featureLabel = document.createElement('div');
            featureLabel.textContent = label;
            Object.assign(featureLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: '#222', marginBottom: '3px',
            });

            const featureDesc = document.createElement('div');
            featureDesc.textContent = description;
            Object.assign(featureDesc.style, {
                fontSize: '12px', color: '#666', lineHeight: '1.4',
            });

            textBlock.appendChild(featureLabel);
            textBlock.appendChild(featureDesc);
            row.appendChild(textBlock);

            row.addEventListener('click', (e) => { if (e.target !== toggle) toggle.click(); });

            updateRowStyle(row, toggle.checked);
            return row;
        }

        /* ── Standalone feature rows ── */
        const STANDALONE_KEYS = ['copyButtons', 'openButtons', 'smtpAutofill', 'saveReminder', 'dlpCharCounter'];
        FEATURES.filter(f => STANDALONE_KEYS.includes(f.key)).forEach(f => {
            scrollBody.appendChild(buildFeatureRow(f, false));
        });

        /* ── Log Buttons category (collapsible) ── */
        const LOG_KEYS = ['descriptionLog', 'urlListHistory', 'sslDomainLog'];
        const logFeatures = FEATURES.filter(f => LOG_KEYS.includes(f.key));

        const logCatRow = document.createElement('div');
        Object.assign(logCatRow.style, {
            display:    'flex',
            alignItems: 'center',
            gap:        '10px',
            background: '#eef2ff',
            border:     '1px solid #c5cae9',
            borderRadius: '8px',
            padding:    '9px 14px',
            marginBottom: '8px',
            cursor:     'pointer',
            userSelect: 'none',
        });

        const logCatIcon = document.createElement('span');
        logCatIcon.textContent = '📋';
        Object.assign(logCatIcon.style, { fontSize: '15px', flexShrink: '0' });
        logCatRow.appendChild(logCatIcon);

        const logCatTextWrap = document.createElement('div');
        Object.assign(logCatTextWrap.style, { flex: '1' });

        const logCatLabel = document.createElement('div');
        Object.assign(logCatLabel.style, { fontWeight: 'bold', fontSize: '13px', color: '#3949ab' });
        logCatLabel.textContent = 'Log Buttons';

        const logCatDesc = document.createElement('div');
        Object.assign(logCatDesc.style, { fontSize: '11px', color: '#7986cb', marginTop: '1px' });
        logCatDesc.textContent = 'Description log, URL list history, SSL removal entry';

        logCatTextWrap.appendChild(logCatLabel);
        logCatTextWrap.appendChild(logCatDesc);
        logCatRow.appendChild(logCatTextWrap);

        const chevron = document.createElement('span');
        Object.assign(chevron.style, {
            fontSize: '12px', color: '#7986cb',
            transition: 'transform 0.2s', display: 'inline-block',
        });
        chevron.textContent = '▾';
        logCatRow.appendChild(chevron);
        scrollBody.appendChild(logCatRow);

        /* ── Log sub-features container ── */
        const logSubContainer = document.createElement('div');
        Object.assign(logSubContainer.style, { marginBottom: '4px' });
        logFeatures.forEach(f => logSubContainer.appendChild(buildFeatureRow(f, true)));
        scrollBody.appendChild(logSubContainer);

        let logExpanded = true;
        logCatRow.addEventListener('click', () => {
            logExpanded = !logExpanded;
            logSubContainer.style.display = logExpanded ? 'block' : 'none';
            chevron.style.transform = logExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        });

        /* ── Footer: version label + changelog badge (pinned) ── */
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '10px 24px 14px',
            borderTop:      '1px solid #e0e0e0',
            flexShrink:     '0',
        });

        const versionLabel = document.createElement('span');
        Object.assign(versionLabel.style, {
            fontSize: '11px', color: '#999', fontFamily: 'Arial, sans-serif',
        });
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        footer.appendChild(versionLabel);

        // Changelog badge — fully inline styled, no stylesheet dependency
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'nsToolkitChangelogNotification';
            Object.assign(changelogNotification.style, {
                display:    'inline-flex',
                alignItems: 'center',
                gap:        '6px',
                cursor:     'pointer',
                padding:    '3px 8px',
                borderRadius: '4px',
            });
            changelogNotification.addEventListener('mouseenter', () => {
                changelogNotification.style.backgroundColor = '#e0e0e0';
            });
            changelogNotification.addEventListener('mouseleave', () => {
                changelogNotification.style.backgroundColor = 'transparent';
            });

            const notifDot = document.createElement('span');
            Object.assign(notifDot.style, {
                display:      'inline-block',
                width:        '8px',
                height:       '8px',
                borderRadius: '50%',
                background:   '#007bff',
                flexShrink:   '0',
            });
            // Simple pulse via setInterval since CSS animation may be blocked
            let dotBlue = true;
            setInterval(() => {
                dotBlue = !dotBlue;
                notifDot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);

            const notifText = document.createElement('span');
            notifText.textContent = "What's new";
            Object.assign(notifText.style, {
                fontSize:       '11px',
                color:          '#0066cc',
                textDecoration: 'underline',
                fontFamily:     'Arial, sans-serif',
                fontWeight:     'normal',
            });

            changelogNotification.appendChild(notifDot);
            changelogNotification.appendChild(notifText);
            changelogNotification.onclick = () => showChangelogModal();

            footer.appendChild(changelogNotification);
        }

        modal.appendChild(footer);

        backdrop.appendChild(modal);
        // Append to document.body — same as working Ticket Assignment script
        document.body.appendChild(backdrop);
    }

    function updateRowStyle(row, enabled) {
        row.style.borderColor = enabled ? '#1a73e8' : '#e0e0e0';
        row.style.background  = enabled ? '#f0f6ff' : '#fff';
        row.style.opacity     = enabled ? '1'       : '0.7';
    }

    function showSettingsModal() {
        buildSettingsModal(); // idempotent

        // Sync checkboxes to current GM values (may have changed in another tab)
        FEATURES.forEach(({ key }) => {
            const toggle = document.getElementById(`toolkit-toggle-${key}`);
            if (toggle) {
                toggle.checked = getSetting(key);
                const row = toggle.closest('div[style]');
                if (row) updateRowStyle(row, toggle.checked);
            }
        });

        // Sync username input
        const nameInput = document.getElementById(MODAL_ID + '-name-input');
        if (nameInput) nameInput.value = GM_getValue('toolkit_username', '');

        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'flex';
    }

    function hideSettingsModal() {
        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    }

    function removeAll(selector) {
        document.querySelectorAll(selector).forEach(el => el.remove());
    }

    // ─────────────────────────────────────────────────────────────
    // RELOAD NOTICE (persistent red bar inside modal)
    // ─────────────────────────────────────────────────────────────

    const NOTICE_ID = 'ns-toolkit-reload-notice';

    function showReloadNotice() {
        if (document.getElementById(NOTICE_ID)) return;

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        Object.assign(notice.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            '12px',
            background:     '#c62828',
            color:          '#fff',
            borderRadius:   '7px',
            padding:        '10px 14px',
            marginBottom:   '4px',
            fontSize:       '12px',
            fontWeight:     '600',
            lineHeight:     '1.4',
        });

        const msg = document.createElement('span');
        msg.textContent = '⚠️ Reload the page for changes to take effect.';
        notice.appendChild(msg);

        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = 'Reload now';
        Object.assign(reloadBtn.style, {
            background:   '#fff',
            color:        '#c62828',
            border:       'none',
            borderRadius: '5px',
            padding:      '4px 11px',
            fontSize:     '12px',
            fontWeight:   'bold',
            cursor:       'pointer',
            flexShrink:   '0',
        });
        reloadBtn.addEventListener('mouseenter', () => { reloadBtn.style.background = '#ffd7d7'; });
        reloadBtn.addEventListener('mouseleave', () => { reloadBtn.style.background = '#fff'; });
        reloadBtn.addEventListener('click', () => window.location.reload());
        notice.appendChild(reloadBtn);

        const scrollBody = document.getElementById(MODAL_ID + '-body');
        if (scrollBody) scrollBody.insertBefore(notice, scrollBody.firstElementChild);
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 1 — CHIRP COPY BUTTONS
    // ─────────────────────────────────────────────────────────────

    function addCopyButtons() {
        if (!getSetting('copyButtons')) return;

        document.querySelectorAll('.ns-picker-tag').forEach((tag) => {
            if (tag.querySelector('.dlp-copy-btn')) return;

            const labelSpan = tag.querySelector('.ng-value-label');
            if (!labelSpan) return;

            let profileName = labelSpan.textContent.trim();
            if (!profileName) return;
            profileName = profileName.replace(/\s*\((custom|predefined)\)\s*$/i, '').trim();

            const copyBtn = document.createElement('button');
            copyBtn.className = 'dlp-copy-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy profile name';
            copyBtn.style.cssText = `
                margin-left: 4px; padding: 1px 4px;
                border: 1px solid #ccc; border-radius: 3px;
                background: #f5f5f5; cursor: pointer;
                font-size: 11px; display: inline-block;
                vertical-align: middle; line-height: 1;
            `;

            copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = '#e0e0e0'; });
            copyBtn.addEventListener('mouseleave', () => { if (copyBtn.innerHTML === '📋') copyBtn.style.background = '#f5f5f5'; });

            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const finish = (ok) => {
                    copyBtn.innerHTML = ok ? '✓' : '✗';
                    copyBtn.style.background = ok ? '#4CAF50' : '#e53935';
                    copyBtn.style.color = 'white';
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.style.background = '#f5f5f5';
                        copyBtn.style.color = 'inherit';
                    }, 1500);
                };

                navigator.clipboard.writeText(profileName).then(() => finish(true)).catch(() => {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = profileName;
                        ta.style.cssText = 'position:fixed;left:-999999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        finish(true);
                    } catch {
                        finish(false);
                        alert('Failed to copy: ' + profileName);
                    }
                });
            });

            labelSpan.appendChild(copyBtn);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 2 — DLP PROFILE OPEN BUTTONS
    // ─────────────────────────────────────────────────────────────

    function addOpenButtons() {
        if (!getSetting('openButtons')) return;

        document.querySelectorAll('.criteria-title').forEach(titleNode => {
            if (titleNode.textContent.trim() !== 'DLP Profile =') return;

            const ngSelect = titleNode.closest('.ng-select-container');
            if (!ngSelect) return;

            ngSelect.querySelectorAll('.ns-picker-tag').forEach((tag) => {
                if (tag.querySelector('.dlp-open-btn')) return;

                const labelSpan = tag.querySelector('.ng-value-label');
                if (!labelSpan) return;

                let profileName = labelSpan.getAttribute('title') || labelSpan.textContent.trim();
                if (!profileName) return;
                const cleanName = profileName.replace(/\s*\((custom|predefined)\)\s*$/i, '').trim();

                const openBtn = document.createElement('button');
                openBtn.className = 'dlp-open-btn';
                openBtn.innerHTML = '↗';
                openBtn.title = 'Open profile in new tab';
                openBtn.style.cssText = `
                    margin-left: 6px; padding: 2px 5px;
                    border: 1px solid #ccc; border-radius: 3px;
                    background: #f5f5f5; cursor: pointer;
                    font-size: 12px; display: inline-block;
                    vertical-align: middle; line-height: 1;
                `;

                openBtn.addEventListener('mouseenter', () => { openBtn.style.background = '#e0e0e0'; });
                openBtn.addEventListener('mouseleave', () => { if (openBtn.innerHTML === '↗') openBtn.style.background = '#f5f5f5'; });

                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const url = `${window.location.origin}/ns#/profiles?profile_name=${encodeURIComponent(cleanName)}`;
                    window.open(url, '_blank');

                    openBtn.innerHTML = '✓';
                    openBtn.style.background = '#4CAF50';
                    openBtn.style.color = 'white';
                    setTimeout(() => {
                        openBtn.innerHTML = '↗';
                        openBtn.style.background = '#f5f5f5';
                        openBtn.style.color = 'inherit';
                    }, 1000);
                });

                labelSpan.insertAdjacentElement('afterend', openBtn);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 3 — SMTP HEADER AUTO-FILL
    // ─────────────────────────────────────────────────────────────

    const SMTP_HEADERS = `X-Netskope-Action: Block\nX-Netskope-Policy: {{NS_DLP_PROFILE}}`;
    const SMTP_BTN_ID  = 'smtp-autofill-btn';

    function getSmtpTrigger() {
        return [...document.querySelectorAll('a.trigger')].find(el =>
            el.textContent.includes('Add SMTP Header')
        );
    }

    function setAngularValue(textarea, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, value);
        textarea.dispatchEvent(new Event('input',  { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function checkSmtp() {
        const triggerEl = getSmtpTrigger();
        const existing  = document.getElementById(SMTP_BTN_ID);

        if (!getSetting('smtpAutofill') || !triggerEl) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const btn = document.createElement('button');
        btn.id = SMTP_BTN_ID;
        btn.textContent = 'Fill with Block Headers';
        btn.title = 'Auto-fill standard Netskope SMTP headers';
        btn.style.cssText = `
            padding: 4px 10px; border: 1px solid #0073e6;
            border-radius: 4px; background: #0073e6;
            color: #fff; cursor: pointer; font-size: 12px;
            font-weight: 600; vertical-align: middle;
            line-height: 1.4; transition: background 0.15s;
        `;

        btn.addEventListener('mouseenter', () => { btn.style.background = '#005bb5'; });
        btn.addEventListener('mouseleave', () => { if (!btn.dataset.success) btn.style.background = '#0073e6'; });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const textarea = document.querySelector('textarea.policy-description-container.ns-form-textarea');
            if (!textarea) {
                alert('Could not find the SMTP header textarea. Make sure the panel is open.');
                return;
            }

            setAngularValue(textarea, SMTP_HEADERS);
            textarea.focus();

            btn.textContent = '✓ Filled!';
            btn.style.background = '#4CAF50';
            btn.dataset.success = '1';
            setTimeout(() => {
                btn.textContent = 'Fill with Block Headers';
                btn.style.background = '#0073e6';
                delete btn.dataset.success;
            }, 2000);
        });

        triggerEl.insertAdjacentElement('afterend', btn);
        console.log('[NS Toolkit] SMTP autofill button injected.');
    }


    // ─────────────────────────────────────────────────────────────
    // FEATURE 4 — SAVE REMINDER CHECKLIST
    // ─────────────────────────────────────────────────────────────

    let saveProceedFlag = false;

    function showSaveReminderModal(onProceed) {
        if (document.getElementById('ns-save-reminder-modal')) return;

        /* ── Overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'ns-save-reminder-overlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0', left: '0',
            width:      '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)',
            zIndex:     '2000000',
        });

        /* ── Modal ── */
        const modal = document.createElement('div');
        modal.id = 'ns-save-reminder-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '2000001',
            background:   '#ffffff',
            border:       '2px solid #e65100',
            borderRadius: '10px',
            padding:      '24px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '480px',
            width:        '90vw',
            boxSizing:    'border-box',
            color:        '#333333',
        });

        /* ── Title ── */
        const title = document.createElement('div');
        title.textContent = '💾 Before you save…';
        Object.assign(title.style, {
            fontSize:     '15px',
            fontWeight:   'bold',
            color:        '#e65100',
            marginBottom: '6px',
            fontFamily:   'Arial, sans-serif',
        });

        /* ── Subtitle ── */
        const subtitle = document.createElement('div');
        subtitle.textContent = 'Make sure the policy description includes the following:';
        Object.assign(subtitle.style, {
            fontSize:     '12px',
            color:        '#666',
            marginBottom: '16px',
            fontFamily:   'Arial, sans-serif',
        });

        /* ── Checklist ── */
        const items = [
            { icon: '🎫', text: 'RITM number' },
            { icon: '👤', text: 'Creator name & creation date' },
            { icon: '✏️',  text: 'Editor name & modification date' },
        ];

        const checklist = document.createElement('div');
        Object.assign(checklist.style, {
            display:       'flex',
            flexDirection: 'column',
            gap:           '8px',
            marginBottom:  '20px',
        });

        items.forEach(({ icon, text }) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                background:   '#fff8f0',
                border:       '1px solid #ffcc80',
                borderRadius: '6px',
                padding:      '9px 12px',
                fontSize:     '13px',
                fontFamily:   'Arial, sans-serif',
                color:        '#333',
            });

            const iconEl = document.createElement('span');
            iconEl.textContent = icon;
            Object.assign(iconEl.style, { fontSize: '16px', flexShrink: '0' });

            const label = document.createElement('span');
            label.textContent = text;
            Object.assign(label.style, { fontWeight: '500' });

            row.appendChild(iconEl);
            row.appendChild(label);
            checklist.appendChild(row);
        });

        /* ── Buttons ── */
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex', gap: '10px',
        });

        const goBackBtn = document.createElement('button');
        goBackBtn.textContent = '← Go back';
        Object.assign(goBackBtn.style, {
            flex:         '1',
            padding:      '10px',
            background:   '#e0e0e0',
            color:        '#333',
            border:       '1px solid #ccc',
            borderRadius: '6px',
            cursor:       'pointer',
            fontWeight:   'bold',
            fontSize:     '13px',
            fontFamily:   'Arial, sans-serif',
        });
        goBackBtn.addEventListener('mouseenter', () => { goBackBtn.style.background = '#d0d0d0'; });
        goBackBtn.addEventListener('mouseleave', () => { goBackBtn.style.background = '#e0e0e0'; });
        goBackBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save anyway →';
        Object.assign(saveBtn.style, {
            flex:         '1',
            padding:      '10px',
            background:   '#e65100',
            color:        '#fff',
            border:       'none',
            borderRadius: '6px',
            cursor:       'pointer',
            fontWeight:   'bold',
            fontSize:     '13px',
            fontFamily:   'Arial, sans-serif',
        });
        saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#bf360c'; });
        saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = '#e65100'; });
        saveBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            onProceed();
        };

        btnRow.appendChild(goBackBtn);
        btnRow.appendChild(saveBtn);

        /* ── Log-entry tip ── */
        const tip = document.createElement('div');
        Object.assign(tip.style, {
            display:      'flex',
            alignItems:   'flex-start',
            gap:          '8px',
            background:   '#e8f4fd',
            border:       '1px solid #90caf9',
            borderRadius: '6px',
            padding:      '9px 12px',
            marginBottom: '16px',
            fontSize:     '12px',
            lineHeight:   '1.5',
            color:        '#1a4f7a',
            fontFamily:   'Arial, sans-serif',
        });

        const tipIcon = document.createElement('span');
        tipIcon.textContent = '💡';
        Object.assign(tipIcon.style, { flexShrink: '0', fontSize: '14px' });

        const tipText = document.createElement('span');
        tipText.innerHTML = 'Use the <strong>+ Add Log Entry</strong> button below the policy description to quickly add the RITM, date, and your name in the correct format.';

        tip.appendChild(tipIcon);
        tip.appendChild(tipText);

        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(checklist);
        modal.appendChild(tip);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = (e) => { if (e.target === overlay) goBackBtn.click(); };
    }

    function isOnPolicyPage() {
        const hash = window.location.hash || '';
        return hash.includes('/inline-policy-page') || hash.includes('/endpoint-dlp-page');
    }

    // Returns true when the element lives inside a Netskope dialog/overlay
    // (e.g. the "where to place this policy" modal that appears after the first Save).
    function isInsideDialog(el) {
        return !!(
            el.closest('[role="dialog"]')   ||
            el.closest('.cdk-overlay-pane') ||
            el.closest('.ns-modal')         ||
            el.closest('.modal-dialog')
        );
    }

    function interceptSaveButtons() {
        if (!getSetting('saveReminder')) return;
        if (!isOnPolicyPage()) return;

        document.querySelectorAll('button.ns-btn.ns-btn-primary').forEach((btn) => {
            if (btn.dataset.nstkSaveIntercepted) return;
            if (!btn.textContent.trim().toLowerCase().includes('save')) return;
            // Skip Save buttons that belong to Netskope's own dialogs
            if (isInsideDialog(btn)) return;

            btn.dataset.nstkSaveIntercepted = '1';

            btn.addEventListener('click', (e) => {
                if (!getSetting('saveReminder')) return;
                if (!isOnPolicyPage()) return;
                if (saveProceedFlag) return;
                // Guard at click-time too, in case Angular moved the button into a dialog
                if (isInsideDialog(btn)) return;

                e.stopImmediatePropagation();
                e.preventDefault();

                showSaveReminderModal(() => {
                    saveProceedFlag = true;
                    btn.click();
                    setTimeout(() => { saveProceedFlag = false; }, 300);
                });
            }, true); // capture phase — fires before Angular's own handler

            console.log('[NS Toolkit] Save button intercepted.');
        });
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 5 — DESCRIPTION LOG ENTRY
    // ─────────────────────────────────────────────────────────────

    const LOG_BTN_CONTAINER_CLASS      = 'ns-log-btn-container';
    const URL_LIST_BTN_CONTAINER_CLASS = 'ns-url-log-btn-container';

    // Selectors that identify description textareas across Netskope pages:
    //   1. Specific class used on policy pages
    //   2. Exact ID used on Custom Categories page
    //   3. aria-label fallback for other pages (no class restriction)
    const DESCRIPTION_TA_SELECTORS = [
        'textarea.policy-description-container.ns-form-textarea',
        'textarea#category-description',
        'textarea[aria-label*="description" i]',
    ];

    function getTodayDate() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getDescriptionTextareas() {
        const seen = new Set();
        DESCRIPTION_TA_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                // Skip the domains picker on SSL decryption pages — it gets its own button
                if (el.closest('[data-test-id="domains_picker"]')) return;
                if (/comma[\s-]?separated/i.test(el.placeholder || '')) return;
                seen.add(el);
            });
        });
        return [...seen];
    }

    function injectDescriptionLogButtons() {
        if (!getSetting('descriptionLog')) return;

        const isSSL = /ssl-decryption/i.test(window.location.hash || window.location.pathname || '');

        getDescriptionTextareas().forEach(textarea => {
            // Per-textarea guard — skip if buttons already injected for this element
            if (textarea.dataset.nstkLogInjected) return;
            textarea.dataset.nstkLogInjected = '1';

            const container = document.createElement('div');
            container.className = LOG_BTN_CONTAINER_CLASS;
            Object.assign(container.style, {
                display:   'flex',
                gap:       '8px',
                marginTop: '6px',
                flexWrap:  'wrap',
            });

            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Add Log Entry';
            addBtn.style.cssText = `
                padding: 4px 10px; border: 1px solid #0073e6;
                border-radius: 4px; background: #0073e6;
                color: #fff; cursor: pointer; font-size: 12px;
                font-weight: 600; line-height: 1.4;
            `;
            addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#005bb5'; });
            addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#0073e6'; });
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                showAddLogEntryModal(textarea, isSSL ? 'ssl' : null);
            });
            container.appendChild(addBtn);

            // On SSL decryption pages, also show a removal entry button
            if (isSSL && getSetting('sslDomainLog')) {
                const removalBtn = document.createElement('button');
                removalBtn.textContent = '+ Add Removal Entry';
                removalBtn.title = 'Insert a #RITM | Date | Name | Removed marker at cursor position';
                removalBtn.style.cssText = `
                    padding: 4px 10px; border: 1px solid #e53935;
                    border-radius: 4px; background: #e53935;
                    color: #fff; cursor: pointer; font-size: 12px;
                    font-weight: 600; line-height: 1.4;
                `;
                removalBtn.addEventListener('mouseenter', () => { removalBtn.style.background = '#b71c1c'; });
                removalBtn.addEventListener('mouseleave', () => { removalBtn.style.background = '#e53935'; });
                removalBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); e.preventDefault();
                    showAddRemovalEntryModal(textarea);
                });
                container.appendChild(removalBtn);
            }

            const viewBtn = document.createElement('button');
            viewBtn.textContent = '📋 View Log';
            viewBtn.style.cssText = `
                padding: 4px 10px; border: 1px solid #4caf50;
                border-radius: 4px; background: #4caf50;
                color: #fff; cursor: pointer; font-size: 12px;
                font-weight: 600; line-height: 1.4;
            `;
            viewBtn.addEventListener('mouseenter', () => { viewBtn.style.background = '#388e3c'; });
            viewBtn.addEventListener('mouseleave', () => { viewBtn.style.background = '#4caf50'; });
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                showViewLogModal(textarea);
            });
            container.appendChild(viewBtn);

            textarea.insertAdjacentElement('afterend', container);
            console.log('[NS Toolkit] Description log buttons injected for textarea:', textarea.className);
        });
    }

    function showAddLogEntryModal(textarea, context) {
        if (document.getElementById('ns-add-log-modal')) return;
        const isSSL = context === 'ssl';

        const overlay = document.createElement('div');
        overlay.id = 'ns-add-log-overlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0', left: '0',
            width:      '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)',
            zIndex:     '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-add-log-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '2000001',
            background:   '#ffffff',
            border:       '2px solid #0073e6',
            borderRadius: '10px',
            padding:      '24px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '460px',
            width:        '90vw',
            boxSizing:    'border-box',
            color:        '#333',
        });

        const mkLabel = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, {
                fontSize: '12px', fontWeight: 'bold', color: '#555',
                display: 'block', marginBottom: '4px', fontFamily: 'Arial, sans-serif',
            });
            return el;
        };

        const mkInput = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text';
            el.placeholder = placeholder || '';
            el.value = value || '';
            el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px',
                border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff',
                color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const title = document.createElement('div');
        title.textContent = isSSL ? '📝 Add Domain Change Entry' : '📝 Add Log Entry';
        Object.assign(title.style, {
            fontSize: '15px', fontWeight: 'bold',
            color: '#0073e6', marginBottom: '16px', fontFamily: 'Arial, sans-serif',
        });

        const ritmLabel   = mkLabel('RITM Number');
        const ritmInput   = mkInput('e.g. RITM1234567');
        const dateLabel   = mkLabel('Date (auto-filled)');
        const dateInput   = mkInput('', getTodayDate(), true);
        const userLabel   = mkLabel('Your Name');
        const userInput   = mkInput('Your name', GM_getValue('toolkit_username', ''));
        const descLabel   = mkLabel(isSSL ? 'Domain Changes' : 'Description');

        const descInput = document.createElement('textarea');
        descInput.placeholder = isSSL ? 'Which domains were added or removed?' : 'What was changed or why?';
        descInput.rows = 3;
        Object.assign(descInput.style, {
            width: '100%', padding: '8px 10px',
            border: '1px solid #ccc', borderRadius: '5px',
            fontSize: '13px', fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box', marginBottom: '16px', resize: 'vertical',
        });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const addEntryBtn = document.createElement('button');
        addEntryBtn.textContent = 'Add Entry';
        Object.assign(addEntryBtn.style, {
            flex: '1', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        addEntryBtn.addEventListener('mouseenter', () => { addEntryBtn.style.background = '#005bb5'; });
        addEntryBtn.addEventListener('mouseleave', () => { addEntryBtn.style.background = '#0073e6'; });
        addEntryBtn.onclick = () => {
            const ritm = ritmInput.value.trim();
            const date = dateInput.value.trim();
            const user = userInput.value.trim();
            const desc = descInput.value.trim();

            if (!ritm) { ritmInput.style.borderColor = '#e53935'; ritmInput.focus(); return; }
            if (!desc) { descInput.style.borderColor = '#e53935'; descInput.focus(); return; }

            if (user && user !== GM_getValue('toolkit_username', '')) {
                GM_setValue('toolkit_username', user);
            }

            const logLine = `${ritm} | ${date} | ${user || 'Unknown'} | ${desc}`;
            const current = textarea.value;
            setAngularValue(textarea, current ? current + '\n' + logLine : logLine);

            overlay.remove();
            modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(addEntryBtn);

        modal.appendChild(title);
        modal.appendChild(ritmLabel);   modal.appendChild(ritmInput);
        modal.appendChild(dateLabel);   modal.appendChild(dateInput);
        modal.appendChild(userLabel);   modal.appendChild(userInput);
        modal.appendChild(descLabel);   modal.appendChild(descInput);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInput.focus(), 50);
    }

    function parseLogEntries(text) {
        if (!text) return [];
        return text.split('\n').map(line => {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 4) {
                return {
                    ritm: parts[0], date: parts[1], user: parts[2],
                    description: parts.slice(3).join(' | '),
                    isLogEntry: true,
                };
            }
            return { raw: line, isLogEntry: false };
        });
    }

    function showViewLogModal(textarea) {
        if (document.getElementById('ns-view-log-modal')) return;

        const logEntries = parseLogEntries(textarea.value).filter(e => e.isLogEntry);

        const overlay = document.createElement('div');
        overlay.id = 'ns-view-log-overlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0', left: '0',
            width:      '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)',
            zIndex:     '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-view-log-modal';
        Object.assign(modal.style, {
            position:      'fixed',
            top:           '50%', left: '50%',
            transform:     'translate(-50%, -50%)',
            zIndex:        '2000001',
            background:    '#ffffff',
            border:        '2px solid #4caf50',
            borderRadius:  '10px',
            padding:       '24px',
            boxShadow:     '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily:    'Arial, sans-serif',
            maxWidth:      '600px',
            width:         '90vw',
            maxHeight:     '85vh',
            boxSizing:     'border-box',
            color:         '#333',
            display:       'flex',
            flexDirection: 'column',
        });

        const title = document.createElement('div');
        title.textContent = `📋 Policy Change Log  (${logEntries.length} ${logEntries.length === 1 ? 'entry' : 'entries'})`;
        Object.assign(title.style, {
            fontSize: '15px', fontWeight: 'bold',
            color: '#2e7d32', marginBottom: '12px',
            fontFamily: 'Arial, sans-serif', flexShrink: '0',
        });
        modal.appendChild(title);

        /* ── Filter row ── */
        const filterRow = document.createElement('div');
        Object.assign(filterRow.style, {
            display: 'flex', gap: '8px', flexWrap: 'wrap',
            marginBottom: '12px', flexShrink: '0', alignItems: 'flex-end',
        });

        const mkFilterBlock = (labelText, inputType) => {
            const wrap = document.createElement('div');
            const lbl  = document.createElement('div');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { fontSize: '10px', fontWeight: 'bold', color: '#888', marginBottom: '2px' });
            const inp  = document.createElement('input');
            inp.type        = inputType || 'text';
            inp.placeholder = inputType === 'date' ? '' : 'All';
            Object.assign(inp.style, {
                padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px',
                fontSize: '12px', width: inputType === 'date' ? '130px' : '140px',
                boxSizing: 'border-box',
            });
            wrap.appendChild(lbl); wrap.appendChild(inp);
            return { wrap, inp };
        };

        const { wrap: ritmWrap, inp: ritmFilter }     = mkFilterBlock('Filter by RITM');
        const { wrap: fromWrap, inp: dateFromFilter }  = mkFilterBlock('Date From', 'date');
        const { wrap: toWrap,   inp: dateToFilter }    = mkFilterBlock('Date To',   'date');

        const clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.textContent = 'Clear';
        Object.assign(clearFiltersBtn.style, {
            padding: '5px 10px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc',
            borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', alignSelf: 'flex-end',
        });
        clearFiltersBtn.onclick = () => {
            ritmFilter.value = ''; dateFromFilter.value = ''; dateToFilter.value = '';
            renderEntries();
        };

        filterRow.append(ritmWrap, fromWrap, toWrap, clearFiltersBtn);
        modal.appendChild(filterRow);

        const scrollArea = document.createElement('div');
        Object.assign(scrollArea.style, { overflowY: 'auto', flex: '1', marginBottom: '16px' });
        modal.appendChild(scrollArea);

        function renderEntries() {
            const ritmVal  = ritmFilter.value.trim().toLowerCase();
            const dateFrom = dateFromFilter.value;
            const dateTo   = dateToFilter.value;

            const filtered = logEntries.filter(entry => {
                if (ritmVal  && !entry.ritm.toLowerCase().includes(ritmVal)) return false;
                if (dateFrom && entry.date && entry.date < dateFrom) return false;
                if (dateTo   && entry.date && entry.date > dateTo)   return false;
                return true;
            });

            scrollArea.innerHTML = '';

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = logEntries.length === 0
                    ? 'No log entries found in the policy description.'
                    : 'No entries match the current filters.';
                Object.assign(empty.style, {
                    fontSize: '13px', color: '#999', textAlign: 'center',
                    padding: '24px 0', fontFamily: 'Arial, sans-serif',
                });
                scrollArea.appendChild(empty);
                return;
            }

            filtered.forEach((entry, i) => {
                const card = document.createElement('div');
                Object.assign(card.style, {
                    background:   i % 2 === 0 ? '#f8fff8' : '#ffffff',
                    border:       '1px solid #c8e6c9',
                    borderRadius: '7px',
                    padding:      '12px 14px',
                    marginBottom: '8px',
                    fontSize:     '13px',
                    fontFamily:   'Arial, sans-serif',
                });

                const mkBadge = (text, bg, color, border) => {
                    const s = document.createElement('span');
                    s.textContent = text;
                    Object.assign(s.style, {
                        background: bg, color, borderRadius: '4px',
                        padding: '2px 7px', fontWeight: 'bold', fontSize: '12px',
                        border: border || 'none',
                    });
                    return s;
                };

                const headerRow = document.createElement('div');
                Object.assign(headerRow.style, {
                    display: 'flex', gap: '8px',
                    flexWrap: 'wrap', marginBottom: '7px', alignItems: 'center',
                });
                headerRow.appendChild(mkBadge(entry.ritm, '#1565c0', '#fff'));
                headerRow.appendChild(mkBadge(entry.date, '#f5f5f5', '#555', '1px solid #e0e0e0'));
                headerRow.appendChild(mkBadge('👤 ' + entry.user, '#e8f5e9', '#2e7d32'));

                const descEl = document.createElement('div');
                descEl.textContent = entry.description;
                Object.assign(descEl.style, { color: '#333', lineHeight: '1.4' });

                card.appendChild(headerRow);
                card.appendChild(descEl);
                scrollArea.appendChild(card);
            });
        }

        ritmFilter.addEventListener('input', renderEntries);
        dateFromFilter.addEventListener('change', renderEntries);
        dateToFilter.addEventListener('change', renderEntries);
        renderEntries();

        const footerRow = document.createElement('div');
        Object.assign(footerRow.style, { display: 'flex', gap: '8px', flexShrink: '0' });

        const removeOlderBtn = document.createElement('button');
        removeOlderBtn.textContent = '🗑 Remove Older Than';
        Object.assign(removeOlderBtn.style, {
            flex: '0 0 auto', padding: '10px 14px', background: '#fff', color: '#c62828',
            border: '1px solid #e53935', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        removeOlderBtn.addEventListener('mouseenter', () => { removeOlderBtn.style.background = '#ffebee'; });
        removeOlderBtn.addEventListener('mouseleave', () => { removeOlderBtn.style.background = '#fff'; });
        removeOlderBtn.addEventListener('click', () => {
            showRemoveOlderConfirm(
                (cutoff) => logEntries.filter(e => e.date && e.date < cutoff).length,
                (cutoff) => {
                    const newLines = textarea.value.split('\n').filter(line => {
                        const parts = line.split('|').map(p => p.trim());
                        if (parts.length >= 4) {
                            const date = parts[1];
                            return !date || date >= cutoff;
                        }
                        return true;
                    });
                    setAngularValue(textarea, newLines.join('\n').replace(/\n{3,}/g, '\n\n').trim());
                    overlay.remove(); modal.remove();
                }
            );
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            flex: '1', padding: '10px', background: '#4caf50', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#388e3c'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#4caf50'; });
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };

        footerRow.appendChild(removeOlderBtn);
        footerRow.appendChild(closeBtn);
        modal.appendChild(footerRow);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) closeBtn.click(); };
    }

    function showRemoveOlderConfirm(previewFn, onConfirm) {
        if (document.getElementById('ns-remove-older-confirm')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ns-remove-older-confirm-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '2000002',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-remove-older-confirm';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '2000003',
            background: '#ffffff',
            border: '2px solid #e53935',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 6px 28px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '400px',
            width: '90vw',
            boxSizing: 'border-box',
            color: '#333',
        });

        const title = document.createElement('div');
        title.textContent = '🗑 Remove Logs Older Than';
        Object.assign(title.style, {
            fontSize: '15px', fontWeight: 'bold',
            color: '#c62828', marginBottom: '6px', fontFamily: 'Arial, sans-serif',
        });

        const subtitle = document.createElement('div');
        subtitle.textContent = 'All log entries strictly before this date will be permanently deleted from the textarea.';
        Object.assign(subtitle.style, {
            fontSize: '12px', color: '#666', marginBottom: '16px', lineHeight: '1.4',
        });

        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Remove entries before:';
        Object.assign(dateLabel.style, {
            fontSize: '12px', fontWeight: 'bold', color: '#555',
            display: 'block', marginBottom: '4px',
        });

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        Object.assign(dateInput.style, {
            width: '100%', padding: '8px 10px',
            border: '1px solid #ccc', borderRadius: '5px',
            fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px',
        });

        const previewEl = document.createElement('div');
        Object.assign(previewEl.style, {
            fontSize: '12px', minHeight: '18px', marginBottom: '16px',
            padding: '8px 12px', borderRadius: '5px',
            background: '#fff8e1', border: '1px solid #ffe082', color: '#795548',
            display: 'none',
        });

        dateInput.addEventListener('change', () => {
            const cutoff = dateInput.value;
            if (!cutoff) { previewEl.style.display = 'none'; return; }
            const count = previewFn(cutoff);
            previewEl.style.display = 'block';
            if (count === 0) {
                previewEl.textContent = 'No entries are older than this date.';
                previewEl.style.background = '#f1f8e9';
                previewEl.style.borderColor = '#aed581';
                previewEl.style.color = '#558b2f';
            } else {
                previewEl.textContent = `⚠️  ${count} entr${count === 1 ? 'y' : 'ies'} will be permanently removed.`;
                previewEl.style.background = '#fff8e1';
                previewEl.style.borderColor = '#ffe082';
                previewEl.style.color = '#795548';
            }
        });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm Delete';
        Object.assign(confirmBtn.style, {
            flex: '1', padding: '10px', background: '#e53935', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.background = '#b71c1c'; });
        confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.background = '#e53935'; });
        confirmBtn.onclick = () => {
            const cutoff = dateInput.value;
            if (!cutoff) { dateInput.style.borderColor = '#e53935'; dateInput.focus(); return; }
            if (previewFn(cutoff) === 0) return;
            overlay.remove(); modal.remove();
            onConfirm(cutoff);
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(dateLabel);
        modal.appendChild(dateInput);
        modal.appendChild(previewEl);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => dateInput.focus(), 50);
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 6 — SSL DECRYPTION DOMAIN LOG (removal entry modal)
    // ─────────────────────────────────────────────────────────────

    function showAddRemovalEntryModal(textarea) {
        if (document.getElementById('ns-ssl-removal-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ns-ssl-removal-overlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0', left: '0',
            width:      '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)',
            zIndex:     '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-ssl-removal-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '2000001',
            background:   '#ffffff',
            border:       '2px solid #e53935',
            borderRadius: '10px',
            padding:      '24px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '460px',
            width:        '90vw',
            boxSizing:    'border-box',
            color:        '#333',
        });

        const mkLabel = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, {
                fontSize: '12px', fontWeight: 'bold', color: '#555',
                display: 'block', marginBottom: '4px', fontFamily: 'Arial, sans-serif',
            });
            return el;
        };

        const mkInput = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text';
            el.placeholder = placeholder || '';
            el.value = value || '';
            el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px',
                border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff',
                color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const title = document.createElement('div');
        title.textContent = '🗑 Add Removal Entry';
        Object.assign(title.style, {
            fontSize: '15px', fontWeight: 'bold',
            color: '#e53935', marginBottom: '16px', fontFamily: 'Arial, sans-serif',
        });

        const ritmLabel = mkLabel('RITM Number');
        const ritmInput = mkInput('e.g. RITM1234567');
        const dateLabel = mkLabel('Date (auto-filled)');
        const dateInput = mkInput('', getTodayDate(), true);
        const userLabel = mkLabel('Your Name');
        const userInput = mkInput('Your name', GM_getValue('toolkit_username', ''));
        const domainsLabel = mkLabel('Domains Removed (optional)');

        const domainsInput = document.createElement('textarea');
        domainsInput.placeholder = 'e.g. domain1.com, domain2.com';
        domainsInput.rows = 3;
        Object.assign(domainsInput.style, {
            width: '100%', padding: '8px 10px',
            border: '1px solid #ccc', borderRadius: '5px',
            fontSize: '13px', fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box', marginBottom: '16px', resize: 'vertical',
        });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Entry';
        Object.assign(insertBtn.style, {
            flex: '1', padding: '10px', background: '#e53935', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        insertBtn.addEventListener('mouseenter', () => { insertBtn.style.background = '#b71c1c'; });
        insertBtn.addEventListener('mouseleave', () => { insertBtn.style.background = '#e53935'; });
        insertBtn.onclick = () => {
            const ritm = ritmInput.value.trim();
            const date = dateInput.value.trim();
            const user = userInput.value.trim();

            if (!ritm) { ritmInput.style.borderColor = '#e53935'; ritmInput.focus(); return; }

            if (user && user !== GM_getValue('toolkit_username', '')) {
                GM_setValue('toolkit_username', user);
            }

            const domains = domainsInput.value.trim();
            const entry = `#${ritm.replace(/^#+/, '')} | ${date} | ${user || 'Unknown'} | Removed${domains ? ' | ' + domains : ''}`;
            insertAtCursor(textarea, entry);

            overlay.remove();
            modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(insertBtn);

        modal.appendChild(title);
        modal.appendChild(ritmLabel);    modal.appendChild(ritmInput);
        modal.appendChild(dateLabel);    modal.appendChild(dateInput);
        modal.appendChild(userLabel);    modal.appendChild(userInput);
        modal.appendChild(domainsLabel); modal.appendChild(domainsInput);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInput.focus(), 50);
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 7 — DLP ENTITY CHARACTER COUNTER
    // ─────────────────────────────────────────────────────────────

    function addDlpCharCounter(input) {
        if (input.nextElementSibling && input.nextElementSibling.classList.contains('char-counter')) return;

        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.style.cssText = 'margin-top: 4px; font-size: 12px; color: #666; font-family: inherit;';
        counter.textContent = `Characters: ${input.value.length}`;

        const flexContainer = input.closest('.ns-flex');
        if (flexContainer && flexContainer.parentNode) {
            flexContainer.parentNode.insertBefore(counter, flexContainer.nextSibling);
        }

        input.addEventListener('input', function () {
            counter.textContent = `Characters: ${this.value.length}`;
        });

        const attrObserver = new MutationObserver(function () {
            counter.textContent = `Characters: ${input.value.length}`;
        });
        attrObserver.observe(input, { attributes: true, attributeFilter: ['value'] });
    }

    function checkDlpCharCounters() {
        if (!getSetting('dlpCharCounter')) return;
        const input = document.querySelector('input[placeholder*="Add a regex, keyword or predefined data identifier"]');
        if (input && !input.dataset.counterAdded) {
            input.dataset.counterAdded = 'true';
            addDlpCharCounter(input);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE 8 — URL LIST HISTORY
    // ─────────────────────────────────────────────────────────────

    const URL_LIST_TA_SELECTORS = [
        'textarea.ns-form-textarea:not(.policy-description-container)',
        'textarea[aria-label*="IP Address" i]',
        'textarea[placeholder*="IP Address" i]',
        'textarea[aria-label*="url list" i]',
        'textarea[aria-label*="urls" i]:not([aria-label*="description" i])',
        'textarea[placeholder*="domain" i]',
        'textarea[placeholder*="url" i]:not([aria-label*="description" i])',
    ];

    function isOnUrlListPage() {
        return /url-?list/i.test((window.location.hash || '') + (window.location.pathname || ''));
    }

    function getUrlListTextareas() {
        if (!isOnUrlListPage()) return [];
        const seen = new Set();
        URL_LIST_TA_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el.dataset.nstkLogInjected)    return; // already has description log buttons
                if (el.dataset.nstkUrlLogInjected) return;
                seen.add(el);
            });
        });
        return [...seen];
    }

    function injectUrlListHistoryButtons() {
        if (!getSetting('urlListHistory')) return;

        getUrlListTextareas().forEach(textarea => {
            if (textarea.dataset.nstkUrlLogInjected) return;
            textarea.dataset.nstkUrlLogInjected = '1';

            const container = document.createElement('div');
            container.className = URL_LIST_BTN_CONTAINER_CLASS;
            Object.assign(container.style, { display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' });

            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Log Entry';
            addBtn.title = 'Insert a #RITM | Date | Name header at the cursor position';
            addBtn.style.cssText = `
                padding: 4px 10px; border: 1px solid #0073e6;
                border-radius: 4px; background: #0073e6;
                color: #fff; cursor: pointer; font-size: 12px;
                font-weight: 600; line-height: 1.4;
            `;
            addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#005bb5'; });
            addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#0073e6'; });
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                showAddUrlLogEntryModal(textarea);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑 Delete Selected';
            deleteBtn.title = 'Select domains in the textarea first, then click to comment them out and add a Deleted log header';
            deleteBtn.style.cssText = `
                padding: 4px 10px; border: 1px solid #e53935;
                border-radius: 4px; background: #e53935;
                color: #fff; cursor: pointer; font-size: 12px;
                font-weight: 600; line-height: 1.4;
            `;
            deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.background = '#c62828'; });
            deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.background = '#e53935'; });
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                showDeleteSelectionModal(textarea);
            });

            const viewBtn = document.createElement('button');
            viewBtn.textContent = '📜 View History';
            viewBtn.style.cssText = `
                padding: 4px 10px; border: 1px solid #4caf50;
                border-radius: 4px; background: #4caf50;
                color: #fff; cursor: pointer; font-size: 12px;
                font-weight: 600; line-height: 1.4;
            `;
            viewBtn.addEventListener('mouseenter', () => { viewBtn.style.background = '#388e3c'; });
            viewBtn.addEventListener('mouseleave', () => { viewBtn.style.background = '#4caf50'; });
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                showUrlListLogViewer(textarea);
            });

            container.appendChild(addBtn);
            container.appendChild(deleteBtn);
            container.appendChild(viewBtn);
            textarea.insertAdjacentElement('afterend', container);
            console.log('[NS Toolkit] URL list history buttons injected for textarea:', textarea.id || textarea.className);
        });
    }

    /* ── Parse URL list content into groups ── */
    function parseUrlListLog(text) {
        if (!text) return [];
        const lines = text.split('\n');
        const groups = [];
        let current = null;
        const orphanDomains = [];

        for (const line of lines) {
            const trimmed = line.trim();
            // Log header: starts with # followed immediately by a word character (#RITM...)
            if (/^#\w/.test(trimmed)) {
                if (orphanDomains.length > 0) {
                    groups.push({ ritm: '', date: '', name: '', isDeleted: false, domains: [...orphanDomains], raw: '', isOrphan: true });
                    orphanDomains.length = 0;
                }
                const parts = trimmed.slice(1).split('|').map(p => p.trim());
                current = {
                    ritm:      '#' + parts[0],
                    date:      parts[1] || '',
                    name:      parts[2] || '',
                    isDeleted: parts.length >= 4 && parts[3].toLowerCase() === 'deleted',
                    domains:   [],
                    raw:       line,
                };
                groups.push(current);
            } else if (trimmed) {
                // Domain line — may be commented with "# " prefix
                const isCommented = /^#/.test(trimmed);
                const domain = isCommented ? trimmed.slice(1).trim() : trimmed;
                const entry = { raw: line, domain, isCommented };
                if (current) current.domains.push(entry);
                else orphanDomains.push(entry);
            }
        }

        if (orphanDomains.length > 0) {
            groups.push({ ritm: '', date: '', name: '', isDeleted: false, domains: orphanDomains, raw: '', isOrphan: true });
        }

        return groups;
    }

    /* ── Insert text at cursor position in a textarea ── */
    function insertAtCursor(textarea, text) {
        const start  = textarea.selectionStart;
        const end    = textarea.selectionEnd;
        const value  = textarea.value;
        const before = value.slice(0, start);
        const after  = value.slice(end);
        const prefix = (before && !before.endsWith('\n')) ? '\n' : '';
        const suffix = (after  && !after.startsWith('\n')) ? '\n' : '';
        setAngularValue(textarea, before + prefix + text + suffix + after);
        const newPos = before.length + prefix.length + text.length + suffix.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
    }

    /* ── Add URL Log Entry modal ── */
    function showAddUrlLogEntryModal(textarea) {
        if (document.getElementById('ns-url-log-add-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ns-url-log-add-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)', zIndex: '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-url-log-add-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '2000001', background: '#ffffff', border: '2px solid #0073e6',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '440px', width: '90vw',
            boxSizing: 'border-box', color: '#333',
        });

        const mkLbl = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' });
            return el;
        };
        const mkInp = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text'; el.placeholder = placeholder || ''; el.value = value || ''; el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff', color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const titleEl = document.createElement('div');
        titleEl.textContent = '📜 Add URL List Log Entry';
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#0073e6', marginBottom: '16px' });

        const ritmLbl  = mkLbl('RITM Number');
        const ritmInp  = mkInp('e.g. RITM1234567');
        const dateLbl  = mkLbl('Date (auto-filled)');
        const dateInp  = mkInp('', getTodayDate(), true);
        const userLbl  = mkLbl('Your Name');
        const userInp  = mkInp('Your name', GM_getValue('toolkit_username', ''));

        const tipEl = document.createElement('div');
        Object.assign(tipEl.style, {
            background: '#e8f4fd', border: '1px solid #90caf9', borderRadius: '6px',
            padding: '8px 12px', marginBottom: '16px', fontSize: '12px', color: '#1a4f7a',
        });
        tipEl.textContent = 'The log header (#RITM | Date | Name) will be inserted at the current cursor position. Type your domains below it.';

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Insert Log Header';
        Object.assign(addBtn.style, {
            flex: '1', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#005bb5'; });
        addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#0073e6'; });
        addBtn.onclick = () => {
            const ritm = ritmInp.value.trim();
            const date = dateInp.value.trim();
            const user = userInp.value.trim();
            if (!ritm) { ritmInp.style.borderColor = '#e53935'; ritmInp.focus(); return; }
            if (user && user !== GM_getValue('toolkit_username', '')) GM_setValue('toolkit_username', user);
            const ritmClean = ritm.startsWith('#') ? ritm : '#' + ritm;
            const logLine = `${ritmClean} | ${date} | ${user || 'Unknown'}`;
            insertAtCursor(textarea, logLine);
            overlay.remove(); modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(addBtn);

        modal.appendChild(titleEl);
        modal.appendChild(ritmLbl); modal.appendChild(ritmInp);
        modal.appendChild(dateLbl); modal.appendChild(dateInp);
        modal.appendChild(userLbl); modal.appendChild(userInp);
        modal.appendChild(tipEl);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInp.focus(), 50);
    }

    /* ── Delete Selection modal ── */
    function showDeleteSelectionModal(textarea) {
        const start    = textarea.selectionStart;
        const end      = textarea.selectionEnd;
        const selected = textarea.value.slice(start, end).trim();

        if (!selected) {
            const msg = document.createElement('div');
            msg.textContent = 'Select the domains you want to mark as deleted first.';
            Object.assign(msg.style, {
                position: 'fixed', bottom: '20px', right: '20px',
                background: '#e65100', color: '#fff', padding: '10px 16px',
                borderRadius: '6px', zIndex: '2000002', fontSize: '13px',
                fontFamily: 'Arial, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            });
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2500);
            return;
        }

        if (document.getElementById('ns-url-del-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ns-url-del-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)', zIndex: '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-url-del-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '2000001', background: '#ffffff', border: '2px solid #e53935',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '480px', width: '90vw',
            boxSizing: 'border-box', color: '#333',
        });

        const mkLbl = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' });
            return el;
        };
        const mkInp = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text'; el.placeholder = placeholder || ''; el.value = value || ''; el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff', color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const titleEl = document.createElement('div');
        titleEl.textContent = '🗑 Mark Selected Domains as Deleted';
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#e53935', marginBottom: '8px' });

        const preview = document.createElement('div');
        Object.assign(preview.style, {
            background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '6px',
            padding: '8px 12px', marginBottom: '8px', fontSize: '11px', color: '#555',
            fontFamily: 'monospace', maxHeight: '80px', overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        });
        preview.textContent = selected.length > 300 ? selected.slice(0, 300) + '…' : selected;

        const domainCount = selected.split('\n').filter(l => l.trim()).length;
        const countLine = document.createElement('div');
        countLine.textContent = `${domainCount} line${domainCount !== 1 ? 's' : ''} selected — they will be commented out and marked as deleted.`;
        Object.assign(countLine.style, { fontSize: '12px', color: '#666', marginBottom: '14px' });

        const ritmLbl  = mkLbl('RITM Number');
        const ritmInp  = mkInp('e.g. RITM1234567');
        const dateLbl  = mkLbl('Date (auto-filled)');
        const dateInp  = mkInp('', getTodayDate(), true);
        const userLbl  = mkLbl('Your Name');
        const userInp  = mkInp('Your name', GM_getValue('toolkit_username', ''));

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '4px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Mark as Deleted';
        Object.assign(confirmBtn.style, {
            flex: '1', padding: '10px', background: '#e53935', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.background = '#c62828'; });
        confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.background = '#e53935'; });
        confirmBtn.onclick = () => {
            const ritm = ritmInp.value.trim();
            const date = dateInp.value.trim();
            const user = userInp.value.trim();
            if (!ritm) { ritmInp.style.borderColor = '#e53935'; ritmInp.focus(); return; }
            if (user && user !== GM_getValue('toolkit_username', '')) GM_setValue('toolkit_username', user);

            const ritmClean = ritm.startsWith('#') ? ritm : '#' + ritm;
            const logLine   = `${ritmClean} | ${date} | ${user || 'Unknown'} | Deleted`;

            // Comment out selected lines (skip blank lines and already-commented lines)
            const selLines  = textarea.value.slice(start, end).split('\n');
            const commented = selLines.map(l => {
                const t = l.trim();
                if (!t || /^#/.test(t)) return l;
                return '# ' + l;
            }).join('\n');

            const before = textarea.value.slice(0, start);
            const after  = textarea.value.slice(end);
            const prefix = (before && !before.endsWith('\n')) ? '\n' : '';
            setAngularValue(textarea, before + prefix + logLine + '\n' + commented + after);

            overlay.remove(); modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(titleEl);
        modal.appendChild(preview);
        modal.appendChild(countLine);
        modal.appendChild(ritmLbl); modal.appendChild(ritmInp);
        modal.appendChild(dateLbl); modal.appendChild(dateInp);
        modal.appendChild(userLbl); modal.appendChild(userInp);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInp.focus(), 50);
    }

    /* ── URL List Log Viewer ── */
    function showUrlListLogViewer(textarea) {
        if (document.getElementById('ns-url-log-view-modal')) return;

        const allGroups = parseUrlListLog(textarea.value).filter(g =>
            g.ritm || g.domains.some(d => d.domain)
        );

        const overlay = document.createElement('div');
        overlay.id = 'ns-url-log-view-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)', zIndex: '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-url-log-view-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '2000001', background: '#ffffff', border: '2px solid #0073e6',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '640px', width: '92vw',
            maxHeight: '85vh', boxSizing: 'border-box', color: '#333',
            display: 'flex', flexDirection: 'column',
        });

        const titleEl = document.createElement('div');
        titleEl.textContent = `📜 URL List Change History  (${allGroups.length} group${allGroups.length !== 1 ? 's' : ''})`;
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#0073e6', marginBottom: '12px', flexShrink: '0' });
        modal.appendChild(titleEl);

        /* ── Filter row ── */
        const filterRow = document.createElement('div');
        Object.assign(filterRow.style, {
            display: 'flex', gap: '8px', flexWrap: 'wrap',
            marginBottom: '12px', flexShrink: '0', alignItems: 'flex-end',
        });

        const mkFilterBlock = (labelText, inputType) => {
            const wrap = document.createElement('div');
            const lbl  = document.createElement('div');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { fontSize: '10px', fontWeight: 'bold', color: '#888', marginBottom: '2px' });
            const inp  = document.createElement('input');
            inp.type        = inputType || 'text';
            inp.placeholder = inputType === 'date' ? '' : 'All';
            Object.assign(inp.style, {
                padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px',
                fontSize: '12px', width: inputType === 'date' ? '130px' : '140px',
                boxSizing: 'border-box',
            });
            wrap.appendChild(lbl); wrap.appendChild(inp);
            return { wrap, inp };
        };

        const { wrap: ritmWrap, inp: ritmFilter }    = mkFilterBlock('Filter by RITM');
        const { wrap: fromWrap, inp: dateFromFilter } = mkFilterBlock('Date From', 'date');
        const { wrap: toWrap,   inp: dateToFilter }   = mkFilterBlock('Date To',   'date');

        const clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.textContent = 'Clear';
        Object.assign(clearFiltersBtn.style, {
            padding: '5px 10px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc',
            borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', alignSelf: 'flex-end',
        });
        clearFiltersBtn.onclick = () => {
            ritmFilter.value = ''; dateFromFilter.value = ''; dateToFilter.value = '';
            applyFilters();
        };

        filterRow.append(ritmWrap, fromWrap, toWrap, clearFiltersBtn);
        modal.appendChild(filterRow);

        const scrollArea = document.createElement('div');
        Object.assign(scrollArea.style, { overflowY: 'auto', flex: '1', marginBottom: '12px' });
        modal.appendChild(scrollArea);

        function buildGroupCard(group) {
            const isDeleted = group.isDeleted;
            const card = document.createElement('div');
            Object.assign(card.style, {
                background:   isDeleted ? '#fff8f8' : (group.isOrphan ? '#f8f8f8' : '#f0f6ff'),
                border:       `1px solid ${isDeleted ? '#ffcdd2' : (group.isOrphan ? '#e0e0e0' : '#bbdefb')}`,
                borderRadius: '7px', padding: '12px 14px', marginBottom: '8px', fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
            });

            const mkBadge = (text, bg, color, border) => {
                const s = document.createElement('span');
                s.textContent = text;
                Object.assign(s.style, {
                    display: 'inline-block', background: bg, color, borderRadius: '4px',
                    padding: '2px 8px', fontWeight: 'bold', fontSize: '12px',
                    border: border || 'none',
                });
                return s;
            };

            const headerRow = document.createElement('div');
            Object.assign(headerRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' });

            if (group.ritm) {
                headerRow.appendChild(mkBadge(group.ritm, isDeleted ? '#e53935' : '#1565c0', '#fff'));
            }
            if (group.date) {
                headerRow.appendChild(mkBadge(group.date, '#f5f5f5', '#555', '1px solid #e0e0e0'));
            }
            if (group.name) {
                headerRow.appendChild(mkBadge('👤 ' + group.name, '#e8f5e9', '#2e7d32'));
            }
            if (isDeleted) {
                headerRow.appendChild(mkBadge('🗑 DELETED', '#e53935', '#fff'));
            }
            if (group.isOrphan) {
                headerRow.appendChild(mkBadge('No Log Header', '#f5f5f5', '#999', '1px solid #e0e0e0'));
            }

            card.appendChild(headerRow);

            const activeDomains = group.domains.filter(d => d.domain);
            if (activeDomains.length > 0) {
                const domainList = document.createElement('div');
                Object.assign(domainList.style, { fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.7', paddingLeft: '4px' });

                activeDomains.forEach(d => {
                    const dEl = document.createElement('div');
                    dEl.textContent = d.isCommented ? '# ' + d.domain : d.domain;
                    Object.assign(dEl.style, {
                        color: d.isCommented ? '#aaa' : '#333',
                        textDecoration: d.isCommented ? 'line-through' : 'none',
                    });
                    domainList.appendChild(dEl);
                });

                const activeCount    = activeDomains.filter(d => !d.isCommented).length;
                const commentedCount = activeDomains.filter(d =>  d.isCommented).length;
                let countText = `${activeCount} domain${activeCount !== 1 ? 's' : ''}`;
                if (commentedCount > 0) countText += `  ·  ${commentedCount} commented`;
                const countEl = document.createElement('div');
                countEl.textContent = countText;
                Object.assign(countEl.style, { fontSize: '10px', color: '#999', marginTop: '4px' });

                card.appendChild(domainList);
                card.appendChild(countEl);
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.textContent = '(no domains in this group)';
                Object.assign(emptyEl.style, { fontSize: '11px', color: '#bbb', fontStyle: 'italic' });
                card.appendChild(emptyEl);
            }

            return card;
        }

        function applyFilters() {
            const ritmVal  = ritmFilter.value.trim().toLowerCase();
            const dateFrom = dateFromFilter.value;
            const dateTo   = dateToFilter.value;

            const filtered = allGroups.filter(group => {
                if (ritmVal  && !group.ritm.toLowerCase().includes(ritmVal)) return false;
                if (dateFrom && group.date && group.date < dateFrom) return false;
                if (dateTo   && group.date && group.date > dateTo)   return false;
                return true;
            });

            scrollArea.innerHTML = '';

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = allGroups.length === 0
                    ? 'No log entries found in this URL list.'
                    : 'No entries match the current filters.';
                Object.assign(empty.style, {
                    fontSize: '13px', color: '#999', textAlign: 'center',
                    padding: '24px 0', fontStyle: 'italic',
                });
                scrollArea.appendChild(empty);
            } else {
                filtered.forEach(group => scrollArea.appendChild(buildGroupCard(group)));
            }
        }

        ritmFilter.addEventListener('input', applyFilters);
        dateFromFilter.addEventListener('change', applyFilters);
        dateToFilter.addEventListener('change', applyFilters);
        applyFilters();

        const footerRow = document.createElement('div');
        Object.assign(footerRow.style, { display: 'flex', gap: '8px', flexShrink: '0' });

        const removeOlderBtn = document.createElement('button');
        removeOlderBtn.textContent = '🗑 Remove Older Than';
        Object.assign(removeOlderBtn.style, {
            flex: '0 0 auto', padding: '10px 14px', background: '#fff', color: '#c62828',
            border: '1px solid #e53935', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        removeOlderBtn.addEventListener('mouseenter', () => { removeOlderBtn.style.background = '#ffebee'; });
        removeOlderBtn.addEventListener('mouseleave', () => { removeOlderBtn.style.background = '#fff'; });
        removeOlderBtn.addEventListener('click', () => {
            showRemoveOlderConfirm(
                (cutoff) => allGroups.filter(g => !g.isOrphan && g.date && g.date < cutoff).length,
                (cutoff) => {
                    const groups = parseUrlListLog(textarea.value);
                    const keepLines = [];
                    groups.forEach(group => {
                        if (group.isOrphan || !group.date || group.date >= cutoff) {
                            if (group.raw) keepLines.push(group.raw);
                            group.domains.forEach(d => keepLines.push(d.raw));
                        }
                    });
                    setAngularValue(textarea, keepLines.join('\n').trim());
                    overlay.remove(); modal.remove();
                }
            );
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            flex: '1', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#005bb5'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#0073e6'; });
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };

        footerRow.appendChild(removeOlderBtn);
        footerRow.appendChild(closeBtn);
        modal.appendChild(footerRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) closeBtn.click(); };
    }

    // ─────────────────────────────────────────────────────────────
    // FIRST-BOOT USERNAME PROMPT
    // ─────────────────────────────────────────────────────────────

    function showUsernamePromptModal() {
        if (document.getElementById('ns-username-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ns-username-overlay';
        Object.assign(overlay.style, {
            position:   'fixed',
            top:        '0', left: '0',
            width:      '100%', height: '100%',
            background: 'rgba(0,0,0,0.45)',
            zIndex:     '2000000',
        });

        const modal = document.createElement('div');
        modal.id = 'ns-username-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '2000001',
            background:   '#ffffff',
            border:       '2px solid #0073e6',
            borderRadius: '10px',
            padding:      '24px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '380px',
            width:        '90vw',
            boxSizing:    'border-box',
            color:        '#333',
        });

        const title = document.createElement('div');
        title.textContent = '👋 Welcome to NS Policies Toolkit';
        Object.assign(title.style, {
            fontSize: '15px', fontWeight: 'bold',
            color: '#0073e6', marginBottom: '8px', fontFamily: 'Arial, sans-serif',
        });

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Enter your name — it will be auto-filled when adding log entries to policy descriptions.';
        Object.assign(subtitle.style, {
            fontSize: '12px', color: '#666',
            marginBottom: '16px', lineHeight: '1.5', fontFamily: 'Arial, sans-serif',
        });

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Your full name';
        Object.assign(nameInput.style, {
            width: '100%', padding: '8px 10px',
            border: '1px solid #ccc', borderRadius: '5px',
            fontSize: '13px', fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box', marginBottom: '16px',
        });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Continue';
        Object.assign(saveBtn.style, {
            width: '100%', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        saveBtn.addEventListener('mouseenter', () => { saveBtn.style.background = '#005bb5'; });
        saveBtn.addEventListener('mouseleave', () => { saveBtn.style.background = '#0073e6'; });
        saveBtn.onclick = () => {
            const name = nameInput.value.trim();
            if (!name) { nameInput.style.borderColor = '#e53935'; nameInput.focus(); return; }
            GM_setValue('toolkit_username', name);
            overlay.remove();
            modal.remove();
        };
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });

        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(nameInput);
        modal.appendChild(saveBtn);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        setTimeout(() => nameInput.focus(), 100);
    }

    // ─────────────────────────────────────────────────────────────
    // SHARED RUNNER
    // ─────────────────────────────────────────────────────────────

    function runAll() {
        addCopyButtons();
        addOpenButtons();
        checkSmtp();
        interceptSaveButtons();
        injectDescriptionLogButtons();
        injectUrlListHistoryButtons();
        checkDlpCharCounters();
    }

    let burst = 0;
    (function burstRun() {
        runAll();
        if (++burst < 5) setTimeout(burstRun, 1000);
    })();

    setInterval(checkSmtp, 800);
    setInterval(interceptSaveButtons, 1200);

    // On SPA navigation, clear intercepted flags so new Save buttons get picked up
    let lastHash = window.location.hash;
    setInterval(() => {
        if (window.location.hash !== lastHash) {
            lastHash = window.location.hash;
            document.querySelectorAll('[data-nstk-save-intercepted]').forEach(btn => {
                delete btn.dataset.nstkSaveIntercepted;
            });
        }
    }, 300);

    const observer = new MutationObserver((mutations) => {
        const relevant = mutations.some(m =>
            [...m.addedNodes].some(n => {
                if (n.nodeType !== 1) return false;
                return (
                    n.classList?.contains('ns-picker-tag')  ||
                    n.classList?.contains('criteria-title') ||
                    n.querySelector?.('.ns-picker-tag')     ||
                    n.querySelector?.('.criteria-title')    ||
                    n.querySelector?.('a.trigger')    ||
                    n.querySelector?.('button.ns-btn-primary') ||
                    n.querySelector?.('textarea.ns-form-textarea') ||
                    n.querySelector?.('textarea#category-description') ||
                    n.querySelector?.('input[placeholder*="Add a regex, keyword or predefined data identifier"]') ||
                    n.matches?.('input[placeholder*="Add a regex, keyword or predefined data identifier"]') ||
                    URL_LIST_TA_SELECTORS.some(sel => n.matches?.(sel) || n.querySelector?.(sel))
                );
            })
        );
        if (relevant) setTimeout(runAll, 100);
    });

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;

        isInitialized = true;
        console.log('Initializing NS Policies Toolkit…');

        observer.observe(document.body, { childList: true, subtree: true });
        buildSettingsModal();
        setTimeout(attemptRegistration, 1000);

        if (!GM_getValue('toolkit_username', '')) {
            setTimeout(() => showUsernamePromptModal(), 800);
        }

        console.log('✅ NS Policies Toolkit v' + SCRIPT_VERSION + ' ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => {
        if (!isRegistered) {
            console.log('🔄 Page load fallback — checking registration…');
            attemptRegistration();
        }
    });

})();