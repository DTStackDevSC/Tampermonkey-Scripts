// ==UserScript==
// @name         ServiceNow SLA Alert Banner
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowSLAAlertBanner.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowSLAAlertBanner.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.3.2
// @description  Display color-coded SLA warning banner based on days remaining
// @author       You
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_VERSION = '1.3.2';
    const CHANGELOG = `Version 1.3.2:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 1.3.1:
- Banner now suppresses on all terminal states (Closed Incomplete, Cancelled, Resolved, Closed) not just Closed Complete.

Version 1.3:
- Added configurable date format picker with ⚙ button next to the Due Date field.`;

    // ─── Version Control ──────────────────────────────────────────────────────

    const SLA_VERSION_KEY   = 'sla_banner_version';
    const SLA_CHANGELOG_KEY = 'sla_banner_changelog_seen';

    function getStoredVersion()    { return GM_getValue(SLA_VERSION_KEY, null); }
    function saveVersion(v)        { GM_setValue(SLA_VERSION_KEY, v); }
    function hasSeenChangelog()    { return GM_getValue(SLA_CHANGELOG_KEY, null) === SCRIPT_VERSION; }
    function markChangelogSeen()   { GM_setValue(SLA_CHANGELOG_KEY, SCRIPT_VERSION); }

    function isNewVersion() {
        const stored = getStoredVersion();
        if (!stored) return true;
        const a = stored.split('.').map(Number);
        const b = SCRIPT_VERSION.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if ((b[i] || 0) > (a[i] || 0)) return true;
            if ((b[i] || 0) < (a[i] || 0)) return false;
        }
        return false;
    }

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
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            background: '#fff', borderRadius: '8px',
            padding: '24px', width: '420px', maxWidth: '90vw',
            maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            fontFamily: 'Arial, sans-serif',
        });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, { margin: '0 0 6px', fontSize: '16px', color: '#1d1d1d' });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `SLA Alert Banner updated to v${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, { fontSize: '13px', color: '#666', marginBottom: '16px' });

        const cardsWrap = document.createElement('div');
        cardsWrap.style.marginBottom = '16px';
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
            display: 'block', margin: '0 auto',
            padding: '8px 28px', borderRadius: '6px',
            background: '#667eea', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'Arial, sans-serif',
        });
        closeButton.onclick = () => {
            overlay.remove();
            markChangelogSeen();
            saveVersion(SCRIPT_VERSION);
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeButton.click(); });
    }

    // ─── Date Format Config ───────────────────────────────────────────────────

    const DATE_FORMAT_KEY = 'sla_banner_date_format';

    const DATE_FORMATS = {
        'MM-dd-yyyy': { label: 'MM-dd-yyyy  (e.g. 03-15-2024)', order: ['m','d','y'], sep: '-' },
        'dd/MM/yyyy': { label: 'dd/MM/yyyy  (e.g. 15/03/2024)', order: ['d','m','y'], sep: '/' },
        'dd-MM-yyyy': { label: 'dd-MM-yyyy  (e.g. 15-03-2024)', order: ['d','m','y'], sep: '-' },
        'dd.MM.yyyy': { label: 'dd.MM.yyyy  (e.g. 15.03.2024)', order: ['d','m','y'], sep: '.' },
        'yyyy-MM-dd': { label: 'yyyy-MM-dd  (e.g. 2024-03-15)', order: ['y','m','d'], sep: '-' },
    };

    let activeFormatKey = null;

    function showFormatPicker(isReconfigure, callback) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0',
            background: 'rgba(0,0,0,0.55)',
            zIndex: '999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Arial, sans-serif',
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#fff',
            borderRadius: '6px',
            padding: '28px 32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        });

        const title = document.createElement('h2');
        title.textContent = isReconfigure
            ? '⚙️ SLA Banner — Change Date Format'
            : '📅 SLA Banner — First Time Setup';
        Object.assign(title.style, { margin: '0 0 10px', fontSize: '16px', color: '#1d1d1d' });

        // ── Hint paragraph ────────────────────────────────────────────────────
        const hint = document.createElement('p');
        Object.assign(hint.style, {
            margin: '0 0 6px',
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.6',
        });
        hint.innerHTML = isReconfigure
            ? 'Select the date format your ServiceNow instance uses. The banner will update immediately.'
            : 'Select the date format your ServiceNow instance uses.';

        const howTo = document.createElement('p');
        Object.assign(howTo.style, {
            margin: '0 0 20px',
            fontSize: '12px',
            color: '#777',
            lineHeight: '1.6',
            borderLeft: '3px solid #e0e0e0',
            paddingLeft: '10px',
        });
        howTo.innerHTML =
            'Not sure? Check the <strong>Due Date</strong> field on any ticket, or go to your ' +
            '<strong>profile</strong> (top-right picture → <em>Profile</em>) and look for ' +
            '<strong>Date format</strong>. If it shows <strong>None</strong>, your format is ' +
            '<strong>yyyy-MM-dd</strong>.' +
            (isReconfigure ? '' : '<br><br>This can be changed later via the ⚙ button next to the Due Date field.');

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', flexDirection: 'column', gap: '10px' });

        Object.entries(DATE_FORMATS).forEach(([key, { label }]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;

            const isCurrent = isReconfigure && key === activeFormatKey;
            Object.assign(btn.style, {
                padding: '10px 14px',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                border: isCurrent ? '2px solid #4a90d9' : '1px solid #ccc',
                borderRadius: '4px',
                background: isCurrent ? '#e8f0fe' : '#f7f7f7',
                color: '#1d1d1d',
                transition: 'background 0.15s',
            });
            btn.onmouseover = () => { if (!isCurrent) btn.style.background = '#e8f0fe'; };
            btn.onmouseout  = () => { if (!isCurrent) btn.style.background = '#f7f7f7'; };
            btn.onclick = () => {
                GM_setValue(DATE_FORMAT_KEY, key);
                overlay.remove();
                callback(key);
            };
            btnGroup.appendChild(btn);
        });

        if (isReconfigure) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            Object.assign(cancel.style, {
                marginTop: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'transparent',
                color: '#777',
            });
            cancel.onmouseover = () => cancel.style.background = '#f0f0f0';
            cancel.onmouseout  = () => cancel.style.background = 'transparent';
            cancel.onclick = () => overlay.remove();
            btnGroup.appendChild(cancel);
        }

        box.append(title, hint, howTo, btnGroup);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ─── Date Parsing ─────────────────────────────────────────────────────────

    function parseDueDate(dateStr, formatKey) {
        if (!dateStr) return null;
        dateStr = dateStr.trim();

        const fmt = DATE_FORMATS[formatKey] || DATE_FORMATS['yyyy-MM-dd'];
        const { order } = fmt;

        // Match date part + optional time (supports -, /, . as separators)
        const match = dateStr.match(
            /^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
        );

        if (match) {
            const [, seg1, seg2, seg3, h = '0', min = '0', s = '0'] = match;
            const parts = { [order[0]]: seg1, [order[1]]: seg2, [order[2]]: seg3 };
            return new Date(+parts.y, +parts.m - 1, +parts.d, +h, +min, +s);
        }

        const fallback = new Date(dateStr);
        return isNaN(fallback) ? null : fallback;
    }

    // ─── Core Logic ───────────────────────────────────────────────────────────

    function getTimeRemaining(dueDate, formatKey) {
        const now = new Date();
        const due = parseDueDate(dueDate, formatKey);
        if (!due || isNaN(due)) return null;

        const diffMs = due - now;
        return {
            total:   diffMs,
            days:    Math.floor(diffMs / (1000 * 60 * 60 * 24)),
            hours:   Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
            isToday: now.toDateString() === due.toDateString(),
            due,
        };
    }

    function getAlertColor(days, isToday) {
        if (isToday || days <= 1) return { bg: '#ff4444', text: '#ffffff' };
        if (days === 2)           return { bg: '#ff8c00', text: '#ffffff' };
        if (days === 3)           return { bg: '#9370db', text: '#ffffff' };
        return null;
    }

    // ─── Config Button (next to Due Date field) ───────────────────────────────

    function injectConfigButton() {
        if (document.getElementById('sla-config-btn')) return;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
        if (!dueDateInput) return;

        const configBtn = document.createElement('button');
        configBtn.id = 'sla-config-btn';
        configBtn.type = 'button';
        configBtn.textContent = '⚙';
        configBtn.title = 'SLA Banner — Change date format';
        Object.assign(configBtn.style, {
            marginLeft: '6px',
            padding: '2px 7px',
            fontSize: '13px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: '3px',
            background: '#f7f7f7',
            color: '#555',
            verticalAlign: 'middle',
            lineHeight: '1.4',
            transition: 'background 0.15s, color 0.15s',
        });
        configBtn.onmouseover = () => { configBtn.style.background = '#e8f0fe'; configBtn.style.color = '#1a73e8'; };
        configBtn.onmouseout  = () => { configBtn.style.background = '#f7f7f7'; configBtn.style.color = '#555'; };
        configBtn.onclick = () => {
            showFormatPicker(true, newFormatKey => {
                activeFormatKey = newFormatKey;
                const input = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');
                if (input?.value) createOrUpdateBanner(input.value, newFormatKey);
            });
        };

        dueDateInput.insertAdjacentElement('afterend', configBtn);
    }

    // ─── State Check ─────────────────────────────────────────────────────────

    const TERMINAL_STATES = new Set([
        'closed complete',
        'closed incomplete',
        'cancelled',
        'resolved',
        'closed',
    ]);

    function isTicketClosed() {
        // ServiceNow renders the state as a select (edit mode) or a display span (read-only mode).
        // Try the select first, then fall back to common read-only label selectors.
        const stateSelect = document.querySelector('select[id$=".state"]');
        if (stateSelect) {
            const text = stateSelect.options[stateSelect.selectedIndex]?.text?.trim().toLowerCase() || '';
            return TERMINAL_STATES.has(text);
        }
        // Read-only display variants used by different SNow themes
        const stateLabel =
            document.querySelector('[id$=".state_label"]') ||
            document.querySelector('[id$=".state"] .select2-chosen');
        if (stateLabel) {
            return TERMINAL_STATES.has(stateLabel.textContent.trim().toLowerCase());
        }
        return false;
    }

    // ─── Banner ───────────────────────────────────────────────────────────────

    function createOrUpdateBanner(dueDate, formatKey) {
        if (isTicketClosed()) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const tr = getTimeRemaining(dueDate, formatKey);
        if (!tr) return;

        const { days, hours, minutes, seconds, isToday, total, due } = tr;

        if (days > 3 && !isToday && total > 0) {
            document.getElementById('sla-alert-banner')?.remove();
            return;
        }

        const colors = getAlertColor(days, isToday);
        if (!colors && total > 0) return;

        const targetElement = document.querySelector('.sn-form-inline-stream-entries')
            || document.querySelector('.activity-form-group')
            || document.querySelector('.tab_section');
        if (!targetElement) return;

        let banner = document.getElementById('sla-alert-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'sla-alert-banner';
            Object.assign(banner.style, {
                padding: '12px 15px',
                marginBottom: '15px',
                borderRadius: '3px',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: '1000',
                fontFamily: 'Arial, sans-serif',
            });
            targetElement.insertBefore(banner, targetElement.firstChild);
        }

        const finalColors = total < 0 ? { bg: '#ff4444', text: '#ffffff' } : colors;
        banner.style.backgroundColor = finalColors.bg;
        banner.style.color = finalColors.text;

        const pad = n => String(n).padStart(2, '0');
        const countdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        const expiryStr = due.toLocaleString();

        if      (total < 0)   banner.textContent = `⚠️ SLA EXPIRED ${Math.abs(days)} day(s) ago!`;
        else if (isToday)     banner.textContent = `🚨 SLA EXPIRES TODAY — ${countdown} remaining`;
        else if (days === 0)  banner.textContent = `🚨 SLA EXPIRES SOON — ${countdown} remaining`;
        else if (days === 1)  banner.textContent = `⚠️ SLA WARNING: 1 day remaining (Expires: ${expiryStr})`;
        else if (days === 2)  banner.textContent = `⚠️ SLA NOTICE: 2 days remaining (Expires: ${expiryStr})`;
        else if (days === 3)  banner.textContent = `⚠️ SLA NOTICE: 3 days remaining (Expires: ${expiryStr})`;
    }

    // ─── Monitor ──────────────────────────────────────────────────────────────

    function monitorDueDate(formatKey) {
        activeFormatKey = formatKey;

        const dueDateInput = document.querySelector('input[id*="due_date"][data-type="glide_element_date_time"]');

        if (!dueDateInput || !dueDateInput.value) {
            setTimeout(() => monitorDueDate(formatKey), 500);
            return;
        }

        injectConfigButton();
        createOrUpdateBanner(dueDateInput.value, formatKey);

        setInterval(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }, 1000);

        new MutationObserver(() => {
            if (dueDateInput.value) createOrUpdateBanner(dueDateInput.value, activeFormatKey);
        }).observe(dueDateInput, { attributes: true, attributeFilter: ['value'] });
    }

    // ─── Entry Point ──────────────────────────────────────────────────────────

    function init() {
        const savedFormat = GM_getValue(DATE_FORMAT_KEY, null);

        if (savedFormat && DATE_FORMATS[savedFormat]) {
            monitorDueDate(savedFormat);
        } else {
            const showPicker = () => showFormatPicker(false, formatKey => monitorDueDate(formatKey));
            document.body ? showPicker() : document.addEventListener('DOMContentLoaded', showPicker);
        }

        if (isNewVersion() && !hasSeenChangelog()) {
            const showModal = () => showChangelogModal();
            document.body ? setTimeout(showModal, 500) : document.addEventListener('DOMContentLoaded', () => setTimeout(showModal, 500));
        }
    }

    init();
})();