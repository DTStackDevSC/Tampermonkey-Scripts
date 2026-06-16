// ==UserScript==
// @name         |Toolbar| General Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-GeneralToolkit.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-GeneralToolkit.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.4
// @description  Highlight a RITM, PER, or Netskope case number on any page to get a floating button that opens it in a new tab. Toggle via Toolbar.
// @author       J.R.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // VERSION CONTROL
    // ─────────────────────────────────────────────────────────────

    const SCRIPT_VERSION = '1.4';
    const CHANGELOG = `Version 1.4:
- Added a ? Help button to the settings panel that opens a visual Feature Guide covering both tool groups and the ticket quick-open mechanism.

Version 1.3.3:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.3.2:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.3.1:
- The settings modal now explains how to use each tool group: highlight a ticket or case number on any page, then click the floating button that appears.

Version 1.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.2:
- Added INC (Incident) ticket type support. Highlight any INC number on any page to open it in ServiceNow alongside RITM and PER.`;

    function getStoredVersion()    { return GM_getValue('tqo_version', null); }
    function saveVersion(v)        { GM_setValue('tqo_version', v); }
    function hasSeenChangelog()    { return GM_getValue('tqo_changelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue('tqo_changelogSeen', SCRIPT_VERSION); }

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
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────────

    const SNOW_SETTING_KEY = 'tqo_snow_enabled';
    const NS_SETTING_KEY   = 'tqo_ns_enabled';
    function isSnowEnabled()   { return GM_getValue(SNOW_SETTING_KEY, true); }
    function setSnowEnabled(v) { GM_setValue(SNOW_SETTING_KEY, !!v); }
    function isNsEnabled()     { return GM_getValue(NS_SETTING_KEY, true); }
    function setNsEnabled(v)   { GM_setValue(NS_SETTING_KEY, !!v); }

    function isGroupEnabled(group) {
        if (group === 'snow') return isSnowEnabled();
        if (group === 'ns')   return isNsEnabled();
        return false;
    }

    const TICKET_TYPES = {
        RITM: {
            group: 'snow',
            regex: /^RITM\d+$/i,
            url:   (n) => `https://deloitteglobal.service-now.com/sc_req_item.do?sys_id=${n}`,
            color: '#0073e6',
        },
        INC: {
            group: 'snow',
            regex: /^INC\d+$/i,
            url:   (n) => `https://deloitteglobal.service-now.com/incident.do?sys_id=${n}`,
            color: '#e53935',
        },
        PER: {
            group: 'snow',
            regex: /^PER\d+$/i,
            url:   (n) => `https://deloitteglobal.service-now.com/sn_compliance_policy_exception.do?sys_id=${n}`,
            color: '#7c3aed',
        },
        NS: {
            group: 'ns',
            regex: /^006\d{5}$/,
            url:   (n) => `https://support.netskope.com/s/global-search/${n}`,
            color: '#00897b',
        },
    };

    // ─────────────────────────────────────────────────────────────
    // DARK MODE ISOLATION
    // ─────────────────────────────────────────────────────────────

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        #tqo-settings-modal, #tqo-changelog-modal, #tqoHelpModal {
            color: #333333 !important;
        }
        #tqoHelpModal input, #tqoHelpModal select, #tqoHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(darkModeStyle);

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'tqo-notif-dot';

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
                position: 'absolute', top: '2px', right: '2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#007bff', pointerEvents: 'none', zIndex: '10',
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
    // TOOLBAR REGISTRATION
    // ─────────────────────────────────────────────────────────────

    const TOOL_ID       = 'ticketQuickOpen';
    const TOOL_POSITION = 6;

    let isRegistered         = false;
    let registrationAttempts = 0;
    const MAX_ATTEMPTS       = 10;
    const RETRY_DELAY        = 500;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 12c0-1.1-.9-2-2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v3c1.1 0 2 .9 2 2s-.9 2-2 2v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3c-1.1 0-2-.9-2-2zm-2 4.5H4v-2.18c1.19-.69 2-1.99 2-3.32s-.81-2.63-2-3.32V5.5h14v2.18c-1.19.69-2 1.99-2 3.32s.81 2.63 2 3.32v2.18z"/>
    </svg>`;

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_ATTEMPTS) {
            console.warn('⚠️ TQO: max registration attempts reached');
            return;
        }
        registrationAttempts++;

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'General Toolkit', position: TOOL_POSITION }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ TQO: registered in toolbar');
        } else {
            setTimeout(attemptRegistration, RETRY_DELAY);
        }
    }

    document.addEventListener('toolbarReady',       () => attemptRegistration());
    document.addEventListener('toolbarToolClicked', (e) => {
        if (e.detail.id === TOOL_ID) showSettingsModal();
    });

    // ─────────────────────────────────────────────────────────────
    // CHANGELOG MODAL
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
        if (document.getElementById('tqo-changelog-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tqo-changelog-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000',
        });

        const modal = document.createElement('div');
        modal.id = 'tqo-changelog-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000001', background: '#ffffff', border: '2px solid #333',
            padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif', borderRadius: '10px',
            maxWidth: '520px', width: '90vw', maxHeight: '80vh', overflowY: 'auto',
            color: '#333', boxSizing: 'border-box',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New — v${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            marginTop: '0', marginBottom: '12px', fontSize: '16px', fontWeight: 'bold',
            color: '#333', borderBottom: '2px solid #0073e6', paddingBottom: '8px',
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Got it!';
        Object.assign(closeBtn.style, {
            display: 'block', marginTop: '14px', padding: '10px 20px',
            background: '#0073e6', color: '#fff', border: 'none',
            borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px', boxSizing: 'border-box',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#005bb5'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#0073e6'; });
        closeBtn.onclick = () => {
            overlay.remove(); modal.remove();
            markChangelogAsSeen(); saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            document.getElementById('tqo-changelog-notif')?.remove();
        };

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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px',
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

        modal.append(title, cardsWrap, closeBtn);
        document.body.append(overlay, modal);
        overlay.onclick = () => closeBtn.click();
    }

    // ─────────────────────────────────────────────────────────────
    // SETTINGS MODAL
    // ─────────────────────────────────────────────────────────────

    const MODAL_ID = 'tqo-settings-modal';

    function buildToggleSection(opts) {
        const section = document.createElement('div');
        Object.assign(section.style, {
            background: '#fff', border: `1px solid ${opts.accentColor}44`,
            borderRadius: '8px', marginBottom: '16px', overflow: 'hidden',
        });

        const sectionHeader = document.createElement('div');
        Object.assign(sectionHeader.style, {
            background: `${opts.accentColor}18`, borderBottom: `1px solid ${opts.accentColor}33`,
            padding: '6px 12px', display: 'flex', alignItems: 'center',
        });
        const sectionTitle = document.createElement('span');
        Object.assign(sectionTitle.style, {
            fontSize: '11px', fontWeight: 'bold', color: opts.accentColor,
            textTransform: 'uppercase', letterSpacing: '0.5px',
        });
        sectionTitle.textContent = `${opts.icon}  ${opts.title}`;
        sectionHeader.appendChild(sectionTitle);
        section.appendChild(sectionHeader);

        const toggleRow = document.createElement('div');
        Object.assign(toggleRow.style, {
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '10px 14px', cursor: 'pointer',
        });

        const toggleWrap = document.createElement('div');
        Object.assign(toggleWrap.style, { flexShrink: '0', marginTop: '2px' });
        const toggle = document.createElement('input');
        toggle.type    = 'checkbox';
        toggle.id      = opts.toggleId;
        toggle.checked = isGroupEnabled(opts.group);
        Object.assign(toggle.style, { width: '34px', height: '18px', cursor: 'pointer', accentColor: opts.accentColor });
        toggleWrap.appendChild(toggle);
        toggleRow.appendChild(toggleWrap);

        const textWrap = document.createElement('div');
        const lbl = document.createElement('div');
        Object.assign(lbl.style, { fontWeight: 'bold', fontSize: '12px', color: '#222', marginBottom: '2px' });
        lbl.textContent = opts.description.title;
        const desc = document.createElement('div');
        Object.assign(desc.style, { fontSize: '11px', color: '#666', lineHeight: '1.4' });
        desc.textContent = opts.description.body;
        textWrap.append(lbl, desc);
        toggleRow.appendChild(textWrap);

        toggle.addEventListener('change', () => {
            if (opts.group === 'snow') setSnowEnabled(toggle.checked);
            else                       setNsEnabled(toggle.checked);
            updateSectionStyle(toggleRow, toggle.checked, opts.accentColor);
        });
        toggleRow.addEventListener('click', (e) => { if (e.target !== toggle) toggle.click(); });
        updateSectionStyle(toggleRow, toggle.checked, opts.accentColor);
        section.appendChild(toggleRow);

        opts.typeKeys.forEach(typeKey => {
            const cfg = TICKET_TYPES[typeKey];
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 14px', borderTop: '1px solid #f0f0f0',
            });

            const badge = document.createElement('span');
            badge.textContent = typeKey;
            Object.assign(badge.style, {
                background: cfg.color, color: '#fff', borderRadius: '4px',
                padding: '2px 9px', fontWeight: 'bold', fontSize: '11px', flexShrink: '0',
            });

            const urlExample = document.createElement('span');
            Object.assign(urlExample.style, {
                fontSize: '10px', color: '#777', fontFamily: "'Courier New', monospace",
                wordBreak: 'break-all',
            });
            urlExample.textContent = cfg.url(`${typeKey}…`);

            row.append(badge, urlExample);
            section.appendChild(row);
        });

        if (opts.note) {
            const noteRow = document.createElement('div');
            Object.assign(noteRow.style, {
                padding: '6px 14px 10px', borderTop: '1px solid #f0f0f0',
                fontSize: '11px', color: '#888', lineHeight: '1.4', fontStyle: 'italic',
            });
            noteRow.textContent = opts.note;
            section.appendChild(noteRow);
        }

        return { section, toggleEl: toggle, toggleRow };
    }

    function updateSectionStyle(row, enabled, accentColor) {
        row.style.background = enabled ? `${accentColor}0d` : '#fff';
        row.style.opacity    = enabled ? '1' : '0.65';
    }

    function buildSettingsModal() {
        if (document.getElementById(MODAL_ID)) return;

        /* ── Backdrop ── */
        const backdrop = document.createElement('div');
        backdrop.id = MODAL_ID + '-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.35)',
            zIndex: '999997', display: 'none', alignItems: 'center', justifyContent: 'center',
        });
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) hideSettingsModal(); });

        /* ── Modal card ── */
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        Object.assign(modal.style, {
            position: 'relative', background: '#f9f9f9', border: '1px solid #ccc',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', borderRadius: '10px',
            zIndex: '999998', fontFamily: 'Arial, sans-serif',
            width: '440px', maxWidth: '95vw', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        });

        /* ── Header ── */
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px 10px', borderBottom: '1px solid #e0e0e0', flexShrink: '0',
        });
        const titleEl = document.createElement('div');
        Object.assign(titleEl.style, { fontSize: '12px', fontWeight: 'bold', color: '#333' });
        titleEl.textContent = '🎫 General Toolkit — Settings';
        header.appendChild(titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: '#e53935', color: '#fff', border: 'none', borderRadius: '4px',
            cursor: 'pointer', padding: '4px 9px', fontWeight: 'bold', fontSize: '13px',
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
        header.appendChild(headerRight);
        modal.appendChild(header);

        /* ── Body (scrollable) ── */
        const body = document.createElement('div');
        Object.assign(body.style, { padding: '16px 20px', overflowY: 'auto', flex: '1' });
        modal.appendChild(body);

        /* ── ServiceNow section ── */
        const snowSection = buildToggleSection({
            group:       'snow',
            accentColor: '#1a73e8',
            icon:        '☁️',
            title:       'ServiceNow',
            toggleId:    'tqo-snow-toggle',
            description: {
                title: 'Enable ServiceNow tickets',
                body:  'Detect RITM, INC, and PER numbers on any page. To open a ticket: highlight the number with your mouse, then click the floating button that appears.',
            },
            typeKeys: ['RITM', 'INC', 'PER'],
        });
        body.appendChild(snowSection.section);

        /* ── Netskope section ── */
        const nsSection = buildToggleSection({
            group:       'ns',
            accentColor: '#00897b',
            icon:        '🛡️',
            title:       'Netskope',
            toggleId:    'tqo-ns-toggle',
            description: {
                title: 'Enable Netskope support cases',
                body:  'Detect 006XXXXX case numbers on any page. To look up a case: highlight the number with your mouse, then click the floating button that appears.',
            },
            typeKeys: ['NS'],
            note:     'ℹ️ Opens Netskope global search — no direct case URL can be computed from the case number.',
        });
        body.appendChild(nsSection.section);

        /* ── Footer ── */
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '10px 20px 14px', borderTop: '1px solid #e0e0e0', flexShrink: '0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        });
        const versionLabel = document.createElement('span');
        Object.assign(versionLabel.style, { fontSize: '11px', color: '#999' });
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        footer.appendChild(versionLabel);

        if (isNewVersion() && !hasSeenChangelog()) {
            const notif = document.createElement('span');
            notif.id = 'tqo-changelog-notif';
            Object.assign(notif.style, {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
            });
            notif.addEventListener('mouseenter', () => { notif.style.background = '#e0e0e0'; });
            notif.addEventListener('mouseleave', () => { notif.style.background = 'transparent'; });

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
            Object.assign(notifText.style, { fontSize: '11px', color: '#0066cc', textDecoration: 'underline' });

            notif.append(dot, notifText);
            notif.onclick = () => showChangelogModal();
            footer.appendChild(notif);
        }

        modal.appendChild(footer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    }

    // ─────────────────────────────────────────────────────────────
    // FEATURE GUIDE MODAL
    // ─────────────────────────────────────────────────────────────

    function showHelpModal() {
        if (document.getElementById('tqoHelpModal')) return;

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
            wrap.style.margin = '0 0 0 0';
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
                    lead(body, 'Click the ticket icon in the floating toolbar to open the General Toolkit settings panel.');

                    body.appendChild(hrow([
                        menuMock([
                            toolSquare('📊'), menuSep(),
                            toolSquare('🎫', { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: '2px solid #667eea' }),
                            menuSep(),
                            toolSquare('🛡'), toolSquare('🔗'),
                        ]),
                    ], { marginBottom: '10px' }));
                    caption(body, 'The toolkit registers as a ticket icon in the floating toolbar.');

                    bullets(body, [
                        'A pulsing dot on the icon means a new version is available. Open settings to see what is new.',
                        'Two feature groups are available: ServiceNow tickets and Netskope support cases.',
                        'Each group can be toggled on or off independently from the settings panel.',
                    ]);
                },
            },
            {
                icon: '🎫',
                title: 'Ticket Quick Open',
                buildContent(body) {
                    lead(body, 'Highlight any recognised ticket or case number on any page, then click the floating button that appears near your cursor.');

                    const selDemo = document.createElement('div');
                    Object.assign(selDemo.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '13px', color: '#333',
                        marginBottom: '8px', lineHeight: '2',
                    });
                    selDemo.appendChild(document.createTextNode('...related to ticket '));
                    const hl = document.createElement('span');
                    hl.textContent = 'RITM1234567';
                    Object.assign(hl.style, {
                        background: '#0073e6', color: '#fff', padding: '1px 4px', borderRadius: '2px',
                    });
                    selDemo.appendChild(hl);
                    selDemo.appendChild(document.createTextNode(' which was...'));
                    body.appendChild(selDemo);
                    caption(body, 'Step 1: highlight the ticket number with your mouse on any page.');

                    const floatWrap = document.createElement('div');
                    floatWrap.style.margin = '10px 0';
                    const floatBtn = document.createElement('div');
                    floatBtn.textContent = '🎫 Open RITM1234567';
                    Object.assign(floatBtn.style, {
                        display: 'inline-block', background: '#0073e6', color: '#fff',
                        borderRadius: '5px', padding: '6px 14px',
                        fontSize: '12px', fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                    });
                    floatWrap.appendChild(floatBtn);
                    body.appendChild(floatWrap);
                    caption(body, 'Step 2: click the floating button to open the ticket in a new tab.');

                    bullets(body, [
                        'The button appears near your cursor and clamps to the viewport so it never goes off-screen.',
                        'Click anywhere else, press Escape, or scroll to dismiss the button without opening anything.',
                    ]);
                },
            },
            {
                icon: '☁️',
                title: 'ServiceNow Tickets',
                buildContent(body) {
                    lead(body, 'Three ServiceNow ticket types are supported, each with a distinct color and destination form.');

                    const types = [
                        { bg: '#0073e6', label: 'RITM', desc: 'Service request items. Opens the request item form in ServiceNow.' },
                        { bg: '#e53935', label: 'INC',  desc: 'Incident tickets. Opens the incident form in ServiceNow.' },
                        { bg: '#7c3aed', label: 'PER',  desc: 'Policy exception requests. Opens the compliance exception form in ServiceNow.' },
                    ];
                    for (const t of types) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0',
                        });
                        const badge = document.createElement('span');
                        badge.textContent = t.label;
                        Object.assign(badge.style, {
                            background: t.bg, color: '#fff', borderRadius: '4px',
                            padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                            alignSelf: 'flex-start', minWidth: '40px', textAlign: 'center',
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = t.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }

                    bullets(body, [
                        'Format: prefix (RITM, INC, or PER) followed immediately by digits, e.g. RITM1234567.',
                        'Leading and trailing punctuation around the highlighted number is stripped automatically.',
                    ]);
                },
            },
            {
                icon: '🛡️',
                title: 'Netskope Cases',
                buildContent(body) {
                    lead(body, 'Highlight an eight-digit number starting with 006 to look it up in Netskope global search.');

                    const rowEl = document.createElement('div');
                    Object.assign(rowEl.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0',
                    });
                    const nsBadge = document.createElement('span');
                    nsBadge.textContent = 'NS';
                    Object.assign(nsBadge.style, {
                        background: '#00897b', color: '#fff', borderRadius: '4px',
                        padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                    });
                    const nsDescEl = document.createElement('span');
                    nsDescEl.textContent = 'Netskope support case. Opens the global search page filtered to the case number.';
                    Object.assign(nsDescEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    rowEl.appendChild(nsBadge);
                    rowEl.appendChild(nsDescEl);
                    body.appendChild(rowEl);

                    const box = document.createElement('div');
                    Object.assign(box.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#333', marginBottom: '8px',
                    });
                    box.textContent = '00612345   →   eight digits, starting with 006';
                    body.appendChild(box);

                    bullets(body, [
                        'There is no direct URL for a Netskope case number, so the script opens global search instead.',
                        'Click the matching result in the search list to open the full case.',
                    ]);
                },
            },
            {
                icon: '⚙️',
                title: 'Settings',
                buildContent(body) {
                    lead(body, 'Open the settings panel by clicking the ticket icon in the toolbar.');

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

                    // ServiceNow toggle section mock
                    const snowWrap = document.createElement('div');
                    Object.assign(snowWrap.style, {
                        background: '#fff', border: '1px solid #1a73e833',
                        borderRadius: '8px', marginBottom: '12px', overflow: 'hidden',
                    });
                    const snowHdr = document.createElement('div');
                    Object.assign(snowHdr.style, {
                        background: '#1a73e818', borderBottom: '1px solid #1a73e833', padding: '6px 12px',
                    });
                    const snowHdrTitle = document.createElement('span');
                    snowHdrTitle.textContent = '☁️  SERVICENOW';
                    Object.assign(snowHdrTitle.style, {
                        fontSize: '11px', fontWeight: 'bold', color: '#1a73e8',
                        textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif',
                    });
                    snowHdr.appendChild(snowHdrTitle);
                    snowWrap.appendChild(snowHdr);
                    const snowToggleWrap = document.createElement('div');
                    snowToggleWrap.style.padding = '10px 14px';
                    const snowToggleEl = toggle('Enable ServiceNow tickets', true, 'Detect RITM, INC, and PER numbers on any page.');
                    snowToggleWrap.appendChild(snowToggleEl);
                    snowWrap.appendChild(snowToggleWrap);
                    const snowBadgesRow = document.createElement('div');
                    Object.assign(snowBadgesRow.style, {
                        display: 'flex', gap: '6px', padding: '8px 14px', borderTop: '1px solid #f0f0f0',
                    });
                    [['RITM','#0073e6'],['INC','#e53935'],['PER','#7c3aed']].forEach(([lbl, bg]) => {
                        const b = document.createElement('span');
                        b.textContent = lbl;
                        Object.assign(b.style, {
                            background: bg, color: '#fff', borderRadius: '4px',
                            padding: '2px 8px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif',
                        });
                        snowBadgesRow.appendChild(b);
                    });
                    snowWrap.appendChild(snowBadgesRow);
                    body.appendChild(snowWrap);

                    // Netskope toggle section mock
                    const nsWrap = document.createElement('div');
                    Object.assign(nsWrap.style, {
                        background: '#fff', border: '1px solid #00897b33',
                        borderRadius: '8px', marginBottom: '8px', overflow: 'hidden',
                    });
                    const nsHdr = document.createElement('div');
                    Object.assign(nsHdr.style, {
                        background: '#00897b18', borderBottom: '1px solid #00897b33', padding: '6px 12px',
                    });
                    const nsHdrTitle = document.createElement('span');
                    nsHdrTitle.textContent = '🛡️  NETSKOPE';
                    Object.assign(nsHdrTitle.style, {
                        fontSize: '11px', fontWeight: 'bold', color: '#00897b',
                        textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'Arial, sans-serif',
                    });
                    nsHdr.appendChild(nsHdrTitle);
                    nsWrap.appendChild(nsHdr);
                    const nsToggleWrap = document.createElement('div');
                    nsToggleWrap.style.padding = '10px 14px';
                    const nsToggleEl = toggle('Enable Netskope support cases', true, 'Detect 006XXXXX case numbers on any page.');
                    nsToggleWrap.appendChild(nsToggleEl);
                    nsWrap.appendChild(nsToggleWrap);
                    const nsBadgesRow = document.createElement('div');
                    Object.assign(nsBadgesRow.style, {
                        display: 'flex', gap: '6px', padding: '8px 14px', borderTop: '1px solid #f0f0f0',
                    });
                    const nsB = document.createElement('span');
                    nsB.textContent = 'NS';
                    Object.assign(nsB.style, {
                        background: '#00897b', color: '#fff', borderRadius: '4px',
                        padding: '2px 8px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Arial, sans-serif',
                    });
                    nsBadgesRow.appendChild(nsB);
                    nsWrap.appendChild(nsBadgesRow);
                    body.appendChild(nsWrap);
                },
            },
        ];

        /* ── Overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'tqoHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '1000000',
        });

        /* ── Modal ── */
        const modal = document.createElement('div');
        modal.id = 'tqoHelpModal';
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
        titleSub.textContent = `General Toolkit • v${SCRIPT_VERSION}`;
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
        buildSettingsModal();

        // Re-sync toggles to stored values (may have changed in another tab)
        const snowToggle = document.getElementById('tqo-snow-toggle');
        const nsToggle   = document.getElementById('tqo-ns-toggle');
        if (snowToggle) snowToggle.checked = isSnowEnabled();
        if (nsToggle)   nsToggle.checked   = isNsEnabled();

        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'flex';
    }

    function hideSettingsModal() {
        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    }

    // ─────────────────────────────────────────────────────────────
    // TICKET MATCHING
    // ─────────────────────────────────────────────────────────────

    function matchTicket(rawText) {
        const text = rawText.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toUpperCase();
        for (const [, cfg] of Object.entries(TICKET_TYPES)) {
            if (!isGroupEnabled(cfg.group)) continue;
            if (cfg.regex.test(text)) return { cfg, number: text };
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    // FLOATING BUTTON
    // ─────────────────────────────────────────────────────────────

    const BTN_ID = 'tqo-floating-btn';

    function removeBtn() {
        document.getElementById(BTN_ID)?.remove();
    }

    function showBtn(match, cursorX, cursorY) {
        removeBtn();

        const btn = document.createElement('button');
        btn.id = BTN_ID;
        btn.textContent = `🎫 Open ${match.number}`;
        Object.assign(btn.style, {
            position:     'fixed',
            top:          `${cursorY + 12}px`,
            left:         `${cursorX}px`,
            zIndex:       '2147483647',
            background:   match.cfg.color,
            color:        '#fff',
            border:       'none',
            borderRadius: '5px',
            padding:      '6px 14px',
            fontSize:     '12px',
            fontFamily:   'Arial, sans-serif',
            fontWeight:   'bold',
            cursor:       'pointer',
            boxShadow:    '0 2px 10px rgba(0,0,0,0.3)',
            userSelect:   'none',
            whiteSpace:   'nowrap',
            lineHeight:   '1.5',
            transition:   'filter 0.12s, transform 0.1s',
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.filter    = 'brightness(1.15)';
            btn.style.transform = 'scale(1.04)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.filter    = '';
            btn.style.transform = '';
        });
        // Prevent mousedown from clearing the selection before click fires
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(match.cfg.url(match.number), '_blank');
            removeBtn();
        });

        document.body.appendChild(btn);

        // Clamp to viewport so the button never bleeds off-screen
        requestAnimationFrame(() => {
            const rect = btn.getBoundingClientRect();
            if (rect.right  > window.innerWidth  - 8) btn.style.left = `${window.innerWidth  - rect.width  - 8}px`;
            if (rect.bottom > window.innerHeight - 8) btn.style.top  = `${cursorY - rect.height - 8}px`;
        });
    }

    // ─────────────────────────────────────────────────────────────
    // SELECTION LISTENERS
    // ─────────────────────────────────────────────────────────────

    document.addEventListener('mouseup', (e) => {
        if (e.target?.id === BTN_ID) return;
        const selected = window.getSelection()?.toString() || '';
        const match    = matchTicket(selected);
        if (match) showBtn(match, e.clientX, e.clientY);
        else       removeBtn();
    });

    document.addEventListener('mousedown', (e) => { if (e.target?.id !== BTN_ID) removeBtn(); });
    document.addEventListener('keydown',   (e) => { if (e.key === 'Escape') removeBtn(); });
    document.addEventListener('scroll',    removeBtn, { passive: true });

    // ─────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────

    let isInitialized = false;

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;
        isInitialized = true;

        buildSettingsModal();
        setTimeout(attemptRegistration, 1000);
        console.log('✅ General Toolkit v' + SCRIPT_VERSION + ' ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => {
        if (!isRegistered) attemptRegistration();
    });

})();
