// ==UserScript==
// @name         |Toolbar| Ticket Assignment Tool
// @namespace    https://gitlab.com/-/snippets/4904912
// @version      1.0.8
// @description  Assign tickets with automated field population, SCTASK opening, etc
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==


(function() {
    'use strict';

    console.log('🎫 ServiceNow Ticket Assignment Tool loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.7';
    const CHANGELOG = `Version 1.0.7:
- Replaced static team configuration with dynamic member setup
- Team members are now entered at first run and stored in GM storage
- Added member management (add/remove) from modal footer
- Added Import/Export (JSON) in Manage Members modal
- Added Import (JSON) in first-run setup wizard

Version 1.0.6:
- Migrated from localStorage to Tampermonkey native storage (GM_setValue, GM_getValue)

Version 1.0.5:
- Changed template texts in EMEA team

Version 1.0.3:
- Added "Product Freeze Reminder" checkbox with customizable date/time/timezone picker
- Several fixes`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('ticketAssignmentVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('ticketAssignmentVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('ticketAssignmentChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('ticketAssignmentChangelogSeen', SCRIPT_VERSION);
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
     *  FREEZE DATE STORAGE FUNCTIONS
     * ==========================================================*/

    function getStoredFreezeDate() {
        return GM_getValue('ticketAssignmentFreezeDate', '2026-01-04T13:00');
    }

    function saveFreezeDate(datetime) {
        GM_setValue('ticketAssignmentFreezeDate', datetime);
    }

    function getStoredTimezone() {
        return GM_getValue('ticketAssignmentTimezone', 'CST');
    }

    function saveTimezone(timezone) {
        GM_setValue('ticketAssignmentTimezone', timezone);
    }

    function formatFreezeDate(datetimeStr, timezone) {
        const date = new Date(datetimeStr);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = date.getDate();
        const suffix = getDaySuffix(day);
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        let hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${month} ${day}${suffix} ${year} at ${hours}${ampm} ${timezone}`;
    }

    function getDaySuffix(day) {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    /* ==========================================================
     *  TEAM MEMBER STORAGE FUNCTIONS
     * ==========================================================*/

    function getStoredMembers() {
        const raw = GM_getValue('ticketAssignmentMembers', null);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function saveMembers(members) {
        GM_setValue('ticketAssignmentMembers', JSON.stringify(members));
    }

    function clearMembers() {
        GM_deleteValue('ticketAssignmentMembers');
    }

    /* ==========================================================
     *  IMPORT / EXPORT HELPERS
     * ==========================================================*/

    function exportMembersToFile(members) {
        const names = members.map(m => m.name);
        const json = JSON.stringify(names, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'team-members.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function triggerMembersImport(currentMembers, onImport) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    let names = [];
                    if (Array.isArray(parsed)) {
                        if (parsed.length > 0 && typeof parsed[0] === 'string') {
                            names = parsed;
                        } else if (parsed.length > 0 && parsed[0].name) {
                            names = parsed.map(m => m.name);
                        }
                    }
                    if (names.length === 0) {
                        alert('⚠️ No valid members found in file.\n\nExpected format:\n["John Smith", "Jane Doe"]');
                        return;
                    }
                    // Merge: skip duplicates
                    const merged = [...currentMembers];
                    let added = 0;
                    names.forEach(name => {
                        if (!merged.some(m => m.name.toLowerCase() === name.toLowerCase())) {
                            merged.push({ name, value: name.toLowerCase().replace(/\s+/g, '_') });
                            added++;
                        }
                    });
                    onImport(merged, added);
                } catch (err) {
                    alert('❌ Invalid JSON file. Could not parse members.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /* ==========================================================
     *  MEMBER SETUP WIZARD (first run)
     * ==========================================================*/

    function showMemberSetupWizard(onComplete) {
        if (document.getElementById('sn-setup-overlay')) return;

        const members = [];

        const style = document.createElement('style');
        style.textContent = `
            #sn-setup-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6); z-index: 100000;
                display: flex; justify-content: center; align-items: center;
                font-family: Arial, sans-serif;
            }
            #sn-setup-modal {
                background: #fff; border-radius: 12px; padding: 30px;
                width: 480px; max-width: 95vw;
                box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            }
            #sn-setup-modal h2 { margin: 0 0 6px 0; color: #333; font-size: 18px; }
            #sn-setup-modal .sn-setup-warning {
                background: #fff0f0; border: 1px solid #f5c2c2;
                border-left: 4px solid #cc0000; border-radius: 6px;
                padding: 10px 12px; margin-bottom: 14px;
                font-size: 12px; color: #8b0000; line-height: 1.5;
                font-family: Arial, sans-serif;
            }
            #sn-setup-modal .sn-setup-warning strong { color: #cc0000; }
            #sn-setup-modal .sn-setup-subtitle {
                color: #888; font-size: 13px; margin-bottom: 20px;
            }
            #sn-setup-member-list {
                max-height: 220px; overflow-y: auto;
                border: 1px solid #e0e0e0; border-radius: 6px;
                margin-bottom: 16px; min-height: 48px;
                padding: 4px 0; background: #fafafa;
            }
            .sn-setup-member-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
                font-size: 13px; color: #333;
            }
            .sn-setup-member-item:last-child { border-bottom: none; }
            .sn-setup-member-remove {
                background: none; border: none; color: #cc0000;
                cursor: pointer; font-size: 16px; line-height: 1;
                padding: 0 4px; font-weight: bold;
            }
            .sn-setup-member-remove:hover { color: #ff0000; }
            .sn-setup-add-row { display: flex; gap: 8px; margin-bottom: 8px; }
            #sn-setup-name-input {
                flex: 1; padding: 10px 12px; border: 1px solid #ccc;
                border-radius: 6px; font-size: 14px; color: #333; outline: none;
            }
            #sn-setup-name-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102,126,234,0.15);
            }
            .sn-setup-add-btn {
                padding: 10px 18px; background: #667eea; color: #fff;
                border: none; border-radius: 6px; font-size: 14px;
                font-weight: bold; cursor: pointer; white-space: nowrap;
            }
            .sn-setup-add-btn:hover { background: #5568d3; }
            .sn-setup-import-row { margin-bottom: 20px; }
            .sn-setup-import-btn {
                background: none; border: 1px dashed #aaa; color: #555;
                border-radius: 6px; padding: 7px 14px; font-size: 12px;
                cursor: pointer; width: 100%; text-align: center;
                box-sizing: border-box; transition: all 0.2s ease;
                font-family: Arial, sans-serif;
            }
            .sn-setup-import-btn:hover {
                border-color: #667eea; color: #667eea; background: #f5f5ff;
            }
            .sn-setup-footer { display: flex; gap: 10px; justify-content: flex-end; }
            .sn-setup-done-btn {
                padding: 10px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff; border: none; border-radius: 6px;
                font-size: 14px; font-weight: bold; cursor: pointer;
                font-family: Arial, sans-serif;
            }
            .sn-setup-done-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .sn-setup-done-btn:not(:disabled):hover { opacity: 0.9; }
            .sn-setup-empty-hint {
                text-align: center; color: #aaa; font-size: 12px;
                padding: 14px 0; font-style: italic;
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'sn-setup-overlay';

        const modal = document.createElement('div');
        modal.id = 'sn-setup-modal';
        modal.innerHTML = `
            <h2>👥 Set Up Team Members</h2>
            <div class="sn-setup-warning">
                ⚠️ <strong>Names must match ServiceNow exactly.</strong>
                Enter each member's full name exactly as it appears in the ServiceNow UI (e.g. in the "Assigned to" autocomplete field). Incorrect or partial names will cause assignment failures.
            </div>
            <p class="sn-setup-subtitle">Enter each team member's full name and click Add. You can manage this list later from the toolbar.</p>
            <div id="sn-setup-member-list">
                <div class="sn-setup-empty-hint">No members added yet...</div>
            </div>
            <div class="sn-setup-add-row">
                <input id="sn-setup-name-input" type="text" placeholder="Full name (e.g. John Smith)" autocomplete="off" />
                <button class="sn-setup-add-btn" id="sn-setup-add-btn">Add</button>
            </div>
            <div class="sn-setup-import-row">
                <button class="sn-setup-import-btn" id="sn-setup-import-btn">⬆ Import from JSON file</button>
            </div>
            <div class="sn-setup-footer">
                <button class="sn-setup-done-btn" id="sn-setup-done-btn" disabled>Save & Continue →</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const list = document.getElementById('sn-setup-member-list');
        const nameInput = document.getElementById('sn-setup-name-input');
        const addBtn = document.getElementById('sn-setup-add-btn');
        const doneBtn = document.getElementById('sn-setup-done-btn');
        const importBtn = document.getElementById('sn-setup-import-btn');

        function renderList() {
            if (members.length === 0) {
                list.innerHTML = '<div class="sn-setup-empty-hint">No members added yet...</div>';
            } else {
                list.innerHTML = '';
                members.forEach((m, i) => {
                    const item = document.createElement('div');
                    item.className = 'sn-setup-member-item';
                    item.innerHTML = `<span>${m.name}</span>`;
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'sn-setup-member-remove';
                    removeBtn.textContent = '×';
                    removeBtn.title = 'Remove';
                    removeBtn.onclick = () => {
                        members.splice(i, 1);
                        renderList();
                        doneBtn.disabled = members.length === 0;
                    };
                    item.appendChild(removeBtn);
                    list.appendChild(item);
                });
            }
        }

        function addMember() {
            const name = nameInput.value.trim();
            if (!name) return;
            if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
                nameInput.style.borderColor = '#cc0000';
                nameInput.title = 'Already added';
                setTimeout(() => { nameInput.style.borderColor = ''; nameInput.title = ''; }, 1500);
                return;
            }
            members.push({ name, value: name.toLowerCase().replace(/\s+/g, '_') });
            nameInput.value = '';
            nameInput.focus();
            renderList();
            doneBtn.disabled = false;
        }

        addBtn.onclick = addMember;
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

        importBtn.onclick = () => {
            triggerMembersImport(members, (merged, added) => {
                members.length = 0;
                merged.forEach(m => members.push(m));
                renderList();
                doneBtn.disabled = members.length === 0;
                importBtn.textContent = `✓ Imported (${added} added)`;
                setTimeout(() => { importBtn.textContent = '⬆ Import from JSON file'; }, 2500);
            });
        };

        doneBtn.onclick = () => {
            if (members.length === 0) return;
            saveMembers(members);
            overlay.remove();
            style.remove();
            onComplete(members);
        };

        nameInput.focus();
    }

    /* ==========================================================
     *  MEMBER MANAGEMENT MODAL (edit existing list)
     * ==========================================================*/

    function showManageMembersModal() {
        if (document.getElementById('sn-manage-overlay')) return;

        const members = JSON.parse(JSON.stringify(getStoredMembers() || []));

        const style = document.createElement('style');
        style.textContent = `
            #sn-manage-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6); z-index: 1000000;
                display: flex; justify-content: center; align-items: center;
                font-family: Arial, sans-serif;
            }
            #sn-manage-modal {
                background: #fff; border-radius: 12px; padding: 28px;
                width: 440px; max-width: 95vw;
                box-shadow: 0 8px 32px rgba(0,0,0,0.25);
            }
            #sn-manage-modal h3 { margin: 0 0 12px 0; color: #333; font-size: 16px; }
            #sn-manage-modal .sn-manage-warning {
                background: #fff0f0; border: 1px solid #f5c2c2;
                border-left: 4px solid #cc0000; border-radius: 6px;
                padding: 10px 12px; margin-bottom: 14px;
                font-size: 12px; color: #8b0000; line-height: 1.5;
                font-family: Arial, sans-serif;
            }
            #sn-manage-modal .sn-manage-warning strong { color: #cc0000; }
            #sn-manage-list {
                max-height: 240px; overflow-y: auto;
                border: 1px solid #e0e0e0; border-radius: 6px;
                margin-bottom: 14px; background: #fafafa;
                min-height: 48px; padding: 4px 0;
            }
            .sn-manage-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
                font-size: 13px; color: #333;
            }
            .sn-manage-item:last-child { border-bottom: none; }
            .sn-manage-remove {
                background: none; border: none; color: #cc0000;
                cursor: pointer; font-size: 16px; font-weight: bold; padding: 0 4px;
            }
            .sn-manage-remove:hover { color: #ff0000; }
            .sn-manage-add-row { display: flex; gap: 8px; margin-bottom: 12px; }
            #sn-manage-input {
                flex: 1; padding: 9px 12px; border: 1px solid #ccc;
                border-radius: 6px; font-size: 13px; color: #333; outline: none;
                font-family: Arial, sans-serif;
            }
            #sn-manage-input:focus { border-color: #667eea; }
            .sn-manage-add {
                padding: 9px 16px; background: #667eea; color: #fff;
                border: none; border-radius: 6px; font-size: 13px;
                font-weight: bold; cursor: pointer; font-family: Arial, sans-serif;
            }
            .sn-manage-add:hover { background: #5568d3; }
            .sn-manage-io-row {
                display: flex; gap: 8px; margin-bottom: 16px;
            }
            .sn-manage-io-btn {
                flex: 1; padding: 8px; background: none;
                border: 1px dashed #aaa; border-radius: 6px;
                font-size: 12px; color: #555; cursor: pointer;
                text-align: center; transition: all 0.2s ease;
                font-family: Arial, sans-serif;
            }
            .sn-manage-io-btn:hover {
                border-color: #667eea; color: #667eea; background: #f5f5ff;
            }
            .sn-manage-footer { display: flex; gap: 8px; justify-content: flex-end; }
            .sn-manage-save {
                padding: 9px 22px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #fff; border: none; border-radius: 6px;
                font-size: 13px; font-weight: bold; cursor: pointer;
                font-family: Arial, sans-serif;
            }
            .sn-manage-save:hover { opacity: 0.9; }
            .sn-manage-cancel {
                padding: 9px 16px; background: #e0e0e0; color: #333;
                border: 1px solid #ccc; border-radius: 6px;
                font-size: 13px; cursor: pointer; font-family: Arial, sans-serif;
            }
            .sn-manage-cancel:hover { background: #d0d0d0; }
            .sn-manage-empty {
                text-align: center; color: #aaa; font-size: 12px;
                padding: 14px 0; font-style: italic;
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'sn-manage-overlay';

        const modal = document.createElement('div');
        modal.id = 'sn-manage-modal';
        modal.innerHTML = `
            <h3>👥 Manage Team Members</h3>
            <div class="sn-manage-warning">
                ⚠️ <strong>Names must match ServiceNow exactly.</strong>
                Enter each member's full name exactly as it appears in the ServiceNow UI (e.g. in the "Assigned to" autocomplete field). Incorrect or partial names will cause assignment failures.
            </div>
            <div id="sn-manage-list"></div>
            <div class="sn-manage-add-row">
                <input id="sn-manage-input" type="text" placeholder="Add new member..." autocomplete="off" />
                <button class="sn-manage-add" id="sn-manage-add-btn">Add</button>
            </div>
            <div class="sn-manage-io-row">
                <button class="sn-manage-io-btn" id="sn-manage-import-btn">⬆ Import from JSON</button>
                <button class="sn-manage-io-btn" id="sn-manage-export-btn">⬇ Export to JSON</button>
            </div>
            <div class="sn-manage-footer">
                <button class="sn-manage-cancel" id="sn-manage-cancel-btn">Cancel</button>
                <button class="sn-manage-save" id="sn-manage-save-btn">Save Changes</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const list = document.getElementById('sn-manage-list');
        const input = document.getElementById('sn-manage-input');
        const addBtn = document.getElementById('sn-manage-add-btn');
        const saveBtn = document.getElementById('sn-manage-save-btn');
        const cancelBtn = document.getElementById('sn-manage-cancel-btn');
        const importBtn = document.getElementById('sn-manage-import-btn');
        const exportBtn = document.getElementById('sn-manage-export-btn');

        function renderList() {
            if (members.length === 0) {
                list.innerHTML = '<div class="sn-manage-empty">No members yet...</div>';
            } else {
                list.innerHTML = '';
                members.forEach((m, i) => {
                    const item = document.createElement('div');
                    item.className = 'sn-manage-item';
                    item.innerHTML = `<span>${m.name}</span>`;
                    const rm = document.createElement('button');
                    rm.className = 'sn-manage-remove';
                    rm.textContent = '×';
                    rm.onclick = () => { members.splice(i, 1); renderList(); };
                    item.appendChild(rm);
                    list.appendChild(item);
                });
            }
        }

        function addMember() {
            const name = input.value.trim();
            if (!name) return;
            if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) return;
            members.push({ name, value: name.toLowerCase().replace(/\s+/g, '_') });
            input.value = '';
            input.focus();
            renderList();
        }

        addBtn.onclick = addMember;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

        importBtn.onclick = () => {
            triggerMembersImport(members, (merged, added) => {
                members.length = 0;
                merged.forEach(m => members.push(m));
                renderList();
                importBtn.textContent = `✓ ${added} member(s) added`;
                setTimeout(() => { importBtn.textContent = '⬆ Import from JSON'; }, 2500);
            });
        };

        exportBtn.onclick = () => {
            if (members.length === 0) {
                exportBtn.textContent = '⚠ Nothing to export';
                setTimeout(() => { exportBtn.textContent = '⬇ Export to JSON'; }, 2000);
                return;
            }
            exportMembersToFile(members);
            exportBtn.textContent = '✓ Exported!';
            setTimeout(() => { exportBtn.textContent = '⬇ Export to JSON'; }, 2000);
        };

        saveBtn.onclick = () => {
            saveMembers(members);
            overlay.remove();
            style.remove();
            rebuildDropdown(members);
        };

        cancelBtn.onclick = () => { overlay.remove(); style.remove(); };
        overlay.onclick = (e) => { if (e.target === overlay) cancelBtn.click(); };

        renderList();
        input.focus();
    }

    /* ==========================================================
     *  DROPDOWN REBUILD HELPER
     * ==========================================================*/

    function rebuildDropdown(members) {
        const dropdown = document.getElementById('sn-assign-team-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Choose a team member...';
        dropdown.appendChild(defaultOption);
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.value;
            option.textContent = member.name;
            option.dataset.name = member.name;
            dropdown.appendChild(option);
        });
    }

    /* ==========================================================
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        const overlay = document.createElement('div');
        overlay.id = 'ticketAssignmentChangelogOverlay';

        const modal = document.createElement('div');
        modal.id = 'ticketAssignmentChangelogModal';

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
            const notification = document.getElementById('ticketAssignmentChangelogNotification');
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
     *  CONSTANTS
     * ==========================================================*/

    const SHORT_DESC_TEMPLATE = 'DD-MM-YEAR | MF Product | Current Status | Vendor Case | Type | Complexity | PER Number';

    const TIMEZONES = [
        'EST', 'EDT', 'CST', 'CDT', 'MST', 'MDT', 'PST', 'PDT',
        'AKST', 'AKDT', 'HST', 'AST', 'GMT', 'UTC', 'CET', 'CEST',
        'IST', 'JST', 'AEST', 'AEDT', 'NZST', 'NZDT'
    ];

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>`;

    // Global flags
    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;

    /* ==========================================================
     *  MODAL STYLES
     * ==========================================================*/

    const styles = `
        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        #ticketAssignmentChangelogNotification {
            display: inline-flex; align-items: center; gap: 6px;
            cursor: pointer; margin-left: 10px; padding: 3px 8px;
            border-radius: 4px; transition: background-color 0.2s ease;
        }
        #ticketAssignmentChangelogNotification:hover { background-color: #e0e0e0 !important; }
        #ticketAssignmentChangelogNotification .notification-dot {
            width: 8px; height: 8px; border-radius: 50%;
            animation: colorPulse 1s ease-in-out infinite;
        }
        #ticketAssignmentChangelogNotification .notification-text {
            font-size: 11px; color: #666 !important; text-decoration: underline;
            font-family: Arial, sans-serif !important;
        }

        #ticketAssignmentChangelogModal {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 999999; background: #fff !important;
            border: 2px solid #333 !important; padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif !important;
            border-radius: 10px; max-width: 600px;
            max-height: 80vh; overflow-y: auto;
        }
        #ticketAssignmentChangelogModal h2 {
            margin-top: 0; margin-bottom: 15px; color: #333 !important;
            border-bottom: 2px solid #667eea; padding-bottom: 10px;
            font-family: Arial, sans-serif !important;
        }
        #ticketAssignmentChangelogModal .version-info {
            background-color: #f8f9fa !important; padding: 10px;
            border-radius: 5px; margin-bottom: 15px;
            border-left: 4px solid #667eea; color: #333 !important;
            font-family: Arial, sans-serif !important;
        }
        #ticketAssignmentChangelogModal .changelog-content {
            white-space: pre-wrap !important; line-height: 1.6 !important;
            color: #333333 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important; background-color: #fafafa !important;
            padding: 10px !important; border-radius: 5px !important;
        }
        #ticketAssignmentChangelogModal .close-changelog {
            margin-top: 15px; padding: 10px 20px;
            background-color: #667eea !important; color: white !important;
            border: none; border-radius: 5px; cursor: pointer;
            font-weight: bold; width: 100%; font-family: Arial, sans-serif !important;
        }
        #ticketAssignmentChangelogModal .close-changelog:hover { background-color: #5568d3 !important; }
        #ticketAssignmentChangelogOverlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5) !important; z-index: 999998;
        }

        .sn-assign-overlay {
            display: none; position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5) !important;
            z-index: 999997 !important;
            justify-content: center; align-items: center;
        }
        .sn-assign-overlay.active { display: flex !important; }

        .sn-assign-modal {
            background: #f9f9f9 !important; border: 1px solid #ccc !important;
            border-radius: 10px !important; padding: 50px 20px 20px 20px !important;
            box-shadow: 0px 4px 12px rgba(0,0,0,0.1) !important;
            max-width: 500px; width: 90%; position: relative;
            font-family: Arial, sans-serif !important;
        }

        .sn-assign-modal-header {
            position: absolute; top: 12px; left: 12px;
            display: flex; align-items: center; gap: 8px;
        }
        .sn-assign-modal-icon { width: 16px; height: 16px; fill: #333 !important; }
        .sn-assign-modal-title {
            color: #333 !important; font-size: 12px !important;
            font-weight: bold !important; margin: 0 !important;
            font-family: Arial, sans-serif !important;
        }

        .sn-assign-close-btn {
            position: absolute !important; top: 5px !important; right: 5px !important;
            background: red !important; color: white !important; border: none !important;
            border-radius: 4px !important; padding: 4px 8px !important;
            cursor: pointer !important; font-weight: bold !important;
            font-size: 12px !important; font-family: Arial, sans-serif !important;
        }
        .sn-assign-close-btn:hover { opacity: 0.8; }

        .sn-assign-modal-content { display: flex; flex-direction: column; gap: 15px; }
        .sn-assign-form-group { margin-bottom: 0; }

        .sn-assign-label {
            display: block; color: #555 !important; font-size: 13px !important;
            font-weight: bold !important; margin-bottom: 5px !important;
            font-family: Arial, sans-serif !important;
        }

        .sn-assign-dropdown {
            width: 100% !important; padding: 10px !important;
            border: 1px solid #ccc !important; border-radius: 6px !important;
            font-size: 14px !important; color: #333 !important;
            background: white !important; cursor: pointer !important;
            transition: all 0.2s ease !important; box-sizing: border-box !important;
            font-family: Arial, sans-serif !important;
        }
        .sn-assign-dropdown:hover { border-color: #667eea !important; }
        .sn-assign-dropdown:focus {
            outline: none !important; border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1) !important;
        }
        .sn-assign-dropdown option {
            color: #333 !important; background: white !important;
            font-family: Arial, sans-serif !important;
        }

        .sn-assign-checkbox-container {
            display: flex; align-items: center; gap: 8px; padding: 10px;
            background: #fff !important; border-radius: 6px;
            border: 1px solid #e0e0e0 !important; transition: all 0.2s ease;
        }
        .sn-assign-checkbox-container:hover {
            background: #f8f8f8 !important; border-color: #667eea !important;
        }
        .sn-assign-checkbox {
            width: 18px !important; height: 18px !important;
            cursor: pointer !important; accent-color: #667eea !important;
        }
        .sn-assign-checkbox-label {
            color: #333 !important; font-size: 13px !important;
            font-weight: 500 !important; cursor: pointer !important;
            user-select: none; font-family: Arial, sans-serif !important; flex: 1;
        }

        .sn-assign-freeze-container { display: flex; flex-direction: column; gap: 8px; }
        .sn-assign-freeze-row { display: flex; align-items: center; gap: 8px; }
        .sn-assign-freeze-picker {
            display: none; padding: 8px; background: #f8f8f8 !important;
            border-radius: 4px; border: 1px solid #e0e0e0 !important; gap: 8px;
        }
        .sn-assign-freeze-picker.active { display: flex; flex-direction: column; }
        .sn-assign-datetime-row { display: flex; gap: 8px; align-items: center; }
        .sn-assign-datetime-input {
            flex: 1; padding: 8px !important; border: 1px solid #ccc !important;
            border-radius: 4px !important; font-size: 13px !important;
            color: #333 !important; background: white !important;
            font-family: Arial, sans-serif !important;
        }
        .sn-assign-datetime-input:focus {
            outline: none !important; border-color: #667eea !important;
            box-shadow: 0 0 0 2px rgba(102,126,234,0.1) !important;
        }
        .sn-assign-timezone-select {
            width: 100px !important; padding: 8px !important;
            border: 1px solid #ccc !important; border-radius: 4px !important;
            font-size: 13px !important; color: #333 !important;
            background: white !important; cursor: pointer !important;
            font-family: Arial, sans-serif !important;
        }
        .sn-assign-timezone-select:focus {
            outline: none !important; border-color: #667eea !important;
        }

        .sn-assign-buttons { display: flex; gap: 12px; margin-top: 10px; }

        .sn-assign-btn-primary {
            flex: 1; padding: 10px 20px !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important; border: none !important; border-radius: 6px !important;
            font-size: 14px !important; font-weight: bold !important; cursor: pointer !important;
            transition: all 0.2s ease !important; font-family: Arial, sans-serif !important;
        }
        .sn-assign-btn-primary:hover:not(:disabled) { transform: scale(1.02); }
        .sn-assign-btn-primary:active { transform: scale(1); }
        .sn-assign-btn-primary:disabled {
            opacity: 0.6; cursor: not-allowed !important; transform: none !important;
        }

        .sn-assign-btn-secondary {
            flex: 1; padding: 8px 16px !important; background: #e0e0e0 !important;
            color: #333 !important; border: 1px solid #ccc !important;
            border-radius: 4px !important; font-size: 13px !important;
            font-weight: bold !important; cursor: pointer !important;
            transition: all 0.2s ease !important; font-family: Arial, sans-serif !important;
        }
        .sn-assign-btn-secondary:hover { background: #d0d0d0 !important; }

        .sn-assign-loading-overlay {
            display: none; position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(255,255,255,0.95) !important;
            border-radius: 10px !important; justify-content: center;
            align-items: center; flex-direction: column; gap: 16px; z-index: 10;
        }
        .sn-assign-loading-overlay.active { display: flex !important; }
        .sn-assign-spinner {
            width: 48px; height: 48px;
            border: 4px solid #e2e8f0 !important;
            border-top-color: #667eea !important;
            border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        .sn-assign-loading-text {
            color: #333 !important; font-size: 14px !important;
            font-weight: 600 !important; font-family: Arial, sans-serif !important;
        }

        .sn-assign-info-box {
            background: #f0f0f0 !important; border-radius: 6px !important;
            padding: 12px !important; margin-bottom: 0;
            font-size: 12px !important; color: #555 !important;
            line-height: 1.5; font-family: Arial, sans-serif !important;
        }
        .sn-assign-info-box strong { color: #333 !important; font-family: Arial, sans-serif !important; }

        .sn-assign-team-info {
            display: flex; align-items: center; justify-content: space-between;
            gap: 10px; font-size: 11px; color: #666 !important;
            padding: 10px 0; border-top: 1px solid #ddd !important;
            font-family: Arial, sans-serif !important; flex-wrap: wrap;
        }
        .sn-assign-team-name { font-weight: bold; color: #333 !important; }
        .sn-assign-team-actions {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        }
        .sn-assign-switch-team-btn {
            font-size: 11px; background: none; border: none;
            color: #0066cc !important; cursor: pointer; padding: 0;
            text-decoration: underline; font-family: Arial, sans-serif !important;
        }
        .sn-assign-switch-team-btn:hover { color: #0052a3 !important; }
    `;

    /* ==========================================================
     *  MODAL INITIALIZATION
     * ==========================================================*/

    function initializeModal(members) {
        if (document.getElementById('sn-assign-overlay')) return;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        const overlay = document.createElement('div');
        overlay.id = 'sn-assign-overlay';
        overlay.className = 'sn-assign-overlay';

        const modal = document.createElement('div');
        modal.className = 'sn-assign-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'sn-assign-modal-header';
        const headerIcon = document.createElement('div');
        headerIcon.innerHTML = toolIcon;
        headerIcon.className = 'sn-assign-modal-icon';
        const title = document.createElement('span');
        title.className = 'sn-assign-modal-title';
        title.textContent = '🎫 Assign Ticket';
        header.appendChild(headerIcon);
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'sn-assign-close-btn';
        closeBtn.textContent = 'X';
        closeBtn.onclick = hideModal;

        // Content
        const content = document.createElement('div');
        content.className = 'sn-assign-modal-content';

        // Info Box
        const infoBox = document.createElement('div');
        infoBox.className = 'sn-assign-info-box';
        infoBox.innerHTML = `
            <strong>📋 This tool will:</strong><br>
            ✓ Assign the ticket to selected team member<br>
            ✓ Update the Short Description with template<br>
            ✓ Add initial comment with @mentions<br>
            ✓ Open related SCTASK in background
        `;

        // Dropdown
        const formGroup = document.createElement('div');
        formGroup.className = 'sn-assign-form-group';
        const label = document.createElement('label');
        label.className = 'sn-assign-label';
        label.textContent = 'Select Team Member:';
        const dropdown = document.createElement('select');
        dropdown.id = 'sn-assign-team-dropdown';
        dropdown.className = 'sn-assign-dropdown';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Choose a team member...';
        dropdown.appendChild(defaultOption);
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.value;
            option.textContent = member.name;
            option.dataset.name = member.name;
            dropdown.appendChild(option);
        });
        formGroup.appendChild(label);
        formGroup.appendChild(dropdown);

        // Missing Info checkbox
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'sn-assign-checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'sn-assign-missing-info-checkbox';
        checkbox.className = 'sn-assign-checkbox';
        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = 'sn-assign-missing-info-checkbox';
        checkboxLabel.className = 'sn-assign-checkbox-label';
        checkboxLabel.textContent = 'Missing Information';
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(checkboxLabel);

        // Freeze Reminder checkbox + picker
        const freezeContainer = document.createElement('div');
        freezeContainer.className = 'sn-assign-freeze-container';
        const freezeRow = document.createElement('div');
        freezeRow.className = 'sn-assign-freeze-row';
        const freezeCheckboxContainer = document.createElement('div');
        freezeCheckboxContainer.className = 'sn-assign-checkbox-container';
        freezeCheckboxContainer.style.flex = '1';
        const freezeCheckbox = document.createElement('input');
        freezeCheckbox.type = 'checkbox';
        freezeCheckbox.id = 'sn-assign-freeze-checkbox';
        freezeCheckbox.className = 'sn-assign-checkbox';
        const freezeCheckboxLabel = document.createElement('label');
        freezeCheckboxLabel.htmlFor = 'sn-assign-freeze-checkbox';
        freezeCheckboxLabel.className = 'sn-assign-checkbox-label';
        freezeCheckboxLabel.textContent = 'Add reminder for products freeze';
        freezeCheckboxContainer.appendChild(freezeCheckbox);
        freezeCheckboxContainer.appendChild(freezeCheckboxLabel);
        freezeCheckbox.onchange = () => {
            const picker = document.getElementById('sn-assign-freeze-picker');
            if (picker) picker.classList.toggle('active', freezeCheckbox.checked);
        };
        freezeRow.appendChild(freezeCheckboxContainer);
        freezeContainer.appendChild(freezeRow);

        const freezePicker = document.createElement('div');
        freezePicker.id = 'sn-assign-freeze-picker';
        freezePicker.className = 'sn-assign-freeze-picker';
        const datetimeRow = document.createElement('div');
        datetimeRow.className = 'sn-assign-datetime-row';
        const datetimeInput = document.createElement('input');
        datetimeInput.type = 'datetime-local';
        datetimeInput.id = 'sn-assign-freeze-datetime';
        datetimeInput.className = 'sn-assign-datetime-input';
        datetimeInput.value = getStoredFreezeDate();
        datetimeInput.onchange = () => saveFreezeDate(datetimeInput.value);
        const timezoneSelect = document.createElement('select');
        timezoneSelect.id = 'sn-assign-freeze-timezone';
        timezoneSelect.className = 'sn-assign-timezone-select';
        TIMEZONES.forEach(tz => {
            const opt = document.createElement('option');
            opt.value = tz; opt.textContent = tz;
            timezoneSelect.appendChild(opt);
        });
        timezoneSelect.value = getStoredTimezone();
        timezoneSelect.onchange = () => saveTimezone(timezoneSelect.value);
        datetimeRow.appendChild(datetimeInput);
        datetimeRow.appendChild(timezoneSelect);
        freezePicker.appendChild(datetimeRow);
        freezeContainer.appendChild(freezePicker);

        // Buttons
        const buttons = document.createElement('div');
        buttons.className = 'sn-assign-buttons';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'sn-assign-btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = hideModal;
        const assignBtn = document.createElement('button');
        assignBtn.id = 'sn-assign-btn';
        assignBtn.className = 'sn-assign-btn-primary';
        assignBtn.innerHTML = '✓ Assign Ticket';
        assignBtn.onclick = performAssignment;
        buttons.appendChild(cancelBtn);
        buttons.appendChild(assignBtn);

        // Loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'sn-assign-loading';
        loadingOverlay.className = 'sn-assign-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="sn-assign-spinner"></div>
            <div class="sn-assign-loading-text">Assigning ticket...</div>
        `;

        content.appendChild(infoBox);
        content.appendChild(formGroup);
        content.appendChild(checkboxContainer);
        content.appendChild(freezeContainer);
        content.appendChild(buttons);
        content.appendChild(loadingOverlay);

        // Footer row
        const teamInfo = document.createElement('div');
        teamInfo.className = 'sn-assign-team-info';
        const teamName = document.createElement('span');
        teamName.className = 'sn-assign-team-name';
        teamName.textContent = `v${SCRIPT_VERSION}`;
        const teamActions = document.createElement('div');
        teamActions.className = 'sn-assign-team-actions';

        // Manage Members button
        const manageMembersBtn = document.createElement('button');
        manageMembersBtn.className = 'sn-assign-switch-team-btn';
        manageMembersBtn.textContent = 'Manage Members';
        manageMembersBtn.onclick = () => showManageMembersModal();
        teamActions.appendChild(manageMembersBtn);

        // Changelog notification
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'ticketAssignmentChangelogNotification';
            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';
            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = 'Changelog';
            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onclick = () => showChangelogModal();
            teamActions.appendChild(changelogNotification);
        }

        teamInfo.appendChild(teamName);
        teamInfo.appendChild(teamActions);
        content.appendChild(teamInfo);

        modal.appendChild(header);
        modal.appendChild(closeBtn);
        modal.appendChild(content);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        console.log('✅ Ticket Assignment modal created');
    }

    /* ==========================================================
     *  MODAL CONTROL
     * ==========================================================*/

    function showModal() {
        const members = getStoredMembers();
        if (!members || members.length === 0) {
            showMemberSetupWizard((newMembers) => {
                initializeModal(newMembers);
                setTimeout(() => {
                    const overlay = document.getElementById('sn-assign-overlay');
                    if (overlay) overlay.classList.add('active');
                }, 100);
            });
            return;
        }

        const overlay = document.getElementById('sn-assign-overlay');
        if (overlay) {
            overlay.classList.add('active');
            const dropdown = document.getElementById('sn-assign-team-dropdown');
            if (dropdown) setTimeout(() => dropdown.focus(), 100);
        }
    }

    function hideModal() {
        const overlay = document.getElementById('sn-assign-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            const dropdown = document.getElementById('sn-assign-team-dropdown');
            if (dropdown) dropdown.value = '';
            const checkbox = document.getElementById('sn-assign-missing-info-checkbox');
            if (checkbox) checkbox.checked = false;
            const freezeCheckbox = document.getElementById('sn-assign-freeze-checkbox');
            if (freezeCheckbox) freezeCheckbox.checked = false;
            const freezePicker = document.getElementById('sn-assign-freeze-picker');
            if (freezePicker) freezePicker.classList.remove('active');
        }
    }

    function showLoading() {
        const loading = document.getElementById('sn-assign-loading');
        if (loading) loading.classList.add('active');
    }

    function hideLoading() {
        const loading = document.getElementById('sn-assign-loading');
        if (loading) loading.classList.remove('active');
    }

    /* ==========================================================
     *  MENTION INSERTION SYSTEM
     * ==========================================================*/

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function insertTextDirectly(textarea, text) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const currentValue = textarea.value;
        textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }

    async function triggerMentionPicker(textarea, name) {
        console.log('🔔 Triggering @ mention picker for:', name);
        textarea.focus();
        await sleep(100);

        insertTextDirectly(textarea, '@');
        await sleep(150);

        textarea.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, data: '@', inputType: 'insertText'
        }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', {
            key: '@', code: 'Digit2', keyCode: 50, which: 50,
            shiftKey: true, bubbles: true, cancelable: true
        }));

        await sleep(400);

        for (const char of name) {
            insertTextDirectly(textarea, char);
            textarea.dispatchEvent(new InputEvent('input', {
                bubbles: true, cancelable: true, data: char, inputType: 'insertText'
            }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', {
                key: char, bubbles: true, cancelable: true
            }));
            await sleep(50);
        }

        await sleep(1000);

        textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
        }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
        }));

        await sleep(200);

        const suggestionSelectors = [
            '.mention-suggestion',
            '.at-view-ul li',
            '[role="option"]',
            '.atwho-view li',
            '.atwho-view-ul li',
            '.mentions-autocomplete li',
            '[data-mention-item]'
        ];

        for (const selector of suggestionSelectors) {
            const suggestion = document.querySelector(selector);
            if (suggestion && suggestion.offsetParent !== null) {
                console.log('✓ Found mention suggestion, clicking:', selector);
                suggestion.click();
                await sleep(200);
                return true;
            }
        }

        console.warn('⚠️ No mention suggestion found to click');
        return false;
    }

    async function insertTextWithMention(textarea, text) {
        console.group('📝 Inserting text with mentions');

        const mentionRegex = /@\[([^\]]+)\]/g;
        const matches = text.match(mentionRegex);

        if (!matches || matches.length === 0) {
            textarea.value = textarea.value.trim() ? textarea.value + "\n\n" + text : text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.groupEnd();
            return;
        }

        const mentions = [];
        let match;
        mentionRegex.lastIndex = 0;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({ placeholder: match[0], name: match[1], index: match.index });
        }

        const parts = text.split(mentionRegex);
        const existingContent = textarea.value.trim();
        textarea.value = existingContent ? existingContent + "\n\n" : '';
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        textarea.focus();
        await sleep(100);

        let partIndex = 0;
        for (let i = 0; i < mentions.length; i++) {
            if (parts[partIndex]) {
                insertTextDirectly(textarea, parts[partIndex].replace(/@\s*$/, ''));
                await sleep(100);
            }
            partIndex++;
            await triggerMentionPicker(textarea, mentions[i].name);
            await sleep(200);
            partIndex++;
        }

        if (partIndex < parts.length && parts[partIndex]) {
            insertTextDirectly(textarea, parts[partIndex]);
        }

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('✓ Text insertion complete');
        console.groupEnd();
    }

    /* ==========================================================
     *  TICKET ASSIGNMENT FUNCTIONALITY
     * ==========================================================*/

    async function performAssignment() {
        const dropdown = document.getElementById('sn-assign-team-dropdown');
        const selectedValue = dropdown.value;
        if (!selectedValue) { alert('⚠️ Please select a team member'); return; }

        const selectedOption = dropdown.options[dropdown.selectedIndex];
        const assigneeName = selectedOption.dataset.name;
        const checkbox = document.getElementById('sn-assign-missing-info-checkbox');
        const useMissingInfoTemplate = checkbox.checked;
        const freezeCheckbox = document.getElementById('sn-assign-freeze-checkbox');
        const useFreezeReminder = freezeCheckbox.checked;

        console.log('🎫 Starting ticket assignment to:', assigneeName);
        showLoading();

        try {
            await assignToTeamMember(assigneeName);
            await updateShortDescription();
            const openedByName = getOpenedByName();
            await addAdditionalComments(openedByName, assigneeName, useMissingInfoTemplate, useFreezeReminder);
            await openSCTASKInBackground();
            hideLoading();
            hideModal();
            console.log('✅ Ticket assignment completed successfully');
        } catch (error) {
            hideLoading();
            console.error('❌ Error during ticket assignment:', error);
            alert('❌ Error assigning ticket: ' + error.message);
        }
    }

    async function assignToTeamMember(assigneeName) {
        const assignedToInput = document.getElementById('sys_display.sc_req_item.assigned_to') ||
                               document.getElementById('sys_display.incident.assigned_to');
        if (!assignedToInput) throw new Error('Could not find "Assigned to" field');

        assignedToInput.value = '';
        assignedToInput.dispatchEvent(new Event('input', { bubbles: true }));
        assignedToInput.dispatchEvent(new Event('change', { bubbles: true }));
        assignedToInput.focus();
        await sleep(200);

        for (let i = 0; i < assigneeName.length; i++) {
            const char = assigneeName[i];
            assignedToInput.value += char;
            assignedToInput.dispatchEvent(new InputEvent('input', {
                bubbles: true, cancelable: true, data: char, inputType: 'insertText'
            }));
            assignedToInput.dispatchEvent(new KeyboardEvent('keyup', {
                key: char, bubbles: true, cancelable: true
            }));
            await sleep(50);
        }

        await sleep(500);

        assignedToInput.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
        }));
        assignedToInput.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
        }));

        await sleep(300);

        const dropdownSelectors = [
            '.ac_results li:first-child',
            '[role="option"]:first-child',
            '.autocomplete-suggestion:first-child',
            'ul.ac_results li:first-child',
            '[id*="ac_results"] li:first-child'
        ];

        for (const selector of dropdownSelectors) {
            const suggestion = document.querySelector(selector);
            if (suggestion && suggestion.offsetParent !== null) {
                console.log('✓ Found autocomplete suggestion, clicking:', selector);
                suggestion.click();
                await sleep(300);
                break;
            }
        }

        assignedToInput.dispatchEvent(new Event('change', { bubbles: true }));
        assignedToInput.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('✓ Successfully assigned to:', assigneeName);
        await sleep(300);
    }

    function updateShortDescription() {
        return new Promise((resolve, reject) => {
            try {
                const shortDescInput = document.getElementById('sc_req_item.short_description') ||
                                      document.getElementById('incident.short_description');
                if (!shortDescInput) throw new Error('Could not find "Short Description" field');
                shortDescInput.value = SHORT_DESC_TEMPLATE;
                shortDescInput.dispatchEvent(new Event('input', { bubbles: true }));
                shortDescInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✓ Updated Short Description with template');
                setTimeout(resolve, 300);
            } catch (error) { reject(error); }
        });
    }

    function getOpenedByName() {
        const openedByInput = document.getElementById('sc_req_item.opened_by_label') ||
                             document.getElementById('sys_display.sc_req_item.opened_by') ||
                             document.getElementById('incident.opened_by_label') ||
                             document.getElementById('sys_display.incident.opened_by');
        if (openedByInput) {
            return (openedByInput.value || openedByInput.textContent).trim();
        }
        console.warn('⚠️ Could not find "Opened by" field, using placeholder');
        return 'Requester Name';
    }

    async function addAdditionalComments(openedByName, assigneeName, useMissingInfoTemplate, useFreezeReminder) {
        const textarea = document.getElementById('activity-stream-textarea');
        if (!textarea) throw new Error('Could not find Additional Comments textarea');

        const greeting = `Hi @[${openedByName}],

Our team has taken ownership of your request, and @[${assigneeName}] will be working with you directly.
Once the ticket details have been reviewed, they will reach out if there are any questions or if additional information is required.

Please expect an update within the next two business days.

If this is an urgent request, please let us know.`;

        const freezeReminderText = useFreezeReminder ?
            `\n\nA reminder we are currently on a change freeze for Data Security products and will be in effect until ${formatFreezeDate(getStoredFreezeDate(), getStoredTimezone())}. If you require an emergency P1 change, kindly provide business justification.` : '';

        const missingInfoText = useMissingInfoTemplate ?
            `\n\nTo proceed with your case, please provide the following mandatory information that was not included:

- Number of users affected
- When the issue started
- Screenshot of the error, including the system clock to verify the timestamp
- Netskope logs
- HAR logs (if the issue occurs in a browser)
- Screenshot of the Netskope client configuration
- Troubleshooting steps already performed
- Confirmation of whether the issue can be reproduced with Netskope disabled
- Business justification – a clear description of the issue or request

Please note that without the required information, we will be unable to proceed with your case, and it may need to be closed.

Thank you for your cooperation.` : '';

        const signature = `\n\nBest regards,\nGlobal Data Security Enablement`;

        await insertTextWithMention(textarea, greeting + freezeReminderText + missingInfoText + signature);
        console.log('✓ Added Additional Comments with @mentions');
    }

    function openSCTASKInBackground() {
        return new Promise((resolve) => {
            try {
                const sctaskLinks = Array.from(document.querySelectorAll('a[href*="sc_task.do"]'))
                    .filter(link => link.textContent.trim().startsWith('SCTASK'));
                if (sctaskLinks.length > 0) {
                    GM_openInTab(sctaskLinks[0].href, { active: false, insert: true });
                    console.log('✓ Opened SCTASK in background');
                } else {
                    console.log('ℹ️ No SCTASK links found on this page');
                }
                setTimeout(resolve, 300);
            } catch (error) {
                console.warn('⚠️ Could not open SCTASK in background:', error);
                resolve();
            }
        });
    }

    /* ==========================================================
     *  TOOLBAR REGISTRATION
     * ==========================================================*/

    function attemptRegistration() {
        if (isRegistered) return;
        if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
            console.warn('⚠️ Ticket Assignment Tool: Max registration attempts reached');
            return;
        }
        registrationAttempts++;
        console.log(`🔄 Ticket Assignment Tool registration attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}`);

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id: 'ticketAssignment', icon: toolIcon, tooltip: 'Assign Ticket', position: 5 }
            }));
            isRegistered = true;
            console.log('✅ Ticket Assignment Tool registered successfully!');
        } else {
            console.log(`⏳ Toolbar not ready, will retry...`);
            setTimeout(attemptRegistration, REGISTRATION_RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS
     * ==========================================================*/

    document.addEventListener('toolbarReady', () => {
        console.log('✅ Toolbar ready event received');
        attemptRegistration();
    });

    document.addEventListener('toolbarToolClicked', function(e) {
        if (e.detail.id === 'ticketAssignment') {
            console.log('🎫 Ticket Assignment Tool clicked!');
            showModal();
        }
    });

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;
        isInitialized = true;

        const members = getStoredMembers();

        if (!members || members.length === 0) {
            showMemberSetupWizard((newMembers) => {
                initializeModal(newMembers);
                setTimeout(() => attemptRegistration(), 500);
            });
        } else {
            initializeModal(members);
            setTimeout(() => attemptRegistration(), 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => {
        if (!isRegistered) attemptRegistration();
    });

    console.log('✅ Ticket Assignment Tool v' + SCRIPT_VERSION + ' loaded');

})();