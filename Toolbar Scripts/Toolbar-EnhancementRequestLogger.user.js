// ==UserScript==
// @name         |Toolbar| Enhancement Request Logger
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-EnhancementRequestLogger.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.2.0
// @description  Opens a pre-filled Office Forms submission with RITM auto-populated from the current ServiceNow ticket - Integrated with Toolbar
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('📋 Enhancement Request Logger loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.0';
    const CHANGELOG = `Version 1.2.0:
- Added a "? Help" button next to the version number in the form. It opens a visual Feature Guide that explains every field of the request form and how the pre-filled form opens.
- The request form and its windows now stay readable when ServiceNow uses a dark theme.

Version 1.1.6:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.1.5:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.1.4:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.1.3:
- Added dual mode support for Polaris (Dashboard) and Classic (New Tab) ticket access.
  RITM field now resolves correctly when tickets are opened from the ServiceNow dashboard
  via shadow DOM iframe traversal, not just when opened in a new tab directly.

Version 1.1.2:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.1.1:
- Fixed changelog modal rendering beneath main modal
- Changed toolbar icon to lightbulb`;

    const GM_KEY_VERSION        = 'erlVersion';
    const GM_KEY_CHANGELOG_SEEN = 'erlChangelogSeen';

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

    const FORM_BASE_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=8UXaNizdH02vE1q-RrmZIfcr6iS62VJHoplKi5KJ73dUNk9ZSzlQQTRJTkFOVk9ZU0xLS0lEVk9MUi4u';

    const PARAM_SERVICE     = 'r496ad1f88f214369bc47b3240310be93';
    const PARAM_CASE_NUMBER = 'r0623f39004cf4c80a1f8b8b7754d45d3';
    const PARAM_RITM        = 're9787aeeab4c449d95cd77040e7c5cc4';
    const PARAM_VENDOR_CASE = 'r89798ae279624de7ad97cb06e2ad8eec';
    const PARAM_REGION      = 'r6304b1498aaa438d9bdebd7d0fc32a14';
    const PARAM_DETAILS     = 'rdcd805e8af324630852bd6daceba1948';

    const DEFAULT_SERVICE = 'Netskope';
    const DEFAULT_REGION  = 'EMEA';

    /* ==========================================================
     *  TOOLBAR REGISTRATION CONFIG
     * ==========================================================*/

    const TOOL_ID       = 'enhancementRequestLogger';
    const TOOL_TOOLTIP  = 'Enhancement Request Logger';
    const TOOL_POSITION = 11;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.3 3-5.7 0-3.9-3.1-7-7-7z"/>
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

    function getTicketContext() {
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        if (macro && macro.shadowRoot) {
            const iframe = macro.shadowRoot.querySelector('#gsft_main');
            if (iframe && iframe.contentWindow && iframe.contentWindow.g_form) {
                return { win: iframe.contentWindow, doc: iframe.contentDocument, gForm: iframe.contentWindow.g_form, mode: 'polaris' };
            }
        }
        if (window.g_form) {
            return { win: window, doc: document, gForm: window.g_form, mode: 'classic' };
        }
        return null;
    }

    function getTicketNumber() {
        const ctx = getTicketContext();
        if (ctx && ctx.gForm) {
            const num = ctx.gForm.getValue('number');
            if (num) return num.trim();
        }
        const doc = (ctx && ctx.doc) || document;
        const el =
            doc.querySelector('input[id*="sc_req_item.number"]') ||
            doc.querySelector('input[id*="incident.number"]')     ||
            doc.querySelector('input[id$=".number"][readonly]');
        return el?.value?.trim() || null;
    }

    function buildFormUrl(service, caseNumber, ritm, vendorCase, region, details) {
        // Service and Region are Choice fields in Office Forms — must be wrapped in quotes.
        // Use encodeURIComponent (not URLSearchParams) to produce %20 for spaces, which
        // Office Forms pre-fill requires; URLSearchParams would produce "+" instead.
        const params = [
            [PARAM_SERVICE,     `"${service}"`],
            [PARAM_CASE_NUMBER, caseNumber],
            [PARAM_RITM,        ritm],
            [PARAM_VENDOR_CASE, vendorCase],
            [PARAM_REGION,      `"${region}"`],
            [PARAM_DETAILS,     details],
        ];
        const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        return `${FORM_BASE_URL}&${qs}`;
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
        overlay.id = 'erl-cl-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000', display: 'block'
        });

        const clModal = document.createElement('div');
        clModal.id = 'erl-cl-modal';
        Object.assign(clModal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1000001', background: '#ffffff', border: '2px solid #333', padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial,sans-serif',
            borderRadius: '10px', maxWidth: '600px', width: '90%', maxHeight: '80vh',
            overflowY: 'auto', color: '#333'
        });

        const clTitle = document.createElement('h2');
        clTitle.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(clTitle.style, {
            marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea',
            paddingBottom: '10px', fontSize: '1.5em', fontWeight: 'bold'
        });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa', color: '#333', padding: '10px', borderRadius: '5px',
            marginBottom: '15px', borderLeft: '4px solid #667eea', fontSize: '14px'
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            marginTop: '15px', padding: '10px 20px', backgroundColor: '#667eea', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px'
        });
        closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#5568d3'; });
        closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = '#667eea'; });
        closeButton.onclick = () => {
            overlay.remove();
            clModal.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            const n = document.getElementById('erl-changelog-notif');
            if (n) n.remove();
        };

        clModal.appendChild(clTitle);
        clModal.appendChild(versionInfo);

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
        clModal.appendChild(cardsWrap);

        clModal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(clModal);
        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  FEATURE GUIDE  (? Help modal)
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('erlHelpModal')) return;

        /* ---- Reusable content helpers. lead/bullets/caption append to the section body;
         *      span/hrow/chip return an element you place yourself. ---- */

        // lead: the single orienting sentence at the very top of a section.
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
                borderRadius: opts.radius || '4px', padding: opts.padding || '3px 8px',
                fontSize: opts.fontSize || '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
                fontFamily: 'Arial, sans-serif', border: opts.border || 'none',
                display: 'inline-block'
            });
            return c;
        }

        // badgeRow: a button preview on the left with a one line description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = chip(item.label, item.bg, { color: item.color, border: item.border, padding: '4px 8px' });
            badge.style.flexShrink = '0';
            const descEl = span(item.desc, { fontSize: '12px', color: '#555', lineHeight: '1.5' });
            row.appendChild(badge);
            row.appendChild(descEl);
            body.appendChild(row);
        }

        // kvGrid: a two column key:value grid for field references and named settings.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: '10px' });
            for (const [key, val] of pairs) {
                grid.appendChild(span(key, { fontFamily: 'monospace', fontSize: '11px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap' }));
                grid.appendChild(span(val, { fontSize: '12px', color: '#555', padding: '2px 0', lineHeight: '1.4' }));
            }
            body.appendChild(grid);
        }

        // mockField: a labelled input or dropdown as it appears in the real form.
        function mockField(label, value, opts) {
            opts = opts || {};
            const wrap = document.createElement('div');
            wrap.style.margin = '0 0 8px 0';
            wrap.appendChild(span(label, { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '3px' }));
            const box = document.createElement('div');
            Object.assign(box.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px',
                background: opts.readOnly ? '#efefef' : '#fff', maxWidth: opts.width || '320px',
                minHeight: opts.tall ? '34px' : 'auto', boxSizing: 'border-box'
            });
            box.appendChild(span(value, { fontSize: '12px', color: opts.placeholder ? '#aaa' : '#333', fontStyle: opts.placeholder ? 'italic' : 'normal' }));
            if (opts.caret) box.appendChild(span('▾', { fontSize: '11px', color: '#999' }));
            wrap.appendChild(box);
            return wrap;
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

        // menuMock: a white rounded card that holds tool tiles, like the open toolbar menu.
        function menuMock(items) {
            const menu = document.createElement('div');
            Object.assign(menu.style, {
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
            });
            items.forEach(i => menu.appendChild(i));
            return menu;
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Open a RITM in ServiceNow and click the lightbulb in the floating toolbar.');
                    const pin = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    body.appendChild(hrow([ menuMock([ toolSquare('💡', pin), menuSep(), toolSquare('👥'), toolSquare('📝') ]) ], { margin: '0 0 10px 0' }));
                    caption(body, 'The 💡 icon is the Enhancement Request Logger button in the toolbar.');
                    bullets(body, [
                        'The form opens with the RITM number of the ticket already filled in.',
                        'Fill in the other fields and click Open Pre-filled Form.',
                        'Works when the ticket is opened in a new tab and from the ServiceNow dashboard.'
                    ]);
                }
            },
            {
                icon: '📋', title: 'The Request Form',
                buildContent(body) {
                    lead(body, 'Each field is copied into the matching question of the Office Forms enhancement request.');
                    body.appendChild(mockField('Service', 'Netskope', { caret: true }));
                    body.appendChild(mockField('Case Number', 'e.g. IDEA-12345', { placeholder: true }));
                    body.appendChild(mockField('RITM', 'RITM0012345', { readOnly: true }));
                    body.appendChild(mockField('Vendor Case', 'e.g. 006', { placeholder: true }));
                    body.appendChild(mockField('Region', 'EMEA', { caret: true }));
                    body.appendChild(mockField('Details', 'Brief description of the Enhancement request', { placeholder: true, tall: true }));
                    kvGrid(body, [
                        ['Service',     'Always Netskope.'],
                        ['Case Number', 'The IDEA or enhancement case number, if you have one.'],
                        ['RITM',        'Read from the open ticket. You cannot edit it.'],
                        ['Vendor Case', 'The vendor support case number, if there is one.'],
                        ['Region',      'EMEA, APAC or AME. EMEA is selected by default.'],
                        ['Details',     'A short description of what is being requested.']
                    ]);
                }
            },
            {
                icon: '⚡', title: 'Opening the Form',
                buildContent(body) {
                    lead(body, 'Click the button at the bottom to open the Office Forms submission in a new tab.');
                    body.appendChild(hrow([ chip('📋 Open Pre-filled Form', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', { padding: '8px 16px', fontSize: '12px', radius: '6px' }) ]));
                    body.appendChild(hrow([ span('⚠️ RITM not found, please open a ticket first.', { fontSize: '12px', color: '#c0392b' }) ], { margin: '8px 0 0 0' }));
                    caption(body, 'This message shows, and the button stays greyed out, when no RITM is found on the page.');
                    bullets(body, [
                        'Review the answers in Office Forms and submit them there. Nothing is sent from ServiceNow.',
                        'The form window closes once the new tab is open. Your typed values are kept until the page reloads.'
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent(body) {
                    lead(body, 'The title bar of the form holds these controls. There are no settings to configure.');
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: 'none', label: "🔵 What's New", desc: 'Appears with a pulsing dot after an update. Opens the changelog.' });
                    badgeRow(body, { bg: 'red', color: '#fff', border: 'none', label: 'X', desc: 'Closes the form without opening anything.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'erlHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000002'
        });

        const modal = document.createElement('div');
        modal.id = 'erlHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000003', background: '#fff', border: '2px solid #333', padding: '20px',
            borderRadius: '10px', width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333', boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', textAlign: 'left'
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
        titleSub.textContent = `Enhancement Request Logger • v${SCRIPT_VERSION}`;
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

        // Section cards, all start expanded
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

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #erl-changelog-notif {
                display: inline-flex; align-items: center; gap: 5px;
                cursor: pointer; padding: 2px 6px;
                border-radius: 4px; transition: background-color 0.2s ease;
            }
            #erl-changelog-notif:hover { background-color: #f0f0f0; }
            #erl-changelog-notif .erl-notif-dot {
                display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                animation: erlColorPulse 1s ease-in-out infinite;
            }
            @keyframes erlColorPulse {
                0%, 100% { background-color: #667eea; }
                50%       { background-color: #5568d3; }
            }
            #erl-changelog-notif .erl-notif-text {
                font-size: 11px; color: #667eea; text-decoration: underline;
                font-family: Arial, sans-serif; font-weight: normal;
            }

            /* DARK MODE ISOLATION */
            #erl-modal, #erl-cl-modal, #erlHelpModal { color: #333333 !important; }
            #erl-cl-modal, #erlHelpModal { background-color: #ffffff !important; }
            #erl-modal { background-color: #f9f9f9 !important; }
            #erl-modal input, #erl-modal select, #erl-modal textarea,
            #erlHelpModal input, #erlHelpModal select, #erlHelpModal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
            #erl-modal input[readonly] { background-color: #efefef !important; color: #555555 !important; }
        `;
        document.head.appendChild(style);
    }

    /* ==========================================================
     *  MODAL
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('erl-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'erl-modal';
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

        // ── Title bar ─────────────────────────────────────────
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            position:   'absolute',
            top:        '10px',
            left:       '12px',
            display:    'flex',
            alignItems: 'center',
            gap:        '8px'
        });

        const titleText = document.createElement('span');
        Object.assign(titleText.style, { fontSize: '12px', color: '#333', fontWeight: 'bold' });
        titleText.textContent = '📋 Enhancement Request Logger';
        titleBar.appendChild(titleText);

        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, { fontSize: '11px', color: '#6b7280' });
        titleBar.appendChild(versionBadge);

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        titleBar.appendChild(helpBtn);

        if (isNewVersion() && !hasSeenChangelog()) {
            const clNotif = document.createElement('span');
            clNotif.id = 'erl-changelog-notif';
            const dot = document.createElement('span');
            dot.className = 'erl-notif-dot';
            const txt = document.createElement('span');
            txt.className = 'erl-notif-text';
            txt.textContent = "What's New";
            clNotif.appendChild(dot);
            clNotif.appendChild(txt);
            clNotif.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });
            titleBar.appendChild(clNotif);
        }

        modal.appendChild(titleBar);

        // ── Field builders ────────────────────────────────────
        function makeLabel(text) {
            const lbl = document.createElement('label');
            lbl.textContent = text;
            Object.assign(lbl.style, {
                display:      'block',
                fontWeight:   'bold',
                fontSize:     '12px',
                color:        '#555',
                marginBottom: '4px'
            });
            return lbl;
        }

        function makeReadOnlyRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const input = document.createElement('input');
            input.id          = valueId;
            input.type        = 'text';
            input.readOnly    = true;
            input.placeholder = placeholder;
            Object.assign(input.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#555',
                background:   '#efefef',
                boxSizing:    'border-box'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(input);
            return wrap;
        }

        function makeEditableRow(labelText, valueId, placeholder, defaultValue) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const input = document.createElement('input');
            input.id          = valueId;
            input.type        = 'text';
            input.placeholder = placeholder;
            if (defaultValue) input.value = defaultValue;
            Object.assign(input.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(input);
            return wrap;
        }

        function makeSelectRow(labelText, valueId, options, defaultValue) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const sel = document.createElement('select');
            sel.id = valueId;
            Object.assign(sel.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box',
                cursor:       'pointer'
            });
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === defaultValue) o.selected = true;
                sel.appendChild(o);
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(sel);
            return wrap;
        }

        function makeTextareaRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';
            const ta = document.createElement('textarea');
            ta.id          = valueId;
            ta.placeholder = placeholder;
            ta.rows        = 3;
            Object.assign(ta.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box',
                resize:       'vertical',
                fontFamily:   'Arial, sans-serif'
            });
            wrap.appendChild(makeLabel(labelText));
            wrap.appendChild(ta);
            return wrap;
        }

        modal.appendChild(makeSelectRow('Service',     'erl-service',     [DEFAULT_SERVICE], DEFAULT_SERVICE));
        modal.appendChild(makeEditableRow('Case Number', 'erl-case-number', 'e.g. IDEA-12345', ''));
        modal.appendChild(makeReadOnlyRow('RITM',        'erl-ritm',        'Not found — open a RITM ticket first'));
        modal.appendChild(makeEditableRow('Vendor Case', 'erl-vendor-case', 'e.g. 006', ''));
        modal.appendChild(makeSelectRow('Region',      'erl-region',      ['EMEA', 'APAC', 'AME'], DEFAULT_REGION));
        modal.appendChild(makeTextareaRow('Details',     'erl-details',     'Brief description of the Enhancement request'));

        // ── Status message ────────────────────────────────────
        const status = document.createElement('div');
        status.id = 'erl-status';
        Object.assign(status.style, {
            fontSize:  '12px',
            color:     '#c0392b',
            textAlign: 'center',
            minHeight: '16px'
        });
        modal.appendChild(status);

        // ── Open Form button ──────────────────────────────────
        const btnOpen = document.createElement('button');
        btnOpen.id          = 'erl-open-btn';
        btnOpen.textContent = '📋 Open Pre-filled Form';
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

        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  SHOW MODAL — populates fields when opened
     * ==========================================================*/

    function showModal() {
        const modal = document.getElementById('erl-modal');
        if (!modal) {
            console.error('❌ Enhancement Request Logger modal not found!');
            return;
        }

        const ritm = getTicketNumber();

        document.getElementById('erl-service').value = DEFAULT_SERVICE;
        document.getElementById('erl-ritm').value    = ritm ?? '';

        const status = document.getElementById('erl-status');
        const btn    = document.getElementById('erl-open-btn');

        if (!ritm) {
            status.textContent = '⚠️ RITM not found — please open a ticket first.';
            btn.disabled      = true;
            btn.style.opacity = '0.5';
            btn.style.cursor  = 'not-allowed';
        } else {
            status.textContent = '';
            btn.disabled      = false;
            btn.style.opacity = '1';
            btn.style.cursor  = 'pointer';
        }

        modal.style.display = 'flex';
    }

    /* ==========================================================
     *  OPEN FORM
     * ==========================================================*/

    function openForm() {
        const ritm       = document.getElementById('erl-ritm').value.trim();
        const caseNumber = document.getElementById('erl-case-number').value.trim();
        const vendorCase = document.getElementById('erl-vendor-case').value.trim();
        const region     = document.getElementById('erl-region').value.trim() || DEFAULT_REGION;
        const details    = document.getElementById('erl-details').value.trim();

        if (!ritm) {
            document.getElementById('erl-status').textContent = '❌ Cannot open form — RITM is missing.';
            return;
        }

        const url = buildFormUrl(DEFAULT_SERVICE, caseNumber, ritm, vendorCase, region, details);
        console.log(`🔗 Opening form: ${url}`);
        GM_openInTab(url, { active: true, insert: true });

        const modal = document.getElementById('erl-modal');
        if (modal) modal.style.display = 'none';
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'enhReqLog-notif-dot';

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
        if (isRegistered) {
            console.log('✅ Enhancement Request Logger already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Enhancement Request Logger: Max registration attempts reached. Toolbar may not be available.');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Enhancement Request Logger registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id:       TOOL_ID,
                    icon:     toolIcon,
                    tooltip:  TOOL_TOOLTIP,
                    position: TOOL_POSITION
                }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Enhancement Request Logger registered successfully!');
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
            console.log('📋 Enhancement Request Logger clicked!');
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
            console.log('Enhancement Request Logger already initialized');
            return;
        }

        console.log('Initializing Enhancement Request Logger...');
        isInitialized = true;
        injectStyles();
        initializeModal();
        console.log('✅ Enhancement Request Logger modal ready!');

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
