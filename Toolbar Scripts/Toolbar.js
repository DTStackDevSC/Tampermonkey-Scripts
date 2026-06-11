// ==UserScript==
// @name         || Tools Toolbar ||
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.4.0
// @description  Floating toolbar with expandable horizontal menu
// @author       J.R.
// @match        https://*.netskope.com/*
// @match        https://*.goskope.com/*
// @match        https://*.service-now.com/*
// @match        https://*.servicenow.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔧 Toolbar v2.5 starting...');

    /* ==========================================================
     *  VERSION CONTROL!
     * ==========================================================*/

    const SCRIPT_VERSION = '1.4.0';
    const CHANGELOG = `Version 1.4.0:
- Added a "? Help" button in the Toolbar Settings window that opens a full Feature Guide. The guide explains the floating button, the tools menu, pinned tools, tool labels, positioning and dragging, appearance options, and settings.

Version 1.3.5:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.3.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.3.2:
- Tool Labels now show full name without truncation and font size increased to 10px.

Version 1.3.1:
- Fixed Tool Labels layout - label now sits clearly above or below the icon with no overlap or clipping.
- Pinned Tools now default to the Right side.`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('toolbar-version', null);
    }

    function saveVersion(version) {
        GM_setValue('toolbar-version', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('toolbar-changelog-seen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('toolbar-changelog-seen', SCRIPT_VERSION);
    }

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

    function isNewVersion() {
        const storedVersion = getStoredVersion();
        return compareVersions(storedVersion, SCRIPT_VERSION);
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
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'toolbarChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'toolbarChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'toolbar-version-info';
        versionInfo.textContent = `Tools Toolbar has been updated to version ${SCRIPT_VERSION}!`;

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

        function addParagraph(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 8px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        function addBulletList(body, items) {
            const ul = document.createElement('div');
            ul.style.marginBottom = '8px';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5',
                    fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = item;
                row.appendChild(dot);
                row.appendChild(text);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        function addKeyValueGrid(body, pairs) {
            const grid = document.createElement('div');
            Object.assign(grid.style, {
                display: 'grid', gridTemplateColumns: 'auto 1fr',
                gap: '4px 14px', marginBottom: '10px'
            });
            for (const [key, val] of pairs) {
                const keyEl = document.createElement('span');
                keyEl.textContent = key;
                Object.assign(keyEl.style, {
                    fontSize: '12px', color: '#667eea', fontWeight: 'bold',
                    padding: '2px 0', whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif'
                });
                const valEl = document.createElement('span');
                valEl.textContent = val;
                Object.assign(valEl.style, {
                    fontSize: '12px', color: '#555', padding: '2px 0',
                    lineHeight: '1.4', fontFamily: 'Arial, sans-serif'
                });
                grid.appendChild(keyEl);
                grid.appendChild(valEl);
            }
            body.appendChild(grid);
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    addParagraph(body, 'The Tools Toolbar is a floating button that expands into a menu of tools. It appears on Netskope and ServiceNow pages and acts as the home for every other helper tool you have installed.');

                    const row = document.createElement('div');
                    Object.assign(row.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const badge = document.createElement('span');
                    badge.textContent = '🔧 Toggle';
                    Object.assign(badge.style, {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff',
                        borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const desc = document.createElement('span');
                    desc.textContent = 'The floating button. Click it to open or close the tools menu.';
                    Object.assign(desc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    row.appendChild(badge);
                    row.appendChild(desc);
                    body.appendChild(row);

                    addBulletList(body, [
                        'Click the floating button to expand the menu of tool icons.',
                        'Click any tool icon to run that tool.',
                        'Click the gear icon to open this Settings window.',
                        'Click outside the menu to close it, unless you have pinned it open.'
                    ]);
                }
            },
            {
                icon: '🧰',
                title: 'Tools Menu',
                buildContent: (body) => {
                    addParagraph(body, 'Each helper tool you install adds its own icon to the menu. The Tools Toolbar itself only provides the container and the gear icon. The other tools register themselves when the page loads.');
                    addBulletList(body, [
                        'Tools appear in the menu automatically once their script is installed and the page is refreshed.',
                        'Hover over an icon to see its name as a tooltip.',
                        'A pulsing dot on a tool icon means that tool has a new version with unread release notes.',
                        'If the menu is empty, no tools are installed yet beyond the toolbar itself.'
                    ]);
                }
            },
            {
                icon: '📌',
                title: 'Pinned Tools',
                buildContent: (body) => {
                    addParagraph(body, 'Pinning keeps your most used tools at a fixed side of the menu so they are always in the same place.');
                    addBulletList(body, [
                        'Open the "Pinned Tools" section in Settings and tick a tool to pin it.',
                        'Choose Left or Right to decide which side of the menu the tool sits on.',
                        'Use the up and down arrows to reorder tools within the pinned group.',
                        'Pinned tools are separated from the rest of the menu by a divider line.'
                    ]);
                }
            },
            {
                icon: '🏷️',
                title: 'Tool Labels',
                buildContent: (body) => {
                    addParagraph(body, 'Labels show each tool name directly on its icon so you do not need to hover to read the tooltip.');
                    addBulletList(body, [
                        'Turn on "Show permanent labels on tool icons" in the Tool Labels section of Settings.',
                        'Choose whether the label sits above or below each icon.',
                        'Labels show the full tool name without truncation.'
                    ]);
                }
            },
            {
                icon: '🎯',
                title: 'Position and Dragging',
                buildContent: (body) => {
                    addParagraph(body, 'You can place the toolbar in any of six preset positions, or drag it anywhere on the screen.');
                    addKeyValueGrid(body, [
                        ['Presets',     'Pick from Top or Bottom combined with Left, Center, or Right in the Position section.'],
                        ['Dragging',    'Enable "Enable toolbar dragging" in Behavior, then drag the floating button to any spot.'],
                        ['Reset Drag',  'Use "Reset Drag Position" to clear a dragged spot and return to the chosen preset.']
                    ]);
                    addParagraph(body, 'Saving a preset position clears any custom drag position.');
                }
            },
            {
                icon: '🎨',
                title: 'Appearance',
                buildContent: (body) => {
                    addParagraph(body, 'The Appearance and Animation sections control how the toolbar looks and moves.');
                    addKeyValueGrid(body, [
                        ['Theme',          'Five color schemes for the floating button: Purple, Blue, Green, Orange, Dark.'],
                        ['Opacity',        'Sets how transparent the toolbar appears.'],
                        ['Button Size',    'Size of the main floating button.'],
                        ['Tool Icon Size', 'Size of the tool icons inside the menu.'],
                        ['Menu Gap',       'Spacing between tool icons.'],
                        ['Compact Mode',   'Shrinks the whole toolbar to a smaller overall size.'],
                        ['Animation Speed','How fast the menu opens and closes.']
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Settings and Data',
                buildContent: (body) => {
                    addParagraph(body, 'The gear icon in the menu opens this Settings window. The Behavior and Data sections cover the rest of the options.');
                    addKeyValueGrid(body, [
                        ['Auto close',      'Closes the menu automatically after you click a tool.'],
                        ['Show tooltips',   'Shows the tool name on hover.'],
                        ['Keep menu pinned','Keeps the menu open at all times so it cannot be closed by clicking outside.'],
                        ['Export Settings', 'Saves all your toolbar settings to a file.'],
                        ['Import Settings', 'Loads toolbar settings from a previously exported file.'],
                        ['Reset to Default','Restores every setting to its original value.'],
                        ["What's New", 'Appears next to the version number when an update is available. Click it to read the release notes.']
                    ]);
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
        titleSub.textContent = `Tools Toolbar • v${SCRIPT_VERSION}`;
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

        console.log('🔄 Menu rerendered:', { left: leftEls.length, regular: regularEls.length, right: rightEls.length });
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
     *  INITIALIZATION
     * ==========================================================*/

    function initToolbar() {
        if (document.getElementById('custom-toolbar-container')) {
            console.log('⚠️ Toolbar already exists, skipping initialization');
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

        console.log('✅ Toolbar DOM element created with data-toolbar-v2 attribute');

        setupEventListeners();

        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('toolbarReady'));
            console.log('📢 toolbarReady event dispatched');
        }, 100);

        console.log('✅ Toolbar initialized and ready!');
    }

    function setupEventListeners() {
        const toggleWrap   = document.getElementById('custom-toolbar-toggle-wrap');
        const toggleButton = document.getElementById('custom-toolbar-toggle');
        const menu         = document.getElementById('custom-toolbar-menu');
        const tbContainer  = document.getElementById('custom-toolbar-container');

        if (!toggleButton || !menu) {
            console.error('❌ Cannot find toolbar elements');
            return;
        }

        // ── Restore pin state ────────────────────────────────────────
        if (getSetting('toolbar-pinned')) {
            menu.classList.add('active', 'pinned-open');
        }

        // ── Drag logic (only when enabled in settings) ───────────────
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

        // ── Toggle click ─────────────────────────────────────────────
        toggleButton.addEventListener('click', function(e) {
            e.stopPropagation();
            if (didDrag) { didDrag = false; return; }
            if (menu.classList.contains('pinned-open')) return;
            menu.classList.toggle('active');
        });

        // ── Close on outside click (respects pin) ────────────────────
        document.addEventListener('click', function(e) {
            if (!(e.target instanceof Element)) return;
            if (!e.target.closest('#custom-toolbar-container')) {
                if (!menu.classList.contains('pinned-open')) {
                    menu.classList.remove('active');
                }
            }
        });

        // ── Settings button ──────────────────────────────────────────
        const settingsBtn = menu.querySelector('[data-tool="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!menu.classList.contains('pinned-open')) menu.classList.remove('active');
                showSettings();
            });
        }

        console.log('✅ Event listeners set up');
    }

    /* ==========================================================
     *  SETTINGS MODAL (ENHANCED)
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
                        <h2>⚙️ Toolbar Settings</h2>
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
                            <h3>🎯 Position</h3>
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
                            <h3>🎨 Appearance</h3>

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
                            <h3>✨ Animation</h3>

                            <div class="setting-item">
                                <label>Animation Speed: <span class="range-value" id="animation-speed-value">0.3s</span></label>
                                <input type="range" id="animation-speed" min="0.1" max="1.0" step="0.1" value="0.3">
                                <div class="setting-help-text">Speed of menu open/close animation</div>
                            </div>
                        </div>

                        <!-- Behavior -->
                        <div class="settings-section">
                            <h3>⚡ Behavior</h3>

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
                            <h3>📌 Pinned Tools</h3>
                            <p class="setting-help-text">Pin tools for quick access. Choose Left or Right side and use arrows to reorder within the pinned group.</p>
                            <div class="tools-list" style="max-height: 220px;" id="pinned-tools-list"></div>
                        </div>

                        <!-- Tool Labels -->
                        <div class="settings-section">
                            <h3>🏷️ Tool Labels</h3>
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
                            <h3>💾 Data</h3>
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
        const opacityValue = document.getElementById('opacity-value');
        opacityInput.addEventListener('input', () => {
            opacityValue.textContent = opacityInput.value + '%';
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
        a.download = 'toolbar-settings.json';
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
        console.log('📥 Received request to add tool:', config.id);
        addToolToMenu(config);
    });

    function addToolToMenu(config) {
        toolRegistry.set(config.id, config);
        scheduleRerender();
        console.log('📥 Registered tool:', config.id);
    }

    /* ==========================================================
     *  START
     * ==========================================================*/

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolbar);
    } else {
        initToolbar();
    }

})();
