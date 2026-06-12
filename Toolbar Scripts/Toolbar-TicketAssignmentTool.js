// ==UserScript==
// @name         |Toolbar| Ticket Assignment Tool
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-TicketAssignmentTool.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-TicketAssignmentTool.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.3.6
// @description  Assign tickets with automated field population, SCTASK opening, etc
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/now/nav/*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==


(function() {
    'use strict';

    console.log('🎫 ServiceNow Ticket Assignment Tool loading...');

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '1.3.6';
    const CHANGELOG = `Version 1.3.6:
- Forced all popups to stay readable when ServiceNow dark theme is on. The setup
  wizard, the manage members window, the assign ticket form, and the What's New
  window now keep their light backgrounds and dark text instead of turning into
  dark on dark or invisible text.

Version 1.3.5:
- Rewrote the activity stream textarea detection and text insertion to fix the
  comments field not being populated in both classic new-tab mode and dashboard mode.
  Three root causes addressed: (1) In single-input journal mode the dedicated
  activity-stream-comments-textarea exists in the DOM but is hidden inside an ng-hide
  container. The previous code found it by ID and then wrote into a hidden element.
  Detection now checks visibility and uses the data-stream-text-input attribute to find
  the correct visible textarea regardless of single or dual mode. (2) Direct .value
  assignment is silently overridden by Angular's ng-model digest on the next cycle.
  All text insertion now goes through the HTMLTextAreaElement native setter so Angular
  sees the change as a real user edit. (3) In classic new-tab mode without an iframe,
  the page context now always resolves to the top document even when g_form is not yet
  available, preventing a false null context on ticket pages.

Version 1.3.4:
- Fixed two separate failures in Polaris mode. First: getTicketContext no longer
  requires g_form to be initialized on the iframe window. In a fresh browser tab
  the macroponent and iframe are present before g_form is set, which previously
  caused the tool to report that no ticket form could be detected. Second: the
  activity stream textarea is rendered by the outer Polaris page, not inside the
  gsft_main form iframe. addAdditionalComments now searches the outer document as
  a fallback when the textarea is not found in the form iframe, so the comments
  field is correctly populated in dashboard mode. The mention suggestion lookup
  also now searches the textarea's own document instead of the form iframe.

Version 1.3.3:
- Fixed field detection failure when a ticket is opened in a new tab in classic mode.
  ServiceNow's nav wrapper loads the form inside a direct gsft_main iframe. The tool
  now checks for that iframe before falling back to window.g_form, so field access
  works correctly in both new tab and dashboard modes.

Version 1.3.2:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.3.1:
- Fixed comment insertion when the activity stream is in dual worknotes/comments
  mode. The tool now checks for the split comments textarea first
  (activity-stream-comments-textarea) and falls back to the combined textarea
  for single-mode instances.

Version 1.3.0:
- Added support for tickets opened from the ServiceNow dashboard (Polaris mode).
  The tool now detects whether the form lives in a shadow DOM iframe (dashboard)
  or directly on the page (new tab), then reads and writes all ticket fields
  through the correct document context in each case.

Version 1.2.3:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.2.2:
- Assignment loading overlay now shows whether the clipboard snippet was copied or not before closing.

Version 1.2.1:
- Member Firm is now silently auto-detected in the background and injected into the clipboard snippet automatically. The Short Description field is for the description only.`;

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
        overlay.id = 'ticketAssignmentChangelogOverlay';

        const modal = document.createElement('div');
        modal.id = 'ticketAssignmentChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'version-info';
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            removeToolbarNotificationDot();
            const notification = document.getElementById('ticketAssignmentChangelogNotification');
            if (notification) notification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);

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
        modal.appendChild(closeButton);

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.onclick = () => closeButton.click();
    }

    /* ==========================================================
     *  DARK MODE ISOLATION
     * ==========================================================*/

    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        #sn-setup-modal, #sn-manage-modal,
        #ticketAssignmentChangelogModal, .sn-assign-modal {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        .sn-assign-modal { background-color: #f9f9f9 !important; }

        #sn-setup-modal input, #sn-setup-modal select, #sn-setup-modal textarea,
        #sn-manage-modal input, #sn-manage-modal select, #sn-manage-modal textarea,
        #ticketAssignmentChangelogModal input, #ticketAssignmentChangelogModal select, #ticketAssignmentChangelogModal textarea,
        .sn-assign-modal input, .sn-assign-modal select, .sn-assign-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }

        /* Setup and Manage modals are built at runtime without !important, so lock
           their nested panels here to stop dark theme bleeding through. */
        #sn-setup-modal h2, #sn-manage-modal h3 { color: #333333 !important; }
        #sn-setup-member-list, #sn-manage-list { background-color: #fafafa !important; }
        .sn-setup-member-item, .sn-manage-item { color: #333333 !important; }
        #sn-setup-modal .sn-setup-warning, #sn-manage-modal .sn-manage-warning {
            background-color: #fff0f0 !important; color: #8b0000 !important;
        }
        #sn-setup-modal .sn-setup-subtitle, #sn-setup-modal .sn-setup-empty-hint,
        #sn-manage-modal .sn-manage-empty { color: #888888 !important; }
    `;

    (function injectDarkModeStyle() {
        if (document.head) {
            document.head.appendChild(darkModeStyle);
        } else {
            setTimeout(injectDarkModeStyle, 20);
        }
    })();

    /* ==========================================================
     *  CONSTANTS
     * ==========================================================*/

    const SHORT_DESC_TEMPLATE = 'DD-MM-YEAR | MF Product | Current Status | Vendor Case | Type | Complexity | PER Number';

    const TIMEZONES = [
        'EST', 'EDT', 'CST', 'CDT', 'MST', 'MDT', 'PST', 'PDT',
        'AKST', 'AKDT', 'HST', 'AST', 'GMT', 'UTC', 'CET', 'CEST',
        'IST', 'JST', 'AEST', 'AEDT', 'NZST', 'NZDT'
    ];

    const MF_CODE_MAP = {
        'Deloitte Africa':                          'Africa',
        'Deloitte Austria':                         'AT',
        'Deloitte Belgium':                         'BE',
        'Deloitte Central Europe':                  'CE',
        'Deloitte Central Mediterranean':           'DCM',
        'Deloitte Cyprus':                          'DME',
        'Deloitte Denmark':                         'DK',
        'Deloitte DKU':                             'DKU',
        'DTTL':                                     'GLB',
        'Deloitte Finland':                         'FI',
        'Deloitte France':                          'FR',
        'Deloitte Germany':                         'DE',
        'Deloitte Iceland':                         'IS',
        'Deloitte Ireland':                         'IE',
        'Deloitte Luxembourg':                      'LU',
        'Deloitte Middle East':                     'DME',
        'Deloitte Netherlands':                     'NL',
        'Deloitte Nordics':                         'Nordics',
        'Deloitte North and South Europe':          'NSE',
        'Deloitte Norway':                          'NO',
        'Deloitte Portugal':                        'PT',
        'Deloitte Spain':                           'ES',
        'Deloitte Sweden':                          'SE',
        'Deloitte Switzerland':                     'CH',
        'Deloitte Turkey':                          'TR',
        'Deloitte United Kingdom':                  'UK',
        'Deloitte United States':                   'US',
        'Deloitte Canada':                          'CA',
        'Deloitte Brazil':                          'BR',
        'Deloitte Caribbean and Bermuda Countries': 'CBC',
        'Deloitte SLATAM':                          'SLATAM',
        'Deloitte S-LATAM':                         'SLATAM',
        'Deloitte South East Asia':                 'SEA',
        'Deloitte South Asia India':                'SA_IN',
        'Deloitte South Asia Mauritius':            'SA_MU',
        'Deloitte Japan':                           'JP',
        'Deloitte Korea':                           'KR',
        'Deloitte Taiwan':                          'TW',
        'Deloitte Australia':                       'AU',
        'Deloitte New Zealand':                     'NZ',
    };

    const toolIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>`;

    const TOOL_ID = 'ticketAssignment';

    // Global flags
    let isInitialized = false;
    let isRegistered = false;
    let registrationAttempts = 0;
    const MAX_REGISTRATION_ATTEMPTS = 10;
    const REGISTRATION_RETRY_DELAY = 500;
    let _ctx = null;

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

        .sn-assign-field-tip {
            font-size: 11px !important; color: #888 !important; margin-top: 5px !important;
            line-height: 1.4; font-family: Arial, sans-serif !important;
        }
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

        // Short Description (Optional) — for clipboard one-liner
        const shortDescGroup = document.createElement('div');
        shortDescGroup.className = 'sn-assign-form-group';
        const shortDescLabel = document.createElement('label');
        shortDescLabel.className = 'sn-assign-label';
        shortDescLabel.textContent = 'Short Description (Optional)';
        const shortDescInput = document.createElement('input');
        shortDescInput.type = 'text';
        shortDescInput.id = 'sn-assign-short-desc';
        shortDescInput.className = 'sn-assign-dropdown';
        shortDescInput.placeholder = 'e.g. Error accessing Netskope client';
        const shortDescTip = document.createElement('div');
        shortDescTip.className = 'sn-assign-field-tip';
        shortDescTip.textContent = '💡 If filled, copies "RITM | MF | Short Description" to clipboard after assigning. MF is auto-detected from the ticket.';
        shortDescGroup.appendChild(shortDescLabel);
        shortDescGroup.appendChild(shortDescInput);
        shortDescGroup.appendChild(shortDescTip);

        content.appendChild(infoBox);
        content.appendChild(formGroup);
        content.appendChild(shortDescGroup);
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
            notificationText.textContent = "What's New";
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
            const shortDescInput = document.getElementById('sn-assign-short-desc');
            if (shortDescInput) shortDescInput.value = '';
        }
    }

    function showLoading() {
        const loading = document.getElementById('sn-assign-loading');
        if (loading) loading.classList.add('active');
    }

    function hideLoading() {
        const loading = document.getElementById('sn-assign-loading');
        if (!loading) return;
        loading.classList.remove('active');
        // Reset spinner and text for next use
        const spinner = loading.querySelector('.sn-assign-spinner');
        if (spinner) { spinner.style.cssText = ''; spinner.textContent = ''; }
        const loadingText = loading.querySelector('.sn-assign-loading-text');
        if (loadingText) loadingText.textContent = 'Assigning ticket...';
        const statusEl = loading.querySelector('.sn-assign-clip-status');
        if (statusEl) statusEl.remove();
    }

    function showAssignmentSuccess(clipText) {
        const loading = document.getElementById('sn-assign-loading');
        if (!loading) return;

        const spinner = loading.querySelector('.sn-assign-spinner');
        if (spinner) {
            spinner.style.cssText = 'font-size:38px; width:auto; height:auto; border:none; animation:none;';
            spinner.textContent = '✅';
        }

        const loadingText = loading.querySelector('.sn-assign-loading-text');
        if (loadingText) loadingText.textContent = 'Ticket assigned!';

        const statusEl = document.createElement('div');
        statusEl.className = 'sn-assign-clip-status';
        Object.assign(statusEl.style, {
            fontSize: '12px', fontFamily: 'Arial, sans-serif',
            marginTop: '8px', fontWeight: '500', textAlign: 'center',
            color: clipText ? '#2e7d32' : '#999',
        });
        statusEl.textContent = clipText
            ? '📋 Snippet copied to clipboard'
            : 'No snippet — Short Description was empty';
        loading.appendChild(statusEl);

        setTimeout(() => { hideLoading(); hideModal(); }, 2500);
    }

    /* ==========================================================
     *  MENTION INSERTION SYSTEM
     * ==========================================================*/

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const _nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

    function setNativeValue(textarea, value) {
        _nativeSetter.call(textarea, value);
        textarea.dispatchEvent(new Event('input',  { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function insertTextDirectly(textarea, text) {
        const start = textarea.selectionStart || 0;
        const end   = textarea.selectionEnd   || 0;
        const newValue = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        _nativeSetter.call(textarea, newValue);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input',  { bubbles: true }));
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

        const ticketDoc = textarea.ownerDocument;
        for (const selector of suggestionSelectors) {
            const suggestion = ticketDoc.querySelector(selector);
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
            const existing = textarea.value.trim();
            setNativeValue(textarea, existing ? existing + "\n\n" + text : text);
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
        _nativeSetter.call(textarea, existingContent ? existingContent + "\n\n" : '');
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

    function getTicketContext() {
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        if (macro && macro.shadowRoot) {
            const iframe = macro.shadowRoot.querySelector('#gsft_main');
            if (iframe && iframe.contentDocument) {
                return {
                    win: iframe.contentWindow,
                    doc: iframe.contentDocument,
                    gForm: (iframe.contentWindow && iframe.contentWindow.g_form) || null,
                    mode: 'polaris'
                };
            }
        }
        const directIframe = document.getElementById('gsft_main');
        if (directIframe && directIframe.contentDocument) {
            return {
                win: directIframe.contentWindow,
                doc: directIframe.contentDocument,
                gForm: (directIframe.contentWindow && directIframe.contentWindow.g_form) || null,
                mode: 'classic'
            };
        }
        // Classic direct page: return the top document even if g_form is not yet set
        return { win: window, doc: document, gForm: window.g_form || null, mode: 'classic' };
    }

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
        const shortDescVal = document.getElementById('sn-assign-short-desc')?.value?.trim() || '';

        _ctx = getTicketContext();
        if (!_ctx) {
            alert('Could not detect the ticket form. Make sure you are on a ticket page.');
            return;
        }
        console.log('🎫 Starting ticket assignment to:', assigneeName, '| Mode:', _ctx.mode);
        showLoading();

        try {
            await assignToTeamMember(assigneeName);
            await updateShortDescription();
            const openedByName = getOpenedByName();
            await addAdditionalComments(openedByName, assigneeName, useMissingInfoTemplate, useFreezeReminder);
            await openSCTASKInBackground();

            let clipText = null;
            if (shortDescVal) {
                const ticketNum  = getTicketNumber();
                const detectedMF = detectMFCode();
                const parts = [];
                if (ticketNum)  parts.push(ticketNum);
                if (detectedMF) parts.push(detectedMF);
                parts.push(shortDescVal);
                clipText = parts.join(' | ');
                GM_setClipboard(clipText);
                console.log('📋 Copied to clipboard:', clipText);
            }

            showAssignmentSuccess(clipText);
            console.log('✅ Ticket assignment completed successfully');
        } catch (error) {
            hideLoading();
            console.error('❌ Error during ticket assignment:', error);
            alert('❌ Error assigning ticket: ' + error.message);
        }
    }

    async function assignToTeamMember(assigneeName) {
        const ticketDoc = _ctx ? _ctx.doc : document;
        const assignedToInput = ticketDoc.getElementById('sys_display.sc_req_item.assigned_to') ||
                               ticketDoc.getElementById('sys_display.incident.assigned_to');
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
            const suggestion = ticketDoc.querySelector(selector);
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
                const ticketDoc = _ctx ? _ctx.doc : document;
                const shortDescInput = ticketDoc.getElementById('sc_req_item.short_description') ||
                                      ticketDoc.getElementById('incident.short_description');
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
        const ticketDoc = _ctx ? _ctx.doc : document;
        const openedByInput = ticketDoc.getElementById('sc_req_item.opened_by_label') ||
                             ticketDoc.getElementById('sys_display.sc_req_item.opened_by') ||
                             ticketDoc.getElementById('incident.opened_by_label') ||
                             ticketDoc.getElementById('sys_display.incident.opened_by');
        if (openedByInput) {
            return (openedByInput.value || openedByInput.textContent).trim();
        }
        console.warn('⚠️ Could not find "Opened by" field, using placeholder');
        return 'Requester Name';
    }

    function getTicketNumber() {
        const ticketDoc = _ctx ? _ctx.doc : document;
        const numField = ticketDoc.getElementById('sc_req_item.number') ||
                         ticketDoc.getElementById('incident.number');
        if (numField) return (numField.value || numField.textContent).trim();
        return '';
    }

    function detectMFCode() {
        const selectors = [
            'input[type="hidden"][id*="display_hidden"]',
            'input.element_reference_input',
            'input.questionsetreference',
        ];
        const ticketDoc = _ctx ? _ctx.doc : document;
        for (const selector of selectors) {
            for (const input of ticketDoc.querySelectorAll(selector)) {
                const value = input.value.trim();
                if (value && MF_CODE_MAP[value]) return MF_CODE_MAP[value];
            }
        }
        return '';
    }

    async function findCommentsTextarea(ctxDoc) {
        // Search the form doc first, then the outer page (Polaris keeps activity stream outside iframe)
        const docsToSearch = [ctxDoc];
        if (ctxDoc !== document) docsToSearch.push(document);

        for (const doc of docsToSearch) {
            // Find the visible textarea already showing comments mode.
            // data-stream-text-input="comments" matches:
            //   - #activity-stream-textarea in single mode (when comments is selected)
            //   - #activity-stream-comments-textarea in dual mode
            // Checking offsetParent skips the hidden counterpart that lives in the ng-hide container.
            for (const el of doc.querySelectorAll('textarea[data-stream-text-input="comments"]')) {
                if (el.offsetParent !== null) return el;
            }

            // Single mode with work_notes currently selected: toggle to comments then return.
            const singleTA = doc.getElementById('activity-stream-textarea');
            if (singleTA && singleTA.offsetParent !== null) {
                const toggle = doc.querySelector('input[name="comments-journal-checkbox"]');
                if (toggle) { toggle.click(); await sleep(300); }
                if (singleTA.getAttribute('data-stream-text-input') === 'comments') return singleTA;
            }
        }
        return null;
    }

    async function addAdditionalComments(openedByName, assigneeName, useMissingInfoTemplate, useFreezeReminder) {
        const iframeDoc = _ctx ? _ctx.doc : document;
        const textarea = await findCommentsTextarea(iframeDoc);
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
                const ticketDoc = _ctx ? _ctx.doc : document;
                const sctaskLinks = Array.from(ticketDoc.querySelectorAll('a[href*="sc_task.do"]'))
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

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'ticketAssign-notif-dot';

    function addToolbarNotificationDot() {
        if (!isNewVersion() || hasSeenChangelog()) return;
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
            addToolbarNotificationDot();
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