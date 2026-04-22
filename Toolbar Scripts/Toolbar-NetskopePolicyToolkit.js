// ==UserScript==
// @name         |Toolbar| Netskope Policies Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyToolkit.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.3
// @description  Copy buttons, DLP profile open buttons, SMTP auto-fill, and Save reminder checklist. Integrated with Toolbar v2.
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
        copyButtons:   'toolkit_copyButtons',
        openButtons:   'toolkit_openButtons',
        smtpAutofill:  'toolkit_smtpAutofill',
        saveReminder:  'toolkit_saveReminder',
    };

    function getSetting(key)        { return GM_getValue(SETTING_KEYS[key], true); }
    function setSetting(key, value) { GM_setValue(SETTING_KEYS[key], value); }

    // ─────────────────────────────────────────────────────────────
    // VERSION CONTROL & CHANGELOG
    // ─────────────────────────────────────────────────────────────

    const SCRIPT_VERSION = '1.3';
    const CHANGELOG = `Version 1.3:
- Update URL Changed

Version 1.2:
- Added Save Reminder: intercepts the policy Save button and shows a
  checklist modal reminding you to fill in RITM number, creator name
  & date, and editor name & modification date before saving.`;

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

        /* ── Changelog body ── */
        const changelogContent = document.createElement('div');
        changelogContent.textContent = CHANGELOG;
        Object.assign(changelogContent.style, {
            whiteSpace:      'pre-wrap',
            lineHeight:      '1.6',
            color:           '#333333',
            fontFamily:      "'Courier New', Courier, monospace",
            fontSize:        '13px',
            fontWeight:      'normal',
            backgroundColor: '#fafafa',
            padding:         '10px',
            borderRadius:    '5px',
            marginBottom:    '0',
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
            const notification = document.getElementById('nsToolkitChangelogNotification');
            if (notification) notification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(changelogContent);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeButton.click();
    }

    // ─────────────────────────────────────────────────────────────
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

        /* ── Modal card ── */
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        Object.assign(modal.style, {
            position:     'relative',
            background:   '#f9f9f9',
            border:       '1px solid #ccc',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.18)',
            borderRadius: '10px',
            padding:      '48px 24px 24px',
            zIndex:       '999998',
            fontFamily:   'Arial, sans-serif',
            minWidth:     '420px',
            maxWidth:     '520px',
            width:        '100%',
        });

        /* ── Close button ── */
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            position:     'absolute',
            top:          '8px',
            right:        '8px',
            background:   '#e53935',
            color:        '#fff',
            border:       'none',
            borderRadius: '4px',
            cursor:       'pointer',
            padding:      '4px 9px',
            fontWeight:   'bold',
            fontSize:     '13px',
        });
        closeBtn.addEventListener('click', hideSettingsModal);
        modal.appendChild(closeBtn);

        /* ── Title ── */
        const titleEl = document.createElement('div');
        Object.assign(titleEl.style, {
            position:   'absolute',
            top:        '13px',
            left:       '14px',
            fontSize:   '12px',
            fontWeight: 'bold',
            color:      '#333',
        });
        titleEl.textContent = '🛡 NS Policies Toolkit — Feature Settings';
        modal.appendChild(titleEl);

        /* ── Subtitle ── */
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Toggle features on or off. Changes take effect immediately and are saved across sessions.';
        Object.assign(subtitle.style, {
            fontSize:   '12px',
            color:      '#666',
            margin:     '0 0 18px',
            lineHeight: '1.5',
        });
        modal.appendChild(subtitle);

        /* ── Feature rows ── */
        FEATURES.forEach(({ key, label, description }) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '14px',
                background:   '#fff',
                border:       '1px solid #e0e0e0',
                borderRadius: '8px',
                padding:      '12px 14px',
                marginBottom: '10px',
                cursor:       'pointer',
                transition:   'border-color 0.15s',
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
                    if (key === 'copyButtons')  removeAll('.dlp-copy-btn');
                    if (key === 'openButtons')  removeAll('.dlp-open-btn');
                    if (key === 'smtpAutofill') removeAll('#' + SMTP_BTN_ID);
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
            modal.appendChild(row);
        });

        /* ── Footer: version label + changelog badge ── */
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginTop:      '6px',
            paddingTop:     '12px',
            borderTop:      '1px solid #e0e0e0',
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

        const modal = document.getElementById(MODAL_ID);
        if (modal) modal.insertBefore(notice, modal.firstElementChild);
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

        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(checklist);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = (e) => { if (e.target === overlay) goBackBtn.click(); };
    }

    function isOnPolicyPage() {
        const hash = window.location.hash || '';
        return hash.includes('/inline-policy-page') || hash.includes('/endpoint-dlp-page');
    }

    function interceptSaveButtons() {
        if (!getSetting('saveReminder')) return;
        if (!isOnPolicyPage()) return;

        document.querySelectorAll('button.ns-btn.ns-btn-primary').forEach((btn) => {
            if (btn.dataset.nstkSaveIntercepted) return;
            if (!btn.textContent.trim().toLowerCase().includes('save')) return;

            btn.dataset.nstkSaveIntercepted = '1';

            btn.addEventListener('click', (e) => {
                if (!getSetting('saveReminder')) return;
                if (!isOnPolicyPage()) return;
                if (saveProceedFlag) return;

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
    // SHARED RUNNER
    // ─────────────────────────────────────────────────────────────

    function runAll() {
        addCopyButtons();
        addOpenButtons();
        checkSmtp();
        interceptSaveButtons();
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
                    n.querySelector?.('button.ns-btn-primary')
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