// ==UserScript==
// @name         |Toolbar| Netskope URL List Manager
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-URLListEditor.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-URLListEditor.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.5.3
// @description  Create and update URL lists for Netskope tenants via API - Integrated with Toolbar v2
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/now/nav/ui/classic/params/target/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔧 Netskope URL List Manager v1.5.3 loading...');

    /* ==========================================================
     *  CONSTANTS & CONFIGURATION
     * ==========================================================*/

    const SCRIPT_VERSION = '1.5.3';
    const CHANGELOG = `Version 1.5.3:
- Added Custom Category Lookup: a new action button lets you look up any Custom
  Category by its numeric ID via the /api/v2/profiles/customcategories/{id} endpoint.
  Results display the category name, status, description, included/excluded URL list IDs,
  included predefined categories, and full audit info (created/modified by + timestamps).

Version 1.5.2:
- Fixed status bubble ("Found X URL lists") not displaying properly: it was appended
  after the content containers, so the flex:1 container pushed it off-screen. Moved
  it above the containers so it appears between the action buttons and the list.
- Fixed persistent bottom clipping: replaced height/maxHeight with a pinned
  bottom:20px anchor. The modal now always ends 20px from the viewport bottom
  regardless of browser, OS scale, or padding model.

Version 1.5.1:
- Fixed modal clipping at the bottom of the screen. The tenant override selector was
  moved into the API Configuration section header row, adding no extra height.
  Added box-sizing: border-box to the modal so the declared height always includes
  padding regardless of the page CSS context.

Version 1.5.0:
- Temporary tenant switch: a dropdown in the API Configuration panel lets you override
  the auto-detected tenant for the current session. The override resets automatically
  when the modal is closed and is never saved to storage. If the target tenant has a
  saved token, its passphrase is prompted on switch.
- Inline domain lookup in the URL Lists view: a search bar next to the list filter lets
  you search a URL or domain across all loaded lists without leaving the list view.
  Results show which lists contain a match, with matched entries expandable per list.
  Clearing the search restores the normal list view.

Version 1.4.6:
- Fixed dark mode compatibility: all modals now force light backgrounds and dark text
  via injected CSS with !important so ServiceNow dark mode cannot override script UI
  inputs, selects, and textareas.

Version 1.4.5:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.4.4:
- Fixed tenant auto-detection in Polaris (Dashboard) mode. The member firm field scan
  now searches inside the shadow DOM iframe instead of the top-level document, so the
  correct Netskope tenant is resolved when tickets are opened from the dashboard.

Version 1.4.3:
- Added dual mode support for Polaris (Dashboard) and Classic (New Tab) ticket access.
  RITM field in the Insert Log Entry and Delete Log Entry modals now resolves correctly
  when tickets are opened from the ServiceNow dashboard via shadow DOM iframe traversal.
  Script now also matches the dashboard URL pattern.

Version 1.4.2:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.4.1:
- Insert RITM and Log Entry now insert at exact cursor position with no auto-newlines
- Insert RITM button now prefixes the ticket number with #`;

    const TOOL_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;

    /* ----------------------------------------------------------
     *  REGION → TENANT TYPE (static, organisational logic only)
     * ----------------------------------------------------------*/
    const REGION_TO_TENANT_TYPE = {
        'Africa':                        'EMA',
        //'Asia Pacific':                  'APAC', -- Uncomment when Tenant is confirmed
        'Australia':                     'APAC',
        'Austria':                       'EU',
        'Belgium':                       'EU',
        'Brazil':                        'AME',
        'Canada':                        'AME',
        'Caribbean and Bermuda Countries': 'AME',
        'Central Europe':                'CE',
        'Central Mediterranean':         'EU',
        'Chile':                         'AME',
        //'China':                         'APAC', -- Uncomment when Tenant is confirmed
        'Cyprus':                        'EU',
        'Denmark':                       'EU',
        'DKU':                           'EMA',
        'Finland':                       'EU',
        'France':                        'CE',
        'Germany':                       'CE',
        //'Hong Kong':                     'APAC', -- Uncomment when Tenant is confirmed
        'Iceland':                       'EU',
        'Ireland':                       'EU',
        'Israel':                        'EMA',
        'Japan':                         'APAC',
        'Korea':                         'APAC',
        'Luxembourg':                    'EU',
        'Mauritius':                     'APAC',
        'Mexico':                        'AME',
        'Middle East':                   'EU',
        'Netherlands':                   'EU',
        'New Zealand':                   'APAC',
        'Nordics':                       'EU',
        'North and South Europe':        'EU',
        'Norway':                        'EU',
        'Portugal':                      'CE',
        'S-LATAM':                       'EMA',
        'South Asia(India)':             'APAC',
        'Southeast Asia':                'APAC',
        'Spain':                         'EMA',
        'Sweden':                        'EU',
        'Switzerland':                   'EU',
        'Taiwan':                        'APAC',
        'Touche Tohmatsu Limited':       'AME',
        'Turkey':                        'CE',
        'United Kingdom':                'EU',
        'United States':                 'AME',
    };

    /* ----------------------------------------------------------
     *  TENANT HOST KEYS  (GM storage keys + UI labels)
     * ----------------------------------------------------------*/
    const TENANT_HOST_KEYS = [
        { key: 'netskopeHost_EMA', label: 'EMA Tenant Host', placeholder: 'google.com' },
        { key: 'netskopeHost_EU',  label: 'EU Tenant Host',  placeholder: 'google.com'  },
        { key: 'netskopeHost_CE',  label: 'CE Tenant Host',  placeholder: 'google.com'  },
        { key: 'netskopeHost_APAC', label: 'APAC Tenant Host', placeholder: 'google.com' },
        { key: 'netskopeHost_AME', label: 'AME Tenant Host', placeholder: 'google.com' },
    ];

    // Maps tenant type abbreviation → GM storage key
    const TENANT_TYPE_TO_KEY = {
        'EMA': 'netskopeHost_EMA',
        'EU':  'netskopeHost_EU',
        'CE':  'netskopeHost_CE',
        'APAC': 'netskopeHost_APAC',
        'AME': 'netskopeHost_AME',
    };

    /* ----------------------------------------------------------
     *  TENANT HOST STORAGE HELPERS
     * ----------------------------------------------------------*/
    function getTenantHosts() {
        const hosts = {};
        for (const [type, gmKey] of Object.entries(TENANT_TYPE_TO_KEY)) {
            const stored = GM_getValue(gmKey, null);
            if (stored) hosts[type] = stored.trim();
        }
        return hosts;
    }

    function areTenantHostsConfigured() {
        return TENANT_HOST_KEYS.every(({ key }) => {
            const val = GM_getValue(key, null);
            return val && val.trim() !== '';
        });
    }

    function saveTenantHosts(hostMap) {
        // hostMap: { netskopeHost_EMA: '...', netskopeHost_EU: '...', ... }
        for (const [gmKey, host] of Object.entries(hostMap)) {
            GM_setValue(gmKey, host.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''));
        }
    }

    /* ----------------------------------------------------------
     *  TENANT HOST SETUP MODAL
     * ----------------------------------------------------------*/
    function showTenantHostSetup(onComplete) {
        // Remove any existing instance
        document.getElementById('netskopeHostSetupOverlay')?.remove();
        document.getElementById('netskopeHostSetupModal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'netskopeHostSetupOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)',
            zIndex: '1000010'
        });

        const modal = document.createElement('div');
        modal.id = 'netskopeHostSetupModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '1000011',
            background: '#fff',
            border: '2px solid #667eea',
            padding: '28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif',
            borderRadius: '12px',
            minWidth: '480px',
            maxWidth: '540px'
        });

        // Title
        const title = document.createElement('h2');
        title.textContent = '🌐 Configure Netskope Tenant Hosts';
        Object.assign(title.style, { margin: '0 0 6px 0', color: '#333', fontSize: '18px' });
        modal.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Netskope URL List Manager — Host configuration';
        Object.assign(subtitle.style, {
            margin: '0 0 16px 0', color: '#888',
            fontSize: '12px', fontStyle: 'italic'
        });
        modal.appendChild(subtitle);

        // Info note
        const note = document.createElement('div');
        Object.assign(note.style, {
            background: '#f0f4ff', border: '1px solid #c7d2fe',
            borderRadius: '6px', padding: '10px 14px',
            marginBottom: '20px', fontSize: '12px',
            color: '#3730a3', lineHeight: '1.5'
        });
        note.innerHTML = '📋 <strong>Enter only the hostname</strong> (without <code>https://</code> or trailing slash).<br>Example: <code>google.com</code><br><br>📄 <strong>Where to find the tenant hostnames:</strong> The Netskope tenant links for each region are listed in the <em>General Scripts User Guide</em> Word document.<br>Look for the section titled <strong>Required information & variables</strong>.';
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

        // Input fields
        const inputs = {};

        for (const { key, label, placeholder } of TENANT_HOST_KEYS) {
            const fieldWrapper = document.createElement('div');
            Object.assign(fieldWrapper.style, {
                display: 'flex', alignItems: 'center',
                marginBottom: '12px', gap: '10px'
            });

            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.setAttribute('for', `hostSetup_${key}`);
            Object.assign(lbl.style, {
                width: '145px', fontWeight: 'bold',
                fontSize: '13px', color: '#333', flexShrink: '0'
            });

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.id = `hostSetup_${key}`;
            inp.placeholder = placeholder;
            // Pre-fill with existing value if already set
            inp.value = GM_getValue(key, '');
            Object.assign(inp.style, {
                flex: '1', padding: '7px 10px',
                border: '1px solid #ccc', borderRadius: '6px',
                fontSize: '12px', boxSizing: 'border-box',
                fontFamily: 'monospace'
            });

            inp.addEventListener('input', () => {
                inp.style.borderColor = inp.value.trim() ? '#4CAF50' : '#e74c3c';
            });

            // Colour feedback on load
            inp.style.borderColor = inp.value.trim() ? '#4CAF50' : '#ccc';

            inputs[key] = inp;
            fieldWrapper.appendChild(lbl);
            fieldWrapper.appendChild(inp);
            modal.appendChild(fieldWrapper);
        }

        // Error message
        const errorMsg = document.createElement('div');
        Object.assign(errorMsg.style, {
            color: '#721c24', fontSize: '12px',
            marginBottom: '10px', display: 'none',
            background: '#f8d7da', border: '1px solid #f5c6cb',
            borderRadius: '4px', padding: '8px'
        });
        errorMsg.textContent = '⚠ All fields are required. Please fill in every tenant hostname.';
        modal.appendChild(errorMsg);

        // Button row
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save & Continue';
        Object.assign(saveBtn.style, {
            flex: '1', padding: '11px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '0 0 100px', padding: '11px',
            background: '#e0e0e0', color: '#333',
            border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
        });

        saveBtn.onclick = () => {
            let allFilled = true;
            for (const { key } of TENANT_HOST_KEYS) {
                if (!inputs[key].value.trim()) {
                    inputs[key].style.borderColor = '#e74c3c';
                    allFilled = false;
                }
            }

            if (!allFilled) {
                errorMsg.style.display = 'block';
                return;
            }

            errorMsg.style.display = 'none';

            const hostMap = {};
            for (const { key } of TENANT_HOST_KEYS) {
                hostMap[key] = inputs[key].value.trim();
            }
            saveTenantHosts(hostMap);

            overlay.remove();
            modal.remove();

            if (onComplete) onComplete();
        };

        cancelBtn.onclick = () => {
            overlay.remove();
            modal.remove();
        };

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(cancelBtn);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Focus first empty field
        const firstEmpty = TENANT_HOST_KEYS.find(({ key }) => !GM_getValue(key, ''));
        if (firstEmpty) {
            setTimeout(() => inputs[firstEmpty.key]?.focus(), 100);
        }
    }

    /* ----------------------------------------------------------
     *  Updated detectTenant() — resolves via GM-stored hosts
     * ----------------------------------------------------------*/
    function getActiveTenant() {
        return temporaryTenant || detectTenant();
    }

    function detectTenant() {
        const ctx = getTicketContext();
        const doc = (ctx && ctx.doc) || document;

        const selectors = [
            'input.form-control.element_reference_input',
            'input[type="hidden"][id*="display_hidden"]'
        ];

        for (const selector of selectors) {
            for (const input of doc.querySelectorAll(selector)) {
                const value = input.value.trim();
                if (value.startsWith('Deloitte')) {
                    const region = value.replace('Deloitte', '').trim();
                    const tenantType = REGION_TO_TENANT_TYPE[region];
                    if (tenantType) {
                        const gmKey = TENANT_TYPE_TO_KEY[tenantType];
                        const host = GM_getValue(gmKey, null);
                        if (host) return host.trim();
                    }
                }
            }
        }
        return null;
    }

    const EXPIRY_SCALES = [
        { label: 'Hours', value: 1 },
        { label: 'Days', value: 24 },
        { label: 'Weeks', value: 168 },
        { label: 'Months', value: 720 }
    ];

    const STATUS_COLORS = {
        success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
        error:   { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
        info:    { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' },
        warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' }
    };

    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    let currentUrlLists = [];
    let sessionPassphrases = {};
    let temporaryTenant = null;

    /* ==========================================================
     *  SESSION MANAGEMENT (Tenant-Specific)
     * ==========================================================*/

    const SessionManager = {
        getPassphrase(tenant) {
            if (!tenant) return null;
            if (sessionPassphrases[tenant]) return sessionPassphrases[tenant];
            const stored = sessionStorage.getItem(`netskope_session_key_${tenant}`);
            if (stored) {
                sessionPassphrases[tenant] = stored;
                return stored;
            }
            return null;
        },
        setPassphrase(tenant, value) {
            if (!tenant) return;
            sessionPassphrases[tenant] = value;
            sessionStorage.setItem(`netskope_session_key_${tenant}`, value);
        },
        clear(tenant) {
            if (tenant) {
                delete sessionPassphrases[tenant];
                sessionStorage.removeItem(`netskope_session_key_${tenant}`);
            } else {
                sessionPassphrases = {};
                Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('netskope_session_key_')) sessionStorage.removeItem(key);
                });
            }
        },
        hasPassphrase(tenant) { return !!this.getPassphrase(tenant); }
    };

    /* ==========================================================
     *  VERSION MANAGEMENT
     * ==========================================================*/

    const VersionManager = {
        get stored() { return GM_getValue('netskopeUrlListVersion', null); },
        save: () => GM_setValue('netskopeUrlListVersion', SCRIPT_VERSION),

        get changelogSeen() { return GM_getValue('netskopeUrlListChangelogSeen', null) === SCRIPT_VERSION; },
        markChangelogSeen: () => {
            GM_setValue('netskopeUrlListChangelogSeen', SCRIPT_VERSION);
            VersionManager.save();
        },

        isNewer() {
            const stored = this.stored;
            if (!stored) return true;
            const [v1M, v1m, v1p] = stored.split('.').map(Number);
            const [v2M, v2m, v2p] = SCRIPT_VERSION.split('.').map(Number);
            return v2M > v1M ||
                (v2M === v1M && v2m > v1m) ||
                (v2M === v1M && v2m === v1m && v2p > v1p);
        },

        shouldShowChangelog() { return this.isNewer() && !this.changelogSeen; }
    };

    /* ==========================================================
     *  TOKEN ENCRYPTION (AES-256 with PBKDF2)
     * ==========================================================*/

    const TokenCrypto = {
        async hashPassphrase(passphrase) {
            const encoder = new TextEncoder();
            const data = encoder.encode(passphrase);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        },

        async deriveKey(passphrase, salt) {
            const encoder = new TextEncoder();
            const passphraseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
            return crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                passphraseKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
        },

        async encrypt(token, passphrase) {
            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv   = crypto.getRandomValues(new Uint8Array(12));
            const key  = await this.deriveKey(passphrase, salt);
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token));
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            return btoa(String.fromCharCode(...combined));
        },

        async decrypt(encryptedData, passphrase) {
            try {
                const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
                const salt      = combined.slice(0, 16);
                const iv        = combined.slice(16, 28);
                const encrypted = combined.slice(28);
                const key       = await this.deriveKey(passphrase, salt);
                const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
                return new TextDecoder().decode(decrypted);
            } catch (e) {
                throw new Error('Invalid passphrase or corrupted data');
            }
        },

        legacyDeobfuscate(obfuscatedToken) {
            if (!obfuscatedToken) return '';
            try {
                const decoded = atob(obfuscatedToken);
                const shift = 7;
                let token = '';
                for (let i = 0; i < decoded.length; i++) {
                    token += String.fromCharCode(decoded.charCodeAt(i) - shift - (i % 5));
                }
                return token;
            } catch (e) { return obfuscatedToken; }
        }
    };

    /* ==========================================================
     *  STORAGE MANAGEMENT
     * ==========================================================*/

    const Storage = {
        async getToken(tenant) {
            const encrypted = GM_getValue(`netskope_token_${tenant}`, '');
            if (!encrypted) return '';
            const passphrase = SessionManager.getPassphrase(tenant);
            if (!passphrase) throw new Error('NO_PASSPHRASE');
            try {
                return await TokenCrypto.decrypt(encrypted, passphrase);
            } catch (e) {
                try { return TokenCrypto.legacyDeobfuscate(encrypted); }
                catch (le) { throw new Error('INVALID_PASSPHRASE'); }
            }
        },

        getExpiry(tenant)   { return GM_getValue(`netskope_token_expiry_${tenant}`, null); },

        async saveToken(tenant, token, hours, passphrase) {
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + hours);
            const encrypted      = await TokenCrypto.encrypt(token, passphrase);
            const passphraseHash = await TokenCrypto.hashPassphrase(passphrase);
            GM_setValue(`netskope_token_${tenant}`, encrypted);
            GM_setValue(`netskope_passphrase_hash_${tenant}`, passphraseHash);
            GM_setValue(`netskope_token_expiry_${tenant}`, { expiryDate: expiryDate.getTime(), duration: hours });
            SessionManager.setPassphrase(tenant, passphrase);
        },

        removeToken(tenant) {
            GM_setValue(`netskope_token_${tenant}`, '');
            GM_setValue(`netskope_passphrase_hash_${tenant}`, '');
            GM_setValue(`netskope_token_expiry_${tenant}`, null);
        },

        isTokenExpired(tenant) {
            const d = this.getExpiry(tenant);
            return d ? new Date().getTime() > d.expiryDate : false;
        },

        hasToken(tenant)   { return !!GM_getValue(`netskope_token_${tenant}`, ''); },

        async verifyPassphrase(tenant, passphrase) {
            const storedHash = GM_getValue(`netskope_passphrase_hash_${tenant}`, '');
            if (!storedHash) return false;
            return (await TokenCrypto.hashPassphrase(passphrase)) === storedHash;
        }
    };

    /* ==========================================================
     *  UI HELPERS
     * ==========================================================*/

    const UI = {
        createElement(tag, styles = {}, attributes = {}) {
            const el = document.createElement(tag);
            Object.assign(el.style, styles);
            Object.entries(attributes).forEach(([k, v]) => el[k] = v);
            return el;
        },

        createInput(id, type, label, placeholder, value = '') {
            const container = this.createElement('div', { width: '100%', marginBottom: '10px' });
            const labelEl   = this.createElement('label', { display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '5px' }, { textContent: label + ':', htmlFor: id });
            const input     = this.createElement('input', { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }, { id, type, placeholder, value });
            container.appendChild(labelEl);
            container.appendChild(input);
            return container;
        },

        createTextArea(id, label, placeholder, rows = 5) {
            const container  = this.createElement('div', { width: '100%', marginBottom: '10px', flex: '1', display: 'flex', flexDirection: 'column' });
            const labelEl    = this.createElement('label', { display: 'block', fontWeight: 'bold', fontSize: '13px', color: '#555', marginBottom: '5px' }, { textContent: label + ':', htmlFor: id });
            const textarea   = this.createElement('textarea', {
                width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px',
                fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace',
                resize: 'vertical', flex: '1', minHeight: '200px', maxHeight: '500px',
                whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'auto', wordWrap: 'normal'
            }, { id, placeholder, rows });
            container.appendChild(labelEl);
            container.appendChild(textarea);
            return container;
        },

        createButton(text, gradient, onClick) {
            const btn = this.createElement('button', {
                padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: gradient, color: 'white', fontWeight: 'bold', fontSize: '14px', flex: '1'
            }, { textContent: text, onclick: onClick });
            return btn;
        },

        showStatus(message, type = 'info') {
            const statusArea = document.getElementById('urllist-status');
            if (!statusArea) return;
            const color = STATUS_COLORS[type] || STATUS_COLORS.info;
            Object.assign(statusArea.style, { backgroundColor: color.bg, border: `1px solid ${color.border}`, color: color.text, display: 'block' });
            statusArea.textContent = message;
            if (type === 'success') setTimeout(() => statusArea.style.display = 'none', 5000);
        },

        hideStatus() {
            const statusArea = document.getElementById('urllist-status');
            if (statusArea) statusArea.style.display = 'none';
        },

        async promptPassphrase(title, message, isNewPassphrase = false) {
            return new Promise((resolve, reject) => {
                const overlay = this.createElement('div', {
                    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                    background: 'rgba(0, 0, 0, 0.7)', zIndex: '1000002',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }, { id: 'passphrase-prompt-overlay' });

                const modal = this.createElement('div', {
                    background: '#ffffff', border: '2px solid #667eea', padding: '25px',
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    maxWidth: '450px', width: '90%', fontFamily: 'Arial, sans-serif'
                });

                modal.innerHTML = `
                    <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                        🔐 ${title}
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.5;">${message}</p>
                    <div style="margin-bottom: 15px;">
                        <input type="password" id="passphrase-input" placeholder="Enter passphrase"
                            style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: monospace;">
                    </div>
                    ${isNewPassphrase ? `
                    <div style="margin-bottom: 15px;">
                        <input type="password" id="passphrase-confirm" placeholder="Confirm passphrase"
                            style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: monospace;">
                    </div>` : ''}
                    <div id="passphrase-error" style="display: none; padding: 8px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24; font-size: 12px; margin-bottom: 15px;"></div>
                    <div style="display: flex; gap: 10px; margin-bottom: ${isNewPassphrase ? '0' : '10px'};">
                        <button id="passphrase-confirm-btn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;">Confirm</button>
                        <button id="passphrase-cancel-btn" style="flex: 1; padding: 10px; background: #e0e0e0; color: #333; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;">Cancel</button>
                    </div>
                    ${!isNewPassphrase ? `
                    <button id="passphrase-forgot-btn" style="width: 100%; padding: 8px; background: transparent; color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                        🗑️ Forgot Passphrase? Delete Token
                    </button>` : ''}
                `;

                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                const input       = document.getElementById('passphrase-input');
                const confirmInp  = document.getElementById('passphrase-confirm');
                const errorDiv    = document.getElementById('passphrase-error');
                const confirmBtn  = document.getElementById('passphrase-confirm-btn');
                const cancelBtn   = document.getElementById('passphrase-cancel-btn');
                const forgotBtn   = document.getElementById('passphrase-forgot-btn');
                const cleanup     = () => overlay.remove();

                const showError = (msg) => {
                    errorDiv.textContent = msg;
                    errorDiv.style.display = 'block';
                    input.style.borderColor = '#dc3545';
                    if (confirmInp) confirmInp.style.borderColor = '#dc3545';
                };

                const handleConfirm = () => {
                    const passphrase = input.value.trim();
                    if (!passphrase) { showError('Passphrase cannot be empty'); return; }
                    if (isNewPassphrase && passphrase !== confirmInp?.value.trim()) { showError('Passphrases do not match'); return; }
                    cleanup();
                    resolve(passphrase);
                };

                confirmBtn.onclick = handleConfirm;
                cancelBtn.onclick  = () => { cleanup(); reject(new Error('USER_CANCELLED')); };
                if (forgotBtn) {
                    forgotBtn.onclick    = () => { cleanup(); reject(new Error('FORGOT_PASSPHRASE')); };
                    forgotBtn.onmouseover = () => { forgotBtn.style.backgroundColor = '#dc3545'; forgotBtn.style.color = 'white'; };
                    forgotBtn.onmouseout  = () => { forgotBtn.style.backgroundColor = 'transparent'; forgotBtn.style.color = '#dc3545'; };
                }

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') isNewPassphrase && confirmInp ? confirmInp.focus() : handleConfirm();
                    else if (e.key === 'Escape') { cleanup(); reject(new Error('USER_CANCELLED')); }
                };
                if (confirmInp) {
                    confirmInp.onkeydown = (e) => {
                        if (e.key === 'Enter') handleConfirm();
                        else if (e.key === 'Escape') { cleanup(); reject(new Error('USER_CANCELLED')); }
                    };
                }

                setTimeout(() => input.focus(), 100);
            });
        }
    };

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    const changelogStyle = document.createElement('style');
    changelogStyle.textContent = `
        #netskopeChangelogNotification { display: inline-flex !important; align-items: center !important; gap: 6px !important; cursor: pointer !important; margin-left: 10px !important; padding: 3px 8px !important; border-radius: 4px !important; transition: background-color 0.2s ease !important; }
        #netskopeChangelogNotification:hover { background-color: #f0f0f0 !important; }
        #netskopeChangelogNotification .netskope-notification-dot { width: 8px !important; height: 8px !important; border-radius: 50% !important; animation: netskopeColorPulse 1s ease-in-out infinite !important; }
        @keyframes netskopeColorPulse { 0%, 100% { background-color: #007bff; } 50% { background-color: #ff8c00; } }
        #netskopeChangelogNotification .netskope-notification-text { font-size: 11px !important; color: #0066cc !important; text-decoration: underline !important; }

        /* Dark mode isolation */
        #netskope-urllist-modal, #netskopeHostSetupModal,
        #urllist-log-add-modal, #urllist-del-modal,
        #urllist-remove-older-confirm, #urllist-log-view-modal { color: #333333 !important; }
        #netskope-urllist-modal input, #netskope-urllist-modal select,
        #netskope-urllist-modal textarea,
        #netskopeHostSetupModal input, #netskopeHostSetupModal select,
        #netskopeHostSetupModal textarea,
        #urllist-log-add-modal input, #urllist-log-add-modal select,
        #urllist-log-add-modal textarea,
        #urllist-del-modal input, #urllist-del-modal select,
        #urllist-del-modal textarea,
        #urllist-remove-older-confirm input, #urllist-remove-older-confirm select,
        #urllist-remove-older-confirm textarea,
        #urllist-log-view-modal input, #urllist-log-view-modal select,
        #urllist-log-view-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(changelogStyle);

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
        const overlay = UI.createElement('div', { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: '1000000' }, { id: 'netskopeChangelogModalOverlay' });
        const modal   = UI.createElement('div', {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000001', background: '#ffffff', border: '2px solid #333333', padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif',
            borderRadius: '10px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', color: '#333333'
        }, { id: 'netskopeChangelogModal' });

        const closeModal = () => { overlay.remove(); modal.remove(); VersionManager.markChangelogSeen(); document.getElementById('netskopeChangelogNotification')?.remove(); removeToolbarNotificationDot(); };

        const h2 = document.createElement('h2');
        h2.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(h2.style, { marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px', fontSize: '1.5em' });
        modal.appendChild(h2);

        const infoDiv = document.createElement('div');
        infoDiv.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(infoDiv.style, { backgroundColor: '#f8f9fa', color: '#333', padding: '10px', borderRadius: '5px', marginBottom: '15px', borderLeft: '4px solid #667eea' });
        modal.appendChild(infoDiv);

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
        modal.appendChild(cardsWrap);

        const closeBtn = UI.createButton('Got it!', '#667eea', closeModal);
        Object.assign(closeBtn.style, { marginTop: '15px', width: '100%', background: '#667eea' });
        modal.appendChild(closeBtn);

        overlay.onclick = closeModal;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  TOKEN UI BUILDERS
     * ==========================================================*/

    async function buildTokenUI(tenant) {
        const container = document.getElementById('api-token-container');
        if (!container) return;
        container.innerHTML = '';

        if (!tenant) {
            container.innerHTML = '<div style="padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; font-size: 13px; color: #856404;">Please select a Member Firm first</div>';
            return;
        }

        Storage.hasToken(tenant) ? buildSavedTokenUI(container, tenant, Storage.getExpiry(tenant)) : buildNewTokenUI(container, tenant);
    }

    function buildSavedTokenUI(container, tenant, expiryData) {
        container.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-weight: bold; font-size: 13px; color: #555; margin-bottom: 5px;">Saved API Token:</label>
                <div style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; background-color: #e9ecef; font-size: 13px; color: #495057; font-family: monospace; letter-spacing: 2px;">
                    ••••••••••••••••••••••••••••••••••••••••
                </div>
            </div>
        `;

        const passphraseStatus = UI.createElement('div', {
            marginBottom: '10px', padding: '8px',
            backgroundColor: SessionManager.hasPassphrase(tenant) ? '#d4edda' : '#fff3cd',
            border: '1px solid ' + (SessionManager.hasPassphrase(tenant) ? '#c3e6cb' : '#ffeaa7'),
            borderRadius: '6px', fontSize: '12px',
            color: SessionManager.hasPassphrase(tenant) ? '#155724' : '#856404',
            fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        });

        const statusText = UI.createElement('span');
        statusText.textContent = SessionManager.hasPassphrase(tenant) ? '🔓 Session unlocked for this browser session' : '🔒 Passphrase required on next tool open';
        passphraseStatus.appendChild(statusText);

        if (SessionManager.hasPassphrase(tenant)) {
            const clearBtn = UI.createElement('button', { padding: '4px 8px', fontSize: '11px', backgroundColor: '#856404', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }, { textContent: 'Lock' });
            clearBtn.onclick = () => {
                if (confirm('This will lock your session. You\'ll need to enter your passphrase again when using the tool. Continue?')) {
                    SessionManager.clear(tenant);
                    UI.showStatus('🔒 Session locked. Passphrase will be required on next use.', 'info');
                    buildSavedTokenUI(container, tenant, expiryData);
                }
            };
            passphraseStatus.appendChild(clearBtn);
        }
        container.appendChild(passphraseStatus);

        if (expiryData) {
            const expiryDate = new Date(expiryData.expiryDate);
            const timeLeft   = expiryDate - new Date();
            const daysLeft   = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            let expiryText, expiryColor, expiryBg;

            if (timeLeft < 0)       { [expiryText, expiryColor, expiryBg] = ['⚠️ EXPIRED', '#721c24', '#f8d7da']; }
            else if (daysLeft === 0) { const h = Math.floor(timeLeft / (1000 * 60 * 60)); [expiryText, expiryColor, expiryBg] = [`⏰ Expires in ${h} hours`, '#856404', '#fff3cd']; }
            else if (daysLeft < 7)  { [expiryText, expiryColor, expiryBg] = [`⚠️ Expires in ${daysLeft} days`, '#856404', '#fff3cd']; }
            else                    { [expiryText, expiryColor, expiryBg] = [`✅ Expires in ${daysLeft} days (${expiryDate.toLocaleDateString()})`, '#155724', '#d4edda']; }

            const expiryDiv = UI.createElement('div', { marginBottom: '10px' });
            expiryDiv.innerHTML = `<label style="display: block; font-weight: bold; font-size: 13px; color: #555; margin-bottom: 5px;">Token Expiry:</label><div style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; background-color: ${expiryBg}; font-size: 13px; color: ${expiryColor}; font-weight: bold;">${expiryText}</div>`;
            container.appendChild(expiryDiv);
        }

        const removeBtn = UI.createButton('🗑️ Remove Token', '#dc3545', () => {
            if (confirm(`Are you sure you want to remove the API token for ${tenant}?`)) {
                Storage.removeToken(tenant);
                SessionManager.clear(tenant);
                UI.showStatus('✅ API token removed successfully!', 'success');
                buildTokenUI(tenant);
            }
        });
        removeBtn.style.width = '100%';
        container.appendChild(removeBtn);
    }

    function buildNewTokenUI(container, tenant) {
        container.appendChild(UI.createInput('api-token-input', 'password', 'API Token v2', 'Your Netskope API token', ''));

        const passphraseSection = UI.createElement('div', { width: '100%', marginBottom: '10px', padding: '12px', backgroundColor: '#f0f4ff', border: '1px solid #667eea', borderRadius: '6px' });
        passphraseSection.innerHTML = `
            <div style="margin-bottom: 8px; color: #333; font-weight: bold; font-size: 13px; display: flex; align-items: center; gap: 6px;">🔐 Encryption Passphrase</div>
            <div style="margin-bottom: 12px; color: #666; font-size: 11px; line-height: 1.4;">Create a passphrase to encrypt your API token. You'll need this passphrase each browser session. <strong>Choose something memorable!</strong></div>
            <div style="margin-bottom: 10px;"><input type="password" id="api-passphrase-input" placeholder="Enter passphrase" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box; font-family: monospace;"></div>
            <div><input type="password" id="api-passphrase-confirm" placeholder="Confirm passphrase" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box; font-family: monospace;"></div>
        `;
        container.appendChild(passphraseSection);

        const expiryContainer = UI.createElement('div', { width: '100%', marginBottom: '10px' });
        expiryContainer.innerHTML = `
            <label style="display: block; font-weight: bold; font-size: 13px; color: #555; margin-bottom: 5px;">Token Valid For:</label>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input id="token-expiry-number" type="number" min="1" value="1" style="flex: 0 0 80px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box; text-align: center;">
                <select id="token-expiry-scale" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                    ${EXPIRY_SCALES.map(s => `<option value="${s.value}" ${s.value === 720 ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(expiryContainer);

        const saveBtn = UI.createButton('💾 Save API Token', '#4CAF50', () => saveApiConfig(tenant));
        saveBtn.style.width = '100%';
        container.appendChild(saveBtn);
    }

    async function saveApiConfig(tenant) {
        const token             = document.getElementById('api-token-input')?.value.trim();
        const passphrase        = document.getElementById('api-passphrase-input')?.value.trim();
        const passphraseConfirm = document.getElementById('api-passphrase-confirm')?.value.trim();
        const numberValue       = parseInt(document.getElementById('token-expiry-number')?.value);
        const scaleValue        = parseInt(document.getElementById('token-expiry-scale')?.value);

        if (!token)                        return UI.showStatus('⚠️ Please enter your API token', 'warning');
        if (!passphrase)                   return UI.showStatus('⚠️ Please enter an encryption passphrase', 'warning');
        if (passphrase !== passphraseConfirm) return UI.showStatus('⚠️ Passphrases do not match', 'warning');
        if (!numberValue || numberValue < 1)  return UI.showStatus('⚠️ Please enter a valid duration (minimum 1)', 'warning');
        if (!tenant)                       return UI.showStatus('⚠️ No tenant detected. Please select a Member Firm in ServiceNow.', 'warning');

        try {
            UI.showStatus('🔐 Encrypting and saving token...', 'info');
            await Storage.saveToken(tenant, token, numberValue * scaleValue, passphrase);
            UI.showStatus('✅ API token saved and encrypted successfully!', 'success');
            await buildTokenUI(tenant);

            const apiConfigContent = document.getElementById('api-config-content');
            const collapseIcon     = document.getElementById('api-config-collapse-icon');
            if (apiConfigContent) apiConfigContent.style.display = 'none';
            if (collapseIcon)     collapseIcon.style.transform   = 'rotate(-90deg)';
        } catch (error) {
            console.error('Failed to save token:', error);
            UI.showStatus('❌ Failed to encrypt and save token', 'error');
        }
    }

    /* ==========================================================
     *  TENANT SWITCH HELPERS
     * ==========================================================*/

    function populateTenantSwitchSelect() {
        const select = document.getElementById('tenant-switch-select');
        if (!select) return;
        select.innerHTML = '<option value="">— Use auto-detected tenant —</option>';
        for (const { key } of TENANT_HOST_KEYS) {
            const host = GM_getValue(key, null);
            if (!host || !host.trim()) continue;
            const type = Object.entries(TENANT_TYPE_TO_KEY).find(([, k]) => k === key)?.[0];
            const opt = document.createElement('option');
            opt.value = host.trim();
            opt.dataset.tenantType = type || '';
            opt.textContent = `${type}: ${host.trim()}`;
            select.appendChild(opt);
        }
        select.value = temporaryTenant || '';
        select.onchange = async () => {
            const opt = select.options[select.selectedIndex];
            await applyTenantSwitch(opt.dataset.tenantType || '', select.value || null);
        };
    }

    async function applyTenantSwitch(tenantType, tenantHost) {
        if (tenantHost && Storage.hasToken(tenantHost) && !SessionManager.hasPassphrase(tenantHost)) {
            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    const passphrase = await UI.promptPassphrase(
                        attempts === 0 ? `Unlock ${tenantType} Token` : `Unlock ${tenantType} Token (Attempt ${attempts + 1}/${maxAttempts})`,
                        attempts === 0
                            ? `Enter the passphrase for your ${tenantType} API token (${tenantHost}).`
                            : '❌ Invalid passphrase. Please try again.',
                        false
                    );
                    if (await Storage.verifyPassphrase(tenantHost, passphrase)) {
                        SessionManager.setPassphrase(tenantHost, passphrase);
                        break;
                    } else {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            alert('❌ Maximum unlock attempts reached.');
                            const sel = document.getElementById('tenant-switch-select');
                            if (sel) sel.value = temporaryTenant || '';
                            return;
                        }
                    }
                } catch (err) {
                    const sel = document.getElementById('tenant-switch-select');
                    if (sel) sel.value = temporaryTenant || '';
                    if (err.message !== 'USER_CANCELLED') alert('❌ Failed to unlock token: ' + err.message);
                    return;
                }
            }
        }

        temporaryTenant = tenantHost || null;
        currentUrlLists = [];
        resetModal();

        const tenantDisplay = document.getElementById('tenant-display');
        if (tenantDisplay) {
            if (tenantHost) {
                tenantDisplay.innerHTML = `⚡ <strong>${tenantType}</strong>: ${tenantHost} <span style="font-size:10px;font-weight:normal;">(temporary override)</span>`;
                tenantDisplay.style.backgroundColor = '#fff3cd';
                tenantDisplay.style.color = '#856404';
                tenantDisplay.style.border = '1px solid #ffeaa7';
            } else {
                const detected = detectTenant();
                if (detected) {
                    tenantDisplay.textContent = detected;
                    tenantDisplay.style.backgroundColor = '#d4edda';
                    tenantDisplay.style.color = '#155724';
                    tenantDisplay.style.border = '1px solid #ccc';
                } else {
                    tenantDisplay.textContent = 'Not detected — Please select a Member Firm in ServiceNow (or configure tenant hosts via ⚙ Tenant Hosts)';
                    tenantDisplay.style.backgroundColor = '#fff3cd';
                    tenantDisplay.style.color = '#856404';
                    tenantDisplay.style.border = '1px solid #ccc';
                }
            }
        }

        await buildTokenUI(getActiveTenant());
    }

    /* ==========================================================
     *  MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('netskope-urllist-modal')) return;

        const backdrop = UI.createElement('div', {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: '999997', display: 'none'
        }, { id: 'netskope-urllist-backdrop' });

        const closeModal = () => { temporaryTenant = null; modal.style.display = 'none'; backdrop.style.display = 'none'; resetModal(); const sel = document.getElementById('tenant-switch-select'); if (sel) sel.value = ''; };
        backdrop.onclick = closeModal;
        document.body.appendChild(backdrop);

        const modal = UI.createElement('div', {
            position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#f9f9f9', border: '1px solid #ccc',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.1)', padding: '50px 20px 20px 20px',
            zIndex: '999998', borderRadius: '10px', fontFamily: 'Arial, sans-serif',
            display: 'none', flexDirection: 'column', alignItems: 'center', gap: '15px',
            minWidth: '650px', maxWidth: '750px', bottom: '20px',
            overflowY: 'auto', boxSizing: 'border-box'
        }, { id: 'netskope-urllist-modal' });

        // Close button
        const closeBtn = UI.createButton('X', 'red', closeModal);
        Object.assign(closeBtn.style, { position: 'absolute', top: '5px', right: '5px', padding: '4px 8px', flex: 'none' });
        modal.appendChild(closeBtn);

        // Title
        const titleDiv = UI.createElement('div', { position: 'absolute', top: '12px', left: '12px', fontSize: '12px', color: '#333', fontWeight: 'bold' });
        titleDiv.textContent = '🌐 Netskope URL List Manager';
        modal.appendChild(titleDiv);

        // Description
        const descP = UI.createElement('p', { fontSize: '13px', color: '#666', margin: '0', textAlign: 'center' });
        descP.textContent = 'Manage URL lists in your Netskope tenant via API';
        modal.appendChild(descP);

        // Version row
        const versionRow = UI.createElement('div', { display: 'flex', alignItems: 'center', gap: '15px', fontSize: '11px', color: '#666', width: '100%', justifyContent: 'center' });
        versionRow.innerHTML = `<span>Version ${SCRIPT_VERSION}</span>`;

        // ⚙ Configure Tenant Hosts link
        const configureHostsLink = UI.createElement('span', { color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px' });
        configureHostsLink.textContent = '⚙ Tenant Hosts';
        configureHostsLink.title = 'Edit stored Netskope tenant hostnames';
        configureHostsLink.onclick = () => {
            closeModal();
            showTenantHostSetup(() => {
                // Re-open the modal after saving
                setTimeout(() => showModal(), 100);
            });
        };
        versionRow.appendChild(configureHostsLink);

        if (VersionManager.shouldShowChangelog()) {
            const changelogNotif = UI.createElement('span', {}, { id: 'netskopeChangelogNotification', onclick: showChangelogModal });
            changelogNotif.innerHTML = `<span class="netskope-notification-dot"></span><span class="netskope-notification-text">What's New</span>`;
            versionRow.appendChild(changelogNotif);
        }
        modal.appendChild(versionRow);

        // API Configuration Section
        const apiSection = UI.createElement('div', { width: '100%' });

        const sectionHeader = UI.createElement('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' });
        sectionHeader.innerHTML = `
            <h3 style="font-size: 14px; font-weight: bold; color: #333; margin: 0;">API Configuration</h3>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span style="font-size: 11px; color: #666; white-space: nowrap;">⚡ Override:</span>
                <select id="tenant-switch-select" style="padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px; color: #333; background: #fff; max-width: 200px;">
                    <option value="">Auto-detect</option>
                </select>
                <span id="api-config-collapse-icon" style="font-size: 12px; color: #666; transition: transform 0.3s ease;">▼</span>
            </div>
        `;
        const apiConfigContent = UI.createElement('div', { width: '100%' }, { id: 'api-config-content' });
        apiConfigContent.innerHTML = `
            <div style="width: 100%; margin-bottom: 10px;">
                <label style="display: block; font-weight: bold; font-size: 13px; color: #555; margin-bottom: 5px;">Detected Tenant:</label>
                <div id="tenant-display" style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; background-color: #e8f4f8; font-size: 13px; color: #0066cc; font-weight: bold; box-sizing: border-box;">Detecting...</div>
            </div>
            <div id="api-token-container" style="width: 100%;"></div>
        `;

        sectionHeader.onclick = () => {
            const isHidden = apiConfigContent.style.display === 'none';
            apiConfigContent.style.display = isHidden ? 'block' : 'none';
            document.getElementById('api-config-collapse-icon').style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        };

        apiSection.appendChild(sectionHeader);
        apiSection.appendChild(apiConfigContent);

        const expiryAlert = UI.createElement('div', { width: '100%', marginTop: '10px', display: 'none' }, { id: 'api-expiry-alert' });
        apiSection.appendChild(expiryAlert);

        modal.appendChild(apiSection);
        sectionHeader.querySelector('#tenant-switch-select')?.addEventListener('click', e => e.stopPropagation());
        modal.appendChild(UI.createElement('hr', { width: '100%', border: 'none', borderTop: '1px solid #ddd', margin: '10px 0' }));

        // Action buttons
        const actionBtns = UI.createElement('div', { display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' });
        actionBtns.appendChild(UI.createButton('🔍 Fetch URL Lists',  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fetchUrlLists));
        actionBtns.appendChild(UI.createButton('✨ Create New List', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', showCreateForm));
        actionBtns.appendChild(UI.createButton('🔎 Domain Lookup', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', showDomainLookup));
        actionBtns.appendChild(UI.createButton('🏷️ Category Lookup', 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', showCustomCategoryLookup));
        actionBtns.lastChild.style.color = '#333';
        modal.appendChild(actionBtns);

        modal.appendChild(UI.createElement('div', {
            width: '100%', padding: '10px', borderRadius: '6px', fontSize: '13px',
            textAlign: 'center', display: 'none'
        }, { id: 'urllist-status' }));

        ['url-lists-container', 'create-form-container', 'update-form-container', 'domain-lookup-container', 'custom-category-container'].forEach(id => {
            modal.appendChild(UI.createElement('div', { display: 'none', width: '100%' }, { id }));
        });

        document.body.appendChild(modal);
    }

    /* ==========================================================
     *  MODAL FUNCTIONS
     * ==========================================================*/

    async function showModal() {
        // Guard: hosts must be configured before anything else
        if (!areTenantHostsConfigured()) {
            showTenantHostSetup(() => showModal());
            return;
        }

        const modal    = document.getElementById('netskope-urllist-modal');
        const backdrop = document.getElementById('netskope-urllist-backdrop');
        if (!modal) return;

        const tenant = detectTenant();

        if (tenant && Storage.hasToken(tenant) && !SessionManager.hasPassphrase(tenant)) {
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    const passphrase = await UI.promptPassphrase(
                        attempts === 0 ? 'Unlock API Token' : `Unlock API Token (Attempt ${attempts + 1}/${maxAttempts})`,
                        attempts === 0
                            ? 'Your API token is encrypted. Please enter your passphrase to unlock it for this browser session.'
                            : '❌ Invalid passphrase. Please try again.',
                        false
                    );

                    if (await Storage.verifyPassphrase(tenant, passphrase)) {
                        SessionManager.setPassphrase(tenant, passphrase);
                        break;
                    } else {
                        attempts++;
                        if (attempts >= maxAttempts) { alert('❌ Maximum unlock attempts reached.'); return; }
                    }
                } catch (error) {
                    if (error.message === 'USER_CANCELLED') return;
                    if (error.message === 'FORGOT_PASSPHRASE') {
                        if (confirm('⚠️ WARNING: This will permanently delete your encrypted API token.\n\nYou will need to save a new API token with a new passphrase.\n\nAre you sure?')) {
                            Storage.removeToken(tenant);
                            SessionManager.clear(tenant);
                            break;
                        } else return;
                    }
                    alert('❌ Failed to unlock token. Error: ' + error.message);
                    return;
                }
            }
        }

        modal.style.display = 'flex';
        if (backdrop) backdrop.style.display = 'block';
        populateTenantSwitchSelect();

        const tenantDisplay = document.getElementById('tenant-display');
        if (tenantDisplay) {
            if (tenant) {
                tenantDisplay.textContent = tenant;
                tenantDisplay.style.backgroundColor = '#d4edda';
                tenantDisplay.style.color = '#155724';
            } else {
                tenantDisplay.textContent = 'Not detected — Please select a Member Firm in ServiceNow (or configure tenant hosts via ⚙ Tenant Hosts)';
                tenantDisplay.style.backgroundColor = '#fff3cd';
                tenantDisplay.style.color = '#856404';
            }
        }

        await buildTokenUI(tenant);

        const hasToken         = Storage.hasToken(tenant);
        const apiConfigContent = document.getElementById('api-config-content');
        const collapseIcon     = document.getElementById('api-config-collapse-icon');
        const expiryAlert      = document.getElementById('api-expiry-alert');

        if (hasToken && apiConfigContent && collapseIcon) {
            apiConfigContent.style.display = 'none';
            collapseIcon.style.transform   = 'rotate(-90deg)';

            const expiry = Storage.getExpiry(tenant);
            if (expiry && expiryAlert) {
                const expiryDate = new Date(expiry.expiryDate);
                const timeLeft   = expiryDate - new Date();
                const daysLeft   = Math.floor(timeLeft / (1000 * 60 * 60 * 24));

                if (timeLeft < 0 || daysLeft < 7) {
                    let alertText, alertBg, alertColor, alertBorder;
                    if (timeLeft < 0)        { [alertText, alertBg, alertColor, alertBorder] = ['⚠️ API Token EXPIRED - Click to update', '#f8d7da', '#721c24', '#f5c6cb']; }
                    else if (daysLeft === 0) { const h = Math.floor(timeLeft / (1000 * 60 * 60)); [alertText, alertBg, alertColor, alertBorder] = [`⏰ API Token expires in ${h} hours - Click to update`, '#fff3cd', '#856404', '#ffeaa7']; }
                    else                     { [alertText, alertBg, alertColor, alertBorder] = [`⚠️ API Token expires in ${daysLeft} days - Click to update`, '#fff3cd', '#856404', '#ffeaa7']; }

                    expiryAlert.innerHTML = `<div style="padding: 8px; border-radius: 6px; font-size: 12px; font-weight: bold; text-align: center; cursor: pointer; background-color: ${alertBg}; color: ${alertColor}; border: 1px solid ${alertBorder};">${alertText}</div>`;
                    expiryAlert.style.display = 'block';
                    expiryAlert.firstChild.onclick = () => {
                        if (apiConfigContent) apiConfigContent.style.display = 'block';
                        if (collapseIcon)     collapseIcon.style.transform   = 'rotate(0deg)';
                    };
                } else {
                    expiryAlert.style.display = 'none';
                }
            }
        } else {
            if (apiConfigContent) apiConfigContent.style.display = 'block';
            if (collapseIcon)     collapseIcon.style.transform   = 'rotate(0deg)';
            if (expiryAlert)      expiryAlert.style.display      = 'none';
        }
    }

    function resetModal() {
        ['url-lists-container', 'create-form-container', 'update-form-container', 'domain-lookup-container', 'custom-category-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.display = 'none'; el.innerHTML = ''; }
        });
        UI.hideStatus();
    }

    /* ==========================================================
     *  API FUNCTIONS
     * ==========================================================*/

    async function makeApiRequest(method, endpoint, data, onSuccess, onError) {
        const tenant = getActiveTenant();

        if (!tenant)                        return UI.showStatus('⚠️ No tenant detected. Please select a Member Firm in ServiceNow.', 'warning');
        if (!Storage.hasToken(tenant))      return UI.showStatus('⚠️ Please save your API token first', 'warning');
        if (Storage.isTokenExpired(tenant)) return UI.showStatus('⚠️ API token has expired. Please update your token.', 'warning');

        let token;
        try {
            token = await Storage.getToken(tenant);
        } catch (error) {
            if (error.message === 'NO_PASSPHRASE')    { UI.showStatus('⚠️ Passphrase required. Please reopen the tool.', 'warning'); return; }
            if (error.message === 'INVALID_PASSPHRASE') { UI.showStatus('❌ Invalid passphrase. Please close and reopen the tool.', 'error'); SessionManager.clear(); return; }
            UI.showStatus('❌ Failed to retrieve token', 'error');
            return;
        }

        GM_xmlhttpRequest({
            method,
            url: `https://${tenant}${endpoint}`,
            headers: { 'Netskope-Api-Token': token, 'Content-Type': 'application/json' },
            data: data ? JSON.stringify(data) : undefined,
            onload: (response) => {
                if (response.status >= 200 && response.status < 300) {
                    try { onSuccess(JSON.parse(response.responseText)); } catch (e) { onSuccess(null); }
                } else {
                    let errorMsg = `Error ${response.status}`;
                    try { const d = JSON.parse(response.responseText); errorMsg = d.message || d.error || errorMsg; } catch (e) { errorMsg = response.responseText || errorMsg; }
                    if (onError) onError(errorMsg);
                }
            },
            onerror: () => { if (onError) onError('Network error'); }
        });
    }

    async function fetchUrlLists() {
        resetModal();
        UI.showStatus('🔄 Fetching URL lists from Netskope...', 'info');
        await makeApiRequest('GET', '/api/v2/policy/urllist', null,
            (data) => {
                currentUrlLists = Array.isArray(data) ? data : [];
                currentUrlLists.length === 0
                    ? UI.showStatus('ℹ️ No URL lists found in this tenant', 'info')
                    : (UI.showStatus(`✅ Found ${currentUrlLists.length} URL lists`, 'success'), displayUrlLists(currentUrlLists));
            },
            (error) => UI.showStatus(`❌ Failed: ${error}`, 'error')
        );
    }

    function displayUrlLists(lists) {
        const container = document.getElementById('url-lists-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display       = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex          = '1';
        container.style.minHeight     = '0';

        container.innerHTML = `
            <h3 style="font-size: 14px; font-weight: bold; color: #333; margin: 15px 0 10px 0;">Available URL Lists</h3>
            <div style="margin-bottom: 8px;">
                <input id="urllist-search" type="text" placeholder="🔍 Filter lists by name..."
                    style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box; color: #333;">
            </div>
            <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: stretch;">
                <input id="urllist-domain-search" type="text" placeholder="🔎 Search URL or domain across all lists…"
                    style="flex: 1; padding: 8px 12px; border: 2px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box; font-family: monospace; color: #333; background-color: #fff; transition: border-color 0.2s;">
                <button id="urllist-domain-search-btn" style="padding: 8px 14px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; white-space: nowrap; flex-shrink: 0;">🔎 Search</button>
            </div>
            <div id="urllist-wrapper" style="flex: 1; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; min-height: 200px;"></div>
        `;

        const wrapper          = document.getElementById('urllist-wrapper');
        const search           = document.getElementById('urllist-search');
        const domainSearch     = document.getElementById('urllist-domain-search');
        const domainSearchBtn  = document.getElementById('urllist-domain-search-btn');

        function renderLists(filteredLists) {
            wrapper.innerHTML = filteredLists.length === 0
                ? '<div style="text-align: center; padding: 20px; color: #999; font-size: 13px;">No lists found</div>'
                : filteredLists.map(list => {
                    const urlCount = list.data?.urls?.length || 0;
                    return `
                        <div class="url-list-item" data-list-id="${list.id}" style="padding: 10px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 6px; background-color: #fff; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-weight: bold; font-size: 14px; color: #333; margin-bottom: 5px;">${list.name || 'Unnamed List'}</div>
                            <div style="font-size: 12px; color: #666;">ID: ${list.id} • ${urlCount} URLs</div>
                        </div>`;
                }).join('');

            wrapper.querySelectorAll('.url-list-item').forEach(item => {
                item.onmouseover = () => { item.style.backgroundColor = '#f0f0f0'; item.style.borderColor = '#667eea'; };
                item.onmouseout  = () => { item.style.backgroundColor = '#fff';    item.style.borderColor = '#ccc'; };
                item.onclick     = () => { const list = lists.find(l => l.id == item.dataset.listId); if (list) showUpdateForm(list); };
            });
        }

        function runDomainSearch() {
            const raw = domainSearch.value.trim();
            if (!raw) {
                const nameTerm = search.value.toLowerCase().trim();
                renderLists(lists.filter(l => (l.name || '').toLowerCase().includes(nameTerm)));
                return;
            }
            const query = raw.toLowerCase()
                .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
            const matches = [];
            for (const list of lists) {
                const urls = list.data?.urls || [];
                const matchedEntries = urls.filter(e => domainMatches(query, e.toLowerCase().trim()));
                if (matchedEntries.length > 0) matches.push({ list, matchedEntries, totalUrls: urls.length });
            }
            renderLookupResults(wrapper, query, matches);
        }

        renderLists(lists);

        search.oninput = (e) => {
            if (domainSearch.value.trim()) return;
            const term = e.target.value.toLowerCase().trim();
            renderLists(lists.filter(l => (l.name || '').toLowerCase().includes(term)));
        };

        domainSearch.onfocus = () => { domainSearch.style.borderColor = '#f5576c'; };
        domainSearch.onblur  = () => { domainSearch.style.borderColor = domainSearch.value.trim() ? '#f5576c' : '#ccc'; };
        domainSearch.oninput = (e) => {
            if (!e.target.value.trim()) {
                domainSearch.style.borderColor = '#ccc';
                const nameTerm = search.value.toLowerCase().trim();
                renderLists(lists.filter(l => (l.name || '').toLowerCase().includes(nameTerm)));
            }
        };
        domainSearch.onkeydown = (e) => { if (e.key === 'Enter') runDomainSearch(); };
        domainSearchBtn.onclick = runDomainSearch;
    }

    function showCreateForm() {
        resetModal();
        const container = document.getElementById('create-form-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display       = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex          = '1';
        container.style.minHeight     = '0';
        container.innerHTML = `
            <h3 style="font-size: 14px; font-weight: bold; color: #333; margin: 15px 0 10px 0;">Create New URL List</h3>
            <div style="font-size: 11px; color: #666; margin-bottom: 10px; font-style: italic;">Note: List names can only contain letters, numbers, spaces, underscores (_), and hyphens (-)</div>
        `;

        container.appendChild(UI.createInput('create-list-name', 'text', 'List Name', 'e.g., Marketing_Domains or Sales-Team-2024', ''));
        const textarea = UI.createTextArea('create-urls-input', 'Enter URLs (one per line)', 'example.com\ntest.example.com\n*.domain.com', 10);
        textarea.style.flex = '1';
        container.appendChild(textarea);
        const createTextareaEl = textarea.querySelector('textarea');
        if (createTextareaEl) container.appendChild(createUrlListLogButtons(createTextareaEl));

        const btnContainer = UI.createElement('div', { display: 'flex', gap: '10px', marginTop: '15px' });
        btnContainer.appendChild(UI.createButton('✨ Create List', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', submitCreateList));
        btnContainer.appendChild(UI.createButton('✖️ Cancel', 'white', resetModal));
        btnContainer.lastChild.style.border = '1px solid #ccc';
        btnContainer.lastChild.style.color  = '#333';
        container.appendChild(btnContainer);
    }

    function showUpdateForm(list) {
        resetModal();
        const container = document.getElementById('update-form-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display       = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex          = '1';
        container.style.minHeight     = '0';
        container.innerHTML = `
            <h3 style="font-size: 14px; font-weight: bold; color: #333; margin: 15px 0 10px 0;">Update: ${list.name}</h3>
            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">List ID: ${list.id}</div>
        `;

        const textarea   = UI.createTextArea('update-urls-input', 'URLs (one per line)', 'example.com\ntest.example.com', 10);
        textarea.style.flex = '1';
        const textareaEl = textarea.querySelector('textarea');
        if (textareaEl) textareaEl.value = (list.data?.urls || []).join('\n');
        container.appendChild(textarea);
        if (textareaEl) container.appendChild(createUrlListLogButtons(textareaEl));

        const btnContainer = UI.createElement('div', { display: 'flex', gap: '10px', marginTop: '15px' });
        btnContainer.appendChild(UI.createButton('🔄 Update List', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', () => submitUpdateList(list.id, list.name)));
        btnContainer.appendChild(UI.createButton('✖️ Cancel', 'white', () => { resetModal(); displayUrlLists(currentUrlLists); }));
        btnContainer.lastChild.style.border = '1px solid #ccc';
        btnContainer.lastChild.style.color  = '#333';
        container.appendChild(btnContainer);
    }

    async function submitCreateList() {
        const listName  = document.getElementById('create-list-name')?.value.trim();
        const urlsInput = document.getElementById('create-urls-input')?.value.trim();

        if (!listName)   return UI.showStatus('⚠️ Please enter a list name', 'warning');
        if (/[<>\/!@#$%^&*(){};\+=,?\.|:'"]/.test(listName)) return UI.showStatus('⚠️ List name contains invalid characters.', 'warning');
        if (!urlsInput)  return UI.showStatus('⚠️ Please enter at least one URL', 'warning');

        const urls = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);
        if (!urls.length) return UI.showStatus('⚠️ No valid URLs found', 'warning');

        UI.showStatus('🔄 Creating URL list...', 'info');
        await makeApiRequest('POST', '/api/v2/policy/urllist', { data: { type: 'exact', urls }, name: listName },
            () => { const t = getActiveTenant(); UI.showStatus(`✅ URL list "${listName}" created successfully! Opening URL List page...`, 'success'); GM_openInTab(`https://${t}/ns#/url-list`, { active: false, insert: true }); setTimeout(UI.hideStatus, 8000); },
            (error) => UI.showStatus(`❌ Failed: ${error}`, 'error')
        );
    }

    async function submitUpdateList(listId, listName) {
        const urlsInput = document.getElementById('update-urls-input')?.value.trim();
        if (!urlsInput) return UI.showStatus('⚠️ Please enter at least one URL', 'warning');

        const urls = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);
        if (!urls.length) return UI.showStatus('⚠️ No valid URLs found', 'warning');

        UI.showStatus('🔄 Updating URL list...', 'info');
        await makeApiRequest('PATCH', `/api/v2/policy/urllist/${listId}/replace`, { data: { type: 'exact', urls } },
            () => { const t = getActiveTenant(); UI.showStatus(`✅ URL list "${listName}" updated successfully! Opening URL List page...`, 'success'); GM_openInTab(`https://${t}/ns#/url-list`, { active: false, insert: true }); setTimeout(UI.hideStatus, 8000); },
            (error) => UI.showStatus(`❌ Failed: ${error}`, 'error')
        );
    }

    /* ==========================================================
     *  DOMAIN LOOKUP
     * ==========================================================*/

    function showDomainLookup() {
        resetModal();
        const container = document.getElementById('domain-lookup-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display       = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex          = '1';
        container.style.minHeight     = '0';

        // Header
        const header = UI.createElement('h3', { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '15px 0 5px 0' });
        header.textContent = '🔎 Domain Lookup';
        container.appendChild(header);

        // Description
        const desc = UI.createElement('div', {
            fontSize: '12px', color: '#666', marginBottom: '12px', lineHeight: '1.5'
        });
        desc.innerHTML = 'Search for a domain or URL across all URL lists in this tenant.<br>' +
            '<span style="color: #888; font-size: 11px;">Supports exact match, substring match, and wildcard entries (e.g. <code>*.example.com</code>).</span>';
        container.appendChild(desc);

        // Search row
        const searchRow = UI.createElement('div', { display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'stretch' });

        const searchInput = UI.createElement('input', {
            flex: '1', padding: '10px 12px', border: '2px solid #ccc', borderRadius: '6px',
            fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace',
            outline: 'none', transition: 'border-color 0.2s'
        }, { id: 'domain-lookup-input', type: 'text', placeholder: 'e.g. example.com or sub.example.com' });

        searchInput.onfocus = () => searchInput.style.borderColor = '#667eea';
        searchInput.onblur  = () => searchInput.style.borderColor = '#ccc';

        const searchBtn = UI.createButton('🔎 Search', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', executeDomainLookup);
        searchBtn.style.flex = '0 0 120px';

        searchRow.appendChild(searchInput);
        searchRow.appendChild(searchBtn);
        container.appendChild(searchRow);

        // Results area
        const resultsArea = UI.createElement('div', {
            flex: '1', overflowY: 'auto', minHeight: '150px'
        }, { id: 'domain-lookup-results' });
        container.appendChild(resultsArea);

        // Cancel button
        const cancelRow = UI.createElement('div', { display: 'flex', gap: '10px', marginTop: '10px' });
        const cancelBtn = UI.createButton('✖️ Cancel', 'white', resetModal);
        cancelBtn.style.border = '1px solid #ccc';
        cancelBtn.style.color  = '#333';
        cancelRow.appendChild(cancelBtn);
        container.appendChild(cancelRow);

        // Enter key support
        searchInput.onkeydown = (e) => { if (e.key === 'Enter') executeDomainLookup(); };
        setTimeout(() => searchInput.focus(), 100);
    }

    async function executeDomainLookup() {
        const input = document.getElementById('domain-lookup-input');
        const resultsArea = document.getElementById('domain-lookup-results');
        if (!input || !resultsArea) return;

        const query = input.value.trim().toLowerCase()
            .replace(/^https?:\/\//, '')   // strip protocol
            .replace(/\/.*$/, '')          // strip path
            .replace(/:\d+$/, '');         // strip port

        if (!query) return UI.showStatus('⚠️ Please enter a domain or URL to search', 'warning');

        // If we don't have cached lists, fetch them first
        if (!currentUrlLists.length) {
            UI.showStatus('🔄 Fetching URL lists before searching...', 'info');
            resultsArea.innerHTML = '<div style="text-align: center; padding: 30px; color: #888; font-size: 13px;">⏳ Fetching URL lists from Netskope...</div>';

            await new Promise((resolve, reject) => {
                makeApiRequest('GET', '/api/v2/policy/urllist', null,
                    (data) => {
                        currentUrlLists = Array.isArray(data) ? data : [];
                        resolve();
                    },
                    (error) => {
                        UI.showStatus(`❌ Failed to fetch URL lists: ${error}`, 'error');
                        reject(error);
                    }
                );
            }).catch(() => {
                resultsArea.innerHTML = '<div style="text-align: center; padding: 30px; color: #dc3545; font-size: 13px;">Failed to fetch URL lists. Please check your API configuration.</div>';
                return;
            });
        }

        if (!currentUrlLists.length) {
            resultsArea.innerHTML = '<div style="text-align: center; padding: 30px; color: #999; font-size: 13px;">No URL lists found in this tenant.</div>';
            UI.hideStatus();
            return;
        }

        // Perform the search
        const matches = [];

        for (const list of currentUrlLists) {
            const urls = list.data?.urls || [];
            const matchedEntries = [];

            for (const entry of urls) {
                const entryLower = entry.toLowerCase().trim();
                if (domainMatches(query, entryLower)) {
                    matchedEntries.push(entry);
                }
            }

            if (matchedEntries.length > 0) {
                matches.push({
                    list,
                    matchedEntries,
                    totalUrls: urls.length
                });
            }
        }

        // Render results
        renderLookupResults(resultsArea, query, matches);
    }

    /**
     * Check whether a search query matches a URL list entry.
     *
     * Matching logic:
     *   1. Exact match  — entry is identical to the query
     *   2. Substring    — entry appears inside query or query inside entry
     *   3. Wildcard     — entry starts with *. and the query ends with the
     *                     wildcard's base domain (or is exactly that domain)
     *   4. Reverse wild — query itself contains a wildcard pattern that
     *                     the entry satisfies
     */
    function domainMatches(query, entry) {
        // 1. Exact match
        if (query === entry) return true;

        // 2. Substring match (either direction)
        if (entry.includes(query) || query.includes(entry)) return true;

        // 3. Wildcard entry (e.g. *.example.com matches sub.example.com and example.com)
        if (entry.startsWith('*.')) {
            const wildBase = entry.slice(2); // "example.com"
            if (query === wildBase || query.endsWith('.' + wildBase)) return true;
        }

        // 4. Query is a wildcard (user typed *.example.com)
        if (query.startsWith('*.')) {
            const queryBase = query.slice(2);
            if (entry === queryBase || entry.endsWith('.' + queryBase)) return true;
            // Also match if the entry itself is a wildcard for the same base
            if (entry.startsWith('*.') && entry.slice(2) === queryBase) return true;
        }

        return false;
    }

    function renderLookupResults(resultsArea, query, matches) {
        resultsArea.innerHTML = '';

        // Summary bar
        const summary = UI.createElement('div', {
            padding: '10px 14px', borderRadius: '6px', marginBottom: '12px',
            fontSize: '13px', fontWeight: 'bold',
            backgroundColor: matches.length > 0 ? '#d4edda' : '#f8d7da',
            border: '1px solid ' + (matches.length > 0 ? '#c3e6cb' : '#f5c6cb'),
            color: matches.length > 0 ? '#155724' : '#721c24'
        });

        if (matches.length > 0) {
            const totalMatched = matches.reduce((sum, m) => sum + m.matchedEntries.length, 0);
            summary.textContent = `✅ Found "${query}" in ${matches.length} URL list${matches.length !== 1 ? 's' : ''} (${totalMatched} matching entr${totalMatched !== 1 ? 'ies' : 'y'})`;
        } else {
            summary.textContent = `❌ "${query}" was not found in any of the ${currentUrlLists.length} URL lists`;
        }
        resultsArea.appendChild(summary);
        UI.hideStatus();

        if (matches.length === 0) {
            const hint = UI.createElement('div', {
                padding: '12px', fontSize: '12px', color: '#666',
                backgroundColor: '#f8f9fa', borderRadius: '6px',
                lineHeight: '1.5', marginTop: '8px'
            });
            hint.innerHTML = '💡 <strong>Tips:</strong> Try searching with just the root domain (e.g. <code>example.com</code>), ' +
                'or use a wildcard pattern (e.g. <code>*.example.com</code>). ' +
                'Make sure the URL lists have been fetched recently — click <strong>🔎 Search</strong> again to re-fetch.';
            resultsArea.appendChild(hint);
            return;
        }

        // Sort: most matched entries first
        matches.sort((a, b) => b.matchedEntries.length - a.matchedEntries.length);

        for (const { list, matchedEntries, totalUrls } of matches) {
            const card = UI.createElement('div', {
                padding: '12px', marginBottom: '10px',
                border: '1px solid #ccc', borderRadius: '8px',
                backgroundColor: '#fff', transition: 'all 0.2s ease'
            });

            // Card header (clickable → go to update form)
            const cardHeader = UI.createElement('div', {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', marginBottom: '8px'
            });

            const listInfo = UI.createElement('div');
            listInfo.innerHTML = `
                <div style="font-weight: bold; font-size: 14px; color: #333;">${list.name || 'Unnamed List'}</div>
                <div style="font-size: 11px; color: #888; margin-top: 2px;">ID: ${list.id} • ${totalUrls} total URLs • ${matchedEntries.length} match${matchedEntries.length !== 1 ? 'es' : ''}</div>
            `;

            const editBtn = UI.createElement('button', {
                padding: '5px 12px', fontSize: '11px', fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0'
            }, { textContent: '✏️ Edit List' });

            editBtn.onclick = (e) => {
                e.stopPropagation();
                showUpdateForm(list);
            };

            cardHeader.appendChild(listInfo);
            cardHeader.appendChild(editBtn);
            card.appendChild(cardHeader);

            // Matched entries (collapsible)
            const matchedSection = UI.createElement('div');

            const toggleBtn = UI.createElement('div', {
                fontSize: '12px', color: '#667eea', cursor: 'pointer',
                fontWeight: 'bold', marginBottom: '6px', userSelect: 'none'
            });
            toggleBtn.textContent = `▶ Show matched entries (${matchedEntries.length})`;

            const matchedList = UI.createElement('div', {
                display: 'none', padding: '8px',
                backgroundColor: '#f8f9fa', borderRadius: '6px',
                maxHeight: '200px', overflowY: 'auto',
                fontFamily: 'monospace', fontSize: '12px',
                lineHeight: '1.6', border: '1px solid #e9ecef'
            });

            for (const entry of matchedEntries) {
                const entryDiv = UI.createElement('div', { padding: '2px 6px' });
                // Highlight the matching portion
                const entryLower = entry.toLowerCase();
                const queryLower = query.toLowerCase();
                const idx = entryLower.indexOf(queryLower);

                if (idx !== -1) {
                    const before  = entry.substring(0, idx);
                    const matched = entry.substring(idx, idx + query.length);
                    const after   = entry.substring(idx + query.length);
                    entryDiv.innerHTML = `${escapeHtml(before)}<span style="background-color: #fff3cd; font-weight: bold; border-radius: 2px; padding: 0 1px;">${escapeHtml(matched)}</span>${escapeHtml(after)}`;
                } else {
                    entryDiv.innerHTML = `<span style="background-color: #e8f4f8;">${escapeHtml(entry)}</span>`;
                }
                matchedList.appendChild(entryDiv);
            }

            let expanded = false;
            toggleBtn.onclick = () => {
                expanded = !expanded;
                matchedList.style.display = expanded ? 'block' : 'none';
                toggleBtn.textContent = expanded
                    ? `▼ Hide matched entries (${matchedEntries.length})`
                    : `▶ Show matched entries (${matchedEntries.length})`;
            };

            matchedSection.appendChild(toggleBtn);
            matchedSection.appendChild(matchedList);
            card.appendChild(matchedSection);

            // Hover effects on the whole card
            card.onmouseover = () => { card.style.borderColor = '#667eea'; card.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.15)'; };
            card.onmouseout  = () => { card.style.borderColor = '#ccc'; card.style.boxShadow = 'none'; };

            resultsArea.appendChild(card);
        }
    }

    /** Escape HTML characters to prevent XSS in rendered results */
    function escapeHtml(str) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    /* ==========================================================
     *  CUSTOM CATEGORY LOOKUP
     * ==========================================================*/

    function showCustomCategoryLookup() {
        resetModal();
        const container = document.getElementById('custom-category-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display       = 'flex';
        container.style.flexDirection = 'column';
        container.style.flex          = '1';
        container.style.minHeight     = '0';

        const header = UI.createElement('h3', { fontSize: '14px', fontWeight: 'bold', color: '#333', margin: '15px 0 5px 0' });
        header.textContent = '🏷️ Custom Category Lookup';
        container.appendChild(header);

        const desc = UI.createElement('div', { fontSize: '12px', color: '#666', marginBottom: '12px', lineHeight: '1.5' });
        desc.textContent = 'Look up a Custom Category by its numeric ID to see its name, status, URL list assignments, and audit info.';
        container.appendChild(desc);

        const inputRow = UI.createElement('div', { display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'stretch' });

        const idInput = UI.createElement('input', {
            flex: '1', padding: '10px 12px', border: '2px solid #ccc', borderRadius: '6px',
            fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace',
            outline: 'none', transition: 'border-color 0.2s'
        }, { id: 'custom-category-id-input', type: 'text', placeholder: 'e.g. 10042' });

        idInput.onfocus = () => { idInput.style.borderColor = '#f7971e'; };
        idInput.onblur  = () => { idInput.style.borderColor = '#ccc'; };

        const lookupBtn = UI.createButton('🔍 Lookup', 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', executeCustomCategoryLookup);
        Object.assign(lookupBtn.style, { flex: '0 0 120px', color: '#333' });

        inputRow.appendChild(idInput);
        inputRow.appendChild(lookupBtn);
        container.appendChild(inputRow);

        const resultsArea = UI.createElement('div', { flex: '1', overflowY: 'auto', minHeight: '150px' }, { id: 'custom-category-results' });
        container.appendChild(resultsArea);

        const cancelRow = UI.createElement('div', { display: 'flex', gap: '10px', marginTop: '10px' });
        const cancelBtn = UI.createButton('✖️ Cancel', 'white', resetModal);
        cancelBtn.style.border = '1px solid #ccc';
        cancelBtn.style.color  = '#333';
        cancelRow.appendChild(cancelBtn);
        container.appendChild(cancelRow);

        idInput.onkeydown = (e) => { if (e.key === 'Enter') executeCustomCategoryLookup(); };
        setTimeout(() => idInput.focus(), 100);
    }

    async function executeCustomCategoryLookup() {
        const input      = document.getElementById('custom-category-id-input');
        const resultsArea = document.getElementById('custom-category-results');
        if (!input || !resultsArea) return;

        const id = input.value.trim();
        if (!id) return UI.showStatus('⚠️ Please enter a category ID', 'warning');
        if (!/^\d+$/.test(id)) return UI.showStatus('⚠️ Category ID must be a numeric value', 'warning');

        UI.showStatus('🔄 Looking up custom category...', 'info');
        resultsArea.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:13px;">⏳ Fetching category data...</div>';

        await makeApiRequest('GET', `/api/v2/profiles/customcategories/${id}?details=true`, null,
            (data) => {
                UI.hideStatus();
                renderCustomCategoryResult(resultsArea, data);
            },
            (error) => {
                UI.showStatus(`❌ Failed: ${error}`, 'error');
                resultsArea.innerHTML = `<div style="text-align:center;padding:30px;color:#dc3545;font-size:13px;">Could not retrieve category. ${escapeHtml(String(error))}</div>`;
            }
        );
    }

    function renderCustomCategoryResult(resultsArea, data) {
        resultsArea.innerHTML = '';

        const STATUS_BADGE = {
            'applied': { bg: '#d4edda', border: '#c3e6cb', color: '#155724' },
            'pending': { bg: '#fff3cd', border: '#ffeaa7', color: '#856404' },
            'error':   { bg: '#f8d7da', border: '#f5c6cb', color: '#721c24' }
        };
        const badge = STATUS_BADGE[(data.status || '').toLowerCase()] || { bg: '#e9ecef', border: '#dee2e6', color: '#495057' };

        const formatDate = (iso) => {
            if (!iso) return '—';
            try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
        };

        const card = UI.createElement('div', {
            padding: '16px', border: '1px solid #ccc', borderRadius: '8px',
            backgroundColor: '#fff', fontSize: '13px', fontFamily: 'Arial, sans-serif'
        });

        // Name + status
        const titleRow = UI.createElement('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' });
        const nameEl = UI.createElement('div', { fontWeight: 'bold', fontSize: '16px', color: '#333' });
        nameEl.textContent = data.name || '(unnamed)';
        const statusBadge = UI.createElement('span', {
            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
            backgroundColor: badge.bg, border: `1px solid ${badge.border}`, color: badge.color
        });
        statusBadge.textContent = data.status || 'unknown';
        titleRow.appendChild(nameEl);
        titleRow.appendChild(statusBadge);
        card.appendChild(titleRow);

        // ID
        const idRow = UI.createElement('div', { fontSize: '12px', color: '#888', marginBottom: '14px' });
        idRow.textContent = `ID: ${data.id}`;
        card.appendChild(idRow);

        // Description
        if (data.description) {
            const descRow = UI.createElement('div', { marginBottom: '12px', color: '#555', fontSize: '13px' });
            descRow.innerHTML = `<strong>Description:</strong> ${escapeHtml(data.description)}`;
            card.appendChild(descRow);
        }

        // Helper: labelled pill list
        const renderPillField = (label, items) => {
            const wrap = UI.createElement('div', { marginBottom: '10px' });
            const lbl = UI.createElement('div', { fontWeight: 'bold', color: '#555', marginBottom: '5px', fontSize: '12px' });
            lbl.textContent = label;
            wrap.appendChild(lbl);
            if (!items || items.length === 0) {
                const none = UI.createElement('span', { color: '#aaa', fontStyle: 'italic', fontSize: '12px' });
                none.textContent = '(none)';
                wrap.appendChild(none);
            } else {
                const pillRow = UI.createElement('div', { display: 'flex', flexWrap: 'wrap', gap: '6px' });
                items.forEach(item => {
                    const pill = UI.createElement('span', {
                        padding: '3px 10px', backgroundColor: '#e8f4f8', border: '1px solid #bee5eb',
                        borderRadius: '12px', fontSize: '12px', color: '#0c5460', fontFamily: 'monospace'
                    });
                    pill.textContent = item;
                    pillRow.appendChild(pill);
                });
                wrap.appendChild(pillRow);
            }
            return wrap;
        };

        card.appendChild(renderPillField('Included URL Lists:', data.included_url_lists));
        card.appendChild(renderPillField('Excluded URL Lists:', data.excluded_url_lists));
        card.appendChild(renderPillField('Included Predefined Categories:', data.included_predefined_categories));

        card.appendChild(UI.createElement('hr', { border: 'none', borderTop: '1px solid #eee', margin: '10px 0' }));

        // Audit grid
        const grid = UI.createElement('div', {
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            fontSize: '12px', color: '#666'
        });
        const mkCell = (label, value) => {
            const cell = UI.createElement('div');
            cell.innerHTML = `<span style="font-weight:bold;">${escapeHtml(label)}</span><br>${escapeHtml(value || '—')}`;
            return cell;
        };
        grid.appendChild(mkCell('Created by:', data.create_by));
        grid.appendChild(mkCell('Created:', formatDate(data.create_time)));
        grid.appendChild(mkCell('Modified by:', data.modify_by));
        grid.appendChild(mkCell('Modified:', formatDate(data.modify_time)));
        card.appendChild(grid);

        resultsArea.appendChild(card);
    }

    /* ==========================================================
     *  LOG BUTTON HELPERS
     * ==========================================================*/

    function getTodayDate() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getTicketContext() {
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        if (macro && macro.shadowRoot) {
            const iframe = macro.shadowRoot.querySelector('#gsft_main');
            if (iframe && iframe.contentWindow && iframe.contentWindow.g_form) {
                return { win: iframe.contentWindow, doc: iframe.contentDocument, gForm: iframe.contentWindow.g_form, mode: 'polaris' };
            }
        }
        if (window.g_form) {
            return { win: window, doc: document, gForm: window.g_form, mode: 'classic' };
        }
        return null;
    }

    function getTicketNumber() {
        const ctx = getTicketContext();
        if (ctx && ctx.gForm) {
            const num = ctx.gForm.getValue('number');
            if (num) return num.trim();
        }
        const doc = (ctx && ctx.doc) || document;
        for (const id of ['sc_req_item.number', 'incident.number']) {
            const n = doc.getElementById(id);
            if (n?.value?.trim()) return n.value.trim();
        }
        const m = window.location.search.match(/[?&]sys_id=([^&]+)/);
        return m ? `SYS_${m[1].slice(0, 8)}` : null;
    }

    function insertAtCursor(textarea, text) {
        const start  = textarea.selectionStart;
        const end    = textarea.selectionEnd;
        const value  = textarea.value;
        const before = value.slice(0, start);
        const after  = value.slice(end);
        textarea.value = before + text + after;
        const newPos = before.length + text.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }

    function parseUrlListLog(text) {
        if (!text) return [];
        const lines = text.split('\n');
        const groups = [];
        let current = null;
        const orphanDomains = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (/^#\w/.test(trimmed)) {
                if (orphanDomains.length > 0) {
                    groups.push({ ritm: '', date: '', name: '', isDeleted: false, domains: [...orphanDomains], raw: '', isOrphan: true });
                    orphanDomains.length = 0;
                }
                const parts = trimmed.slice(1).split('|').map(p => p.trim());
                current = {
                    ritm:      '#' + parts[0],
                    date:      parts[1] || '',
                    name:      parts[2] || '',
                    isDeleted: parts.length >= 4 && parts[3].toLowerCase() === 'deleted',
                    domains:   [],
                    raw:       line,
                };
                groups.push(current);
            } else if (trimmed) {
                const isCommented = /^#/.test(trimmed);
                const domain = isCommented ? trimmed.slice(1).trim() : trimmed;
                const entry = { raw: line, domain, isCommented };
                if (current) current.domains.push(entry);
                else orphanDomains.push(entry);
            }
        }

        if (orphanDomains.length > 0) {
            groups.push({ ritm: '', date: '', name: '', isDeleted: false, domains: orphanDomains, raw: '', isOrphan: true });
        }
        return groups;
    }

    function showUrlLogEntryModal(textarea) {
        if (document.getElementById('urllist-log-add-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'urllist-log-add-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.55)', zIndex: '1100000',
        });

        const modal = document.createElement('div');
        modal.id = 'urllist-log-add-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1100001', background: '#ffffff', border: '2px solid #0073e6',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '440px', width: '90vw',
            boxSizing: 'border-box', color: '#333',
        });

        const mkLbl = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' });
            return el;
        };
        const mkInp = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text'; el.placeholder = placeholder || ''; el.value = value || ''; el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff', color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const titleEl = document.createElement('div');
        titleEl.textContent = '📜 Add URL List Log Entry';
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#0073e6', marginBottom: '16px' });

        const ritmLbl = mkLbl('RITM Number');
        const ritmInp = mkInp('e.g. RITM1234567', getTicketNumber() || '');
        const dateLbl = mkLbl('Date (auto-filled)');
        const dateInp = mkInp('', getTodayDate(), true);
        const userLbl = mkLbl('Your Name');
        const userInp = mkInp('Your name', GM_getValue('netskopeUrlList_username', ''));

        const tipEl = document.createElement('div');
        Object.assign(tipEl.style, {
            background: '#e8f4fd', border: '1px solid #90caf9', borderRadius: '6px',
            padding: '8px 12px', marginBottom: '16px', fontSize: '12px', color: '#1a4f7a',
        });
        tipEl.textContent = 'The log header (#RITM | Date | Name) will be inserted at the current cursor position. Type your domains below it.';

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Insert Log Header';
        Object.assign(addBtn.style, {
            flex: '1', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#005bb5'; });
        addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#0073e6'; });
        addBtn.onclick = () => {
            const ritm = ritmInp.value.trim();
            const date = dateInp.value.trim();
            const user = userInp.value.trim();
            if (!ritm) { ritmInp.style.borderColor = '#e53935'; ritmInp.focus(); return; }
            if (user && user !== GM_getValue('netskopeUrlList_username', '')) GM_setValue('netskopeUrlList_username', user);
            const ritmClean = ritm.startsWith('#') ? ritm : '#' + ritm;
            const logLine = `${ritmClean} | ${date} | ${user || 'Unknown'}`;
            insertAtCursor(textarea, logLine);
            overlay.remove(); modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(addBtn);

        modal.appendChild(titleEl);
        modal.appendChild(ritmLbl); modal.appendChild(ritmInp);
        modal.appendChild(dateLbl); modal.appendChild(dateInp);
        modal.appendChild(userLbl); modal.appendChild(userInp);
        modal.appendChild(tipEl);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInp.focus(), 50);
    }

    function showUrlDeleteSelectionModal(textarea) {
        const start    = textarea.selectionStart;
        const end      = textarea.selectionEnd;
        const selected = textarea.value.slice(start, end).trim();

        if (!selected) {
            const msg = document.createElement('div');
            msg.textContent = 'Select the domains you want to mark as deleted first.';
            Object.assign(msg.style, {
                position: 'fixed', bottom: '20px', right: '20px',
                background: '#e65100', color: '#fff', padding: '10px 16px',
                borderRadius: '6px', zIndex: '1100002', fontSize: '13px',
                fontFamily: 'Arial, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            });
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2500);
            return;
        }

        if (document.getElementById('urllist-del-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'urllist-del-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.55)', zIndex: '1100000',
        });

        const modal = document.createElement('div');
        modal.id = 'urllist-del-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1100001', background: '#ffffff', border: '2px solid #e53935',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '480px', width: '90vw',
            boxSizing: 'border-box', color: '#333',
        });

        const mkLbl = (text) => {
            const el = document.createElement('label');
            el.textContent = text;
            Object.assign(el.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' });
            return el;
        };
        const mkInp = (placeholder, value, readOnly) => {
            const el = document.createElement('input');
            el.type = 'text'; el.placeholder = placeholder || ''; el.value = value || ''; el.readOnly = !!readOnly;
            Object.assign(el.style, {
                width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', marginBottom: '12px',
                background: readOnly ? '#f5f5f5' : '#fff', color: readOnly ? '#666' : '#333',
            });
            return el;
        };

        const titleEl = document.createElement('div');
        titleEl.textContent = '🗑 Mark Selected Domains as Deleted';
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#e53935', marginBottom: '8px' });

        const preview = document.createElement('div');
        Object.assign(preview.style, {
            background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '6px',
            padding: '8px 12px', marginBottom: '8px', fontSize: '11px', color: '#555',
            fontFamily: 'monospace', maxHeight: '80px', overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        });
        preview.textContent = selected.length > 300 ? selected.slice(0, 300) + '…' : selected;

        const domainCount = selected.split('\n').filter(l => l.trim()).length;
        const countLine = document.createElement('div');
        countLine.textContent = `${domainCount} line${domainCount !== 1 ? 's' : ''} selected — they will be commented out and marked as deleted.`;
        Object.assign(countLine.style, { fontSize: '12px', color: '#666', marginBottom: '14px' });

        const ritmLbl = mkLbl('RITM Number');
        const ritmInp = mkInp('e.g. RITM1234567', getTicketNumber() || '');
        const dateLbl = mkLbl('Date (auto-filled)');
        const dateInp = mkInp('', getTodayDate(), true);
        const userLbl = mkLbl('Your Name');
        const userInp = mkInp('Your name', GM_getValue('netskopeUrlList_username', ''));

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '4px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Mark as Deleted';
        Object.assign(confirmBtn.style, {
            flex: '1', padding: '10px', background: '#e53935', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.background = '#c62828'; });
        confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.background = '#e53935'; });
        confirmBtn.onclick = () => {
            const ritm = ritmInp.value.trim();
            const date = dateInp.value.trim();
            const user = userInp.value.trim();
            if (!ritm) { ritmInp.style.borderColor = '#e53935'; ritmInp.focus(); return; }
            if (user && user !== GM_getValue('netskopeUrlList_username', '')) GM_setValue('netskopeUrlList_username', user);

            const ritmClean = ritm.startsWith('#') ? ritm : '#' + ritm;
            const logLine   = `${ritmClean} | ${date} | ${user || 'Unknown'} | Deleted`;

            const selLines  = textarea.value.slice(start, end).split('\n');
            const commented = selLines.map(l => {
                const t = l.trim();
                if (!t || /^#/.test(t)) return l;
                return '# ' + l;
            }).join('\n');

            const before = textarea.value.slice(0, start);
            const after  = textarea.value.slice(end);
            const prefix = (before && !before.endsWith('\n')) ? '\n' : '';
            textarea.value = before + prefix + logLine + '\n' + commented + after;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            overlay.remove(); modal.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(titleEl);
        modal.appendChild(preview);
        modal.appendChild(countLine);
        modal.appendChild(ritmLbl); modal.appendChild(ritmInp);
        modal.appendChild(dateLbl); modal.appendChild(dateInp);
        modal.appendChild(userLbl); modal.appendChild(userInp);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => ritmInp.focus(), 50);
    }

    function showUrlRemoveOlderConfirm(previewFn, onConfirm) {
        if (document.getElementById('urllist-remove-older-confirm')) return;

        const overlay = document.createElement('div');
        overlay.id = 'urllist-remove-older-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.55)', zIndex: '1100002',
        });

        const modal = document.createElement('div');
        modal.id = 'urllist-remove-older-confirm';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1100003', background: '#ffffff', border: '2px solid #e53935',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 28px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif', maxWidth: '400px', width: '90vw',
            boxSizing: 'border-box', color: '#333',
        });

        const title = document.createElement('div');
        title.textContent = '🗑 Remove Logs Older Than';
        Object.assign(title.style, { fontSize: '15px', fontWeight: 'bold', color: '#c62828', marginBottom: '6px' });

        const subtitle = document.createElement('div');
        subtitle.textContent = 'All log entries strictly before this date will be permanently deleted from the textarea.';
        Object.assign(subtitle.style, { fontSize: '12px', color: '#666', marginBottom: '16px', lineHeight: '1.4' });

        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Remove entries before:';
        Object.assign(dateLabel.style, { fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' });

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        Object.assign(dateInput.style, {
            width: '100%', padding: '8px 10px', border: '1px solid #ccc',
            borderRadius: '5px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px',
        });

        const previewEl = document.createElement('div');
        Object.assign(previewEl.style, {
            fontSize: '12px', minHeight: '18px', marginBottom: '16px',
            padding: '8px 12px', borderRadius: '5px',
            background: '#fff8e1', border: '1px solid #ffe082', color: '#795548', display: 'none',
        });

        dateInput.addEventListener('change', () => {
            const cutoff = dateInput.value;
            if (!cutoff) { previewEl.style.display = 'none'; return; }
            const count = previewFn(cutoff);
            previewEl.style.display = 'block';
            if (count === 0) {
                previewEl.textContent = 'No entries are older than this date.';
                previewEl.style.background = '#f1f8e9';
                previewEl.style.borderColor = '#aed581';
                previewEl.style.color = '#558b2f';
            } else {
                previewEl.textContent = `⚠️  ${count} entr${count === 1 ? 'y' : 'ies'} will be permanently removed.`;
                previewEl.style.background = '#fff8e1';
                previewEl.style.borderColor = '#ffe082';
                previewEl.style.color = '#795548';
            }
        });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '10px', background: '#e0e0e0', color: '#333',
            border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#d0d0d0'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#e0e0e0'; });
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm Delete';
        Object.assign(confirmBtn.style, {
            flex: '1', padding: '10px', background: '#e53935', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.background = '#b71c1c'; });
        confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.background = '#e53935'; });
        confirmBtn.onclick = () => {
            const cutoff = dateInput.value;
            if (!cutoff) { dateInput.style.borderColor = '#e53935'; dateInput.focus(); return; }
            if (previewFn(cutoff) === 0) return;
            overlay.remove(); modal.remove();
            onConfirm(cutoff);
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(dateLabel);
        modal.appendChild(dateInput);
        modal.appendChild(previewEl);
        modal.appendChild(btnRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };
        setTimeout(() => dateInput.focus(), 50);
    }

    function showUrlListLogViewerModal(textarea) {
        if (document.getElementById('urllist-log-view-modal')) return;

        const allGroups = parseUrlListLog(textarea.value).filter(g =>
            g.ritm || g.domains.some(d => d.domain)
        );

        const overlay = document.createElement('div');
        overlay.id = 'urllist-log-view-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.55)', zIndex: '1100000',
        });

        const modal = document.createElement('div');
        modal.id = 'urllist-log-view-modal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: '1100001', background: '#ffffff', border: '2px solid #0073e6',
            borderRadius: '10px', padding: '24px', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif', maxWidth: '640px', width: '92vw',
            maxHeight: '85vh', boxSizing: 'border-box', color: '#333',
            display: 'flex', flexDirection: 'column',
        });

        const titleEl = document.createElement('div');
        titleEl.textContent = `📜 URL List Change History  (${allGroups.length} group${allGroups.length !== 1 ? 's' : ''})`;
        Object.assign(titleEl.style, { fontSize: '15px', fontWeight: 'bold', color: '#0073e6', marginBottom: '12px', flexShrink: '0' });
        modal.appendChild(titleEl);

        const filterRow = document.createElement('div');
        Object.assign(filterRow.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', flexShrink: '0', alignItems: 'flex-end' });

        const mkFilterBlock = (labelText, inputType) => {
            const wrap = document.createElement('div');
            const lbl  = document.createElement('div');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { fontSize: '10px', fontWeight: 'bold', color: '#888', marginBottom: '2px' });
            const inp = document.createElement('input');
            inp.type        = inputType || 'text';
            inp.placeholder = inputType === 'date' ? '' : 'All';
            Object.assign(inp.style, {
                padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px',
                fontSize: '12px', width: inputType === 'date' ? '130px' : '140px', boxSizing: 'border-box',
            });
            wrap.appendChild(lbl); wrap.appendChild(inp);
            return { wrap, inp };
        };

        const { wrap: ritmWrap, inp: ritmFilter }    = mkFilterBlock('Filter by RITM');
        const { wrap: fromWrap, inp: dateFromFilter } = mkFilterBlock('Date From', 'date');
        const { wrap: toWrap,   inp: dateToFilter }   = mkFilterBlock('Date To',   'date');

        const clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.textContent = 'Clear';
        Object.assign(clearFiltersBtn.style, {
            padding: '5px 10px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc',
            borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', alignSelf: 'flex-end',
        });
        clearFiltersBtn.onclick = () => { ritmFilter.value = ''; dateFromFilter.value = ''; dateToFilter.value = ''; applyFilters(); };

        filterRow.append(ritmWrap, fromWrap, toWrap, clearFiltersBtn);
        modal.appendChild(filterRow);

        const scrollArea = document.createElement('div');
        Object.assign(scrollArea.style, { overflowY: 'auto', flex: '1', marginBottom: '12px' });
        modal.appendChild(scrollArea);

        function buildGroupCard(group) {
            const isDeleted = group.isDeleted;
            const card = document.createElement('div');
            Object.assign(card.style, {
                background:   isDeleted ? '#fff8f8' : (group.isOrphan ? '#f8f8f8' : '#f0f6ff'),
                border:       `1px solid ${isDeleted ? '#ffcdd2' : (group.isOrphan ? '#e0e0e0' : '#bbdefb')}`,
                borderRadius: '7px', padding: '12px 14px', marginBottom: '8px',
                fontSize: '13px', fontFamily: 'Arial, sans-serif',
            });

            const mkBadge = (text, bg, color, border) => {
                const s = document.createElement('span');
                s.textContent = text;
                Object.assign(s.style, {
                    display: 'inline-block', background: bg, color, borderRadius: '4px',
                    padding: '2px 8px', fontWeight: 'bold', fontSize: '12px', border: border || 'none',
                });
                return s;
            };

            const headerRow = document.createElement('div');
            Object.assign(headerRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' });

            if (group.ritm)     headerRow.appendChild(mkBadge(group.ritm, isDeleted ? '#e53935' : '#1565c0', '#fff'));
            if (group.date)     headerRow.appendChild(mkBadge(group.date, '#f5f5f5', '#555', '1px solid #e0e0e0'));
            if (group.name)     headerRow.appendChild(mkBadge('👤 ' + group.name, '#e8f5e9', '#2e7d32'));
            if (isDeleted)      headerRow.appendChild(mkBadge('🗑 DELETED', '#e53935', '#fff'));
            if (group.isOrphan) headerRow.appendChild(mkBadge('No Log Header', '#f5f5f5', '#999', '1px solid #e0e0e0'));
            card.appendChild(headerRow);

            const activeDomains = group.domains.filter(d => d.domain);
            if (activeDomains.length > 0) {
                const domainList = document.createElement('div');
                Object.assign(domainList.style, { fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.7', paddingLeft: '4px' });
                activeDomains.forEach(d => {
                    const dEl = document.createElement('div');
                    dEl.textContent = d.isCommented ? '# ' + d.domain : d.domain;
                    Object.assign(dEl.style, { color: d.isCommented ? '#aaa' : '#333', textDecoration: d.isCommented ? 'line-through' : 'none' });
                    domainList.appendChild(dEl);
                });
                const activeCount    = activeDomains.filter(d => !d.isCommented).length;
                const commentedCount = activeDomains.filter(d =>  d.isCommented).length;
                let countText = `${activeCount} domain${activeCount !== 1 ? 's' : ''}`;
                if (commentedCount > 0) countText += `  ·  ${commentedCount} commented`;
                const countEl = document.createElement('div');
                countEl.textContent = countText;
                Object.assign(countEl.style, { fontSize: '10px', color: '#999', marginTop: '4px' });
                card.appendChild(domainList);
                card.appendChild(countEl);
            } else {
                const emptyEl = document.createElement('div');
                emptyEl.textContent = '(no domains in this group)';
                Object.assign(emptyEl.style, { fontSize: '11px', color: '#bbb', fontStyle: 'italic' });
                card.appendChild(emptyEl);
            }
            return card;
        }

        function applyFilters() {
            const ritmVal  = ritmFilter.value.trim().toLowerCase();
            const dateFrom = dateFromFilter.value;
            const dateTo   = dateToFilter.value;

            const filtered = allGroups.filter(group => {
                if (ritmVal  && !group.ritm.toLowerCase().includes(ritmVal)) return false;
                if (dateFrom && group.date && group.date < dateFrom) return false;
                if (dateTo   && group.date && group.date > dateTo)   return false;
                return true;
            });

            scrollArea.innerHTML = '';
            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = allGroups.length === 0 ? 'No log entries found in this URL list.' : 'No entries match the current filters.';
                Object.assign(empty.style, { fontSize: '13px', color: '#999', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' });
                scrollArea.appendChild(empty);
            } else {
                filtered.forEach(group => scrollArea.appendChild(buildGroupCard(group)));
            }
        }

        ritmFilter.addEventListener('input', applyFilters);
        dateFromFilter.addEventListener('change', applyFilters);
        dateToFilter.addEventListener('change', applyFilters);
        applyFilters();

        const footerRow = document.createElement('div');
        Object.assign(footerRow.style, { display: 'flex', gap: '8px', flexShrink: '0' });

        const removeOlderBtn = document.createElement('button');
        removeOlderBtn.textContent = '🗑 Remove Older Than';
        Object.assign(removeOlderBtn.style, {
            flex: '0 0 auto', padding: '10px 14px', background: '#fff', color: '#c62828',
            border: '1px solid #e53935', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif',
        });
        removeOlderBtn.addEventListener('mouseenter', () => { removeOlderBtn.style.background = '#ffebee'; });
        removeOlderBtn.addEventListener('mouseleave', () => { removeOlderBtn.style.background = '#fff'; });
        removeOlderBtn.addEventListener('click', () => {
            showUrlRemoveOlderConfirm(
                (cutoff) => allGroups.filter(g => !g.isOrphan && g.date && g.date < cutoff).length,
                (cutoff) => {
                    const groups = parseUrlListLog(textarea.value);
                    const keepLines = [];
                    groups.forEach(group => {
                        if (group.isOrphan || !group.date || group.date >= cutoff) {
                            if (group.raw) keepLines.push(group.raw);
                            group.domains.forEach(d => keepLines.push(d.raw));
                        }
                    });
                    textarea.value = keepLines.join('\n').trim();
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    overlay.remove(); modal.remove();
                }
            );
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            flex: '1', padding: '10px', background: '#0073e6', color: '#fff',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#005bb5'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = '#0073e6'; });
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };

        footerRow.appendChild(removeOlderBtn);
        footerRow.appendChild(closeBtn);
        modal.appendChild(footerRow);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) closeBtn.click(); };
    }

    function createUrlListLogButtons(textareaEl) {
        const container = UI.createElement('div', { display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' });

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Log Entry';
        addBtn.title = 'Insert a #RITM | Date | Name header at the cursor position';
        addBtn.style.cssText = `padding: 4px 10px; border: 1px solid #0073e6; border-radius: 4px; background: #0073e6; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1.4;`;
        addBtn.addEventListener('mouseenter', () => { addBtn.style.background = '#005bb5'; });
        addBtn.addEventListener('mouseleave', () => { addBtn.style.background = '#0073e6'; });
        addBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); showUrlLogEntryModal(textareaEl); });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑 Delete Selected';
        deleteBtn.title = 'Select domains in the textarea first, then click to comment them out and add a Deleted log header';
        deleteBtn.style.cssText = `padding: 4px 10px; border: 1px solid #e53935; border-radius: 4px; background: #e53935; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1.4;`;
        deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.background = '#c62828'; });
        deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.background = '#e53935'; });
        deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); showUrlDeleteSelectionModal(textareaEl); });

        const viewBtn = document.createElement('button');
        viewBtn.textContent = '📜 View History';
        viewBtn.style.cssText = `padding: 4px 10px; border: 1px solid #4caf50; border-radius: 4px; background: #4caf50; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1.4;`;
        viewBtn.addEventListener('mouseenter', () => { viewBtn.style.background = '#388e3c'; });
        viewBtn.addEventListener('mouseleave', () => { viewBtn.style.background = '#4caf50'; });
        viewBtn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); showUrlListLogViewerModal(textareaEl); });

        const ritmBtn = document.createElement('button');
        ritmBtn.textContent = '🎫 Insert RITM';
        ritmBtn.title = 'Insert the current ServiceNow ticket number at cursor position';
        ritmBtn.style.cssText = `padding: 4px 10px; border: 1px solid #764ba2; border-radius: 4px; background: #764ba2; color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; line-height: 1.4;`;
        ritmBtn.addEventListener('mouseenter', () => { ritmBtn.style.background = '#5a3680'; });
        ritmBtn.addEventListener('mouseleave', () => { ritmBtn.style.background = '#764ba2'; });
        ritmBtn.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            const ticket = getTicketNumber();
            if (!ticket) { UI.showStatus('⚠️ No RITM/ticket number detected on this page.', 'warning'); return; }
            insertAtCursor(textareaEl, '#' + ticket.replace(/^#+/, ''));
        });

        container.appendChild(addBtn);
        container.appendChild(deleteBtn);
        container.appendChild(viewBtn);
        container.appendChild(ritmBtn);
        return container;
    }

    /* ==========================================================
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOL_ID = 'netskopeUrlListManager';

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'urlListEditor-notif-dot';

    function addToolbarNotificationDot() {
        if (!VersionManager.isNewer() || VersionManager.changelogSeen) return;
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
            let dotBlue = true;
            const intervalId = setInterval(() => {
                dotBlue = !dotBlue;
                dot.style.background = dotBlue ? '#007bff' : '#ff8c00';
            }, 500);
            dot.dataset.intervalId = intervalId;
            toolEl.appendChild(dot);
        };
        setTimeout(() => tryAdd(0), 500);
    }

    function removeToolbarNotificationDot() {
        const dot = document.querySelector(`[data-tool="${TOOL_ID}"] .${TOOLBAR_DOT_CLASS}`);
        if (dot) {
            clearInterval(Number(dot.dataset.intervalId));
            dot.remove();
        }
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered || registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) return;
        registrationAttempts++;

        if (document.querySelector('[data-toolbar-v2="true"]') && document.getElementById('custom-toolbar-menu')) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: 'netskopeUrlListManager', icon: TOOL_ICON, tooltip: 'Netskope URL List Manager', position: 2 }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Netskope URL List Manager registered successfully!');
        } else {
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS & INITIALIZATION
     * ==========================================================*/

    document.addEventListener('toolbarReady', attemptRegistration);
    document.addEventListener('toolbarToolClicked', (e) => { if (e.detail.id === 'netskopeUrlListManager') showModal(); });

    function initialize() {
        if (!document.body) return setTimeout(initialize, 50);
        if (isInitialized) return;
        isInitialized = true;

        // Show host setup on first run (non-blocking — modal triggers on toolbar click too)
        if (!areTenantHostsConfigured()) {
            showTenantHostSetup(() => console.log('✅ Tenant hosts configured.'));
        }

        initializeModal();
        console.log('✅ Netskope URL List Manager initialized!');
        setTimeout(attemptRegistration, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => { if (!isRegistered) attemptRegistration(); });

})();