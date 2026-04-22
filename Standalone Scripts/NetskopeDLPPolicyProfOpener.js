// ==UserScript==
// @name         Netskope DLP Profile Open Button
// @namespace    https://gitlab.com/-/snippets/4896559
// @version      1.1.1
// @updateURL    https://gitlab.com/-/snippets/4904912/raw/main/Toolbar-NetskopePolicyToolkit.js
// @downloadURL  https://gitlab.com/-/snippets/4904912/raw/main/Toolbar-NetskopePolicyToolkit.js
// @description  Add open buttons to DLP profile names in Netskope to view profile details
// @author       J.R.
// @match        https://*.goskope.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Netskope DLP Open Script loaded');

    // Get the current base URL
    function getBaseUrl() {
        const origin = window.location.origin;
        return origin;
    }

    // Function to add open buttons to selected profiles
    function addOpenButtons() {
        console.log('Looking for DLP Profile sections...');

        // Find all elements with "DLP Profile = " criteria title
        const criteriaTitles = document.querySelectorAll('.criteria-title');

        criteriaTitles.forEach(title => {
            if (title.textContent.trim() !== 'DLP Profile =') {
                return;
            }

            console.log('Found DLP Profile section');

            // Find the parent ng-select container
            const ngSelect = title.closest('.ng-select-container');
            if (!ngSelect) {
                console.log('No ng-select container found');
                return;
            }

            // Find all profile tags within this container
            const profileTags = ngSelect.querySelectorAll('.ns-picker-tag');

            console.log('Found profile tags in DLP Profile section:', profileTags.length);

            profileTags.forEach((tag, index) => {
                // Check if button already added
                if (tag.querySelector('.dlp-open-btn')) {
                    return;
                }

                // Get the profile name from ng-value-label
                const labelSpan = tag.querySelector('.ng-value-label');
                if (!labelSpan) {
                    console.log('No label found for tag', index);
                    return;
                }

                // Get the title attribute which has the original profile name
                let profileName = labelSpan.getAttribute('title') || labelSpan.textContent.trim();

                if (!profileName) {
                    console.log('No profile name found for tag', index);
                    return;
                }

                // Remove "(custom)" or "(predefined)" from the end for the URL
                const cleanProfileName = profileName.replace(/\s*\((custom|predefined)\)\s*$/i, '').trim();

                console.log('Adding open button for:', cleanProfileName);

                // Create open button
                const openBtn = document.createElement('button');
                openBtn.className = 'dlp-open-btn';
                openBtn.innerHTML = '↗';
                openBtn.title = 'Open profile in new tab';
                openBtn.style.cssText = `
                    margin-left: 6px;
                    padding: 2px 5px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    background: #f5f5f5;
                    cursor: pointer;
                    font-size: 12px;
                    display: inline-block;
                    vertical-align: middle;
                    line-height: 1;
                `;

                // Add hover effect
                openBtn.addEventListener('mouseenter', () => {
                    openBtn.style.background = '#e0e0e0';
                });

                openBtn.addEventListener('mouseleave', () => {
                    if (openBtn.innerHTML === '↗') {
                        openBtn.style.background = '#f5f5f5';
                    }
                });

                // Add click handler
                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    // Encode the clean profile name for URL
                    const encodedProfileName = encodeURIComponent(cleanProfileName);

                    // Build the URL with current base URL
                    const baseUrl = getBaseUrl();
                    const profileUrl = `${baseUrl}/ns#/profiles?profile_name=${encodedProfileName}`;

                    console.log('Opening profile:', profileUrl);
                    console.log('Clean profile name:', cleanProfileName);

                    // Open in new tab
                    window.open(profileUrl, '_blank');

                    // Visual feedback
                    openBtn.innerHTML = '✓';
                    openBtn.style.background = '#4CAF50';
                    openBtn.style.color = 'white';

                    setTimeout(() => {
                        openBtn.innerHTML = '↗';
                        openBtn.style.background = '#f5f5f5';
                        openBtn.style.color = 'inherit';
                    }, 1000);
                });

                // Insert button after the label span (as a sibling, not child)
                labelSpan.insertAdjacentElement('afterend', openBtn);
            });
        });
    }

    // Run with multiple delays to catch different loading states
    let runCount = 0;

    function runAddButtons() {
        runCount++;
        console.log('Run attempt', runCount);
        addOpenButtons();

        if (runCount < 5) {
            setTimeout(runAddButtons, 1000);
        }
    }

    // Start trying
    setTimeout(runAddButtons, 500);

    // Observer to watch for changes
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
                        if (node.classList && node.classList.contains('criteria-title')) {
                            shouldCheck = true;
                        }
                    }
                });
            }
        });

        if (shouldCheck) {
            console.log('New content detected, adding buttons...');
            setTimeout(addOpenButtons, 100);
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Observer started - watching for DLP Profile sections');
})();