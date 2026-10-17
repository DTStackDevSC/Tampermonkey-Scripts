// ==UserScript==
// @name         |Toolbar| Domain Extractor
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainExtractor.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-DomainExtractor.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      99.0.0
// @description  Now part of the Tools Toolbar. Keeps your saved data until the toolbar imports it.
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // This tool now lives in the Tools Toolbar. This script only hands its saved data to
    // the toolbar and, when the toolbar is missing, tells the user once where the tool went.

    const TOOL_ID  = 'domainExtractor';
    const SEEN_KEY = TOOL_ID + '-suite-migration-seen';

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
        text.textContent = 'Domain Extractor has been merged into Domain Tools, which is part of the Tools Toolbar. Install the Tools Toolbar from the script installer page, then uninstall this script.';
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
