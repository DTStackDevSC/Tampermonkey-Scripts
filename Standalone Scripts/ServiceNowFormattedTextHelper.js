// ==UserScript==
// @name         Formatted Text Helper
// @namespace    https://gitlab.com/-/snippets/4896559
// @author       J.R.
// @version      1.0.1.2
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

    const SCRIPT_VERSION = '1.0.1';
    const CHANGELOG = `Version 1.0.1:
- Migrated all storage from browser localStorage to Tampermonkey GM storage

Version 1.0.0:
- Initial release`;

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

        const changelogContent = document.createElement('div');
        changelogContent.textContent = CHANGELOG;
        Object.assign(changelogContent.style, {
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            color: '#333'
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
        modal.appendChild(changelogContent);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => {
            closeButton.click();
        };
    }

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
                case 'link':
                    const url = prompt('Enter URL:', 'https://');
                    if (url && url.trim()) {
                        wrapper = document.createElement('a');
                        wrapper.href = url.trim();
                    } else {
                        return;
                    }
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
            { type: 'custom', command: 'mark', icon: '<mark>H</mark>', title: 'Highlight' },
            { type: 'custom', command: 'small', icon: '<small>Aa</small>', title: 'Small Text' },
            { type: 'custom', command: 'del', icon: '<del>Del</del>', title: 'Deleted Text' },
            { type: 'custom', command: 'ins', icon: '<ins>Ins</ins>', title: 'Inserted Text' },
            { type: 'custom', command: 'sub', icon: 'X<sub>2</sub>', title: 'Subscript' },
            { type: 'custom', command: 'sup', icon: 'X<sup>2</sup>', title: 'Superscript' },
            { type: 'custom', command: 'code', icon: '&lt;/&gt;', title: 'Inline Code' },
            { type: 'custom', command: 'blockquote', icon: '"', title: 'Blockquote' },
            { type: 'custom', command: 'link', icon: '🔗', title: 'Insert Link' },
            { type: 'image', command: 'image', icon: '🖼️', title: 'Insert Image' },   // ← NEW
            { command: 'insertUnorderedList', icon: '• List', title: 'Bullet List' },
            { command: 'insertOrderedList', icon: '1. List', title: 'Numbered List' },
            { command: 'formatBlock', value: 'h3', icon: 'H1', title: 'Heading 1 (H3)' },
            { command: 'formatBlock', value: 'h4', icon: 'H2', title: 'Heading 2 (H4)' },
            { command: 'formatBlock', value: 'p', icon: 'P', title: 'Paragraph' },
            // Second row - utility buttons (will be positioned on right)
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

                // Open the dedicated image modal
                if (btn.type === 'image') {
                    showImageModal();
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
            const html = cleanHTML(editor.innerHTML);
            const wrappedHTML = `[code]${html}[/code]`;
            alert('HTML Preview:\n\n' + wrappedHTML);
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
        insertBtn.textContent = 'Insert to Comment';
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
            insertFormattedText(editor);
            overlay.style.display = 'none';
            // Clear editor for next use
            editor.innerHTML = '<p>Start typing here...</p>';
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

        // Remove contenteditable attributes and other unwanted attributes
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove contenteditable
            el.removeAttribute('contenteditable');

            // For span elements, keep only style attribute (for font-size)
            if (el.tagName.toLowerCase() === 'span') {
                const style = el.getAttribute('style');
                // Remove all attributes
                const attrs = Array.from(el.attributes);
                attrs.forEach(attr => {
                    el.removeAttribute(attr.name);
                });
                // Restore style if it exists
                if (style) {
                    el.setAttribute('style', style);
                }
            } else if (el.tagName.toLowerCase() === 'img') {
                // For img elements, keep src and style (width)
                const src   = el.getAttribute('src');
                const style = el.getAttribute('style');
                const attrs = Array.from(el.attributes);
                attrs.forEach(attr => el.removeAttribute(attr.name));
                if (src)   el.setAttribute('src',   src);
                if (style) el.setAttribute('style', style);
            } else {
                // For other elements, remove style attributes
                el.removeAttribute('style');
            }

            // Keep only essential attributes
            const allowedAttrs = ['href', 'src', 'alt', 'title', 'style'];
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (!allowedAttrs.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
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
     *  INSERT FORMATTED TEXT INTO TEXTAREA
     * ==========================================================*/

    function insertFormattedText(editor) {
        const textarea = document.querySelector('#activity-stream-textarea');

        if (!textarea) {
            console.error('❌ Textarea not found!');
            alert('Could not find the comment textarea. Please make sure you are on a ticket page.');
            return;
        }

        // Get and clean HTML
        const html = cleanHTML(editor.innerHTML);

        if (!html || html.trim() === '') {
            alert('Please enter some text before inserting.');
            return;
        }

        // Wrap in [code] tags
        const wrappedHTML = `[code]${html}[/code]`;

        // Insert into textarea
        const existingContent = textarea.value.trim();
        if (existingContent) {
            textarea.value = existingContent + '\n\n' + wrappedHTML;
        } else {
            textarea.value = wrappedHTML;
        }

        // Trigger events to ensure ServiceNow detects the change
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        // Focus textarea
        textarea.focus();

        console.log('✓ Formatted text inserted successfully');
    }

    /* ==========================================================
     *  POSITION BUTTON NEXT TO QUICK RESPONSE
     * ==========================================================*/

    function addFormattedTextButton() {
        if (document.getElementById('formatted-text-button')) return;

        // Wait for Quick Response button to exist
        const quickResponseBtn = document.getElementById('ticket-response-inline-button');

        if (!quickResponseBtn) {
            console.log('Quick Response button not found yet, retrying...');
            setTimeout(addFormattedTextButton, 500);
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

        // Insert after Quick Response button
        quickResponseBtn.parentNode.insertBefore(formattedTextBtn, quickResponseBtn.nextSibling);

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

        console.log('✓ Formatted Text button added successfully');
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