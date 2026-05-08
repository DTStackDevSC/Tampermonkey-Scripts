// ==UserScript==
// @name         |Toolbar| Domain Extractor
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainExtractor.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainExtractor.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.7
// @description  Extract domains from text
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔗 Domain Extractor loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.7';
    const CHANGELOG = `Version 1.0.7:
- Fixed dark mode compatibility: the modal now forces light background and dark text
  on all inputs and textareas via CSS with !important so ServiceNow dark mode cannot
  override them.

Version 1.0.6:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.0.5:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.0.4:
- Update URL Changed`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('domainExtractorVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('domainExtractorVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('domainExtractorChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('domainExtractorChangelogSeen', SCRIPT_VERSION);
    }

    function compareVersions(v1, v2) {
        if (!v1) return true; // No stored version means this is new

        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;

            if (num2 > num1) return true;
            if (num2 < num1) return false;
        }

        return false; // Versions are equal
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
        const overlay = document.createElement('div');
        overlay.id = 'changelogModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'changelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.textContent = `Domain Extractor has been updated to version ${SCRIPT_VERSION}!`;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();

            // Remove the notification dot
            const notification = document.getElementById('changelogNotification');
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
     *  CSS STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        /* Changelog Notification Styles */
        #changelogNotification {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }

        #changelogNotification:hover {
            background-color: #d0d0d0 !important;
        }

        #changelogNotification .notification-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: colorPulse 1s ease-in-out infinite !important;
        }

        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #changelogNotification .notification-text {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* Changelog Modal Styles */
        #changelogModal {
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

        #changelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.5em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }

        #changelogModal .version-info {
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

        #changelogModal .changelog-content {
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

        #changelogModal .close-changelog {
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

        #changelogModal .close-changelog:hover {
            background-color: #5568d3 !important;
        }

        #changelogModalOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 100000011 !important;
        }

        .hidden {
            display: none !important;
        }

        /* Dark mode isolation */
        #domain-extractor-modal { color: #333333 !important; }
        #domain-extractor-modal input, #domain-extractor-modal select,
        #domain-extractor-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    // Tool icon
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
    </svg>`;

    // Tool ID
    const TOOL_ID = 'domainExtractor';

    // Global flags
    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500; // ms

    /* ==========================================================
     *  MAIN MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        // Prevent duplicate modals
        if (document.getElementById('domain-extractor-modal')) return;

        // Main modal
        const modal = document.createElement('div');
        modal.id = 'domain-extractor-modal';
        modal.style.position = 'fixed';
        modal.style.top = '60px';
        modal.style.left = '50%';
        modal.style.transform = 'translateX(-50%)';
        modal.style.backgroundColor = '#f9f9f9';
        modal.style.border = '1px solid #ccc';
        modal.style.boxShadow = '0px 4px 12px rgba(0,0,0,0.1)';
        modal.style.padding = '50px 20px 20px 20px';
        modal.style.zIndex = '999998'; // Below toolbar (999999)
        modal.style.borderRadius = '10px';
        modal.style.fontFamily = 'Arial, sans-serif';
        modal.style.display = 'none';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.gap = '15px';
        modal.style.minWidth = '600px';
        modal.style.maxWidth = '800px';
        modal.style.maxHeight = 'calc(100vh - 80px)';
        modal.style.overflowY = 'auto';
        modal.style.overflowX = 'hidden';

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.background = 'red';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '4px 8px';
        closeButton.style.fontWeight = 'bold';
        closeButton.onclick = () => {
            modal.style.display = 'none';
        };
        modal.appendChild(closeButton);

        // Title container with version
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            position: 'absolute',
            top: '12px',
            left: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
            color: '#333',
            fontWeight: 'bold'
        });

        const titleText = document.createElement('span');
        titleText.textContent = '🔗 Domain Extractor';
        titleContainer.appendChild(titleText);

        const versionIndicator = document.createElement('span');
        versionIndicator.textContent = `v${SCRIPT_VERSION}`;
        versionIndicator.style.color = '#666';
        versionIndicator.style.fontSize = '11px';
        versionIndicator.style.fontWeight = 'normal';
        titleContainer.appendChild(versionIndicator);

        // Add changelog notification if needed
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        console.log('Version check:', {
            currentVersion: SCRIPT_VERSION,
            storedVersion: getStoredVersion(),
            isNewVersion: isNewVersion(),
            hasSeenChangelog: hasSeenChangelog(),
            showChangelog: showChangelog
        });

        if (showChangelog) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';

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

            titleContainer.appendChild(changelogNotification);
        }

        modal.appendChild(titleContainer);

        // Input textarea
        const textareaLabel = document.createElement('label');
        textareaLabel.textContent = 'Paste your text here:';
        textareaLabel.style.alignSelf = 'flex-start';
        textareaLabel.style.fontWeight = 'bold';
        textareaLabel.style.fontSize = '13px';
        textareaLabel.style.color = '#555';

        const textarea = document.createElement('textarea');
        textarea.id = 'domain-input-text';
        textarea.placeholder = 'Paste text containing URLs here...\n\nExample:\nhttps://google.com\nftp://mirror.example.com\nwww.github.com\nstandalone-domain.org';
        Object.assign(textarea.style, {
            width: '100%',
            minHeight: '140px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'Courier New, monospace',
            resize: 'vertical',
            boxSizing: 'border-box'
        });

        // Extract button
        const btnExtract = document.createElement('button');
        btnExtract.textContent = 'Extract Domains';
        Object.assign(btnExtract.style, {
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            background: '#e0e0e0',
            fontWeight: 'bold',
            fontSize: '13px'
        });

        // Results section
        const resultsContainer = document.createElement('div');
        resultsContainer.style.width = '100%';
        resultsContainer.style.display = 'flex';
        resultsContainer.style.flexDirection = 'column';
        resultsContainer.style.gap = '15px';

        // Count indicator
        const countDiv = document.createElement('div');
        countDiv.id = 'domain-count';
        Object.assign(countDiv.style, {
            padding: '8px 12px',
            background: '#e8f4f8',
            borderRadius: '4px',
            color: '#0066cc',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            display: 'none'
        });

        // Line by line result
        const lineByLineContainer = document.createElement('div');
        lineByLineContainer.style.width = '100%';

        const lineByLineLabel = document.createElement('label');
        lineByLineLabel.textContent = 'Line-by-Line:';
        Object.assign(lineByLineLabel.style, {
            display: 'block',
            fontWeight: 'bold',
            fontSize: '12px',
            color: '#555',
            marginBottom: '5px'
        });

        const lineByLineOutput = document.createElement('div');
        lineByLineOutput.id = 'line-output';
        Object.assign(lineByLineOutput.style, {
            background: '#ffffff',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '12px',
            minHeight: '80px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'Courier New, monospace',
            fontSize: '12px',
            color: '#999',
            fontStyle: 'italic',
            whiteSpace: 'pre-line',
            boxSizing: 'border-box'
        });
        lineByLineOutput.textContent = 'Paste text and click Extract';

        const btnCopyLine = document.createElement('button');
        btnCopyLine.id = 'copy-line-btn';
        btnCopyLine.textContent = 'Copy';
        Object.assign(btnCopyLine.style, {
            padding: '6px 12px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            marginTop: '8px',
            display: 'none'
        });

        lineByLineContainer.appendChild(lineByLineLabel);
        lineByLineContainer.appendChild(lineByLineOutput);
        lineByLineContainer.appendChild(btnCopyLine);

        // Comma separated result
        const commaContainer = document.createElement('div');
        commaContainer.style.width = '100%';

        const commaLabel = document.createElement('label');
        commaLabel.textContent = 'Comma Separated:';
        Object.assign(commaLabel.style, {
            display: 'block',
            fontWeight: 'bold',
            fontSize: '12px',
            color: '#555',
            marginBottom: '5px'
        });

        const commaOutput = document.createElement('div');
        commaOutput.id = 'comma-output';
        Object.assign(commaOutput.style, {
            background: '#ffffff',
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '12px',
            minHeight: '80px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'Courier New, monospace',
            fontSize: '12px',
            color: '#999',
            fontStyle: 'italic',
            whiteSpace: 'pre-line',
            boxSizing: 'border-box'
        });
        commaOutput.textContent = 'Paste text and click Extract';

        const btnCopyComma = document.createElement('button');
        btnCopyComma.id = 'copy-comma-btn';
        btnCopyComma.textContent = 'Copy';
        Object.assign(btnCopyComma.style, {
            padding: '6px 12px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            marginTop: '8px',
            display: 'none'
        });

        commaContainer.appendChild(commaLabel);
        commaContainer.appendChild(commaOutput);
        commaContainer.appendChild(btnCopyComma);

        // Append all elements
        resultsContainer.appendChild(countDiv);
        resultsContainer.appendChild(lineByLineContainer);
        resultsContainer.appendChild(commaContainer);

        modal.appendChild(textareaLabel);
        modal.appendChild(textarea);
        modal.appendChild(btnExtract);
        modal.appendChild(resultsContainer);
        document.body.appendChild(modal);

        /* ==========================================================
         *  EXTRACT DOMAINS FUNCTION
         * ==========================================================*/

        function extractDomains() {
            const input = textarea.value;
            const lineOutput = document.getElementById('line-output');
            const commaOutput = document.getElementById('comma-output');
            const countDiv = document.getElementById('domain-count');
            const copyLineBtn = document.getElementById('copy-line-btn');
            const copyCommaBtn = document.getElementById('copy-comma-btn');

            if (!input.trim()) {
                lineOutput.textContent = 'Paste text and click Extract';
                lineOutput.style.color = '#999';
                lineOutput.style.fontStyle = 'italic';
                commaOutput.textContent = 'Paste text and click Extract';
                commaOutput.style.color = '#999';
                commaOutput.style.fontStyle = 'italic';
                countDiv.style.display = 'none';
                copyLineBtn.style.display = 'none';
                copyCommaBtn.style.display = 'none';
                return;
            }

            const domains = new Set();

            // Pattern 1: Extract domains from URLs with ANY protocol
            const urlWithProtocolRegex = /(?:[a-z][a-z0-9+\-.]*:\/\/)([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
            let match;
            while ((match = urlWithProtocolRegex.exec(input)) !== null) {
                domains.add(match[1].toLowerCase());
            }

            // Pattern 2: Extract www. prefixed domains
            const wwwRegex = /\b(www\.[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/gi;
            while ((match = wwwRegex.exec(input)) !== null) {
                domains.add(match[1].toLowerCase());
            }

            // Pattern 3: Extract standalone domains
            const standaloneDomainRegex = /(?<![a-zA-Z0-9@])([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,6})\b/g;
            while ((match = standaloneDomainRegex.exec(input)) !== null) {
                const domain = match[1].toLowerCase();
                if (domain.includes('.') &&
                    !domain.startsWith('.') &&
                    !domain.endsWith('.') &&
                    !domain.startsWith('-') &&
                    !domain.endsWith('-')) {
                    domains.add(domain);
                }
            }

            if (domains.size === 0) {
                lineOutput.textContent = 'No domains found in the text';
                lineOutput.style.color = '#999';
                lineOutput.style.fontStyle = 'italic';
                commaOutput.textContent = 'No domains found in the text';
                commaOutput.style.color = '#999';
                commaOutput.style.fontStyle = 'italic';
                countDiv.style.display = 'none';
                copyLineBtn.style.display = 'none';
                copyCommaBtn.style.display = 'none';
            } else {
                // Convert Set to Array and sort
                const domainArray = Array.from(domains).sort();

                // One per line format
                const domainList = domainArray.join('\n');
                lineOutput.textContent = domainList;
                lineOutput.style.color = '#333';
                lineOutput.style.fontStyle = 'normal';

                // Comma separated format
                const domainComma = domainArray.join(', ');
                commaOutput.textContent = domainComma;
                commaOutput.style.color = '#333';
                commaOutput.style.fontStyle = 'normal';

                countDiv.textContent = `Found ${domains.size} unique domain${domains.size !== 1 ? 's' : ''}`;
                countDiv.style.display = 'block';
                copyLineBtn.style.display = 'inline-block';
                copyCommaBtn.style.display = 'inline-block';
            }
        }

        /* ==========================================================
         *  COPY TO CLIPBOARD FUNCTION
         * ==========================================================*/

        function copyToClipboard(elementId, buttonId) {
            const output = document.getElementById(elementId);
            const text = output.textContent;

            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById(buttonId);
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                btn.style.background = '#0066cc';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '#28a745';
                }, 2000);
            }).catch(err => {
                try {
                    GM_setClipboard(text);
                    const btn = document.getElementById(buttonId);
                    const originalText = btn.textContent;
                    btn.textContent = '✓ Copied!';
                    btn.style.background = '#0066cc';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '#28a745';
                    }, 2000);
                } catch (e) {
                    alert('Failed to copy to clipboard');
                    console.error('Copy failed:', err);
                }
            });
        }

        // Event listeners
        btnExtract.addEventListener('click', extractDomains);
        btnCopyLine.addEventListener('click', () => copyToClipboard('line-output', 'copy-line-btn'));
        btnCopyComma.addEventListener('click', () => copyToClipboard('comma-output', 'copy-comma-btn'));

        // Allow Ctrl+Enter to trigger extraction
        textarea.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                extractDomains();
            }
        });

        return modal;
    }

    /* ==========================================================
     *  SHOW MODAL FUNCTION
     * ==========================================================*/

    function showModal() {
        const modal = document.getElementById('domain-extractor-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Focus on textarea
            const textarea = document.getElementById('domain-input-text');
            if (textarea) {
                setTimeout(() => textarea.focus(), 100);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'domainExtractor-notif-dot';

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
     *  TOOLBAR REGISTRATION WITH RETRY MECHANISM
     * ==========================================================*/

    function attemptRegistration() {
        // Check if already registered
        if (isRegistered) {
            console.log('✅ Domain Extractor already registered');
            return;
        }

        // Check if we've exceeded max attempts
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Domain Extractor: Max registration attempts reached. Toolbar may not be available.');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Domain Extractor registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        // Check if toolbar exists in the DOM
        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found in DOM, registering Domain Extractor...');

            // Register tool in toolbar
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id: 'domainExtractor',
                    icon: toolIcon,
                    tooltip: 'Domain Extractor',
                    position: 3
                }
            }));

            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Domain Extractor registered successfully!');
        } else {
            // Toolbar not ready yet, retry
            console.log(`⏳ Toolbar not ready (toolbar: ${!!toolbarExists}, menu: ${!!menuExists}), will retry...`);
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  TOOLBAR INTEGRATION
     * ==========================================================*/

    // Listen for toolbarReady event
    document.addEventListener('toolbarReady', function() {
        console.log('✅ Toolbar ready event received');
        attemptRegistration();
    });

    // Listen for clicks on our tool
    document.addEventListener('toolbarToolClicked', function(e) {
        if (e.detail.id === 'domainExtractor') {
            console.log('🔗 Domain Extractor clicked!');
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

        // Prevent multiple initializations
        if (isInitialized) {
            console.log('Domain Extractor already initialized');
            return;
        }

        console.log('Initializing Domain Extractor...');
        isInitialized = true;
        initializeModal();
        console.log('✅ Domain Extractor modal ready!');

        // Start registration attempts after a short delay
        // This gives the toolbar time to initialize
        setTimeout(() => {
            attemptRegistration();
        }, 1000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Also try to register when the page is fully loaded (backup)
    window.addEventListener('load', function() {
        if (!isRegistered) {
            console.log('🔄 Page loaded, checking registration status...');
            attemptRegistration();
        }
    });

})();