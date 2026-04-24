#!/usr/bin/env python3
"""
Ticket Response Helper — Team Config Editor
Requires: pip install PyQt5
Run:      python ticket_response_editor.py [optional_path.js]
"""
import re, os, copy, sys
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QPushButton, QLineEdit, QCheckBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QScrollArea, QFrame, QSplitter, QFileDialog, QMessageBox,
    QInputDialog, QSizePolicy, QAbstractItemView, QStatusBar, QDialog,
    QDialogButtonBox, QComboBox, QTextEdit, QTabWidget, QListWidget,
    QListWidgetItem, QShortcut
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QFont, QKeySequence, QColor

# ══════════════════════════════════════════════════════════════════════════════
#  STYLE
# ══════════════════════════════════════════════════════════════════════════════
STYLE = """
QWidget { background:#1e1e2e; color:#e8e8f0; font-family:'Segoe UI'; font-size:10pt; }
QMainWindow, QSplitter { background:#1e1e2e; }
QSplitter::handle { background:#44446a; width:1px; }
QTabWidget::pane { border:1px solid #44446a; background:#1e1e2e; }
QTabBar::tab {
    background:#26263a; color:#9090b0; padding:7px 18px;
    border:1px solid #44446a; border-bottom:none; border-radius:4px 4px 0 0;
}
QTabBar::tab:selected { background:#1e1e2e; color:#e8e8f0; border-bottom:1px solid #1e1e2e; }
QTabBar::tab:hover:!selected { background:#2f2f48; color:#e8e8f0; }
QScrollArea { border:none; background:#1e1e2e; }
QScrollBar:vertical { background:#26263a; width:12px; margin:0; }
QScrollBar::handle:vertical { background:#44446a; min-height:24px; border-radius:6px; }
QScrollBar::handle:vertical:hover { background:#7c6af7; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height:0; }
QScrollBar:horizontal { background:#26263a; height:12px; }
QScrollBar::handle:horizontal { background:#44446a; min-width:24px; border-radius:6px; }
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width:0; }
QPushButton {
    background:#363652; color:#e8e8f0; border:none;
    border-radius:5px; padding:5px 12px;
}
QPushButton:hover { background:#46466a; }
QPushButton:pressed { background:#2d2d4a; }
QPushButton#accent { background:#7c6af7; }
QPushButton#accent:hover { background:#6455e0; }
QPushButton#danger { background:#e05555; }
QPushButton#danger:hover { background:#c04040; }
QPushButton#team_btn {
    background:transparent; color:#9090b0; border:none; border-radius:0;
    text-align:left; padding:9px 16px; font-size:10pt;
}
QPushButton#team_btn:hover { background:#2f2f48; color:#e8e8f0; }
QPushButton#team_btn[selected=true] {
    background:#3d3d60; color:#ffffff;
    border-left:3px solid #7c6af7; padding-left:13px;
}
QLineEdit {
    background:#252538; color:#e8e8f0; border:1px solid #44446a;
    border-radius:5px; padding:4px 8px;
}
QLineEdit:focus { border-color:#7c6af7; }
QTextEdit {
    background:#252538; color:#e8e8f0; border:1px solid #44446a;
    border-radius:5px; padding:6px;
    font-family:'Consolas','Courier New',monospace; font-size:10pt;
}
QTextEdit:focus { border-color:#7c6af7; }
QComboBox {
    background:#252538; color:#e8e8f0; border:1px solid #44446a;
    border-radius:5px; padding:4px 8px; min-width:120px;
}
QComboBox:focus { border-color:#7c6af7; }
QComboBox::drop-down { border:none; width:22px; }
QComboBox QAbstractItemView {
    background:#252538; color:#e8e8f0; border:1px solid #44446a;
    selection-background-color:#3d3d60;
}
QTableWidget {
    background:#26263a; color:#e8e8f0; gridline-color:#3a3a58;
    border:1px solid #44446a; border-radius:5px;
    selection-background-color:#3d3d60; selection-color:#ffffff;
}
QTableWidget::item { padding:3px 6px; }
QHeaderView::section {
    background:#2f2f48; color:#9090b0; border:none;
    border-bottom:1px solid #44446a; padding:5px 6px; font-weight:bold;
}
QListWidget {
    background:#26263a; color:#e8e8f0; border:1px solid #44446a;
    border-radius:5px;
}
QListWidget::item { padding:5px 10px; }
QListWidget::item:selected { background:#3d3d60; color:#ffffff; }
QListWidget::item:hover:!selected { background:#2f2f48; }
QCheckBox { spacing:8px; }
QCheckBox::indicator { width:16px; height:16px; border:1px solid #44446a; border-radius:3px; background:#252538; }
QCheckBox::indicator:checked { background:#7c6af7; border-color:#7c6af7; }
QDialog { background:#1e1e2e; }
QDialogButtonBox QPushButton { min-width:80px; }
QFrame#separator { background:#3a3a58; max-height:1px; }
QFrame#topbar { background:#26263a; }
QFrame#sidebar { background:#26263a; }
QStatusBar { background:#26263a; color:#9090b0; font-size:9pt; }
QLabel#section_title { font-size:12pt; font-weight:bold; }
QLabel#field_label { color:#9090b0; }
QLabel#hint { color:#666688; font-size:9pt; }
QLabel#top_path { color:#9090b0; font-size:9pt; }
"""

CATEGORIES = ['first_contact','responses','reminders','closures','workcomments','other']
FIELD_TYPES = ['comments','work_notes']

# ══════════════════════════════════════════════════════════════════════════════
#  JS PARSER
# ══════════════════════════════════════════════════════════════════════════════
def _bal(text, oc, cc, start):
    d = 0
    for i in range(start, len(text)):
        if text[i] == oc:   d += 1
        elif text[i] == cc:
            d -= 1
            if d == 0: return text[start:i+1], i+1
    return None, start

def _pstr(text, name):
    m = re.search(r'\b'+re.escape(name)+r"""\s*:\s*'((?:[^'\\]|\\.)*)'""", text)
    return m.group(1) if m else ''

def _pbool(text, name, default=False):
    m = re.search(r'\b'+re.escape(name)+r'\s*:\s*(true|false)', text)
    return (m.group(1)=='true') if m else default

def _str_arr(text, name):
    m = re.search(r'\b'+re.escape(name)+r'\s*:\s*\[', text)
    if not m: return []
    b = text.index('[', m.start())
    blk, _ = _bal(text, '[', ']', b)
    if not blk: return []
    return [x.group(1) for x in re.finditer(r"'((?:[^'\\]|\\.)*)'", blk)]

def _template_literal(text, start):
    """Extract JS template literal content starting at the opening backtick."""
    assert text[start] == '`'
    i, depth, content = start+1, 0, []
    while i < len(text):
        ch = text[i]
        if depth == 0 and ch == '`':
            return ''.join(content), i+1
        elif ch == '\\' and i+1 < len(text):
            content += [ch, text[i+1]]; i += 2
        elif ch == '$' and i+1 < len(text) and text[i+1] == '{':
            depth += 1; content.append('${'); i += 2
        elif depth > 0 and ch == '{':
            depth += 1; content.append(ch); i += 1
        elif depth > 0 and ch == '}':
            depth -= 1; content.append(ch); i += 1
        else:
            content.append(ch); i += 1
    return ''.join(content), i

def _parse_response_metadata(text):
    m = re.search(r'\bresponseMetadata\s*:\s*\{', text)
    if not m: return {}
    brace = text.index('{', m.start())
    blk, _ = _bal(text, '{', '}', brace)
    if not blk: return {}
    inner, result, pos = blk[1:-1], {}, 0
    while pos < len(inner):
        km = re.search(r'\b([a-zA-Z_]\w*)\s*:\s*\{', inner[pos:])
        if not km: break
        key = km.group(1)
        ab = inner.index('{', pos + km.start())
        obj, end = _bal(inner, '{', '}', ab)
        if not obj: break
        o = obj[1:-1]
        pi = _pstr(o, 'parentItem') or None
        result[key] = {
            'label':      _pstr(o, 'label'),
            'category':   _pstr(o, 'category'),
            'fieldType':  _pstr(o, 'fieldType') or 'comments',
            'hasSubmenu': _pbool(o, 'hasSubmenu', False),
            'parentItem': pi,
        }
        pos = end
    return result

def _parse_responses(text):
    m = re.search(r'\bresponses\s*:\s*\{', text)
    if not m: return {}
    brace = text.index('{', m.start())
    blk, _ = _bal(text, '{', '}', brace)
    if not blk: return {}
    inner, result, pos = blk[1:-1], {}, 0
    while pos < len(inner):
        km = re.search(r'\b([a-zA-Z_]\w*)\s*:\s*\(vars\)\s*=>\s*`', inner[pos:])
        if not km: break
        key = km.group(1)
        bt = pos + km.end() - 1
        content, after = _template_literal(inner, bt)
        result[key] = content
        pos = after
    return result

def parse_teams(js):
    m = re.search(r'const\s+TEAMS\s*=\s*\{', js)
    if not m: return None, None, None
    cs = m.start()
    bp = js.index('{', m.start())
    outer, _ = _bal(js, '{', '}', bp)
    if not outer: return None, None, None
    re_ = bp + len(outer)
    semi = re.match(r'\s*;', js[re_:re_+10])
    be = re_ + (len(semi.group()) if semi else 0)
    inner, teams, pos = outer[1:-1], [], 0
    while pos < len(inner):
        km = re.search(r'\b([a-zA-Z_]\w*)\s*:\s*\{', inner[pos:])
        if not km: break
        key = km.group(1)
        ab = inner.index('{', pos + km.start())
        blk, end = _bal(inner, '{', '}', ab)
        if not blk: break
        ti = blk[1:-1]
        teams.append({
            'key':                key,
            'name':               _pstr(ti, 'name'),
            'defaultSectionOrder': _str_arr(ti, 'defaultSectionOrder'),
            'responseMetadata':   _parse_response_metadata(ti),
            'enabledResponses':   _str_arr(ti, 'enabledResponses'),
            'responses':          _parse_responses(ti),
        })
        pos = end
    return teams, cs, be

# ══════════════════════════════════════════════════════════════════════════════
#  JS SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════
def _esc(s): return "'" + s.replace('\\','\\\\').replace("'","\\'") + "'"

def build_teams_block(teams):
    L = ['const TEAMS = {', '']
    for ti, t in enumerate(teams):
        L += [f"    /// {t['name'].upper()} ///", '', f"    {t['key']}: {{",
              f"        name: {_esc(t['name'])},", '']
        # defaultSectionOrder
        L.append('        defaultSectionOrder: [')
        for s in t['defaultSectionOrder']: L.append(f'            {_esc(s)},')
        L += ['        ],', '']
        # responseMetadata
        L.append('        responseMetadata: {')
        meta = t['responseMetadata']
        mk = list(meta.keys())
        for i, key in enumerate(mk):
            mm = meta[key]
            L.append(f'            {key}: {{')
            L.append(f"                label: {_esc(mm['label'])},")
            L.append(f"                category: {_esc(mm['category'])},")
            if mm.get('hasSubmenu'): L.append('                hasSubmenu: true,')
            if mm.get('parentItem'): L.append(f"                parentItem: {_esc(mm['parentItem'])},")
            L.append(f"                fieldType: {_esc(mm['fieldType'])}")
            L.append('            }' + (',' if i < len(mk)-1 else ''))
        L += ['        },', '']
        # enabledResponses
        L.append('        enabledResponses: [')
        for r in t['enabledResponses']: L.append(f'            {_esc(r)},')
        L += ['        ],', '']
        # responses — use concat to avoid f-string interpreting ${}
        L.append('        responses: {')
        rk = list(t['responses'].keys())
        for i, key in enumerate(rk):
            body = t['responses'][key]
            comma = ',' if i < len(rk)-1 else ''
            L.append('                ' + key + ': (vars) => `' + body + '`' + comma)
        L.append('        }')
        L.append('    }' + (',' if ti < len(teams)-1 else ''))
        L.append('')
    L.append('};')
    return '\n'.join(L)

def splice_teams(original, teams, start, end):
    return original[:start] + build_teams_block(teams) + original[end:]

# ══════════════════════════════════════════════════════════════════════════════
#  RESPONSE EDIT DIALOG
# ══════════════════════════════════════════════════════════════════════════════
class ResponseDialog(QDialog):
    def __init__(self, key, meta, body, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f'Edit Response — {key}')
        self.resize(680, 580)
        self.setModal(True)
        self._key = key

        root = QVBoxLayout(self)
        root.setSpacing(10)
        root.setContentsMargins(20, 16, 20, 16)

        def field_row(label, widget):
            row = QHBoxLayout()
            lbl = QLabel(label); lbl.setObjectName('field_label')
            lbl.setFixedWidth(100)
            row.addWidget(lbl); row.addWidget(widget, 1)
            return row

        # Label
        self._label = QLineEdit(meta.get('label',''))
        root.addLayout(field_row('Label', self._label))

        # Category
        self._category = QComboBox()
        self._category.addItems(CATEGORIES)
        cat = meta.get('category','responses')
        if cat in CATEGORIES: self._category.setCurrentText(cat)
        root.addLayout(field_row('Category', self._category))

        # Field Type
        self._fieldtype = QComboBox()
        self._fieldtype.addItems(FIELD_TYPES)
        ft = meta.get('fieldType','comments')
        if ft in FIELD_TYPES: self._fieldtype.setCurrentText(ft)
        root.addLayout(field_row('Field Type', self._fieldtype))

        # Has Submenu
        self._has_submenu = QCheckBox('Has Submenu (parent item — no body needed)')
        self._has_submenu.setChecked(meta.get('hasSubmenu', False))
        root.addWidget(self._has_submenu)
        self._has_submenu.toggled.connect(self._on_submenu_toggle)

        # Parent Item
        self._parent_item = QLineEdit(meta.get('parentItem') or '')
        self._parent_item.setPlaceholderText('parentItem key (leave blank if top-level)')
        root.addLayout(field_row('Parent Item', self._parent_item))

        # Body
        body_lbl = QLabel('Response Body')
        body_lbl.setObjectName('section_title')
        root.addWidget(body_lbl)

        hint = QLabel('Use  ${vars.openedByName}  and  ${vars.pageType}  as template variables.')
        hint.setObjectName('hint')
        root.addWidget(hint)

        self._body = QTextEdit()
        self._body.setPlainText(body or '')
        self._body.setFont(QFont('Consolas', 10))
        self._body.setMinimumHeight(260)
        root.addWidget(self._body, 1)

        # Buttons
        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.button(QDialogButtonBox.Ok).setObjectName('accent')
        btns.accepted.connect(self.accept)
        btns.rejected.connect(self.reject)
        root.addWidget(btns)

        self._on_submenu_toggle(self._has_submenu.isChecked())

    def _on_submenu_toggle(self, checked):
        self._body.setEnabled(not checked)
        self._body.setStyleSheet('' if not checked else 'QTextEdit { color:#555; }')

    def result_data(self):
        return {
            'meta': {
                'label':      self._label.text().strip(),
                'category':   self._category.currentText(),
                'fieldType':  self._fieldtype.currentText(),
                'hasSubmenu': self._has_submenu.isChecked(),
                'parentItem': self._parent_item.text().strip() or None,
            },
            'body': self._body.toPlainText(),
        }

# ══════════════════════════════════════════════════════════════════════════════
#  TEAM EDITOR  (tabbed: Identity | Section Order | Responses)
# ══════════════════════════════════════════════════════════════════════════════
class TeamEditor(QWidget):
    def __init__(self, team_data, on_name_change=None, parent=None):
        super().__init__(parent)
        self._t = copy.deepcopy(team_data)
        self._on_name_change = on_name_change

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)

        tabs = QTabWidget()
        root.addWidget(tabs)

        tabs.addTab(self._build_identity_tab(), '  Identity  ')
        tabs.addTab(self._build_order_tab(),    '  Section Order  ')
        tabs.addTab(self._build_responses_tab(),'  Responses  ')

    # ── Identity ──────────────────────────────────────────────────────────────
    def _build_identity_tab(self):
        w = QWidget(); lay = QVBoxLayout(w)
        lay.setContentsMargins(24, 20, 24, 20); lay.setSpacing(10)

        lbl = QLabel('Team Identity'); lbl.setObjectName('section_title')
        lay.addWidget(lbl)

        def row(label, widget):
            f = QWidget(); h = QHBoxLayout(f)
            h.setContentsMargins(0,4,0,4); h.setSpacing(12)
            l = QLabel(label); l.setObjectName('field_label'); l.setFixedWidth(120)
            h.addWidget(l); h.addWidget(widget, 1)
            return f

        self._name = QLineEdit(self._t['name'])
        self._key  = QLineEdit(self._t['key'])
        self._key.setFont(QFont('Consolas', 10))
        lay.addWidget(row('Team Name',    self._name))
        lay.addWidget(row('Internal Key', self._key))
        self._name.textChanged.connect(lambda t: self._on_name_change and self._on_name_change(t))
        lay.addStretch()
        return w

    # ── Section Order ─────────────────────────────────────────────────────────
    def _build_order_tab(self):
        w = QWidget(); lay = QVBoxLayout(w)
        lay.setContentsMargins(24, 20, 24, 20); lay.setSpacing(8)

        lbl = QLabel('Default Section Order'); lbl.setObjectName('section_title')
        lay.addWidget(lbl)
        hint = QLabel('Drag or use ↑ ↓ to reorder. This controls which category sections appear in the dropdown menu and in what order.')
        hint.setObjectName('hint'); hint.setWordWrap(True)
        lay.addWidget(hint)

        self._order_list = QListWidget()
        self._order_list.setDragDropMode(QAbstractItemView.InternalMove)
        for s in self._t['defaultSectionOrder']:
            self._order_list.addItem(QListWidgetItem(s))
        lay.addWidget(self._order_list, 1)

        bf = QHBoxLayout()
        for txt, fn in [('↑', self._order_up), ('↓', self._order_down)]:
            b = QPushButton(txt); b.clicked.connect(fn); b.setFixedWidth(40)
            bf.addWidget(b)
        bf.addStretch()
        lay.addLayout(bf)
        return w

    def _order_up(self):
        r = self._order_list.currentRow()
        if r <= 0: return
        item = self._order_list.takeItem(r)
        self._order_list.insertItem(r-1, item)
        self._order_list.setCurrentRow(r-1)

    def _order_down(self):
        r = self._order_list.currentRow()
        if r < 0 or r >= self._order_list.count()-1: return
        item = self._order_list.takeItem(r)
        self._order_list.insertItem(r+1, item)
        self._order_list.setCurrentRow(r+1)

    # ── Responses ─────────────────────────────────────────────────────────────
    def _build_responses_tab(self):
        w = QWidget(); lay = QVBoxLayout(w)
        lay.setContentsMargins(12, 12, 12, 12); lay.setSpacing(6)

        hint = QLabel('Enabled column controls which responses appear in the menu. Row order sets the menu order within each category. Double-click any row to edit.')
        hint.setObjectName('hint'); hint.setWordWrap(True)
        lay.addWidget(hint)

        COLS = ['Enabled','Key','Label','Category','Field Type','Submenu','Parent','Body preview']
        self._resp_table = QTableWidget(0, len(COLS))
        self._resp_table.setHorizontalHeaderLabels(COLS)
        self._resp_table.verticalHeader().setVisible(False)
        self._resp_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._resp_table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._resp_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._resp_table.horizontalHeader().setStretchLastSection(True)
        self._resp_table.setColumnWidth(0, 64)   # Enabled
        self._resp_table.setColumnWidth(1, 130)  # Key
        self._resp_table.setColumnWidth(2, 170)  # Label
        self._resp_table.setColumnWidth(3, 110)  # Category
        self._resp_table.setColumnWidth(4, 90)   # FieldType
        self._resp_table.setColumnWidth(5, 70)   # Submenu
        self._resp_table.setColumnWidth(6, 100)  # Parent
        self._resp_table.itemDoubleClicked.connect(lambda _: self._edit_response())
        lay.addWidget(self._resp_table, 1)

        bf = QHBoxLayout(); bf.setSpacing(6)
        specs = [
            ('＋  Add',    '#7c6af7','#6455e0', self._add_response),
            ('✏  Edit',   '#363652','#46466a', self._edit_response),
            ('✕  Delete', '#e05555','#c04040', self._del_response),
            ('↑',          '#363652','#46466a', self._resp_up),
            ('↓',          '#363652','#46466a', self._resp_down),
        ]
        for txt, bg, hbg, fn in specs:
            b = QPushButton(txt)
            b.setStyleSheet(f'QPushButton{{background:{bg};border-radius:5px;padding:4px 10px;}}QPushButton:hover{{background:{hbg};}}')
            b.clicked.connect(fn); bf.addWidget(b)
        bf.addStretch()
        lay.addLayout(bf)

        self._populate_responses()
        return w

    def _populate_responses(self):
        t = self._t
        enabled_set = set(t['enabledResponses'])
        # Show enabled responses in order, then disabled ones
        ordered_keys = list(t['enabledResponses'])
        for k in t['responseMetadata']:
            if k not in enabled_set:
                ordered_keys.append(k)

        self._resp_table.setRowCount(len(ordered_keys))
        for row, key in enumerate(ordered_keys):
            meta = t['responseMetadata'].get(key, {})
            body = t['responses'].get(key, '')
            enabled = key in enabled_set

            chk = QCheckBox(); chk.setChecked(enabled)
            chk.setStyleSheet('margin-left:18px;')
            self._resp_table.setCellWidget(row, 0, chk)

            for col, val in enumerate([
                key,
                meta.get('label',''),
                meta.get('category',''),
                meta.get('fieldType',''),
                '✓' if meta.get('hasSubmenu') else '',
                meta.get('parentItem') or '',
                body[:60].replace('\n','↵') + ('…' if len(body)>60 else ''),
            ], start=1):
                item = QTableWidgetItem(val)
                item.setData(Qt.UserRole, key)
                self._resp_table.setItem(row, col, item)

        self._resp_table.resizeRowsToContents()

    def _current_key(self):
        row = self._resp_table.currentRow()
        if row < 0: return None
        item = self._resp_table.item(row, 1)
        return item.text() if item else None

    def _add_response(self):
        key, ok = QInputDialog.getText(self, 'New Response', 'Response key (camelCase JS identifier):')
        if not ok or not key.strip(): return
        key = key.strip()
        if key in self._t['responseMetadata']:
            QMessageBox.warning(self, 'Duplicate Key', f'Key "{key}" already exists.'); return
        meta = {'label': key, 'category': 'responses', 'fieldType': 'comments',
                'hasSubmenu': False, 'parentItem': None}
        dlg = ResponseDialog(key, meta, '', self)
        if dlg.exec_() != QDialog.Accepted: return
        data = dlg.result_data()
        self._t['responseMetadata'][key] = data['meta']
        self._t['responses'][key] = data['body']
        self._t['enabledResponses'].append(key)
        self._populate_responses()

    def _edit_response(self):
        key = self._current_key()
        if not key: return
        meta = self._t['responseMetadata'].get(key, {})
        body = self._t['responses'].get(key, '')
        dlg = ResponseDialog(key, meta, body, self)
        if dlg.exec_() != QDialog.Accepted: return
        data = dlg.result_data()
        self._t['responseMetadata'][key] = data['meta']
        if not data['meta']['hasSubmenu']:
            self._t['responses'][key] = data['body']
        self._populate_responses()

    def _del_response(self):
        key = self._current_key()
        if not key: return
        r = QMessageBox.question(self, 'Delete', f'Delete response "{key}" ?')
        if r != QMessageBox.Yes: return
        self._t['responseMetadata'].pop(key, None)
        self._t['responses'].pop(key, None)
        if key in self._t['enabledResponses']:
            self._t['enabledResponses'].remove(key)
        self._populate_responses()

    def _resp_up(self):
        row = self._resp_table.currentRow()
        if row <= 0: return
        self._swap_rows(row, row-1)
        self._resp_table.selectRow(row-1)

    def _resp_down(self):
        row = self._resp_table.currentRow()
        if row < 0 or row >= self._resp_table.rowCount()-1: return
        self._swap_rows(row, row+1)
        self._resp_table.selectRow(row+1)

    def _swap_rows(self, r1, r2):
        tbl = self._resp_table
        # Swap checkboxes
        chk1 = tbl.cellWidget(r1, 0); chk2 = tbl.cellWidget(r2, 0)
        v1 = chk1.isChecked() if chk1 else False
        v2 = chk2.isChecked() if chk2 else False
        # Swap text cells
        for col in range(1, tbl.columnCount()):
            i1 = tbl.takeItem(r1, col); i2 = tbl.takeItem(r2, col)
            tbl.setItem(r1, col, i2); tbl.setItem(r2, col, i1)
        # Re-create checkboxes
        for row, val in [(r1, v2), (r2, v1)]:
            chk = QCheckBox(); chk.setChecked(val)
            chk.setStyleSheet('margin-left:18px;')
            tbl.setCellWidget(row, 0, chk)

    # ── collect ───────────────────────────────────────────────────────────────
    def collect(self):
        t = copy.deepcopy(self._t)
        t['name'] = self._name.text().strip()
        t['key']  = self._key.text().strip()
        # Section order from list widget
        t['defaultSectionOrder'] = [
            self._order_list.item(i).text()
            for i in range(self._order_list.count())
        ]
        # enabledResponses = checked rows in table order
        enabled = []
        for row in range(self._resp_table.rowCount()):
            chk = self._resp_table.cellWidget(row, 0)
            key_item = self._resp_table.item(row, 1)
            if chk and chk.isChecked() and key_item:
                enabled.append(key_item.text())
        t['enabledResponses'] = enabled
        return t

# ══════════════════════════════════════════════════════════════════════════════
#  SIDEBAR BUTTON
# ══════════════════════════════════════════════════════════════════════════════
class TeamButton(QPushButton):
    def __init__(self, name, idx, on_click):
        super().__init__(name)
        self.setObjectName('team_btn'); self._idx = idx
        self.clicked.connect(lambda: on_click(idx))
        self.setCursor(Qt.PointingHandCursor)

    def set_selected(self, yes):
        self.setProperty('selected', 'true' if yes else 'false')
        self.style().unpolish(self); self.style().polish(self)

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN WINDOW
# ══════════════════════════════════════════════════════════════════════════════
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Ticket Response Helper — Team Config Editor')
        self.resize(1280, 820); self.setMinimumSize(900, 580)
        self._js_path = None; self._js_src = ''
        self._teams   = []; self._blk_s = None; self._blk_e = None
        self._sel     = None; self._editor = None; self._team_btns = []
        self._build_ui()

    def _build_ui(self):
        central = QWidget(); self.setCentralWidget(central)
        root = QVBoxLayout(central); root.setContentsMargins(0,0,0,0); root.setSpacing(0)

        # Top bar
        top = QFrame(); top.setObjectName('topbar'); top.setFixedHeight(52)
        tl = QHBoxLayout(top); tl.setContentsMargins(14,0,14,0); tl.setSpacing(12)
        ob = QPushButton('📂  Open .js File'); ob.setObjectName('accent')
        ob.clicked.connect(self._open)
        tl.addWidget(ob)
        self._path_lbl = QLabel('No file loaded — click Open to begin.')
        self._path_lbl.setObjectName('top_path')
        tl.addWidget(self._path_lbl, 1)
        root.addWidget(top)

        # Main split
        split = QSplitter(Qt.Horizontal); split.setHandleWidth(1)
        root.addWidget(split, 1)

        # Sidebar
        sb = QFrame(); sb.setObjectName('sidebar'); sb.setFixedWidth(215)
        sl = QVBoxLayout(sb); sl.setContentsMargins(0,0,0,0); sl.setSpacing(0)
        hdr = QWidget(); hl = QVBoxLayout(hdr); hl.setContentsMargins(14,14,14,6)
        t = QLabel('Teams'); t.setFont(QFont('Segoe UI',13,QFont.Bold)); hl.addWidget(t)
        s = QLabel('Click a team to edit.'); s.setObjectName('hint'); hl.addWidget(s)
        sl.addWidget(hdr)

        self._team_scroll = QScrollArea()
        self._team_scroll.setWidgetResizable(True)
        self._team_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._team_scroll.setFrameShape(QFrame.NoFrame)
        self._team_container = QWidget()
        self._team_layout = QVBoxLayout(self._team_container)
        self._team_layout.setContentsMargins(0,0,0,0); self._team_layout.setSpacing(0)
        self._team_layout.addStretch()
        self._team_scroll.setWidget(self._team_container)
        sl.addWidget(self._team_scroll, 1)

        sbf = QWidget(); bbl = QVBoxLayout(sbf)
        bbl.setContentsMargins(8,8,8,8); bbl.setSpacing(4)
        for txt, fn, obj in [
            ('＋  New Team',  self._new_team, 'accent'),
            ('⧉  Duplicate', self._dup_team, ''),
            ('✕  Delete',    self._del_team, 'danger'),
        ]:
            b = QPushButton(txt); b.setObjectName(obj); b.clicked.connect(fn)
            bbl.addWidget(b)
        sl.addWidget(sbf)
        split.addWidget(sb)

        # Content
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll.setFrameShape(QFrame.NoFrame)
        self._placeholder = QLabel('Open a .js file, then select a team from the sidebar.')
        self._placeholder.setAlignment(Qt.AlignCenter)
        self._placeholder.setObjectName('hint')
        self._placeholder.setFont(QFont('Segoe UI', 13))
        self._scroll.setWidget(self._placeholder)
        split.addWidget(self._scroll)
        split.setStretchFactor(0, 0); split.setStretchFactor(1, 1)

        # Status bar
        self._status = QStatusBar(); self.setStatusBar(self._status)
        save_btn = QPushButton('💾  Save to File (Ctrl+S)')
        save_btn.setObjectName('accent'); save_btn.clicked.connect(self._save)
        self._status.addPermanentWidget(save_btn)
        self._status.showMessage('Open a .js file to begin.')
        QShortcut(QKeySequence('Ctrl+S'), self).activated.connect(self._save)

    def _rebuild_sidebar(self):
        for b in self._team_btns: b.setParent(None)
        self._team_btns.clear()
        for i, t in enumerate(self._teams):
            b = TeamButton(t['name'], i, self._select)
            b.set_selected(i == self._sel)
            self._team_layout.insertWidget(i, b)
            self._team_btns.append(b)

    def _flush(self):
        if self._editor is not None and self._sel is not None:
            self._teams[self._sel] = self._editor.collect()

    def _open(self, path=None):
        if not path:
            path, _ = QFileDialog.getOpenFileName(
                self, 'Select the Ticket Response Helper .js file',
                '', 'JavaScript (*.js);;All files (*.*)')
        if not path: return
        try:
            with open(path, encoding='utf-8') as f: src = f.read()
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Could not read file:\n{e}'); return
        teams, start, end = parse_teams(src)
        if teams is None:
            QMessageBox.critical(self, 'Parse Error',
                'Could not find  const TEAMS = {...}  in this file.\n'
                'Make sure you selected the Ticket Response Helper userscript.'); return
        self._js_path = path; self._js_src = src
        self._teams = teams; self._blk_s = start; self._blk_e = end
        self._sel = None; self._editor = None
        fname = os.path.basename(path)
        n = len(teams)
        self._path_lbl.setText(f'{fname}   ({n} team{"s" if n!=1 else ""} found)')
        self._status.showMessage(f'✅  Loaded {fname}')
        self._rebuild_sidebar()
        if teams: self._select(0)
        else:
            self._placeholder.setText('No teams found — use "New Team" to create one.')
            self._scroll.setWidget(self._placeholder)

    def _save(self):
        if not self._js_path: return
        self._flush()
        if not self._teams:
            QMessageBox.warning(self, 'Nothing to save', 'No teams defined.'); return
        try:
            new_src = splice_teams(self._js_src, self._teams, self._blk_s, self._blk_e)
            with open(self._js_path, 'w', encoding='utf-8') as f: f.write(new_src)
            self._js_src = new_src
            _, s, e = parse_teams(new_src)
            if s is not None: self._blk_s, self._blk_e = s, e
            self._status.showMessage(f'💾  Saved → {os.path.basename(self._js_path)}')
        except Exception as e:
            QMessageBox.critical(self, 'Save Error', f'Could not save:\n{e}')

    def _select(self, idx):
        self._flush(); self._sel = idx
        for b in self._team_btns: b.set_selected(b._idx == idx)
        self._editor = TeamEditor(
            self._teams[idx],
            on_name_change=lambda name, i=idx: self._on_name_change(i, name))
        self._scroll.setWidget(self._editor)

    def _on_name_change(self, idx, name):
        if idx < len(self._teams):
            self._teams[idx]['name'] = name
            if idx < len(self._team_btns): self._team_btns[idx].setText(name)

    def _new_team(self):
        if not self._js_path:
            QMessageBox.information(self, 'No File', 'Open a .js file first.'); return
        self._flush()
        name, ok = QInputDialog.getText(self, 'New Team', 'Team name:', text='New Team')
        if not ok or not name.strip(): return
        name = name.strip()
        parts = re.sub(r'[^a-zA-Z0-9 ]','',name).split()
        key = (parts[0].lower()+''.join(p.capitalize() for p in parts[1:])+'Team') if parts else 'newTeam'
        existing = {t['key'] for t in self._teams}
        base, n = key, 2
        while key in existing: key=f'{base}{n}'; n+=1
        self._teams.append({
            'key': key, 'name': name,
            'defaultSectionOrder': ['first_contact','responses','reminders','closures','workcomments','other','custom'],
            'responseMetadata': {},
            'enabledResponses': [],
            'responses': {},
        })
        self._rebuild_sidebar(); self._select(len(self._teams)-1)
        self._status.showMessage(f'➕  Added team: {name}')

    def _dup_team(self):
        if self._sel is None: return
        self._flush()
        orig = copy.deepcopy(self._teams[self._sel])
        orig['name'] += ' (Copy)'
        base = orig['key']+'Copy'; existing = {t['key'] for t in self._teams}
        key, n = base, 2
        while key in existing: key=f'{base}{n}'; n+=1
        orig['key'] = key
        self._teams.append(orig); self._rebuild_sidebar()
        self._select(len(self._teams)-1)
        self._status.showMessage(f'⧉  Duplicated: {orig["name"]}')

    def _del_team(self):
        if self._sel is None:
            QMessageBox.information(self, 'Nothing selected', 'Select a team first.'); return
        name = self._teams[self._sel]['name']
        if QMessageBox.question(self,'Delete Team',f'Delete  "{name}" ?\n\nThis cannot be undone.') != QMessageBox.Yes: return
        self._teams.pop(self._sel); self._editor = None; self._sel = None
        self._rebuild_sidebar()
        if self._teams: self._select(0)
        else:
            self._placeholder.setText('No teams left — use "New Team" to add one.')
            self._scroll.setWidget(self._placeholder)
        self._status.showMessage(f'🗑  Deleted: {name}')

# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLE)
    win = MainWindow()
    win.show()
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        win._open(sys.argv[1])
    sys.exit(app.exec_())
