// ==UserScript==
// @name         |Toolbar| General Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-GeneralToolkit.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-GeneralToolkit.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.3
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

    const SCRIPT_VERSION = '1.3';
    const CHANGELOG = `Version 1.3:
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
        header.appendChild(closeBtn);
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
                body:  'Detect RITM, INC, and PER numbers and open them in ServiceNow.',
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
                body:  'Detect 006XXXXX case numbers and search for them in the Netskope support portal.',
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
