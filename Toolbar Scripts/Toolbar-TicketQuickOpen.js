// ==UserScript==
// @name         |Toolbar| Ticket Quick Open
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-TicketQuickOpen.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-TicketQuickOpen.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0
// @description  Highlight a RITM or PER ticket number on any page to get a floating button that opens the ticket in a new tab. Toggle via Toolbar.
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

    const SCRIPT_VERSION = '1.0';
    const CHANGELOG = `Version 1.0:
- Initial release as toolbar script. Highlight any RITM or PER number on any page to open the ticket in a new tab.`;

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

    const SETTING_KEY = 'tqo_enabled';
    function isEnabled()   { return GM_getValue(SETTING_KEY, true); }
    function setEnabled(v) { GM_setValue(SETTING_KEY, !!v); }

    const TICKET_TYPES = {
        RITM: {
            regex: /^RITM\d+$/i,
            url:   (n) => `https://deloitteglobal.service-now.com/sc_req_item.do?sys_id=${n}`,
            color: '#0073e6',
        },
        PER: {
            regex: /^PER\d+$/i,
            url:   (n) => `https://deloitteglobal.service-now.com/sn_compliance_policy_exception.do?sys_id=${n}`,
            color: '#7c3aed',
        },
    };

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
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'Ticket Quick Open', position: TOOL_POSITION }
            }));
            isRegistered = true;
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

        const body = document.createElement('div');
        body.textContent = CHANGELOG;
        Object.assign(body.style, {
            whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px',
            fontFamily: "'Courier New', monospace", background: '#fafafa',
            padding: '10px', borderRadius: '5px', marginBottom: '0',
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
            document.getElementById('tqo-changelog-notif')?.remove();
        };

        modal.append(title, body, closeBtn);
        document.body.append(overlay, modal);
        overlay.onclick = () => closeBtn.click();
    }

    // ─────────────────────────────────────────────────────────────
    // SETTINGS MODAL
    // ─────────────────────────────────────────────────────────────

    const MODAL_ID       = 'tqo-settings-modal';
    const TOGGLE_ROW_ID  = 'tqo-toggle-row';

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
            width: '420px', maxWidth: '95vw', maxHeight: '90vh',
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
        titleEl.textContent = '🎫 Ticket Quick Open — Settings';
        header.appendChild(titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: '#e53935', color: '#fff', border: 'none', borderRadius: '4px',
            cursor: 'pointer', padding: '4px 9px', fontWeight: 'bold', fontSize: '13px',
        });
        closeBtn.addEventListener('click', hideSettingsModal);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        /* ── Body (scrollable) ── */
        const body = document.createElement('div');
        Object.assign(body.style, { padding: '16px 20px', overflowY: 'auto', flex: '1' });
        modal.appendChild(body);

        /* ── Enable / disable toggle ── */
        const toggleRow = document.createElement('div');
        toggleRow.id = TOGGLE_ROW_ID;
        Object.assign(toggleRow.style, {
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px',
            padding: '12px 14px', marginBottom: '18px', cursor: 'pointer',
            transition: 'border-color 0.15s',
        });

        const toggleWrap = document.createElement('div');
        Object.assign(toggleWrap.style, { flexShrink: '0', marginTop: '2px' });

        const toggle = document.createElement('input');
        toggle.type    = 'checkbox';
        toggle.id      = 'tqo-toggle';
        toggle.checked = isEnabled();
        Object.assign(toggle.style, { width: '36px', height: '20px', cursor: 'pointer', accentColor: '#1a73e8' });
        toggle.addEventListener('change', () => {
            setEnabled(toggle.checked);
            updateToggleStyle(toggleRow, toggle.checked);
        });
        toggleWrap.appendChild(toggle);
        toggleRow.appendChild(toggleWrap);

        const toggleText = document.createElement('div');
        const lbl = document.createElement('div');
        Object.assign(lbl.style, { fontWeight: 'bold', fontSize: '13px', color: '#222', marginBottom: '3px' });
        lbl.textContent = '🎫 Enable Ticket Quick Open';
        const desc = document.createElement('div');
        Object.assign(desc.style, { fontSize: '12px', color: '#666', lineHeight: '1.4' });
        desc.textContent = 'When enabled, selecting a ticket number on any page shows a floating button to open it in a new tab.';
        toggleText.append(lbl, desc);
        toggleRow.appendChild(toggleText);
        toggleRow.addEventListener('click', (e) => { if (e.target !== toggle) toggle.click(); });
        updateToggleStyle(toggleRow, toggle.checked);
        body.appendChild(toggleRow);

        /* ── Supported ticket types ── */
        const sectionLabel = document.createElement('div');
        Object.assign(sectionLabel.style, {
            fontSize: '11px', fontWeight: 'bold', color: '#888',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px',
        });
        sectionLabel.textContent = 'Supported ticket types';
        body.appendChild(sectionLabel);

        Object.entries(TICKET_TYPES).forEach(([type, cfg]) => {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '12px',
                background: '#fff', border: '1px solid #e0e0e0', borderRadius: '7px',
                padding: '10px 14px', marginBottom: '8px',
            });

            const badge = document.createElement('span');
            badge.textContent = type;
            Object.assign(badge.style, {
                background: cfg.color, color: '#fff', borderRadius: '4px',
                padding: '3px 10px', fontWeight: 'bold', fontSize: '12px', flexShrink: '0',
            });

            const urlExample = document.createElement('span');
            Object.assign(urlExample.style, {
                fontSize: '11px', color: '#777', fontFamily: "'Courier New', monospace",
                wordBreak: 'break-all',
            });
            urlExample.textContent = cfg.url(`${type}…`);

            row.append(badge, urlExample);
            body.appendChild(row);
        });

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
            Object.assign(notifText.style, {
                fontSize: '11px', color: '#0066cc', textDecoration: 'underline',
            });

            notif.append(dot, notifText);
            notif.onclick = () => showChangelogModal();
            footer.appendChild(notif);
        }

        modal.appendChild(footer);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    }

    function updateToggleStyle(row, enabled) {
        row.style.borderColor = enabled ? '#1a73e8' : '#e0e0e0';
        row.style.background  = enabled ? '#f0f6ff' : '#fff';
        row.style.opacity     = enabled ? '1'       : '0.7';
    }

    function showSettingsModal() {
        buildSettingsModal();

        // Re-sync toggle to stored value (may have changed in another tab)
        const toggle    = document.getElementById('tqo-toggle');
        const toggleRow = document.getElementById(TOGGLE_ROW_ID);
        if (toggle && toggleRow) {
            toggle.checked = isEnabled();
            updateToggleStyle(toggleRow, toggle.checked);
        }

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
        // Trim whitespace and strip leading/trailing punctuation so partial
        // selections like "RITM1234567." or " RITM1234567 " still match.
        const text = rawText.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toUpperCase();
        for (const [, cfg] of Object.entries(TICKET_TYPES)) {
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
        if (!isEnabled()) { removeBtn(); return; }

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
        console.log('✅ Ticket Quick Open v' + SCRIPT_VERSION + ' ready');
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
