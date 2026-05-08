Here is the complete reference document you can paste directly into Claude Code as context:

---

# ServiceNow Polaris (Dashboard) Mode — Script DOM Reference Guide

## The Core Problem

When a ticket is opened **directly from the ServiceNow dashboard** (URL pattern: `.../now/nav/ui/classic/params/target/...`), the form lives inside a `<macroponent-XXXXXXXX>` custom element with a **shadow DOM**. The classic `window.g_form`, `document.getElementById()`, etc. are **not available** at the top-level `window`. Everything must be accessed through the iframe nested inside that shadow root.

When opened via **right-click → New Tab**, the ticket URL is a plain `.../sc_req_item.do?sys_id=...` and `window.g_form` is directly accessible at the top level.

---

## Step 1 — Universal iframe Access Helper

Every script must start with this helper. It works in **both modes**:

```javascript
function getTicketContext() {
  // MODE A: Polaris/Dashboard — ticket is inside a shadow DOM macroponent
  const macro = Array.from(document.querySelectorAll('*'))
    .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
  
  if (macro && macro.shadowRoot) {
    const iframe = macro.shadowRoot.querySelector('#gsft_main');
    if (iframe && iframe.contentWindow) {
      return {
        win: iframe.contentWindow,
        doc: iframe.contentDocument,
        gForm: iframe.contentWindow.g_form,
        mode: 'polaris'
      };
    }
  }
  
  // MODE B: Classic New Tab — g_form is directly on window
  if (window.g_form) {
    return {
      win: window,
      doc: document,
      gForm: window.g_form,
      mode: 'classic'
    };
  }
  
  return null; // Not on a ticket page
}

// Usage at the start of any script:
const ctx = getTicketContext();
if (!ctx) { console.error('Not on a ticket page'); return; }
const { win, doc, gForm: gf } = ctx;
```

---

## Step 2 — Reading Field Values

### g_form API (preferred — works for all field types)

```javascript
// Get the stored sys_id value (for reference fields) or raw value
gf.getValue('assignment_group')       // → "72dfbf59dbd62c5850630ee1f396191e" (sys_id)
gf.getValue('state')                  // → "2" (integer code)
gf.getValue('short_description')      // → plain text string

// Get the human-readable display value
gf.getDisplayValue('assignment_group') // → "DTTL-GTS-Cyber-WP EMEA"
gf.getDisplayValue('state')            // → "Work in Progress"
gf.getDisplayValue('assigned_to')      // → "Jaume Rocarol Valls"

// Check field state
gf.isReadOnly('assignment_group')      // → true/false
gf.isEditableField('short_description')// → true/false
gf.isMandatory('assignment_group')     // → true/false
gf.isVisible('priority')              // → true/false

// Ticket metadata
gf.getTableName()   // → "sc_req_item"
gf.getUniqueValue() // → sys_id of current record
```

### Direct DOM element access (fallback / for direct manipulation)

Field elements use the pattern `tableName.fieldName`. The table name is always in the id:

```javascript
// Reference fields (assignment_group, assigned_to, business_service, etc.)
doc.getElementById('sc_req_item.assignment_group')          // hidden INPUT — stores sys_id
doc.getElementById('sys_display.sc_req_item.assignment_group') // search INPUT — stores display name

// Plain text fields
doc.getElementById('sc_req_item.short_description')  // INPUT type="text"

// Textarea fields
doc.getElementById('sc_req_item.description')   // TEXTAREA
doc.getElementById('sc_req_item.work_notes')    // TEXTAREA (hidden journal field)
doc.getElementById('sc_req_item.comments')      // TEXTAREA (hidden journal field)

// Choice/select fields
doc.getElementById('sc_req_item.priority')      // SELECT when editable
doc.getElementById('sys_readonly.sc_req_item.state') // SELECT when read-only

// Also available via g_form:
gf.getElement('assignment_group')  // returns the HIDDEN input (sys_id store)
gf.getDisplayBox('assignment_group') // returns the SEARCH input (display name)
```

### Field type map for this ticket

| Field | g_form type | DOM element type when editable |
|---|---|---|
| `assignment_group` | `reference` | hidden INPUT + search INPUT |
| `assigned_to` | `reference` | hidden INPUT + search INPUT |
| `business_service` | `reference` | hidden INPUT + search INPUT |
| `configuration_item` | `reference` | hidden INPUT + search INPUT |
| `short_description` | `string` | INPUT text |
| `description` | `string` | TEXTAREA |
| `work_notes` | `journal_input` | TEXTAREA + activity stream |
| `comments` | `journal_input` | TEXTAREA + activity stream |
| `priority` | `integer` | SELECT |
| `state` | `integer` | SELECT (editable) / sys_readonly SELECT |
| `due_date` | `glide_date_time` | INPUT text with class `datex` |
| `watch_list` | `glide_list` | SELECT multiple + text INPUT |

---

## Step 3 — Setting Field Values

### Method A: g_form.setValue (recommended for most fields)

```javascript
// Plain text fields
gf.setValue('short_description', 'new text');

// Choice/integer fields — pass the value code, not the label
gf.setValue('priority', '2');   // sets "2 - High"
gf.setValue('state', '2');      // sets "Work in Progress"

// Reference fields — pass sys_id as value, display name as second arg
gf.setValue('assignment_group', 'SYS_ID_HERE', 'Display Name Here');
gf.setValue('assigned_to', 'SYS_ID_HERE', 'Full Name Here');
// If you only have the display name and need the sys_id, use GlideAjax (see Step 5)
```

### Method B: Direct DOM + event trigger (for when g_form.setValue is blocked by read-only or triggers unwanted validation)

```javascript
// For plain text / textarea fields:
function setFieldValue(doc, fieldId, value) {
  const el = doc.getElementById(fieldId);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// For reference fields — set BOTH the hidden (sys_id) and display inputs:
function setReferenceField(doc, win, tableName, fieldName, sysId, displayName) {
  const hiddenId = `${tableName}.${fieldName}`;
  const displayId = `sys_display.${tableName}.${fieldName}`;
  const hiddenEl = doc.getElementById(hiddenId);
  const displayEl = doc.getElementById(displayId);
  
  if (hiddenEl) {
    hiddenEl.value = sysId;
    hiddenEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (displayEl) {
    displayEl.value = displayName;
    displayEl.dispatchEvent(new Event('change', { bubbles: true }));
    displayEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
```

---

## Step 4 — Setting Work Notes / Comments (Activity Stream)

This is the most complex case. There are **two parallel systems** — the hidden form textareas and the Angular activity stream. You must update both so the value persists on save.

### Single-textarea vs. dual-textarea mode

ServiceNow instances can be configured in two ways:

| Mode | What you see | Activity stream textarea ID |
|---|---|---|
| **Single (combined)** | One shared textarea for both work notes and comments | `activity-stream-textarea` |
| **Dual (split)** | Separate tabs/textareas for work notes and comments | `activity-stream-work_notes-textarea` / `activity-stream-comments-textarea` |

**Always write a two-candidate lookup** so your code works on both configurations:

```javascript
// For comments (public, customer-facing):
const textarea = doc.getElementById('activity-stream-comments-textarea') ||
                 doc.getElementById('activity-stream-textarea');

// For work notes (internal):
const textarea = doc.getElementById('activity-stream-work_notes-textarea') ||
                 doc.getElementById('activity-stream-textarea');
```

Prefer the split ID first — if the instance is in dual mode and you fall through to the combined ID, the field won't exist and you get `null`. If the instance is in single mode, the split ID won't exist and the fallback fires correctly.

```javascript
function setJournalField(doc, win, fieldName, text) {
  // fieldName is 'work_notes' or 'comments'
  
  // 1. Set on the hidden form textarea (used on form submit)
  const formTextarea = doc.getElementById(`sc_req_item.${fieldName}`);
  if (formTextarea) {
    formTextarea.value = text;
    formTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    formTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 2. Set on the Angular activity stream textarea (what user sees)
  //    work_notes → activity-stream-work_notes-textarea  (ng-model: activity_field_0.value)
  //    comments   → activity-stream-comments-textarea    (ng-model: activity_field_1.value)
  const streamId = `activity-stream-${fieldName}-textarea`;
  const streamTextarea = doc.getElementById(streamId);
  
  if (streamTextarea) {
    // Update the DOM value
    streamTextarea.value = text;
    
    // Update the Angular model through the scope
    const angular = win.angular;
    const scope = angular.element(streamTextarea).scope();
    
    // Walk the scope chain to find activity_field_0 / activity_field_1
    let targetScope = scope;
    const modelName = streamTextarea.getAttribute('ng-model'); // e.g. "activity_field_0.value"
    const fieldKey = modelName.split('.')[0]; // "activity_field_0" or "activity_field_1"
    
    while (targetScope) {
      if (fieldKey in targetScope) {
        targetScope[fieldKey].value = text;
        targetScope.$apply(); // Trigger Angular digest
        break;
      }
      targetScope = targetScope.$parent;
    }
    
    // Also fire DOM events so Angular ng-model sync catches it
    streamTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    streamTextarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Example usage:
setJournalField(doc, win, 'work_notes', 'Your work note text here');
setJournalField(doc, win, 'comments', 'Your comment text here');
```

**Angular field index mapping:**
- `activity_field_0` → `work_notes`
- `activity_field_1` → `comments`

---

## Step 5 — Looking Up sys_ids via GlideAjax

When you only have a display name (e.g. a group name) and need the sys_id for `setValue`:

```javascript
function lookupSysId(win, tableName, displayField, displayValue, callback) {
  const ga = new win.GlideAjax('ajaxClientHelper');
  ga.addParam('sysparm_name', 'getRecord');
  ga.addParam('sysparm_table', tableName);
  ga.addParam('sysparm_field', displayField);
  ga.addParam('sysparm_value', displayValue);
  ga.getXMLAnswer(function(answer) {
    callback(answer); // returns sys_id string
  });
}

// Example: look up assignment group sys_id by name
lookupSysId(win, 'sys_user_group', 'name', 'DTTL-GTS-Cyber-WP EMEA', function(sysId) {
  gf.setValue('assignment_group', sysId, 'DTTL-GTS-Cyber-WP EMEA');
});
```

---

## Step 6 — Saving / Submitting

```javascript
// Option A: g_form API
gf.save();    // Save and navigate back (equivalent to "Update" button)

// Option B: Click the Update button directly (more reliable, respects UI policies)
const updateBtn = doc.getElementById('sysverb_update');
if (updateBtn) updateBtn.click();

// Option C: Save and stay on the page
const saveStayBtn = doc.getElementById('sysverb_update_and_stay');
if (saveStayBtn) saveStayBtn.click();
```

---

## Step 7 — URL / Mode Detection

```javascript
function detectMode() {
  const url = window.location.href;
  
  if (url.includes('/now/nav/ui/classic/params/target/')) {
    return 'polaris'; // Opened from dashboard, ticket in shadow DOM iframe
  }
  if (url.match(/service-now\.com\/[a-z_]+\.do\?/)) {
    return 'classic'; // Opened in new tab, g_form directly on window
  }
  return 'unknown';
}
```

---

## Complete Boilerplate Template

```javascript
(function() {
  // ─── 1. Get ticket context (works in both polaris and classic mode) ───
  function getTicketContext() {
    const macro = Array.from(document.querySelectorAll('*'))
      .find(el => el.tagName.toLowerCase().startsWith('macroponent-'));
    if (macro && macro.shadowRoot) {
      const iframe = macro.shadowRoot.querySelector('#gsft_main');
      if (iframe && iframe.contentWindow && iframe.contentWindow.g_form) {
        return { win: iframe.contentWindow, doc: iframe.contentDocument, gForm: iframe.contentWindow.g_form };
      }
    }
    if (window.g_form) {
      return { win: window, doc: document, gForm: window.g_form };
    }
    return null;
  }

  const ctx = getTicketContext();
  if (!ctx) return console.error('[Script] Not on a ticket page or g_form not ready');
  const { win, doc, gForm: gf } = ctx;

  // ─── 2. Read fields ───
  const tableName = gf.getTableName();         // e.g. "sc_req_item"
  const sysId     = gf.getUniqueValue();       // record sys_id
  const group     = gf.getDisplayValue('assignment_group');
  const assignee  = gf.getDisplayValue('assigned_to');
  const state     = gf.getDisplayValue('state');

  // ─── 3. Write fields (example) ───
  // gf.setValue('short_description', 'New title');
  // gf.setValue('assignment_group', 'SYS_ID', 'Group Name');
  // setJournalField(doc, win, 'work_notes', 'Note text');

  // ─── 4. Save ───
  // doc.getElementById('sysverb_update').click();

  console.log(`[Script] Loaded on ${tableName} ${sysId} | Group: ${group} | Assignee: ${assignee} | State: ${state}`);
})();
```

---

## Key Differences: Polaris vs Classic New Tab

| | Polaris (Dashboard) | Classic (New Tab) |
|---|---|---|
| URL pattern | `/now/nav/ui/classic/params/target/...` | `/sc_req_item.do?sys_id=...` |
| `window.g_form` | ❌ undefined | ✅ direct access |
| `document.getElementById('gsft_main')` | ❌ null (in shadow DOM) | ✅ returns iframe |
| Access path | `macroponent-*.shadowRoot → #gsft_main → contentWindow.g_form` | `window.g_form` |
| Angular activity stream | ✅ present | ✅ present |
| `NOW.isPolarisEnabled` (inside iframe) | `"true"` | may vary |