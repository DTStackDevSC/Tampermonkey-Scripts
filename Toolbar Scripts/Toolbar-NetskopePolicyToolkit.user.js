// ==UserScript==
// @name         |Toolbar| Netskope Policies Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.24
// @description  Copy buttons, DLP profile open buttons, SMTP auto-fill, Save reminder checklist, description log entry tools, URL list history, DLP entity character counter, and bulk constraint entry/delete/copy (by Sameena K.), and bulk removal of domains from steering exceptions. Integrated with Toolbar v2.
// @author       J.R., Sameena K. (Bulk Constraint Tools)
// @match        https://*.goskope.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
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
        refOpenButtons:  'toolkit_refOpenButtons',
        smtpAutofill:    'toolkit_smtpAutofill',
        saveReminder:    'toolkit_saveReminder',
        descriptionLog:  'toolkit_descriptionLog',
        urlListHistory:  'toolkit_urlListHistory',
        sslDomainLog:    'toolkit_sslDomainLog',
        dlpCharCounter:  'toolkit_dlpCharCounter',
        bulkConstraints: 'toolkit_bulkConstraints',
        steeringRemover: 'toolkit_steeringRemover',
    };

    function getSetting(key)        { return GM_getValue(SETTING_KEYS[key], true); }
    function setSetting(key, value) { GM_setValue(SETTING_KEYS[key], value); }

    // ─────────────────────────────────────────────────────────────
    // VERSION CONTROL & CHANGELOG
    // ─────────────────────────────────────────────────────────────

    const SCRIPT_VERSION = '1.24';
    const CHANGELOG = `Version 1.24:
- New "Steering Exception Domain Remover" feature. On the Steering Configuration page, a "🧹 Bulk remove domains" button now appears next to New Exception. Paste the domains, tick the steering configurations to search, and click Check to see where each domain is listed as an exception.
- Remove takes only the requested domains out of each exception entry and keeps the others. An entry is deleted only when every domain in it was requested.
- Nothing changes until you confirm. Afterwards the tool checks again that the domains are gone and gives you a summary to copy into the ticket.
- The entries are backed up before each change. "Restore last backup" puts them back, and the backup can be downloaded as a file.

Version 1.23:
- The ↗ open buttons now also cover File Classifiers in a DLP Profile (they open the classifier directly) and, inside a DLP Rule, each Custom or Dictionary Identifier listed in the Overview panel (the new tab finds and opens the entity).
- The buttons also show in DLP Profiles that use Advanced mode.
- Fixed the fallback that searches the DLP Profiles list when a profile cannot be opened by its name.

Version 1.22.1:
- Fixed the DLP Profile ↗ button showing "Could not find the DLP profile" for some profiles. It now keeps the exact name, including leading spaces, and opens predefined profiles correctly. If Netskope still cannot find the profile, the new tab searches the profiles list and opens it from there.

Version 1.22:
- New "Profile Reference Open Buttons" feature. Inside a DLP Profile, an ↗ button now appears on each DLP Rule and Fingerprint Rule in the Content Rules step, and on each File Profile in the Overview panel. It opens the item in a new tab: that tab searches the list for the exact name and opens it for you. If the item cannot be found, the list stays filtered so you can pick it yourself. It can be turned off in the settings.

Version 1.21.3:
- Fixed the copy button not showing on blue tags with long names. It now sits in front of the name, so it stays visible even when the name is cut short, and it still copies the full name.

Version 1.21.2:
- Fixed the "+ Add Log Entry" and "View Log" buttons not appearing when the Destination Profile side panel is opened after the page has loaded.

Version 1.21.1:
- The "+ Add Log Entry" and "View Log" buttons now also appear below the description field of the Destination Profile side panel.

Version 1.21:
- Bulk Constraint Tools (by Sameena K.) now also work in Netskope's new user constraint profile side panel, with the buttons shown beside Save in the panel header. The old modal is still supported.

Version 1.20.1:
- The Bulk Constraint Tools settings row now shows its "Contributed by Sameena K." credit as a highlighted footer line.

Version 1.20:
- Added Bulk Constraint Tools, contributed by Sameena K. In the user constraint profile modal, "Bulk entry", "Bulk delete" and "Copy constraints" buttons now appear beside Cancel.
- Bulk entry adds pasted domains as new rows (Does not match by default), Bulk delete removes every row matching the pasted domains, and Copy constraints copies all values to the clipboard.
- Replaces the standalone "Netskope Bulk Constraint Entry" and "Netskope Bulk Constraint Delete" scripts; uninstall those after updating. Can be toggled in settings like all other features.

Version 1.19.1:
- Fixed a startup error that could stop the toolkit from loading on some page loads.
- SMTP "Fill with Block Headers" now targets the header field next to the trigger and asks before overwriting existing text.
- "Remove Older Than" now only removes entries with a YYYY-MM-DD date, and keeps blank lines in URL lists.
- Fixed settings rows not refreshing their highlight, and extended dark mode fixes to the name prompt and filter fields.

Version 1.19:
- Added a ? Help button to the toolkit settings panel that opens a visual Feature Guide covering all eight toolkit features and the settings controls.

Version 1.18.2:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.18.1:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.18:
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
        #ns-username-overlay, #ns-username-modal, #nsToolkitChangelogModal,
        #nsToolkitHelpModal {
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
        #ns-username-modal input, #ns-username-modal select,
        #ns-username-modal textarea,
        #ns-view-log-modal input, #ns-url-log-view-modal input,
        #ns-remove-older-confirm input {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #ns-steering-remover-btn {
            background-color: #ffffff !important;
            color: #da291c !important;
        }
    `;
    // At document-start neither head nor even documentElement is guaranteed to exist yet
    (function appendDarkModeStyle() {
        const parent = document.head || document.documentElement;
        if (parent) parent.appendChild(darkModeStyle);
        else setTimeout(appendDarkModeStyle, 10);
    })();

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
            key:         'refOpenButtons',
            label:       '↗ Profile Reference Open Buttons',
            description: 'Adds open-in-new-tab buttons to what a DLP Profile or DLP Rule uses: DLP Rules, Fingerprint Rules and File Classifiers (Content Rules step), File Profiles and Entities (Overview panel). The new tab finds and opens the item for you.',
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
        {
            key:         'bulkConstraints',
            label:       '📥 Bulk Constraint Tools',
            description: 'In the user constraint profile editor, adds "Bulk entry", "Bulk delete" and "Copy constraints" buttons beside Cancel (old modal) or Save (new side panel).',
            credit:      'Contributed by Sameena K.',
        },
        {
            key:         'steeringRemover',
            label:       '🧹 Steering Exception Domain Remover',
            description: 'On the Steering Configuration page, adds a "Bulk remove domains" button. Paste domains, pick the steering configurations, check where they are listed as exceptions, and remove them in one go.',
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

        const headerRight = document.createElement('div');
        Object.assign(headerRight.style, { display: 'flex', alignItems: 'center', gap: '8px' });

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif',
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();

        headerRight.appendChild(helpBtn);
        headerRight.appendChild(closeBtn);
        headerRow.appendChild(headerRight);
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
        subtitle.textContent = 'Toggle features on or off. Changes are saved across sessions and take effect after reloading the page.';
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
        function buildFeatureRow({ key, label, description, credit }, indented) {
            const row = document.createElement('div');
            row.className = 'nstk-feature-row';
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
                    if (key === 'refOpenButtons') removeAll('.' + REF_OPEN_BTN_CLASS);
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
                    if (key === 'bulkConstraints') cleanupBulkConstraintTools();
                    if (key === 'steeringRemover') cleanupSteeringRemover();
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

            // Optional contributor credit, shown as a footer line on the row
            if (credit) {
                const creditEl = document.createElement('div');
                creditEl.textContent = '✨ ' + credit;
                Object.assign(creditEl.style, {
                    fontSize: '11px', fontWeight: 'bold', color: '#3949ab',
                    marginTop: '8px', paddingTop: '6px',
                    borderTop: '1px dashed #c5cae9',
                });
                textBlock.appendChild(creditEl);
            }
            row.appendChild(textBlock);

            row.addEventListener('click', (e) => { if (e.target !== toggle) toggle.click(); });

            updateRowStyle(row, toggle.checked);
            return row;
        }

        /* ── Standalone feature rows ── */
        const STANDALONE_KEYS = ['copyButtons', 'openButtons', 'refOpenButtons', 'smtpAutofill', 'saveReminder', 'dlpCharCounter', 'bulkConstraints', 'steeringRemover'];
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

    // ─────────────────────────────────────────────────────────────
    // FEATURE GUIDE MODAL
    // ─────────────────────────────────────────────────────────────

    function showHelpModal() {
        if (document.getElementById('nsToolkitHelpModal')) return;

        // lead: single orienting sentence at the top of a section.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif',
            });
            body.appendChild(p);
        }

        // bullets: compact list with purple dot markers.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif',
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

        // caption: small italic note placed under a visual.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif',
            });
            body.appendChild(c);
        }

        // span: inline element with optional styles. Returned, not appended.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: horizontal flex row for side-by-side mocks.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0',
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: small colored rounded label.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: '4px', padding: '3px 8px',
                fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block',
            });
            return c;
        }

        // toolSquare: rounded icon tile resembling a real toolbar button.
        function toolSquare(content, opts) {
            opts = opts || {};
            const sq = document.createElement('div');
            Object.assign(sq.style, {
                width: '30px', height: '30px', borderRadius: '8px',
                background: opts.bg || '#f3f4f6', border: opts.border || '2px solid transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', flexShrink: '0', position: 'relative',
            });
            sq.textContent = content;
            if (opts.dot) {
                const dot = document.createElement('span');
                Object.assign(dot.style, {
                    position: 'absolute', top: '-3px', right: '-3px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#ff8c00', border: '1px solid #fff',
                });
                sq.appendChild(dot);
            }
            return sq;
        }

        // menuSep: thin vertical divider between toolbar groups.
        function menuSep() {
            const s = document.createElement('div');
            Object.assign(s.style, { width: '1px', height: '22px', background: '#e5e7eb', flexShrink: '0' });
            return s;
        }

        // menuMock: white card wrapping toolbar icon tiles.
        function menuMock(items) {
            const menu = document.createElement('div');
            Object.assign(menu.style, {
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            });
            items.forEach(i => menu.appendChild(i));
            return menu;
        }

        // toggle: checkbox preview with an optional per-control description.
        function toggle(label, on, desc) {
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            const box = document.createElement('span');
            Object.assign(box.style, {
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: '0',
                border: on ? 'none' : '1px solid #b0b0b0',
                background: on ? '#667eea' : '#fff', color: '#fff',
                fontSize: '11px', lineHeight: '15px', textAlign: 'center', display: 'inline-block',
            });
            box.textContent = on ? '✓' : '';
            wrap.appendChild(hrow([box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' })], { margin: '0' }));
            if (desc) wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px' }));
            return wrap;
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Click the shield icon in the floating toolbar to open the NS Policies Toolkit settings panel.');

                    body.appendChild(hrow([
                        menuMock([
                            toolSquare('📊'), menuSep(),
                            toolSquare('🛡', { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '2px solid #667eea' }),
                            menuSep(),
                            toolSquare('📝'), toolSquare('🔗'),
                        ]),
                    ], { marginBottom: '10px' }));
                    caption(body, 'The toolkit registers as a shield icon in the floating toolbar.');

                    bullets(body, [
                        'A pulsing dot on the shield icon means a new version is available. Open settings to see what is new.',
                        'The first time you use the toolkit you will be prompted to enter your name. It is saved and auto-filled in all log entry modals.',
                        'Toggle each feature on or off in the settings panel. Changes take effect after reloading the page.',
                    ]);
                },
            },
            {
                icon: '📋',
                title: 'Chirp Copy Buttons',
                buildContent(body) {
                    lead(body, 'A 📋 copy button appears inside every blue tag in Netskope policy pickers for one-click profile name copying.');

                    const tagWrap = document.createElement('div');
                    tagWrap.style.marginBottom = '10px';
                    const tag = document.createElement('div');
                    Object.assign(tag.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#1976d2', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '12px',
                        fontFamily: 'Arial, sans-serif', fontWeight: 'bold',
                    });
                    const tagLabel = document.createElement('span');
                    tagLabel.textContent = 'DLP-Block-US-PII-v3';
                    tagLabel.style.color = '#fff';
                    const copyIcon = document.createElement('span');
                    copyIcon.textContent = '📋';
                    Object.assign(copyIcon.style, {
                        padding: '1px 4px', border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '3px', background: 'rgba(255,255,255,0.15)', fontSize: '11px',
                    });
                    tag.appendChild(copyIcon);
                    tag.appendChild(tagLabel);
                    tagWrap.appendChild(tag);
                    body.appendChild(tagWrap);
                    caption(body, 'The 📋 button sits in front of the name in each blue picker tag, so it stays visible even when a long name is cut short.');

                    bullets(body, [
                        'The full name is copied even when the tag only shows part of it.',
                        'The (custom) and (predefined) label suffix is stripped automatically before copying.',
                        'The button turns green (✓) after a successful copy and red (✗) if the clipboard is unavailable.',
                    ]);
                },
            },
            {
                icon: '↗',
                title: 'DLP Profile Open Buttons',
                buildContent(body) {
                    lead(body, 'An ↗ open button appears on tags inside DLP Profile = criteria rows, letting you jump to that profile in a new tab.');

                    const criteriaWrap = document.createElement('div');
                    Object.assign(criteriaWrap.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '10px 14px', marginBottom: '10px', fontFamily: 'Arial, sans-serif',
                    });
                    const criteriaLabel = document.createElement('div');
                    criteriaLabel.textContent = 'DLP Profile =';
                    Object.assign(criteriaLabel.style, { fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 'bold' });
                    criteriaWrap.appendChild(criteriaLabel);

                    const tag2 = document.createElement('div');
                    Object.assign(tag2.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#1976d2', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '12px',
                        fontFamily: 'Arial, sans-serif', fontWeight: 'bold',
                    });
                    const tagLabel2 = document.createElement('span');
                    tagLabel2.textContent = 'DLP-Block-US-PII-v3';
                    tagLabel2.style.color = '#fff';
                    tag2.appendChild(tagLabel2);
                    const openIcon = document.createElement('span');
                    openIcon.textContent = '↗';
                    Object.assign(openIcon.style, {
                        padding: '1px 5px', border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '3px', background: 'rgba(255,255,255,0.15)', fontSize: '12px',
                    });
                    tag2.appendChild(openIcon);
                    criteriaWrap.appendChild(tag2);
                    body.appendChild(criteriaWrap);

                    bullets(body, [
                        'Only appears on tags within DLP Profile = rows, not on all picker tags across the page.',
                        'Clicking ↗ opens the Netskope DLP Profiles page filtered to that profile name in a new tab.',
                    ]);
                },
            },
            {
                icon: '🔗',
                title: 'Profile Reference Open Buttons',
                buildContent(body) {
                    lead(body, 'Inside a DLP Profile or DLP Rule, an ↗ button opens each rule, classifier, profile or entity it uses.');

                    const btnStyle = {
                        padding: '1px 5px', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '3px',
                        background: 'rgba(255,255,255,0.15)', fontSize: '11px',
                    };
                    const wrap = document.createElement('div');
                    Object.assign(wrap.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '10px 14px', marginBottom: '10px', fontFamily: 'Arial, sans-serif',
                    });
                    const stepLabel = document.createElement('div');
                    stepLabel.textContent = 'Content Rules  ·  DLP Rules';
                    Object.assign(stepLabel.style, { fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 'bold' });
                    wrap.appendChild(stepLabel);
                    const chip = document.createElement('div');
                    Object.assign(chip.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: '#1976d2', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '12px', fontWeight: 'bold',
                    });
                    ['↗', '📋'].forEach(icon => {
                        const b = document.createElement('span');
                        b.textContent = icon;
                        Object.assign(b.style, btnStyle);
                        chip.appendChild(b);
                    });
                    const chipName = document.createElement('span');
                    chipName.textContent = 'ES - Policy 8_1_1 - CKW 01 - DLPRULE';
                    chipName.style.color = '#fff';
                    chip.appendChild(chipName);
                    wrap.appendChild(chip);

                    const overviewLabel = document.createElement('div');
                    overviewLabel.textContent = 'Overview  ·  File Profiles';
                    Object.assign(overviewLabel.style, { fontSize: '11px', color: '#888', margin: '10px 0 4px 0', fontWeight: 'bold' });
                    wrap.appendChild(overviewLabel);
                    const overviewItem = document.createElement('div');
                    Object.assign(overviewItem.style, { fontSize: '12px', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' });
                    const ovBtn = document.createElement('span');
                    ovBtn.textContent = '↗';
                    Object.assign(ovBtn.style, { padding: '1px 5px', border: '1px solid #ccc', borderRadius: '3px', background: '#f5f5f5', fontSize: '11px' });
                    const ovName = document.createElement('span');
                    ovName.textContent = 'ES - Policy 8_1_1 - FT - FILEPRO';
                    overviewItem.append(ovBtn, ovName);
                    wrap.appendChild(overviewItem);
                    body.appendChild(wrap);

                    bullets(body, [
                        'In a DLP Profile: on DLP Rules, Fingerprint Rules and File Classifiers (Content Rules step, Advanced mode included) and on File Profiles (Overview panel).',
                        'In a DLP Rule: on each Custom or Dictionary Identifier listed in the Overview panel.',
                        'Clicking ↗ opens the matching page in a new tab, searches for the exact name and opens it for you. If it cannot be found, the list stays filtered so you can pick it yourself.',
                    ]);
                },
            },
            {
                icon: '✉',
                title: 'SMTP Header Auto-Fill',
                buildContent(body) {
                    lead(body, 'A "Fill with Block Headers" button appears next to the "Add SMTP Header" action trigger on email-type policy pages.');

                    const btnShowRow = document.createElement('div');
                    Object.assign(btnShowRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0',
                    });
                    const smtpBadge = document.createElement('span');
                    smtpBadge.textContent = 'Fill with Block Headers';
                    Object.assign(smtpBadge.style, {
                        background: '#0073e6', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                    });
                    const smtpDesc = document.createElement('span');
                    smtpDesc.textContent = 'Appears next to the "Add SMTP Header" link in email policy action configurations.';
                    Object.assign(smtpDesc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    btnShowRow.appendChild(smtpBadge);
                    btnShowRow.appendChild(smtpDesc);
                    body.appendChild(btnShowRow);

                    const box = document.createElement('div');
                    Object.assign(box.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#333', marginBottom: '8px',
                    });
                    box.innerHTML = 'X-Netskope-Action: Block<br>X-Netskope-Policy: {{NS_DLP_PROFILE}}';
                    body.appendChild(box);
                    caption(body, 'The two headers inserted into the SMTP header textarea.');

                    bullets(body, [
                        'Replace {{NS_DLP_PROFILE}} manually with the actual DLP profile name after filling.',
                    ]);
                },
            },
            {
                icon: '💾',
                title: 'Save Reminder Checklist',
                buildContent(body) {
                    lead(body, 'Clicking Save on a policy page shows a checklist to confirm the description is complete before the save proceeds.');

                    const checkWrap = document.createElement('div');
                    Object.assign(checkWrap.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '12px 14px', marginBottom: '10px',
                    });
                    const checkTitle = document.createElement('div');
                    checkTitle.textContent = '💾 Before you save…';
                    Object.assign(checkTitle.style, {
                        fontWeight: 'bold', fontSize: '13px', color: '#e65100',
                        marginBottom: '8px', fontFamily: 'Arial, sans-serif',
                    });
                    checkWrap.appendChild(checkTitle);

                    const checkItems = [
                        { icon: '🎫', text: 'RITM number' },
                        { icon: '👤', text: 'Creator name & creation date' },
                        { icon: '✏️',  text: 'Editor name & modification date' },
                    ];
                    for (const item of checkItems) {
                        const r = document.createElement('div');
                        Object.assign(r.style, {
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: '#fff8f0', border: '1px solid #ffcc80',
                            borderRadius: '5px', padding: '6px 10px',
                            fontSize: '12px', marginBottom: '4px', fontFamily: 'Arial, sans-serif',
                        });
                        const ic = document.createElement('span');
                        ic.textContent = item.icon;
                        const tx = document.createElement('span');
                        tx.textContent = item.text;
                        r.appendChild(ic); r.appendChild(tx);
                        checkWrap.appendChild(r);
                    }

                    const mockBtnRow = document.createElement('div');
                    Object.assign(mockBtnRow.style, { display: 'flex', gap: '8px', marginTop: '10px' });
                    mockBtnRow.appendChild(chip('← Go back', '#e0e0e0', { color: '#333', border: '1px solid #ccc' }));
                    mockBtnRow.appendChild(chip('Save anyway →', '#e65100'));
                    checkWrap.appendChild(mockBtnRow);
                    body.appendChild(checkWrap);

                    bullets(body, [
                        'Only activates on inline policy pages and endpoint DLP pages, not on other Netskope pages.',
                        'Click "Save anyway" to skip the reminder and save immediately.',
                    ]);
                },
            },
            {
                icon: '📝',
                title: 'Description Log Buttons',
                buildContent(body) {
                    lead(body, 'Two buttons appear below the description field of policies, custom categories, and destination profiles for structured change tracking.');

                    const btnRowEl = document.createElement('div');
                    Object.assign(btnRowEl.style, { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' });
                    btnRowEl.appendChild(chip('+ Add Log Entry', '#0073e6'));
                    btnRowEl.appendChild(chip('📋 View Log', '#4caf50'));
                    body.appendChild(btnRowEl);

                    const box = document.createElement('div');
                    Object.assign(box.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#333',
                        marginBottom: '8px', overflowX: 'auto', whiteSpace: 'nowrap',
                    });
                    box.textContent = 'RITM1234567 | 2026-06-16 | Jane Smith | Blocked social media domains';
                    body.appendChild(box);
                    caption(body, 'Each log entry follows the format: RITM | Date | Name | Description.');

                    bullets(body, [
                        '"Add Log Entry" opens a form to fill in the RITM, date (auto-filled today), name (auto-filled from settings), and a description. The entry is appended to the textarea.',
                        '"View Log" shows all entries as cards with RITM, date, and user badges. Filter by RITM number or date range.',
                        'Use "Remove Older Than" in the View Log panel to clean up entries before a chosen date.',
                    ]);
                },
            },
            {
                icon: '📜',
                title: 'URL List History Buttons',
                buildContent(body) {
                    lead(body, 'On URL list edit pages, three buttons appear below the URL textarea for tracking domain changes over time.');

                    const btnRowEl = document.createElement('div');
                    Object.assign(btnRowEl.style, { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' });
                    btnRowEl.appendChild(chip('+ Log Entry', '#0073e6'));
                    btnRowEl.appendChild(chip('🗑 Delete Selected', '#e53935'));
                    btnRowEl.appendChild(chip('📜 View History', '#4caf50'));
                    body.appendChild(btnRowEl);

                    bullets(body, [
                        '"+ Log Entry" inserts a #RITM | Date | Name header at your cursor position. Add the domains below it.',
                        '"Delete Selected" comments out the highlighted domains with a # prefix and inserts a Deleted log header above them.',
                        '"View History" shows all change groups with their domains, filterable by RITM and date range.',
                    ]);
                },
            },
            {
                icon: '🔒',
                title: 'SSL Decryption Removal Entry',
                buildContent(body) {
                    lead(body, 'On SSL Decryption policy pages, an "+ Add Removal Entry" button appears alongside the description log buttons.');

                    const btnRowEl = document.createElement('div');
                    Object.assign(btnRowEl.style, { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' });
                    btnRowEl.appendChild(chip('+ Add Log Entry', '#0073e6'));
                    btnRowEl.appendChild(chip('+ Add Removal Entry', '#e53935'));
                    btnRowEl.appendChild(chip('📋 View Log', '#4caf50'));
                    body.appendChild(btnRowEl);

                    const box = document.createElement('div');
                    Object.assign(box.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#333',
                        marginBottom: '8px', overflowX: 'auto', whiteSpace: 'nowrap',
                    });
                    box.textContent = '#RITM1234567 | 2026-06-16 | Jane Smith | Removed | domain1.com, domain2.com';
                    body.appendChild(box);
                    caption(body, 'Format: #RITM | Date | Name | Removed | domains (optional).');

                    bullets(body, [
                        'The entry is inserted at your cursor position in the description textarea.',
                        'On SSL pages, the "Add Log Entry" modal relabels the description field to "Domain Changes" to reflect the context.',
                    ]);
                },
            },
            {
                icon: '🔢',
                title: 'DLP Entity Character Counter',
                buildContent(body) {
                    lead(body, 'A live character count appears below the regex or keyword input field in the DLP Edit Entity modal.');

                    const mockInputWrap = document.createElement('div');
                    Object.assign(mockInputWrap.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '12px 14px', marginBottom: '10px',
                    });
                    const mockInput = document.createElement('div');
                    Object.assign(mockInput.style, {
                        border: '1px solid #ccc', borderRadius: '4px',
                        padding: '6px 10px', background: '#fff',
                        fontSize: '12px', color: '#333', fontFamily: 'monospace', marginBottom: '4px',
                    });
                    mockInput.textContent = '\\b[A-Z]{2}[0-9]{6}\\b';
                    const counterEl = document.createElement('div');
                    counterEl.textContent = 'Characters: 18';
                    Object.assign(counterEl.style, {
                        fontSize: '12px', color: '#666', fontFamily: 'Arial, sans-serif', marginTop: '4px',
                    });
                    mockInputWrap.appendChild(mockInput);
                    mockInputWrap.appendChild(counterEl);
                    body.appendChild(mockInputWrap);

                    bullets(body, [
                        'The count updates live as you type and also tracks programmatic value changes.',
                        'Useful for staying within Netskope character limits on regex patterns and keyword lists.',
                    ]);
                },
            },
            {
                icon: '📥',
                title: 'Bulk Constraint Tools',
                buildContent(body) {
                    lead(body, 'In the user constraint profile editor, three buttons appear for working with many email or domain constraints at once: beside Cancel in the old modal, or beside Save in the header of the new side panel.');

                    const btnRowEl = document.createElement('div');
                    Object.assign(btnRowEl.style, { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' });
                    btnRowEl.appendChild(chip('Bulk entry', '#fff', { color: '#333', border: '1px solid #a7a8aa' }));
                    btnRowEl.appendChild(chip('🗑️ Bulk delete', '#fff', { color: '#da291c', border: '1px solid #da291c' }));
                    btnRowEl.appendChild(chip('Copy constraints', '#fff', { color: '#333', border: '1px solid #a7a8aa' }));
                    btnRowEl.appendChild(chip('Cancel', '#e0e0e0', { color: '#333', border: '1px solid #ccc' }));
                    body.appendChild(btnRowEl);
                    caption(body, 'Old modal: buttons sit before Cancel in the footer. New side panel: buttons sit before Save in the header.');

                    bullets(body, [
                        '"Bulk entry": paste domains one per line. Each is added as a new row set to "Does not match" (untick the option to use "Matches"). Duplicates are skipped and you confirm before anything is inserted.',
                        '"Bulk delete": paste domains one per line. Every row matching each domain is removed; domains that are not in the profile are skipped and counted.',
                        '"Copy constraints": copies every value in the profile to the clipboard, optionally with the Matches / Does not match operator and with duplicates removed.',
                        'Changes are made in the form only. Click Save in the profile modal to keep them.',
                        'Contributed by Sameena K.',
                    ]);
                },
            },
            {
                icon: '🧹',
                title: 'Steering Exception Domain Remover',
                buildContent(body) {
                    lead(body, 'On the Steering Configuration page, remove a list of domains from the exceptions of one or more steering configurations at once.');

                    body.appendChild(hrow([
                        chip('🧹 Bulk remove domains', '#fff', { color: '#da291c', border: '1px solid #da291c' }),
                        chip('+ New Exception', '#0073e6'),
                    ], { marginBottom: '6px' }));
                    caption(body, 'The button sits next to New Exception. If that button cannot be found, it floats in the bottom right corner instead.');

                    const card = document.createElement('div');
                    Object.assign(card.style, { border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', margin: '12px 0 4px 0' });
                    const head = document.createElement('div');
                    Object.assign(head.style, {
                        display: 'flex', justifyContent: 'space-between', padding: '7px 12px',
                        background: '#f7f7f7', fontSize: '12px', fontWeight: 'bold', color: '#333',
                        fontFamily: 'Arial, sans-serif',
                    });
                    head.appendChild(span('ES - Steering Config'));
                    head.appendChild(span('2 of 3 found in 2 entries', { fontWeight: 'normal', color: '#777' }));
                    card.appendChild(head);
                    [
                        { kind: 'Edit entry',   bg: '#e08a00', name: '"RITM0847844"', note: 'Removes logmein.eu. Keeps its other 16 domains.' },
                        { kind: 'Delete entry', bg: '#da291c', name: '"TEST"',        note: 'Removes test.cat. Every domain in this entry was requested, so the whole entry is deleted.' },
                    ].forEach(r => {
                        const row = document.createElement('div');
                        Object.assign(row.style, { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 12px', borderTop: '1px solid #f0f0f0' });
                        const box = span('✓', {
                            width: '14px', height: '14px', borderRadius: '3px', background: '#667eea', color: '#fff',
                            fontSize: '10px', lineHeight: '14px', textAlign: 'center', flexShrink: '0', marginTop: '2px',
                        });
                        const text = document.createElement('div');
                        text.appendChild(span(r.name, { fontSize: '12px', fontWeight: 'bold', color: '#333', display: 'block' }));
                        text.appendChild(span(r.note, { fontSize: '11px', color: '#777', display: 'block' }));
                        row.appendChild(box);
                        row.appendChild(chip(r.kind, r.bg));
                        row.appendChild(text);
                        card.appendChild(row);
                    });
                    const nf = span('Not present: example.org', {
                        display: 'block', padding: '6px 12px', borderTop: '1px solid #f0f0f0', fontSize: '11px', color: '#555',
                    });
                    card.appendChild(nf);
                    body.appendChild(card);
                    caption(body, 'After Check: one card per configuration. Untick any entry you want to leave as it is.');

                    const steps = [
                        { bg: '#005587', label: 'Check',  desc: 'Reads the exceptions and shows where each domain is listed. Nothing changes yet.' },
                        { bg: '#da291c', label: 'Remove', desc: 'Click twice to confirm. Netskope applies it straight away, there is no Save step.' },
                        { bg: 'transparent', color: '#333', border: '1px solid #a7a8aa', label: '↩ Restore last backup', desc: 'Puts the entries back as they were before the last removal.' },
                    ];
                    for (const s of steps) {
                        const srow = hrow([
                            chip(s.label, s.bg, { color: s.color, border: s.border }),
                            span(s.desc, { fontSize: '12px', color: '#555' }),
                        ], { flexWrap: 'nowrap', margin: '10px 0 0 0' });
                        body.appendChild(srow);
                    }

                    bullets(body, [
                        'Matching is exact. A domain only removes the same value, so example.com leaves *.example.com alone. Wildcard entries that cover a domain are listed as similar entries but never removed.',
                        'Only the requested domains are taken out of an entry. The entry is deleted only when it holds nothing else.',
                        'Configurations show in the list once you have opened them. Open the Steering Configuration list once so all of them appear. The one open now is ticked for you.',
                        'When it finishes, it checks again that the domains are gone and gives you a summary to copy into the ticket, plus a backup file to download.',
                    ]);
                },
            },
            {
                icon: '⚙️',
                title: 'Settings',
                buildContent(body) {
                    lead(body, 'Open the settings panel by clicking the shield icon in the toolbar, then use the controls inside.');

                    const headerButtons = [
                        { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' },
                        { bg: '#e53935',     color: '#fff',    border: 'none',              label: '✕',      desc: 'Closes the settings panel.' },
                    ];
                    for (const item of headerButtons) {
                        const brow = document.createElement('div');
                        Object.assign(brow.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0',
                        });
                        const badge = document.createElement('span');
                        badge.textContent = item.label;
                        Object.assign(badge.style, {
                            background: item.bg, color: item.color, border: item.border,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0',
                            fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start',
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = item.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        brow.appendChild(badge);
                        brow.appendChild(descEl);
                        body.appendChild(brow);
                    }

                    const nameRowMock = document.createElement('div');
                    Object.assign(nameRowMock.style, {
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '8px 12px', marginBottom: '8px',
                    });
                    nameRowMock.appendChild(span('👤 Your Name', { fontSize: '12px', fontWeight: 'bold', color: '#333' }));
                    const nameInputMock = document.createElement('div');
                    Object.assign(nameInputMock.style, {
                        flex: '1', border: '1px solid #ccc', borderRadius: '4px',
                        padding: '4px 8px', background: '#fff',
                        fontSize: '12px', color: '#999', fontFamily: 'Arial, sans-serif', fontStyle: 'italic',
                    });
                    nameInputMock.textContent = 'Your full name';
                    nameRowMock.appendChild(nameInputMock);
                    nameRowMock.appendChild(chip('Save', '#1a73e8'));
                    body.appendChild(nameRowMock);
                    caption(body, 'Your name is auto-filled in all Add Log Entry and deletion modals.');

                    const togglesWrap = document.createElement('div');
                    togglesWrap.style.marginTop = '10px';
                    togglesWrap.appendChild(toggle('📋 Chirp Copy Buttons',          true, 'Copy buttons on all blue picker tags.'));
                    togglesWrap.appendChild(toggle('↗ DLP Profile Open Buttons', true, 'Open-in-new-tab on DLP Profile = tags.'));
                    togglesWrap.appendChild(toggle('↗ Profile Reference Open Buttons', true, 'Open what a DLP Profile or DLP Rule uses: rules, classifiers, file profiles and entities.'));
                    togglesWrap.appendChild(toggle('✉ SMTP Header Auto-Fill',    true, 'Fill with Block Headers button next to Add SMTP Header.'));
                    togglesWrap.appendChild(toggle('💾 Save Reminder Checklist',      true, 'Checklist when you click Save on a policy page.'));
                    togglesWrap.appendChild(toggle('🔢 DLP Entity Character Counter', true, 'Live character count in the DLP Edit Entity input.'));
                    togglesWrap.appendChild(toggle('📥 Bulk Constraint Tools',        true, 'Bulk entry, bulk delete and copy in the constraint profile modal.'));

                    const logGroup = document.createElement('div');
                    Object.assign(logGroup.style, {
                        background: '#eef2ff', border: '1px solid #c5cae9', borderRadius: '6px',
                        padding: '8px 12px', marginBottom: '8px',
                    });
                    const logGroupLabel = document.createElement('div');
                    logGroupLabel.textContent = '📋 Log Buttons (collapsible group in settings)';
                    Object.assign(logGroupLabel.style, {
                        fontWeight: 'bold', fontSize: '12px', color: '#3949ab',
                        marginBottom: '8px', fontFamily: 'Arial, sans-serif',
                    });
                    logGroup.appendChild(logGroupLabel);
                    logGroup.appendChild(toggle('📝 Description Log Buttons', true, 'Add Log Entry and View Log on policy descriptions.'));
                    logGroup.appendChild(toggle('📜 URL List History Buttons', true, 'Log entry, delete, and view history on URL list pages.'));
                    logGroup.appendChild(toggle('🔒 SSL Decryption Removal Entry', true, 'Add Removal Entry button on SSL Decryption pages.'));
                    togglesWrap.appendChild(logGroup);
                    body.appendChild(togglesWrap);
                },
            },
        ];

        /* ── Overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'nsToolkitHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '1000000',
        });

        /* ── Modal ── */
        const modal = document.createElement('div');
        modal.id = 'nsToolkitHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '1000001',
            background: '#fff', border: '2px solid #333',
            padding: '20px', borderRadius: '10px',
            width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333333',
            fontFamily: 'Arial, sans-serif', boxSizing: 'border-box',
        });

        /* ── Header ── */
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px',
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
        titleSub.textContent = `NS Policies Toolkit • v${SCRIPT_VERSION}`;
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
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif',
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };

        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        /* ── Section cards (all start expanded) ── */
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden',
            });

            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0',
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
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999',
                transition: 'transform 0.2s', display: 'inline-block',
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

        /* ── Close button ── */
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white', border: 'none',
            borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px', fontFamily: 'Arial, sans-serif',
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

    function showSettingsModal() {
        buildSettingsModal(); // idempotent

        // Sync checkboxes to current GM values (may have changed in another tab)
        FEATURES.forEach(({ key }) => {
            const toggle = document.getElementById(`toolkit-toggle-${key}`);
            if (toggle) {
                toggle.checked = getSetting(key);
                const row = toggle.closest('.nstk-feature-row');
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

            // The title holds the full name when the visible text is cut short
            let profileName = labelSpan.getAttribute('title') || labelSpan.textContent.trim();
            if (!profileName) return;
            profileName = profileName.replace(/\s*\((custom|predefined)\)\s*$/i, '').trim();

            const copyBtn = document.createElement('button');
            copyBtn.className = 'dlp-copy-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy profile name';
            copyBtn.style.cssText = `
                margin-right: 4px; padding: 1px 4px;
                border: 1px solid #ccc; border-radius: 3px;
                background: #f5f5f5; cursor: pointer;
                font-size: 11px; display: inline-block;
                vertical-align: middle; line-height: 1;
                flex-shrink: 0;
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

            // In front of the name, outside it: long names are cut with "…"
            // and anything inside or after the name would be cut with them.
            labelSpan.insertAdjacentElement('beforebegin', copyBtn);
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

                // Netskope matches profile_name exactly, leading spaces included, so
                // keep the title as is and only drop the "(custom)/(predefined)" tag.
                const rawName = labelSpan.getAttribute('title') || labelSpan.textContent.trim();
                if (!rawName.trim()) return;
                const isPredefined = /\(predefined\)\s*$/i.test(rawName);
                const exactName = rawName.replace(/\s*\((custom|predefined)\)\s*$/i, '');

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

                    // profile_type defaults to custom on Netskope's side
                    const url = `${window.location.origin}/ns#/profiles?profile_name=${encodeURIComponent(exactName)}`
                              + (isPredefined ? '&profile_type=predefined' : '');
                    // If Netskope still cannot find it, the new tab falls back to searching the list
                    GM_setValue(PENDING_OPEN_KEY, JSON.stringify({ kind: 'dlpProfile', name: exactName.trim(), ts: Date.now() }));
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
    // FEATURE — PROFILE REFERENCE OPEN BUTTONS
    // Inside the Edit DLP Profile modal, adds ↗ to the DLP Rules and
    // Fingerprint Rules chips and to the File Profiles listed in the
    // Overview panel. None of these open by name from a URL, so the
    // button stores a "pending open" in GM (shared by all tabs) and opens
    // the list page in a new tab; that tab searches for the exact name and
    // clicks it. DLP Rules could open by rule_id, but getting the id needs
    // the console API, while the name is right there on screen.
    // ─────────────────────────────────────────────────────────────

    const REF_OPEN_BTN_CLASS = 'nstk-ref-open-btn';
    const PENDING_OPEN_KEY   = 'toolkit_pendingRefOpen';
    const PENDING_OPEN_TTL   = 30000;

    // Search box and result cell of the DLP Rules / Fingerprint Rules lists
    const RULE_LIST_SEARCH = 'input[placeholder="Search keywords"]';
    const RULE_LIST_CELL   = 'td.ns__rule_name span.clickable';

    const REF_KINDS = {
        dlpRule: {
            label: 'DLP Rule',
            url:   () => '/ns#/inspection?view=dlp',
            isListRoute: hash => /[?&]view=dlp(&|$)/.test(hash) && !/subview=/.test(hash),
            searchSelector: RULE_LIST_SEARCH,
            cellSelector:   RULE_LIST_CELL,
        },
        fingerprintRule: {
            label: 'Fingerprint Rule',
            url:   () => '/ns#/inspection?view=fingerprint',
            isListRoute: hash => /[?&]view=fingerprint(&|$)/.test(hash) && !/subview=/.test(hash),
            searchSelector: RULE_LIST_SEARCH,
            cellSelector:   RULE_LIST_CELL,
        },
        dlpProfile: {
            label: 'DLP Profile',
            url:   name => '/ns#/profiles?profile_name=' + encodeURIComponent(name),
            isListRoute: hash => hash.startsWith('#/profiles'),
            // The URL usually opens it; only search the list if Netskope reports it missing
            onlyIfError: /Could not find the DLP profile/i,
            searchSelector: 'section.dlp-profiles input[placeholder="Search keywords"]',
            cellSelector:   'td.ns__profile_name a.clickable',
        },
        entity: {
            label: 'Entity',
            url:   () => '/ns#/inspection?view=dlp&subview=entities',
            isListRoute: hash => /[?&]subview=entities(&|$)/.test(hash),
            searchSelector: 'section.dlp-dictionary ns-search-input.search-query input',
            cellSelector:   'td.ns__obj_name span.clickable',
        },
        fileClassifier: {
            label: 'File Classifier',
            // classifier=<exact name> opens its side panel. Chips do not say whether a
            // classifier is predefined or custom, so try predefined first.
            url:   name => '/ns#/inspection?view=fileClassifiers&subview=predefined&classifier=' + encodeURIComponent(name),
            isListRoute: hash => /[?&]view=fileClassifiers(&|$)/.test(hash),
            openedSelector: '[data-testid$="ClassifierPanel-sidepanel"]',
            retryHash: name => '#/inspection?view=fileClassifiers&subview=custom&classifier=' + encodeURIComponent(name),
        },
        fileProfile: {
            label: 'File Profile',
            // The list reads ?query=(file_filter_profile eq|like '<name>') on load.
            // A quote would end the value early, so fall back to a partial match.
            url: name => {
                const q = name.includes("'")
                    ? `(file_filter_profile like '${name.split("'")[0]}')`
                    : `(file_filter_profile eq '${name}')`;
                return '/ns#/file-filter-profile?query=' + encodeURIComponent(q);
            },
            isListRoute: hash => hash.startsWith('#/file-filter-profile'),
            searchSelector: null,
            cellSelector:   'td.scroll-table__td.clickable',
        },
    };

    function openReference(kindKey, name) {
        const kind = REF_KINDS[kindKey];
        const clean = (name || '').trim();
        if (!kind || !clean) return;
        GM_setValue(PENDING_OPEN_KEY, JSON.stringify({ kind: kindKey, name: clean, ts: Date.now() }));
        window.open(window.location.origin + kind.url(clean), '_blank');
    }

    function makeRefOpenButton(kindKey, name) {
        const kind = REF_KINDS[kindKey];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = REF_OPEN_BTN_CLASS;
        btn.textContent = '↗';
        btn.title = `Open this ${kind.label} in a new tab`;
        btn.style.cssText = `
            margin-right: 4px; padding: 1px 5px;
            border: 1px solid #ccc; border-radius: 3px;
            background: #f5f5f5; color: #333; cursor: pointer;
            font-size: 11px; display: inline-block;
            vertical-align: middle; line-height: 1; flex-shrink: 0;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.background = '#e0e0e0'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = '#f5f5f5'; });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openReference(kindKey, name);
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = '↗'; }, 1000);
        });
        return btn;
    }

    function injectRefOpenButtons() {
        if (!getSetting('refOpenButtons')) return;

        // Content Rules step: chips in the rule pickers
        // (also inside "Advanced" mode condition blocks, which reuse these pickers)
        [['ns-dlp-rule-picker', 'dlpRule'], ['ns-dlp-fingerprint-rule-picker', 'fingerprintRule'],
         ['ns-dlp-file-classifier-picker', 'fileClassifier']].forEach(([picker, kindKey]) => {
            document.querySelectorAll(`${picker} .ns-picker-tag`).forEach(tag => {
                if (tag.querySelector('.' + REF_OPEN_BTN_CLASS)) return;
                const label = tag.querySelector('.ng-value-label');
                if (!label) return;
                const name = (label.getAttribute('title') || label.textContent).trim();
                if (!name) return;
                // In front of the name, like the copy button, so long names cannot hide it
                label.insertAdjacentElement('beforebegin', makeRefOpenButton(kindKey, name));
            });
        });

        // Overview panels (visible in every step): File Profiles of a DLP Profile,
        // and the entities of a DLP Rule, listed as "(C0) - name" / "(D0) - name"
        const entityName = text => (text.match(/^\s*\((?:C|D)\d+\)\s*-\s*(.+?)\s*$/) || [])[1] || null;
        const OVERVIEW_REFS = {
            'File Profiles':          { kind: 'fileProfile', name: text => /^(matches|does not match|none|all)$/i.test(text) ? null : text },
            'Custom Identifiers':     { kind: 'entity',      name: entityName },
            'Dictionary Identifiers': { kind: 'entity',      name: entityName },
        };
        document.querySelectorAll('[data-test-id="ns-overview-section-title"]').forEach(title => {
            const ref = OVERVIEW_REFS[title.textContent.trim()];
            if (!ref) return;
            const list = title.closest('.parent')?.nextElementSibling;
            if (!list) return;
            list.querySelectorAll('li[data-test-id="ns-overview-section-data-value"]').forEach(li => {
                if (li.querySelector('.' + REF_OPEN_BTN_CLASS)) return;
                const text = li.textContent.trim();
                const name = text && ref.name(text);
                if (!name) return;
                li.insertBefore(makeRefOpenButton(ref.kind, name), li.firstChild);
            });
        });
    }

    function showRefNotice(text) {
        document.getElementById('nstk-ref-notice')?.remove();
        const note = document.createElement('div');
        note.id = 'nstk-ref-notice';
        note.textContent = text;
        Object.assign(note.style, {
            position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
            zIndex: '1000002', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107',
            borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '560px'
        });
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 6000);
    }

    // New tab side: if a pending open was left for this list page, search
    // for the exact name and click it.
    function consumePendingRefOpen() {
        let pending = null;
        try { pending = JSON.parse(GM_getValue(PENDING_OPEN_KEY, 'null')); } catch (e) { pending = null; }
        if (!pending) return;
        if (Date.now() - pending.ts > PENDING_OPEN_TTL) { GM_deleteValue(PENDING_OPEN_KEY); return; }
        const kind = REF_KINDS[pending.kind];
        if (!kind || !kind.isListRoute(window.location.hash)) return;
        GM_deleteValue(PENDING_OPEN_KEY);
        runPendingRefOpen(kind, pending.name);
    }

    async function runPendingRefOpen(kind, name) {
        let deadline = Date.now() + 25000;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const waitFor = async (find) => {
            while (Date.now() < deadline) {
                const found = find();
                if (found) return found;
                await sleep(300);
            }
            return null;
        };

        if (kind.openedSelector) {
            // Opened by the URL itself; only check it worked
            deadline = Date.now() + 8000;
            if (await waitFor(() => document.querySelector(kind.openedSelector))) return;
            if (kind.retryHash) {
                window.location.hash = kind.retryHash(name);   // this page reacts to hash changes
                deadline = Date.now() + 8000;
                if (await waitFor(() => document.querySelector(kind.openedSelector))) return;
            }
            showRefNotice(`Could not open ${kind.label} "${name}". Search for it in the list.`);
            return;
        }

        if (kind.onlyIfError) {
            // Give the direct URL time to work; act only if the error shows up
            deadline = Date.now() + 10000;
            const failed = await waitFor(() => kind.onlyIfError.test(document.body.innerText));
            if (!failed) return;
            deadline = Date.now() + 25000;
        }

        if (kind.searchSelector) {
            const input = await waitFor(() => document.querySelector(kind.searchSelector));
            if (!input) { showRefNotice(`Could not find the search box to open ${kind.label} "${name}".`); return; }
            input.focus();
            input.value = name;
            // This list filters on input + keyup (input alone is not enough)
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }

        // Some names carry a leading space in Netskope, so compare trimmed text
        const cell = await waitFor(() =>
            [...document.querySelectorAll(kind.cellSelector)].find(el => el.textContent.trim() === name));
        if (!cell) {
            showRefNotice(`Could not find ${kind.label} "${name}". The list is filtered so you can pick it yourself.`);
            return;
        }
        cell.click();
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

            // The header field shares its classes with the policy description, so take
            // the matching textarea closest to the trigger rather than the first on the page.
            const SMTP_TA_SELECTOR = 'textarea.policy-description-container.ns-form-textarea';
            let textarea = null;
            for (let el = triggerEl.parentElement; el && !textarea; el = el.parentElement) {
                textarea = el.querySelector(SMTP_TA_SELECTOR);
            }
            if (!textarea) {
                alert('Could not find the SMTP header textarea. Make sure the panel is open.');
                return;
            }
            const existingText = textarea.value.trim();
            if (existingText && existingText !== SMTP_HEADERS &&
                !confirm('The target field already contains text:\n\n' + existingText.slice(0, 200) +
                         (existingText.length > 200 ? '…' : '') + '\n\nOverwrite it with the block headers?')) {
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
        'textarea#dest-description',            // Destination Profiles side panel (aria-label is just "textarea")
        'textarea[aria-label*="description" i]',
    ];

    // Log dates are compared as strings, which is only valid for YYYY-MM-DD.
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    function isOlderThan(date, cutoff) {
        return ISO_DATE_RE.test(date || '') && date < cutoff;
    }

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
                (cutoff) => logEntries.filter(e => isOlderThan(e.date, cutoff)).length,
                (cutoff) => {
                    const newLines = textarea.value.split('\n').filter(line => {
                        const parts = line.split('|').map(p => p.trim());
                        return !(parts.length >= 4 && isOlderThan(parts[1], cutoff));
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
                (cutoff) => allGroups.filter(g => !g.isOrphan && isOlderThan(g.date, cutoff)).length,
                (cutoff) => {
                    // Walk lines directly (same header rule as parseUrlListLog) so blank
                    // lines inside kept groups survive.
                    let keepGroup = true;
                    const keepLines = textarea.value.split('\n').filter(line => {
                        const trimmed = line.trim();
                        if (/^#\w/.test(trimmed)) {
                            const date = (trimmed.slice(1).split('|')[1] || '').trim();
                            keepGroup = !isOlderThan(date, cutoff);
                        }
                        return keepGroup;
                    });
                    setAngularValue(textarea, keepLines.join('\n').replace(/\n{3,}/g, '\n\n').trim());
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
    // FEATURE 9 — BULK CONSTRAINT TOOLS  (contributed by Sameena K.)
    // "Bulk entry", "Bulk delete" and "Copy constraints" buttons in the user
    // constraint profile editor. Netskope runs two UIs side by side:
    //   - old: Angular modal (#activities-constraint-modal), buttons beside Cancel
    //   - new: React side panel, buttons beside Save in the panel header
    // ─────────────────────────────────────────────────────────────

    const BC_PRIMARY_ID       = 'activities-constraint-modal';
    const BC_PANEL_SELECTOR   = '[data-testid="user-constraint-profile-form-panel-sidepanel"]';
    const BC_LIST_SELECTOR    = '[data-testid="constraint-profile-email-list-wrapper"]';
    // Button IDs match the original standalone scripts so a copy of those
    // that is still installed never adds a second set of buttons.
    const BC_ENTRY_BUTTON_ID  = 'bulk-constraint-entry-button';
    const BC_DELETE_BUTTON_ID = 'bulk-constraint-delete-button';
    const BC_COPY_BUTTON_ID   = 'bulk-constraint-copy-button';
    const BC_HOST_ID          = 'nstk-bulk-constraint-host';
    const BC_EMAIL_SELECTOR   =
        `${BC_LIST_SELECTOR} input[name="email.key"], ` +                         // old modal
        `${BC_LIST_SELECTOR} input[name^="userConditions."][name$=".email"]`;     // new side panel
    const BC_DROPDOWN_SELECTOR =
        '[role="combobox"], button[aria-label="Match type"], button[aria-haspopup="menu"]';

    const bc = {
        host:        null,
        shadow:      null,
        observer:    null,
        busy:        false,
        constraints: [],
        lastButton:  null,
    };

    const bcWait      = ms => new Promise(resolve => setTimeout(resolve, ms));
    const bcNormalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const bcKey       = value => bcNormalize(value).toLowerCase();

    function bcIsVisible(el) {
        if (!el || !el.getClientRects().length) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function bcGetModal() {
        const modal = document.getElementById(BC_PRIMARY_ID);
        if (bcIsVisible(modal)) return modal;
        return [...document.querySelectorAll(BC_PANEL_SELECTOR)].find(bcIsVisible) || null;
    }

    const bcIsPanel = modal => !!modal && modal.matches(BC_PANEL_SELECTOR);

    // Old UI rows are <li>; new UI rows are the direct children of the list wrapper
    function bcGetRow(input) {
        const li = input.closest('li') || input.closest("[role='listitem']");
        if (li) return li;
        let el = input;
        while (el.parentElement && !el.parentElement.matches(BC_LIST_SELECTOR)) el = el.parentElement;
        return el.parentElement ? el : null;
    }

    function bcGetRowDropdown(row) {
        return row ? row.querySelector(BC_DROPDOWN_SELECTOR) : null;
    }

    function bcGetInputs(modal) {
        return [...modal.querySelectorAll(BC_EMAIL_SELECTOR)];
    }

    function bcFindVisible(root, selector, test) {
        return [...root.querySelectorAll(selector)].filter(bcIsVisible).find(test);
    }

    // Our buttons go immediately before this one: Cancel (old modal) or Save (new panel)
    function bcGetAnchorButton(modal) {
        if (bcIsPanel(modal)) {
            return bcFindVisible(modal, 'button',
                b => b.getAttribute('aria-label') === 'Save' || bcNormalize(b.textContent) === 'Save');
        }
        return bcFindVisible(modal, 'footer button, [mat-dialog-actions] button',
            b => bcNormalize(b.textContent) === 'Cancel');
    }

    function bcGetAddButton(modal) {
        return bcFindVisible(modal, "a[role='button'], button",
            b => /^\+?\s*Add Another$/i.test(bcNormalize(b.textContent)));
    }

    function bcSetStatus(id, message, isError) {
        const status = bc.shadow?.getElementById(id);
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('error', !!isError);
    }

    function bcParseEntries(text) {
        const seen = new Set();
        return String(text)
            .split(/\r?\n/)
            .map(v => v.replace(/^﻿/, '').trim())
            .filter(v => {
                const key = bcKey(v);
                if (!v || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    /* ── Overlay open / close ── */

    function bcShowView(view) {
        ['bulk', 'copy', 'delete'].forEach(v => {
            bc.shadow.getElementById(`bc-${v}-view`).hidden = v !== view;
        });
        bc.host.dataset.open = 'true';
        bc.host.removeAttribute('aria-hidden');
    }

    function bcClose() {
        if (!bc.host) return;
        bc.shadow?.activeElement?.blur?.();
        bc.host.dataset.open = 'false';
        bc.host.setAttribute('aria-hidden', 'true');
        if (bc.lastButton?.isConnected) bc.lastButton.focus({ preventScroll: true });
    }

    function bcOpen(view, button) {
        if (!bcGetModal()) {
            console.warn('[NS Toolkit] Open the user constraint profile modal first.');
            return;
        }
        bc.lastButton = button;

        if (view === 'bulk') {
            const textarea = bc.shadow.getElementById('bc-bulk-textarea');
            textarea.value = '';
            bc.shadow.getElementById('bc-bulk-does-not-match').checked = true;
            bcSetStatus('bc-bulk-status', '');
            bcShowView('bulk');
            setTimeout(() => textarea.focus(), 0);
        } else if (view === 'delete') {
            const textarea = bc.shadow.getElementById('bc-delete-textarea');
            textarea.value = '';
            bcSetStatus('bc-delete-status', '');
            bcShowView('delete');
            setTimeout(() => textarea.focus(), 0);
        } else {
            bc.constraints = bcReadConstraints();
            bcSetStatus('bc-copy-status',
                bc.constraints.length ? '' : 'No constraints found in this profile.',
                !bc.constraints.length);
            bcRefreshCopyPreview();
            bcShowView('copy');
            setTimeout(() => bc.shadow.querySelector('.copy-action')?.focus(), 0);
        }
    }

    /* ── Copy constraints ── */

    function bcGetDropdownText(dropdown) {
        const placeholder = dropdown.querySelector('.placeholder');
        return bcNormalize(placeholder ? placeholder.textContent : dropdown.textContent);
    }

    function bcReadConstraints() {
        const modal = bcGetModal();
        if (!modal) return [];
        return bcGetInputs(modal)
            .map(input => {
                const dropdown = bcGetRowDropdown(bcGetRow(input));
                return {
                    operator: dropdown ? bcGetDropdownText(dropdown) : '',
                    value:    input.value.trim(),
                };
            })
            .filter(item => item.value);
    }

    function bcBuildCopyLines() {
        const includeOperator = bc.shadow.getElementById('bc-copy-include-operator').checked;
        const dedupe          = bc.shadow.getElementById('bc-copy-dedupe').checked;
        const seen  = new Set();
        const lines = [];
        for (const item of bc.constraints) {
            const line = includeOperator ? `${item.operator}: ${item.value}` : item.value;
            const key  = line.toLowerCase();
            if (dedupe && seen.has(key)) continue;
            seen.add(key);
            lines.push(line);
        }
        return lines;
    }

    function bcRefreshCopyPreview() {
        const lines = bcBuildCopyLines();
        bc.shadow.getElementById('bc-copy-preview').value = lines.join('\n');
        bc.shadow.getElementById('bc-copy-count').textContent =
            `${lines.length} constraint${lines.length === 1 ? '' : 's'} to copy`;
        bc.shadow.querySelector('.copy-action').disabled = !lines.length;
    }

    async function bcCopyConstraints() {
        const lines = bcBuildCopyLines();
        if (!lines.length) { bcSetStatus('bc-copy-status', 'Nothing to copy.', true); return; }

        const text = lines.join('\n');
        let ok;
        try {
            await navigator.clipboard.writeText(text);
            ok = true;
        } catch {
            const preview = bc.shadow.getElementById('bc-copy-preview');
            preview.focus();
            preview.select();
            try { ok = document.execCommand('copy'); } catch { ok = false; }
        }

        if (ok) {
            bcSetStatus('bc-copy-status',
                `Copied ${lines.length} constraint${lines.length === 1 ? '' : 's'} to the clipboard.`);
        } else {
            bcSetStatus('bc-copy-status', 'Clipboard blocked. Text is selected; press Ctrl+C to copy.', true);
        }
    }

    /* ── Bulk entry ── */

    function bcSetInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        input.focus();
        setter.call(input, value);
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur',   { bubbles: true }));
    }

    function bcChoiceMatches(actual, target) {
        const actualText = bcKey(actual);
        const targetText = bcKey(target);
        if (targetText === 'does not match') return /^does not match(?:es)?$/.test(actualText);
        return actualText === targetText;
    }

    function bcFindDropdownOption(target, dropdown) {
        const menus = [...document.querySelectorAll(".dropdown-menu-wrapper, [role='listbox'], [role='menu']")]
            .filter(bcIsVisible);
        return menus
            .flatMap(menu => [menu, ...menu.querySelectorAll('*')])
            .filter(el =>
                el !== dropdown &&
                bcIsVisible(el) &&
                !bc.host?.contains(el) &&
                bcChoiceMatches(el.textContent, target)
            )
            .sort((a, b) => a.children.length - b.children.length)[0];
    }

    // Old UI combobox opens on click. The new UI's menu button may open on
    // pointerdown (Radix-style) or on click, so press first and only click if
    // it did not open — clicking an already-open menu would close it again.
    async function bcOpenDropdown(dropdown) {
        if (dropdown.getAttribute('role') === 'combobox') {
            dropdown.click();
            return;
        }
        dropdown.scrollIntoView({ block: 'center' });
        const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
        dropdown.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }));
        dropdown.dispatchEvent(new MouseEvent('mousedown', opts));
        await bcWait(150);
        if (dropdown.getAttribute('aria-expanded') === 'true') return;
        dropdown.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
        dropdown.dispatchEvent(new MouseEvent('mouseup', opts));
        dropdown.click();
    }

    async function bcSelectDropdown(row, target) {
        const dropdown = bcGetRowDropdown(row);
        if (!dropdown) throw new Error('Could not find the row dropdown.');
        if (bcChoiceMatches(bcGetDropdownText(dropdown), target)) return;

        await bcOpenDropdown(dropdown);
        await bcWait(250);

        const timeout = Date.now() + 5000;
        let option = null;
        while (!option && Date.now() < timeout) {
            option = bcFindDropdownOption(target, dropdown);
            if (!option) await bcWait(100);
        }
        if (!option) throw new Error(`Could not find the "${target}" option.`);

        option.click();
        while (Date.now() < timeout && !bcChoiceMatches(bcGetDropdownText(dropdown), target)) {
            await bcWait(100);
        }
        if (!bcChoiceMatches(bcGetDropdownText(dropdown), target)) {
            throw new Error(`Dropdown did not change to "${target}".`);
        }
    }

    async function bcWaitForInputCount(expectedCount) {
        const timeout = Date.now() + 5000;
        while (Date.now() < timeout) {
            const modal = bcGetModal();
            if (modal && bcGetInputs(modal).length >= expectedCount) return;
            await bcWait(100);
        }
        throw new Error('Timed out waiting for a new form row.');
    }

    async function bcGetNextEmptyInput() {
        const modal = bcGetModal();
        if (!modal) throw new Error('The profile modal is no longer open.');

        const inputs = bcGetInputs(modal);
        const emptyInput = inputs.find(input => !input.value.trim());
        if (emptyInput) return emptyInput;

        const addButton = bcGetAddButton(modal);
        if (!addButton) throw new Error('Could not find the "+ Add Another" button.');

        addButton.click();
        await bcWaitForInputCount(inputs.length + 1);

        const updated = bcGetInputs(bcGetModal());
        return updated[updated.length - 1];
    }

    async function bcInsertEntries() {
        if (bc.busy) return;

        const textarea = bc.shadow.getElementById('bc-bulk-textarea');
        const checkbox = bc.shadow.getElementById('bc-bulk-does-not-match');
        const insertBtn = bc.shadow.querySelector('.insert');
        const entries = bcParseEntries(textarea.value);

        if (!entries.length) { bcSetStatus('bc-bulk-status', 'Paste at least one domain first.', true); return; }

        const target = checkbox.checked ? 'Does not match' : 'Matches';
        if (!window.confirm([
            `Insert ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}?`,
            `First: ${entries[0]}`,
            `Last: ${entries[entries.length - 1]}`,
            `Selection: ${target}`,
            '',
            'Continue?',
        ].join('\n'))) return;

        bc.busy = true;
        insertBtn.disabled = textarea.disabled = checkbox.disabled = true;

        try {
            for (let i = 0; i < entries.length; i++) {
                const input = await bcGetNextEmptyInput();
                const row = bcGetRow(input);
                if (!row) throw new Error('Could not find the current form row.');

                await bcSelectDropdown(row, target);
                bcSetInputValue(input, entries[i]);
                bcSetStatus('bc-bulk-status', `Inserted ${i + 1} of ${entries.length}: ${entries[i]}`);
                await bcWait(150);
            }
            textarea.value = '';
            bcSetStatus('bc-bulk-status', `Completed ${entries.length} entries as "${target}".`);
        } catch (error) {
            console.error('[NS Toolkit] Bulk entry:', error);
            bcSetStatus('bc-bulk-status', `Stopped: ${error.message}`, true);
        } finally {
            insertBtn.disabled = textarea.disabled = checkbox.disabled = false;
            bc.busy = false;
        }
    }

    /* ── Bulk delete ── */

    function bcGetControlLabel(control) {
        return bcNormalize([
            control.getAttribute('aria-label'),
            control.getAttribute('title'),
            control.getAttribute('data-testid'),
            control.textContent,
            String(control.className || ''),
        ].filter(Boolean).join(' '));
    }

    function bcFindDeleteControl(row) {
        // New UI has a dedicated remove button per row
        const direct = row.querySelector('[data-testid^="remove-condition-btn"], button[aria-label="Remove email entry"]');
        if (direct && bcIsVisible(direct)) return direct;

        const candidates = [...row.querySelectorAll(
            "button, a[role='button'], [role='button'], [aria-label], [title], [data-testid], " +
            "[class*='delete' i], [class*='remove' i], [class*='trash' i]"
        )].filter(bcIsVisible);

        const explicit = candidates.find(c => /(delete|remove|trash)/i.test(bcGetControlLabel(c)));
        if (explicit) return explicit;

        // Fall back to the row's only other control, if it is unambiguous
        const fallback = candidates.filter(c =>
            c.getAttribute('role') !== 'combobox' &&
            !/add another|save|cancel|matches|does not match/.test(bcGetControlLabel(c).toLowerCase())
        );
        return fallback.length === 1 ? fallback[0] : null;
    }

    function bcGetMatchingInputs(modal, targetKey) {
        return bcGetInputs(modal).filter(input => bcKey(input.value) === targetKey);
    }

    async function bcWaitForOneMatchToDisappear(targetKey, beforeCount) {
        const timeout = Date.now() + 5000;
        while (Date.now() < timeout) {
            const modal = bcGetModal();
            if (!modal) throw new Error('The profile modal was closed.');
            if (bcGetMatchingInputs(modal, targetKey).length < beforeCount) return;
            await bcWait(100);
        }
        throw new Error('The matching row did not disappear after clicking its delete control.');
    }

    async function bcDeleteAllMatchesForDomain(domain) {
        const targetKey = bcKey(domain);
        let deleted = 0;

        while (true) {
            const modal = bcGetModal();
            if (!modal) throw new Error('The profile modal was closed.');

            const matching = bcGetMatchingInputs(modal, targetKey);
            if (!matching.length) return deleted;

            const row = bcGetRow(matching[0]);
            if (!row) throw new Error(`Could not find the row for "${domain}".`);

            const deleteControl = bcFindDeleteControl(row);
            if (!deleteControl) throw new Error(`Could not find the delete control for "${domain}".`);

            deleteControl.click();
            await bcWaitForOneMatchToDisappear(targetKey, matching.length);
            deleted++;
        }
    }

    async function bcDeleteEntries() {
        if (bc.busy) return;

        const modal     = bcGetModal();
        const textarea  = bc.shadow.getElementById('bc-delete-textarea');
        const deleteBtn = bc.shadow.querySelector('.delete');

        if (!modal) { bcSetStatus('bc-delete-status', 'Open the user constraint profile first.', true); return; }

        const entries = bcParseEntries(textarea.value);
        if (!entries.length) { bcSetStatus('bc-delete-status', 'Paste at least one domain first.', true); return; }

        const inputs       = bcGetInputs(modal);
        const existingKeys = new Set(inputs.map(input => bcKey(input.value)).filter(Boolean));
        const entryKeys    = new Set(entries.map(bcKey));
        const missingCount = entries.filter(e => !existingKeys.has(bcKey(e))).length;
        const rowsToDelete = inputs.filter(input => entryKeys.has(bcKey(input.value))).length;

        if (!rowsToDelete) {
            bcSetStatus('bc-delete-status',
                `No matching domains found. Total domains: ${entries.length}. Missing domains: ${missingCount}.`, true);
            return;
        }

        if (!window.confirm([
            'Bulk delete confirmation',
            '',
            `Total domains provided: ${entries.length}`,
            `Missing domains: ${missingCount}`,
            `Rows to delete: ${rowsToDelete}`,
            '',
            'Continue deleting the matching rows?',
        ].join('\n'))) {
            bcSetStatus('bc-delete-status', 'Deletion cancelled.');
            return;
        }

        bc.busy = true;
        deleteBtn.disabled = textarea.disabled = true;
        let deletedCount = 0;
        bcSetStatus('bc-delete-status', `Deleting ${rowsToDelete} matching row${rowsToDelete === 1 ? '' : 's'}...`);

        try {
            for (const domain of entries) {
                const deletedForDomain = await bcDeleteAllMatchesForDomain(domain);
                deletedCount += deletedForDomain;
                if (deletedForDomain) {
                    bcSetStatus('bc-delete-status', `Deleted ${deletedCount} of ${rowsToDelete} rows...`);
                }
            }
            textarea.value = '';
            bcSetStatus('bc-delete-status',
                `Completed. Deleted ${deletedCount} row${deletedCount === 1 ? '' : 's'}. Missing domains: ${missingCount}.`);
        } catch (error) {
            console.error('[NS Toolkit] Bulk delete:', error);
            bcSetStatus('bc-delete-status',
                `Stopped after deleting ${deletedCount} row${deletedCount === 1 ? '' : 's'}: ${error.message}`, true);
        } finally {
            deleteBtn.disabled = textarea.disabled = false;
            bc.busy = false;
        }
    }

    /* ── Overlay (shadow DOM keeps Netskope styles out) ── */

    function bcCreateHost() {
        const host   = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const sheet  = new CSSStyleSheet();

        host.id = BC_HOST_ID;
        host.dataset.open = 'false';
        host.setAttribute('aria-hidden', 'true');

        sheet.replaceSync(`
            :host {
                all: initial;
                position: fixed !important;
                inset: 0 !important;
                z-index: 2147483647 !important;
                display: block !important;
                pointer-events: none;
                font-family: Arial, sans-serif;
            }
            :host([data-open="false"]) { display: none !important; }
            :host([data-open="true"])  { pointer-events: auto; }

            .backdrop {
                position: fixed; inset: 0;
                display: flex; align-items: center; justify-content: center;
                padding: 24px; box-sizing: border-box;
                background: rgba(0, 0, 0, .48);
            }
            .backdrop[hidden] { display: none; }

            .panel {
                display: flex; flex-direction: column;
                width: min(640px, calc(100vw - 32px));
                max-height: calc(100vh - 48px);
                overflow: hidden; box-sizing: border-box;
                color: #282728; background: #fff;
                border: 1px solid #d5d5d5; border-top: 5px solid #86bc25;
                border-radius: 6px;
                box-shadow: 0 8px 28px rgba(0, 0, 0, .3);
            }
            .panel.danger { border-top-color: #da291c; }

            .header, .footer {
                display: flex; align-items: center; gap: 8px;
                flex: 0 0 auto; padding: 16px 20px; box-sizing: border-box;
            }
            .header { justify-content: space-between; border-bottom: 1px solid #e6e6e6; }
            .header h2 { margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 700; }

            .close {
                padding: 2px 8px; color: #53565a; background: transparent;
                border: 0; font-size: 24px; line-height: 1; cursor: pointer;
            }

            .body { overflow: auto; padding: 20px; box-sizing: border-box; }

            .label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; }

            textarea {
                display: block; width: 100%; min-height: 240px;
                box-sizing: border-box; padding: 10px; resize: vertical;
                border: 1px solid #a7a8aa; border-radius: 4px;
                color: #282728; background: #fff;
                font: 14px Arial, sans-serif;
            }
            textarea[readonly] {
                background: #f6f6f6;
                font-family: Consolas, "Courier New", monospace;
                font-size: 13px; white-space: pre;
            }
            textarea:focus { outline: 2px solid #86bc25; }
            .danger textarea:focus { outline-color: #da291c; outline-offset: 1px; }

            .option { display: flex; gap: 8px; align-items: center; margin-top: 16px; font-size: 14px; }
            .options-row { display: flex; flex-wrap: wrap; gap: 4px 24px; }

            .help  { margin-top: 8px; color: #53565a; font-size: 13px; }
            .count { margin-top: 12px; color: #53565a; font-size: 13px; }

            .status { min-height: 20px; margin-top: 12px; color: #005587; font-size: 13px; }
            .status.error { color: #da291c; }

            .footer { justify-content: flex-end; border-top: 1px solid #e6e6e6; }
            .footer button {
                min-width: 84px; padding: 9px 18px; border-radius: 4px;
                font-weight: 600; cursor: pointer;
            }
            .cancel { color: #282728; background: #fff; border: 1px solid #a7a8aa; }
            .insert, .copy-action { color: #fff; background: #6b9a1e; border: 1px solid #6b9a1e; }
            .delete { color: #fff; background: #da291c; border: 1px solid #da291c; }

            button:disabled, textarea:disabled { cursor: wait; opacity: .6; }
        `);

        shadow.adoptedStyleSheets = [sheet];

        shadow.innerHTML = `
            <div class="backdrop" id="bc-bulk-view" hidden>
                <section class="panel" role="dialog" aria-modal="true" aria-labelledby="bc-bulk-title">
                    <header class="header">
                        <h2 id="bc-bulk-title">Bulk entry</h2>
                        <button type="button" class="close" data-action="close" aria-label="Close bulk entry">×</button>
                    </header>
                    <main class="body">
                        <label class="label" for="bc-bulk-textarea">Paste domains, one per line</label>
                        <textarea id="bc-bulk-textarea" placeholder="*@example.com&#10;*@another-example.com"></textarea>
                        <label class="option">
                            <input id="bc-bulk-does-not-match" type="checkbox" checked>
                            <span>Use "Does not match"</span>
                        </label>
                        <div id="bc-bulk-status" class="status" role="status" aria-live="polite"></div>
                    </main>
                    <footer class="footer">
                        <button type="button" class="cancel" data-action="close">Cancel</button>
                        <button type="button" class="insert" data-action="insert">Insert</button>
                    </footer>
                </section>
            </div>

            <div class="backdrop" id="bc-delete-view" hidden>
                <section class="panel danger" role="dialog" aria-modal="true" aria-labelledby="bc-delete-title">
                    <header class="header">
                        <h2 id="bc-delete-title">Bulk delete</h2>
                        <button type="button" class="close" data-action="close" aria-label="Close bulk delete">×</button>
                    </header>
                    <main class="body">
                        <label class="label" for="bc-delete-textarea">Paste domains to delete, one per line</label>
                        <textarea id="bc-delete-textarea" placeholder="*@example.com&#10;*@another-example.com"></textarea>
                        <div class="help">Only matching entries will be deleted. Missing entries will be skipped.</div>
                        <div id="bc-delete-status" class="status" role="status" aria-live="polite"></div>
                    </main>
                    <footer class="footer">
                        <button type="button" class="cancel" data-action="close">Cancel</button>
                        <button type="button" class="delete" data-action="delete">Delete</button>
                    </footer>
                </section>
            </div>

            <div class="backdrop" id="bc-copy-view" hidden>
                <section class="panel" role="dialog" aria-modal="true" aria-labelledby="bc-copy-title">
                    <header class="header">
                        <h2 id="bc-copy-title">Copy constraints</h2>
                        <button type="button" class="close" data-action="close" aria-label="Close copy constraints">×</button>
                    </header>
                    <main class="body">
                        <label class="label" for="bc-copy-preview">Constraints in this profile</label>
                        <textarea id="bc-copy-preview" readonly></textarea>
                        <div class="options-row">
                            <label class="option">
                                <input id="bc-copy-include-operator" type="checkbox">
                                <span>Include "Matches / Does not match"</span>
                            </label>
                            <label class="option">
                                <input id="bc-copy-dedupe" type="checkbox" checked>
                                <span>Remove duplicates</span>
                            </label>
                        </div>
                        <div id="bc-copy-count" class="count"></div>
                        <div id="bc-copy-status" class="status" role="status" aria-live="polite"></div>
                    </main>
                    <footer class="footer">
                        <button type="button" class="cancel" data-action="close">Close</button>
                        <button type="button" class="copy-action" data-action="copy">Copy</button>
                    </footer>
                </section>
            </div>
        `;

        // Keep clicks inside the overlay from reaching Netskope's modal handlers
        ['pointerdown', 'mousedown', 'click'].forEach(name => {
            shadow.addEventListener(name, e => e.stopPropagation());
        });

        shadow.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'close')  bcClose();
            if (action === 'insert') bcInsertEntries();
            if (action === 'delete') bcDeleteEntries();
            if (action === 'copy')   bcCopyConstraints();
        });

        shadow.addEventListener('change', (e) => {
            const id = e.target?.id;
            if (id === 'bc-copy-include-operator' || id === 'bc-copy-dedupe') {
                bcRefreshCopyPreview();
                bcSetStatus('bc-copy-status', '');
            }
        });

        // Escape closes the overlay only; it must not reach (and close) the Netskope modal
        shadow.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            if (!bc.busy) bcClose();
        });

        document.body.appendChild(host);
        bc.host   = host;
        bc.shadow = shadow;
    }

    /* ── Buttons beside Cancel (old modal) / Save (new panel) ── */

    function bcMakeButton(id, label, danger, view, panel) {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.textContent = label;
        if (panel) {
            // New UI is Tailwind-styled, so the old ns-btn classes do nothing there
            Object.assign(button.style, {
                padding: '6px 12px', fontSize: '13px', fontWeight: '600', lineHeight: '1.25',
                borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
                background: '#fff', color: danger ? '#da291c' : '#282728',
                border: '1px solid ' + (danger ? '#da291c' : '#a7a8aa'),
            });
        } else {
            button.className = 'ns-btn ns-btn-secondary ns-left mr-2' + (danger ? ' ns-color-red' : '');
        }
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            bcOpen(view, button);
        });
        return button;
    }

    function installBulkConstraintButtons() {
        const modal = bcGetModal();
        if (!modal) return;

        const hasEntry  = modal.querySelector('#' + BC_ENTRY_BUTTON_ID);
        const hasDelete = modal.querySelector('#' + BC_DELETE_BUTTON_ID);
        const hasCopy   = modal.querySelector('#' + BC_COPY_BUTTON_ID);
        if (hasEntry && hasDelete && hasCopy) return;

        const anchor = bcGetAnchorButton(modal);
        if (!anchor) return;
        const panel = bcIsPanel(modal);

        // Final order: [Bulk entry] [Bulk delete] [Copy constraints] [Cancel / Save]
        let entryButton = hasEntry;
        if (!entryButton) {
            entryButton = bcMakeButton(BC_ENTRY_BUTTON_ID, 'Bulk entry', false, 'bulk', panel);
            anchor.insertAdjacentElement('beforebegin', entryButton);
        }
        if (!hasCopy) {
            anchor.insertAdjacentElement('beforebegin',
                bcMakeButton(BC_COPY_BUTTON_ID, 'Copy constraints', false, 'copy', panel));
        }
        if (!hasDelete) {
            entryButton.insertAdjacentElement('afterend',
                bcMakeButton(BC_DELETE_BUTTON_ID, '🗑️ Bulk delete', true, 'delete', panel));
        }
    }

    function initBulkConstraintTools() {
        if (!getSetting('bulkConstraints') || bc.host) return;

        bcCreateHost();

        let scheduled = false;
        const scheduleInstall = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                installBulkConstraintButtons();
            });
        };

        bc.observer = new MutationObserver(scheduleInstall);
        bc.observer.observe(document.body, { childList: true, subtree: true });
        scheduleInstall();
        console.log('[NS Toolkit] Bulk constraint tools ready.');
    }

    function cleanupBulkConstraintTools() {
        bc.observer?.disconnect();
        bc.observer = null;
        removeAll(`#${BC_ENTRY_BUTTON_ID}, #${BC_DELETE_BUTTON_ID}, #${BC_COPY_BUTTON_ID}`);
        bc.host?.remove();
        bc.host = bc.shadow = null;
    }

    // ─────────────────────────────────────────────────────────────
    // STEERING EXCEPTION DOMAIN REMOVER
    // ─────────────────────────────────────────────────────────────
    //
    // Talks to the admin console's own steering exception endpoints with the
    // session the page is logged in with. Every call needs the page's request
    // token, which is not stored anywhere readable, so it is picked up from the
    // page's own outgoing requests (the console pings every few seconds).

    const SE_API         = '/settings/steering_exception/';
    const SE_CONFIGS_KEY = 'toolkit_steeringConfigs';   // { [config_id]: { name, trafficType } }
    const SE_BACKUP_KEY  = 'toolkit_steeringBackup';    // entries as they were before the last removal
    const SE_HOST_ID     = 'ns-steering-remover-host';
    const SE_BUTTON_ID   = 'ns-steering-remover-btn';
    const SE_RESOURCE    = 'settings.steering-configuration';
    const SE_MODE        = 'on_prem';

    const se = {
        token:          null,
        resource:       null,   // "resource" header of the page's latest request: tells us which page is open
        clientIdPrefix: null,
        currentConfig:  null,   // config_id the open page last asked about
        host:           null,
        shadow:         null,
        timer:          null,
        busy:           false,
        domains:        [],
        plan:           null,
        confirming:     false,
    };

    /* ── Learning from the page's own requests ── */

    function seGetConfigs() {
        try { return JSON.parse(GM_getValue(SE_CONFIGS_KEY, '{}')) || {}; } catch (e) { return {}; }
    }

    function seRememberConfigs(json) {
        const found = {};
        (function walk(v, depth) {
            if (!v || typeof v !== 'object' || depth > 6) return;
            if (Array.isArray(v)) { v.forEach(x => walk(x, depth + 1)); return; }
            if (v.config_id != null && typeof v.config_name === 'string') {
                found[String(v.config_id)] = { name: v.config_name, trafficType: v.traffic_type || 'web' };
            }
            Object.values(v).forEach(x => walk(x, depth + 1));
        })(json, 0);
        if (!Object.keys(found).length) return;
        GM_setValue(SE_CONFIGS_KEY, JSON.stringify(Object.assign(seGetConfigs(), found)));
        if (se.shadow && !se.busy) seRenderConfigList();
    }

    function seLearnFromRequest(url, body) {
        if (typeof body !== 'string' || body.indexOf('"token"') === -1) return;
        try {
            const json = JSON.parse(body);
            if (json.token) se.token = json.token;
            if (/steering/i.test(url) && json.config_id != null) se.currentConfig = String(json.config_id);
        } catch (e) { /* not JSON */ }
    }

    function seInstallSniffer() {
        const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const proto = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
        if (!proto || proto.__nstkSteering) return;
        proto.__nstkSteering = true;

        const origOpen = proto.open, origSend = proto.send, origHeader = proto.setRequestHeader;
        proto.open = function (method, url) {
            this.__nstkUrl = String(url || '');
            return origOpen.apply(this, arguments);
        };
        proto.setRequestHeader = function (name, value) {
            const n = String(name).toLowerCase();
            if (n === 'resource') se.resource = String(value);
            if (n === 'x-netskope-client-request-id' && /steering/i.test(this.__nstkUrl || '')) {
                se.clientIdPrefix = String(value).split('.')[0];
            }
            return origHeader.apply(this, arguments);
        };
        proto.send = function (body) {
            const url = this.__nstkUrl || '';
            seLearnFromRequest(url, body);
            if (/steering/i.test(url)) {
                this.addEventListener('load', () => {
                    try {
                        seRememberConfigs(this.responseType === 'json' ? this.response : JSON.parse(this.responseText));
                    } catch (e) { /* not JSON */ }
                });
            }
            return origSend.apply(this, arguments);
        };

        if (typeof w.fetch === 'function') {
            const origFetch = w.fetch;
            w.fetch = function (input, init) {
                try {
                    const url = typeof input === 'string' ? input : (input && input.url) || '';
                    seLearnFromRequest(url, init && init.body);
                } catch (e) { /* never block the page's request */ }
                return origFetch.apply(this, arguments);
            };
        }
    }

    // Must run before the console app starts so its first requests are seen
    if (getSetting('steeringRemover')) seInstallSniffer();

    /* ── API calls ── */

    function seRandomId() {
        return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }

    async function sePost(endpoint, payload) {
        if (!se.token) {
            throw new Error('The page has not sent its session token yet. Wait a few seconds and try again, or reload the page.');
        }
        const reqId  = seRandomId();
        const prefix = se.clientIdPrefix || btoa('/settings+steering_config+traffic');
        const res = await fetch(SE_API + endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'resource': SE_RESOURCE,
                'Netskope-req-id': reqId,
                'X-Netskope-Client-Request-Id': prefix + '.' + reqId,
            },
            body: JSON.stringify(Object.assign({}, payload, { token: se.token })),
        });
        if (!res.ok) throw new Error(`Netskope answered ${res.status} to ${endpoint}. Your session may have expired: reload the page.`);

        let json;
        try { json = await res.json(); } catch (e) { throw new Error(`Netskope sent an unexpected answer to ${endpoint}.`); }
        if (!json || json.status !== 'success') throw new Error(`Netskope refused ${endpoint}: ${(json && json.msg) || 'no reason given'}`);

        // Write calls wrap the backend's own result in a JSON string
        if (typeof json.data === 'string' && json.data.trim().startsWith('{')) {
            let inner = null;
            try { inner = JSON.parse(json.data); } catch (e) { /* plain text */ }
            if (inner && inner.status && inner.status !== 'success') {
                throw new Error(`Netskope refused ${endpoint}: ${inner.message || inner.status}`);
            }
        }
        return json.data;
    }

    function seListExceptions(configId) {
        const cfg = seGetConfigs()[configId] || {};
        return sePost('getBypassSettingsForConfig', {
            splitQueries: [], config_id: String(configId),
            dynamic_steering_mode: SE_MODE, traffic_type: cfg.trafficType || 'web',
        });
    }

    function seGetException(configId, rowId) {
        return sePost('getExceptionById', { config_id: String(configId), rowId: Number(rowId) });
    }

    // rowId null creates a new entry, otherwise the entry's domain list is replaced
    function seSaveDomains(configId, rowId, domains, notes) {
        const payload = { domains, config_id: String(configId), editRow: rowId != null, notes: notes || '' };
        if (rowId != null) payload.rowSelectionId = Number(rowId);
        return sePost('addNewDomainsToConfig', payload);
    }

    function seDeleteEntries(configId, rowIds) {
        const selectedRows = {};
        rowIds.forEach(id => { selectedRows[id] = true; });
        return sePost('deleteSelectedExceptions', {
            selectedRows, selectedAll: false, config_id: String(configId), dynamic_steering_mode: SE_MODE,
        });
    }

    /* ── Matching ── */

    function seNormalize(raw) {
        return String(raw || '').trim().toLowerCase()
            .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
            .split(/[/?#]/)[0]
            .replace(/:\d+$/, '')
            .replace(/\.+$/, '');
    }

    function seParseDomains(text) {
        const out = [];
        String(text || '').split(/[\s,;]+/).forEach(part => {
            const d = seNormalize(part);
            if (d && !out.includes(d)) out.push(d);
        });
        return out;
    }

    // Wildcard entries that cover a requested domain (or the reverse). Shown, never removed.
    function seIsRelated(requested, existing) {
        if (requested === existing) return false;
        const base = requested.replace(/^\*\./, '');
        if (existing.startsWith('*.')) {
            const eBase = existing.slice(2);
            return base === eBase || base.endsWith('.' + eBase);
        }
        return requested.startsWith('*.') && existing === base;
    }

    function seFirstLine(text, max) {
        const line = (String(text || '').split('\n').map(s => s.trim()).find(Boolean) || '').replace(/[\s,;:]+$/, '');
        return line.length > max ? line.slice(0, max - 1) + '…' : line;
    }

    function seEntryLabel(notes, rowId) {
        const n = seFirstLine(notes, 70);
        return n ? `"${n}"` : `entry #${rowId}`;
    }

    async function seBuildPlan(configIds, domains) {
        const configs = seGetConfigs();
        const wanted  = new Set(domains);
        const plan = [];
        for (const id of configIds) {
            const rows    = await seListExceptions(id);
            const entries = (Array.isArray(rows) ? rows : [])
                .filter(r => r.type === 'domain' && Array.isArray(r.display_value));
            const actions = [], related = [];
            for (const e of entries) {
                const values = e.display_value.map(seNormalize);
                const hits   = domains.filter(d => values.includes(d));
                if (hits.length) {
                    const keeps = values.filter(v => !wanted.has(v)).length;
                    actions.push({
                        rowId: e.settings_id, notes: e.notes || '', hits, keeps,
                        kind: keeps ? 'edit' : 'delete', selected: true,
                    });
                }
                for (const d of domains) {
                    values.filter(v => seIsRelated(d, v)).forEach(v => {
                        related.push({ requested: d, existing: v, label: seEntryLabel(e.notes, e.settings_id) });
                    });
                }
            }
            plan.push({
                configId: id,
                name: (configs[id] && configs[id].name) || `Configuration ${id}`,
                actions, related,
                notFound: domains.filter(d => !actions.some(a => a.hits.includes(d))),
            });
        }
        return plan;
    }

    /* ── Removal, backup and restore ── */

    async function seApplyPlan(plan, domains, progress) {
        const wanted = new Set(domains);
        const backup = { at: new Date().toISOString(), host: location.host, entries: [] };
        const log = [];

        for (const cfg of plan) {
            const chosen = cfg.actions.filter(a => a.selected);
            if (!chosen.length) continue;
            const toDelete = [];

            for (const a of chosen) {
                progress(`Reading ${seEntryLabel(a.notes, a.rowId)} in ${cfg.name}…`);
                // Re-read the entry so the edit is based on its exact current domains and notes
                const current = await seGetException(cfg.configId, a.rowId);
                const now     = (current && current.data && Array.isArray(current.data.domains)) ? current.data.domains : [];
                const notes   = current && current.notes != null ? current.notes : a.notes;
                const removed = now.filter(v => wanted.has(seNormalize(v)));
                const keep    = now.filter(v => !wanted.has(seNormalize(v)));
                if (!removed.length) {
                    log.push({ config: cfg.name, label: seEntryLabel(notes, a.rowId), kind: 'skipped', removed: [] });
                    continue;
                }

                backup.entries.push({ configId: cfg.configId, configName: cfg.name, rowId: a.rowId, notes, domains: now });
                GM_setValue(SE_BACKUP_KEY, JSON.stringify(backup));   // saved before every change

                if (keep.length) {
                    progress(`Removing ${removed.length} domain${removed.length === 1 ? '' : 's'} from ${seEntryLabel(notes, a.rowId)}…`);
                    await seSaveDomains(cfg.configId, a.rowId, keep, notes);
                    log.push({ config: cfg.name, label: seEntryLabel(notes, a.rowId), kind: 'edit', removed, keeps: keep.length });
                } else {
                    toDelete.push({ a, notes, removed });
                }
            }

            if (toDelete.length) {
                progress(`Deleting ${toDelete.length} entr${toDelete.length === 1 ? 'y' : 'ies'} in ${cfg.name}…`);
                await seDeleteEntries(cfg.configId, toDelete.map(t => t.a.rowId));
                toDelete.forEach(t => log.push({ config: cfg.name, label: seEntryLabel(t.notes, t.a.rowId), kind: 'delete', removed: t.removed }));
            }
        }

        // Read every touched configuration again to confirm the domains are gone
        const stillThere = [];
        for (const cfg of plan.filter(c => c.actions.some(a => a.selected))) {
            progress(`Checking ${cfg.name}…`);
            const rows = await seListExceptions(cfg.configId);
            (Array.isArray(rows) ? rows : []).filter(r => r.type === 'domain' && Array.isArray(r.display_value)).forEach(r => {
                const selectedHere = cfg.actions.some(a => a.selected && a.rowId === r.settings_id);
                r.display_value.map(seNormalize).filter(v => wanted.has(v)).forEach(v => {
                    if (selectedHere || cfg.actions.every(a => a.rowId !== r.settings_id)) {
                        stillThere.push(`${v} (${cfg.name})`);
                    }
                });
            });
        }
        return { log, stillThere, backup };
    }

    function seGetBackup() {
        try { return JSON.parse(GM_getValue(SE_BACKUP_KEY, 'null')); } catch (e) { return null; }
    }

    async function seRestoreBackup(backup, progress) {
        const existing = {};
        for (const entry of backup.entries) {
            if (!existing[entry.configId]) {
                const rows = await seListExceptions(entry.configId);
                existing[entry.configId] = new Set((Array.isArray(rows) ? rows : []).map(r => r.settings_id));
            }
            const stillExists = existing[entry.configId].has(entry.rowId);
            progress(`${stillExists ? 'Restoring' : 'Recreating'} ${seEntryLabel(entry.notes, entry.rowId)} in ${entry.configName}…`);
            await seSaveDomains(entry.configId, stillExists ? entry.rowId : null, entry.domains, entry.notes);
        }
    }

    function seBuildSummary(plan, result) {
        const lines = [`Steering exception domain removal (${new Date().toISOString().slice(0, 10)})`];
        const byConfig = {};
        result.log.forEach(l => { (byConfig[l.config] = byConfig[l.config] || []).push(l); });
        plan.forEach(cfg => {
            lines.push('', cfg.name + ':');
            (byConfig[cfg.name] || []).forEach(l => {
                if (l.kind === 'edit')   lines.push(`  Removed ${l.removed.join(', ')} from ${l.label} (${l.keeps} other domain${l.keeps === 1 ? '' : 's'} kept)`);
                if (l.kind === 'delete') lines.push(`  Deleted ${l.label} (it only held ${l.removed.join(', ')})`);
            });
            if (cfg.notFound.length) lines.push(`  Not present: ${cfg.notFound.join(', ')}`);
            if (!(byConfig[cfg.name] || []).some(l => l.kind !== 'skipped') && !cfg.notFound.length) lines.push('  No changes');
        });
        if (result.stillThere.length) lines.push('', 'Still present after removal: ' + result.stillThere.join(', '));
        return lines.join('\n');
    }

    /* ── Overlay (shadow DOM keeps Netskope styles out) ── */

    function seCreateHost() {
        const host   = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const sheet  = new CSSStyleSheet();
        host.id = SE_HOST_ID;
        host.dataset.open = 'false';

        sheet.replaceSync(`
            :host { all: initial; position: fixed !important; inset: 0 !important;
                z-index: 2147483647 !important; display: block !important; font-family: Arial, sans-serif; }
            :host([data-open="false"]) { display: none !important; }
            .backdrop { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
                padding: 24px; box-sizing: border-box; background: rgba(0, 0, 0, .48); }
            .panel { display: flex; flex-direction: column; width: min(760px, calc(100vw - 32px));
                max-height: calc(100vh - 48px); overflow: hidden; box-sizing: border-box;
                color: #282728; background: #fff; border: 1px solid #d5d5d5; border-top: 5px solid #da291c;
                border-radius: 6px; box-shadow: 0 8px 28px rgba(0, 0, 0, .3); }
            .header, .footer { display: flex; align-items: center; gap: 8px; flex: 0 0 auto;
                padding: 14px 20px; box-sizing: border-box; }
            .header { justify-content: space-between; border-bottom: 1px solid #e6e6e6; }
            .header h2 { margin: 0; color: #1a1a1a; font-size: 18px; font-weight: 700; }
            .close { padding: 2px 8px; color: #53565a; background: transparent; border: 0;
                font-size: 24px; line-height: 1; cursor: pointer; }
            .body { overflow: auto; padding: 16px 20px; box-sizing: border-box; }
            .cols { display: flex; gap: 16px; flex-wrap: wrap; }
            .col { flex: 1 1 300px; min-width: 0; }
            .label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; }
            textarea, input[type="text"] { display: block; width: 100%; box-sizing: border-box; padding: 8px;
                border: 1px solid #a7a8aa; border-radius: 4px; color: #282728; background: #fff;
                font: 13px Arial, sans-serif; }
            textarea { min-height: 190px; resize: vertical; font-family: Consolas, "Courier New", monospace; }
            textarea[readonly] { background: #f6f6f6; min-height: 140px; white-space: pre; }
            .configs { height: 152px; overflow: auto; margin-top: 6px; border: 1px solid #a7a8aa;
                border-radius: 4px; padding: 4px 0; }
            .cfg { display: flex; align-items: center; gap: 8px; padding: 4px 10px; font-size: 13px; cursor: pointer; }
            .cfg:hover { background: #f4f6fb; }
            .tag { font-size: 10px; font-weight: 700; color: #005587; background: #e3f0f8;
                border-radius: 3px; padding: 1px 5px; white-space: nowrap; }
            .help { margin-top: 6px; color: #63666a; font-size: 12px; line-height: 1.4; }
            .results { margin-top: 14px; }
            .card { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
            .card-head { padding: 8px 12px; background: #f7f7f7; font-weight: 700; font-size: 13px;
                display: flex; justify-content: space-between; gap: 8px; }
            .card-head span { font-weight: 400; color: #63666a; }
            .row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 12px;
                border-top: 1px solid #f0f0f0; font-size: 13px; }
            .row input { margin-top: 3px; }
            .chip { font-size: 11px; font-weight: 700; color: #fff; border-radius: 3px; padding: 2px 7px;
                white-space: nowrap; flex-shrink: 0; }
            .chip.delete { background: #da291c; }
            .chip.edit { background: #e08a00; }
            .chip.done { background: #26890d; }
            .muted { color: #63666a; font-size: 12px; margin-top: 2px; }
            .note { padding: 6px 12px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #53565a; }
            .note.related { color: #8a5a00; }
            .status { min-height: 18px; margin-top: 10px; color: #005587; font-size: 13px; white-space: pre-wrap; }
            .status.error { color: #da291c; }
            .footer { border-top: 1px solid #e6e6e6; }
            .spacer { flex: 1; }
            .footer button, .link-btn { padding: 8px 16px; border-radius: 4px; font-weight: 600; cursor: pointer;
                font-size: 13px; color: #282728; background: #fff; border: 1px solid #a7a8aa; }
            .footer .primary { color: #fff; background: #005587; border-color: #005587; }
            .footer .danger { color: #fff; background: #da291c; border-color: #da291c; }
            .footer .ghost { font-weight: 400; font-size: 12px; padding: 6px 10px; }
            button:disabled { cursor: not-allowed; opacity: .5; }
            .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
        `);
        shadow.adoptedStyleSheets = [sheet];

        shadow.innerHTML = `
            <div class="backdrop">
                <section class="panel" role="dialog" aria-modal="true" aria-labelledby="se-title">
                    <header class="header">
                        <h2 id="se-title">🧹 Remove domains from Steering Exceptions</h2>
                        <button type="button" class="close" data-action="close" aria-label="Close">×</button>
                    </header>
                    <main class="body">
                        <div class="cols">
                            <div class="col">
                                <label class="label" for="se-domains">Domains to remove</label>
                                <textarea id="se-domains" placeholder="example.com&#10;*.example.com&#10;another.org"></textarea>
                                <div class="help">One per line. Matching is exact: example.com does not remove *.example.com.</div>
                            </div>
                            <div class="col">
                                <label class="label" for="se-filter">Steering configurations</label>
                                <input type="text" id="se-filter" placeholder="Filter by name">
                                <div class="configs" id="se-configs"></div>
                                <div class="help" id="se-config-help"></div>
                            </div>
                        </div>
                        <div class="results" id="se-results"></div>
                        <div class="status" id="se-status" role="status" aria-live="polite"></div>
                    </main>
                    <footer class="footer">
                        <button type="button" class="ghost" data-action="restore" id="se-restore-btn">↩ Restore last backup</button>
                        <div class="spacer"></div>
                        <button type="button" data-action="close">Close</button>
                        <button type="button" class="primary" data-action="check" id="se-check-btn">Check</button>
                        <button type="button" class="danger" data-action="remove" id="se-remove-btn" disabled>Remove selected</button>
                    </footer>
                </section>
            </div>
        `;

        ['pointerdown', 'mousedown', 'click'].forEach(name => shadow.addEventListener(name, e => e.stopPropagation()));
        shadow.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            if (e.target.classList.contains('backdrop') && !se.busy) { seClose(); return; }
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'close' && !se.busy) seClose();
            if (action === 'check')    seRunCheck();
            if (action === 'remove')   seRunRemove();
            if (action === 'restore')  seRunRestore();
            if (action === 'copy')     seCopySummary();
            if (action === 'download') seDownloadBackup();
            if (action === 'reload')   location.reload();
        });
        shadow.addEventListener('input', (e) => {
            if (e.target.id === 'se-filter') seRenderConfigList();
            if (e.target.id === 'se-domains') seResetPlan();
        });
        shadow.addEventListener('change', (e) => {
            if (e.target.dataset.cfg !== undefined) seResetPlan();
            if (e.target.dataset.row !== undefined && se.plan) {
                const [ci, ai] = e.target.dataset.row.split(':').map(Number);
                se.plan[ci].actions[ai].selected = e.target.checked;
                seUpdateRemoveButton();
            }
        });
        shadow.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            if (!se.busy) seClose();
        });

        document.body.appendChild(host);
        se.host = host;
        se.shadow = shadow;
    }

    const seEl = id => se.shadow.getElementById(id);

    function seEscape(text) {
        const d = document.createElement('div');
        d.textContent = String(text);
        return d.innerHTML;
    }

    function seSetStatus(message, isError) {
        const el = seEl('se-status');
        el.textContent = message || '';
        el.classList.toggle('error', !!isError);
    }

    function seRenderConfigList() {
        const box = seEl('se-configs');
        const ticked = new Set([...box.querySelectorAll('input[data-cfg]:checked')].map(i => i.dataset.cfg));
        if (!box.dataset.init && se.currentConfig) ticked.add(se.currentConfig);
        box.dataset.init = '1';

        const filter  = seEl('se-filter').value.trim().toLowerCase();
        const configs = seGetConfigs();
        const ids = Object.keys(configs).sort((a, b) => configs[a].name.localeCompare(configs[b].name));

        box.innerHTML = '';
        ids.filter(id => ticked.has(id) || !filter || configs[id].name.toLowerCase().includes(filter)).forEach(id => {
            const row = document.createElement('label');
            row.className = 'cfg';
            row.innerHTML = `<input type="checkbox" data-cfg="${seEscape(id)}"${ticked.has(id) ? ' checked' : ''}>
                <span>${seEscape(configs[id].name)}</span>${id === se.currentConfig ? '<span class="tag">open now</span>' : ''}`;
            box.appendChild(row);
        });
        if (!ids.length) box.innerHTML = '<div class="help" style="padding:6px 10px">No configurations known yet.</div>';

        seEl('se-config-help').textContent = ids.length < 2
            ? 'Configurations appear here once you open them. Open Settings > Steering Configuration once so the full list loads.'
            : `${ids.length} configurations known. Open the Steering Configuration list again if one is missing.`;
    }

    function seSelectedConfigs() {
        return [...seEl('se-configs').querySelectorAll('input[data-cfg]:checked')].map(i => i.dataset.cfg);
    }

    function seResetPlan() {
        if (se.busy) return;
        se.plan = null;
        se.confirming = false;
        seEl('se-results').innerHTML = '';
        seUpdateRemoveButton();
    }

    function seUpdateRemoveButton() {
        const btn = seEl('se-remove-btn');
        const count = se.plan ? se.plan.reduce((n, c) => n + c.actions.filter(a => a.selected).length, 0) : 0;
        btn.disabled = se.busy || !count;
        se.confirming = false;
        btn.textContent = count ? `Remove from ${count} entr${count === 1 ? 'y' : 'ies'}` : 'Remove selected';
        seEl('se-check-btn').disabled = se.busy;
        seEl('se-restore-btn').disabled = se.busy || !seGetBackup();
    }

    function seSetBusy(busy) {
        se.busy = busy;
        seEl('se-domains').disabled = busy;
        seUpdateRemoveButton();
    }

    function seRenderPlan() {
        const out = seEl('se-results');
        out.innerHTML = '';
        se.plan.forEach((cfg, ci) => {
            const card = document.createElement('div');
            card.className = 'card';
            const found = se.domains.length - cfg.notFound.length;
            card.innerHTML = `<div class="card-head">${seEscape(cfg.name)}
                <span>${found} of ${se.domains.length} found in ${cfg.actions.length} entr${cfg.actions.length === 1 ? 'y' : 'ies'}</span></div>`;
            cfg.actions.forEach((a, ai) => {
                const row = document.createElement('label');
                row.className = 'row';
                const what = a.kind === 'delete'
                    ? 'Every domain in this entry was requested, so the whole entry is deleted.'
                    : `Keeps its other ${a.keeps} domain${a.keeps === 1 ? '' : 's'}.`;
                row.innerHTML = `<input type="checkbox" data-row="${ci}:${ai}"${a.selected ? ' checked' : ''}>
                    <span class="chip ${a.kind}">${a.kind === 'delete' ? 'Delete entry' : 'Edit entry'}</span>
                    <div><div><b>${seEscape(seEntryLabel(a.notes, a.rowId))}</b></div>
                    <div class="muted">Removes ${seEscape(a.hits.join(', '))}. ${what}</div></div>`;
                card.appendChild(row);
            });
            if (cfg.notFound.length) {
                const n = document.createElement('div');
                n.className = 'note';
                n.textContent = `Not present: ${cfg.notFound.join(', ')}`;
                card.appendChild(n);
            }
            if (cfg.related.length) {
                const n = document.createElement('div');
                n.className = 'note related';
                n.textContent = 'Similar entries, left alone: ' +
                    cfg.related.map(r => `${r.existing} in ${r.label} (covers ${r.requested})`).join('; ');
                card.appendChild(n);
            }
            out.appendChild(card);
        });
    }

    function seRenderResult(summary, stillThere) {
        const out = seEl('se-results');
        out.innerHTML = `
            <label class="label" for="se-summary">${stillThere.length ? '⚠️ Finished, but some domains are still present' : '✅ Done. Summary for the ticket'}</label>
            <textarea id="se-summary" readonly></textarea>
            <div class="actions">
                <button type="button" class="link-btn" data-action="copy">📋 Copy summary</button>
                <button type="button" class="link-btn" data-action="download">💾 Download backup</button>
                <button type="button" class="link-btn" data-action="reload">⟳ Reload page to see changes</button>
            </div>`;
        seEl('se-summary').value = summary;
    }

    async function seRunCheck() {
        if (se.busy) return;
        const domains = seParseDomains(seEl('se-domains').value);
        const configIds = seSelectedConfigs();
        if (!domains.length)   return seSetStatus('Paste at least one domain.', true);
        if (!configIds.length) return seSetStatus('Tick at least one steering configuration.', true);

        seResetPlan();
        seSetBusy(true);
        seSetStatus('Reading exceptions…');
        try {
            se.domains = domains;
            se.plan = await seBuildPlan(configIds, domains);
            seRenderPlan();
            const total = se.plan.reduce((n, c) => n + c.actions.length, 0);
            seSetStatus(total
                ? 'Nothing has changed yet. Untick any entry you want to keep as it is, then click Remove.'
                : 'None of these domains are in the selected configurations. Nothing to remove.');
        } catch (err) {
            console.error('[NS Toolkit] Steering check:', err);
            seSetStatus(err.message, true);
        } finally {
            seSetBusy(false);
        }
    }

    async function seRunRemove() {
        if (se.busy || !se.plan) return;
        const count = se.plan.reduce((n, c) => n + c.actions.filter(a => a.selected).length, 0);
        if (!count) return;
        const btn = seEl('se-remove-btn');
        if (!se.confirming) {
            se.confirming = true;
            btn.textContent = 'Click again to confirm';
            seSetStatus('Netskope applies these changes straight away, with no Save step. A backup is kept so you can restore it.');
            return;
        }

        seSetBusy(true);
        const plan = se.plan;
        try {
            const result = await seApplyPlan(plan, se.domains, msg => seSetStatus(msg));
            se.plan = null;
            seRenderResult(seBuildSummary(plan, result), result.stillThere);
            seSetStatus(result.stillThere.length
                ? 'Still present: ' + result.stillThere.join(', ')
                : 'All selected domains were removed and checked.', !!result.stillThere.length);
        } catch (err) {
            console.error('[NS Toolkit] Steering removal:', err);
            se.plan = null;
            seEl('se-results').innerHTML = '';
            seSetStatus(`Stopped: ${err.message}\nChanges made before this point were kept. Use "Restore last backup" to undo them, or click Check again to see the current state.`, true);
        } finally {
            seSetBusy(false);
        }
    }

    async function seRunRestore() {
        if (se.busy) return;
        const backup = seGetBackup();
        if (!backup || !backup.entries || !backup.entries.length) return seSetStatus('There is no backup to restore.', true);
        if (backup.host !== location.host) return seSetStatus(`The last backup belongs to ${backup.host}. Open that tenant to restore it.`, true);
        const when = new Date(backup.at).toLocaleString();
        if (!confirm(`Restore ${backup.entries.length} exception entr${backup.entries.length === 1 ? 'y' : 'ies'} to how they were before the removal on ${when}?\n\nEdited entries get their old domain list back. Deleted entries are created again with the same domains and notes.`)) return;

        seResetPlan();
        seSetBusy(true);
        try {
            await seRestoreBackup(backup, msg => seSetStatus(msg));
            GM_deleteValue(SE_BACKUP_KEY);
            seSetStatus('Backup restored. Reload the page to see the exceptions table updated.');
        } catch (err) {
            console.error('[NS Toolkit] Steering restore:', err);
            seSetStatus(`Restore stopped: ${err.message}`, true);
        } finally {
            seSetBusy(false);
        }
    }

    async function seCopySummary() {
        const text = seEl('se-summary')?.value || '';
        try {
            await navigator.clipboard.writeText(text);
            seSetStatus('Summary copied to the clipboard.');
        } catch (e) {
            seEl('se-summary').select();
            seSetStatus('Copy failed. The summary is selected, press Ctrl+C.', true);
        }
    }

    function seDownloadBackup() {
        const backup = seGetBackup();
        if (!backup) return seSetStatus('There is no backup to download.', true);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `steering-exceptions-backup-${backup.at.slice(0, 19).replace(/[:T]/g, '-')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function seOpen() {
        if (!se.host) seCreateHost();
        se.host.dataset.open = 'true';
        seRenderConfigList();
        seUpdateRemoveButton();
        if (!se.token) seSetStatus('Waiting for the page to send its session token. This takes a few seconds after the page loads.');
        setTimeout(() => seEl('se-domains').focus(), 50);
    }

    function seClose() {
        if (se.host) se.host.dataset.open = 'false';
    }

    /* ── Button on the Steering Configuration page ── */

    function seOnSteeringPage() {
        return se.resource === SE_RESOURCE || /steering/i.test(window.location.hash || '');
    }

    function seFindAnchor() {
        return [...document.querySelectorAll('button')].find(b =>
            b.id !== SE_BUTTON_ID && b.offsetParent !== null && /^\+?\s*new exception$/i.test(b.textContent.trim()));
    }

    function seSyncButton() {
        let btn = document.getElementById(SE_BUTTON_ID);
        if (!seOnSteeringPage()) { btn?.remove(); return; }

        const anchor = seFindAnchor();
        if (btn && (anchor ? btn.nextElementSibling === anchor : btn.dataset.floating === '1')) return;
        btn?.remove();

        btn = document.createElement('button');
        btn.id = SE_BUTTON_ID;
        btn.type = 'button';
        btn.textContent = '🧹 Bulk remove domains';
        btn.title = 'Find domains in steering exceptions and remove them (NS Policies Toolkit)';
        Object.assign(btn.style, {
            padding: '6px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '4px',
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif',
            background: '#fff', color: '#da291c', border: '1px solid #da291c',
        });
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); seOpen(); });

        if (anchor) {
            btn.style.marginRight = '8px';
            anchor.insertAdjacentElement('beforebegin', btn);
        } else {
            btn.dataset.floating = '1';
            Object.assign(btn.style, {
                position: 'fixed', right: '24px', bottom: '24px', zIndex: '2147483000',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)', padding: '9px 14px',
            });
            document.body.appendChild(btn);
        }
    }

    function initSteeringRemover() {
        if (!getSetting('steeringRemover') || se.timer) return;
        se.timer = setInterval(seSyncButton, 1000);
        seSyncButton();
    }

    function cleanupSteeringRemover() {
        clearInterval(se.timer);
        se.timer = null;
        removeAll('#' + SE_BUTTON_ID);
        se.host?.remove();
        se.host = se.shadow = null;
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
        injectRefOpenButtons();
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
                    n.matches?.('[data-test-id="ns-overview-section-data-value"]') ||
                    n.querySelector?.('[data-test-id="ns-overview-section-data-value"]') ||
                    n.querySelector?.('a.trigger')    ||
                    n.querySelector?.('button.ns-btn-primary') ||
                    n.querySelector?.('textarea.ns-form-textarea') ||
                    DESCRIPTION_TA_SELECTORS.some(sel => n.matches?.(sel) || n.querySelector?.(sel)) ||
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
        initBulkConstraintTools();
        initSteeringRemover();
        // A ↗ reference button in another tab may have asked this tab to open an item
        setTimeout(consumePendingRefOpen, 1500);
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