// ==UserScript==
// @name         Real-time Protection Policy Naming Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopePolicyNameHelper.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopePolicyNameHelper.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.5.0
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

    const SCRIPT_VERSION = '1.5.0';
    const CHANGELOG = `Version 1.5.0:
- Consolidated Member Firm, Geo Group, and Geo into a single "Geo" dropdown containing all geos and member firms. The form now has one field instead of three.
- Nordic geos (DK, FI, IS, NO, SE) automatically prepend "Nordics" in the generated name (e.g. "Nordics - DK - Web Deny - Freelance"). No manual action required.
- The Quick Setup Wizard now has 9 steps instead of 11, reflecting the consolidated Geo field.
- The Feature Guide and example outputs have been updated to match the new format.

Version 1.4.1:
- The Feature Guide now includes a "Quick Setup Wizard" section explaining all 11 wizard steps, which steps are skipped based on your answers, and how the Apply button works.

Version 1.4.0:
- Added a "Quick Setup" wizard button above the preset bar. Clicking it opens a step-by-step guided form that asks about policy type, scope, region, action, and description, then fills all form fields automatically when you click Apply.

Version 1.3.2:
- Added a close button (✕) at the top right of the "What's New" modal.

Version 1.3.1:
- Fixed the Feature Guide modal rendering as plain text on the page instead of opening as a floating modal. Styles are now applied directly on the modal elements to override Netskope's CSS cascade layers.

Version 1.3.0:
- Added a "? Help" button to the panel header that opens a Feature Guide modal covering all script features: policy name format, CASB/Web fields, DLP fields, criteria codes, the preset system, and panel controls.

Version 1.2.7:
- Fixed the pulsing dot on the "What's New" notification not appearing. CSS animations cannot override Netskope's page styles, so the dot color is now toggled via JavaScript, which always takes effect.

Version 1.2.6:
- Fixed the "What's New" notification appearing as plain black text on the Netskope page. Styles are now applied directly on the element to override Netskope's CSS cascade layers, which were preventing the stylesheet rules from taking effect.

Version 1.2.5:
- The "What's New" notification now uses the same blue color and blue-to-orange pulsing dot as the other scripts, making it consistent and easier to spot.

Version 1.2.4:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.2.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.2.2:
- Update URL Changed
    
Version 1.2.0:
- Added Saved Presets system — save any form state under a custom name
- Preset dropdown at the top of the panel for one-click loading
- Manage Presets panel to view, inspect, and delete presets
- Each preset displays a human-readable summary of its configuration
- Presets persist across sessions via GM storage`;

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
        if (state.geo && state.geo !== 'N/A') {
            if (NORDIC_CODES.has(state.geo)) parts.push('Nordics');
            parts.push(state.geo);
        }
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
            document.getElementById('npg-geo-select').value = state.geo || 'N/A';
            document.getElementById('npg-policy-type-select').value = state.policyType || 'N/A';
            document.getElementById('npg-description-input').value = state.description || '';
        } else {
            setCheckbox('npg-dlp-test-checkbox', state.isTest);
            setCheckbox('npg-dlp-global-checkbox', state.isGlobal);
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

        const titleRow = document.createElement('div');
        Object.assign(titleRow.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '15px', borderBottom: '2px solid #667eea', paddingBottom: '10px'
        });
        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, {
            margin: '0', color: '#333', fontSize: '1.5em', fontWeight: 'bold'
        });
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px', color: '#999',
            cursor: 'pointer', padding: '2px 6px', borderRadius: '4px',
            lineHeight: '1', fontFamily: 'Arial, sans-serif', flexShrink: '0'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };
        titleRow.appendChild(title);
        titleRow.appendChild(closeX);

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, {
            backgroundColor: '#f8f9fa', color: '#333', padding: '10px', borderRadius: '5px',
            marginBottom: '15px', borderLeft: '4px solid #667eea', fontSize: '14px'
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
        closeX.onclick = () => closeButton.click();

        modal.appendChild(titleRow);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);

        const parent = mainPanel ? mainPanel.parentElement : document.body;
        parent.appendChild(overlay);
        parent.appendChild(modal);
        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  HELP MODAL
     * ==========================================================*/

    function showHelpModal() {
        if (document.getElementById('npg-help-modal')) return;

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

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    addParagraph(body, 'The Policy Naming Helper adds a button next to the Policy Name field on any Netskope policy form. Click it to open the generator panel and build a standardised name from dropdown selections.');

                    const btnRow = document.createElement('div');
                    Object.assign(btnRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const btnBadge = document.createElement('span');
                    btnBadge.textContent = '📝';
                    Object.assign(btnBadge.style, {
                        background: '#667eea', color: '#fff', borderRadius: '4px',
                        padding: '6px 8px', fontSize: '14px',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const btnDesc = document.createElement('span');
                    btnDesc.textContent = 'Appears next to the Policy Name input field. Click it to open the generator panel.';
                    Object.assign(btnDesc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    btnRow.appendChild(btnBadge);
                    btnRow.appendChild(btnDesc);
                    body.appendChild(btnRow);

                    addBulletList(body, [
                        'Open any policy creation or edit form in Netskope.',
                        'Click the purple 📝 button next to the Policy Name field.',
                        'Select the CASB/Web Policies or DLP Policies tab to match the type of policy you are naming.',
                        'Fill in the relevant fields. The preview at the bottom updates in real time.',
                        'Click "Apply Policy Name" to write the generated name into the field on the page.'
                    ]);
                }
            },
            {
                icon: '📋',
                title: 'Policy Name Format',
                buildContent: (body) => {
                    addParagraph(body, 'All generated names follow a dash-separated format. Only fields that are set to something other than "N/A" are included. Fields appear in this order:');

                    const formatBox = document.createElement('div');
                    Object.assign(formatBox.style, {
                        background: '#f8f8ff', border: '1px solid #d0d0f0',
                        borderRadius: '6px', padding: '10px 14px',
                        fontFamily: 'monospace', fontSize: '11px', color: '#333',
                        marginBottom: '12px', overflowX: 'auto', whiteSpace: 'nowrap'
                    });
                    formatBox.textContent = '[Test] - [GLB] - [Nordics -] [Geo] - [PolicyType] - [Description]';
                    body.appendChild(formatBox);

                    addParagraph(body, 'Nordic geos (DK, FI, IS, NO, SE) automatically insert "Nordics" before the country code. DLP policies also append Applies To, Channel Type, and Criteria codes joined by underscores. Example outputs:');

                    const exampleWrap = document.createElement('div');
                    Object.assign(exampleWrap.style, {
                        marginBottom: '12px', borderRadius: '6px',
                        border: '1px solid #d0d0f0', overflow: 'hidden'
                    });
                    const examples = [
                        { label: 'CASB',   bg: '#eef4ff', labelColor: '#1d4ed8', text: 'ES - Web Deny - Freelance' },
                        { label: 'Nordic', bg: '#f0fff4', labelColor: '#166534', text: 'Nordics - DK - Web Deny - Freelance' },
                        { label: 'DLP',    bg: '#f5f3ff', labelColor: '#6d28d9', text: 'GLB - DLP Block - Sensitive Data - FW - E - CDI_FT' }
                    ];
                    for (const ex of examples) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', alignItems: 'baseline', gap: '10px',
                            padding: '7px 12px', background: ex.bg,
                            borderBottom: ex.label !== 'DLP' ? '1px solid #e8e8f0' : 'none'
                        });
                        const labelEl = document.createElement('span');
                        labelEl.textContent = ex.label;
                        Object.assign(labelEl.style, {
                            fontSize: '10px', fontWeight: 'bold', color: ex.labelColor,
                            textTransform: 'uppercase', whiteSpace: 'nowrap',
                            width: '42px', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                        });
                        const textEl = document.createElement('span');
                        textEl.textContent = ex.text;
                        Object.assign(textEl.style, { fontFamily: 'monospace', fontSize: '11px', color: '#333' });
                        row.appendChild(labelEl);
                        row.appendChild(textEl);
                        exampleWrap.appendChild(row);
                    }
                    body.appendChild(exampleWrap);

                    addBulletList(body, [
                        'If the Policy Name field already has a value when you open the panel, it is parsed automatically and the form fields are pre-filled.',
                        'The live preview at the bottom shows exactly what will be written to the field before you apply it.'
                    ]);
                }
            },
            {
                icon: '🏷️',
                title: 'CASB/Web Policies',
                buildContent: (body) => {
                    const tabRow = document.createElement('div');
                    Object.assign(tabRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const tabBadge = document.createElement('span');
                    tabBadge.textContent = 'CASB/Web Policies';
                    Object.assign(tabBadge.style, {
                        background: '#dbeafe', color: '#1d4ed8', borderRadius: '99px',
                        padding: '3px 10px', fontSize: '11px', fontWeight: '600',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const tabDesc = document.createElement('span');
                    tabDesc.textContent = 'Use this tab for CASB Allow/Deny, Web Allow/Deny, and Threat Allow/Deny policies.';
                    Object.assign(tabDesc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    tabRow.appendChild(tabBadge);
                    tabRow.appendChild(tabDesc);
                    body.appendChild(tabRow);

                    const fieldDescs = [
                        ['Test Policy',  'Adds "Test" as the first segment. Use for non-production policies.'],
                        ['Global Policy','Adds "GLB". Use for policies that apply globally with no specific geo.'],
                        ['Geo',          'The geography or member firm (e.g. ES, UK, FR, NSE, Africa). Nordic geos (DK, FI, IS, NO, SE) automatically prepend "Nordics" in the name.'],
                        ['Policy Type',  'The policy action: CASB Allow, CASB Deny, Web Allow, Web Deny, Threat Allow, or Threat Deny.'],
                        ['Description',  'Free-text label. Describe the specific purpose or target of the policy.']
                    ];
                    const grid = document.createElement('div');
                    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px' });
                    for (const [field, desc] of fieldDescs) {
                        const nameEl = document.createElement('span');
                        nameEl.textContent = field;
                        Object.assign(nameEl.style, {
                            fontFamily: 'monospace', fontSize: '11px',
                            color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', padding: '2px 0', fontFamily: 'Arial, sans-serif' });
                        grid.appendChild(nameEl);
                        grid.appendChild(descEl);
                    }
                    body.appendChild(grid);
                }
            },
            {
                icon: '🛡️',
                title: 'DLP Policies',
                buildContent: (body) => {
                    const tabRow = document.createElement('div');
                    Object.assign(tabRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const tabBadge = document.createElement('span');
                    tabBadge.textContent = 'DLP Policies';
                    Object.assign(tabBadge.style, {
                        background: '#ede9fe', color: '#6d28d9', borderRadius: '99px',
                        padding: '3px 10px', fontSize: '11px', fontWeight: '600',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const tabDesc = document.createElement('span');
                    tabDesc.textContent = 'Use this tab for DLP Block, Monitor, Notify, and Deny policies. Has all CASB fields plus three more.';
                    Object.assign(tabDesc.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                    tabRow.appendChild(tabBadge);
                    tabRow.appendChild(tabDesc);
                    body.appendChild(tabRow);

                    addParagraph(body, 'DLP policies include all CASB/Web fields, plus:');

                    const extraFields = [
                        ['Applies To',          'Scope: "FW" (Firm Wide) or "UG" (User Group).'],
                        ['Policy Channel Type',  'Channel: "W" (Web), "E" (Email), or "D" (Endpoint/Device).'],
                        ['Criteria',             'One or more criteria codes. Multiple selections are joined by underscores (e.g. CAP_FT_CDI). Select all that apply to this policy.']
                    ];
                    const extraGrid = document.createElement('div');
                    Object.assign(extraGrid.style, {
                        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: '12px'
                    });
                    for (const [field, desc] of extraFields) {
                        const nameEl = document.createElement('span');
                        nameEl.textContent = field;
                        Object.assign(nameEl.style, {
                            fontFamily: 'monospace', fontSize: '11px',
                            color: '#667eea', fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', padding: '2px 0', fontFamily: 'Arial, sans-serif' });
                        extraGrid.appendChild(nameEl);
                        extraGrid.appendChild(descEl);
                    }
                    body.appendChild(extraGrid);

                    addParagraph(body, 'Available criteria codes:');

                    const criteriaGrid = document.createElement('div');
                    Object.assign(criteriaGrid.style, {
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px',
                        background: '#f8f8ff', borderRadius: '6px',
                        padding: '10px 14px', border: '1px solid #e8e8f8'
                    });
                    const criteriaList = [
                        ['CAP', 'Cloud App'],       ['CAT',  'Category'],
                        ['CB',  'Clipboard'],        ['CDI',  'Content Data Identifier'],
                        ['CKW', 'Content Keyword'],  ['CMIP', 'Content MIP Classification'],
                        ['CRX', 'Content Regular Expression'], ['EF', 'Encrypted File'],
                        ['FN',  'File Name'],        ['FS',   'File Size'],
                        ['FT',  'File Type'],        ['NS',   'Network Storage'],
                        ['O',   'Other'],             ['P',    'Print'],
                        ['RM',  'Removable Media'],  ['RP',   'Recipient Pattern']
                    ];
                    for (const [code, label] of criteriaList) {
                        const item = document.createElement('div');
                        Object.assign(item.style, { display: 'flex', gap: '6px', alignItems: 'baseline' });
                        const codeEl = document.createElement('span');
                        codeEl.textContent = code;
                        Object.assign(codeEl.style, {
                            fontFamily: 'monospace', fontSize: '11px',
                            color: '#667eea', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: '0'
                        });
                        const labelEl = document.createElement('span');
                        labelEl.textContent = label;
                        Object.assign(labelEl.style, { fontSize: '11px', color: '#555', fontFamily: 'Arial, sans-serif' });
                        item.appendChild(codeEl);
                        item.appendChild(labelEl);
                        criteriaGrid.appendChild(item);
                    }
                    body.appendChild(criteriaGrid);
                }
            },
            {
                icon: '⭐',
                title: 'Saved Presets',
                buildContent: (body) => {
                    addParagraph(body, 'The preset bar at the top of the panel lets you save the current form state and restore it in one click. Presets persist across sessions.');

                    const presetBtns = [
                        {
                            bg: '#667eea', color: '#fff', border: 'none', label: '💾 Save',
                            desc: 'Saves the current form state under a name you enter. The preset is immediately available in the dropdown.'
                        },
                        {
                            bg: '#fff', color: '#374151', border: '1px solid #d1d5db', label: 'Load',
                            desc: 'Select a preset from the dropdown, then click Load to restore all its field values into the form.'
                        },
                        {
                            bg: '#fff', color: '#6b7280', border: '1px solid #d1d5db', label: '⚙',
                            desc: 'Opens the Manage Presets panel where you can view summaries, load, or delete any saved preset.'
                        }
                    ];
                    for (const item of presetBtns) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badge = document.createElement('span');
                        badge.textContent = item.label;
                        Object.assign(badge.style, {
                            background: item.bg, color: item.color, border: item.border,
                            borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = item.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }

                    addBulletList(body, [
                        'A preset stores the active tab (CASB or DLP), all field values, and all checked criteria.',
                        'The Manage Presets panel shows each preset\'s name, a readable summary of its configuration, and when it was saved.',
                        'Presets are stored locally in your browser and do not affect other users.'
                    ]);
                }
            },
            {
                icon: '✨',
                title: 'Quick Setup Wizard',
                buildContent: (body) => {
                    addParagraph(body, 'The Quick Setup Wizard guides you through a short series of questions and automatically fills every form field when you are done. It is the fastest way to set up a policy name from scratch.');

                    const btnRow = document.createElement('div');
                    Object.assign(btnRow.style, {
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f5f3ff', borderRadius: '6px', border: '1px dashed #9b8ee8'
                    });
                    const btnBadge = document.createElement('span');
                    btnBadge.textContent = '✨  Quick Setup';
                    Object.assign(btnBadge.style, {
                        color: '#5b4fcf', fontSize: '13px', fontWeight: '600',
                        fontFamily: 'Arial, sans-serif', flexShrink: '0'
                    });
                    const btnDesc = document.createElement('span');
                    btnDesc.textContent = 'Fill the form by answering a few questions  →';
                    Object.assign(btnDesc.style, {
                        fontSize: '12px', color: '#7c6af7', fontFamily: 'Arial, sans-serif'
                    });
                    btnRow.appendChild(btnBadge);
                    btnRow.appendChild(btnDesc);
                    body.appendChild(btnRow);

                    addParagraph(body, 'The wizard walks through up to 9 steps depending on the policy type selected. Steps that do not apply are skipped automatically.');

                    const steps = [
                        { step: '1', label: 'Policy type',   desc: 'Choose CASB/Web or DLP.' },
                        { step: '2', label: 'Test policy?',  desc: 'Mark as live or test. Test policies get a [Test] prefix.' },
                        { step: '3', label: 'Scope',         desc: 'Global or a specific geo. Choosing Global skips step 4.' },
                        { step: '4', label: 'Geo',           desc: 'The target geo or member firm. Skipped when scope is Global. Nordic geos automatically prepend "Nordics" in the name.' },
                        { step: '5', label: 'Policy action', desc: 'The policy type dropdown (e.g. CASB Allow, DLP Block).' },
                        { step: '6', label: 'Description',   desc: 'Free-text description. Press Enter to advance.' },
                        { step: '7', label: 'Applies To',    desc: 'DLP only: Firm Wide or User Group.' },
                        { step: '8', label: 'Channel type',  desc: 'DLP only: Web, Email, or Endpoint.' },
                        { step: '9', label: 'DLP Criteria',  desc: 'DLP only: multi-select checkboxes for all applicable criteria.' }
                    ];

                    const grid = document.createElement('div');
                    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '4px 12px', marginBottom: '10px', alignItems: 'baseline' });
                    for (const s of steps) {
                        const numEl = document.createElement('span');
                        numEl.textContent = s.step;
                        Object.assign(numEl.style, {
                            fontFamily: 'monospace', fontSize: '11px', color: '#667eea',
                            fontWeight: 'bold', textAlign: 'right', padding: '2px 0'
                        });
                        const labelEl = document.createElement('span');
                        labelEl.textContent = s.label;
                        Object.assign(labelEl.style, {
                            fontSize: '12px', fontWeight: '600', color: '#333',
                            fontFamily: 'Arial, sans-serif', padding: '2px 0', whiteSpace: 'nowrap'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = s.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', fontFamily: 'Arial, sans-serif', padding: '2px 0' });
                        grid.appendChild(numEl);
                        grid.appendChild(labelEl);
                        grid.appendChild(descEl);
                    }
                    body.appendChild(grid);

                    addBulletList(body, [
                        'Clicking "Apply →" on the last step fills all form fields at once and switches to the correct tab (CASB or DLP). Nordic geos are handled automatically: no extra action is needed.',
                        'You can go back to any previous step with the "← Back" button to change an answer.',
                        'Closing the wizard or clicking the overlay discards all answers without touching the form.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Panel Controls',
                buildContent: (body) => {
                    const controls = [
                        {
                            bg: '#4b5563', color: '#fff', border: 'none', label: 'Apply Policy Name',
                            desc: 'Writes the generated name from the live preview into the Policy Name field on the page. The panel closes automatically.'
                        },
                        {
                            bg: '#fff', color: '#374151', border: '1px solid #d1d5db', label: 'Clear Form',
                            desc: 'Resets all fields in the current tab to their defaults (N/A) and clears the description.'
                        },
                        {
                            bg: '#667eea', color: '#fff', border: 'none', label: '📝',
                            desc: 'The floating button next to the Policy Name field. If the field already has a value, the form is pre-filled by parsing the existing name when you open the panel.'
                        }
                    ];
                    for (const item of controls) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badge = document.createElement('span');
                        badge.textContent = item.label;
                        Object.assign(badge.style, {
                            background: item.bg, color: item.color, border: item.border,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif', alignSelf: 'flex-start'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = item.desc;
                        Object.assign(descEl.style, { fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'npg-help-modal-overlay';
        overlay.style.setProperty('position',         'fixed',                  'important');
        overlay.style.setProperty('top',              '0',                      'important');
        overlay.style.setProperty('left',             '0',                      'important');
        overlay.style.setProperty('width',            '100%',                   'important');
        overlay.style.setProperty('height',           '100%',                   'important');
        overlay.style.setProperty('background',       'rgba(0,0,0,0.5)',        'important');
        overlay.style.setProperty('z-index',          '20002',                  'important');

        const modal = document.createElement('div');
        modal.id = 'npg-help-modal';
        modal.style.setProperty('position',         'fixed',                    'important');
        modal.style.setProperty('top',              '50%',                      'important');
        modal.style.setProperty('left',             '50%',                      'important');
        modal.style.setProperty('transform',        'translate(-50%,-50%)',     'important');
        modal.style.setProperty('z-index',          '20003',                    'important');
        modal.style.setProperty('background',       '#ffffff',                  'important');
        modal.style.setProperty('background-color', '#ffffff',                  'important');
        modal.style.setProperty('border',           '2px solid #333',           'important');
        modal.style.setProperty('padding',          '20px',                     'important');
        modal.style.setProperty('border-radius',    '10px',                     'important');
        modal.style.setProperty('width',            '640px',                    'important');
        modal.style.setProperty('max-width',        '92vw',                     'important');
        modal.style.setProperty('max-height',       '82vh',                     'important');
        modal.style.setProperty('overflow-y',       'auto',                     'important');
        modal.style.setProperty('color',            '#333333',                  'important');
        modal.style.setProperty('font-family',      'Arial, sans-serif',        'important');
        modal.style.setProperty('box-sizing',       'border-box',               'important');

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
        titleSub.textContent = `Policy Naming Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, { fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
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

        // Section cards — all start expanded
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden'
            });
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
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block'
            });
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
        const helpParent = mainPanel ? mainPanel.parentElement : document.body;
        helpParent.appendChild(overlay);
        helpParent.appendChild(modal);
    }

    /* ==========================================================
     *  CSS STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
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
        /* Wizard modal */
        #npg-wizard-overlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;
            z-index: 20004 !important;
        }
        #npg-wizard-modal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 20005 !important;
            background: #fff !important; border: 2px solid #333 !important;
            border-radius: 10px !important; width: 520px !important; max-width: 94vw !important;
            padding: 24px !important; font-family: Arial, sans-serif !important;
            box-sizing: border-box !important; color: #333333 !important;
        }
        #npg-wizard-modal input, #npg-wizard-modal select {
            background-color: #ffffff !important; color: #1f2937 !important;
        }
        /* Help modal */
        #npg-help-modal-overlay {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.5) !important;
            z-index: 20002 !important;
        }
        #npg-help-modal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 20003 !important;
            background: #fff !important; border: 2px solid #333 !important;
            padding: 20px !important; border-radius: 10px !important;
            width: 640px !important; max-width: 92vw !important;
            max-height: 82vh !important; overflow-y: auto !important;
            color: #333333 !important; font-family: Arial, sans-serif !important;
            box-sizing: border-box !important;
        }
        #npg-help-modal input, #npg-help-modal select, #npg-help-modal textarea {
            background-color: #ffffff !important; color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  CONFIGURATION DATA (Needs to be edited for AME & APAC MF's)
     * ==========================================================*/

    const GEOS = [
        { code: 'N/A',    label: 'N/A' },
        { code: 'ZA',     label: 'Southern Africa (ZA)' },
        { code: 'EA',     label: 'East Africa (EA)' },
        { code: 'WA',     label: 'West Africa (WA)' },
        { code: 'CE',     label: 'Central Europe (CE)' },
        { code: 'FR',     label: 'France (FR)' },
        { code: 'DE',     label: 'Germany (DE)' },
        { code: 'AT',     label: 'Austria (AT)' },
        { code: 'LU',     label: 'Luxembourg (LU)' },
        { code: 'PT',     label: 'Portugal (PT)' },
        { code: 'TR',     label: 'Turkey (TR)' },
        { code: 'UK',     label: 'United Kingdom (UK)' },
        { code: 'CH',     label: 'Switzerland (CH)' },
        { code: 'IE',     label: 'Ireland (IE)' },
        { code: 'BE',     label: 'Belgium (BE)' },
        { code: 'NL',     label: 'Netherlands (NL)' },
        { code: 'DME',    label: 'Deloitte Middle East (DME)' },
        { code: 'IT',     label: 'Italy (IT)' },
        { code: 'GR',     label: 'Greece (GR)' },
        { code: 'MT',     label: 'Malta (MT)' },
        { code: 'NO',     label: 'Norway (NO) — Nordics' },
        { code: 'DK',     label: 'Denmark (DK) — Nordics' },
        { code: 'SE',     label: 'Sweden (SE) — Nordics' },
        { code: 'FI',     label: 'Finland (FI) — Nordics' },
        { code: 'IS',     label: 'Iceland (IS) — Nordics' },
        { code: 'ES',     label: 'Deloitte Spain (ES)' },
        { code: 'Africa', label: 'Deloitte Africa (Africa)' },
        { code: 'DKU',    label: 'Deloitte DKU (DKU)' },
        { code: 'DCE',    label: 'Deloitte Central Europe (DCE)' },
        { code: 'NSE',    label: 'Deloitte North and South Europe (NSE)' }
    ];
    const NORDIC_CODES = new Set(['DK', 'FI', 'IS', 'NO', 'SE']);
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
            isDLP, isTest: false, isGlobal: false,
            geo: 'N/A', policyType: 'N/A', dlpPolicyType: 'N/A', description: '',
            appliesTo: 'N/A', channelType: 'N/A', criteria: []
        };
        const findCode = (arr, part) => arr.find(item => item.code === part);
        const descriptionParts = [];

        for (const part of parts) {
            if (part === 'Test') parsed.isTest = true;
            else if (part === 'GLB') parsed.isGlobal = true;
            else if (part === 'Nordics') { /* implied by the geo code, skip */ }
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
            const g = document.getElementById('npg-geo-select').value;
            if (g !== 'N/A') { if (NORDIC_CODES.has(g)) parts.push('Nordics'); parts.push(g); }
            const pt = document.getElementById('npg-policy-type-select').value;
            if (pt !== 'N/A') parts.push(pt);
            const d = document.getElementById('npg-description-input').value.trim();
            if (d) parts.push(d);
        } else {
            if (document.getElementById('npg-dlp-test-checkbox').checked) parts.push('Test');
            if (document.getElementById('npg-dlp-global-checkbox').checked) parts.push('GLB');
            const g = document.getElementById('npg-dlp-geo-select').value;
            if (g !== 'N/A') { if (NORDIC_CODES.has(g)) parts.push('Nordics'); parts.push(g); }
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
            document.getElementById('npg-geo-select').value = 'N/A';
            document.getElementById('npg-policy-type-select').value = 'N/A';
            document.getElementById('npg-description-input').value = '';
        } else {
            setCheckbox('npg-dlp-test-checkbox', false);
            setCheckbox('npg-dlp-global-checkbox', false);
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
     *  POLICY WIZARD
     * ==========================================================*/

    function showPolicyWizard() {
        if (document.getElementById('npg-wizard-modal')) return;

        const wizardState = {
            tab:         'casb',
            isTest:      false,
            isGlobal:    false,
            geo:         'N/A',
            policyType:  'N/A',
            description: '',
            appliesTo:   'N/A',
            channelType: 'N/A',
            criteria:    []
        };

        const WIZARD_STEPS = [
            {
                id: 'tab',
                question: 'What type of policy are you creating?',
                type: 'choice',
                choices: [
                    { value: 'casb', icon: '🌐', label: 'CASB / Web Policy',  desc: 'Cloud app access controls and web filtering' },
                    { value: 'dlp',  icon: '🛡️', label: 'DLP Policy',         desc: 'Data loss prevention and content inspection' }
                ]
            },
            {
                id: 'isTest',
                question: 'Is this a test policy?',
                type: 'choice',
                choices: [
                    { value: false, icon: '✅', label: 'No, this is a live policy',  desc: 'Applied to real traffic immediately' },
                    { value: true,  icon: '🧪', label: 'Yes, this is a test policy', desc: 'Name will be prefixed with [Test]' }
                ]
            },
            {
                id: 'isGlobal',
                question: 'What is the scope of this policy?',
                type: 'choice',
                choices: [
                    { value: false, icon: '📍', label: 'Specific region or member firm', desc: 'Targets a particular member firm, geo group, or geography' },
                    { value: true,  icon: '🌍', label: 'Global',                          desc: 'Applies globally; region fields will be N/A' }
                ]
            },
            {
                id: 'geo',
                question: 'Which Geo does this policy target?',
                type: 'dropdown',
                options: () => GEOS,
                shouldSkip: s => s.isGlobal
            },
            {
                id: 'policyType',
                question: 'What is the policy action?',
                type: 'dropdown',
                options: () => (wizardState.tab === 'dlp' ? DLP_POLICY_TYPES : POLICY_TYPES).map(t => ({ code: t, label: t }))
            },
            {
                id: 'description',
                question: 'Enter a short description for this policy.',
                type: 'text',
                placeholder: 'e.g. Block SharePoint uploads for ES users'
            },
            {
                id: 'appliesTo',
                question: 'Who does this DLP policy apply to?',
                type: 'dropdown',
                options: () => APPLIES_TO,
                shouldSkip: s => s.tab !== 'dlp'
            },
            {
                id: 'channelType',
                question: 'What channel type does this DLP policy cover?',
                type: 'dropdown',
                options: () => POLICY_CHANNEL_TYPES,
                shouldSkip: s => s.tab !== 'dlp'
            },
            {
                id: 'criteria',
                question: 'Which DLP criteria apply? Select all that match.',
                type: 'multicheck',
                options: DLP_CRITERIA,
                shouldSkip: s => s.tab !== 'dlp'
            }
        ];

        let stepIndex = 0;

        function getVisible() {
            return WIZARD_STEPS.filter(s => !s.shouldSkip || !s.shouldSkip(wizardState));
        }

        const overlay = document.createElement('div');
        overlay.id = 'npg-wizard-overlay';
        overlay.style.setProperty('position',   'fixed',           'important');
        overlay.style.setProperty('top',        '0',               'important');
        overlay.style.setProperty('left',       '0',               'important');
        overlay.style.setProperty('width',      '100%',            'important');
        overlay.style.setProperty('height',     '100%',            'important');
        overlay.style.setProperty('background', 'rgba(0,0,0,0.5)', 'important');
        overlay.style.setProperty('z-index',    '20004',           'important');
        overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); modal.remove(); } };

        const modal = document.createElement('div');
        modal.id = 'npg-wizard-modal';
        modal.style.setProperty('position',         'fixed',                'important');
        modal.style.setProperty('top',              '50%',                  'important');
        modal.style.setProperty('left',             '50%',                  'important');
        modal.style.setProperty('transform',        'translate(-50%,-50%)', 'important');
        modal.style.setProperty('z-index',          '20005',                'important');
        modal.style.setProperty('background-color', '#ffffff',              'important');
        modal.style.setProperty('border',           '2px solid #333',       'important');
        modal.style.setProperty('border-radius',    '10px',                 'important');
        modal.style.setProperty('width',            '520px',                'important');
        modal.style.setProperty('max-width',        '94vw',                 'important');
        modal.style.setProperty('padding',          '24px',                 'important');
        modal.style.setProperty('font-family',      'Arial, sans-serif',    'important');
        modal.style.setProperty('box-sizing',       'border-box',           'important');
        modal.style.setProperty('color',            '#333333',              'important');

        function render() {
            modal.innerHTML = '';

            const visible = getVisible();
            const total   = visible.length;
            const step    = visible[stepIndex];
            if (!step) return;

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '16px', paddingBottom: '14px', borderBottom: '2px solid #667eea'
            });
            const hLeft  = document.createElement('div');
            const hTitle = document.createElement('div');
            hTitle.textContent = '✨ Policy Setup Wizard';
            Object.assign(hTitle.style, { fontWeight: 'bold', fontSize: '15px', color: '#333', fontFamily: 'Arial, sans-serif' });
            const hStep = document.createElement('div');
            hStep.textContent = `Step ${stepIndex + 1} of ${total}`;
            Object.assign(hStep.style, { fontSize: '11px', color: '#888', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
            hLeft.appendChild(hTitle);
            hLeft.appendChild(hStep);
            const hClose = document.createElement('button');
            hClose.textContent = '✕';
            Object.assign(hClose.style, {
                background: 'none', border: 'none', fontSize: '18px', color: '#999',
                cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', lineHeight: '1'
            });
            hClose.onmouseover = () => { hClose.style.background = '#f0f0f0'; };
            hClose.onmouseout  = () => { hClose.style.background = 'none'; };
            hClose.onclick     = () => { overlay.remove(); modal.remove(); };
            header.appendChild(hLeft);
            header.appendChild(hClose);
            modal.appendChild(header);

            // Progress bar
            const progBg = document.createElement('div');
            Object.assign(progBg.style, { height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '20px' });
            const progFill = document.createElement('div');
            Object.assign(progFill.style, {
                height: '100%', borderRadius: '2px', background: '#667eea',
                width: `${((stepIndex + 1) / total) * 100}%`
            });
            progBg.appendChild(progFill);
            modal.appendChild(progBg);

            // Question
            const questionEl = document.createElement('div');
            questionEl.textContent = step.question;
            Object.assign(questionEl.style, {
                fontSize: '14px', fontWeight: '600', color: '#1f2937',
                marginBottom: '14px', fontFamily: 'Arial, sans-serif', lineHeight: '1.4'
            });
            modal.appendChild(questionEl);

            // Answer area
            const answerArea = document.createElement('div');
            answerArea.style.marginBottom = '20px';
            let getAnswer;
            let nextBtnRef = null; // captured by text keydown handler before nextBtn is created

            if (step.type === 'choice') {
                step.choices.forEach(choice => {
                    const isSel = wizardState[step.id] === choice.value;
                    const card = document.createElement('div');
                    Object.assign(card.style, {
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '11px 14px', marginBottom: '8px', cursor: 'pointer',
                        border: `2px solid ${isSel ? '#667eea' : '#e5e7eb'}`,
                        borderRadius: '8px', background: isSel ? '#f0f0ff' : '#ffffff',
                        transition: 'all 0.15s'
                    });
                    const iconEl = document.createElement('span');
                    iconEl.textContent = choice.icon;
                    iconEl.style.fontSize = '22px';
                    const textWrap = document.createElement('div');
                    const lbl = document.createElement('div');
                    lbl.textContent = choice.label;
                    Object.assign(lbl.style, {
                        fontWeight: '600', fontSize: '13px', fontFamily: 'Arial, sans-serif',
                        color: isSel ? '#667eea' : '#1f2937'
                    });
                    const desc = document.createElement('div');
                    desc.textContent = choice.desc;
                    Object.assign(desc.style, { fontSize: '12px', color: '#6b7280', marginTop: '2px', fontFamily: 'Arial, sans-serif' });
                    textWrap.appendChild(lbl);
                    textWrap.appendChild(desc);
                    card.appendChild(iconEl);
                    card.appendChild(textWrap);
                    card.onclick = () => { wizardState[step.id] = choice.value; render(); };
                    card.addEventListener('mouseenter', () => {
                        if (wizardState[step.id] !== choice.value) { card.style.borderColor = '#c0c8f0'; card.style.background = '#f8f8ff'; }
                    });
                    card.addEventListener('mouseleave', () => {
                        if (wizardState[step.id] !== choice.value) { card.style.borderColor = '#e5e7eb'; card.style.background = '#ffffff'; }
                    });
                    answerArea.appendChild(card);
                });
                getAnswer = () => wizardState[step.id];

            } else if (step.type === 'dropdown') {
                const opts = step.options();
                const sel = document.createElement('select');
                Object.assign(sel.style, {
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                    borderRadius: '6px', fontSize: '14px', color: '#1f2937',
                    backgroundColor: '#ffffff', cursor: 'pointer', boxSizing: 'border-box'
                });
                opts.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.code;
                    o.textContent = opt.label;
                    if (opt.code === wizardState[step.id]) o.selected = true;
                    sel.appendChild(o);
                });
                answerArea.appendChild(sel);
                getAnswer = () => sel.value;

            } else if (step.type === 'text') {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = step.placeholder || '';
                inp.value = wizardState[step.id] || '';
                Object.assign(inp.style, {
                    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                    borderRadius: '6px', fontSize: '14px', color: '#1f2937',
                    backgroundColor: '#ffffff', boxSizing: 'border-box', outline: 'none'
                });
                inp.addEventListener('focus', () => { inp.style.borderColor = '#667eea'; });
                inp.addEventListener('blur',  () => { inp.style.borderColor = '#d1d5db'; });
                inp.addEventListener('keydown', e => { if (e.key === 'Enter' && nextBtnRef) nextBtnRef.click(); });
                answerArea.appendChild(inp);
                getAnswer = () => inp.value.trim();
                setTimeout(() => inp.focus(), 40);

            } else if (step.type === 'multicheck') {
                const grid = document.createElement('div');
                Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' });
                step.options.forEach(opt => {
                    const lbl = document.createElement('label');
                    Object.assign(lbl.style, {
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                        padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '6px',
                        fontSize: '12px', color: '#374151', fontFamily: 'Arial, sans-serif',
                        transition: 'all 0.15s'
                    });
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = opt.code;
                    cb.checked = wizardState.criteria.includes(opt.code);
                    cb.style.accentColor = '#667eea';
                    const txt = document.createElement('span');
                    txt.textContent = `${opt.label} (${opt.code})`;
                    lbl.appendChild(cb);
                    lbl.appendChild(txt);
                    lbl.addEventListener('mouseenter', () => { lbl.style.borderColor = '#c0c8f0'; lbl.style.background = '#f8f8ff'; });
                    lbl.addEventListener('mouseleave', () => { lbl.style.borderColor = '#e5e7eb'; lbl.style.background = ''; });
                    grid.appendChild(lbl);
                });
                answerArea.appendChild(grid);
                getAnswer = () => {
                    const checked = [];
                    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (cb.checked) checked.push(cb.value); });
                    return checked;
                };
            }

            modal.appendChild(answerArea);

            // Navigation
            const navRow = document.createElement('div');
            Object.assign(navRow.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });
            const isLast = stepIndex === total - 1;

            if (stepIndex > 0) {
                const backBtn = document.createElement('button');
                backBtn.textContent = '← Back';
                Object.assign(backBtn.style, {
                    padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: '6px',
                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                    backgroundColor: '#ffffff', color: '#374151'
                });
                backBtn.addEventListener('mouseenter', () => { backBtn.style.backgroundColor = '#f3f4f6'; });
                backBtn.addEventListener('mouseleave', () => { backBtn.style.backgroundColor = '#ffffff'; });
                backBtn.onclick = () => { stepIndex--; render(); };
                navRow.appendChild(backBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtnRef = nextBtn;
            nextBtn.textContent = isLast ? 'Apply →' : 'Next →';
            Object.assign(nextBtn.style, {
                padding: '9px 18px', border: 'none', borderRadius: '6px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                backgroundColor: '#667eea', color: '#ffffff'
            });
            nextBtn.addEventListener('mouseenter', () => { nextBtn.style.backgroundColor = '#5568d3'; });
            nextBtn.addEventListener('mouseleave', () => { nextBtn.style.backgroundColor = '#667eea'; });
            nextBtn.onclick = () => {
                if (getAnswer) wizardState[step.id] = getAnswer();
                if (isLast) {
                    overlay.remove();
                    modal.remove();
                    applyFormState(wizardState.tab, {
                        isTest:      wizardState.isTest,
                        isGlobal:    wizardState.isGlobal,
                        geo:         wizardState.geo,
                        policyType:  wizardState.policyType,
                        description: wizardState.description,
                        appliesTo:   wizardState.appliesTo,
                        channelType: wizardState.channelType,
                        criteria:    wizardState.criteria
                    });
                } else {
                    stepIndex++;
                    render();
                }
            };
            navRow.appendChild(nextBtn);
            modal.appendChild(navRow);
        }

        render();

        const wizParent = mainPanel ? mainPanel.parentElement : document.body;
        wizParent.appendChild(overlay);
        wizParent.appendChild(modal);
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
                    document.getElementById('npg-geo-select').value = parsed.geo;
                    document.getElementById('npg-policy-type-select').value = parsed.policyType;
                    document.getElementById('npg-description-input').value = parsed.description;

                    setCheckbox('npg-dlp-test-checkbox', parsed.isTest);
                    setCheckbox('npg-dlp-global-checkbox', parsed.isGlobal);
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
            // setProperty with 'important' guarantees these win over Netskope's cascade-layered styles
            clNotif.style.setProperty('display',           'inline-flex',         'important');
            clNotif.style.setProperty('align-items',       'center',              'important');
            clNotif.style.setProperty('gap',               '6px',                 'important');
            clNotif.style.setProperty('cursor',            'pointer',             'important');
            clNotif.style.setProperty('margin-left',       '10px',                'important');
            clNotif.style.setProperty('padding',           '3px 8px',             'important');
            clNotif.style.setProperty('border-radius',     '4px',                 'important');
            clNotif.style.setProperty('background-color',  'transparent',         'important');
            clNotif.style.setProperty('transition',        'background-color 0.2s ease', 'important');
            clNotif.onmouseover = () => clNotif.style.setProperty('background-color', '#f0f0f0',    'important');
            clNotif.onmouseout  = () => clNotif.style.setProperty('background-color', 'transparent','important');

            const dot = document.createElement('span');
            dot.style.setProperty('display',          'inline-block', 'important');
            dot.style.setProperty('width',            '8px',          'important');
            dot.style.setProperty('height',           '8px',          'important');
            dot.style.setProperty('border-radius',    '50%',          'important');
            dot.style.setProperty('flex-shrink',      '0',            'important');
            dot.style.setProperty('background-color', '#007bff',      'important');
            let dotToggle = true;
            const dotPulse = setInterval(() => {
                if (!document.contains(dot)) { clearInterval(dotPulse); return; }
                dotToggle = !dotToggle;
                dot.style.setProperty('background-color', dotToggle ? '#007bff' : '#ff8c00', 'important');
            }, 500);

            const txt = document.createElement('span');
            txt.textContent = "What's New";
            txt.style.setProperty('font-size',       '11px',                   'important');
            txt.style.setProperty('color',           '#0066cc',                'important');
            txt.style.setProperty('text-decoration', 'underline',              'important');
            txt.style.setProperty('font-family',     'Arial, sans-serif',      'important');
            txt.style.setProperty('font-weight',     'normal',                 'important');
            txt.style.setProperty('line-height',     'normal',                 'important');

            clNotif.appendChild(dot);
            clNotif.appendChild(txt);
            clNotif.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });
            titleContainer.appendChild(clNotif);
        }

        const helpBtn = document.createElement('span');
        helpBtn.textContent = '? Help';
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.style.setProperty('color',            '#667eea',                    'important');
        helpBtn.style.setProperty('cursor',           'pointer',                    'important');
        helpBtn.style.setProperty('font-size',        '11px',                       'important');
        helpBtn.style.setProperty('display',          'inline-flex',                'important');
        helpBtn.style.setProperty('align-items',      'center',                     'important');
        helpBtn.style.setProperty('padding',          '1px 6px',                    'important');
        helpBtn.style.setProperty('border-radius',    '3px',                        'important');
        helpBtn.style.setProperty('border',           '1px solid #c0c8f0',          'important');
        helpBtn.style.setProperty('font-weight',      'bold',                       'important');
        helpBtn.style.setProperty('user-select',      'none',                       'important');
        helpBtn.style.setProperty('background-color', 'transparent',                'important');
        helpBtn.style.setProperty('transition',       'background-color 0.2s ease', 'important');
        helpBtn.style.setProperty('font-family',      'Arial, sans-serif',          'important');
        helpBtn.style.setProperty('margin-left',      '4px',                        'important');
        helpBtn.onmouseover = () => helpBtn.style.setProperty('background-color', '#eef0ff',    'important');
        helpBtn.onmouseout  = () => helpBtn.style.setProperty('background-color', 'transparent','important');
        helpBtn.onclick = () => showHelpModal();
        titleContainer.appendChild(helpBtn);

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
        casbForm.appendChild(createDropdown('npg-geo-select', 'Geo', GEOS));
        casbForm.appendChild(createDropdown('npg-policy-type-select', 'Policy Type', POLICY_TYPES));
        casbForm.appendChild(createTextInput('npg-description-input', 'Description', 'Enter description...'));

        dlpForm.appendChild(createCheckbox('npg-dlp-test-checkbox', 'Test Policy'));
        dlpForm.appendChild(createCheckbox('npg-dlp-global-checkbox', 'Global Policy'));
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

        // Wizard bar
        const wizardBar = document.createElement('div');
        wizardBar.style.marginBottom = '10px';
        const wizardBtn = document.createElement('button');
        Object.assign(wizardBtn.style, {
            width: '100%', padding: '10px 16px', border: '1px dashed #9b8ee8',
            borderRadius: '6px', backgroundColor: '#f5f3ff', color: '#5b4fcf',
            cursor: 'pointer', fontFamily: 'Arial, sans-serif', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxSizing: 'border-box'
        });
        const wizLeft = document.createElement('span');
        wizLeft.textContent = '✨  Quick Setup';
        Object.assign(wizLeft.style, { fontWeight: '600', fontSize: '13px' });
        const wizRight = document.createElement('span');
        wizRight.textContent = 'Fill the form by answering a few questions  →';
        Object.assign(wizRight.style, { fontWeight: 'normal', fontSize: '12px', opacity: '0.8' });
        wizardBtn.appendChild(wizLeft);
        wizardBtn.appendChild(wizRight);
        wizardBtn.addEventListener('mouseenter', () => { wizardBtn.style.backgroundColor = '#ede9ff'; wizardBtn.style.borderColor = '#7c6af7'; });
        wizardBtn.addEventListener('mouseleave', () => { wizardBtn.style.backgroundColor = '#f5f3ff'; wizardBtn.style.borderColor = '#9b8ee8'; });
        wizardBtn.onclick = () => showPolicyWizard();
        wizardBar.appendChild(wizardBtn);

        // Assemble
        mainPanel.appendChild(closeButton);
        mainPanel.appendChild(titleContainer);
        mainPanel.appendChild(wizardBar);
        mainPanel.appendChild(presetBar);
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