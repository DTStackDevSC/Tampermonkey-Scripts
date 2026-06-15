// ==UserScript==
// @name         Ticket Response Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowTicketResponseHelper.user.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowTicketResponseHelper.user.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @author       J.R.
// @version      2.17.3
// @description  Insert predefined responses into tickets with team-specific options and automatic name detection with enhanced @ mention support
// @match        https://*.service-now.com/sc_req_item.do*
// @match        https://*.service-now.com/incident.do*
// @match        https://*.service-now.com/sc_task.do*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    // Global flag to prevent multiple initializations
    let isInitialized = false;
    let cachedOpenedByName = null;

    /* ==========================================================
     *  VERSION CONTROL
     * ==========================================================*/

    const SCRIPT_VERSION = '2.17.3';
    const CHANGELOG = `Version 2.17.3:
- Republished under a new file that installs in one click from the script installer page. Your saved settings are unchanged.

Version 2.17.2:
- Moved the automatic update source to a new file so future updates keep installing correctly.

Version 2.17.1:
- The Feature Guide now includes visual examples: a button badge showing how the inline button looks, colored field-type badges (Comments and Work Notes) with descriptions, a before-and-after name substitution example, a mock search box, and a grid of editor fields for custom responses. Settings are shown as badge rows matching the Short Description Helper's style.

Version 2.17.0:
- Added a "? Help" button in the dropdown header that opens a Feature Guide modal documenting all script features.
- The "Settings" and "Help" buttons now use a pill style matching the Short Description Helper.

Version 2.16.5:
- The "What's New" notification now appears directly to the right of the version number in the dropdown header.

Version 2.16.4:
- Switch Team moved into the Settings modal. A new "Team" section shows the current team and a "Switch Team" button. The inline link in the dropdown header has been removed.

Version 2.16.3:
- The team selection modal now has a purple top border, purple title, and purple buttons to visually distinguish it from the Short Description Helper modal when both scripts are active at the same time.

Version 2.16.2:
- Selecting a team on first setup now applies immediately without reloading the page.
- The loading screen shown when switching teams now displays an animated "Reloading page to select team" message with cycling dots.

Version 2.16.1:
- The search bar now receives focus automatically when the dropdown is opened, so you can start typing a filter immediately without clicking it first.

Version 2.16.0:
- EMEA: Added "NPA Access" response to the Responses section with two submenu options: "First NPA Access for MF" and "Additional NPA Access".

Version 2.15.0:
- Added short description field transforms: responses can now declare a
  shortDescTransforms array in their metadata to rewrite specific pipe-segment
  fields when the response is inserted.
- Solved Closure now automatically sets the short description status segment
  to "Closed" on insert across all teams.

Version 2.14.0:
- Added a Settings button in the dropdown header that opens a Settings modal.
- New setting: "Auto-update date on insert" updates the short description date
  to today whenever a response is inserted. The setting is on by default and
  persists across sessions.

Version 2.13.2:
- EMEA: Added "SPM Request Loaded" response to the Responses section.

Version 2.13.1:
- Parent items with submenus can now be pinned. When pinned, the full flyout submenu
  is available directly from the Pinned section.

Version 2.13.0:
- Added pinned responses: click the pin icon on any response to keep it at
  the top of the list in a dedicated Pinned section. Pinned items still appear
  in their original category. Click the pin again to unpin.

Version 2.12.3:
- Fixed dark mode compatibility: the response dropdown, custom responses modal, team
  selector, and changelog modal now force light backgrounds and dark text via CSS with
  !important so ServiceNow dark mode cannot override their inputs and controls.

Version 2.12.2:
- Renamed the version notification badge label from "Changelog" to "What's New".

Version 2.12.1:
- Changelog modal now renders as collapsible version cards - most recent
  expanded by default, older entries can be opened individually.

Version 2.12.0:
- Search bar: filter templates in real time from the top of the dropdown.
- Recently Used: last 3 used templates pinned to the top of the list.

Version 2.11.1:
- EMEA: Added "# Recategorization Request" worknote with URL Requested and Categories requested fields.`;

    /* ==========================================================
     *  TEAM CONFIGURATIONS
     * ==========================================================*/

    const TEAMS = {

    /// EMEA TEAM ///

    emeaTeam: {
        name: 'EMEA Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments'
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments'
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            ssltodomain: {
                label: 'SSL Bypass > Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            teststeps: {
                label: 'Initial Troubleshooting Steps',
                category: 'responses',
                fieldType: 'comments'
            },
            unknownreq: {
                label: 'Unknown Requestor',
                category: 'responses',
                fieldType: 'comments'
            },
            vendorcaseloaded: {
                label: 'Vendor Case Opened',
                category: 'responses',
                fieldType: 'comments'
            },
            policymgmt: {
                label: 'Policy Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            policycreate: {
                label: 'Create',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments'
            },
            policymodify: {
                label: 'Modify',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments'
            },
            policydelete: {
                label: 'Delete',
                category: 'responses',
                parentItem: 'policymgmt',
                fieldType: 'comments'
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            bypasscomments: {
                label: '# SSL/Domain/App Bypass',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            bypasssslcomment: {
                label: '# SSL Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            bypassdomaincomment: {
                label: '# Domain Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            bypassappcomment: {
                label: '# Application Bypass Comment',
                category: 'workcomments',
                parentItem: 'bypasscomments',
                fieldType: 'work_notes'
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments'
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments'
            },
            slackAddComment: {
                label: 'Slack URL Added',
                category: 'responses',
                fieldType: 'comments'
            },
            tier2SOCreq: {
                label: 'SOC Tier 2 Task Request',
                category: 'other',
                fieldType: 'comments'
            },
            recatRequest: {
                label: 'Recategorization Request',
                category: 'responses',
                fieldType: 'comments'
            },
            recatRequestWorknote: {
                label: '# Recategorization Request',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            ideaFeatureRequest: {
                label: 'IDEA Request Opened',
                category: 'responses',
                fieldType: 'comments'
            },
            configMgmt: {
                label: 'Configuration Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            configSteering: {
                label: 'Steering/Client Configuration',
                category: 'responses',
                parentItem: 'configMgmt',
                fieldType: 'comments'
            },
            configMgmtWorknotes: {
                label: '# Configuration Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            configSteeringWorknotes: {
                label: '# Steering/Client Configuration',
                category: 'workcomments',
                parentItem: 'configMgmtWorknotes',
                fieldType: 'work_notes'
            },
            policyMgmtWorknote: {
                label: '# Policy Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            policyCreateWorknote: {
                label: '# Create',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            policyModifyWorknote: {
                label: '# Modify',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            policyDeleteWorknote: {
                label: '# Delete',
                category: 'workcomments',
                parentItem: 'policyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyMgmt: {
                label: 'DLP Policy Managment',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            dlpPolicyCreate: {
                label: 'Create',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments'
            },
            dlpPolicyModify: {
                label: 'Modify',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments'
            },
            dlpPolicyDelete: {
                label: 'Delete',
                category: 'responses',
                parentItem: 'dlpPolicyMgmt',
                fieldType: 'comments'
            },
            dlpPolicyMgmtWorknote: {
                label: '# DLP Policy Managment',
                category: 'workcomments',
                hasSubmenu: true,
                fieldType: 'work_notes'
            },
            dlpPolicyCreateWorknote: {
                label: '# Create',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyModifyWorknote: {
                label: '# Modify',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            dlpPolicyDeleteWorknote: {
                label: '# Delete',
                category: 'workcomments',
                parentItem: 'dlpPolicyMgmtWorknote',
                fieldType: 'work_notes'
            },
            workingOnReminder: {
                label: 'Working on the request Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            spmLoaded: {
                label: 'SPM Request Loaded',
                category: 'responses',
                fieldType: 'comments'
            },
            npaAccess: {
                label: 'NPA Access',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            npaAccessFirst: {
                label: 'First NPA Access for MF',
                category: 'responses',
                parentItem: 'npaAccess',
                fieldType: 'comments'
            },
            npaAccessAdditional: {
                label: 'Additional NPA Access',
                category: 'responses',
                parentItem: 'npaAccess',
                fieldType: 'comments'
            }
        },

        enabledResponses: [
            'teststeps',
            'unknownreq',
            'policymgmt',
            'policycreate',
            'policymodify',
            'policydelete',
            'dlpPolicyMgmt',
            'dlpPolicyCreate',
            'dlpPolicyModify',
            'dlpPolicyDelete',
            'configMgmt',
            'configSteering',
            'bypass',
            'bypassssl',
            'ssltodomain',
            'bypassdomain',
            'bypassapp',
            'vendorcaseloaded',
            'slackAddComment',
            'recatRequest',
            'recatRequestWorknote',
            'ideaFeatureRequest',
            'first',
            'second',
            'third',
            'workingOnReminder',
            'solved',
            'timeout',
            'enduser',
            'bypasscomments',
            'bypasssslcomment',
            'bypassdomaincomment',
            'bypassappcomment',
            'policyMgmtWorknote',
            'policyCreateWorknote',
            'policyModifyWorknote',
            'policyDeleteWorknote',
            'dlpPolicyMgmtWorknote',
            'dlpPolicyCreateWorknote',
            'dlpPolicyModifyWorknote',
            'dlpPolicyDeleteWorknote',
            'configMgmtWorknotes',
            'configSteeringWorknotes',
            'urlcheck',
            'moreinfo',
            'vpninfo',
            'tier2SOCreq',
            'spmLoaded',
            'npaAccess',
            'npaAccessFirst',
            'npaAccessAdditional',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request

Please note that if the required information is not provided, we will be unable to proceed with your case, and it will unfortunately have to be closed.`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                ssltodomain: (vars) => `Hi @[${vars.openedByName}],
We've switched the following bypasses from SSL Bypass to Domain Bypass to help address the issue:

- Now, currently the Domain Bypass applied is:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:

- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                teststeps: (vars) => `Hello @[${vars.openedByName}],

I hope you're doing well.
To help us identify the root cause of the persistent issue, could you please provide more detailed information from your side? For example, if a domain bypass was applied as previously advised, we would greatly appreciate it if you could perform the standard Member Firm troubleshooting steps and share the results.
The recommended troubleshooting includes:

- Temporarily disabling the Netskope client to confirm whether the issue is related to Netskope
- Capturing screenshots of the error
- Collecting HAR files
- Gathering relevant Netskope logs

Performing these steps on your end would significantly reduce back-and-forth and allow us to resolve the issue for the affected user much faster.
Please let me know if you need any guidance on capturing the above information. We're happy to assist.

Thank you in advance for your help!

Kind regards,
Global Data Security Enablement`,
                unknownreq: (vars) => `Hi @[${vars.openedByName}],

We have noticed that you have not previously been listed as a frequent point of contact for submitting requests to our team.
To add you as an approved Member Firm requestor, could you please provide confirmation or approval for this addition?

Kind regards,
Global Data Security Enablement`,
                first: (vars) => `Hi @[${vars.openedByName}],
I hope you're doing well. I'm reaching out with a gentle reminder that we still need the following information to continue working on your ${vars.pageType}:

>

Whenever you have a moment, please share the details so we can move forward as quickly as possible.
Thank you in advance for your help!

Kind regards,
Global Data Security Enablement`,
                second: (vars) => `Hi @[${vars.openedByName}],
I hope you're doing well. This is a second gentle reminder that we still need the information below in order to continue working on your ${vars.pageType}:

>

Whenever you have a moment, please share the required details so we can proceed as soon as possible.
If we don't receive a response by the end of the next business day, we will need to close the ticket in accordance with our standard procedure.

Thank you in advance for your cooperation.

Kind regards,
Global Data Security Enablement`,
                third: (vars) => `Hello @[${vars.openedByName}],
I hope you're doing well. This is a gentle third reminder that we still require the following information to continue working on your ${vars.pageType}:

>

Whenever you have a moment, please share the requested details so we can proceed as quickly as possible.
If we do not receive a response by the end of the day, we will need to close the ticket in accordance with our standard procedure.

Thank you very much in advance for your cooperation.

Kind regards,
Global Data Security Enablement`,
                solved: (vars) => `Hi @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
If you notice that the ${vars.pageType} has not been fully addressed, please open a new ${vars.pageType} and refer to this ticket.

Best regards,
Global Data Security Enablement`,
                timeout: (vars) => `Hi @[${vars.openedByName}],
After multiple attempts to obtain the additional information required, we still do not have sufficient details to continue working on this ticket. Therefore, we are proceeding with its closure.

Once you have the necessary information available, please open a new ${vars.pageType} and reference this ticket so we can resume support.

Best regards,
Global Data Security Enablement`,
                enduser: (vars) => `Hi @[${vars.openedByName}],
We have determined that this ${vars.pageType} was submitted directly by you rather than through your designated Member Firm (MF) IT Contact.
Please coordinate with your MF IT Contact to ensure the ${vars.pageType} is submitted correctly and includes all mandatory information.
Accordingly, we will proceed with the closure of this case.

Best regards,
Global Data Security Enablement`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`,
                bypasssslcomment: (vars) => `# Added to SSL Decryption policy for:



in:

`,
                bypassdomaincomment: (vars) => `# Added Steering Exception for:



in:

`,
                bypassappcomment: (vars) => `# Added App Bypass for binary:



in:

`,
                vendorcaseloaded: (vars) => `Hi @[${vars.openedByName}],
We have opened vendor case # for further review of this matter. The Netskope team is currently conducting an investigation, and we will keep you informed as soon as updates become available.

Best regards,
Global Data Security Enablement`,
                policycreate: (vars) => `Hi @[${vars.openedByName}],

We've created the following Netskope policy to help address the issue:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                policymodify: (vars) => `Hi @[${vars.openedByName}],

We've modified the following Netskope policy to help address the issue:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                policydelete: (vars) => `Hi @[${vars.openedByName}],

We've scheduled for deletion the following Netskope policy to help address the issue:
- Policy name:

This policy has been disabled and scheduled for deletion in 30 days.

Best regards,
Global Data Security Enablement`,
                slackAddComment: (vars) => `Hello @[${vars.openedByName}],

Slack URL:
>

Has been added to the requested MF Slack Allow list.

Kind regards,`,
                tier2SOCreq: (vars) => `Hello,

A MF has requested access to a URL that was blocked by SOC. Could you please take a look?
The URL is:

>

Thanks!`,
                recatRequest: (vars) => `Hello @[${vars.openedByName}],

A recategorization request has been submitted to Netskope. Please allow 24–48 hours for them to review it and apply any necessary changes.

Kind regards,`,
                recatRequestWorknote: (vars) => `# Recategorization request submitted to Netskope.
- URL Requested:
- Categories requested: `,
                ideaFeatureRequest: (vars) => `Hello @[${vars.openedByName}],

An IDEA #### feature request has been opened with Netskope for this functionality. We will update you directly once there is any progress or feedback.
In the meantime, we will proceed with closing this request.

Kind regards,`,
                configMgmt: (vars) => ``,
                configSteering: (vars) => `Hello @[${vars.openedByName}],

We have created/updated/deleted the following Netskope Steering/Client Configuration to meet the requested requirements:

Steering name:
AD group:
Partner Tenant Access configured:

1 –



Kind regards,`,
                configMgmtWorknotes: (vars) => ``,
                configSteeringWorknotes: (vars) => `Created/updated/deleted Netskope Steering/Client Configuration:

Steering name:
AD group:
Partner Tenant Access configured:

1 -`,
                policyMgmtWorknote: (vars) => ``,
                policyCreateWorknote: (vars) => `Netskope Policy has been created:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:`,
                policyModifyWorknote: (vars) => `Netskope Policy has been modified:
- Policy name:
- AD group:
- Destination:
- Policy description:
- Group position:
- Action:`,
                policyDeleteWorknote: (vars) => `Netskope Policy has been scheduled to be deleted (currently disabled):
- Policy name:`,
                dlpPolicyMgmt: (vars) => ``,
                dlpPolicyCreate: (vars) => `Hi @[${vars.openedByName}],

We've created the following Netskope DLP policy to help address the request:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                dlpPolicyModify: (vars) => `Hi @[${vars.openedByName}],

We've modified the following Netskope DLP policy to help address the request:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any issues.

Best regards,
Global Data Security Enablement`,
                dlpPolicyDelete: (vars) => `Hi @[${vars.openedByName}],

We've scheduled for deletion the following Netskope DLP policy:
- Policy name:

This policy has been disabled and scheduled for deletion in 30 days.

Best regards,
Global Data Security Enablement`,
                dlpPolicyMgmtWorknote: (vars) => ``,
                dlpPolicyCreateWorknote: (vars) => `Netskope DLP Policy has been created:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:`,
                dlpPolicyModifyWorknote: (vars) => `Netskope DLP Policy has been modified:
- Policy name:
- AD group:
- Destination:
- Activities:
- Profile & Action:
- DLP Profile:
- Action:
- Policy description:
- Group position:`,
                dlpPolicyDeleteWorknote: (vars) => `Netskope DLP Policy has been scheduled to be deleted (currently disabled):
- Policy name:`,
                workingOnReminder: (vars) => `Hello @[${vars.openedByName}],

Just a quick note to let you know that we are currently working on your request and the ticket is actively in progress.

We’ll keep you updated as we move forward.

Kind regards,
Global Data Security Enablement`,
                spmLoaded: (vars) => `Hi @[${vars.openedByName}],
We have loaded SPM request #. The SPM team will work on it and contact you if additional information is required.

Best regards,
Global Data Security Enablement`,
                npaAccess: (vars) => ``,
                npaAccessFirst: (vars) => `Hi @[${vars.openedByName}],
Hope you are doing well.

Since this is the first NPA to be created in your Firm, we require the following:
• (1) An AD group that will contain all sub-groups for each client's NPA now or in the future.
• (2) An AD group containing the required members needed for a specific client's NPA. This group must be nested into the Firm group of point 1.

Example of AD groups:

(1) ES NPA Access → (2) Client 1 NPA, (2) Client 2 NPA, (2) Client 3 NPA

Please let us know once the required AD groups are updated and available.
Regards,`,
                npaAccessAdditional: (vars) => `Hi @[${vars.openedByName}],
Hope you are doing well.

Since there are already other NPAs in your firm, we need the following:
• An AD group containing the required members needed for this specific NPA.
• In addition, the group of point 1 must be nested into the following AD group that contains all the users in your Firm using NPAs: <Firm_Level_NPA_AD_Group>

Please let us know once the required AD groups are updated and available.
Regards,`
        }
    },

    /// AME TEAM ///

    ameTeam: {
        name: 'AME Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments'
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments'
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments'
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments'
            }
        },

        enabledResponses: [
            'urlcheck',
            'initial',
            'initialmiss',
            'bypass',
            'bypassssl',
            'bypassdomain',
            'bypassapp',
            'first',
            'second',
            'third',
            'solved',
            'timeout',
            'enduser',
            'moreinfo',
            'vpninfo',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                first: (vars) => `Hello @[${vars.openedByName}],
I'm contacting you to recall we need the following information to continue working on your ${vars.pageType}:

>`,
                second: (vars) => `Hello @[${vars.openedByName}],
This is a second reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of tomorrow, we will have to close the ticket following our procedure.`,
                third: (vars) => `Hello @[${vars.openedByName}],
This is the third reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of the day, we will have to close the ticket following our procedure.

@MF CISO`,
                solved: (vars) => `Hello @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
In case you detect that the ${vars.pageType} is not fully attended, please open a new ${vars.pageType} and refer to this ticket.`,
                timeout: (vars) => `Hello @[${vars.openedByName}],
After several contacts asking for additional information, we have not enough information to continue working on this ticket, so we are closing.

Once you have the required information, please open a new ${vars.pageType} and refer to this ticket.`,
                enduser: (vars) => `Hi @[${vars.openedByName}], hope you are doing fine.
We noticed a ${vars.pageType} was directly raised by you and not by your local Member Firm IT Contact.
To speed up your ${vars.pageType} we encourage you to contact your MF IT Contact providing all necessary evidence.
We will proceed to close this case.
Regards.`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`
        }
    },

    /// APAC TEAM ///

    apacTeam: {
        name: 'APAC Team',

        defaultSectionOrder: [
            'first_contact',
            'responses',
            'reminders',
            'closures',
            'workcomments',
            'other',
            'custom',
        ],

        responseMetadata: {
            urlcheck: {
                label: '# URL Check',
                category: 'workcomments',
                fieldType: 'work_notes'
            },
            initial: {
                label: 'Initial Contact',
                category: 'first_contact',
                fieldType: 'comments'
            },
            initialmiss: {
                label: 'Initial Contact (Missing Info)',
                category: 'first_contact',
                fieldType: 'comments'
            },
            bypass: {
                label: 'SSL/Domain/App Bypass',
                category: 'responses',
                hasSubmenu: true,
                fieldType: 'comments'
            },
            bypassssl: {
                label: 'SSL Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassdomain: {
                label: 'Domain Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            bypassapp: {
                label: 'Application Bypass',
                category: 'responses',
                parentItem: 'bypass',
                fieldType: 'comments'
            },
            first: {
                label: 'First reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            second: {
                label: 'Second Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            third: {
                label: 'Third Reminder',
                category: 'reminders',
                fieldType: 'comments'
            },
            solved: {
                label: 'Solved Closure',
                category: 'closures',
                fieldType: 'comments',
                shortDescTransforms: [{ field: 'status', value: 'Closed' }]
            },
            timeout: {
                label: 'Timeout Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            enduser: {
                label: 'End User Closure',
                category: 'closures',
                fieldType: 'comments'
            },
            moreinfo: {
                label: 'More Information Request',
                category: 'other',
                fieldType: 'comments'
            },
            vpninfo: {
                label: 'VPN Info & Req.',
                category: 'other',
                fieldType: 'comments'
            }
        },

        enabledResponses: [
            'urlcheck',
            'initial',
            'initialmiss',
            'bypass',
            'bypassssl',
            'bypassdomain',
            'bypassapp',
            'first',
            'second',
            'third',
            'solved',
            'timeout',
            'enduser',
            'moreinfo',
            'vpninfo',
        ],

        responses: {
                urlcheck: (vars) => `#

IBM-XF:
VT:
Netskope: `,
                initial: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please let us know.`,
                initialmiss: (vars) => `Hi @[${vars.openedByName}],
Our team has taken ownership of your request and @[${vars.openedByName}] will be working on it with you. Once the ticket details have been reviewed, they will reach out if there are any questions or if any additional information is needed.
Please expect an update within the next two business days.

If this is an urgent request, please respond to this email to let us know.

Additionally, please provide all missing mandatory information that was not loaded with the ticket:

- How many users affected?
- When did the issue started?
- Screenshot of the error with capture of the system clock to check the timestamp when the issue happened.
- Netskope Logs
- HAR logs if the problem is happening on browser
- Netskope Client Configuration screenshot
- What troubleshooting has been performed?
- Have you tried reproducing the issue with Netskope disabled?
- Business justification – Clear description of the issue/request`,
                bypassssl: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- SSL bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassdomain: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Domain bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                bypassapp: (vars) => `Hi @[${vars.openedByName}],
We've added the following bypasses to help address the issue:
- Application bypass for:

>

When you have a moment, please update the agent configuration and run a quick test. Let me know if everything is working as expected or if you still encounter any problems.

Best regards,
Global Data Security Enablement`,
                first: (vars) => `Hello @[${vars.openedByName}],
I'm contacting you to recall we need the following information to continue working on your ${vars.pageType}:

>`,
                second: (vars) => `Hello @[${vars.openedByName}],
This is a second reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of tomorrow, we will have to close the ticket following our procedure.`,
                third: (vars) => `Hello @[${vars.openedByName}],
This is the third reminder to recall you that we need the following information to continue working on your ${vars.pageType}:

>

If we don't have a response by end of the day, we will have to close the ticket following our procedure.

@MF CISO`,
                solved: (vars) => `Hello @[${vars.openedByName}],
We have carried out the following actions to meet your requirements:

>

Since we have completed your ${vars.pageType}, we are closing the ticket.
In case you detect that the ${vars.pageType} is not fully attended, please open a new ${vars.pageType} and refer to this ticket.`,
                timeout: (vars) => `Hello @[${vars.openedByName}],
After several contacts asking for additional information, we have not enough information to continue working on this ticket, so we are closing.

Once you have the required information, please open a new ${vars.pageType} and refer to this ticket.`,
                enduser: (vars) => `Hi @[${vars.openedByName}], hope you are doing fine.
We noticed a ${vars.pageType} was directly raised by you and not by your local Member Firm IT Contact.
To speed up your ${vars.pageType} we encourage you to contact your MF IT Contact providing all necessary evidence.
We will proceed to close this case.
Regards.`,
                moreinfo: (vars) => `- Screenshot of the error (if new) with capture of the system clock to check the timestamp when the issue happened.
- New set of Netskope Logs & HAR Logs
- New set of Netskope Logs
- Netskope Client Configuration screenshot
- Timestamp of when the test has been done`,
                vpninfo: (vars) => `- Confirm VPN IP/URL
- Screenshot error of the VPN (If you have logs from the VPN itself would be great)
- If the VPN uses IP Ranges, what are those
- Confirmation that Netskope IPs were added from their end:
	https://docs.netskope.com/en/bypass-netskope-from-your-vpn/`
        }
    }

};

    /* ==========================================================
     *  DUAL / SINGLE INPUT MODE DETECTION & TEXTAREA ROUTING
     * ==========================================================*/

    /**
     * Returns true when ServiceNow is showing both the Work Notes and
     * Additional Comments textareas simultaneously (dual-input mode).
     * The container div #multiple-input-journal-entry has aria-hidden="false"
     * when active; we also verify both textareas are in the DOM.
     */
    function isDualInputMode() {
        const container = document.getElementById('multiple-input-journal-entry');
        if (container && container.getAttribute('aria-hidden') === 'false') {
            const wn = document.getElementById('activity-stream-work_notes-textarea');
            const cm = document.getElementById('activity-stream-comments-textarea');
            return !!(wn && cm);
        }
        return false;
    }

    /**
     * Returns the correct textarea element to write into.
     *
     * @param {'work_notes'|'comments'} fieldType  — the target declared in responseMetadata
     *
     * Dual mode  → routes to the matching specific textarea
     * Single mode → always uses the generic #activity-stream-textarea (original behaviour)
     *
     * A small badge indicator is briefly shown on the chosen field so the user
     * can confirm at a glance which area received the text.
     */
    function getTargetTextarea(fieldType) {
        if (isDualInputMode()) {
            if (fieldType === 'work_notes') {
                return document.getElementById('activity-stream-work_notes-textarea');
            }
            // 'comments' or any unrecognised value → customer-visible comments field
            return document.getElementById('activity-stream-comments-textarea');
        }

        // Single-input mode — original selector
        return (
            document.querySelector('#activity-stream-textarea') ||
            document.querySelector('[data-stream-text-input]')
        );
    }

    /**
     * Briefly highlights the border of the textarea that was written into,
     * so the analyst can confirm routing at a glance.
     */
    function flashTargetField(textarea) {
        if (!textarea) return;
        const prev = textarea.style.outline;
        textarea.style.outline = '2px solid #667eea';
        textarea.style.transition = 'outline 0.3s ease';
        setTimeout(() => {
            textarea.style.outline = prev;
        }, 1500);
    }


    /* ==========================================================
     *  MENTION INSERTION BLOCKER
     *
     *  While @mention picker interactions are in progress the page is
     *  overlaid with a transparent pointer-events blocker so accidental
     *  mouse clicks cannot dismiss the suggestion dropdown.
     *
     *  An animated toast is shown at the top of the viewport.
     *  The blocker is ALWAYS removed via try/finally in insertTextWithMention.
     * ==========================================================*/

    let _mentionBlockerActive = false;
    let _mentionFocusGuardTextarea = null;   // textarea being guarded
    let _mentionFocusGuardHandler  = null;   // its focusout listener ref (for cleanup)

    /**
     * Show the blocker overlay + status toast.
     *
     * @param {number}          total     Total @ mentions to process
     * @param {number}          current   1-based index of current mention
     * @param {string}          fieldType 'work_notes' | 'comments'
     * @param {HTMLTextAreaElement} textarea  The textarea receiving text — kept focused
     */
    function showMentionBlocker(total, current, fieldType, textarea) {
        hideMentionBlocker();
        _mentionBlockerActive = true;

        // ── Full mouse-event blocker overlay ─────────────────────────────
        // Intercepts in capture phase so nothing underneath ever sees these
        // events.  stopImmediatePropagation ensures no other capture listeners
        // on parent nodes can steal focus either.
        const overlay = document.createElement('div');
        overlay.id = 'mention-blocker-overlay';
        Object.assign(overlay.style, {
            position:      'fixed',
            inset:         '0',
            zIndex:        '2147483646',
            pointerEvents: 'all',
            cursor:        'not-allowed',
            background:    'rgba(0, 0, 0, 0.10)',
        });
        const _eatEvent = e => { e.preventDefault(); e.stopImmediatePropagation(); };
        ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'].forEach(type => {
            overlay.addEventListener(type, _eatEvent, true);
        });

        // ── focusout guard on the textarea ───────────────────────────────
        // Even with the overlay in place, some SN internal scripts can trigger
        // a blur.  We immediately re-focus the textarea whenever it loses focus
        // while the blocker is active.
        if (textarea) {
            _mentionFocusGuardTextarea = textarea;
            _mentionFocusGuardHandler  = () => {
                if (_mentionBlockerActive) {
                    // Use a microtask so the blur finishes before we re-focus
                    setTimeout(() => { if (_mentionBlockerActive) textarea.focus(); }, 0);
                }
            };
            textarea.addEventListener('focusout', _mentionFocusGuardHandler, true);
        }

        // Status toast
        const fieldLabel   = fieldType === 'work_notes' ? '\uD83D\uDD12 Work Notes' : '\uD83D\uDCAC Comments';
        const progressText = total > 1 ? ` (1 of ${total})` : '';

        const toast = document.createElement('div');
        toast.id = 'mention-blocker-toast';
        Object.assign(toast.style, {
            position:     'fixed',
            top:          '18px',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       '2147483647',
            background:   'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color:        '#fff',
            padding:      '12px 22px 15px',
            borderRadius: '10px',
            boxShadow:    '0 6px 24px rgba(0,0,0,0.5)',
            fontFamily:   'Arial, sans-serif',
            fontSize:     '13px',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
            whiteSpace:   'nowrap',
            userSelect:   'none',
            pointerEvents:'none',
            border:       '1px solid rgba(102,126,234,0.55)',
            minWidth:     '320px',
        });

        const spinner = document.createElement('span');
        spinner.className = 'mention-blocker-spinner';
        Object.assign(spinner.style, {
            display:      'inline-block',
            width:        '16px',
            height:       '16px',
            border:       '2px solid rgba(255,255,255,0.2)',
            borderTop:    '2px solid #818cf8',
            borderRadius: '50%',
            flexShrink:   '0',
        });

        const msg = document.createElement('span');
        msg.id = 'mention-blocker-msg';
        msg.innerHTML =
            `Inserting @mention<strong id="mention-blocker-progress" style="color:#a5b4fc">${progressText}</strong>` +
            ` \u2192 <span style="color:#67e8f9">${fieldLabel}</span>` +
            `<span style="color:#fca5a5;margin-left:10px;font-size:12px">\u26D4 do not click</span>`;

        const barTrack = document.createElement('div');
        Object.assign(barTrack.style, {
            position:     'absolute',
            bottom:       '0',
            left:         '0',
            width:        '100%',
            height:       '4px',
            borderRadius: '0 0 10px 10px',
            overflow:     'hidden',
            background:   'rgba(255,255,255,0.08)',
        });
        const barFill = document.createElement('div');
        barFill.id = 'mention-blocker-bar';
        Object.assign(barFill.style, {
            height:     '100%',
            width:      total > 1 ? `${Math.round(((current - 1) / total) * 100)}%` : '0%',
            background: 'linear-gradient(90deg,#667eea,#a5b4fc)',
            transition: 'width 0.35s ease',
        });
        barTrack.appendChild(barFill);
        toast.appendChild(spinner);
        toast.appendChild(msg);
        toast.appendChild(barTrack);
        document.body.appendChild(overlay);
        document.body.appendChild(toast);
    }

    /** Update progress bar / counter text between mentions. */
    function updateMentionBlocker(total, current) {
        const bar      = document.getElementById('mention-blocker-bar');
        const progress = document.getElementById('mention-blocker-progress');
        if (bar && total > 1)      bar.style.width = `${Math.round(((current - 1) / total) * 100)}%`;
        if (progress && total > 1) progress.textContent = ` (${current} of ${total})`;
    }

    /** Remove the blocker overlay, toast, and focusout guard. Safe to call when already gone. */
    function hideMentionBlocker() {
        _mentionBlockerActive = false;
        // Remove focusout guard from the textarea
        if (_mentionFocusGuardTextarea && _mentionFocusGuardHandler) {
            _mentionFocusGuardTextarea.removeEventListener('focusout', _mentionFocusGuardHandler, true);
        }
        _mentionFocusGuardTextarea = null;
        _mentionFocusGuardHandler  = null;
        document.getElementById('mention-blocker-overlay')?.remove();
        document.getElementById('mention-blocker-toast')?.remove();
    }

    /* ==========================================================
     *  SECTION STATE MANAGEMENT (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getSectionStates() {
        return GM_getValue('ticketResponseSectionStates', {});
    }

    function saveSectionState(categoryKey, isCollapsed) {
        const states = getSectionStates();
        states[categoryKey] = isCollapsed;
        GM_setValue('ticketResponseSectionStates', states);
    }

    /**
     * Returns the saved section order for the given team, falling back to
     * that team's defaultSectionOrder if none is stored yet.
     * The 'custom' category is always guaranteed to be present.
     */
    function getSectionOrder(teamKey) {
        const team = TEAMS[teamKey];
        const fallback = team ? [...team.defaultSectionOrder] : ['first_contact', 'responses', 'reminders', 'closures', 'workcomments', 'other', 'custom'];
        const storageKey = `ticketResponseSectionOrder_${teamKey}`;
        const order = GM_getValue(storageKey, fallback);

        // Ensure 'custom' is always present
        if (!order.includes('custom')) {
            order.push('custom');
            GM_setValue(storageKey, order);
        }
        return order;
    }

    function saveSectionOrder(order, teamKey) {
        const storageKey = `ticketResponseSectionOrder_${teamKey}`;
        GM_setValue(storageKey, order);
    }

    /* ==========================================================
     *  RECENTLY USED STORAGE
     * ==========================================================*/

    const MAX_RECENTLY_USED = 3;

    function getRecentlyUsed() {
        return GM_getValue('ticketResponseRecentlyUsed', []);
    }

    function trackRecentlyUsed(entry) {
        const recent = getRecentlyUsed().filter(r => r.key !== entry.key);
        recent.unshift(entry);
        GM_setValue('ticketResponseRecentlyUsed', recent.slice(0, MAX_RECENTLY_USED));
    }

    /* ==========================================================
     *  PINNED RESPONSES STORAGE
     * ==========================================================*/

    function getPinnedResponses() {
        return GM_getValue('ticketResponsePinned', []);
    }

    function savePinnedResponses(pinned) {
        GM_setValue('ticketResponsePinned', pinned);
    }

    function isPinned(key) {
        return getPinnedResponses().some(p => p.key === key);
    }

    function togglePinned(entry) {
        const pinned = getPinnedResponses();
        const idx = pinned.findIndex(p => p.key === entry.key);
        if (idx >= 0) pinned.splice(idx, 1);
        else pinned.push(entry);
        savePinnedResponses(pinned);
    }

    /* ==========================================================
     *  CUSTOM RESPONSES STORAGE (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getCustomResponses() {
        return GM_getValue('ticketResponseCustomResponses', []);
    }

    function saveCustomResponses(responses) {
        GM_setValue('ticketResponseCustomResponses', responses);
    }

    function generateCustomId() {
        return 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    }

    function resolveCustomResponseText(rawText, vars) {
        return rawText
            .replace(/\{\{openedByName\}\}/g, vars.openedByName || 'User')
            .replace(/\{\{pageType\}\}/g, vars.pageType || 'ticket');
    }

    /* ==========================================================
     *  SETTINGS STORAGE
     * ==========================================================*/

    function getAutoUpdateDateEnabled() {
        return GM_getValue('ticketResponseAutoUpdateDate', true);
    }

    function setAutoUpdateDateEnabled(val) {
        GM_setValue('ticketResponseAutoUpdateDate', val);
    }

    /* ==========================================================
     *  DATE UPDATE HELPERS
     * ==========================================================*/

    function getFormattedDate() {
        const today = new Date();
        const day   = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year  = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function getShortDescriptionInput() {
        return document.getElementById('sc_req_item.short_description') ||
               document.getElementById('incident.short_description') ||
               document.getElementById('sc_task.short_description');
    }

    function maybeUpdateShortDescriptionDate() {
        if (!getAutoUpdateDateEnabled()) return;
        const input = getShortDescriptionInput();
        if (!input) return;
        const currentValue = input.value.trim();
        if (!currentValue) return;
        const newDate = getFormattedDate();
        const datePattern = /^\d{2}-\d{2}-\d{4}/;
        const newValue = datePattern.test(currentValue)
            ? currentValue.replace(datePattern, newDate)
            : `${newDate} | ${currentValue}`;
        if (newValue === currentValue) return;
        input.value = newValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Named indices for the pipe-delimited short description format:
    // DD-MM-YYYY | MF | Product | Status | Vendor Case | Type | Complexity | PER | Tenant
    const SHORT_DESC_FIELDS = {
        date: 0, mf: 1, product: 2, status: 3,
        vendorCase: 4, type: 5, complexity: 6, per: 7, tenant: 8
    };

    function applyShortDescTransforms(transforms) {
        if (!transforms || !transforms.length) return;
        const input = getShortDescriptionInput();
        if (!input || !input.value.includes('|')) return;
        const parts = input.value.split('|').map(p => p.trim());
        let changed = false;
        transforms.forEach(t => {
            const idx = SHORT_DESC_FIELDS[t.field];
            if (idx !== undefined && idx < parts.length) {
                parts[idx] = t.value;
                changed = true;
            }
        });
        if (!changed) return;
        input.value = parts.join(' | ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ==========================================================
     *  VERSION CONTROL FUNCTIONS (GM_getValue/GM_setValue)
     * ==========================================================*/

    function getStoredVersion() {
        return GM_getValue('ticketResponseVersion', null);
    }

    function saveVersion(version) {
        GM_setValue('ticketResponseVersion', version);
    }

    function hasSeenChangelog() {
        return GM_getValue('ticketResponseChangelogSeen', null) === SCRIPT_VERSION;
    }

    function markChangelogAsSeen() {
        GM_setValue('ticketResponseChangelogSeen', SCRIPT_VERSION);
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
     *  UTILITY FUNCTIONS
     * ==========================================================*/

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ==========================================================
     *  PAGE TYPE DETECTION
     * ==========================================================*/

    function getPageType() {
        const url = window.location.href;
        if (url.includes('/sc_req_item.do')) return 'request';
        if (url.includes('/incident.do'))    return 'incident';
        return 'ticket';
    }

    /* ==========================================================
     *  FIELD AVAILABILITY WATCHER
     * ==========================================================*/

    function waitForFieldAvailability() {
        return new Promise((resolve) => {
            const selectors = [
                'sc_req_item.opened_by_label',
                'sys_display.sc_req_item.opened_by',
                'incident.opened_by_label',
                'sys_display.incident.opened_by',
                'sc_req_item.caller_id_label',
                'sys_display.sc_req_item.caller_id',
                'incident.caller_id_label',
                'sys_display.incident.caller_id'
            ];

            for (const selector of selectors) {
                const field = document.getElementById(selector);
                if (field && (field.value || field.textContent)) {
                    console.log('✓ Field already available:', selector);
                    resolve(true);
                    return;
                }
            }

            console.log('⏳ Waiting for form fields to load...');
            const observer = new MutationObserver((mutations, obs) => {
                for (const selector of selectors) {
                    const field = document.getElementById(selector);
                    if (field && (field.value || field.textContent)) {
                        console.log('✓ Field detected via observer:', selector);
                        obs.disconnect();
                        resolve(true);
                        return;
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                console.warn('⚠️ Field availability timeout');
                resolve(false);
            }, 10000);
        });
    }

    /* ==========================================================
     *  ENHANCED NAME DETECTION WITH RETRY
     * ==========================================================*/

    async function getOpenedByName(retries = 5, delay = 300) {
        if (cachedOpenedByName) {
            console.log('✓ Using cached name:', cachedOpenedByName);
            return cachedOpenedByName;
        }

        const selectors = [
            'sc_req_item.opened_by_label',
            'sys_display.sc_req_item.opened_by',
            'incident.opened_by_label',
            'sys_display.incident.opened_by',
            'sc_req_item.caller_id_label',
            'sys_display.sc_req_item.caller_id',
            'incident.caller_id_label',
            'sys_display.incident.caller_id'
        ];

        for (let attempt = 0; attempt < retries; attempt++) {
            for (const selector of selectors) {
                const field = document.getElementById(selector);
                if (field) {
                    const name = field.value || field.textContent;
                    if (name && name.trim() && name.trim().length > 2) {
                        console.log(`✓ Found "Opened by" name on attempt ${attempt + 1}:`, name.trim());
                        cachedOpenedByName = name.trim();
                        return cachedOpenedByName;
                    }
                }
            }

            const labelFields = document.querySelectorAll('[id*="opened_by"], [id*="caller_id"]');
            for (const field of labelFields) {
                const name = field.value || field.textContent;
                if (name && name.trim() && !name.includes('_') && name.length > 2) {
                    console.log(`✓ Found name from fallback on attempt ${attempt + 1}:`, name.trim());
                    cachedOpenedByName = name.trim();
                    return cachedOpenedByName;
                }
            }

            if (attempt < retries - 1) {
                console.log(`⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }

        console.warn('⚠️ Could not find "Opened by" name after all retries, using placeholder');
        return null;
    }

    async function cacheOpenedByName() {
        await waitForFieldAvailability();
        cachedOpenedByName = await getOpenedByName();
        if (cachedOpenedByName) {
            console.log('✓ Cached opened by name:', cachedOpenedByName);
        }
    }

    /* ==========================================================
     *  DEBUG SERVICENOW MENTION SYSTEM
     * ==========================================================*/

    function debugMentionSystem() {
        console.group('🔍 ServiceNow Mention System Debug');
        const textarea = document.querySelector('#activity-stream-textarea');
        console.log('Textarea found:', !!textarea);
        console.log('Dual input mode:', isDualInputMode());
        console.log('Mention blocker active:', _mentionBlockerActive);
        console.log('g_form available:', typeof g_form !== 'undefined');
        console.log('Angular available:', typeof angular !== 'undefined');
        console.log('jQuery available:', typeof $ !== 'undefined');
        if (textarea) {
            const mentionElements = document.querySelectorAll('[class*="mention"], [data-mention], [class*="at-"], .atwho-view');
            console.log('Mention-related elements:', mentionElements.length);
            if (typeof $ !== 'undefined') {
                try { console.log('jQuery data on textarea:', $(textarea).data()); } catch (e) {}
            }
        }
        if (typeof window.SNMention !== 'undefined')    console.log('✓ SNMention found:', window.SNMention);
        if (typeof window.GlideMention !== 'undefined') console.log('✓ GlideMention found:', window.GlideMention);
        console.groupEnd();
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            debugMentionSystem();
        }
    });

    /* ==========================================================
     *  SERVICENOW API MENTION INSERTION
     * ==========================================================*/

    async function insertMentionViaAPI(textarea, name) {
        console.log('🔔 Attempting API-based mention insertion for:', name);
        try {
            if (typeof $ !== 'undefined' && $(textarea).data('atwho')) {
                const atwho = $(textarea).data('atwho');
                if (atwho && atwho.insert) { atwho.insert('@', name); return true; }
            }
            if (typeof angular !== 'undefined') {
                try {
                    const scope = angular.element(textarea).scope();
                    if (scope && scope.insertMention) { await scope.insertMention(name); return true; }
                } catch (e) { console.warn('Angular method failed:', e.message); }
            }
            if (textarea.mentionPlugin || textarea._mentionApi) {
                const api = textarea.mentionPlugin || textarea._mentionApi;
                if (api.insert || api.addMention) { (api.insert || api.addMention).call(api, name); return true; }
            }
            if (typeof window.SNMention !== 'undefined' && window.SNMention.insert) {
                window.SNMention.insert(textarea, name); return true;
            }
            if (typeof window.GlideMention !== 'undefined' && window.GlideMention.insert) {
                window.GlideMention.insert(textarea, name); return true;
            }
        } catch (error) {
            console.warn('⚠️ API insertion failed:', error);
            return false;
        }
        return false;
    }

    /* ==========================================================
     *  TEXT INSERTION HELPERS
     * ==========================================================*/

    function insertTextDirectly(textarea, text) {
        const start = textarea.selectionStart || 0;
        const end   = textarea.selectionEnd   || 0;
        const current = textarea.value;
        textarea.value = current.substring(0, start) + text + current.substring(end);
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

        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: '@', inputType: 'insertText' }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { key: '@', code: 'Digit2', keyCode: 50, which: 50, shiftKey: true, bubbles: true, cancelable: true }));
        await sleep(400);

        for (const char of name) {
            insertTextDirectly(textarea, char);
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: char, inputType: 'insertText' }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
            await sleep(50);
        }

        await sleep(400);

        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        await sleep(200);

        const suggestionSelectors = ['.mention-suggestion', '.at-view-ul li', '[role="option"]', '.atwho-view li', '.atwho-view-ul li', '.mentions-autocomplete li', '[data-mention-item]'];
        for (const selector of suggestionSelectors) {
            const suggestion = document.querySelector(selector);
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

    /* ==========================================================
     *  MAIN MENTION INSERTION WITH STRATEGIES
     * ==========================================================*/

    async function insertTextWithMention(textarea, text, fieldType = 'comments') {
        console.group('📝 Inserting text with mentions');
        console.log('Text to insert:', text);

        const mentionRegex = /@\[([^\]]+)\]/g;
        const matches = text.match(mentionRegex);

        if (!matches || matches.length === 0) {
            console.log('ℹ️ No mentions detected, inserting as plain text');
            if (textarea.value.trim() !== "") {
                textarea.value += "\n\n" + text;
            } else {
                textarea.value = text;
            }
            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.groupEnd();
            return;
        }

        console.log('🔔 Mentions detected:', matches);

        const mentions = [];
        let match;
        mentionRegex.lastIndex = 0;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({ placeholder: match[0], name: match[1], index: match.index });
        }

        const parts = text.split(mentionRegex);
        console.log('Text parts:', parts);

        // Show blocker before any async work begins
        showMentionBlocker(mentions.length, 1, fieldType, textarea);

        try {
            const existingContent = textarea.value.trim();
            if (existingContent) {
                textarea.value = existingContent + "\n\n";
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            } else {
                textarea.value = '';
            }

            textarea.focus();
            await sleep(100);

            let partIndex = 0;
            for (let i = 0; i < mentions.length; i++) {
                if (i > 0) updateMentionBlocker(mentions.length, i + 1);
                if (parts[partIndex]) {
                    insertTextDirectly(textarea, parts[partIndex]);
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

            textarea.dispatchEvent(new Event('input',  { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('✓ Text insertion complete');
        } finally {
            // Always release the blocker, even if an error was thrown
            hideMentionBlocker();
        }

        console.groupEnd();
    }

    /* ==========================================================
     *  CUSTOM RESPONSES MANAGEMENT MODAL
     * ==========================================================*/

    function showCustomResponsesModal(onUpdate) {
        const existingOverlay = document.getElementById('customResponsesModalOverlay');
        if (existingOverlay) existingOverlay.remove();
        const existingModal = document.getElementById('customResponsesModal');
        if (existingModal) existingModal.remove();

        let responses = getCustomResponses();

        const overlay = document.createElement('div');
        overlay.id = 'customResponsesModalOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'customResponsesModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '10001', background: '#fff', border: '2px solid #333', padding: '0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif',
            borderRadius: '10px', width: '640px', maxWidth: '95vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });

        const headerBar = document.createElement('div');
        Object.assign(headerBar.style, { padding: '16px 20px', borderBottom: '2px solid #667eea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', flexShrink: '0' });

        const title = document.createElement('h2');
        title.textContent = 'Custom Responses';
        Object.assign(title.style, { margin: '0', fontSize: '18px', color: '#333' });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666', padding: '0 4px', lineHeight: '1' });
        closeBtn.onmouseover = () => closeBtn.style.color = '#333';
        closeBtn.onmouseout  = () => closeBtn.style.color = '#666';

        headerBar.appendChild(title);
        headerBar.appendChild(closeBtn);
        modal.appendChild(headerBar);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, { flex: '1', overflowY: 'auto', padding: '16px 20px' });
        modal.appendChild(contentArea);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, { padding: '12px 20px', borderTop: '1px solid #e0e0e0', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: '0' });

        const responseCount = document.createElement('span');
        Object.assign(responseCount.style, { fontSize: '12px', color: '#888' });

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add Response';
        Object.assign(addBtn.style, { padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' });
        addBtn.onmouseover = () => addBtn.style.backgroundColor = '#218838';
        addBtn.onmouseout  = () => addBtn.style.backgroundColor = '#28a745';

        footerBar.appendChild(responseCount);
        footerBar.appendChild(addBtn);
        modal.appendChild(footerBar);

        // Badge helper for the list cards
        function makeFieldTypeBadge(fieldType) {
            const badge = document.createElement('span');
            const isWorkNotes = fieldType === 'work_notes';
            badge.textContent = isWorkNotes ? '🔒 Work Notes' : '💬 Comments';
            Object.assign(badge.style, {
                fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '3px',
                backgroundColor: isWorkNotes ? '#fff3cd' : '#d1ecf1',
                color: isWorkNotes ? '#856404' : '#0c5460',
                border: `1px solid ${isWorkNotes ? '#ffc107' : '#bee5eb'}`,
                whiteSpace: 'nowrap'
            });
            return badge;
        }

        function renderList() {
            responses = getCustomResponses();
            contentArea.innerHTML = '';
            responseCount.textContent = `${responses.length} custom response${responses.length !== 1 ? 's' : ''}`;

            if (responses.length === 0) {
                const empty = document.createElement('div');
                Object.assign(empty.style, { textAlign: 'center', padding: '40px 20px', color: '#999' });
                empty.innerHTML = `<div style="font-size: 36px; margin-bottom: 12px;">📝</div><div style="font-size: 15px; margin-bottom: 6px;">No custom responses yet</div><div style="font-size: 12px;">Click <strong>+ Add Response</strong> to create your first one.</div>`;
                contentArea.appendChild(empty);
                return;
            }

            responses.forEach((resp, index) => {
                const card = document.createElement('div');
                Object.assign(card.style, { border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 14px', marginBottom: '10px', backgroundColor: '#fafbfc', transition: 'box-shadow 0.2s ease' });
                card.onmouseover = () => card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                card.onmouseout  = () => card.style.boxShadow = 'none';

                const cardHeader = document.createElement('div');
                Object.assign(cardHeader.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' });

                const titleAndBadge = document.createElement('div');
                Object.assign(titleAndBadge.style, { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' });

                const titleSpan = document.createElement('span');
                titleSpan.textContent = resp.title;
                Object.assign(titleSpan.style, { fontWeight: 'bold', fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });

                titleAndBadge.appendChild(titleSpan);
                titleAndBadge.appendChild(makeFieldTypeBadge(resp.fieldType || 'comments'));

                const btnGroup = document.createElement('div');
                Object.assign(btnGroup.style, { display: 'flex', gap: '6px', flexShrink: '0' });

                if (index > 0) {
                    const upBtn = createIconButton('▲', 'Move up', '#6c757d');
                    upBtn.onclick = () => {
                        [responses[index - 1], responses[index]] = [responses[index], responses[index - 1]];
                        saveCustomResponses(responses);
                        renderList();
                    };
                    btnGroup.appendChild(upBtn);
                }

                if (index < responses.length - 1) {
                    const downBtn = createIconButton('▼', 'Move down', '#6c757d');
                    downBtn.onclick = () => {
                        [responses[index], responses[index + 1]] = [responses[index + 1], responses[index]];
                        saveCustomResponses(responses);
                        renderList();
                    };
                    btnGroup.appendChild(downBtn);
                }

                const editBtn = createIconButton('✎', 'Edit', '#007bff');
                editBtn.onclick = () => showEditorView(resp, renderList);
                btnGroup.appendChild(editBtn);

                const deleteBtn = createIconButton('🗑', 'Delete', '#dc3545');
                deleteBtn.onclick = () => {
                    if (confirm(`Delete "${resp.title}"?`)) {
                        responses = responses.filter(r => r.id !== resp.id);
                        saveCustomResponses(responses);
                        renderList();
                        if (onUpdate) onUpdate();
                    }
                };
                btnGroup.appendChild(deleteBtn);

                cardHeader.appendChild(titleAndBadge);
                cardHeader.appendChild(btnGroup);
                card.appendChild(cardHeader);

                const preview = document.createElement('div');
                Object.assign(preview.style, { fontSize: '12px', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' });
                preview.textContent = resp.text.substring(0, 120) + (resp.text.length > 120 ? '…' : '');
                card.appendChild(preview);
                contentArea.appendChild(card);
            });
        }

        function createIconButton(icon, titleText, color) {
            const btn = document.createElement('button');
            btn.textContent = icon;
            btn.title = titleText;
            Object.assign(btn.style, { background: 'none', border: '1px solid ' + color, color, borderRadius: '4px', cursor: 'pointer', padding: '2px 7px', fontSize: '12px', lineHeight: '1.2' });
            btn.onmouseover = () => { btn.style.backgroundColor = color; btn.style.color = '#fff'; };
            btn.onmouseout  = () => { btn.style.backgroundColor = 'transparent'; btn.style.color = color; };
            return btn;
        }

        function showEditorView(existing, afterSave) {
            const isEdit = !!existing;
            contentArea.innerHTML = '';
            footerBar.style.display = 'none';

            const backRow = document.createElement('div');
            Object.assign(backRow.style, { marginBottom: '14px' });
            const backBtn = document.createElement('button');
            backBtn.textContent = '← Back to list';
            Object.assign(backBtn.style, { background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: '0', fontSize: '13px', textDecoration: 'underline' });
            backBtn.onclick = () => { document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove()); footerBar.style.display = 'flex'; renderList(); };
            backRow.appendChild(backBtn);
            contentArea.appendChild(backRow);

            const editorTitle = document.createElement('h3');
            editorTitle.textContent = isEdit ? 'Edit Response' : 'New Custom Response';
            Object.assign(editorTitle.style, { margin: '0 0 14px 0', fontSize: '16px', color: '#333' });
            contentArea.appendChild(editorTitle);

            // ── Title field ──────────────────────────────────────────────
            const titleLabel = document.createElement('label');
            titleLabel.textContent = 'Response Title';
            Object.assign(titleLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: '#444' });
            contentArea.appendChild(titleLabel);

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.placeholder = 'e.g. Follow-up with logs request';
            titleInput.value = isEdit ? existing.title : '';
            Object.assign(titleInput.style, { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' });
            titleInput.onfocus = () => titleInput.style.borderColor = '#667eea';
            titleInput.onblur  = () => titleInput.style.borderColor = '#ccc';
            contentArea.appendChild(titleInput);

            // ── Target field selector ─────────────────────────────────────
            const fieldTypeLabel = document.createElement('label');
            fieldTypeLabel.textContent = 'Target field';
            Object.assign(fieldTypeLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#444' });
            contentArea.appendChild(fieldTypeLabel);

            const fieldTypeRow = document.createElement('div');
            Object.assign(fieldTypeRow.style, {
                display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap'
            });

            const currentFieldType = (isEdit && existing.fieldType) ? existing.fieldType : 'comments';

            [
                { value: 'comments',   icon: '💬', label: 'Additional comments', sublabel: 'Customer visible' },
                { value: 'work_notes', icon: '🔒', label: 'Work notes',           sublabel: 'Internal only' }
            ].forEach(opt => {
                const pill = document.createElement('label');
                Object.assign(pill.style, {
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    padding: '8px 14px', border: '2px solid #dee2e6', borderRadius: '6px',
                    fontSize: '13px', userSelect: 'none', transition: 'all 0.15s ease',
                    backgroundColor: currentFieldType === opt.value ? '#f0f2ff' : '#fff',
                    borderColor: currentFieldType === opt.value ? '#667eea' : '#dee2e6'
                });

                const radio = document.createElement('input');
                radio.type  = 'radio';
                radio.name  = 'customFieldType';
                radio.value = opt.value;
                radio.checked = (currentFieldType === opt.value);
                Object.assign(radio.style, { margin: '0', cursor: 'pointer' });

                const textWrap = document.createElement('div');
                const mainText = document.createElement('div');
                mainText.textContent = `${opt.icon} ${opt.label}`;
                Object.assign(mainText.style, { fontWeight: '600', color: '#333' });
                const subText = document.createElement('div');
                subText.textContent = opt.sublabel;
                Object.assign(subText.style, { fontSize: '11px', color: '#888', marginTop: '1px' });
                textWrap.appendChild(mainText);
                textWrap.appendChild(subText);

                pill.appendChild(radio);
                pill.appendChild(textWrap);

                pill.addEventListener('change', () => {
                    fieldTypeRow.querySelectorAll('label').forEach(l => {
                        l.style.backgroundColor = '#fff';
                        l.style.borderColor = '#dee2e6';
                    });
                    pill.style.backgroundColor = '#f0f2ff';
                    pill.style.borderColor = '#667eea';
                });

                fieldTypeRow.appendChild(pill);
            });

            // Sync styling when radio changes by any means
            fieldTypeRow.addEventListener('change', () => {
                fieldTypeRow.querySelectorAll('label').forEach(pill => {
                    const r = pill.querySelector('input[type=radio]');
                    pill.style.backgroundColor = r.checked ? '#f0f2ff' : '#fff';
                    pill.style.borderColor      = r.checked ? '#667eea' : '#dee2e6';
                });
            });

            const fieldTypeHint = document.createElement('div');
            fieldTypeHint.textContent = 'In dual-input mode both fields are shown simultaneously — this setting controls which one receives the text.';
            Object.assign(fieldTypeHint.style, { fontSize: '11px', color: '#888', marginTop: '-8px', marginBottom: '14px' });

            contentArea.appendChild(fieldTypeRow);
            contentArea.appendChild(fieldTypeHint);

            // ── Body field ───────────────────────────────────────────────
            const bodyLabel = document.createElement('label');
            bodyLabel.textContent = 'Response Body';
            Object.assign(bodyLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: '#444' });
            contentArea.appendChild(bodyLabel);

            const varBar = document.createElement('div');
            Object.assign(varBar.style, { display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' });

            const varLabelEl = document.createElement('span');
            varLabelEl.textContent = 'Insert variable:';
            Object.assign(varLabelEl.style, { fontSize: '12px', color: '#666', marginRight: '2px' });
            varBar.appendChild(varLabelEl);

            const variables = [
                { label: '@Mention Opened By', value: '@[{{openedByName}}]', tooltip: '@ mention the ticket opener (triggers ServiceNow mention picker)' },
                { label: 'Page Type',           value: '{{pageType}}',        tooltip: 'Inserts "request" or "incident" based on ticket type' }
            ];

            variables.forEach(v => {
                const varBtnWrapper = document.createElement('div');
                Object.assign(varBtnWrapper.style, { position: 'relative', display: 'inline-block' });

                const tooltipEl = document.createElement('div');
                tooltipEl.className = 'custom-response-tooltip';
                tooltipEl.textContent = v.tooltip;
                Object.assign(tooltipEl.style, { position: 'fixed', background: '#333', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', zIndex: '20000', pointerEvents: 'none', display: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' });
                document.body.appendChild(tooltipEl);

                const varBtn = document.createElement('button');
                varBtn.textContent = v.label;
                Object.assign(varBtn.style, { padding: '4px 10px', fontSize: '12px', border: '1px solid #667eea', borderRadius: '4px', backgroundColor: '#f0f2ff', color: '#667eea', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s ease' });
                varBtn.onmouseover = (e) => {
                    varBtn.style.backgroundColor = '#667eea';
                    varBtn.style.color = '#fff';
                    const rect = varBtn.getBoundingClientRect();
                    tooltipEl.style.left = `${rect.left}px`;
                    tooltipEl.style.top  = `${rect.top - 30}px`;
                    tooltipEl.style.display = 'block';
                };
                varBtn.onmouseout = () => { varBtn.style.backgroundColor = '#f0f2ff'; varBtn.style.color = '#667eea'; tooltipEl.style.display = 'none'; };
                varBtn.onclick = () => {
                    const start = bodyTextarea.selectionStart;
                    const end   = bodyTextarea.selectionEnd;
                    const current = bodyTextarea.value;
                    bodyTextarea.value = current.substring(0, start) + v.value + current.substring(end);
                    bodyTextarea.selectionStart = bodyTextarea.selectionEnd = start + v.value.length;
                    bodyTextarea.focus();
                };

                varBtnWrapper.appendChild(varBtn);
                varBar.appendChild(varBtnWrapper);
            });

            contentArea.appendChild(varBar);

            const bodyTextarea = document.createElement('textarea');
            bodyTextarea.placeholder = 'Type your response here...\n\nUse the variable buttons above to insert dynamic values.';
            bodyTextarea.value = isEdit ? existing.text : '';
            Object.assign(bodyTextarea.style, { width: '100%', minHeight: '200px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '13px', fontFamily: 'Consolas, Monaco, "Courier New", monospace', lineHeight: '1.5', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' });
            bodyTextarea.onfocus = () => bodyTextarea.style.borderColor = '#667eea';
            bodyTextarea.onblur  = () => bodyTextarea.style.borderColor = '#ccc';
            contentArea.appendChild(bodyTextarea);

            const previewLabel = document.createElement('label');
            previewLabel.textContent = 'Preview (with sample values)';
            Object.assign(previewLabel.style, { display: 'block', fontWeight: 'bold', fontSize: '12px', marginBottom: '4px', color: '#888' });
            contentArea.appendChild(previewLabel);

            const previewBox = document.createElement('div');
            Object.assign(previewBox.style, { padding: '10px', border: '1px dashed #ccc', borderRadius: '5px', backgroundColor: '#fafbfc', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5', maxHeight: '150px', overflowY: 'auto', color: '#555', marginBottom: '14px' });
            contentArea.appendChild(previewBox);

            function updatePreview() {
                const sampleVars = { openedByName: cachedOpenedByName || 'John Doe', pageType: getPageType() };
                previewBox.textContent = resolveCustomResponseText(bodyTextarea.value, sampleVars) || '(empty)';
            }
            bodyTextarea.addEventListener('input', updatePreview);
            updatePreview();

            // ── Action buttons ────────────────────────────────────────────
            const actionRow = document.createElement('div');
            Object.assign(actionRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            Object.assign(cancelBtn.style, { padding: '8px 18px', backgroundColor: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' });
            cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f5f5f5';
            cancelBtn.onmouseout  = () => cancelBtn.style.backgroundColor = '#fff';
            cancelBtn.onclick = () => { document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove()); footerBar.style.display = 'flex'; renderList(); };

            const saveBtn = document.createElement('button');
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Response';
            Object.assign(saveBtn.style, { padding: '8px 18px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' });
            saveBtn.onmouseover = () => saveBtn.style.backgroundColor = '#5568d3';
            saveBtn.onmouseout  = () => saveBtn.style.backgroundColor = '#667eea';
            saveBtn.onclick = () => {
                const newTitle = titleInput.value.trim();
                const newText  = bodyTextarea.value.trim();
                const selectedFieldType = fieldTypeRow.querySelector('input[name="customFieldType"]:checked')?.value || 'comments';

                if (!newTitle) { titleInput.style.borderColor = '#dc3545'; titleInput.focus(); return; }
                if (!newText)  { bodyTextarea.style.borderColor = '#dc3545'; bodyTextarea.focus(); return; }

                responses = getCustomResponses();
                if (isEdit) {
                    const idx = responses.findIndex(r => r.id === existing.id);
                    if (idx !== -1) {
                        responses[idx].title     = newTitle;
                        responses[idx].text      = newText;
                        responses[idx].fieldType = selectedFieldType;
                    }
                } else {
                    responses.push({ id: generateCustomId(), title: newTitle, text: newText, fieldType: selectedFieldType });
                }
                saveCustomResponses(responses);
                document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove());
                footerBar.style.display = 'flex';
                renderList();
                if (onUpdate) onUpdate();
            };

            actionRow.appendChild(cancelBtn);
            actionRow.appendChild(saveBtn);
            contentArea.appendChild(actionRow);
            titleInput.focus();
        }

        addBtn.onclick = () => showEditorView(null, renderList);

        const closeModal = () => {
            overlay.remove();
            modal.remove();
            document.querySelectorAll('.custom-response-tooltip').forEach(t => t.remove());
            if (onUpdate) onUpdate();
        };

        closeBtn.onclick = closeModal;
        overlay.onclick  = closeModal;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        renderList();
    }

    /* ==========================================================
     *  UI HELPER FUNCTIONS
     * ==========================================================*/

    function getCurrentTeamKey() {
        const stored = GM_getValue('ticketResponseTeam', null);
        return stored && TEAMS[stored] ? stored : null;
    }

    function saveTeam(teamKey) {
        GM_setValue('ticketResponseTeam', teamKey);
    }

    function showLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: '99999', display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const content = document.createElement('div');
        Object.assign(content.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' });

        const spinner = document.createElement('div');
        Object.assign(spinner.style, { width: '60px', height: '60px', border: '6px solid #f3f3f3', borderTop: '6px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' });
        content.appendChild(spinner);

        if (message) {
            const msgEl = document.createElement('div');
            Object.assign(msgEl.style, { fontSize: '14px', color: '#555', fontFamily: 'Arial, sans-serif', textAlign: 'center' });

            const msgText = document.createElement('span');
            msgText.textContent = message;

            const dotsEl = document.createElement('span');
            dotsEl.textContent = '.';

            let dotCount = 1;
            setInterval(() => {
                dotCount = dotCount >= 3 ? 1 : dotCount + 1;
                dotsEl.textContent = '.'.repeat(dotCount);
            }, 500);

            msgEl.appendChild(msgText);
            msgEl.appendChild(dotsEl);
            content.appendChild(msgEl);
        }

        overlay.appendChild(content);
        document.body.appendChild(overlay);
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
        overlay.id = 'changelogModalOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'changelogModal';
        Object.assign(modal.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '10001', background: '#fff', border: '2px solid #333', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', borderRadius: '10px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' });

        const title = document.createElement('h2');
        title.textContent = `What's New - Version ${SCRIPT_VERSION}`;
        Object.assign(title.style, { marginTop: '0', marginBottom: '15px', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px' });

        const versionInfo = document.createElement('div');
        versionInfo.textContent = `You've been updated to version ${SCRIPT_VERSION}!`;
        Object.assign(versionInfo.style, { backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px', marginBottom: '15px', borderLeft: '4px solid #667eea' });

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

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Got it!';
        Object.assign(closeButton.style, { marginTop: '15px', padding: '10px 20px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', width: '100%' });
        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#5568d3';
        closeButton.onmouseout  = () => closeButton.style.backgroundColor = '#667eea';
        closeButton.onclick = () => {
            overlay.remove();
            modal.remove();
            markChangelogAsSeen();
            saveVersion(SCRIPT_VERSION);
            const changelogNotification = document.getElementById('changelogNotification');
            if (changelogNotification) changelogNotification.remove();
        };

        modal.appendChild(title);
        modal.appendChild(versionInfo);
        modal.appendChild(cardsWrap);
        modal.appendChild(closeButton);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = () => closeButton.click();
    }

    function showHelpModal() {
        if (document.getElementById('responseHelperHelpModal')) return;

        function addParagraph(body, text) {
            const p = document.createElement('p');
            p.textContent = text;
            Object.assign(p.style, {
                fontSize: '12px', color: '#555', lineHeight: '1.5',
                margin: '0 0 8px 0', fontFamily: 'Arial, sans-serif'
            });
            body.appendChild(p);
        }

        function addBulletList(body, items) {
            const ul = document.createElement('div');
            ul.style.marginBottom = '8px';
            for (const item of items) {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', gap: '8px', padding: '2px 0',
                    fontSize: '12px', color: '#555', lineHeight: '1.5',
                    fontFamily: 'Arial, sans-serif'
                });
                const dot = document.createElement('span');
                dot.textContent = '•';
                Object.assign(dot.style, { color: '#667eea', flexShrink: '0', fontWeight: 'bold' });
                const text = document.createElement('span');
                text.textContent = item;
                row.appendChild(dot);
                row.appendChild(text);
                ul.appendChild(row);
            }
            body.appendChild(ul);
        }

        const sections = [
            {
                icon: '🚀',
                title: 'Getting Started',
                buildContent: (body) => {
                    addParagraph(body, 'The Ticket Response Helper adds an inline button next to the Short Description field on every ServiceNow ticket. Click it to open a dropdown of predefined response templates for your team.');

                    const btnRow = document.createElement('div');
                    Object.assign(btnRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const btnBadge = document.createElement('span');
                    btnBadge.textContent = '🗣 Quick Response';
                    Object.assign(btnBadge.style, {
                        background: '#669bea', color: '#fff', borderRadius: '4px',
                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const btnDesc = document.createElement('span');
                    btnDesc.textContent = 'This button appears next to the Short Description field on every ticket. Click it to open the response dropdown.';
                    Object.assign(btnDesc.style, {
                        fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                    });
                    btnRow.appendChild(btnBadge);
                    btnRow.appendChild(btnDesc);
                    body.appendChild(btnRow);

                    addBulletList(body, [
                        'Open any RITM or Incident ticket in ServiceNow.',
                        'Click the blue "🗣 Quick Response" button next to the Short Description field.',
                        'Browse sections or use the search box to find a template.',
                        'Click a template to insert it into the correct field on the ticket immediately.'
                    ]);
                }
            },
            {
                icon: '📋',
                title: 'Response Templates',
                buildContent: (body) => {
                    addParagraph(body, 'Templates are grouped into collapsible sections: First contact, Responses, Reminders, Closures, Work Notes Comments, Other, and Custom. Click a section header to expand or collapse it.');

                    addParagraph(body, 'Each template targets a specific ticket field:');

                    const fieldTypes = [
                        {
                            bg: '#0066cc', label: 'Comments',
                            desc: 'Customer-facing. The requester can see these. Use for replies, updates, and requests directed at the person who opened the ticket.'
                        },
                        {
                            bg: '#5a6672', label: 'Work Notes',
                            desc: 'Internal only. Visible to your team but not the requester. Use for handover notes, investigation logs, and internal status updates.'
                        }
                    ];
                    for (const ft of fieldTypes) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badge = document.createElement('span');
                        badge.textContent = ft.label;
                        Object.assign(badge.style, {
                            background: ft.bg, color: '#fff', borderRadius: '4px',
                            padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                            alignSelf: 'flex-start', minWidth: '80px', textAlign: 'center'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = ft.desc;
                        Object.assign(descEl.style, {
                            fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                        });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }

                    addParagraph(body, 'Some templates have sub-options: hover over the item to reveal a flyout menu with variants. Click any variant to insert it.');
                }
            },
            {
                icon: '🔍',
                title: 'Search',
                buildContent: (body) => {
                    addParagraph(body, 'A search box at the top of the dropdown filters all templates across all sections in real time:');

                    const searchBox = document.createElement('div');
                    Object.assign(searchBox.style, {
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px',
                        background: '#fff', marginBottom: '12px', maxWidth: '260px'
                    });
                    const searchIcon = document.createElement('span');
                    searchIcon.textContent = '🔍';
                    searchIcon.style.fontSize = '12px';
                    const searchPlaceholder = document.createElement('span');
                    searchPlaceholder.textContent = 'Search responses...';
                    Object.assign(searchPlaceholder.style, {
                        fontSize: '12px', color: '#bbb', fontFamily: 'Arial, sans-serif', fontStyle: 'italic'
                    });
                    searchBox.appendChild(searchIcon);
                    searchBox.appendChild(searchPlaceholder);
                    body.appendChild(searchBox);

                    addBulletList(body, [
                        'Type any word from a template label to narrow the list instantly.',
                        'The search works across all sections and flyout sub-options.',
                        'Clear the search box to return to the full grouped list.'
                    ]);
                }
            },
            {
                icon: '👤',
                title: 'Name Detection',
                buildContent: (body) => {
                    addParagraph(body, 'Templates can include the requester\'s first name. When you insert a template the script reads the "Opened by" field and substitutes the name automatically:');

                    const exampleWrap = document.createElement('div');
                    Object.assign(exampleWrap.style, {
                        marginBottom: '12px', borderRadius: '6px',
                        border: '1px solid #d0d0f0', overflow: 'hidden'
                    });
                    const exRows = [
                        { label: 'Template', bg: '#f8f8ff', color: '#888', text: 'Hello [Name], thank you for contacting us.' },
                        { label: 'Inserted',  bg: '#f2fff7', color: '#2a7d4f', text: 'Hello Jane, thank you for contacting us.' }
                    ];
                    for (const exRow of exRows) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', alignItems: 'baseline', gap: '10px',
                            padding: '7px 12px', background: exRow.bg,
                            borderBottom: exRow.label === 'Template' ? '1px solid #e8e8f0' : 'none'
                        });
                        const labelEl = document.createElement('span');
                        labelEl.textContent = exRow.label;
                        Object.assign(labelEl.style, {
                            fontSize: '10px', fontWeight: 'bold', color: exRow.color,
                            textTransform: 'uppercase', whiteSpace: 'nowrap',
                            width: '55px', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                        });
                        const textEl = document.createElement('span');
                        textEl.textContent = exRow.text;
                        Object.assign(textEl.style, { fontFamily: 'monospace', fontSize: '11px', color: '#333' });
                        row.appendChild(labelEl);
                        row.appendChild(textEl);
                        exampleWrap.appendChild(row);
                    }
                    body.appendChild(exampleWrap);

                    addBulletList(body, [
                        'Name detection works in both the classic (new tab) and Polaris (dashboard) ticket views.',
                        'If the name cannot be read from the ticket, the placeholder "[Name]" stays in the inserted text so you can fill it in before saving.'
                    ]);
                }
            },
            {
                icon: '✦',
                title: 'Custom Responses',
                buildContent: (body) => {
                    const headerRow = document.createElement('div');
                    Object.assign(headerRow.style, {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '12px', padding: '10px 14px',
                        background: '#f8f8ff', borderRadius: '6px', border: '1px solid #d0d0f0'
                    });
                    const headerBadge = document.createElement('span');
                    headerBadge.textContent = '✦ Manage Custom Responses';
                    Object.assign(headerBadge.style, {
                        background: '#f0f2ff', color: '#667eea', border: '1px solid #667eea',
                        borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif'
                    });
                    const headerDesc = document.createElement('span');
                    headerDesc.textContent = 'Located in the dropdown header. Opens the editor where you can create, edit, and delete your personal templates.';
                    Object.assign(headerDesc.style, {
                        fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                    });
                    headerRow.appendChild(headerBadge);
                    headerRow.appendChild(headerDesc);
                    body.appendChild(headerRow);

                    const fieldDescs = [
                        ['Label',      'The name shown in the dropdown list for your template.'],
                        ['Body',       'The full text that gets inserted into the ticket field when clicked.'],
                        ['Field Type', 'Choose "Comments" (customer-facing) or "Work Notes" (internal).']
                    ];
                    const grid = document.createElement('div');
                    Object.assign(grid.style, {
                        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', marginBottom: '10px'
                    });
                    for (const [field, desc] of fieldDescs) {
                        const nameEl = document.createElement('span');
                        nameEl.textContent = field;
                        Object.assign(nameEl.style, {
                            fontFamily: 'monospace', fontSize: '11px',
                            color: '#667eea', fontWeight: 'bold', padding: '2px 0'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = desc;
                        Object.assign(descEl.style, {
                            fontSize: '12px', color: '#555', padding: '2px 0', fontFamily: 'Arial, sans-serif'
                        });
                        grid.appendChild(nameEl);
                        grid.appendChild(descEl);
                    }
                    body.appendChild(grid);

                    addBulletList(body, [
                        'Custom responses appear in a dedicated "Custom" section at the bottom of the dropdown.',
                        'They are stored locally in your browser and do not affect other users on your team.'
                    ]);
                }
            },
            {
                icon: '⚙️',
                title: 'Settings',
                buildContent: (body) => {
                    const headerButtons = [
                        {
                            bg: 'transparent', color: '#555', border: '1px solid #ccc', label: '⚙ Settings',
                            desc: 'Opens the Settings modal where you can toggle auto-date update and switch your active team.'
                        },
                        {
                            bg: 'transparent', color: '#667eea', border: '1px solid #c0c8f0', label: '? Help',
                            desc: 'Opens this Feature Guide.'
                        },
                        {
                            bg: '#f0f2ff', color: '#667eea', border: '1px solid #667eea', label: '✦ Manage Custom Responses',
                            desc: 'Opens the custom response editor. Create, edit, and delete your personal templates.'
                        }
                    ];
                    for (const item of headerButtons) {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                            marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0'
                        });
                        const badge = document.createElement('span');
                        badge.textContent = item.label;
                        Object.assign(badge.style, {
                            background: item.bg, color: item.color, border: item.border,
                            borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold',
                            whiteSpace: 'nowrap', flexShrink: '0', fontFamily: 'Arial, sans-serif',
                            alignSelf: 'flex-start'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = item.desc;
                        Object.assign(descEl.style, {
                            fontSize: '12px', color: '#555', lineHeight: '1.5', fontFamily: 'Arial, sans-serif'
                        });
                        row.appendChild(badge);
                        row.appendChild(descEl);
                        body.appendChild(row);
                    }

                    addParagraph(body, 'Inside the Settings modal:');

                    const settingsItems = [
                        ['Auto-update date on insert', 'Updates the date at the start of the short description to today (DD-MM-YYYY) every time you insert a response.'],
                        ['Switch Team',                'Changes your active team between EMEA, AME, and APAC. Each team has its own set of templates and section layout. Switching teams reloads the page.']
                    ];
                    const grid = document.createElement('div');
                    Object.assign(grid.style, {
                        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px'
                    });
                    for (const [name, desc] of settingsItems) {
                        const nameEl = document.createElement('span');
                        nameEl.textContent = name;
                        Object.assign(nameEl.style, {
                            fontFamily: 'monospace', fontSize: '11px', color: '#667eea',
                            fontWeight: 'bold', padding: '2px 0', whiteSpace: 'nowrap'
                        });
                        const descEl = document.createElement('span');
                        descEl.textContent = desc;
                        Object.assign(descEl.style, {
                            fontSize: '12px', color: '#555', padding: '2px 0',
                            fontFamily: 'Arial, sans-serif', lineHeight: '1.4'
                        });
                        grid.appendChild(nameEl);
                        grid.appendChild(descEl);
                    }
                    body.appendChild(grid);
                }
            }
        ];

        const overlay = document.createElement('div');
        overlay.id = 'responseHelperHelpModalOverlay';

        const modal = document.createElement('div');
        modal.id = 'responseHelperHelpModal';

        // Modal header row
        const modalHeader = document.createElement('div');
        Object.assign(modalHeader.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', borderBottom: '2px solid #667eea', paddingBottom: '12px'
        });

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📖';
        titleIcon.style.fontSize = '22px';
        const titleText = document.createElement('div');
        const titleMain = document.createElement('div');
        titleMain.textContent = 'Feature Guide';
        Object.assign(titleMain.style, {
            fontWeight: 'bold', fontSize: '17px', color: '#333', fontFamily: 'Arial, sans-serif'
        });
        const titleSub = document.createElement('div');
        titleSub.textContent = `Ticket Response Helper • v${SCRIPT_VERSION}`;
        Object.assign(titleSub.style, {
            fontSize: '11px', color: '#888', marginTop: '2px', fontFamily: 'Arial, sans-serif'
        });
        titleText.appendChild(titleMain);
        titleText.appendChild(titleSub);
        titleEl.appendChild(titleIcon);
        titleEl.appendChild(titleText);

        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, {
            background: 'none', border: 'none', fontSize: '18px',
            color: '#999', cursor: 'pointer', padding: '2px 6px',
            borderRadius: '4px', lineHeight: '1', fontFamily: 'Arial, sans-serif'
        });
        closeX.onmouseover = () => { closeX.style.background = '#f0f0f0'; };
        closeX.onmouseout  = () => { closeX.style.background = 'none'; };

        modalHeader.appendChild(titleEl);
        modalHeader.appendChild(closeX);
        modal.appendChild(modalHeader);

        // Section cards
        const contentWrap = document.createElement('div');
        for (const section of sections) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                border: '1px solid #e8e8f0', borderRadius: '6px',
                marginBottom: '8px', overflow: 'hidden'
            });

            const cardHeader = document.createElement('div');
            Object.assign(cardHeader.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#f8f8ff',
                cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e8e8f0'
            });

            const headerLeft = document.createElement('span');
            headerLeft.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
            const iconEl = document.createElement('span');
            iconEl.textContent = section.icon;
            iconEl.style.fontSize = '14px';
            const titleLabel = document.createElement('span');
            titleLabel.textContent = section.title;
            Object.assign(titleLabel.style, {
                fontWeight: 'bold', fontSize: '13px', color: '#444', fontFamily: 'Arial, sans-serif'
            });
            headerLeft.appendChild(iconEl);
            headerLeft.appendChild(titleLabel);

            const chevron = document.createElement('span');
            chevron.textContent = '▾';
            Object.assign(chevron.style, {
                fontSize: '12px', color: '#999', transition: 'transform 0.2s', display: 'inline-block'
            });

            cardHeader.appendChild(headerLeft);
            cardHeader.appendChild(chevron);

            const cardBody = document.createElement('div');
            Object.assign(cardBody.style, { padding: '12px 14px', background: '#fff' });
            section.buildContent(cardBody);

            card.appendChild(cardHeader);
            card.appendChild(cardBody);

            let expanded = true;
            cardHeader.addEventListener('click', () => {
                expanded = !expanded;
                cardBody.style.display = expanded ? 'block' : 'none';
                chevron.style.transform = expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
            });

            contentWrap.appendChild(card);
        }
        modal.appendChild(contentWrap);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px', padding: '10px 20px',
            background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontWeight: 'bold', width: '100%',
            fontSize: '14px', fontFamily: 'Arial, sans-serif'
        });
        closeBtn.onmouseover = () => { closeBtn.style.background = '#5568d3'; };
        closeBtn.onmouseout  = () => { closeBtn.style.background = '#667eea'; };
        closeBtn.onclick = () => { overlay.remove(); modal.remove(); };
        closeX.onclick   = () => closeBtn.click();
        overlay.onclick  = () => closeBtn.click();

        modal.appendChild(closeBtn);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
    }

    function showSettingsModal() {
        if (document.getElementById('responseHelperSettingsOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'responseHelperSettingsOverlay';
        Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: '10000' });

        const modal = document.createElement('div');
        modal.id = 'responseHelperSettingsModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: '10001', background: '#fff', border: '2px solid #333',
            padding: '0', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'Arial, sans-serif', borderRadius: '10px',
            minWidth: '360px', maxWidth: '460px'
        });

        const headerBar = document.createElement('div');
        Object.assign(headerBar.style, {
            padding: '14px 18px', borderBottom: '2px solid #667eea',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f8f9fa', borderRadius: '8px 8px 0 0'
        });
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        Object.assign(title.style, { margin: '0', fontSize: '15px', color: '#333', fontFamily: 'Arial, sans-serif' });
        const closeX = document.createElement('button');
        closeX.textContent = '✕';
        Object.assign(closeX.style, { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666', padding: '0', lineHeight: '1' });
        closeX.onmouseover = () => closeX.style.color = '#333';
        closeX.onmouseout  = () => closeX.style.color = '#666';
        closeX.onclick = () => { overlay.remove(); modal.remove(); };
        headerBar.appendChild(title);
        headerBar.appendChild(closeX);

        const body = document.createElement('div');
        Object.assign(body.style, { padding: '16px 18px' });

        // Toggle row: auto-update date
        const toggleRow = document.createElement('div');
        Object.assign(toggleRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' });

        const labelCol = document.createElement('div');
        const labelText = document.createElement('div');
        labelText.textContent = 'Auto-update date on insert';
        Object.assign(labelText.style, { fontSize: '13px', fontWeight: 'bold', color: '#333', fontFamily: 'Arial, sans-serif' });
        const labelDesc = document.createElement('div');
        labelDesc.textContent = 'Updates the short description date to today when a response is inserted.';
        Object.assign(labelDesc.style, { fontSize: '11px', color: '#777', marginTop: '3px', fontFamily: 'Arial, sans-serif' });
        labelCol.appendChild(labelText);
        labelCol.appendChild(labelDesc);

        const toggleLabel = document.createElement('label');
        Object.assign(toggleLabel.style, { position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: '0', marginLeft: '16px' });
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = getAutoUpdateDateEnabled();
        Object.assign(toggleInput.style, { opacity: '0', width: '0', height: '0', position: 'absolute' });
        const slider = document.createElement('span');
        Object.assign(slider.style, {
            position: 'absolute', cursor: 'pointer', top: '0', left: '0', right: '0', bottom: '0',
            backgroundColor: toggleInput.checked ? '#667eea' : '#ccc',
            borderRadius: '22px', transition: 'background-color 0.25s'
        });
        const knob = document.createElement('span');
        Object.assign(knob.style, {
            position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px',
            backgroundColor: '#fff', borderRadius: '50%', transition: 'transform 0.25s',
            transform: toggleInput.checked ? 'translateX(18px)' : 'translateX(0)'
        });
        slider.appendChild(knob);
        toggleInput.onchange = () => {
            const on = toggleInput.checked;
            setAutoUpdateDateEnabled(on);
            slider.style.backgroundColor = on ? '#667eea' : '#ccc';
            knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
        };
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(slider);

        toggleRow.appendChild(labelCol);
        toggleRow.appendChild(toggleLabel);
        body.appendChild(toggleRow);

        // Separator
        const separator = document.createElement('div');
        Object.assign(separator.style, { borderTop: '1px solid #e0e0e0', margin: '10px 0' });
        body.appendChild(separator);

        // Team section
        const teamSectionTitle = document.createElement('div');
        teamSectionTitle.textContent = '👥 Team';
        Object.assign(teamSectionTitle.style, {
            fontWeight: 'bold', fontSize: '13px', color: '#333',
            marginBottom: '8px', fontFamily: 'Arial, sans-serif'
        });
        body.appendChild(teamSectionTitle);

        const teamRow = document.createElement('div');
        Object.assign(teamRow.style, {
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '12px'
        });

        const currentTeamKey = getCurrentTeamKey();
        const currentTeam = currentTeamKey ? TEAMS[currentTeamKey] : null;

        const teamLabel = document.createElement('span');
        teamLabel.textContent = `Current team: ${currentTeam ? currentTeam.name : 'None'}`;
        Object.assign(teamLabel.style, {
            fontSize: '13px', color: '#555', fontFamily: 'Arial, sans-serif'
        });

        const switchTeamModalBtn = document.createElement('button');
        switchTeamModalBtn.textContent = 'Switch Team';
        Object.assign(switchTeamModalBtn.style, {
            padding: '6px 14px', background: '#667eea', color: 'white',
            border: 'none', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold', fontFamily: 'Arial, sans-serif',
            transition: 'background 0.2s ease', flexShrink: '0'
        });
        switchTeamModalBtn.onmouseover = () => { switchTeamModalBtn.style.background = '#5568d3'; };
        switchTeamModalBtn.onmouseout  = () => { switchTeamModalBtn.style.background = '#667eea'; };
        switchTeamModalBtn.onclick = () => {
            overlay.remove();
            modal.remove();
            GM_deleteValue('ticketResponseTeam');
            isInitialized = false;
            showLoadingOverlay('Reloading page to select team');
            setTimeout(() => location.reload(), 100);
        };

        teamRow.appendChild(teamLabel);
        teamRow.appendChild(switchTeamModalBtn);
        body.appendChild(teamRow);

        modal.appendChild(headerBar);
        modal.appendChild(body);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); modal.remove(); } };
    }

    function showTeamSelector() {
        if (document.getElementById('ticketResponseTeamSelector')) return;

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'ticketResponseTeamSelector';
        Object.assign(selectorContainer.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '10000', background: '#fff', border: '1px solid #ddd', borderTop: '4px solid #667eea', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', borderRadius: '10px', textAlign: 'center', minWidth: '400px' });

        const title = document.createElement('h2');
        title.textContent = 'Select Your Team';
        title.style.marginBottom = '8px';
        title.style.color = '#667eea';
        selectorContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Ticket Response Helper Script';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#667eea';
        subtitle.style.fontSize = '12px';
        subtitle.style.fontWeight = 'bold';
        subtitle.style.letterSpacing = '0.5px';
        subtitle.style.textTransform = 'uppercase';
        selectorContainer.appendChild(subtitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        for (const [key, team] of Object.entries(TEAMS)) {
            const btn = document.createElement('button');
            btn.textContent = team.name;
            Object.assign(btn.style, { padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', border: '2px solid #667eea', borderRadius: '6px', backgroundColor: '#667eea', color: 'white', cursor: 'pointer', transition: 'all 0.3s ease' });
            btn.onmouseover = () => { btn.style.backgroundColor = '#5568d3'; btn.style.borderColor = '#5568d3'; };
            btn.onmouseout  = () => { btn.style.backgroundColor = '#667eea'; btn.style.borderColor = '#667eea'; };
            btn.onclick = () => {
                saveTeam(key);
                selectorContainer.remove();
                initializeDropdown();
            };
            buttonContainer.appendChild(btn);
        }

        selectorContainer.appendChild(buttonContainer);
        document.body.appendChild(selectorContainer);
    }

    /* ==========================================================
     *  POSITION DROPDOWN FUNCTION
     * ==========================================================*/

    function positionDropdown(dropdown, button) {
        const rect = button.getBoundingClientRect();
        dropdown.style.top  = `${rect.bottom + window.scrollY + 5}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
    }

    /* ==========================================================
     *  BUILD DROPDOWN MENU WITH COLLAPSIBLE SECTIONS
     * ==========================================================*/

    function buildDropdownMenu(team, teamKey, inlineButton) {
        const categories = {
            first_contact: { label: 'First contact',          items: [] },
            responses:     { label: 'Responses',              items: [] },
            reminders:     { label: 'Reminders',              items: [] },
            closures:      { label: 'Closures',               items: [] },
            workcomments:  { label: 'Work Notes Comments',    items: [] },
            other:         { label: 'Other',                  items: [] },
            custom:        { label: 'Custom',                 items: [] }
        };

        team.enabledResponses.forEach(responseKey => {
            const metadata = team.responseMetadata[responseKey];
            if (metadata && categories[metadata.category] && !metadata.parentItem) {
                categories[metadata.category].items.push({ value: responseKey, label: metadata.label });
            }
        });

        const customResponses = getCustomResponses();
        customResponses.forEach(cr => {
            categories.custom.items.push({ value: cr.id, label: cr.title, isCustom: true, customText: cr.text, fieldType: cr.fieldType || 'comments' });
        });

        const dropdown = document.createElement('div');
        dropdown.id = 'ticket-response-dropdown';
        Object.assign(dropdown.style, { position: 'absolute', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '9999', fontFamily: 'Arial, sans-serif', minWidth: '280px', maxHeight: '500px', display: 'none', flexDirection: 'column' });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, { padding: '12px 15px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' });

        const teamInfo = document.createElement('div');
        Object.assign(teamInfo.style, {
            fontSize: '11px', color: '#666', marginBottom: '6px',
            display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
        });
        const teamInfoText = document.createElement('span');
        teamInfoText.textContent = `Team: ${team.name} • v${SCRIPT_VERSION}`;
        teamInfo.appendChild(teamInfoText);

        // "What's New" notification sits directly after the version number
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';
            Object.assign(changelogNotification.style, { display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '0', background: 'none', border: 'none' });

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';
            Object.assign(notificationDot.style, { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' });

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = "What's New";
            Object.assign(notificationText.style, { fontSize: '11px', color: '#0066cc', textDecoration: 'underline' });

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onmouseover = () => notificationText.style.color = '#0052a3';
            changelogNotification.onmouseout  = () => notificationText.style.color = '#0066cc';
            changelogNotification.onclick = () => showChangelogModal();
            teamInfo.appendChild(changelogNotification);
        }

        const actionButtons = document.createElement('div');
        Object.assign(actionButtons.style, { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' });

        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙ Settings';
        Object.assign(settingsBtn.style, {
            color: '#555', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px', border: '1px solid #ccc',
            fontWeight: 'bold', userSelect: 'none', backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease', fontFamily: 'Arial, sans-serif'
        });
        settingsBtn.onmouseover = () => { settingsBtn.style.backgroundColor = '#f0f0f0'; };
        settingsBtn.onmouseout  = () => { settingsBtn.style.backgroundColor = 'transparent'; };
        settingsBtn.onclick = () => {
            dropdown.style.display = 'none';
            showSettingsModal();
        };
        actionButtons.appendChild(settingsBtn);

        const helpBtn = document.createElement('button');
        helpBtn.textContent = '? Help';
        Object.assign(helpBtn.style, {
            color: '#667eea', cursor: 'pointer', fontSize: '11px', display: 'inline-flex',
            alignItems: 'center', padding: '1px 6px', borderRadius: '3px', border: '1px solid #c0c8f0',
            fontWeight: 'bold', userSelect: 'none', backgroundColor: 'transparent',
            transition: 'background-color 0.2s ease', fontFamily: 'Arial, sans-serif'
        });
        helpBtn.title = 'View feature guide and documentation';
        helpBtn.onmouseover = () => { helpBtn.style.backgroundColor = '#eef0ff'; };
        helpBtn.onmouseout  = () => { helpBtn.style.backgroundColor = 'transparent'; };
        helpBtn.onclick = () => { dropdown.style.display = 'none'; showHelpModal(); };
        actionButtons.appendChild(helpBtn);

        const manageCustomRow = document.createElement('div');
        Object.assign(manageCustomRow.style, { marginTop: '8px' });

        const manageCustomBtn = document.createElement('button');
        manageCustomBtn.textContent = '✦ Manage Custom Responses';
        Object.assign(manageCustomBtn.style, { padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#f0f2ff', color: '#667eea', border: '1px solid #667eea', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s ease', width: '100%' });
        manageCustomBtn.onmouseover = () => { manageCustomBtn.style.backgroundColor = '#667eea'; manageCustomBtn.style.color = '#fff'; };
        manageCustomBtn.onmouseout  = () => { manageCustomBtn.style.backgroundColor = '#f0f2ff'; manageCustomBtn.style.color = '#667eea'; };
        manageCustomBtn.onclick = () => {
            dropdown.style.display = 'none';
            showCustomResponsesModal(() => rebuildDropdownContent(dropdown, team, teamKey, inlineButton));
        };
        manageCustomRow.appendChild(manageCustomBtn);

        header.appendChild(teamInfo);
        header.appendChild(actionButtons);
        header.appendChild(manageCustomRow);
        dropdown.appendChild(header);

        const searchRow = document.createElement('div');
        Object.assign(searchRow.style, { padding: '7px 12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fff' });
        const searchInput = document.createElement('input');
        searchInput.id = 'response-search-input';
        searchInput.type = 'text';
        searchInput.placeholder = 'Filter templates…';
        Object.assign(searchInput.style, {
            width: '100%', padding: '5px 8px', fontSize: '12px',
            border: '1px solid #d0d0d0', borderRadius: '4px',
            fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', outline: 'none', color: '#333',
        });
        searchInput.addEventListener('focus', () => { searchInput.style.borderColor = '#0066cc'; });
        searchInput.addEventListener('blur',  () => { searchInput.style.borderColor = '#d0d0d0'; });
        searchInput.addEventListener('input', () => { filterItems(optionsContainer, searchInput.value); });
        searchRow.appendChild(searchInput);
        dropdown.appendChild(searchRow);

        const optionsContainer = document.createElement('div');
        optionsContainer.id = 'sections-container';
        Object.assign(optionsContainer.style, { overflowY: 'auto', maxHeight: '400px' });
        dropdown.appendChild(optionsContainer);

        buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown);

        return dropdown;
    }

    /* ==========================================================
     *  BUILD SECTIONS CONTENT
     * ==========================================================*/

    function buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown) {
        optionsContainer.innerHTML = '';

        const sectionStates = getSectionStates();
        const sectionOrder  = getSectionOrder(teamKey);
        const rebuildFn     = () => rebuildDropdownContent(dropdown, team, teamKey);

        // ── Pinned section ──
        const pinnedItems = getPinnedResponses();
        if (pinnedItems.length > 0) {
            const pinnedSection = document.createElement('div');
            pinnedSection.className = 'category-section';
            pinnedSection.dataset.categoryKey = 'pinned';

            const pinnedHeader = document.createElement('div');
            Object.assign(pinnedHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: '#eef0ff', borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                textTransform: 'uppercase', letterSpacing: '0.7px',
            });
            pinnedHeader.textContent = '📌 Pinned';

            const pinnedItemsContainer = document.createElement('div');
            pinnedItemsContainer.className = 'category-items';

            pinnedItems.forEach(entry => {
                const ft = entry.fieldType || 'comments';
                if (entry.hasSubmenu) {
                    pinnedItemsContainer.appendChild(buildSubmenuParentOption(entry.key, entry.label, ft, team, dropdown, rebuildFn));
                } else {
                    const option = buildMenuOption(entry.label, ft, async () => {
                        trackRecentlyUsed(entry);
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(ft);
                        if (textarea) {
                            const text = entry.isCustom
                                ? resolveCustomResponseText(entry.customText, vars)
                                : team.responses[entry.key](vars);
                            await insertTextWithMention(textarea, text, ft);
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                            if (!entry.isCustom) {
                                const pinnedMeta = team.responseMetadata[entry.key];
                                if (pinnedMeta && pinnedMeta.shortDescTransforms) applyShortDescTransforms(pinnedMeta.shortDescTransforms);
                            }
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, entry, rebuildFn);
                    pinnedItemsContainer.appendChild(option);
                }
            });

            pinnedSection.appendChild(pinnedHeader);
            pinnedSection.appendChild(pinnedItemsContainer);
            optionsContainer.appendChild(pinnedSection);
        }

        // ── Recently Used section ──
        const recentItems = getRecentlyUsed();
        if (recentItems.length > 0) {
            const recentSection = document.createElement('div');
            recentSection.className = 'category-section';
            recentSection.dataset.categoryKey = 'recently_used';

            const recentHeader = document.createElement('div');
            Object.assign(recentHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: '#fff8e1', borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                textTransform: 'uppercase', letterSpacing: '0.7px',
            });
            recentHeader.textContent = '⏱ Recently Used';

            const recentItemsContainer = document.createElement('div');
            recentItemsContainer.className = 'category-items';

            recentItems.forEach(entry => {
                const ft = entry.fieldType || 'comments';
                const option = buildMenuOption(entry.label, ft, async () => {
                    trackRecentlyUsed(entry);
                    const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                    const textarea = getTargetTextarea(ft);
                    if (textarea) {
                        const text = entry.isCustom
                            ? resolveCustomResponseText(entry.customText, vars)
                            : team.responses[entry.key](vars);
                        await insertTextWithMention(textarea, text, ft);
                        flashTargetField(textarea);
                        maybeUpdateShortDescriptionDate();
                        if (!entry.isCustom) {
                            const recentMeta = team.responseMetadata[entry.key];
                            if (recentMeta && recentMeta.shortDescTransforms) applyShortDescTransforms(recentMeta.shortDescTransforms);
                        }
                    }
                    dropdown.style.display = 'none';
                });
                recentItemsContainer.appendChild(option);
            });

            recentSection.appendChild(recentHeader);
            recentSection.appendChild(recentItemsContainer);
            optionsContainer.appendChild(recentSection);
        }

        sectionOrder.forEach(catKey => {
            const category = categories[catKey];
            if (!category || category.items.length === 0) return;

            const sectionWrapper = document.createElement('div');
            sectionWrapper.className = 'category-section';
            sectionWrapper.dataset.categoryKey = catKey;

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            Object.assign(categoryHeader.style, {
                padding: '8px 15px', fontSize: '11px', fontWeight: 'bold', color: '#555',
                backgroundColor: catKey === 'custom' ? '#ebe8ff' : '#e9edf2',
                borderTop: '1px solid #d4d8de', borderBottom: '2px solid #d4d8de',
                cursor: 'pointer', userSelect: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textTransform: 'uppercase', letterSpacing: '0.7px'
            });

            const categoryLabel = document.createElement('span');
            categoryLabel.textContent = catKey === 'custom' ? `✦ ${category.label}` : category.label;

            const collapseIndicator = document.createElement('span');
            const isCollapsed = sectionStates[catKey] === true;
            collapseIndicator.textContent = isCollapsed ? '▶' : '▼';
            collapseIndicator.style.fontSize = '10px';

            categoryHeader.appendChild(categoryLabel);
            categoryHeader.appendChild(collapseIndicator);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'category-items';
            Object.assign(itemsContainer.style, { display: isCollapsed ? 'none' : 'block', transition: 'all 0.2s ease' });

            category.items.forEach(item => {
                if (item.isCustom) {
                    const option = buildMenuOption(item.label, item.fieldType || 'comments', async () => {
                        trackRecentlyUsed({ key: item.value, label: item.label, fieldType: item.fieldType || 'comments', isCustom: true, customText: item.customText });
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(item.fieldType || 'comments');
                        if (textarea) {
                            await insertTextWithMention(textarea, resolveCustomResponseText(item.customText, vars), item.fieldType || 'comments');
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, { key: item.value, label: item.label, fieldType: item.fieldType || 'comments', isCustom: true, customText: item.customText }, rebuildFn);
                    itemsContainer.appendChild(option);
                    return;
                }

                const metadata = team.responseMetadata[item.value];
                const fieldType = (metadata && metadata.fieldType) ? metadata.fieldType : 'comments';

                if (metadata && metadata.hasSubmenu) {
                    itemsContainer.appendChild(buildSubmenuParentOption(item.value, item.label, fieldType, team, dropdown, rebuildFn));

                } else if (!metadata || !metadata.parentItem) {
                    const option = buildMenuOption(item.label, fieldType, async () => {
                        trackRecentlyUsed({ key: item.value, label: item.label, fieldType });
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(fieldType);
                        if (textarea) {
                            await insertTextWithMention(textarea, team.responses[item.value](vars), fieldType);
                            flashTargetField(textarea);
                            maybeUpdateShortDescriptionDate();
                            if (metadata && metadata.shortDescTransforms) applyShortDescTransforms(metadata.shortDescTransforms);
                        }
                        dropdown.style.display = 'none';
                    });
                    attachPinButton(option, { key: item.value, label: item.label, fieldType }, rebuildFn);
                    itemsContainer.appendChild(option);
                }
            });

            categoryHeader.onclick = () => {
                const isCurrentlyCollapsed = itemsContainer.style.display === 'none';
                itemsContainer.style.display = isCurrentlyCollapsed ? 'block' : 'none';
                collapseIndicator.textContent = isCurrentlyCollapsed ? '▼' : '▶';
                saveSectionState(catKey, !isCurrentlyCollapsed);
            };

            sectionWrapper.appendChild(categoryHeader);
            sectionWrapper.appendChild(itemsContainer);
            optionsContainer.appendChild(sectionWrapper);
        });
    }

    /**
     * Tiny coloured dot that appears to the right of each menu item label,
     * indicating whether it targets Work Notes (amber) or Comments (teal).
     * Only visible in dual-input mode to avoid noise; always rendered in the
     * DOM but hidden via opacity when single-input mode is detected at build
     * time — recheck is done each time the dropdown opens via the button.
     */
    function makeFieldTypePip(fieldType) {
        const pip = document.createElement('span');
        pip.className = 'field-type-pip';
        pip.dataset.fieldType = fieldType;
        const isWorkNotes = fieldType === 'work_notes';
        Object.assign(pip.style, {
            display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: isWorkNotes ? '#ffc107' : '#17a2b8',
            opacity: isDualInputMode() ? '1' : '0',
            transition: 'opacity 0.2s ease',
            flexShrink: '0'
        });
        pip.title = isWorkNotes ? 'Goes to: Work Notes' : 'Goes to: Additional comments';
        return pip;
    }

    function filterItems(optionsContainer, query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            const states = getSectionStates();
            optionsContainer.querySelectorAll('.category-section').forEach(section => {
                section.style.display = '';
                section.querySelectorAll('[data-filter-label]').forEach(item => { item.style.display = ''; });
                const itemsEl = section.querySelector('.category-items');
                if (itemsEl) {
                    const catKey = section.dataset.categoryKey;
                    itemsEl.style.display = (catKey !== 'recently_used' && states[catKey]) ? 'none' : 'block';
                }
            });
            return;
        }
        optionsContainer.querySelectorAll('.category-section').forEach(section => {
            let visible = 0;
            section.querySelectorAll('[data-filter-label]').forEach(item => {
                const match = item.dataset.filterLabel.includes(q);
                item.style.display = match ? '' : 'none';
                if (match) visible++;
            });
            section.style.display = visible > 0 ? '' : 'none';
            const itemsEl = section.querySelector('.category-items');
            if (itemsEl) itemsEl.style.display = 'block';
        });
    }

    function buildMenuOption(label, fieldType, onClickHandler) {
        const option = document.createElement('div');
        option.dataset.filterLabel = label.toLowerCase();
        Object.assign(option.style, {
            padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000',
            borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const rightGroup = document.createElement('span');
        rightGroup.className = 'menu-option-right-group';
        Object.assign(rightGroup.style, { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0' });
        rightGroup.appendChild(makeFieldTypePip(fieldType));

        option.appendChild(labelSpan);
        option.appendChild(rightGroup);

        option.onmouseover = () => option.style.backgroundColor = '#f0f0f0';
        option.onmouseout  = () => option.style.backgroundColor = 'transparent';
        option.onclick     = onClickHandler;
        return option;
    }

    function attachPinButton(option, entry, rebuildFn) {
        const rightGroup = option.querySelector('.menu-option-right-group');
        if (!rightGroup) return;
        const pinBtn = document.createElement('span');
        const pinned = isPinned(entry.key);
        pinBtn.textContent = '📌';
        pinBtn.title = pinned ? 'Unpin' : 'Pin to top';
        Object.assign(pinBtn.style, {
            fontSize: '11px', cursor: 'pointer', lineHeight: '1', flexShrink: '0',
            opacity: pinned ? '1' : '0.25', transition: 'opacity 0.15s ease',
        });
        pinBtn.onmouseover = () => { pinBtn.style.opacity = '0.85'; };
        pinBtn.onmouseout  = () => { pinBtn.style.opacity = isPinned(entry.key) ? '1' : '0.25'; };
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            togglePinned(entry);
            rebuildFn();
        };
        rightGroup.appendChild(pinBtn);
    }

    function buildSubmenuParentOption(key, label, fieldType, team, dropdown, rebuildFn) {
        const parentOption = document.createElement('div');
        Object.assign(parentOption.style, { padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        const rightGroup = document.createElement('span');
        rightGroup.className = 'menu-option-right-group';
        Object.assign(rightGroup.style, { display: 'flex', alignItems: 'center', gap: '6px' });
        rightGroup.appendChild(makeFieldTypePip(fieldType));
        const arrowSpan = document.createElement('span');
        arrowSpan.textContent = '❯';
        arrowSpan.style.fontSize = '10px';
        arrowSpan.style.color = '#666';
        rightGroup.appendChild(arrowSpan);

        parentOption.appendChild(labelSpan);
        parentOption.appendChild(rightGroup);

        const submenu = document.createElement('div');
        submenu.className = 'bypass-submenu';
        Object.assign(submenu.style, { position: 'fixed', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: '200px', display: 'none', zIndex: '10001' });
        document.body.appendChild(submenu);

        const submenuItems = team.enabledResponses
            .map(responseKey => {
                const subMeta = team.responseMetadata[responseKey];
                return (subMeta && subMeta.parentItem === key)
                    ? { value: responseKey, label: subMeta.label, fieldType: subMeta.fieldType || 'comments' }
                    : null;
            })
            .filter(Boolean);

        parentOption.dataset.filterLabel = [label, ...submenuItems.map(s => s.label)].join(' ').toLowerCase();

        submenuItems.forEach(subItem => {
            const subOption = buildMenuOption(subItem.label, subItem.fieldType, async (e) => {
                e.stopPropagation();
                trackRecentlyUsed({ key: subItem.value, label: subItem.label, fieldType: subItem.fieldType });
                const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                const textarea = getTargetTextarea(subItem.fieldType);
                if (textarea) {
                    await insertTextWithMention(textarea, team.responses[subItem.value](vars), subItem.fieldType);
                    flashTargetField(textarea);
                    maybeUpdateShortDescriptionDate();
                    const subMeta = team.responseMetadata[subItem.value];
                    if (subMeta && subMeta.shortDescTransforms) applyShortDescTransforms(subMeta.shortDescTransforms);
                }
                dropdown.style.display = 'none';
                submenu.style.display = 'none';
            });
            attachPinButton(subOption, { key: subItem.value, label: subItem.label, fieldType: subItem.fieldType }, rebuildFn);
            submenu.appendChild(subOption);
        });

        parentOption.onmouseover = () => {
            parentOption.style.backgroundColor = '#f0f0f0';
            const rect = parentOption.getBoundingClientRect();
            submenu.style.top  = `${rect.top}px`;
            submenu.style.left = `${rect.right}px`;
            submenu.style.display = 'block';
        };
        parentOption.onmouseout = (e) => {
            if (!submenu.contains(e.relatedTarget)) {
                parentOption.style.backgroundColor = 'transparent';
                submenu.style.display = 'none';
            }
        };
        submenu.onmouseleave  = () => { submenu.style.display = 'none'; parentOption.style.backgroundColor = 'transparent'; };
        submenu.onmouseenter  = () => { parentOption.style.backgroundColor = '#f0f0f0'; };

        attachPinButton(parentOption, { key, label, fieldType, hasSubmenu: true }, rebuildFn);
        return parentOption;
    }

    /* ==========================================================
     *  UPDATE PIPS VISIBILITY ON DROPDOWN OPEN
     * =========================================================*/

    /**
     * Called each time the dropdown is shown. Refreshes all pip visibility
     * in case the user switched between single/dual mode between opens.
     */
    function refreshFieldTypePips(dropdown) {
        const dual = isDualInputMode();
        dropdown.querySelectorAll('.field-type-pip').forEach(pip => {
            pip.style.opacity = dual ? '1' : '0';
        });
    }

    /* ==========================================================
     *  REBUILD DROPDOWN CONTENT (after custom responses change)
     * ==========================================================*/

    function rebuildDropdownContent(dropdown, team, teamKey, inlineButton) {
        const optionsContainer = dropdown.querySelector('#sections-container');
        if (!optionsContainer) return;

        document.querySelectorAll('.bypass-submenu').forEach(sm => sm.remove());

        const categories = {
            first_contact: { label: 'First contact',       items: [] },
            responses:     { label: 'Responses',           items: [] },
            reminders:     { label: 'Reminders',           items: [] },
            closures:      { label: 'Closures',            items: [] },
            workcomments:  { label: 'Work Notes Comments', items: [] },
            other:         { label: 'Other',               items: [] },
            custom:        { label: 'Custom',              items: [] }
        };

        team.enabledResponses.forEach(responseKey => {
            const metadata = team.responseMetadata[responseKey];
            if (metadata && categories[metadata.category] && !metadata.parentItem) {
                categories[metadata.category].items.push({ value: responseKey, label: metadata.label });
            }
        });

        getCustomResponses().forEach(cr => {
            categories.custom.items.push({ value: cr.id, label: cr.title, isCustom: true, customText: cr.text, fieldType: cr.fieldType || 'comments' });
        });

        buildSectionsContent(optionsContainer, categories, team, teamKey, dropdown);
    }

    /* ==========================================================
     *  STYLES
     * ==========================================================*/

    const style = document.createElement('style');
    style.textContent = `
        @keyframes colorPulse {
            0%, 100% { background-color: #007bff; }
            50%       { background-color: #ff8c00; }
        }
        @keyframes spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        /* Mention blocker spinner */
        @keyframes mentionSpin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .mention-blocker-spinner { animation: mentionSpin 0.7s linear infinite; }
        /* Slide-down entrance for the toast */
        @keyframes mentionToastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-14px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #mention-blocker-toast { animation: mentionToastIn 0.2s ease forwards; }
        .notification-dot { animation: colorPulse 1s ease-in-out infinite; }
        #ticket-response-dropdown::-webkit-scrollbar       { width: 8px; }
        #ticket-response-dropdown::-webkit-scrollbar-track { background: #f1f1f1; }
        #ticket-response-dropdown::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
        #ticket-response-dropdown::-webkit-scrollbar-thumb:hover { background: #555; }
        .category-header:hover  { background-color: #e9ecef !important; }
        .category-header:active { background-color: #dee2e6 !important; }

        /* Dark mode isolation */
        #ticket-response-dropdown, #customResponsesModal,
        #teamSelector, #changelogModal,
        #responseHelperSettingsModal { color: #333333 !important; }
        #ticket-response-dropdown input, #ticket-response-dropdown select,
        #ticket-response-dropdown textarea,
        #customResponsesModal input, #customResponsesModal select,
        #customResponsesModal textarea,
        #teamSelector input, #teamSelector select, #teamSelector textarea,
        #changelogModal input, #changelogModal select, #changelogModal textarea,
        #responseHelperSettingsModal input, #responseHelperSettingsModal select,
        #responseHelperSettingsModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
        #ticket-response-dropdown { background-color: #ffffff !important; }
        #customResponsesModal { background-color: #ffffff !important; }
        #changelogModal { background-color: #ffffff !important; }
        #responseHelperSettingsModal { background-color: #ffffff !important; }

        /* Help Modal */
        #responseHelperHelpModalOverlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        }
        #responseHelperHelpModal {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: #fff;
            border: 2px solid #333;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            border-radius: 10px;
            width: 640px;
            max-width: 92vw;
            max-height: 82vh;
            overflow-y: auto;
            color: #333333 !important;
        }
        #responseHelperHelpModal input, #responseHelperHelpModal select,
        #responseHelperHelpModal textarea {
            background-color: #ffffff !important;
            color: #333333 !important;
        }
    `;
    document.head.appendChild(style);

    /* ==========================================================
     *  MAIN INITIALIZATION
     * ==========================================================*/

    function initializeDropdown() {
        if (document.getElementById('ticket-response-inline-button')) return;

        const teamKey = getCurrentTeamKey();
        if (!teamKey) { showTeamSelector(); return; }

        const currentTeam = TEAMS[teamKey];

        const inlineButton = document.createElement('button');
        inlineButton.id = 'ticket-response-inline-button';
        inlineButton.textContent = '🗣 Quick Response';
        inlineButton.type = 'button';
        Object.assign(inlineButton.style, {
            padding: '5px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer',
            background: '#669bea', fontSize: '13px', fontFamily: 'Arial, sans-serif',
            marginLeft: '10px', display: 'inline-block', transition: 'background 0.2s ease',
            color: 'white', position: 'relative'
        });
        inlineButton.onmouseover = () => inlineButton.style.background = '#5568d3';
        inlineButton.onmouseout  = () => inlineButton.style.background = '#669bea';

        const targetDiv = document.querySelector('.col-xs-10.col-md-9.col-lg-8.form-field .pull-left');
        if (targetDiv) {
            targetDiv.appendChild(inlineButton);
        } else {
            console.log('Target div not found, will retry...');
            setTimeout(initializeDropdown, 500);
            return;
        }

        const dropdown = buildDropdownMenu(currentTeam, teamKey, inlineButton);
        document.body.appendChild(dropdown);

        inlineButton.onclick = (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'flex';
            if (isVisible) {
                dropdown.style.display = 'none';
                document.querySelectorAll('.bypass-submenu').forEach(sm => sm.style.display = 'none');
            } else {
                // Rebuild sections to refresh Recently Used from storage
                rebuildDropdownContent(dropdown, currentTeam, teamKey, inlineButton);
                // Reset search input if it had text
                const srchInput = dropdown.querySelector('#response-search-input');
                if (srchInput && srchInput.value) {
                    srchInput.value = '';
                    const sc = dropdown.querySelector('#sections-container');
                    if (sc) filterItems(sc, '');
                }
                positionDropdown(dropdown, inlineButton);
                dropdown.style.display = 'flex';
                refreshFieldTypePips(dropdown);
                if (srchInput) setTimeout(() => srchInput.focus(), 0);
            }
        };

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (dropdown.style.display === 'flex') {
                clearTimeout(scrollTimeout);
                positionDropdown(dropdown, inlineButton);
                scrollTimeout = setTimeout(() => { if (dropdown.style.display === 'flex') positionDropdown(dropdown, inlineButton); }, 50);
            }
        }, true);

        window.addEventListener('resize', () => {
            if (dropdown.style.display === 'flex') positionDropdown(dropdown, inlineButton);
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== inlineButton) {
                dropdown.style.display = 'none';
                document.querySelectorAll('.bypass-submenu').forEach(sm => sm.style.display = 'none');
            }
        });
    }

    /* ==========================================================
     *  SINGLE INITIALIZATION POINT
     * ==========================================================*/

    async function initialize() {
        if (isInitialized) { console.log('Ticket Response Helper already initialized'); return; }
        console.log('Initializing Ticket Response Helper v' + SCRIPT_VERSION + '...');
        isInitialized = true;

        cacheOpenedByName();

        const teamKey = getCurrentTeamKey();
        if (!teamKey) {
            showTeamSelector();
        } else {
            initializeDropdown();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    console.log('✓ Ticket Response Helper v' + SCRIPT_VERSION + ' loaded');
    console.log('💡 Press Ctrl+Shift+D to debug mention system');

})();