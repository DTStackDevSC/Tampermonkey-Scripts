// ==UserScript==
// @name         Rename Test B
// @namespace    https://github.com/DTStackDevSC/rename-test
// @version      2.0
// @description  Throwaway test: does an update that changes @name keep the same script and its storage?
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/rename-test/rename-test-B.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/rename-test/rename-test-B.user.js
// @match        https://example.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// ==/UserScript==

(function () {
    'use strict';
    // Saved once by the first version that runs; a renamed update must still see it.
    if (!GM_getValue('renameTestSavedBy', '')) GM_setValue('renameTestSavedBy', 'Rename Test B 2.0, ' + new Date().toISOString());
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#667eea;color:#fff;padding:16px 20px;border-radius:10px;font:14px Arial;max-width:420px;box-shadow:0 4px 16px rgba(0,0,0,.3)';
    const lines = [
        'Running: ' + GM_info.script.name + ' v' + GM_info.script.version,
        'Saved value: ' + GM_getValue('renameTestSavedBy', '(none)')
    ];
    for (const l of lines) { const d = document.createElement('div'); d.textContent = l; box.appendChild(d); }
    document.body.appendChild(box);
})();
