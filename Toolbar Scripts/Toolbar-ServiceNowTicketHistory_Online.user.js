// ==UserScript==
// @name         |Toolbar| Change Tracker (Online)
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory_Online.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Toolbar%20Scripts/Toolbar-ServiceNowTicketHistory_Online.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @version      1.13.0
// @description  Structured per-ticket change audit log for ServiceNow / Netskope tickets — shared team-wide via Cloudflare Worker + D1, with auto-write to ticket worknotes/comments
// @author       J.R.
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/now/nav/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('📝 Change Tracker loading...');

    /* ==========================================================
     *  VERSION
     * ==========================================================*/

    const SCRIPT_VERSION = '1.13.0';
    const CHANGELOG = `Version 1.13.0:
- DLP Policy and DLP Process Exception entries now generate ticket notes and show the "Write" button, just like the other entry types. Creating one of these entries auto-writes to the worknote and comments fields, and you can also write it manually from the entry card.

Version 1.12.1:
- Field titles in entry cards (for example "Policy Name:", "Source:") are now displayed in bold, making it easier to distinguish titles from their values at a glance.

Version 1.12.0:
- Added a new "Constraints" group with a "User Constraint" entry type. Use it to record when a user constraint is configured on a DLP policy: it captures the constraint name and the list of users it applies to.
- Added a new "File Profiles" group with Added, Modified, and Removed entry types. Each entry captures the file profile name along with its configuration: name pattern or extension, file type, file hash, object ID, file size, protection status, and sensitivity label.
- Added a new "DLP Profiles" group with Added, Modified, and Removed entry types. Each entry captures the profile name, the associated file profile, and the content rules.

Version 1.11.0:
- Added a new "Handover Note" entry type under a dedicated Handover group in the change-type dropdown. Use it to record context when passing a ticket to another technician: who it is going to, the current status, and the next steps. Handover notes are stored and synced with the team log like any other entry type.

Version 1.10.3:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 1.10.2:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 1.10.1:
- Certified Pinned App entries now capture platform and binary information together. Each line in the Platforms and Binaries field represents one combination, for example "Windows - chrome.exe" or "MacOS - chrome". Multiple platforms for the same app are entered one per line.

Version 1.10.0:
- Added a new "Certified Pinned Apps" group with three entry types: Certified Pinned App Added, Certified Pinned App Edited, and Certified Pinned App Removed. Each entry captures the app name and platform. Added and Edited entries auto-write to the ticket worknote and comments fields. Removed entries auto-write a removal notice.

Version 1.9.3:
- Fixed an intermittent Firefox issue where the script would silently abort on load, preventing the toolbar button from appearing. Style injection is now deferred until the page head is ready.

Version 1.9.2:
- Fixed a Firefox-specific issue where the toolbar button would occasionally not appear when opening a ticket, caused by the style block being injected before the page head was ready.

Version 1.9.1:
- Removed "Additional Details" from the Destination extra fields on policies,
  as the entry-level "Additional Details" field at the bottom covers that need.

Version 1.9.0:
- All structured entry types now have an "+ Add field" button at the bottom
  of the form. Clicking it reveals an "Additional Details" free-text area
  where you can write any extra information not covered by the other fields.
  The value is saved with the entry, shown in the entry card, included in
  worknote auto-write, and pre-filled when editing.

Version 1.8.2:
- Steering Config entries no longer show extra fields under Source.

Version 1.8.1:
- DLP Policy entries now show different optional fields: no extra fields under
  Source, and Destination offers Activity Constraints and File Constraints only.
  The full set of Source and Destination extras remains on regular policies.

Version 1.8.0:
- Policy, DLP Policy, and Steering Config entries now have an "+ Add fields"
  button below Source and below Destination. Clicking it opens a panel of
  optional fields you can add one by one: Source has Source IP, Source IP
  (Egress), Source Country, OS Family, Browsers, Access Method, Device
  Classification, and HTTP Header. Destination has App Instance, Destination
  Country, and Additional Details. Each added field can be removed with the
  × button next to it. Fields added this way are saved and displayed alongside
  the other entry details.

Version 1.7.2:
- The "AD group" field on policy, DLP policy, and steering config entries has been renamed to "Source" to better reflect that it can hold values other than AD groups.
- Existing entries that were saved with the old field name are migrated automatically on first load, so no data is lost.

Version 1.7.1:
- Searchable dropdown group headers now use a filled background with top and
  bottom borders, matching the section title style from the Response Helper.

Version 1.7.0:
- Added a searchable snippet dropdown that replaces the native change-type
  select in the sidebar and edit modal. Typing filters by group name or item
  label: searching "dlp" shows all items under "DLP Policies" and "DLP
  Process Exceptions". The search input is auto-focused whenever the
  dropdown is opened.
- The feature is enabled by default and can be toggled off in the settings
  modal via a new "Searchable change-type dropdown" checkbox.

Version 1.6.0:
- Added DLP Process Exceptions group with "DLP Process Exception Added" and
  "DLP Process Exception Removed" change types. Each entry captures Process
  executable path, Operating System, and Description.

Version 1.5.4:
- Added automatic local cache expiry: ticket logs not opened within the
  configured number of days are deleted from GM storage on startup. The
  server copy is never affected and reloads on next open.
- Cache expiry is configurable in the settings modal (default 30 days).
  A warning appears if the value is set above 30 days.

Version 1.5.3:
- Fixed new entries showing "unknown" as the author immediately after being added.
  After a successful push the script now re-syncs from the server so the
  server-assigned author label is in the local cache before the log re-renders.

Version 1.5.2:
- Fixed dark mode compatibility: sidebar, edit modal, and setup modal now force light
  backgrounds and dark text via CSS with !important so ServiceNow dark mode cannot
  override script UI inputs, selects, and textareas.

Version 1.5.1:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 1.5.0:
- Added support for tickets opened from the ServiceNow dashboard (Polaris mode).
  All ticket field access, activity stream detection, and mention insertion now
  route through the shadow DOM iframe when the tool is opened from the dashboard,
  and fall back to the classic direct-access path when opened in a new tab.

Version 1.4.4:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.
- Toolbar button now shows a pulsing notification dot when a new version
  is available and has not been seen yet.

Version 1.4.3:
- Entry IDs now use crypto.randomUUID() instead of a Math.random()-based generator, making IDs cryptographically unpredictable.`;

    /* ==========================================================
     *  OPTIONAL EXTRA FIELDS
     *  Attached to specific schema fields via extraFields:[].
     *  Shown via an "+ Add fields" button; stored alongside main fields.
     * ==========================================================*/

    const SOURCE_EXTRA_FIELDS = [
        { key: 'sourceIp',             label: 'Source IP'             },
        { key: 'sourceIpEgress',       label: 'Source IP (Egress)'    },
        { key: 'sourceCountry',        label: 'Source Country'        },
        { key: 'osFamily',             label: 'OS Family'             },
        { key: 'browsers',             label: 'Browsers'              },
        { key: 'accessMethod',         label: 'Access Method'         },
        { key: 'deviceClassification', label: 'Device Classification' },
        { key: 'httpHeader',           label: 'HTTP Header'           },
    ];

    const DESTINATION_EXTRA_FIELDS = [
        { key: 'appInstance',        label: 'App Instance'        },
        { key: 'destinationCountry', label: 'Destination Country' },
    ];

    const DESTINATION_DLP_EXTRA_FIELDS = [
        { key: 'activityConstraints', label: 'Activity Constraints' },
        { key: 'fileConstraints',     label: 'File Constraints'     },
    ];

    /* ==========================================================
     *  FIELD SCHEMAS
     *  Each schema is an array of { key, label, type:'text'|'textarea' }
     * ==========================================================*/

    const FIELD_SCHEMAS = {
        policy_full: [
            { key: 'policyName',    label: 'Policy name',        type: 'text'     },
            { key: 'source',        label: 'Source',             type: 'text',     extraFields: SOURCE_EXTRA_FIELDS      },
            { key: 'destination',   label: 'Destination',        type: 'text',     extraFields: DESTINATION_EXTRA_FIELDS },
            { key: 'description',   label: 'Policy description', type: 'textarea' },
            { key: 'groupPosition', label: 'Group position',     type: 'text'     },
            { key: 'action',        label: 'Action',             type: 'text'     },
        ],
        policy_deleted: [
            { key: 'policyName',    label: 'Policy name',        type: 'text'     },
        ],
        dlp_policy_full: [
            { key: 'policyName',    label: 'Policy name',        type: 'text'     },
            { key: 'source',        label: 'Source',             type: 'text'     },
            { key: 'destination',   label: 'Destination',        type: 'text',     extraFields: DESTINATION_DLP_EXTRA_FIELDS },
            { key: 'activities',    label: 'Activities',         type: 'text'     },
            { key: 'profileAction', label: 'Profile & Action',   type: 'text'     },
            { key: 'dlpProfile',    label: 'DLP Profile',        type: 'text'     },
            { key: 'action',        label: 'Action',             type: 'text'     },
            { key: 'description',   label: 'Policy Description', type: 'textarea' },
            { key: 'groupPosition', label: 'Group position',     type: 'text'     },
        ],
        ssl_policy: [
            { key: 'sslPolicyName', label: 'SSL Policy name', type: 'text'     },
            { key: 'domains',       label: 'Domains',          type: 'textarea' },
        ],
        steering_exception: [
            { key: 'urlsOrNetwork',   label: 'URLs / Network Location', type: 'textarea' },
            { key: 'steeringApplied', label: 'Steering/s applied to',   type: 'text'     },
        ],
        app_exception: [
            { key: 'app',             label: 'App',                     type: 'text' },
            { key: 'steeringApplied', label: 'Steering/s applied to',   type: 'text' },
        ],
        steering_config_full: [
            { key: 'configName',    label: 'Steering/Client Config name',      type: 'text' },
            { key: 'source',        label: 'Source',                           type: 'text' },
            { key: 'partnerTenant', label: 'Partner Tenant Access configured', type: 'text' },
        ],
        steering_config_deleted: [
            { key: 'configName',    label: 'Steering/Client Config name',      type: 'text' },
        ],
        url_list: [
            { key: 'urlListName', label: 'URL List name', type: 'text'     },
            { key: 'domains',     label: 'Domains',       type: 'textarea' },
        ],
        network_location: [
            { key: 'locationName', label: 'Network Location name', type: 'text'     },
            { key: 'ips',          label: 'IPs',                   type: 'textarea' },
        ],
        custom_category: [
            { key: 'categoryName', label: 'Custom Category name', type: 'text'     },
            { key: 'urlLists',     label: 'URL Lists',            type: 'textarea' },
        ],
        user_notification: [
            { key: 'notificationName', label: 'Notification name', type: 'text' },
        ],
        custom_app_full: [
            { key: 'appName',  label: 'App name',  type: 'text'     },
            { key: 'appType',  label: 'App type',  type: 'select',  options: ['Predefined', 'Universal Connector', 'Custom Connector'] },
            { key: 'domains',  label: 'Domains',   type: 'textarea' },
        ],
        custom_app_deleted: [
            { key: 'appName', label: 'App name', type: 'text' },
        ],
        recat_request: [
            { key: 'urlRequested',        label: 'URL Requested',        type: 'text' },
            { key: 'categoriesRequested', label: 'Categories requested', type: 'text' },
        ],
        dlp_process_exception: [
            { key: 'processPath',      label: 'Process executable path', type: 'text'     },
            { key: 'operatingSystem',  label: 'Operating System',        type: 'text'     },
            { key: 'description',      label: 'Description',             type: 'textarea' },
        ],
        certified_pinned_app_full: [
            { key: 'appName',   label: 'App name',               type: 'text'     },
            { key: 'platforms', label: 'Platforms and Binaries', type: 'textarea' },
        ],
        certified_pinned_app_removed: [
            { key: 'appName', label: 'App name', type: 'text' },
        ],
        handover_note: [
            { key: 'handoverTo',    label: 'Handing over to', type: 'text'     },
            { key: 'currentStatus', label: 'Current status',  type: 'textarea' },
            { key: 'nextSteps',     label: 'Next steps',      type: 'textarea' },
        ],
        constraint_user: [
            { key: 'name',  label: 'Name', type: 'text'     },
            { key: 'users', label: 'User', type: 'textarea' },
        ],
        file_profile_full: [
            { key: 'name',               label: 'Name',                type: 'text' },
            { key: 'nameOrExtension',    label: 'Name or extension',   type: 'text' },
            { key: 'fileType',           label: 'File Type',           type: 'text' },
            { key: 'fileHash',           label: 'File Hash',           type: 'text' },
            { key: 'objectId',           label: 'Object ID',           type: 'text' },
            { key: 'fileSize',           label: 'File Size',           type: 'text' },
            { key: 'protectedEncrypted', label: 'Protected/Encrypted', type: 'text' },
            { key: 'sensitivityLabel',   label: 'Sensitivity Label',   type: 'text' },
        ],
        file_profile_deleted: [
            { key: 'name', label: 'Name', type: 'text' },
        ],
        dlp_profile_full: [
            { key: 'name',         label: 'Name',          type: 'text'     },
            { key: 'fileProfile',  label: 'File Profile',  type: 'text'     },
            { key: 'contentRules', label: 'Content Rules', type: 'textarea' },
        ],
        dlp_profile_deleted: [
            { key: 'name', label: 'Name', type: 'text' },
        ],
    };

    /* ==========================================================
     *  SNIPPET GROUPS  (drives dropdown optgroups + all lookups)
     *  schema: null  → freeform textarea
     *  schema: 'key' → renders FIELD_SCHEMAS[key]
     * ==========================================================*/

    const SNIPPET_GROUPS = [
        {
            group: 'Policies',
            items: [
                { label: 'Policy Created',  value: 'Policy Created',  color: '#007bff', schema: 'policy_full'    },
                { label: 'Policy Modified', value: 'Policy Modified', color: '#6610f2', schema: 'policy_full'    },
                { label: 'Policy Deleted',  value: 'Policy Deleted',  color: '#c0392b', schema: 'policy_deleted' },
            ],
        },
        {
            group: 'DLP Policies',
            items: [
                { label: 'DLP Policy Created',  value: 'DLP Policy Created',  color: '#007bff', schema: 'dlp_policy_full' },
                { label: 'DLP Policy Modified', value: 'DLP Policy Modified', color: '#6610f2', schema: 'dlp_policy_full' },
                { label: 'DLP Policy Deleted',  value: 'DLP Policy Deleted',  color: '#c0392b', schema: 'policy_deleted'  },
            ],
        },
        {
            group: 'DLP Process Exceptions',
            items: [
                { label: 'DLP Process Exception Added',   value: 'DLP Process Exception Added',   color: '#28a745', schema: 'dlp_process_exception' },
                { label: 'DLP Process Exception Removed', value: 'DLP Process Exception Removed', color: '#dc3545', schema: 'dlp_process_exception' },
            ],
        },
        {
            group: 'URL Lists',
            items: [
                { label: 'URL List Created',       value: 'URL List Created',       color: '#28a745', schema: 'url_list' },
                { label: 'URL List — URLs Added',  value: 'URL List — URLs Added',  color: '#20c997', schema: 'url_list' },
                { label: 'URL List — URLs Removed',value: 'URL List — URLs Removed',color: '#fd7e14', schema: 'url_list' },
                { label: 'URL List Removed',       value: 'URL List Removed',       color: '#dc3545', schema: 'url_list' },
            ],
        },
        {
            group: 'Network Locations',
            items: [
                { label: 'Network Location Created',        value: 'Network Location Created',        color: '#28a745', schema: 'network_location' },
                { label: 'Network Location — IPs Added',    value: 'Network Location — IPs Added',    color: '#17a2b8', schema: 'network_location' },
                { label: 'Network Location — IPs Removed',  value: 'Network Location — IPs Removed',  color: '#fd7e14', schema: 'network_location' },
                { label: 'Network Location Removed',        value: 'Network Location Removed',        color: '#dc3545', schema: 'network_location' },
            ],
        },
        {
            group: 'Custom Categories',
            items: [
                { label: 'Custom Category Created',                value: 'Custom Category Created',                color: '#28a745', schema: 'custom_category' },
                { label: 'Custom Category — URL Lists Added',      value: 'Custom Category — URL Lists Added',      color: '#20c997', schema: 'custom_category' },
                { label: 'Custom Category — URL Lists Removed',    value: 'Custom Category — URL Lists Removed',    color: '#fd7e14', schema: 'custom_category' },
                { label: 'Custom Category Removed',                value: 'Custom Category Removed',                color: '#dc3545', schema: 'custom_category' },
            ],
        },
        {
            group: 'SSL Decryption',
            items: [
                { label: 'SSL Decryption Policy Created',       value: 'SSL Decryption Policy Created',       color: '#28a745', schema: 'ssl_policy' },
                { label: 'SSL Decryption — URLs Added',        value: 'SSL Decryption — URLs Added',         color: '#17a2b8', schema: 'ssl_policy' },
                { label: 'SSL Decryption — URLs Removed',      value: 'SSL Decryption — URLs Removed',       color: '#fd7e14', schema: 'ssl_policy' },
                { label: 'SSL Decryption Policy Removed',      value: 'SSL Decryption Policy Removed',       color: '#c0392b', schema: 'ssl_policy' },
            ],
        },
        {
            group: 'Steering Exceptions',
            items: [
                { label: 'Steering Exception Added',   value: 'Steering Exception Added',   color: '#28a745', schema: 'steering_exception' },
                { label: 'Steering Exception Removed', value: 'Steering Exception Removed', color: '#e74c3c', schema: 'steering_exception' },
            ],
        },
        {
            group: 'App Exceptions',
            items: [
                { label: 'App Exception Added',   value: 'App Exception Added',   color: '#20c997', schema: 'app_exception' },
                { label: 'App Exception Removed', value: 'App Exception Removed', color: '#fd7e14', schema: 'app_exception' },
            ],
        },
        {
            group: 'Steering / Client Configs',
            items: [
                { label: 'Steering/Client Config Created',  value: 'Steering/Client Config Created',  color: '#007bff', schema: 'steering_config_full'    },
                { label: 'Steering/Client Config Modified', value: 'Steering/Client Config Modified', color: '#6f42c1', schema: 'steering_config_full'    },
                { label: 'Steering/Client Config Deleted',  value: 'Steering/Client Config Deleted',  color: '#c0392b', schema: 'steering_config_deleted' },
            ],
        },
        {
            group: 'User Notifications',
            items: [
                { label: 'User Notification Added',    value: 'User Notification Added',    color: '#28a745', schema: 'user_notification' },
                { label: 'User Notification Modified', value: 'User Notification Modified', color: '#6610f2', schema: 'user_notification' },
                { label: 'User Notification Removed',  value: 'User Notification Removed',  color: '#dc3545', schema: 'user_notification' },
            ],
        },
        {
            group: 'Custom Apps',
            items: [
                { label: 'Custom App Added',   value: 'Custom App Added',   color: '#007bff', schema: 'custom_app_full'    },
                { label: 'Custom App Edited',  value: 'Custom App Edited',  color: '#6f42c1', schema: 'custom_app_full'    },
                { label: 'Custom App Removed', value: 'Custom App Removed', color: '#c0392b', schema: 'custom_app_deleted' },
            ],
        },
        {
            group: 'Certified Pinned Apps',
            items: [
                { label: 'Certified Pinned App Added',   value: 'Certified Pinned App Added',   color: '#007bff', schema: 'certified_pinned_app_full'    },
                { label: 'Certified Pinned App Edited',  value: 'Certified Pinned App Edited',  color: '#6f42c1', schema: 'certified_pinned_app_full'    },
                { label: 'Certified Pinned App Removed', value: 'Certified Pinned App Removed', color: '#c0392b', schema: 'certified_pinned_app_removed' },
            ],
        },
        {
            group: 'Recategorization',
            items: [
                { label: 'Recategorization Request', value: 'Recategorization Request', color: '#17a2b8', schema: 'recat_request' },
            ],
        },
        {
            group: 'Constraints',
            items: [
                { label: 'User Constraint', value: 'User Constraint', color: '#17a2b8', schema: 'constraint_user' },
            ],
        },
        {
            group: 'File Profiles',
            items: [
                { label: 'File Profile Added',    value: 'File Profile Added',    color: '#28a745', schema: 'file_profile_full'    },
                { label: 'File Profile Modified', value: 'File Profile Modified', color: '#6610f2', schema: 'file_profile_full'    },
                { label: 'File Profile Removed',  value: 'File Profile Removed',  color: '#dc3545', schema: 'file_profile_deleted' },
            ],
        },
        {
            group: 'DLP Profiles',
            items: [
                { label: 'DLP Profile Added',    value: 'DLP Profile Added',    color: '#007bff', schema: 'dlp_profile_full'    },
                { label: 'DLP Profile Modified', value: 'DLP Profile Modified', color: '#6610f2', schema: 'dlp_profile_full'    },
                { label: 'DLP Profile Removed',  value: 'DLP Profile Removed',  color: '#c0392b', schema: 'dlp_profile_deleted' },
            ],
        },
        {
            group: 'Handover',
            items: [
                { label: 'Handover Note', value: 'Handover Note', color: '#e67e22', schema: 'handover_note' },
            ],
        },
        {
            group: 'General',
            items: [
                { label: 'Custom', value: 'Custom', color: '#343a40', schema: null },
            ],
        },
    ];

    // Flat SNIPPETS list (for code that needs to iterate all items)
    const SNIPPETS = SNIPPET_GROUPS.flatMap(g => g.items);

    // Fast value → snippet lookup
    const SNIPPET_MAP = {};
    SNIPPETS.forEach(s => { SNIPPET_MAP[s.value] = s; });

    function getSnippet(type)   { return SNIPPET_MAP[type] || null; }
    function getSchemaKey(type) { return getSnippet(type)?.schema || null; }
    function getSchema(type)    { const k = getSchemaKey(type); return k ? (FIELD_SCHEMAS[k] || null) : null; }
    function typeColor(type)    { return getSnippet(type)?.color || '#495057'; }

    /**
     * Populates a <select> element with optgroup-organised options.
     * @param {HTMLSelectElement} selectEl
     * @param {string}  selectedValue  - pre-select this value ('' for none)
     * @param {boolean} addPlaceholder - prepend the "— Select —" blank option
     */
    function populateSnippetSelect(selectEl, selectedValue, addPlaceholder) {
        selectEl.innerHTML = '';
        if (addPlaceholder) {
            const ph = mk('option'); ph.value = ''; ph.textContent = '— Select a change type —';
            selectEl.appendChild(ph);
        }
        SNIPPET_GROUPS.forEach(({ group, items }) => {
            const grp = document.createElement('optgroup');
            grp.label = group;
            items.forEach(s => {
                const opt = mk('option');
                opt.value = s.value; opt.textContent = s.label;
                if (s.value === selectedValue) opt.selected = true;
                grp.appendChild(opt);
            });
            selectEl.appendChild(grp);
        });
    }

    /**
     * Returns a native <select> or a custom searchable snippet dropdown
     * depending on the searchable-dropdown setting. Either way the returned
     * element has `.value` (get/set), `.disabled` (get/set), and dispatches
     * a native 'change' event on selection — same API as a native <select>.
     */
    function makeSnippetSelect(id, selectedValue, addPlaceholder) {
        if (!getSearchableDropdown()) {
            const sel = css(mk('select', { id }), {
                width:'100%', padding:'7px 10px', borderRadius:'4px', border:'1px solid #ccc',
                fontSize:'12px', fontFamily:'Arial, sans-serif', marginBottom:'8px',
                background:'#fff', color:'#333', boxSizing:'border-box', cursor:'pointer'
            });
            populateSnippetSelect(sel, selectedValue, addPlaceholder);
            return sel;
        }

        const container = mk('div', { id });
        Object.assign(container.style, {
            position:'relative', width:'100%', marginBottom:'8px', boxSizing:'border-box'
        });

        let _value    = selectedValue || '';
        let _disabled = false;

        const trigger = mk('button', { type:'button' });
        trigger.className = 'ct-cs-trigger';

        const triggerText = mk('span');
        Object.assign(triggerText.style, { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:'1', textAlign:'left' });
        const triggerArrow = mk('span');
        triggerArrow.className = 'ct-cs-arrow';
        triggerArrow.textContent = '▼';
        trigger.append(triggerText, triggerArrow);

        const dropdown = mk('div');
        dropdown.className = 'ct-cs-dropdown';
        dropdown.style.display = 'none';

        const searchInput = mk('input', { type:'text', placeholder:'Type to filter...' });
        searchInput.className = 'ct-cs-search';

        const listEl = mk('ul');
        listEl.className = 'ct-cs-list';

        function labelForValue(v) {
            if (!v) return addPlaceholder ? '— Select a change type —' : '';
            return getSnippet(v)?.label || v;
        }

        function updateTriggerText() { triggerText.textContent = labelForValue(_value); }
        updateTriggerText();

        function renderList(filter) {
            listEl.innerHTML = '';
            const q = filter.toLowerCase();
            let hasAny = false;
            SNIPPET_GROUPS.forEach(({ group, items }) => {
                const groupMatch   = group.toLowerCase().includes(q);
                const visibleItems = groupMatch ? items : items.filter(s => s.label.toLowerCase().includes(q));
                if (!visibleItems.length) return;
                hasAny = true;
                const header = mk('li');
                header.className = 'ct-cs-group-header';
                header.textContent = group;
                listEl.appendChild(header);
                visibleItems.forEach(s => {
                    const li = mk('li');
                    li.className = 'ct-cs-item' + (s.value === _value ? ' ct-cs-selected' : '');
                    li.textContent = s.label;
                    li.dataset.value = s.value;
                    li.addEventListener('mousedown', e => {
                        e.preventDefault();
                        pickOption(s.value);
                        closeDropdown();
                        trigger.focus();
                    });
                    listEl.appendChild(li);
                });
            });
            if (!hasAny) {
                const li = mk('li');
                li.className = 'ct-cs-no-results';
                li.textContent = 'No results';
                listEl.appendChild(li);
            }
        }

        function pickOption(v) {
            _value = v;
            updateTriggerText();
            container.dispatchEvent(new Event('change', { bubbles:true }));
        }

        function openDropdown() {
            if (_disabled) return;
            document.querySelectorAll('.ct-cs-dropdown').forEach(dd => {
                if (dd !== dropdown && dd.style.display !== 'none') {
                    dd.style.display = 'none';
                    dd.parentElement?.querySelector('.ct-cs-trigger')?.classList.remove('ct-cs-open');
                }
            });
            dropdown.style.display = 'block';
            trigger.classList.add('ct-cs-open');
            searchInput.value = '';
            renderList('');
            setTimeout(() => {
                searchInput.focus();
                listEl.querySelector('.ct-cs-selected')?.scrollIntoView({ block:'nearest' });
            }, 0);
        }

        function closeDropdown() {
            dropdown.style.display = 'none';
            trigger.classList.remove('ct-cs-open');
        }

        trigger.addEventListener('click', e => {
            e.stopPropagation();
            dropdown.style.display === 'none' ? openDropdown() : closeDropdown();
        });

        searchInput.addEventListener('input', () => renderList(searchInput.value));

        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); closeDropdown(); trigger.focus(); return; }
            const items = [...listEl.querySelectorAll('.ct-cs-item')];
            if (!items.length) return;
            const highlighted = listEl.querySelector('.ct-cs-highlighted');
            const idx = highlighted ? items.indexOf(highlighted) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items.forEach(i => i.classList.remove('ct-cs-highlighted'));
                const next = items[Math.min(idx + 1, items.length - 1)];
                if (next) { next.classList.add('ct-cs-highlighted'); next.scrollIntoView({ block:'nearest' }); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items.forEach(i => i.classList.remove('ct-cs-highlighted'));
                const prev = items[Math.max(idx - 1, 0)];
                if (prev) { prev.classList.add('ct-cs-highlighted'); prev.scrollIntoView({ block:'nearest' }); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = highlighted || items[0];
                if (target?.dataset.value !== undefined) { pickOption(target.dataset.value); closeDropdown(); trigger.focus(); }
            }
        });

        document.addEventListener('click', e => { if (!container.contains(e.target)) closeDropdown(); });

        Object.defineProperty(container, 'value', {
            get() { return _value; },
            set(v) { _value = v || ''; updateTriggerText(); },
            configurable: true
        });
        Object.defineProperty(container, 'disabled', {
            get()  { return _disabled; },
            set(v) { _disabled = !!v; trigger.disabled = !!v; if (v) closeDropdown(); },
            configurable: true
        });
        container.focus = () => trigger.focus();

        dropdown.append(searchInput, listEl);
        container.append(trigger, dropdown);
        return container;
    }

    /* ==========================================================
     *  CATEGORY GROUPS  (for grouped summary)
     * ==========================================================*/

    const CATEGORY_GROUPS = [
        { label: 'Policy Changes',              types: ['Policy Created', 'Policy Modified', 'Policy Deleted'] },
        { label: 'DLP Policy Changes',          types: ['DLP Policy Created', 'DLP Policy Modified', 'DLP Policy Deleted'] },
        { label: 'DLP Process Exceptions',      types: ['DLP Process Exception Added', 'DLP Process Exception Removed'] },
        { label: 'URL Lists',                   types: ['URL List Created', 'URL List — URLs Added', 'URL List — URLs Removed', 'URL List Removed'] },
        { label: 'Network Locations',           types: ['Network Location Created', 'Network Location — IPs Added', 'Network Location — IPs Removed', 'Network Location Removed'] },
        { label: 'Custom Categories',           types: ['Custom Category Created', 'Custom Category — URL Lists Added', 'Custom Category — URL Lists Removed', 'Custom Category Removed'] },
        { label: 'SSL Decryption Policies',     types: ['SSL Decryption Policy Created', 'SSL Decryption — URLs Added', 'SSL Decryption — URLs Removed', 'SSL Decryption Policy Removed'] },
        { label: 'Steering Exceptions',         types: ['Steering Exception Added', 'Steering Exception Removed'] },
        { label: 'App Exceptions',              types: ['App Exception Added', 'App Exception Removed'] },
        { label: 'Steering / Client Configs',   types: ['Steering/Client Config Created', 'Steering/Client Config Modified', 'Steering/Client Config Deleted'] },
        { label: 'User Notifications',          types: ['User Notification Added', 'User Notification Modified', 'User Notification Removed'] },
        { label: 'Custom Apps',                 types: ['Custom App Added', 'Custom App Edited', 'Custom App Removed'] },
        { label: 'Certified Pinned Apps',       types: ['Certified Pinned App Added', 'Certified Pinned App Edited', 'Certified Pinned App Removed'] },
        { label: 'Recategorization Requests',   types: ['Recategorization Request'] },
        { label: 'Constraints',                 types: ['User Constraint'] },
        { label: 'File Profiles',               types: ['File Profile Added', 'File Profile Modified', 'File Profile Removed'] },
        { label: 'DLP Profiles',                types: ['DLP Profile Added', 'DLP Profile Modified', 'DLP Profile Removed'] },
        { label: 'Handover Notes',              types: ['Handover Note'] },
        { label: 'Other',                       types: ['Custom'] },
    ];

    /* ==========================================================
     *  VERSION MANAGEMENT
     * ==========================================================*/

    function getStoredVersion()    { return GM_getValue('changeTrackerVersion', null); }
    function saveVersion(v)        { GM_setValue('changeTrackerVersion', v); }
    function hasSeenChangelog()    { return GM_getValue('changeTrackerChangelogSeen', null) === SCRIPT_VERSION; }
    function markChangelogAsSeen() { GM_setValue('changeTrackerChangelogSeen', SCRIPT_VERSION); }

    // Auto-write toggle: when enabled, adding an entry also writes the
    // equivalent text into the SNow ticket worknote/comments fields.
    // Default ON. Stored as boolean in GM.
    const AUTO_WRITE_KEY = 'changeTrackerAutoWriteEnabled';
    function getAutoWriteEnabled()  { return GM_getValue(AUTO_WRITE_KEY, true) !== false; }
    function setAutoWriteEnabled(v) { GM_setValue(AUTO_WRITE_KEY, !!v); }

    const CACHE_TTL_KEY = 'changeTrackerCacheTtlDays';
    const CACHE_TTL_DEFAULT = 30;
    const CACHE_TTL_WARN_THRESHOLD = 30;
    function getCacheTtlDays()  { return Number(GM_getValue(CACHE_TTL_KEY, CACHE_TTL_DEFAULT)) || CACHE_TTL_DEFAULT; }
    function setCacheTtlDays(v) { GM_setValue(CACHE_TTL_KEY, Math.max(1, Number(v) || CACHE_TTL_DEFAULT)); }

    const SEARCHABLE_DROPDOWN_KEY = 'changeTrackerSearchableDropdown';
    function getSearchableDropdown()  { return GM_getValue(SEARCHABLE_DROPDOWN_KEY, true) !== false; }
    function setSearchableDropdown(v) { GM_setValue(SEARCHABLE_DROPDOWN_KEY, !!v); }

    function compareVersions(v1, v2) {
        if (!v1) return true;
        const p1 = v1.split('.').map(Number), p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            if ((p2[i]||0) > (p1[i]||0)) return true;
            if ((p2[i]||0) < (p1[i]||0)) return false;
        }
        return false;
    }

    function isNewVersion() { return compareVersions(getStoredVersion(), SCRIPT_VERSION); }

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
        const overlay = mk('div', { id: 'ct-changelog-overlay' });
        const modal   = mk('div', { id: 'ct-changelog-modal'   });

        const h2 = mk('h2');
        h2.textContent = `What's New — v${SCRIPT_VERSION}`;

        const info = mk('div', { className: 'ct-cl-info' });
        info.textContent = `Updated to version ${SCRIPT_VERSION}!`;

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

        const btn = mk('button', { className: 'ct-cl-ok' });
        btn.textContent = 'Got it!';
        btn.onclick = () => {
            overlay.remove(); modal.remove();
            markChangelogAsSeen(); saveVersion(SCRIPT_VERSION);
            document.getElementById('ct-changelog-dot')?.remove();
            removeToolbarNotificationDot();
        };

        modal.append(h2, info, cardsWrap, btn);
        document.body.append(overlay, modal);
        overlay.onclick = () => btn.click();
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* ── Z-INDEX NOTES ──────────────────────────────────────
         * Toolbar / Mini Summary Sidebar : 999997–999998
         * Change Tracker sidebar         : 999997  (peer)
         * Edit / Setup modal             : 1050000
         * Confirm modal                  : 1100000
         * Changelog overlay/modal        : 20000/20001
         * ─────────────────────────────────────────────────────*/

        #ct-changelog-dot {
            display: inline-flex !important; align-items: center !important;
            gap: 6px !important; cursor: pointer !important;
            margin-left: 10px !important; padding: 3px 8px !important;
            border-radius: 4px !important; transition: background-color .2s !important;
        }
        #ct-changelog-dot:hover { background: rgba(40,167,69,.1) !important; }
        #ct-changelog-dot .ct-dot {
            width: 8px !important; height: 8px !important; border-radius: 50% !important;
            animation: ctPulse 1s ease-in-out infinite !important;
        }
        @keyframes ctPulse { 0%,100% { background-color:#28a745; } 50% { background-color:#ff8c00; } }
        #ct-changelog-dot .ct-dot-label {
            font-size: 11px !important; color: #28a745 !important;
            text-decoration: underline !important; font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal {
            position: fixed !important; top: 50% !important; left: 50% !important;
            transform: translate(-50%,-50%) !important; z-index: 20001 !important;
            background: #fff !important; border: 2px solid #333 !important;
            padding: 20px !important; border-radius: 10px !important;
            max-width: 600px !important; max-height: 80vh !important; overflow-y: auto !important;
            font-family: Arial, sans-serif !important; color: #333 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,.3) !important;
        }
        #ct-changelog-modal h2 {
            margin: 0 0 14px !important; border-bottom: 2px solid #28a745 !important;
            padding-bottom: 10px !important; font-size: 1.4em !important;
            color: #333 !important; font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal .ct-cl-info {
            background: #f8f9fa !important; border-left: 4px solid #28a745 !important;
            padding: 10px !important; border-radius: 5px !important;
            margin-bottom: 14px !important; font-size: 13px !important;
            font-family: Arial, sans-serif !important;
        }
        #ct-changelog-modal .ct-cl-body {
            white-space: pre-wrap !important; font-family: 'Courier New', monospace !important;
            font-size: 12px !important; background: #fafafa !important;
            padding: 10px !important; border-radius: 5px !important; line-height: 1.6 !important;
        }
        #ct-changelog-modal .ct-cl-ok {
            margin-top: 14px !important; padding: 10px 20px !important;
            background: #28a745 !important; color: #fff !important; border: none !important;
            border-radius: 5px !important; cursor: pointer !important;
            font-weight: bold !important; width: 100% !important;
            font-family: Arial, sans-serif !important; font-size: 14px !important;
        }
        #ct-changelog-modal .ct-cl-ok:hover { background: #218838 !important; }
        #ct-changelog-overlay {
            position: fixed !important; inset: 0 !important;
            background: rgba(0,0,0,.5) !important; z-index: 20000 !important;
        }

        /* Custom searchable snippet dropdown */
        .ct-cs-trigger {
            width: 100%; padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px;
            background: #fff; color: #333; font-size: 12px; font-family: Arial, sans-serif;
            cursor: pointer; box-sizing: border-box; display: flex; align-items: center;
            justify-content: space-between; gap: 6px; transition: border-color .15s;
        }
        .ct-cs-trigger:hover, .ct-cs-trigger:focus { border-color: #888; outline: none; }
        .ct-cs-trigger:disabled { opacity: .45; cursor: not-allowed; background: #e9e9e9; }
        .ct-cs-trigger.ct-cs-open .ct-cs-arrow { transform: rotate(180deg); }
        .ct-cs-arrow {
            font-size: 10px; color: #666; flex-shrink: 0;
            pointer-events: none; transition: transform .15s; display: inline-block;
        }
        .ct-cs-dropdown {
            position: absolute; top: calc(100% + 2px); left: 0; z-index: 99999;
            background: #fff; border: 1px solid #ccc; border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,.15); min-width: 100%; max-width: 360px; overflow: hidden;
        }
        .ct-cs-search {
            width: 100%; padding: 6px 10px; border: none; border-bottom: 1px solid #eee;
            border-radius: 0; font-size: 13px; box-sizing: border-box; outline: none;
            background: #fff; color: #333; font-family: Arial, sans-serif;
        }
        .ct-cs-list {
            list-style: none; margin: 0; padding: 4px 0;
            max-height: 220px; overflow-y: auto;
        }
        .ct-cs-group-header {
            padding: 6px 12px; font-size: 10px; font-weight: bold; color: #555;
            background-color: #e9edf2; border-top: 1px solid #d4d8de; border-bottom: 1px solid #d4d8de;
            text-transform: uppercase; letter-spacing: .7px; font-family: Arial, sans-serif;
            cursor: default; pointer-events: none; user-select: none;
        }
        .ct-cs-item {
            padding: 6px 12px 6px 20px; font-size: 12px; cursor: pointer;
            font-family: Arial, sans-serif; color: #333;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ct-cs-item:hover, .ct-cs-item.ct-cs-highlighted { background: #e8f0fe; color: #333; }
        .ct-cs-item.ct-cs-selected { background: #667eea; color: #fff; }
        .ct-cs-item.ct-cs-selected:hover,
        .ct-cs-item.ct-cs-selected.ct-cs-highlighted { background: #5568d3; color: #fff; }
        .ct-cs-no-results {
            padding: 7px 12px; font-size: 12px; color: #999;
            font-style: italic; cursor: default; font-family: Arial, sans-serif;
        }

        /* Dark mode isolation: force light theme on all script UI */
        #ct-sidebar { background-color: #f9f9f9 !important; color: #333333 !important; }
        #ct-edit-modal { background-color: #f9f9f9 !important; color: #333333 !important; }
        #ct-setup-modal { background-color: #f9f9f9 !important; color: #333333 !important; }
        #ct-sidebar input, #ct-sidebar select, #ct-sidebar textarea,
        #ct-edit-modal input, #ct-edit-modal select, #ct-edit-modal textarea,
        #ct-setup-modal input, #ct-setup-modal select, #ct-setup-modal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        .ct-cs-dropdown { background-color: #ffffff !important; color: #333333 !important; }
        .ct-cs-trigger  { background-color: #ffffff !important; color: #333333 !important; }
        .ct-cs-search   { background-color: #ffffff !important; color: #333333 !important; }
        .ct-cs-item     { color: #333333 !important; }
        .ct-cs-group-header { background-color: #e9edf2 !important; color: #555555 !important; }
    `;
    // Deferred to initialize() where document.head is guaranteed to exist.

    /* ==========================================================
     *  TOOL ICON  (pencil)
     * ==========================================================*/

    const TOOL_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>`;

    /* ==========================================================
     *  STATE
     * ==========================================================*/

    let isInitialized        = false;
    let isRegistered         = false;
    let registrationAttempts = 0;
    const MAX_ATTEMPTS       = 10;
    const RETRY_DELAY        = 500;
    let sidebarVisible       = false;
    let activeFilter         = { query: '', dateFrom: '', dateTo: '' };
    let _ctx                 = null;

    /* ──────────────────────────────────────────────────────────
     *  CONNECTIVITY STATE  (must be initialised before initializeSidebar())
     *  States: 'INIT' | 'ONLINE' | 'OFFLINE' | 'INVALID_TOKEN' | 'SETUP'
     *
     *  INIT          → no token/URL in GM → sidebar open shows setup prompt
     *  ONLINE        → Worker reachable, token valid → full functionality
     *  OFFLINE       → Worker unreachable or 5xx → read-only, offline banner
     *  INVALID_TOKEN → Worker returned 401 → read-only, token-invalid banner
     *  SETUP         → user is in the first-run setup form
     * ─────────────────────────────────────────────────────────*/
    let connState = 'INIT';

    /* ==========================================================
     *  TICKET CONTEXT (polaris / classic mode detection)
     * ==========================================================*/

    function getTicketContext() {
        const macro = Array.from(document.querySelectorAll('*'))
            .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
        if (macro && macro.shadowRoot) {
            const iframe = macro.shadowRoot.querySelector('#gsft_main');
            if (iframe && iframe.contentWindow && iframe.contentWindow.g_form) {
                return { win: iframe.contentWindow, doc: iframe.contentDocument, mode: 'polaris' };
            }
        }
        if (window.g_form) {
            return { win: window, doc: document, mode: 'classic' };
        }
        return null;
    }

    function getTicketDoc() { return _ctx ? _ctx.doc : document; }
    function getTicketWin() { return _ctx ? _ctx.win : window; }

    /* ==========================================================
     *  HELPERS
     * ==========================================================*/

    function mk(tag, props = {}) { const n = document.createElement(tag); Object.assign(n, props); return n; }
    function css(n, s) { Object.assign(n.style, s); return n; }
    function pad(n) { return String(n).padStart(2, '0'); }
    function nowStamp() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function uid() { return crypto.randomUUID(); }

    /* ==========================================================
     *  TICKET NUMBER DETECTION
     * ==========================================================*/

    function getTicketNumber() {
        const ticketDoc = getTicketDoc();
        for (const id of ['sc_req_item.number', 'incident.number']) {
            const n = ticketDoc.getElementById(id);
            if (n?.value?.trim()) return n.value.trim();
        }
        const m = window.location.search.match(/[?&]sys_id=([^&]+)/);
        return m ? `SYS_${m[1].slice(0, 8)}` : 'UNKNOWN';
    }

    /* ==========================================================
     *  STORAGE
     *  Entry format: { id, ts, type, fields: obj|null, note: str|null }
     *  - Structured types  → fields populated, note null
     *  - Freeform types    → fields null, note populated
     *  Backward compat: old v1.1.0 entries only have {id,ts,type,note} — handled gracefully
     *
     *  v1.3.0: GM storage now serves as a local read cache. The Worker
     *  (api object below) is the source of truth when ONLINE. Local cache
     *  is updated optimistically on every mutation so the sidebar feels
     *  instant even when the API is slow or unreachable.
     * ==========================================================*/

    const PREFIX = 'changeTracker_notes_';

    function storeKey(ticket) { return PREFIX + ticket; }

    // Renames the legacy 'adGroup' field key to 'source' in stored entries.
    function migrateEntry(e) {
        if (e.fields && 'adGroup' in e.fields) {
            const f = { ...e.fields };
            f.source = f.adGroup;
            delete f.adGroup;
            return { ...e, fields: f };
        }
        return e;
    }

    // Sync read from GM cache — never blocks
    function loadEntries(ticket) {
        try {
            const raw      = JSON.parse(GM_getValue(storeKey(ticket), '[]'));
            const migrated = raw.map(migrateEntry);
            if (migrated.some((e, i) => e !== raw[i])) {
                GM_setValue(storeKey(ticket), JSON.stringify(migrated));
            }
            return migrated;
        }
        catch { return []; }
    }

    // Internal: update GM cache only (no API call)
    // Migration is applied here so server-fetched data (which may still use
    // the old 'adGroup' key) is normalised before being written locally.
    function _cacheEntries(ticket, entries) {
        GM_setValue(storeKey(ticket), JSON.stringify(entries.map(migrateEntry)));
    }

    /* ==========================================================
     *  CACHE EXPIRY
     *  Tracks the last time each ticket's cache was consulted (sidebar
     *  opened). On startup, any ticket cache older than the configured
     *  TTL is deleted — the server remains the source of truth and will
     *  re-populate the cache on next open.
     * ==========================================================*/

    const LAST_ACCESS_KEY = 'changeTracker_lastAccess';

    function _getLastAccessMap() {
        try { return JSON.parse(GM_getValue(LAST_ACCESS_KEY, '{}')); }
        catch { return {}; }
    }

    function touchTicketAccess(ticket) {
        const map = _getLastAccessMap();
        map[ticket] = Date.now();
        GM_setValue(LAST_ACCESS_KEY, JSON.stringify(map));
    }

    function purgeStaleCache() {
        const ttlMs  = getCacheTtlDays() * 24 * 60 * 60 * 1000;
        const now    = Date.now();
        const map    = _getLastAccessMap();
        const allKeys = GM_listValues();
        let changed  = false;

        for (const key of allKeys) {
            if (!key.startsWith(PREFIX)) continue;
            const ticket = key.slice(PREFIX.length);
            const last   = map[ticket] || 0;
            if (now - last > ttlMs) {
                GM_deleteValue(key);
                delete map[ticket];
                changed = true;
                console.log(`CT: purged stale local cache for ${ticket} (not consulted in ${getCacheTtlDays()}d)`);
            }
        }

        // Clean up orphaned access entries whose cache key is already gone
        for (const ticket of Object.keys(map)) {
            if (!allKeys.includes(storeKey(ticket))) {
                delete map[ticket];
                changed = true;
            }
        }

        if (changed) GM_setValue(LAST_ACCESS_KEY, JSON.stringify(map));
    }

    /* ==========================================================
     *  API CLIENT  (Cloudflare Worker proxy to D1)
     *  Single fetch surface. All errors return { ok: false, ... }
     *  rather than throwing, so callers can route them through
     *  handleApiResponse() without try/catch.
     * ==========================================================*/

    const api = {

        // Read Worker URL and token from GM storage
        getConfig() {
            return {
                url:   GM_getValue('changeTrackerWorkerUrl', ''),
                token: GM_getValue('changeTrackerToken',     ''),
            };
        },

        // Returns true if both url and token are set
        isConfigured() {
            const { url, token } = api.getConfig();
            return Boolean(url && token);
        },

        // Shared fetch wrapper.
        // Returns { ok: true, data } or { ok: false, status, network: bool }
        async request(method, path, body) {
            const { url, token } = api.getConfig();
            try {
                const res = await fetch(`${url}${path}`, {
                    method,
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: body ? JSON.stringify(body) : undefined,
                });
                if (res.ok) {
                    return { ok: true, data: await res.json() };
                }
                return { ok: false, status: res.status, network: false };
            } catch (e) {
                return { ok: false, status: 0, network: true };
            }
        },

        async ping() {
            const { url } = api.getConfig();
            if (!url) return false;
            try {
                const res = await fetch(`${url}/ping`);
                return res.ok;
            } catch { return false; }
        },

        async fetchEntries(ticket) {
            return api.request('GET', `/entries/${encodeURIComponent(ticket)}`);
        },

        async pushEntries(entries) {
            return api.request('POST', '/entries', { entries });
        },

        async deleteTicket(ticket) {
            return api.request('DELETE', `/entries/${encodeURIComponent(ticket)}`);
        },

        async deleteEntry(ticket, id) {
            return api.request('DELETE',
                `/entries/${encodeURIComponent(ticket)}/${encodeURIComponent(id)}`);
        },
    };

    /* ==========================================================
     *  TICKET WRITER  (auto-write entries into SNow worknote/comments)
     *
     *  Three scenarios driven by which textareas SNow is showing:
     *    - 'both'           → write technical text to work_notes,
     *                         customer-facing text + @mention to comments
     *    - 'workNotesOnly'  → write technical text to work_notes
     *    - 'commentsOnly'   → write customer-facing text + @mention to comments
     *
     *  Mention-insertion machinery is adapted from
     *  Standalone Scripts/ServiceNowTicketResponseHelper.js. Custom (freeform)
     *  entries don't auto-write (no template defined for them).
     * ==========================================================*/

    const ticketWriter = (() => {

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        // ── Field visibility detection ────────────────────────────

        function isDualInputMode() {
            const ticketDoc = getTicketDoc();
            const container = ticketDoc.getElementById('multiple-input-journal-entry');
            if (container && container.getAttribute('aria-hidden') === 'false') {
                const wn = ticketDoc.getElementById('activity-stream-work_notes-textarea');
                const cm = ticketDoc.getElementById('activity-stream-comments-textarea');
                return !!(wn && cm);
            }
            return false;
        }

        function isVisible(el) {
            return !!(el && el.offsetParent !== null);
        }

        /**
         * In single-input mode SNow shows ONE textarea (#activity-stream-textarea)
         * and lets the analyst toggle it between Work Notes and Additional
         * Comments. We detect the active journal type from multiple signals:
         *   1. The textarea's placeholder (most reliable across SNow versions)
         *   2. An "active"/"selected"/"pressed" toggle button in the journal bar
         *   3. A class hint on the textarea's container
         * Returns 'work_notes' | 'comments' | null.
         */
        function detectSingleInputJournal(textarea) {
            const ph = ((textarea && textarea.placeholder) || '').toLowerCase();
            if (ph.includes('work note')) return 'work_notes';
            if (ph.includes('additional comment') || ph.includes('comment')) return 'comments';

            const ticketDoc = getTicketDoc();
            const activeBtn = ticketDoc.querySelector(
                '[id*="show-work_notes"].active, ' +
                'button[data-input-stream-type="work_notes"].active, ' +
                'button[data-input-stream-type="work_notes"][aria-pressed="true"], ' +
                'button[data-input-stream-type="work_notes"][aria-selected="true"]'
            );
            if (activeBtn) return 'work_notes';

            const activeCmBtn = ticketDoc.querySelector(
                '[id*="show-comments"].active, ' +
                'button[data-input-stream-type="comments"].active, ' +
                'button[data-input-stream-type="comments"][aria-pressed="true"], ' +
                'button[data-input-stream-type="comments"][aria-selected="true"]'
            );
            if (activeCmBtn) return 'comments';

            const container = textarea && (textarea.closest('[id*="activity-stream"]') || textarea.parentElement);
            const cls = (container && container.className) || '';
            if (/work[_-]?notes/i.test(cls)) return 'work_notes';
            if (/comments/i.test(cls))       return 'comments';

            return null;
        }

        /**
         * Returns one of:
         *   { mode: 'both',          workNotes, comments }
         *   { mode: 'workNotesOnly', workNotes, comments: null }
         *   { mode: 'commentsOnly',  workNotes: null, comments }
         *   { mode: 'unknown',       workNotes: null, comments: <generic textarea> }
         *   { mode: 'none',          workNotes: null, comments: null }
         */
        function detectVisibility() {
            const ticketDoc = getTicketDoc();
            const wn = ticketDoc.getElementById('activity-stream-work_notes-textarea');
            const cm = ticketDoc.getElementById('activity-stream-comments-textarea');

            if (isDualInputMode()) return { mode: 'both', workNotes: wn, comments: cm };

            const wnVisible = isVisible(wn);
            const cmVisible = isVisible(cm);
            if (wnVisible && cmVisible) return { mode: 'both',          workNotes: wn, comments: cm };
            if (wnVisible)              return { mode: 'workNotesOnly', workNotes: wn, comments: null };
            if (cmVisible)              return { mode: 'commentsOnly',  workNotes: null, comments: cm };

            const generic = ticketDoc.querySelector('#activity-stream-textarea')
                         || ticketDoc.querySelector('[data-stream-text-input]');
            if (generic) {
                // Single-input mode — figure out which journal it is currently
                // showing so we pick the right template.
                const which = detectSingleInputJournal(generic);
                if (which === 'work_notes') return { mode: 'workNotesOnly', workNotes: generic, comments: null };
                if (which === 'comments')   return { mode: 'commentsOnly',  workNotes: null,    comments: generic };
                return { mode: 'unknown', workNotes: null, comments: generic };
            }

            return { mode: 'none', workNotes: null, comments: null };
        }

        // ── "Opened by" name detection (for @mention target) ──────

        let _cachedOpenedByName = null;

        async function getOpenedByName(retries = 3, delay = 200) {
            if (_cachedOpenedByName) return _cachedOpenedByName;

            const selectors = [
                'sc_req_item.opened_by_label',
                'sys_display.sc_req_item.opened_by',
                'incident.opened_by_label',
                'sys_display.incident.opened_by',
                'sc_req_item.caller_id_label',
                'sys_display.sc_req_item.caller_id',
                'incident.caller_id_label',
                'sys_display.incident.caller_id',
            ];

            for (let attempt = 0; attempt < retries; attempt++) {
                const ticketDoc = getTicketDoc();
                for (const sel of selectors) {
                    const f = ticketDoc.getElementById(sel);
                    if (f) {
                        const v = (f.value || f.textContent || '').trim();
                        if (v.length > 2) { _cachedOpenedByName = v; return v; }
                    }
                }
                const labelFields = ticketDoc.querySelectorAll('[id*="opened_by"], [id*="caller_id"]');
                for (const f of labelFields) {
                    const v = (f.value || f.textContent || '').trim();
                    if (v.length > 2 && !v.includes('_')) { _cachedOpenedByName = v; return v; }
                }
                if (attempt < retries - 1) await sleep(delay);
            }
            return null;
        }

        // ── Plain text insertion ─────────────────────────────────

        function insertTextDirectly(textarea, text) {
            const start = textarea.selectionStart || 0;
            const end   = textarea.selectionEnd   || 0;
            const cur   = textarea.value;
            textarea.value = cur.substring(0, start) + text + cur.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + text.length;
            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }

        function appendText(textarea, text) {
            const existing = textarea.value.trim();
            textarea.value = existing ? existing + '\n\n' + text : text;
            textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // ── @mention insertion (best-effort: API → keystroke fallback) ──

        async function insertMentionViaAPI(textarea, name) {
            const tWin = getTicketWin();
            try {
                if (typeof tWin.$ !== 'undefined' && tWin.$(textarea).data('atwho')) {
                    const atwho = tWin.$(textarea).data('atwho');
                    if (atwho && atwho.insert) { atwho.insert('@', name); return true; }
                }
                if (typeof tWin.angular !== 'undefined') {
                    try {
                        const scope = tWin.angular.element(textarea).scope();
                        if (scope && scope.insertMention) { await scope.insertMention(name); return true; }
                    } catch {}
                }
                if (textarea.mentionPlugin || textarea._mentionApi) {
                    const apiObj = textarea.mentionPlugin || textarea._mentionApi;
                    if (apiObj.insert || apiObj.addMention) { (apiObj.insert || apiObj.addMention).call(apiObj, name); return true; }
                }
                if (typeof tWin.SNMention !== 'undefined' && tWin.SNMention.insert) {
                    tWin.SNMention.insert(textarea, name); return true;
                }
                if (typeof tWin.GlideMention !== 'undefined' && tWin.GlideMention.insert) {
                    tWin.GlideMention.insert(textarea, name); return true;
                }
            } catch {}
            return false;
        }

        async function triggerMentionPicker(textarea, name) {
            textarea.focus();
            await sleep(80);
            insertTextDirectly(textarea, '@');
            await sleep(120);
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: '@', inputType: 'insertText' }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { key: '@', code: 'Digit2', keyCode: 50, which: 50, shiftKey: true, bubbles: true }));
            await sleep(350);

            for (const ch of name) {
                insertTextDirectly(textarea, ch);
                textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
                textarea.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
                await sleep(45);
            }

            await sleep(350);
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            textarea.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            await sleep(180);

            const suggestionSelectors = [
                '.mention-suggestion', '.at-view-ul li', '[role="option"]',
                '.atwho-view li', '.atwho-view-ul li', '.mentions-autocomplete li', '[data-mention-item]',
            ];
            const ticketDoc = getTicketDoc();
            for (const sel of suggestionSelectors) {
                const node = ticketDoc.querySelector(sel);
                if (node && node.offsetParent !== null) { node.click(); await sleep(180); return true; }
            }
            return false;
        }

        // ── Mention blocker (prevents accidental clicks during keystroke flow) ──

        let _blockerActive = false;
        let _focusGuardTextarea = null;
        let _focusGuardHandler  = null;

        function showBlocker(fieldType, textarea) {
            hideBlocker();
            _blockerActive = true;

            const overlay = document.createElement('div');
            overlay.id = 'ct-mention-blocker-overlay';
            Object.assign(overlay.style, {
                position:'fixed', inset:'0', zIndex:'2147483646',
                pointerEvents:'all', cursor:'not-allowed', background:'rgba(0,0,0,0.10)',
            });
            const eat = e => { e.preventDefault(); e.stopImmediatePropagation(); };
            ['mousedown','mouseup','click','pointerdown','pointerup'].forEach(t => overlay.addEventListener(t, eat, true));

            if (textarea) {
                _focusGuardTextarea = textarea;
                _focusGuardHandler  = () => {
                    if (_blockerActive) setTimeout(() => { if (_blockerActive) textarea.focus(); }, 0);
                };
                textarea.addEventListener('focusout', _focusGuardHandler, true);
            }

            const fieldLabel = fieldType === 'work_notes' ? '🔒 Work Notes' : '💬 Comments';
            const toast = document.createElement('div');
            toast.id = 'ct-mention-blocker-toast';
            Object.assign(toast.style, {
                position:'fixed', top:'18px', left:'50%', transform:'translateX(-50%)',
                zIndex:'2147483647', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
                color:'#fff', padding:'10px 18px', borderRadius:'8px',
                boxShadow:'0 6px 24px rgba(0,0,0,.5)', fontFamily:'Arial,sans-serif',
                fontSize:'13px', whiteSpace:'nowrap', pointerEvents:'none',
                border:'1px solid rgba(102,126,234,0.55)',
            });
            toast.innerHTML = `Inserting @mention → <span style="color:#67e8f9">${fieldLabel}</span>` +
                              `<span style="color:#fca5a5;margin-left:10px;font-size:12px">⛔ do not click</span>`;
            document.body.appendChild(overlay);
            document.body.appendChild(toast);
        }

        function hideBlocker() {
            _blockerActive = false;
            if (_focusGuardTextarea && _focusGuardHandler) {
                _focusGuardTextarea.removeEventListener('focusout', _focusGuardHandler, true);
            }
            _focusGuardTextarea = null;
            _focusGuardHandler  = null;
            document.getElementById('ct-mention-blocker-overlay')?.remove();
            document.getElementById('ct-mention-blocker-toast')?.remove();
        }

        async function insertTextWithMention(textarea, text, fieldType) {
            const mentionRegex = /@\[([^\]]+)\]/g;
            const matches = text.match(mentionRegex);

            // No mentions → straight append
            if (!matches || matches.length === 0) {
                appendText(textarea, text);
                return;
            }

            const mentions = [];
            let m; mentionRegex.lastIndex = 0;
            while ((m = mentionRegex.exec(text)) !== null) {
                mentions.push({ placeholder: m[0], name: m[1], index: m.index });
            }
            const parts = text.split(mentionRegex);

            showBlocker(fieldType, textarea);
            try {
                const existing = textarea.value.trim();
                textarea.value = existing ? existing + '\n\n' : '';
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                textarea.focus();
                await sleep(80);

                let pi = 0;
                for (let i = 0; i < mentions.length; i++) {
                    if (parts[pi]) {
                        insertTextDirectly(textarea, parts[pi]);
                        await sleep(80);
                    }
                    pi++;
                    const apiOk = await insertMentionViaAPI(textarea, mentions[i].name);
                    if (!apiOk) await triggerMentionPicker(textarea, mentions[i].name);
                    await sleep(150);
                    pi++;
                }
                if (pi < parts.length && parts[pi]) {
                    insertTextDirectly(textarea, parts[pi]);
                }
                textarea.dispatchEvent(new Event('input',  { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            } finally {
                hideBlocker();
            }
        }

        // ── Templates per entry type ──────────────────────────────
        //
        // Each template defines:
        //   workNoteHeader  : header line for the technical worknote
        //   commentsHeader  : header line for the customer-facing comment
        //   commentsCloser  : optional sentence appended before the sign-off
        //
        // The body is auto-built from the entry's FIELD_SCHEMA, so adding new
        // entry types only requires registering a template here.

        const SIGN_OFF = 'Best regards,\nGlobal Data Security Enablement';

        const NOTE_TEMPLATES = {
            // ── Policies ───────────────────────────────────────
            'Policy Created': {
                workNoteHeader: 'Netskope Policy has been created:',
                commentsHeader: "We've created the following Netskope policy to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Policy Modified': {
                workNoteHeader: 'Netskope Policy has been modified:',
                commentsHeader: "We've modified the following Netskope policy to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Policy Deleted': {
                workNoteHeader: 'Netskope Policy has been scheduled to be deleted (currently disabled):',
                commentsHeader: "We've scheduled for deletion the following Netskope policy to help address the issue:",
                commentsCloser: 'This policy has been disabled and scheduled for deletion in 30 days.',
            },

            // ── DLP Policies ───────────────────────────────────
            'DLP Policy Created': {
                workNoteHeader: 'Netskope DLP Policy has been created:',
                commentsHeader: "We've created the following Netskope DLP policy to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'DLP Policy Modified': {
                workNoteHeader: 'Netskope DLP Policy has been modified:',
                commentsHeader: "We've modified the following Netskope DLP policy to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'DLP Policy Deleted': {
                workNoteHeader: 'Netskope DLP Policy has been scheduled to be deleted (currently disabled):',
                commentsHeader: "We've scheduled for deletion the following Netskope DLP policy to help address the issue:",
                commentsCloser: 'This policy has been disabled and scheduled for deletion in 30 days.',
            },

            // ── DLP Process Exceptions ─────────────────────────
            'DLP Process Exception Added': {
                workNoteHeader: 'Netskope DLP Process Exception has been added:',
                commentsHeader: "We've added the following DLP Process Exception to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'DLP Process Exception Removed': {
                workNoteHeader: 'Netskope DLP Process Exception has been removed:',
                commentsHeader: "We've removed the following DLP Process Exception as requested:",
            },

            // ── URL Lists ──────────────────────────────────────
            'URL List Created': {
                workNoteHeader: 'Netskope URL List has been created:',
                commentsHeader: "We've created the following Netskope URL List to support the requested change:",
            },
            'URL List — URLs Added': {
                workNoteHeader: 'URLs have been added to the following Netskope URL List:',
                commentsHeader: "We've added the following URLs to the requested Netskope URL List:",
            },
            'URL List — URLs Removed': {
                workNoteHeader: 'URLs have been removed from the following Netskope URL List:',
                commentsHeader: "We've removed the following URLs from the requested Netskope URL List:",
            },
            'URL List Removed': {
                workNoteHeader: 'Netskope URL List has been removed:',
                commentsHeader: "We've removed the following Netskope URL List as requested:",
            },

            // ── Network Locations ──────────────────────────────
            'Network Location Created': {
                workNoteHeader: 'Netskope Network Location has been created:',
                commentsHeader: "We've created the following Netskope Network Location:",
            },
            'Network Location — IPs Added': {
                workNoteHeader: 'IPs have been added to the following Netskope Network Location:',
                commentsHeader: "We've added the following IPs to the requested Netskope Network Location:",
            },
            'Network Location — IPs Removed': {
                workNoteHeader: 'IPs have been removed from the following Netskope Network Location:',
                commentsHeader: "We've removed the following IPs from the requested Netskope Network Location:",
            },
            'Network Location Removed': {
                workNoteHeader: 'Netskope Network Location has been removed:',
                commentsHeader: "We've removed the following Netskope Network Location as requested:",
            },

            // ── Custom Categories ──────────────────────────────
            'Custom Category Created': {
                workNoteHeader: 'Netskope Custom Category has been created:',
                commentsHeader: "We've created the following Netskope Custom Category:",
            },
            'Custom Category — URL Lists Added': {
                workNoteHeader: 'URL Lists have been added to the following Netskope Custom Category:',
                commentsHeader: "We've added the following URL Lists to the requested Netskope Custom Category:",
            },
            'Custom Category — URL Lists Removed': {
                workNoteHeader: 'URL Lists have been removed from the following Netskope Custom Category:',
                commentsHeader: "We've removed the following URL Lists from the requested Netskope Custom Category:",
            },
            'Custom Category Removed': {
                workNoteHeader: 'Netskope Custom Category has been removed:',
                commentsHeader: "We've removed the following Netskope Custom Category as requested:",
            },

            // ── SSL Decryption ─────────────────────────────────
            'SSL Decryption Policy Created': {
                workNoteHeader: '# Added to SSL Decryption policy:',
                commentsHeader: "We've added the following SSL Decryption bypasses to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.',
            },
            'SSL Decryption — URLs Added': {
                workNoteHeader: '# URLs added to SSL Decryption policy:',
                commentsHeader: "We've added the following URLs to the existing SSL Decryption policy:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test.',
            },
            'SSL Decryption — URLs Removed': {
                workNoteHeader: '# URLs removed from SSL Decryption policy:',
                commentsHeader: "We've removed the following URLs from the SSL Decryption policy as requested:",
            },
            'SSL Decryption Policy Removed': {
                workNoteHeader: '# SSL Decryption policy has been removed:',
                commentsHeader: "We've removed the following SSL Decryption policy as requested:",
            },

            // ── Steering Exceptions ────────────────────────────
            'Steering Exception Added': {
                workNoteHeader: '# Added Steering Exception:',
                commentsHeader: "We've added the following Steering Exception (Domain bypass) to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.',
            },
            'Steering Exception Removed': {
                workNoteHeader: '# Removed Steering Exception:',
                commentsHeader: "We've removed the following Steering Exception as requested:",
            },

            // ── App Exceptions ─────────────────────────────────
            'App Exception Added': {
                workNoteHeader: '# Added App Bypass:',
                commentsHeader: "We've added the following Application bypass to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.',
            },
            'App Exception Removed': {
                workNoteHeader: '# Removed App Bypass:',
                commentsHeader: "We've removed the following Application bypass as requested:",
            },

            // ── Steering / Client Configs ──────────────────────
            'Steering/Client Config Created': {
                workNoteHeader: 'Created Netskope Steering/Client Configuration:',
                commentsHeader: 'We have created the following Netskope Steering/Client Configuration to meet the requested requirements:',
            },
            'Steering/Client Config Modified': {
                workNoteHeader: 'Modified Netskope Steering/Client Configuration:',
                commentsHeader: 'We have updated the following Netskope Steering/Client Configuration to meet the requested requirements:',
            },
            'Steering/Client Config Deleted': {
                workNoteHeader: 'Deleted Netskope Steering/Client Configuration:',
                commentsHeader: 'We have deleted the following Netskope Steering/Client Configuration as requested:',
            },

            // ── User Notifications ─────────────────────────────
            'User Notification Added': {
                workNoteHeader: 'Netskope User Notification has been added:',
                commentsHeader: "We've added the following Netskope User Notification:",
            },
            'User Notification Modified': {
                workNoteHeader: 'Netskope User Notification has been modified:',
                commentsHeader: "We've modified the following Netskope User Notification:",
            },
            'User Notification Removed': {
                workNoteHeader: 'Netskope User Notification has been removed:',
                commentsHeader: "We've removed the following Netskope User Notification as requested:",
            },

            // ── Custom Apps ────────────────────────────────────
            'Custom App Added': {
                workNoteHeader: 'Netskope Custom App has been added:',
                commentsHeader: "We've added the following Netskope Custom App to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Custom App Edited': {
                workNoteHeader: 'Netskope Custom App has been edited:',
                commentsHeader: "We've edited the following Netskope Custom App to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Custom App Removed': {
                workNoteHeader: 'Netskope Custom App has been removed:',
                commentsHeader: "We've removed the following Netskope Custom App as requested:",
            },

            // ── Certified Pinned Apps ──────────────────────────────
            'Certified Pinned App Added': {
                workNoteHeader: 'Netskope Certified Pinned App has been added:',
                commentsHeader: "We've added the following Certified Pinned App to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Certified Pinned App Edited': {
                workNoteHeader: 'Netskope Certified Pinned App has been edited:',
                commentsHeader: "We've edited the following Certified Pinned App to help address the issue:",
                commentsCloser: 'When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.',
            },
            'Certified Pinned App Removed': {
                workNoteHeader: 'Netskope Certified Pinned App has been removed:',
                commentsHeader: "We've removed the following Certified Pinned App as requested:",
            },

            // ── Recategorization ───────────────────────────────────
            'Recategorization Request': {
                workNoteHeader: '# Recategorization request submitted to Netskope:',
                commentsHeader: 'A recategorization request has been submitted to Netskope. Please allow 24–48 hours for them to review it and apply any necessary changes.',
            },

            // ── Constraints ────────────────────────────────────────
            'User Constraint': {
                workNoteHeader: 'Netskope User Constraint has been configured:',
                commentsHeader: "We've configured the following Netskope User Constraint:",
            },

            // ── File Profiles ──────────────────────────────────────
            'File Profile Added': {
                workNoteHeader: 'Netskope File Profile has been added:',
                commentsHeader: "We've added the following Netskope File Profile:",
            },
            'File Profile Modified': {
                workNoteHeader: 'Netskope File Profile has been modified:',
                commentsHeader: "We've modified the following Netskope File Profile:",
            },
            'File Profile Removed': {
                workNoteHeader: 'Netskope File Profile has been removed:',
                commentsHeader: "We've removed the following Netskope File Profile as requested:",
            },

            // ── DLP Profiles ───────────────────────────────────────
            'DLP Profile Added': {
                workNoteHeader: 'Netskope DLP Profile has been added:',
                commentsHeader: "We've added the following Netskope DLP Profile:",
            },
            'DLP Profile Modified': {
                workNoteHeader: 'Netskope DLP Profile has been modified:',
                commentsHeader: "We've modified the following Netskope DLP Profile:",
            },
            'DLP Profile Removed': {
                workNoteHeader: 'Netskope DLP Profile has been removed:',
                commentsHeader: "We've removed the following Netskope DLP Profile as requested:",
            },

            // 'Custom' is intentionally absent — freeform notes don't auto-write.
        };

        // ── Builders ─────────────────────────────────────────────

        function fieldLines(entry) {
            const schema = getSchema(entry.type);
            if (!schema || !entry.fields) return [];
            const out = [];
            schema.forEach(f => {
                const raw = entry.fields[f.key];
                if (!raw) return;
                if (/\r?\n/.test(raw)) {
                    // Multi-line value (e.g. URL/IP lists) — list label on its
                    // own line, indent each value below.
                    out.push(`- ${f.label}:`);
                    raw.split(/\r?\n/).forEach(v => {
                        const t = v.trim();
                        if (t) out.push(`  ${t}`);
                    });
                } else {
                    out.push(`- ${f.label}: ${raw}`);
                }
            });
            return out;
        }

        function buildWorkNoteText(entry) {
            const tpl = NOTE_TEMPLATES[entry.type];
            if (!tpl) return null;
            const lines = [`#${tpl.workNoteHeader}`, ...fieldLines(entry)];
            return lines.join('\n');
        }

        function buildCommentsText(entry, openedByName) {
            const tpl = NOTE_TEMPLATES[entry.type];
            if (!tpl) return null;
            const greeting = openedByName ? `Hi @[${openedByName}],` : 'Hi,';
            const parts = [greeting, '', tpl.commentsHeader, ...fieldLines(entry)];
            if (tpl.commentsCloser) parts.push('', tpl.commentsCloser);
            parts.push('', SIGN_OFF);
            return parts.join('\n');
        }

        // ── Public entry-point ───────────────────────────────────

        /**
         * Returns one of:
         *   { ok: true,  wrote: 'both' | 'workNotes' | 'comments' }
         *   { ok: false, reason: 'no-template' | 'no-field' | 'error', error? }
         */
        async function writeEntry(entry) {
            if (!NOTE_TEMPLATES[entry.type]) return { ok: false, reason: 'no-template' };
            const vis = detectVisibility();
            if (vis.mode === 'none') {
                console.warn('CT: no SNow worknote/comments field visible — skipping ticket write');
                return { ok: false, reason: 'no-field' };
            }

            const openedByName = await getOpenedByName().catch(() => null);

            try {
                if (vis.mode === 'both') {
                    const wnText = buildWorkNoteText(entry);
                    const cmText = buildCommentsText(entry, openedByName);
                    if (wnText) appendText(vis.workNotes, wnText);
                    if (cmText) await insertTextWithMention(vis.comments, cmText, 'comments');
                    return { ok: true, wrote: 'both' };

                } else if (vis.mode === 'workNotesOnly') {
                    const text = buildWorkNoteText(entry);
                    if (text) appendText(vis.workNotes, text);
                    return { ok: true, wrote: 'workNotes' };

                } else { // 'commentsOnly' or 'unknown' (assume comments-style)
                    const text = buildCommentsText(entry, openedByName);
                    if (text) await insertTextWithMention(vis.comments, text, 'comments');
                    return { ok: true, wrote: 'comments' };
                }
            } catch (e) {
                console.warn('CT: ticket write failed', e);
                hideBlocker();
                return { ok: false, reason: 'error', error: e };
            }
        }

        return {
            writeEntry,
            detectVisibility,                              // exposed for diagnostics
            hasTemplate: type => Boolean(NOTE_TEMPLATES[type]),
        };
    })();

    /* ==========================================================
     *  CONNECTIVITY STATE TRANSITIONS
     * ==========================================================*/

    function setConnState(newState) {
        connState = newState;
        renderConnBanner();
        renderInputLock();
    }

    function handleApiResponse(res) {
        if (res.ok) return;
        if (res.status === 401) {
            setConnState('INVALID_TOKEN');
        } else if (res.network || res.status >= 500) {
            setConnState('OFFLINE');
        }
    }

    /* ==========================================================
     *  ENTRY CRUD  (cache-first, write-through to Worker when online)
     *
     *  All mutations update the GM cache synchronously, then push to
     *  the Worker if connState === 'ONLINE'. This keeps the sidebar
     *  instant and lets the offline mode degrade gracefully.
     * ==========================================================*/

    async function addEntry(ticket, type, fields, note) {
        const entry   = {
            id:     uid(),
            ts:     nowStamp(),
            type,
            fields: fields || null,
            note:   note   || null,
        };
        const current = loadEntries(ticket);
        current.push(entry);
        _cacheEntries(ticket, current);                          // optimistic local update

        if (connState === 'ONLINE') {
            const res = await api.pushEntries([{ ...entry, ticket }]);
            handleApiResponse(res);
            if (res.ok) await syncTicket(ticket);
        }
        return loadEntries(ticket);
    }

    async function updateEntry(ticket, entryId, type, fields, note) {
        const entries = loadEntries(ticket);
        const idx     = entries.findIndex(e => e.id === entryId);
        if (idx !== -1) {
            entries[idx] = { ...entries[idx], type, fields: fields || null, note: note || null };
            _cacheEntries(ticket, entries);

            if (connState === 'ONLINE') {
                const res = await api.pushEntries([{ ...entries[idx], ticket }]);
                handleApiResponse(res);
            }
        }
        return entries;
    }

    async function deleteEntry(ticket, entryId) {
        const entries = loadEntries(ticket).filter(e => e.id !== entryId);
        _cacheEntries(ticket, entries);

        if (connState === 'ONLINE') {
            const res = await api.deleteEntry(ticket, entryId);
            handleApiResponse(res);
        }
        return entries;
    }

    async function clearEntries(ticket) {
        GM_deleteValue(storeKey(ticket));

        if (connState === 'ONLINE') {
            const res = await api.deleteTicket(ticket);
            handleApiResponse(res);
        }
    }

    // Pull authoritative entries from D1 into the cache for one ticket.
    // Called when the sidebar opens, after a successful reconnect, etc.
    async function syncTicket(ticket) {
        if (connState !== 'ONLINE') return;
        const res = await api.fetchEntries(ticket);
        if (res.ok) {
            _cacheEntries(ticket, res.data.entries || []);
        } else {
            handleApiResponse(res);
        }
    }

    /* ==========================================================
     *  FIELD FORM BUILDERS  (reused in sidebar + edit modal)
     * ==========================================================*/

    /**
     * Renders form inputs for a given schema into a container element.
     * @param {Array}  schema   - array of field defs from FIELD_SCHEMAS
     * @param {Object} values   - prefill values
     * @param {string} prefix   - ID prefix to avoid collisions between sidebar and modal
     * @param {HTMLElement} container - target container (its contents are replaced)
     */
    function buildFieldInputs(schema, values, prefix, container) {
        container.innerHTML = '';
        schema.forEach(f => {
            const wrap = css(mk('div'), { marginBottom: '7px' });

            const lbl = css(mk('label'), {
                display: 'block', fontSize: '11px', fontWeight: 'bold',
                color: '#666', marginBottom: '3px', fontFamily: 'Arial, sans-serif'
            });
            lbl.textContent = f.label;
            lbl.htmlFor = `${prefix}-${f.key}`;

            let input;
            if (f.type === 'textarea') {
                input = css(mk('textarea'), {
                    width: '100%', height: '52px', resize: 'vertical',
                    fontFamily: '"Courier New", Courier, monospace', fontSize: '12px',
                    padding: '6px', border: '1px solid #ccc', borderRadius: '4px',
                    background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none'
                });
            } else if (f.type === 'select') {
                input = css(mk('select'), {
                    width: '100%', padding: '6px 8px', border: '1px solid #ccc',
                    borderRadius: '4px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
                    background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none'
                });
                (f.options || []).forEach(opt => {
                    const o = mk('option');
                    o.value = opt; o.textContent = opt;
                    input.appendChild(o);
                });
            } else {
                input = css(mk('input'), {
                    width: '100%', padding: '6px 8px', border: '1px solid #ccc',
                    borderRadius: '4px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
                    background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none'
                });
                input.type = 'text';
            }
            input.id = `${prefix}-${f.key}`;
            if (f.type !== 'select') input.placeholder = f.label;
            if (values && values[f.key]) input.value = values[f.key];

            wrap.append(lbl, input);
            container.appendChild(wrap);

            if (f.extraFields && f.extraFields.length) {
                const addedKeys    = new Set();
                const addedContainer = mk('div');
                const chips        = {};

                const panel = css(mk('div'), {
                    display: 'none', flexWrap: 'wrap', gap: '5px',
                    padding: '6px 8px', marginBottom: '6px',
                    background: '#f6f8fa', border: '1px solid #e1e4e8', borderRadius: '4px',
                });

                const addBtn = css(mk('button'), {
                    display: 'block', fontSize: '11px', fontFamily: 'Arial, sans-serif',
                    color: '#0066cc', background: 'none', border: 'none',
                    padding: '0 0 6px 0', cursor: 'pointer', textDecoration: 'underline',
                });
                addBtn.textContent = '+ Add fields';
                addBtn.onclick = (e) => {
                    e.preventDefault();
                    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                };

                function addExtraRow(ef, val) {
                    if (addedKeys.has(ef.key)) return;
                    addedKeys.add(ef.key);

                    const row = css(mk('div'), {
                        display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '7px',
                    });
                    const inner = css(mk('div'), { flex: '1' });

                    const rLbl = css(mk('label'), {
                        display: 'block', fontSize: '11px', fontWeight: 'bold',
                        color: '#888', marginBottom: '3px', fontFamily: 'Arial, sans-serif',
                    });
                    rLbl.textContent = ef.label;
                    rLbl.htmlFor = `${prefix}-${ef.key}`;

                    const rInput = css(mk('input'), {
                        width: '100%', padding: '6px 8px', border: '1px solid #ccc',
                        borderRadius: '4px', fontSize: '12px', fontFamily: 'Arial, sans-serif',
                        background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none',
                    });
                    rInput.type = 'text';
                    rInput.id = `${prefix}-${ef.key}`;
                    rInput.placeholder = ef.label;
                    rInput.dataset.extraKey = ef.key;
                    if (val) rInput.value = val;

                    const rmBtn = css(mk('button'), {
                        flexShrink: '0', padding: '4px 7px', fontSize: '13px', lineHeight: '1',
                        border: '1px solid #ccc', borderRadius: '4px', background: '#f5f5f5',
                        color: '#888', cursor: 'pointer',
                    });
                    rmBtn.textContent = '×';
                    rmBtn.title = 'Remove field';
                    rmBtn.onclick = (e) => {
                        e.preventDefault();
                        row.remove();
                        addedKeys.delete(ef.key);
                        if (chips[ef.key]) chips[ef.key].style.display = '';
                        addBtn.style.display = '';
                    };

                    inner.append(rLbl, rInput);
                    row.append(inner, rmBtn);
                    addedContainer.appendChild(row);

                    if (chips[ef.key]) chips[ef.key].style.display = 'none';
                    if (addedKeys.size === f.extraFields.length) {
                        panel.style.display = 'none';
                        addBtn.style.display = 'none';
                    }
                }

                f.extraFields.forEach(ef => {
                    const chip = css(mk('button'), {
                        padding: '3px 8px', fontSize: '11px', fontFamily: 'Arial, sans-serif',
                        border: '1px solid #c8d0d9', borderRadius: '12px',
                        background: '#fff', color: '#444', cursor: 'pointer',
                    });
                    chip.textContent = ef.label;
                    chip.onclick = (e) => { e.preventDefault(); addExtraRow(ef, ''); };
                    chips[ef.key] = chip;
                    panel.appendChild(chip);
                });

                f.extraFields.forEach(ef => {
                    if (values && values[ef.key]) addExtraRow(ef, values[ef.key]);
                });

                const extrasSection = mk('div');
                extrasSection.append(addedContainer, addBtn, panel);
                container.appendChild(extrasSection);
            }
        });
    }

    /** Builds the freeform textarea and appends it into container. */
    function buildFreeformInput(note, prefix, container) {
        container.innerHTML = '';
        const ta = css(mk('textarea', { id: `${prefix}-note` }), {
            width: '100%', height: '60px', resize: 'vertical',
            fontFamily: '"Courier New", Courier, monospace', fontSize: '12px',
            lineHeight: '1.5', padding: '8px', border: '1px solid #ccc',
            borderRadius: '4px', background: '#fafafa', color: '#333',
            boxSizing: 'border-box', outline: 'none'
        });
        ta.placeholder = 'Details (optional) — e.g. domain, user, reason…';
        if (note) ta.value = note;
        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddEntry();
        });
        container.appendChild(ta);
    }

    /** Optional "Additional Details" textarea appended below all schema fields. */
    function buildOptionalNoteInput(note, prefix, container) {
        const hasValue = Boolean(note);

        const taWrap = css(mk('div'), { display: hasValue ? 'block' : 'none', marginTop: '4px' });
        const lbl = css(mk('label'), {
            display: 'block', fontSize: '11px', fontWeight: 'bold',
            color: '#666', marginBottom: '3px', fontFamily: 'Arial, sans-serif',
        });
        lbl.textContent = 'Additional Details';
        lbl.htmlFor = `${prefix}-note`;

        const ta = css(mk('textarea', { id: `${prefix}-note` }), {
            width: '100%', height: '52px', resize: 'vertical',
            fontFamily: '"Courier New", Courier, monospace', fontSize: '12px',
            padding: '6px', border: '1px solid #ccc', borderRadius: '4px',
            background: '#fafafa', color: '#333', boxSizing: 'border-box', outline: 'none',
        });
        ta.placeholder = 'Additional details (optional)';
        if (note) ta.value = note;

        taWrap.append(lbl, ta);

        const addBtn = css(mk('button'), {
            display: hasValue ? 'none' : 'block', fontSize: '11px',
            fontFamily: 'Arial, sans-serif', color: '#0066cc', background: 'none',
            border: 'none', padding: '4px 0 2px 0', cursor: 'pointer',
            textDecoration: 'underline', marginTop: '4px',
        });
        addBtn.textContent = '+ Add field';
        addBtn.onclick = (e) => {
            e.preventDefault();
            taWrap.style.display = 'block';
            addBtn.style.display = 'none';
            ta.focus();
        };

        container.append(addBtn, taWrap);
    }

    /** Rebuilds the dynamic input area based on selected type. */
    function rebuildInputFields(type, values, note, prefix, container) {
        const schema = getSchema(type);
        if (schema) {
            buildFieldInputs(schema, values || {}, prefix, container);
            buildOptionalNoteInput(note || '', prefix, container);
        } else {
            buildFreeformInput(note || '', prefix, container);
        }
    }

    /** Collects values from schema field inputs, including any added extra fields. */
    function collectFieldValues(schema, prefix) {
        const vals = {};
        schema.forEach(f => {
            const el = document.getElementById(`${prefix}-${f.key}`);
            vals[f.key] = el ? el.value.trim() : '';
            if (f.extraFields) {
                f.extraFields.forEach(ef => {
                    const el = document.getElementById(`${prefix}-${ef.key}`);
                    if (el) vals[ef.key] = el.value.trim();
                });
            }
        });
        return vals;
    }

    /* ==========================================================
     *  ENTRY CONTENT FORMATTER  (for card display + export text)
     * ==========================================================*/

    function formatEntryContent(entry, forExport = false) {
        if (entry.fields && typeof entry.fields === 'object') {
            const schema = getSchema(entry.type);
            if (schema) {
                const labelMap = {};
                const orderedKeys = [];
                schema.forEach(f => {
                    labelMap[f.key] = f.label;
                    orderedKeys.push(f.key);
                    if (f.extraFields) f.extraFields.forEach(ef => {
                        labelMap[ef.key] = ef.label;
                        orderedKeys.push(ef.key);
                    });
                });
                const lines = orderedKeys
                    .filter(k => entry.fields[k])
                    .map(k => `${labelMap[k] || k}: ${entry.fields[k]}`);
                if (entry.note) lines.push(`Additional Details: ${entry.note}`);
                return lines.join('\n') || '(all fields empty)';
            }
            return Object.entries(entry.fields)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n') || '(all fields empty)';
        }
        return entry.note || '(no detail provided)';
    }

    /* ==========================================================
     *  CLIPBOARD / TEXT HELPERS
     * ==========================================================*/

    function entriesToText(ticket, entries) {
        const sep  = '─'.repeat(50);
        const head = `Change Log — ${ticket}\nGenerated: ${nowStamp()}\n${sep}\n`;
        if (!entries.length) return head + '\n(no entries)\n';
        return head + '\n' + [...entries].reverse()
            .map(e => `[${e.ts}] ${e.type}\n${formatEntryContent(e, true)}\n`)
            .join('\n');
    }

    async function copyToClipboard(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    }

    /* ==========================================================
     *  GROUPED SUMMARY BUILDER  (with full net-state reconciliation)
     * ==========================================================*/

    // ── Domain-list reconciliation ─────────────────────────────
    // Used for URL Lists, SSL Decryption, Steering Exceptions, App Exceptions.
    // nameKey   : entry.fields key that identifies the entity (e.g. the list name)
    // domainKey : entry.fields key that holds the items to reconcile (domains, apps, etc.)
    // addTypes / removeTypes / deleteTypes : entry type strings for each operation

    const RECONCILE_CONFIG = {
        'URL Lists': {
            nameKey:     'urlListName',
            domainKey:   'domains',
            createTypes: ['URL List Created'],
            addTypes:    ['URL List Created', 'URL List — URLs Added'],
            removeTypes: ['URL List — URLs Removed'],
            deleteTypes: ['URL List Removed'],
        },
        'SSL Decryption Policies': {
            nameKey:     'sslPolicyName',
            domainKey:   'domains',
            createTypes: ['SSL Decryption Policy Created'],
            addTypes:    ['SSL Decryption Policy Created', 'SSL Decryption — URLs Added'],
            removeTypes: ['SSL Decryption — URLs Removed'],
            deleteTypes: ['SSL Decryption Policy Removed'],
        },
        'Steering Exceptions': {
            nameKey:     'steeringApplied',
            domainKey:   'urlsOrNetwork',
            addTypes:    ['Steering Exception Added'],
            removeTypes: ['Steering Exception Removed'],
            deleteTypes: [],
        },
        'App Exceptions': {
            nameKey:     'steeringApplied',
            domainKey:   'app',
            addTypes:    ['App Exception Added'],
            removeTypes: ['App Exception Removed'],
            deleteTypes: [],
        },
        'Network Locations': {
            nameKey:     'locationName',
            domainKey:   'ips',
            createTypes: ['Network Location Created'],
            addTypes:    ['Network Location Created', 'Network Location — IPs Added'],
            removeTypes: ['Network Location — IPs Removed'],
            deleteTypes: ['Network Location Removed'],
        },
        'Custom Categories': {
            nameKey:     'categoryName',
            domainKey:   'urlLists',
            createTypes: ['Custom Category Created'],
            addTypes:    ['Custom Category Created', 'Custom Category — URL Lists Added'],
            removeTypes: ['Custom Category — URL Lists Removed'],
            deleteTypes: ['Custom Category Removed'],
        },
    };

    // ── Lifecycle reconciliation ───────────────────────────────
    // Used for Policies and Steering/Client Configs.
    // Tracks whether an entity was created, modified, and/or deleted within the ticket.
    // Created + Deleted in same ticket = net zero → skipped entirely in summary.

    const LIFECYCLE_CONFIG = {
        'Policy Changes': {
            nameKey:     'policyName',
            createTypes: ['Policy Created'],
            modifyTypes: ['Policy Modified'],
            deleteTypes: ['Policy Deleted'],
        },
        'DLP Policy Changes': {
            nameKey:     'policyName',
            createTypes: ['DLP Policy Created'],
            modifyTypes: ['DLP Policy Modified'],
            deleteTypes: ['DLP Policy Deleted'],
        },
        'Steering / Client Configs': {
            nameKey:     'configName',
            createTypes: ['Steering/Client Config Created'],
            modifyTypes: ['Steering/Client Config Modified'],
            deleteTypes: ['Steering/Client Config Deleted'],
        },
        'User Notifications': {
            nameKey:     'notificationName',
            createTypes: ['User Notification Added'],
            modifyTypes: ['User Notification Modified'],
            deleteTypes: ['User Notification Removed'],
        },
        'Custom Apps': {
            nameKey:     'appName',
            createTypes: ['Custom App Added'],
            modifyTypes: ['Custom App Edited'],
            deleteTypes: ['Custom App Removed'],
        },
        'Certified Pinned Apps': {
            nameKey:     'appName',
            createTypes: ['Certified Pinned App Added'],
            modifyTypes: ['Certified Pinned App Edited'],
            deleteTypes: ['Certified Pinned App Removed'],
        },
        'File Profiles': {
            nameKey:     'name',
            createTypes: ['File Profile Added'],
            modifyTypes: ['File Profile Modified'],
            deleteTypes: ['File Profile Removed'],
        },
        'DLP Profiles': {
            nameKey:     'name',
            createTypes: ['DLP Profile Added'],
            modifyTypes: ['DLP Profile Modified'],
            deleteTypes: ['DLP Profile Removed'],
        },
    };

    // ── Shared helpers ─────────────────────────────────────────

    /** Splits a freeform value string (comma / newline / semicolon) into trimmed items. */
    function parseDomains(raw) {
        return (raw || '').split(/[\n,;]+/).map(d => d.trim()).filter(Boolean);
    }

    /**
     * Domain-list reconciliation (firstOp + lastOp net-change model).
     *
     *   firstOp=+, lastOp=+  → [ADDED]    new item, still present
     *   firstOp=-, lastOp=-  → [REMOVED]  pre-existing item, still gone
     *   firstOp=+, lastOp=-  → SKIP       added then removed = net zero
     *   firstOp=-, lastOp=+  → SKIP       pre-existing, removed then re-added = net zero
     *
     * Returns [{ name, items: [{display, op}], deleted }] in first-seen entity order.
     */
    function reconcileEntityEntries(entries, config) {
        const entityOrder = [];
        const entityMap   = {};

        entries.forEach(entry => {
            const name = entry.fields?.[config.nameKey]?.trim() || '(unnamed)';

            if (!entityMap[name]) {
                entityOrder.push(name);
                entityMap[name] = { ops: new Map(), deleted: false, isNew: false };
            }

            const rec   = entityMap[name];
            const items = parseDomains(entry.fields?.[config.domainKey] || '');

            if (config.createTypes?.includes(entry.type)) rec.isNew = true;

            if (config.addTypes.includes(entry.type)) {
                items.forEach(d => {
                    const key = d.toLowerCase(), ex = rec.ops.get(key);
                    rec.ops.set(key, ex
                        ? { ...ex, lastOp: '+' }
                        : { display: d, firstOp: '+', lastOp: '+' });
                });
                rec.deleted = false;

            } else if (config.removeTypes.includes(entry.type)) {
                items.forEach(d => {
                    const key = d.toLowerCase(), ex = rec.ops.get(key);
                    rec.ops.set(key, ex
                        ? { ...ex, lastOp: '-' }
                        : { display: d, firstOp: '-', lastOp: '-' });
                });

            } else if (config.deleteTypes.includes(entry.type)) {
                rec.deleted = true;
            }
        });

        return entityOrder.map(name => {
            const { ops, deleted, isNew } = entityMap[name];
            const items = [...ops.values()]
                .filter(({ firstOp, lastOp }) => firstOp === lastOp)  // net-zero pairs dropped
                .map(({ display, lastOp }) => ({ display, op: lastOp }));
            return { name, items, deleted, isNew };
        });
    }

    /**
     * Lifecycle reconciliation for Created / Modified / Deleted entities.
     *
     * Rules (evaluated on the sequence of ops in chronological order):
     *   first=create, last=delete → SKIP (created and deleted in same ticket = net zero)
     *   last=delete               → [DELETED]  show entity name only
     *   first=create              → [CREATED]  show latest field values
     *   (only modifications)      → [MODIFIED] show latest field values
     *
     * Returns [{ name, tag, latestFields, latestType }] with net-zero entries removed.
     */
    function reconcileLifecycleEntries(entries, config) {
        const entityOrder = [];
        const entityMap   = {};

        entries.forEach(entry => {
            const name = entry.fields?.[config.nameKey]?.trim() || '(unnamed)';

            if (!entityMap[name]) {
                entityOrder.push(name);
                entityMap[name] = { firstCat: null, lastCat: null, latestFields: null, latestType: null };
            }

            const rec = entityMap[name];
            const cat = config.createTypes.includes(entry.type) ? 'create'
                      : config.modifyTypes.includes(entry.type) ? 'modify'
                      : config.deleteTypes.includes(entry.type) ? 'delete'
                      : null;
            if (!cat) return;

            if (!rec.firstCat) rec.firstCat = cat;
            rec.lastCat      = cat;
            rec.latestFields = entry.fields;
            rec.latestType   = entry.type;
        });

        return entityOrder
            .map(name => {
                const { firstCat, lastCat, latestFields, latestType } = entityMap[name];
                // Determine summary tag
                const tag = lastCat === 'delete' ? '[DELETED]'
                          : firstCat === 'create' ? '[CREATED]'
                          : '[MODIFIED]';
                return { name, firstCat, lastCat, tag, latestFields, latestType };
            })
            // Drop net-zero: created then deleted within the same ticket
            .filter(({ firstCat, lastCat }) => !(firstCat === 'create' && lastCat === 'delete'));
    }

    // ── Summary builder ────────────────────────────────────────

    function buildGroupedSummary(ticket, entries) {
        const bar        = '═'.repeat(50);
        const lines      = [`CHANGE SUMMARY — ${ticket}`, `Generated: ${nowStamp()}`, bar, ''];
        const coveredIds = new Set();

        CATEGORY_GROUPS.forEach(({ label, types }) => {
            const matching = entries.filter(e => types.includes(e.type));
            if (!matching.length) return;

            // Always mark entries as covered so they don't appear in the catch-all
            matching.forEach(e => coveredIds.add(e.id));

            const chronological = [...matching].sort((a, b) => a.ts.localeCompare(b.ts));
            const reconcileConf = RECONCILE_CONFIG[label];
            const lifecycleConf = LIFECYCLE_CONFIG[label];

            if (reconcileConf) {
                // ── Domain-list groups ──────────────────────────
                const reconciled = reconcileEntityEntries(chronological, reconcileConf);
                if (!reconciled.length) return;

                lines.push(`[ ${label} ]`, '');
                reconciled.forEach(({ name, items, deleted, isNew }) => {
                    const entityTag = deleted ? '  [REMOVED]' : isNew ? '  [CREATED]' : '';
                    lines.push(`  ${name}${entityTag}`);
                    if (items.length) {
                        items.forEach(({ display, op }) =>
                            lines.push(`    • ${display}  ${op === '+' ? '[ADDED]' : '[REMOVED]'}`)
                        );
                    } else if (!deleted) {
                        lines.push(`    • (no items recorded)`);
                    }
                    lines.push('');
                });

            } else if (lifecycleConf) {
                // ── Lifecycle groups (Policies, Steering Configs) ─
                const reconciled = reconcileLifecycleEntries(chronological, lifecycleConf);
                if (!reconciled.length) return; // all entries cancelled out, skip group

                lines.push(`[ ${label} ]`, '');
                reconciled.forEach(({ name, tag, lastCat, latestFields, latestType }) => {
                    lines.push(`  ${name}  ${tag}`);

                    if (lastCat !== 'delete' && latestFields) {
                        // Show latest field values (skip the name field itself — already on the header)
                        const schema = getSchema(latestType);
                        if (schema) {
                            schema
                                .filter(f => f.key !== lifecycleConf.nameKey && latestFields[f.key])
                                .forEach(f => lines.push(`    • ${f.label}: ${latestFields[f.key]}`));
                        }
                    }
                    lines.push('');
                });

            } else {
                // ── Non-reconciled groups (Other / Custom) ────────
                lines.push(`[ ${label} ]`, '');
                chronological.forEach(e => {
                    lines.push(`  ${e.type}  •  ${e.ts}`);
                    formatEntryContent(e, true).split('\n')
                        .forEach(line => lines.push(`    • ${line}`));
                    lines.push('');
                });
            }
        });

        // Catch-all for types not covered by any CATEGORY_GROUP
        const uncovered = entries.filter(e => !coveredIds.has(e.id));
        if (uncovered.length) {
            lines.push('[ Other ]', '');
            uncovered
                .sort((a, b) => a.ts.localeCompare(b.ts))
                .forEach(e => {
                    lines.push(`  ${e.type}  •  ${e.ts}`);
                    formatEntryContent(e, true).split('\n')
                        .forEach(line => lines.push(`    • ${line}`));
                    lines.push('');
                });
        }

        return lines.join('\n').trim();
    }

    /* ==========================================================
     *  FLASH STATUS
     * ==========================================================*/

    function flashStatus(msg, color = '#28a745', ms = 2800) {
        const el = document.getElementById('ct-status');
        if (!el) return;
        el.style.color = color;
        el.textContent = msg;
        setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, ms);
    }

    /* ==========================================================
     *  INLINE TWO-CLICK CONFIRM  (per-entry delete)
     * ==========================================================*/

    function inlineConfirm(btn, onConfirm) {
        if (btn.dataset.confirming === '1') { onConfirm(); return; }
        const origText = btn.textContent, origBg = btn.style.background;
        btn.dataset.confirming = '1';
        btn.textContent = 'Sure?'; btn.style.background = '#c0392b';
        setTimeout(() => {
            if (btn.dataset.confirming === '1') {
                btn.dataset.confirming = ''; btn.textContent = origText; btn.style.background = origBg;
            }
        }, 3000);
    }

    /* ==========================================================
     *  CONFIRM MODAL  (bulk / destructive actions)
     * ==========================================================*/

    function confirmModal(message, onYes) {
        const ov = css(mk('div'), { position:'fixed', inset:'0', background:'rgba(0,0,0,.45)', zIndex:'1100000' });
        const md = css(mk('div'), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1100001', background:'#fff', border:'2px solid #dc3545',
            padding:'24px', borderRadius:'10px', fontFamily:'Arial, sans-serif',
            minWidth:'300px', boxShadow:'0 4px 16px rgba(0,0,0,.3)', textAlign:'center'
        });
        const msg = css(mk('p'), { margin:'0 0 18px', fontSize:'13px', color:'#333', lineHeight:'1.5', whiteSpace:'pre-line' });
        msg.textContent = message;
        const row = css(mk('div'), { display:'flex', gap:'10px', justifyContent:'center' });
        const bs = { padding:'8px 22px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif' };
        const yes = css(mk('button'), { ...bs, background:'#dc3545', color:'#fff' });
        yes.textContent = 'Delete';
        yes.onclick = () => { ov.remove(); md.remove(); onYes(); };
        const no = css(mk('button'), { ...bs, background:'#6c757d', color:'#fff' });
        no.textContent = 'Cancel';
        no.onclick = () => { ov.remove(); md.remove(); };
        row.append(yes, no); md.append(msg, row);
        document.body.append(ov, md);
        ov.onclick = () => no.click();
    }

    /* ==========================================================
     *  ENTRY CARD RENDERER
     * ==========================================================*/

    function renderEntryCard(entry, ticket, onMutated) {
        const color = typeColor(entry.type);

        const card = css(mk('div'), {
            background:'#fff', border:'1px solid #e0e0e0', borderRadius:'6px',
            padding:'10px 12px 10px 16px', marginBottom:'8px', position:'relative'
        });

        // Left colour accent bar
        card.appendChild(css(mk('div'), {
            position:'absolute', left:'0', top:'0', bottom:'0',
            width:'4px', borderRadius:'6px 0 0 6px', background: color
        }));

        // Top row: badge + action buttons
        const topRow = css(mk('div'), { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'6px' });

        const badge = css(mk('span'), {
            display:'inline-block', padding:'2px 8px', background: color, color:'#fff',
            borderRadius:'3px', fontSize:'11px', fontWeight:'bold', fontFamily:'Arial, sans-serif',
            flexShrink: '0'
        });
        badge.textContent = entry.type;

        const btnGroup = css(mk('div'), { display:'flex', gap:'4px', marginLeft:'6px', flexShrink:'0' });

        // Edit button
        const editBtn = css(mk('button'), {
            background:'#667eea', color:'#fff', border:'none', borderRadius:'3px',
            cursor:'pointer', padding:'2px 8px', fontSize:'10px', fontFamily:'Arial, sans-serif', fontWeight:'bold'
        });
        editBtn.textContent = '✎ Edit';
        editBtn.onclick = () => openEditModal(ticket, entry, onMutated);

        // Rewrite-to-ticket button (only shown for entries with a template)
        let writeBtn = null;
        if (ticketWriter.hasTemplate(entry.type)) {
            writeBtn = css(mk('button'), {
                background:'#17a2b8', color:'#fff', border:'none', borderRadius:'3px',
                cursor:'pointer', padding:'2px 8px', fontSize:'10px', fontFamily:'Arial, sans-serif', fontWeight:'bold'
            });
            writeBtn.textContent = '↪ Write';
            writeBtn.title = 'Rewrite this entry into the ticket worknote/comments';
            writeBtn.onclick = async () => {
                if (writeBtn.disabled) return;
                writeBtn.disabled = true;
                const prev = writeBtn.textContent;
                writeBtn.textContent = '…';
                try {
                    const res = await ticketWriter.writeEntry(entry);
                    if (res && res.ok) {
                        const where = res.wrote === 'both'      ? 'Work Notes + Comments'
                                    : res.wrote === 'workNotes' ? 'Work Notes'
                                    :                             'Comments';
                        flashStatus(`✓ Written to ${where}`);
                    } else if (res && res.reason === 'no-field') {
                        flashStatus('⚠️ No worknote/comments field visible.', '#e67e22');
                    } else if (res && res.reason === 'error') {
                        flashStatus('✗ Write failed (see console).', '#dc3545');
                    }
                } finally {
                    writeBtn.textContent = prev;
                    writeBtn.disabled = false;
                }
            };
        }

        // Delete button
        const delBtn = css(mk('button'), {
            background:'#e9ecef', color:'#6c757d', border:'none', borderRadius:'3px',
            cursor:'pointer', padding:'2px 8px', fontSize:'11px', fontFamily:'Arial, sans-serif', fontWeight:'bold'
        });
        delBtn.textContent = '×';
        delBtn.title = 'Delete entry (click twice)';
        delBtn.onclick = () => inlineConfirm(delBtn, () => {
            css(card, { opacity:'0', transition:'opacity .2s' });
            setTimeout(async () => {
                card.remove();
                await deleteEntry(ticket, entry.id);
                onMutated();
            }, 200);
        });

        if (writeBtn) btnGroup.append(editBtn, writeBtn, delBtn);
        else          btnGroup.append(editBtn, delBtn);
        topRow.append(badge, btnGroup);
        card.appendChild(topRow);

        // Content
        const contentEl = css(mk('div'), {
            fontSize:'12px', color:'#333', lineHeight:'1.6',
            wordBreak:'break-word', fontFamily:'Arial, sans-serif'
        });
        if (entry.fields && typeof entry.fields === 'object') {
            const schema = getSchema(entry.type);
            if (schema) {
                const labelMap = {};
                const orderedKeys = [];
                schema.forEach(f => {
                    labelMap[f.key] = f.label;
                    orderedKeys.push(f.key);
                    if (f.extraFields) f.extraFields.forEach(ef => {
                        labelMap[ef.key] = ef.label;
                        orderedKeys.push(ef.key);
                    });
                });
                const visibleKeys = orderedKeys.filter(k => entry.fields[k]);
                if (!visibleKeys.length && !entry.note) {
                    contentEl.textContent = '(all fields empty)';
                } else {
                    visibleKeys.forEach(k => {
                        const row = mk('div');
                        const lbl = mk('strong');
                        lbl.textContent = (labelMap[k] || k) + ':';
                        const val = mk('span');
                        val.style.whiteSpace = 'pre-wrap';
                        val.textContent = ' ' + entry.fields[k];
                        row.append(lbl, val);
                        contentEl.appendChild(row);
                    });
                    if (entry.note) {
                        const row = mk('div');
                        const lbl = mk('strong');
                        lbl.textContent = 'Additional Details:';
                        const val = mk('span');
                        val.style.whiteSpace = 'pre-wrap';
                        val.textContent = ' ' + entry.note;
                        row.append(lbl, val);
                        contentEl.appendChild(row);
                    }
                }
            } else {
                contentEl.style.whiteSpace = 'pre-wrap';
                contentEl.textContent = Object.entries(entry.fields)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n') || '(all fields empty)';
            }
        } else {
            contentEl.style.whiteSpace = 'pre-wrap';
            contentEl.textContent = entry.note || '(no detail provided)';
        }
        card.appendChild(contentEl);

        // Timestamp + author
        const author = entry.author_label || entry.author_user_id || '(unknown)';
        card.appendChild(css(Object.assign(mk('div'), { textContent: `${entry.ts}  ·  by ${author}` }), {
            fontSize:'10px', color:'#bbb', marginTop:'6px', fontFamily:'monospace'
        }));

        return card;
    }

    /* ==========================================================
     *  LOG FILTER
     * ==========================================================*/

    function filterEntries(entries, filter) {
        let result = entries;

        const q = (filter.query || '').toLowerCase().trim();
        if (q) {
            result = result.filter(e => {
                const content = formatEntryContent(e).toLowerCase();
                const author  = (e.author_label || e.author_user_id || '').toLowerCase();
                return (
                    e.type.toLowerCase().includes(q) ||
                    content.includes(q) ||
                    author.includes(q) ||
                    e.ts.includes(q) ||
                    (e.note || '').toLowerCase().includes(q)
                );
            });
        }

        // entry.ts format: "YYYY-MM-DD HH:MM" — lexicographic comparison works correctly
        if (filter.dateFrom) {
            result = result.filter(e => e.ts >= filter.dateFrom);
        }
        if (filter.dateTo) {
            result = result.filter(e => e.ts.slice(0, 10) <= filter.dateTo);
        }

        return result;
    }

    /* ==========================================================
     *  LOG REFRESH
     * ==========================================================*/

    function refreshLog(ticket) {
        const container = document.getElementById('ct-log-container');
        const countEl   = document.getElementById('ct-entry-count');
        if (!container) return;

        const allEntries      = loadEntries(ticket);
        const filteredEntries = filterEntries(allEntries, activeFilter);
        const isFiltered      = filteredEntries.length !== allEntries.length;
        container.innerHTML   = '';

        if (countEl) {
            if (!allEntries.length) {
                countEl.textContent = 'No entries yet';
            } else if (isFiltered) {
                countEl.textContent = `${filteredEntries.length} of ${allEntries.length} ${allEntries.length === 1 ? 'entry' : 'entries'}`;
            } else {
                countEl.textContent = `${allEntries.length} ${allEntries.length === 1 ? 'entry' : 'entries'}`;
            }
        }

        if (!allEntries.length) {
            container.appendChild(
                css(Object.assign(mk('div'), { textContent: 'No changes logged yet — add your first entry above.' }), {
                    textAlign:'center', color:'#ccc', fontSize:'12px',
                    padding:'28px 0', fontFamily:'Arial, sans-serif', fontStyle:'italic'
                })
            );
            return;
        }

        if (!filteredEntries.length) {
            container.appendChild(
                css(Object.assign(mk('div'), { textContent: 'No entries match the current filter.' }), {
                    textAlign:'center', color:'#aaa', fontSize:'12px',
                    padding:'28px 0', fontFamily:'Arial, sans-serif', fontStyle:'italic'
                })
            );
            return;
        }

        [...filteredEntries].reverse().forEach(e =>
            container.appendChild(renderEntryCard(e, ticket, () => refreshLog(ticket)))
        );
    }

    /* ==========================================================
     *  EDIT MODAL
     * ==========================================================*/

    function openEditModal(ticket, entry, onSaved) {
        document.getElementById('ct-edit-overlay')?.remove();
        document.getElementById('ct-edit-modal')?.remove();

        const overlay = css(mk('div', { id:'ct-edit-overlay' }), {
            position:'fixed', inset:'0', background:'rgba(0,0,0,.5)', zIndex:'1050000'
        });
        const modal = css(mk('div', { id:'ct-edit-modal' }), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1050001', background:'#f9f9f9', border:'1px solid #ccc',
            borderRadius:'10px', padding:'20px', width:'480px', maxWidth:'92vw',
            maxHeight:'86vh', overflowY:'auto', fontFamily:'Arial, sans-serif',
            boxShadow:'0 6px 24px rgba(0,0,0,.25)'
        });

        // Header
        const hdr = css(mk('div'), { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' });
        const hTitle = css(mk('div'), { fontSize:'15px', fontWeight:'bold', color:'#333', fontFamily:'Arial, sans-serif' });
        hTitle.textContent = '✎ Edit Entry';
        const closeX = css(mk('button'), { background:'red', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', padding:'4px 10px', fontWeight:'bold', fontSize:'18px', lineHeight:'1' });
        closeX.textContent = '×';
        closeX.onclick = () => { overlay.remove(); modal.remove(); };
        hdr.append(hTitle, closeX);
        modal.appendChild(hdr);

        // Timestamp note
        modal.appendChild(css(Object.assign(mk('div'), { textContent: `Created: ${entry.ts}  (timestamp is immutable)` }), {
            fontSize:'10px', color:'#aaa', marginBottom:'12px', fontFamily:'monospace'
        }));

        // Type label
        modal.appendChild(css(Object.assign(mk('div'), { textContent: 'Change type' }), {
            fontSize:'11px', fontWeight:'bold', color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));

        // Type dropdown — all types, grouped, pre-selected to current entry type
        const typeSelect = makeSnippetSelect('ct-edit-type', entry.type, false);
        typeSelect.style.marginBottom = '12px';
        modal.appendChild(typeSelect);

        // Dynamic fields container
        const fieldsContainer = mk('div', { id:'ct-edit-fields-container' });
        modal.appendChild(fieldsContainer);

        // Build/rebuild fields
        let prevSchemaKey = getSchemaKey(entry.type);
        rebuildInputFields(entry.type, entry.fields, entry.note, 'ct-edit-field', fieldsContainer);

        typeSelect.addEventListener('change', () => {
            const newType      = typeSelect.value;
            const newSchemaKey = getSchemaKey(newType);
            // Preserve values if schema didn't change
            const carry = (prevSchemaKey && newSchemaKey === prevSchemaKey && FIELD_SCHEMAS[prevSchemaKey])
                ? collectFieldValues(FIELD_SCHEMAS[prevSchemaKey], 'ct-edit-field')
                : {};
            rebuildInputFields(newType, carry, null, 'ct-edit-field', fieldsContainer);
            prevSchemaKey = newSchemaKey;
        });

        // Save / Cancel
        const btnRow = css(mk('div'), { display:'flex', gap:'10px', marginTop:'14px' });

        const saveBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        saveBtn.textContent = '✓ Save Changes';
        saveBtn.onclick = async () => {
            const newType  = typeSelect.value;
            const schema   = getSchema(newType);
            const newFields = schema ? collectFieldValues(schema, 'ct-edit-field') : null;
            const newNote   = (document.getElementById('ct-edit-field-note')?.value.trim() || null);

            await updateEntry(ticket, entry.id, newType, newFields, newNote);
            overlay.remove(); modal.remove();
            refreshLog(ticket);
            flashStatus('✓ Entry updated.');
            if (onSaved) onSaved();
        };

        const cancelBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#6c757d', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => { overlay.remove(); modal.remove(); };

        btnRow.append(cancelBtn, saveBtn);
        modal.appendChild(btnRow);

        document.body.append(overlay, modal);
        overlay.onclick = () => cancelBtn.click();
    }

    /* ==========================================================
     *  SIDEBAR INITIALIZATION
     * ==========================================================*/

    function initializeSidebar() {
        if (document.getElementById('ct-sidebar')) return;

        const sidebar = css(mk('div', { id:'ct-sidebar' }), {
            position:'fixed', top:'60px', right:'-460px', width:'445px',
            maxHeight:'calc(100vh - 80px)', backgroundColor:'#f9f9f9',
            border:'1px solid #ccc', borderRight:'none',
            boxShadow:'-4px 4px 12px rgba(0,0,0,.12)', padding:'20px',
            zIndex:'999997', borderRadius:'10px 0 0 10px',
            fontFamily:'Arial, sans-serif', overflowY:'auto', overflowX:'hidden',
            transition:'right .3s ease-in-out', boxSizing:'border-box'
        });

        // ── Close ───────────────────────────────────────────────
        const closeBtn = css(mk('button'), {
            position:'absolute', top:'5px', right:'5px', background:'red', color:'white',
            border:'none', borderRadius:'4px', cursor:'pointer', padding:'4px 10px',
            fontWeight:'bold', fontSize:'18px', lineHeight:'1'
        });
        closeBtn.textContent = '×'; closeBtn.onclick = hideSidebar;
        sidebar.appendChild(closeBtn);

        // ── Title ────────────────────────────────────────────────
        sidebar.appendChild(
            css(Object.assign(mk('div'), { textContent:'✏️ Change Tracker' }), {
                fontSize:'16px', fontWeight:'bold', color:'#333', marginBottom:'4px', paddingRight:'30px'
            })
        );

        // ── Version row ──────────────────────────────────────────
        const verRow = css(mk('div'), { display:'flex', alignItems:'center', fontSize:'11px', color:'#999', marginBottom:'8px', paddingRight:'30px', flexWrap:'wrap' });
        const verSpan = css(mk('span'), { fontFamily:'monospace', fontSize:'10px' });
        verSpan.textContent = `v${SCRIPT_VERSION}`;
        verRow.appendChild(verSpan);

        if (isNewVersion() && !hasSeenChangelog()) {
            const dot = mk('span', { id:'ct-changelog-dot' });
            const d = mk('span', { className:'ct-dot' });
            const l = mk('span', { className:'ct-dot-label' });
            l.textContent = "What's New";
            dot.append(d, l); dot.onclick = showChangelogModal;
            verRow.appendChild(dot);
        }

        // Configure button — opens setup modal pre-filled with current values
        const cfgBtn = css(mk('button', { id:'ct-configure-btn', type:'button' }), {
            background:'transparent', color:'#666', border:'none', cursor:'pointer',
            padding:'2px 6px', marginLeft:'auto', fontSize:'11px',
            textDecoration:'underline', fontFamily:'Arial, sans-serif'
        });
        cfgBtn.textContent = '⚙ Configure';
        cfgBtn.title       = 'Change the Worker URL or API token';
        cfgBtn.onclick     = () => {
            const previousToken = GM_getValue('changeTrackerToken', '');
            const previousState = connState;
            openSetupPrompt({ previousToken, previousState });
        };
        verRow.appendChild(cfgBtn);

        sidebar.appendChild(verRow);

        // ── Ticket badge ─────────────────────────────────────────
        sidebar.appendChild(
            css(mk('div', { id:'ct-ticket-badge' }), {
                fontSize:'11px', color:'#444', background:'#e8f5e9', border:'1px solid #a5d6a7',
                borderRadius:'4px', padding:'4px 10px', marginBottom:'14px',
                fontFamily:'monospace', wordBreak:'break-all'
            })
        );

        // ── Connectivity banner (filled by renderConnBanner) ────
        sidebar.appendChild(
            css(mk('div', { id:'ct-conn-banner' }), {
                display:'none', alignItems:'center', justifyContent:'space-between',
                gap:'8px', padding:'7px 10px', borderRadius:'4px',
                marginBottom:'10px', fontSize:'12px', fontFamily:'Arial, sans-serif'
            })
        );

        // ══ INPUT AREA ═══════════════════════════════════════════

        const inputArea = css(mk('div'), {
            background:'#fff', border:'1px solid #ddd', borderRadius:'7px',
            padding:'12px', marginBottom:'10px'
        });

        inputArea.appendChild(
            css(Object.assign(mk('div'), { textContent:'New Entry' }), {
                fontSize:'11px', fontWeight:'bold', color:'#888', marginBottom:'8px',
                textTransform:'uppercase', letterSpacing:'.6px', fontFamily:'Arial, sans-serif'
            })
        );

        // Snippet dropdown
        const select = makeSnippetSelect('ct-snippet-select', '', true);
        inputArea.appendChild(select);

        // Dynamic fields container (starts as freeform textarea)
        const fieldsContainer = mk('div', { id:'ct-input-fields' });
        rebuildInputFields('', {}, '', 'ct-field', fieldsContainer);
        inputArea.appendChild(fieldsContainer);

        select.addEventListener('change', () => {
            rebuildInputFields(select.value, {}, '', 'ct-field', fieldsContainer);
            renderInputLock();   // re-apply lock to freshly-rendered inputs
        });

        // Add Entry button
        const addBtn = css(mk('button', { id:'ct-add-btn' }), {
            width:'100%', marginTop:'8px', padding:'8px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        addBtn.textContent = '+ Add Entry';
        addBtn.title = 'Ctrl+Enter also works inside the detail field';
        addBtn.onclick = handleAddEntry;
        inputArea.appendChild(addBtn);
        sidebar.appendChild(inputArea);

        // ── Status ───────────────────────────────────────────────
        sidebar.appendChild(
            css(mk('div', { id:'ct-status' }), {
                fontSize:'11px', color:'#28a745', minHeight:'16px',
                marginBottom:'8px', fontFamily:'Arial, sans-serif'
            })
        );

        // ══ LOG SECTION ══════════════════════════════════════════

        // Log header: count + button rows
        const logHeader = css(mk('div'), { marginBottom:'8px' });

        const logTop = css(mk('div'), { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' });
        const countEl = css(mk('div', { id:'ct-entry-count' }), {
            fontSize:'12px', fontWeight:'bold', color:'#555', fontFamily:'Arial, sans-serif'
        });
        countEl.textContent = 'No entries yet';
        logTop.appendChild(countEl);
        logHeader.appendChild(logTop);

        function rowOf(buttons) {
            const row = css(mk('div'), { display:'flex', gap:'5px', marginBottom:'4px' });
            buttons.forEach(([label, bg, cb, title]) => {
                const b = css(mk('button'), {
                    flex:'1', padding:'5px 4px', background:bg, color:'#fff', border:'none',
                    borderRadius:'3px', cursor:'pointer', fontSize:'10px', fontWeight:'bold',
                    fontFamily:'Arial, sans-serif', whiteSpace:'nowrap'
                });
                b.textContent = label; if (title) b.title = title; b.onclick = cb;
                row.appendChild(b);
            });
            return row;
        }

        logHeader.appendChild(rowOf([
            ['📋 Copy All',     '#667eea', handleCopyAll,       'Copy full log to clipboard'],
            ['📝 Worknote',     '#5a6268', handleGroupedSummary,'Copy all ticket changes as a closing worknote summary'],
            ['🗑️ Clear',       '#dc3545', handleClearAll,      'Delete all entries for this ticket (everyone)'],
        ]));

        sidebar.appendChild(logHeader);

        // ── Search / filter bar ──────────────────────────────────
        const filterBar = css(mk('div'), { marginBottom:'6px' });

        // Keyword row
        const kwRow = css(mk('div'), { display:'flex', alignItems:'center', gap:'4px', marginBottom:'5px' });

        const kwInput = css(mk('input', { id:'ct-filter-search', type:'text', placeholder:'Filter by type, value, author…' }), {
            flex:'1', padding:'5px 8px', fontSize:'11px', border:'1px solid #d0d0d0',
            borderRadius:'4px', fontFamily:'Arial, sans-serif', outline:'none',
            color:'#333', boxSizing:'border-box',
        });
        kwInput.addEventListener('focus', () => { kwInput.style.borderColor = '#667eea'; });
        kwInput.addEventListener('blur',  () => { kwInput.style.borderColor = '#d0d0d0'; });
        kwInput.addEventListener('input', () => {
            activeFilter.query = kwInput.value;
            refreshLog(getTicketNumber());
        });

        const kwClear = css(mk('button', { type:'button', title:'Clear search' }), {
            background:'transparent', border:'none', cursor:'pointer',
            color:'#bbb', fontSize:'15px', padding:'0 3px', lineHeight:'1', flexShrink:'0',
        });
        kwClear.textContent = '×';
        kwClear.addEventListener('click', () => {
            kwInput.value = ''; activeFilter.query = '';
            refreshLog(getTicketNumber());
        });
        kwClear.addEventListener('mouseenter', () => { kwClear.style.color = '#333'; });
        kwClear.addEventListener('mouseleave', () => { kwClear.style.color = '#bbb'; });
        kwRow.append(kwInput, kwClear);
        filterBar.appendChild(kwRow);

        // Date range row
        const drRow = css(mk('div'), { display:'flex', alignItems:'center', gap:'4px' });

        const drLabel = css(Object.assign(mk('span'), { textContent:'Date:' }), {
            fontSize:'10px', color:'#999', fontFamily:'Arial, sans-serif', flexShrink:'0',
        });

        const dateStyle = {
            flex:'1', padding:'4px 5px', fontSize:'11px', border:'1px solid #d0d0d0',
            borderRadius:'4px', fontFamily:'Arial, sans-serif', color:'#333',
            outline:'none', minWidth:'0', boxSizing:'border-box',
        };

        const fromInput = css(mk('input', { id:'ct-filter-from', type:'date' }), dateStyle);
        fromInput.addEventListener('change', () => {
            activeFilter.dateFrom = fromInput.value;
            refreshLog(getTicketNumber());
        });

        const drSep = css(Object.assign(mk('span'), { textContent:'–' }), {
            fontSize:'10px', color:'#aaa', flexShrink:'0',
        });

        const toInput = css(mk('input', { id:'ct-filter-to', type:'date' }), dateStyle);
        toInput.addEventListener('change', () => {
            activeFilter.dateTo = toInput.value;
            refreshLog(getTicketNumber());
        });

        const drClear = css(mk('button', { type:'button', title:'Clear date range' }), {
            background:'transparent', border:'none', cursor:'pointer',
            color:'#bbb', fontSize:'15px', padding:'0 3px', lineHeight:'1', flexShrink:'0',
        });
        drClear.textContent = '×';
        drClear.addEventListener('click', () => {
            fromInput.value = ''; toInput.value = '';
            activeFilter.dateFrom = ''; activeFilter.dateTo = '';
            refreshLog(getTicketNumber());
        });
        drClear.addEventListener('mouseenter', () => { drClear.style.color = '#333'; });
        drClear.addEventListener('mouseleave', () => { drClear.style.color = '#bbb'; });

        drRow.append(drLabel, fromInput, drSep, toInput, drClear);
        filterBar.appendChild(drRow);

        sidebar.appendChild(filterBar);

        // Divider
        sidebar.appendChild(css(mk('div'), { height:'1px', background:'#e0e0e0', marginBottom:'10px' }));

        // Log container
        sidebar.appendChild(mk('div', { id:'ct-log-container' }));

        document.body.appendChild(sidebar);

        // Reflect current connectivity state into the freshly-built DOM
        renderConnBanner();
        renderInputLock();
    }

    /* ==========================================================
     *  CONNECTIVITY BANNER + INPUT LOCK
     *  Called by setConnState() any time connState changes, and
     *  once at the end of initializeSidebar() to apply the initial
     *  state to the freshly-built DOM.
     * ==========================================================*/

    function renderConnBanner() {
        const banner = document.getElementById('ct-conn-banner');
        if (!banner) return;

        // Hide the banner outside of OFFLINE / INVALID_TOKEN
        if (connState !== 'OFFLINE' && connState !== 'INVALID_TOKEN') {
            banner.style.display = 'none';
            banner.innerHTML     = '';
            return;
        }

        banner.innerHTML = '';
        banner.style.display = 'flex';

        if (connState === 'OFFLINE') {
            css(banner, {
                background:'#fff3cd', border:'1px solid #ffc107', color:'#856404'
            });
            const msg = mk('span'); msg.textContent = '⚠ Offline — read only';
            const btn = css(mk('button', { id:'ct-reconnect-btn' }), {
                background:'#ffc107', color:'#333', border:'none', borderRadius:'3px',
                cursor:'pointer', padding:'3px 10px', fontSize:'11px',
                fontWeight:'bold', fontFamily:'Arial, sans-serif'
            });
            btn.textContent = '↺ Reconnect';
            btn.onclick = () => attemptReconnect(getTicketNumber(), false);
            banner.append(msg, btn);

        } else if (connState === 'INVALID_TOKEN') {
            css(banner, {
                background:'#f8d7da', border:'1px solid #f5c6cb', color:'#721c24'
            });
            const msg = mk('span'); msg.textContent = '🔑 Token invalid';
            const btn = css(mk('button'), {
                background:'transparent', color:'#721c24', border:'none',
                cursor:'pointer', padding:'2px 4px', fontSize:'12px',
                textDecoration:'underline', fontFamily:'Arial, sans-serif',
                fontWeight:'bold'
            });
            btn.textContent = 'Reset token';
            btn.onclick = () => {
                const previousToken = GM_getValue('changeTrackerToken', '');
                const previousState = connState;
                GM_deleteValue('changeTrackerToken');
                openSetupPrompt({ previousToken, previousState });
            };
            banner.append(msg, btn);
        }
    }

    function renderInputLock() {
        const select = document.getElementById('ct-snippet-select');
        const fields = document.getElementById('ct-input-fields');
        const addBtn = document.getElementById('ct-add-btn');
        if (!select && !fields && !addBtn) return;

        const locked = connState !== 'ONLINE';

        if (select) select.disabled = locked;
        if (addBtn) {
            addBtn.disabled        = locked;
            addBtn.style.opacity   = locked ? '0.55' : '1';
            addBtn.style.cursor    = locked ? 'not-allowed' : 'pointer';
        }
        if (fields) {
            fields.querySelectorAll('input, textarea, select').forEach(el => {
                el.disabled = locked;
            });
        }
    }

    /* ==========================================================
     *  ADD ENTRY HANDLER
     * ==========================================================*/

    async function handleAddEntry() {
        const select = document.getElementById('ct-snippet-select');
        if (!select) return;

        // Block adding when the API is not currently usable
        if (connState !== 'ONLINE') {
            if (connState === 'OFFLINE')           flashStatus('⚠️ Offline — adding new entries is disabled.', '#e67e22');
            else if (connState === 'INVALID_TOKEN') flashStatus('🔑 Token invalid — reset to add entries.', '#dc3545');
            else                                    flashStatus('⚠️ Not connected yet.', '#e67e22');
            return;
        }

        // Empty selection → treat as "Custom"
        let type = select.value.trim() || 'Custom';

        const schema  = getSchema(type);
        let fields = null, note = null;

        if (schema) {
            fields = collectFieldValues(schema, 'ct-field');
            const noteTa = document.getElementById('ct-field-note');
            note = noteTa ? (noteTa.value.trim() || null) : null;
            const hasValue = Object.values(fields).some(v => v !== '') || Boolean(note);
            if (!hasValue) { flashStatus('⚠️ Fill in at least one field.', '#e67e22'); return; }
        } else {
            const ta = document.getElementById('ct-field-note');
            note = ta ? ta.value.trim() : '';
        }

        const ticket  = getTicketNumber();
        const entries = await addEntry(ticket, type, fields, note);

        // Reset
        select.value = '';
        const fc = document.getElementById('ct-input-fields');
        if (fc) rebuildInputFields('', {}, '', 'ct-field', fc);
        renderInputLock();   // re-apply lock to freshly-rendered inputs

        refreshLog(ticket);
        flashStatus(`✓ Entry added  (${entries.length} total)`);

        // Auto-write the equivalent text into the SNow worknote/comments
        // textareas based on which are visible. Custom entries (no template)
        // are skipped silently. Errors here must not block the entry save.
        if (getAutoWriteEnabled() && ticketWriter.hasTemplate(type)) {
            const lastEntry = entries[entries.length - 1];
            ticketWriter.writeEntry(lastEntry).catch(err => {
                console.warn('CT: ticket auto-write failed', err);
            });
        }
    }

    /* ==========================================================
     *  ACTION HANDLERS
     * ==========================================================*/

    async function handleCopyAll() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to copy.', '#e67e22'); return; }
        (await copyToClipboard(entriesToText(ticket, entries)))
            ? flashStatus('✓ Copied to clipboard!')
            : flashStatus('✗ Copy failed.', '#dc3545');
    }

    async function handleGroupedSummary() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ No entries to summarize.', '#e67e22'); return; }
        (await copyToClipboard(buildGroupedSummary(ticket, entries)))
            ? flashStatus('✓ Worknote summary copied!')
            : flashStatus('✗ Copy failed.', '#dc3545');
    }

    function handleClearAll() {
        const ticket = getTicketNumber(), entries = loadEntries(ticket);
        if (!entries.length) { flashStatus('⚠️ Nothing to clear.', '#e67e22'); return; }
        const msg =
            `Delete all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} for ${ticket}?\n` +
            `This wipes the log for EVERYONE on the team — including entries you didn't author.\n` +
            `This cannot be undone.`;
        confirmModal(msg, async () => {
            await clearEntries(ticket);
            refreshLog(ticket);
            flashStatus('✓ All entries cleared.');
        });
    }

    /* ==========================================================
     *  RECONNECT
     *  Pings the Worker, then issues a real authenticated request to
     *  prove the token is still valid. Routes through handleApiResponse
     *  on failure so OFFLINE / INVALID_TOKEN are surfaced consistently.
     * ==========================================================*/

    async function attemptReconnect(ticket, silent = false) {
        const btn = document.getElementById('ct-reconnect-btn');
        if (btn) {
            btn.textContent  = '↺';
            btn.disabled     = true;
            btn.style.opacity = '0.6';
        }

        const reachable = await api.ping();

        if (!reachable) {
            setConnState('OFFLINE');
            if (!silent) flashStatus('Still offline — try again later.', '#e67e22');
            const b = document.getElementById('ct-reconnect-btn');
            if (b) { b.textContent = '↺ Reconnect'; b.disabled = false; b.style.opacity = '1'; }
            return;
        }

        // Ping succeeded — verify token with a real request
        const res = await api.fetchEntries(ticket);
        if (res.ok) {
            _cacheEntries(ticket, res.data.entries || []);
            setConnState('ONLINE');
            refreshLog(ticket);
            if (!silent) flashStatus('✓ Back online!');
        } else {
            handleApiResponse(res);
            if (!silent && connState !== 'ONLINE') {
                flashStatus('Could not reconnect.', '#dc3545');
            }
        }
    }

    /* ==========================================================
     *  FIRST-RUN SETUP PROMPT
     *  Modal overlay (independent of sidebar) for capturing the
     *  Worker URL and bearer token. Reused by the "Reset token"
     *  link in the INVALID_TOKEN banner.
     * ==========================================================*/

    function openSetupPrompt(options = {}) {
        const { previousToken = null, previousState = null } = options;

        document.getElementById('ct-setup-overlay')?.remove();
        document.getElementById('ct-setup-modal')?.remove();

        setConnState('SETUP');

        const overlay = css(mk('div', { id:'ct-setup-overlay' }), {
            position:'fixed', inset:'0', background:'rgba(0,0,0,.5)', zIndex:'1050000'
        });
        const modal = css(mk('div', { id:'ct-setup-modal' }), {
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:'1050001', background:'#fff', border:'1px solid #ccc',
            borderRadius:'10px', padding:'20px', width:'480px', maxWidth:'92vw',
            maxHeight:'86vh', overflowY:'auto', fontFamily:'Arial, sans-serif',
            boxShadow:'0 6px 24px rgba(0,0,0,.25)', color:'#333'
        });

        // Header
        const hdr = css(mk('div'), {
            display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'
        });
        const hTitle = css(mk('div'), {
            fontSize:'15px', fontWeight:'bold', color:'#333', fontFamily:'Arial, sans-serif'
        });
        hTitle.textContent = '☁ Connect to Cloud Sync';

        const closeX = css(mk('button'), {
            background:'red', color:'#fff', border:'none', borderRadius:'4px',
            cursor:'pointer', padding:'4px 10px', fontWeight:'bold',
            fontSize:'18px', lineHeight:'1'
        });
        closeX.textContent = '×';

        hdr.append(hTitle, closeX);
        modal.appendChild(hdr);

        // URL field
        modal.appendChild(css(Object.assign(mk('label'), { textContent:'Worker URL', htmlFor:'ct-setup-url' }), {
            display:'block', fontSize:'11px', fontWeight:'bold',
            color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));
        const urlInput = css(mk('input', { id:'ct-setup-url', type:'text' }), {
            width:'100%', padding:'7px 10px', border:'1px solid #ccc',
            borderRadius:'4px', fontSize:'12px', fontFamily:'Arial, sans-serif',
            background:'#fafafa', color:'#333', boxSizing:'border-box',
            outline:'none', marginBottom:'12px'
        });
        urlInput.placeholder = 'https://change-tracker-api.yourname.workers.dev';
        urlInput.value       = GM_getValue('changeTrackerWorkerUrl', '');
        modal.appendChild(urlInput);

        // Token field
        modal.appendChild(css(Object.assign(mk('label'), { textContent:'Your API Token', htmlFor:'ct-setup-token' }), {
            display:'block', fontSize:'11px', fontWeight:'bold',
            color:'#666', marginBottom:'4px', fontFamily:'Arial, sans-serif'
        }));
        const tokenInput = css(mk('input', { id:'ct-setup-token', type:'password' }), {
            width:'100%', padding:'7px 36px 7px 10px', border:'1px solid #ccc',
            borderRadius:'4px', fontSize:'12px',
            fontFamily:'"Courier New", Courier, monospace',
            background:'#fafafa', color:'#333', boxSizing:'border-box',
            outline:'none'
        });
        tokenInput.placeholder = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        tokenInput.value       = GM_getValue('changeTrackerToken', '');

        const EYE_OPEN   = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        const EYE_CLOSED = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

        const revealBtn = css(mk('button', { type:'button', title:'Show token' }), {
            position:'absolute', right:'6px', top:'50%', transform:'translateY(-50%)',
            background:'none', border:'none', cursor:'pointer', padding:'2px',
            color:'#888', display:'flex', alignItems:'center', lineHeight:'1'
        });
        revealBtn.innerHTML = EYE_OPEN;
        revealBtn.addEventListener('click', () => {
            const show = tokenInput.type === 'password';
            tokenInput.type     = show ? 'text' : 'password';
            revealBtn.innerHTML = show ? EYE_CLOSED : EYE_OPEN;
            revealBtn.title     = show ? 'Hide token' : 'Show token';
        });

        const tokenWrap = css(mk('div'), { position:'relative', marginBottom:'12px' });
        tokenWrap.appendChild(tokenInput);
        tokenWrap.appendChild(revealBtn);
        modal.appendChild(tokenWrap);

        // Help text
        const help = css(mk('div'), {
            fontSize:'11px', color:'#666', marginBottom:'14px',
            lineHeight:'1.5', fontFamily:'Arial, sans-serif'
        });
        help.appendChild(document.createTextNode('Ask your administrator for both values. Contact '));
        const mailto = css(mk('a'), {
            color:'inherit', textDecoration:'underline'
        });
        mailto.href        = 'mailto:jrocarolvalls@deloitte.es';
        mailto.textContent = 'jrocarolvalls@deloitte.es';
        help.appendChild(mailto);
        help.appendChild(document.createTextNode(' to request access.'));
        modal.appendChild(help);

        // Auto-write toggle — copies entry text into ticket worknote/comments
        const autoWriteRow = css(mk('label', { htmlFor:'ct-setup-autowrite' }), {
            display:'flex', alignItems:'flex-start', gap:'8px',
            padding:'8px 10px', marginBottom:'14px',
            background:'#f6f8fa', border:'1px solid #e1e4e8', borderRadius:'4px',
            cursor:'pointer', fontFamily:'Arial, sans-serif'
        });
        const autoWriteInput = css(mk('input', { id:'ct-setup-autowrite', type:'checkbox' }), {
            marginTop:'2px', cursor:'pointer'
        });
        autoWriteInput.checked = getAutoWriteEnabled();

        const autoWriteText = css(mk('div'), { fontSize:'12px', color:'#333', lineHeight:'1.4' });
        const autoWriteTitle = css(mk('div'), { fontWeight:'bold', marginBottom:'2px' });
        autoWriteTitle.textContent = 'Auto-write entries to ticket';
        const autoWriteDesc = css(mk('div'), { fontSize:'11px', color:'#666' });
        autoWriteDesc.textContent =
            'When adding an entry, also paste the equivalent worknote/comment ' +
            'into the SNow ticket fields (with @mention to the requester).';
        autoWriteText.append(autoWriteTitle, autoWriteDesc);

        autoWriteRow.append(autoWriteInput, autoWriteText);
        modal.appendChild(autoWriteRow);

        // Cache TTL row
        const ttlRow = css(mk('div'), {
            padding:'8px 10px', marginBottom:'14px',
            background:'#f6f8fa', border:'1px solid #e1e4e8', borderRadius:'4px',
            fontFamily:'Arial, sans-serif'
        });
        const ttlLabel = css(mk('label', { htmlFor:'ct-setup-ttl' }), {
            display:'block', fontSize:'12px', fontWeight:'bold',
            color:'#333', marginBottom:'4px'
        });
        ttlLabel.textContent = 'Local cache expiry (days)';
        const ttlDesc = css(mk('div'), { fontSize:'11px', color:'#666', marginBottom:'6px', lineHeight:'1.4' });
        ttlDesc.textContent =
            'Ticket logs not opened within this many days are removed from local storage. ' +
            'The server copy is never affected and will reload on next open.';

        const ttlInputRow = css(mk('div'), { display:'flex', alignItems:'center', gap:'8px' });
        const ttlInput = css(mk('input', { id:'ct-setup-ttl', type:'number', min:'1', max:'365' }), {
            width:'70px', padding:'5px 8px', border:'1px solid #ccc',
            borderRadius:'4px', fontSize:'12px', fontFamily:'Arial, sans-serif',
            background:'#fff', color:'#333'
        });
        ttlInput.value = getCacheTtlDays();
        const ttlUnit = css(mk('span'), { fontSize:'12px', color:'#555' });
        ttlUnit.textContent = 'days  (default: 30)';
        ttlInputRow.append(ttlInput, ttlUnit);

        const ttlWarn = css(mk('div', { id:'ct-setup-ttl-warn' }), {
            display:'none', marginTop:'6px', padding:'5px 8px',
            background:'#fff3cd', border:'1px solid #ffc107', color:'#856404',
            borderRadius:'4px', fontSize:'11px', lineHeight:'1.4'
        });
        ttlWarn.textContent =
            'Setting this above 30 days may cause GM storage to grow large and ' +
            'slow down the script. Keep it at 30 days or lower for best performance.';

        ttlInput.addEventListener('input', () => {
            ttlWarn.style.display = Number(ttlInput.value) > CACHE_TTL_WARN_THRESHOLD ? 'block' : 'none';
        });

        ttlRow.append(ttlLabel, ttlDesc, ttlInputRow, ttlWarn);
        modal.appendChild(ttlRow);

        // Searchable dropdown toggle
        const searchableRow = css(mk('label', { htmlFor:'ct-setup-searchable' }), {
            display:'flex', alignItems:'flex-start', gap:'8px',
            padding:'8px 10px', marginBottom:'14px',
            background:'#f6f8fa', border:'1px solid #e1e4e8', borderRadius:'4px',
            cursor:'pointer', fontFamily:'Arial, sans-serif'
        });
        const searchableInput = css(mk('input', { id:'ct-setup-searchable', type:'checkbox' }), {
            marginTop:'2px', cursor:'pointer'
        });
        searchableInput.checked = getSearchableDropdown();
        const searchableText = css(mk('div'), { fontSize:'12px', color:'#333', lineHeight:'1.4' });
        const searchableTitle = css(mk('div'), { fontWeight:'bold', marginBottom:'2px' });
        searchableTitle.textContent = 'Searchable change-type dropdown';
        const searchableDesc = css(mk('div'), { fontSize:'11px', color:'#666' });
        searchableDesc.textContent =
            'Replaces the change-type select with a searchable dropdown. ' +
            'Type a group name (e.g. "dlp") to filter all items in that group, ' +
            'or type part of an item label to filter directly.';
        searchableText.append(searchableTitle, searchableDesc);
        searchableRow.append(searchableInput, searchableText);
        modal.appendChild(searchableRow);

        // Inline error area
        const errEl = css(mk('div', { id:'ct-setup-error' }), {
            display:'none', marginBottom:'10px', padding:'7px 10px',
            background:'#f8d7da', border:'1px solid #f5c6cb', color:'#721c24',
            borderRadius:'4px', fontSize:'12px', fontFamily:'Arial, sans-serif'
        });
        modal.appendChild(errEl);

        function showError(msg) {
            errEl.textContent    = msg;
            errEl.style.display  = 'block';
        }
        function hideError() {
            errEl.textContent    = '';
            errEl.style.display  = 'none';
        }

        // Button row
        const btnRow = css(mk('div'), { display:'flex', gap:'10px', marginTop:'4px' });

        const cancelBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#6c757d', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        cancelBtn.textContent = 'Cancel';

        const saveBtn = css(mk('button'), {
            flex:'1', padding:'9px', background:'#28a745', color:'#fff',
            border:'none', borderRadius:'4px', cursor:'pointer',
            fontWeight:'bold', fontSize:'13px', fontFamily:'Arial, sans-serif'
        });
        saveBtn.textContent = 'Save & Connect';

        btnRow.append(cancelBtn, saveBtn);
        modal.appendChild(btnRow);

        function close() {
            overlay.remove();
            modal.remove();
        }

        function cancel() {
            if (previousToken) {
                // Restore previous token + state (Reset path)
                GM_setValue('changeTrackerToken', previousToken);
                setConnState(previousState || 'INVALID_TOKEN');
            } else {
                // First-time setup cancelled — clear anything save() may have
                // already written so the next open re-prompts cleanly.
                GM_deleteValue('changeTrackerWorkerUrl');
                GM_deleteValue('changeTrackerToken');
                setConnState('INIT');
                hideSidebar();
            }
            close();
        }

        async function save() {
            hideError();
            const url   = urlInput.value.trim().replace(/\/+$/, '');
            const token = tokenInput.value.trim();
            if (!url)   { showError('Worker URL is required.');  return; }
            if (!token) { showError('API token is required.');   return; }

            saveBtn.disabled    = true;
            saveBtn.textContent = 'Connecting…';

            GM_setValue('changeTrackerWorkerUrl', url);
            GM_setValue('changeTrackerToken',     token);
            setAutoWriteEnabled(autoWriteInput.checked);
            setCacheTtlDays(ttlInput.value);
            setSearchableDropdown(searchableInput.checked);

            // Try to connect using the current ticket
            const ticket = getTicketNumber();
            await attemptReconnect(ticket, /* silent */ true);

            if (connState === 'ONLINE') {
                close();
                showSidebar();           // ensure sidebar slides in
                flashStatus('✓ Connected!');
            } else if (connState === 'INVALID_TOKEN') {
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save & Connect';
                showError('Token rejected. Double-check the token value.');
            } else {
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save & Connect';
                showError('Could not reach the Worker. Check the URL and try again.');
            }
        }

        cancelBtn.onclick = cancel;
        closeX.onclick    = cancel;
        overlay.onclick   = cancel;
        saveBtn.onclick   = save;

        document.body.append(overlay, modal);
        urlInput.focus();
    }

    /* ==========================================================
     *  SHOW / HIDE / TOGGLE
     * ==========================================================*/

    function showSidebar() {
        _ctx = getTicketContext();
        const sidebar = document.getElementById('ct-sidebar');
        if (!sidebar) return;

        // Not configured yet → setup modal first, sidebar stays hidden
        if (!api.isConfigured()) {
            setConnState('INIT');
            openSetupPrompt();
            return;
        }

        const ticket = getTicketNumber();
        touchTicketAccess(ticket);
        const badge  = document.getElementById('ct-ticket-badge');
        if (badge) badge.textContent = `Ticket: ${ticket}`;

        // Show cached data immediately — never block on network
        refreshLog(ticket);

        // Slide in
        css(sidebar, { right:'0px' });
        sidebarVisible = true;
        setTimeout(() => document.getElementById('ct-snippet-select')?.focus(), 310);

        // Background: attempt reconnect if offline, sync if online
        if (connState === 'OFFLINE' || connState === 'INVALID_TOKEN') {
            attemptReconnect(ticket, /* silent */ true);
        } else if (connState === 'ONLINE') {
            syncTicket(ticket).then(() => refreshLog(ticket));
        } else {
            // First open after config saved (connState still 'INIT' or 'SETUP') → go online
            attemptReconnect(ticket, /* silent */ true);
        }
    }

    function hideSidebar() {
        const sidebar = document.getElementById('ct-sidebar');
        if (sidebar) { css(sidebar, { right:'-460px' }); sidebarVisible = false; }
    }

    function toggleSidebar() { sidebarVisible ? hideSidebar() : showSidebar(); }

    /* ==========================================================
     *  TOOLBAR NOTIFICATION DOT
     * ==========================================================*/

    const TOOL_ID = 'changeTracker';

    // ─────────────────────────────────────────────────────────────
    // TOOLBAR NOTIFICATION DOT
    // ─────────────────────────────────────────────────────────────

    const TOOLBAR_DOT_CLASS = 'changeTrackerOnline-notif-dot';

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
        if (registrationAttempts >= MAX_ATTEMPTS) { console.warn('⚠️ Change Tracker: max attempts reached'); return; }
        registrationAttempts++;

        const toolbarExists = document.querySelector('[data-toolbar-v2="true"]');
        const menuExists    = document.getElementById('custom-toolbar-menu');

        if (toolbarExists && menuExists) {
            document.dispatchEvent(new CustomEvent('addToolbarTool', {
                detail: { id:'changeTracker', icon:TOOL_ICON, tooltip:'Change Tracker', position:7 }
            }));
            isRegistered = true;
            addToolbarNotificationDot();
            console.log('✅ Change Tracker registered!');
        } else {
            setTimeout(attemptRegistration, RETRY_DELAY);
        }
    }

    /* ==========================================================
     *  EVENT LISTENERS + INIT
     * ==========================================================*/

    document.addEventListener('toolbarReady',       ()  => attemptRegistration());
    document.addEventListener('toolbarToolClicked', (e) => { if (e.detail.id === 'changeTracker') toggleSidebar(); });

    function initialize() {
        if (!document.body) { setTimeout(initialize, 50); return; }
        if (isInitialized) return;
        isInitialized = true;
        document.head.appendChild(styleEl);
        initializeSidebar();
        console.log('✅ Change Tracker ready!');
        setTimeout(attemptRegistration, 1000);
        setTimeout(purgeStaleCache, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.addEventListener('load', () => { if (!isRegistered) attemptRegistration(); });

})();