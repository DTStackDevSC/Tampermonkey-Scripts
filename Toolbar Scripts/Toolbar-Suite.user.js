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
        #erl-modal, #erl-cl-modal { color: #333333 !important; }
        #erl-modal input, #erl-modal select, #erl-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        /* Mini Summary Sidebar (harvested from its theme-independence style block) */
        /* Z-INDEX HIERARCHY
         * Main Sidebar: 999997
         * SPM Modal: 999998
         * Changelog Overlay: 20000
         * Changelog Modal: 20001
         */

        /* Changelog Notification Badge */
        #miniSummaryChangelogNotification {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            margin-left: 10px !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }

        #miniSummaryChangelogNotification:hover {
            background-color: rgba(102, 126, 234, 0.1) !important;
        }

        #miniSummaryChangelogNotification .notification-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: miniSummaryColorPulse 1s ease-in-out infinite !important;
        }

        @keyframes miniSummaryColorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #miniSummaryChangelogNotification .notification-text {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* Changelog Modal */
        #miniSummaryChangelogModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 20001 !important;
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

        #miniSummaryChangelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.5em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }

        #miniSummaryChangelogModal .version-info {
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

        #miniSummaryChangelogModal .changelog-content {
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

        #miniSummaryChangelogModal .close-changelog {
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

        #miniSummaryChangelogModal .close-changelog:hover {
            background-color: #5568d3 !important;
        }

        #miniSummaryChangelogModalOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 20000 !important;
        }

        /* Help Modal */
        #miniSummarySidebarHelpModalOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 21000 !important;
        }

        #miniSummarySidebarHelpModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 21001 !important;
            background: #ffffff !important;
            border: 2px solid #333333 !important;
            padding: 20px !important;
            border-radius: 10px !important;
            width: 640px !important;
            max-width: 92vw !important;
            max-height: 82vh !important;
            overflow-y: auto !important;
            color: #333333 !important;
            font-family: Arial, sans-serif !important;
        }

        #miniSummarySidebarHelpModal input,
        #miniSummarySidebarHelpModal select,
        #miniSummarySidebarHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        /* Row Highlighter */
        #highlighter-config-modal, #highlighterChangelogModal, #rowHighlighterHelpModal { color: #333333 !important; }
        #highlighter-config-modal input, #highlighter-config-modal select, #highlighter-config-modal textarea { background-color: #ffffff !important; color: #333333 !important; }
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

    const registerMiniSummarySidebar = (() => {
        'use strict';

    console.log('📊 Mini Summary Sidebar loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.1.2';
    const CHANGELOG = `Version 1.1.2:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.1.1:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.1.0:
- Added a ? Help button next to the panel title. Clicking it opens an illustrated Feature Guide covering the summary fields, the SPM Copy modal, and all sidebar controls.

Version 1.0.7:
- Business Justification is now shown in the SPM copy modal only when the actual
  Business Justification field is populated on the ticket form. It no longer falls
  back to the short description, so the label always reflects the true field value.

Version 1.0.6:
- Fixed sidebar peeking on the right edge in dashboard (Polaris) mode. The hidden
  offset now accounts for padding and border, pushing the sidebar fully off-screen.

Version 1.0.5:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.0.4:
- Added dual mode support for Polaris (Dashboard) and Classic (New Tab) ticket access.
  All field extraction now works when tickets are opened from the ServiceNow dashboard
  via shadow DOM iframe traversal. Script now also matches the dashboard URL pattern.
- Standard ticket fields prefer g_form.getDisplayValue() over DOM queries for
  more reliable value resolution in both modes.

Version 1.0.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.0.2:
- Update URL Changed`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('miniSummarySidebarVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('miniSummarySidebarVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('miniSummarySidebarChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('miniSummarySidebarChangelogSeen', SCRIPT_VERSION);
    }


    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/


    function showChangelogModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'miniSummaryChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'miniSummaryChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();

            // Remove the notification dot from sidebar
            const notification = document.getElementById('miniSummaryChangelogNotification');
            if (notification) {
                notification.remove();
            }
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);

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
     *  CONFIGURATION
     * ==========================================================*/

    // Tool icon (summary/info icon)
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </svg>`;

    // Tool ID
    const TOOL_ID = 'miniSummary';

    let sidebarVisible = false;

    /* ==========================================================
     *  DATA EXTRACTION FUNCTIONS
     * ==========================================================*/


    function getFieldValue(fieldId) {
        const ctx = getTicketContext();
        const doc = (ctx && ctx.doc) || document;

        // Prefer g_form display values for standard ticket fields
        if (ctx && ctx.gForm) {
            const bareField = fieldId.includes('.') ? fieldId.split('.').slice(1).join('.') : fieldId;
            try {
                const dv = ctx.gForm.getDisplayValue(bareField);
                if (dv && dv.trim() && !/^[a-f0-9]{32}$/i.test(dv.trim())) return dv.trim();
                const v = ctx.gForm.getValue(bareField);
                if (v && v.trim() && !/^[a-f0-9]{32}$/i.test(v.trim())) return v.trim();
            } catch(e) { /* field not on form, fall through to DOM */ }
        }

        // DOM fallback — uses ctx.doc so it works inside the Polaris iframe
        const patterns = [
            `${fieldId}_label`,
            `sys_display.${fieldId}`,
            `sys_readonly.${fieldId}`,
            `sys_readonly.sys_display.${fieldId}`,
            fieldId
        ];

        for (const pattern of patterns) {
            const element = doc.getElementById(pattern);
            if (element) {
                if (element.value && element.value.trim()) {
                    if (!/^[a-f0-9]{32}$/i.test(element.value.trim())) {
                        return element.value.trim();
                    }
                }
                if (element.textContent && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    if (!/^[a-f0-9]{32}$/i.test(text)) {
                        return text;
                    }
                }
            }
        }

        const selectElement = doc.getElementById(fieldId) ||
                             doc.getElementById(`sys_readonly.${fieldId}`);
        if (selectElement && selectElement.tagName === 'SELECT') {
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            if (selectedOption && selectedOption.text) {
                return selectedOption.text;
            }
        }

        return 'N/A';
    }

    function getVariableValue(variableName) {
        const ctx = getTicketContext();
        const doc = (ctx && ctx.doc) || document;

        const displayPatterns = [
            `sys_display.ni.VE${variableName}`,
            `ni.VE${variableName}_label`
        ];

        for (const pattern of displayPatterns) {
            const elements = doc.querySelectorAll(`input[id*="${pattern}"]`);
            for (const elem of elements) {
                if (elem.value && elem.value.trim() && !/^[a-f0-9]{32}$/i.test(elem.value.trim())) {
                    return elem.value.trim();
                }
            }
        }

        const directElement = doc.getElementById(`ni.VE${variableName}`);
        if (directElement) {
            if (directElement.tagName === 'TEXTAREA' && directElement.value && directElement.value.trim()) {
                return directElement.value.trim();
            }
            if (directElement.tagName === 'INPUT' && directElement.value && directElement.value.trim() && !/^[a-f0-9]{32}$/i.test(directElement.value.trim())) {
                return directElement.value.trim();
            }
        }

        const textarea = doc.querySelector(`textarea[name*="${variableName}"], textarea[id*="${variableName}"]`);
        if (textarea && textarea.value && textarea.value.trim()) {
            return textarea.value.trim();
        }

        const input = doc.querySelector(`input[name*="${variableName}"][type="text"], input[name*="${variableName}"][type="hidden"]`);
        if (input && input.value && input.value.trim() && !/^[a-f0-9]{32}$/i.test(input.value.trim())) {
            return input.value.trim();
        }

        const select = doc.querySelector(`select[name*="${variableName}"], select[id*="${variableName}"]`);
        if (select && select.value && select.value !== '') {
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption ? selectedOption.text : select.value;
        }

        return 'N/A';
    }

    function extractSummaryData() {
        const ctx = getTicketContext();
        const doc = (ctx && ctx.doc) || document;
        const data = {};

        // Basic fields
        data.number = getFieldValue('sc_req_item.number') || getFieldValue('incident.number');
        data.requestedFor = getFieldValue('sc_req_item.request.requested_for') || getFieldValue('incident.caller_id');
        data.openedBy = getFieldValue('sc_req_item.opened_by') || getFieldValue('incident.opened_by');
        data.openedAt = getFieldValue('sc_req_item.opened_at') || getFieldValue('incident.opened_at');
        data.assignmentGroup = getFieldValue('sc_req_item.assignment_group') || getFieldValue('incident.assignment_group');
        data.assignedTo = getFieldValue('sc_req_item.assigned_to') || getFieldValue('incident.assigned_to');
        data.dueDate = getFieldValue('sc_req_item.due_date') || getFieldValue('incident.due_date');
        data.configItem = getFieldValue('sc_req_item.configuration_item') || getFieldValue('incident.cmdb_ci');

        // Catalog specific fields
        data.catalogItem = getFieldValue('sc_req_item.cat_item');

        // Try to get business justification by finding span with aria-label inside label
        const businessJustSpan = doc.querySelector('span[aria-label="Business Justification"]');
        if (businessJustSpan) {
            const parentLabel = businessJustSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const businessJustTextarea = doc.getElementById(labelFor);
                    if (businessJustTextarea && businessJustTextarea.value && businessJustTextarea.value.trim()) {
                        data.description = businessJustTextarea.value.trim();
                        data.businessJustification = businessJustTextarea.value.trim();
                    }
                }
            }
        }

        // Fallback business justification via variable (no short_description fallback)
        if (!data.businessJustification) {
            const bjVar = getVariableValue('business_justification');
            if (bjVar && bjVar !== 'N/A') data.businessJustification = bjVar;
        }

        // Fallback to other methods if not found for description
        if (!data.description || data.description === 'N/A') {
            data.description = getVariableValue('business_justification') ||
                              getVariableValue('short_description') ||
                              getFieldValue('incident.short_description');
        }

        // Get web protection platform - search by span aria-label
        const platformSpan = doc.querySelector('span[aria-label="Web Protection Platform"]');
        if (platformSpan) {
            const parentLabel = platformSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const platformSelect = doc.getElementById(labelFor);
                    if (platformSelect && platformSelect.value) {
                        const selectedOption = platformSelect.options[platformSelect.selectedIndex];
                        data.platform = selectedOption ? selectedOption.text : platformSelect.value;
                    }
                }
            }
        }
        if (!data.platform || data.platform === 'N/A') {
            data.platform = getVariableValue('web_protection_platform');
        }

        // Get type of request - search by span aria-label
        const typeSpan = doc.querySelector('span[aria-label="Type of Request"]');
        if (typeSpan) {
            const parentLabel = typeSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const typeSelect = doc.getElementById(labelFor);
                    if (typeSelect && typeSelect.value) {
                        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
                        data.requestType = selectedOption ? selectedOption.text : typeSelect.value;
                    }
                }
            }
        }
        if (!data.requestType || data.requestType === 'N/A') {
            data.requestType = getVariableValue('type_of_request');
        }

        // Get requesting member firm - search by span aria-label
        const firmSpan = doc.querySelector('span[aria-label="Requesting Member Firm"]');
        if (firmSpan) {
            const parentLabel = firmSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const firmInput = doc.getElementById(labelFor);
                    if (firmInput && firmInput.value && firmInput.value.trim() && !/^[a-f0-9]{32}$/i.test(firmInput.value.trim())) {
                        data.memberFirm = firmInput.value.trim();
                    }
                }
            }
        }
        if (!data.memberFirm || data.memberFirm === 'N/A') {
            data.memberFirm = getVariableValue('ref_member_firm') ||
                             getFieldValue('sc_req_item.u_member_firm');
        }

        // Get application/URL - search by span aria-label
        const appSpan = doc.querySelector('span[aria-label="Application / URL"]');
        if (appSpan) {
            const parentLabel = appSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const appInput = doc.getElementById(labelFor);
                    if (appInput && appInput.value && appInput.value.trim()) {
                        data.applicationUrl = appInput.value.trim();
                    }
                }
            }
        }
        if (!data.applicationUrl || data.applicationUrl === 'N/A') {
            data.applicationUrl = getVariableValue('application_url') ||
                                 getFieldValue('sc_req_item.u_application_url');
        }

        return data;
    }

    /* ==========================================================
     *  FEATURE GUIDE MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('miniSummarySidebarHelpModal')) return;

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
            if (opts.dot) {
                const dot = document.createElement('span');
                Object.assign(dot.style, { position: 'absolute', top: '-3px', right: '-3px', width: '8px', height: '8px', borderRadius: '50%', background: '#ff8c00', border: '1px solid #fff' });
                sq.appendChild(dot);
            }
            return sq;
        }

        // menuSep: thin vertical divider between groups in a mock menu
        function menuSep() {
            const s = document.createElement('div');
            Object.assign(s.style, { width: '1px', height: '22px', background: '#e5e7eb', flexShrink: '0' });
            return s;
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Click the chart icon in the floating toolbar to open the summary panel.');
                    const menu = document.createElement('div');
                    Object.assign(menu.style, {
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                        padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', marginBottom: '12px'
                    });
                    const pinStyle = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    [toolSquare('📊', pinStyle), menuSep(), toolSquare('📝'), toolSquare('🔗'), menuSep(), toolSquare('⚙️')].forEach(el => menu.appendChild(el));
                    body.appendChild(hrow([menu], { margin: '0 0 12px 0' }));
                    caption(body, 'The 📊 icon is the Mini Summary Sidebar tool in the toolbar.');
                    bullets(body, [
                        'The sidebar slides in from the right edge of the ticket page.',
                        'Fields are read automatically when the panel opens.',
                        'Click the toolbar icon again or the × button inside the panel to close it.'
                    ]);
                }
            },
            {
                icon: '📊',
                title: 'Summary Fields',
                buildContent(body) {
                    lead(body, 'The sidebar reads ticket data and groups it into labeled sections.');
                    const fieldSections = [
                        { icon: '📋', label: 'Basic Info', fields: ['Number', 'Catalog Item'] },
                        { icon: '👥', label: 'People', fields: ['Requested For', 'Opened By', 'Assigned To', 'Assignment Group'] },
                        { icon: '🔧', label: 'Technical Details', fields: ['Member Firm', 'Config Item', 'Platform', 'Request Type', 'Application / URL'] },
                        { icon: '📅', label: 'Dates', fields: ['Opened', 'Due Date'] },
                        { icon: '📝', label: 'Description', fields: ['Business Justification or short description'] }
                    ];
                    for (const sec of fieldSections) {
                        const secHeader = document.createElement('div');
                        secHeader.textContent = `${sec.icon} ${sec.label}`;
                        Object.assign(secHeader.style, {
                            fontSize: '12px', fontWeight: 'bold', color: '#667eea',
                            borderBottom: '1px solid #c0c8f0', paddingBottom: '3px',
                            marginBottom: '5px', marginTop: '10px', fontFamily: 'Arial, sans-serif'
                        });
                        body.appendChild(secHeader);
                        const fieldRow = document.createElement('div');
                        Object.assign(fieldRow.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' });
                        for (const f of sec.fields) {
                            const pill = document.createElement('span');
                            pill.textContent = f;
                            Object.assign(pill.style, {
                                background: '#f5f5f5', border: '1px solid #e0e0e0',
                                borderRadius: '4px', padding: '2px 7px', fontSize: '11px',
                                color: '#555', fontFamily: 'Arial, sans-serif'
                            });
                            fieldRow.appendChild(pill);
                        }
                        body.appendChild(fieldRow);
                    }
                    bullets(body, [
                        'Fields showing "N/A" were not found or are not yet populated on the form.',
                        'Use the Refresh button to re-read all fields after editing the ticket.',
                        'Standard fields prefer the ServiceNow form API; catalog variables fall back to DOM lookup.'
                    ]);
                }
            },
            {
                icon: '📋',
                title: 'SPM Copy Modal',
                buildContent(body) {
                    lead(body, 'The green SPM button opens a modal with individual clipboard copy buttons for fields commonly needed in SPM requests.');
                    const btnRow = document.createElement('div');
                    Object.assign(btnRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const badge = document.createElement('span');
                    badge.textContent = '📋 Copy relevant information for SPM Request';
                    Object.assign(badge.style, {
                        background: '#28a745', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const desc = document.createElement('span');
                    desc.textContent = 'Opens the SPM Copy modal above the ticket.';
                    Object.assign(desc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    btnRow.appendChild(badge);
                    btnRow.appendChild(desc);
                    body.appendChild(btnRow);
                    const mockField = document.createElement('div');
                    Object.assign(mockField.style, {
                        background: '#fff', border: '1px solid #ddd', borderRadius: '6px',
                        padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px'
                    });
                    const mockLabel = document.createElement('div');
                    mockLabel.textContent = '🔓 Opened By';
                    Object.assign(mockLabel.style, { fontWeight: 'bold', color: '#555', fontSize: '11px', fontFamily: 'Arial, sans-serif' });
                    const mockValueRow = document.createElement('div');
                    Object.assign(mockValueRow.style, { display: 'flex', gap: '8px', alignItems: 'center' });
                    const mockValue = document.createElement('div');
                    mockValue.textContent = 'Jane Smith';
                    Object.assign(mockValue.style, {
                        flex: '1', color: '#333', fontSize: '12px',
                        fontFamily: 'Courier New, monospace', background: '#f5f5f5',
                        padding: '6px 8px', borderRadius: '4px'
                    });
                    const mockCopyBtn = document.createElement('span');
                    mockCopyBtn.textContent = 'Copy';
                    Object.assign(mockCopyBtn.style, {
                        background: '#28a745', color: '#fff', borderRadius: '4px',
                        padding: '5px 14px', fontSize: '12px', fontWeight: 'bold',
                        fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap'
                    });
                    mockValueRow.appendChild(mockValue);
                    mockValueRow.appendChild(mockCopyBtn);
                    mockField.appendChild(mockLabel);
                    mockField.appendChild(mockValueRow);
                    body.appendChild(mockField);
                    caption(body, 'Each field gets its own Copy button. It briefly flashes blue with a checkmark after copying.');
                    bullets(body, [
                        'Fields included: Opened By, Requesting Member Firm, Business Justification, Number.',
                        'Only populated fields appear. Fields without a value are omitted from the modal.',
                        'Close the modal with the red X button in its top-right corner.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Sidebar Controls',
                buildContent(body) {
                    lead(body, 'Every control in the sidebar and what it does.');
                    const controls = [
                        { bg: '#e53e3e', color: '#fff', border: 'none',                   label: '×',                                              desc: 'Closes and hides the sidebar. Click the toolbar icon to reopen it.' },
                        { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', label: '🔄 Refresh',               desc: 'Re-reads all fields from the current ticket state. Use this after editing a field to see the updated value.' },
                        { bg: '#28a745',     color: '#fff', border: 'none',               label: '📋 Copy relevant information for SPM Request',   desc: 'Opens the SPM Copy modal.' },
                        { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help',                                       desc: 'Opens this Feature Guide.' }
                    ];
                    for (const ctrl of controls) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badgeEl = document.createElement('span');
                        badgeEl.textContent = ctrl.label;
                        Object.assign(badgeEl.style, {
                            background: ctrl.bg, color: ctrl.color, border: ctrl.border,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = ctrl.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(badgeEl);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }
                    const notifNote = document.createElement('div');
                    Object.assign(notifNote.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0', borderRadius: '6px',
                        padding: '8px 12px', fontSize: '12px', color: '#555',
                        fontFamily: 'Arial, sans-serif', lineHeight: '1.5', marginTop: '4px'
                    });
                    const notifDot = document.createElement('span');
                    notifDot.textContent = '● ';
                    Object.assign(notifDot.style, { color: '#007bff', fontWeight: 'bold' });
                    const notifLink = document.createElement('span');
                    notifLink.textContent = "What's New";
                    Object.assign(notifLink.style, { color: '#0066cc', textDecoration: 'underline', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' });
                    const notifText = document.createTextNode(' appears next to the version number when a script update has not been viewed yet. Click it to open the changelog.');
                    notifNote.appendChild(notifDot);
                    notifNote.appendChild(notifLink);
                    notifNote.appendChild(notifText);
                    body.appendChild(notifNote);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'miniSummarySidebarHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'miniSummarySidebarHelpModal';

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
        titleSub.textContent = `Mini Summary Sidebar • v${SCRIPT_VERSION}`;
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
     *  SIDEBAR INITIALIZATION
     * ==========================================================*/

    function initializeSidebar() {
        if (document.getElementById('mini-summary-sidebar')) return;

        const sidebar = document.createElement('div');
        sidebar.id = 'mini-summary-sidebar';
        Object.assign(sidebar.style, {
            position: 'fixed',
            top: '60px',
            right: '-420px', // Hidden by default — must exceed actual rendered width (350px content + 40px padding + 1px border = 391px)
            width: '350px',
            maxHeight: 'calc(100vh - 80px)',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            borderRight: 'none',
            boxShadow: '-4px 4px 12px rgba(0,0,0,0.1)',
            padding: '20px',
            zIndex: '999997', // Below toolbar and modals
            borderRadius: '10px 0 0 10px',
            fontFamily: 'Arial, sans-serif',
            overflowY: 'auto',
            overflowX: 'hidden',
            transition: 'right 0.3s ease-in-out'
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'red',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '4px 10px',
            fontWeight: 'bold',
            fontSize: '18px',
            lineHeight: '1'
        });
        closeButton.onclick = hideSidebar;
        sidebar.appendChild(closeButton);

        // Title row with ? Help pill
        const titleRow = document.createElement('div');
        Object.assign(titleRow.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            paddingRight: '35px'
        });
        const title = document.createElement('div');
        title.textContent = '📊 Ticket Summary';
        Object.assign(title.style, {
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333'
        });
        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px',
            border: '1px solid #c0c8f0', fontWeight: 'bold', userSelect: 'none',
            backgroundColor: 'transparent', transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, sans-serif', flexShrink: '0'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        titleRow.appendChild(title);
        titleRow.appendChild(helpBtn);
        sidebar.appendChild(titleRow);

        // Version row with changelog notification
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            display: 'flex',
            alignItems: 'center',
            fontSize: '11px',
            color: '#666',
            marginBottom: '15px',
            paddingRight: '30px',
            flexWrap: 'wrap'
        });

        const versionIndicator = document.createElement('span');
        versionIndicator.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionIndicator.style, {
            fontFamily: 'monospace',
            fontSize: '10px'
        });
        versionRow.appendChild(versionIndicator);

        // Check if there's a new version and user hasn't seen the changelog
        const showChangelog = isNewVersion() && !hasSeenChangelog();

        console.log('📊 Version check:', {
            currentVersion: SCRIPT_VERSION,
            storedVersion: getStoredVersion(),
            isNewVersion: isNewVersion(),
            hasSeenChangelog: hasSeenChangelog(),
            showChangelog: showChangelog
        });

        if (showChangelog) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'miniSummaryChangelogNotification';

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = "What's New";

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);

            changelogNotification.onclick = () => {
                showChangelogModal();
            };

            versionRow.appendChild(changelogNotification);
        }

        sidebar.appendChild(versionRow);

        // Refresh button
        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 Refresh';
        Object.assign(refreshButton.style, {
            padding: '6px 12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '8px',
            width: '100%'
        });
        refreshButton.onclick = updateSidebarContent;
        sidebar.appendChild(refreshButton);

        // Copy SPM button
        const spmButton = document.createElement('button');
        spmButton.textContent = '📋 Copy relevant information for SPM Request';
        Object.assign(spmButton.style, {
            padding: '6px 12px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            marginBottom: '15px',
            width: '100%'
        });
        spmButton.onclick = copySPMData;
        sidebar.appendChild(spmButton);

        // Content container
        const content = document.createElement('div');
        content.id = 'summary-content';
        Object.assign(content.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        });
        sidebar.appendChild(content);

        document.body.appendChild(sidebar);
        return sidebar;
    }

    function createField(label, value, icon = '📌') {
        const field = document.createElement('div');
        Object.assign(field.style, {
            background: '#ffffff',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '10px',
            fontSize: '12px'
        });

        const labelEl = document.createElement('div');
        labelEl.textContent = `${icon} ${label}`;
        Object.assign(labelEl.style, {
            fontWeight: 'bold',
            color: '#555',
            marginBottom: '4px',
            fontSize: '11px'
        });

        const valueEl = document.createElement('div');
        valueEl.textContent = value || 'N/A';
        Object.assign(valueEl.style, {
            color: '#333',
            fontSize: '12px',
            wordWrap: 'break-word',
            lineHeight: '1.4'
        });

        field.appendChild(labelEl);
        field.appendChild(valueEl);
        return field;
    }

    function createSection(title) {
        const section = document.createElement('div');
        section.textContent = title;
        Object.assign(section.style, {
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#667eea',
            marginTop: '10px',
            marginBottom: '5px',
            borderBottom: '2px solid #667eea',
            paddingBottom: '4px'
        });
        return section;
    }

    function updateSidebarContent() {
        const content = document.getElementById('summary-content');
        if (!content) return;

        // Clear existing content
        content.innerHTML = '';

        // Extract data
        const data = extractSummaryData();

        // Log extracted data for debugging
        console.log('📊 Extracted data:', data);

        // Basic Information Section
        content.appendChild(createSection('📋 Basic Info'));

        if (data.number && data.number !== 'N/A') {
            content.appendChild(createField('Number', data.number, '🎫'));
        }

        if (data.catalogItem && data.catalogItem !== 'N/A') {
            content.appendChild(createField('Catalog Item', data.catalogItem, '📦'));
        }

        // People Section
        content.appendChild(createSection('👥 People'));

        if (data.requestedFor && data.requestedFor !== 'N/A') {
            content.appendChild(createField('Requested For', data.requestedFor, '👤'));
        }

        if (data.openedBy && data.openedBy !== 'N/A') {
            content.appendChild(createField('Opened By', data.openedBy, '🔓'));
        }

        if (data.assignedTo && data.assignedTo !== 'N/A') {
            content.appendChild(createField('Assigned To', data.assignedTo, '👨‍💼'));
        }

        if (data.assignmentGroup && data.assignmentGroup !== 'N/A') {
            content.appendChild(createField('Assignment Group', data.assignmentGroup, '👥'));
        }

        // Technical Details Section
        content.appendChild(createSection('🔧 Technical Details'));

        if (data.memberFirm && data.memberFirm !== 'N/A') {
            content.appendChild(createField('Requesting Member Firm', data.memberFirm, '🏢'));
        }

        if (data.configItem && data.configItem !== 'N/A') {
            content.appendChild(createField('Configuration Item', data.configItem, '🖥️'));
        }

        if (data.platform && data.platform !== 'N/A') {
            content.appendChild(createField('Platform', data.platform, '🛡️'));
        }

        if (data.requestType && data.requestType !== 'N/A') {
            content.appendChild(createField('Request Type', data.requestType, '📋'));
        }

        if (data.applicationUrl && data.applicationUrl !== 'N/A') {
            content.appendChild(createField('Application / URL', data.applicationUrl, '🌐'));
        }

        // Dates Section
        content.appendChild(createSection('📅 Dates'));

        if (data.openedAt && data.openedAt !== 'N/A') {
            content.appendChild(createField('Opened', data.openedAt, '🕐'));
        }

        if (data.dueDate && data.dueDate !== 'N/A') {
            content.appendChild(createField('Due Date', data.dueDate, '⏰'));
        }

        // Description Section
        if (data.description && data.description !== 'N/A') {
            content.appendChild(createSection('📝 Description'));
            content.appendChild(createField('Details', data.description, '💬'));
        }

        console.log('✅ Summary updated!');
    }

    /* ==========================================================
     *  SPM COPY MODAL
     * ==========================================================*/

    function initializeSPMModal() {
        if (document.getElementById('spm-copy-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'spm-copy-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ccc',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
            padding: '50px 20px 20px 20px',
            zIndex: '999998',
            borderRadius: '10px',
            fontFamily: 'Arial, sans-serif',
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            minWidth: '600px',
            maxWidth: '700px',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto'
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'red',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: 'bold'
        });
        closeButton.onclick = () => modal.style.display = 'none';
        modal.appendChild(closeButton);

        // Title
        const title = document.createElement('div');
        title.textContent = '📋 SPM Request Information';
        Object.assign(title.style, {
            position: 'absolute',
            top: '12px',
            left: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333'
        });
        modal.appendChild(title);

        // Instructions
        const instructions = document.createElement('p');
        instructions.textContent = 'Click each "Copy" button to copy the field individually:';
        Object.assign(instructions.style, {
            fontSize: '13px',
            color: '#666',
            margin: '0',
            textAlign: 'center',
            width: '100%'
        });
        modal.appendChild(instructions);

        // Content container
        const content = document.createElement('div');
        content.id = 'spm-modal-content';
        Object.assign(content.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%'
        });
        modal.appendChild(content);

        document.body.appendChild(modal);
        return modal;
    }

    function createCopyField(label, value, icon = '📌') {
        const container = document.createElement('div');
        Object.assign(container.style, {
            background: '#ffffff',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        });

        // Label
        const labelEl = document.createElement('div');
        labelEl.textContent = `${icon} ${label}`;
        Object.assign(labelEl.style, {
            fontWeight: 'bold',
            color: '#555',
            fontSize: '12px'
        });
        container.appendChild(labelEl);

        // Value container
        const valueContainer = document.createElement('div');
        Object.assign(valueContainer.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start'
        });

        // Value display
        const valueEl = document.createElement('div');
        valueEl.textContent = value;
        Object.assign(valueEl.style, {
            flex: '1',
            color: '#333',
            fontSize: '12px',
            fontFamily: 'Courier New, monospace',
            background: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            wordWrap: 'break-word',
            lineHeight: '1.4',
            maxHeight: '150px',
            overflowY: 'auto'
        });

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        Object.assign(copyBtn.style, {
            padding: '6px 16px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
        });
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(value);
                const originalText = copyBtn.textContent;
                const originalBg = copyBtn.style.background;
                copyBtn.textContent = '✓ Copied!';
                copyBtn.style.background = '#0066cc';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = originalBg;
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                alert('❌ Failed to copy');
            }
        };

        valueContainer.appendChild(valueEl);
        valueContainer.appendChild(copyBtn);
        container.appendChild(valueContainer);

        return container;
    }

    function showSPMModal() {
        const modal = document.getElementById('spm-copy-modal');
        const content = document.getElementById('spm-modal-content');

        if (!modal || !content) {
            initializeSPMModal();
            return showSPMModal();
        }

        // Clear existing content
        content.innerHTML = '';

        // Extract data
        const data = extractSummaryData();

        // Add fields in order
        const fields = [
            { label: 'Opened By', value: data.openedBy, icon: '🔓' },
            { label: 'Requesting Member Firm', value: data.memberFirm, icon: '🏢' },
            { label: 'Business Justification', value: data.businessJustification, icon: '📝' },
            { label: 'Number', value: data.number, icon: '🎫' }
        ];

        let hasData = false;
        fields.forEach(field => {
            if (field.value && field.value !== 'N/A') {
                content.appendChild(createCopyField(field.label, field.value, field.icon));
                hasData = true;
            }
        });

        if (!hasData) {
            const noData = document.createElement('p');
            noData.textContent = '⚠️ No data available to copy';
            Object.assign(noData.style, {
                color: '#999',
                fontSize: '13px',
                textAlign: 'center',
                padding: '20px'
            });
            content.appendChild(noData);
        }

        modal.style.display = 'flex';
    }

    function copySPMData() {
        showSPMModal();
    }

    /* ==========================================================
     *  SHOW/HIDE SIDEBAR FUNCTIONS
     * ==========================================================*/

    function showSidebar() {
        const sidebar = document.getElementById('mini-summary-sidebar');
        if (sidebar) {
            sidebar.style.right = '0px';
            sidebarVisible = true;
            updateSidebarContent();
        }
    }

    function hideSidebar() {
        const sidebar = document.getElementById('mini-summary-sidebar');
        if (sidebar) {
            sidebar.style.right = '-420px';
            sidebarVisible = false;
        }
    }

    function toggleSidebar() {
        if (sidebarVisible) {
            hideSidebar();
        } else {
            showSidebar();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'miniSummary-notif-dot';

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
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarToolClicked', function(e) {
        if (e.detail.id === 'miniSummary') {
            console.log('📊 Mini Summary Sidebar clicked!');
            toggleSidebar();
        }
    });

        return function register() {
            initializeSidebar();
            initializeSPMModal();
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'Mini Summary Sidebar', position: 6 }
            }));
            if (typeof isNewVersion === 'function' && isNewVersion() && !hasSeenChangelog()) addToolbarNotificationDot();
        };
    })();

    /* === TOOL: ENHANCEMENT REQUEST LOGGER === */

    const registerEnhancementRequestLogger = (() => {
        'use strict';

    console.log('📋 Enhancement Request Logger loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.1.6';
    const CHANGELOG = `Version 1.1.6:
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
     *  HELPERS
     * ==========================================================*/


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
        clModal.appendChild(cardsWrap);

        clModal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(clModal);
        overlay.onclick = () => closeButton.click();
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
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarToolClicked', function (e) {
        if (e.detail.id === TOOL_ID) {
            console.log('📋 Enhancement Request Logger clicked!');
            showModal();
        }
    });

        return function register() {
            injectStyles();
            initializeModal();
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: TOOL_TOOLTIP, position: TOOL_POSITION }
            }));
            if (typeof isNewVersion === 'function' && isNewVersion() && !hasSeenChangelog()) addToolbarNotificationDot();
        };
    })();

    /* === TOOL: TICKET ASSIGNMENT TOOL === */

    /* === TOOL: URL LIST EDITOR === */

    /* === TOOL: SERVICENOW ROW HIGHLIGHTER === */

    const registerServiceNowRowHighlighter = (() => {
        'use strict';

    console.log('🎨 ServiceNow Row Highlighter loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '2.4.2';
    const CHANGELOG = `Version 2.4.2:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 2.4.1:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 2.4.0:
- Added a "? Help" button in the top right of the settings panel that opens a visual
  Feature Guide. The guide covers getting started, how row highlighting works, the SLA
  due date heat-map, the Light and Dark themes, and every control in the settings panel.

Version 2.3.5:
- Fixed dark mode compatibility: the config modal now forces light background and dark
  text on all inputs via CSS with !important so ServiceNow dark mode cannot override them.

Version 2.3.4:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 2.3.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 2.3.2:
- Fixed row highlighting and SLA heat-map not working on classic ServiceNow list views - script now searches inside iframes embedded in shadow roots to reach the ticket table.

Version 2.3.1:
- Fixed table detection to work across all ServiceNow view types - now scans any shadow host containing a ticket table, not just now-list elements.`;

    /* ==========================================================
     *  CONFIGURATION
     * ==========================================================*/

    // Tool icon - Highlight/Paint brush icon (representing row highlighting)
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.71,4.63L19.37,3.29C19,2.9 18.35,2.9 17.96,3.29L9,12.25L11.75,15L20.71,6.04C21.1,5.65 21.1,5 20.71,4.63M7,14A3,3 0 0,0 4,17C4,18.31 2.84,19 2,19C2.92,20.22 4.5,21 6,21A4,4 0 0,0 10,17A3,3 0 0,0 7,14Z"/>
    </svg>`;

    const TOOL_ID = 'rowHighlighter';

    // Global flags
    let isInitialized = false;

    // Storage keys
    const STORAGE_KEY = 'servicenow_highlighter_username';
    const THEME_STORAGE_KEY = 'servicenow_highlighter_theme';
    const VERSION_STORAGE_KEY = 'servicenow_highlighter_version';
    const CHANGELOG_SEEN_KEY = 'servicenow_highlighter_changelog_seen';
    const SLA_ENABLED_KEY = 'servicenow_highlighter_sla_enabled';
    const SLA_FORMAT_KEY  = 'servicenow_highlighter_sla_format';

    // State
    let targetUsername = null;
    let currentTheme = 'light';
    let slaHeatmapEnabled = false;
    let slaDateFormat = 'yyyy-MM-dd';

    // Theme configurations
    const THEMES = {
        light: {
            green: {
                background: '#d4edda',
                border: '#28a745'
            },
            red: {
                background: '#f8d7da',
                border: '#dc3545'
            }
        },
        dark: {
            green: {
                background: '#1a4d2e',
                border: '#4ade80'
            },
            red: {
                background: '#4d1a1a',
                border: '#ef4444'
            }
        }
    };

    const SLA_DATE_FORMATS = {
        'MM-dd-yyyy': { order: ['m','d','y'] },
        'dd/MM/yyyy': { order: ['d','m','y'] },
        'dd-MM-yyyy': { order: ['d','m','y'] },
        'dd.MM.yyyy': { order: ['d','m','y'] },
        'yyyy-MM-dd': { order: ['y','m','d'] },
    };

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue(VERSION_STORAGE_KEY, null);
    }

    function saveVersion(version) {
        GM_setValue(VERSION_STORAGE_KEY, version);
    }

    function hasSeenChangelog() {
        return GM_getValue(CHANGELOG_SEEN_KEY, null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue(CHANGELOG_SEEN_KEY, SCRIPT_VERSION);
    }

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'highlighterChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'highlighterChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'highlighter-version-info';
        versionInfo.textContent = `Row Highlighter has been updated to version ${SCRIPT_VERSION}!`;

        const closeButton = document.createElement('button');
        closeButton.className = 'highlighter-close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();

            // Remove the notification dot
            const notification = document.getElementById('highlighterChangelogNotification');
            if (notification) {
                notification.remove();
            }
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);

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
     *  STORAGE FUNCTIONS
     * ==========================================================*/

    function getStoredUsername() {
        return GM_getValue(STORAGE_KEY, null);
    }

    function saveUsername(username) {
        GM_setValue(STORAGE_KEY, username);
        targetUsername = username;
        console.log(`✅ Username saved: ${username}`);
    }

    function getStoredTheme() {
        return GM_getValue(THEME_STORAGE_KEY, 'light');
    }

    function saveTheme(theme) {
        GM_setValue(THEME_STORAGE_KEY, theme);
        currentTheme = theme;
        console.log(`✅ Theme saved: ${theme}`);
    }

    function toggleTheme() {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        saveTheme(newTheme);
        updateCustomCSS();
        highlightRowsWithClasses();
        return newTheme;
    }

    /* ==========================================================
     *  FIRST-RUN USERNAME PROMPT
     * ==========================================================*/

    function showFirstRunPrompt() {
        // Remove any existing prompt
        const existing = document.getElementById('highlighter-firstrun-overlay');
        if (existing) existing.remove();

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'highlighter-firstrun-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '1000002',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });

        // Card
        const card = document.createElement('div');
        Object.assign(card.style, {
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            padding: '32px 28px 24px',
            maxWidth: '420px',
            width: '90%',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        // Icon + Title row
        const titleRow = document.createElement('div');
        Object.assign(titleRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        const iconSpan = document.createElement('span');
        iconSpan.textContent = '🎨';
        iconSpan.style.fontSize = '24px';

        const titleText = document.createElement('h2');
        titleText.textContent = 'Row Highlighter Setup';
        Object.assign(titleText.style, {
            margin: '0',
            fontSize: '17px',
            fontWeight: 'bold',
            color: '#222222'
        });

        titleRow.appendChild(iconSpan);
        titleRow.appendChild(titleText);
        card.appendChild(titleRow);

        // Description
        const desc = document.createElement('p');
        desc.innerHTML = 'Enter your ServiceNow username to get started.<br><span style="color:#888;font-size:12px;">Rows updated by you will be highlighted <strong style="color:#28a745">green</strong>, others <strong style="color:#dc3545">red</strong>.</span>';
        Object.assign(desc.style, {
            margin: '0',
            fontSize: '13px',
            color: '#444444',
            lineHeight: '1.6'
        });
        card.appendChild(desc);

        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'e.g. jdoe';
        Object.assign(input.style, {
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #cccccc',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#333333'
        });

        // Highlight border on focus
        input.addEventListener('focus', () => input.style.borderColor = '#28a745');
        input.addEventListener('blur', () => input.style.borderColor = '#cccccc');

        card.appendChild(input);

        // Error message (hidden by default)
        const errorMsg = document.createElement('span');
        errorMsg.textContent = '⚠️ Please enter a username before saving.';
        Object.assign(errorMsg.style, {
            fontSize: '12px',
            color: '#dc3545',
            display: 'none',
            marginTop: '-8px'
        });
        card.appendChild(errorMsg);

        // Button row
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: '4px'
        });

        // Skip button
        const btnSkip = document.createElement('button');
        btnSkip.textContent = 'Skip for now';
        Object.assign(btnSkip.style, {
            padding: '9px 16px',
            border: '1px solid #cccccc',
            borderRadius: '6px',
            background: '#f5f5f5',
            color: '#555555',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        btnSkip.addEventListener('mouseover', () => btnSkip.style.background = '#e9e9e9');
        btnSkip.addEventListener('mouseout', () => btnSkip.style.background = '#f5f5f5');
        btnSkip.onclick = () => overlay.remove();

        // Save button
        const btnSave = document.createElement('button');
        btnSave.textContent = '💾 Save & Apply';
        Object.assign(btnSave.style, {
            padding: '9px 18px',
            border: 'none',
            borderRadius: '6px',
            background: '#28a745',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        btnSave.addEventListener('mouseover', () => btnSave.style.background = '#218838');
        btnSave.addEventListener('mouseout', () => btnSave.style.background = '#28a745');
        btnSave.onclick = () => {
            const value = input.value.trim();
            if (!value) {
                errorMsg.style.display = 'block';
                input.focus();
                return;
            }
            saveUsername(value);
            overlay.remove();

            // Update the config modal input if it's already rendered
            const configInput = document.getElementById('highlighter-username-input');
            if (configInput) configInput.value = value;

            const displayDiv = document.getElementById('current-username-display');
            if (displayDiv) updateCurrentUserDisplay(displayDiv);

            // Trigger highlighting
            setTimeout(() => highlightRowsWithClasses(), 1000);
            setTimeout(() => highlightRowsWithClasses(), 2500);
        };

        // Allow Enter key to submit
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnSave.click();
            if (e.key === 'Escape') btnSkip.click();
        });

        btnRow.appendChild(btnSkip);
        btnRow.appendChild(btnSave);
        card.appendChild(btnRow);

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Auto-focus input
        setTimeout(() => input.focus(), 80);
    }

    /* ==========================================================
     *  MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('highlighter-config-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'highlighter-config-modal';

        Object.assign(modal.style, {
            position: 'fixed',
            top: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f9f9f9',
            border: '1px solid #cccccc',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
            padding: '50px 20px 20px 20px',
            zIndex: '999998',
            borderRadius: '10px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            minWidth: '500px',
            maxWidth: '600px'
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: '#dc3545',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: 'bold',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '12px'
        });
        closeButton.onclick = () => modal.style.display = 'none';
        modal.appendChild(closeButton);

        // Help pill (top right, left of the close button)
        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            position: 'absolute',
            top: '7px',
            right: '38px',
            color: '#667eea',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: '3px',
            border: '1px solid #c0c8f0',
            fontWeight: 'bold',
            userSelect: 'none',
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => showHelpModal();
        modal.appendChild(helpBtn);

        // Title
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            position: 'absolute',
            top: '12px',
            left: '12px',
            fontSize: '12px',
            color: '#333333',
            fontWeight: 'bold',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        titleContainer.textContent = '🎨 Row Highlighter Settings';
        modal.appendChild(titleContainer);

        // Description
        const description = document.createElement('p');
        description.innerHTML = `Configure username to highlight in <span style="color: #28a745; font-weight: bold;">green</span> (other rows will be <span style="color: #dc3545; font-weight: bold;">red</span>)`;
        Object.assign(description.style, {
            fontSize: '13px',
            color: '#666666',
            margin: '0',
            textAlign: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        modal.appendChild(description);

        // Current username display
        const currentUserDiv = document.createElement('div');
        currentUserDiv.id = 'current-username-display';
        Object.assign(currentUserDiv.style, {
            width: '100%',
            padding: '10px',
            background: '#e9ecef',
            borderRadius: '6px',
            fontSize: '13px',
            textAlign: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        updateCurrentUserDisplay(currentUserDiv);
        modal.appendChild(currentUserDiv);

        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.style.width = '100%';

        const inputLabel = document.createElement('label');
        inputLabel.textContent = 'Username:';
        Object.assign(inputLabel.style, {
            display: 'block',
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#555555',
            marginBottom: '5px',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });

        const input = document.createElement('input');
        input.id = 'highlighter-username-input';
        input.type = 'text';
        input.placeholder = 'Enter username (e.g., jdoe)';
        input.value = getStoredUsername() || '';
        Object.assign(input.style, {
            width: '100%',
            padding: '10px',
            border: '1px solid #cccccc',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
            fontFamily: 'Arial, Helvetica, sans-serif',
            backgroundColor: '#ffffff',
            color: '#333333'
        });

        inputContainer.appendChild(inputLabel);
        inputContainer.appendChild(input);
        modal.appendChild(inputContainer);

        // Theme toggle container
        const themeContainer = document.createElement('div');
        Object.assign(themeContainer.style, {
            width: '100%',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '6px'
        });

        const themeInner = document.createElement('div');
        Object.assign(themeInner.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const themeLabel = document.createElement('div');
        Object.assign(themeLabel.style, {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '14px'
        });
        const themeIcon = currentTheme === 'light' ? '☀️' : '🌙';
        const themeText = currentTheme === 'light' ? 'Light' : 'Dark';
        themeLabel.innerHTML = `<strong style="color: #333333;">Theme:</strong>
            <span id="theme-display" style="color: #666666; margin-left: 10px;">${themeIcon} ${themeText} Mode</span>`;

        const themeButton = document.createElement('button');
        themeButton.id = 'highlighter-theme-toggle';
        themeButton.textContent = `Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'}`;
        Object.assign(themeButton.style, {
            padding: '8px 16px',
            fontSize: '14px',
            background: '#6c757d',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background 0.3s',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 'normal'
        });

        themeButton.addEventListener('click', () => {
            const newTheme = toggleTheme();
            const newThemeText = newTheme === 'light' ? 'Light' : 'Dark';
            const newThemeIcon = newTheme === 'light' ? '☀️' : '🌙';

            themeButton.textContent = `Switch to ${newTheme === 'light' ? 'Dark' : 'Light'}`;
            const themeDisplay = document.getElementById('theme-display');
            if (themeDisplay) {
                themeDisplay.textContent = `${newThemeIcon} ${newThemeText} Mode`;
            }
        });

        themeButton.addEventListener('mouseover', () => {
            themeButton.style.background = '#5a6268';
        });

        themeButton.addEventListener('mouseout', () => {
            themeButton.style.background = '#6c757d';
        });

        themeInner.appendChild(themeLabel);
        themeInner.appendChild(themeButton);
        themeContainer.appendChild(themeInner);
        modal.appendChild(themeContainer);

        // SLA Heatmap section
        const slaContainer = document.createElement('div');
        Object.assign(slaContainer.style, {
            width: '100%',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '6px'
        });

        const slaTopRow = document.createElement('div');
        Object.assign(slaTopRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
        });

        const slaTitleEl = document.createElement('div');
        slaTitleEl.innerHTML = '<strong style="color:#333333; font-family:Arial,Helvetica,sans-serif; font-size:14px;">📅 SLA Due Date Heat-map</strong>';

        const slaToggleBtn = document.createElement('button');
        Object.assign(slaToggleBtn.style, {
            padding: '6px 14px',
            fontSize: '13px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 'bold',
            transition: 'background 0.2s'
        });

        const slaLegendEl = document.createElement('div');
        Object.assign(slaLegendEl.style, {
            fontSize: '12px',
            color: '#666666',
            lineHeight: '1.6',
            fontFamily: 'Arial, Helvetica, sans-serif',
            marginBottom: '8px'
        });
        slaLegendEl.innerHTML =
            'Colours the left border of each row by due date urgency:&nbsp; ' +
            '<span style="color:#ff4444;font-weight:bold;">■</span> Expired / ≤1 day &nbsp; ' +
            '<span style="color:#ff8c00;font-weight:bold;">■</span> 2 days &nbsp; ' +
            '<span style="color:#9370db;font-weight:bold;">■</span> 3 days';

        const slaFormatRow = document.createElement('div');
        Object.assign(slaFormatRow.style, {
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px'
        });

        const slaFormatLabel = document.createElement('label');
        slaFormatLabel.textContent = 'Date format:';
        Object.assign(slaFormatLabel.style, {
            fontSize: '12px',
            color: '#555555',
            fontFamily: 'Arial, Helvetica, sans-serif',
            marginRight: '6px'
        });

        const slaFormatSelect = document.createElement('select');
        slaFormatSelect.id = 'highlighter-sla-format';
        Object.assign(slaFormatSelect.style, {
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #cccccc',
            borderRadius: '4px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            background: '#ffffff',
            color: '#333333',
            cursor: 'pointer'
        });
        Object.keys(SLA_DATE_FORMATS).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            if (key === slaDateFormat) opt.selected = true;
            slaFormatSelect.appendChild(opt);
        });
        slaFormatSelect.addEventListener('change', () => {
            slaDateFormat = slaFormatSelect.value;
            GM_setValue(SLA_FORMAT_KEY, slaDateFormat);
            highlightRowsWithClasses();
        });

        slaFormatRow.appendChild(slaFormatLabel);
        slaFormatRow.appendChild(slaFormatSelect);

        function refreshSLAToggle() {
            slaToggleBtn.textContent = slaHeatmapEnabled ? '✓ Enabled' : 'Disabled';
            slaToggleBtn.style.background = slaHeatmapEnabled ? '#28a745' : '#6c757d';
            slaToggleBtn.style.color = '#ffffff';
            slaFormatRow.style.display = slaHeatmapEnabled ? 'flex' : 'none';
        }

        slaToggleBtn.addEventListener('click', () => {
            slaHeatmapEnabled = !slaHeatmapEnabled;
            GM_setValue(SLA_ENABLED_KEY, slaHeatmapEnabled);
            refreshSLAToggle();
            if (slaHeatmapEnabled) {
                highlightRowsWithClasses();
            } else {
                clearSLAHeatmap();
            }
        });
        slaToggleBtn.addEventListener('mouseover', () => {
            slaToggleBtn.style.background = slaHeatmapEnabled ? '#218838' : '#5a6268';
        });
        slaToggleBtn.addEventListener('mouseout', () => {
            slaToggleBtn.style.background = slaHeatmapEnabled ? '#28a745' : '#6c757d';
        });

        slaTopRow.appendChild(slaTitleEl);
        slaTopRow.appendChild(slaToggleBtn);
        slaContainer.appendChild(slaTopRow);
        slaContainer.appendChild(slaLegendEl);
        slaContainer.appendChild(slaFormatRow);
        modal.appendChild(slaContainer);

        refreshSLAToggle();

        // Version row with changelog notification
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            width: '100%',
            padding: '10px',
            background: '#e9ecef',
            borderRadius: '6px',
            fontSize: '12px',
            textAlign: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
        });

        const versionText = document.createElement('span');
        versionText.textContent = `Version: ${SCRIPT_VERSION}`;
        Object.assign(versionText.style, {
            color: '#666666',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });
        versionRow.appendChild(versionText);

        // Add changelog notification badge if new version
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'highlighterChangelogNotification';

            const notificationDot = document.createElement('span');
            notificationDot.className = 'highlighter-notification-dot';

            const notificationText = document.createElement('span');
            notificationText.className = 'highlighter-notification-text';
            notificationText.textContent = "What's New";

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onclick = () => showChangelogModal();

            versionRow.appendChild(changelogNotification);
        }

        modal.appendChild(versionRow);

        // Save button
        const btnSave = document.createElement('button');
        btnSave.textContent = '💾 Save Settings';
        Object.assign(btnSave.style, {
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#28a745',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            width: '100%',
            transition: 'background 0.3s',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });

        btnSave.addEventListener('mouseover', () => {
            btnSave.style.background = '#218838';
        });

        btnSave.addEventListener('mouseout', () => {
            btnSave.style.background = '#28a745';
        });

        btnSave.onclick = () => {
            const username = input.value.trim();
            if (username) {
                saveUsername(username);
                updateCurrentUserDisplay(currentUserDiv);

                // Close modal first
                modal.style.display = 'none';

                // Show alert after a brief delay to ensure modal is closed
                setTimeout(() => {
                    alert('✅ Settings saved successfully!\n\nThe page will reload to apply the changes.');
                    console.log('✅ Settings saved, reloading page...');
                    location.reload();
                }, 100);
            } else {
                alert('⚠️ Please enter a username');
            }
        };
        modal.appendChild(btnSave);

        // Enter key handler
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnSave.click();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function updateCurrentUserDisplay(displayDiv) {
        const currentUser = getStoredUsername();
        if (currentUser) {
            displayDiv.innerHTML = `<strong style="color: #333333;">Current:</strong> <code style="background: #ffffff; padding: 2px 6px; border-radius: 3px; color: #333333; font-family: 'Courier New', monospace;">${currentUser}</code>`;
            displayDiv.style.color = '#28a745';
        } else {
            displayDiv.innerHTML = '<strong style="color: #333333;">No username configured</strong>';
            displayDiv.style.color = '#dc3545';
        }
    }

    /* ==========================================================
     *  SHOW MODAL
     * ==========================================================*/

    function showConfigModal() {
        const modal = document.getElementById('highlighter-config-modal');
        if (modal) {
            modal.style.display = 'flex';

            // Update current user display
            const displayDiv = document.getElementById('current-username-display');
            if (displayDiv) {
                updateCurrentUserDisplay(displayDiv);
            }

            // Focus input
            const input = document.getElementById('highlighter-username-input');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        }
    }

    /* ==========================================================
     *  FEATURE GUIDE MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('rowHighlighterHelpModal')) return;

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

        // menuMock: a white toolbar card that holds icon tiles side by side.
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

        // mockField: a rounded box that looks like a dropdown or text input on screen.
        function mockField(text, opts) {
            opts = opts || {};
            const box = document.createElement('div');
            Object.assign(box.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '6px', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px',
                background: '#fff', margin: '0 0 10px 0', maxWidth: '220px'
            });
            const t = document.createElement('span');
            t.textContent = text;
            Object.assign(t.style, { fontSize: '12px', color: '#444', fontFamily: 'monospace' });
            box.appendChild(t);
            if (opts.caret) {
                const car = document.createElement('span');
                car.textContent = '▾';
                Object.assign(car.style, { fontSize: '11px', color: '#999' });
                box.appendChild(car);
            }
            return box;
        }

        // fakeRow: a mock ticket row with a colored background and left border.
        function fakeRow(bgColor, borderColor, label) {
            const r = document.createElement('div');
            Object.assign(r.style, {
                background: bgColor, borderLeft: '4px solid ' + borderColor,
                padding: '7px 10px', fontSize: '12px', color: '#333',
                fontFamily: 'Arial, sans-serif'
            });
            r.textContent = label;
            return r;
        }

        // legendRow: a colored square next to a short label, for color keys.
        function legendRow(color, label) {
            const sq = document.createElement('span');
            Object.assign(sq.style, {
                width: '14px', height: '14px', borderRadius: '3px',
                background: color, display: 'inline-block', flexShrink: '0'
            });
            return hrow([ sq, span(label, { fontSize: '12px', color: '#555' }) ], { margin: '0 0 6px 0' });
        }

        // badgeRow: a colored button preview on the left with a description on the right.
        function badgeRow(body, item) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
            });
            const badge = document.createElement('span');
            badge.textContent = item.label;
            Object.assign(badge.style, {
                background: item.bg, color: item.color, border: item.border || 'none',
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

        // kvGrid: a two column key on the left, description on the right grid.
        function kvGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: '4px 0 0 0' });
            for (const [key, val] of pairs) {
                const keyEl = document.createElement('span');
                keyEl.textContent = key;
                Object.assign(keyEl.style, { fontSize: '12px', color: '#667eea', fontWeight: 'bold', padding: '2px 0', fontFamily: 'Arial, sans-serif' });
                const valEl = document.createElement('span');
                valEl.textContent = val;
                Object.assign(valEl.style, { fontSize: '12px', color: '#555', padding: '2px 0', fontFamily: 'Arial, sans-serif' });
                grid.appendChild(keyEl);
                grid.appendChild(valEl);
            }
            body.appendChild(grid);
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent(body) {
                    lead(body, 'Open the settings from the floating toolbar, then set your ServiceNow username.');
                    const pin = { bg: '#e8f0fe', border: '2px solid #667eea' };
                    body.appendChild(hrow([ menuMock([ toolSquare('🖌️', pin), menuSep(), toolSquare('📊'), toolSquare('📝') ]) ]));
                    caption(body, 'The Row Highlighter icon lives in the toolbar. Click it to open settings.');
                    bullets(body, [
                        'Click the Row Highlighter icon to open the settings panel.',
                        'On first use, a prompt asks for your ServiceNow username.',
                        'Open any ticket list and the colors apply automatically.'
                    ]);
                }
            },
            {
                icon: '🎨', title: 'Row Highlighting',
                buildContent(body) {
                    lead(body, 'Rows you last updated turn green, everyone else turns red, so your work stands out.');
                    const listMock = document.createElement('div');
                    Object.assign(listMock.style, {
                        border: '1px solid #e0e0e0', borderRadius: '6px',
                        overflow: 'hidden', maxWidth: '360px', marginBottom: '4px'
                    });
                    listMock.appendChild(fakeRow('#d4edda', '#28a745', 'INC0012345  updated by you'));
                    listMock.appendChild(fakeRow('#f8d7da', '#dc3545', 'INC0012346  updated by A. Patel'));
                    listMock.appendChild(fakeRow('#f8d7da', '#dc3545', 'INC0012347  updated by M. Lopez'));
                    body.appendChild(listMock);
                    caption(body, 'Works on any ticket list that shows the Updated By column.');
                    bullets(body, [
                        'Set your username in settings to turn this on.',
                        'Green marks rows whose Updated By matches you.',
                        'Red marks rows updated by anyone else.'
                    ]);
                }
            },
            {
                icon: '📅', title: 'SLA Heat-map',
                buildContent(body) {
                    lead(body, 'When a list shows a Due Date column, each row gets a colored left border by urgency.');
                    body.appendChild(legendRow('#ff4444', 'Expired or due within 1 day'));
                    body.appendChild(legendRow('#ff8c00', 'Due in 2 days'));
                    body.appendChild(legendRow('#9370db', 'Due in 3 days'));
                    const fmtLabel = span('Date format', { fontSize: '11px', color: '#777', display: 'block', margin: '10px 0 4px 0' });
                    body.appendChild(fmtLabel);
                    body.appendChild(mockField('yyyy-MM-dd', { caret: true }));
                    caption(body, 'Pick the date format your ServiceNow instance uses, otherwise the due dates will not be read correctly.');
                    bullets(body, [
                        'Turn it on with the SLA Due Date Heat-map toggle in settings.',
                        'Only rows due within three days are colored.'
                    ]);
                }
            },
            {
                icon: '🌗', title: 'Themes',
                buildContent(body) {
                    lead(body, 'Choose Light or Dark so the highlight colors match your ServiceNow theme.');
                    function themeCol(name, greenBg, redBg) {
                        const col = document.createElement('div');
                        Object.assign(col.style, { display: 'inline-flex', flexDirection: 'column', gap: '6px', alignItems: 'center' });
                        col.appendChild(span(name, { fontSize: '11px', color: '#666', fontWeight: 'bold' }));
                        const sw = document.createElement('div');
                        sw.style.cssText = 'display:flex; gap:6px;';
                        [greenBg, redBg].forEach(c => {
                            const s = document.createElement('div');
                            Object.assign(s.style, { width: '34px', height: '24px', borderRadius: '5px', background: c, border: '1px solid rgba(0,0,0,0.15)' });
                            sw.appendChild(s);
                        });
                        col.appendChild(sw);
                        return col;
                    }
                    body.appendChild(hrow([
                        themeCol('☀️ Light', '#d4edda', '#f8d7da'),
                        themeCol('🌙 Dark', '#1a4d2e', '#4d1a1a')
                    ], { gap: '24px' }));
                    caption(body, 'Each theme has its own green and red. Switch any time with the theme button in settings.');
                }
            },
            {
                icon: '⚙️', title: 'Settings',
                buildContent(body) {
                    lead(body, 'Everything is controlled from the panel that opens when you click the toolbar icon.');
                    badgeRow(body, { bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help', desc: 'Opens this Feature Guide. Sits in the top right of the panel.' });
                    badgeRow(body, { bg: 'transparent', color: '#0066cc', label: "🔵 What's New", desc: 'Appears with a pulsing dot when a new version is available, and opens the changelog.' });
                    badgeRow(body, { bg: '#6c757d', color: '#fff', label: 'Switch to Dark', desc: 'Flips between the Light and Dark highlight color sets.' });
                    badgeRow(body, { bg: '#28a745', color: '#fff', label: '✓ Enabled', desc: 'Turns the SLA due date heat-map on or off.' });
                    badgeRow(body, { bg: '#28a745', color: '#fff', label: '💾 Save Settings', desc: 'Saves your username and reloads the page to apply the changes.' });
                    kvGrid(body, [
                        ['Username', 'The ServiceNow username whose rows turn green.'],
                        ['Date format', 'The format your instance uses for due dates, read by the heat-map.']
                    ]);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'rowHighlighterHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'rowHighlighterHelpModal';

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
        const titleTextWrap = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, { fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Row Highlighter • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleTextWrap.appendChild(titleMain);
        titleTextWrap.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleTextWrap);
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
     *  CSS AND HIGHLIGHTING
     * ==========================================================*/

    function updateCustomCSS() {
        const existingStyle = document.getElementById('highlighter-custom-css');
        if (existingStyle) {
            existingStyle.remove();
        }

        const colors = THEMES[currentTheme];
        const style = document.createElement('style');
        style.id = 'highlighter-custom-css';
        style.textContent = `
            /* Z-INDEX HIERARCHY
             * Main Config Modal: 999998
             * Changelog Overlay: 1000000
             * Changelog Modal: 1000001
             * First-Run Prompt: 1000002
             */

            /* Old UI Support */
            tr.list_row.highlight-green {
                background-color: ${colors.green.background} !important;
                border-left: 4px solid ${colors.green.border} !important;
            }
            tr.list_row.highlight-red {
                background-color: ${colors.red.background} !important;
                border-left: 4px solid ${colors.red.border} !important;
            }
            tr.list_row.highlight-green td,
            tr.list_row.highlight-red td {
                background-color: inherit !important;
            }

            /* New UI Support - Ultra-specific selectors to override ServiceNow's is-even/is-odd/is-highlighted */
            table.now-list-table tr.now-list-table-row.highlight-green,
            table.now-list-table tr.now-list-table-row.highlight-green.is-even,
            table.now-list-table tr.now-list-table-row.highlight-green.is-odd,
            tr.now-list-table-row.highlight-green,
            tr.now-list-table-row.highlight-green.is-even,
            tr.now-list-table-row.highlight-green.is-odd,
            tr.highlight-green,
            [role="row"].highlight-green {
                background-color: ${colors.green.background} !important;
                background: ${colors.green.background} !important;
                border-left: 4px solid ${colors.green.border} !important;
            }

            table.now-list-table tr.now-list-table-row.highlight-red,
            table.now-list-table tr.now-list-table-row.highlight-red.is-even,
            table.now-list-table tr.now-list-table-row.highlight-red.is-odd,
            tr.now-list-table-row.highlight-red,
            tr.now-list-table-row.highlight-red.is-even,
            tr.now-list-table-row.highlight-red.is-odd,
            tr.highlight-red,
            [role="row"].highlight-red {
                background-color: ${colors.red.background} !important;
                background: ${colors.red.background} !important;
                border-left: 4px solid ${colors.red.border} !important;
            }

            /* Override for all cells within highlighted rows */
            table.now-list-table tr.now-list-table-row.highlight-green td,
            table.now-list-table tr.now-list-table-row.highlight-red td,
            tr.now-list-table-row.highlight-green td,
            tr.now-list-table-row.highlight-red td,
            tr.highlight-green td,
            tr.highlight-red td,
            [role="row"].highlight-green [role="cell"],
            [role="row"].highlight-red [role="cell"] {
                background-color: inherit !important;
                background: inherit !important;
            }

            /* Hover states for new UI */
            table.now-list-table tr.now-list-table-row.highlight-green:hover,
            table.now-list-table tr.now-list-table-row.highlight-green.is-even:hover,
            table.now-list-table tr.now-list-table-row.highlight-green.is-odd:hover,
            tr.now-list-table-row.highlight-green:hover,
            tr.now-list-table-row.highlight-green.is-even:hover,
            tr.now-list-table-row.highlight-green.is-odd:hover {
                background-color: ${colors.green.hover || colors.green.background} !important;
                background: ${colors.green.hover || colors.green.background} !important;
            }

            table.now-list-table tr.now-list-table-row.highlight-red:hover,
            table.now-list-table tr.now-list-table-row.highlight-red.is-even:hover,
            table.now-list-table tr.now-list-table-row.highlight-red.is-odd:hover,
            tr.now-list-table-row.highlight-red:hover,
            tr.now-list-table-row.highlight-red.is-even:hover,
            tr.now-list-table-row.highlight-red.is-odd:hover {
                background-color: ${colors.red.hover || colors.red.background} !important;
                background: ${colors.red.hover || colors.red.background} !important;
            }

            /* Changelog Notification Styles */
            #highlighterChangelogNotification {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                cursor: pointer !important;
                padding: 3px 8px !important;
                border-radius: 4px !important;
                transition: background-color 0.2s ease !important;
                background-color: transparent !important;
            }

            #highlighterChangelogNotification:hover {
                background-color: #d0d0d0 !important;
            }

            #highlighterChangelogNotification .highlighter-notification-dot {
                width: 8px !important;
                height: 8px !important;
                border-radius: 50% !important;
                animation: highlighterColorPulse 1s ease-in-out infinite !important;
            }

            @keyframes highlighterColorPulse {
                0%, 100% { background-color: #007bff; }
                50% { background-color: #ff8c00; }
            }

            #highlighterChangelogNotification .highlighter-notification-text {
                font-size: 11px !important;
                color: #0066cc !important;
                text-decoration: underline !important;
                font-family: Arial, sans-serif !important;
                font-weight: normal !important;
            }

            /* Changelog Modal Styles */
            #highlighterChangelogModal {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 1000001 !important;
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

            #highlighterChangelogModal h2 {
                margin-top: 0 !important;
                margin-bottom: 15px !important;
                color: #333333 !important;
                border-bottom: 2px solid #667eea !important;
                padding-bottom: 10px !important;
                font-size: 1.5em !important;
                font-weight: bold !important;
                font-family: Arial, sans-serif !important;
            }

            #highlighterChangelogModal .highlighter-version-info {
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

            #highlighterChangelogModal .highlighter-changelog-content {
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

            #highlighterChangelogModal .highlighter-close-changelog {
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

            #highlighterChangelogModal .highlighter-close-changelog:hover {
                background-color: #5568d3 !important;
            }

            #highlighterChangelogOverlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 1000000 !important;
            }

            /* Dark mode isolation */
            #highlighter-config-modal { color: #333333 !important; }
            #highlighter-config-modal input, #highlighter-config-modal select,
            #highlighter-config-modal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }

            /* Feature Guide Modal */
            #rowHighlighterHelpModalOverlay {
                position: fixed !important;
                top: 0 !important; left: 0 !important;
                width: 100% !important; height: 100% !important;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 1000004 !important;
            }
            #rowHighlighterHelpModal {
                position: fixed !important;
                top: 50% !important; left: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 1000005 !important;
                background: #ffffff !important;
                border: 2px solid #333333 !important;
                padding: 20px !important;
                border-radius: 10px !important;
                width: 640px !important;
                max-width: 92vw !important;
                max-height: 82vh !important;
                overflow-y: auto !important;
                color: #333333 !important;
                font-family: Arial, sans-serif !important;
            }
            #rowHighlighterHelpModal input, #rowHighlighterHelpModal select,
            #rowHighlighterHelpModal textarea {
                background-color: #ffffff !important;
                color: #333333 !important;
            }
        `;
        document.head.appendChild(style);
        console.log(`✅ CSS updated for ${currentTheme} theme`);
    }

    /* ==========================================================
     *  SLA HEATMAP LOGIC
     * ==========================================================*/

    function parseSLADate(dateStr) {
        if (!dateStr) return null;
        dateStr = dateStr.trim();
        const fmt = SLA_DATE_FORMATS[slaDateFormat] || SLA_DATE_FORMATS['yyyy-MM-dd'];
        const { order } = fmt;
        const match = dateStr.match(/^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (match) {
            const [, seg1, seg2, seg3, h = '0', min = '0', s = '0'] = match;
            const parts = { [order[0]]: seg1, [order[1]]: seg2, [order[2]]: seg3 };
            return new Date(+parts.y, +parts.m - 1, +parts.d, +h, +min, +s);
        }
        const fallback = new Date(dateStr);
        return isNaN(fallback) ? null : fallback;
    }

    function getSLABorderColor(dateStr) {
        const due = parseSLADate(dateStr);
        if (!due) return null;
        const diffMs = due - new Date();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffMs < 0)  return '#ff4444'; // expired
        if (days <= 1)   return '#ff4444'; // today or 1 day
        if (days === 2)  return '#ff8c00'; // 2 days
        if (days === 3)  return '#9370db'; // 3 days
        return null;
    }

    function showSLAFormatPicker() {
        if (document.getElementById('sla-format-picker-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'sla-format-picker-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '1000003',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Arial, Helvetica, sans-serif'
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#ffffff', borderRadius: '8px',
            padding: '28px 32px', maxWidth: '460px', width: '90%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)'
        });

        const title = document.createElement('h2');
        title.textContent = '📅 SLA Heat-map — Date Format';
        Object.assign(title.style, { margin: '0 0 10px', fontSize: '16px', color: '#1d1d1d' });

        const hint = document.createElement('p');
        Object.assign(hint.style, { margin: '0 0 6px', fontSize: '13px', color: '#555', lineHeight: '1.6' });
        hint.textContent = 'Select the date format your ServiceNow instance uses for due dates.';

        const howTo = document.createElement('p');
        Object.assign(howTo.style, {
            margin: '0 0 20px', fontSize: '12px', color: '#777', lineHeight: '1.6',
            borderLeft: '3px solid #e0e0e0', paddingLeft: '10px'
        });
        howTo.innerHTML =
            'Check the <strong>Due Date</strong> field on any ticket, or go to your ' +
            '<strong>Profile</strong> (top-right → <em>Profile</em>) and look for ' +
            '<strong>Date format</strong>. If it shows <strong>None</strong>, your format is ' +
            '<strong>yyyy-MM-dd</strong>.<br><br>This can be changed later in the Row Highlighter settings.';

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', flexDirection: 'column', gap: '10px' });

        Object.keys(SLA_DATE_FORMATS).forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = key;
            Object.assign(btn.style, {
                padding: '10px 14px', fontSize: '13px', textAlign: 'left',
                cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px',
                background: '#f7f7f7', color: '#1d1d1d', transition: 'background 0.15s',
                fontFamily: 'Arial, Helvetica, sans-serif'
            });
            btn.onmouseover = () => { btn.style.background = '#e8f0fe'; };
            btn.onmouseout  = () => { btn.style.background = '#f7f7f7'; };
            btn.onclick = () => {
                slaDateFormat = key;
                GM_setValue(SLA_FORMAT_KEY, key);
                overlay.remove();
                const sel = document.getElementById('highlighter-sla-format');
                if (sel) sel.value = key;
                highlightRowsWithClasses();
            };
            btnGroup.appendChild(btn);
        });

        box.append(title, hint, howTo, btnGroup);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    function clearSLAHeatmap() {
        // Old UI
        let tbody = null;
        for (const doc of getAccessibleDocuments()) {
            tbody = doc.querySelector('tbody.list2_body');
            if (tbody) break;
        }
        if (tbody) {
            tbody.querySelectorAll('td.vt[headers*="due_date"]').forEach(cell => {
                cell.style.removeProperty('box-shadow');
                cell.style.removeProperty('border-left');
            });
            return;
        }
        // New UI — any shadow host or light DOM
        findListTables().forEach(table => {
            table.querySelectorAll('td[data-column-key="due_date"], td[data-column-key*="due"]').forEach(cell => {
                cell.style.removeProperty('box-shadow');
                cell.style.removeProperty('border-left');
            });
        });
    }

    function applySLAHeatmap() {
        if (!slaHeatmapEnabled) return;

        // Old UI
        let tbody = null;
        for (const doc of getAccessibleDocuments()) {
            tbody = doc.querySelector('tbody.list2_body');
            if (tbody) break;
        }
        if (tbody) {
            tbody.querySelectorAll('tr.list_row').forEach(row => {
                const cell = row.querySelector('td.vt[headers*="due_date"]');
                if (!cell) return;
                const color = getSLABorderColor(cell.textContent.trim());
                if (color) {
                    cell.style.setProperty('box-shadow', `inset 4px 0 0 ${color}`, 'important');
                    cell.style.setProperty('border-left', `4px solid ${color}`, 'important');
                } else {
                    cell.style.removeProperty('box-shadow');
                    cell.style.removeProperty('border-left');
                }
            });
            return;
        }

        // New UI — any shadow host or light DOM
        findListTables().forEach(table => {
            table.querySelectorAll('tr.now-list-table-row').forEach(row => {
                const cell = row.querySelector('td[data-column-key="due_date"]') ||
                             row.querySelector('td[data-column-key*="due"]');
                if (!cell) return;
                const content = cell.querySelector('.cell-content');
                const dateStr = content
                    ? (content.getAttribute('data-tooltip') || content.textContent.trim())
                    : cell.textContent.trim();
                const color = getSLABorderColor(dateStr);
                if (color) {
                    cell.style.setProperty('box-shadow', `inset 4px 0 0 ${color}`, 'important');
                    cell.style.setProperty('border-left', `4px solid ${color}`, 'important');
                } else {
                    cell.style.removeProperty('box-shadow');
                    cell.style.removeProperty('border-left');
                }
            });
        });
    }

    /* ==========================================================
     *  NEW HIGHLIGHTING LOGIC FOR NEW UI
     * ==========================================================*/

    // Recursively collect every Element reachable through shadow roots
    function findAllShadowRoots(root = document.body) {
        const elements = [];

        function traverse(node) {
            // Add current node if it's an element
            if (node instanceof Element) {
                elements.push(node);
            }

            // If this node has a shadow root, traverse it
            if (node.shadowRoot) {
                traverse(node.shadowRoot);
            }

            // Traverse all children
            const children = node.children || node.childNodes;
            for (let child of children) {
                if (child instanceof Element) {
                    traverse(child);
                }
            }
        }

        traverse(root);
        return elements;
    }

    // Returns all same-origin documents reachable from the current page,
    // including documents inside iframes nested in shadow roots.
    function getAccessibleDocuments() {
        const docs = [document];
        const visited = new WeakSet([document]);

        function addIframesFromBody(body) {
            if (!body) return;
            findAllShadowRoots(body)
                .filter(el => el.tagName === 'IFRAME')
                .forEach(iframe => {
                    try {
                        const idoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (!idoc || visited.has(idoc)) return;
                        visited.add(idoc);
                        docs.push(idoc);
                        addIframesFromBody(idoc.body);
                    } catch(e) {}
                });
        }

        addIframesFromBody(document.body);
        return docs;
    }

    // Returns every table.now-list-table reachable from any document, shadow root, or iframe
    function findListTables() {
        const tables = new Set();
        getAccessibleDocuments().forEach(doc => {
            doc.querySelectorAll('table.now-list-table').forEach(t => tables.add(t));
            if (doc.body) {
                findAllShadowRoots(doc.body)
                    .filter(el => el.shadowRoot)
                    .forEach(el => el.shadowRoot.querySelectorAll('table.now-list-table').forEach(t => tables.add(t)));
            }
        });
        return Array.from(tables);
    }

    function highlightRowsWithClasses() {
        if (!targetUsername) {
            console.log('⏳ No target username set yet');
            applySLAHeatmap();
            return false;
        }

        // Get current theme colors
        const colors = THEMES[currentTheme];
        let processedCount = 0;

        console.log('🔍 SHADOW DOM SEARCH: Looking for tables...');

        // Re-attach pagination listeners every time we highlight (to catch dynamically loaded pagination)
        setTimeout(() => {
            attachPaginationListeners();
        }, 100);

        // Try old UI first (backward compatibility)
        let tbody = null;
        for (const doc of getAccessibleDocuments()) {
            tbody = doc.querySelector('tbody.list2_body');
            if (tbody) break;
        }
        if (tbody) {
            const rows = tbody.querySelectorAll('tr.list_row');
            if (rows.length > 0) {
                console.log(`🎨 Found ${rows.length} rows in old UI format`);

                const hasUpdatedByCol = !!tbody.querySelector('td.vt[headers*="sys_updated_by"]');
                console.log(`    Updated By column present: ${hasUpdatedByCol}`);

                if (hasUpdatedByCol) {
                    rows.forEach((row) => {
                        const updatedByCell = row.querySelector('td.vt[headers*="sys_updated_by"]');
                        if (!updatedByCell) return;
                        const updatedByValue = updatedByCell.textContent.trim();

                        row.classList.remove('highlight-green', 'highlight-red', 'is-highlighted');

                        if (updatedByValue === targetUsername) {
                            row.classList.add('highlight-green');
                            row.style.setProperty('background-color', colors.green.background, 'important');
                            row.style.setProperty('background', colors.green.background, 'important');
                            row.style.setProperty('border-left', `4px solid ${colors.green.border}`, 'important');

                            const hoverColor = colors.green.hover || colors.green.background;
                            row.addEventListener('mouseenter', function() {
                                this.style.setProperty('background-color', hoverColor, 'important');
                                this.style.setProperty('background', hoverColor, 'important');
                            });
                            row.addEventListener('mouseleave', function() {
                                this.style.setProperty('background-color', colors.green.background, 'important');
                                this.style.setProperty('background', colors.green.background, 'important');
                            });

                            processedCount++;
                        } else if (updatedByValue !== '') {
                            row.classList.add('highlight-red');
                            row.style.setProperty('background-color', colors.red.background, 'important');
                            row.style.setProperty('background', colors.red.background, 'important');
                            row.style.setProperty('border-left', `4px solid ${colors.red.border}`, 'important');

                            const hoverColor = colors.red.hover || colors.red.background;
                            row.addEventListener('mouseenter', function() {
                                this.style.setProperty('background-color', hoverColor, 'important');
                                this.style.setProperty('background', hoverColor, 'important');
                            });
                            row.addEventListener('mouseleave', function() {
                                this.style.setProperty('background-color', colors.red.background, 'important');
                                this.style.setProperty('background', colors.red.background, 'important');
                            });

                            processedCount++;
                        }
                    });
                }

                applySLAHeatmap();
                return processedCount > 0;
            }
        }

        // Search every table.now-list-table reachable from light DOM or any shadow root
        console.log('🔍 Searching for ticket tables...');
        const tables = findListTables();
        console.log(`  Found ${tables.length} table(s)`);

        tables.forEach((table, index) => {
            const rows = table.querySelectorAll('tr.now-list-table-row');
            console.log(`  Table #${index + 1}: ${rows.length} rows`);

            const hasUpdatedByCol = !!table.querySelector('[data-column-key="sys_updated_by"]');
            if (!hasUpdatedByCol) {
                console.log(`    ⏭️ No 'Updated By' column - skipping row highlighting`);
                return;
            }

            rows.forEach(row => {
                const updatedByCell = row.querySelector('td[data-column-key="sys_updated_by"]');
                if (!updatedByCell) return;

                let updatedByValue = '';
                const cellContent = updatedByCell.querySelector('.cell-content');
                if (cellContent) {
                    updatedByValue = cellContent.getAttribute('data-tooltip') || cellContent.textContent.trim();
                } else {
                    updatedByValue = updatedByCell.textContent.trim();
                }

                row.classList.remove('highlight-green', 'highlight-red', 'is-highlighted');

                if (updatedByValue === targetUsername) {
                    row.classList.add('highlight-green');
                    row.style.setProperty('background-color', colors.green.background, 'important');
                    row.style.setProperty('background', colors.green.background, 'important');
                    row.style.setProperty('border-left', `4px solid ${colors.green.border}`, 'important');

                    const hoverColor = colors.green.hover || colors.green.background;
                    row.addEventListener('mouseenter', function() {
                        this.style.setProperty('background-color', hoverColor, 'important');
                        this.style.setProperty('background', hoverColor, 'important');
                    });
                    row.addEventListener('mouseleave', function() {
                        this.style.setProperty('background-color', colors.green.background, 'important');
                        this.style.setProperty('background', colors.green.background, 'important');
                    });

                    processedCount++;
                    console.log(`      ✅ GREEN: ${updatedByValue}`);
                } else if (updatedByValue !== '' && updatedByValue !== 'Updated By') {
                    row.classList.add('highlight-red');
                    row.style.setProperty('background-color', colors.red.background, 'important');
                    row.style.setProperty('background', colors.red.background, 'important');
                    row.style.setProperty('border-left', `4px solid ${colors.red.border}`, 'important');

                    const hoverColor = colors.red.hover || colors.red.background;
                    row.addEventListener('mouseenter', function() {
                        this.style.setProperty('background-color', hoverColor, 'important');
                        this.style.setProperty('background', hoverColor, 'important');
                    });
                    row.addEventListener('mouseleave', function() {
                        this.style.setProperty('background-color', colors.red.background, 'important');
                        this.style.setProperty('background', colors.red.background, 'important');
                    });

                    processedCount++;
                    console.log(`      ❌ RED: ${updatedByValue}`);
                }
            });
        });

        // Attach persistent shadow observer so future table re-renders are caught automatically
        attachShadowObserver();

        if (processedCount > 0) {
            console.log(`✅ Highlighted ${processedCount} rows`);
        } else {
            console.log('⏳ No rows found to highlight');
        }

        applySLAHeatmap();
        return processedCount > 0;
    }

    /* ==========================================================
     *  SHADOW DOM OBSERVER  (persistent — survives polling window)
     *  Attaches a MutationObserver directly to each now-list shadow root
     *  so table re-renders (pagination, sort, filter) are caught even
     *  after the startup polling interval has ended.
     * ==========================================================*/

    function attachShadowObserver() {
        const allRoots = [];
        getAccessibleDocuments().forEach(doc => {
            if (doc.body) findAllShadowRoots(doc.body).forEach(el => allRoots.push(el));
        });
        allRoots
            .filter(el => el.shadowRoot && el.shadowRoot.querySelector('table.now-list-table'))
            .forEach(host => {
                if (host._shadowObserverAttached) return;
                host._shadowObserverAttached = true;
                let debounce = null;
                new MutationObserver(() => {
                    if (!targetUsername) return;
                    clearTimeout(debounce);
                    debounce = setTimeout(() => highlightRowsWithClasses(), 400);
                }).observe(host.shadowRoot, { childList: true, subtree: true });
            });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'rowHighlighter-notif-dot';

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
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarToolClicked', function(e) {
        if (e.detail.id === 'rowHighlighter') {
            console.log('🎨 Row Highlighter clicked!');
            showConfigModal();
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
            console.log('Row Highlighter already initialized');
            return;
        }

        console.log(`Initializing Row Highlighter v${SCRIPT_VERSION}...`);
        isInitialized = true;

        // Load stored settings
        currentTheme = getStoredTheme();
        targetUsername = getStoredUsername();
        slaHeatmapEnabled = GM_getValue(SLA_ENABLED_KEY, true);
        const storedSLAFormat = GM_getValue(SLA_FORMAT_KEY, null);
        if (storedSLAFormat !== null) {
            slaDateFormat = storedSLAFormat;
        } else if (slaHeatmapEnabled) {
            setTimeout(() => showSLAFormatPicker(), 1500);
        }

        console.log(`Using theme: ${currentTheme}`);
        if (targetUsername) {
            console.log(`Using stored username: ${targetUsername}`);
        } else {
            console.log('⚠️ No username configured - showing first-run prompt');
        }

        // Version check logging
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        console.log('Version check:', {
            currentVersion: SCRIPT_VERSION,
            storedVersion: getStoredVersion(),
            isNewVersion: isNewVersion(),
            hasSeenChangelog: hasSeenChangelog(),
            showChangelog: showChangelog
        });

        // Add CSS and modal
        updateCustomCSS();
        initializeModal();
        console.log('✅ Row Highlighter modal ready!');

        // Show first-run prompt if no username is stored
        if (!targetUsername) {
            // Small delay so the page has started rendering
            setTimeout(() => showFirstRunPrompt(), 800);
        } else {
            // Start highlighting if username is set
            setTimeout(() => {
                console.log('🔍 First highlight attempt...');
                highlightRowsWithClasses();
            }, 2000);

            setTimeout(() => {
                console.log('🔍 Second highlight attempt (3s)...');
                highlightRowsWithClasses();
            }, 3000);

            setTimeout(() => {
                console.log('🔍 Third highlight attempt (5s)...');
                highlightRowsWithClasses();
            }, 5000);

            setTimeout(() => {
                console.log('🔍 Fourth highlight attempt (8s)...');
                highlightRowsWithClasses();
            }, 8000);
        }

        // Set up MutationObserver for dynamic content (including shadow DOM)
        const observer = new MutationObserver(function(mutations) {
            if (targetUsername) {
                const hasRelevantChanges = mutations.some(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (let node of mutation.addedNodes) {
                            if (node.nodeType === 1) {
                                if (node.tagName === 'TABLE' ||
                                    node.tagName === 'TBODY' ||
                                    node.tagName === 'TR' ||
                                    node.querySelector('table') ||
                                    node.querySelector('tr.now-list-table-row')) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                });

                if (hasRelevantChanges) {
                    console.log('🔍 Table content detected by MutationObserver, highlighting...');
                    highlightRowsWithClasses();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Retry highlighting periodically
        if (targetUsername) {
            let attempts = 0;
            const maxAttempts = 60;
            const retryInterval = setInterval(() => {
                attempts++;

                const tableCount = document.querySelectorAll('table').length;
                const rowCount = document.querySelectorAll('tr.now-list-table-row').length;

                if (attempts % 5 === 0) {
                    console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} - Tables: ${tableCount}, Rows: ${rowCount}`);
                }

                highlightRowsWithClasses();

                if (attempts >= maxAttempts) {
                    clearInterval(retryInterval);
                    console.log(`⚠️ Startup polling complete — shadow observer active for ongoing coverage`);
                }
            }, 2000);
        }

        // Listen for ServiceNow events
        if (window.CustomEvent && window.CustomEvent.observe) {
            window.CustomEvent.observe('list.loaded', function() {
                console.log('ServiceNow list.loaded event fired');
                if (targetUsername) {
                    setTimeout(highlightRowsWithClasses, 500);
                }
            });

            window.CustomEvent.observe('partial.page.reload', function() {
                console.log('ServiceNow partial.page.reload event fired');
                if (targetUsername) {
                    setTimeout(highlightRowsWithClasses, 500);
                }
            });
        }

        window.addEventListener('load', function() {
            console.log('🔍 Window load event fired, attempting highlight...');
            if (targetUsername) {
                setTimeout(highlightRowsWithClasses, 1000);
            }
        });

        // Listen for pagination clicks
        document.addEventListener('click', function(e) {
            const clickedElement = e.target;
            let isPaginationClick = false;

            let element = clickedElement;
            let depth = 0;
            while (element && element !== document.body && depth < 20) {
                depth++;
                if (element.tagName === 'NOW-PAGINATION-CONTROL' ||
                    element.tagName === 'NOW-BUTTON-ICONIC' ||
                    element.tagName === 'NOW-ICON' ||
                    element.classList?.contains('now-pagination-control-button') ||
                    element.classList?.contains('now-pagination-control-button-iconic') ||
                    element.classList?.contains('now-button-iconic') ||
                    element.classList?.contains('now-icon') ||
                    element.getAttribute('data-testid')?.includes('page') ||
                    element.getAttribute('data-testid')?.includes('go-to') ||
                    element.getAttribute('aria-label')?.toLowerCase().includes('page') ||
                    element.getAttribute('aria-label')?.toLowerCase().includes('next') ||
                    element.getAttribute('aria-label')?.toLowerCase().includes('previous') ||
                    element.getAttribute('aria-label')?.toLowerCase().includes('first') ||
                    element.getAttribute('aria-label')?.toLowerCase().includes('last')) {
                    isPaginationClick = true;
                    console.log(`🎯 Pagination click detected at depth ${depth}: ${element.tagName}`);
                    break;
                }

                if (element.parentNode) {
                    element = element.parentNode;
                } else if (element.host) {
                    element = element.host;
                } else {
                    break;
                }
            }

            if (!isPaginationClick) {
                const ariaLabel = clickedElement.getAttribute?.('aria-label') || '';
                const dataTestId = clickedElement.getAttribute?.('data-testid') || '';
                const classList = Array.from(clickedElement.classList || []).join(' ');

                if (ariaLabel.match(/page|next|previous|first|last/i) ||
                    dataTestId.match(/page|go-to/i) ||
                    classList.match(/pagination|page-/i)) {
                    isPaginationClick = true;
                }
            }

            if (isPaginationClick && targetUsername) {
                setTimeout(() => highlightRowsWithClasses(), 500);
                setTimeout(() => highlightRowsWithClasses(), 1000);
                setTimeout(() => highlightRowsWithClasses(), 1500);
                setTimeout(() => highlightRowsWithClasses(), 2500);
            }
        }, true);

        function attachPaginationListeners() {
            const allElements = findAllShadowRoots();
            const paginationControls = allElements.filter(el =>
                el.tagName && el.tagName.toLowerCase() === 'now-pagination-control'
            );

            console.log(`🔍 Found ${paginationControls.length} pagination controls`);

            let buttonCount = 0;
            paginationControls.forEach(control => {
                if (control.shadowRoot) {
                    const buttons = control.shadowRoot.querySelectorAll('button, now-button-iconic, .now-pagination-control-button');
                    buttons.forEach(button => {
                        if (!button.hasAttribute('data-highlight-listener')) {
                            button.setAttribute('data-highlight-listener', 'true');
                            button.addEventListener('click', function() {
                                if (targetUsername) {
                                    setTimeout(() => highlightRowsWithClasses(), 500);
                                    setTimeout(() => highlightRowsWithClasses(), 1000);
                                    setTimeout(() => highlightRowsWithClasses(), 1500);
                                }
                            }, true);
                            buttonCount++;
                        }
                    });

                    const iconicButtons = control.shadowRoot.querySelectorAll('now-button-iconic');
                    iconicButtons.forEach(iconic => {
                        if (iconic.shadowRoot) {
                            const innerButtons = iconic.shadowRoot.querySelectorAll('button');
                            innerButtons.forEach(button => {
                                if (!button.hasAttribute('data-highlight-listener')) {
                                    button.setAttribute('data-highlight-listener', 'true');
                                    button.addEventListener('click', function() {
                                        if (targetUsername) {
                                            setTimeout(() => highlightRowsWithClasses(), 500);
                                            setTimeout(() => highlightRowsWithClasses(), 1000);
                                            setTimeout(() => highlightRowsWithClasses(), 1500);
                                        }
                                    }, true);
                                    buttonCount++;
                                }
                            });
                        }
                    });
                }
            });

            if (buttonCount > 0) {
                console.log(`✅ Attached listeners to ${buttonCount} pagination buttons`);
            }
        }

        setTimeout(attachPaginationListeners, 3000);
        setTimeout(attachPaginationListeners, 5000);
        setTimeout(attachPaginationListeners, 8000);

        // Listen for tab changes
        document.addEventListener('click', function(e) {
            const clickedElement = e.target;
            let isTabClick = false;
            let element = clickedElement;

            while (element && element !== document.body) {
                if (element.tagName === 'NOW-TABS' ||
                    element.classList?.contains('now-tab') ||
                    element.getAttribute('role') === 'tab' ||
                    element.getAttribute('role') === 'tablist') {
                    isTabClick = true;
                    break;
                }
                if (element.parentNode) {
                    element = element.parentNode;
                } else if (element.host) {
                    element = element.host;
                } else {
                    break;
                }
            }

            if (isTabClick && targetUsername) {
                setTimeout(() => highlightRowsWithClasses(), 500);
                setTimeout(() => highlightRowsWithClasses(), 1000);
                setTimeout(() => highlightRowsWithClasses(), 2000);
            }
        }, true);

        function attachTabListeners() {
            const allElements = findAllShadowRoots();
            const tabControls = allElements.filter(el =>
                el.tagName && el.tagName.toLowerCase() === 'now-tabs'
            );

            tabControls.forEach(control => {
                if (control.shadowRoot) {
                    const tabs = control.shadowRoot.querySelectorAll('button[role="tab"]');
                    tabs.forEach(tab => {
                        if (!tab.hasAttribute('data-highlight-tab-listener')) {
                            tab.setAttribute('data-highlight-tab-listener', 'true');
                            tab.addEventListener('click', function() {
                                if (targetUsername) {
                                    setTimeout(() => highlightRowsWithClasses(), 500);
                                    setTimeout(() => highlightRowsWithClasses(), 1000);
                                    setTimeout(() => highlightRowsWithClasses(), 2000);
                                }
                            });
                        }
                    });
                }
            });
        }

        setTimeout(attachTabListeners, 3000);
        setTimeout(attachTabListeners, 5000);
        setTimeout(attachTabListeners, 8000);

        window.manualHighlightRows = function() {
            console.log('🔍 Manual highlight triggered via console');
            return highlightRowsWithClasses();
        };
        console.log('💡 TIP: If auto-highlighting fails, type "manualHighlightRows()" in console to trigger manually');
    }

    console.log(`✅ Row Highlighter v${SCRIPT_VERSION} script loaded!`);

        return function register() {
            initialize();
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: 'Row Highlighter Settings', position: 1 }
            }));
            if (typeof isNewVersion === 'function' && isNewVersion() && !hasSeenChangelog()) addToolbarNotificationDot();
        };
    })();

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
            registerEnhancementRequestLogger();
            registerMiniSummarySidebar();
            registerServiceNowRowHighlighter();
            // Phases 6 to 9 add ServiceNow tool registrations here.
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
