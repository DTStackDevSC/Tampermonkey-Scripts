// ==UserScript==
// @name         Ticket Response Helper
// @downloadURL  https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowTicketResponseHelper.js
// @updateURL    https://raw.githubusercontent.com/DTStackDevSC/Tampermonkey-Scripts/refs/heads/main/Standalone%20Scripts/ServiceNowTicketResponseHelper.js
// @namespace    https://github.com/DTStackDevSC/Tampermonkey-Scripts
// @author       J.R.
// @version      2.10.4
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

    const SCRIPT_VERSION = '2.10.4';
    const CHANGELOG = `Version 2.10.4:
- Added several new options for EMEA Team.

Version 2.10.3:
- Updated Update URL to GitHub.`;

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
                fieldType: 'comments'
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
            workingOnReminder: {
                label: 'Working on the request Reminder',
                category: 'reminders',
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
            'configMgmtWorknotes',
            'configSteeringWorknotes',
            'urlcheck',
            'moreinfo',
            'vpninfo',
            'tier2SOCreq',
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
                workingOnReminder: (vars) => `Hello @[${vars.openedByName}],

Just a quick note to let you know that we are currently working on your request and the ticket is actively in progress.

We’ll keep you updated as we move forward.

Kind regards,
Global Data Security Enablement`
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
                fieldType: 'comments'
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
                fieldType: 'comments'
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

    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: '99999', display: 'flex', justifyContent: 'center', alignItems: 'center'
        });
        const spinner = document.createElement('div');
        Object.assign(spinner.style, { width: '60px', height: '60px', border: '6px solid #f3f3f3', borderTop: '6px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' });
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
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

        const changelogContent = document.createElement('div');
        changelogContent.textContent = CHANGELOG;
        Object.assign(changelogContent.style, { whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333' });

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
        modal.appendChild(changelogContent);
        modal.appendChild(closeButton);
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        overlay.onclick = () => closeButton.click();
    }

    function showTeamSelector() {
        if (document.getElementById('teamSelector')) return;

        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'teamSelector';
        Object.assign(selectorContainer.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: '10000', background: '#fff', border: '2px solid #333', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Arial, sans-serif', borderRadius: '10px', textAlign: 'center', minWidth: '400px' });

        const title = document.createElement('h2');
        title.textContent = 'Select Your Team';
        title.style.marginBottom = '20px';
        title.style.color = '#333';
        selectorContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Ticket Response Helper Script';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#666';
        subtitle.style.fontSize = '14px';
        subtitle.style.fontStyle = 'italic';
        selectorContainer.appendChild(subtitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';

        for (const [key, team] of Object.entries(TEAMS)) {
            const btn = document.createElement('button');
            btn.textContent = team.name;
            Object.assign(btn.style, { padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', border: '2px solid #007bff', borderRadius: '6px', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', transition: 'all 0.3s ease' });
            btn.onmouseover = () => { btn.style.backgroundColor = '#0056b3'; btn.style.borderColor = '#0056b3'; };
            btn.onmouseout  = () => { btn.style.backgroundColor = '#007bff'; btn.style.borderColor = '#007bff'; };
            btn.onclick = () => {
                saveTeam(key);
                selectorContainer.remove();
                showLoadingOverlay();
                setTimeout(() => location.reload(), 100);
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
        Object.assign(teamInfo.style, { fontSize: '11px', color: '#666', marginBottom: '6px' });
        teamInfo.textContent = `Team: ${team.name} • v${SCRIPT_VERSION}`;

        const actionButtons = document.createElement('div');
        Object.assign(actionButtons.style, { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' });

        const switchTeamBtn = document.createElement('button');
        switchTeamBtn.textContent = 'Switch Team';
        Object.assign(switchTeamBtn.style, { fontSize: '11px', background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: '0', textDecoration: 'underline' });
        switchTeamBtn.onmouseover = () => switchTeamBtn.style.color = '#0052a3';
        switchTeamBtn.onmouseout  = () => switchTeamBtn.style.color = '#0066cc';
        switchTeamBtn.onclick = () => {
            GM_deleteValue('ticketResponseTeam');
            dropdown.remove();
            inlineButton.remove();
            isInitialized = false;
            showLoadingOverlay();
            setTimeout(() => location.reload(), 100);
        };
        actionButtons.appendChild(switchTeamBtn);

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

        // Changelog notification
        if (isNewVersion() && !hasSeenChangelog()) {
            const changelogNotification = document.createElement('span');
            changelogNotification.id = 'changelogNotification';
            Object.assign(changelogNotification.style, { display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '0', background: 'none', border: 'none' });

            const notificationDot = document.createElement('span');
            notificationDot.className = 'notification-dot';
            Object.assign(notificationDot.style, { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' });

            const notificationText = document.createElement('span');
            notificationText.className = 'notification-text';
            notificationText.textContent = 'Changelog';
            Object.assign(notificationText.style, { fontSize: '11px', color: '#0066cc', textDecoration: 'underline' });

            changelogNotification.appendChild(notificationDot);
            changelogNotification.appendChild(notificationText);
            changelogNotification.onmouseover = () => notificationText.style.color = '#0052a3';
            changelogNotification.onmouseout  = () => notificationText.style.color = '#0066cc';
            changelogNotification.onclick = () => showChangelogModal();
            actionButtons.appendChild(changelogNotification);
        }

        header.appendChild(teamInfo);
        header.appendChild(actionButtons);
        header.appendChild(manageCustomRow);
        dropdown.appendChild(header);

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

        sectionOrder.forEach(catKey => {
            const category = categories[catKey];
            if (!category || category.items.length === 0) return;

            const sectionWrapper = document.createElement('div');
            sectionWrapper.className = 'category-section';
            sectionWrapper.dataset.categoryKey = catKey;

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            Object.assign(categoryHeader.style, {
                padding: '8px 15px', fontSize: '12px', fontWeight: 'bold', color: '#666',
                backgroundColor: catKey === 'custom' ? '#f0f2ff' : '#f8f9fa',
                borderBottom: '1px solid #e0e0e0', cursor: 'pointer', userSelect: 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
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
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(item.fieldType || 'comments');
                        if (textarea) {
                            await insertTextWithMention(textarea, resolveCustomResponseText(item.customText, vars), item.fieldType || 'comments');
                            flashTargetField(textarea);
                        }
                        dropdown.style.display = 'none';
                    });
                    itemsContainer.appendChild(option);
                    return;
                }

                const metadata = team.responseMetadata[item.value];
                const fieldType = (metadata && metadata.fieldType) ? metadata.fieldType : 'comments';

                if (metadata && metadata.hasSubmenu) {
                    // Parent item with submenu
                    const parentOption = document.createElement('div');
                    Object.assign(parentOption.style, { padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

                    const labelSpan = document.createElement('span');
                    labelSpan.textContent = item.label;

                    const rightGroup = document.createElement('span');
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
                            return (subMeta && subMeta.parentItem === item.value)
                                ? { value: responseKey, label: subMeta.label, fieldType: subMeta.fieldType || 'comments' }
                                : null;
                        })
                        .filter(Boolean);

                    submenuItems.forEach(subItem => {
                        const subOption = buildMenuOption(subItem.label, subItem.fieldType, async (e) => {
                            e.stopPropagation();
                            const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                            const textarea = getTargetTextarea(subItem.fieldType);
                            if (textarea) {
                                await insertTextWithMention(textarea, team.responses[subItem.value](vars), subItem.fieldType);
                                flashTargetField(textarea);
                            }
                            dropdown.style.display = 'none';
                            submenu.style.display = 'none';
                        });
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

                    itemsContainer.appendChild(parentOption);

                } else if (!metadata || !metadata.parentItem) {
                    const option = buildMenuOption(item.label, fieldType, async () => {
                        const vars = { openedByName: (await getOpenedByName()) || 'User', pageType: getPageType() };
                        const textarea = getTargetTextarea(fieldType);
                        if (textarea) {
                            await insertTextWithMention(textarea, team.responses[item.value](vars), fieldType);
                            flashTargetField(textarea);
                        }
                        dropdown.style.display = 'none';
                    });
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

    function buildMenuOption(label, fieldType, onClickHandler) {
        const option = document.createElement('div');
        Object.assign(option.style, {
            padding: '10px 15px', cursor: 'pointer', fontSize: '13px', color: '#000',
            borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s ease',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });

        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        option.appendChild(labelSpan);
        option.appendChild(makeFieldTypePip(fieldType));

        option.onmouseover = () => option.style.backgroundColor = '#f0f0f0';
        option.onmouseout  = () => option.style.backgroundColor = 'transparent';
        option.onclick     = onClickHandler;
        return option;
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
                positionDropdown(dropdown, inlineButton);
                dropdown.style.display = 'flex';
                refreshFieldTypePips(dropdown);   // ← refresh pip visibility on every open
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