// ==UserScript==
// @name         |Toolbar| ServiceNow Toolkit
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowToolkit.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      99.0.0
// @description  Now part of the Tools Toolbar. Keeps your saved data until the toolbar imports it.
// @author       J.R.
// @match        https://*.service-now.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // This tool now lives in the Tools Toolbar. This script only hands its saved data to
    // the toolbar and, when the toolbar is missing, tells the user once where the tool went.

    const TOOL_ID  = 'serviceNowToolkit';
    const SEEN_KEY = TOOL_ID + '-suite-migration-seen';

    // The Tools Toolbar asks for the data this script saved, so it can import it.
    document.addEventListener('toolbarSuiteDataRequest', (e) => {
        const requestId = e.detail && e.detail.requestId;
        if (typeof requestId !== 'string' || !requestId) return;
        const values = {};
        for (const key of GM_listValues()) {
            if (key !== SEEN_KEY) values[key] = GM_getValue(key);
        }
        document.dispatchEvent(new CustomEvent('toolbarSuiteDataResponse', {
            detail: { requestId, toolId: TOOL_ID, protocol: 1, payload: JSON.stringify(values) }
        }));
    });

    function showMergedNotice() {
        if (document.getElementById('toolbarSuiteMergedNotice')) return;
        const style = document.createElement('style');
        style.textContent = '#toolbarSuiteMergedNotice { background-color: #ffffff !important; color: #333333 !important; }';
        document.head.appendChild(style);

        const box = document.createElement('div');
        box.id = 'toolbarSuiteMergedNotice';
        Object.assign(box.style, {
            position: 'fixed', bottom: '60px', right: '20px', zIndex: '2147483000',
            background: '#fff', border: '2px solid #667eea', borderRadius: '10px',
            padding: '14px 18px', maxWidth: '360px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#333', lineHeight: '1.5'
        });
        const title = document.createElement('div');
        title.textContent = '🔧 Script merged';
        Object.assign(title.style, { fontWeight: 'bold', marginBottom: '6px', color: '#667eea' });
        const text = document.createElement('div');
        text.textContent = 'ServiceNow Toolkit is now part of the Tools Toolbar. If you use the Tools Toolbar, it updates by itself and offers to import your ServiceNow Toolkit data: nothing else to do. Otherwise, install the Tools Toolbar from the script installer page, import your data when asked, then uninstall this script.';
        text.style.marginBottom = '10px';
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'Got it';
        Object.assign(ok.style, {
            background: '#667eea', color: '#fff', border: 'none', borderRadius: '5px',
            padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '13px'
        });
        ok.onclick = () => { GM_setValue(SEEN_KEY, true); box.remove(); };
        box.append(title, text, ok);
        document.body.appendChild(box);
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            if (GM_getValue(SEEN_KEY, false)) return;
            if (document.getElementById('custom-toolbar-suite-marker')) return;
            showMergedNotice();
        }, 3000);
    });
})();
