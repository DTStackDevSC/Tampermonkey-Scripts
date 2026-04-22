// ==UserScript==
// @name         DLP Entity Input Character Counter
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeDLPEntityCharacterCount.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/NetskopeDLPEntityCharacterCount.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts//
// @version      1.5
// @description  Adds a live character count below the regex/keyword input field in the DLP Edit Entity modal in Netsokpe
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to add character counter to an input element
    function addCharacterCounter(input) {
        // Check if counter already exists
        if (input.nextElementSibling && input.nextElementSibling.classList.contains('char-counter')) {
            return;
        }

        // Create the character counter element
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.style.cssText = 'margin-top: 4px; font-size: 12px; color: #666; font-family: inherit;';
        counter.textContent = `Characters: ${input.value.length}`;

        // Insert counter after the input's parent flex container
        const flexContainer = input.closest('.ns-flex');
        if (flexContainer && flexContainer.parentNode) {
            flexContainer.parentNode.insertBefore(counter, flexContainer.nextSibling);
        }

        // Update counter on input
        input.addEventListener('input', function() {
            counter.textContent = `Characters: ${this.value.length}`;
        });

        // Update counter on any value change (including programmatic)
        const observer = new MutationObserver(function() {
            counter.textContent = `Characters: ${input.value.length}`;
        });

        observer.observe(input, {
            attributes: true,
            attributeFilter: ['value']
        });
    }

    // Function to find and enhance the input field
    function findAndEnhanceInput() {
        const input = document.querySelector('input[placeholder*="Add a regex, keyword or predefined data identifier"]');
        if (input && !input.dataset.counterAdded) {
            input.dataset.counterAdded = 'true';
            addCharacterCounter(input);
        }
    }

    // Initial check
    findAndEnhanceInput();

    // Watch for modal opening and DOM changes
    const observer = new MutationObserver(function(mutations) {
        findAndEnhanceInput();
    });

    // Start observing the document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also check periodically in case the modal is dynamically loaded
    setInterval(findAndEnhanceInput, 1000);
})();