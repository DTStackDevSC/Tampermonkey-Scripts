// ==UserScript==
// @name         |Toolbar| ServiceNow Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.0
// @description  Work note & comment draft autosave with toolbar management panel
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/now/platform-analytics-workspace/dashboards/
// @match        https://*.service-now.com/now/platform-analytics-workspace/dashboards*
// @match        https://*.service-now.com/now/nav/ui/classic/params/target/%24pa_dashboard.do
// @match        https://*.service-now.com/now/nav/ui/classic/params/target/%24pa_dashboard.do*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('🛠️ ServiceNow Toolkit loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.0';
    const CHANGELOG = `Version 1.0.0:
- Initial release: work note and comment draft autosave
- Drafts stored per-ticket in sessionStorage (cleared when browser closes)
- Floating indicator on ticket pages: restore, clear, and post-submit prompt
- Toolbar panel on dashboard: view, restore context, and delete saved drafts`;

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

    const DRAFT_PREFIX   = 'sn_toolkit_draft_';
    const AUTOSAVE_DELAY = 3000; // ms between saves

    // Ordered by specificity — first match wins
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
     *  DRAFT STORAGE  (sessionStorage — cleared on browser close)
     * ==========================================================*/

    function saveDraft(ticket, content, fieldLabel) {
        sessionStorage.setItem(DRAFT_PREFIX + ticket, JSON.stringify({
            ticket, content, fieldLabel,
            savedAt: Date.now(),
            url: location.href
        }));
    }

    function loadDraft(ticket) {
        try {
            const raw = sessionStorage.getItem(DRAFT_PREFIX + ticket);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function deleteDraft(ticket) {
        sessionStorage.removeItem(DRAFT_PREFIX + ticket);
    }

    function hasDraft(ticket) {
        return sessionStorage.getItem(DRAFT_PREFIX + ticket) !== null;
    }

    function getAllDrafts() {
        const result = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(DRAFT_PREFIX)) {
                try {
                    const d = JSON.parse(sessionStorage.getItem(key));
                    if (d) result.push(d);
                } catch { /* skip malformed */ }
            }
        }
        return result.sort((a, b) => b.savedAt - a.savedAt);
    }

    /* ==========================================================
     *  UI COMPONENTS
     * ==========================================================*/

    // ── Floating indicator (ticket pages) ──────────────────────

    let indicatorEl      = null;
    let autoDismissTimer = null;

    function buildIndicator() {
        if (indicatorEl && document.contains(indicatorEl)) return;
        indicatorEl = document.createElement('div');
        indicatorEl.id = 'sn-toolkit-indicator';
        Object.assign(indicatorEl.style, {
            position: 'fixed',
            bottom: '24px',
            right: '80px',
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            background: '#ffffff',
            border: '1px solid #c5d3f0',
            borderLeft: '4px solid #4a90d9',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
            fontSize: '12px',
            color: '#2c3e6a',
            fontFamily: 'Arial, Helvetica, sans-serif',
            zIndex: '99990',
            userSelect: 'none',
            maxWidth: '400px',
        });
        document.body.appendChild(indicatorEl);
    }

    function makeActionBtn(label, onClick, accent) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: '3px 9px',
            fontSize: '11px',
            border: accent ? '1px solid #4a90d9' : '1px solid #c5d3f0',
            borderRadius: '3px',
            background: accent ? '#e8f0fe' : '#f7f9ff',
            color: accent ? '#1a5cb8' : '#3a3a6a',
            cursor: 'pointer',
            fontFamily: 'Arial, Helvetica, sans-serif',
            whiteSpace: 'nowrap',
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

        actions.forEach(({ label, onClick, accent }) => {
            indicatorEl.appendChild(makeActionBtn(label, onClick, accent));
        });

        indicatorEl.style.display = 'inline-flex';

        if (autoDismissMs > 0) {
            autoDismissTimer = setTimeout(() => {
                if (indicatorEl) indicatorEl.style.display = 'none';
            }, autoDismissMs);
        }
    }

    function hideIndicator() {
        clearTimeout(autoDismissTimer);
        if (indicatorEl) indicatorEl.style.display = 'none';
    }

    // ── Toolbar modal (dashboard pages) ───────────────────────

    function relTime(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60)   return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        return `${Math.floor(s / 3600)}h ago`;
    }

    function truncate(str, n = 88) {
        const clean = (str || '').replace(/\s+/g, ' ').trim();
        return clean.length > n ? clean.slice(0, n) + '…' : clean;
    }

    function buildModal() {
        if (document.getElementById('sn-toolkit-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'sn-toolkit-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f9f9f9',
            border: '1px solid #cccccc',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '50px 20px 20px 20px',
            zIndex: '999998',
            borderRadius: '10px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'none',
            flexDirection: 'column',
            gap: '12px',
            minWidth: '480px',
            maxWidth: '560px',
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        Object.assign(closeBtn.style, {
            position: 'absolute', top: '5px', right: '5px',
            background: '#dc3545', color: '#ffffff', border: 'none',
            borderRadius: '4px', cursor: 'pointer', padding: '4px 8px',
            fontWeight: 'bold', fontSize: '12px',
            fontFamily: 'Arial, Helvetica, sans-serif',
        });
        closeBtn.onclick = () => { modal.style.display = 'none'; };
        modal.appendChild(closeBtn);

        const titleEl = document.createElement('div');
        Object.assign(titleEl.style, {
            position: 'absolute', top: '12px', left: '12px',
            fontSize: '12px', color: '#333333', fontWeight: 'bold',
            fontFamily: 'Arial, Helvetica, sans-serif',
        });
        titleEl.textContent = '🛠️ ServiceNow Toolkit — Saved Drafts';
        modal.appendChild(titleEl);

        const listContainer = document.createElement('div');
        listContainer.id = 'sn-toolkit-draft-list';
        Object.assign(listContainer.style, {
            display: 'flex', flexDirection: 'column', gap: '8px',
            maxHeight: '400px', overflowY: 'auto',
        });
        modal.appendChild(listContainer);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            fontSize: '11px', color: '#888888',
            borderTop: '1px solid #e0e0e0', paddingTop: '8px',
            fontFamily: 'Arial, Helvetica, sans-serif',
        });
        footer.textContent = '⏱ Drafts live in this session only — cleared when the browser closes.';
        modal.appendChild(footer);

        document.body.appendChild(modal);
    }

    function renderDraftList() {
        const container = document.getElementById('sn-toolkit-draft-list');
        if (!container) return;
        container.innerHTML = '';

        const drafts = getAllDrafts();

        if (drafts.length === 0) {
            const empty = document.createElement('div');
            Object.assign(empty.style, {
                textAlign: 'center', color: '#888888',
                fontSize: '13px', padding: '24px 0',
                fontFamily: 'Arial, Helvetica, sans-serif',
            });
            empty.textContent = 'No drafts saved in this session.';
            container.appendChild(empty);
            return;
        }

        // "Clear all" row
        const clearRow = document.createElement('div');
        Object.assign(clearRow.style, { display: 'flex', justifyContent: 'flex-end' });
        const clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '🗑️ Clear All';
        Object.assign(clearAllBtn.style, {
            padding: '5px 12px', fontSize: '12px',
            border: '1px solid #dc3545', borderRadius: '4px',
            background: '#fff5f5', color: '#dc3545',
            cursor: 'pointer', fontFamily: 'Arial, Helvetica, sans-serif',
        });
        clearAllBtn.addEventListener('mouseover', () => clearAllBtn.style.background = '#ffe0e0');
        clearAllBtn.addEventListener('mouseout',  () => clearAllBtn.style.background = '#fff5f5');
        clearAllBtn.onclick = () => { drafts.forEach(d => deleteDraft(d.ticket)); renderDraftList(); };
        clearRow.appendChild(clearAllBtn);
        container.appendChild(clearRow);

        drafts.forEach(draft => {
            const card = document.createElement('div');
            Object.assign(card.style, {
                background: '#ffffff', border: '1px solid #dee2e6',
                borderRadius: '6px', padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: '5px',
            });

            // Header: ticket number | field badge | time | delete btn
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            });

            const ticketLabel = document.createElement('strong');
            ticketLabel.textContent = draft.ticket;
            Object.assign(ticketLabel.style, {
                fontSize: '13px', color: '#222222',
                fontFamily: 'Arial, Helvetica, sans-serif',
            });

            const metaGroup = document.createElement('div');
            Object.assign(metaGroup.style, { display: 'flex', gap: '6px', alignItems: 'center' });

            const fieldBadge = document.createElement('span');
            fieldBadge.textContent = draft.fieldLabel || 'Work Notes';
            Object.assign(fieldBadge.style, {
                fontSize: '11px', padding: '2px 6px', borderRadius: '3px',
                background: '#e8f0fe', color: '#1a73e8',
                fontFamily: 'Arial, Helvetica, sans-serif',
            });

            const timeSpan = document.createElement('span');
            timeSpan.textContent = relTime(draft.savedAt);
            Object.assign(timeSpan.style, {
                fontSize: '11px', color: '#888888',
                fontFamily: 'Arial, Helvetica, sans-serif',
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.title = 'Delete this draft';
            Object.assign(delBtn.style, {
                border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: '14px',
                lineHeight: '1', padding: '0 2px', opacity: '0.65',
            });
            delBtn.addEventListener('mouseover', () => delBtn.style.opacity = '1');
            delBtn.addEventListener('mouseout',  () => delBtn.style.opacity = '0.65');
            delBtn.onclick = () => { deleteDraft(draft.ticket); renderDraftList(); };

            metaGroup.appendChild(fieldBadge);
            metaGroup.appendChild(timeSpan);
            metaGroup.appendChild(delBtn);
            header.appendChild(ticketLabel);
            header.appendChild(metaGroup);
            card.appendChild(header);

            // Draft content preview
            const preview = document.createElement('div');
            preview.textContent = truncate(draft.content);
            Object.assign(preview.style, {
                fontSize: '12px', color: '#555555', lineHeight: '1.45',
                fontFamily: 'Arial, Helvetica, sans-serif',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            });
            card.appendChild(preview);

            container.appendChild(card);
        });
    }

    function showToolkitModal() {
        buildModal();
        renderDraftList();
        const modal = document.getElementById('sn-toolkit-modal');
        if (modal) modal.style.display = 'flex';
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

    function findWorkNotesField() {
        for (const { sel, label } of FIELD_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) return { el, label };
        }
        return null;
    }

    function startAutosave(ticketNum, fieldEl, fieldLabel) {
        let lastSaved = '';
        let lastValue = fieldEl.value;

        // Offer to restore an existing draft — don't auto-fill to avoid
        // re-populating a note that was already submitted.
        const draft = loadDraft(ticketNum);
        if (draft?.content) {
            showIndicator('📝', `Saved draft found (${fieldLabel})`, [
                {
                    label: 'Restore',
                    accent: true,
                    onClick: () => {
                        fieldEl.value = draft.content;
                        lastSaved = draft.content;
                        lastValue = draft.content;
                        showIndicator('✅', 'Draft restored', [
                            {
                                label: 'Clear Draft',
                                onClick: () => {
                                    deleteDraft(ticketNum);
                                    fieldEl.value = '';
                                    lastSaved = '';
                                    lastValue = '';
                                    hideIndicator();
                                }
                            }
                        ]);
                    }
                },
                {
                    label: 'Delete',
                    onClick: () => { deleteDraft(ticketNum); hideIndicator(); }
                }
            ]);
        }

        setInterval(() => {
            const current = fieldEl.value;

            // Field was cleared after containing content → likely just submitted
            if (lastValue && !current && hasDraft(ticketNum)) {
                showIndicator('✉️', 'Work note submitted? Clear the saved draft?', [
                    {
                        label: 'Clear Draft',
                        accent: true,
                        onClick: () => {
                            deleteDraft(ticketNum);
                            lastSaved = '';
                            hideIndicator();
                        }
                    },
                    {
                        label: 'Keep',
                        onClick: hideIndicator
                    }
                ]);
                lastValue = current;
                return;
            }

            lastValue = current;

            if (current && current !== lastSaved) {
                saveDraft(ticketNum, current, fieldLabel);
                lastSaved = current;
                // Show "saved" briefly then dismiss — don't clutter if user is actively typing
                showIndicator('💾', 'Draft auto-saved', [
                    {
                        label: 'Clear',
                        onClick: () => {
                            deleteDraft(ticketNum);
                            lastSaved = '';
                            hideIndicator();
                        }
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
            const found     = findWorkNotesField();

            if (ticketNum && found) {
                buildIndicator();
                startAutosave(ticketNum, found.el, found.label);
            } else if (retries < 12) {
                retries++;
                setTimeout(tryInit, 1500);
            } else {
                console.log('⚠️ Toolkit: could not detect ticket number or work notes field after 12 retries');
            }
        }

        tryInit();
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
                detail: {
                    id:       TOOL_ID,
                    icon:     toolIcon,
                    tooltip:  TOOL_TOOLTIP,
                    position: TOOL_POSITION,
                }
            }));
            isRegistered = true;
            console.log('✅ ServiceNow Toolkit registered!');
        } else {
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;

        const isTicketPage = /\/(sc_req_item|incident)\.do(\?|$)/.test(location.pathname + location.search);

        if (isTicketPage) {
            console.log('🛠️ Toolkit: ticket page — autosave starting');
            initTicketPage();
        } else {
            console.log('🛠️ Toolkit: dashboard page — registering toolbar');
            buildModal();

            document.addEventListener('toolbarReady', () => attemptRegistration());
            document.addEventListener('toolbarToolClicked', e => {
                if (e.detail.id === TOOL_ID) showToolkitModal();
            });

            setTimeout(attemptRegistration, 1000);
        }

        if (isNewVersion() && !hasSeenChangelog()) {
            saveVersion(SCRIPT_VERSION);
            markChangelogSeen();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log(`✅ ServiceNow Toolkit v${SCRIPT_VERSION} loaded`);

})();
