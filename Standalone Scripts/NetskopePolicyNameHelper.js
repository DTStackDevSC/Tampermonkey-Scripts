// ==UserScript==
// @name         Real-time Protection Policy Naming Helper
// @namespace    https://gitlab.com/-/snippets/4896559
// @version      1.2.1
// @description  Generate standardized policy names for Netskope
// @author       J.R.
// @match        https://*.goskope.com/*
// @match        https://*.netskope.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Netskope Policy Generator] Script loaded');

    if (window.netskopeGeneratorLoaded) {
        console.log('[Netskope Policy Generator] Already loaded, skipping');
        return;
    }
    window.netskopeGeneratorLoaded = true;

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.2.0';
    const CHANGELOG = `Version 1.2.0 (Current):
- Added Saved Presets system — save any form state under a custom name
- Preset dropdown at the top of the panel for one-click loading
- Manage Presets panel to view, inspect, and delete presets
- Each preset displays a human-readable summary of its configuration
- Presets persist across sessions via GM storage

Version 1.1.0 (Old):
- Added changelog notification system with GM storage
- Improved version tracking and user notifications
- Enhanced UI with version indicator
- Added automatic update notifications

Version 1.0.1 (Old):
- Initial release
- CASB/Web policy generation
- DLP policy generation with criteria
- Tabbed interface for policy types`;

    /* ==========================================================
     *  VERSION MANAGEMENT
     * ==========================================================*/

    function getStoredVersion() { return GM_getValue('netskopeHelperVersion', null); }
    function saveVersion(version) { GM_setValue('netskopeHelperVersion', version); }
    function hasSeenChangelog() { return GM_getValue('netskopeHelperChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue('netskopeHelperChangelogSeen', SCRIPT_VERSION); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            if ((p2[i] || 0) > (p1[i] || 0)) return true;
            if ((p2[i] || 0) < (p1[i] || 0)) return false;
        }
        return false;
    }

    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

    /* ==========================================================
     *  PRESET STORAGE
     * ==========================================================*/

    const PRESETS_KEY = 'netskopePresets';

    function getPresets() {
        try {
            return JSON.parse(GM_getValue(PRESETS_KEY, '[]'));
        } catch {
            return [];
        }
    }

    function savePresets(presets) {
        GM_setValue(PRESETS_KEY, JSON.stringify(presets));
    }

    function addPreset(preset) {
        const presets = getPresets();
        presets.push(preset);
        savePresets(presets);
    }

    function removePreset(id) {
        const presets = getPresets().filter(p => p.id !== id);
        savePresets(presets);
    }

    function generatePresetSummary(tab, state) {
        const parts = [];
        parts.push(tab === 'dlp' ? 'DLP' : 'CASB/Web');
        if (state.isTest) parts.push('TEST');
        if (state.isGlobal) parts.push('GLB');
        if (state.memberFirm && state.memberFirm !== 'N/A') parts.push(state.memberFirm);
        if (state.geoGroup && state.geoGroup !== 'N/A') parts.push(state.geoGroup);
        if (state.geo && state.geo !== 'N/A') parts.push(state.geo);
        if (tab === 'dlp') {
            if (state.policyType && state.policyType !== 'N/A') parts.push(state.policyType);
            if (state.appliesTo && state.appliesTo !== 'N/A') parts.push(state.appliesTo);
            if (state.channelType && state.channelType !== 'N/A') parts.push(state.channelType);
            if (state.criteria && state.criteria.length > 0) parts.push(state.criteria.join('_'));
        } else {
            if (state.policyType && state.policyType !== 'N/A') parts.push(state.policyType);
        }
        if (state.description) parts.push(`"${state.description}"`);
        return parts.join(' · ');
    }

    function getCurrentFormState() {
        if (currentTab === 'casb') {
            return {
                isTest: document.getElementById('npg-test-checkbox').checked,
                isGlobal: document.getElementById('npg-global-checkbox').checked,
                memberFirm: document.getElementById('npg-member-firm-select').value,
                geoGroup: document.getElementById('npg-geo-group-select').value,
                geo: document.getElementById('npg-geo-select').value,
                policyType: document.getElementById('npg-policy-type-select').value,
                description: document.getElementById('npg-description-input').value.trim()
            };
        } else {
            const criteria = [];
            DLP_CRITERIA.forEach(c => {
                const cb = document.getElementById(`npg-dlp-criteria-${c.code}`);
                if (cb && cb.checked) criteria.push(c.code);
            });
            return {
                isTest: document.getElementById('npg-dlp-test-checkbox').checked,
                isGlobal: document.getElementById('npg-dlp-global-checkbox').checked,
                memberFirm: document.getElementById('npg-dlp-member-firm-select').value,
                geoGroup: document.getElementById('npg-dlp-geo-group-select').value,
                geo: document.getElementById('npg-dlp-geo-select').value,
                policyType: document.getElementById('npg-dlp-policy-type-select').value,
                description: document.getElementById('npg-dlp-description-input').value.trim(),
                appliesTo: document.getElementById('npg-dlp-applies-to-select').value,
                channelType: document.getElementById('npg-dlp-channel-type-select').value,
                criteria
            };
        }
    }

    function applyFormState(tab, state) {
        // Switch tab
        currentTab = tab;
        if (typeof updateTabUI === 'function') updateTabUI();

        if (tab === 'casb') {
            setCheckbox('npg-test-checkbox', state.isTest);
            setCheckbox('npg-global-checkbox', state.isGlobal);
            document.getElementById('npg-member-firm-select').value = state.memberFirm || 'N/A';
            document.getElementById('npg-geo-group-select').value = state.geoGroup || 'N/A';
            document.getElementById('npg-geo-select').value = state.geo || 'N/A';
            document.getElementById('npg-policy-type-select').value = state.policyType || 'N/A';
            document.getElementById('npg-description-input').value = state.description || '';
        } else {
            setCheckbox('npg-dlp-test-checkbox', state.isTest);
            setCheckbox('npg-dlp-global-checkbox', state.isGlobal);
            document.getElementById('npg-dlp-member-firm-select').value = state.memberFirm || 'N/A';
            document.getElementById('npg-dlp-geo-group-select').value = state.geoGroup || 'N/A';
            document.getElementById('npg-dlp-geo-select').value = state.geo || 'N/A';
            document.getElementById('npg-dlp-policy-type-select').value = state.policyType || 'N/A';
            document.getElementById('npg-dlp-description-input').value = state.description || '';
            document.getElementById('npg-dlp-applies-to-select').value = state.appliesTo || 'N/A';
            document.getElementById('npg-dlp-channel-type-select').value = state.channelType || 'N/A';
            DLP_CRITERIA.forEach(c => {
                const cb = document.getElementById(`npg-dlp-criteria-${c.code}`);
                if (cb) {
                    cb.checked = (state.criteria || []).includes(c.code);
                    cb.dispatchEvent(new Event('change'));
                }
            });
        }
        updatePreview();
    }

    // Helper: programmatically set a checkbox and fire its change listeners
    function setCheckbox(id, value) {
        const cb = document.getElementById(id);
        if (cb) {
            cb.checked = !!value;
            cb.dispatchEvent(new Event('change'));
        }
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'netskopeChangelogModalOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '20000', display: 'block'
        });

        const modal = document.createElement('div');
        modal.id = 'netskopeChangelogModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '20001', background: '#ffffff', border: '2px solid #333', padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial,sans-serif',
            borderRadius: '10px', maxWidth: '600px', width: '90%', maxHeight: '80vh',
            overflowY: 'auto', color: '#333'
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea',
            paddingBottom: '10px', fontSize: '1.5em', fontWeight: 'bold'
        });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa', color: '#333', padding: '10px', borderRadius: '5px',
            marginBottom: '15px', borderLeft: '4px solid #667eea', fontSize: '14px'
        });

        const changelogContent = document.createElement('div');
        changelogContent.textContent = CHANGELOG;
        Object.assign(changelogContent.style, {
            whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333',
            fontFamily: "'Courier New',Courier,monospace", fontSize: '13px',
            backgroundColor: '#fafafa', padding: '10px', borderRadius: '5px'
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, {
            marginTop: '15px', padding: '10px 20px', backgroundColor: '#667eea', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
            width: '100%', fontSize: '14px'
        });
        closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#5568d3'; });
        closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = '#667eea'; });
        closeButton.onclick = () => {
            overlay.remove(); modal.remove();
            markChangelogAsSeen(); saveVersion(SCRIPT_VERSION);
            const n = document.getElementById('netskopeChangelogNotification');
            if (n) n.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(changelogContent);
        modal.appendChild(closeButton);

        const parent = mainPanel ? mainPanel.parentElement : document.body;
        parent.appendChild(overlay);
        parent.appendChild(modal);
        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  CSS STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        #netskopeChangelogNotification {
            display: inline-flex !important; align-items: center !important; gap: 6px !important;
            cursor: pointer !important; margin-left: 10px !important; padding: 3px 8px !important;
            border-radius: 4px !important; transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }
        #netskopeChangelogNotification:hover { background-color: #f0f0f0 !important; }
        #netskopeChangelogNotification .netskope-notification-dot {
            width: 8px !important; height: 8px !important; border-radius: 50% !important;
            animation: netskopeColorPulse 1s ease-in-out infinite !important;
        }
        @keyframes netskopeColorPulse {
            0%, 100% { background-color: #667eea; }
            50% { background-color: #5568d3; }
        }
        #netskopeChangelogNotification .netskope-notification-text {
            font-size: 11px !important; color: #667eea !important; text-decoration: underline !important;
            font-family: Arial, sans-serif !important; font-weight: normal !important;
        }
        #netskopeChangelogModal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 20001 !important;
            background: #ffffff !important; border: 2px solid #333 !important;
            padding: 20px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            font-family: Arial, sans-serif !important; border-radius: 10px !important;
            max-width: 600px !important; max-height: 80vh !important; overflow-y: auto !important; color: #333 !important;
        }
        #netskopeChangelogModalOverlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;
            z-index: 20000 !important;
        }
        /* Manage Presets Panel */
        #npg-presets-panel {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 10001 !important;
            background: #ffffff !important; border-radius: 8px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.35) !important;
            width: 540px !important; max-height: 85vh !important; overflow-y: auto !important;
            padding: 24px !important; font-family: Arial, sans-serif !important;
        }
        #npg-presets-overlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.45) !important;
            z-index: 10000 !important;
        }
        .npg-preset-card {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px 14px;
            margin-bottom: 10px;
            background: #fafafa;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            transition: border-color 0.15s;
        }
        .npg-preset-card:hover { border-color: #9ca3af; }
        .npg-preset-card .npg-preset-info { flex: 1; min-width: 0; }
        .npg-preset-card .npg-preset-name {
            font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;
        }
        .npg-preset-card .npg-preset-summary {
            font-size: 12px; color: #6b7280; line-height: 1.4; word-break: break-word;
        }
        .npg-preset-card .npg-preset-date {
            font-size: 11px; color: #9ca3af; margin-top: 4px;
        }
        .npg-preset-card .npg-preset-tab-badge {
            font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px;
            white-space: nowrap; flex-shrink: 0; align-self: flex-start; margin-top: 2px;
        }
        .npg-preset-card .npg-preset-tab-badge.casb {
            background: #dbeafe; color: #1d4ed8;
        }
        .npg-preset-card .npg-preset-tab-badge.dlp {
            background: #ede9fe; color: #6d28d9;
        }
        .npg-preset-actions { display: flex; gap: 6px; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
        .npg-preset-btn {
            padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 500;
            cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151;
            transition: all 0.15s;
        }
        .npg-preset-btn:hover { background: #f3f4f6; }
        .npg-preset-btn.danger { color: #dc2626; border-color: #fca5a5; background: #fff; }
        .npg-preset-btn.danger:hover { background: #fee2e2; border-color: #dc2626; }
        .npg-empty-presets {
            text-align: center; padding: 32px 16px; color: #9ca3af;
            font-size: 14px; border: 1px dashed #e5e7eb; border-radius: 6px;
        }
        .npg-empty-presets .npg-empty-icon { font-size: 32px; margin-bottom: 8px; }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  CONFIGURATION DATA (Needs to be edited for AME & APAC MF's)
     * ==========================================================*/

    const MEMBER_FIRMS = [
        { code: 'N/A', label: 'N/A' },
        { code: 'ES', label: 'Deloitte Spain (ES)' },
        { code: 'Africa', label: 'Deloitte Africa (Africa)' },
        { code: 'DKU', label: 'Deloitte DKU (DKU)' },
        { code: 'DCE', label: 'Deloitte Central Europe (DCE)' },
        { code: 'NSE', label: 'Deloitte North and South Europe (NSE)' }
    ];
    const GEO_GROUPS = [
        { code: 'N/A', label: 'N/A' },
        { code: 'DCM', label: 'Deloitte Central Mediterranean (DCM)' },
        { code: 'Nordics', label: 'Nordics (Nordics)' }
    ];
    const GEOS = [
        { code: 'N/A', label: 'N/A' },
        { code: 'ZA', label: 'Southern Africa (ZA)' },
        { code: 'EA', label: 'East Africa (EA)' },
        { code: 'WA', label: 'West Africa (WA)' },
        { code: 'CE', label: 'Central Europe (CE)' },
        { code: 'FR', label: 'France (FR)' },
        { code: 'DE', label: 'Germany (DE)' },
        { code: 'AT', label: 'Austria (AT)' },
        { code: 'LU', label: 'Luxembourg (LU)' },
        { code: 'PT', label: 'Portugal (PT)' },
        { code: 'TR', label: 'Turkey (TR)' },
        { code: 'UK', label: 'United Kingdom (UK)' },
        { code: 'CH', label: 'Switzerland (CH)' },
        { code: 'IE', label: 'Ireland (IE)' },
        { code: 'BE', label: 'Belgium (BE)' },
        { code: 'NL', label: 'Netherlands (NL)' },
        { code: 'DME', label: 'Deloitte Middle East (DME)' },
        { code: 'IT', label: 'Italy (IT)' },
        { code: 'GR', label: 'Greece (GR)' },
        { code: 'MT', label: 'Malta (MT)' },
        { code: 'NO', label: 'Norway (NO)' },
        { code: 'DK', label: 'Denmark (DK)' },
        { code: 'SE', label: 'Sweden (SE)' },
        { code: 'FI', label: 'Finland (FI)' },
        { code: 'IS', label: 'Iceland (IS)' }
    ];
    const POLICY_TYPES = ['N/A', 'CASB Allow', 'CASB Deny', 'Threat Allow', 'Threat Deny', 'Web Allow', 'Web Deny'];
    const DLP_POLICY_TYPES = ['N/A', 'DLP Block', 'DLP Monitor', 'DLP Notify', 'DLP Deny'];
    const APPLIES_TO = [
        { code: 'N/A', label: 'N/A' },
        { code: 'FW', label: 'Firm Wide (FW)' },
        { code: 'UG', label: 'User Group (UG)' }
    ];
    const POLICY_CHANNEL_TYPES = [
        { code: 'N/A', label: 'N/A' },
        { code: 'W', label: 'Web (W)' },
        { code: 'E', label: 'Email (E)' },
        { code: 'D', label: 'Endpoint (D)' }
    ];
    const DLP_CRITERIA = [
        { code: 'CAP', label: 'Cloud App' },
        { code: 'CAT', label: 'Category' },
        { code: 'CB', label: 'Clipboard' },
        { code: 'CDI', label: 'Content Data Identifier' },
        { code: 'CKW', label: 'Content Keyword' },
        { code: 'CMIP', label: 'Content MIP Classification' },
        { code: 'CRX', label: 'Content Regular Expression' },
        { code: 'EF', label: 'Encrypted File' },
        { code: 'FN', label: 'File Name' },
        { code: 'FS', label: 'File Size' },
        { code: 'FT', label: 'File Type' },
        { code: 'NS', label: 'Network Storage' },
        { code: 'O', label: 'Other' },
        { code: 'P', label: 'Print' },
        { code: 'RM', label: 'Removable Media' },
        { code: 'RP', label: 'Recipient Pattern' }
    ];

    let targetInput = null;
    let targetInputContainer = null;
    let floatingButton = null;
    let mainPanel = null;
    let presetsPanel = null;
    let currentTab = 'casb';
    let updateTabUI = null; // forward reference, assigned after panel creation

    /* ==========================================================
     *  MANAGE PRESETS PANEL
     * ==========================================================*/

    // Force a style property with !important directly on the element,
    // overriding any page stylesheet rules (including Netskope's own CSS).
    function forceStyle(el, prop, value) {
        el.style.setProperty(prop, value, 'important');
    }

    function forceStyles(el, map) {
        for (const [prop, value] of Object.entries(map)) {
            // Convert camelCase to kebab-case
            const kebab = prop.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
            forceStyle(el, kebab, value);
        }
    }

    function openManagePresetsPanel() {
        if (presetsPanel) {
            presetsPanel.remove();
            presetsPanel = null;
            const oldOverlay = document.getElementById('npg-presets-overlay');
            if (oldOverlay) oldOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'npg-presets-overlay';
        // Force all positioning with !important so Netskope CSS can't override
        forceStyles(overlay, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '2147483640',
            display: 'block',
            boxSizing: 'border-box'
        });

        presetsPanel = document.createElement('div');
        presetsPanel.id = 'npg-presets-panel';
        // Force all positioning with !important
        forceStyles(presetsPanel, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '2147483647',
            background: '#ffffff',
            'border-radius': '8px',
            'box-shadow': '0 4px 20px rgba(0,0,0,0.35)',
            width: '540px',
            'max-height': '85vh',
            'overflow-y': 'auto',
            padding: '24px',
            'font-family': 'Arial, sans-serif',
            color: '#1f2937',
            'box-sizing': 'border-box',
            margin: '0'
        });

        // Header
        const header = document.createElement('div');
        forceStyles(header, {
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            'margin-bottom': '18px',
            'padding-bottom': '14px',
            'border-bottom': '1px solid #e5e7eb'
        });

        const headerLeft = document.createElement('div');
        forceStyles(headerLeft, { display: 'flex', 'align-items': 'center', gap: '10px' });

        const headerTitle = document.createElement('h2');
        headerTitle.textContent = 'Manage Presets';
        forceStyles(headerTitle, {
            margin: '0',
            'font-size': '18px',
            'font-weight': '600',
            color: '#1f2937',
            'font-family': 'Arial,sans-serif'
        });

        const countBadge = document.createElement('span');
        forceStyles(countBadge, {
            'font-size': '12px',
            'font-weight': '600',
            color: '#6b7280',
            background: '#f3f4f6',
            padding: '2px 8px',
            'border-radius': '99px',
            'font-family': 'Arial,sans-serif'
        });

        headerLeft.appendChild(headerTitle);
        headerLeft.appendChild(countBadge);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        forceStyles(closeBtn, {
            width: '30px',
            height: '30px',
            border: 'none',
            background: 'transparent',
            color: '#dc2626',
            'font-size': '26px',
            cursor: 'pointer',
            'border-radius': '4px',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-family': 'Arial,sans-serif',
            'line-height': '1'
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.setProperty('background', '#fee2e2', 'important'); });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.setProperty('background', 'transparent', 'important'); });
        closeBtn.onclick = () => { presetsPanel.remove(); overlay.remove(); presetsPanel = null; };

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);

        // Preset list container
        const listContainer = document.createElement('div');
        listContainer.id = 'npg-preset-list';
        forceStyles(listContainer, { 'font-family': 'Arial,sans-serif' });

        function renderList() {
            listContainer.innerHTML = '';
            const presets = getPresets();
            countBadge.textContent = `${presets.length} saved`;

            if (presets.length === 0) {
                const empty = document.createElement('div');
                forceStyles(empty, {
                    'text-align': 'center',
                    padding: '32px 16px',
                    color: '#9ca3af',
                    'font-size': '14px',
                    border: '1px dashed #e5e7eb',
                    'border-radius': '6px',
                    'font-family': 'Arial,sans-serif'
                });
                empty.innerHTML = '<div style="font-size:32px;margin-bottom:8px;">📋</div>No presets saved yet.<br>Use the <strong>Save as Preset</strong> button in the main panel to create one.';
                listContainer.appendChild(empty);
                return;
            }

            presets.forEach(preset => {
                const card = document.createElement('div');
                forceStyles(card, {
                    border: '1px solid #e5e7eb',
                    'border-radius': '6px',
                    padding: '12px 14px',
                    'margin-bottom': '10px',
                    background: '#fafafa',
                    display: 'flex',
                    'align-items': 'flex-start',
                    gap: '12px',
                    'font-family': 'Arial,sans-serif',
                    'box-sizing': 'border-box'
                });

                // Tab badge
                const badge = document.createElement('span');
                const isD = preset.tab === 'dlp';
                forceStyles(badge, {
                    'font-size': '10px',
                    'font-weight': '600',
                    padding: '2px 7px',
                    'border-radius': '99px',
                    'white-space': 'nowrap',
                    'flex-shrink': '0',
                    'align-self': 'flex-start',
                    'margin-top': '2px',
                    background: isD ? '#ede9fe' : '#dbeafe',
                    color: isD ? '#6d28d9' : '#1d4ed8'
                });
                badge.textContent = isD ? 'DLP' : 'CASB/Web';

                // Info block
                const info = document.createElement('div');
                forceStyles(info, { flex: '1', 'min-width': '0' });

                const nameEl = document.createElement('div');
                forceStyles(nameEl, {
                    'font-weight': '600', 'font-size': '14px', color: '#1f2937',
                    'margin-bottom': '4px', 'font-family': 'Arial,sans-serif'
                });
                nameEl.textContent = preset.name;

                const summaryEl = document.createElement('div');
                forceStyles(summaryEl, {
                    'font-size': '12px', color: '#6b7280', 'line-height': '1.4',
                    'word-break': 'break-word', 'font-family': 'Arial,sans-serif'
                });
                summaryEl.textContent = preset.summary;

                const dateEl = document.createElement('div');
                forceStyles(dateEl, {
                    'font-size': '11px', color: '#9ca3af', 'margin-top': '4px',
                    'font-family': 'Arial,sans-serif'
                });
                dateEl.textContent = `Saved ${new Date(preset.createdAt).toLocaleString()}`;

                info.appendChild(nameEl);
                info.appendChild(summaryEl);
                info.appendChild(dateEl);

                // Actions
                const actions = document.createElement('div');
                forceStyles(actions, {
                    display: 'flex', gap: '6px', 'flex-shrink': '0',
                    'align-self': 'flex-start', 'margin-top': '2px'
                });

                function makeBtn(text, danger) {
                    const b = document.createElement('button');
                    b.textContent = text;
                    forceStyles(b, {
                        padding: '5px 10px',
                        'border-radius': '4px',
                        'font-size': '12px',
                        'font-weight': '500',
                        cursor: 'pointer',
                        border: danger ? '1px solid #fca5a5' : '1px solid #d1d5db',
                        background: '#fff',
                        color: danger ? '#dc2626' : '#374151',
                        'font-family': 'Arial,sans-serif',
                        transition: 'all 0.15s'
                    });
                    b.addEventListener('mouseenter', () => {
                        b.style.setProperty('background', danger ? '#fee2e2' : '#f3f4f6', 'important');
                        if (danger) b.style.setProperty('border-color', '#dc2626', 'important');
                    });
                    b.addEventListener('mouseleave', () => {
                        b.style.setProperty('background', '#fff', 'important');
                        b.style.setProperty('border-color', danger ? '#fca5a5' : '#d1d5db', 'important');
                    });
                    return b;
                }

                const loadBtn = makeBtn('Load', false);
                loadBtn.title = 'Load this preset into the form';
                loadBtn.onclick = () => {
                    applyFormState(preset.tab, preset.state);
                    presetsPanel.remove();
                    overlay.remove();
                    presetsPanel = null;
                    refreshPresetDropdown();
                };

                const delBtn = makeBtn('Delete', true);
                delBtn.title = 'Remove this preset';
                delBtn.onclick = () => {
                    if (confirm(`Delete preset "${preset.name}"?`)) {
                        removePreset(preset.id);
                        renderList();
                        refreshPresetDropdown();
                    }
                };

                actions.appendChild(loadBtn);
                actions.appendChild(delBtn);

                card.appendChild(badge);
                card.appendChild(info);
                card.appendChild(actions);
                listContainer.appendChild(card);
            });
        }

        renderList();

        presetsPanel.appendChild(header);
        presetsPanel.appendChild(listContainer);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBtn.click();
        });

        // Append to <html>, not <body>, to escape any stacking context or
        // CSS transform Netskope may apply to body/its children.
        document.documentElement.appendChild(overlay);
        document.documentElement.appendChild(presetsPanel);
    }

    /* ==========================================================
     *  PRESET BAR (inside main panel)
     * ==========================================================*/

    function createPresetBar() {
        const bar = document.createElement('div');
        bar.id = 'npg-preset-bar';
        Object.assign(bar.style, {
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 12px', backgroundColor: '#f8f9fa',
            border: '1px solid #e5e7eb', borderRadius: '6px',
            marginBottom: '16px'
        });

        const presetIcon = document.createElement('span');
        presetIcon.textContent = '⭐';
        presetIcon.style.fontSize = '14px';
        presetIcon.style.flexShrink = '0';

        const presetDropdown = document.createElement('select');
        presetDropdown.id = 'npg-preset-dropdown';
        Object.assign(presetDropdown.style, {
            flex: '1', padding: '6px 8px', border: '1px solid #d1d5db',
            borderRadius: '4px', fontSize: '13px', color: '#1f2937',
            backgroundColor: '#ffffff', cursor: 'pointer', minWidth: '0'
        });

        function populateDropdown() {
            presetDropdown.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            const presets = getPresets();
            placeholder.textContent = presets.length === 0 ? 'No presets saved' : '— Load a preset —';
            placeholder.disabled = true;
            placeholder.selected = true;
            presetDropdown.appendChild(placeholder);

            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.tab === 'dlp' ? '[DLP]' : '[CASB]'} ${p.name}`;
                presetDropdown.appendChild(opt);
            });
        }

        populateDropdown();

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        Object.assign(loadBtn.style, {
            padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            backgroundColor: '#ffffff', color: '#374151', transition: 'all 0.15s',
            flexShrink: '0'
        });
        loadBtn.addEventListener('mouseenter', () => { loadBtn.style.backgroundColor = '#f3f4f6'; });
        loadBtn.addEventListener('mouseleave', () => { loadBtn.style.backgroundColor = '#ffffff'; });
        loadBtn.onclick = () => {
            const id = Number(presetDropdown.value);
            if (!id) return;
            const preset = getPresets().find(p => p.id === id);
            if (preset) {
                applyFormState(preset.tab, preset.state);
                presetDropdown.value = '';
            }
        };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Save';
        Object.assign(saveBtn.style, {
            padding: '6px 12px', border: '1px solid #667eea', borderRadius: '4px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            backgroundColor: '#667eea', color: '#ffffff', transition: 'all 0.15s',
            flexShrink: '0'
        });
        saveBtn.addEventListener('mouseenter', () => { saveBtn.style.backgroundColor = '#5568d3'; });
        saveBtn.addEventListener('mouseleave', () => { saveBtn.style.backgroundColor = '#667eea'; });
        saveBtn.onclick = () => {
            const presetName = prompt('Enter a name for this preset (e.g. "ES FW Web Block"):');
            if (!presetName || !presetName.trim()) return;

            const state = getCurrentFormState();
            const tab = currentTab;
            const summary = generatePresetSummary(tab, state);
            const preset = {
                id: Date.now(),
                name: presetName.trim(),
                tab,
                state,
                summary,
                createdAt: new Date().toISOString()
            };
            addPreset(preset);
            populateDropdown();

            // Brief visual confirmation
            const orig = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            saveBtn.style.backgroundColor = '#10b981';
            saveBtn.style.borderColor = '#10b981';
            setTimeout(() => {
                saveBtn.textContent = orig;
                saveBtn.style.backgroundColor = '#667eea';
                saveBtn.style.borderColor = '#667eea';
            }, 1500);
        };

        const manageBtn = document.createElement('button');
        manageBtn.title = 'Manage presets';
        manageBtn.textContent = '⚙';
        Object.assign(manageBtn.style, {
            padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: '4px',
            fontSize: '14px', cursor: 'pointer', backgroundColor: '#ffffff',
            color: '#6b7280', transition: 'all 0.15s', flexShrink: '0'
        });
        manageBtn.addEventListener('mouseenter', () => { manageBtn.style.backgroundColor = '#f3f4f6'; manageBtn.style.color = '#1f2937'; });
        manageBtn.addEventListener('mouseleave', () => { manageBtn.style.backgroundColor = '#ffffff'; manageBtn.style.color = '#6b7280'; });
        manageBtn.onclick = openManagePresetsPanel;

        bar.appendChild(presetIcon);
        bar.appendChild(presetDropdown);
        bar.appendChild(loadBtn);
        bar.appendChild(saveBtn);
        bar.appendChild(manageBtn);

        // Expose refresh function
        window._npgRefreshDropdown = populateDropdown;

        return bar;
    }

    function refreshPresetDropdown() {
        if (typeof window._npgRefreshDropdown === 'function') {
            window._npgRefreshDropdown();
        }
    }

    /* ==========================================================
     *  CORE LOGIC
     * ==========================================================*/

    function findTargetInput() {
        let input = document.querySelector('input.ns-form-input.policy-name-container');
        if (!input) {
            const inputs = document.querySelectorAll('input[placeholder*="Policy Name"]');
            if (inputs.length > 0) input = inputs[0];
        }
        if (input) {
            targetInputContainer = input.closest('.inputs-container');
        }
        return input;
    }

    function parseExistingName(name) {
        if (!name || !name.trim()) return null;
        const parts = name.split(' - ').map(p => p.trim());
        const isDLP = parts.some(part => DLP_POLICY_TYPES.includes(part));
        const parsed = {
            isDLP, isTest: false, isGlobal: false, memberFirm: 'N/A', geoGroup: 'N/A',
            geo: 'N/A', policyType: 'N/A', dlpPolicyType: 'N/A', description: '',
            appliesTo: 'N/A', channelType: 'N/A', criteria: []
        };
        const findCode = (arr, part) => arr.find(item => item.code === part);
        const descriptionParts = [];

        for (const part of parts) {
            if (part === 'Test') parsed.isTest = true;
            else if (part === 'GLB') parsed.isGlobal = true;
            else if (findCode(MEMBER_FIRMS, part)) parsed.memberFirm = part;
            else if (findCode(GEO_GROUPS, part)) parsed.geoGroup = part;
            else if (findCode(GEOS, part)) parsed.geo = part;
            else if (DLP_POLICY_TYPES.includes(part)) parsed.dlpPolicyType = part;
            else if (POLICY_TYPES.includes(part)) parsed.policyType = part;
            else if (findCode(APPLIES_TO, part)) parsed.appliesTo = part;
            else if (findCode(POLICY_CHANNEL_TYPES, part)) parsed.channelType = part;
            else if (part.includes('_')) {
                const codes = part.split('_');
                const valid = codes.filter(c => DLP_CRITERIA.some(d => d.code === c));
                if (valid.length > 0) parsed.criteria = valid;
                else descriptionParts.push(part);
            } else {
                descriptionParts.push(part);
            }
        }
        parsed.description = descriptionParts.join(' - ');
        return parsed;
    }

    function generatePolicyName() {
        const parts = [];
        if (currentTab === 'casb') {
            if (document.getElementById('npg-test-checkbox').checked) parts.push('Test');
            if (document.getElementById('npg-global-checkbox').checked) parts.push('GLB');
            const mf = document.getElementById('npg-member-firm-select').value;
            if (mf !== 'N/A') parts.push(mf);
            const gg = document.getElementById('npg-geo-group-select').value;
            if (gg !== 'N/A') parts.push(gg);
            const g = document.getElementById('npg-geo-select').value;
            if (g !== 'N/A') parts.push(g);
            const pt = document.getElementById('npg-policy-type-select').value;
            if (pt !== 'N/A') parts.push(pt);
            const d = document.getElementById('npg-description-input').value.trim();
            if (d) parts.push(d);
        } else {
            if (document.getElementById('npg-dlp-test-checkbox').checked) parts.push('Test');
            if (document.getElementById('npg-dlp-global-checkbox').checked) parts.push('GLB');
            const mf = document.getElementById('npg-dlp-member-firm-select').value;
            if (mf !== 'N/A') parts.push(mf);
            const gg = document.getElementById('npg-dlp-geo-group-select').value;
            if (gg !== 'N/A') parts.push(gg);
            const g = document.getElementById('npg-dlp-geo-select').value;
            if (g !== 'N/A') parts.push(g);
            const pt = document.getElementById('npg-dlp-policy-type-select').value;
            if (pt !== 'N/A') parts.push(pt);
            const d = document.getElementById('npg-dlp-description-input').value.trim();
            if (d) parts.push(d);
            const at = document.getElementById('npg-dlp-applies-to-select').value;
            if (at !== 'N/A') parts.push(at);
            const ct = document.getElementById('npg-dlp-channel-type-select').value;
            if (ct !== 'N/A') parts.push(ct);
            const criteria = [];
            DLP_CRITERIA.forEach(c => {
                const cb = document.getElementById(`npg-dlp-criteria-${c.code}`);
                if (cb && cb.checked) criteria.push(c.code);
            });
            if (criteria.length > 0) parts.push(criteria.join('_'));
        }
        return parts.join(' - ');
    }

    function updatePreview() {
        const preview = document.getElementById('npg-preview');
        if (!preview) return;
        const name = generatePolicyName();
        preview.textContent = name || '(No components selected)';
    }

    function clearForm() {
        if (currentTab === 'casb') {
            setCheckbox('npg-test-checkbox', false);
            setCheckbox('npg-global-checkbox', false);
            document.getElementById('npg-member-firm-select').value = 'N/A';
            document.getElementById('npg-geo-group-select').value = 'N/A';
            document.getElementById('npg-geo-select').value = 'N/A';
            document.getElementById('npg-policy-type-select').value = 'N/A';
            document.getElementById('npg-description-input').value = '';
        } else {
            setCheckbox('npg-dlp-test-checkbox', false);
            setCheckbox('npg-dlp-global-checkbox', false);
            document.getElementById('npg-dlp-member-firm-select').value = 'N/A';
            document.getElementById('npg-dlp-geo-group-select').value = 'N/A';
            document.getElementById('npg-dlp-geo-select').value = 'N/A';
            document.getElementById('npg-dlp-policy-type-select').value = 'N/A';
            document.getElementById('npg-dlp-description-input').value = '';
            document.getElementById('npg-dlp-applies-to-select').value = 'N/A';
            document.getElementById('npg-dlp-channel-type-select').value = 'N/A';
            DLP_CRITERIA.forEach(c => {
                const cb = document.getElementById(`npg-dlp-criteria-${c.code}`);
                if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
            });
        }
        updatePreview();
    }

    function applyPolicyName() {
        if (!targetInput) { alert('Target input field not found. Please try again.'); return; }
        const name = generatePolicyName();
        targetInput.value = name;
        targetInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        if (mainPanel) mainPanel.style.display = 'none';
    }

    /* ==========================================================
     *  FLOATING BUTTON
     * ==========================================================*/

    function createFloatingButton() {
        if (floatingButton) return;
        if (!targetInput) targetInput = findTargetInput();
        if (!targetInput) return;

        floatingButton = document.createElement('button');
        floatingButton.id = 'npg-floating-button';
        floatingButton.title = 'Open Policy Name Generator';

        const icon = document.createElement('span');
        icon.textContent = '📝';
        icon.style.cssText = 'font-size:16px;line-height:1;display:block;';
        floatingButton.appendChild(icon);

        Object.assign(floatingButton.style, {
            position: 'absolute', width: '33px', height: '33px', borderRadius: '3px',
            border: '1px solid #5568d3', backgroundColor: '#667eea', cursor: 'pointer',
            zIndex: '9998', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            marginLeft: '8px', color: 'white', padding: '0'
        });

        floatingButton.addEventListener('mouseenter', () => {
            floatingButton.style.backgroundColor = '#5568d3';
            floatingButton.style.borderColor = '#4557bb';
        });
        floatingButton.addEventListener('mouseleave', () => {
            floatingButton.style.backgroundColor = '#667eea';
            floatingButton.style.borderColor = '#5568d3';
        });
        floatingButton.addEventListener('mousedown', () => { floatingButton.style.backgroundColor = '#4557bb'; });
        floatingButton.addEventListener('mouseup', () => { floatingButton.style.backgroundColor = '#5568d3'; });

        floatingButton.addEventListener('click', () => {
            if (!mainPanel) return;
            mainPanel.style.display = 'block';
            if (targetInput && targetInput.value.trim()) {
                const parsed = parseExistingName(targetInput.value);
                if (parsed) {
                    setCheckbox('npg-test-checkbox', parsed.isTest);
                    setCheckbox('npg-global-checkbox', parsed.isGlobal);
                    document.getElementById('npg-member-firm-select').value = parsed.memberFirm;
                    document.getElementById('npg-geo-group-select').value = parsed.geoGroup;
                    document.getElementById('npg-geo-select').value = parsed.geo;
                    document.getElementById('npg-policy-type-select').value = parsed.policyType;
                    document.getElementById('npg-description-input').value = parsed.description;

                    setCheckbox('npg-dlp-test-checkbox', parsed.isTest);
                    setCheckbox('npg-dlp-global-checkbox', parsed.isGlobal);
                    document.getElementById('npg-dlp-member-firm-select').value = parsed.memberFirm;
                    document.getElementById('npg-dlp-geo-group-select').value = parsed.geoGroup;
                    document.getElementById('npg-dlp-geo-select').value = parsed.geo;
                    document.getElementById('npg-dlp-policy-type-select').value = parsed.dlpPolicyType;
                    document.getElementById('npg-dlp-description-input').value = parsed.description;
                    document.getElementById('npg-dlp-applies-to-select').value = parsed.appliesTo;
                    document.getElementById('npg-dlp-channel-type-select').value = parsed.channelType;
                    DLP_CRITERIA.forEach(c => {
                        const cb = document.getElementById(`npg-dlp-criteria-${c.code}`);
                        if (cb) { cb.checked = parsed.criteria.includes(c.code); cb.dispatchEvent(new Event('change')); }
                    });
                    updatePreview();
                }
            }
        });

        const wrapper = document.createElement('div');
        wrapper.id = 'npg-button-wrapper';
        Object.assign(wrapper.style, { display: 'inline-flex', alignItems: 'center', position: 'absolute' });
        wrapper.appendChild(floatingButton);
        targetInput.parentNode.insertBefore(wrapper, targetInput.nextSibling);

        function positionButton() {
            if (!targetInput || !wrapper) return;
            if (!document.body.contains(targetInput)) return;
            Object.assign(wrapper.style, {
                top: `${targetInput.offsetTop}px`,
                left: `${targetInput.offsetLeft + targetInput.offsetWidth + 8}px`,
                height: `${targetInput.offsetHeight}px`
            });
        }

        [100, 300, 500].forEach(d => setTimeout(positionButton, d));
        const posInterval = setInterval(() => {
            if (!document.body.contains(targetInput) || !document.body.contains(wrapper)) {
                clearInterval(posInterval); return;
            }
            positionButton();
        }, 2000);
        window.addEventListener('resize', positionButton);

        const obs = new MutationObserver(positionButton);
        obs.observe(targetInput.parentNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    /* ==========================================================
     *  MAIN PANEL
     * ==========================================================*/

    function createMainPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'npg-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999', display: 'none'
        });

        mainPanel = document.createElement('div');
        mainPanel.id = 'npg-main-panel';
        Object.assign(mainPanel.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '520px', backgroundColor: '#ffffff', borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: '10000', display: 'none',
            padding: '24px', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'Arial,sans-serif'
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.title = 'Close';
        Object.assign(closeButton.style, {
            position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px',
            border: 'none', backgroundColor: 'transparent', color: '#dc2626', fontSize: '28px',
            cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center',
            justifyContent: 'center'
        });
        closeButton.addEventListener('mouseenter', () => { closeButton.style.backgroundColor = '#fee2e2'; });
        closeButton.addEventListener('mouseleave', () => { closeButton.style.backgroundColor = 'transparent'; });
        closeButton.onclick = () => { mainPanel.style.display = 'none'; };

        // Title row
        const titleContainer = document.createElement('div');
        Object.assign(titleContainer.style, {
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb'
        });

        const title = document.createElement('h2');
        title.textContent = 'Policy Name Generator';
        Object.assign(title.style, { margin: '0', fontSize: '20px', fontWeight: '600', color: '#1f2937' });
        titleContainer.appendChild(title);

        const versionBadge = document.createElement('span');
        versionBadge.textContent = `v${SCRIPT_VERSION}`;
        Object.assign(versionBadge.style, { fontSize: '12px', color: '#6b7280' });
        titleContainer.appendChild(versionBadge);

        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const clNotif = document.createElement('span');
            clNotif.id = 'netskopeChangelogNotification';
            const dot = document.createElement('span');
            dot.className = 'netskope-notification-dot';
            const txt = document.createElement('span');
            txt.className = 'netskope-notification-text';
            txt.textContent = 'Changelog';
            clNotif.appendChild(dot);
            clNotif.appendChild(txt);
            clNotif.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });
            titleContainer.appendChild(clNotif);
        }

        // Preset bar
        const presetBar = createPresetBar();

        // Tab container
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb'
        });

        function createTabButton(id, label) {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.tab = id;
            Object.assign(btn.style, {
                padding: '10px 20px', border: 'none', backgroundColor: 'transparent', color: '#6b7280',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                borderBottom: '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s'
            });
            btn.addEventListener('click', () => { currentTab = id; updateTabUI(); updatePreview(); });
            return btn;
        }

        const casbTab = createTabButton('casb', 'CASB/Web Policies');
        const dlpTab = createTabButton('dlp', 'DLP Policies');
        tabContainer.appendChild(casbTab);
        tabContainer.appendChild(dlpTab);

        // CASB Form
        const casbForm = document.createElement('div');
        casbForm.id = 'npg-casb-form';
        casbForm.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        // DLP Form
        const dlpForm = document.createElement('div');
        dlpForm.id = 'npg-dlp-form';
        dlpForm.style.cssText = 'display:none;flex-direction:column;gap:16px;';

        updateTabUI = function() {
            [casbTab, dlpTab].forEach(tab => {
                const active = tab.dataset.tab === currentTab;
                tab.style.color = active ? '#4b5563' : '#6b7280';
                tab.style.fontWeight = active ? '600' : '500';
                tab.style.borderBottomColor = active ? '#4b5563' : 'transparent';
            });
            document.getElementById('npg-casb-form').style.display = currentTab === 'casb' ? 'flex' : 'none';
            document.getElementById('npg-dlp-form').style.display = currentTab === 'dlp' ? 'flex' : 'none';
        };

        /* ---- Form helpers ---- */

        function createCheckbox(id, label) {
            const container = document.createElement('div');
            Object.assign(container.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '4px',
                cursor: 'pointer', backgroundColor: '#ffffff', transition: 'all 0.2s', userSelect: 'none'
            });

            const left = document.createElement('div');
            left.style.cssText = 'display:flex;align-items:center;gap:8px;';

            const hidden = document.createElement('input');
            hidden.type = 'checkbox';
            hidden.id = id;
            hidden.style.display = 'none';

            const customBox = document.createElement('div');
            Object.assign(customBox.style, {
                width: '20px', height: '20px', border: '2px solid #4b5563', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#ffffff', flexShrink: '0', transition: 'all 0.2s'
            });
            const checkmark = document.createElement('span');
            checkmark.innerHTML = '✓';
            Object.assign(checkmark.style, { color: '#fff', fontSize: '16px', fontWeight: 'bold', display: 'none' });
            customBox.appendChild(checkmark);

            const lbl = document.createElement('span');
            lbl.textContent = label;
            lbl.style.cssText = 'font-size:14px;color:#374151;font-weight:500;';

            const statusDot = document.createElement('span');
            statusDot.innerHTML = '✓';
            Object.assign(statusDot.style, { color: '#10b981', fontSize: '18px', fontWeight: 'bold', display: 'none' });

            function syncUI() {
                if (hidden.checked) {
                    customBox.style.backgroundColor = '#4b5563';
                    customBox.style.borderColor = '#4b5563';
                    checkmark.style.display = 'block';
                    statusDot.style.display = 'block';
                    container.style.backgroundColor = '#f9fafb';
                } else {
                    customBox.style.backgroundColor = '#ffffff';
                    customBox.style.borderColor = '#4b5563';
                    checkmark.style.display = 'none';
                    statusDot.style.display = 'none';
                    container.style.backgroundColor = '#ffffff';
                }
            }

            hidden.addEventListener('change', () => { syncUI(); updatePreview(); });
            container.addEventListener('click', () => { hidden.checked = !hidden.checked; syncUI(); updatePreview(); });
            container.addEventListener('mouseenter', () => { container.style.borderColor = '#9ca3af'; });
            container.addEventListener('mouseleave', () => { container.style.borderColor = '#d1d5db'; });

            left.appendChild(customBox);
            left.appendChild(lbl);
            container.appendChild(left);
            container.appendChild(statusDot);
            container.appendChild(hidden);
            return container;
        }

        function createDropdown(id, label, options) {
            const container = document.createElement('div');
            container.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
            const lbl = document.createElement('label');
            lbl.htmlFor = id;
            lbl.textContent = label;
            lbl.style.cssText = 'font-size:14px;font-weight:500;color:#374151;';
            const sel = document.createElement('select');
            sel.id = id;
            Object.assign(sel.style, {
                width: '280px', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: '4px', fontSize: '14px', color: '#1f2937', backgroundColor: '#ffffff', cursor: 'pointer'
            });
            options.forEach(opt => {
                const o = document.createElement('option');
                if (typeof opt === 'string') { o.value = opt; o.textContent = opt; }
                else { o.value = opt.code; o.textContent = opt.label; }
                sel.appendChild(o);
            });
            sel.addEventListener('change', updatePreview);
            container.appendChild(lbl);
            container.appendChild(sel);
            return container;
        }

        function createTextInput(id, label, placeholder) {
            const container = document.createElement('div');
            container.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
            const lbl = document.createElement('label');
            lbl.htmlFor = id;
            lbl.textContent = label;
            lbl.style.cssText = 'font-size:14px;font-weight:500;color:#374151;';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = id;
            inp.placeholder = placeholder;
            Object.assign(inp.style, {
                width: '280px', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: '4px', fontSize: '14px', color: '#1f2937', backgroundColor: '#ffffff'
            });
            inp.addEventListener('input', updatePreview);
            container.appendChild(lbl);
            container.appendChild(inp);
            return container;
        }

        function createCriteriaSection() {
            const container = document.createElement('div');
            container.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            const lbl = document.createElement('label');
            lbl.textContent = 'Criteria (select all that apply)';
            lbl.style.cssText = 'font-size:14px;font-weight:500;color:#374151;margin-bottom:4px;';

            const grid = document.createElement('div');
            Object.assign(grid.style, {
                display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px',
                padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb'
            });

            DLP_CRITERIA.forEach(criterion => {
                const item = document.createElement('div');
                Object.assign(item.style, {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', backgroundColor: '#fff', borderRadius: '4px',
                    border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none'
                });

                const left = document.createElement('div');
                left.style.cssText = 'display:flex;align-items:center;gap:6px;';

                const hidden = document.createElement('input');
                hidden.type = 'checkbox';
                hidden.id = `npg-dlp-criteria-${criterion.code}`;
                hidden.style.display = 'none';

                const customBox = document.createElement('div');
                Object.assign(customBox.style, {
                    width: '16px', height: '16px', border: '2px solid #4b5563', borderRadius: '3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#fff', flexShrink: '0', transition: 'all 0.2s'
                });
                const checkmark = document.createElement('span');
                checkmark.innerHTML = '✓';
                Object.assign(checkmark.style, { color: '#fff', fontSize: '12px', fontWeight: 'bold', display: 'none' });
                customBox.appendChild(checkmark);

                const itemLbl = document.createElement('span');
                itemLbl.innerHTML = `<strong>${criterion.code}</strong> - ${criterion.label}`;
                itemLbl.style.cssText = 'font-size:12px;color:#374151;flex:1;';

                const statusDot = document.createElement('span');
                statusDot.innerHTML = '✓';
                Object.assign(statusDot.style, { color: '#10b981', fontSize: '14px', fontWeight: 'bold', display: 'none', marginLeft: '4px' });

                function syncUI() {
                    if (hidden.checked) {
                        customBox.style.backgroundColor = '#4b5563'; customBox.style.borderColor = '#4b5563';
                        checkmark.style.display = 'block'; statusDot.style.display = 'block';
                        item.style.backgroundColor = '#f0fdf4'; item.style.borderColor = '#86efac';
                    } else {
                        customBox.style.backgroundColor = '#fff'; customBox.style.borderColor = '#4b5563';
                        checkmark.style.display = 'none'; statusDot.style.display = 'none';
                        item.style.backgroundColor = '#fff'; item.style.borderColor = '#e5e7eb';
                    }
                }

                hidden.addEventListener('change', () => { syncUI(); updatePreview(); });
                item.addEventListener('click', () => { hidden.checked = !hidden.checked; syncUI(); updatePreview(); });
                item.addEventListener('mouseenter', () => { if (!hidden.checked) item.style.borderColor = '#9ca3af'; });
                item.addEventListener('mouseleave', () => { if (!hidden.checked) item.style.borderColor = '#e5e7eb'; });

                left.appendChild(customBox);
                left.appendChild(itemLbl);
                item.appendChild(left);
                item.appendChild(statusDot);
                item.appendChild(hidden);
                grid.appendChild(item);
            });

            container.appendChild(lbl);
            container.appendChild(grid);
            return container;
        }

        /* ---- Populate forms ---- */

        casbForm.appendChild(createCheckbox('npg-test-checkbox', 'Test Policy'));
        casbForm.appendChild(createCheckbox('npg-global-checkbox', 'Global Policy'));
        casbForm.appendChild(createDropdown('npg-member-firm-select', 'Member Firm', MEMBER_FIRMS));
        casbForm.appendChild(createDropdown('npg-geo-group-select', 'Geo Group', GEO_GROUPS));
        casbForm.appendChild(createDropdown('npg-geo-select', 'Geo', GEOS));
        casbForm.appendChild(createDropdown('npg-policy-type-select', 'Policy Type', POLICY_TYPES));
        casbForm.appendChild(createTextInput('npg-description-input', 'Description', 'Enter description...'));

        dlpForm.appendChild(createCheckbox('npg-dlp-test-checkbox', 'Test Policy'));
        dlpForm.appendChild(createCheckbox('npg-dlp-global-checkbox', 'Global Policy'));
        dlpForm.appendChild(createDropdown('npg-dlp-member-firm-select', 'Member Firm', MEMBER_FIRMS));
        dlpForm.appendChild(createDropdown('npg-dlp-geo-group-select', 'Geo Group', GEO_GROUPS));
        dlpForm.appendChild(createDropdown('npg-dlp-geo-select', 'Geo', GEOS));
        dlpForm.appendChild(createDropdown('npg-dlp-policy-type-select', 'Policy Type', DLP_POLICY_TYPES));
        dlpForm.appendChild(createTextInput('npg-dlp-description-input', 'Description', 'Enter description...'));
        dlpForm.appendChild(createDropdown('npg-dlp-applies-to-select', 'Applies To', APPLIES_TO));
        dlpForm.appendChild(createDropdown('npg-dlp-channel-type-select', 'Policy Channel Type', POLICY_CHANNEL_TYPES));
        dlpForm.appendChild(createCriteriaSection());

        // Preview
        const previewContainer = document.createElement('div');
        Object.assign(previewContainer.style, {
            marginTop: '16px', padding: '12px', backgroundColor: '#f3f4f6',
            borderRadius: '4px', border: '1px solid #e5e7eb'
        });
        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'Preview:';
        previewLabel.style.cssText = 'font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px;';
        const preview = document.createElement('div');
        preview.id = 'npg-preview';
        preview.textContent = '(No components selected)';
        Object.assign(preview.style, { fontSize: '14px', color: '#1f2937', fontWeight: '500', wordBreak: 'break-word' });
        previewContainer.appendChild(previewLabel);
        previewContainer.appendChild(preview);

        // Buttons
        const buttonsContainer = document.createElement('div');
        Object.assign(buttonsContainer.style, { display: 'flex', gap: '12px', marginTop: '20px' });

        function createActionButton(text, onClick, primary = false) {
            const btn = document.createElement('button');
            btn.textContent = text;
            Object.assign(btn.style, {
                flex: '1', padding: '10px 16px', border: primary ? 'none' : '1px solid #d1d5db',
                borderRadius: '4px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                backgroundColor: primary ? '#4b5563' : '#ffffff', color: primary ? '#ffffff' : '#374151',
                transition: 'all 0.2s'
            });
            btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = primary ? '#374151' : '#f9fafb'; });
            btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = primary ? '#4b5563' : '#ffffff'; });
            btn.addEventListener('click', onClick);
            return btn;
        }

        buttonsContainer.appendChild(createActionButton('Clear Form', clearForm));
        buttonsContainer.appendChild(createActionButton('Apply Policy Name', applyPolicyName, true));

        // Assemble
        mainPanel.appendChild(closeButton);
        mainPanel.appendChild(titleContainer);
        mainPanel.appendChild(presetBar);         // ← preset bar sits here
        mainPanel.appendChild(tabContainer);
        mainPanel.appendChild(casbForm);
        mainPanel.appendChild(dlpForm);
        mainPanel.appendChild(previewContainer);
        mainPanel.appendChild(buttonsContainer);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) mainPanel.style.display = 'none'; });
        document.body.appendChild(overlay);
        document.body.appendChild(mainPanel);

        updateTabUI();
        console.log('[Netskope Policy Generator] Main panel created');
    }

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        targetInput = findTargetInput();
        if (!mainPanel) createMainPanel();
        if (!floatingButton) createFloatingButton();
    }

    function setupSPAWatcher() {
        const observer = new MutationObserver(() => {
            const input = document.querySelector('input.ns-form-input.policy-name-container');
            if (input && input !== targetInput) {
                targetInput = null;
                floatingButton = null;
                setTimeout(initialize, 100);
                setTimeout(initialize, 500);
                setTimeout(initialize, 1000);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    [0, 1000, 2000, 3000, 5000].forEach(delay => {
        setTimeout(() => {
            if (!targetInput) {
                targetInput = findTargetInput();
                if (targetInput && !floatingButton) createFloatingButton();
            }
        }, delay);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initialize(); setupSPAWatcher(); });
    } else {
        initialize();
        setupSPAWatcher();
    }

    console.log('[Netskope Policy Generator] Script initialization scheduled');
})();