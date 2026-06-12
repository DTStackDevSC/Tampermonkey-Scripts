// ==UserScript==
// @name         |Toolbar| Domain Tools
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainTools.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainTools.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.2.0
// @description  Extract domains from text and check their security reputation. Replaces Domain Extractor and Domain Security Check.
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/now/nav/*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.0';
    const CHANGELOG = `Version 1.2.0:
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
    const GM_KEY_SNOW_URL       = 'domainSecurityCheckServiceNowURL';

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
        parseChangelog().forEach((entry, index) => {
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
     *  DARK MODE ISOLATION
     * ==========================================================*/

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
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
    `;
    document.head.appendChild(darkModeStyle);

    /* ==========================================================
     *  CONFIGURATION
     * ==========================================================*/

    const TOOL_ID       = 'domainTools';
    const TOOL_TOOLTIP  = 'Domain Tools';
    const TOOL_POSITION = 3;

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.91-4.33-3.56zm2.95-8H5.08c.96-1.65 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>
    </svg>`;

    let isInitialized = false;
    let isRegistered  = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY  = 500;

    /* ==========================================================
     *  SPM URL MANAGEMENT
     * ==========================================================*/

    function getStoredSPMURL() { return GM_getValue(GM_KEY_SNOW_URL, null); }
    function saveSPMURL(url)   { GM_setValue(GM_KEY_SNOW_URL, url); }

    function showSPMURLModal(isReconfigure, onSave) {
        if (document.getElementById('dt-spm-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'dt-spm-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)', zIndex: '1000010',
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1000011', background: '#fff', border: '2px solid #333',
            padding: '24px', boxShadow: '0 6px 20px rgba(0,0,0,0.35)', borderRadius: '10px',
            fontFamily: 'Arial, sans-serif', width: '520px', maxWidth: '92vw',
            display: 'flex', flexDirection: 'column', gap: '14px',
        });

        const title = document.createElement('h2');
        title.textContent = isReconfigure ? '⚙️ Reconfigure SPM Request URL' : '⚙️ SPM Request URL Setup';
        Object.assign(title.style, {
            margin: '0', fontSize: '17px', color: '#222',
            borderBottom: '2px solid #667eea', paddingBottom: '10px',
        });

        const infoBox = document.createElement('div');
        Object.assign(infoBox.style, {
            background: '#fff8e1', borderLeft: '4px solid #f39c12',
            padding: '10px 12px', borderRadius: '5px', fontSize: '13px',
            color: '#555', lineHeight: '1.55',
        });
        infoBox.innerHTML = '<strong>Where to find this URL:</strong><br>The ServiceNow SPM Request Form URL is in the <em>General Scripts User Guide</em> under <strong>Required information and variables</strong>.';

        const warning = document.createElement('div');
        Object.assign(warning.style, {
            background: '#fff0f0', border: '1px solid #f5c6cb', borderRadius: '6px',
            padding: '10px 14px', fontSize: '13px', color: '#c0392b', lineHeight: '1.5',
        });
        warning.innerHTML = '⚠️ <strong>Important:</strong> Enter the URL exactly as shown. Do not add or remove characters, slashes, or parameters.';

        const inputLabel = document.createElement('label');
        inputLabel.textContent = 'ServiceNow SPM Request Form URL:';
        Object.assign(inputLabel.style, { fontSize: '13px', fontWeight: 'bold', color: '#444' });

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = 'https://...';
        Object.assign(inputField.style, {
            width: '100%', padding: '9px 10px', border: '1px solid #ccc', borderRadius: '6px',
            fontSize: '13px', fontFamily: '"Courier New", monospace', boxSizing: 'border-box',
        });
        if (isReconfigure) inputField.value = getStoredSPMURL() || '';

        const validationMsg = document.createElement('div');
        Object.assign(validationMsg.style, { fontSize: '12px', minHeight: '16px' });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Save URL';
        Object.assign(saveBtn.style, {
            flex: '1', padding: '9px',
            background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
            color: '#fff', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
        });

        const skipBtn = document.createElement('button');
        skipBtn.textContent = isReconfigure ? 'Cancel' : 'Skip for now';
        Object.assign(skipBtn.style, {
            padding: '9px 16px', background: '#e0e0e0', color: '#444',
            border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
        });

        btnRow.append(saveBtn, skipBtn);
        modal.append(title, infoBox, warning, inputLabel, inputField, validationMsg, btnRow);
        document.body.append(overlay, modal);

        function closeModal() { overlay.remove(); modal.remove(); }

        function validateAndSave() {
            const url = inputField.value.trim();
            if (!url) {
                validationMsg.textContent = 'Please enter a URL before saving.';
                validationMsg.style.color = '#c0392b';
                return;
            }
            if (!url.startsWith('https://')) {
                validationMsg.textContent = 'URL must start with https://';
                validationMsg.style.color = '#c0392b';
                return;
            }
            saveSPMURL(url);
            closeModal();
            if (typeof onSave === 'function') onSave(url);
        }

        saveBtn.addEventListener('click', validateAndSave);
        inputField.addEventListener('keydown', e => { if (e.key === 'Enter') validateAndSave(); });
        skipBtn.addEventListener('click', closeModal);
        setTimeout(() => inputField.focus(), 100);
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

        const spmConfigLink = document.createElement('span');
        spmConfigLink.id = 'dt-spm-config-link';
        spmConfigLink.textContent = getStoredSPMURL() ? '⚙️ Change URL' : '⚙️ Set URL';
        Object.assign(spmConfigLink.style, {
            fontSize: '11px', color: '#0066cc', textDecoration: 'underline',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0',
        });
        spmConfigLink.addEventListener('click', e => {
            e.stopPropagation();
            showSPMURLModal(true, () => { spmConfigLink.textContent = '⚙️ Change URL'; });
        });

        spmRow.addEventListener('click', e => {
            if (e.target === spmCheckbox || e.target === spmConfigLink) return;
            e.preventDefault();
            spmCheckbox.checked = !spmCheckbox.checked;
        });
        spmRow.append(spmCheckbox, spmLabel, spmConfigLink);

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
            '✓ ServiceNow SPM Request Form (if checked and URL is configured)';

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
                const url = getStoredSPMURL();
                if (url) {
                    GM_openInTab(url, { active: false, insert: true });
                } else {
                    showSPMURLModal(false, saved => {
                        GM_openInTab(saved, { active: false, insert: true });
                        spmConfigLink.textContent = '⚙️ Change URL';
                    });
                }
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
                    spmMock.append(spmCb, span('Open SPM Request Form', { fontSize: '13px', color: '#555', flex: '1' }), span('⚙️ Set URL', { fontSize: '11px', color: '#0066cc', textDecoration: 'underline' }));
                    body.appendChild(spmMock);
                    bullets(body, [
                        'Each domain opens its own background tabs so you can review them one by one.',
                        'Tick Open SPM Request Form to also open your saved SPM form when you run a check.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'SPM URL & Settings',
                buildContent(body) {
                    lead(body, 'Header controls and the one stored setting Domain Tools keeps.');
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
                    setupHeader.textContent = 'SPM Request URL';
                    Object.assign(setupHeader.style, { fontSize: '12px', fontWeight: 'bold', color: '#667eea', marginTop: '6px', marginBottom: '6px', fontFamily: 'Arial, sans-serif' });
                    body.appendChild(setupHeader);
                    const infoMock = document.createElement('div');
                    Object.assign(infoMock.style, {
                        background: '#fff8e1', borderLeft: '4px solid #f39c12',
                        padding: '8px 12px', borderRadius: '5px', fontSize: '12px',
                        color: '#555', lineHeight: '1.5', marginBottom: '8px', fontFamily: 'Arial, sans-serif'
                    });
                    infoMock.textContent = 'The SPM Request Form URL is in the General Scripts User Guide, under Required information and variables.';
                    body.appendChild(infoMock);
                    bullets(body, [
                        'On first load the setup prompt appears automatically until you save a URL.',
                        'Use the Set URL or Change URL link in the Security Check tab to update it any time.',
                        'Enter the URL exactly as shown in the guide. Do not add or remove characters or parameters.'
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

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) return;
        registrationAttempts++;

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: TOOL_ID, icon: toolIcon, tooltip: TOOL_TOOLTIP, position: TOOL_POSITION }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Domain Tools registered!');
        } else {
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    document.addEventListener('toolbarReady',       () => attemptRegistration());
    document.addEventListener('toolbarToolClicked', e => { if (e.detail.id === TOOL_ID) showModal(); });

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;
        isInitialized = true;

        buildModal();
        setTimeout(attemptRegistration, 1000);

        // First run: prompt for the SPM Request URL when none is stored yet
        if (!getStoredSPMURL()) {
            setTimeout(() => showSPMURLModal(false, () => {
                const link = document.getElementById('dt-spm-config-link');
                if (link) link.textContent = '⚙️ Change URL';
            }), 1200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => { if (!isRegistered) attemptRegistration(); });

})();
