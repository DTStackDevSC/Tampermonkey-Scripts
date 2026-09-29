#!/usr/bin/env python3
"""
Real-time Protection Policy Naming Helper — Config Editor
Requires: pip install PyQt5
Run:      python policy_naming_editor.py [optional_path.js]
"""
import re, os, copy, sys
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QTableWidget, QTableWidgetItem,
    QHeaderView, QScrollArea, QFrame, QFileDialog, QMessageBox,
    QInputDialog, QSizePolicy, QAbstractItemView, QStatusBar, QDialog,
    QDialogButtonBox, QShortcut, QTabWidget
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont, QKeySequence

# ══════════════════════════════════════════════════════════════════════════════
#  STYLE
# ══════════════════════════════════════════════════════════════════════════════
STYLE = """
QWidget { background:#1e1e2e; color:#e8e8f0; font-family:'Segoe UI'; font-size:10pt; }
QMainWindow { background:#1e1e2e; }
QTabWidget::pane { border:1px solid #44446a; background:#1e1e2e; }
QTabBar::tab {
    background:#26263a; color:#9090b0; padding:8px 20px;
    border:1px solid #44446a; border-bottom:none;
    border-radius:4px 4px 0 0; min-width:130px;
}
QTabBar::tab:selected { background:#1e1e2e; color:#e8e8f0; border-bottom:1px solid #1e1e2e; }
QTabBar::tab:hover:!selected { background:#2f2f48; color:#e8e8f0; }
QScrollArea { border:none; background:#1e1e2e; }
QScrollBar:vertical { background:#26263a; width:14px; margin:0; }
QScrollBar::handle:vertical { background:#44446a; min-height:30px; border-radius:7px; margin:2px; }
QScrollBar::handle:vertical:hover { background:#7c6af7; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height:0; }
QPushButton {
    background:#363652; color:#e8e8f0; border:none;
    border-radius:5px; padding:5px 14px;
}
QPushButton:hover { background:#46466a; }
QPushButton:pressed { background:#2d2d4a; }
QPushButton#accent { background:#7c6af7; }
QPushButton#accent:hover { background:#6455e0; }
QPushButton#danger { background:#e05555; }
QPushButton#danger:hover { background:#c04040; }
QLineEdit {
    background:#252538; color:#e8e8f0; border:1px solid #44446a;
    border-radius:5px; padding:5px 9px;
}
QLineEdit:focus { border-color:#7c6af7; }
QTableWidget {
    background:#26263a; color:#e8e8f0; gridline-color:#3a3a58;
    border:1px solid #44446a; border-radius:5px;
    selection-background-color:#3d3d60; selection-color:#ffffff;
}
QTableWidget::item { padding:5px 8px; }
QHeaderView::section {
    background:#2f2f48; color:#9090b0; border:none;
    border-bottom:1px solid #44446a; padding:7px 8px; font-weight:bold;
}
QDialog { background:#1e1e2e; }
QDialogButtonBox QPushButton { min-width:80px; }
QFrame#topbar { background:#26263a; }
QFrame#divider { background:#3a3a58; max-height:1px; }
QStatusBar { background:#26263a; color:#9090b0; font-size:9pt; }
QLabel#section_title { font-size:12pt; font-weight:bold; color:#c0b0ff; }
QLabel#hint { color:#666688; font-size:9pt; }
QLabel#top_path { color:#9090b0; font-size:9pt; }
"""

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

def _find_const(js, name):
    m = re.search(r'\bconst\s+' + re.escape(name) + r'\s*=\s*[\[\{]', js)
    if not m: return None, None, None
    cs = m.start(); opener = js[m.end()-1]
    closer = ']' if opener == '[' else '}'
    blk, end = _bal(js, opener, closer, m.end()-1)
    if not blk: return None, None, None
    semi = re.match(r'\s*;', js[end:end+10])
    be = end + (len(semi.group()) if semi else 0)
    return cs, blk, be

def parse_code_label_arr(js, name):
    cs, blk, be = _find_const(js, name)
    if blk is None: return [], None, None
    items, pos, inner = [], 0, blk[1:-1]
    while pos < len(inner):
        p = inner.find('{', pos)
        if p == -1: break
        obj, end = _bal(inner, '{', '}', p)
        if not obj: break
        cm = re.search(r"\bcode\s*:\s*'((?:[^'\\]|\\.)*)'", obj)
        lm = re.search(r"\blabel\s*:\s*'((?:[^'\\]|\\.)*)'", obj)
        if cm and lm: items.append({'code': cm.group(1), 'label': lm.group(1)})
        pos = end
    return items, cs, be

def parse_string_arr(js, name):
    cs, blk, be = _find_const(js, name)
    if blk is None: return [], None, None
    return [m.group(1) for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", blk)], cs, be

def parse_all(js):
    data = {}
    for key in ['MEMBER_FIRMS','GEO_GROUPS','GEOS','APPLIES_TO','POLICY_CHANNEL_TYPES','DLP_CRITERIA']:
        items, cs, be = parse_code_label_arr(js, key)
        data[key] = {'items': items, 'start': cs, 'end': be}
    for key in ['POLICY_TYPES','DLP_POLICY_TYPES']:
        items, cs, be = parse_string_arr(js, key)
        data[key] = {'items': items, 'start': cs, 'end': be}
    return data

# ══════════════════════════════════════════════════════════════════════════════
#  JS SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════
def _esc(s): return "'" + s.replace('\\','\\\\').replace("'","\\'") + "'"

def build_code_label_arr(name, items):
    L = [f'const {name} = [']
    for i, it in enumerate(items):
        comma = ',' if i < len(items)-1 else ''
        L.append(f"    {{ code: {_esc(it['code'])}, label: {_esc(it['label'])} }}{comma}")
    L.append('];')
    return '\n'.join(L)

def build_string_arr(name, items):
    return f'const {name} = [{", ".join(_esc(x) for x in items)}];'

def apply_changes(original, data):
    CODE_LABEL = ['MEMBER_FIRMS','GEO_GROUPS','GEOS','APPLIES_TO','POLICY_CHANNEL_TYPES','DLP_CRITERIA']
    keys = [k for k in data if data[k]['start'] is not None]
    keys.sort(key=lambda k: data[k]['start'], reverse=True)
    result = original
    for k in keys:
        d = data[k]
        block = build_code_label_arr(k, d['items']) if k in CODE_LABEL else build_string_arr(k, d['items'])
        result = result[:d['start']] + block + result[d['end']:]
    return result

# ══════════════════════════════════════════════════════════════════════════════
#  CODE+LABEL ITEM DIALOG
# ══════════════════════════════════════════════════════════════════════════════
class CodeLabelDialog(QDialog):
    def __init__(self, parent, code='', label='', title='Edit Entry'):
        super().__init__(parent)
        self.setWindowTitle(title); self.setModal(True); self.resize(420, 150)
        root = QVBoxLayout(self); root.setSpacing(10); root.setContentsMargins(18,16,18,16)

        def row(ltext, widget):
            f = QWidget(); h = QHBoxLayout(f)
            h.setContentsMargins(0,0,0,0); h.setSpacing(10)
            l = QLabel(ltext); l.setFixedWidth(60); l.setStyleSheet('color:#9090b0;')
            h.addWidget(l); h.addWidget(widget, 1); return f

        self._code  = QLineEdit(code)
        self._label = QLineEdit(label)
        root.addWidget(row('Code',  self._code))
        root.addWidget(row('Label', self._label))
        hint = QLabel('Code = short token in policy name (e.g. "ES").  Label = dropdown text.')
        hint.setObjectName('hint'); hint.setWordWrap(True); root.addWidget(hint)
        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.button(QDialogButtonBox.Ok).setObjectName('accent')
        btns.accepted.connect(self._ok); btns.rejected.connect(self.reject)
        root.addWidget(btns); self._code.setFocus()

    def _ok(self):
        if not self._code.text().strip():
            QMessageBox.warning(self,'Required','Code cannot be empty.'); return
        if not self._label.text().strip():
            QMessageBox.warning(self,'Required','Label cannot be empty.'); return
        self.accept()

    def values(self):
        return {'code': self._code.text().strip(), 'label': self._label.text().strip()}

# ══════════════════════════════════════════════════════════════════════════════
#  BASE LIST EDITOR  — no internal scrollbar, table grows to show all rows
# ══════════════════════════════════════════════════════════════════════════════
ROW_H = 32   # px per data row

class _BaseEditor(QWidget):
    def __init__(self, title, hint, ncols, col_setup, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self); lay.setContentsMargins(0,0,0,4); lay.setSpacing(4)

        # Section header
        hdr = QHBoxLayout()
        t = QLabel(title); t.setObjectName('section_title'); hdr.addWidget(t)
        hdr.addStretch(); lay.addLayout(hdr)

        if hint:
            h = QLabel(hint); h.setObjectName('hint'); h.setWordWrap(True)
            lay.addWidget(h)

        # Table — no scrollbars, grows to fit content
        self._table = QTableWidget(0, ncols)
        self._table.verticalHeader().setVisible(False)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SingleSelection)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._table.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self._table.setFocusPolicy(Qt.StrongFocus)
        self._table.verticalHeader().setDefaultSectionSize(ROW_H)
        col_setup(self._table)
        self._table.itemDoubleClicked.connect(lambda _: self._edit())
        lay.addWidget(self._table)

        # Buttons
        bf = QHBoxLayout(); bf.setSpacing(6)
        for txt, fn, bg, hbg in [
            ('＋  Add',    self._add,    '#7c6af7','#6455e0'),
            ('✏  Edit',   self._edit,   '#363652','#46466a'),
            ('✕  Delete', self._delete, '#e05555','#c04040'),
            ('↑',          self._up,     '#363652','#46466a'),
            ('↓',          self._down,   '#363652','#46466a'),
        ]:
            b = QPushButton(txt)
            b.setStyleSheet(f'QPushButton{{background:{bg};border-radius:5px;padding:4px 12px;}}'
                            f'QPushButton:hover{{background:{hbg};}}')
            b.clicked.connect(fn); bf.addWidget(b)
        bf.addStretch(); lay.addLayout(bf)

    def _fit_table(self):
        """Resize table height to exactly fit all rows — no internal scroll."""
        header_h = self._table.horizontalHeader().height()
        rows_h   = ROW_H * self._table.rowCount()
        self._table.setFixedHeight(header_h + rows_h + 2)

    def _sel(self): return self._table.currentRow()

    def _resel(self, idx):
        if 0 <= idx < self._table.rowCount():
            self._table.selectRow(idx)

    def _up(self):
        idx = self._sel()
        if idx <= 0: return
        self._swap(idx-1, idx); self._resel(idx-1)

    def _down(self):
        idx = self._sel()
        if idx < 0 or idx >= self._table.rowCount()-1: return
        self._swap(idx, idx+1); self._resel(idx+1)

    def _swap(self, a, b):
        for col in range(self._table.columnCount()):
            ia = self._table.takeItem(a, col); ib = self._table.takeItem(b, col)
            self._table.setItem(a, col, ib);  self._table.setItem(b, col, ia)

    # Subclasses implement:
    def _refresh(self): raise NotImplementedError
    def _add(self):     raise NotImplementedError
    def _edit(self):    raise NotImplementedError
    def _delete(self):  raise NotImplementedError
    def get(self):      raise NotImplementedError


class CodeLabelEditor(_BaseEditor):
    def __init__(self, title, hint, items, parent=None):
        def setup(tbl):
            tbl.setHorizontalHeaderLabels(['Code', 'Label'])
            tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
            tbl.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        super().__init__(title, hint, 2, setup, parent)
        self._items = list(items); self._refresh()

    def _refresh(self):
        self._table.setRowCount(len(self._items))
        for i, it in enumerate(self._items):
            self._table.setItem(i, 0, QTableWidgetItem(it['code']))
            self._table.setItem(i, 1, QTableWidgetItem(it['label']))
        self._fit_table()

    def _add(self):
        d = CodeLabelDialog(self, title='Add Entry')
        if d.exec_() != QDialog.Accepted: return
        self._items.append(d.values()); self._refresh(); self._resel(len(self._items)-1)

    def _edit(self):
        idx = self._sel()
        if idx < 0: return
        it = self._items[idx]
        d = CodeLabelDialog(self, code=it['code'], label=it['label'], title='Edit Entry')
        if d.exec_() != QDialog.Accepted: return
        self._items[idx] = d.values(); self._refresh(); self._resel(idx)

    def _delete(self):
        idx = self._sel()
        if idx < 0: return
        name = self._items[idx]['code']
        if QMessageBox.question(self,'Delete',f'Delete  "{name}" ?') == QMessageBox.Yes:
            self._items.pop(idx); self._refresh()
            self._resel(min(idx, len(self._items)-1))

    def _swap(self, a, b):
        self._items[a], self._items[b] = self._items[b], self._items[a]
        self._refresh()

    def get(self): return copy.deepcopy(self._items)


class StringListEditor(_BaseEditor):
    def __init__(self, title, hint, items, parent=None):
        def setup(tbl):
            tbl.setHorizontalHeaderLabels(['Value'])
            tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        super().__init__(title, hint, 1, setup, parent)
        self._items = list(items); self._refresh()

    def _refresh(self):
        self._table.setRowCount(len(self._items))
        for i, v in enumerate(self._items):
            self._table.setItem(i, 0, QTableWidgetItem(v))
        self._fit_table()

    def _add(self):
        v, ok = QInputDialog.getText(self,'Add Value','Value:')
        if not ok or not v.strip(): return
        self._items.append(v.strip()); self._refresh(); self._resel(len(self._items)-1)

    def _edit(self):
        idx = self._sel()
        if idx < 0: return
        v, ok = QInputDialog.getText(self,'Edit Value','Value:', text=self._items[idx])
        if not ok or not v.strip(): return
        self._items[idx] = v.strip(); self._refresh(); self._resel(idx)

    def _delete(self):
        idx = self._sel()
        if idx < 0: return
        if QMessageBox.question(self,'Delete',f'Delete  "{self._items[idx]}" ?') == QMessageBox.Yes:
            self._items.pop(idx); self._refresh()
            self._resel(min(idx, len(self._items)-1))

    def _swap(self, a, b):
        self._items[a], self._items[b] = self._items[b], self._items[a]
        self._refresh()

    def get(self): return list(self._items)

# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def _divider():
    f = QFrame(); f.setObjectName('divider'); f.setFrameShape(QFrame.HLine)
    return f

def _scroll_tab(build_fn):
    """Wrap a build function's content in a QScrollArea (one scroll per tab)."""
    inner = QWidget()
    lay   = QVBoxLayout(inner); lay.setContentsMargins(24, 20, 24, 24); lay.setSpacing(14)
    build_fn(lay)
    lay.addStretch()

    scroll = QScrollArea()
    scroll.setWidget(inner)
    scroll.setWidgetResizable(True)
    scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
    scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
    scroll.setFrameShape(QFrame.NoFrame)
    return scroll

# ══════════════════════════════════════════════════════════════════════════════
#  EDITOR PAGE  — three tabs, each a single scroll area
# ══════════════════════════════════════════════════════════════════════════════
class EditorPage(QWidget):
    def __init__(self, data, parent=None):
        super().__init__(parent)
        self._data = data
        tabs = QTabWidget()
        root = QVBoxLayout(self); root.setContentsMargins(0,0,0,0)
        root.addWidget(tabs)

        # ── Tab 1: Geography ─────────────────────────────────────────────────
        def build_geo(lay):
            self._mf = CodeLabelEditor(
                'Member Firms',
                'Code → token inserted into the policy name.  Label → dropdown display text.',
                data['MEMBER_FIRMS']['items'])
            lay.addWidget(self._mf)
            lay.addWidget(_divider())
            self._gg = CodeLabelEditor(
                'Geo Groups',
                'Regional groupings (e.g. DCM, Nordics).',
                data['GEO_GROUPS']['items'])
            lay.addWidget(self._gg)
            lay.addWidget(_divider())
            self._geo = CodeLabelEditor(
                'Geos',
                'Individual country / region codes (e.g. ES, FR, DE).',
                data['GEOS']['items'])
            lay.addWidget(self._geo)

        tabs.addTab(_scroll_tab(build_geo), '  Geography  ')

        # ── Tab 2: Policy Types ───────────────────────────────────────────────
        def build_pt(lay):
            self._pt = StringListEditor(
                'CASB / Web Policy Types',
                'Plain strings used in the CASB/Web tab. Selected value is inserted directly into the policy name.',
                data['POLICY_TYPES']['items'])
            lay.addWidget(self._pt)
            lay.addWidget(_divider())
            self._dlp_pt = StringListEditor(
                'DLP Policy Types',
                'Plain strings used in the DLP tab.',
                data['DLP_POLICY_TYPES']['items'])
            lay.addWidget(self._dlp_pt)

        tabs.addTab(_scroll_tab(build_pt), '  Policy Types  ')

        # ── Tab 3: DLP Options ────────────────────────────────────────────────
        def build_dlp(lay):
            self._at = CodeLabelEditor(
                'Applies To',
                'Scope of the DLP policy (e.g. FW = Firm Wide, UG = User Group).',
                data['APPLIES_TO']['items'])
            lay.addWidget(self._at)
            lay.addWidget(_divider())
            self._pct = CodeLabelEditor(
                'Policy Channel Types',
                'Channel the DLP policy targets (e.g. W = Web, E = Email, D = Endpoint).',
                data['POLICY_CHANNEL_TYPES']['items'])
            lay.addWidget(self._pct)
            lay.addWidget(_divider())
            self._crit = CodeLabelEditor(
                'DLP Criteria',
                'Criteria checkboxes in the DLP form. Code is joined with _ in the policy name; Label is the checkbox text.',
                data['DLP_CRITERIA']['items'])
            lay.addWidget(self._crit)

        tabs.addTab(_scroll_tab(build_dlp), '  DLP Options  ')

    def collect(self):
        d = copy.deepcopy(self._data)
        d['MEMBER_FIRMS']['items']         = self._mf.get()
        d['GEO_GROUPS']['items']           = self._gg.get()
        d['GEOS']['items']                 = self._geo.get()
        d['POLICY_TYPES']['items']         = self._pt.get()
        d['DLP_POLICY_TYPES']['items']     = self._dlp_pt.get()
        d['APPLIES_TO']['items']           = self._at.get()
        d['POLICY_CHANNEL_TYPES']['items'] = self._pct.get()
        d['DLP_CRITERIA']['items']         = self._crit.get()
        return d

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN WINDOW
# ══════════════════════════════════════════════════════════════════════════════
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('Policy Naming Helper — Config Editor')
        self.resize(1000, 820); self.setMinimumSize(800, 600)
        self._js_path = None; self._js_src = ''
        self._data    = None; self._editor = None
        self._build_ui()

    def _build_ui(self):
        central = QWidget(); self.setCentralWidget(central)
        root = QVBoxLayout(central); root.setContentsMargins(0,0,0,0); root.setSpacing(0)

        # Top bar
        top = QFrame(); top.setObjectName('topbar'); top.setFixedHeight(52)
        tl = QHBoxLayout(top); tl.setContentsMargins(14,0,14,0); tl.setSpacing(12)
        ob = QPushButton('📂  Open .js File'); ob.setObjectName('accent')
        ob.clicked.connect(self._open); tl.addWidget(ob)
        self._path_lbl = QLabel('No file loaded — click Open to begin.')
        self._path_lbl.setObjectName('top_path')
        tl.addWidget(self._path_lbl, 1)
        root.addWidget(top)

        # Content area
        self._content = QWidget()
        self._content_lay = QVBoxLayout(self._content)
        self._content_lay.setContentsMargins(0,0,0,0)
        self._placeholder = QLabel('Open the Policy Naming Helper .js file to begin editing.')
        self._placeholder.setAlignment(Qt.AlignCenter)
        self._placeholder.setObjectName('hint')
        self._placeholder.setFont(QFont('Segoe UI', 13))
        self._content_lay.addWidget(self._placeholder)
        root.addWidget(self._content, 1)

        # Status bar
        self._status = QStatusBar(); self.setStatusBar(self._status)
        save_btn = QPushButton('💾  Save to File (Ctrl+S)')
        save_btn.setObjectName('accent'); save_btn.clicked.connect(self._save)
        self._status.addPermanentWidget(save_btn)
        self._status.showMessage('Open a .js file to begin.')
        QShortcut(QKeySequence('Ctrl+S'), self).activated.connect(self._save)

    def _set_content(self, widget):
        lay = self._content_lay
        while lay.count():
            item = lay.takeAt(0)
            if item.widget(): item.widget().hide()
        lay.addWidget(widget); widget.show()

    def _open(self, path=None):
        if not path:
            path, _ = QFileDialog.getOpenFileName(
                self, 'Select the Policy Naming Helper .js file',
                '', 'JavaScript (*.js);;All files (*.*)')
        if not path: return
        try:
            with open(path, encoding='utf-8') as f: src = f.read()
        except Exception as e:
            QMessageBox.critical(self,'Error',f'Could not read file:\n{e}'); return

        data  = parse_all(src)
        found = [k for k in data if data[k]['start'] is not None]
        if not found:
            QMessageBox.critical(self,'Parse Error',
                'Could not find any known configuration arrays in this file.\n'
                'Make sure you selected the correct userscript.'); return

        self._js_path = path; self._js_src = src; self._data = data
        self._path_lbl.setText(f'{os.path.basename(path)}   ({len(found)} arrays found)')
        self._status.showMessage(f'✅  Loaded {os.path.basename(path)}')
        self._editor = EditorPage(data)
        self._set_content(self._editor)

    def _save(self):
        if not self._js_path or not self._editor: return
        data = self._editor.collect()
        try:
            new_src = apply_changes(self._js_src, data)
            with open(self._js_path, 'w', encoding='utf-8') as f: f.write(new_src)
            self._js_src = new_src
            self._data   = parse_all(new_src)
            self._status.showMessage(f'💾  Saved → {os.path.basename(self._js_path)}')
        except Exception as e:
            QMessageBox.critical(self,'Save Error',f'Could not save:\n{e}')

# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLE)
    win = MainWindow()
    win.show()
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        win._open(sys.argv[1])
    sys.exit(app.exec_())