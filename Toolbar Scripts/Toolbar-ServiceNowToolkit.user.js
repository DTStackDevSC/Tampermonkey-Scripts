// ==UserScript==
// @name         |Toolbar| ServiceNow Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.4
// @description  Work note & comment draft autosave with toolbar management panel
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('🛠️ ServiceNow Toolkit loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.4';
    const CHANGELOG = `Version 1.4:
- Added a ? Help button to the settings panel that opens a visual Feature Guide covering draft autosave, restore prompts, the saved drafts panel, and the SCTASK auto-open feature.

Version 1.3.8:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.3.7:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.3.6:
- Added a toggle in the toolkit settings to enable or disable the automatic
  SCTASK tab feature independently of the autosave feature.

Version 1.3.5:
- When clicking Save and Stay or Update on a ticket whose short description
  contains "Closed", the associated SCTASK now opens automatically in a
  background tab without disrupting your current view.

Version 1.3.4:
- Temporarily simplified the Closed ticket action to verify button interception
  is working correctly before restoring the full SCTASK behaviour.

Version 1.3.3:
- Fixed Save and Update button interception by switching to event delegation
  with capture. Buttons are no longer looked up at page load time, so the
  feature now works even when ServiceNow re-renders or replaces the form
  buttons dynamically.

Version 1.3.2:
- Fixed the SCTASK opener to work even when the Tasks related list has not been
  loaded on the page. It now falls back to a REST API lookup using the ticket
  sys_id when no SCTASK links are found in the DOM.
- Fixed the Save and Update button listeners to also bind inside the gsft_main
  iframe for setups where the ticket form loads inside a navigation frame.

Version 1.3.1:
- Fixed the "Open SCTASK on Closed Save" feature to open the SCTASK linked to
  the current ticket in a background tab, rather than opening the current
  ticket page itself. Uses the same background tab method as the Ticket
  Assignment Tool.

Version 1.3.0:
- Added an option to automatically open the current ticket in a new tab when
  clicking Save and Stay or Update on a ticket whose short description contains
  the word "Closed". This can be toggled on or off in the toolkit settings.

Version 1.2.3:
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

    const GM_KEY_DRAFTS        = 'sn_toolkit_drafts';
    const GM_KEY_AUTOSAVE      = 'sn_toolkit_autosave_enabled';
    const GM_KEY_AUTOOPEN_TAB  = 'sn_toolkit_autoopen_tab_enabled';
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

    function getAutosaveEnabled()      { return GM_getValue(GM_KEY_AUTOSAVE, true); }
    function setAutosaveEnabled(v)     { GM_setValue(GM_KEY_AUTOSAVE, v); }
    function getAutoOpenTabEnabled()   { return GM_getValue(GM_KEY_AUTOOPEN_TAB, true); }
    function setAutoOpenTabEnabled(v)  { GM_setValue(GM_KEY_AUTOOPEN_TAB, v); }

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
     *  DARK MODE ISOLATION
     * ==========================================================*/

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        #sn-toolkit-modal, #snToolkitHelpModal {
            color: #333333 !important;
        }
        #sn-toolkit-modal input, #sn-toolkit-modal select, #sn-toolkit-modal textarea,
        #snToolkitHelpModal input, #snToolkitHelpModal select, #snToolkitHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(darkModeStyle);

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

    /* ==========================================================
     *  UI COMPONENTS — feature guide modal
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('snToolkitHelpModal')) return;

        /* ---- Reusable content helpers. Define these once at the top of showHelpModal.
         *      Each section's buildContent calls them. lead/bullets/caption append to
         *      the section body; span/hrow/chip return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section. One line only.
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        // bullets: a compact list of short usage notes, each prefixed with a purple dot.
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
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

        // caption: a small italic note placed directly under a visual to explain it.
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        // span: an inline text node with optional extra styles. Returned, not appended.
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: a horizontal, wrapping flex row that holds visual mocks side by side.
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: a small colored rounded label. Use for categories and button previews.
        function chip(text, bg, opts) {
            opts = opts || {};
            const c = document.createElement('span');
            c.textContent = text;
            Object.assign(c.style, {
                background: bg, color: opts.color || '#fff',
                borderRadius: '4px', padding: '3px 8px',
                fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block'
            });
            return c;
        }

        // toolSquare: one rounded icon tile, like a real toolbar button.
        function toolSquare(content, opts) {
            opts = opts || {};
            const sq = document.createElement('div');
            Object.assign(sq.style, {
                width: '30px', height: '30px', borderRadius: '8px',
                background: opts.bg || '#f3f4f6', border: opts.border || '2px solid transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', flexShrink: '0', position: 'relative'
            });
            sq.textContent = content;
            if (opts.dot) {
                const dot = document.createElement('span');
                Object.assign(dot.style, {
                    position: 'absolute', top: '-3px', right: '-3px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#ff8c00', border: '1px solid #fff'
                });
                sq.appendChild(dot);
            }
            return sq;
        }

        // menuSep: the thin vertical divider used between groups in a menu mock.
        function menuSep() {
            const s = document.createElement('div');
            Object.assign(s.style, { width: '1px', height: '22px', background: '#e5e7eb', flexShrink: '0' });
            return s;
        }

        // toggle: a checkbox preview row with label and optional description.
        function toggle(label, on, desc) {
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            const box = document.createElement('span');
            Object.assign(box.style, {
                width: '15px', height: '15px', borderRadius: '3px', flexShrink: '0',
                border: on ? 'none' : '1px solid #b0b0b0',
                background: on ? '#667eea' : '#fff', color: '#fff',
                fontSize: '11px', lineHeight: '15px', textAlign: 'center', display: 'inline-block'
            });
            box.textContent = on ? '✓' : '';
            wrap.appendChild(hrow([box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' })], { margin: '0' }));
            if (desc) wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px' }));
            return wrap;
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Click the 🛠️ toolbar icon on any ServiceNow page to open the Settings panel.');
                    const menuMock = document.createElement('div');
                    Object.assign(menuMock.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                        padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        marginBottom: '10px'
                    });
                    menuMock.appendChild(toolSquare('🛠️', { bg: '#e8f0fe', border: '2px solid #667eea' }));
                    menuMock.appendChild(menuSep());
                    menuMock.appendChild(toolSquare('📋'));
                    menuMock.appendChild(toolSquare('🔗'));
                    body.appendChild(hrow([menuMock]));
                    caption(body, 'The 🛠️ tile opens the ServiceNow Toolkit settings panel.');
                    bullets(body, [
                        'On RITM and INC ticket pages, autosave activates automatically when Work Notes or Comments fields are detected.',
                        'A floating indicator in the bottom-right corner shows save status and any restore prompts.',
                        'Settings are saved across browser sessions via Tampermonkey storage.',
                    ]);
                }
            },
            {
                icon: '📝', title: 'Draft Autosave',
                buildContent(body) {
                    lead(body, 'Work Notes and Comments are saved automatically every 3 seconds as you type on ticket pages.');
                    const indicator = document.createElement('div');
                    Object.assign(indicator.style, {
                        display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                        padding: '7px 12px', background: '#ffffff',
                        border: '1px solid #c5d3f0', borderLeft: '4px solid #4a90d9',
                        borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
                        fontSize: '12px', color: '#2c3e6a', fontFamily: 'Arial, Helvetica, sans-serif',
                        marginBottom: '10px', maxWidth: '360px'
                    });
                    const msgSpan = document.createElement('span');
                    msgSpan.textContent = '💾 Work Notes draft saved';
                    Object.assign(msgSpan.style, { fontSize: '12px', color: '#2c3e6a', fontFamily: 'Arial, sans-serif' });
                    const clearBtn = document.createElement('span');
                    clearBtn.textContent = 'Clear';
                    Object.assign(clearBtn.style, {
                        padding: '3px 9px', fontSize: '11px',
                        border: '1px solid #c5d3f0', borderRadius: '3px',
                        background: '#f7f9ff', color: '#3a3a6a',
                        fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap'
                    });
                    indicator.appendChild(msgSpan);
                    indicator.appendChild(clearBtn);
                    body.appendChild(indicator);
                    caption(body, 'The indicator appears at the bottom-right of the page after each auto-save.');
                    bullets(body, [
                        'Drafts are stored in Tampermonkey storage and persist across sessions and page reloads.',
                        'Both Work Notes and Comments can be saved independently for the same ticket.',
                        'Click "Clear" on the indicator to delete the draft immediately without navigating away.',
                        'Drafts older than 7 days are automatically removed on the next page load.',
                    ]);
                }
            },
            {
                icon: '↩', title: 'Draft Restore Prompt',
                buildContent(body) {
                    lead(body, 'When you open a ticket that has a saved draft, a restore bar appears at the bottom of the page.');
                    const restoreBar = document.createElement('div');
                    Object.assign(restoreBar.style, {
                        display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                        padding: '7px 12px', background: '#ffffff',
                        border: '1px solid #c5d3f0', borderLeft: '4px solid #4a90d9',
                        borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
                        fontSize: '12px', color: '#2c3e6a', fontFamily: 'Arial, Helvetica, sans-serif',
                        marginBottom: '10px', maxWidth: '420px'
                    });
                    const restoreMsg = document.createElement('span');
                    restoreMsg.textContent = '📝 Saved draft found (Work Notes)';
                    Object.assign(restoreMsg.style, { fontSize: '12px', color: '#2c3e6a', fontFamily: 'Arial, sans-serif' });
                    const restoreBtn = document.createElement('span');
                    restoreBtn.textContent = 'Restore';
                    Object.assign(restoreBtn.style, {
                        padding: '3px 9px', fontSize: '11px',
                        border: '1px solid #4a90d9', borderRadius: '3px',
                        background: '#e8f0fe', color: '#1a5cb8',
                        fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap', fontWeight: 'bold'
                    });
                    const deleteBtn = document.createElement('span');
                    deleteBtn.textContent = 'Delete';
                    Object.assign(deleteBtn.style, {
                        padding: '3px 9px', fontSize: '11px',
                        border: '1px solid #c5d3f0', borderRadius: '3px',
                        background: '#f7f9ff', color: '#3a3a6a',
                        fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap'
                    });
                    restoreBar.appendChild(restoreMsg);
                    restoreBar.appendChild(restoreBtn);
                    restoreBar.appendChild(deleteBtn);
                    body.appendChild(restoreBar);
                    caption(body, 'Click Restore to paste the draft back into the field, or Delete to discard it.');
                    bullets(body, [
                        'Click "Restore" to paste the saved draft back into the Work Notes or Comments field.',
                        'Click "Delete" to permanently discard the draft.',
                        'If both Work Notes and Comments have drafts, each gets its own "↩ Label" restore button.',
                    ]);
                }
            },
            {
                icon: '📋', title: 'Saved Drafts Panel',
                buildContent(body) {
                    lead(body, 'Click "View Saved Drafts →" in Settings to browse all drafts stored across sessions.');
                    const card = document.createElement('div');
                    Object.assign(card.style, {
                        background: '#fff', border: '1px solid #dee2e6',
                        borderRadius: '8px', padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        marginBottom: '10px', maxWidth: '380px'
                    });
                    const cardHeader = document.createElement('div');
                    Object.assign(cardHeader.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
                    const ticketLabel = document.createElement('strong');
                    ticketLabel.textContent = 'RITM1234567';
                    Object.assign(ticketLabel.style, { fontSize: '13px', color: '#222', fontFamily: 'Arial, sans-serif' });
                    const meta = document.createElement('div');
                    Object.assign(meta.style, { display: 'flex', gap: '6px', alignItems: 'center' });
                    const fieldBadge = document.createElement('span');
                    fieldBadge.textContent = 'Work Notes';
                    Object.assign(fieldBadge.style, {
                        fontSize: '11px', padding: '2px 6px', borderRadius: '3px',
                        background: '#e8f0fe', color: '#1a73e8', fontFamily: 'Arial, sans-serif'
                    });
                    const timeSpan = document.createElement('span');
                    timeSpan.textContent = '5m ago';
                    Object.assign(timeSpan.style, { fontSize: '11px', color: '#888', fontFamily: 'Arial, sans-serif' });
                    const delSpan = document.createElement('span');
                    delSpan.textContent = '🗑️';
                    Object.assign(delSpan.style, { fontSize: '14px', opacity: '0.65', cursor: 'default' });
                    meta.appendChild(fieldBadge);
                    meta.appendChild(timeSpan);
                    meta.appendChild(delSpan);
                    cardHeader.appendChild(ticketLabel);
                    cardHeader.appendChild(meta);
                    const preview = document.createElement('div');
                    preview.textContent = 'Hi there, I have reviewed the request and confirmed the…';
                    Object.assign(preview.style, {
                        fontSize: '12px', color: '#555', lineHeight: '1.45',
                        fontFamily: 'Arial, sans-serif',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    });
                    card.appendChild(cardHeader);
                    card.appendChild(preview);
                    body.appendChild(card);
                    bullets(body, [
                        'Each card shows the ticket number, field type (Work Notes or Comments), time saved, and a content preview.',
                        'Click 🗑️ on a card to delete that specific draft.',
                        '"Clear All" at the top of the list removes every draft at once.',
                        'Click "← Back" in the header to return to the main Settings view.',
                    ]);
                }
            },
            {
                icon: '🔗', title: 'SCTASK Auto-Open',
                buildContent(body) {
                    lead(body, 'Saving a ticket whose short description contains "Closed" automatically opens its linked SCTASK in a background tab.');
                    const wrap = document.createElement('div');
                    Object.assign(wrap.style, { marginBottom: '12px', borderRadius: '6px', border: '1px solid #d0d0f0', overflow: 'hidden' });
                    const rows = [
                        { label: 'Trigger', bg: '#f8f8ff', labelColor: '#888',    text: 'Short description contains "Closed" and you click Save and Stay or Update' },
                        { label: 'Result',  bg: '#f2fff7', labelColor: '#2a7d4f', text: 'The linked SCTASK opens automatically in a new background tab' }
                    ];
                    for (const r of rows) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', alignItems: 'baseline', gap: '10px',
                            padding: '7px 12px', background: r.bg,
                            borderBottom: r.label === 'Trigger' ? '1px solid #e8e8f0' : 'none'
                        });
                        const labelEl = document.createElement('span');
                        labelEl.textContent = r.label;
                        Object.assign(labelEl.style, {
                            fontSize: '10px', fontWeight: 'bold', color: r.labelColor,
                            textTransform: 'uppercase', whiteSpace: 'nowrap',
                            width: '52px', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                        });
                        const textEl = document.createElement('span');
                        textEl.textContent = r.text;
                        Object.assign(textEl.style, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#333', lineHeight: '1.5' });
                        row.appendChild(labelEl);
                        row.appendChild(textEl);
                        wrap.appendChild(row);
                    }
                    body.appendChild(wrap);
                    bullets(body, [
                        'Only triggers on "Save and Stay" and "Update" buttons, not a plain Save.',
                        'Looks for SCTASK links in the related list first, then falls back to a REST API lookup if the list has not loaded.',
                        'Can be toggled on or off in Settings independently of the autosave feature.',
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Settings',
                buildContent(body) {
                    lead(body, 'Open the Settings panel from the toolbar icon to toggle features and manage drafts.');
                    const headerButtons = [
                        { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' },
                        { bg: '#e53935',     color: '#fff',    border: 'none',                label: '✕',     desc: 'Closes the Settings panel.' },
                    ];
                    for (const item of headerButtons) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badge = document.createElement('span');
                        badge.textContent = item.label;
                        Object.assign(badge.style, {
                            background: item.bg, color: item.color, border: item.border,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = item.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }
                    const togglesLabel = document.createElement('div');
                    togglesLabel.textContent = 'Feature toggles:';
                    Object.assign(togglesLabel.style, { fontSize: '11px', color: '#888', marginBottom: '8px', fontFamily: 'Arial, sans-serif' });
                    body.appendChild(togglesLabel);
                    body.appendChild(toggle('📝 Work Note Draft Autosave', true, 'Auto-saves Work Notes and Comments as you type. Drafts persist until deleted or expired after 7 days.'));
                    body.appendChild(toggle('🔗 Open SCTASK on Closed Save', true, 'Opens the linked SCTASK in a background tab when saving a ticket whose short description contains "Closed".'));
                    const viewRow = document.createElement('div');
                    Object.assign(viewRow.style, {
                        display: 'flex', gap: '10px', alignItems: 'flex-start',
                        marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0'
                    });
                    const viewBadge = document.createElement('span');
                    viewBadge.textContent = 'View Saved Drafts →';
                    Object.assign(viewBadge.style, {
                        background: '#e8f0fe', color: '#1a73e8', border: '1px solid #1a73e8',
                        borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start'
                    });
                    const viewDesc = document.createElement('span');
                    viewDesc.textContent = 'Switches to the Saved Drafts panel, showing all stored drafts with previews and delete options.';
                    Object.assign(viewDesc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    viewRow.appendChild(viewBadge);
                    viewRow.appendChild(viewDesc);
                    body.appendChild(viewRow);
                }
            },
        ];

        const overlay = document.createElement('div');
        overlay.id = 'snToolkitHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '999999'
        });

        const modal = document.createElement('div');
        modal.id = 'snToolkitHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1000000', background: '#fff', border: '2px solid #333', padding: '20px',
            borderRadius: '10px', width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333333', fontFamily: 'Arial, sans-serif'
        });

        // Header
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
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
        titleSub.textContent = `ServiceNow Toolkit • v${SCRIPT_VERSION}`;
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
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };
        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // Section cards — all start expanded
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, { border: '1px solid #e8e8f0', borderRadius: '6px', marginBottom: '8px', overflow: 'hidden' });
            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
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
            Object.assign(chevron.style, { fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block' });
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

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white', border: 'none',
            borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px', fontFamily: 'Arial, sans-serif'
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

    /* ==========================================================
     *  UI COMPONENTS — settings / drafts modal
     * ==========================================================*/

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
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
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

        // ── Feature: Auto-open SCTASK on Closed ──
        const autoOpenRow = document.createElement('div');
        Object.assign(autoOpenRow.style, {
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            background: '#fff', border: '1px solid #e0e0e0',
            borderRadius: '8px', padding: '12px 14px', cursor: 'pointer',
            transition: 'border-color 0.15s', marginTop: '10px',
        });

        const autoOpenToggleWrapper = document.createElement('div');
        Object.assign(autoOpenToggleWrapper.style, { flexShrink: '0', marginTop: '2px' });

        const autoOpenToggle = document.createElement('input');
        autoOpenToggle.type    = 'checkbox';
        autoOpenToggle.id      = MODAL_ID + '-autoopen-toggle';
        autoOpenToggle.checked = getAutoOpenTabEnabled();
        Object.assign(autoOpenToggle.style, { width: '36px', height: '20px', cursor: 'pointer', accentColor: '#1a73e8' });
        autoOpenToggle.addEventListener('change', () => {
            setAutoOpenTabEnabled(autoOpenToggle.checked);
            updateRowStyle(autoOpenRow, autoOpenToggle.checked);
        });
        autoOpenToggleWrapper.appendChild(autoOpenToggle);

        const autoOpenTextBlock = document.createElement('div');
        Object.assign(autoOpenTextBlock.style, { flex: '1' });

        const autoOpenLabel = document.createElement('div');
        autoOpenLabel.textContent = '🔗 Open SCTASK on Closed Save';
        Object.assign(autoOpenLabel.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#222', marginBottom: '3px',
        });

        const autoOpenDesc = document.createElement('div');
        autoOpenDesc.textContent = 'When you click Save and Stay or Update on a ticket whose short description contains "Closed", the associated SCTASK opens automatically in a background tab.';
        Object.assign(autoOpenDesc.style, { fontSize: '12px', color: '#666', lineHeight: '1.4' });

        autoOpenTextBlock.appendChild(autoOpenLabel);
        autoOpenTextBlock.appendChild(autoOpenDesc);
        autoOpenRow.appendChild(autoOpenToggleWrapper);
        autoOpenRow.appendChild(autoOpenTextBlock);
        autoOpenRow.addEventListener('click', e => { if (e.target !== autoOpenToggle) autoOpenToggle.click(); });
        updateRowStyle(autoOpenRow, autoOpenToggle.checked);
        view.appendChild(autoOpenRow);

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

    function getTicketContext() {
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        if (macro && macro.shadowRoot) {
            const iframe = macro.shadowRoot.querySelector('#gsft_main');
            if (iframe && iframe.contentDocument) {
                return {
                    win:   iframe.contentWindow,
                    doc:   iframe.contentDocument,
                    gForm: (iframe.contentWindow && iframe.contentWindow.g_form) || null,
                };
            }
        }
        const directIframe = document.getElementById('gsft_main');
        if (directIframe && directIframe.contentDocument) {
            return {
                win:   directIframe.contentWindow,
                doc:   directIframe.contentDocument,
                gForm: (directIframe.contentWindow && directIframe.contentWindow.g_form) || null,
            };
        }
        return { win: window, doc: document, gForm: window.g_form || null };
    }

    function attachSubmitListeners(ticketNum, fields) {
        function onSubmitClick() {
            storeSubmitIntent(ticketNum, fields.map(f => f.label));

            const ctx = getTicketContext();
            const doc = ctx.doc;

            let shortDesc = '';
            if (ctx.gForm) {
                try { shortDesc = ctx.gForm.getDisplayValue('short_description') || ''; } catch(e) {}
            }
            if (!shortDesc) {
                const el = doc.getElementById('sc_req_item.short_description') ||
                           doc.getElementById('incident.short_description');
                shortDesc = el ? (el.value || '') : '';
            }

            if (!getAutoOpenTabEnabled()) return;
            if (!shortDesc.includes('Closed')) return;

            const sctaskLinks = Array.from(doc.querySelectorAll('a[href*="sc_task.do"]'))
                .filter(link => link.textContent.trim().startsWith('SCTASK'));
            if (sctaskLinks.length > 0) {
                GM_openInTab(sctaskLinks[0].href, { active: false, insert: true });
            }
        }

        const SUBMIT_SELECTOR = '#sysverb_update, #sysverb_update_and_stay, #sysverb_save';

        // Event delegation with capture: fires before ServiceNow can stop propagation
        // and does not require buttons to exist in the DOM at setup time.
        function delegateClicks(doc) {
            doc.addEventListener('click', function(e) {
                if (e.target && e.target.closest && e.target.closest(SUBMIT_SELECTOR)) {
                    onSubmitClick();
                }
            }, true);
        }

        delegateClicks(document);

        // Also cover the gsft_main iframe (Polaris and classic nav-frame mode)
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        const iframeDoc = (macro && macro.shadowRoot && macro.shadowRoot.querySelector('#gsft_main')?.contentDocument) ||
                          document.getElementById('gsft_main')?.contentDocument;
        if (iframeDoc && iframeDoc !== document) delegateClicks(iframeDoc);
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
