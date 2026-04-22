// ==UserScript==
// @name         || Tools Toolbar ||
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.0.1
// @description  Floating toolbar with expandable horizontal menu
// @author       J.R.
// @match        https://*.netskope.com/*
// @match        https://*.goskope.com/*
// @match        https://*.service-now.com/*
// @match        https://*.servicenow.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('🔧 Toolbar v2.5 starting...');

    /* ==========================================================
     *  VERSION CONTROL!
     * ==========================================================*/

    const SCRIPT_VERSION = '1.0.1';
    const CHANGELOG = `Version 1.0.1:
- Update URL Changed
    
Version 1.0:
- Initial Release`;

    /* ==========================================================
     *  VERSION MANAGEMENT FUNCTIONS
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('toolbar-version', null);
    }

    function saveVersion(version) {
        GM_setValue('toolbar-version', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('toolbar-changelog-seen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('toolbar-changelog-seen', SCRIPT_VERSION);
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
     *  CHANGELOG MODAL
     * ==========================================================*/

    function showChangelogModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'toolbarChangelogOverlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'toolbarChangelogModal';

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;

        const versionInfo = document.createElement('div');
        versionInfo.className = 'toolbar-version-info';
        versionInfo.textContent = `Tools Toolbar has been updated to version ${SCRIPT_VERSION}!`;

        const changelogContent = document.createElement('div');
        changelogContent.className = 'toolbar-changelog-content';
        changelogContent.textContent = CHANGELOG;

        const closeButton = document.createElement('button');
        closeButton.className = 'toolbar-close-changelog';
        closeButton.textContent = 'Got it!';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);

            // Remove the notification dot
            const notification = document.getElementById('toolbarChangelogNotification');
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
     *  SETTINGS DEFAULTS AND MANAGEMENT
     * ==========================================================*/

    const DEFAULT_SETTINGS = {
        'toolbar-position': 'bottom-right',
        'toolbar-theme': 'purple',
        'compact-mode': false,
        'auto-close': true,
        'show-tooltips': true,
        'toolbar-opacity': 100,
        'button-size': 36,
        'tool-size': 32,
        'animation-speed': 0.3,
        'menu-gap': 8
    };

    function getSetting(key) {
        return GM_getValue(key, DEFAULT_SETTINGS[key]);
    }

    function setSetting(key, value) {
        GM_setValue(key, value);
    }

    /* ==========================================================
     *  POSITION HELPER FUNCTIONS
     * ==========================================================*/

    function getPositionStyles(position) {
        const styles = { container: '', menu: '' };

        switch(position) {
            case 'top-center':
                styles.container = 'top: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'top: calc(100% + 10px); left: 50%; transform: translateX(-50%);';
                break;
            case 'top-left':
                styles.container = 'top: 10px; left: 20px;';
                styles.menu = 'top: calc(100% + 10px); left: 0; transform: none;';
                break;
            case 'top-right':
                styles.container = 'top: 10px; right: 20px;';
                styles.menu = 'top: calc(100% + 10px); right: 0; left: auto; transform: none;';
                break;
            case 'bottom-center':
                styles.container = 'bottom: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; left: 50%; transform: translateX(-50%);';
                break;
            case 'bottom-left':
                styles.container = 'bottom: 10px; left: 20px;';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; left: 0; transform: none;';
                break;
            case 'bottom-right':
                styles.container = 'bottom: 10px; right: 20px;';
                styles.menu = 'bottom: calc(100% + 10px); top: auto; right: 0; left: auto; transform: none;';
                break;
            default:
                styles.container = 'top: 10px; left: 50%; transform: translateX(-50%);';
                styles.menu = 'top: calc(100% + 10px); left: 50%; transform: translateX(-50%);';
        }

        return styles;
    }

    function getAnimationKeyframes(position, speed) {
        const isBottom = position.includes('bottom');
        const isCenter = position.includes('center');

        if (isBottom) {
            return `
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(0);
                    }
                }
            `;
        } else {
            return `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: ${isCenter ? 'translateX(-50%)' : 'translateX(0)'} translateY(0);
                    }
                }
            `;
        }
    }

    /* ==========================================================
     *  INITIAL STYLES WITH SAVED SETTINGS
     * ==========================================================*/

    const savedPosition = getSetting('toolbar-position');
    const savedTheme = getSetting('toolbar-theme');
    const savedCompactMode = getSetting('compact-mode');
    const savedOpacity = getSetting('toolbar-opacity');
    const savedButtonSize = getSetting('button-size');
    const savedToolSize = getSetting('tool-size');
    const savedAnimationSpeed = getSetting('animation-speed');
    const savedMenuGap = getSetting('menu-gap');

    const positionStyles = getPositionStyles(savedPosition);
    const isBottom = savedPosition.includes('bottom');
    const animationName = isBottom ? 'slideUp' : 'slideDown';

    // Theme colors
    const themeColors = {
        purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        blue: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        green: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        orange: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        dark: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
    };

    const selectedTheme = themeColors[savedTheme] || themeColors.purple;
    const tooltipPosition = isBottom ? 'top: -28px; bottom: auto;' : 'bottom: -28px; top: auto;';
    const opacityValue = savedOpacity / 100;

    // Add custom styles with saved settings
    GM_addStyle(`
        ${getAnimationKeyframes(savedPosition, savedAnimationSpeed)}

        .hidden {
            display: none !important;
        }

        #custom-toolbar-container {
            position: fixed;
            ${positionStyles.container}
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            opacity: ${opacityValue};
            transition: opacity 0.3s ease;
            ${savedCompactMode ? 'transform: ' + (positionStyles.container.includes('transform') ? positionStyles.container.match(/transform: ([^;]+)/)[1] + ' scale(0.85)' : 'scale(0.85)') + ';' : ''}
        }

        #custom-toolbar-toggle {
            width: ${savedButtonSize}px;
            height: ${savedButtonSize}px;
            border-radius: 8px;
            background: ${selectedTheme};
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            position: relative;
        }

        #custom-toolbar-toggle:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        #custom-toolbar-toggle svg {
            width: ${savedButtonSize * 0.45}px;
            height: ${savedButtonSize * 0.45}px;
            fill: white;
        }

        #custom-toolbar-menu {
            position: absolute;
            ${positionStyles.menu}
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            padding: 8px 12px;
            display: none;
            flex-direction: row;
            gap: ${savedMenuGap}px;
            align-items: center;
            white-space: nowrap;
            animation: ${animationName} ${savedAnimationSpeed}s ease;
        }

        #custom-toolbar-menu.active {
            display: flex;
        }

        .toolbar-item {
            width: ${savedToolSize}px;
            height: ${savedToolSize}px;
            border-radius: 8px;
            background: #f3f4f6;
            border: 2px solid transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            position: relative;
        }

        .toolbar-item:hover {
            background: #e5e7eb;
            border-color: #667eea;
            transform: translateY(-2px);
        }

        .toolbar-item svg {
            width: ${savedToolSize * 0.56}px;
            height: ${savedToolSize * 0.56}px;
            fill: #374151;
        }

        .toolbar-item:hover svg {
            fill: #667eea;
        }

        .toolbar-item-tooltip {
            position: absolute;
            ${tooltipPosition}
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: #ffffff !important;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            ${getSetting('show-tooltips') ? '' : 'display: none;'}
        }

        .toolbar-item:hover .toolbar-item-tooltip {
            opacity: 1;
        }

        .toolbar-separator {
            width: 1px;
            height: 24px;
            background: #e5e7eb;
        }

        /* Z-INDEX HIERARCHY
         * Settings Modal: 9999999
         * Changelog Overlay: 1000000
         * Changelog Modal: 1000001
         */

        /* Changelog Notification Styles */
        #toolbarChangelogNotification {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            transition: background-color 0.2s ease !important;
            background-color: transparent !important;
        }

        #toolbarChangelogNotification:hover {
            background-color: #d0d0d0 !important;
        }

        #toolbarChangelogNotification .toolbar-notification-dot {
            width: 8px !important;
            height: 8px !important;
            border-radius: 50% !important;
            animation: toolbarColorPulse 1s ease-in-out infinite !important;
        }

        @keyframes toolbarColorPulse {
            0%, 100% { background-color: #007bff; }
            50% { background-color: #ff8c00; }
        }

        #toolbarChangelogNotification .toolbar-notification-text {
            font-size: 11px !important;
            color: #0066cc !important;
            text-decoration: underline !important;
            font-family: Arial, sans-serif !important;
            font-weight: normal !important;
        }

        /* Changelog Modal Styles */
        #toolbarChangelogModal {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 100000012 !important;
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

        #toolbarChangelogModal h2 {
            margin-top: 0 !important;
            margin-bottom: 15px !important;
            color: #333333 !important;
            border-bottom: 2px solid #667eea !important;
            padding-bottom: 10px !important;
            font-size: 1.5em !important;
            font-weight: bold !important;
            font-family: Arial, sans-serif !important;
        }

        #toolbarChangelogModal .toolbar-version-info {
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

        #toolbarChangelogModal .toolbar-changelog-content {
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

        #toolbarChangelogModal .toolbar-close-changelog {
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

        #toolbarChangelogModal .toolbar-close-changelog:hover {
            background-color: #5568d3 !important;
        }

        #toolbarChangelogOverlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 100000011 !important;
        }

        /* Settings Modal Styles */
        #toolbar-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999999;
            display: none;
            align-items: center;
            justify-content: center;
        }

        #toolbar-settings-modal.visible {
            display: flex;
        }

        .settings-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
        }

        .settings-content {
            position: relative;
            background: #ffffff !important;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            animation: modalSlideIn 0.3s ease;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
        }

        .settings-header h2 {
            margin: 0 !important;
            font-size: 20px !important;
            font-weight: 600 !important;
            color: #1f2937 !important;
        }

        .settings-close {
            background: none !important;
            border: none !important;
            font-size: 28px !important;
            cursor: pointer !important;
            color: #6b7280 !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            transition: all 0.2s !important;
        }

        .settings-close:hover {
            background: #f3f4f6 !important;
            color: #1f2937 !important;
        }

        .settings-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .settings-section {
            margin-bottom: 24px;
        }

        .settings-section:last-child {
            margin-bottom: 0;
        }

        .settings-section h3 {
            margin: 0 0 12px 0 !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        .setting-item {
            margin-bottom: 16px;
        }

        .setting-item:last-child {
            margin-bottom: 0;
        }

        .setting-item label {
            display: block !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #374151 !important;
            margin-bottom: 6px !important;
        }

        .setting-item input[type="text"],
        .setting-item input[type="number"],
        .setting-item select {
            width: 100% !important;
            padding: 8px 12px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            transition: all 0.2s !important;
            background: #ffffff !important;
            color: #1f2937 !important;
        }

        .setting-item input[type="text"]:focus,
        .setting-item input[type="number"]:focus,
        .setting-item select:focus {
            outline: none !important;
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }

        .setting-item input[type="checkbox"] {
            margin-right: 8px !important;
        }

        .setting-item input[type="range"] {
            width: 100% !important;
            margin: 8px 0 !important;
        }

        .range-value {
            display: inline-block !important;
            min-width: 50px !important;
            text-align: right !important;
            font-weight: 600 !important;
            color: #667eea !important;
            margin-left: 10px !important;
        }

        .tools-list {
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            padding: 12px !important;
            max-height: 150px !important;
            overflow-y: auto !important;
            background: #f9fafb !important;
        }

        .tool-item {
            display: flex !important;
            align-items: center !important;
            padding: 6px 0 !important;
            color: #1f2937 !important;
        }

        .tool-item input[type="checkbox"] {
            margin-right: 8px !important;
        }

        .tool-item span {
            color: #1f2937 !important;
        }

        .settings-footer {
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
            padding: 8px 16px !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            border: none !important;
        }

        .btn-primary {
            background: #667eea !important;
            color: #ffffff !important;
        }

        .btn-primary:hover {
            background: #5568d3 !important;
        }

        .btn-secondary {
            background: #f3f4f6 !important;
            color: #374151 !important;
        }

        .btn-secondary:hover {
            background: #e5e7eb !important;
        }

        .btn-danger {
            background: #ef4444 !important;
            color: #ffffff !important;
        }

        .btn-danger:hover {
            background: #dc2626 !important;
        }

        .version-section {
            background: #f8f9fa !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin-bottom: 20px !important;
            border-left: 4px solid #667eea !important;
        }

        .version-info-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .version-display {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .version-label {
            font-weight: 600 !important;
            color: #374151 !important;
            font-size: 14px !important;
        }

        .setting-help-text {
            font-size: 12px !important;
            color: #6b7280 !important;
            margin-top: 4px !important;
            font-style: italic !important;
        }
    `);

    // Create toolbar HTML
    const toolbarHTML = `
        <div id="custom-toolbar-container" data-toolbar-v2="true">
            <button id="custom-toolbar-toggle" title="Toggle Toolbar">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                </svg>
            </button>
            <div id="custom-toolbar-menu">
                <!-- Settings -->
                <div class="toolbar-item" data-tool="settings">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    <div class="toolbar-item-tooltip">Settings</div>
                </div>
            </div>
        </div>
    `;

    /* ==========================================================
     *  INITIALIZATION
     * ==========================================================*/

    function initToolbar() {
        if (document.getElementById('custom-toolbar-container')) {
            console.log('⚠️ Toolbar already exists, skipping initialization');
            return;
        }

        if (!document.body) {
            setTimeout(initToolbar, 50);
            return;
        }

        const container = document.createElement('div');
        container.innerHTML = toolbarHTML;
        const toolbarElement = container.firstElementChild;
        document.body.appendChild(toolbarElement);

        console.log('✅ Toolbar DOM element created with data-toolbar-v2 attribute');

        setupEventListeners();

        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('toolbarReady'));
            console.log('📢 toolbarReady event dispatched');
        }, 100);

        console.log('✅ Toolbar initialized and ready!');
    }

    function setupEventListeners() {
        const toggleButton = document.getElementById('custom-toolbar-toggle');
        const menu = document.getElementById('custom-toolbar-menu');

        if (!toggleButton || !menu) {
            console.error('❌ Cannot find toolbar elements');
            return;
        }

        // Click to toggle menu
        toggleButton.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#custom-toolbar-container')) {
                menu.classList.remove('active');
            }
        });

        // Settings button
        const settingsBtn = menu.querySelector('[data-tool="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                menu.classList.remove('active');
                showSettings();
            });
        }

        console.log('✅ Event listeners set up');
    }

    /* ==========================================================
     *  SETTINGS MODAL (ENHANCED)
     * ==========================================================*/

    function showSettings() {
        const existingModal = document.getElementById('toolbar-settings-modal');
        if (existingModal) {
            existingModal.classList.add('visible');
            const showChangelog = isNewVersion() && !hasSeenChangelog();
            const changelogNotification = document.getElementById('toolbarChangelogNotification');
            if (changelogNotification) {
                if (showChangelog) {
                    changelogNotification.classList.remove('hidden');
                } else {
                    changelogNotification.classList.add('hidden');
                }
            }
            return;
        }

        const modalHTML = `
            <div id="toolbar-settings-modal" class="visible">
                <div class="settings-overlay"></div>
                <div class="settings-content">
                    <div class="settings-header">
                        <h2>⚙️ Toolbar Settings</h2>
                        <button class="settings-close">&times;</button>
                    </div>

                    <div class="settings-body">
                        <!-- Version Info -->
                        <div class="settings-section version-section">
                            <div class="version-info-container">
                                <div class="version-display">
                                    <span class="version-label">Current Version: ${SCRIPT_VERSION}</span>
                                    <span id="toolbarChangelogNotification" class="hidden">
                                        <span class="toolbar-notification-dot"></span>
                                        <span class="toolbar-notification-text">Changelog</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Position Settings -->
                        <div class="settings-section">
                            <h3>🎯 Position</h3>
                            <div class="setting-item">
                                <label>Toolbar Position:</label>
                                <select id="toolbar-position">
                                    <option value="top-center">Top Center</option>
                                    <option value="top-left">Top Left</option>
                                    <option value="top-right">Top Right</option>
                                    <option value="bottom-center">Bottom Center</option>
                                    <option value="bottom-left">Bottom Left</option>
                                    <option value="bottom-right">Bottom Right</option>
                                </select>
                            </div>
                        </div>

                        <!-- Appearance -->
                        <div class="settings-section">
                            <h3>🎨 Appearance</h3>

                            <div class="setting-item">
                                <label>Theme:</label>
                                <select id="toolbar-theme">
                                    <option value="purple">Purple (Default)</option>
                                    <option value="blue">Blue</option>
                                    <option value="green">Green</option>
                                    <option value="orange">Orange</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </div>

                            <div class="setting-item">
                                <label>Toolbar Opacity: <span class="range-value" id="opacity-value">100%</span></label>
                                <input type="range" id="toolbar-opacity" min="10" max="100" step="5" value="100">
                                <div class="setting-help-text">Adjust transparency of the toolbar</div>
                            </div>

                            <div class="setting-item">
                                <label>Toolbar Button Size: <span class="range-value" id="button-size-value">36px</span></label>
                                <input type="range" id="button-size" min="28" max="48" step="2" value="36">
                                <div class="setting-help-text">Size of the main toolbar button</div>
                            </div>

                            <div class="setting-item">
                                <label>Tool Icon Size: <span class="range-value" id="tool-size-value">32px</span></label>
                                <input type="range" id="tool-size" min="24" max="40" step="2" value="32">
                                <div class="setting-help-text">Size of the tool icons in the menu</div>
                            </div>

                            <div class="setting-item">
                                <label>Menu Gap: <span class="range-value" id="menu-gap-value">8px</span></label>
                                <input type="range" id="menu-gap" min="4" max="16" step="2" value="8">
                                <div class="setting-help-text">Spacing between tool icons</div>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="compact-mode" />
                                    Compact Mode (Smaller overall size)
                                </label>
                            </div>
                        </div>

                        <!-- Animation -->
                        <div class="settings-section">
                            <h3>✨ Animation</h3>

                            <div class="setting-item">
                                <label>Animation Speed: <span class="range-value" id="animation-speed-value">0.3s</span></label>
                                <input type="range" id="animation-speed" min="0.1" max="1.0" step="0.1" value="0.3">
                                <div class="setting-help-text">Speed of menu open/close animation</div>
                            </div>
                        </div>

                        <!-- Behavior -->
                        <div class="settings-section">
                            <h3>⚡ Behavior</h3>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="auto-close" checked />
                                    Auto-close menu after clicking tool
                                </label>
                            </div>

                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="show-tooltips" checked />
                                    Show tooltips on hover
                                </label>
                            </div>
                        </div>

                        <!-- Tool Management -->
                        <div class="settings-section">
                            <h3>🔧 Tools</h3>
                            <div class="setting-item">
                                <label>Active Tools:</label>
                                <div id="tools-list" class="tools-list">
                                    <!-- Will be populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- Data -->
                        <div class="settings-section">
                            <h3>💾 Data</h3>
                            <div class="setting-item">
                                <button id="export-settings" class="btn-secondary">Export Settings</button>
                                <button id="import-settings" class="btn-secondary">Import Settings</button>
                                <button id="reset-settings" class="btn-danger">Reset to Default</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-footer">
                        <button id="save-settings" class="btn-primary">Save Changes</button>
                        <button id="cancel-settings" class="btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        setTimeout(() => {
            loadSettings();
            setupSettingsEventListeners();

            const showChangelog = isNewVersion() && !hasSeenChangelog();
            const changelogNotification = document.getElementById('toolbarChangelogNotification');

            if (showChangelog && changelogNotification) {
                changelogNotification.classList.remove('hidden');
                changelogNotification.onclick = () => {
                    showChangelogModal();
                };
            }

            populateToolsList();
        }, 50);
    }

    function setupSettingsEventListeners() {
        const modal = document.getElementById('toolbar-settings-modal');
        const closeBtn = modal.querySelector('.settings-close');
        const cancelBtn = document.getElementById('cancel-settings');
        const saveBtn = document.getElementById('save-settings');
        const overlay = modal.querySelector('.settings-overlay');

        closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
        cancelBtn.addEventListener('click', () => modal.classList.remove('visible'));
        overlay.addEventListener('click', () => modal.classList.remove('visible'));

        saveBtn.addEventListener('click', () => {
            saveSettings();
            modal.classList.remove('visible');
            location.reload();
        });

        // Range input live updates
        const opacityInput = document.getElementById('toolbar-opacity');
        const opacityValue = document.getElementById('opacity-value');
        opacityInput.addEventListener('input', () => {
            opacityValue.textContent = opacityInput.value + '%';
        });

        const buttonSizeInput = document.getElementById('button-size');
        const buttonSizeValue = document.getElementById('button-size-value');
        buttonSizeInput.addEventListener('input', () => {
            buttonSizeValue.textContent = buttonSizeInput.value + 'px';
        });

        const toolSizeInput = document.getElementById('tool-size');
        const toolSizeValue = document.getElementById('tool-size-value');
        toolSizeInput.addEventListener('input', () => {
            toolSizeValue.textContent = toolSizeInput.value + 'px';
        });

        const animationSpeedInput = document.getElementById('animation-speed');
        const animationSpeedValue = document.getElementById('animation-speed-value');
        animationSpeedInput.addEventListener('input', () => {
            animationSpeedValue.textContent = animationSpeedInput.value + 's';
        });

        const menuGapInput = document.getElementById('menu-gap');
        const menuGapValue = document.getElementById('menu-gap-value');
        menuGapInput.addEventListener('input', () => {
            menuGapValue.textContent = menuGapInput.value + 'px';
        });

        document.getElementById('export-settings').addEventListener('click', exportSettings);
        document.getElementById('import-settings').addEventListener('click', importSettings);
        document.getElementById('reset-settings').addEventListener('click', resetSettings);
    }

    function loadSettings() {
        document.getElementById('toolbar-position').value = getSetting('toolbar-position');
        document.getElementById('toolbar-theme').value = getSetting('toolbar-theme');
        document.getElementById('compact-mode').checked = getSetting('compact-mode');
        document.getElementById('auto-close').checked = getSetting('auto-close');
        document.getElementById('show-tooltips').checked = getSetting('show-tooltips');

        const opacityInput = document.getElementById('toolbar-opacity');
        opacityInput.value = getSetting('toolbar-opacity');
        document.getElementById('opacity-value').textContent = opacityInput.value + '%';

        const buttonSizeInput = document.getElementById('button-size');
        buttonSizeInput.value = getSetting('button-size');
        document.getElementById('button-size-value').textContent = buttonSizeInput.value + 'px';

        const toolSizeInput = document.getElementById('tool-size');
        toolSizeInput.value = getSetting('tool-size');
        document.getElementById('tool-size-value').textContent = toolSizeInput.value + 'px';

        const animationSpeedInput = document.getElementById('animation-speed');
        animationSpeedInput.value = getSetting('animation-speed');
        document.getElementById('animation-speed-value').textContent = animationSpeedInput.value + 's';

        const menuGapInput = document.getElementById('menu-gap');
        menuGapInput.value = getSetting('menu-gap');
        document.getElementById('menu-gap-value').textContent = menuGapInput.value + 'px';
    }

    function saveSettings() {
        setSetting('toolbar-position', document.getElementById('toolbar-position').value);
        setSetting('toolbar-theme', document.getElementById('toolbar-theme').value);
        setSetting('compact-mode', document.getElementById('compact-mode').checked);
        setSetting('auto-close', document.getElementById('auto-close').checked);
        setSetting('show-tooltips', document.getElementById('show-tooltips').checked);
        setSetting('toolbar-opacity', parseInt(document.getElementById('toolbar-opacity').value));
        setSetting('button-size', parseInt(document.getElementById('button-size').value));
        setSetting('tool-size', parseInt(document.getElementById('tool-size').value));
        setSetting('animation-speed', parseFloat(document.getElementById('animation-speed').value));
        setSetting('menu-gap', parseInt(document.getElementById('menu-gap').value));

        alert('✅ Settings saved! The page will reload to apply changes.');
    }

    function populateToolsList() {
        const toolsList = document.getElementById('tools-list');
        const menu = document.getElementById('custom-toolbar-menu');

        if (!menu || !toolsList) return;

        const tools = Array.from(menu.querySelectorAll('.toolbar-item'));

        if (tools.length === 0) {
            toolsList.innerHTML = '<p style="color: #6b7280; font-size: 13px;">No tools installed yet.</p>';
            return;
        }

        toolsList.innerHTML = '';
        tools.forEach(tool => {
            const toolId = tool.getAttribute('data-tool');
            const tooltip = tool.querySelector('.toolbar-item-tooltip');
            const toolName = tooltip ? tooltip.textContent : toolId;

            const toolItem = document.createElement('div');
            toolItem.className = 'tool-item';
            toolItem.innerHTML = `
                <input type="checkbox" checked disabled />
                <span>${toolName}</span>
            `;
            toolsList.appendChild(toolItem);
        });
    }

    function exportSettings() {
        const settings = {};
        Object.keys(DEFAULT_SETTINGS).forEach(key => {
            settings[key] = getSetting(key);
        });

        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'toolbar-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    Object.keys(settings).forEach(key => {
                        setSetting(key, settings[key]);
                    });
                    loadSettings();
                    alert('✅ Settings imported successfully! The page will reload to apply changes.');
                    location.reload();
                } catch (error) {
                    alert('❌ Error importing settings: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            Object.keys(DEFAULT_SETTINGS).forEach(key => {
                GM_deleteValue(key);
            });
            alert('✅ Settings reset to default! The page will reload.');
            location.reload();
        }
    }

    /* ==========================================================
     *  TOOL REGISTRATION
     * ==========================================================*/

    document.addEventListener('addToolbarTool', function(e) {
        const config = e.detail;
        console.log('📥 Received request to add tool:', config.id);
        addToolToMenu(config);
    });

    function addToolToMenu(config) {
        const menu = document.getElementById('custom-toolbar-menu');
        if (!menu) {
            console.error('❌ Menu not found, cannot add tool');
            return;
        }

        const settings = menu.querySelector('[data-tool="settings"]');
        const customTools = Array.from(menu.children).filter(child =>
            child.classList.contains('toolbar-item') &&
            child.getAttribute('data-tool') !== 'settings'
        );

        if (customTools.length === 0) {
            const separator = document.createElement('div');
            separator.className = 'toolbar-separator';
            menu.insertBefore(separator, settings);
        }

        const toolDiv = document.createElement('div');
        toolDiv.className = 'toolbar-item';
        toolDiv.setAttribute('data-tool', config.id);

        if (config.position !== undefined) {
            toolDiv.setAttribute('data-position', config.position);
        }

        toolDiv.innerHTML = `
            ${config.icon}
            <div class="toolbar-item-tooltip">${config.tooltip}</div>
        `;

        toolDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.remove('active');

            document.dispatchEvent(new CustomEvent('toolbarToolClicked', {
                detail: { id: config.id }
            }));
        });

        const separator = settings.previousElementSibling;

        if (config.position === undefined || config.position === null) {
            menu.insertBefore(toolDiv, separator);
        } else {
            const position = parseInt(config.position);
            const allCustomTools = Array.from(menu.children).filter(child =>
                child.classList.contains('toolbar-item') &&
                child.getAttribute('data-tool') !== 'settings'
            );

            let insertBefore = separator;

            for (let i = 0; i < allCustomTools.length; i++) {
                const existingTool = allCustomTools[i];
                const existingPosition = existingTool.getAttribute('data-position');

                if (existingPosition !== null) {
                    const existingPos = parseInt(existingPosition);
                    if (position < existingPos) {
                        insertBefore = existingTool;
                        break;
                    }
                } else {
                    insertBefore = existingTool;
                    break;
                }
            }

            menu.insertBefore(toolDiv, insertBefore);
        }

        console.log('✅ Tool added to menu:', config.id, config.position !== undefined ? `at position ${config.position}` : '(no position)');
    }

    /* ==========================================================
     *  START
     * ==========================================================*/

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToolbar);
    } else {
        initToolbar();
    }

})();