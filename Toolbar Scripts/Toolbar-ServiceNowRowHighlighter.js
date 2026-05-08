// ==UserScript==
// @name         |Toolbar| ServiceNow Row Highlighter
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowRowHighlighter.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowRowHighlighter.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      2.3.4
// @description  Highlights rows on any ServiceNow ticket list when Updated By column is present; applies SLA heat-map when Due Date column is present
// @author       J.R.
// @match        https://*.service-now.com/*
// @match        https://*.servicenow.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎨 ServiceNow Row Highlighter loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '2.3.4';
    const CHANGELOG = `Version 2.3.4:
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
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;

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
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ Row Highlighter already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Row Highlighter: Max registration attempts reached');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Row Highlighter registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found, registering Row Highlighter...');

            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id: 'rowHighlighter',
                    icon: toolIcon,
                    tooltip: 'Row Highlighter Settings',
                    position: 1
                }
            }));

            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Row Highlighter registered successfully!');
        } else {
            console.log(`⏳ Toolbar not ready (toolbar: ${!!toolbarExists}, menu: ${!!menuExists}), will retry...`);
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarReady', function() {
        console.log('✅ Toolbar ready event received');
        attemptRegistration();
    });

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

        setTimeout(() => {
            attemptRegistration();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log(`✅ Row Highlighter v${SCRIPT_VERSION} script loaded!`);

})();