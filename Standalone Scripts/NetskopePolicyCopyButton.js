// ==UserScript==
// @name         Netskope Blue 'Chirps' Copy Button
// @namespace    https://gitlab.com/-/snippets/4896559
// @version      1.1.1
// @updateURL    https://gitlab.com/-/snippets/4904912/raw/main/Toolbar-NetskopePolicyToolkit.js
// @downloadURL  https://gitlab.com/-/snippets/4904912/raw/main/Toolbar-NetskopePolicyToolkit.js
// @description  Add copy buttons to blue 'chirps' in Netskope policies interface.
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Netskope DLP Copy Script loaded');

    // Function to add copy buttons to selected profiles
    function addCopyButtons() {
        console.log('Looking for selected DLP profiles...');

        // Find all selected profile tags
        const profileTags = document.querySelectorAll('.ns-picker-tag');

        console.log('Found profile tags:', profileTags.length);

        profileTags.forEach((tag, index) => {
            // Check if button already added
            if (tag.querySelector('.dlp-copy-btn')) {
                return;
            }

            // Get the profile name from ng-value-label
            const labelSpan = tag.querySelector('.ng-value-label');
            if (!labelSpan) {
                console.log('No label found for tag', index);
                return;
            }

            let profileName = labelSpan.textContent.trim();

            if (!profileName) {
                console.log('No profile name found for tag', index);
                return;
            }

            // Remove "(custom)" or "(predefined)" from the end
            profileName = profileName.replace(/\s*\((custom|predefined)\)\s*$/i, '').trim();

            console.log('Adding button for:', profileName);

            // Create copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'dlp-copy-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy profile name';
            copyBtn.style.cssText = `
                margin-left: 4px;
                padding: 1px 4px;
                border: 1px solid #ccc;
                border-radius: 3px;
                background: #f5f5f5;
                cursor: pointer;
                font-size: 11px;
                display: inline-block;
                vertical-align: middle;
                line-height: 1;
            `;

            // Add hover effect
            copyBtn.addEventListener('mouseenter', () => {
                copyBtn.style.background = '#e0e0e0';
            });

            copyBtn.addEventListener('mouseleave', () => {
                if (copyBtn.innerHTML === '📋') {
                    copyBtn.style.background = '#f5f5f5';
                }
            });

            // Add click handler
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                console.log('Copying:', profileName);

                // Copy to clipboard
                navigator.clipboard.writeText(profileName).then(() => {
                    console.log('Copied successfully');
                    // Visual feedback
                    copyBtn.innerHTML = '✓';
                    copyBtn.style.background = '#4CAF50';
                    copyBtn.style.color = 'white';

                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.style.background = '#f5f5f5';
                        copyBtn.style.color = 'inherit';
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy:', err);

                    // Fallback: use old method
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = profileName;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);

                        copyBtn.innerHTML = '✓';
                        copyBtn.style.background = '#4CAF50';
                        copyBtn.style.color = 'white';

                        setTimeout(() => {
                            copyBtn.innerHTML = '📋';
                            copyBtn.style.background = '#f5f5f5';
                            copyBtn.style.color = 'inherit';
                        }, 1500);
                    } catch(err2) {
                        alert('Failed to copy to clipboard: ' + profileName);
                    }
                });
            });

            // Add button after the label span
            labelSpan.appendChild(copyBtn);
        });
    }

    // Run with multiple delays to catch different loading states
    let runCount = 0;

    function runAddButtons() {
        runCount++;
        console.log('Run attempt', runCount);
        addCopyButtons();

        if (runCount < 5) {
            setTimeout(runAddButtons, 1000);
        }
    }

    // Start trying
    setTimeout(runAddButtons, 500);

    // Observer to watch for changes in the ng-select component
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;

        mutations.forEach((mutation) => {
            // Check if new tags were added
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('ns-picker-tag')) {
                            shouldCheck = true;
                        }
                        if (node.querySelector && node.querySelector('.ns-picker-tag')) {
                            shouldCheck = true;
                        }
                    }
                });
            }
        });

        if (shouldCheck) {
            console.log('New profile tag detected, adding buttons...');
            setTimeout(addCopyButtons, 100);
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Observer started - watching for profile tags');
})();