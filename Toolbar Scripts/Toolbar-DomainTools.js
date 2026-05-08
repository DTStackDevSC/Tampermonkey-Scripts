// ==UserScript==
// @name         |Toolbar| Domain Tools
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainTools.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainTools.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.1
// @description  Extract domains from text and check their security reputation. Replaces Domain Extractor and Domain Security Check.
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
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

    const SCRIPT_VERSION = '1.1';
    const CHANGELOG = `Version 1.1:
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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        Object.assign(closeBtn.style, {
            background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px',
            cursor: 'pointer', padding: '3px 8px', fontWeight: 'bold', fontSize: '12px',
        });
        closeBtn.onclick = () => { modal.style.display = 'none'; };

        header.append(headerLeft, closeBtn);

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => { if (!isRegistered) attemptRegistration(); });

})();
