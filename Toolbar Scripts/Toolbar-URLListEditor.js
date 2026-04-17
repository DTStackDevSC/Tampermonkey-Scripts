// ==UserScript==
// @name         |Toolbar| Netskope URL List Manager
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Create and update URL lists for Netskope tenants via API - Integrated with Toolbar v2
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔧 Netskope URL List Manager v1.3.0 loading...');

    /* ==========================================================
     *  CONSTANTS & CONFIGURATION
     * ==========================================================*/

    const SCRIPT_VERSION = '1.3.0';
    const CHANGELOG = `Version 1.3.0:
- Added Domain Lookup feature: search for a domain across all URL lists
- Supports exact, partial, and wildcard matching
- Results show list name, ID, URL count, and matched entries
- Click a result to jump directly to the Update form for that list

Version 1.2.0:
- Tenant hostnames are now configurable and stored in Tampermonkey GM storage
- Added Tenant Host setup modal on first run (or when hosts are missing)
- Added "Configure Hosts" option in modal header
- Changed @connect to wildcard (*) to support configurable hostnames

Version 1.1.0:
- Added encryption mechanisms to more securely store API tokens

Version 1.0.0:
- Initial release`;

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
    function detectTenant() {
        const selectors = [
            'input.form-control.element_reference_input',
            'input[type="hidden"][id*="display_hidden"]'
        ];

        for (const selector of selectors) {
            for (const input of document.querySelectorAll(selector)) {
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
    `;
    document.head.appendChild(changelogStyle);

    function showChangelogModal() {
        const overlay = UI.createElement('div', { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: '1000000' }, { id: 'netskopeChangelogModalOverlay' });
        const modal   = UI.createElement('div', {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '1000001', background: '#ffffff', border: '2px solid #333333', padding: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif',
            borderRadius: '10px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', color: '#333333'
        }, { id: 'netskopeChangelogModal' });

        const closeModal = () => { overlay.remove(); modal.remove(); VersionManager.markChangelogSeen(); document.getElementById('netskopeChangelogNotification')?.remove(); };

        modal.innerHTML = `
            <h2 style="margin-top: 0; margin-bottom: 15px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; font-size: 1.5em;">What's New - Version ${SCRIPT_VERSION}</h2>
            <div style="background-color: #f8f9fa; color: #333; padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #667eea;">You've been updated to version ${SCRIPT_VERSION}!</div>
            <div style="white-space: pre-wrap; line-height: 1.6; color: #333; font-family: 'Courier New', Courier, monospace; font-size: 13px; background-color: #fafafa; padding: 10px; border-radius: 5px;">${CHANGELOG}</div>
        `;

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
     *  MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal() {
        if (document.getElementById('netskope-urllist-modal')) return;

        const backdrop = UI.createElement('div', {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: '999997', display: 'none'
        }, { id: 'netskope-urllist-backdrop' });

        const closeModal = () => { modal.style.display = 'none'; backdrop.style.display = 'none'; resetModal(); };
        backdrop.onclick = closeModal;
        document.body.appendChild(backdrop);

        const modal = UI.createElement('div', {
            position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#f9f9f9', border: '1px solid #ccc',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.1)', padding: '50px 20px 20px 20px',
            zIndex: '999998', borderRadius: '10px', fontFamily: 'Arial, sans-serif',
            display: 'none', flexDirection: 'column', alignItems: 'center', gap: '15px',
            minWidth: '650px', maxWidth: '750px', height: 'calc(100vh - 80px)',
            maxHeight: 'calc(100vh - 80px)', overflowY: 'auto'
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
            changelogNotif.innerHTML = `<span class="netskope-notification-dot"></span><span class="netskope-notification-text">Changelog</span>`;
            versionRow.appendChild(changelogNotif);
        }
        modal.appendChild(versionRow);

        // API Configuration Section
        const apiSection = UI.createElement('div', { width: '100%' });

        const sectionHeader = UI.createElement('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' });
        sectionHeader.innerHTML = `
            <h3 style="font-size: 14px; font-weight: bold; color: #333; margin: 0;">API Configuration</h3>
            <span id="api-config-collapse-icon" style="font-size: 12px; color: #666; transition: transform 0.3s ease;">▼</span>
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
        modal.appendChild(UI.createElement('hr', { width: '100%', border: 'none', borderTop: '1px solid #ddd', margin: '10px 0' }));

        // Action buttons — added Domain Lookup button
        const actionBtns = UI.createElement('div', { display: 'flex', gap: '10px', width: '100%' });
        actionBtns.appendChild(UI.createButton('🔍 Fetch URL Lists',  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fetchUrlLists));
        actionBtns.appendChild(UI.createButton('✨ Create New List', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', showCreateForm));
        actionBtns.appendChild(UI.createButton('🔎 Domain Lookup', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', showDomainLookup));
        modal.appendChild(actionBtns);

        ['url-lists-container', 'create-form-container', 'update-form-container', 'domain-lookup-container'].forEach(id => {
            modal.appendChild(UI.createElement('div', { display: 'none', width: '100%' }, { id }));
        });

        modal.appendChild(UI.createElement('div', {
            width: '100%', padding: '10px', borderRadius: '6px', fontSize: '13px',
            textAlign: 'center', display: 'none', marginTop: '10px'
        }, { id: 'urllist-status' }));

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
        ['url-lists-container', 'create-form-container', 'update-form-container', 'domain-lookup-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.display = 'none'; el.innerHTML = ''; }
        });
        UI.hideStatus();
    }

    /* ==========================================================
     *  API FUNCTIONS
     * ==========================================================*/

    async function makeApiRequest(method, endpoint, data, onSuccess, onError) {
        const tenant = detectTenant();

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
            <div style="margin-bottom: 10px;">
                <input id="urllist-search" type="text" placeholder="🔍 Search lists by name..."
                    style="width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
            </div>
            <div id="urllist-wrapper" style="flex: 1; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; min-height: 200px;"></div>
        `;

        const wrapper = document.getElementById('urllist-wrapper');
        const search  = document.getElementById('urllist-search');

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

        renderLists(lists);
        search.oninput = (e) => {
            const term = e.target.value.toLowerCase().trim();
            renderLists(lists.filter(l => (l.name || '').toLowerCase().includes(term)));
        };
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
            () => { const t = detectTenant(); UI.showStatus(`✅ URL list "${listName}" created successfully! Opening URL List page...`, 'success'); GM_openInTab(`https://${t}/ns#/url-list`, { active: false, insert: true }); setTimeout(UI.hideStatus, 8000); },
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
            () => { const t = detectTenant(); UI.showStatus(`✅ URL list "${listName}" updated successfully! Opening URL List page...`, 'success'); GM_openInTab(`https://${t}/ns#/url-list`, { active: false, insert: true }); setTimeout(UI.hideStatus, 8000); },
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