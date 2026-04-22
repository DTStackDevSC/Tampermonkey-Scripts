// ==UserScript==
// @name         |Toolbar| Domain Security Check
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainSecurityCheck.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainSecurityCheck.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.2.4
// @description  Toolbar button to check domain on VirusTotal, IBM X-Force Exchange & Netskope
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔒 Domain Security Check Tool loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.4';
    const CHANGELOG = `Version 1.2.4:
- Update URL Changed
    
Version 1.2.0:
- ServiceNow SPM Request URL is no longer hardcoded
- URL is now prompted on first use and saved to GM storage
- URL can be reconfigured at any time via the modal settings`;

    /* ==========================================================
     *  GM STORAGE KEYS
     * ==========================================================*/

    const GM_KEY_VERSION        = 'domainSecurityCheckVersion';
    const GM_KEY_CHANGELOG_SEEN = 'domainSecurityCheckChangelogSeen';
    const GM_KEY_SNOW_URL       = 'domainSecurityCheckServiceNowURL';

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion()    { return GM_getValue(GM_KEY_VERSION, null); }
    function saveVersion(v)        { GM_setValue(GM_KEY_VERSION, v); }
    function hasSeenChangelog()    { return GM_getValue(GM_KEY_CHANGELOG_SEEN, null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue(GM_KEY_CHANGELOG_SEEN, SCRIPT_VERSION); }

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
        return compareVersions(getStoredVersion(), SCRIPT_VERSION);
    }

    /* ==========================================================
     *  SERVICENOW URL MANAGEMENT
     * ==========================================================*/

    function getStoredServiceNowURL() {
        return GM_getValue(GM_KEY_SNOW_URL, null);
    }

    function saveServiceNowURL(url) {
        GM_setValue(GM_KEY_SNOW_URL, url);
    }

    /* ==========================================================
     *  SERVICENOW URL CONFIGURATION MODAL
     * ==========================================================*/

    /**
     * Shows a modal asking the user to provide the SPM Request Form URL.
     * @param {boolean} isReconfigure - If true, shows a slightly different title (reconfigure vs first-time setup).
     * @param {function} onSave - Callback invoked with the saved URL once the user confirms.
     */
    function showServiceNowURLModal(isReconfigure = false, onSave = null) {
        // Prevent duplicates
        if (document.getElementById('sn-url-config-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'sn-url-config-overlay';

        const modal = document.createElement('div');
        modal.id = 'sn-url-config-modal';

        // Title
        const title = document.createElement('h2');
        title.textContent = isReconfigure
            ? '⚙️ Reconfigure SPM Request URL'
            : '⚙️ SPM Request URL Setup';
        modal.appendChild(title);

        // Info box
        const infoBox = document.createElement('div');
        infoBox.className = 'sn-url-info-box';
        infoBox.innerHTML = `
            <strong>📄 Where to find this URL:</strong><br>
            The ServiceNow SPM Request Form URL is provided in the
            <em>General Scripts User Guide Word document</em>.
            Look for the section titled <strong>Required information & variables</strong>.
        `;
        modal.appendChild(infoBox);

        // Warning note
        const warning = document.createElement('div');
        Object.assign(warning.style, {
            background: '#fff0f0',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#c0392b',
            lineHeight: '1.5'
        });
        warning.innerHTML = '⚠️ <strong>Important:</strong> Enter the URLs <strong>exactly</strong> as they appear in the Word document. Do not add, remove, or modify any characters — including trailing slashes, subpaths, or query parameters.';
        modal.appendChild(warning);

        // Input
        const inputLabel = document.createElement('label');
        inputLabel.textContent = 'ServiceNow SPM Request Form URL:';
        inputLabel.htmlFor = 'sn-url-config-input';
        modal.appendChild(inputLabel);

        const inputField = document.createElement('input');
        inputField.id = 'sn-url-config-input';
        inputField.type = 'text';
        inputField.placeholder = 'https://...';

        // Pre-fill if reconfiguring
        const existing = getStoredServiceNowURL();
        if (isReconfigure && existing) {
            inputField.value = existing;
        }

        modal.appendChild(inputField);

        // Validation message
        const validationMsg = document.createElement('div');
        validationMsg.id = 'sn-url-validation-msg';
        modal.appendChild(validationMsg);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.className = 'sn-url-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'sn-url-btn-save';
        saveBtn.textContent = '💾 Save URL';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'sn-url-btn-skip';
        skipBtn.textContent = isReconfigure ? 'Cancel' : 'Skip for now';

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(skipBtn);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        function closeModal() {
            overlay.remove();
            modal.remove();
        }

        function validateAndSave() {
            const url = inputField.value.trim();

            if (!url) {
                validationMsg.textContent = '⚠️ Please enter a URL before saving.';
                validationMsg.style.color = '#c0392b';
                return;
            }

            if (!url.startsWith('https://')) {
                validationMsg.textContent = '⚠️ URL must start with https://';
                validationMsg.style.color = '#c0392b';
                return;
            }

            saveServiceNowURL(url);
            console.log('✅ ServiceNow SPM URL saved:', url);
            closeModal();
            if (typeof onSave === 'function') onSave(url);
        }

        saveBtn.addEventListener('click', validateAndSave);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') validateAndSave();
        });

        skipBtn.addEventListener('click', () => {
            console.log('ℹ️ ServiceNow URL setup skipped.');
            closeModal();
        });

        // Focus input
        setTimeout(() => inputField.focus(), 100);
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'domainSecurityChangelogOverlay';

        const modal = document.createElement('div');
        modal.id = 'domainSecurityChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;

        const changelogContent = document.createElement('div');
        changelogContent.className = 'changelog-content';
        changelogContent.textContent = CHANGELOG;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            const notification = document.getElementById('domainSecurityChangelogNotification');
            if (notification) notification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(changelogContent);
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  CSS STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
    /* ---- ServiceNow URL Config Modal ---- */
    #sn-url-config-overlay {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(0,0,0,0.55) !important;
        z-index: 1000000 !important;
    }

    #sn-url-config-modal {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        z-index: 1000001 !important;
        background: #ffffff !important;
        border: 2px solid #333333 !important;
        padding: 24px !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35) !important;
        border-radius: 10px !important;
        font-family: Arial, sans-serif !important;
        width: 520px !important;
        max-width: 92vw !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
    }

    #sn-url-config-modal h2 {
        margin: 0 !important;
        font-size: 17px !important;
        color: #222 !important;
        border-bottom: 2px solid #667eea !important;
        padding-bottom: 10px !important;
    }

    .sn-url-info-box {
        background: #fff8e1 !important;
        border-left: 4px solid #f39c12 !important;
        padding: 10px 12px !important;
        border-radius: 5px !important;
        font-size: 13px !important;
        color: #555 !important;
        line-height: 1.55 !important;
    }

    #sn-url-config-modal label {
        font-size: 13px !important;
        font-weight: bold !important;
        color: #444 !important;
    }

    #sn-url-config-input {
        width: 100% !important;
        padding: 9px 10px !important;
        border: 1px solid #ccc !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        font-family: 'Courier New', monospace !important;
        box-sizing: border-box !important;
    }

    #sn-url-config-input:focus {
        outline: none !important;
        border-color: #667eea !important;
        box-shadow: 0 0 0 2px rgba(102,126,234,0.25) !important;
    }

    #sn-url-validation-msg {
        font-size: 12px !important;
        min-height: 16px !important;
    }

    .sn-url-btn-row {
        display: flex !important;
        gap: 10px !important;
    }

    .sn-url-btn-save {
        flex: 1 !important;
        padding: 9px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: #fff !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        font-weight: bold !important;
        cursor: pointer !important;
    }

    .sn-url-btn-save:hover { opacity: 0.9 !important; }

    .sn-url-btn-skip {
        padding: 9px 16px !important;
        background: #e0e0e0 !important;
        color: #444 !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        cursor: pointer !important;
    }

    .sn-url-btn-skip:hover { background: #d0d0d0 !important; }

    /* ---- Changelog Notification ---- */
    #domainSecurityChangelogNotification {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        cursor: pointer !important;
        margin-left: 10px !important;
        padding: 3px 8px !important;
        border-radius: 4px !important;
        transition: background-color 0.2s ease !important;
    }

    #domainSecurityChangelogNotification:hover { background-color: #f0f0f0 !important; }

    #domainSecurityChangelogNotification .notification-dot {
        width: 8px !important;
        height: 8px !important;
        border-radius: 50% !important;
        animation: domainSecurityColorPulse 1s ease-in-out infinite !important;
    }

    @keyframes domainSecurityColorPulse {
        0%, 100% { background-color: #007bff; }
        50%       { background-color: #ff8c00; }
    }

    #domainSecurityChangelogNotification .notification-text {
        font-size: 11px !important;
        color: #0066cc !important;
        text-decoration: underline !important;
        font-family: Arial, sans-serif !important;
    }

    /* ---- Changelog Modal ---- */
    #domainSecurityChangelogModal {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        z-index: 999999 !important;
        background: #ffffff !important;
        border: 2px solid #333333 !important;
        padding: 20px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        border-radius: 10px !important;
        max-width: 600px !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        font-family: Arial, sans-serif !important;
    }

    #domainSecurityChangelogModal h2 {
        margin-top: 0 !important;
        margin-bottom: 15px !important;
        color: #333333 !important;
        border-bottom: 2px solid #667eea !important;
        padding-bottom: 10px !important;
        font-size: 20px !important;
        font-weight: bold !important;
    }

    #domainSecurityChangelogModal .version-info {
        background-color: #f8f9fa !important;
        padding: 10px !important;
        border-radius: 5px !important;
        margin-bottom: 15px !important;
        border-left: 4px solid #667eea !important;
        color: #333333 !important;
        font-size: 14px !important;
    }

    #domainSecurityChangelogModal .changelog-content {
        white-space: pre-wrap !important;
        line-height: 1.6 !important;
        color: #333333 !important;
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 13px !important;
        background-color: #fafafa !important;
        padding: 10px !important;
        border-radius: 5px !important;
    }

    #domainSecurityChangelogModal .close-changelog {
        margin-top: 15px !important;
        padding: 10px 20px !important;
        background-color: #667eea !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        font-weight: bold !important;
        width: 100% !important;
        font-size: 14px !important;
    }

    #domainSecurityChangelogModal .close-changelog:hover { background-color: #5568d3 !important; }

    #domainSecurityChangelogOverlay {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(0,0,0,0.5) !important;
        z-index: 999998 !important;
    }

    /* ---- Checkbox Container ---- */
    .servicenow-checkbox-container {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: #f0f0f0;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .servicenow-checkbox-container:hover { background: #e8e8e8; }

    .servicenow-checkbox-container input[type="checkbox"] {
        cursor: pointer;
        width: 16px;
        height: 16px;
        margin: 0;
        flex-shrink: 0;
    }

    .servicenow-checkbox-container label {
        cursor: pointer;
        font-size: 13px;
        color: #555;
        user-select: none;
        flex: 1;
        margin: 0;
        line-height: 16px;
    }

    /* ---- Configure URL link inside checkbox row ---- */
    #sn-configure-url-link {
        font-size: 11px !important;
        color: #0066cc !important;
        text-decoration: underline !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
    }

    #sn-configure-url-link:hover { color: #004a99 !important; }
`;
    document.head.appendChild(style);

    // Tool icon (shield with checkmark)
    const securityIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>`;

    // Global flags
    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;

    /* ==========================================================
     *  DOMAIN EXTRACTION FUNCTION
     * ==========================================================*/

    function extractDomain(text) {
        let domain = text.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, '');
        domain = domain.split('/')[0].split('?')[0];
        domain = domain.split(':')[0];
        return domain.trim().toLowerCase();
    }

    /* ==========================================================
     *  MAIN MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('security-check-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'security-check-modal';
        modal.style.cssText = `
            position:fixed; top:60px; left:50%; transform:translateX(-50%);
            background-color:#f9f9f9; border:1px solid #ccc;
            box-shadow:0px 4px 12px rgba(0,0,0,0.1); padding:50px 20px 20px 20px;
            z-index:999998; border-radius:10px; font-family:Arial,sans-serif;
            display:none; flex-direction:column; align-items:center; gap:15px;
            min-width:500px; max-width:600px;
        `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = `
            position:absolute; top:5px; right:5px; background:red; color:white;
            border:none; border-radius:4px; cursor:pointer; padding:4px 8px; font-weight:bold;
        `;
        closeButton.onclick = () => { modal.style.display = 'none'; };
        modal.appendChild(closeButton);

        // Title
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            position:'absolute', top:'12px', left:'12px',
            fontSize:'12px', color:'#333', fontWeight:'bold'
        });
        titleContainer.textContent = '🛡️ Domain Security Check';
        modal.appendChild(titleContainer);

        // Version row
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            position:'absolute', top:'28px', left:'12px',
            display:'flex', alignItems:'center', gap:'8px'
        });

        const versionIndicator = document.createElement('span');
        versionIndicator.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionIndicator.style, { fontSize:'10px', color:'#666', fontWeight:'normal' });
        versionRow.appendChild(versionIndicator);

        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'domainSecurityChangelogNotification';

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = 'Changelog';

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onclick = () => showChangelogModal();
            versionRow.appendChild(changelogNotification);
        }

        modal.appendChild(versionRow);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Enter a domain or URL to check its reputation across multiple security platforms.';
        Object.assign(description.style, {
            fontSize:'13px', color:'#666', margin:'0', textAlign:'center', width:'100%'
        });
        modal.appendChild(description);

        // Input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'width:100%; display:flex; flex-direction:column; gap:8px;';

        const inputLabel = document.createElement('label');
        inputLabel.textContent = 'Domain or URL:';
        inputLabel.style.cssText = 'align-self:flex-start; font-weight:bold; font-size:13px; color:#555;';

        const inputField = document.createElement('input');
        inputField.id = 'domain-input-field';
        inputField.type = 'text';
        inputField.placeholder = 'e.g., google.com or https://example.com/path';
        Object.assign(inputField.style, {
            width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'6px',
            fontSize:'14px', fontFamily:'Courier New, monospace', boxSizing:'border-box'
        });

        inputContainer.appendChild(inputLabel);
        inputContainer.appendChild(inputField);
        modal.appendChild(inputContainer);

        // Preview
        const previewContainer = document.createElement('div');
        previewContainer.id = 'domain-preview';
        Object.assign(previewContainer.style, {
            width:'100%', padding:'10px', background:'#e8f4f8', borderRadius:'6px',
            fontSize:'12px', color:'#0066cc', fontWeight:'bold', textAlign:'center', display:'none'
        });
        modal.appendChild(previewContainer);

        // Checkbox row (checkbox + label + configure link)
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'servicenow-checkbox-container';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'servicenow-catalog-checkbox';

        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = 'servicenow-catalog-checkbox';
        checkboxLabel.textContent = 'Open SPM Request Form';

        // "Configure URL" link shown inline
        const configureLink = document.createElement('span');
        configureLink.id = 'sn-configure-url-link';
        configureLink.textContent = getStoredServiceNowURL() ? '⚙️ Change URL' : '⚙️ Set URL';
        configureLink.title = 'Configure the ServiceNow SPM Request Form URL';
        configureLink.addEventListener('click', (e) => {
            e.stopPropagation();
            showServiceNowURLModal(true, (savedURL) => {
                configureLink.textContent = '⚙️ Change URL';
                console.log('✅ URL updated to:', savedURL);
            });
        });

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(checkboxLabel);
        checkboxContainer.appendChild(configureLink);

        // Click on container toggles checkbox (but not the configure link)
        checkboxContainer.addEventListener('click', (e) => {
            if (e.target === checkbox || e.target === configureLink) return;
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
        });

        modal.appendChild(checkboxContainer);

        // Check button
        const btnCheck = document.createElement('button');
        btnCheck.textContent = '🔍 Check Domain Security';
        Object.assign(btnCheck.style, {
            padding:'10px 20px', border:'none', borderRadius:'6px', cursor:'pointer',
            background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color:'white', fontWeight:'bold', fontSize:'14px', width:'100%', transition:'transform 0.2s'
        });
        btnCheck.onmouseover = () => btnCheck.style.transform = 'scale(1.02)';
        btnCheck.onmouseout  = () => btnCheck.style.transform = 'scale(1)';
        modal.appendChild(btnCheck);

        // Info box
        const infoBox = document.createElement('div');
        Object.assign(infoBox.style, {
            width:'100%', padding:'12px', background:'#f0f0f0',
            borderRadius:'6px', fontSize:'12px', color:'#555', lineHeight:'1.5'
        });
        infoBox.innerHTML = `
            <strong>What happens when you check:</strong><br>
            ✓ Domain copied to clipboard (https://domain)<br>
            ✓ Opens Netskope URL Lookup<br>
            ✓ Opens IBM X-Force Exchange<br>
            ✓ Opens VirusTotal<br>
            ✓ Opens ServiceNow SPM Request Form (if checked &amp; URL is configured)
        `;
        modal.appendChild(infoBox);

        document.body.appendChild(modal);

        /* ---- Inner helpers ---- */

        function updatePreview() {
            const input = inputField.value.trim();
            const preview = document.getElementById('domain-preview');
            if (!input) { preview.style.display = 'none'; return; }
            const domain = extractDomain(input);
            if (domain) {
                preview.textContent = `Will check: ${domain}`;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        }

        function checkDomain() {
            const input = inputField.value.trim();
            if (!input) { alert('⚠️ Please enter a domain or URL'); inputField.focus(); return; }

            const domain = extractDomain(input);
            if (!domain) { alert('⚠️ Could not extract a valid domain from the input'); inputField.focus(); return; }

            console.log('🔍 Checking domain:', domain);

            const fullUrl = `https://${domain}`;
            try {
                GM_setClipboard(fullUrl, 'text');
                const originalText = btnCheck.textContent;
                btnCheck.textContent = '✓ Copied to Clipboard!';
                btnCheck.style.background = '#28a745';
                setTimeout(() => {
                    btnCheck.textContent = originalText;
                    btnCheck.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy to clipboard:', err);
            }

            GM_openInTab('https://www.netskope.com/url-lookup', { active: false, insert: true });
            GM_openInTab(`https://exchange.xforce.ibmcloud.com/url/${domain}`, { active: false, insert: true });
            GM_openInTab(`https://www.virustotal.com/gui/domain/${domain}`, { active: false, insert: true });

            const serviceNowCheckbox = document.getElementById('servicenow-catalog-checkbox');
            if (serviceNowCheckbox && serviceNowCheckbox.checked) {
                const snowURL = getStoredServiceNowURL();
                if (snowURL) {
                    GM_openInTab(snowURL, { active: false, insert: true });
                    console.log('✅ Opened ServiceNow SPM Request tab');
                } else {
                    // No URL stored yet — prompt the user to set it first
                    showServiceNowURLModal(false, (savedURL) => {
                        GM_openInTab(savedURL, { active: false, insert: true });
                        console.log('✅ Opened ServiceNow SPM Request tab after setup');
                        // Update the configure link text
                        const link = document.getElementById('sn-configure-url-link');
                        if (link) link.textContent = '⚙️ Change URL';
                    });
                }
            }

            console.log('✅ Opened security check tabs for:', domain);
        }

        inputField.addEventListener('input', updatePreview);
        inputField.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkDomain(); });
        btnCheck.addEventListener('click', checkDomain);

        return modal;
    }

    /* ==========================================================
     *  SHOW MODAL FUNCTION
     * ==========================================================*/

    function showModal() {
        const modal = document.getElementById('security-check-modal');
        if (!modal) return;

        modal.style.display = 'flex';

        const selectedText = window.getSelection().toString().trim();
        const inputField = document.getElementById('domain-input-field');
        if (inputField) {
            if (selectedText) {
                inputField.value = selectedText;
                inputField.dispatchEvent(new Event('input'));
            }
            setTimeout(() => inputField.focus(), 100);
        }
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Domain Security Check: Max registration attempts reached.');
            return;
        }

        registrationAttempts++;
        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: 'domainSecurityCheck', icon: securityIcon, tooltip: 'Security Check', position: 4 }
            }));
            isRegistered = true;
            console.log('✅ Domain Security Check registered successfully!');
        } else {
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    document.addEventListener('toolbarReady',       () => attemptRegistration());
    document.addEventListener('toolbarToolClicked', (e) => {
        if (e.detail.id === 'domainSecurityCheck') showModal();
    });

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;

        console.log('Initializing Domain Security Check...');
        isInitialized = true;
        initializeModal();
        console.log('✅ Domain Security Check modal ready!');

        // Prompt for ServiceNow URL on first install if not yet stored
        if (!getStoredServiceNowURL()) {
            console.log('ℹ️ No ServiceNow URL stored. Showing setup prompt...');
            showServiceNowURLModal(false);
        }

        setTimeout(attemptRegistration, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => {
        if (!isRegistered) attemptRegistration();
    });

})();