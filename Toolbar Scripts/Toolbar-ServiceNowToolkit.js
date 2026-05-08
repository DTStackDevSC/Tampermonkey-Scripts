// ==UserScript==
// @name         |Toolbar| ServiceNow Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.2.3
// @description  Work note & comment draft autosave with toolbar management panel
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('🛠️ ServiceNow Toolkit loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.3';
    const CHANGELOG = `Version 1.2.3:
- Fixed the "What's new" link not appearing in the settings modal. The stored
  version was being saved on page load before the changelog was ever seen,
  causing the new version check to always return false on subsequent loads.
  Version is now only saved when the changelog modal is dismissed.

Version 1.2.2:
- Changelog is now accessible via a "What's new" link in the settings modal
  footer instead of an auto-popup on page load.
- Toolbar button shows a pulsing notification dot when a new version has not
  been seen yet.
- Changelog modal renders as collapsible version cards - most recent expanded
  by default, older entries can be opened individually.

Version 1.2.0:
- Drafts older than 7 days are now automatically deleted on page load

Version 1.1.4:
- Drafts are now preserved when a save fails due to session timeout or permission errors`;

    const GM_KEY_VERSION        = 'snToolkitVersion';
    const GM_KEY_CHANGELOG_SEEN = 'snToolkitChangelogSeen';

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

    const TOOL_ID       = 'serviceNowToolkit';
    const TOOL_TOOLTIP  = 'ServiceNow Toolkit';
    const TOOL_POSITION = 10;
    const MODAL_ID      = 'sn-toolkit-modal';

    const GM_KEY_DRAFTS   = 'sn_toolkit_drafts';
    const GM_KEY_AUTOSAVE = 'sn_toolkit_autosave_enabled';
    const AUTOSAVE_DELAY  = 3000;
    const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    const SESSION_KEY_SUBMIT_INTENT = 'sn_toolkit_submit_intent';
    const SUBMIT_INTENT_TTL_MS      = 60000;

    // Ordered by specificity — first match wins per selector pass
    const FIELD_SELECTORS = [
        { sel: '#activity-stream-work_notes-textarea', label: 'Work Notes' },
        { sel: '#activity-stream-comments-textarea',   label: 'Comments'   },
        { sel: 'textarea[id*="work_notes"]',           label: 'Work Notes' },
        { sel: 'textarea[name="work_notes"]',          label: 'Work Notes' },
        { sel: 'textarea[id*="comments"]',             label: 'Comments'   },
        { sel: 'textarea[name="comments"]',            label: 'Comments'   },
    ];

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"/>
    </svg>`;

    let isInitialized = false;
    let isRegistered  = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY  = 500;

    /* ==========================================================
     *  SETTINGS
     * ==========================================================*/

    function getAutosaveEnabled() { return GM_getValue(GM_KEY_AUTOSAVE, true); }
    function setAutosaveEnabled(v) { GM_setValue(GM_KEY_AUTOSAVE, v); }

    /* ==========================================================
     *  DRAFT STORAGE  (GM storage — persists across sessions)
     * ==========================================================*/

    function fieldSlug(label) {
        return label.toLowerCase().replace(/ /g, '_');
    }

    function getDraftsObj() {
        try { return JSON.parse(GM_getValue(GM_KEY_DRAFTS, '{}')); }
        catch { return {}; }
    }

    function saveDraft(ticket, content, fieldLabel) {
        const drafts = getDraftsObj();
        drafts[ticket + '_' + fieldSlug(fieldLabel)] = {
            ticket, content, fieldLabel, savedAt: Date.now(), url: location.href
        };
        GM_setValue(GM_KEY_DRAFTS, JSON.stringify(drafts));
    }

    function loadDraft(ticket, fieldLabel) {
        return getDraftsObj()[ticket + '_' + fieldSlug(fieldLabel)] || null;
    }

    function deleteDraft(ticket, fieldLabel) {
        const drafts = getDraftsObj();
        delete drafts[ticket + '_' + fieldSlug(fieldLabel)];
        GM_setValue(GM_KEY_DRAFTS, JSON.stringify(drafts));
    }

    function hasDraft(ticket, fieldLabel) {
        const d = getDraftsObj()[ticket + '_' + fieldSlug(fieldLabel)];
        return !!(d?.content);
    }

    function getAllDrafts() {
        return Object.values(getDraftsObj()).sort((a, b) => b.savedAt - a.savedAt);
    }

    function clearAllDrafts() {
        GM_setValue(GM_KEY_DRAFTS, '{}');
    }

    function pruneExpiredDrafts() {
        const drafts = getDraftsObj();
        let pruned = 0;
        for (const key of Object.keys(drafts)) {
            if (Date.now() - (drafts[key].savedAt || 0) > DRAFT_MAX_AGE_MS) {
                delete drafts[key];
                pruned++;
            }
        }
        if (pruned > 0) {
            GM_setValue(GM_KEY_DRAFTS, JSON.stringify(drafts));
            console.log(`🛠️ Toolkit: pruned ${pruned} expired draft(s)`);
        }
    }

    /* ==========================================================
     *  SUBMIT INTENT  (sessionStorage — survives page navigation within the tab)
     *
     *  Stores which ticket + fields the user just tried to save.
     *  On the next ticket page load we check if the ticket matches and the
     *  intent is fresh (< SUBMIT_INTENT_TTL_MS).  If so the save succeeded
     *  and we silently clear the drafts.  If we land on any non-ticket page
     *  first (login / error / home) the intent is wiped without touching
     *  drafts, so the user gets the restore prompt when they come back.
     * ==========================================================*/

    function storeSubmitIntent(ticket, fieldLabels) {
        sessionStorage.setItem(SESSION_KEY_SUBMIT_INTENT, JSON.stringify({
            ticket, fields: fieldLabels, ts: Date.now(),
        }));
    }

    function consumeSubmitIntent() {
        const raw = sessionStorage.getItem(SESSION_KEY_SUBMIT_INTENT);
        sessionStorage.removeItem(SESSION_KEY_SUBMIT_INTENT);
        if (!raw) return null;
        try {
            const intent = JSON.parse(raw);
            if (Date.now() - intent.ts > SUBMIT_INTENT_TTL_MS) return null;
            return intent;
        } catch { return null; }
    }

    /* ==========================================================
     *  UI COMPONENTS — floating indicator (ticket pages)
     * ==========================================================*/

    let indicatorEl      = null;
    let autoDismissTimer = null;

    function buildIndicator() {
        if (indicatorEl && document.contains(indicatorEl)) return;
        indicatorEl = document.createElement('div');
        indicatorEl.id = 'sn-toolkit-indicator';
        Object.assign(indicatorEl.style, {
            position: 'fixed', bottom: '24px', right: '80px',
            display: 'none', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
            padding: '7px 12px', background: '#ffffff',
            border: '1px solid #c5d3f0', borderLeft: '4px solid #4a90d9',
            borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            fontSize: '12px', color: '#2c3e6a',
            fontFamily: 'Arial, Helvetica, sans-serif',
            zIndex: '99990', userSelect: 'none', maxWidth: '420px',
        });
        document.body.appendChild(indicatorEl);
    }

    function makeBtn(label, onClick, accent) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: '3px 9px', fontSize: '11px',
            border: accent ? '1px solid #4a90d9' : '1px solid #c5d3f0',
            borderRadius: '3px',
            background: accent ? '#e8f0fe' : '#f7f9ff',
            color: accent ? '#1a5cb8' : '#3a3a6a',
            cursor: 'pointer', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap',
        });
        btn.addEventListener('mouseover', () => btn.style.opacity = '0.7');
        btn.addEventListener('mouseout',  () => btn.style.opacity = '1');
        btn.addEventListener('click', onClick);
        return btn;
    }

    function showIndicator(icon, text, actions = [], autoDismissMs = 0) {
        clearTimeout(autoDismissTimer);
        buildIndicator();
        indicatorEl.innerHTML = '';
        const msg = document.createElement('span');
        msg.textContent = `${icon} ${text}`;
        indicatorEl.appendChild(msg);
        actions.forEach(({ label, onClick, accent }) => indicatorEl.appendChild(makeBtn(label, onClick, accent)));
        indicatorEl.style.display = 'inline-flex';
        if (autoDismissMs > 0) {
            autoDismissTimer = setTimeout(() => { if (indicatorEl) indicatorEl.style.display = 'none'; }, autoDismissMs);
        }
    }

    function hideIndicator() {
        clearTimeout(autoDismissTimer);
        if (indicatorEl) indicatorEl.style.display = 'none';
    }

    /* ==========================================================
     *  UI COMPONENTS — settings / drafts modal
     * ==========================================================*/

    function relTime(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60)   return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    }

    function truncate(str, n = 90) {
        const c = (str || '').replace(/\s+/g, ' ').trim();
        return c.length > n ? c.slice(0, n) + '…' : c;
    }

    function updateRowStyle(row, enabled) {
        row.style.borderColor = enabled ? '#1a73e8' : '#e0e0e0';
        row.style.background  = enabled ? '#f0f6ff' : '#ffffff';
    }

    function buildModal() {
        if (document.getElementById(MODAL_ID)) return;

        /* ── Backdrop ── */
        const backdrop = document.createElement('div');
        backdrop.id = MODAL_ID + '-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.35)',
            zIndex: '999997', display: 'none',
            alignItems: 'center', justifyContent: 'center',
        });
        backdrop.addEventListener('click', e => { if (e.target === backdrop) hideModal(); });

        /* ── Card ── */
        const card = document.createElement('div');
        card.id = MODAL_ID;
        Object.assign(card.style, {
            position: 'relative', background: '#f9f9f9',
            border: '1px solid #ccc', boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            borderRadius: '10px', zIndex: '999998',
            fontFamily: 'Arial, sans-serif',
            minWidth: '440px', maxWidth: '520px', width: '100%',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        });

        /* ── Header ── */
        const header = document.createElement('div');
        header.id = MODAL_ID + '-header';
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px 10px', borderBottom: '1px solid #e0e0e0', flexShrink: '0',
        });

        const headerLeft = document.createElement('div');
        Object.assign(headerLeft.style, { display: 'flex', alignItems: 'center', gap: '8px' });

        const backBtn = document.createElement('button');
        backBtn.id = MODAL_ID + '-back-btn';
        backBtn.textContent = '← Back';
        Object.assign(backBtn.style, {
            display: 'none', padding: '3px 10px', fontSize: '12px',
            border: '1px solid #ccc', borderRadius: '4px',
            background: '#f5f5f5', color: '#333', cursor: 'pointer', fontFamily: 'Arial, sans-serif',
        });
        backBtn.addEventListener('mouseenter', () => backBtn.style.background = '#e8e8e8');
        backBtn.addEventListener('mouseleave', () => backBtn.style.background = '#f5f5f5');
        backBtn.addEventListener('click', () => switchView('settings'));

        const titleEl = document.createElement('div');
        titleEl.id = MODAL_ID + '-title';
        Object.assign(titleEl.style, { fontSize: '12px', fontWeight: 'bold', color: '#333' });
        titleEl.textContent = '🛠️ ServiceNow Toolkit — Settings';

        headerLeft.appendChild(backBtn);
        headerLeft.appendChild(titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: '#e53935', color: '#fff', border: 'none',
            borderRadius: '4px', cursor: 'pointer',
            padding: '4px 9px', fontWeight: 'bold', fontSize: '13px', flexShrink: '0',
        });
        closeBtn.addEventListener('click', hideModal);
        header.appendChild(headerLeft);
        header.appendChild(closeBtn);
        card.appendChild(header);

        /* ── Scrollable body ── */
        const body = document.createElement('div');
        body.id = MODAL_ID + '-body';
        Object.assign(body.style, { overflowY: 'auto', flex: '1', padding: '16px 20px' });
        card.appendChild(body);

        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        // Build both views
        buildSettingsView(body);
        buildDraftsView(body);
        switchView('settings');
    }

    /* ── Settings view ── */
    function buildSettingsView(body) {
        const view = document.createElement('div');
        view.id = MODAL_ID + '-view-settings';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Toggle features on or off. Changes take effect immediately and are saved across sessions.';
        Object.assign(subtitle.style, {
            fontSize: '12px', color: '#666', margin: '0 0 14px', lineHeight: '1.5',
        });
        view.appendChild(subtitle);

        // ── Feature: Autosave ──
        const featureRow = document.createElement('div');
        Object.assign(featureRow.style, {
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            background: '#fff', border: '1px solid #e0e0e0',
            borderRadius: '8px', padding: '12px 14px', cursor: 'pointer',
            transition: 'border-color 0.15s',
        });

        const toggleWrapper = document.createElement('div');
        Object.assign(toggleWrapper.style, { flexShrink: '0', marginTop: '2px' });

        const toggle = document.createElement('input');
        toggle.type    = 'checkbox';
        toggle.id      = MODAL_ID + '-autosave-toggle';
        toggle.checked = getAutosaveEnabled();
        Object.assign(toggle.style, { width: '36px', height: '20px', cursor: 'pointer', accentColor: '#1a73e8' });
        toggle.addEventListener('change', () => {
            setAutosaveEnabled(toggle.checked);
            updateRowStyle(featureRow, toggle.checked);
        });
        toggleWrapper.appendChild(toggle);

        const textBlock = document.createElement('div');
        Object.assign(textBlock.style, { flex: '1' });

        const featureLabel = document.createElement('div');
        featureLabel.textContent = '📝 Work Note Draft Autosave';
        Object.assign(featureLabel.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#222', marginBottom: '3px',
        });

        const featureDesc = document.createElement('div');
        featureDesc.textContent = 'Auto-saves Work Notes and Comments fields as you type on ticket pages. Drafts persist across sessions until manually deleted.';
        Object.assign(featureDesc.style, { fontSize: '12px', color: '#666', lineHeight: '1.4', marginBottom: '10px' });

        const viewDraftsBtn = document.createElement('button');
        viewDraftsBtn.textContent = 'View Saved Drafts →';
        Object.assign(viewDraftsBtn.style, {
            padding: '5px 12px', fontSize: '12px',
            border: '1px solid #1a73e8', borderRadius: '4px',
            background: '#e8f0fe', color: '#1a73e8',
            cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold',
        });
        viewDraftsBtn.addEventListener('mouseenter', () => viewDraftsBtn.style.background = '#d2e3fc');
        viewDraftsBtn.addEventListener('mouseleave', () => viewDraftsBtn.style.background = '#e8f0fe');
        viewDraftsBtn.addEventListener('click', e => { e.stopPropagation(); switchView('drafts'); });

        textBlock.appendChild(featureLabel);
        textBlock.appendChild(featureDesc);
        textBlock.appendChild(viewDraftsBtn);

        featureRow.appendChild(toggleWrapper);
        featureRow.appendChild(textBlock);
        featureRow.addEventListener('click', e => { if (e.target !== toggle && e.target !== viewDraftsBtn) toggle.click(); });
        updateRowStyle(featureRow, toggle.checked);
        view.appendChild(featureRow);

        // ── Version footer ──
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            marginTop: '16px', fontSize: '11px', color: '#aaa',
            textAlign: 'right', fontFamily: 'Arial, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
        });

        if (isNewVersion() && !hasSeenChangelog()) {
            const whatsNewLink = document.createElement('span');
            whatsNewLink.textContent = "What's new";
            Object.assign(whatsNewLink.style, {
                fontSize: '11px', color: '#667eea', cursor: 'pointer',
                textDecoration: 'underline', fontFamily: 'Arial, sans-serif',
            });
            whatsNewLink.onclick = () => { hideModal(); showChangelogModal(); };

            const dot = document.createElement('span');
            Object.assign(dot.style, {
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#007bff', display: 'inline-block', flexShrink: '0',
            });
            let dotBlue = true;
            setInterval(() => {
                dotBlue = !dotBlue;
                dot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);

            versionRow.appendChild(whatsNewLink);
            versionRow.appendChild(dot);
        }

        const versionLabel = document.createElement('span');
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        versionRow.appendChild(versionLabel);
        view.appendChild(versionRow);

        body.appendChild(view);
    }

    /* ── Drafts view ── */
    function buildDraftsView(body) {
        const view = document.createElement('div');
        view.id = MODAL_ID + '-view-drafts';
        view.style.display = 'none';
        body.appendChild(view);
    }

    function renderDraftsView() {
        const view = document.getElementById(MODAL_ID + '-view-drafts');
        if (!view) return;
        view.innerHTML = '';

        const drafts = getAllDrafts();

        if (drafts.length === 0) {
            const empty = document.createElement('div');
            Object.assign(empty.style, {
                textAlign: 'center', color: '#888', fontSize: '13px',
                padding: '32px 0', fontFamily: 'Arial, sans-serif',
            });
            empty.textContent = 'No saved drafts.';
            view.appendChild(empty);
            return;
        }

        // Clear all row
        const topRow = document.createElement('div');
        Object.assign(topRow.style, { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' });
        const clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '🗑️ Clear All';
        Object.assign(clearAllBtn.style, {
            padding: '5px 12px', fontSize: '12px',
            border: '1px solid #e53935', borderRadius: '4px',
            background: '#fff5f5', color: '#e53935',
            cursor: 'pointer', fontFamily: 'Arial, sans-serif',
        });
        clearAllBtn.addEventListener('mouseenter', () => clearAllBtn.style.background = '#fde0de');
        clearAllBtn.addEventListener('mouseleave', () => clearAllBtn.style.background = '#fff5f5');
        clearAllBtn.addEventListener('click', () => { clearAllDrafts(); renderDraftsView(); });
        topRow.appendChild(clearAllBtn);
        view.appendChild(topRow);

        drafts.forEach(draft => {
            const card = document.createElement('div');
            Object.assign(card.style, {
                background: '#fff', border: '1px solid #dee2e6',
                borderRadius: '8px', padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: '4px',
                marginBottom: '8px',
            });

            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

            const ticketLabel = document.createElement('strong');
            ticketLabel.textContent = draft.ticket;
            Object.assign(ticketLabel.style, {
                fontSize: '13px', color: '#222', fontFamily: 'Arial, sans-serif',
            });

            const meta = document.createElement('div');
            Object.assign(meta.style, { display: 'flex', gap: '6px', alignItems: 'center' });

            const fieldBadge = document.createElement('span');
            fieldBadge.textContent = draft.fieldLabel || 'Work Notes';
            Object.assign(fieldBadge.style, {
                fontSize: '11px', padding: '2px 6px', borderRadius: '3px',
                background: '#e8f0fe', color: '#1a73e8', fontFamily: 'Arial, sans-serif',
            });

            const timeSpan = document.createElement('span');
            timeSpan.textContent = relTime(draft.savedAt);
            Object.assign(timeSpan.style, {
                fontSize: '11px', color: '#888', fontFamily: 'Arial, sans-serif',
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.title = 'Delete draft';
            Object.assign(delBtn.style, {
                border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: '14px', lineHeight: '1', padding: '0 2px', opacity: '0.65',
            });
            delBtn.addEventListener('mouseenter', () => delBtn.style.opacity = '1');
            delBtn.addEventListener('mouseleave', () => delBtn.style.opacity = '0.65');
            delBtn.addEventListener('click', () => { deleteDraft(draft.ticket, draft.fieldLabel); renderDraftsView(); });

            meta.appendChild(fieldBadge);
            meta.appendChild(timeSpan);
            meta.appendChild(delBtn);
            cardHeader.appendChild(ticketLabel);
            cardHeader.appendChild(meta);

            const preview = document.createElement('div');
            preview.textContent = truncate(draft.content);
            Object.assign(preview.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.45',
                fontFamily: 'Arial, sans-serif',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            });

            card.appendChild(cardHeader);
            card.appendChild(preview);
            view.appendChild(card);
        });
    }

    /* ── View switching ── */
    function switchView(viewName) {
        const settingsView = document.getElementById(MODAL_ID + '-view-settings');
        const draftsView   = document.getElementById(MODAL_ID + '-view-drafts');
        const backBtn      = document.getElementById(MODAL_ID + '-back-btn');
        const titleEl      = document.getElementById(MODAL_ID + '-title');

        if (!settingsView || !draftsView) return;

        if (viewName === 'drafts') {
            settingsView.style.display = 'none';
            draftsView.style.display   = 'block';
            backBtn.style.display      = 'inline-block';
            titleEl.textContent        = '📋 Saved Drafts';
            renderDraftsView();
        } else {
            draftsView.style.display   = 'none';
            settingsView.style.display = 'block';
            backBtn.style.display      = 'none';
            titleEl.textContent        = '🛠️ ServiceNow Toolkit — Settings';
        }
    }

    function showModal() {
        buildModal();
        switchView('settings');
        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'flex';
    }

    function hideModal() {
        const backdrop = document.getElementById(MODAL_ID + '-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    }

    /* ==========================================================
     *  MAIN LOGIC — TICKET PAGE AUTOSAVE
     * ==========================================================*/

    function getTicketNumber() {
        const el =
            document.querySelector('input[id*="sc_req_item.number"]') ||
            document.querySelector('input[id*="incident.number"]')     ||
            document.querySelector('input[id$=".number"][readonly]');
        return el?.value?.trim() || null;
    }

    function findWorkNotesFields() {
        const found      = [];
        const seenEls    = new Set();
        const seenLabels = new Set();
        for (const { sel, label } of FIELD_SELECTORS) {
            const el = document.querySelector(sel);
            if (el && !seenEls.has(el) && !seenLabels.has(label)) {
                seenEls.add(el);
                seenLabels.add(label);
                found.push({ el, label });
            }
        }
        return found;
    }

    function handleDraftRestorePrompt(ticketNum, fields) {
        const pending = fields
            .map(({ el, label }) => ({ el, label, draft: loadDraft(ticketNum, label) }))
            .filter(f => f.draft?.content);

        if (pending.length === 0) return;

        function showPrompt(remaining) {
            const isMulti = remaining.length > 1;
            const text = isMulti
                ? `${remaining.length} saved drafts (${remaining.map(f => f.label).join(' + ')})`
                : `Saved draft found (${remaining[0].label})`;

            const restoreActions = remaining.map(({ el, label, draft }) => ({
                label: isMulti ? `↩ ${label}` : 'Restore',
                accent: true,
                onClick: () => {
                    el.value = draft.content;
                    const rest = remaining.filter(f => f.label !== label);
                    if (rest.length === 0) {
                        showIndicator('✅', `${label} draft restored`, [
                            { label: 'Clear', onClick: () => { deleteDraft(ticketNum, label); hideIndicator(); } }
                        ]);
                    } else {
                        showIndicator(
                            '✅', `${label} restored — also: ${rest.map(f => f.label).join(', ')}`,
                            rest.map(({ el: rEl, label: rLabel, draft: rDraft }) => ({
                                label: `↩ ${rLabel}`, accent: true,
                                onClick: () => {
                                    rEl.value = rDraft.content;
                                    showIndicator('✅', 'All drafts restored', [
                                        { label: 'Clear All', onClick: () => { remaining.forEach(f => deleteDraft(ticketNum, f.label)); hideIndicator(); } }
                                    ]);
                                }
                            })).concat([{
                                label: 'Delete',
                                onClick: () => { rest.forEach(f => deleteDraft(ticketNum, f.label)); hideIndicator(); }
                            }])
                        );
                    }
                }
            }));

            showIndicator('📝', text, [
                ...restoreActions,
                {
                    label: isMulti ? 'Delete All' : 'Delete',
                    onClick: () => { remaining.forEach(f => deleteDraft(ticketNum, f.label)); hideIndicator(); }
                }
            ]);
        }

        showPrompt(pending);
    }

    const SUBMIT_SELECTORS = [
        '#sysverb_update',
        '#sysverb_update_and_stay',
        '#sysverb_save',
        'button[name="sysverb_update"]',
        'button[name="sysverb_update_and_stay"]',
        'button[name="sysverb_save"]',
    ];

    function attachSubmitListeners(ticketNum, fields) {
        function onSubmitClick() {
            // Record intent but do NOT delete drafts yet — we don't know if the
            // save will succeed.  The next ticket page load will confirm success
            // and clear them, or they'll survive if the session was expired.
            storeSubmitIntent(ticketNum, fields.map(f => f.label));
        }

        SUBMIT_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(btn => {
                if (!btn.dataset.snToolkitBound) {
                    btn.dataset.snToolkitBound = '1';
                    btn.addEventListener('click', onSubmitClick);
                }
            });
        });
    }

    function startAutosave(ticketNum, fieldEl, fieldLabel) {
        let lastSaved = loadDraft(ticketNum, fieldLabel)?.content || '';
        let lastValue = fieldEl.value;

        setInterval(() => {
            if (!getAutosaveEnabled()) return;

            const current = fieldEl.value;

            // Field cleared after having content — activity stream post or other submit mechanism
            if (lastValue && !current && hasDraft(ticketNum, fieldLabel)) {
                deleteDraft(ticketNum, fieldLabel);
                lastSaved = '';
                showIndicator('✅', `${fieldLabel} draft cleared`, [], 2500);
                lastValue = current;
                return;
            }

            lastValue = current;

            if (current && current !== lastSaved) {
                saveDraft(ticketNum, current, fieldLabel);
                lastSaved = current;
                showIndicator('💾', `${fieldLabel} draft saved`, [
                    {
                        label: 'Clear',
                        onClick: () => { deleteDraft(ticketNum, fieldLabel); lastSaved = ''; hideIndicator(); }
                    }
                ], 3000);
            }
        }, AUTOSAVE_DELAY);

        console.log(`✅ Toolkit autosave active: ${ticketNum} / ${fieldLabel}`);
    }

    function initTicketPage() {
        let retries = 0;

        function tryInit() {
            const ticketNum = getTicketNumber();
            const fields    = findWorkNotesFields();

            if (ticketNum && fields.length > 0) {
                buildIndicator();

                const intent = consumeSubmitIntent();
                if (intent && intent.ticket === ticketNum) {
                    // Same ticket reloaded within TTL — save succeeded, clear drafts silently
                    let cleared = 0;
                    (intent.fields || []).forEach(label => {
                        if (hasDraft(ticketNum, label)) { deleteDraft(ticketNum, label); cleared++; }
                    });
                    if (cleared > 0) {
                        showIndicator('✅', cleared === 1 ? 'Draft cleared after save' : `${cleared} drafts cleared after save`, [], 3000);
                    }
                } else if (getAutosaveEnabled()) {
                    handleDraftRestorePrompt(ticketNum, fields);
                }

                attachSubmitListeners(ticketNum, fields);
                fields.forEach(({ el, label }) => startAutosave(ticketNum, el, label));
            } else if (retries < 12) {
                retries++;
                setTimeout(tryInit, 1500);
            } else {
                console.log('⚠️ Toolkit: could not detect ticket number or work notes field');
            }
        }

        tryInit();
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
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            background: '#fff', borderRadius: '8px',
            padding: '24px', width: '420px', maxWidth: '90vw',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, { margin: '0 0 6px', fontSize: '16px', color: '#1d1d1d' });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `ServiceNow Toolkit updated to v${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, { fontSize: '13px', color: '#666', marginBottom: '16px' });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '16px';
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

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            display: 'block', margin: '0 auto',
            padding: '8px 28px', borderRadius: '6px',
            background: '#667eea', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'Arial, sans-serif',
        });
        closeButton.onclick = () => {
            overlay.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeButton.click(); });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'snToolkit-notif-dot';

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

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ ServiceNow Toolkit: max registration attempts reached');
            return;
        }

        registrationAttempts++;
        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: TOOL_TOOLTIP, position: TOOL_POSITION }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ ServiceNow Toolkit registered!');
        } else {
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    document.addEventListener('toolbarReady', () => attemptRegistration());
    document.addEventListener('toolbarToolClicked', e => {
        if (e.detail.id === TOOL_ID) showModal();
    });

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;

        const isTicketPage = /\/(sc_req_item|incident)\.do(\?|$)/.test(location.pathname + location.search);

        if (!isTicketPage) {
            // If we landed on a non-ticket page (login, error, home) after a save
            // attempt, the save failed — discard the intent without touching drafts
            // so the restore prompt appears when the user returns to the ticket.
            sessionStorage.removeItem(SESSION_KEY_SUBMIT_INTENT);
        }

        pruneExpiredDrafts();
        buildModal();
        setTimeout(attemptRegistration, 1000);

        if (isTicketPage) {
            console.log('🛠️ Toolkit: ticket page — autosave starting');
            initTicketPage();
        }

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log(`✅ ServiceNow Toolkit v${SCRIPT_VERSION} loaded`);

})();
