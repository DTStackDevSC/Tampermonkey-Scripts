// ==UserScript==
// @name         ServiceNow SLA Alert Banner
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowSLAAlertBanner.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowSLAAlertBanner.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.4.0
// @description  Display color-coded SLA warning banner based on days remaining
// @author       You
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = '1.4.0';
    const CHANGELOG = `Version 1.4.0:
- Added a "? Help" button at the bottom of the date format picker. It opens a visual Feature Guide that shows every banner color, explains the date formats and lists the controls.
- The date format picker and the What's New window now stay readable when ServiceNow uses a dark theme.

Version 1.3.6:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.3.5:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.3.4:
- Fixed "What's new" footer not appearing in format picker - version was being
  silently marked as seen on page load before the picker could open.

Version 1.3.3:
- Added a "What's new" link with pulsing dot to the date format picker footer -
  links to the changelog when a new version has not been seen yet.
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.3.1:
- Banner now suppresses on all terminal states (Closed Incomplete, Cancelled, Resolved, Closed) not just Closed Complete.

Version 1.3:
- Added configurable date format picker with ⚙ button next to the Due Date field.`;

    // ─── Version Control ──────────────────────────────────────────────────────

    const SLA_VERSION_KEY   = 'sla_banner_version';
    const SLA_CHANGELOG_KEY = 'sla_banner_changelog_seen';

    function getStoredVersion()    { return GM_getValue(SLA_VERSION_KEY, null); }
    function saveVersion(v)        { GM_setValue(SLA_VERSION_KEY, v); }
    function hasSeenChangelog()    { return GM_getValue(SLA_CHANGELOG_KEY, null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue(SLA_CHANGELOG_KEY, SCRIPT_VERSION); }

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
        modal.id = 'sla-changelog-modal';
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
        versionInfo.textContent = `SLA Alert Banner updated to v${SCRIPT_VERSION}!`;
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
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeButton.click(); });
    }

    // ─── Feature Guide (? Help modal) ─────────────────────────────────────────

    function showHelpModal() {
        if (document.getElementById('slaBannerHelpModal')) return;

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

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Open any RITM or Incident ticket. The banner appears on its own when the Due Date is close.');
                    const steps = [
                        ['1', 'Pick your date format', 'The first time, a setup window asks which date format your ServiceNow uses.'],
                        ['2', 'Open a ticket', 'The script reads the Due Date field and counts down to it.'],
                        ['3', 'Watch the banner', 'A colored banner shows above the activity stream when 3 days or less remain.']
                    ];
                    for (const [n, title, desc] of steps) {
                        const num = chip(n, '#667eea', { radius: '50%', padding: '2px 7px' });
                        const text = document.createElement('div');
                        text.appendChild(span(title, { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#333' }));
                        text.appendChild(span(desc, { display: 'block', fontSize: '12px', color: '#555', lineHeight: '1.4' }));
                        body.appendChild(hrow([ num, text ], { alignItems: 'flex-start', flexWrap: 'nowrap', margin: '0 0 8px 0' }));
                    }
                    caption(body, 'Works on tickets opened in a new tab (sc_req_item.do and incident.do pages).');
                }
            },
            {
                icon: '🚦', title: 'Banner Colors',
                buildContent(body) {
                    lead(body, 'The color and the message change as the Due Date gets closer.');
                    const levels = [
                        { bg: '#9370db', text: '⚠️ SLA NOTICE: 3 days remaining (Expires: ...)' },
                        { bg: '#ff8c00', text: '⚠️ SLA NOTICE: 2 days remaining (Expires: ...)' },
                        { bg: '#ff4444', text: '⚠️ SLA WARNING: 1 day remaining (Expires: ...)' },
                        { bg: '#ff4444', text: '🚨 SLA EXPIRES TODAY: 04:12:37 remaining' },
                        { bg: '#ff4444', text: '⚠️ SLA EXPIRED 2 day(s) ago!' }
                    ];
                    for (const l of levels) {
                        const bar = document.createElement('div');
                        bar.textContent = l.text;
                        Object.assign(bar.style, {
                            background: l.bg, color: '#fff', padding: '7px 12px', borderRadius: '3px',
                            fontWeight: 'bold', fontSize: '12px', textAlign: 'center', marginBottom: '6px',
                            fontFamily: 'Arial, sans-serif', boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                        });
                        body.appendChild(bar);
                    }
                    bullets(body, [
                        'On the last day the banner shows a live countdown in hours, minutes and seconds.',
                        'Nothing is shown while more than 3 days remain.',
                        'The banner is hidden on closed tickets: Closed Complete, Closed Incomplete, Cancelled, Resolved and Closed.'
                    ]);
                }
            },
            {
                icon: '📅', title: 'Date Format',
                buildContent(body) {
                    lead(body, 'Click the ⚙ button next to the Due Date field to change the date format at any time.');
                    const dueRow = hrow([
                        span('Due date', { fontSize: '12px', color: '#555', width: '70px' }),
                        span('2026-10-20 17:00:00', { fontSize: '12px', color: '#333', border: '1px solid #ccc', borderRadius: '3px', padding: '3px 8px', background: '#fff' }),
                        chip('⚙', '#f7f7f7', { color: '#555', border: '1px solid #ccc', radius: '3px', padding: '2px 7px', fontSize: '13px' })
                    ], { flexWrap: 'nowrap', gap: '6px', margin: '0 0 10px 0' });
                    body.appendChild(dueRow);
                    const formats = ['MM-dd-yyyy', 'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'];
                    body.appendChild(hrow(formats.map((f, i) => chip(f, i === 4 ? '#e8f0fe' : '#f7f7f7', {
                        color: '#1d1d1d', border: i === 4 ? '2px solid #4a90d9' : '1px solid #ccc', padding: '5px 9px'
                    }))));
                    caption(body, 'The format you use now is outlined in blue. The banner updates as soon as you pick a new one.');
                    bullets(body, [
                        'Not sure which one? Look at the Due Date field of any ticket, or check Date format in your ServiceNow profile.',
                        'If your profile shows None, pick yyyy-MM-dd.'
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Controls',
                buildContent(body) {
                    lead(body, 'The only window is the date format picker. Its controls are:');
                    badgeRow(body, { bg: '#f7f7f7', color: '#555', border: '1px solid #ccc', label: '⚙', desc: 'Next to the Due Date field. Opens the date format picker.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'At the bottom of the date format picker. Opens this Feature Guide.' });
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: 'none', label: "What's new 🔵", desc: 'Appears beside the version number after an update. Opens the changelog.' });
                    badgeRow(body, { bg: 'transparent', color: '#777', border: '1px solid #ccc', label: 'Cancel', desc: 'Closes the picker and keeps your current format.' });
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'slaBannerHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '1000000'
        });

        const modal = document.createElement('div');
        modal.id = 'slaBannerHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000001', background: '#fff', border: '2px solid #333', padding: '20px',
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
        titleSub.textContent = `SLA Alert Banner • v${SCRIPT_VERSION}`;
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

    // ─── Dark Mode Isolation ──────────────────────────────────────────────────

    function injectDarkModeStyles() {
        if (document.getElementById('sla-dark-mode-style')) return;
        const darkModeStyle = document.createElement('style');
        darkModeStyle.id = 'sla-dark-mode-style';
        darkModeStyle.textContent = `
            #sla-format-picker, #sla-changelog-modal, #slaBannerHelpModal {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
            #sla-format-picker input, #sla-format-picker select, #sla-format-picker textarea,
            #sla-changelog-modal input, #sla-changelog-modal select, #sla-changelog-modal textarea,
            #slaBannerHelpModal input, #slaBannerHelpModal select, #slaBannerHelpModal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
        `;
        (document.head || document.documentElement).appendChild(darkModeStyle);
    }

    // ─── Date Format Config ───────────────────────────────────────────────────

    const DATE_FORMAT_KEY = 'sla_banner_date_format';

    const DATE_FORMATS = {
        'MM-dd-yyyy': { label: 'MM-dd-yyyy  (e.g. 03-15-2024)', order: ['m','d','y'], sep: '-' },
        'dd/MM/yyyy': { label: 'dd/MM/yyyy  (e.g. 15/03/2024)', order: ['d','m','y'], sep: '/' },
        'dd-MM-yyyy': { label: 'dd-MM-yyyy  (e.g. 15-03-2024)', order: ['d','m','y'], sep: '-' },
        'dd.MM.yyyy': { label: 'dd.MM.yyyy  (e.g. 15.03.2024)', order: ['d','m','y'], sep: '.' },
        'yyyy-MM-dd': { label: 'yyyy-MM-dd  (e.g. 2024-03-15)', order: ['y','m','d'], sep: '-' },
    };

    let activeFormatKey = null;

    function showFormatPicker(isReconfigure, callback) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
        });

        const box = document.createElement('div');
        box.id = 'sla-format-picker';
        Object.assign(box.style, {
            background: '#fff',
            borderRadius: '6px',
            padding: '28px 32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        });

        const title = document.createElement('h2');
        title.textContent = isReconfigure
            ? '⚙️ SLA Banner — Change Date Format'
            : '📅 SLA Banner — First Time Setup';
        Object.assign(title.style, { margin: '0 0 10px', fontSize: '16px', color: '#1d1d1d' });

        // ── Hint paragraph ────────────────────────────────────────────────────
        const hint = document.createElement('p');
        Object.assign(hint.style, {
            margin: '0 0 6px',
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.6',
        });
        hint.innerHTML = isReconfigure
            ? 'Select the date format your ServiceNow instance uses. The banner will update immediately.'
            : 'Select the date format your ServiceNow instance uses.';

        const howTo = document.createElement('p');
        Object.assign(howTo.style, {
            margin: '0 0 20px',
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.6',
            borderLeft: '3px solid #e0e0e0',
            paddingLeft: '10px',
        });
        howTo.innerHTML =
            'Not sure? Check the <strong>Due Date</strong> field on any ticket, or go to your ' +
            '<strong>profile</strong> (top-right picture → <em>Profile</em>) and look for ' +
            '<strong>Date format</strong>. If it shows <strong>None</strong>, your format is ' +
            '<strong>yyyy-MM-dd</strong>.' +
            (isReconfigure ? '' : '<br><br>This can be changed later via the ⚙ button next to the Due Date field.');

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', flexDirection: 'column', gap: '10px' });

        Object.entries(DATE_FORMATS).forEach(([key, { label }]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;

            const isCurrent = isReconfigure && key === activeFormatKey;
            Object.assign(btn.style, {
                padding: '10px 14px',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                border: isCurrent ? '2px solid #4a90d9' : '1px solid #ccc',
                borderRadius: '4px',
                background: isCurrent ? '#e8f0fe' : '#f7f7f7',
                color: '#1d1d1d',
                transition: 'background 0.15s',
            });
            btn.onmouseover = () => { if (!isCurrent) btn.style.background = '#e8f0fe'; };
            btn.onmouseout  = () => { if (!isCurrent) btn.style.background = '#f7f7f7'; };
            btn.onclick = () => {
                GM_setValue(DATE_FORMAT_KEY, key);
                overlay.remove();
                callback(key);
            };
            btnGroup.appendChild(btn);
        });

        if (isReconfigure) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            Object.assign(cancel.style, {
                marginTop: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'transparent',
                color: '#777',
            });
            cancel.onmouseover = () => cancel.style.background = '#f0f0f0';
            cancel.onmouseout  = () => cancel.style.background = 'transparent';
            cancel.onclick = () => overlay.remove();
            btnGroup.appendChild(cancel);
        }

        const versionFooter = document.createElement('div');
        Object.assign(versionFooter.style, {
            marginTop: '16px', fontSize: '11px', color: '#aaa',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
            fontFamily: 'Arial, sans-serif',
        });

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif', marginRight: 'auto'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        versionFooter.appendChild(helpBtn);

        if (isNewVersion() && !hasSeenChangelog()) {
            const whatsNewLink = document.createElement('span');
            whatsNewLink.textContent = "What's new";
            Object.assign(whatsNewLink.style, {
                fontSize: '11px', color: '#667eea', cursor: 'pointer',
                textDecoration: 'underline', fontFamily: 'Arial, sans-serif',
            });
            whatsNewLink.onclick = () => { overlay.remove(); showChangelogModal(); };

            const notifDot = document.createElement('span');
            Object.assign(notifDot.style, {
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#007bff', display: 'inline-block', flexShrink: '0',
            });
            let dotBlue = true;
            setInterval(() => {
                dotBlue = !dotBlue;
                notifDot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);

            versionFooter.appendChild(whatsNewLink);
            versionFooter.appendChild(notifDot);
        }

        const versionLabel = document.createElement('span');
        versionLabel.textContent = `v${SCRIPT_VERSION}`;
        versionFooter.appendChild(versionLabel);

        box.append(title, hint, howTo, btnGroup, versionFooter);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ─── Date Parsing ─────────────────────────────────────────────────────────

    function parseDueDate(dateStr, formatKey) {
        if (!dateStr) return null;
        dateStr = dateStr.trim();

        const fmt = DATE_FORMATS[formatKey] || DATE_FORMATS['yyyy-MM-dd'];
        const { order } = fmt;

        // Match date part + optional time (supports -, /, . as separators)
        const match = dateStr.match(
            /^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
        );

        if (match) {
            const [, seg1, seg2, seg3, h = '0', min = '0', s = '0'] = match;
            const parts = { [order[0]]: seg1, [order[1]]: seg2, [order[2]]: seg3 };
            return new Date(+parts.y, +parts.m - 1, +parts.d, +h, +min, +s);
        }

        const fallback = new Date(dateStr);
        return isNaN(fallback) ? null : fallback;
    }

    // ─── Core Logic ───────────────────────────────────────────────────────────

    function getTimeRemaining(dueDate, formatKey) {
        const now = new Date();
        const due = parseDueDate(dueDate, formatKey);
        if (!due || isNaN(due)) return null;

        const diffMs = due - now;
        return {
            total:   diffMs,
            days:    Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours:   Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
            isToday: now.toDateString() === due.toDateString(),
            due,
        };
    }

    function getAlertColor(days, isToday) {
        if (isToday || days <= 1) return { bg: '#ff4444', text: '#ffffff' };
        if (days === 2)           return { bg: '#ff8c00', text: '#ffffff' };
        if (days === 3)           return { bg: '#9370db', text: '#ffffff' };
        return null;
    }

    // ─── Config Button (next to Due Date field) ───────────────────────────────

    function injectConfigButton() {
        if (document.getElementById('sla-config-btn')) return;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
        if (!dueDateInput) return;

        const configBtn = document.createElement('button');
        configBtn.id = 'sla-config-btn';
        configBtn.type = 'button';
        configBtn.textContent = '⚙';
        configBtn.title = 'SLA Banner — Change date format';
        Object.assign(configBtn.style, {
            marginLeft: '6px',
            padding: '2px 7px',
            fontSize: '13px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: '3px',
            background: '#f7f7f7',
            color: '#555',
            verticalAlign: 'middle',
            lineHeight: '1.4',
            transition: 'background 0.15s, color 0.15s',
        });
        configBtn.onmouseover = () => { configBtn.style.background = '#e8f0fe'; configBtn.style.color = '#1a73e8'; };
        configBtn.onmouseout  = () => { configBtn.style.background = '#f7f7f7'; configBtn.style.color = '#555'; };
        configBtn.onclick = () => {
            showFormatPicker(true, newFormatKey => {
                activeFormatKey = newFormatKey;
                const input = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
                if (input?.value) createOrUpdateBanner(input.value, newFormatKey);
            });
        };

        dueDateInput.insertAdjacentElement('afterend', configBtn);
    }

    // ─── State Check ─────────────────────────────────────────────────────────

    const TERMINAL_STATES = new Set([
        'closed complete',
        'closed incomplete',
        'cancelled',
        'resolved',
        'closed',
    ]);

    function isTicketClosed() {
        // ServiceNow renders the state as a select (edit mode) or a display span (read-only mode).
        // Try the select first, then fall back to common read-only label selectors.
        const stateSelect = document.querySelector('select[id$=".state"]');
        if (stateSelect) {
            const text = stateSelect.options[stateSelect.selectedIndex]?.text?.trim().toLowerCase() || '';
            return TERMINAL_STATES.has(text);
        }
        // Read-only display variants used by different SNow themes
        const stateLabel =
            document.querySelector('[id$=".state_label"]') ||
            document.querySelector('[id$=".state"] .select2-chosen');
        if (stateLabel) {
            return TERMINAL_STATES.has(stateLabel.textContent.trim().toLowerCase());
        }
        return false;
    }

    // ─── Banner ───────────────────────────────────────────────────────────────

    function createOrUpdateBanner(dueDate, formatKey) {
        if (isTicketClosed()) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const tr = getTimeRemaining(dueDate, formatKey);
        if (!tr) return;

        const { days, hours, minutes, seconds, isToday, total, due } = tr;

        if (days > 3 && !isToday && total > 0) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const colors = getAlertColor(days, isToday);
        if (!colors && total > 0) return;

        const targetElement = document.querySelector('.sn-form-inline-stream-entries')
            || document.querySelector('.activity-form-group')
            || document.querySelector('.tab_section');
        if (!targetElement) return;

        let banner = document.getElementById('sla-alert-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'sla-alert-banner';
            Object.assign(banner.style, {
                padding: '12px 15px',
                marginBottom: '15px',
                borderRadius: '3px',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: '1000',
                fontFamily: 'Arial, sans-serif',
            });
            targetElement.insertBefore(banner, targetElement.firstChild);
        }

        const finalColors = total < 0 ? { bg: '#ff4444', text: '#ffffff' } : colors;
        banner.style.backgroundColor = finalColors.bg;
        banner.style.color = finalColors.text;

        const pad = n => String(n).padStart(2, '0');
        const countdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        const expiryStr = due.toLocaleString();

        if      (total < 0)   banner.textContent = `⚠️ SLA EXPIRED ${Math.abs(days)} day(s) ago!`;
        else if (isToday)     banner.textContent = `🚨 SLA EXPIRES TODAY — ${countdown} remaining`;
        else if (days === 0)  banner.textContent = `🚨 SLA EXPIRES SOON — ${countdown} remaining`;
        else if (days === 1)  banner.textContent = `⚠️ SLA WARNING: 1 day remaining (Expires: ${expiryStr})`;
        else if (days === 2)  banner.textContent = `⚠️ SLA NOTICE: 2 days remaining (Expires: ${expiryStr})`;
        else if (days === 3)  banner.textContent = `⚠️ SLA NOTICE: 3 days remaining (Expires: ${expiryStr})`;
    }

    // ─── Monitor ──────────────────────────────────────────────────────────────

    function monitorDueDate(formatKey) {
        activeFormatKey = formatKey;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');

        if (!dueDateInput || !dueDateInput.value) {
            setTimeout(() => monitorDueDate(formatKey), 500);
            return;
        }

        injectConfigButton();
        createOrUpdateBanner(dueDateInput.value, formatKey);

        setInterval(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }, 1000);

        new MutationObserver(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }).observe(dueDateInput, { attributes: true, attributeFilter: ['value'] });
    }

    // ─── Entry Point ──────────────────────────────────────────────────────────

    function init() {
        injectDarkModeStyles();
        const savedFormat = GM_getValue(DATE_FORMAT_KEY, null);

        if (savedFormat && DATE_FORMATS[savedFormat]) {
            monitorDueDate(savedFormat);
        } else {
            const showPicker = () => showFormatPicker(false, formatKey => monitorDueDate(formatKey));
            document.body ? showPicker() : document.addEventListener('DOMContentLoaded', showPicker);
        }

    }

    init();
})();