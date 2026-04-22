// ==UserScript==
// @name         |Toolbar| Mini Summary Sidebar
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-MiniSummarySidebar.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-MiniSummarySidebar.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.2
// @description  Quick overview panel for ServiceNow tickets
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('📊 Mini Summary Sidebar loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.2';
    const CHANGELOG = `Version 1.0.2:
- Update URL Changed

Version 1.0.1:
- Migrated all storage from browser localStorage to Tampermonkey GM storage`;

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

    function compareVersions(v1, v2) {
        // Returns true if v2 is greater than v1
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

            // Remove the notification dot from sidebar
            const notification = document.getElementById('miniSummaryChangelogNotification');
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
     *  CSS STYLES - HARDCODED FOR THEME INDEPENDENCE
     * ==========================================================*/

    const versionControlStyles = document.createElement('style');
    versionControlStyles.textContent = `
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
    `;
    document.head.appendChild(versionControlStyles);

    /* ==========================================================
     *  CONFIGURATION
     * ==========================================================*/

    // Tool icon (summary/info icon)
    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </svg>`;

    // Global flags
    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;
    let sidebarVisible = false;

    /* ==========================================================
     *  DATA EXTRACTION FUNCTIONS
     * ==========================================================*/

    function getFieldValue(fieldId) {
        // Try different field ID formats - prioritize display values over system IDs
        const patterns = [
            `${fieldId}_label`,           // For reference fields (e.g., requested_for_label)
            `sys_display.${fieldId}`,     // Display value for reference fields
            `sys_readonly.${fieldId}`,    // Read-only display values
            `sys_readonly.sys_display.${fieldId}`, // Combo read-only + display
            fieldId                        // Direct field (last resort)
        ];

        for (const pattern of patterns) {
            const element = document.getElementById(pattern);
            if (element) {
                // Check value attribute first
                if (element.value && element.value.trim()) {
                    // Skip if it looks like a sys_id (32 character hex string)
                    if (!/^[a-f0-9]{32}$/i.test(element.value.trim())) {
                        return element.value.trim();
                    }
                }
                // Check textContent for readonly fields
                if (element.textContent && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    if (!/^[a-f0-9]{32}$/i.test(text)) {
                        return text;
                    }
                }
            }
        }

        // Special handling for select elements (state, priority, etc.)
        const selectElement = document.getElementById(fieldId) ||
                             document.getElementById(`sys_readonly.${fieldId}`);
        if (selectElement && selectElement.tagName === 'SELECT') {
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            if (selectedOption && selectedOption.text) {
                return selectedOption.text;
            }
        }

        return 'N/A';
    }

    function getVariableValue(variableName) {
        // Try to find sys_display fields for reference variables
        const displayPatterns = [
            `sys_display.ni.VE${variableName}`,
            `ni.VE${variableName}_label`
        ];

        for (const pattern of displayPatterns) {
            const elements = document.querySelectorAll(`input[id*="${pattern}"]`);
            for (const elem of elements) {
                if (elem.value && elem.value.trim() && !/^[a-f0-9]{32}$/i.test(elem.value.trim())) {
                    return elem.value.trim();
                }
            }
        }

        // Try direct ID lookup for textareas and inputs
        const directElement = document.getElementById(`ni.VE${variableName}`);
        if (directElement) {
            if (directElement.tagName === 'TEXTAREA' && directElement.value && directElement.value.trim()) {
                return directElement.value.trim();
            }
            if (directElement.tagName === 'INPUT' && directElement.value && directElement.value.trim() && !/^[a-f0-9]{32}$/i.test(directElement.value.trim())) {
                return directElement.value.trim();
            }
        }

        // Try to get catalog variable values by name attribute
        const textarea = document.querySelector(`textarea[name*="${variableName}"], textarea[id*="${variableName}"]`);
        if (textarea && textarea.value && textarea.value.trim()) {
            return textarea.value.trim();
        }

        const input = document.querySelector(`input[name*="${variableName}"][type="text"], input[name*="${variableName}"][type="hidden"]`);
        if (input && input.value && input.value.trim() && !/^[a-f0-9]{32}$/i.test(input.value.trim())) {
            return input.value.trim();
        }

        const select = document.querySelector(`select[name*="${variableName}"], select[id*="${variableName}"]`);
        if (select && select.value && select.value !== '') {
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption ? selectedOption.text : select.value;
        }

        return 'N/A';
    }

    function extractSummaryData() {
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
        const businessJustSpan = document.querySelector('span[aria-label="Business Justification"]');
        if (businessJustSpan) {
            // Get the parent label and find its 'for' attribute
            const parentLabel = businessJustSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const businessJustTextarea = document.getElementById(labelFor);
                    if (businessJustTextarea && businessJustTextarea.value && businessJustTextarea.value.trim()) {
                        data.description = businessJustTextarea.value.trim();
                    }
                }
            }
        }

        // Fallback to other methods if not found
        if (!data.description || data.description === 'N/A') {
            data.description = getVariableValue('business_justification') ||
                              getVariableValue('short_description') ||
                              getFieldValue('incident.short_description');
        }

        // Get web protection platform - search by span aria-label
        const platformSpan = document.querySelector('span[aria-label="Web Protection Platform"]');
        if (platformSpan) {
            const parentLabel = platformSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const platformSelect = document.getElementById(labelFor);
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
        const typeSpan = document.querySelector('span[aria-label="Type of Request"]');
        if (typeSpan) {
            const parentLabel = typeSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const typeSelect = document.getElementById(labelFor);
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
        const firmSpan = document.querySelector('span[aria-label="Requesting Member Firm"]');
        if (firmSpan) {
            const parentLabel = firmSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    // labelFor is "sys_display.ni.VE..." so use it directly
                    const firmInput = document.getElementById(labelFor);
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
        const appSpan = document.querySelector('span[aria-label="Application / URL"]');
        if (appSpan) {
            const parentLabel = appSpan.closest('label');
            if (parentLabel) {
                const labelFor = parentLabel.getAttribute('for');
                if (labelFor) {
                    const appInput = document.getElementById(labelFor);
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
     *  SIDEBAR INITIALIZATION
     * ==========================================================*/

    function initializeSidebar() {
        if (document.getElementById('mini-summary-sidebar')) return;

        const sidebar = document.createElement('div');
        sidebar.id = 'mini-summary-sidebar';
        Object.assign(sidebar.style, {
            position: 'fixed',
            top: '60px',
            right: '-360px', // Hidden by default
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

        // Title
        const title = document.createElement('div');
        title.textContent = '📊 Ticket Summary';
        Object.assign(title.style, {
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '10px',
            paddingRight: '30px'
        });
        sidebar.appendChild(title);

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
            notificationText.textContent = 'Changelog';

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
            { label: 'Business Justification', value: data.description, icon: '📝' },
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
            sidebar.style.right = '-360px';
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

    /* ==========================================================
     *  TOOLBAR REGISTRATION WITH RETRY MECHANISM
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) {
            console.log('✅ Mini Summary Sidebar already registered');
            return;
        }

        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Mini Summary Sidebar: Max registration attempts reached');
            return;
        }

        registrationAttempts++;
        console.log(`🔄 Mini Summary Sidebar registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            console.log('✅ Toolbar found, registering Mini Summary Sidebar...');

            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: {
                    id: 'miniSummary',
                    icon: toolIcon,
                    tooltip: 'Mini Summary Sidebar',
                    position: 6
                }
            }));

            isRegistered = true;
            console.log('✅ Mini Summary Sidebar registered successfully!');
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
        if (e.detail.id === 'miniSummary') {
            console.log('📊 Mini Summary Sidebar clicked!');
            toggleSidebar();
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
            console.log('Mini Summary Sidebar already initialized');
            return;
        }

        console.log('Initializing Mini Summary Sidebar...');
        isInitialized = true;
        initializeSidebar();
        initializeSPMModal();
        console.log('✅ Mini Summary Sidebar ready!');

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