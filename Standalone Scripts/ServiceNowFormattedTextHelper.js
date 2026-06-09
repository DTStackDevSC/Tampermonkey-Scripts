// ==UserScript==
// @name         Formatted Text Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowFormattedTextHelper.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowFormattedTextHelper.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @author       J.R.
// @version      1.2.0
// @description  Add formatted text with HTML support to ServiceNow tickets using a rich text editor with full HTML formatting options
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    let isInitialized = false;

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.0';
    const CHANGELOG = `Version 1.2.0:
- Added a Table button to the toolbar. Pick the number of rows and columns from a quick grid, choose whether the first row is a header, and the table is dropped in at your cursor ready to fill in.
- Added Text Color and Highlight Color buttons to the toolbar. Select your text, click the button, and pick a swatch to color the text or highlight it in any color, not just yellow.
- Improved dark mode: the editor area and the main editor window now always keep a light background and readable text, so nothing looks washed out or invisible on dark themed instances.

Version 1.1.3:
- When the Quick Response helper is not installed, the editor button now appears in the same place that button would, next to the ticket form actions, instead of above the activity stream.

Version 1.1.2:
- Fixed the editor button not appearing in standalone mode when the ticket showed only work notes or only comments. The button now reliably appears above whichever journal field is visible.

Version 1.1.1:
- The editor button now appears a bit faster while the page is still loading.
- When the Quick Response helper is not installed and the ticket shows work notes and comments at the same time, the button now appears above both fields instead of between them.

Version 1.1.0:
- The Insert button now lets you choose where the text goes: as a Comment, as a Work Note, or as both at once.
- Added a Feature Guide. Click "? Help" in the editor header to see what every toolbar button does.
- The HTML preview now opens in a proper window showing both a live rendered preview and the source, with a one click Copy button, replacing the old popup.
- Inserting a link now opens a dedicated dialog with separate fields for the link text and the address, replacing the old browser prompt.
- Added a "Remove Formatting" option that clears formatting from just the selected text, leaving the rest of your document untouched.
- Pasted content is now cleaned automatically so text copied from Word, Outlook, or web pages no longer brings hidden styling into the editor.
- The editor button now appears even when the Quick Response helper is not installed, and it no longer keeps retrying forever if the page layout is different.
- Fixed dark mode: the What's New window and all new dialogs now keep readable light backgrounds.

Version 1.0.7:
- Fixed dark mode compatibility: the formatting modal and image modal now force light
  backgrounds and dark text via CSS with !important so ServiceNow dark mode cannot
  override their inputs and selects.

Version 1.0.6:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.0.5:
- Fixed comment textarea not being detected in dual mode - now uses activity-stream-comments-textarea matching the dual-input container detection

Version 1.0.3:
- Update URL Changed`;

    /* ==========================================================
     *  VERSION CONTROL FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('formattedTextHelperVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('formattedTextHelperVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('formattedTextHelperChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('formattedTextHelperChangelogSeen', SCRIPT_VERSION);
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
        overlay.id = 'changelog-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000'
        });

        const modal = document.createElement('div');
        modal.id = 'changelog-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10001',
            background: '#fff',
            border: '2px solid #333',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto'
        });

        // Header container with title and close button
        const headerContainer = document.createElement('div');
        Object.assign(headerContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '2px solid #28a745',
            paddingBottom: '10px'
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            margin: '0',
            color: '#333'
        });

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
        });
        closeX.onmouseover = () => {
            closeX.style.backgroundColor = '#f0f0f0';
            closeX.style.color = '#000';
        };
        closeX.onmouseout = () => {
            closeX.style.backgroundColor = 'transparent';
            closeX.style.color = '#666';
        };
        closeX.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
        };

        headerContainer.appendChild(title);
        headerContainer.appendChild(closeX);

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `Formatted Text Helper has been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px',
            borderLeft: '4px solid #28a745'
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
            marginTop: '15px',
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%'
        });

        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#218838';
        closeButton.onmouseout = () => closeButton.style.backgroundColor = '#28a745';

        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
        };

        modal.appendChild(headerContainer);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => {
            closeButton.click();
        };
    }

    /* ==========================================================
     *  COLOR PALETTES
     * ==========================================================*/

    // Word style swatches. Foreground colors for text, brighter set for highlights.
    const TEXT_COLORS = [
        '#000000', '#444444', '#666666', '#999999', '#cccccc', '#ffffff',
        '#cc0000', '#e06666', '#ff9900', '#f1c232', '#6aa84f', '#38761d',
        '#1155cc', '#3d85c6', '#9fc5e8', '#674ea7', '#a64d79', '#85200c'
    ];

    const HIGHLIGHT_COLORS = [
        '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff9900', '#ff6666',
        '#ffd966', '#fff2cc', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#d5a6bd',
        '#f4cccc', '#d9d2e9', '#ead1dc', '#cccccc', '#999999', '#ffffff'
    ];

    /* ==========================================================
     *  RICH TEXT EDITOR MODAL
     * ==========================================================*/

    // Saved selection reference so the image modal can restore it
    let savedRange = null;

    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (!savedRange) return;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }

    /* ----------------------------------------------------------
     *  IMAGE INSERTION MODAL
     * ----------------------------------------------------------*/

    function showImageModal() {
        // Save current cursor/selection inside the editor BEFORE opening modal
        saveSelection();

        // --- Overlay ---
        const imgOverlay = document.createElement('div');
        imgOverlay.id = 'image-modal-overlay';
        Object.assign(imgOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: '10002',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // --- Modal box ---
        const imgModal = document.createElement('div');
        imgModal.id = 'image-modal';
        Object.assign(imgModal.style, {
            backgroundColor: '#fff',
            borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            width: '440px',
            maxWidth: 'calc(100vw - 40px)',
            fontFamily: 'Arial, sans-serif',
            overflow: 'hidden',
            zIndex: '10003'
        });

        // --- Header ---
        const imgHeader = document.createElement('div');
        Object.assign(imgHeader.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0'
        });

        const imgTitle = document.createElement('h3');
        imgTitle.textContent = '🖼️ Insert Image';
        Object.assign(imgTitle.style, { margin: '0', fontSize: '16px', color: '#333' });

        const imgCloseX = document.createElement('button');
        imgCloseX.textContent = '✕';
        imgCloseX.type = 'button';
        Object.assign(imgCloseX.style, {
            background: 'none', border: 'none', fontSize: '20px',
            cursor: 'pointer', color: '#666', padding: '0',
            width: '26px', height: '26px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        imgCloseX.onmouseover = () => { imgCloseX.style.backgroundColor = '#f0f0f0'; imgCloseX.style.color = '#000'; };
        imgCloseX.onmouseout  = () => { imgCloseX.style.backgroundColor = 'transparent'; imgCloseX.style.color = '#666'; };
        imgCloseX.onclick = closeImageModal;

        imgHeader.appendChild(imgTitle);
        imgHeader.appendChild(imgCloseX);

        // --- Body ---
        const imgBody = document.createElement('div');
        Object.assign(imgBody.style, { padding: '18px' });

        // URL label + input
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'Image URL';
        Object.assign(urlLabel.style, {
            display: 'block', fontSize: '13px', fontWeight: 'bold',
            color: '#444', marginBottom: '6px'
        });

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://example.com/image.png';
        Object.assign(urlInput.style, {
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '13px',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'Arial, sans-serif'
        });
        urlInput.onfocus = () => { urlInput.style.borderColor = '#669bea'; urlInput.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
        urlInput.onblur  = () => { urlInput.style.borderColor = '#ccc';    urlInput.style.boxShadow = 'none'; };

        // Size label + row (dropdown + live value)
        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Display Size';
        Object.assign(sizeLabel.style, {
            display: 'block', fontSize: '13px', fontWeight: 'bold',
            color: '#444', marginBottom: '6px', marginTop: '14px'
        });

        const sizeRow = document.createElement('div');
        Object.assign(sizeRow.style, { display: 'flex', alignItems: 'center', gap: '10px' });

        const sizeSelect = document.createElement('select');
        Object.assign(sizeSelect.style, {
            flex: '1',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            cursor: 'pointer',
            outline: 'none',
            boxSizing: 'border-box'
        });
        sizeSelect.onfocus = () => { sizeSelect.style.borderColor = '#669bea'; sizeSelect.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
        sizeSelect.onblur  = () => { sizeSelect.style.borderColor = '#ccc';    sizeSelect.style.boxShadow = 'none'; };

        const sizeOptions = [
            { label: '25% (default)',              value: '25' },
            { label: '50%',              value: '50' },
            { label: '75%',              value: '75' },
            { label: '100%',   value: '100' }
        ];
        sizeOptions.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === '25') o.selected = true;
            sizeSelect.appendChild(o);
        });

        const sizeValueBadge = document.createElement('span');
        sizeValueBadge.textContent = '25%';
        Object.assign(sizeValueBadge.style, {
            fontSize: '13px', fontWeight: 'bold', color: '#28a745',
            minWidth: '40px', textAlign: 'center'
        });
        sizeSelect.onchange = () => { sizeValueBadge.textContent = sizeSelect.value + '%'; };

        sizeRow.appendChild(sizeSelect);
        sizeRow.appendChild(sizeValueBadge);

        // --- Preview area ---
        const previewContainer = document.createElement('div');
        Object.assign(previewContainer.style, {
            marginTop: '14px',
            border: '1px dashed #ccc',
            borderRadius: '6px',
            minHeight: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            overflow: 'hidden',
            maxHeight: '200px'
        });

        const previewPlaceholder = document.createElement('span');
        previewPlaceholder.textContent = 'Image preview will appear here';
        Object.assign(previewPlaceholder.style, { color: '#999', fontSize: '13px', fontStyle: 'italic' });
        previewContainer.appendChild(previewPlaceholder);

        const previewImg = document.createElement('img');
        Object.assign(previewImg.style, { maxWidth: '100%', maxHeight: '180px', display: 'none' });
        previewContainer.appendChild(previewImg);

        // Live-update preview on URL input / size change
        function updatePreview() {
            const url = urlInput.value.trim();
            if (url) {
                previewImg.src = url;
                previewImg.style.width = sizeSelect.value + '%';
                previewImg.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewPlaceholder.style.display = 'block';
            }
        }
        urlInput.oninput  = updatePreview;
        sizeSelect.onchange = () => { sizeValueBadge.textContent = sizeSelect.value + '%'; updatePreview(); };

        previewImg.onerror = () => {
            previewImg.style.display = 'none';
            previewPlaceholder.style.display = 'block';
            previewPlaceholder.textContent = '⚠️ Could not load image';
            previewPlaceholder.style.color = '#dc3545';
        };
        previewImg.onload = () => {
            previewPlaceholder.style.color = '#999';
            previewPlaceholder.style.fontStyle = 'italic';
            previewPlaceholder.textContent = 'Image preview will appear here';
        };

        imgBody.appendChild(urlLabel);
        imgBody.appendChild(urlInput);
        imgBody.appendChild(sizeLabel);
        imgBody.appendChild(sizeRow);
        imgBody.appendChild(previewContainer);

        // --- Footer ---
        const imgFooter = document.createElement('div');
        Object.assign(imgFooter.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 18px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f8f9fa'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = closeImageModal;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Image';
        insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            const url  = urlInput.value.trim();
            const size = sizeSelect.value;

            if (!url) {
                urlInput.style.borderColor = '#dc3545';
                urlInput.style.boxShadow  = '0 0 0 0.2rem rgba(220,53,69,0.25)';
                urlInput.focus();
                return;
            }

            // Restore cursor position inside the editor
            restoreSelection();

            // Build <img> with width percentage as inline style
            const img = document.createElement('img');
            img.src   = url;
            img.style.width = size + '%';
            img.style.maxWidth = '100%';

            // Insert at cursor
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                // Move cursor right after the image
                range.setStartAfter(img);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();

            closeImageModal();
            console.log('✓ Image inserted — ' + size + '%');
        };

        imgFooter.appendChild(cancelBtn);
        imgFooter.appendChild(insertBtn);

        // --- Assemble ---
        imgModal.appendChild(imgHeader);
        imgModal.appendChild(imgBody);
        imgModal.appendChild(imgFooter);
        imgOverlay.appendChild(imgModal);
        document.body.appendChild(imgOverlay);

        // Close helpers
        imgOverlay.addEventListener('click', (e) => { if (e.target === imgOverlay) closeImageModal(); });

        function closeImageModal() {
            imgOverlay.remove();
            savedRange = null;
        }

        // Auto-focus URL input
        setTimeout(() => urlInput.focus(), 60);
    }

    /* ----------------------------------------------------------
     *  LINK INSERTION MODAL
     * ----------------------------------------------------------*/

    function showLinkModal() {
        // Capture the editor selection before the modal steals focus
        saveSelection();
        const preText = savedRange ? savedRange.toString() : '';

        const overlay = document.createElement('div');
        overlay.id = 'link-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'link-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '440px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '🔗 Insert Link';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px' });

        function makeLabel(text, topMargin) {
            const l = document.createElement('label');
            l.textContent = text;
            Object.assign(l.style, {
                display: 'block', fontSize: '13px', fontWeight: 'bold',
                color: '#444', marginBottom: '6px', marginTop: topMargin || '0'
            });
            return l;
        }
        function makeInput(placeholder, value) {
            const i = document.createElement('input');
            i.type = 'text';
            i.placeholder = placeholder;
            if (value) i.value = value;
            Object.assign(i.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc',
                borderRadius: '5px', fontSize: '13px', boxSizing: 'border-box',
                outline: 'none', fontFamily: 'Arial, sans-serif'
            });
            i.onfocus = () => { i.style.borderColor = '#669bea'; i.style.boxShadow = '0 0 0 0.2rem rgba(102,155,234,0.25)'; };
            i.onblur  = () => { i.style.borderColor = '#ccc'; i.style.boxShadow = 'none'; };
            return i;
        }

        const textInput = makeInput('Text to display', preText);
        const urlInput  = makeInput('https://example.com', '');

        body.appendChild(makeLabel('Link Text'));
        body.appendChild(textInput);
        body.appendChild(makeLabel('URL', '14px'));
        body.appendChild(urlInput);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa'
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Link'; insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            const url = urlInput.value.trim();
            if (!url || /^\s*javascript:/i.test(url)) {
                urlInput.style.borderColor = '#dc3545';
                urlInput.style.boxShadow  = '0 0 0 0.2rem rgba(220,53,69,0.25)';
                urlInput.focus();
                return;
            }
            const text = textInput.value.trim() || url;

            restoreSelection();
            const a = document.createElement('a');
            a.href = url;
            a.textContent = text;

            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(a);
                range.setStartAfter(a);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();
            cleanup();
            console.log('✓ Link inserted — ' + url);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(insertBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
        setTimeout(() => urlInput.focus(), 60);

        function cleanup() {
            overlay.remove();
            savedRange = null;
        }
    }

    /* ----------------------------------------------------------
     *  TABLE INSERTION MODAL
     * ----------------------------------------------------------*/

    // Build a table element with inline styles ServiceNow renders inside [code].
    function buildTableElement(rows, cols, hasHeader) {
        const cellStyle = 'border: 1px solid #cccccc; padding: 6px 10px;';
        const table = document.createElement('table');
        table.setAttribute('style', 'border-collapse: collapse; width: 100%;');

        let bodyStart = 0;
        if (hasHeader) {
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            tr.setAttribute('style', 'background-color: #f0f0f0;');
            for (let c = 0; c < cols; c++) {
                const th = document.createElement('th');
                th.setAttribute('style', cellStyle);
                th.appendChild(document.createElement('br'));
                tr.appendChild(th);
            }
            thead.appendChild(tr);
            table.appendChild(thead);
            bodyStart = 1;
        }

        const tbody = document.createElement('tbody');
        for (let r = bodyStart; r < rows; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) {
                const td = document.createElement('td');
                td.setAttribute('style', cellStyle);
                td.appendChild(document.createElement('br'));
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        return table;
    }

    function showTableModal() {
        // Save the editor cursor before the modal steals focus
        saveSelection();

        const MAX_GRID = 10;          // hover grid spans up to 10 x 10
        let selRows = 1, selCols = 1;
        let headerRow = true;

        const overlay = document.createElement('div');
        overlay.id = 'table-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'table-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '380px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '▦ Insert Table';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px' });

        // Live dimension label
        const dimLabel = document.createElement('div');
        dimLabel.textContent = '1 × 1 Table';
        Object.assign(dimLabel.style, {
            fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '8px', textAlign: 'center'
        });

        // Hover grid picker
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid', gridTemplateColumns: `repeat(${MAX_GRID}, 18px)`,
            gap: '3px', justifyContent: 'center', marginBottom: '14px'
        });

        const cells = [];
        function paintGrid(r, c) {
            cells.forEach(cell => {
                const on = cell.dataset.r <= r && cell.dataset.c <= c;
                cell.style.backgroundColor = on ? '#669bea' : '#fff';
                cell.style.borderColor = on ? '#3d6fd0' : '#ccc';
            });
        }
        for (let r = 1; r <= MAX_GRID; r++) {
            for (let c = 1; c <= MAX_GRID; c++) {
                const cell = document.createElement('div');
                cell.dataset.r = r;
                cell.dataset.c = c;
                Object.assign(cell.style, {
                    width: '18px', height: '18px', border: '1px solid #ccc',
                    borderRadius: '2px', backgroundColor: '#fff', cursor: 'pointer'
                });
                cell.addEventListener('mouseover', () => {
                    selRows = r; selCols = c;
                    dimLabel.textContent = `${r} × ${c} Table`;
                    rowsInput.value = r;
                    colsInput.value = c;
                    paintGrid(r, c);
                });
                cell.addEventListener('click', () => { selRows = r; selCols = c; doInsert(); });
                cells.push(cell);
                grid.appendChild(cell);
            }
        }

        // Explicit number inputs for sizes beyond the grid
        const inputsRow = document.createElement('div');
        Object.assign(inputsRow.style, {
            display: 'flex', gap: '10px', alignItems: 'center',
            justifyContent: 'center', marginBottom: '12px'
        });
        function makeNumInput(val) {
            const i = document.createElement('input');
            i.type = 'number'; i.min = '1'; i.max = '50'; i.value = String(val);
            Object.assign(i.style, {
                width: '60px', padding: '6px 8px', border: '1px solid #ccc',
                borderRadius: '5px', fontSize: '13px', boxSizing: 'border-box',
                outline: 'none', fontFamily: 'Arial, sans-serif', textAlign: 'center'
            });
            return i;
        }
        const rowsInput = makeNumInput(1);
        const colsInput = makeNumInput(1);
        function syncFromInputs() {
            selRows = Math.max(1, Math.min(50, parseInt(rowsInput.value, 10) || 1));
            selCols = Math.max(1, Math.min(50, parseInt(colsInput.value, 10) || 1));
            dimLabel.textContent = `${selRows} × ${selCols} Table`;
            if (selRows <= MAX_GRID && selCols <= MAX_GRID) paintGrid(selRows, selCols);
        }
        rowsInput.oninput = syncFromInputs;
        colsInput.oninput = syncFromInputs;
        const rowsLbl = document.createElement('span');
        rowsLbl.textContent = 'Rows'; rowsLbl.style.fontSize = '13px'; rowsLbl.style.color = '#444';
        const colsLbl = document.createElement('span');
        colsLbl.textContent = 'Columns'; colsLbl.style.fontSize = '13px'; colsLbl.style.color = '#444';
        inputsRow.appendChild(rowsLbl);
        inputsRow.appendChild(rowsInput);
        inputsRow.appendChild(colsLbl);
        inputsRow.appendChild(colsInput);

        // Header row toggle
        const headerToggle = document.createElement('label');
        Object.assign(headerToggle.style, {
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            fontSize: '13px', color: '#444', cursor: 'pointer', marginBottom: '4px'
        });
        const headerCheck = document.createElement('input');
        headerCheck.type = 'checkbox';
        headerCheck.checked = true;
        headerCheck.style.cursor = 'pointer';
        headerCheck.onchange = () => { headerRow = headerCheck.checked; };
        const headerText = document.createElement('span');
        headerText.textContent = 'Make the first row a header';
        headerToggle.appendChild(headerCheck);
        headerToggle.appendChild(headerText);

        body.appendChild(dimLabel);
        body.appendChild(grid);
        body.appendChild(inputsRow);
        body.appendChild(headerToggle);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa'
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '7px 18px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;

        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert Table'; insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout  = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = doInsert;

        footer.appendChild(cancelBtn);
        footer.appendChild(insertBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
        paintGrid(1, 1);

        function doInsert() {
            syncFromInputs();
            headerRow = headerCheck.checked;

            restoreSelection();
            const table = buildTableElement(selRows, selCols, headerRow);

            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(table);
                // Drop a paragraph after the table so the cursor has somewhere to go
                const after = document.createElement('p');
                after.appendChild(document.createElement('br'));
                table.parentNode.insertBefore(after, table.nextSibling);
                range.setStart(after, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const editor = document.getElementById('formatted-text-editor');
            if (editor) editor.focus();
            cleanup();
            console.log('✓ Table inserted — ' + selRows + ' x ' + selCols);
        }

        function cleanup() {
            overlay.remove();
            savedRange = null;
        }
    }

    /* ----------------------------------------------------------
     *  HTML PREVIEW MODAL
     * ----------------------------------------------------------*/

    function showPreviewModal() {
        const editor = document.getElementById('formatted-text-editor');
        if (!editor) return;
        const html = cleanHTML(editor.innerHTML);
        const wrapped = `[code]${html}[/code]`;

        const overlay = document.createElement('div');
        overlay.id = 'preview-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10004',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'preview-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '660px',
            maxWidth: 'calc(100vw - 40px)', maxHeight: 'calc(100vh - 80px)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0',
            flexShrink: '0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = '👁 HTML Preview';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const bodyWrap = document.createElement('div');
        Object.assign(bodyWrap.style, { padding: '18px', overflowY: 'auto', flex: '1 1 auto', minHeight: '0' });

        const renderLabel = document.createElement('div');
        renderLabel.textContent = 'Rendered preview';
        Object.assign(renderLabel.style, { fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '6px' });

        const renderBox = document.createElement('div');
        renderBox.innerHTML = html || '<span style="color:#999;font-style:italic;">(empty)</span>';
        Object.assign(renderBox.style, {
            border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 14px',
            backgroundColor: '#fff', color: '#333', maxHeight: '260px', overflowY: 'auto',
            fontSize: '14px', lineHeight: '1.6', marginBottom: '16px'
        });

        const sourceLabel = document.createElement('div');
        sourceLabel.textContent = 'Source (this is what gets inserted)';
        Object.assign(sourceLabel.style, { fontSize: '13px', fontWeight: 'bold', color: '#444', marginBottom: '6px' });

        const sourceTA = document.createElement('textarea');
        sourceTA.readOnly = true;
        sourceTA.value = wrapped;
        Object.assign(sourceTA.style, {
            width: '100%', minHeight: '120px', maxHeight: '220px', boxSizing: 'border-box',
            padding: '10px 12px', border: '1px solid #ccc', borderRadius: '6px',
            fontFamily: 'monospace', fontSize: '12px', color: '#333',
            backgroundColor: '#f8f9fa', resize: 'vertical', outline: 'none'
        });

        bodyWrap.appendChild(renderLabel);
        bodyWrap.appendChild(renderBox);
        bodyWrap.appendChild(sourceLabel);
        bodyWrap.appendChild(sourceTA);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            padding: '14px 18px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
            flexShrink: '0'
        });

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy Source'; copyBtn.type = 'button';
        Object.assign(copyBtn.style, {
            padding: '7px 18px', border: '1px solid #6c757d', borderRadius: '5px',
            backgroundColor: '#6c757d', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        copyBtn.onmouseover = () => copyBtn.style.backgroundColor = '#5a6268';
        copyBtn.onmouseout  = () => copyBtn.style.backgroundColor = '#6c757d';
        copyBtn.onclick = () => {
            const done = () => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.textContent = '📋 Copy Source'; }, 1500);
            };
            const fallback = () => {
                sourceTA.removeAttribute('readonly');
                sourceTA.select();
                try { document.execCommand('copy'); } catch (e) { /* ignore */ }
                sourceTA.setAttribute('readonly', 'true');
                done();
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(wrapped).then(done).catch(fallback);
            } else {
                fallback();
            }
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close'; closeBtn.type = 'button';
        Object.assign(closeBtn.style, {
            padding: '7px 18px', border: '1px solid #28a745', borderRadius: '5px',
            backgroundColor: '#28a745', color: '#fff', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold'
        });
        closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#218838';
        closeBtn.onmouseout  = () => closeBtn.style.backgroundColor = '#28a745';
        closeBtn.onclick = cleanup;

        footer.appendChild(copyBtn);
        footer.appendChild(closeBtn);

        modal.appendChild(header);
        modal.appendChild(bodyWrap);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        function cleanup() { overlay.remove(); }
    }

    /* ----------------------------------------------------------
     *  INSERT TARGET CHOOSER MODAL
     * ----------------------------------------------------------*/

    function showInsertTargetModal(onChoose) {
        const overlay = document.createElement('div');
        overlay.id = 'insert-target-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10006',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const modal = document.createElement('div');
        modal.id = 'insert-target-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '400px',
            maxWidth: 'calc(100vw - 40px)', fontFamily: 'Arial, sans-serif', overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0'
        });
        const hTitle = document.createElement('h3');
        hTitle.textContent = 'Insert where?';
        Object.assign(hTitle.style, { margin: '0', fontSize: '16px', color: '#333' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
            color: '#666', padding: '0', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
        });
        closeX.onmouseover = () => { closeX.style.backgroundColor = '#f0f0f0'; closeX.style.color = '#000'; };
        closeX.onmouseout  = () => { closeX.style.backgroundColor = 'transparent'; closeX.style.color = '#666'; };
        closeX.onclick = cleanup;
        header.appendChild(hTitle);
        header.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' });

        const intro = document.createElement('div');
        intro.textContent = 'Choose which field to add the formatted text to.';
        Object.assign(intro.style, { fontSize: '13px', color: '#555', marginBottom: '4px' });
        body.appendChild(intro);

        const options = [
            { target: 'comments',   bg: '#0066cc', label: 'Insert as Comment',   desc: 'Customer facing. The requester can see this.' },
            { target: 'work_notes', bg: '#5a6672', label: 'Insert as Work Note', desc: 'Internal only. Visible to your team but not the requester.' },
            { target: 'both',       bg: '#667eea', label: 'Insert as Both',       desc: 'Adds the text to the comment and the work note.' }
        ];
        options.forEach(opt => {
            const optBtn = document.createElement('button');
            optBtn.type = 'button';
            Object.assign(optBtn.style, {
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                textAlign: 'left', padding: '10px 14px', border: '1px solid #e0e0e0',
                borderLeft: `4px solid ${opt.bg}`, borderRadius: '6px', backgroundColor: '#fff',
                cursor: 'pointer', transition: 'background 0.15s', width: '100%', boxSizing: 'border-box'
            });
            const lbl = document.createElement('span');
            lbl.textContent = opt.label;
            Object.assign(lbl.style, { fontWeight: 'bold', fontSize: '13px', color: opt.bg });
            const desc = document.createElement('span');
            desc.textContent = opt.desc;
            Object.assign(desc.style, { fontSize: '12px', color: '#666' });
            optBtn.appendChild(lbl);
            optBtn.appendChild(desc);
            optBtn.onmouseover = () => optBtn.style.backgroundColor = '#f5f7ff';
            optBtn.onmouseout  = () => optBtn.style.backgroundColor = '#fff';
            optBtn.onclick = () => { cleanup(); onChoose(opt.target); };
            body.appendChild(optBtn);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel'; cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            marginTop: '4px', padding: '8px', border: '1px solid #ccc', borderRadius: '5px',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f0f0f0';
        cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = cleanup;
        body.appendChild(cancelBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        function cleanup() { overlay.remove(); }
    }

    /* ----------------------------------------------------------
     *  FEATURE GUIDE (HELP) MODAL
     * ----------------------------------------------------------*/

    function showHelpModal() {
        if (document.getElementById('formattedTextHelpModal')) return;

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
            Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: '10px' });
            for (const [key, val] of pairs) {
                const keyEl = document.createElement('span');
                keyEl.textContent = key;
                Object.assign(keyEl.style, {
                    fontFamily: 'monospace', fontSize: '11px',
                    color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap'
                });
                const valEl = document.createElement('span');
                valEl.textContent = val;
                Object.assign(valEl.style, { fontSize: '12px', color: '#555', padding: '2px 0', fontFamily: 'Arial, sans-serif' });
                grid.appendChild(keyEl);
                grid.appendChild(valEl);
            }
            body.appendChild(grid);
        }

        function addButtonBadge(body, label, bg, color, border, desc) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '10px', padding: '10px 14px',
                background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
            });
            const badge = document.createElement('span');
            badge.textContent = label;
            Object.assign(badge.style, {
                background: bg, color: color, border: border || 'none', borderRadius: '4px',
                padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
            });
            const descEl = document.createElement('span');
            descEl.textContent = desc;
            Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
            row.appendChild(badge);
            row.appendChild(descEl);
            body.appendChild(row);
        }

        function addCategoryBadges(body, items) {
            for (const opt of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
                });
                const badge = document.createElement('span');
                badge.textContent = opt.label;
                Object.assign(badge.style, {
                    background: opt.bg, color: '#fff', borderRadius: '4px',
                    padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                    whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                    alignSelf: 'flex-start', minWidth: '90px', textAlign: 'center'
                });
                const descEl = document.createElement('span');
                descEl.textContent = opt.desc;
                Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                row.appendChild(badge);
                row.appendChild(descEl);
                body.appendChild(row);
            }
        }

        const sections = [
            {
                icon: '🚀', title: 'Getting Started',
                buildContent: (body) => {
                    addParagraph(body, 'The helper adds a button to the ticket action row. Click it to open the rich text editor, build your content, then insert it into the ticket.');
                    addButtonBadge(body, '📝 Formatted Text', '#28a745', '#fff', null, 'Opens the Formatted Text Editor. It appears next to the Quick Response button, or near the activity stream when that helper is not installed.');
                    addBulletList(body, [
                        'Type your message in the editor and use the toolbar to format it.',
                        'Click Insert to choose where the text goes, then it is added to the ticket wrapped in [code] tags so ServiceNow renders the HTML.',
                        'Your selection of formatting is converted to clean HTML automatically on insert.'
                    ]);
                }
            },
            {
                icon: '📋', title: 'Formatting Toolbar',
                buildContent: (body) => {
                    addParagraph(body, 'Select text first, then click a button to apply that format. These controls live in the top row of the editor.');
                    addKeyValueGrid(body, [
                        ['B',          'Bold the selected text. Shortcut Ctrl+B.'],
                        ['I',          'Italic the selected text. Shortcut Ctrl+I.'],
                        ['U',          'Underline the selected text. Shortcut Ctrl+U.'],
                        ['S',          'Strikethrough the selected text.'],
                        ['Size',       'Set a specific font size on the selected text, from 8 up to 36.'],
                        ['Text Color', 'Open a swatch palette and color the selected text. Includes a Remove option to clear the color.'],
                        ['Highlight Color', 'Open a swatch palette and highlight the selected text in any color. Includes a Remove option.'],
                        ['Highlight',  'Mark the selected text with a yellow highlight.'],
                        ['Small',      'Render the selected text in a smaller size.'],
                        ['Del',        'Show the text as deleted, with a line through it.'],
                        ['Ins',        'Show the text as inserted, underlined on a green tint.'],
                        ['Subscript',  'Lower the text below the baseline, like in H2O.'],
                        ['Superscript','Raise the text above the baseline, like in x squared.'],
                        ['Code',       'Format the selection as inline code with a mono font.'],
                        ['Blockquote', 'Turn the selection into an indented quote block.'],
                        ['Link',       'Open the link dialog to add a clickable address.'],
                        ['Image',      'Open the image dialog to insert a picture by URL.'],
                        ['Table',      'Open the table dialog to insert a grid of rows and columns.'],
                        ['Bullet List','Turn lines into an unordered bullet list.'],
                        ['Numbered',   'Turn lines into an ordered numbered list.'],
                        ['H1 / H2',    'Apply a large or medium heading to the current line.'],
                        ['P',          'Reset the current line back to a normal paragraph.']
                    ]);
                }
            },
            {
                icon: '🔗', title: 'Links',
                buildContent: (body) => {
                    addParagraph(body, 'The link button opens a dialog with two fields so you control both the visible text and the destination.');
                    addBulletList(body, [
                        'Select text before clicking the link button to prefill the Link Text field.',
                        'Enter the address in the URL field. Addresses starting with javascript are rejected for safety.',
                        'Leave the text blank to show the URL itself as the link label.'
                    ]);
                }
            },
            {
                icon: '🖼️', title: 'Images',
                buildContent: (body) => {
                    addParagraph(body, 'The image button opens a dialog where you paste an image URL and pick a display size.');
                    addBulletList(body, [
                        'A live preview shows the image before you insert it.',
                        'Choose a display width of 25, 50, 75, or 100 percent.',
                        'The image is inserted at your cursor position in the editor.'
                    ]);
                }
            },
            {
                icon: '▦', title: 'Tables',
                buildContent: (body) => {
                    addParagraph(body, 'The table button opens a dialog where you pick the size of the table to insert.');
                    addBulletList(body, [
                        'Hover the quick grid and click to choose the number of rows and columns, or type larger sizes into the Rows and Columns boxes.',
                        'Leave Make the first row a header ticked to get a shaded header row, or untick it for a plain grid.',
                        'The empty table is inserted at your cursor. Click any cell to type into it.'
                    ]);
                }
            },
            {
                icon: '🎨', title: 'Text and Highlight Color',
                buildContent: (body) => {
                    addParagraph(body, 'Two color buttons sit next to the font size selector. Select text first, then pick a color.');
                    addBulletList(body, [
                        'Text Color changes the color of the selected letters.',
                        'Highlight Color shades the background behind the selected text, in any color you choose, not just yellow.',
                        'Each palette has a Remove option that clears the color back to normal.'
                    ]);
                }
            },
            {
                icon: '👁', title: 'Preview',
                buildContent: (body) => {
                    addParagraph(body, 'The Preview HTML button in the footer opens a window with two views of your content.');
                    addBulletList(body, [
                        'The rendered preview shows roughly how the content will look once posted.',
                        'The source view shows the exact text, including the [code] wrapper, that will be inserted.',
                        'Use the Copy Source button to copy that text to your clipboard.'
                    ]);
                }
            },
            {
                icon: '⚡', title: 'Where It Gets Inserted',
                buildContent: (body) => {
                    addParagraph(body, 'When you click Insert, you choose the destination field. The text is appended below anything already there.');
                    addCategoryBadges(body, [
                        { bg: '#0066cc', label: 'Comment',   desc: 'Customer facing. The requester can read this.' },
                        { bg: '#5a6672', label: 'Work Note', desc: 'Internal only. Visible to your team but not the requester.' },
                        { bg: '#667eea', label: 'Both',      desc: 'Adds the same text to the comment and the work note at once.' }
                    ]);
                }
            },
            {
                icon: '🧹', title: 'Cleanup Tools',
                buildContent: (body) => {
                    addParagraph(body, 'These utility buttons sit on the right of the second toolbar row.');
                    addKeyValueGrid(body, [
                        ['✕ Selection',  'Removes inline formatting from just the highlighted text and leaves the rest alone.'],
                        ['✕ All Format', 'Strips formatting from the entire document and keeps only the plain text and line breaks.'],
                        ['🗑 Clear',      'Deletes all text in the editor so you can start over.']
                    ]);
                }
            },
            {
                icon: '🧽', title: 'Pasting Content',
                buildContent: (body) => {
                    addParagraph(body, 'When you paste from Word, Outlook, or a web page, the content is cleaned automatically.');
                    addBulletList(body, [
                        'Hidden styling, classes, and unsupported tags are stripped on paste.',
                        'Basic formatting such as bold, italic, lists, and links is preserved.',
                        'This keeps the inserted HTML small and predictable for ServiceNow.'
                    ]);
                }
            },
            {
                icon: '⌨️', title: 'Keyboard Shortcuts',
                buildContent: (body) => {
                    addParagraph(body, 'These shortcuts work while the editor is focused.');
                    addKeyValueGrid(body, [
                        ['Ctrl+B', 'Bold the selected text.'],
                        ['Ctrl+I', 'Italic the selected text.'],
                        ['Ctrl+U', 'Underline the selected text.']
                    ]);
                }
            },
            {
                icon: '⚙️', title: 'Header and Footer Controls',
                buildContent: (body) => {
                    addParagraph(body, 'These controls frame the editor window.');
                    addButtonBadge(body, '? Help',           '#fff',     '#667eea', '1px solid #c0c8f0', 'Opens this Feature Guide.');
                    addButtonBadge(body, '📋 What\'s New',    '#ff8c00',  '#fff',    null, 'Appears after an update. Shows the changelog of recent changes.');
                    addButtonBadge(body, '👁 Preview HTML',   '#6c757d',  '#fff',    null, 'Opens the preview window described above.');
                    addButtonBadge(body, 'Insert',            '#28a745',  '#fff',    null, 'Asks where to place the text, then inserts it into the ticket.');
                    addButtonBadge(body, 'Cancel',            '#fff',     '#333',    '1px solid #ccc', 'Closes the editor without inserting anything.');
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'formattedTextHelpModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '10008'
        });

        const modal = document.createElement('div');
        modal.id = 'formattedTextHelpModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '10009', background: '#fff', border: '2px solid #333', padding: '20px',
            borderRadius: '10px', width: '640px', maxWidth: '92vw', maxHeight: '82vh',
            overflowY: 'auto', color: '#333333', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box'
        });

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
        titleSub.textContent = `Formatted Text Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);
        const closeX = document.createElement('button');
        closeX.textContent = '✕'; closeX.type = 'button';
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

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close'; closeBtn.type = 'button';
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

    /* ----------------------------------------------------------*/

    function createEditorModal() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'formatted-text-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '9999',
            display: 'none',
            justifyContent: 'center',
            alignItems: 'center'
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                e.stopPropagation();
                overlay.style.display = 'none';
            }
        });

        // Modal container
        const modal = document.createElement('div');
        modal.id = 'formatted-text-modal';
        Object.assign(modal.style, {
            backgroundColor: '#fff',
            colorScheme: 'light',
            color: '#333',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            width: 'calc(100vw - 40px)',
            maxWidth: '1063px',
            height: 'calc(100vh - 100px)',
            maxHeight: '1000px',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
            zIndex: '10000',
            overflow: 'visible'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '15px 20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            flexShrink: '0'
        });

        const title = document.createElement('h3');
        title.textContent = 'Formatted Text Editor';
        Object.assign(title.style, {
            margin: '0',
            fontSize: '18px',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        });

        // Add version indicator
        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, {
            fontSize: '11px',
            backgroundColor: '#28a745',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 'normal'
        });
        title.appendChild(versionBadge);

        // Help button (always available)
        const helpBtn = document.createElement('button');
        helpBtn.textContent = '? Help';
        helpBtn.type = 'button';
        helpBtn.title = 'View feature guide and documentation';
        Object.assign(helpBtn.style, {
            fontSize: '11px',
            padding: '4px 10px',
            backgroundColor: '#fff',
            color: '#667eea',
            border: '1px solid #c0c8f0',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = '#fff'; };
        helpBtn.onclick = (e) => {
            e.stopPropagation();
            showHelpModal();
        };
        title.appendChild(helpBtn);

        // Check if there's a new version and user hasn't seen the changelog
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const changelogBtn = document.createElement('button');
            changelogBtn.textContent = '📋 What\'s New';
            changelogBtn.type = 'button';
            Object.assign(changelogBtn.style, {
                fontSize: '11px',
                padding: '4px 10px',
                backgroundColor: '#ff8c00',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                animation: 'pulse 2s infinite'
            });
            changelogBtn.onmouseover = () => changelogBtn.style.backgroundColor = '#e67e00';
            changelogBtn.onmouseout = () => changelogBtn.style.backgroundColor = '#ff8c00';
            changelogBtn.onclick = (e) => {
                e.stopPropagation();
                showChangelogModal();
            };
            title.appendChild(changelogBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.type = 'button';
        Object.assign(closeBtn.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        closeBtn.onmouseover = () => closeBtn.style.color = '#000';
        closeBtn.onmouseout = () => closeBtn.style.color = '#666';
        closeBtn.onclick = () => {
            overlay.style.display = 'none';
        };

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Apply font size with inline style
        function applyFontSize(fontSize, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            if (range.collapsed) {
                alert('Please select some text first.');
                return;
            }

            // Get the fragment
            const fragment = range.extractContents();

            // Process the fragment to wrap text nodes in spans
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    // Wrap text node in span with font-size
                    const span = document.createElement('span');
                    span.style.fontSize = fontSize;
                    span.textContent = node.textContent;
                    return span;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // For element nodes, process children
                    const clone = node.cloneNode(false);

                    Array.from(node.childNodes).forEach(child => {
                        const processed = processNode(child);
                        clone.appendChild(processed);
                    });

                    return clone;
                } else {
                    return node.cloneNode(true);
                }
            };

            // Create a container for the processed fragment
            const container = document.createDocumentFragment();
            Array.from(fragment.childNodes).forEach(node => {
                const processed = processNode(node);
                container.appendChild(processed);
            });

            // Insert the processed content
            range.insertNode(container);

            editor.focus();
        }

        // Wrap the current selection in a span carrying a color or background color.
        // styleProp is 'color' (text) or 'background-color' (highlight). We set the
        // value as !important inline so ServiceNow dark mode cannot recolor it in the
        // editor preview, and so it survives in the inserted [code] block.
        function applyColor(styleProp, color, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            if (range.collapsed) {
                alert('Please select some text first.');
                return;
            }

            const fragment = range.extractContents();

            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const span = document.createElement('span');
                    span.style.setProperty(styleProp, color, 'important');
                    span.textContent = node.textContent;
                    return span;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const clone = node.cloneNode(false);
                    Array.from(node.childNodes).forEach(child => {
                        clone.appendChild(processNode(child));
                    });
                    return clone;
                }
                return node.cloneNode(true);
            };

            const container = document.createDocumentFragment();
            Array.from(fragment.childNodes).forEach(node => {
                container.appendChild(processNode(node));
            });

            range.insertNode(container);
            editor.focus();
        }

        // Build the swatch popup anchored under a color toolbar button. It is fixed
        // positioned and appended to the body so the scrollable toolbar cannot clip it.
        function buildColorPopup(palette, styleProp, anchorEl, onPicked) {
            const pop = document.createElement('div');
            pop.id = 'color-popup';
            Object.assign(pop.style, {
                position: 'fixed', background: '#fff', border: '1px solid #ccc',
                borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', padding: '8px',
                zIndex: '10010', display: 'grid',
                gridTemplateColumns: 'repeat(6, 20px)', gap: '5px'
            });
            const rect = anchorEl.getBoundingClientRect();
            let left = rect.left;
            const popWidth = 6 * 20 + 5 * 5 + 16; // 6 swatches, gaps, padding
            if (left + popWidth > window.innerWidth - 10) left = window.innerWidth - popWidth - 10;
            if (left < 10) left = 10;
            pop.style.left = left + 'px';
            pop.style.top  = (rect.bottom + 4) + 'px';
            palette.forEach(color => {
                const sw = document.createElement('button');
                sw.type = 'button';
                sw.title = color;
                Object.assign(sw.style, {
                    width: '20px', height: '20px', border: '1px solid #ddd',
                    borderRadius: '3px', cursor: 'pointer', padding: '0',
                    backgroundColor: color
                });
                sw.addEventListener('mousedown', (e) => e.preventDefault());
                sw.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    restoreSelection();
                    applyColor(styleProp, color, editor);
                    onPicked();
                };
                pop.appendChild(sw);
            });

            // Full width row to clear the chosen color/highlight off the selection
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = '✕ Remove';
            Object.assign(clearBtn.style, {
                gridColumn: '1 / -1', marginTop: '4px', padding: '4px',
                border: '1px solid #ccc', borderRadius: '4px', background: '#f8f9fa',
                cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#444'
            });
            clearBtn.addEventListener('mousedown', (e) => e.preventDefault());
            clearBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                restoreSelection();
                applyColor(styleProp, styleProp === 'color' ? 'inherit' : 'transparent', editor);
                onPicked();
            };
            pop.appendChild(clearBtn);

            return pop;
        }

        // Custom command handler for non-standard tags
        function handleCustomCommand(command, editor) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const selectedText = range.toString();

            if (!selectedText) {
                alert('Please select some text first.');
                return;
            }

            let wrapper;

            switch (command) {
                case 'mark':
                    wrapper = document.createElement('mark');
                    break;
                case 'small':
                    wrapper = document.createElement('small');
                    break;
                case 'del':
                    wrapper = document.createElement('del');
                    break;
                case 'ins':
                    wrapper = document.createElement('ins');
                    break;
                case 'sub':
                    wrapper = document.createElement('sub');
                    break;
                case 'sup':
                    wrapper = document.createElement('sup');
                    break;
                case 'code':
                    wrapper = document.createElement('code');
                    break;
                case 'blockquote':
                    wrapper = document.createElement('blockquote');
                    break;
                default:
                    return;
            }

            if (wrapper) {
                try {
                    range.surroundContents(wrapper);
                } catch (e) {
                    // If surroundContents fails (complex selection), use alternate method
                    wrapper.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(wrapper);
                }

                // Clear and restore selection
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(wrapper);
                selection.addRange(newRange);
            }
        }

        // Remove all formatting function - strips ALL formatting from entire editor
        function removeAllFormatting(editor) {
            if (!confirm('Remove ALL formatting from the entire document?')) {
                return;
            }

            // Get plain text from editor (preserves line breaks)
            const plainText = editor.innerText;

            if (!plainText || plainText.trim() === '') {
                alert('Editor is empty.');
                return;
            }

            // Clear the editor
            editor.innerHTML = '';

            // Split by double newlines for paragraphs, single newlines for breaks
            const paragraphs = plainText.split('\n\n');

            paragraphs.forEach((para, index) => {
                if (para.trim()) {
                    const p = document.createElement('p');

                    // Handle single line breaks within paragraph
                    const lines = para.split('\n');
                    lines.forEach((line, lineIndex) => {
                        if (lineIndex > 0) {
                            p.appendChild(document.createElement('br'));
                        }
                        p.appendChild(document.createTextNode(line));
                    });

                    editor.appendChild(p);
                }
            });

            // If editor is still empty, add a blank paragraph
            if (!editor.innerHTML.trim()) {
                editor.innerHTML = '<p><br></p>';
            }

            editor.focus();
            console.log('✓ All formatting removed from document');
        }

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        Object.assign(toolbar.style, {
            padding: '10px 15px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#fff',
            maxHeight: '150px',
            overflowY: 'auto',
            overflowX: 'visible',
            position: 'relative',
            flexShrink: '0'
        });

        // First row - formatting buttons
        const firstRow = document.createElement('div');
        Object.assign(firstRow.style, {
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
        });

        // Second row - utility buttons (right-aligned)
        const secondRow = document.createElement('div');
        Object.assign(secondRow.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        // Hint text for @ mentions
        const hintText = document.createElement('div');
        Object.assign(hintText.style, {
            fontSize: '12px',
            color: '#666',
            fontStyle: 'italic',
            maxWidth: '700px',
            lineHeight: '1.4'
        });
        hintText.innerHTML = '💡 <strong>Tip:</strong> To mention someone, type <code style="background: #f4f4f4; padding: 2px 4px; border-radius: 3px;">@</code> without giving it any formatting, then complete the name after inserting the text into ServiceNow.';

        // Container for utility buttons
        const utilityButtonsContainer = document.createElement('div');
        Object.assign(utilityButtonsContainer.style, {
            display: 'flex',
            gap: '8px'
        });

        // Toolbar buttons configuration
        const toolbarButtons = [
            // First row - formatting
            { command: 'bold', icon: '<b>B</b>', title: 'Bold (Ctrl+B)' },
            { command: 'italic', icon: '<i>I</i>', title: 'Italic (Ctrl+I)' },
            { command: 'underline', icon: '<u>U</u>', title: 'Underline (Ctrl+U)' },
            { command: 'strikeThrough', icon: '<del>S</del>', title: 'Strikethrough' },
            { type: 'fontSize', command: 'fontSize', title: 'Font Size' }, // Font size selector
            { type: 'color', command: 'foreColor', icon: '<span style="border-bottom:3px solid #cc0000;">A</span>', title: 'Text Color' },
            { type: 'color', command: 'backColor', icon: '<span style="background:#ffff00;padding:0 3px;border-radius:2px;">A</span>', title: 'Highlight Color' },
            { type: 'custom', command: 'mark', icon: '<mark>H</mark>', title: 'Highlight' },
            { type: 'custom', command: 'small', icon: '<small>Aa</small>', title: 'Small Text' },
            { type: 'custom', command: 'del', icon: '<del>Del</del>', title: 'Deleted Text' },
            { type: 'custom', command: 'ins', icon: '<ins>Ins</ins>', title: 'Inserted Text' },
            { type: 'custom', command: 'sub', icon: 'X<sub>2</sub>', title: 'Subscript' },
            { type: 'custom', command: 'sup', icon: 'X<sup>2</sup>', title: 'Superscript' },
            { type: 'custom', command: 'code', icon: '&lt;/&gt;', title: 'Inline Code' },
            { type: 'custom', command: 'blockquote', icon: '"', title: 'Blockquote' },
            { type: 'link', command: 'link', icon: '🔗', title: 'Insert Link' },
            { type: 'image', command: 'image', icon: '🖼️', title: 'Insert Image' },   // ← NEW
            { type: 'table', command: 'table', icon: '▦ Table', title: 'Insert Table' },
            { command: 'insertUnorderedList', icon: '• List', title: 'Bullet List' },
            { command: 'insertOrderedList', icon: '1. List', title: 'Numbered List' },
            { command: 'formatBlock', value: 'h3', icon: 'H1', title: 'Heading 1 (H3)' },
            { command: 'formatBlock', value: 'h4', icon: 'H2', title: 'Heading 2 (H4)' },
            { command: 'formatBlock', value: 'p', icon: 'P', title: 'Paragraph' },
            // Second row - utility buttons (will be positioned on right)
            { type: 'utility', command: 'removeFormatSelection', icon: '✕ Selection', title: 'Remove Formatting from Selection' },
            { type: 'utility', command: 'removeFormat', icon: '✕ All Format', title: 'Remove All Formatting' },
            { type: 'utility', command: 'clear', icon: '🗑 Clear', title: 'Clear All Text' }
        ];

        // Create toolbar buttons
        toolbarButtons.forEach(btn => {
            // Handle font size selector separately
            if (btn.type === 'fontSize') {
                const fontSizeContainer = document.createElement('div');
                Object.assign(fontSizeContainer.style, {
                    position: 'relative',
                    display: 'inline-block'
                });

                const fontSizeSelect = document.createElement('select');
                fontSizeSelect.title = btn.title;
                Object.assign(fontSizeSelect.style, {
                    padding: '6px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'Arial, sans-serif',
                    outline: 'none'
                });

                // Font size options (like Word)
                const fontSizes = [
                    { label: '8', value: '8px' },
                    { label: '10', value: '10px' },
                    { label: '12', value: '12px' },
                    { label: '14 (default)', value: '14px' },
                    { label: '16', value: '16px' },
                    { label: '18', value: '18px' },
                    { label: '20', value: '20px' },
                    { label: '24', value: '24px' },
                    { label: '28', value: '28px' },
                    { label: '32', value: '32px' },
                    { label: '36', value: '36px' }
                ];

                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Size';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                fontSizeSelect.appendChild(defaultOption);

                // Add font size options
                fontSizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size.value;
                    option.textContent = size.label;
                    fontSizeSelect.appendChild(option);
                });

                fontSizeSelect.onchange = (e) => {
                    e.stopPropagation();
                    if (fontSizeSelect.value) {
                        applyFontSize(fontSizeSelect.value, editor);
                        editor.focus();
                        // Reset to default
                        fontSizeSelect.value = '';
                    }
                };

                fontSizeContainer.appendChild(fontSizeSelect);
                firstRow.appendChild(fontSizeContainer);
                return;
            }

            // Handle the color pickers (text color + highlight) separately
            if (btn.type === 'color') {
                const colorContainer = document.createElement('div');
                Object.assign(colorContainer.style, { position: 'relative', display: 'inline-block' });

                const colorBtn = document.createElement('button');
                colorBtn.type = 'button';
                colorBtn.title = btn.title;
                colorBtn.innerHTML = btn.icon + ' <span style="font-size:9px;">▾</span>';
                Object.assign(colorBtn.style, {
                    padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px',
                    backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px',
                    fontWeight: 'bold', flexShrink: '0', whiteSpace: 'nowrap'
                });
                colorBtn.onmouseover = () => { colorBtn.style.backgroundColor = '#e9ecef'; };
                colorBtn.onmouseout  = () => { colorBtn.style.backgroundColor = '#fff'; };

                const palette   = btn.command === 'foreColor' ? TEXT_COLORS : HIGHLIGHT_COLORS;
                const styleProp = btn.command === 'foreColor' ? 'color' : 'background-color';
                let popup = null;

                function closePopup() {
                    if (popup) { popup.remove(); popup = null; }
                    document.removeEventListener('mousedown', onOutside, true);
                }
                function onOutside(e) {
                    if (popup && !popup.contains(e.target) && !colorContainer.contains(e.target)) closePopup();
                }

                // Keep the editor selection alive while the button takes focus
                colorBtn.addEventListener('mousedown', (e) => { e.preventDefault(); saveSelection(); });
                colorBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (popup) { closePopup(); return; }
                    popup = buildColorPopup(palette, styleProp, colorBtn, () => {
                        closePopup();
                        editor.focus();
                    });
                    document.body.appendChild(popup);
                    document.addEventListener('mousedown', onOutside, true);
                };

                colorContainer.appendChild(colorBtn);
                firstRow.appendChild(colorContainer);
                return;
            }

            const button = document.createElement('button');
            button.innerHTML = btn.icon;
            button.type = 'button';
            Object.assign(button.style, {
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                position: 'relative',
                flexShrink: '0',
                whiteSpace: 'nowrap'
            });

            // Style the image button with a distinct teal accent
            if (btn.type === 'image') {
                button.style.backgroundColor = '#17a2b8';
                button.style.color = '#fff';
                button.style.borderColor = '#17a2b8';
            }

            // Style the table button with a distinct purple accent
            if (btn.type === 'table') {
                button.style.backgroundColor = '#6f42c1';
                button.style.color = '#fff';
                button.style.borderColor = '#6f42c1';
            }

            // Style utility buttons differently
            if (btn.type === 'utility') {
                if (btn.command === 'clear') {
                    button.style.backgroundColor = '#dc3545';
                    button.style.color = '#fff';
                    button.style.borderColor = '#dc3545';
                } else {
                    button.style.backgroundColor = '#6c757d';
                    button.style.color = '#fff';
                    button.style.borderColor = '#6c757d';
                }
            }

            // Create custom tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = btn.title;
            Object.assign(tooltip.style, {
                position: 'fixed',
                padding: '6px 10px',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: '0',
                zIndex: '10001',
                display: 'none'
            });

            // Tooltip arrow
            const arrow = document.createElement('div');
            arrow.className = 'tooltip-arrow';
            Object.assign(arrow.style, {
                position: 'absolute',
                top: '100%',
                width: '0',
                height: '0',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #333'
            });
            tooltip.appendChild(arrow);
            document.body.appendChild(tooltip);

            button.onmouseover = () => {
                if (btn.type === 'image') {
                    button.style.backgroundColor = '#138496';
                } else if (btn.type === 'table') {
                    button.style.backgroundColor = '#5a32a3';
                } else if (btn.type === 'utility') {
                    if (btn.command === 'clear') {
                        button.style.backgroundColor = '#c82333';
                    } else {
                        button.style.backgroundColor = '#5a6268';
                    }
                } else {
                    button.style.backgroundColor = '#e9ecef';
                }

                // Show tooltip first to get accurate dimensions
                tooltip.style.display = 'block';

                // Position tooltip
                const rect = button.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                // Calculate position - center horizontally above button
                let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                const top = rect.top - tooltipRect.height - 8;

                // Store original center position for arrow
                const buttonCenterX = rect.left + (rect.width / 2);

                // Prevent clipping on left edge
                if (left < 10) {
                    left = 10;
                }

                // Prevent clipping on right edge
                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }

                // Position arrow to point to button center
                const arrow = tooltip.querySelector('.tooltip-arrow');
                const arrowLeft = buttonCenterX - left - 5; // 5 is half the arrow width
                arrow.style.left = arrowLeft + 'px';

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.style.opacity = '1';
            };
            button.onmouseout = () => {
                if (btn.type === 'image') {
                    button.style.backgroundColor = '#17a2b8';
                } else if (btn.type === 'table') {
                    button.style.backgroundColor = '#6f42c1';
                } else if (btn.type === 'utility') {
                    if (btn.command === 'clear') {
                        button.style.backgroundColor = '#dc3545';
                    } else {
                        button.style.backgroundColor = '#6c757d';
                    }
                } else {
                    button.style.backgroundColor = '#fff';
                }
                tooltip.style.display = 'none';
                tooltip.style.opacity = '0';
            };

            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (btn.command === 'clear') {
                    if (confirm('Are you sure you want to clear all text?')) {
                        editor.innerHTML = '<p><br></p>';
                        editor.focus();
                    }
                    return false;
                }

                if (btn.command === 'removeFormat') {
                    removeAllFormatting(editor);
                    return false;
                }

                if (btn.command === 'removeFormatSelection') {
                    const sel = window.getSelection();
                    if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
                        alert('Please select some text first.');
                        return false;
                    }
                    document.execCommand('removeFormat');
                    document.execCommand('unlink');
                    editor.focus();
                    return false;
                }

                // Open the dedicated image modal
                if (btn.type === 'image') {
                    showImageModal();
                    return false;
                }

                // Open the dedicated table modal
                if (btn.type === 'table') {
                    showTableModal();
                    return false;
                }

                // Open the dedicated link modal
                if (btn.type === 'link') {
                    showLinkModal();
                    return false;
                }

                if (btn.type === 'custom') {
                    handleCustomCommand(btn.command, editor);
                    editor.focus();
                    return false;
                }

                if (btn.value) {
                    document.execCommand(btn.command, false, btn.value);
                    editor.focus();
                    return false;
                }

                document.execCommand(btn.command, false, null);
                editor.focus();
                return false;
            };

            // Append to appropriate row
            if (btn.type === 'utility') {
                utilityButtonsContainer.appendChild(button);
            } else {
                firstRow.appendChild(button);
            }
        });

        // Add hint and utility buttons to second row
        secondRow.appendChild(hintText);
        secondRow.appendChild(utilityButtonsContainer);

        toolbar.appendChild(firstRow);
        toolbar.appendChild(secondRow);

        // Editor container
        const editorContainer = document.createElement('div');
        Object.assign(editorContainer.style, {
            flex: '1 1 auto',
            padding: '15px 20px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
        });

        // Editable div
        const editor = document.createElement('div');
        editor.id = 'formatted-text-editor';
        editor.contentEditable = 'true';
        Object.assign(editor.style, {
            flex: '1',
            padding: '15px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '1.6',
            outline: 'none',
            backgroundColor: '#fff',
            color: '#333',
            overflowY: 'auto',
            minHeight: '100px'
        });
        editor.innerHTML = '<p>Start typing here...</p>';

        // Focus handler to clear placeholder
        editor.onfocus = () => {
            if (editor.innerHTML === '<p>Start typing here...</p>') {
                editor.innerHTML = '<p><br></p>';
            }
        };

        // Sanitize pasted content so Word/Outlook/web markup does not leak in
        editor.addEventListener('paste', (e) => {
            const cd = e.clipboardData || window.clipboardData;
            if (!cd) return;
            e.preventDefault();
            const pastedHTML = cd.getData('text/html');
            const pastedText = cd.getData('text/plain');
            if (pastedHTML && pastedHTML.trim()) {
                document.execCommand('insertHTML', false, sanitizePastedHTML(pastedHTML));
            } else if (pastedText) {
                document.execCommand('insertText', false, pastedText);
            }
        });

        editorContainer.appendChild(editor);

        // Footer with buttons
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '15px 20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            flexShrink: '0'
        });

        // Preview toggle
        const previewToggle = document.createElement('button');
        previewToggle.textContent = '👁 Preview HTML';
        previewToggle.type = 'button';
        Object.assign(previewToggle.style, {
            padding: '8px 16px',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            backgroundColor: '#6c757d',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        previewToggle.onmouseover = () => previewToggle.style.backgroundColor = '#5a6268';
        previewToggle.onmouseout = () => previewToggle.style.backgroundColor = '#6c757d';
        previewToggle.onclick = () => {
            showPreviewModal();
        };

        // Button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '10px'
        });

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f8f9fa';
        cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = '#fff';
        cancelBtn.onclick = () => {
            overlay.style.display = 'none';
        };

        // Insert button
        const insertBtn = document.createElement('button');
        insertBtn.textContent = 'Insert';
        insertBtn.type = 'button';
        Object.assign(insertBtn.style, {
            padding: '8px 16px',
            border: '1px solid #28a745',
            borderRadius: '4px',
            backgroundColor: '#28a745',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
        });
        insertBtn.onmouseover = () => insertBtn.style.backgroundColor = '#218838';
        insertBtn.onmouseout = () => insertBtn.style.backgroundColor = '#28a745';
        insertBtn.onclick = () => {
            showInsertTargetModal((target) => {
                const inserted = insertFormattedText(editor, target);
                if (inserted) {
                    overlay.style.display = 'none';
                    // Clear editor for next use
                    editor.innerHTML = '<p>Start typing here...</p>';
                }
            });
        };

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(insertBtn);

        footer.appendChild(previewToggle);
        footer.appendChild(buttonContainer);

        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(toolbar);
        modal.appendChild(editorContainer);
        modal.appendChild(footer);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        return overlay;
    }

    /* ==========================================================
     *  HTML CLEANING AND FORMATTING
     * ==========================================================*/

    function cleanHTML(html) {
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Tags allowed to carry an inline style through to ServiceNow:
        // spans (font size and colors), images (width), and every table part (borders).
        const STYLE_TAGS = ['span', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'];

        // Remove contenteditable and any attribute we do not explicitly keep
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            const tag = el.tagName.toLowerCase();

            // Capture the few attributes worth keeping before wiping the rest
            const href    = el.getAttribute('href');
            const src     = el.getAttribute('src');
            const alt     = el.getAttribute('alt');
            const title   = el.getAttribute('title');
            const style   = el.getAttribute('style');
            const colspan = el.getAttribute('colspan');
            const rowspan = el.getAttribute('rowspan');

            Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));

            if (href && tag === 'a')   el.setAttribute('href', href);
            if (src  && tag === 'img') el.setAttribute('src', src);
            if (alt  && tag === 'img') el.setAttribute('alt', alt);
            if (title)                 el.setAttribute('title', title);
            if (style && STYLE_TAGS.includes(tag)) el.setAttribute('style', style);
            if (colspan && (tag === 'th' || tag === 'td')) el.setAttribute('colspan', colspan);
            if (rowspan && (tag === 'th' || tag === 'td')) el.setAttribute('rowspan', rowspan);
        });

        // Get cleaned HTML
        let cleaned = temp.innerHTML;

        // Replace div tags with p tags (contenteditable often creates divs)
        cleaned = cleaned.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');

        // Remove empty paragraphs
        cleaned = cleaned.replace(/<p><br><\/p>/gi, '');
        cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');

        // Clean up excessive whitespace
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Trim
        cleaned = cleaned.trim();

        return cleaned;
    }

    /* ==========================================================
     *  PASTE SANITIZATION
     * ==========================================================*/

    // Tags we allow to survive a paste; everything else is unwrapped to its text.
    const PASTE_ALLOWED_TAGS = new Set([
        'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'INS', 'MARK', 'SMALL',
        'SUB', 'SUP', 'CODE', 'PRE', 'BLOCKQUOTE', 'A', 'IMG',
        'UL', 'OL', 'LI', 'H3', 'H4', 'P', 'BR', 'SPAN', 'DIV',
        'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
    ]);

    // Only these inline style properties are kept when pasting.
    const PASTE_ALLOWED_STYLE = [
        'font-size', 'width', 'max-width', 'color', 'background-color',
        'border', 'border-collapse', 'padding', 'text-align', 'vertical-align'
    ];

    // Tags allowed to carry filtered inline styles through a paste.
    const PASTE_STYLE_TAGS = new Set([
        'SPAN', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
    ]);

    function filterStyle(styleValue) {
        const keep = [];
        styleValue.split(';').forEach(part => {
            const idx = part.indexOf(':');
            if (idx === -1) return;
            const prop = part.slice(0, idx).trim().toLowerCase();
            const val  = part.slice(idx + 1).trim();
            if (prop && val && PASTE_ALLOWED_STYLE.includes(prop)) {
                keep.push(`${prop}: ${val}`);
            }
        });
        return keep.join('; ');
    }

    function sanitizePastedHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Drop dangerous or noise containers entirely
        temp.querySelectorAll('script, style, meta, link, title, head, noscript, iframe, object, embed')
            .forEach(el => el.remove());

        // Walk every element (document order, parents before children)
        Array.from(temp.querySelectorAll('*')).forEach(el => {
            const tag = el.tagName;
            if (!PASTE_ALLOWED_TAGS.has(tag)) {
                // Unwrap: lift children into the parent, then drop the element
                const parent = el.parentNode;
                if (parent) {
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                }
                return;
            }

            const keepStyle = PASTE_STYLE_TAGS.has(tag);
            const isCell = (tag === 'TH' || tag === 'TD');
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name === 'href' && tag === 'A') {
                    if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute('href');
                } else if (name === 'src' && tag === 'IMG') {
                    if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute('src');
                } else if (name === 'style' && keepStyle) {
                    const filtered = filterStyle(attr.value);
                    if (filtered) el.setAttribute('style', filtered);
                    else el.removeAttribute('style');
                } else if ((name === 'colspan' || name === 'rowspan') && isCell) {
                    // keep span attributes on table cells
                } else {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return temp.innerHTML;
    }

    /* ==========================================================
     *  INSERT FORMATTED TEXT INTO TEXTAREA
     * ==========================================================*/

    // Append wrapped content to a journal textarea and notify ServiceNow.
    function writeToTextarea(textarea, wrappedHTML) {
        const existingContent = textarea.value.trim();
        textarea.value = existingContent
            ? existingContent + '\n\n' + wrappedHTML
            : wrappedHTML;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        textarea.focus();
    }

    // target is 'comments', 'work_notes', or 'both'. Returns true if inserted.
    function insertFormattedText(editor, target) {
        // Comments (customer facing): split ID first, single mode fallback
        const commentsTA = document.getElementById('activity-stream-comments-textarea') ||
                           document.getElementById('activity-stream-textarea') ||
                           document.querySelector('[data-stream-text-input]');

        // Work notes (internal): split ID first, single mode fallback
        const workNotesTA = document.getElementById('activity-stream-work_notes-textarea') ||
                            document.getElementById('activity-stream-textarea') ||
                            document.querySelector('[data-stream-text-input]');

        const wanted = [];
        if (target === 'comments'   || target === 'both') wanted.push(commentsTA);
        if (target === 'work_notes' || target === 'both') wanted.push(workNotesTA);

        // Dedupe: in single combined mode both IDs resolve to the same element
        const targets = [...new Set(wanted.filter(Boolean))];

        if (targets.length === 0) {
            console.error('❌ Journal textarea not found!');
            alert('Could not find the target field. Please make sure you are on a ticket page.');
            return false;
        }

        // Get and clean HTML
        const html = cleanHTML(editor.innerHTML);
        if (!html || html.trim() === '') {
            alert('Please enter some text before inserting.');
            return false;
        }

        const wrappedHTML = `[code]${html}[/code]`;
        targets.forEach(ta => writeToTextarea(ta, wrappedHTML));

        console.log('✓ Formatted text inserted successfully (' + target + ')');
        return true;
    }

    /* ==========================================================
     *  POSITION BUTTON NEXT TO QUICK RESPONSE
     * ==========================================================*/

    let buttonAttempts = 0;
    const MAX_BUTTON_ATTEMPTS = 10;     // ~5s waiting for the preferred anchor
    const MAX_FALLBACK_ATTEMPTS = 20;   // ~10s total before giving up entirely

    function isVisible(el) {
        return !!(el && (el.offsetParent !== null || el.getClientRects().length));
    }

    // Same form actions container the Quick Response button appends itself to
    const QR_TARGET_SELECTOR = '.col-xs-10.col-md-9.col-lg-8.form-field .pull-left';

    function findStandaloneAnchor() {
        // 1. Preferred: the exact spot the Quick Response button uses, so the
        //    Formatted Text button lands in the same place when that helper is absent
        const formActions = document.querySelector(QR_TARGET_SELECTOR);
        if (isVisible(formActions)) return { el: formActions, mode: 'append' };

        // 2. Fallback: above whichever journal field is visible
        const journal = findJournalAnchor();
        if (journal) return { el: journal, mode: 'before' };

        return null;
    }

    function findJournalAnchor() {
        // Ordered candidates: the wrapper that holds both fields first (so the
        // button sits above them in dual mode), then each individual journal
        // textarea. We pick the first VISIBLE one so the button is never placed
        // inside a hidden tab, whether the ticket shows comments, work notes, or both.
        const candidates = [
            document.getElementById('multiple-input-journal-entry'),
            document.getElementById('activity-stream-comments-textarea'),
            document.getElementById('activity-stream-work_notes-textarea'),
            document.getElementById('activity-stream-textarea'),
            document.querySelector('[data-stream-text-input]')
        ].filter(Boolean);

        return candidates.find(isVisible) || candidates[0] || null;
    }

    function addFormattedTextButton() {
        if (document.getElementById('formatted-text-button')) return;

        // Preferred anchor: the Quick Response inline button (from the Response Helper)
        const quickResponseBtn = document.getElementById('ticket-response-inline-button');

        // Wait a while for the preferred anchor before falling back
        if (!quickResponseBtn && buttonAttempts < MAX_BUTTON_ATTEMPTS) {
            buttonAttempts++;
            setTimeout(addFormattedTextButton, 500);
            return;
        }

        // Standalone fallback: place it where the Quick Response button would go,
        // so we work even when the Response Helper is not installed
        const standaloneAnchor = quickResponseBtn ? null : findStandaloneAnchor();

        if (!quickResponseBtn && !standaloneAnchor) {
            if (buttonAttempts < MAX_FALLBACK_ATTEMPTS) {
                buttonAttempts++;
                setTimeout(addFormattedTextButton, 500);
            } else {
                console.log('Formatted Text Helper: no anchor element found, button not added.');
            }
            return;
        }

        // Create the formatted text button
        const formattedTextBtn = document.createElement('button');
        formattedTextBtn.id = 'formatted-text-button';
        formattedTextBtn.textContent = '📝 Formatted Text';
        formattedTextBtn.type = 'button';
        Object.assign(formattedTextBtn.style, {
            padding: '5px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            background: '#28a745',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            marginLeft: '10px',
            display: 'inline-block',
            transition: 'background 0.2s ease',
            color: 'white'
        });

        formattedTextBtn.onmouseover = () => formattedTextBtn.style.background = '#218838';
        formattedTextBtn.onmouseout = () => formattedTextBtn.style.background = '#28a745';

        if (quickResponseBtn) {
            // Insert after Quick Response button
            quickResponseBtn.parentNode.insertBefore(formattedTextBtn, quickResponseBtn.nextSibling);
        } else if (standaloneAnchor.mode === 'append') {
            // Same form actions row the Quick Response button uses (keep its 10px left margin)
            standaloneAnchor.el.appendChild(formattedTextBtn);
        } else {
            // Last resort: above whichever journal field is visible
            Object.assign(formattedTextBtn.style, { marginLeft: '0', marginBottom: '8px' });
            standaloneAnchor.el.parentNode.insertBefore(formattedTextBtn, standaloneAnchor.el);
        }

        // Create modal
        const modal = createEditorModal();

        // Button click handler
        formattedTextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'flex';

            // Focus editor after modal opens
            setTimeout(() => {
                const editor = document.getElementById('formatted-text-editor');
                if (editor) {
                    editor.focus();
                }
            }, 100);
        };

        console.log('✓ Formatted Text button added successfully' + (quickResponseBtn ? '' : ' (standalone fallback)'));
    }

    /* ==========================================================
     *  KEYBOARD SHORTCUTS IN EDITOR
     * ==========================================================*/

    document.addEventListener('keydown', (e) => {
        const editor = document.getElementById('formatted-text-editor');
        if (!editor || document.activeElement !== editor) return;

        // Ctrl+B for Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold');
        }
        // Ctrl+I for Italic
        else if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            document.execCommand('italic');
        }
        // Ctrl+U for Underline
        else if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            document.execCommand('underline');
        }
    });

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.7);
            }
            50% {
                box-shadow: 0 0 0 6px rgba(255, 140, 0, 0);
            }
        }

        #formatted-text-modal {
            box-sizing: border-box;
        }

        .custom-tooltip {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }

        #formatted-text-modal select:hover {
            background-color: #f8f9fa;
            border-color: #999;
        }

        #formatted-text-modal select:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102, 155, 234, 0.25);
        }

        @media (max-height: 800px) {
            #formatted-text-modal {
                height: calc(100vh - 60px) !important;
                maxHeight: calc(100vh - 60px) !important;
            }
        }

        @media (max-height: 600px) {
            #formatted-text-modal {
                height: calc(100vh - 40px) !important;
                maxHeight: calc(100vh - 40px) !important;
            }
        }

        @media (max-width: 600px) {
            #formatted-text-modal {
                width: calc(100vw - 20px) !important;
                height: calc(100vh - 40px) !important;
                maxHeight: calc(100vh - 40px) !important;
            }
        }

        #formatted-text-editor:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102, 155, 234, 0.25);
        }

        #formatted-text-editor b,
        #formatted-text-editor strong {
            font-weight: bold;
        }

        #formatted-text-editor i,
        #formatted-text-editor em {
            font-style: italic;
        }

        #formatted-text-editor u {
            text-decoration: underline;
        }

        #formatted-text-editor mark {
            background-color: yellow;
            padding: 0 2px;
        }

        #formatted-text-editor small {
            font-size: 0.8em;
        }

        #formatted-text-editor del {
            text-decoration: line-through;
        }

        #formatted-text-editor ins {
            text-decoration: underline;
            background-color: #d4edda;
        }

        #formatted-text-editor sub {
            vertical-align: sub;
            font-size: 0.8em;
        }

        #formatted-text-editor sup {
            vertical-align: super;
            font-size: 0.8em;
        }

        #formatted-text-editor code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
        }

        #formatted-text-editor blockquote {
            border-left: 4px solid #ccc;
            padding-left: 15px;
            margin: 10px 0;
            color: #666;
            font-style: italic;
        }

        #formatted-text-editor a {
            color: #007bff;
            text-decoration: underline;
        }

        #formatted-text-editor img {
            max-width: 100%;
            height: auto;
            vertical-align: middle;
        }

        #formatted-text-editor h3 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.5em 0;
        }

        #formatted-text-editor h4 {
            font-size: 1.3em;
            font-weight: bold;
            margin: 0.5em 0;
        }

        #formatted-text-editor ul,
        #formatted-text-editor ol {
            margin: 0.5em 0;
            padding-left: 2em;
        }

        #formatted-text-editor li {
            margin: 0.25em 0;
        }

        #formatted-text-editor p {
            margin: 0.5em 0;
        }

        #formatted-text-editor table {
            border-collapse: collapse;
            margin: 0.5em 0;
        }

        #formatted-text-editor th,
        #formatted-text-editor td {
            border: 1px solid #ccc;
            padding: 6px 10px;
            min-width: 24px;
        }

        #formatted-text-editor th {
            background-color: #f0f0f0;
            font-weight: bold;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar {
            height: 6px;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 3px;
        }

        #formatted-text-modal .toolbar::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        #formatted-text-editor::-webkit-scrollbar {
            width: 8px;
        }

        #formatted-text-editor::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }

        #formatted-text-editor::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }

        #formatted-text-editor::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        /* Image modal specific */
        #image-modal input:focus,
        #image-modal select:focus {
            border-color: #669bea;
            box-shadow: 0 0 0 0.2rem rgba(102,155,234,0.25);
        }

        /* Dark mode isolation */
        #formatted-text-modal, #image-modal, #changelog-modal,
        #link-modal, #preview-modal, #insert-target-modal,
        #table-modal, #color-popup, #formattedTextHelpModal { color: #333333 !important; }
        #formatted-text-modal, #changelog-modal, #link-modal, #preview-modal,
        #insert-target-modal, #table-modal, #color-popup, #formattedTextHelpModal {
            background-color: #ffffff !important;
        }
        /* Keep the editor surface and its chrome readable on dark themed instances */
        #formatted-text-editor {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #formatted-text-modal h3, #formatted-text-modal h4,
        #formatted-text-modal label, #formatted-text-modal p {
            color: #333333 !important;
        }
        #formatted-text-modal input, #formatted-text-modal select, #formatted-text-modal textarea,
        #image-modal input, #image-modal select, #image-modal textarea,
        #link-modal input, #link-modal select, #link-modal textarea,
        #preview-modal input, #preview-modal select, #preview-modal textarea,
        #table-modal input, #table-modal select, #table-modal textarea,
        #formattedTextHelpModal input, #formattedTextHelpModal select, #formattedTextHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (isInitialized) {
            console.log('Formatted Text Helper already initialized');
            return;
        }

        console.log('Initializing Formatted Text Helper v' + SCRIPT_VERSION + '...');
        isInitialized = true;

        // Check if this is a new version
        if (isNewVersion()) {
            console.log('New version detected: ' + SCRIPT_VERSION);
            // Show changelog on first interaction with the modal
            // Don't auto-show to avoid interrupting workflow
        }

        // Add button after Quick Response button loads
        addFormattedTextButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('✓ Formatted Text Helper v' + SCRIPT_VERSION + ' loaded');

})();