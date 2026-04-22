// ==UserScript==
// @name         |Toolbar| IOC Batch Copier
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-IOCBatchCopy.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-IOCBatchCopy.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.3
// @description  Batch copy IOC URLs
// @author       J.R.
// @match        https://*.goskope.com/ns*
// @grant        GM_setClipboard
// @grant        GM.setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔧 IOC Batch Copier loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.3';
    const CHANGELOG = `Version 1.0.3:
- Update URL Changed.    
    
Version 1.0:
- Initial Release`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('ioc-copier-version', null);
    }

    function saveVersion(version) {
        GM_setValue('ioc-copier-version', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('ioc-copier-changelog-seen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('ioc-copier-changelog-seen', SCRIPT_VERSION);
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
     *  CHANGELOG MODAL STYLES
     * ==========================================================*/

    GM_addStyle(`
        /* Changelog Notification Styles */
        #iocChangelogNotification {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
            position: absolute !important;
            top: 12px !important;
            right: 40px !important;
        }

        #iocChangelogNotification:hover {
            background-color: #d0d0d0 !important;
        }

        #iocChangelogNotification .ioc-notification-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: iocColorPulse 1s ease-in-out infinite !important;
        }

        @keyframes iocColorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #iocChangelogNotification .ioc-notification-text {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* Changelog Modal Styles */
        #iocChangelogModal {
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

        #iocChangelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.5em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }

        #iocChangelogModal .ioc-version-info {
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

        #iocChangelogModal .ioc-changelog-content {
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

        #iocChangelogModal .ioc-close-changelog {
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

        #iocChangelogModal .ioc-close-changelog:hover {
            background-color: #5568d3 !important;
        }

        #iocChangelogOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 1000000 !important;
        }

        .hidden {
            display: none !important;
        }
    `);

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'iocChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'iocChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'ioc-version-info';
        versionInfo.textContent = `IOC Batch Copier has been updated to version ${SCRIPT_VERSION}!`;

        const changelogContent = document.createElement('div');
        changelogContent.className = 'ioc-changelog-content';
        changelogContent.textContent = CHANGELOG;

        const closeButton = document.createElement('button');
        closeButton.className = 'ioc-close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);

            // Remove the notification dot
            const notification = document.getElementById('iocChangelogNotification');
            if (notification) {
                notification.remove();
            }
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(changelogContent);
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

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>`;

    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;
    const BATCH_SIZE = 5000;

    // Session-based batch position (resets when modal closes)
    let currentBatchPosition = 0;
    let needsClipboardPrep = false; // Flag to track if clipboard prep is needed

    /* ==========================================================
     *  CLIPBOARD HELPER
     * ==========================================================*/

    async function copyToClipboard(text) {
        // Try multiple methods in order of preference

        // Method 1: GM_setClipboard (Tampermonkey v4.x)
        if (typeof GM_setClipboard !== 'undefined') {
            try {
                GM_setClipboard(text);
                console.log('✅ Copied using GM_setClipboard');
                return true;
            } catch (e) {
                console.warn('GM_setClipboard failed:', e);
            }
        }

        // Method 2: GM.setClipboard (Tampermonkey v4.x async)
        if (typeof GM !== 'undefined' && typeof GM.setClipboard !== 'undefined') {
            try {
                await GM.setClipboard(text);
                console.log('✅ Copied using GM.setClipboard');
                return true;
            } catch (e) {
                console.warn('GM.setClipboard failed:', e);
            }
        }

        // Method 3: Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                console.log('✅ Copied using Clipboard API');
                return true;
            } catch (e) {
                console.warn('Clipboard API failed:', e);
            }
        }

        // Method 4: execCommand fallback (older browsers)
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (success) {
                console.log('✅ Copied using execCommand');
                return true;
            }
        } catch (e) {
            console.warn('execCommand failed:', e);
        }

        // All methods failed
        console.error('❌ All clipboard methods failed');
        return false;
    }

    /* ==========================================================
     *  LOADING OVERLAY
     * ==========================================================*/

    function showLoadingOverlay() {
        let overlay = document.getElementById('ioc-loading-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ioc-loading-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: '999999',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px'
            });

            // Spinner
            const spinner = document.createElement('div');
            Object.assign(spinner.style, {
                width: '60px',
                height: '60px',
                border: '6px solid #f3f3f3',
                borderTop: '6px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            });

            // Add keyframe animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);

            // Loading text
            const loadingText = document.createElement('div');
            loadingText.textContent = 'Loading IOC Batch Copier...';
            Object.assign(loadingText.style, {
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                fontFamily: 'Arial, sans-serif'
            });

            overlay.appendChild(spinner);
            overlay.appendChild(loadingText);
            document.body.appendChild(overlay);
        }

        overlay.style.display = 'flex';
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('ioc-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /* ==========================================================
     *  ENCODING FUNCTIONS
     * ==========================================================*/

    function encodeBase64(text) {
        return btoa(unescape(encodeURIComponent(text)));
    }

    function encodeROT13(text) {
        return text.replace(/[a-zA-Z]/g, function(c) {
            return String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
        });
    }

    /* ==========================================================
     *  MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('ioc-batch-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ioc-batch-modal';

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
            maxWidth: '700px'
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
        closeButton.onclick = closeModal;
        modal.appendChild(closeButton);

        // Title
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            position: 'absolute',
            top: '12px',
            left: '12px',
            fontSize: '12px',
            color: '#333',
            fontWeight: 'bold'
        });
        titleContainer.textContent = '📥 IOC Batch Copier';
        modal.appendChild(titleContainer);

        // Version display with changelog notification
        const versionContainer = document.createElement('div');
        Object.assign(versionContainer.style, {
            position: 'absolute',
            top: '12px',
            right: '40px',
            fontSize: '11px',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        const versionText = document.createElement('span');
        versionText.textContent = `v${SCRIPT_VERSION}`;
        versionContainer.appendChild(versionText);

        // Add changelog notification if new version
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'iocChangelogNotification';
            changelogNotification.innerHTML = `
                <span class="ioc-notification-dot"></span>
                <span class="ioc-notification-text">Changelog</span>
            `;
            changelogNotification.onclick = showChangelogModal;
            versionContainer.appendChild(changelogNotification);
        }

        modal.appendChild(versionContainer);

        // Status message
        const statusMessage = document.createElement('div');
        statusMessage.id = 'ioc-batch-status';
        Object.assign(statusMessage.style, {
            fontSize: '14px',
            color: '#666',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: '#f0f0f0',
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
            fontWeight: 'bold'
        });
        statusMessage.textContent = 'Ready...';
        modal.appendChild(statusMessage);

        // Batch progress
        const batchProgressContainer = document.createElement('div');
        batchProgressContainer.id = 'ioc-batch-progress';
        Object.assign(batchProgressContainer.style, {
            width: '100%',
            padding: '15px',
            backgroundColor: '#e9ecef',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#333',
            textAlign: 'center',
            fontWeight: 'bold'
        });
        batchProgressContainer.innerHTML = 'Position: 0 / 0<br>Batch: 0 / 0';
        modal.appendChild(batchProgressContainer);

        // Next batch preview
        const nextBatchPreview = document.createElement('div');
        nextBatchPreview.id = 'next-batch-preview';
        Object.assign(nextBatchPreview.style, {
            width: '100%',
            padding: '10px',
            backgroundColor: '#fff3cd',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#856404',
            textAlign: 'center',
            display: 'none'
        });
        nextBatchPreview.textContent = 'Next batch will copy lines: 1 - 5000';
        modal.appendChild(nextBatchPreview);

        // Separator
        const separator1 = document.createElement('hr');
        Object.assign(separator1.style, {
            width: '100%',
            border: 'none',
            borderTop: '1px solid #ddd',
            margin: '5px 0'
        });
        modal.appendChild(separator1);

        // Batch copy section
        const batchLabel = document.createElement('label');
        batchLabel.textContent = 'Batch Copy (5,000 lines per batch):';
        Object.assign(batchLabel.style, {
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#555',
            width: '100%'
        });
        modal.appendChild(batchLabel);

        // Batch buttons container
        const batchButtonsContainer = document.createElement('div');
        Object.assign(batchButtonsContainer.style, {
            display: 'flex',
            gap: '10px',
            width: '100%'
        });

        const btnCopyNext5000 = document.createElement('button');
        btnCopyNext5000.id = 'btn-copy-next-batch';
        btnCopyNext5000.textContent = '📋 Copy Next 5,000 Lines';
        Object.assign(btnCopyNext5000.style, {
            flex: '1',
            padding: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
        });
        btnCopyNext5000.onclick = handleBatchButtonClick;

        const btnResetBatch = document.createElement('button');
        btnResetBatch.textContent = '🔄 Reset Position';
        Object.assign(btnResetBatch.style, {
            padding: '12px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#17a2b8',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
        });
        btnResetBatch.onclick = resetBatchPosition;

        batchButtonsContainer.appendChild(btnCopyNext5000);
        batchButtonsContainer.appendChild(btnResetBatch);
        modal.appendChild(batchButtonsContainer);

        // Separator
        const separator2 = document.createElement('hr');
        Object.assign(separator2.style, {
            width: '100%',
            border: 'none',
            borderTop: '1px solid #ddd',
            margin: '10px 0'
        });
        modal.appendChild(separator2);

        // Export section
        const exportLabel = document.createElement('label');
        exportLabel.textContent = 'Export All (with encoding options):';
        Object.assign(exportLabel.style, {
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#555',
            width: '100%'
        });
        modal.appendChild(exportLabel);

        // Export buttons
        const exportButtonsContainer = document.createElement('div');
        Object.assign(exportButtonsContainer.style, {
            display: 'flex',
            gap: '10px',
            width: '100%'
        });

        const btnExportPlain = document.createElement('button');
        btnExportPlain.textContent = '📄 Plain Text';
        Object.assign(btnExportPlain.style, {
            flex: '1',
            padding: '10px',
            border: '2px solid #007bff',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'white',
            color: '#007bff',
            fontWeight: 'bold',
            fontSize: '13px'
        });
        btnExportPlain.onclick = () => performExport('plain');

        const btnExportBase64 = document.createElement('button');
        btnExportBase64.textContent = '🔒 Base64';
        Object.assign(btnExportBase64.style, {
            flex: '1',
            padding: '10px',
            border: '2px solid #28a745',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'white',
            color: '#28a745',
            fontWeight: 'bold',
            fontSize: '13px'
        });
        btnExportBase64.onclick = () => performExport('base64');

        const btnExportROT13 = document.createElement('button');
        btnExportROT13.textContent = '🔐 ROT13';
        Object.assign(btnExportROT13.style, {
            flex: '1',
            padding: '10px',
            border: '2px solid #ffc107',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'white',
            color: '#e0a800',
            fontWeight: 'bold',
            fontSize: '13px'
        });
        btnExportROT13.onclick = () => performExport('rot13');

        exportButtonsContainer.appendChild(btnExportPlain);
        exportButtonsContainer.appendChild(btnExportBase64);
        exportButtonsContainer.appendChild(btnExportROT13);
        modal.appendChild(exportButtonsContainer);

        // Info note
        const infoNote = document.createElement('p');
        infoNote.innerHTML = '💡 <strong>Important:</strong> Each click copies ONLY the current batch of 5,000 lines (not accumulated).<br>🔒 <strong>Export:</strong> Use Base64/ROT13 encoding to avoid antivirus detection.<br>⚡ <strong>Clipboard Prep:</strong> Click "Next Batch" between batches to prevent clipboard crashes.';
        Object.assign(infoNote.style, {
            fontSize: '11px',
            color: '#888',
            margin: '5px 0 0 0',
            textAlign: 'center',
            fontStyle: 'italic'
        });
        modal.appendChild(infoNote);

        document.body.appendChild(modal);
        return modal;
    }

    /* ==========================================================
     *  FUNCTIONALITY
     * ==========================================================*/

    function showModal() {
        showLoadingOverlay();

        setTimeout(() => {
            const modal = document.getElementById('ioc-batch-modal');
            if (modal) {
                modal.style.display = 'flex';
                currentBatchPosition = 0; // Reset position when opening
                needsClipboardPrep = false; // Reset clipboard prep flag
                updateStatus();
                updateBatchProgress();
                hideLoadingOverlay();
            } else {
                hideLoadingOverlay();
            }
        }, 300);
    }

    function closeModal() {
        const modal = document.getElementById('ioc-batch-modal');
        if (modal) {
            modal.style.display = 'none';
            currentBatchPosition = 0; // Reset position when closing
            needsClipboardPrep = false; // Reset clipboard prep flag
        }
    }

    function updateStatus() {
        const statusMessage = document.getElementById('ioc-batch-status');
        const textarea = document.querySelector("textarea.ns-form-textarea");

        if (!statusMessage) return;

        if (textarea) {
            const lines = textarea.value.split('\n').filter(line => line.trim());
            statusMessage.textContent = `✅ Found ${lines.length.toLocaleString()} line(s) in textarea`;
            statusMessage.style.backgroundColor = '#d4edda';
            statusMessage.style.color = '#155724';
        } else {
            statusMessage.textContent = '⚠️ Textarea not found. Navigate to the URL List page first.';
            statusMessage.style.backgroundColor = '#fff3cd';
            statusMessage.style.color = '#856404';
        }
    }

    function updateBatchProgress() {
        const textarea = document.querySelector("textarea.ns-form-textarea");
        const batchProgressContainer = document.getElementById('ioc-batch-progress');
        const nextBatchPreview = document.getElementById('next-batch-preview');
        const btnCopyNext = document.getElementById('btn-copy-next-batch');

        if (!textarea || !batchProgressContainer) return;

        const lines = textarea.value.split('\n').filter(line => line.trim());
        const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
        const currentBatch = Math.floor(currentBatchPosition / BATCH_SIZE);
        const remaining = Math.max(0, lines.length - currentBatchPosition);

        // Update progress display
        batchProgressContainer.innerHTML = `Position: ${currentBatchPosition.toLocaleString()} / ${lines.length.toLocaleString()}<br>Batches Completed: ${currentBatch} / ${totalBatches} | Remaining: ${remaining.toLocaleString()} lines`;

        if (remaining === 0) {
            batchProgressContainer.style.backgroundColor = '#d4edda';
            batchProgressContainer.style.color = '#155724';
            if (nextBatchPreview) nextBatchPreview.style.display = 'none';
        } else if (currentBatchPosition > 0) {
            batchProgressContainer.style.backgroundColor = '#fff3cd';
            batchProgressContainer.style.color = '#856404';
        } else {
            batchProgressContainer.style.backgroundColor = '#e9ecef';
            batchProgressContainer.style.color = '#333';
        }

        // Update next batch preview
        if (nextBatchPreview && remaining > 0 && !needsClipboardPrep) {
            const startLine = currentBatchPosition + 1;
            const endLine = Math.min(currentBatchPosition + BATCH_SIZE, lines.length);
            const batchSize = endLine - startLine + 1;

            nextBatchPreview.textContent = `📋 Next click will copy ${batchSize.toLocaleString()} lines (${startLine.toLocaleString()} to ${endLine.toLocaleString()})`;
            nextBatchPreview.style.display = 'block';
        } else if (nextBatchPreview && needsClipboardPrep) {
            nextBatchPreview.textContent = `⚡ Click "Next Batch" to prepare clipboard for next batch`;
            nextBatchPreview.style.display = 'block';
            nextBatchPreview.style.backgroundColor = '#d1ecf1';
            nextBatchPreview.style.color = '#0c5460';
        } else if (nextBatchPreview) {
            nextBatchPreview.style.display = 'none';
            nextBatchPreview.style.backgroundColor = '#fff3cd';
            nextBatchPreview.style.color = '#856404';
        }

        // Update button based on state
        if (btnCopyNext) {
            if (needsClipboardPrep) {
                // Waiting for clipboard prep
                btnCopyNext.textContent = '⚡ Next Batch';
                btnCopyNext.style.background = 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)';
                btnCopyNext.style.cursor = 'pointer';
            } else if (remaining === 0) {
                // All done
                btnCopyNext.textContent = '✅ All Lines Copied';
                btnCopyNext.style.background = '#6c757d';
                btnCopyNext.style.cursor = 'default';
            } else if (remaining < BATCH_SIZE) {
                // Last batch
                btnCopyNext.textContent = `📋 Copy Last ${remaining.toLocaleString()} Lines`;
                btnCopyNext.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btnCopyNext.style.cursor = 'pointer';
            } else {
                // Normal batch
                btnCopyNext.textContent = '📋 Copy Next 5,000 Lines';
                btnCopyNext.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btnCopyNext.style.cursor = 'pointer';
            }
        }
    }

    async function handleBatchButtonClick() {
        if (needsClipboardPrep) {
            // Prepare clipboard with sample text
            await prepareClipboard();
        } else {
            // Copy actual batch
            await copyNextBatch();
        }
    }

    async function prepareClipboard() {
        const sampleText = "IOC Copier Sample Text - Clipboard Ready";

        console.log('⚡ Preparing clipboard for next batch...');

        try {
            const success = await copyToClipboard(sampleText);

            if (!success) {
                alert('❌ Failed to prepare clipboard. Please try again.');
                return;
            }

            console.log('✅ Clipboard prepared successfully');

            // Reset the flag
            needsClipboardPrep = false;

            // Update UI
            updateBatchProgress();

        } catch (error) {
            console.error('Clipboard prep error:', error);
            alert('❌ Failed to prepare clipboard: ' + error.message);
        }
    }

    async function copyNextBatch() {
        const textarea = document.querySelector("textarea.ns-form-textarea");
        if (!textarea) {
            alert('❌ Textarea not found');
            return;
        }

        const lines = textarea.value.split('\n').filter(line => line.trim());

        if (currentBatchPosition >= lines.length) {
            alert('✅ All lines have been copied!');
            return;
        }

        // Calculate THIS batch only (not accumulated)
        const startPosition = currentBatchPosition;
        const endPosition = Math.min(currentBatchPosition + BATCH_SIZE, lines.length);

        // CRITICAL: Only slice the current batch, not from beginning
        const batchLines = lines.slice(startPosition, endPosition);
        const batchCount = batchLines.length;

        // Join ONLY this batch
        const text = batchLines.join('\n');

        console.log(`📋 Copying batch: lines ${startPosition + 1} to ${endPosition}`);
        console.log(`📏 Batch size: ${batchCount} lines`);
        console.log(`📝 Text length: ${text.length} characters`);

        try {
            const success = await copyToClipboard(text);

            if (!success) {
                alert('❌ Failed to copy to clipboard. Check console for details.');
                return;
            }

            const currentBatch = Math.floor(startPosition / BATCH_SIZE);
            const batchNum = currentBatch + 1;
            const totalBatches = Math.ceil(lines.length / BATCH_SIZE);

            // Update position AFTER successful copy
            currentBatchPosition = endPosition;

            // Check if there are more batches
            if (currentBatchPosition < lines.length) {
                // Set flag to require clipboard prep before next batch
                needsClipboardPrep = true;
                alert(`✅ Batch ${batchNum} of ${totalBatches} copied!\n\n${batchCount.toLocaleString()} line(s) copied to clipboard.\nLines ${(startPosition + 1).toLocaleString()} to ${endPosition.toLocaleString()} of ${lines.length.toLocaleString()}.\n\n⚠️ Only THIS batch is in clipboard (not accumulated).\n\n⚡ Click "Next Batch" to prepare for the next batch.`);
            } else {
                // Last batch completed
                alert(`✅ Batch ${batchNum} of ${totalBatches} copied!\n\n${batchCount.toLocaleString()} line(s) copied to clipboard.\nLines ${(startPosition + 1).toLocaleString()} to ${endPosition.toLocaleString()} of ${lines.length.toLocaleString()}.\n\n🎉 All batches completed!`);
            }

            updateBatchProgress();
        } catch (error) {
            console.error('Copy error:', error);
            alert('❌ Failed to copy to clipboard: ' + error.message);
        }
    }

    function resetBatchPosition() {
        currentBatchPosition = 0;
        needsClipboardPrep = false;
        updateBatchProgress();
        alert('✅ Batch position reset! Next click will start from line 1.');
    }

    function performExport(format) {
        const textarea = document.querySelector("textarea.ns-form-textarea");

        if (!textarea) {
            alert('❌ Textarea not found!');
            return;
        }

        const text = textarea.value;

        if (!text.trim()) {
            alert('⚠️ The textarea is empty.');
            return;
        }

        let exportContent, filename, mimeType;

        switch(format) {
            case 'base64':
                exportContent = encodeBase64(text);
                filename = 'ioc_urls.b64';
                mimeType = 'text/plain';
                break;
            case 'rot13':
                exportContent = encodeROT13(text);
                filename = 'ioc_urls.rot13';
                mimeType = 'text/plain';
                break;
            default: // plain
                exportContent = text;
                filename = 'ioc_urls.txt';
                mimeType = 'text/plain';
        }

        try {
            const blob = new Blob([exportContent], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            const lineCount = text.split('\n').filter(line => line.trim()).length;
            const formatName = format === 'base64' ? 'Base64' : format === 'rot13' ? 'ROT13' : 'Plain Text';

            alert(`✅ Exported ${lineCount.toLocaleString()} line(s) as ${formatName} to ${filename}`);

            console.log(`✅ IOC URLs exported as ${formatName} to ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            alert('❌ Export failed!');
        }
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ IOC Batch Copier already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ IOC Batch Copier: Max registration attempts reached');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 IOC Batch Copier registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found, registering IOC Batch Copier...');

            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id: 'iocBatchCopier',
                    icon: toolIcon,
                    tooltip: 'IOC Batch Copier',
                    position: 2
                }
            }));

            isRegistered = true;
            console.log('✅ IOC Batch Copier registered successfully!');
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
        if (e.detail.id === 'iocBatchCopier') {
            console.log('🔧 IOC Batch Copier clicked!');
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

        if (isInitialized) {
            console.log('IOC Batch Copier already initialized');
            return;
        }

        console.log('Initializing IOC Batch Copier...');
        isInitialized = true;
        initializeModal();
        console.log('✅ IOC Batch Copier modal ready!');

        setTimeout(() => {
            attemptRegistration();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', function() {
        if (!isRegistered) {
            console.log('🔄 Page loaded, checking registration status...');
            attemptRegistration();
        }
    });

})();