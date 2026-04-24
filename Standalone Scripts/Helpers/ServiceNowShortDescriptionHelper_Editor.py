#!/usr/bin/env python3
"""
Short Description Helper — Team Config Editor
Requires: pip install PyQt5
Run:      python team_config_editor.py [optional_path.js]
"""
import re, os, copy, sys
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QCheckBox, QTableWidget,
    QTableWidgetItem, QHeaderView, QScrollArea, QFrame, QSplitter,
    QFileDialog, QMessageBox, QInputDialog, QSizePolicy, QAbstractItemView,
    QStatusBar
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QPalette, QColor, QFont

# ══════════════════════════════════════════════════════════════════════════════
#  THEME
# ══════════════════════════════════════════════════════════════════════════════
STYLE = """
QWidget {
    background: #1e1e2e;
    color: #e8e8f0;
    font-family: 'Segoe UI';
    font-size: 10pt;
}
QMainWindow, QSplitter {
    background: #1e1e2e;
}
QSplitter::handle { background: #44446a; width: 1px; }

/* ── Scroll ── */
QScrollArea { border: none; background: #1e1e2e; }
QScrollBar:vertical {
    background: #26263a; width: 12px; margin: 0;
}
QScrollBar::handle:vertical {
    background: #44446a; min-height: 24px; border-radius: 6px;
}
QScrollBar::handle:vertical:hover { background: #7c6af7; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }

/* ── Buttons ── */
QPushButton {
    background: #363652; color: #e8e8f0;
    border: none; border-radius: 5px;
    padding: 5px 12px;
}
QPushButton:hover  { background: #46466a; }
QPushButton:pressed { background: #2d2d4a; }
QPushButton#accent  { background: #7c6af7; }
QPushButton#accent:hover  { background: #6455e0; }
QPushButton#danger  { background: #e05555; }
QPushButton#danger:hover  { background: #c04040; }

/* ── Inputs ── */
QLineEdit {
    background: #252538; color: #e8e8f0;
    border: 1px solid #44446a; border-radius: 5px;
    padding: 4px 8px;
}
QLineEdit:focus { border-color: #7c6af7; }

/* ── Table ── */
QTableWidget {
    background: #26263a; color: #e8e8f0;
    gridline-color: #3a3a58;
    border: 1px solid #44446a; border-radius: 5px;
    selection-background-color: #3d3d60;
    selection-color: #ffffff;
}
QTableWidget::item { padding: 4px 8px; }
QTableWidget::item:selected { background: #3d3d60; }
QHeaderView::section {
    background: #2f2f48; color: #9090b0;
    border: none; border-bottom: 1px solid #44446a;
    padding: 5px 8px; font-weight: bold;
}
QTableCornerButton::section { background: #2f2f48; }

/* ── Checkboxes ── */
QCheckBox { spacing: 8px; }
QCheckBox::indicator {
    width: 16px; height: 16px;
    border: 1px solid #44446a; border-radius: 3px;
    background: #252538;
}
QCheckBox::indicator:checked {
    background: #7c6af7; border-color: #7c6af7;
    image: url('data:,');
}

/* ── Sidebar team buttons ── */
QPushButton#team_btn {
    background: transparent; color: #9090b0;
    border: none; border-radius: 0;
    text-align: left; padding: 9px 16px;
    font-size: 10pt;
}
QPushButton#team_btn:hover  { background: #2f2f48; color: #e8e8f0; }
QPushButton#team_btn[selected=true] {
    background: #3d3d60; color: #ffffff;
    border-left: 3px solid #7c6af7; padding-left: 13px;
}

/* ── Labels ── */
QLabel#section_title { font-size: 13pt; font-weight: bold; color: #e8e8f0; }
QLabel#field_label   { color: #9090b0; min-width: 130px; }
QLabel#hint          { color: #666688; font-size: 9pt; }
QLabel#top_path      { color: #9090b0; font-size: 9pt; }

/* ── Frames ── */
QFrame#separator { background: #3a3a58; max-height: 1px; }
QFrame#topbar    { background: #26263a; }
QFrame#sidebar   { background: #26263a; }
QFrame#statusbar_frame { background: #26263a; }

/* ── Status bar ── */
QStatusBar { background: #26263a; color: #9090b0; font-size: 9pt; }
"""


# ══════════════════════════════════════════════════════════════════════════════
#  JS PARSER / SERIALIZER  (unchanged from previous version)
# ══════════════════════════════════════════════════════════════════════════════
def _bal(text, oc, cc, start):
    d = 0
    for i in range(start, len(text)):
        if text[i] == oc:   d += 1
        elif text[i] == cc:
            d -= 1
            if d == 0: return text[start:i+1], i+1
    return None, start

def _str_arr(s):
    return [m.group(1) for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", s)]

def _mf_arr(s):
    out, pos = [], 0
    while pos < len(s):
        p = s.find('{', pos)
        if p == -1: break
        blk, end = _bal(s, '{', '}', p)
        if blk:
            l = re.search(r"label\s*:\s*'((?:[^'\\]|\\.)*)'", blk)
            v = re.search(r"value\s*:\s*'((?:[^'\\]|\\.)*)'", blk)
            if l and v: out.append({'label': l.group(1), 'value': v.group(1)})
        pos = end if end > pos else pos+1
    return out

def _arr(text, name):
    m = re.search(r'\b'+re.escape(name)+r'\s*:\s*\[', text)
    if not m: return None
    b = text.index('[', m.start())
    blk, _ = _bal(text, '[', ']', b)
    return blk[1:-1] if blk else None

def _pbool(text, name, default=True):
    m = re.search(r'\b'+re.escape(name)+r'\s*:\s*(true|false)', text)
    return (m.group(1) == 'true') if m else default

def _pstr(text, name):
    m = re.search(r'\b'+re.escape(name)+r"""\s*:\s*'((?:[^'\\]|\\.)*)'""", text)
    return m.group(1) if m else ''

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
            'key': key, 'name': _pstr(ti, 'name') or key,
            'mfOptions':         _mf_arr(_arr(ti, 'mfOptions') or ''),
            'productOptions':    _str_arr(_arr(ti, 'productOptions') or ''),
            'statusOptions':     _str_arr(_arr(ti, 'statusOptions') or ''),
            'typeOptions':       _str_arr(_arr(ti, 'typeOptions') or ''),
            'complexityOptions': _str_arr(_arr(ti, 'complexityOptions') or ''),
            'showVendor':        _pbool(ti, 'showVendor'),
            'showPER':           _pbool(ti, 'showPER'),
            'complexityNote':    _pstr(ti, 'complexityNote'),
        })
        pos = end
    return teams, cs, be

def _esc(s): return "'" + s.replace('\\','\\\\').replace("'","\\'") + "'"

def build_teams_block(teams):
    L = ['const TEAMS = {', '']
    for i, t in enumerate(teams):
        L += [f"    /// {t['name'].upper()} ///", '',
              f"    {t['key']}: {{", f"        name: {_esc(t['name'])},",
              '        mfOptions: [']
        for o in t['mfOptions']:
            L.append(f"            {{ label: {_esc(o['label'])}, value: {_esc(o['value'])} }},")
        L += ['        ],',
              f"        productOptions: [{', '.join(_esc(x) for x in t['productOptions'])}],",
              f"        statusOptions:  [{', '.join(_esc(x) for x in t['statusOptions'])}],",
              '        typeOptions: [']
        for x in t['typeOptions']:
            L.append(f'            {_esc(x)},')
        L += ['        ],',
              f"        complexityOptions: [{', '.join(_esc(x) for x in t['complexityOptions'])}],",
              f"        showVendor: {'true' if t['showVendor'] else 'false'},",
              f"        showPER:    {'true' if t['showPER'] else 'false'},",
              f"        complexityNote: {_esc(t['complexityNote'])}",
              '    },' if i < len(teams)-1 else '    }', '']
    L.append('};')
    return '\n'.join(L)

def splice_teams(original, teams, start, end):
    return original[:start] + build_teams_block(teams) + original[end:]


# ══════════════════════════════════════════════════════════════════════════════
#  REUSABLE LIST EDITOR WIDGET
# ══════════════════════════════════════════════════════════════════════════════
class ListEditor(QWidget):
    """
    A label + full-height QTableWidget + CRUD buttons.
    No internal scrollbar — grows to show all rows.
    """
    def __init__(self, title, columns, hint='', two_col=False, parent=None):
        super().__init__(parent)
        self._two_col = two_col   # True = MF editor (label+value), False = single string
        self._data    = []

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 8, 0, 4)
        root.setSpacing(4)

        # Header row
        hrow = QHBoxLayout()
        t = QLabel(title); t.setFont(QFont('Segoe UI', 10, QFont.Bold))
        hrow.addWidget(t)
        if hint:
            h = QLabel(hint); h.setObjectName('hint'); hrow.addWidget(h)
        hrow.addStretch()
        root.addLayout(hrow)

        # Table
        ncols = 2 if two_col else 1
        self._table = QTableWidget(0, ncols)
        self._table.setHorizontalHeaderLabels(columns)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.horizontalHeader().setStretchLastSection(True)
        if two_col:
            self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
            self._table.setColumnWidth(1, 110)
        self._table.setSizeAdjustPolicy(QTableWidget.AdjustToContents)
        self._table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Minimum)
        self._table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._table.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._table.itemDoubleClicked.connect(self._edit)
        root.addWidget(self._table)

        # Buttons
        brow = QHBoxLayout(); brow.setSpacing(6)
        specs = [
            ('＋  Add',    '#7c6af7', '#6455e0', self._add),
            ('✏  Edit',   '#363652', '#46466a', self._edit),
            ('✕  Delete', '#e05555', '#c04040', self._delete),
            ('↑',          '#363652', '#46466a', self._up),
            ('↓',          '#363652', '#46466a', self._down),
        ]
        for txt, bg, hbg, fn in specs:
            b = QPushButton(txt)
            b.setStyleSheet(
                f'QPushButton{{background:{bg};border-radius:5px;padding:4px 10px;}}'
                f'QPushButton:hover{{background:{hbg};}}'
            )
            b.clicked.connect(fn)
            brow.addWidget(b)
        brow.addStretch()
        root.addLayout(brow)

    # ── data ──────────────────────────────────────────────────────────────────
    def load(self, items):
        self._data = list(items)
        self._refresh()

    def get(self):
        return copy.deepcopy(self._data)

    def _refresh(self):
        self._table.setRowCount(len(self._data))
        for i, item in enumerate(self._data):
            if self._two_col:
                self._table.setItem(i, 0, QTableWidgetItem(item['label']))
                self._table.setItem(i, 1, QTableWidgetItem(item['value']))
            else:
                self._table.setItem(i, 0, QTableWidgetItem(item))
        self._table.resizeRowsToContents()
        # Make table exactly tall enough to show all rows without internal scroll
        hh = self._table.horizontalHeader().height()
        rh = sum(self._table.rowHeight(r) for r in range(self._table.rowCount()))
        self._table.setFixedHeight(hh + rh + 4)

    def _sel(self):
        rows = self._table.selectedItems()
        return self._table.currentRow() if rows else -1

    def _resel(self, idx):
        if 0 <= idx < len(self._data):
            self._table.selectRow(idx)

    # ── CRUD ──────────────────────────────────────────────────────────────────
    def _add(self):
        if self._two_col:
            label, ok = QInputDialog.getText(self, 'Add MF Option', 'Label (display text):')
            if not ok or not label.strip(): return
            value, ok = QInputDialog.getText(self, 'Add MF Option', f'Value (short code) for\n"{label}":')
            if not ok or not value.strip(): return
            self._data.append({'label': label.strip(), 'value': value.strip()})
        else:
            val, ok = QInputDialog.getText(self, 'Add Option', 'Value:')
            if not ok or not val.strip(): return
            self._data.append(val.strip())
        self._refresh()
        self._resel(len(self._data)-1)

    def _edit(self):
        idx = self._sel()
        if idx < 0: return
        if self._two_col:
            item = self._data[idx]
            label, ok = QInputDialog.getText(self, 'Edit MF Option', 'Label:', text=item['label'])
            if not ok or not label.strip(): return
            value, ok = QInputDialog.getText(self, 'Edit MF Option', 'Value:', text=item['value'])
            if not ok or not value.strip(): return
            self._data[idx] = {'label': label.strip(), 'value': value.strip()}
        else:
            val, ok = QInputDialog.getText(self, 'Edit Option', 'Value:', text=self._data[idx])
            if not ok or not val.strip(): return
            self._data[idx] = val.strip()
        self._refresh(); self._resel(idx)

    def _delete(self):
        idx = self._sel()
        if idx < 0: return
        name = self._data[idx]['label'] if self._two_col else self._data[idx]
        r = QMessageBox.question(self, 'Delete', f'Delete  "{name}" ?')
        if r == QMessageBox.Yes:
            self._data.pop(idx); self._refresh()
            self._resel(min(idx, len(self._data)-1))

    def _up(self):
        idx = self._sel()
        if idx <= 0: return
        self._data[idx-1], self._data[idx] = self._data[idx], self._data[idx-1]
        self._refresh(); self._resel(idx-1)

    def _down(self):
        idx = self._sel()
        if idx < 0 or idx >= len(self._data)-1: return
        self._data[idx], self._data[idx+1] = self._data[idx+1], self._data[idx]
        self._refresh(); self._resel(idx+1)


# ══════════════════════════════════════════════════════════════════════════════
#  TEAM EDITOR  (the scrollable content for one team)
# ══════════════════════════════════════════════════════════════════════════════
def _sep():
    f = QFrame(); f.setObjectName('separator')
    f.setFrameShape(QFrame.HLine)
    return f

def _section(title):
    l = QLabel(title); l.setObjectName('section_title')
    return l

class TeamEditor(QWidget):
    def __init__(self, team_data, on_name_change=None, parent=None):
        super().__init__(parent)
        self._on_name_change = on_name_change
        layout = QVBoxLayout(self)
        layout.setContentsMargins(28, 16, 28, 32)
        layout.setSpacing(0)

        def row(label_text, widget):
            f = QWidget(); h = QHBoxLayout(f)
            h.setContentsMargins(0,3,0,3); h.setSpacing(12)
            lbl = QLabel(label_text); lbl.setObjectName('field_label')
            h.addWidget(lbl); h.addWidget(widget, 1)
            return f

        # ── Identity ─────────────────────────────────────────────────────────
        layout.addWidget(_section('Team Identity'))
        layout.addSpacing(10)

        self._name = QLineEdit(team_data['name'])
        self._key  = QLineEdit(team_data['key'])
        self._key.setFont(QFont('Consolas', 10))
        layout.addWidget(row('Team Name',    self._name))
        krow = QWidget(); kh = QHBoxLayout(krow)
        kh.setContentsMargins(0,3,0,3); kh.setSpacing(12)
        kh.addWidget(QLabel('Internal Key'))
        kh.addWidget(self._key, 1)
        hint = QLabel('camelCase JS key'); hint.setObjectName('hint')
        kh.addWidget(hint)
        layout.addWidget(krow)
        self._name.textChanged.connect(lambda t: on_name_change and on_name_change(t))

        # ── MF Options ───────────────────────────────────────────────────────
        layout.addSpacing(8); layout.addWidget(_sep()); layout.addSpacing(4)
        self._mf = ListEditor('MF Options',
            ['Label (display text)', 'Value (code)'],
            hint='— display name → short code', two_col=True)
        self._mf.load(team_data['mfOptions'])
        layout.addWidget(self._mf)

        # ── Product ──────────────────────────────────────────────────────────
        layout.addWidget(_sep()); layout.addSpacing(4)
        self._prod = ListEditor('Product Options', ['Option'],
            hint='— e.g. DLP, SWG, CASB')
        self._prod.load(team_data['productOptions'])
        layout.addWidget(self._prod)

        # ── Status ───────────────────────────────────────────────────────────
        layout.addWidget(_sep()); layout.addSpacing(4)
        self._stat = ListEditor('Status Options', ['Option'],
            hint='— e.g. WIP, Waiting Requester')
        self._stat.load(team_data['statusOptions'])
        layout.addWidget(self._stat)

        # ── Type ─────────────────────────────────────────────────────────────
        layout.addWidget(_sep()); layout.addSpacing(4)
        self._type = ListEditor('Type Options', ['Option'],
            hint='— e.g. Access, Config, Policy')
        self._type.load(team_data['typeOptions'])
        layout.addWidget(self._type)

        # ── Complexity ───────────────────────────────────────────────────────
        layout.addWidget(_sep()); layout.addSpacing(4)
        self._comp = ListEditor('Complexity Options', ['Option'],
            hint='— typically N/A, 1, 2, 3')
        self._comp.load(team_data['complexityOptions'])
        layout.addWidget(self._comp)

        # ── Complexity Note ──────────────────────────────────────────────────
        layout.addWidget(_sep()); layout.addSpacing(4)
        layout.addWidget(_section('Complexity Note'))
        layout.addSpacing(6)
        self._note = QLineEdit(team_data['complexityNote'])
        layout.addWidget(self._note)

        # ── Optional fields ──────────────────────────────────────────────────
        layout.addSpacing(8); layout.addWidget(_sep()); layout.addSpacing(4)
        layout.addWidget(_section('Optional Fields'))
        layout.addSpacing(8)
        chk_row = QWidget(); ch = QHBoxLayout(chk_row)
        ch.setContentsMargins(0,0,0,0); ch.setSpacing(32)
        self._vendor = QCheckBox('Show  Vendor Case  field')
        self._per    = QCheckBox('Show  PER Number  field')
        self._vendor.setChecked(team_data['showVendor'])
        self._per.setChecked(team_data['showPER'])
        ch.addWidget(self._vendor); ch.addWidget(self._per); ch.addStretch()
        layout.addWidget(chk_row)
        layout.addStretch()

    def collect(self):
        return {
            'key':               self._key.text().strip(),
            'name':              self._name.text().strip(),
            'mfOptions':         self._mf.get(),
            'productOptions':    self._prod.get(),
            'statusOptions':     self._stat.get(),
            'typeOptions':       self._type.get(),
            'complexityOptions': self._comp.get(),
            'complexityNote':    self._note.text().strip(),
            'showVendor':        self._vendor.isChecked(),
            'showPER':           self._per.isChecked(),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  SIDEBAR BUTTON
# ══════════════════════════════════════════════════════════════════════════════
class TeamButton(QPushButton):
    def __init__(self, name, idx, on_click):
        super().__init__(name)
        self.setObjectName('team_btn')
        self.setCheckable(False)
        self._idx = idx
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
        self.setWindowTitle('Short Description Helper — Team Config Editor')
        self.resize(1200, 780)
        self.setMinimumSize(860, 540)

        self._js_path  = None
        self._js_src   = ''
        self._teams    = []
        self._blk_s    = None
        self._blk_e    = None
        self._sel      = None
        self._editor   = None
        self._team_btns = []

        self._build_ui()

    # ── UI ────────────────────────────────────────────────────────────────────
    def _build_ui(self):
        central = QWidget(); self.setCentralWidget(central)
        root = QVBoxLayout(central); root.setContentsMargins(0,0,0,0); root.setSpacing(0)

        # ── Top bar ───────────────────────────────────────────────────────────
        topbar = QFrame(); topbar.setObjectName('topbar'); topbar.setFixedHeight(52)
        tl = QHBoxLayout(topbar); tl.setContentsMargins(14,0,14,0); tl.setSpacing(12)
        open_btn = QPushButton('📂  Open .js File'); open_btn.setObjectName('accent')
        open_btn.clicked.connect(self._open)
        tl.addWidget(open_btn)
        self._path_lbl = QLabel('No file loaded — click Open to begin.')
        self._path_lbl.setObjectName('top_path')
        tl.addWidget(self._path_lbl, 1)
        root.addWidget(topbar)

        # ── Main split ────────────────────────────────────────────────────────
        split = QSplitter(Qt.Horizontal)
        split.setHandleWidth(1)
        root.addWidget(split, 1)

        # Sidebar
        sidebar = QFrame(); sidebar.setObjectName('sidebar')
        sidebar.setFixedWidth(210)
        sl = QVBoxLayout(sidebar); sl.setContentsMargins(0,0,0,0); sl.setSpacing(0)

        hdr = QWidget(); hl = QVBoxLayout(hdr); hl.setContentsMargins(14,14,14,6)
        t = QLabel('Teams'); t.setFont(QFont('Segoe UI', 13, QFont.Bold)); hl.addWidget(t)
        s = QLabel('Click a team to edit.'); s.setObjectName('hint'); hl.addWidget(s)
        sl.addWidget(hdr)

        # Team list (scrollable)
        self._team_scroll = QScrollArea()
        self._team_scroll.setWidgetResizable(True)
        self._team_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._team_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self._team_scroll.setFrameShape(QFrame.NoFrame)
        self._team_container = QWidget()
        self._team_layout = QVBoxLayout(self._team_container)
        self._team_layout.setContentsMargins(0,0,0,0); self._team_layout.setSpacing(0)
        self._team_layout.addStretch()
        self._team_scroll.setWidget(self._team_container)
        sl.addWidget(self._team_scroll, 1)

        # Sidebar action buttons
        sb_btns = QWidget(); bbl = QVBoxLayout(sb_btns)
        bbl.setContentsMargins(8,8,8,8); bbl.setSpacing(4)
        for txt, fn, obj in [
            ('＋  New Team',  self._new_team, 'accent'),
            ('⧉  Duplicate', self._dup_team, ''),
            ('✕  Delete',    self._del_team, 'danger'),
        ]:
            b = QPushButton(txt); b.setObjectName(obj); b.clicked.connect(fn)
            bbl.addWidget(b)
        sl.addWidget(sb_btns)
        split.addWidget(sidebar)

        # ── Content (QScrollArea — native, reliable scroll) ───────────────────
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self._scroll.setFrameShape(QFrame.NoFrame)

        self._placeholder = QLabel('Open a .js file, then select a team from the sidebar.')
        self._placeholder.setAlignment(Qt.AlignCenter)
        self._placeholder.setObjectName('hint')
        self._placeholder.setFont(QFont('Segoe UI', 13))
        self._scroll.setWidget(self._placeholder)
        split.addWidget(self._scroll)
        split.setStretchFactor(0, 0); split.setStretchFactor(1, 1)

        # ── Status bar ────────────────────────────────────────────────────────
        self._status = QStatusBar()
        self.setStatusBar(self._status)
        save_btn = QPushButton('💾  Save to File (Ctrl+S)')
        save_btn.setObjectName('accent')
        save_btn.clicked.connect(self._save)
        self._status.addPermanentWidget(save_btn)
        self._status.showMessage('Open a .js file to begin.')

        # Keyboard shortcut
        from PyQt5.QtWidgets import QShortcut
        from PyQt5.QtGui import QKeySequence
        QShortcut(QKeySequence('Ctrl+S'), self).activated.connect(self._save)

    # ── helpers ───────────────────────────────────────────────────────────────
    def _rebuild_sidebar(self):
        # Remove old buttons (but not the stretch at the end)
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

    # ── file ops ──────────────────────────────────────────────────────────────
    def _open(self, path=None):
        if not path:
            path, _ = QFileDialog.getOpenFileName(
                self, 'Select the Short Description Helper .js file',
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
                'Make sure you selected the correct userscript.')
            return
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

    # ── team management ───────────────────────────────────────────────────────
    def _select(self, idx):
        self._flush()
        self._sel = idx
        for b in self._team_btns: b.set_selected(b._idx == idx)
        self._editor = TeamEditor(
            self._teams[idx],
            on_name_change=lambda name, i=idx: self._on_name_change(i, name))
        self._scroll.setWidget(self._editor)

    def _on_name_change(self, idx, name):
        if idx < len(self._teams):
            self._teams[idx]['name'] = name
            if idx < len(self._team_btns):
                self._team_btns[idx].setText(name)

    def _new_team(self):
        if not self._js_path:
            QMessageBox.information(self, 'No File', 'Open a .js file first.'); return
        self._flush()
        name, ok = QInputDialog.getText(self, 'New Team', 'Team name:',
                                        text='New Team')
        if not ok or not name.strip(): return
        name = name.strip()
        parts = re.sub(r'[^a-zA-Z0-9 ]', '', name).split()
        key = (parts[0].lower()+''.join(p.capitalize() for p in parts[1:])+'Team') if parts else 'newTeam'
        existing = {t['key'] for t in self._teams}
        base, n = key, 2
        while key in existing: key = f'{base}{n}'; n += 1
        self._teams.append({
            'key': key, 'name': name,
            'mfOptions': [{'label':'N/A','value':'N/A'}],
            'productOptions': ['N/A','DLP','SWG','CASB'],
            'statusOptions':  ['N/A','Waiting Requester','WIP','Closed'],
            'typeOptions':    ['N/A','Access','Config','Policy'],
            'complexityOptions': ['N/A','1','2','3'],
            'complexityNote': '1 = Low, 2 = Medium, 3 = High',
            'showVendor': True, 'showPER': True,
        })
        self._rebuild_sidebar()
        self._select(len(self._teams)-1)
        self._status.showMessage(f'➕  Added team: {name}')

    def _dup_team(self):
        if self._sel is None: return
        self._flush()
        orig = copy.deepcopy(self._teams[self._sel])
        orig['name'] += ' (Copy)'
        base = orig['key']+'Copy'; existing = {t['key'] for t in self._teams}
        key, n = base, 2
        while key in existing: key = f'{base}{n}'; n += 1
        orig['key'] = key
        self._teams.append(orig)
        self._rebuild_sidebar()
        self._select(len(self._teams)-1)
        self._status.showMessage(f'⧉  Duplicated: {orig["name"]}')

    def _del_team(self):
        if self._sel is None:
            QMessageBox.information(self, 'Nothing selected', 'Select a team first.')
            return
        name = self._teams[self._sel]['name']
        r = QMessageBox.question(self, 'Delete Team',
            f'Delete  "{name}" ?\n\nThis cannot be undone.')
        if r != QMessageBox.Yes: return
        self._teams.pop(self._sel)
        self._editor = None; self._sel = None
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
