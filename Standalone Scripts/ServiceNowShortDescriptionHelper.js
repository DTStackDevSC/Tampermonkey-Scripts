// ==UserScript==
// @name         Short Description Helper
// @namespace    https://gitlab.com/-/snippets/4896559
// @version      3.0.8.1
// @description  Show a button to select several options and be able to change the short description
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '3.0.8.1';
    const CHANGELOG = `Version 3.0.8.1:
- Minor changes on fields
- Added Tenant field on Short Description`;

    /* ==========================================================
     *  TENANT MAPPING
     * ==========================================================*/

    const tenantMapping = {
        'Africa': 'EMA Tenant',
        //'Asia Pacific': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Australia': 'APAC Tenant',
        'Austria': 'EU Tenant',
        'Belgium': 'EU Tenant',
        'Brazil': 'AME Tenant',
        'Canada': 'AME Tenant',
        'Caribbean and Bermuda Countries': 'AME Tenant',
        'Central Europe': 'CE Tenant',
        'Central Mediterranean': 'EU Tenant',
        'Chile': 'EMA Tenant',
        //'China': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Cyprus': 'EU Tenant',
        'Denmark': 'EU Tenant',
        'DKU': 'EMA Tenant',
        'Finland': 'EU Tenant',
        'France': 'CE Tenant',
        'Germany': 'CE Tenant',
        //'Hong Kong': 'APAC Tenant', -- Uncomment when Tenant is confirmed
        'Iceland': 'EU Tenant',
        'Ireland': 'EU Tenant',
        'Israel': 'EMA Tenant',
        'Japan': 'APAC Tenant',
        'Korea': 'APAC Tenant',
        'Luxembourg': 'EU Tenant',
        'Mauritius': 'APAC Tenant',
        'Mexico': 'EMA Tenant',
        'Middle East': 'EU Tenant',
        'Netherlands': 'EU Tenant',
        'New Zealand': 'APAC Tenant',
        'Nordics': 'EU Tenant',
        'North and South Europe': 'EU Tenant',
        'Norway': 'EU Tenant',
        'Portugal': 'CE Tenant',
        'S-LATAM': 'EMA Tenant',
        'South Asia(India)': 'APAC Tenant',
        'Southeast Asia': 'APAC Tenant',
        'Spain': 'EMA Tenant',
        'Sweden': 'EU Tenant',
        'Switzerland': 'EU Tenant',
        'Taiwan': 'APAC Tenant',
        'Touche Tohmatsu Limited': 'AME Tenant',
        'Turkey': 'CE Tenant',
        'United Kingdom': 'EU Tenant',
        'United States': 'AME Tenant',
    };

    /* ==========================================================
     *  TENANT URL KEYS & DEFAULTS
     * ==========================================================*/

    const TENANT_KEYS = [
        { key: 'tenantURL_EMA', label: 'EMA Tenant URL' },
        { key: 'tenantURL_EU',  label: 'EU Tenant URL'  },
        { key: 'tenantURL_CE',  label: 'CE Tenant URL'  },
        { key: 'tenantURL_APA', label: 'APA Tenant URL' },
        { key: 'tenantURL_AME', label: 'AME Tenant URL' },
    ];

    // Map from tenant name → GM storage key
    const TENANT_NAME_TO_KEY = {
        'EMA Tenant': 'tenantURL_EMA',
        'EU Tenant':  'tenantURL_EU',
        'CE Tenant':  'tenantURL_CE',
        'APAC Tenant': 'tenantURL_APA',
        'AME Tenant': 'tenantURL_AME',
    };

    function getTenantURLs() {
        const urls = {};
        for (const [tenantName, gmKey] of Object.entries(TENANT_NAME_TO_KEY)) {
            const stored = GM_getValue(gmKey, null);
            if (stored) urls[tenantName] = stored;
        }
        return urls;
    }

    function areTenantURLsConfigured() {
        return TENANT_KEYS.every(({ key }) => {
            const val = GM_getValue(key, null);
            return val && val.trim() !== '';
        });
    }

    function saveTenantURLs(urlMap) {
        for (const [gmKey, url] of Object.entries(urlMap)) {
            GM_setValue(gmKey, url.trim());
        }
    }

    /* ==========================================================
     *  TENANT URL SETUP MODAL
     * ==========================================================*/

    function showTenantURLSetup(onComplete) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '10000'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10001',
            background: '#fff',
            border: '2px solid #333',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            minWidth: '460px',
            maxWidth: '520px'
        });

        const title = document.createElement('h2');
        title.textContent = 'Configure Netskope Tenant URLs';
        Object.assign(title.style, { marginTop: '0', marginBottom: '6px', color: '#333' });
        modal.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Short Description Helper Script — First-time setup';
        Object.assign(subtitle.style, {
            margin: '0 0 14px 0',
            color: '#666', fontSize: '13px', fontStyle: 'italic'
        });
        modal.appendChild(subtitle);

        const note = document.createElement('div');
        Object.assign(note.style, {
            background: '#fff8e1',
            border: '1px solid #ffe082',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#5a4200',
            lineHeight: '1.5'
        });
        note.innerHTML = '📄 <strong>Where to find the tenant URLs:</strong> The Netskope tenant links for each region are listed in the <em>General Scripts User Guide</em> Word document.<br> Look for the section titled <strong>Required information & variables</strong>.';
        modal.appendChild(note);

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

        const inputs = {};

        for (const { key, label } of TENANT_KEYS) {
            const fieldWrapper = document.createElement('div');
            Object.assign(fieldWrapper.style, {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '10px'
            });

            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.setAttribute('for', `tenantSetup_${key}`);
            Object.assign(lbl.style, {
                width: '140px',
                fontWeight: 'bold',
                fontSize: '13px',
                color: '#333',
                flexShrink: '0'
            });

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = `tenantSetup_${key}`;
            inp.placeholder = 'https://...';
            inp.value = GM_getValue(key, '');
            Object.assign(inp.style, {
                flex: '1',
                padding: '7px 10px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
            });

            inp.addEventListener('input', () => {
                inp.style.borderColor = inp.value.trim() ? '#4CAF50' : '#e74c3c';
            });

            if (!inp.value.trim()) {
                inp.style.borderColor = '#ccc';
            } else {
                inp.style.borderColor = '#4CAF50';
            }

            inputs[key] = inp;
            fieldWrapper.appendChild(lbl);
            fieldWrapper.appendChild(inp);
            modal.appendChild(fieldWrapper);
        }

        const errorMsg = document.createElement('div');
        Object.assign(errorMsg.style, {
            color: '#e74c3c',
            fontSize: '13px',
            marginBottom: '10px',
            display: 'none'
        });
        errorMsg.textContent = '⚠ All fields are required. Please fill in every tenant URL.';
        modal.appendChild(errorMsg);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Continue';
        Object.assign(saveBtn.style, {
            width: '100%',
            padding: '12px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
            transition: 'background 0.2s ease'
        });
        saveBtn.onmouseover = () => { saveBtn.style.background = '#0056b3'; };
        saveBtn.onmouseout  = () => { saveBtn.style.background = '#007bff'; };

        saveBtn.onclick = () => {
            let allFilled = true;
            for (const { key } of TENANT_KEYS) {
                const val = inputs[key].value.trim();
                if (!val) {
                    inputs[key].style.borderColor = '#e74c3c';
                    allFilled = false;
                }
            }

            if (!allFilled) {
                errorMsg.style.display = 'block';
                return;
            }

            errorMsg.style.display = 'none';

            const urlMap = {};
            for (const { key } of TENANT_KEYS) {
                urlMap[key] = inputs[key].value.trim();
            }
            saveTenantURLs(urlMap);

            overlay.remove();
            modal.remove();

            showLoadingOverlay();
            setTimeout(() => {
                if (onComplete) onComplete();
                else location.reload();
            }, 100);
        };

        modal.appendChild(saveBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  TEAM CONFIGURATIONS
     * ==========================================================*/

    const TEAMS = {

        /// EMEA TEAM ///

        emeaTeam: {
            name: 'EMEA Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'Deloitte Africa - Africa', value: 'Africa' },
                { label: 'Deloitte Austria - AT', value: 'AT' },
                { label: 'Deloitte Belgium - BE', value: 'BE' },
                { label: 'Deloitte Central Europe - CE', value: 'CE' },
                { label: 'Deloitte Central Mediterranean - DCM', value: 'DCM' },
                { label: 'Deloitte Cyprus - DME', value: 'DME' },
                { label: 'Deloitte Denmark - DK', value: 'DK' },
                { label: 'Deloitte DKU - DKU', value: 'DKU' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' },
                { label: 'Deloitte Finland - FI', value: 'FI' },
                { label: 'Deloitte France - FR', value: 'FR' },
                { label: 'Deloitte Germany - DE', value: 'DE' },
                { label: 'Deloitte Iceland - IS', value: 'IS' },
                { label: 'Deloitte Ireland - IE', value: 'IE' },
                { label: 'Deloitte Luxembourg - LU', value: 'LU' },
                { label: 'Deloitte Middle East - DME', value: 'DME' },
                { label: 'Deloitte Netherlands - NL', value: 'NL' },
                { label: 'Deloitte Nordics - Nordics', value: 'Nordics' },
                { label: 'Deloitte North and South Europe - NSE', value: 'NSE' },
                { label: 'Deloitte Norway - NO', value: 'NO' },
                { label: 'Deloitte Portugal - PT', value: 'PT' },
                { label: 'Deloitte Spain - ES', value: 'ES' },
                { label: 'Deloitte Sweden - SE', value: 'SE' },
                { label: 'Deloitte Switzerland - CH', value: 'CH' },
                { label: 'Deloitte Turkey - TR', value: 'TR' },
                { label: 'Deloitte United Kingdom - UK', value: 'UK' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        },

        /// AME TEAM ///

        ameTeam: {
            name: 'AME Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' },
                { label: 'Deloitte US - US', value: 'US' },
                { label: 'Deloitte Canada - CA', value: 'CA' },
                { label: 'Deloitte Brazil - BR', value: 'BR' },
                { label: 'Deloitte Caribbean and Bermuda Countries - CBC', value: 'CBC' },
                { label: 'Deloitte SLATAM - SLATAM', value: 'SLATAM' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        },

        /// APAC TEAM ///

        apacTeam: {
            name: 'APAC Team',
            mfOptions: [
                { label: 'N/A', value: 'N/A' },
                { label: 'Deloitte South East Asia - SEA', value: 'SEA' },
                { label: 'Deloitte South Asia India - SA_IN', value: 'SA_IN' },
                { label: 'Deloitte South Asia Mauritius - SA_MU', value: 'SA_MU' },
                { label: 'Deloitte Japan - JP', value: 'JP' },
                { label: 'Deloitte Korea - KR', value: 'KR' },
                { label: 'Deloitte Taiwan - TW', value: 'TW' },
                { label: 'Deloitte Australia - AU', value: 'AU' },
                { label: 'Deloitte New Zealand - NZ', value: 'NZ' },
                { label: 'DTTL (Deloitte Global) - GLB', value: 'GLB' }
            ],
            productOptions: ['N/A', 'DLP', 'SWG', 'CASB', 'DCRM', 'DCRM Scanner'],
            statusOptions: ['N/A', 'Waiting Requester', 'WIP', 'Waiting SPM', 'Waiting MF approval', 'Waiting Engineering', 'Waiting Service Owner', 'Waiting Vendor', 'Closed'],
            typeOptions: [
                'N/A',
                'Duplicated',
                'Access',
                'App',
                'Config',
                'Dedicated IP',
                'Domain BP',
                'Malware',
                'Not Applicable',
                'Platform Error',
                'Policy',
                'Questions',
                'Recat',
                'Report',
                'Reverted',
                'RMP',
                'Slack',
                'SOC',
                'SPM Request',
                'SSL BP',
                'VPN',
                'Printer',
                'File Share',
                'Uninstall Password',
                'Feature Request'
            ],
            complexityOptions: ['N/A', '1', '2', '3'],
            showVendor: true,
            showPER: true,
            complexityNote: '1 = Low, 2 = Medium, 3 = High'
        }
    };

    /* ==========================================================
     *  TENANT DETECTION FUNCTIONS
     * ==========================================================*/

    function detectTenant() {
        const inputs = document.querySelectorAll('input.form-control.element_reference_input');
        for (const input of inputs) {
            const value = input.value.trim();
            if (value.startsWith('Deloitte')) {
                const region = value.replace('Deloitte', '').trim();
                const tenant = tenantMapping[region];
                if (tenant) {
                    return tenant;
                }
            }
        }
        return 'Not Detected';
    }

    /* ==========================================================
     *  REQUESTING MEMBER FIRM DETECTION
     * ==========================================================*/

    function detectRequestingMF() {
        const allHiddenInputs = document.querySelectorAll('input[type="hidden"][id*="display_hidden"]');
        for (const input of allHiddenInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                return value;
            }
        }

        const referenceInputs = document.querySelectorAll('input.element_reference_input');
        for (const input of referenceInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                const labelId = input.getAttribute('aria-labelledby');
                if (labelId) {
                    const label = document.getElementById(labelId);
                    if (label && label.textContent.includes('Requesting Member Firm')) {
                        return value;
                    }
                }
                return value;
            }
        }

        const questionSetInputs = document.querySelectorAll('input.questionsetreference');
        for (const input of questionSetInputs) {
            const value = input.value.trim();
            if (value && value.startsWith('Deloitte')) {
                return value;
            }
        }

        return 'Not Detected';
    }

    function updateRequestingMFDisplay() {
        const displayElement = document.getElementById('requestingMFDisplay');
        if (!displayElement) return;

        const requestingMF = detectRequestingMF();
        displayElement.textContent = `Detected Req. MF: ${requestingMF}`;
    }

    /* ==========================================================
     *  AUTO COMPLEXITY FUNCTIONS
     * ==========================================================*/

    function countAdditionalComments() {
        let count = 0;

        const typeLabels = document.querySelectorAll(
            '.sn-card-component-time > span:first-child'
        );

        for (const span of typeLabels) {
            if (span.textContent.trim() === 'Additional comments') {
                count++;
            }
        }

        return count;
    }

    function calculateAutoComplexity(count) {
        if (count <= 15) return '1';
        if (count <= 25) return '2';
        return '3';
    }

    /* ==========================================================
     *  FUNCTIONS
     * ==========================================================*/

    function getFormattedDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function getShortDescriptionInput() {
        return document.getElementById('sc_req_item.short_description') || document.getElementById('incident.short_description');
    }

    function getCurrentTeam() {
        const stored = GM_getValue('shortDescTeam', null);
        return stored && TEAMS[stored] ? stored : null;
    }

    function saveTeam(teamKey) {
        GM_setValue('shortDescTeam', teamKey);
    }

    function getStoredVersion() {
        return GM_getValue('shortDescVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('shortDescVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('shortDescChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('shortDescChangelogSeen', SCRIPT_VERSION);
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

    function showTeamSelector() {
        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'teamSelector';
        Object.assign(selectorContainer.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '10000',
            background: '#fff',
            border: '2px solid #333',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '10px',
            textAlign: 'center',
            minWidth: '400px'
        });

        const title = document.createElement('h2');
        title.textContent = 'Select Your Team';
        title.style.marginBottom = '20px';
        title.style.color = '#333';
        selectorContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Short Description Helper Script';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#666';
        subtitle.style.fontSize = '14px';
        subtitle.style.fontStyle = 'italic';
        selectorContainer.appendChild(subtitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        for (const [key, team] of Object.entries(TEAMS)) {
            const btn = document.createElement('button');
            btn.textContent = team.name;
            Object.assign(btn.style, {
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: '2px solid #007bff',
                borderRadius: '6px',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
            });

            btn.onmouseover = () => {
                btn.style.backgroundColor = '#0056b3';
                btn.style.borderColor = '#0056b3';
            };

            btn.onmouseout = () => {
                btn.style.backgroundColor = '#007bff';
                btn.style.borderColor = '#007bff';
            };

            btn.onclick = () => {
                saveTeam(key);
                selectorContainer.remove();
                showLoadingOverlay();
                setTimeout(() => {
                    location.reload();
                }, 100);
            };

            buttonContainer.appendChild(btn);
        }

        selectorContainer.appendChild(buttonContainer);
        document.body.appendChild(selectorContainer);
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        #shortDescPanel div.field-wrapper {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            margin-left: 10px;
        }

        #shortDescPanel label {
            display: inline-block;
            width: 130px;
            font-weight: bold;
            color: black !important;
            margin-right: 6px;
        }

        #shortDescPanel .tenant-value {
            display: inline;
            font-size: 14px;
            box-sizing: border-box;
            color: #0066cc !important;
            text-decoration: none;
            font-weight: normal;
        }

        #shortDescPanel .tenant-value:hover {
            text-decoration: underline;
        }

        #shortDescPanel select,
        #shortDescPanel input[type="text"] {
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background-color: #f9f9f9;
            font-size: 14px;
            width: 280px;
            box-sizing: border-box;
            transition: all 0.2s ease;
            appearance: none;
            -webkit-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23333" height="24" width="24" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 12px;
            padding-right: 30px;
        }

        #shortDescPanel select,
        #shortDescPanel input,
        #shortDescPanel select option {
            color: black !important;
        }

        #shortDescPanel select:hover,
        #shortDescPanel select:focus,
        #shortDescPanel input[type="text"]:hover,
        #shortDescPanel input[type="text"]:focus {
            border-color: #888;
            background-color: #fff;
            outline: none;
        }

        #shortDescPanel select:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            background-color: #e9e9e9;
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            flex-wrap: wrap;
        }

        .button-group button {
            flex: 1;
            min-width: 150px;
            padding: 8px 12px;
            border: 3px solid #ccc;
            border-radius: 6px;
            backgroundColor: #f0f0f0;
            cursor: 'pointer';
            font-weight: bold;
        }

        .button-group button:hover {
            background-color: #e0e0e0;
            border-color: #999;
        }

        /* Helper Button Styles */
        #shortDescHelperButton {
            background-color: #667eea !important;
            border: 1px solid #5568d3 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
        }

        #shortDescHelperButton:hover {
            background-color: #5568d3 !important;
            border-color: #4557bb !important;
        }

        #shortDescHelperButton:active {
            background-color: #4557bb !important;
        }

        #shortDescHelperButton::before {
            content: "📝";
            font-size: 16px;
            line-height: 1;
            display: block;
        }

        /* Update Date Button Styles */
        #shortDescUpdateDateButton {
            background-color: #17a2b8 !important;
            border: 1px solid #138496 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
            margin-left: 2px;
        }

        #shortDescUpdateDateButton:hover {
            background-color: #138496 !important;
            border-color: #117a8b !important;
        }

        #shortDescUpdateDateButton:active {
            background-color: #117a8b !important;
        }

        #shortDescUpdateDateButton::before {
            content: "📅";
            font-size: 16px;
            line-height: 1;
            display: block;
        }

        /* Netskope Tenant Link Button Styles */
        #shortDescTenantLinkButton {
            background-color: #343434 !important;
            border: 1px solid #0091c9 !important;
            color: white !important;
            transition: all 0.2s ease;
            position: relative;
            margin-left: 2px;
            padding: 0 !important;
            width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
        }

        #shortDescTenantLinkButton:hover {
            background-color: #1b1b1b !important;
            border-color: #007fa8 !important;
        }

        #shortDescTenantLinkButton:active {
            background-color: #007fa8 !important;
        }

        #shortDescTenantLinkButton img {
            width: 20px;
            height: 20px;
            display: block;
        }

        #shortDescTenantLinkButton.disabled {
            background-color: #cccccc !important;
            border-color: #bbbbbb !important;
            cursor: not-allowed !important;
            opacity: 0.6;
        }

        #shortDescTenantLinkButton.disabled:hover {
            background-color: #cccccc !important;
            border-color: #bbbbbb !important;
        }

        /* Changelog Notification Styles */
        #changelogNotification {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            margin-left: 10px;
            padding: 3px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }

        #changelogNotification:hover {
            background-color: #f0f0f0;
        }

        #changelogNotification .notification-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: colorPulse 1s ease-in-out infinite;
        }

        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #changelogNotification .notification-text {
            font-size: 11px;
            color: #0066cc;
            text-decoration: underline;
        }

        /* Changelog Modal Styles */
        #changelogModal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        }

        #changelogModal h2 {
            margin-top: 0;
            margin-bottom: 15px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        #changelogModal .version-info {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }

        #changelogModal .changelog-content {
            white-space: pre-wrap;
            line-height: 1.6;
            color: #333;
        }

        #changelogModal .close-changelog {
            margin-top: 15px;
            padding: 10px 20px;
            background-color: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
        }

        #changelogModal .close-changelog:hover {
            background-color: #5568d3;
        }

        #changelogModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
        }

        /* Modal Overlay for Main Panel */
        #shortDescPanelOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 9998;
            display: none;
        }

        /* Loading Overlay Styles */
        #loadingOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .loading-spinner {
            width: 60px;
            height: 60px;
            border: 6px solid #f3f3f3;
            border-top: 6px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Auto-complexity row styles */
        #autoComplexityRow {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            margin-left: 10px;
        }

        #autoComplexityRow .auto-complexity-spacer {
            display: inline-block;
            width: 130px;
            margin-right: 6px;
            flex-shrink: 0;
        }

        #autoComplexityRow .auto-complexity-inner {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        #autoComplexityCheckbox {
            width: 15px !important;
            height: 15px !important;
            cursor: pointer;
            accent-color: #667eea;
            flex-shrink: 0;
            margin: 0 !important;
        }

        #autoComplexityLabel {
            font-size: 13px;
            color: #444;
            cursor: pointer;
            user-select: none;
            font-weight: normal !important;
            width: auto !important;
        }

        #autoComplexityCount {
            font-size: 11px;
            color: #888;
            font-style: italic;
            white-space: nowrap;
        }

        #autoComplexityCount.active {
            color: #667eea;
            font-weight: bold;
            font-style: normal;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
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

            const notification = document.getElementById('changelogNotification');
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
     *  MODAL CLOSE FUNCTION
     * ==========================================================*/

    function closeMainPanel() {
        const container = document.getElementById('shortDescPanel');
        const overlay = document.getElementById('shortDescPanelOverlay');
        if (container) container.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    }

    /* ==========================================================
     *  MAIN PANEL INITIALIZATION
     * ==========================================================*/

    function initializePanel() {
        const currentTeamKey = getCurrentTeam();
        if (!currentTeamKey) {
            showTeamSelector();
            return;
        }

        const currentTeam = TEAMS[currentTeamKey];

        // Create overlay for main panel
        const overlay = document.createElement('div');
        overlay.id = 'shortDescPanelOverlay';
        overlay.onclick = closeMainPanel;
        document.body.appendChild(overlay);

        // Main container
        const container = document.createElement('div');
        container.id = 'shortDescPanel';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '8px',
            display: 'none',
            width: '480px'
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
            width: '25px',
            height: '25px',
            fontWeight: 'bold'
        });
        closeButton.onclick = closeMainPanel;
        container.appendChild(closeButton);

        // Team indicator container
        const teamIndicatorContainer = document.createElement('div');
        Object.assign(teamIndicatorContainer.style, {
            padding: '8px 10px',
            fontSize: '12px',
            color: '#666',
            borderBottom: '1px solid #eee',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        });

        // Top row
        const topRow = document.createElement('div');
        Object.assign(topRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const teamIndicator = document.createElement('span');
        teamIndicator.textContent = `Current Team: ${currentTeam.name}`;

        const changeTeamButtonTop = document.createElement('button');
        changeTeamButtonTop.textContent = 'Switch Team';
        Object.assign(changeTeamButtonTop.style, {
            background: 'none',
            border: 'none',
            color: '#0066cc',
            cursor: 'pointer',
            fontSize: '11px',
            textDecoration: 'underline',
            padding: '2px 4px',
            margin: '0px 30px 0px 0px',
            transition: 'color 0.2s ease'
        });
        changeTeamButtonTop.onmouseover = () => changeTeamButtonTop.style.color = '#0052a3';
        changeTeamButtonTop.onmouseout  = () => changeTeamButtonTop.style.color = '#0066cc';
        changeTeamButtonTop.onclick = () => {
            GM_deleteValue('shortDescTeam');
            showLoadingOverlay();
            setTimeout(() => location.reload(), 100);
        };

        topRow.appendChild(teamIndicator);
        topRow.appendChild(changeTeamButtonTop);
        teamIndicatorContainer.appendChild(topRow);

        // Version + changelog row
        const versionRow = document.createElement('div');
        Object.assign(versionRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            flexWrap: 'wrap'
        });

        const versionIndicator = document.createElement('span');
        versionIndicator.textContent = `Version • v${SCRIPT_VERSION}`;
        versionRow.appendChild(versionIndicator);

        // "Configure Tenant URLs" link
        const configureTenantLink = document.createElement('span');
        Object.assign(configureTenantLink.style, {
            color: '#0066cc',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '11px'
        });
        configureTenantLink.textContent = '⚙ Tenant URLs';
        configureTenantLink.title = 'Edit stored Netskope tenant URLs';
        configureTenantLink.onclick = () => {
            closeMainPanel();
            showTenantURLSetup(() => location.reload());
        };
        versionRow.appendChild(configureTenantLink);

        // Changelog notification
        const showChangelog = isNewVersion() && !hasSeenChangelog();
        if (showChangelog) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';

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

        teamIndicatorContainer.appendChild(versionRow);
        container.appendChild(teamIndicatorContainer);

        // Fields container
        const fieldsContainer = document.createElement('div');
        fieldsContainer.style.display = 'none';
        fieldsContainer.style.marginTop = '35px';

        // Helper functions
        const createTenantDisplay = () => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = 'MF NS Tenant: ';

            const tenantLink = document.createElement('a');
            tenantLink.className = 'tenant-value';
            tenantLink.id = 'tenantDisplay';
            tenantLink.textContent = 'Detecting...';
            tenantLink.href = '#';
            tenantLink.target = '_blank';
            tenantLink.rel = 'noopener noreferrer';
            Object.assign(tenantLink.style, {
                color: '#0066cc',
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: 'normal'
            });

            tenantLink.onmouseover = () => {
                if (tenantLink.href !== '#') tenantLink.style.textDecoration = 'underline';
            };
            tenantLink.onmouseout = () => {
                tenantLink.style.textDecoration = 'none';
            };

            wrapper.appendChild(label);
            wrapper.appendChild(tenantLink);
            return wrapper;
        };

        const createDropdown = (labelText, optionsArray, id) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            label.setAttribute('for', id);

            const dropdownContainer = document.createElement('div');
            dropdownContainer.style.position = 'relative';
            dropdownContainer.style.display = 'inline-block';

            const select = document.createElement('select');
            select.id = id;
            select.style.paddingRight = '20px';

            for (const option of optionsArray) {
                const opt = document.createElement('option');
                if (typeof option === 'object') {
                    opt.value = option.value;
                    opt.textContent = option.label;
                } else {
                    opt.value = option;
                    opt.textContent = option;
                }
                select.appendChild(opt);
            }

            const arrow = document.createElement('span');
            arrow.textContent = '▼';
            Object.assign(arrow.style, {
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                fontSize: '12px',
                color: '#666'
            });

            dropdownContainer.appendChild(select);
            dropdownContainer.appendChild(arrow);
            wrapper.appendChild(label);
            wrapper.appendChild(dropdownContainer);
            return wrapper;
        };

        const createTextInput = (labelText, id) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'field-wrapper';

            const label = document.createElement('label');
            label.textContent = `${labelText}: `;
            label.setAttribute('for', id);

            const input = document.createElement('input');
            input.id = id;
            input.type = 'text';

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            return wrapper;
        };

        // Build fields
        fieldsContainer.appendChild(createTenantDisplay());
        fieldsContainer.appendChild(createDropdown('MF', currentTeam.mfOptions, 'mf'));

        const requestingMFDisplay = document.createElement('div');
        requestingMFDisplay.id = 'requestingMFDisplay';
        requestingMFDisplay.style.fontSize = '12px';
        requestingMFDisplay.style.margin = '0 0 10px 140px';
        requestingMFDisplay.style.color = '#555';
        requestingMFDisplay.textContent = 'Detecting Requesting MF...';
        fieldsContainer.appendChild(requestingMFDisplay);

        fieldsContainer.appendChild(createDropdown('Product', currentTeam.productOptions, 'product'));
        fieldsContainer.appendChild(createDropdown('Current Status', currentTeam.statusOptions, 'status'));

        if (currentTeam.showVendor) {
            fieldsContainer.appendChild(createTextInput('Vendor Case', 'vendor'));
        }

        fieldsContainer.appendChild(createDropdown('Type', currentTeam.typeOptions, 'type'));
        fieldsContainer.appendChild(createDropdown('Complexity', currentTeam.complexityOptions, 'complexity'));

        const complexityNote = document.createElement('div');
        complexityNote.style.fontSize = '12px';
        complexityNote.style.margin = '0 0 10px 140px';
        complexityNote.style.color = '#555';
        complexityNote.textContent = currentTeam.complexityNote;
        fieldsContainer.appendChild(complexityNote);

        /* ----------------------------------------------------------
         *  AUTO-COMPLEXITY CHECKBOX ROW
         * ---------------------------------------------------------- */
        const autoComplexityRow = document.createElement('div');
        autoComplexityRow.id = 'autoComplexityRow';

        const autoComplexitySpacer = document.createElement('span');
        autoComplexitySpacer.className = 'auto-complexity-spacer';
        autoComplexityRow.appendChild(autoComplexitySpacer);

        const autoComplexityInner = document.createElement('div');
        autoComplexityInner.className = 'auto-complexity-inner';

        const autoComplexityCheckbox = document.createElement('input');
        autoComplexityCheckbox.type = 'checkbox';
        autoComplexityCheckbox.id = 'autoComplexityCheckbox';
        autoComplexityCheckbox.checked = GM_getValue('shortDescAutoComplexity', true);

        const autoComplexityLabel = document.createElement('label');
        autoComplexityLabel.id = 'autoComplexityLabel';
        autoComplexityLabel.htmlFor = 'autoComplexityCheckbox';
        autoComplexityLabel.textContent = 'Auto-calculate complexity';

        const autoComplexityCount = document.createElement('span');
        autoComplexityCount.id = 'autoComplexityCount';

        autoComplexityInner.appendChild(autoComplexityCheckbox);
        autoComplexityInner.appendChild(autoComplexityLabel);
        autoComplexityInner.appendChild(autoComplexityCount);
        autoComplexityRow.appendChild(autoComplexityInner);
        fieldsContainer.appendChild(autoComplexityRow);

        function applyAutoComplexity() {
            const complexitySelect = document.getElementById('complexity');
            if (!complexitySelect) return;

            const count = countAdditionalComments();
            const val = calculateAutoComplexity(count);

            complexitySelect.value = val;
            autoComplexityCount.textContent =
                `(${count} comment${count !== 1 ? 's' : ''} → ${val})`;
            autoComplexityCount.className = 'active';
        }

        function toggleAutoComplexity(enabled) {
            GM_setValue('shortDescAutoComplexity', enabled);
            const complexitySelect = document.getElementById('complexity');
            if (!complexitySelect) return;

            if (enabled) {
                complexitySelect.disabled = true;
                applyAutoComplexity();
            } else {
                complexitySelect.disabled = false;
                autoComplexityCount.textContent = '';
                autoComplexityCount.className = '';
            }
        }

        autoComplexityCheckbox.onchange = () => {
            toggleAutoComplexity(autoComplexityCheckbox.checked);
        };
        /* ---------------------------------------------------------- */

        if (currentTeam.showPER) {
            fieldsContainer.appendChild(createTextInput('PER Number', 'per'));
        }

        // Buttons
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Change Short description';
        applyButton.className = 'apply-btn';
        Object.assign(applyButton.style, { fontWeight: 'bold' });

        const insertDefaultButton = document.createElement('button');
        insertDefaultButton.textContent = 'Insert Default Short description';
        Object.assign(insertDefaultButton.style, {
            margin: '10px',
            marginBottom: '0px',
            lineHeight: '1',
            fontSize: '12px',
            fontWeight: 'normal',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'block'
        });
        // ── CHANGE 1: updated template to include MF Tenant at the end ──
        insertDefaultButton.onclick = () => {
            const input = getShortDescriptionInput();
            if (input) {
                input.value = `DD-MM-YEAR | MF | Product | Current Status | Vendor Case | Type | Complexity | PER Number | MF Tenant`;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                alert('No se encontró el input con ID sc_req_item.short_description o incident.short_description');
            }
            closeMainPanel();
        };

        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.className = 'button-group';
        buttonsWrapper.style.margin = '10px 0';
        buttonsWrapper.style.flexDirection = 'column';
        buttonsWrapper.appendChild(insertDefaultButton);

        const actionButtonsWrapper = document.createElement('div');
        actionButtonsWrapper.className = 'button-group';
        actionButtonsWrapper.style.margin = '10px 0';
        actionButtonsWrapper.appendChild(applyButton);

        fieldsContainer.appendChild(buttonsWrapper);
        fieldsContainer.appendChild(actionButtonsWrapper);

        container.appendChild(fieldsContainer);
        document.body.appendChild(container);

        window.shortDescCurrentTenantURL = null;

        // Create and insert helper buttons
        function createHelperButton() {
            const shortDescInput = getShortDescriptionInput();
            if (!shortDescInput) return;

            const addonsDivs = document.querySelectorAll('.form-field-addons');
            let addonsDiv = null;
            for (const div of addonsDivs) {
                const lookupBtn = div.querySelector(`[id*="short_description"]`);
                if (lookupBtn) { addonsDiv = div; break; }
            }

            if (!addonsDiv) return;
            if (document.getElementById('shortDescHelperButton')) return;

            const helperButton = document.createElement('a');
            helperButton.id = 'shortDescHelperButton';
            helperButton.tabIndex = '-1';
            helperButton.role = 'button';
            helperButton.className = 'btn btn-default btn-ref';
            helperButton.title = 'Short Description Helper';
            helperButton.setAttribute('data-original-title', 'Short Description Helper');

            helperButton.onclick = (e) => {
                e.preventDefault();
                container.style.display = 'block';
                overlay.style.display = 'block';
                fieldsContainer.style.display = 'block';

                // Detect and display tenant with clickable link
                const detectedTenant = detectTenant();
                const currentTenantURLs = getTenantURLs();
                const tenantDisplay = document.getElementById('tenantDisplay');
                if (tenantDisplay) {
                    tenantDisplay.textContent = detectedTenant;
                    if (currentTenantURLs[detectedTenant]) {
                        tenantDisplay.href = currentTenantURLs[detectedTenant];
                        tenantDisplay.style.cursor = 'pointer';
                        window.shortDescCurrentTenantURL = currentTenantURLs[detectedTenant];
                    } else {
                        tenantDisplay.href = '#';
                        tenantDisplay.style.cursor = 'default';
                        tenantDisplay.onclick = (ev) => ev.preventDefault();
                        window.shortDescCurrentTenantURL = null;
                    }
                }

                updateRequestingMFDisplay();

                // Pre-fill fields from existing short description
                // New format: DATE | MF | Product | Status | Vendor | Type | Complexity | PER | MF Tenant
                const input = getShortDescriptionInput();
                if (input && input.value.includes('|')) {
                    const parts = input.value.split('|').map(p => p.trim());

                    // parts[0] = date, parts[1] = MF, parts[2] = Product, ...
                    if (parts.length >= 2) {
                        // MF (parts[1])
                        const mfVal = parts[1];
                        if (currentTeam.mfOptions.find(o => o.value === mfVal)) {
                            document.getElementById('mf').value = mfVal;
                        }

                        let index = 2;

                        // Product (parts[2])
                        if (parts[index] !== undefined) {
                            if (currentTeam.productOptions.includes(parts[index])) {
                                document.getElementById('product').value = parts[index++];
                            } else {
                                index++; // skip unrecognised / placeholder token
                            }
                        }

                        // Status
                        if (parts[index] === 'Current Status') {
                            index++;
                        } else if (parts[index] !== undefined && currentTeam.statusOptions.includes(parts[index])) {
                            document.getElementById('status').value = parts[index++];
                        }

                        // Vendor
                        if (currentTeam.showVendor && parts[index] !== undefined) {
                            if (parts[index] === 'Vendor Case') {
                                index++;
                            } else if (parts[index].startsWith('Vendor Case')) {
                                document.getElementById('vendor').value = parts[index++].replace('Vendor Case', '').trim();
                            } else if (/^[A-Z0-9\-]+$/i.test(parts[index])) {
                                document.getElementById('vendor').value = parts[index++];
                            }
                        }

                        // Type
                        if (parts[index] === 'Type') {
                            index++;
                        } else if (parts[index] !== undefined && currentTeam.typeOptions.includes(parts[index])) {
                            document.getElementById('type').value = parts[index++];
                        }

                        // Complexity — only restore from string if auto-mode is OFF
                        if (!GM_getValue('shortDescAutoComplexity', true)) {
                            if (parts[index] === 'Complexity') {
                                index++;
                            } else if (parts[index] !== undefined && currentTeam.complexityOptions.includes(parts[index])) {
                                document.getElementById('complexity').value = parts[index++];
                            }
                        } else {
                            // Skip the complexity token regardless
                            if (parts[index] === 'Complexity' || (parts[index] !== undefined && currentTeam.complexityOptions.includes(parts[index]))) {
                                index++;
                            }
                        }

                        // PER
                        if (currentTeam.showPER && parts[index] !== undefined && parts[index] !== 'PER Number') {
                            // Only treat as PER if it doesn't look like a tenant name
                            const knownTenants = Object.values(TENANT_NAME_TO_KEY).map((_, i) => Object.keys(TENANT_NAME_TO_KEY)[i]);
                            if (!knownTenants.includes(parts[index]) && !parts[index].includes('Tenant')) {
                                document.getElementById('per').value = parts[index];
                            }
                            index++;
                        } else if (parts[index] === 'PER Number') {
                            index++;
                        }
                    }
                }

                // Apply auto-complexity last so it always wins when enabled
                const isAutoEnabled = GM_getValue('shortDescAutoComplexity', true);
                autoComplexityCheckbox.checked = isAutoEnabled;
                toggleAutoComplexity(isAutoEnabled);
            };

            // Update Date button
            const updateDateButton = document.createElement('a');
            updateDateButton.id = 'shortDescUpdateDateButton';
            updateDateButton.tabIndex = '-1';
            updateDateButton.role = 'button';
            updateDateButton.className = 'btn btn-default btn-ref';
            updateDateButton.title = 'Update Date Only';
            updateDateButton.setAttribute('data-original-title', 'Update Date Only');

            updateDateButton.onclick = (e) => {
                e.preventDefault();
                const input = getShortDescriptionInput();
                if (!input) { alert('Short description field not found'); return; }

                const currentValue = input.value.trim();
                const newDate = getFormattedDate();
                const datePattern = /^\d{2}-\d{2}-\d{4}/;

                let newValue;
                if (datePattern.test(currentValue)) {
                    newValue = currentValue.replace(datePattern, newDate);
                } else if (currentValue) {
                    newValue = `${newDate} | ${currentValue}`;
                } else {
                    newValue = newDate;
                }

                input.value = newValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                updateDateButton.style.backgroundColor = '#4CAF50';
                updateDateButton.style.borderColor = '#45a049';
                setTimeout(() => {
                    updateDateButton.style.backgroundColor = '';
                    updateDateButton.style.borderColor = '';
                }, 500);
            };

            // Tenant Link button
            const tenantLinkButton = document.createElement('a');
            tenantLinkButton.id = 'shortDescTenantLinkButton';
            tenantLinkButton.tabIndex = '-1';
            tenantLinkButton.role = 'button';
            tenantLinkButton.className = 'btn btn-default btn-ref';
            tenantLinkButton.title = 'Open Netskope Tenant';
            tenantLinkButton.setAttribute('data-original-title', 'Open Netskope Tenant');

            const tenantIcon = document.createElement('img');
            tenantIcon.src = 'https://www.netskope.com/wp-content/uploads/2019/04/cropped-favicon-32x32.png';
            tenantIcon.alt = 'Netskope';
            tenantLinkButton.appendChild(tenantIcon);

            tenantLinkButton.onclick = (e) => {
                e.preventDefault();

                if (!window.shortDescCurrentTenantURL) {
                    const detectedTenant = detectTenant();
                    const currentTenantURLs = getTenantURLs();
                    if (currentTenantURLs[detectedTenant]) {
                        window.shortDescCurrentTenantURL = currentTenantURLs[detectedTenant];
                    }
                }

                if (window.shortDescCurrentTenantURL) {
                    window.open(window.shortDescCurrentTenantURL, '_blank', 'noopener,noreferrer');
                    tenantLinkButton.style.backgroundColor = '#4CAF50';
                    tenantLinkButton.style.borderColor = '#45a049';
                    setTimeout(() => {
                        tenantLinkButton.style.backgroundColor = '';
                        tenantLinkButton.style.borderColor = '';
                    }, 500);
                } else {
                    alert('No tenant detected. Please ensure a Member Firm is selected.');
                }
            };

            addonsDiv.appendChild(helperButton);
            addonsDiv.appendChild(updateDateButton);
            addonsDiv.appendChild(tenantLinkButton);
        }

        // ── CHANGE 2: Apply button — MF and Product are now separate pipes,
        //              MF Tenant appended at the end ────────────────────────
        applyButton.onclick = () => {
            const date = getFormattedDate();
            let mf         = document.getElementById('mf').value;
            let product    = document.getElementById('product').value;
            let status     = document.getElementById('status').value;
            let vendor     = currentTeam.showVendor ? document.getElementById('vendor').value.trim() : '';
            let type       = document.getElementById('type').value;
            let complexity = document.getElementById('complexity').value;
            const per      = currentTeam.showPER ? document.getElementById('per').value.trim() : '';
            const tenantDisplay = document.getElementById('tenantDisplay');
            const mfTenant = (tenantDisplay && tenantDisplay.textContent !== 'Detecting...' && tenantDisplay.textContent !== 'Not Detected')
            ? tenantDisplay.textContent.trim()
            : 'MF Tenant';

            // Replace N/A placeholders with readable labels
            mf         = mf         === 'N/A' ? 'MF'             : mf;
            product    = product    === 'N/A' ? 'Product'        : product;
            status     = status     === 'N/A' ? 'Current Status' : status;
            type       = type       === 'N/A' ? 'Type'           : type;
            complexity = complexity === 'N/A' ? 'Complexity'     : complexity;

            const parts = [];
            parts.push(mf);                                            // MF  (separate token)
            parts.push(product);                                       // Product (separate token)
            parts.push(status);
            if (currentTeam.showVendor) parts.push(vendor || 'Vendor Case');
            parts.push(type);
            parts.push(complexity);
            if (currentTeam.showPER) parts.push(per || 'PER Number');
            parts.push(mfTenant);                                      // MF Tenant (new, last)

            const finalText = `${date} | ${parts.join(' | ')}`;

            const input = getShortDescriptionInput();
            if (input) {
                input.value = finalText;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                alert('No se encontró el input con ID sc_req_item.short_description o incident.short_description');
            }

            closeMainPanel();
        };

        const checkAndCreateButton = setInterval(() => {
            const shortDescInput = getShortDescriptionInput();
            if (shortDescInput) {
                createHelperButton();
                clearInterval(checkAndCreateButton);
            }
        }, 500);

        setTimeout(createHelperButton, 1000);
    }

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function startScript() {
        const currentTeam = getCurrentTeam();

        if (!areTenantURLsConfigured()) {
            showTenantURLSetup(() => {
                if (!getCurrentTeam()) {
                    showTeamSelector();
                } else {
                    location.reload();
                }
            });
            return;
        }

        if (!currentTeam) {
            showTeamSelector();
            return;
        }

        initializePanel();
    }

    window.addEventListener('load', startScript);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!getCurrentTeam() && !areTenantURLsConfigured()) {
                showTenantURLSetup(() => showTeamSelector());
            }
        });
    } else {
        startScript();
    }
})();