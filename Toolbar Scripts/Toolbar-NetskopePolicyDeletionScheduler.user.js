// ==UserScript==
// @name         |Toolbar| Policy Deletion Reminder
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyDeletionScheduler.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-NetskopePolicyDeletionScheduler.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.1.0
// @description  Registers a policy deletion reminder by opening a pre-filled form with the policy URL, name, and expiry date - Integrated with Toolbar
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('🗑️ Policy Deletion Reminder loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.1.0';
    const CHANGELOG = `Version 1.1.0:
- Added a "? Help" button next to the version number at the bottom of the window. It opens a visual Feature Guide that explains what is filled in and how the reminder form opens.
- The window and its changelog now stay readable on dark themed pages.

Version 1.0.2:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.0.1:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.0:
- Added version tracking and changelog system with collapsible version cards.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 0.9.1:
- Initial release.`;

    function getStoredVersion()    { return GM_getValue('pdrVersion', null); }
    function saveVersion(v)        { GM_setValue('pdrVersion', v); }
    function hasSeenChangelog()    { return GM_getValue('pdrChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue('pdrChangelogSeen', SCRIPT_VERSION); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const a = v1.split('.').map(Number), b = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if ((b[i] || 0) > (a[i] || 0)) return true;
            if ((b[i] || 0) < (a[i] || 0)) return false;
        }
        return false;
    }
    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

    /* ==========================================================
     *  ⚙️  USER CONFIGURATION — Edit these values as needed
     * ==========================================================*/

    // The base Office Forms URL (everything up to and including the &id= param)
    const FORM_BASE_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=8UXaNizdH02vE1q-RrmZIQgejpGrB1pHvXnKBLeX7j5UOUhQTjA0UTJJRFozMVBVQjEzUVZBTzVZNCQlQCN0PWcu';

    // The exact query parameter keys used by this form's pre-fill system
    const PARAM_PAGE_URL    = 'r04fa97b2e8e8417c9b41f3feb7aed408';
    const PARAM_POLICY_NAME = 'r1e4d11ccef0940378297c0a725b73001';
    const PARAM_EXPIRY_DATE = 'r942cedc03c5c4a339a3bdea4a00f5097';

    // How many days in the future to calculate the date
    const DAYS_OFFSET = 30;

    /* ==========================================================
     *  TOOLBAR REGISTRATION CONFIG
     * ==========================================================*/

    const TOOL_ID       = 'policyDeletionReminder';
    const TOOL_TOOLTIP  = 'Register Policy Deletion Reminder';
    const TOOL_POSITION = 5;

    // Trash / delete clock icon
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 16h4v2h-4zm0-4h7v2h-7zm0-4h7v2h-7zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
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

    /**
     * Returns the full current page URL.
     */
    function getPageUrl() {
        return window.location.href;
    }

    /**
     * Reads the policy name from the Angular input field.
     * Returns the trimmed value, or null if the field isn't found / is empty.
     */
    function getPolicyName() {
        const input = document.querySelector(
            'input.ns-form-input.policy-name-container[placeholder="Policy Name"]'
        );
        if (!input) return null;
        const val = input.value.trim();
        return val.length > 0 ? val : null;
    }

    /**
     * Returns today's date plus DAYS_OFFSET in YYYY-MM-DD format.
     */
    function getFutureDate() {
        const date = new Date();
        date.setDate(date.getDate() + DAYS_OFFSET);
        const yyyy = date.getFullYear();
        const mm   = String(date.getMonth() + 1).padStart(2, '0');
        const dd   = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Builds the full form URL with query parameters.
     */
    function buildFormUrl(pageUrl, policyName, futureDate) {
        // Use encodeURIComponent (always produces %20 for spaces) instead of
        // URLSearchParams (which produces "+" for spaces, breaking Office Forms pre-fill)
        const encodedUrl  = encodeURIComponent(pageUrl);
        const encodedName = encodeURIComponent(policyName);
        const encodedDate = encodeURIComponent(`"${futureDate}"`);
        return `${FORM_BASE_URL}&${PARAM_PAGE_URL}=${encodedUrl}&${PARAM_POLICY_NAME}=${encodedName}&${PARAM_EXPIRY_DATE}=${encodedDate}`;
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
        if (document.getElementById('pdr-changelog-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pdr-changelog-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000',
        });

        const modal = document.createElement('div');
        modal.id = 'pdr-changelog-modal';
        Object.assign(modal.style, {
            position:     'fixed',
            top:          '50%', left: '50%',
            transform:    'translate(-50%, -50%)',
            zIndex:       '1000001',
            background:   '#ffffff',
            border:       '2px solid #333333',
            borderRadius: '10px',
            padding:      '20px',
            boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily:   'Arial, sans-serif',
            maxWidth:     '520px',
            width:        '90vw',
            maxHeight:    '80vh',
            overflowY:    'auto',
            color:        '#333333',
            boxSizing:    'border-box',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New — v${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            marginTop:     '0', marginBottom: '15px',
            color:         '#333333',
            borderBottom:  '2px solid #667eea',
            paddingBottom: '10px',
            fontSize:      '18px', fontWeight: 'bold',
            fontFamily:    'Arial, sans-serif',
        });

        const info = document.createElement('div');
        info.textContent = `You've been updated to v${SCRIPT_VERSION}!`;
        Object.assign(info.style, {
            background:   '#f0f4ff',
            color:        '#333333',
            padding:      '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            borderLeft:   '4px solid #667eea',
            fontFamily:   'Arial, sans-serif',
            fontSize:     '13px',
        });

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
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding:    '9px 12px',
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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Got it!';
        Object.assign(closeBtn.style, {
            display: 'block', marginTop: '15px',
            padding: '10px 20px', background: '#667eea', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontFamily: 'Arial, sans-serif', fontSize: '14px',
            boxSizing: 'border-box',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#5568d3'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#667eea'; });
        closeBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            const notif = document.getElementById('pdr-changelog-notif');
            if (notif) notif.remove();
        };

        modal.appendChild(title);
        modal.appendChild(info);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeBtn);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = () => closeBtn.click();
    }

    /* ==========================================================
     *  MODAL
     * ==========================================================*/

    /* ==========================================================
     *  FEATURE GUIDE  (? Help modal)
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('pdrHelpModal')) return;

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
                    lead(body, 'Open the Netskope policy you want removed later, then click the deletion reminder icon in the floating toolbar.');
                    const pin = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    body.appendChild(hrow([ menuMock([ toolSquare('🗑️', pin), menuSep(), toolSquare('🛡️'), toolSquare('⚙️') ]) ], { margin: '0 0 10px 0' }));
                    caption(body, 'The 🗑️ icon is the Policy Deletion Reminder button in the toolbar.');
                    bullets(body, [
                        'The window reads the policy page you are on and fills everything in for you.',
                        'Click Register Deletion Reminder to open the reminder form with those values.',
                        'Use it for temporary policies, so the team is reminded to delete them when they expire.'
                    ]);
                }
            },
            {
                icon: '📋', title: 'What Gets Filled In',
                buildContent(body) {
                    lead(body, 'All three fields are read only. They come from the page and today\'s date.');
                    body.appendChild(mockField('Policy Page URL', 'https://tenant.goskope.com/ns#/policy/...', { readOnly: true, width: '380px' }));
                    body.appendChild(mockField('Policy Name', 'EU - Web Allow - Temporary Access', { readOnly: true, width: '380px' }));
                    body.appendChild(mockField('Deletion Reminder Date (+30 days)', '2026-11-16', { readOnly: true, width: '380px' }));
                    kvGrid(body, [
                        ['Policy Page URL', 'The address of the policy page you have open.'],
                        ['Policy Name',     'Read from the Policy Name field of the policy.'],
                        ['Reminder Date',   'Today plus 30 days, in YYYY-MM-DD format.']
                    ]);
                }
            },
            {
                icon: '🗓️', title: 'Registering the Reminder',
                buildContent(body) {
                    lead(body, 'Click the button to open the Office Forms reminder in a new tab with every answer already filled in.');
                    body.appendChild(hrow([ chip('🗓️ Register Deletion Reminder', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', { padding: '8px 16px', fontSize: '12px', radius: '6px' }) ]));
                    body.appendChild(hrow([ span('⚠️ Policy Name not found, the field may be empty.', { fontSize: '12px', color: '#c0392b' }) ], { margin: '8px 0 0 0' }));
                    caption(body, 'This message shows, and the button stays greyed out, when the policy has no name yet or you are not on a policy page.');
                    bullets(body, [
                        'Check the answers in Office Forms and submit them there.',
                        'The window closes once the new tab is open.'
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent(body) {
                    lead(body, 'The window has no settings. These controls frame it.');
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Sits beside the version number at the bottom. Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#0066cc', border: 'none', label: "🔵 What's new", desc: 'Appears with a pulsing dot after an update. Opens the changelog.' });
                    badgeRow(body, { bg: 'red', color: '#fff', border: 'none', label: 'X', desc: 'Closes the window without opening the form.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'pdrHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000002'
        });

        const modal = document.createElement('div');
        modal.id = 'pdrHelpModal';
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
        titleSub.textContent = `Policy Deletion Reminder • v${SCRIPT_VERSION}`;
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

    /* ==========================================================
     *  DARK MODE ISOLATION
     * ==========================================================*/

    function injectDarkModeStyles() {
        if (document.getElementById('pdr-dark-mode-style')) return;
        const darkModeStyle = document.createElement('style');
        darkModeStyle.id = 'pdr-dark-mode-style';
        darkModeStyle.textContent = `
            #policy-form-opener-modal, #pdr-changelog-modal, #pdrHelpModal { color: #333333 !important; }
            #policy-form-opener-modal { background-color: #f9f9f9 !important; }
            #pdr-changelog-modal, #pdrHelpModal { background-color: #ffffff !important; }
            #policy-form-opener-modal input, #policy-form-opener-modal select, #policy-form-opener-modal textarea,
            #pdrHelpModal input, #pdrHelpModal select, #pdrHelpModal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
        `;
        document.head.appendChild(darkModeStyle);
    }

    function initializeModal() {
        if (document.getElementById('policy-form-opener-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'policy-form-opener-modal';
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

        // ── Title ─────────────────────────────────────────────
        const title = document.createElement('div');
        Object.assign(title.style, {
            position:   'absolute',
            top:        '12px',
            left:       '12px',
            fontSize:   '12px',
            color:      '#333',
            fontWeight: 'bold'
        });
        title.textContent = '🗑️ Policy Deletion Reminder';
        modal.appendChild(title);

        // ── Read-only preview rows ────────────────────────────
        function makeRow(labelText, valueId, placeholder) {
            const wrap = document.createElement('div');
            wrap.style.width = '100%';

            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            Object.assign(lbl.style, {
                display:      'block',
                fontWeight:   'bold',
                fontSize:     '12px',
                color:        '#555',
                marginBottom: '4px'
            });

            const val = document.createElement('input');
            val.id          = valueId;
            val.type        = 'text';
            val.readOnly    = true;
            val.placeholder = placeholder;
            Object.assign(val.style, {
                width:        '100%',
                padding:      '8px 10px',
                border:       '1px solid #ddd',
                borderRadius: '6px',
                fontSize:     '13px',
                color:        '#333',
                background:   '#fff',
                boxSizing:    'border-box'
            });

            wrap.appendChild(lbl);
            wrap.appendChild(val);
            return wrap;
        }

        modal.appendChild(makeRow('Policy Page URL', 'pfop-page-url', 'Not found'));
        modal.appendChild(makeRow('Policy Name', 'pfop-policy-name', 'Not found — open a policy first'));
        modal.appendChild(makeRow(`Deletion Reminder Date (+${DAYS_OFFSET} days)`, 'pfop-expiry-date', ''));

        // ── Status message ────────────────────────────────────
        const status = document.createElement('div');
        status.id = 'pfop-status';
        Object.assign(status.style, {
            fontSize:  '12px',
            color:     '#c0392b',
            textAlign: 'center',
            minHeight: '16px'
        });
        modal.appendChild(status);

        // ── Open Form button ──────────────────────────────────
        const btnOpen = document.createElement('button');
        btnOpen.id          = 'pfop-open-btn';
        btnOpen.textContent = '🗓️ Register Deletion Reminder';
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

        // ── Footer: version + changelog badge ────────────────
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginTop:      '8px',
            paddingTop:     '8px',
            borderTop:      '1px solid #e0e0e0',
        });

        const versionLabel = document.createElement('span');
        Object.assign(versionLabel.style, { fontSize: '11px', color: '#999', fontFamily: 'Arial, sans-serif' });
        versionLabel.textContent = `v${SCRIPT_VERSION}`;

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

        const footerLeft = document.createElement('span');
        Object.assign(footerLeft.style, { display: 'inline-flex', alignItems: 'center', gap: '8px' });
        footerLeft.appendChild(versionLabel);
        footerLeft.appendChild(helpBtn);
        footer.appendChild(footerLeft);

        if (isNewVersion() && !hasSeenChangelog()) {
            const notif = document.createElement('span');
            notif.id = 'pdr-changelog-notif';
            Object.assign(notif.style, {
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', padding: '3px 8px', borderRadius: '4px',
            });
            notif.addEventListener('mouseenter', () => { notif.style.backgroundColor = '#e0e0e0'; });
            notif.addEventListener('mouseleave', () => { notif.style.backgroundColor = 'transparent'; });

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
                fontFamily: 'Arial, sans-serif', fontWeight: 'normal',
            });

            notif.appendChild(dot);
            notif.appendChild(notifText);
            notif.onclick = showChangelogModal;
            footer.appendChild(notif);
        }

        modal.appendChild(footer);

        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  SHOW MODAL — populates fields when opened
     * ==========================================================*/

    function showModal() {
        const modal = document.getElementById('policy-form-opener-modal');
        if (!modal) {
            console.error('❌ Policy Deletion Reminder modal not found!');
            return;
        }

        const pageUrl    = getPageUrl();
        const policyName = getPolicyName();
        const expiryDate = getFutureDate();

        document.getElementById('pfop-page-url').value    = pageUrl;
        document.getElementById('pfop-policy-name').value = policyName ?? '';
        document.getElementById('pfop-expiry-date').value = expiryDate;

        // Show a warning if something is missing
        const status = document.getElementById('pfop-status');
        const btn    = document.getElementById('pfop-open-btn');

        if (!policyName) {
            status.textContent = '⚠️ Policy Name not found — the field may be empty.';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor  = 'not-allowed';
        } else {
            status.textContent = '';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor  = 'pointer';
        }

        modal.style.display = 'flex';
    }

    /* ==========================================================
     *  OPEN FORM
     * ==========================================================*/

    function openForm() {
        const pageUrl    = getPageUrl();
        const policyName = getPolicyName();

        if (!policyName) {
            document.getElementById('pfop-status').textContent =
                '❌ Cannot open form — Policy Name is missing.';
            return;
        }

        const url = buildFormUrl(pageUrl, policyName, getFutureDate());
        console.log(`🔗 Opening form: ${url}`);

        GM_openInTab(url, { active: true, insert: true });

        // Close the modal after opening
        const modal = document.getElementById('policy-form-opener-modal');
        if (modal) modal.style.display = 'none';
    }

    /* ==========================================================
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOLBAR_DOT_CLASS = 'pdr-notif-dot';

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
                top:           '2px', right: '2px',
                width:         '8px', height: '8px',
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

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ Policy Deletion Reminder already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Policy Deletion Reminder: Max registration attempts reached. Toolbar may not be available.');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Policy Deletion Reminder registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found, registering Policy Deletion Reminder...');

            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id:       TOOL_ID,
                    icon:     toolIcon,
                    tooltip:  TOOL_TOOLTIP,
                    position: TOOL_POSITION
                }
            }));

            isRegistered = true;
            console.log('✅ Policy Deletion Reminder registered successfully!');
            addToolbarNotificationDot();
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
            console.log('🗑️ Policy Deletion Reminder clicked!');
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
            console.log('Policy Deletion Reminder already initialized');
            return;
        }

        console.log('Initializing Policy Deletion Reminder...');
        isInitialized = true;
        injectDarkModeStyles();
        initializeModal();
        console.log('✅ Policy Deletion Reminder modal ready!');

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