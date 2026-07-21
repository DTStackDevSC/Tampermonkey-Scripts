// ==UserScript==
// @name         || Tools Toolbar Suite ||
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-Suite.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-Suite.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.0
// @description  Single-install suite bundling eleven toolbar tools for ServiceNow and Netskope
// @author       J.R.
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.0';
    const CHANGELOG = `Version 1.0.0:
- Combined the eleven separate toolbar tools into a single install. Every tool keeps its own settings and its own "what's new" notification.`;

    function getStoredVersion() {
        return GM_getValue('toolbarSuiteVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('toolbarSuiteVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('toolbarSuiteChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('toolbarSuiteChangelogSeen', SCRIPT_VERSION);
    }

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    /* ==========================================================
     *  DARK MODE ISOLATION
     * ==========================================================*/

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        #toolbar-settings-modal .settings-content,
        #toolbarChangelogModal,
        #toolbarHelpModal {
            color: #333333 !important;
            background-color: #ffffff !important;
        }
        #toolbar-settings-modal .settings-content input,
        #toolbar-settings-modal .settings-content select,
        #toolbar-settings-modal .settings-content textarea,
        #toolbarChangelogModal input,
        #toolbarChangelogModal select,
        #toolbarChangelogModal textarea,
        #toolbarHelpModal input,
        #toolbarHelpModal select,
        #toolbarHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #tqo-settings-modal, #tqo-changelog-modal, #tqoHelpModal { color: #333333 !important; }
        #tqoHelpModal input, #tqoHelpModal select, #tqoHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #dt-modal { color: #333333 !important; }
        #dt-modal input, #dt-modal select, #dt-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #domainToolsHelpModalOverlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            background: rgba(0,0,0,0.5) !important; z-index: 1000020 !important;
        }
        #domainToolsHelpModal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 1000021 !important;
            background: #fff !important; border: 2px solid #333 !important;
            padding: 20px !important; border-radius: 10px !important;
            width: 640px !important; max-width: 92vw !important; max-height: 82vh !important;
            overflow-y: auto !important; color: #333333 !important;
            font-family: Arial, sans-serif !important;
        }
        #domainToolsHelpModal input, #domainToolsHelpModal select, #domainToolsHelpModal textarea {
            background-color: #ffffff !important; color: #333333 !important;
        }
        /* tool modal IDs appended below */
    `;
    document.head.appendChild(darkModeStyle);

    /* ==========================================================
     *  SHARED UTILITIES
     * ==========================================================*/

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num2 > num1) return true;
            if (num2 < num1) return false;
        }
        return false;
    }

    function parseChangelog(changelogStr) {
        const entries = [];
        let current = null;
        let currentBullet = null;
        const src = (typeof changelogStr === 'string') ? changelogStr : CHANGELOG;
        for (const line of src.split('\n')) {
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

    function setJournalField(doc, win, fieldName, text) {
        // fieldName is 'work_notes' or 'comments'

        // 1. Hidden form textarea (submitted with the form)
        const formTA = doc.getElementById(`sc_req_item.${fieldName}`);
        if (formTA) {
            formTA.value = text;
            formTA.dispatchEvent(new Event('change', { bubbles: true }));
            formTA.dispatchEvent(new Event('input',  { bubbles: true }));
        }

        // 2. Angular activity stream textarea (visible to the user)
        const streamTA = doc.getElementById(`activity-stream-${fieldName}-textarea`) ||
                         doc.getElementById('activity-stream-textarea');
        if (streamTA) {
            streamTA.value = text;
            const angular = win.angular;
            const scope   = angular.element(streamTA).scope();
            const model   = streamTA.getAttribute('ng-model'); // e.g. "activity_field_0.value"
            const key     = model.split('.')[0];               // "activity_field_0" or "activity_field_1"
            let s = scope;
            while (s) {
                if (key in s) { s[key].value = text; s.$apply(); break; }
                s = s.$parent;
            }
            streamTA.dispatchEvent(new Event('input',  { bubbles: true }));
            streamTA.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    // Angular model mapping: activity_field_0 = work_notes, activity_field_1 = comments

    /* ==========================================================
     *  TOOLBAR CORE
     * ==========================================================*/

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'toolbarChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'toolbarChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New: Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'toolbar-version-info';
        versionInfo.textContent = `Tools Toolbar Suite has been updated to version ${SCRIPT_VERSION}!`;

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '0';
        parseChangelog(CHANGELOG).forEach((entry, index) => {
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
        closeButton.className = 'toolbar-close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);

            // Remove the notification dot
            const notification = document.getElementById('toolbarChangelogNotification');
            if (notification) {
                notification.remove();
            }
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Close on overlay click
        overlay.onclick = () => {
            closeButton.click();
        };
    }

    /* ==========================================================
     *  HELP / FEATURE GUIDE MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('toolbarHelpModal')) return;

        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, {
                fontSize: '11px', color: '#888', fontStyle: 'italic',
                margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(c);
        }

        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

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

        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                flexWrap: 'wrap', margin: '0 0 4px 0'
            }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

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

        function toolSquare(content, opts) {
            opts = opts || {};
            const sq = document.createElement('div');
            Object.assign(sq.style, {
                width: '30px', height: '30px', borderRadius: '8px',
                background: opts.bg || '#f3f4f6',
                border: opts.border || '2px solid transparent',
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

        function menuSep() {
            const s = document.createElement('div');
            Object.assign(s.style, { width: '1px', height: '22px', background: '#e5e7eb', flexShrink: '0' });
            return s;
        }

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

        const PURPLE_GRAD = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    lead(body, 'The Tools Toolbar floats on the page and expands into a menu. It is the home for every helper tool in this suite.');
                    body.appendChild(hrow([
                        toolSquare('🔧', { bg: PURPLE_GRAD }),
                        span('▶', { color: '#bbb', fontSize: '14px' }),
                        menuMock([ toolSquare('📊'), toolSquare('📝'), toolSquare('🔗'), menuSep(), toolSquare('⚙️') ])
                    ]));
                    bullets(body, [
                        'Click the floating button to open or close the menu.',
                        'Click any tool icon to run that tool.',
                        'Click the gear to open the Settings window.'
                    ]);
                }
            },
            {
                icon: '🧰',
                title: 'Tools Menu',
                buildContent: (body) => {
                    lead(body, 'Every tool in the suite adds its own icon to the menu automatically. The toolbar provides the container and the gear.');
                    body.appendChild(hrow([
                        menuMock([ toolSquare('📊'), toolSquare('📝', { dot: true }), toolSquare('🔗'), menuSep(), toolSquare('⚙️') ])
                    ]));
                    body.appendChild(hrow([
                        toolSquare('📝', { dot: true }),
                        span('Orange dot: this tool has a new version with unread release notes.', { fontSize: '12px', color: '#555' })
                    ], { margin: '8px 0 0 0' }));
                    bullets(body, [
                        'Hover an icon to see the tool name.',
                        'Tools only appear on the pages they support.',
                        'If the menu only shows the gear, no tools match the current page.'
                    ]);
                }
            },
            {
                icon: '📌',
                title: 'Pinned Tools',
                buildContent: (body) => {
                    lead(body, 'Pinning locks a tool to one side of the menu so it stays in the same place, separated from the rest by a divider.');
                    const pin = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    body.appendChild(hrow([
                        menuMock([
                            toolSquare('📊', pin), menuSep(),
                            toolSquare('📝'), toolSquare('🔗'), menuSep(),
                            toolSquare('🛡️', pin), menuSep(),
                            toolSquare('⚙️')
                        ])
                    ]));
                    body.appendChild(hrow([
                        chip('Pinned left', '#667eea'),
                        chip('Unpinned', '#9ca3af'),
                        chip('Pinned right', '#667eea')
                    ], { margin: '8px 0 0 0' }));
                    bullets(body, [
                        'Tick a tool in the Pinned Tools settings to pin it.',
                        'Choose Left or Right for the side it sits on.',
                        'Use the up and down arrows to reorder the pinned group.'
                    ]);
                }
            },
            {
                icon: '🎯',
                title: 'Position and Dragging',
                buildContent: (body) => {
                    lead(body, 'Place the toolbar in one of six preset spots, or drag it anywhere on the screen.');
                    const screen = document.createElement('div');
                    Object.assign(screen.style, {
                        position: 'relative', width: '230px', height: '130px',
                        border: '2px solid #d0d0f0', borderRadius: '8px',
                        background: '#f8f8ff', margin: '0 0 2px 0', flexShrink: '0'
                    });
                    const spots = [
                        { t: '8px',  l: '8px' }, { t: '8px',  c: true }, { t: '8px',  r: '8px' },
                        { b: '8px',  l: '8px' }, { b: '8px',  c: true }, { b: '8px',  r: '8px' }
                    ];
                    spots.forEach((p, i) => {
                        const isDefault = i === 5;
                        const dot = document.createElement('div');
                        Object.assign(dot.style, {
                            position: 'absolute', borderRadius: '4px',
                            width: isDefault ? '16px' : '12px', height: isDefault ? '16px' : '12px',
                            background: isDefault ? PURPLE_GRAD : '#c0c8f0'
                        });
                        if (p.t) dot.style.top = p.t;
                        if (p.b) dot.style.bottom = p.b;
                        if (p.l) dot.style.left = p.l;
                        if (p.r) dot.style.right = p.r;
                        if (p.c) { dot.style.left = '50%'; dot.style.transform = 'translateX(-50%)'; }
                        screen.appendChild(dot);
                    });
                    body.appendChild(screen);
                    bullets(body, [
                        'Pick a corner or edge in the Position settings. The highlighted dot is the default.',
                        'Enable dragging in Behavior, then drag the floating button to any spot.',
                        'Saving a preset position clears any custom drag position.'
                    ]);
                }
            },
            {
                icon: '🎨',
                title: 'Appearance',
                buildContent: (body) => {
                    lead(body, 'Control how the toolbar looks with a theme color and a set of size sliders.');
                    body.appendChild(span('Themes', { fontSize: '11px', color: '#667eea', fontWeight: 'bold', display: 'block', margin: '0 0 6px 0' }));
                    const themes = [
                        ['Purple', PURPLE_GRAD],
                        ['Blue',   'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'],
                        ['Green',  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'],
                        ['Orange', 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'],
                        ['Dark',   'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)']
                    ];
                    const swatches = themes.map(([name, grad]) => {
                        const col = document.createElement('div');
                        Object.assign(col.style, { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });
                        const sw = document.createElement('div');
                        Object.assign(sw.style, { width: '34px', height: '34px', borderRadius: '8px', background: grad });
                        col.appendChild(sw);
                        col.appendChild(span(name, { fontSize: '10px', color: '#666' }));
                        return col;
                    });
                    body.appendChild(hrow(swatches, { margin: '0 0 4px 0' }));
                    caption(body, 'The theme sets the gradient color of the floating button.');
                    bullets(body, [
                        'Compact mode shrinks the whole toolbar at once.',
                        'Animation speed controls how fast the menu opens and closes.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Settings and Data',
                buildContent: (body) => {
                    lead(body, 'The gear opens this window. These controls live in the Behavior and Data sections.');
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
                        wrap.appendChild(hrow([ box, span(label, { fontSize: '12px', color: '#444', fontWeight: 'bold' }) ], { margin: '0' }));
                        wrap.appendChild(span(desc, { fontSize: '11px', color: '#777', display: 'block', margin: '2px 0 0 25px' }));
                        return wrap;
                    }
                    body.appendChild(toggle('Auto close menu after clicking a tool', true, 'Hides the menu as soon as you run a tool.'));
                    body.appendChild(toggle('Show tooltips on hover', true, 'Shows each tool name when you point at its icon.'));
                    body.appendChild(toggle('Keep menu pinned open', false, 'Leaves the menu open so outside clicks do not close it.'));

                    body.appendChild(hrow([
                        chip('Export Settings', '#f3f4f6', { color: '#374151' }),
                        chip('Import Settings', '#f3f4f6', { color: '#374151' }),
                        chip('Reset to Default', '#ef4444')
                    ], { margin: '10px 0 0 0' }));
                    caption(body, 'Export and Import move your settings between browsers. Reset restores the defaults.');
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'toolbarHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'toolbarHelpModal';

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
        Object.assign(titleMain.style, {
            fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif'
        });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Tools Toolbar Suite v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, {
            fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif'
        });
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

        // Section cards
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden'
            });

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
            Object.assign(titleLabel.style, {
                fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif'
            });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);

            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block'
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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontSize: '14px', fontFamily: 'Arial, sans-serif'
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
     *  SETTINGS DEFAULTS AND MANAGEMENT
     * ==========================================================*/

    const DEFAULT_SETTINGS = {
        'toolbar-position': 'bottom-right',
        'toolbar-theme': 'purple',
        'compact-mode': false,
        'auto-close': true,
        'show-tooltips': true,
        'toolbar-opacity': 100,
        'button-size': 36,
        'tool-size': 32,
        'animation-speed': 0.3,
        'menu-gap': 8,
        'toolbar-pinned': false,
        'toolbar-draggable': false,
        'show-labels': false,
        'label-position': 'top'
    };

    function getSetting(key) {
        return GM_getValue(key, DEFAULT_SETTINGS[key]);
    }

    function setSetting(key, value) {
        GM_setValue(key, value);
    }

    /* ==========================================================
     *  TOOL REGISTRY AND PIN MANAGEMENT
     * ==========================================================*/

    const toolRegistry = new Map(); // id -> config

    function loadPinnedConfig() {
        try { return JSON.parse(GM_getValue('toolbar-pinned-tools', '[]')); }
        catch (e) { return []; }
    }

    function savePinnedConfig(arr) {
        GM_setValue('toolbar-pinned-tools', JSON.stringify(arr));
    }

    let _rerenderTimer = null;

    function scheduleRerender() {
        clearTimeout(_rerenderTimer);
        _rerenderTimer = setTimeout(rerenderMenu, 500);
    }

    function rerenderMenu() {
        const menu = document.getElementById('custom-toolbar-menu');
        if (!menu) return;

        const settingsEl = menu.querySelector('[data-tool="settings"]');

        const pinnedConfig  = loadPinnedConfig();
        const pinnedIds     = pinnedConfig.map(p => p.id);
        const leftPinned    = pinnedConfig.filter(p => p.side === 'left');
        const rightPinned   = pinnedConfig.filter(p => p.side === 'right');
        const allPinnedSet  = new Set(pinnedIds);

        const showLabels    = getSetting('show-labels');
        const labelPosition = getSetting('label-position');

        function buildToolEl(config) {
            const el = document.createElement('div');
            el.className = 'toolbar-item' + (showLabels ? ' has-label' : '');
            el.setAttribute('data-tool', config.id);
            if (config.position !== undefined && config.position !== null) {
                el.setAttribute('data-position', config.position);
            }

            const tmp = document.createElement('div');
            tmp.innerHTML = config.icon;
            const svgEl = tmp.firstElementChild;

            const tooltip = document.createElement('div');
            tooltip.className = 'toolbar-item-tooltip';
            tooltip.textContent = config.tooltip;

            if (showLabels) {
                const iconWell = document.createElement('div');
                iconWell.className = 'toolbar-item-icon-well';
                iconWell.appendChild(svgEl);

                const label = document.createElement('div');
                label.className = 'toolbar-item-label';
                label.textContent = config.tooltip;

                if (labelPosition === 'top') {
                    el.appendChild(label);
                    el.appendChild(iconWell);
                } else {
                    el.appendChild(iconWell);
                    el.appendChild(label);
                }
            } else {
                el.appendChild(svgEl);
            }
            el.appendChild(tooltip);

            el.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!menu.classList.contains('pinned-open')) menu.classList.remove('active');
                document.dispatchEvent(new CustomEvent('toolbarToolClicked', { detail: { id: config.id } }));
            });

            return el;
        }

        function makeSep() {
            const sep = document.createElement('div');
            sep.className = 'toolbar-separator';
            return sep;
        }

        // Clear everything except the settings cog
        while (menu.firstChild) menu.removeChild(menu.firstChild);

        const leftEls = leftPinned
            .filter(p => toolRegistry.has(p.id))
            .map(p => buildToolEl(toolRegistry.get(p.id)));

        const regularEls = Array.from(toolRegistry.values())
            .filter(c => !allPinnedSet.has(c.id))
            .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
            .map(buildToolEl);

        const rightEls = rightPinned
            .filter(p => toolRegistry.has(p.id))
            .map(p => buildToolEl(toolRegistry.get(p.id)));

        const hasLeft    = leftEls.length > 0;
        const hasRegular = regularEls.length > 0;
        const hasRight   = rightEls.length > 0;
        const hasAny     = hasLeft || hasRegular || hasRight;

        leftEls.forEach(el => menu.appendChild(el));
        if (hasLeft && (hasRegular || hasRight)) menu.appendChild(makeSep());
        regularEls.forEach(el => menu.appendChild(el));
        if (hasRight && (hasLeft || hasRegular)) menu.appendChild(makeSep());
        rightEls.forEach(el => menu.appendChild(el));
        if (hasAny) menu.appendChild(makeSep());

        if (settingsEl) menu.appendChild(settingsEl);
    }

    /* ==========================================================
     *  POSITION HELPER FUNCTIONS
     * ==========================================================*/

    function getPositionStyles(position) {
        const styles = { container: '', menu: '' };

        switch(position) {
            case 'top-center':
                styles.container = 'top: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'top: calc(100% + 10px); left: 50%; transform: translateX(-50%);';
                break;
            case 'top-left':
                styles.container = 'top: 10px; left: 20px;';
                styles.menu = 'top: calc(100% + 10px); left: 0; transform: none;';
                break;
            case 'top-right':
                styles.container = 'top: 10px; right: 20px;';
                styles.menu = 'top: calc(100% + 10px); right: 0; left: auto; transform: none;';
                break;
            case 'bottom-center':
                styles.container = 'bottom: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; left: 50%; transform: translateX(-50%);';
                break;
            case 'bottom-left':
                styles.container = 'bottom: 10px; left: 20px;';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; left: 0; transform: none;';
                break;
            case 'bottom-right':
                styles.container = 'bottom: 10px; right: 20px;';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; right: 0; left: auto; transform: none;';
                break;
            default:
                styles.container = 'top: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'top: calc(100% + 10px); left: 50%; transform: translateX(-50%);';
        }

        return styles;
    }

    function getAnimationKeyframes(position, speed) {
        const isBottom = position.includes('bottom');
        const isCenter = position.includes('center');

        if (isBottom) {
            return `
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(0);
                    }
                }
            `;
        } else {
            return `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(0);
                    }
                }
            `;
        }
    }

    /* ==========================================================
     *  INITIAL STYLES WITH SAVED SETTINGS
     * ==========================================================*/

    const savedPosition = getSetting('toolbar-position');
    const savedTheme = getSetting('toolbar-theme');
    const savedCompactMode = getSetting('compact-mode');
    const savedOpacity = getSetting('toolbar-opacity');
    const savedButtonSize = getSetting('button-size');
    const savedToolSize = getSetting('tool-size');
    const savedAnimationSpeed = getSetting('animation-speed');
    const savedMenuGap = getSetting('menu-gap');

    const positionStyles = getPositionStyles(savedPosition);
    const isBottom = savedPosition.includes('bottom');
    const animationName = isBottom ? 'slideUp' : 'slideDown';

    // Theme colors
    const themeColors = {
        purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        blue: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        green: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        orange: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        dark: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
    };

    const selectedTheme = themeColors[savedTheme] || themeColors.purple;
    const tooltipPosition = isBottom ? 'top: -28px; bottom: auto;' : 'bottom: -28px; top: auto;';
    const opacityValue = savedOpacity / 100;

    // Add custom styles with saved settings
    GM_addStyle(`
        ${getAnimationKeyframes(savedPosition, savedAnimationSpeed)}

        .hidden {
            display: none !important;
        }

        #custom-toolbar-container {
            position: fixed;
            ${positionStyles.container}
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            opacity: ${opacityValue};
            transition: opacity 0.3s ease;
            ${savedCompactMode ? 'transform: ' + (positionStyles.container.includes('transform') ? positionStyles.container.match(/transform: ([^;]+)/)[1] + ' scale(0.85)' : 'scale(0.85)') + ';' : ''}
        }

        #custom-toolbar-toggle {
            width: ${savedButtonSize}px;
            height: ${savedButtonSize}px;
            border-radius: 8px;
            background: ${selectedTheme};
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            position: relative;
        }

        #custom-toolbar-toggle:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        #custom-toolbar-toggle svg {
            width: ${savedButtonSize * 0.45}px;
            height: ${savedButtonSize * 0.45}px;
            fill: white;
        }

        #custom-toolbar-menu {
            position: absolute;
            ${positionStyles.menu}
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            padding: 8px 12px;
            display: none;
            flex-direction: row;
            gap: ${savedMenuGap}px;
            align-items: center;
            white-space: nowrap;
            animation: ${animationName} ${savedAnimationSpeed}s ease;
        }

        #custom-toolbar-menu.active {
            display: flex;
        }

        .toolbar-item {
            width: ${savedToolSize}px;
            height: ${savedToolSize}px;
            border-radius: 8px;
            background: #f3f4f6;
            border: 2px solid transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            position: relative;
        }

        .toolbar-item:hover {
            background: #e5e7eb;
            border-color: #667eea;
            transform: translateY(-2px);
        }

        .toolbar-item svg {
            width: ${savedToolSize * 0.56}px;
            height: ${savedToolSize * 0.56}px;
            fill: #374151;
        }

        .toolbar-item:hover svg {
            fill: #667eea;
        }

        .toolbar-item-tooltip {
            position: absolute;
            ${tooltipPosition}
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: #ffffff !important;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            ${getSetting('show-tooltips') ? '' : 'display: none;'}
        }

        .toolbar-item:hover .toolbar-item-tooltip {
            opacity: 1;
        }

        .toolbar-separator {
            width: 1px;
            height: 24px;
            background: #e5e7eb;
        }

        /* Z-INDEX HIERARCHY
         * Settings Modal: 9999999
         * Changelog Overlay: 1000000
         * Changelog Modal: 1000001
         */

        /* Changelog Notification Styles */
        #toolbarChangelogNotification {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }

        #toolbarChangelogNotification:hover {
            background-color: #d0d0d0 !important;
        }

        #toolbarChangelogNotification .toolbar-notification-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: toolbarColorPulse 1s ease-in-out infinite !important;
        }

        @keyframes toolbarColorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #toolbarChangelogNotification .toolbar-notification-text {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* Changelog Modal Styles */
        #toolbarChangelogModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 100000012 !important;
            background: #ffffff !important;
            border: 2px solid #333333 !important;
            padding: 20px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            font-family: Arial, sans-serif !important;
            border-radius: 10px !important;
            max-width: 600px !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            color: #333333 !important;
        }

        #toolbarChangelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.5em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }

        #toolbarChangelogModal .toolbar-version-info {
            background-color: #f8f9fa !important;
            color: #333333 !important;
            padding: 10px !important;
            border-radius: 5px !important;
            margin-bottom: 15px !important;
            border-left: 4px solid #667eea !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            font-weight: normal !important;
        }

        #toolbarChangelogModal .toolbar-changelog-content {
            white-space: pre-wrap !important;
            line-height: 1.6 !important;
            color: #333333 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            font-weight: normal !important;
            background-color: #fafafa !important;
            padding: 10px !important;
            border-radius: 5px !important;
        }

        #toolbarChangelogModal .toolbar-close-changelog {
            margin-top: 15px !important;
            padding: 10px 20px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            width: 100% !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
        }

        #toolbarChangelogModal .toolbar-close-changelog:hover {
            background-color: #5568d3 !important;
        }

        #toolbarChangelogOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 100000011 !important;
        }

        /* Help / Feature Guide Modal Styles */
        #toolbarHelpModalOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 100000021 !important;
        }

        #toolbarHelpModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 100000022 !important;
            background: #ffffff !important;
            border: 2px solid #333333 !important;
            padding: 20px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            font-family: Arial, sans-serif !important;
            border-radius: 10px !important;
            width: 640px !important;
            max-width: 92vw !important;
            max-height: 82vh !important;
            overflow-y: auto !important;
            color: #333333 !important;
        }

        #toolbarHelpModal input,
        #toolbarHelpModal select,
        #toolbarHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }

        /* Help pill button in the settings header */
        .settings-header-right {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        }

        #toolbar-help-btn {
            color: #667eea !important;
            cursor: pointer !important;
            font-size: 12px !important;
            display: inline-flex !important;
            align-items: center !important;
            padding: 4px 10px !important;
            border-radius: 4px !important;
            border: 1px solid #c0c8f0 !important;
            font-weight: bold !important;
            user-select: none !important;
            background-color: transparent !important;
            transition: background-color 0.2s ease !important;
            font-family: Arial, sans-serif !important;
        }

        #toolbar-help-btn:hover {
            background-color: #eef0ff !important;
        }

        /* Settings Modal Styles */
        #toolbar-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999999;
            display: none;
            align-items: center;
            justify-content: center;
        }

        #toolbar-settings-modal.visible {
            display: flex;
        }

        .settings-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
        }

        .settings-content {
            position: relative;
            background: #ffffff !important;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            animation: modalSlideIn 0.3s ease;
            will-change: transform;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
        }

        .settings-header h2 {
            margin: 0 !important;
            font-size: 20px !important;
            font-weight: 600 !important;
            color: #1f2937 !important;
        }

        .settings-close {
            background: none !important;
            border: none !important;
            font-size: 28px !important;
            cursor: pointer !important;
            color: #6b7280 !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            transition: all 0.2s !important;
        }

        .settings-close:hover {
            background: #f3f4f6 !important;
            color: #1f2937 !important;
        }

        .settings-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .settings-section {
            margin-bottom: 24px;
        }

        .settings-section:last-child {
            margin-bottom: 0;
        }

        .settings-section h3 {
            margin: 0 0 12px 0 !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        .setting-item {
            margin-bottom: 16px;
        }

        .setting-item:last-child {
            margin-bottom: 0;
        }

        .setting-item label {
            display: block !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #374151 !important;
            margin-bottom: 6px !important;
        }

        .setting-item input[type="text"],
        .setting-item input[type="number"],
        .setting-item select {
            width: 100% !important;
            padding: 8px 12px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            transition: all 0.2s !important;
            background: #ffffff !important;
            color: #1f2937 !important;
        }

        .setting-item input[type="text"]:focus,
        .setting-item input[type="number"]:focus,
        .setting-item select:focus {
            outline: none !important;
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }

        .setting-item input[type="checkbox"] {
            margin-right: 8px !important;
        }

        .setting-item input[type="range"] {
            width: 100% !important;
            margin: 8px 0 !important;
        }

        .range-value {
            display: inline-block !important;
            min-width: 50px !important;
            text-align: right !important;
            font-weight: 600 !important;
            color: #667eea !important;
            margin-left: 10px !important;
        }

        .tools-list {
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            padding: 12px !important;
            max-height: 150px !important;
            overflow-y: auto !important;
            background: #f9fafb !important;
        }

        .tool-item {
            display: flex !important;
            align-items: center !important;
            padding: 6px 0 !important;
            color: #1f2937 !important;
        }

        .tool-item input[type="checkbox"] {
            margin-right: 8px !important;
        }

        .tool-item span {
            color: #1f2937 !important;
        }

        .settings-footer {
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
            padding: 8px 16px !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            border: none !important;
        }

        .btn-primary {
            background: #667eea !important;
            color: #ffffff !important;
        }

        .btn-primary:hover {
            background: #5568d3 !important;
        }

        .btn-secondary {
            background: #f3f4f6 !important;
            color: #374151 !important;
        }

        .btn-secondary:hover {
            background: #e5e7eb !important;
        }

        .btn-danger {
            background: #ef4444 !important;
            color: #ffffff !important;
        }

        .btn-danger:hover {
            background: #dc2626 !important;
        }

        .version-section {
            background: #f8f9fa !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin-bottom: 20px !important;
            border-left: 4px solid #667eea !important;
        }

        .version-info-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .version-display {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .version-label {
            font-weight: 600 !important;
            color: #374151 !important;
            font-size: 14px !important;
        }

        .setting-help-text {
            font-size: 12px !important;
            color: #6b7280 !important;
            margin-top: 4px !important;
            font-style: italic !important;
        }

        /* Drag styles */
        #custom-toolbar-toggle-wrap {
            position: relative;
            display: inline-flex;
            cursor: pointer;
        }

        #custom-toolbar-toggle-wrap.drag-enabled {
            cursor: grab;
        }

        #custom-toolbar-toggle-wrap.drag-enabled.dragging {
            cursor: grabbing;
            user-select: none;
        }

        /* Tool labels */
        .toolbar-item.has-label {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            height: auto !important;
            width: auto !important;
            min-width: ${savedToolSize}px !important;
            padding: 2px 6px !important;
            background: transparent !important;
            border-color: transparent !important;
        }

        .toolbar-item.has-label:hover {
            background: transparent !important;
            border-color: transparent !important;
        }

        .toolbar-item-icon-well {
            width: ${savedToolSize}px !important;
            height: ${savedToolSize}px !important;
            border-radius: 8px !important;
            background: #f3f4f6 !important;
            border: 2px solid transparent !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
        }

        .toolbar-item.has-label:hover .toolbar-item-icon-well {
            background: #e5e7eb !important;
            border-color: #667eea !important;
        }

        .toolbar-item.has-label:hover .toolbar-item-icon-well svg {
            fill: #667eea !important;
        }

        .toolbar-item-label {
            font-size: 10px !important;
            text-align: center !important;
            white-space: nowrap !important;
            pointer-events: none !important;
            color: #6b7280 !important;
            line-height: 1.1 !important;
        }

        .toolbar-item.has-label:hover .toolbar-item-label {
            color: #667eea !important;
        }

        /* Pinned tools rows in settings */
        .pin-tool-row {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 5px 2px !important;
            border-bottom: 1px solid #f0f0f0 !important;
        }

        .pin-tool-row:last-child {
            border-bottom: none !important;
        }

        .pin-tool-row .pin-name {
            flex: 1 !important;
            font-size: 13px !important;
            color: #1f2937 !important;
        }

        .pin-tool-row .pin-side-select,
        .pin-tool-row .pin-reorder-btn {
            display: none !important;
        }

        .pin-tool-row.is-pinned .pin-side-select,
        .pin-tool-row.is-pinned .pin-reorder-btn {
            display: inline-block !important;
        }

        .pin-side-select {
            font-size: 12px !important;
            padding: 2px 4px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            background: #ffffff !important;
            color: #1f2937 !important;
        }

        .pin-reorder-btn {
            background: none !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            padding: 1px 5px !important;
            color: #374151 !important;
            line-height: 1.4 !important;
        }

        .pin-reorder-btn:hover {
            background: #e5e7eb !important;
        }
    `);

    // Create toolbar HTML
    const toolbarHTML = `
        <div id="custom-toolbar-container" data-toolbar-v2="true">
            <div id="custom-toolbar-toggle-wrap">
                <button id="custom-toolbar-toggle" title="Toggle Toolbar">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                    </svg>
                </button>
            </div>
            <div id="custom-toolbar-menu">
                <!-- Settings -->
                <div class="toolbar-item" data-tool="settings">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    <div class="toolbar-item-tooltip">Settings</div>
                </div>
            </div>
        </div>
    `;

    /* ==========================================================
     *  TOOLBAR CORE: bootstrap and event wiring
     * ==========================================================*/

    function initToolbar() {
        if (document.getElementById('custom-toolbar-container')) {
            return;
        }

        if (!document.body) {
            setTimeout(initToolbar, 50);
            return;
        }

        const container = document.createElement('div');
        container.innerHTML = toolbarHTML;
        const toolbarElement = container.firstElementChild;
        document.body.appendChild(toolbarElement);

        // Restore saved drag position (inline styles override CSS preset)
        const savedDragLeft = GM_getValue('toolbar-custom-left', null);
        const savedDragTop  = GM_getValue('toolbar-custom-top',  null);
        if (savedDragLeft !== null && savedDragTop !== null) {
            toolbarElement.style.left      = savedDragLeft + 'px';
            toolbarElement.style.top       = savedDragTop  + 'px';
            toolbarElement.style.right     = 'auto';
            toolbarElement.style.bottom    = 'auto';
            toolbarElement.style.transform = 'none';
        }

        // Suite marker: signals to other scripts that the suite is active
        if (!document.getElementById('custom-toolbar-suite-marker')) {
            const marker = document.createElement('div');
            marker.id = 'custom-toolbar-suite-marker';
            marker.style.display = 'none';
            document.body.appendChild(marker);
        }

        setupEventListeners();

        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('toolbarReady'));
        }, 100);
    }

    function setupEventListeners() {
        const toggleWrap   = document.getElementById('custom-toolbar-toggle-wrap');
        const toggleButton = document.getElementById('custom-toolbar-toggle');
        const menu         = document.getElementById('custom-toolbar-menu');
        const tbContainer  = document.getElementById('custom-toolbar-container');

        if (!toggleButton || !menu) {
            return;
        }

        // Restore pin state
        if (getSetting('toolbar-pinned')) {
            menu.classList.add('active', 'pinned-open');
        }

        // Drag logic (only when enabled in settings)
        let isDragging = false;
        let didDrag    = false;

        if (getSetting('toolbar-draggable')) {
            if (toggleWrap) toggleWrap.classList.add('drag-enabled');

            let dragOffX = 0;
            let dragOffY = 0;
            const dragHandle = toggleWrap || toggleButton;

            dragHandle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                const rect = tbContainer.getBoundingClientRect();
                dragOffX   = e.clientX - rect.left;
                dragOffY   = e.clientY - rect.top;
                isDragging = true;
                didDrag    = false;
                if (toggleWrap) toggleWrap.classList.add('dragging');
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                didDrag      = true;
                const newLeft = Math.max(0, Math.min(window.innerWidth  - tbContainer.offsetWidth,  e.clientX - dragOffX));
                const newTop  = Math.max(0, Math.min(window.innerHeight - tbContainer.offsetHeight, e.clientY - dragOffY));
                tbContainer.style.left      = newLeft + 'px';
                tbContainer.style.top       = newTop  + 'px';
                tbContainer.style.right     = 'auto';
                tbContainer.style.bottom    = 'auto';
                tbContainer.style.transform = 'none';
            });

            document.addEventListener('mouseup', function() {
                if (!isDragging) return;
                isDragging = false;
                if (toggleWrap) toggleWrap.classList.remove('dragging');
                if (didDrag) {
                    GM_setValue('toolbar-custom-left', Math.round(parseFloat(tbContainer.style.left)));
                    GM_setValue('toolbar-custom-top',  Math.round(parseFloat(tbContainer.style.top)));
                }
            });
        }

        // Toggle click
        toggleButton.addEventListener('click', function(e) {
            e.stopPropagation();
            if (didDrag) { didDrag = false; return; }
            if (menu.classList.contains('pinned-open')) return;
            menu.classList.toggle('active');
        });

        // Close on outside click (respects pin)
        document.addEventListener('click', function(e) {
            if (!(e.target instanceof Element)) return;
            if (!e.target.closest('#custom-toolbar-container')) {
                if (!menu.classList.contains('pinned-open')) {
                    menu.classList.remove('active');
                }
            }
        });

        // Settings button
        const settingsBtn = menu.querySelector('[data-tool="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!menu.classList.contains('pinned-open')) menu.classList.remove('active');
                showSettings();
            });
        }
    }

    /* ==========================================================
     *  SETTINGS MODAL
     * ==========================================================*/

    function showSettings() {
        const existingModal = document.getElementById('toolbar-settings-modal');
        if (existingModal) {
            existingModal.classList.add('visible');
            const showChangelog = isNewVersion() && !hasSeenChangelog();
            const changelogNotification = document.getElementById('toolbarChangelogNotification');
            if (changelogNotification) {
                if (showChangelog) {
                    changelogNotification.classList.remove('hidden');
                } else {
                    changelogNotification.classList.add('hidden');
                }
            }
            populatePinnedToolsList();
            return;
        }

        const modalHTML = `
            <div id="toolbar-settings-modal" class="visible">
                <div class="settings-overlay"></div>
                <div class="settings-content">
                    <div class="settings-header">
                        <h2>Toolbar Suite Settings</h2>
                        <div class="settings-header-right">
                            <span id="toolbar-help-btn" title="View feature guide and documentation">? Help</span>
                            <button class="settings-close">&times;</button>
                        </div>
                    </div>

                    <div class="settings-body">
                        <!-- Version Info -->
                        <div class="settings-section version-section">
                            <div class="version-info-container">
                                <div class="version-display">
                                    <span class="version-label">Current Version: ${SCRIPT_VERSION}</span>
                                    <span id="toolbarChangelogNotification" class="hidden">
                                        <span class="toolbar-notification-dot"></span>
                                        <span class="toolbar-notification-text">What's New</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Position Settings -->
                        <div class="settings-section">
                            <h3>Position</h3>
                            <div class="setting-item">
                                <label>Toolbar Position:</label>
                                <select id="toolbar-position">
                                    <option value="top-center">Top Center</option>
                                    <option value="top-left">Top Left</option>
                                    <option value="top-right">Top Right</option>
                                    <option value="bottom-center">Bottom Center</option>
                                    <option value="bottom-left">Bottom Left</option>
                                    <option value="bottom-right">Bottom Right</option>
                                </select>
                                <div class="setting-help-text">Saving a preset position clears any custom drag position.</div>
                            </div>
                            <div class="setting-item">
                                <button id="reset-drag-position" class="btn-secondary">Reset Drag Position</button>
                                <div class="setting-help-text">Clears the saved drag position and returns to the preset above.</div>
                            </div>
                        </div>

                        <!-- Appearance -->
                        <div class="settings-section">
                            <h3>Appearance</h3>

                            <div class="setting-item">
                                <label>Theme:</label>
                                <select id="toolbar-theme">
                                    <option value="purple">Purple (Default)</option>
                                    <option value="blue">Blue</option>
                                    <option value="green">Green</option>
                                    <option value="orange">Orange</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </div>

                            <div class="setting-item">
                                <label>Toolbar Opacity: <span class="range-value" id="opacity-value">100%</span></label>
                                <input type="range" id="toolbar-opacity" min="10" max="100" step="5" value="100">
                                <div class="setting-help-text">Adjust transparency of the toolbar</div>
                            </div>

                            <div class="setting-item">
                                <label>Toolbar Button Size: <span class="range-value" id="button-size-value">36px</span></label>
                                <input type="range" id="button-size" min="28" max="48" step="2" value="36">
                                <div class="setting-help-text">Size of the main toolbar button</div>
                            </div>

                            <div class="setting-item">
                                <label>Tool Icon Size: <span class="range-value" id="tool-size-value">32px</span></label>
                                <input type="range" id="tool-size" min="24" max="40" step="2" value="32">
                                <div class="setting-help-text">Size of the tool icons in the menu</div>
                            </div>

                            <div class="setting-item">
                                <label>Menu Gap: <span class="range-value" id="menu-gap-value">8px</span></label>
                                <input type="range" id="menu-gap" min="4" max="16" step="2" value="8">
                                <div class="setting-help-text">Spacing between tool icons</div>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="compact-mode" />
                                    Compact Mode (Smaller overall size)
                                </label>
                            </div>
                        </div>

                        <!-- Animation -->
                        <div class="settings-section">
                            <h3>Animation</h3>

                            <div class="setting-item">
                                <label>Animation Speed: <span class="range-value" id="animation-speed-value">0.3s</span></label>
                                <input type="range" id="animation-speed" min="0.1" max="1.0" step="0.1" value="0.3">
                                <div class="setting-help-text">Speed of menu open/close animation</div>
                            </div>
                        </div>

                        <!-- Behavior -->
                        <div class="settings-section">
                            <h3>Behavior</h3>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="auto-close" checked />
                                    Auto-close menu after clicking tool
                                </label>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="show-tooltips" checked />
                                    Show tooltips on hover
                                </label>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="toolbar-pinned" />
                                    Keep menu pinned open
                                </label>
                                <div class="setting-help-text">Menu stays visible at all times and cannot be closed by clicking outside</div>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="toolbar-draggable" />
                                    Enable toolbar dragging
                                </label>
                                <div class="setting-help-text">Allows repositioning the toolbar by dragging the toggle button</div>
                            </div>
                        </div>

                        <!-- Pinned Tools -->
                        <div class="settings-section">
                            <h3>Pinned Tools</h3>
                            <p class="setting-help-text">Pin tools for quick access. Choose Left or Right side and use arrows to reorder within the pinned group.</p>
                            <div class="tools-list" style="max-height: 220px;" id="pinned-tools-list"></div>
                        </div>

                        <!-- Tool Labels -->
                        <div class="settings-section">
                            <h3>Tool Labels</h3>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="show-labels" />
                                    Show permanent labels on tool icons
                                </label>
                                <div class="setting-help-text">Displays the tool name directly on each icon without needing to hover</div>
                            </div>
                            <div class="setting-item" id="label-position-row" style="display:none;">
                                <label>Label position:</label>
                                <select id="label-position">
                                    <option value="top">Top</option>
                                    <option value="bottom">Bottom</option>
                                </select>
                            </div>
                        </div>

                        <!-- Data -->
                        <div class="settings-section">
                            <h3>Data</h3>
                            <div class="setting-item">
                                <button id="export-settings" class="btn-secondary">Export Settings</button>
                                <button id="import-settings" class="btn-secondary">Import Settings</button>
                                <button id="reset-settings" class="btn-danger">Reset to Default</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-footer">
                        <button id="save-settings" class="btn-primary">Save Changes</button>
                        <button id="cancel-settings" class="btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        loadSettings();
        setupSettingsEventListeners();

        const showChangelog = isNewVersion() && !hasSeenChangelog();
        const changelogNotification = document.getElementById('toolbarChangelogNotification');

        if (showChangelog && changelogNotification) {
            changelogNotification.classList.remove('hidden');
            changelogNotification.onclick = () => {
                showChangelogModal();
            };
        }

        populatePinnedToolsList();
    }

    function setupSettingsEventListeners() {
        const modal = document.getElementById('toolbar-settings-modal');
        const closeBtn = modal.querySelector('.settings-close');
        const cancelBtn = document.getElementById('cancel-settings');
        const saveBtn = document.getElementById('save-settings');
        const overlay = modal.querySelector('.settings-overlay');

        closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
        cancelBtn.addEventListener('click', () => modal.classList.remove('visible'));
        overlay.addEventListener('click', () => modal.classList.remove('visible'));

        saveBtn.addEventListener('click', () => {
            saveSettings();
            modal.classList.remove('visible');
            location.reload();
        });

        // Range input live updates
        const opacityInput = document.getElementById('toolbar-opacity');
        const opacityValueEl = document.getElementById('opacity-value');
        opacityInput.addEventListener('input', () => {
            opacityValueEl.textContent = opacityInput.value + '%';
        });

        const buttonSizeInput = document.getElementById('button-size');
        const buttonSizeValue = document.getElementById('button-size-value');
        buttonSizeInput.addEventListener('input', () => {
            buttonSizeValue.textContent = buttonSizeInput.value + 'px';
        });

        const toolSizeInput = document.getElementById('tool-size');
        const toolSizeValue = document.getElementById('tool-size-value');
        toolSizeInput.addEventListener('input', () => {
            toolSizeValue.textContent = toolSizeInput.value + 'px';
        });

        const animationSpeedInput = document.getElementById('animation-speed');
        const animationSpeedValue = document.getElementById('animation-speed-value');
        animationSpeedInput.addEventListener('input', () => {
            animationSpeedValue.textContent = animationSpeedInput.value + 's';
        });

        const menuGapInput = document.getElementById('menu-gap');
        const menuGapValue = document.getElementById('menu-gap-value');
        menuGapInput.addEventListener('input', () => {
            menuGapValue.textContent = menuGapInput.value + 'px';
        });

        document.getElementById('export-settings').addEventListener('click', exportSettings);
        document.getElementById('import-settings').addEventListener('click', importSettings);
        document.getElementById('reset-settings').addEventListener('click', resetSettings);

        const showLabelsEl   = document.getElementById('show-labels');
        const labelPosRow    = document.getElementById('label-position-row');
        if (showLabelsEl && labelPosRow) {
            showLabelsEl.addEventListener('change', () => {
                labelPosRow.style.display = showLabelsEl.checked ? '' : 'none';
            });
        }

        const resetDragBtn = document.getElementById('reset-drag-position');
        if (resetDragBtn) {
            resetDragBtn.addEventListener('click', () => {
                GM_deleteValue('toolbar-custom-left');
                GM_deleteValue('toolbar-custom-top');
                alert('✅ Drag position cleared! The page will reload.');
                location.reload();
            });
        }

        const helpBtn = document.getElementById('toolbar-help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', showHelpModal);
        }
    }

    function loadSettings() {
        document.getElementById('toolbar-position').value = getSetting('toolbar-position');
        document.getElementById('toolbar-theme').value = getSetting('toolbar-theme');
        document.getElementById('compact-mode').checked = getSetting('compact-mode');
        document.getElementById('auto-close').checked = getSetting('auto-close');
        document.getElementById('show-tooltips').checked = getSetting('show-tooltips');
        document.getElementById('toolbar-pinned').checked = getSetting('toolbar-pinned');
        document.getElementById('toolbar-draggable').checked = getSetting('toolbar-draggable');

        const opacityInput = document.getElementById('toolbar-opacity');
        opacityInput.value = getSetting('toolbar-opacity');
        document.getElementById('opacity-value').textContent = opacityInput.value + '%';

        const buttonSizeInput = document.getElementById('button-size');
        buttonSizeInput.value = getSetting('button-size');
        document.getElementById('button-size-value').textContent = buttonSizeInput.value + 'px';

        const toolSizeInput = document.getElementById('tool-size');
        toolSizeInput.value = getSetting('tool-size');
        document.getElementById('tool-size-value').textContent = toolSizeInput.value + 'px';

        const animationSpeedInput = document.getElementById('animation-speed');
        animationSpeedInput.value = getSetting('animation-speed');
        document.getElementById('animation-speed-value').textContent = animationSpeedInput.value + 's';

        const menuGapInput = document.getElementById('menu-gap');
        menuGapInput.value = getSetting('menu-gap');
        document.getElementById('menu-gap-value').textContent = menuGapInput.value + 'px';

        const showLabelsEl = document.getElementById('show-labels');
        if (showLabelsEl) showLabelsEl.checked = getSetting('show-labels');

        const labelPositionEl = document.getElementById('label-position');
        if (labelPositionEl) labelPositionEl.value = getSetting('label-position');

        const labelPositionRow = document.getElementById('label-position-row');
        if (labelPositionRow) labelPositionRow.style.display = getSetting('show-labels') ? '' : 'none';
    }

    function saveSettings() {
        setSetting('toolbar-position', document.getElementById('toolbar-position').value);
        setSetting('toolbar-theme', document.getElementById('toolbar-theme').value);
        setSetting('compact-mode', document.getElementById('compact-mode').checked);
        setSetting('auto-close', document.getElementById('auto-close').checked);
        setSetting('show-tooltips', document.getElementById('show-tooltips').checked);
        setSetting('toolbar-opacity', parseInt(document.getElementById('toolbar-opacity').value));
        setSetting('button-size', parseInt(document.getElementById('button-size').value));
        setSetting('tool-size', parseInt(document.getElementById('tool-size').value));
        setSetting('animation-speed', parseFloat(document.getElementById('animation-speed').value));
        setSetting('menu-gap', parseInt(document.getElementById('menu-gap').value));
        setSetting('toolbar-pinned', document.getElementById('toolbar-pinned').checked);
        setSetting('toolbar-draggable', document.getElementById('toolbar-draggable').checked);
        setSetting('show-labels', document.getElementById('show-labels').checked);
        setSetting('label-position', document.getElementById('label-position').value);

        const pinnedRows = Array.from(document.querySelectorAll('#pinned-tools-list .pin-tool-row.is-pinned'));
        savePinnedConfig(pinnedRows.map(row => ({
            id: row.dataset.toolId,
            side: row.querySelector('.pin-side-select').value
        })));

        // Saving a preset position clears any custom drag position
        GM_deleteValue('toolbar-custom-left');
        GM_deleteValue('toolbar-custom-top');

        alert('✅ Settings saved! The page will reload to apply changes.');
    }

    function populatePinnedToolsList() {
        const container = document.getElementById('pinned-tools-list');
        if (!container) return;

        if (toolRegistry.size === 0) {
            container.innerHTML = '<p style="color: #6b7280; font-size: 13px;">No tools installed yet.</p>';
            return;
        }

        const pinnedConfig = loadPinnedConfig();
        const pinnedMap    = new Map(pinnedConfig.map(p => [p.id, p.side]));

        const pinnedTools   = pinnedConfig
            .filter(p => toolRegistry.has(p.id))
            .map(p => ({ config: toolRegistry.get(p.id), side: p.side }));

        const unpinnedTools = Array.from(toolRegistry.values())
            .filter(c => !pinnedMap.has(c.id))
            .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

        container.innerHTML = '';

        function makeRow(config, side, isPinned) {
            const row = document.createElement('div');
            row.className = 'pin-tool-row' + (isPinned ? ' is-pinned' : '');
            row.dataset.toolId = config.id;

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = isPinned;
            cb.style.marginRight = '6px';

            const name = document.createElement('span');
            name.className = 'pin-name';
            name.textContent = config.tooltip || config.id;

            const sideSelect = document.createElement('select');
            sideSelect.className = 'pin-side-select';
            ['left', 'right'].forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
                if (s === (side || 'right')) opt.selected = true;
                sideSelect.appendChild(opt);
            });

            const upBtn = document.createElement('button');
            upBtn.className = 'pin-reorder-btn';
            upBtn.textContent = '▲';
            upBtn.title = 'Move up';

            const downBtn = document.createElement('button');
            downBtn.className = 'pin-reorder-btn';
            downBtn.textContent = '▼';
            downBtn.title = 'Move down';

            row.appendChild(cb);
            row.appendChild(name);
            row.appendChild(sideSelect);
            row.appendChild(upBtn);
            row.appendChild(downBtn);

            cb.addEventListener('change', () => {
                if (cb.checked) {
                    row.classList.add('is-pinned');
                    const firstUnpinned = container.querySelector('.pin-tool-row:not(.is-pinned)');
                    if (firstUnpinned) {
                        container.insertBefore(row, firstUnpinned);
                    } else {
                        container.appendChild(row);
                    }
                } else {
                    row.classList.remove('is-pinned');
                    const allPinned = Array.from(container.querySelectorAll('.pin-tool-row.is-pinned'));
                    if (allPinned.length > 0) {
                        const afterLast = allPinned[allPinned.length - 1].nextSibling;
                        if (afterLast) {
                            container.insertBefore(row, afterLast);
                        } else {
                            container.appendChild(row);
                        }
                    } else {
                        container.insertBefore(row, container.firstChild);
                    }
                }
            });

            upBtn.addEventListener('click', () => {
                const pinnedRows = Array.from(container.querySelectorAll('.pin-tool-row.is-pinned'));
                const idx = pinnedRows.indexOf(row);
                if (idx > 0) container.insertBefore(row, pinnedRows[idx - 1]);
            });

            downBtn.addEventListener('click', () => {
                const pinnedRows = Array.from(container.querySelectorAll('.pin-tool-row.is-pinned'));
                const idx = pinnedRows.indexOf(row);
                if (idx >= 0 && idx < pinnedRows.length - 1) container.insertBefore(pinnedRows[idx + 1], row);
            });

            return row;
        }

        pinnedTools.forEach(({ config, side }) => container.appendChild(makeRow(config, side, true)));
        unpinnedTools.forEach(config => container.appendChild(makeRow(config, 'right', false)));
    }

    function exportSettings() {
        const settings = {};
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            settings[key] = getSetting(key);
        });

        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'toolbar-suite-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    Object.keys(settings).forEach(key => {
                        setSetting(key, settings[key]);
                    });
                    loadSettings();
                    alert('✅ Settings imported successfully! The page will reload to apply changes.');
                    location.reload();
                } catch (error) {
                    alert('❌ Error importing settings: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                GM_deleteValue(key);
            });
            GM_deleteValue('toolbar-custom-left');
            GM_deleteValue('toolbar-custom-top');
            alert('✅ Settings reset to default! The page will reload.');
            location.reload();
        }
    }

    /* ==========================================================
     *  TOOL REGISTRATION
     * ==========================================================*/

    document.addEventListener('addToolbarTool', function(e) {
        const config = e.detail;
        addToolToMenu(config);
    });

    function addToolToMenu(config) {
        toolRegistry.set(config.id, config);
        scheduleRerender();
    }

    /* === TOOL: GENERAL TOOLKIT === */

    const registerGeneralToolkit = (() => {
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


    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 12c0-1.1-.9-2-2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v3c1.1 0 2 .9 2 2s-.9 2-2 2v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3c-1.1 0-2-.9-2-2zm-2 4.5H4v-2.18c1.19-.69 2-1.99 2-3.32s-.81-2.63-2-3.32V5.5h14v2.18c-1.19.69-2 1.99-2 3.32s.81 2.63 2 3.32v2.18z"/>
    </svg>`;


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
        parseChangelog(CHANGELOG).forEach((entry, index) => {
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

        return function register() {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'General Toolkit', position: TOOL_POSITION }
            }));
            if (typeof isNewVersion === 'function' && isNewVersion() && !hasSeenChangelog()) addToolbarNotificationDot();
        };
    })();

    /* === TOOL: SERVICENOW TOOLKIT === */

    /* === TOOL: MINI SUMMARY SIDEBAR === */

    /* === TOOL: ENHANCEMENT REQUEST LOGGER === */

    /* === TOOL: TICKET ASSIGNMENT TOOL === */

    /* === TOOL: URL LIST EDITOR === */

    /* === TOOL: SERVICENOW ROW HIGHLIGHTER === */

    /* === TOOL: SERVICENOW TICKET HISTORY === */

    /* === TOOL: DOMAIN TOOLS === */

    const registerDomainTools = (() => {
        'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.3.0';
    const CHANGELOG = `Version 1.3.0:
- The Open SPM Request Form option now opens a fixed SPM request link and automatically
  adds the RITM number of the ticket you have open. You no longer need to set or paste an
  SPM URL, so the URL setup prompt and the Set URL link have been removed.

Version 1.2.2:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.2.1:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.2.0:
- Added a ? Help button to the modal header. It opens an illustrated Feature Guide covering the
  Extract tab, the Security Check tab, the SPM Request URL setup, and the header controls.

Version 1.1.3:
- The SPM Request URL setup now appears automatically the first time you load the tool, and
  on later loads until a URL is saved. Previously you had to open it manually before the
  Open SPM Request Form option would work.

Version 1.1.2:
- Fixed dark mode compatibility: the modal now forces light background and dark text via
  injected CSS with !important so ServiceNow dark mode cannot override its inputs and
  textareas.

Version 1.1.1:
- Extract tab: each domain row now has a checkbox for selection, and clicking anywhere on
  the row (except the Check button) toggles it.
- Extract tab: "Select all / Deselect all" toggle appears above the domain list after extraction.
- Extract tab: "Check Selected (N)" button in the action row opens security checks for all
  selected domains with an 800ms stagger between each to avoid tab overload.
- Security Check tab: new Single / Multiple mode toggle. In Multiple mode, paste one domain
  per line and check all at once. A progress indicator shows which domain is being opened.

Version 1.0:
- Initial release combining Domain Extractor and Domain Security Check into one toolbar tool.
- Extracted domains appear as clickable rows. Clicking any domain sends it directly to the
  Security Check tab with one click.
- Comma-separated and line-by-line copy buttons retained from the original extractor.
- Security Check tab accepts selected text on open, same as the original tool.`;

    /* ==========================================================
     *  VERSION MANAGEMENT
     * ==========================================================*/

    const GM_KEY_VERSION        = 'domainToolsVersion';
    const GM_KEY_CHANGELOG_SEEN = 'domainToolsChangelogSeen';

    function getStoredVersion()    { return GM_getValue(GM_KEY_VERSION, null); }
    function saveVersion(v)        { GM_setValue(GM_KEY_VERSION, v); }
    function hasSeenChangelog()    { return GM_getValue(GM_KEY_CHANGELOG_SEEN, null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue(GM_KEY_CHANGELOG_SEEN, SCRIPT_VERSION); }

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
     *  CHANGELOG MODAL
     * ==========================================================*/


    function showChangelogModal() {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)',
            zIndex: '1000010', display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            background: '#fff', borderRadius: '10px', padding: '20px',
            width: '500px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New — Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            margin: '0 0 10px', fontSize: '18px', color: '#333',
            borderBottom: '2px solid #667eea', paddingBottom: '10px',
        });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `Domain Tools updated to v${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            background: '#f8f9fa', borderLeft: '4px solid #667eea',
            padding: '10px', borderRadius: '5px', marginBottom: '15px',
            fontSize: '13px', color: '#333',
        });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '0';
        parseChangelog(CHANGELOG).forEach((entry, index) => {
            const isLatest = index === 0;
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid ' + (isLatest ? '#667eea' : '#e0e0e0'),
                borderRadius: '6px', marginBottom: '8px', overflow: 'hidden',
            });
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: isLatest ? '#f0f0ff' : '#f8f8f8',
                cursor: 'pointer', userSelect: 'none',
            });
            const versionWrap = document.createElement('span');
            versionWrap.style.cssText = 'display:inline-flex;align-items:center;';
            const versionLabel = document.createElement('span');
            versionLabel.textContent = `Version ${entry.version}`;
            Object.assign(versionLabel.style, {
                fontWeight: 'bold', fontSize: '13px',
                color: isLatest ? '#667eea' : '#555', fontFamily: 'Arial, sans-serif',
            });
            versionWrap.appendChild(versionLabel);
            if (isLatest) {
                const tag = document.createElement('span');
                tag.textContent = 'Latest';
                Object.assign(tag.style, {
                    fontSize: '10px', fontWeight: 'bold', background: '#667eea',
                    color: '#fff', borderRadius: '3px', padding: '1px 6px',
                    marginLeft: '8px', fontFamily: 'Arial, sans-serif',
                });
                versionWrap.appendChild(tag);
            }
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s',
                display: 'inline-block', transform: isLatest ? 'rotate(0deg)' : 'rotate(-90deg)',
            });
            header.appendChild(versionWrap);
            header.appendChild(chevron);
            card.appendChild(header);
            const body = document.createElement('div');
            Object.assign(body.style, {
                padding: isLatest ? '10px 14px' : '0',
                display: isLatest ? 'block' : 'none', background: '#fff',
            });
            entry.bullets.forEach(bullet => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '3px 0',
                    fontSize: '13px', fontFamily: 'Arial, sans-serif', color: '#444', lineHeight: '1.5',
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
                body.style.display = expanded ? 'block' : 'none';
                body.style.padding = expanded ? '10px 14px' : '0';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });
            cardsWrap.appendChild(card);
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Got it!';
        Object.assign(closeBtn.style, {
            marginTop: '15px', padding: '10px 20px', background: '#667eea',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '14px',
        });
        closeBtn.onclick = () => {
            overlay.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
        };

        modal.append(title, versionInfo, cardsWrap, closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeBtn.click(); });
    }


    /* ==========================================================
     *  CONFIGURATION
     * ==========================================================*/

    const TOOL_ID       = 'domainTools';
    const TOOL_TOOLTIP  = 'Domain Tools';
    const TOOL_POSITION = 3;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.91-4.33-3.56zm2.95-8H5.08c.96-1.65 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>
    </svg>`;


    /* ==========================================================
     *  SPM REQUEST FORM
     * ==========================================================*/

    // Fixed SPM request catalog item. The current RITM number is appended to ritm_id.
    const SPM_REQUEST_BASE_URL = 'https://deloitteglobal.service-now.com/mysupport?id=sc_cat_item&sys_id=809dca521bd015103c2fa64fad4bcb21&ritm_id=';


    // Read the RITM number of the currently open ticket, or null when none is open.
    function getCurrentRITM() {
        const ctx = getTicketContext();
        if (ctx && ctx.gForm) {
            try {
                const num = ctx.gForm.getValue('number');
                if (num && /^RITM\d+$/i.test(num.trim())) return num.trim().toUpperCase();
            } catch (e) { /* field not on this form, fall through to DOM */ }
        }
        const doc = (ctx && ctx.doc) || document;
        const el = doc.getElementById('sc_req_item.number');
        const val = el?.value?.trim();
        if (val && /^RITM\d+$/i.test(val)) return val.toUpperCase();
        return null;
    }

    // Build the SPM request link with the current RITM appended (empty when none is open).
    function buildSPMRequestURL() {
        return SPM_REQUEST_BASE_URL + (getCurrentRITM() || '');
    }

    /* ==========================================================
     *  DOMAIN HELPERS
     * ==========================================================*/

    function stripToDomain(text) {
        let d = text.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, '');
        d = d.split('/')[0].split('?')[0].split(':')[0];
        return d.trim().toLowerCase();
    }

    function extractDomainsFromText(text) {
        const domains = new Set();
        const proto = /(?:[a-z][a-z0-9+\-.]*:\/\/)([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
        const www   = /\b(www\.[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
        const plain = /(?<![a-zA-Z0-9@])([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,6})\b/g;
        let m;
        while ((m = proto.exec(text)) !== null) domains.add(m[1].toLowerCase());
        while ((m = www.exec(text))   !== null) domains.add(m[1].toLowerCase());
        while ((m = plain.exec(text)) !== null) {
            const d = m[1].toLowerCase();
            if (d.includes('.') && !d.startsWith('.') && !d.endsWith('.') && !d.startsWith('-') && !d.endsWith('-'))
                domains.add(d);
        }
        return Array.from(domains).sort();
    }

    /* ==========================================================
     *  MAIN MODAL
     * ==========================================================*/

    const MODAL_ID = 'dt-modal';

    function buildModal() {
        if (document.getElementById(MODAL_ID)) return;

        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        Object.assign(modal.style, {
            position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
            background: '#f9f9f9', border: '1px solid #ccc',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '10px',
            fontFamily: 'Arial, sans-serif', display: 'none', flexDirection: 'column',
            zIndex: '999998', minWidth: '620px', maxWidth: '820px',
            maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', overflowX: 'hidden',
        });

        /* ── Header bar ── */
        const header = document.createElement('div');
        Object.assign(header.style, {
            position: 'sticky', top: '0', background: '#f9f9f9',
            borderBottom: '1px solid #ddd', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: '2', borderRadius: '10px 10px 0 0',
        });

        const headerLeft = document.createElement('div');
        Object.assign(headerLeft.style, { display: 'flex', alignItems: 'center', gap: '10px' });

        const headerTitle = document.createElement('span');
        headerTitle.textContent = '🌐 Domain Tools';
        Object.assign(headerTitle.style, { fontWeight: 'bold', fontSize: '13px', color: '#333' });

        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, { fontSize: '11px', color: '#999' });

        headerLeft.append(headerTitle, versionBadge);

        if (isNewVersion() && !hasSeenChangelog()) {
            const whatsNew = document.createElement('span');
            whatsNew.textContent = "What's new";
            Object.assign(whatsNew.style, {
                fontSize: '11px', color: '#667eea', cursor: 'pointer', textDecoration: 'underline',
            });
            whatsNew.onclick = () => showChangelogModal();

            const dot = document.createElement('span');
            Object.assign(dot.style, {
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#007bff', display: 'inline-block',
            });
            let blue = true;
            setInterval(() => { blue = !blue; dot.style.background = blue ? '#007bff' : '#ff8c00'; }, 500);

            headerLeft.append(whatsNew, dot);
        }

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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        Object.assign(closeBtn.style, {
            background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px',
            cursor: 'pointer', padding: '3px 8px', fontWeight: 'bold', fontSize: '12px',
        });
        closeBtn.onclick = () => { modal.style.display = 'none'; };

        const headerRight = document.createElement('div');
        Object.assign(headerRight.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        headerRight.append(helpBtn, closeBtn);

        header.append(headerLeft, headerRight);

        /* ── Tab bar ── */
        const tabBar = document.createElement('div');
        Object.assign(tabBar.style, {
            display: 'flex', borderBottom: '2px solid #ddd',
            background: '#fff', padding: '0 16px',
        });

        function makeTab(label) {
            const tab = document.createElement('button');
            tab.textContent = label;
            Object.assign(tab.style, {
                padding: '10px 20px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                color: '#999', borderBottom: '3px solid transparent', marginBottom: '-2px',
                transition: 'color 0.15s',
            });
            return tab;
        }

        const tabExtract = makeTab('Extract');
        const tabCheck   = makeTab('Security Check');
        tabBar.append(tabExtract, tabCheck);

        /* ── Tab content panels ── */
        const panels = document.createElement('div');
        panels.style.padding = '20px 20px 16px';

        /* Extract panel */
        const extractPanel = document.createElement('div');

        const textareaLabel = document.createElement('label');
        textareaLabel.textContent = 'Paste text containing URLs:';
        Object.assign(textareaLabel.style, {
            display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '6px',
        });

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Paste text here...\n\nExamples:\nhttps://google.com\nwww.github.com\nstandalone-domain.org';
        Object.assign(textarea.style, {
            width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #ccc',
            borderRadius: '6px', fontSize: '13px', fontFamily: '"Courier New", monospace',
            resize: 'vertical', boxSizing: 'border-box',
        });

        const extractBtn = document.createElement('button');
        extractBtn.textContent = 'Extract Domains';
        Object.assign(extractBtn.style, {
            marginTop: '8px', padding: '8px 18px', border: '1px solid #ccc',
            borderRadius: '4px', cursor: 'pointer', background: '#e0e0e0',
            fontWeight: 'bold', fontSize: '13px',
        });

        const countRow = document.createElement('div');
        Object.assign(countRow.style, {
            display: 'none', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px',
        });

        const countBadge = document.createElement('div');
        Object.assign(countBadge.style, {
            padding: '7px 12px', background: '#e8f4f8', borderRadius: '4px',
            color: '#0066cc', fontSize: '12px', fontWeight: 'bold',
        });

        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Select all';
        Object.assign(selectAllBtn.style, {
            fontSize: '11px', color: '#667eea', background: 'none', border: 'none',
            cursor: 'pointer', textDecoration: 'underline', padding: '0',
        });
        countRow.append(countBadge, selectAllBtn);

        const domainList = document.createElement('div');
        Object.assign(domainList.style, {
            marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px',
            maxHeight: '220px', overflowY: 'auto',
        });

        const copyRow = document.createElement('div');
        Object.assign(copyRow.style, {
            display: 'none', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center',
        });

        const copyLineBtn = document.createElement('button');
        copyLineBtn.textContent = 'Copy Line by Line';
        styleCopyBtn(copyLineBtn);

        const copyCommaBtn = document.createElement('button');
        copyCommaBtn.textContent = 'Copy Comma Separated';
        styleCopyBtn(copyCommaBtn);

        const checkSelectedBtn = document.createElement('button');
        checkSelectedBtn.textContent = 'Check Selected (0)';
        checkSelectedBtn.style.display = 'none';
        Object.assign(checkSelectedBtn.style, {
            padding: '6px 14px', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
            color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold',
        });

        copyRow.append(copyLineBtn, copyCommaBtn, checkSelectedBtn);
        extractPanel.append(textareaLabel, textarea, extractBtn, countRow, domainList, copyRow);

        /* Security Check panel */
        const checkPanel = document.createElement('div');
        checkPanel.style.display = 'none';

        const checkDescription = document.createElement('p');
        checkDescription.textContent = 'Enter a domain or URL to check its reputation across multiple security platforms.';
        Object.assign(checkDescription.style, {
            fontSize: '13px', color: '#666', margin: '0 0 14px',
        });

        const checkInputLabel = document.createElement('label');
        checkInputLabel.textContent = 'Domain or URL:';
        Object.assign(checkInputLabel.style, {
            display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '6px',
        });

        const checkInput = document.createElement('input');
        checkInput.id = 'dt-check-input';
        checkInput.type = 'text';
        checkInput.placeholder = 'e.g., google.com or https://example.com/path';
        Object.assign(checkInput.style, {
            width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px',
            fontSize: '14px', fontFamily: '"Courier New", monospace', boxSizing: 'border-box',
        });

        const checkPreview = document.createElement('div');
        Object.assign(checkPreview.style, {
            padding: '8px 12px', background: '#e8f4f8', borderRadius: '6px',
            fontSize: '12px', color: '#0066cc', fontWeight: 'bold', display: 'none',
            marginTop: '8px',
        });

        const spmRow = document.createElement('div');
        Object.assign(spmRow.style, {
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px', background: '#f0f0f0', borderRadius: '6px', marginTop: '12px',
        });

        const spmCheckbox = document.createElement('input');
        spmCheckbox.type = 'checkbox';
        spmCheckbox.id = 'dt-spm-checkbox';
        Object.assign(spmCheckbox.style, { cursor: 'pointer', width: '16px', height: '16px', margin: '0', flexShrink: '0' });

        const spmLabel = document.createElement('label');
        spmLabel.htmlFor = 'dt-spm-checkbox';
        spmLabel.textContent = 'Open SPM Request Form';
        Object.assign(spmLabel.style, {
            cursor: 'pointer', fontSize: '13px', color: '#555', flex: '1', margin: '0',
        });

        spmRow.addEventListener('click', e => {
            if (e.target === spmCheckbox) return;
            e.preventDefault();
            spmCheckbox.checked = !spmCheckbox.checked;
        });
        spmRow.append(spmCheckbox, spmLabel);

        const checkBtn = document.createElement('button');
        checkBtn.textContent = '🔍 Check Domain Security';
        Object.assign(checkBtn.style, {
            marginTop: '12px', padding: '10px 20px', border: 'none', borderRadius: '6px',
            cursor: 'pointer', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
            color: '#fff', fontWeight: 'bold', fontSize: '14px', width: '100%',
            transition: 'transform 0.15s',
        });
        checkBtn.onmouseover = () => checkBtn.style.transform = 'scale(1.02)';
        checkBtn.onmouseout  = () => checkBtn.style.transform = 'scale(1)';

        const infoBox = document.createElement('div');
        Object.assign(infoBox.style, {
            marginTop: '12px', padding: '12px', background: '#f0f0f0',
            borderRadius: '6px', fontSize: '12px', color: '#555', lineHeight: '1.5',
        });
        infoBox.innerHTML = '<strong>Opens on check:</strong><br>' +
            '✓ Netskope URL Lookup (domain pre-filled)<br>' +
            '✓ IBM X-Force Exchange<br>' +
            '✓ VirusTotal<br>' +
            '✓ ServiceNow SPM Request Form (if checked, with the current RITM added)';

        /* ── Mode toggle ── */
        const modeToggleRow = document.createElement('div');
        Object.assign(modeToggleRow.style, { display: 'flex', gap: '6px', marginBottom: '14px' });

        function makeModeBtn(label) {
            const btn = document.createElement('button');
            btn.textContent = label;
            Object.assign(btn.style, {
                padding: '4px 16px', border: '1px solid #ccc', borderRadius: '20px',
                background: '#f0f0f0', color: '#555', fontSize: '12px',
                cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.15s',
            });
            return btn;
        }

        const singleModeBtn = makeModeBtn('Single');
        const multiModeBtn  = makeModeBtn('Multiple');
        modeToggleRow.append(singleModeBtn, multiModeBtn);

        const singleContent = document.createElement('div');
        singleContent.append(checkDescription, checkInputLabel, checkInput, checkPreview, spmRow, checkBtn, infoBox);

        /* ── Multi-domain content ── */
        const multiContent = document.createElement('div');
        multiContent.style.display = 'none';

        const multiLabel = document.createElement('label');
        multiLabel.textContent = 'Domains to check (one per line):';
        Object.assign(multiLabel.style, {
            display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '6px',
        });

        const multiTextarea = document.createElement('textarea');
        multiTextarea.placeholder = 'google.com\nexample.com\ngithub.com';
        Object.assign(multiTextarea.style, {
            width: '100%', minHeight: '100px', padding: '10px', border: '1px solid #ccc',
            borderRadius: '6px', fontSize: '13px', fontFamily: '"Courier New", monospace',
            resize: 'vertical', boxSizing: 'border-box',
        });

        const multiCountLabel = document.createElement('div');
        Object.assign(multiCountLabel.style, {
            fontSize: '11px', color: '#999', marginTop: '4px', minHeight: '16px',
        });

        const multiCheckBtn = document.createElement('button');
        multiCheckBtn.textContent = '🔍 Check All Domains';
        Object.assign(multiCheckBtn.style, {
            marginTop: '12px', padding: '10px 20px', border: 'none', borderRadius: '6px',
            cursor: 'pointer', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
            color: '#fff', fontWeight: 'bold', fontSize: '14px', width: '100%',
            transition: 'transform 0.15s',
        });
        multiCheckBtn.onmouseover = () => multiCheckBtn.style.transform = 'scale(1.02)';
        multiCheckBtn.onmouseout  = () => multiCheckBtn.style.transform = 'scale(1)';

        const bulkProgress = document.createElement('div');
        Object.assign(bulkProgress.style, {
            marginTop: '10px', padding: '8px 12px', background: '#e8f4f8',
            borderRadius: '6px', fontSize: '12px', color: '#0066cc', display: 'none',
        });

        multiTextarea.addEventListener('input', () => {
            const n = multiTextarea.value.split('\n').filter(l => l.trim()).length;
            multiCountLabel.textContent = n > 0 ? `${n} domain${n !== 1 ? 's' : ''} entered` : '';
            multiCheckBtn.textContent = `🔍 Check All Domains${n > 0 ? ` (${n})` : ''}`;
        });

        multiCheckBtn.addEventListener('click', () => {
            const domains = multiTextarea.value.split('\n')
                .map(l => stripToDomain(l.trim())).filter(Boolean);
            if (!domains.length) { alert('Please enter at least one domain.'); multiTextarea.focus(); return; }
            multiCheckBtn.disabled = true;
            runBulkCheck(domains,
                (current, total) => {
                    bulkProgress.style.display = 'block';
                    bulkProgress.textContent = `Checking domain ${current} of ${total}...`;
                },
                () => {
                    multiCheckBtn.disabled = false;
                    bulkProgress.textContent = `Done. Opened tabs for ${domains.length} domain${domains.length !== 1 ? 's' : ''}.`;
                    setTimeout(() => { bulkProgress.style.display = 'none'; }, 4000);
                }
            );
        });

        multiContent.append(multiLabel, multiTextarea, multiCountLabel, multiCheckBtn, bulkProgress);

        function setCheckMode(isMulti) {
            singleContent.style.display = isMulti ? 'none' : 'block';
            multiContent.style.display  = isMulti ? 'block' : 'none';

            singleModeBtn.style.background = isMulti ? '#f0f0f0' : '#667eea';
            singleModeBtn.style.color      = isMulti ? '#555'    : '#fff';
            singleModeBtn.style.border     = isMulti ? '1px solid #ccc' : '1px solid #667eea';

            multiModeBtn.style.background = isMulti ? '#667eea' : '#f0f0f0';
            multiModeBtn.style.color      = isMulti ? '#fff'    : '#555';
            multiModeBtn.style.border     = isMulti ? '1px solid #667eea' : '1px solid #ccc';
        }

        setCheckMode(false);
        singleModeBtn.addEventListener('click', () => { setCheckMode(false); setTimeout(() => checkInput.focus(), 50); });
        multiModeBtn.addEventListener('click',  () => { setCheckMode(true);  setTimeout(() => multiTextarea.focus(), 50); });

        checkPanel.append(modeToggleRow, singleContent, multiContent);

        panels.append(extractPanel, checkPanel);
        modal.append(header, tabBar, panels);
        document.body.appendChild(modal);

        /* ── Tab switching ── */
        function activateTab(isExtract) {
            extractPanel.style.display = isExtract ? 'block' : 'none';
            checkPanel.style.display   = isExtract ? 'none'  : 'block';

            tabExtract.style.color       = isExtract ? '#667eea' : '#999';
            tabExtract.style.borderColor = isExtract ? '#667eea' : 'transparent';
            tabCheck.style.color         = isExtract ? '#999' : '#667eea';
            tabCheck.style.borderColor   = isExtract ? 'transparent' : '#667eea';
        }

        activateTab(true);
        tabExtract.addEventListener('click', () => activateTab(true));
        tabCheck.addEventListener('click',   () => { activateTab(false); setTimeout(() => checkInput.focus(), 50); });

        function sendToSecurityCheck(domain) {
            activateTab(false);
            setCheckMode(false);
            checkInput.value = domain;
            checkInput.dispatchEvent(new Event('input'));
            setTimeout(() => checkInput.focus(), 50);
        }

        /* ── Extract logic ── */
        let lastDomains = [];
        const selectedDomains = new Set();

        function updateCheckSelectedBtn() {
            const n = selectedDomains.size;
            checkSelectedBtn.textContent = `Check Selected (${n})`;
            checkSelectedBtn.style.display = n > 0 ? 'inline-block' : 'none';
        }

        function runExtract() {
            const raw = textarea.value;
            domainList.innerHTML = '';
            copyRow.style.display = 'none';
            countRow.style.display = 'none';
            selectedDomains.clear();
            updateCheckSelectedBtn();
            selectAllBtn.textContent = 'Select all';

            if (!raw.trim()) return;

            lastDomains = extractDomainsFromText(raw);

            if (lastDomains.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No domains found in the text.';
                Object.assign(empty.style, { fontSize: '13px', color: '#999', fontStyle: 'italic', padding: '8px 0' });
                domainList.appendChild(empty);
                return;
            }

            countBadge.textContent = `Found ${lastDomains.length} unique domain${lastDomains.length !== 1 ? 's' : ''}`;
            countRow.style.display = 'flex';

            lastDomains.forEach(domain => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', background: '#fff', border: '1px solid #e5e5e5',
                    borderRadius: '5px', gap: '10px', cursor: 'pointer',
                });

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                Object.assign(cb.style, { width: '14px', height: '14px', margin: '0', cursor: 'pointer', flexShrink: '0' });
                cb.addEventListener('change', () => {
                    if (cb.checked) selectedDomains.add(domain);
                    else selectedDomains.delete(domain);
                    updateCheckSelectedBtn();
                    selectAllBtn.textContent = selectedDomains.size === lastDomains.length ? 'Deselect all' : 'Select all';
                });

                const domainText = document.createElement('span');
                domainText.textContent = domain;
                Object.assign(domainText.style, {
                    fontFamily: '"Courier New", monospace', fontSize: '13px',
                    color: '#333', flex: '1', wordBreak: 'break-all',
                });

                const checkRowBtn = document.createElement('button');
                checkRowBtn.textContent = 'Check →';
                Object.assign(checkRowBtn.style, {
                    padding: '3px 10px', fontSize: '11px', fontWeight: 'bold',
                    background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
                    color: '#fff', border: 'none', borderRadius: '4px',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0',
                });
                checkRowBtn.onclick = () => sendToSecurityCheck(domain);

                row.addEventListener('click', e => {
                    if (e.target === cb || e.target === checkRowBtn) return;
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                });

                row.append(cb, domainText, checkRowBtn);
                domainList.appendChild(row);
            });

            copyRow.style.display = 'flex';
        }

        selectAllBtn.addEventListener('click', () => {
            const allSelected = selectedDomains.size === lastDomains.length;
            domainList.querySelectorAll('input[type=checkbox]').forEach((cb, i) => {
                cb.checked = !allSelected;
                if (!allSelected) selectedDomains.add(lastDomains[i]);
                else selectedDomains.delete(lastDomains[i]);
            });
            updateCheckSelectedBtn();
            selectAllBtn.textContent = allSelected ? 'Select all' : 'Deselect all';
        });

        checkSelectedBtn.addEventListener('click', () => {
            const domains = Array.from(selectedDomains).map(d => stripToDomain(d)).filter(Boolean);
            if (!domains.length) return;
            runBulkCheck(domains);
        });

        extractBtn.addEventListener('click', runExtract);
        textarea.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') runExtract(); });

        function copyText(text, btn) {
            const orig = btn.textContent;
            navigator.clipboard.writeText(text).catch(() => GM_setClipboard(text));
            btn.textContent = '✓ Copied!';
            btn.style.background = '#0066cc';
            setTimeout(() => { btn.textContent = orig; btn.style.background = '#28a745'; }, 2000);
        }

        copyLineBtn.addEventListener('click',  () => copyText(lastDomains.join('\n'), copyLineBtn));
        copyCommaBtn.addEventListener('click', () => copyText(lastDomains.join(', '), copyCommaBtn));

        /* ── Security check logic ── */
        checkInput.addEventListener('input', () => {
            const d = stripToDomain(checkInput.value.trim());
            checkPreview.textContent = d ? `Will check: ${d}` : '';
            checkPreview.style.display = d ? 'block' : 'none';
        });

        checkInput.addEventListener('keydown', e => { if (e.key === 'Enter') runCheck(); });
        checkBtn.addEventListener('click', runCheck);

        function runCheck() {
            const raw = checkInput.value.trim();
            if (!raw) { alert('Please enter a domain or URL.'); checkInput.focus(); return; }
            const domain = stripToDomain(raw);
            if (!domain) { alert('Could not extract a valid domain from the input.'); checkInput.focus(); return; }

            GM_openInTab(`https://www.netskope.com/url-lookup?url=https://${domain}`, { active: false, insert: true });
            GM_openInTab(`https://exchange.xforce.ibmcloud.com/url/${domain}`,          { active: false, insert: true });
            GM_openInTab(`https://www.virustotal.com/gui/domain/${domain}`,             { active: false, insert: true });

            if (spmCheckbox.checked) {
                GM_openInTab(buildSPMRequestURL(), { active: false, insert: true });
            }
        }

        function runBulkCheck(domains, onProgress, onComplete) {
            const total = domains.length;
            let current = 0;
            function checkNext() {
                if (current >= total) { if (onComplete) onComplete(); return; }
                const domain = domains[current];
                GM_openInTab(`https://www.netskope.com/url-lookup?url=https://${domain}`, { active: false, insert: true });
                GM_openInTab(`https://exchange.xforce.ibmcloud.com/url/${domain}`,          { active: false, insert: true });
                GM_openInTab(`https://www.virustotal.com/gui/domain/${domain}`,             { active: false, insert: true });
                current++;
                if (onProgress) onProgress(current, total);
                if (current < total) setTimeout(checkNext, 800);
                else if (onComplete) onComplete();
            }
            checkNext();
        }

        modal._activateTab         = activateTab;
        modal._sendToSecurityCheck = sendToSecurityCheck;
        modal._checkInput          = checkInput;
        modal._setCheckMode        = setCheckMode;
    }

    function styleCopyBtn(btn) {
        Object.assign(btn.style, {
            padding: '6px 14px', background: '#28a745', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold',
        });
    }

    /* ==========================================================
     *  FEATURE GUIDE MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('domainToolsHelpModal')) return;

        // lead: one orienting sentence at the top of a section
        function lead(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', margin: '0 0 10px 0', fontFamily: 'Arial, sans-serif' });
            body.appendChild(p);
        }

        // bullets: compact list of usage notes with a purple dot each
        function bullets(body, items) {
            const ul = document.createElement('div');
            ul.style.margin = '8px 0 0 0';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, { display: 'flex', gap: '8px', padding: '2px 0', fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
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

        // caption: small italic note placed under a visual
        function caption(body, text) {
            const c = document.createElement('div');
            c.textContent = text;
            Object.assign(c.style, { fontSize: '11px', color: '#888', fontStyle: 'italic', margin: '6px 0 0 0', lineHeight: '1.4', fontFamily: 'Arial, sans-serif' });
            body.appendChild(c);
        }

        // span: inline text node with optional extra styles, returned not appended
        function span(text, extra) {
            const s = document.createElement('span');
            s.textContent = text;
            Object.assign(s.style, { fontFamily: 'Arial, sans-serif' }, extra || {});
            return s;
        }

        // hrow: horizontal wrapping flex row for placing visual mocks side by side
        function hrow(children, extra) {
            const r = document.createElement('div');
            Object.assign(r.style, { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '0 0 4px 0' }, extra || {});
            children.forEach(c => r.appendChild(c));
            return r;
        }

        // chip: small colored rounded label for button previews and categories
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

        // toolSquare: one rounded icon tile, like a real toolbar button
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
            return sq;
        }

        // menuSep: thin vertical divider between groups in a mock menu
        function menuSep() {
            const s = document.createElement('div');
            Object.assign(s.style, { width: '1px', height: '22px', background: '#e5e7eb', flexShrink: '0' });
            return s;
        }

        // pill: a rounded mode-toggle button mock (Single / Multiple style)
        function pill(text, active) {
            const p = document.createElement('span');
            p.textContent = text;
            Object.assign(p.style, {
                padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif',
                background: active ? '#667eea' : '#f0f0f0',
                color: active ? '#fff' : '#555',
                border: active ? '1px solid #667eea' : '1px solid #ccc'
            });
            return p;
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Click the globe icon in the floating toolbar to open Domain Tools.');
                    const menu = document.createElement('div');
                    Object.assign(menu.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                        padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', marginBottom: '12px'
                    });
                    const pinStyle = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    [toolSquare('🌐', pinStyle), menuSep(), toolSquare('📊'), toolSquare('📝'), menuSep(), toolSquare('⚙️')].forEach(el => menu.appendChild(el));
                    body.appendChild(hrow([menu], { margin: '0 0 12px 0' }));
                    caption(body, 'The 🌐 icon is the Domain Tools button in the toolbar.');
                    const tabBar = document.createElement('div');
                    Object.assign(tabBar.style, { display: 'inline-flex', borderBottom: '2px solid #ddd', marginBottom: '8px' });
                    const t1 = document.createElement('span');
                    t1.textContent = 'Extract';
                    Object.assign(t1.style, { padding: '8px 18px', fontSize: '12px', fontWeight: 'bold', color: '#667eea', borderBottom: '3px solid #667eea', marginBottom: '-2px', fontFamily: 'Arial, sans-serif' });
                    const t2 = document.createElement('span');
                    t2.textContent = 'Security Check';
                    Object.assign(t2.style, { padding: '8px 18px', fontSize: '12px', fontWeight: 'bold', color: '#999', fontFamily: 'Arial, sans-serif' });
                    tabBar.append(t1, t2);
                    body.appendChild(tabBar);
                    bullets(body, [
                        'Two tabs: Extract pulls domains out of pasted text, Security Check looks up reputation.',
                        'If you select a domain or URL on the page first, then open the tool, it jumps straight to Security Check with that value filled in.'
                    ]);
                }
            },
            {
                icon: '🔗',
                title: 'Extract Domains',
                buildContent(body) {
                    lead(body, 'Paste any text into the Extract tab and pull out every unique domain it contains.');
                    const rowMock = document.createElement('div');
                    Object.assign(rowMock.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '6px 10px', background: '#fff', border: '1px solid #e5e5e5',
                        borderRadius: '5px', marginBottom: '12px'
                    });
                    const cbMock = document.createElement('span');
                    Object.assign(cbMock.style, { width: '14px', height: '14px', border: '1px solid #b0b0b0', borderRadius: '3px', flexShrink: '0', display: 'inline-block' });
                    const domMock = document.createElement('span');
                    domMock.textContent = 'example.com';
                    Object.assign(domMock.style, { fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#333', flex: '1' });
                    rowMock.append(cbMock, domMock, chip('Check →', 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'));
                    body.appendChild(rowMock);
                    caption(body, 'Each extracted domain appears as a row. Click anywhere on the row to tick its checkbox.');
                    body.appendChild(hrow([
                        chip('Copy Line by Line', '#28a745'),
                        chip('Copy Comma Separated', '#28a745'),
                        chip('Check Selected (2)', 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)')
                    ], { margin: '10px 0 4px 0' }));
                    bullets(body, [
                        'Check arrow on a single row sends that one domain to the Security Check tab.',
                        'Select all toggles every row, then Check Selected opens reputation tabs for all ticked domains.',
                        'Copy buttons put the full domain list on your clipboard, one per line or comma separated.'
                    ]);
                }
            },
            {
                icon: '🔍',
                title: 'Security Check',
                buildContent(body) {
                    lead(body, 'Look up a domain reputation across several security platforms at once.');
                    body.appendChild(hrow([pill('Single', true), pill('Multiple', false)], { margin: '0 0 10px 0' }));
                    caption(body, 'Single checks one domain. Multiple takes one domain per line and checks them all with a short delay between each.');
                    const sites = ['Netskope URL Lookup', 'IBM X-Force Exchange', 'VirusTotal', 'SPM Request Form (optional)'];
                    const siteWrap = document.createElement('div');
                    siteWrap.style.margin = '4px 0 8px 0';
                    for (const s of sites) {
                        const r = document.createElement('div');
                        Object.assign(r.style, { display: 'flex', gap: '8px', padding: '2px 0', fontSize: '12px', color: '#555', fontFamily: 'Arial, sans-serif' });
                        const tick = document.createElement('span');
                        tick.textContent = '✓';
                        Object.assign(tick.style, { color: '#28a745', fontWeight: 'bold', flexShrink: '0' });
                        const t = document.createElement('span');
                        t.textContent = s;
                        r.append(tick, t);
                        siteWrap.appendChild(r);
                    }
                    body.appendChild(siteWrap);
                    const spmMock = document.createElement('div');
                    Object.assign(spmMock.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px', background: '#f0f0f0', borderRadius: '6px', marginTop: '4px'
                    });
                    const spmCb = document.createElement('span');
                    Object.assign(spmCb.style, { width: '16px', height: '16px', border: '1px solid #b0b0b0', borderRadius: '3px', flexShrink: '0', background: '#fff', display: 'inline-block' });
                    spmMock.append(spmCb, span('Open SPM Request Form', { fontSize: '13px', color: '#555', flex: '1' }));
                    body.appendChild(spmMock);
                    bullets(body, [
                        'Each domain opens its own background tabs so you can review them one by one.',
                        'Tick Open SPM Request Form to also open the SPM request form when you run a check. The RITM number of the ticket you have open is added automatically.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'SPM Request & Settings',
                buildContent(body) {
                    lead(body, 'Header controls and how the SPM request form opens.');
                    const controls = [
                        { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide.' },
                        { bg: 'transparent', color: '#667eea', border: 'none', label: "What's new", desc: 'Appears with a pulsing dot after an update. Opens the changelog.' },
                        { bg: '#e74c3c', color: '#fff', border: 'none', label: 'X', desc: 'Closes the modal. Your text and results stay until you reopen.' }
                    ];
                    for (const ctrl of controls) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
                        });
                        row.appendChild(chip(ctrl.label, ctrl.bg, { color: ctrl.color, border: ctrl.border }));
                        const descEl = document.createElement('span');
                        descEl.textContent = ctrl.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }
                    const setupHeader = document.createElement('div');
                    setupHeader.textContent = 'SPM Request Form';
                    Object.assign(setupHeader.style, { fontSize: '12px', fontWeight: 'bold', color: '#667eea', marginTop: '6px', marginBottom: '6px', fontFamily: 'Arial, sans-serif' });
                    body.appendChild(setupHeader);
                    const infoMock = document.createElement('div');
                    Object.assign(infoMock.style, {
                        background: '#eef7ff', borderLeft: '4px solid #667eea',
                        padding: '8px 12px', borderRadius: '5px', fontSize: '12px',
                        color: '#555', lineHeight: '1.5', marginBottom: '8px', fontFamily: 'Arial, sans-serif'
                    });
                    infoMock.textContent = 'The SPM request form now uses a fixed link, so there is nothing to set up.';
                    body.appendChild(infoMock);
                    bullets(body, [
                        'Tick Open SPM Request Form in the Security Check tab to open the form when you run a check.',
                        'The RITM number of the ticket you have open is added to the request automatically.',
                        'Open the RITM in ServiceNow before you run the check so the number can be picked up.'
                    ]);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'domainToolsHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'domainToolsHelpModal';

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
        titleSub.textContent = `Domain Tools • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleText.append(titleMain, titleSub);
        titleEl.append(titleIcon, titleText);
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };
        modalHeader.append(titleEl, closeX);
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
            headerLeft.append(iconEl, titleLabel);
            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, { fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block' });
            cardHeader.append(headerLeft, chevron);
            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);
            card.append(cardHeader, cardBody);
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
        document.body.append(overlay, modal);
    }

    /* ==========================================================
     *  SHOW MODAL
     * ==========================================================*/

    function showModal() {
        buildModal();
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;

        modal.style.display = 'flex';

        const selected = window.getSelection().toString().trim();
        if (selected) {
            const domain = stripToDomain(selected);
            if (domain) {
                modal._activateTab(false);
                modal._setCheckMode(false);
                modal._checkInput.value = selected;
                modal._checkInput.dispatchEvent(new Event('input'));
                setTimeout(() => modal._checkInput.focus(), 100);
                return;
            }
        }

        modal._activateTab(true);
        const textarea = modal.querySelector('textarea');
        if (textarea) setTimeout(() => textarea.focus(), 100);
    }

    /* ==========================================================
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOLBAR_DOT_CLASS = 'domainTools-notif-dot';

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
            let blue = true;
            const intervalId = setInterval(() => {
                blue = !blue;
                dot.style.background = blue ? '#007bff' : '#ff8c00';
            }, 500);
            dot.dataset.intervalId = intervalId;
            toolEl.appendChild(dot);
        };
        setTimeout(() => tryAdd(0), 500);
    }

    function removeToolbarNotificationDot() {
        const dot = document.querySelector(`[data-tool="${TOOL_ID}"] .${TOOLBAR_DOT_CLASS}`);
        if (dot) { clearInterval(Number(dot.dataset.intervalId)); dot.remove(); }
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/


    document.addEventListener('toolbarToolClicked', e => { if (e.detail.id === TOOL_ID) showModal(); });

        return function register() {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: TOOL_TOOLTIP, position: TOOL_POSITION }
            }));
            if (typeof isNewVersion === 'function' && isNewVersion() && !hasSeenChangelog()) addToolbarNotificationDot();
        };
    })();

    /* === TOOL: NETSKOPE POLICY TOOLKIT === */

    /* === TOOL: NETSKOPE POLICY DELETION SCHEDULER === */

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function doRegisterAllTools() {
        registerGeneralToolkit();
        if (/\.service-now\.com|\.servicenow\.com/.test(location.hostname)) {
            registerDomainTools();
            // Phases 3 to 9 add ServiceNow tool registrations here.
        }
        if (/\.goskope\.com|\.netskope\.com/.test(location.hostname)) {
            // Phases 10 to 11 add Netskope tool registrations here.
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { initToolbar(); doRegisterAllTools(); });
    } else {
        initToolbar();
        doRegisterAllTools();
    }

})();
