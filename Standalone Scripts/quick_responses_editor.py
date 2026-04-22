#!/usr/bin/env python3
"""
Short Description Helper — Team Config Editor
Zero external dependencies (stdlib tkinter only).
Run: python team_config_editor.py [optional_path_to_script.js]
"""

import re, os, copy, sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ══════════════════════════════════════════════════════════════════════════════
#  PALETTE & HELPERS
# ══════════════════════════════════════════════════════════════════════════════
C = {
    'bg':       '#1e1e2e', 'surface':  '#26263a', 'surface2': '#2f2f48',
    'border':   '#44446a', 'accent':   '#7c6af7',  'accent_h': '#6455e0',
    'danger':   '#e05555', 'danger_h': '#c04040',  'success':  '#4ade80',
    'text':     '#e8e8f0', 'text_dim': '#8888aa',  'sel_bg':   '#3d3d60',
    'entry_bg': '#252538', 'btn_bg':   '#363652',  'btn_h':    '#46466a',
    'white':    '#ffffff',
}
FU = ('Segoe UI', 10)
FB = ('Segoe UI', 10, 'bold')
FS = ('Segoe UI', 9)
FH = ('Segoe UI', 12, 'bold')
FM = ('Consolas', 10)


def apply_style():
    s = ttk.Style()
    s.theme_use('clam')
    s.configure('.', background=C['bg'], foreground=C['text'], font=FU,
                borderwidth=0, relief='flat')
    s.configure('TFrame', background=C['bg'])
    s.configure('TLabel', background=C['bg'], foreground=C['text'])
    s.configure('Dim.TLabel', background=C['bg'], foreground=C['text_dim'], font=FS)
    s.configure('TCheckbutton', background=C['bg'], foreground=C['text'],
                indicatorcolor=C['accent'], indicatorbackground=C['entry_bg'])
    s.map('TCheckbutton', background=[('active', C['bg'])],
          indicatorcolor=[('selected', C['accent'])])
    s.configure('TSeparator', background=C['border'])
    s.configure('Treeview', background=C['surface2'], fieldbackground=C['surface2'],
                foreground=C['text'], rowheight=26, font=FU, borderwidth=0)
    s.configure('Treeview.Heading', background=C['surface'], foreground=C['text_dim'],
                font=FB, relief='flat', borderwidth=0)
    s.map('Treeview', background=[('selected', C['sel_bg'])],
          foreground=[('selected', C['white'])])
    s.configure('Vertical.TScrollbar', background=C['surface2'], troughcolor=C['surface'],
                arrowcolor=C['text_dim'], borderwidth=0, width=12)
    s.map('Vertical.TScrollbar', background=[('active', C['border'])])


def btn(parent, text, cmd, bg=None, hbg=None, small=False, **kw):
    obg = bg or C['btn_bg']
    ohbg = hbg or C['btn_h']
    b = tk.Button(parent, text=text, command=cmd,
                  bg=obg, fg=C['text'], activebackground=ohbg,
                  activeforeground=C['white'], relief='flat',
                  cursor='hand2', padx=10, pady=5,
                  font=FS if small else FU,
                  bd=0, highlightthickness=0, **kw)
    b.bind('<Enter>', lambda _: b.config(bg=ohbg))
    b.bind('<Leave>', lambda _: b.config(bg=obg))
    return b


def entry(parent, var=None, width=32, mono=False):
    return tk.Entry(parent, textvariable=var, width=width,
                    bg=C['entry_bg'], fg=C['text'],
                    insertbackground=C['text'], relief='flat', bd=0,
                    highlightthickness=1, highlightbackground=C['border'],
                    highlightcolor=C['accent'],
                    font=FM if mono else FU)


def lbl(parent, text, dim=False, bold=False, head=False, **kw):
    font = FH if head else (FB if bold else (FS if dim else FU))
    fg   = C['text_dim'] if dim else C['text']
    return tk.Label(parent, text=text, bg=C['bg'], fg=fg, font=font, **kw)


# ══════════════════════════════════════════════════════════════════════════════
#  JS PARSER
# ══════════════════════════════════════════════════════════════════════════════
def _bal(text, oc, cc, start):
    d = 0
    for i in range(start, len(text)):
        if   text[i] == oc: d += 1
        elif text[i] == cc:
            d -= 1
            if d == 0: return text[start:i+1], i+1
    return None, start

def _str_arr(s):  return [m.group(1) for m in re.finditer(r"'((?:[^'\\]|\\.)*)'", s)]
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

def _bool(text, name, default=True):
    m = re.search(r'\b'+re.escape(name)+r'\s*:\s*(true|false)', text)
    return (m.group(1)=='true') if m else default

def _str(text, name):
    m = re.search(r'\b'+re.escape(name)+r"""\s*:\s*'((?:[^'\\]|\\.)*)'""", text)
    return m.group(1) if m else ''

def parse_teams(js):
    m = re.search(r'const\s+TEAMS\s*=\s*\{', js)
    if not m: return None, None, None
    cs  = m.start()
    bp  = js.index('{', m.start())
    outer, _ = _bal(js, '{', '}', bp)
    if not outer: return None, None, None
    re_ = bp + len(outer)
    semi = re.match(r'\s*;', js[re_:re_+10])
    be   = re_ + (len(semi.group()) if semi else 0)
    inner, teams, pos = outer[1:-1], [], 0
    while pos < len(inner):
        km = re.search(r'\b([a-zA-Z_]\w*)\s*:\s*\{', inner[pos:])
        if not km: break
        key = km.group(1)
        ab  = inner.index('{', pos + km.start())
        blk, end = _bal(inner, '{', '}', ab)
        if not blk: break
        ti = blk[1:-1]
        teams.append({
            'key': key, 'name': _str(ti, 'name') or key,
            'mfOptions':         _mf_arr(_arr(ti,'mfOptions') or ''),
            'productOptions':    _str_arr(_arr(ti,'productOptions') or ''),
            'statusOptions':     _str_arr(_arr(ti,'statusOptions') or ''),
            'typeOptions':       _str_arr(_arr(ti,'typeOptions') or ''),
            'complexityOptions': _str_arr(_arr(ti,'complexityOptions') or ''),
            'showVendor':        _bool(ti, 'showVendor'),
            'showPER':           _bool(ti, 'showPER'),
            'complexityNote':    _str(ti, 'complexityNote'),
        })
        pos = end
    return teams, cs, be


# ══════════════════════════════════════════════════════════════════════════════
#  JS SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════
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
#  DIALOGS
# ══════════════════════════════════════════════════════════════════════════════
class _Dlg(tk.Toplevel):
    def __init__(self, parent, title, w=460):
        super().__init__(parent)
        self.title(title); self.configure(bg=C['bg'])
        self.resizable(False, False); self.result = None
        self.transient(parent); self.grab_set()
        self.geometry(f'+{parent.winfo_rootx()+60}+{parent.winfo_rooty()+60}')
        self.bind('<Escape>', lambda _: self.destroy())
        self.after(60, self.lift)

    def _ok_cancel(self, on_ok):
        f = tk.Frame(self, bg=C['bg']); f.pack(fill='x', padx=16, pady=(6, 16))
        btn(f,'  OK  ', on_ok, bg=C['accent'], hbg=C['accent_h']).pack(side='left', padx=(0,8))
        btn(f,'Cancel', self.destroy).pack(side='left')

    def wait(self):
        self.wait_window(self); return self.result


class MFDialog(_Dlg):
    def __init__(self, parent, label='', value=''):
        super().__init__(parent, 'Edit MF Option')
        self._lv = tk.StringVar(value=label)
        self._vv = tk.StringVar(value=value)
        p = tk.Frame(self, bg=C['bg']); p.pack(fill='x', padx=16, pady=(16,4))
        for text, var, hint in [
            ('Label (display text)', self._lv, 'e.g.  "Deloitte Spain - ES"'),
            ('Value  (short code)',  self._vv, 'e.g.  "ES"'),
        ]:
            lbl(p, text, bold=True).pack(anchor='w', pady=(8,2))
            entry(p, var=var, width=50).pack(fill='x')
            lbl(p, hint, dim=True).pack(anchor='w', pady=(1,0))
        self._ok_cancel(self._ok)
        self.bind('<Return>', lambda _: self._ok())

    def _ok(self):
        l, v = self._lv.get().strip(), self._vv.get().strip()
        if not l or not v:
            messagebox.showwarning('Required','Both fields required.', parent=self); return
        self.result = {'label': l, 'value': v}; self.destroy()


class StrDialog(_Dlg):
    def __init__(self, parent, title, value='', hint=None):
        super().__init__(parent, title)
        self._var = tk.StringVar(value=value)
        p = tk.Frame(self, bg=C['bg']); p.pack(fill='x', padx=16, pady=(16,4))
        lbl(p, 'Value', bold=True).pack(anchor='w', pady=(0,4))
        entry(p, var=self._var, width=50).pack(fill='x')
        if hint: lbl(p, hint, dim=True).pack(anchor='w', pady=(2,0))
        self._ok_cancel(self._ok)
        self.bind('<Return>', lambda _: self._ok())

    def _ok(self):
        v = self._var.get().strip()
        if not v:
            messagebox.showwarning('Required','Value cannot be empty.', parent=self); return
        self.result = v; self.destroy()


# ══════════════════════════════════════════════════════════════════════════════
#  LIST EDITOR  (reusable treeview + CRUD buttons)
# ══════════════════════════════════════════════════════════════════════════════
class ListEditor(tk.Frame):
    def __init__(self, master, title, items, columns, row_fn,
                 add_fn, edit_fn, height=6, hint='', **kw):
        super().__init__(master, bg=C['bg'], **kw)
        self._items  = list(items)
        self._row_fn = row_fn
        self._add_fn = add_fn
        self._edit_fn = edit_fn

        # Header
        hf = tk.Frame(self, bg=C['bg']); hf.pack(fill='x', pady=(10,3))
        lbl(hf, title, bold=True).pack(side='left')
        if hint: lbl(hf, f'  {hint}', dim=True).pack(side='left')

        # Treeview
        tf = tk.Frame(self, bg=C['surface2'], bd=1, relief='flat')
        tf.pack(fill='both', expand=True)
        cols = [c[0] for c in columns]
        self._tv = ttk.Treeview(tf, columns=cols, show='headings',
                                height=height, selectmode='browse')
        for cid, head, w in columns:
            self._tv.heading(cid, text=head)
            self._tv.column(cid, width=w, anchor='w', stretch=True)
        vsb = ttk.Scrollbar(tf, orient='vertical', command=self._tv.yview)
        self._tv.configure(yscrollcommand=vsb.set)
        self._tv.grid(row=0, column=0, sticky='nsew')
        vsb.grid(row=0, column=1, sticky='ns')
        tf.grid_columnconfigure(0, weight=1); tf.grid_rowconfigure(0, weight=1)
        self._tv.bind('<Double-1>', lambda _: self._edit())

        # Buttons
        bf = tk.Frame(self, bg=C['bg']); bf.pack(fill='x', pady=(4,0))
        specs = [('＋ Add',    self._add,    C['accent'],  C['accent_h']),
                 ('✏ Edit',   self._edit,   C['btn_bg'],  C['btn_h']),
                 ('✕ Delete', self._delete, C['danger'],  C['danger_h']),
                 ('↑',        self._up,     C['btn_bg'],  C['btn_h']),
                 ('↓',        self._down,   C['btn_bg'],  C['btn_h'])]
        for t, c, bg, hbg in specs:
            btn(bf, t, c, bg=bg, hbg=hbg, small=True).pack(side='left', padx=2)
        self._refresh()

    def _refresh(self):
        for r in self._tv.get_children(): self._tv.delete(r)
        for i, item in enumerate(self._items):
            self._tv.insert('', 'end', iid=str(i), values=self._row_fn(item))

    def _sel(self):
        s = self._tv.selection(); return int(s[0]) if s else None

    def _resel(self, idx):
        if 0 <= idx < len(self._items):
            self._tv.selection_set(str(idx)); self._tv.see(str(idx))

    def _add(self):
        item = self._add_fn()
        if item is not None:
            self._items.append(item); self._refresh()
            self._resel(len(self._items)-1)

    def _edit(self):
        idx = self._sel()
        if idx is None: return
        result = self._edit_fn(self._items[idx])
        if result is not None:
            self._items[idx] = result; self._refresh(); self._resel(idx)

    def _delete(self):
        idx = self._sel()
        if idx is None: return
        lv = self._row_fn(self._items[idx])[0]
        if messagebox.askyesno('Delete', f'Delete  "{lv}" ?', parent=self):
            self._items.pop(idx); self._refresh()
            self._resel(min(idx, len(self._items)-1))

    def _up(self):
        idx = self._sel()
        if idx is None or idx == 0: return
        self._items[idx-1], self._items[idx] = self._items[idx], self._items[idx-1]
        self._refresh(); self._resel(idx-1)

    def _down(self):
        idx = self._sel()
        if idx is None or idx >= len(self._items)-1: return
        self._items[idx], self._items[idx+1] = self._items[idx+1], self._items[idx]
        self._refresh(); self._resel(idx+1)

    def get(self): return copy.deepcopy(self._items)


def mf_editor(parent, items):
    return ListEditor(parent, 'MF Options', items,
        columns=[('l','Label (display text)',340),('v','Value (code)',100)],
        row_fn=lambda x:(x['label'],x['value']),
        add_fn=lambda: MFDialog(parent).wait(),
        edit_fn=lambda item: MFDialog(parent, item['label'], item['value']).wait(),
        height=8, hint='— display name → short code')

def str_editor(parent, title, items, height=5, hint=''):
    return ListEditor(parent, title, items,
        columns=[('v','Option',460)], row_fn=lambda x:(x,),
        add_fn=lambda: StrDialog(parent, f'Add – {title}').wait(),
        edit_fn=lambda item: StrDialog(parent, f'Edit – {title}', value=item).wait(),
        height=height, hint=hint)


# ══════════════════════════════════════════════════════════════════════════════
#  SCROLLABLE CANVAS WRAPPER
#  — one persistent canvas; inner frame is destroyed/rebuilt on team switch
# ══════════════════════════════════════════════════════════════════════════════
class ScrollCanvas(tk.Frame):
    """
    A canvas+scrollbar container whose .inner frame can be fully replaced
    via .rebuild(callback) without re-creating the canvas or scrollbar.
    This eliminates the layout glitch that happens when packing/unpacking
    the whole ScrollFrame widget.
    """
    def __init__(self, master, **kw):
        super().__init__(master, bg=C['bg'], **kw)
        self._canvas = tk.Canvas(self, bg=C['bg'], bd=0,
                                 highlightthickness=0, yscrollincrement=8)
        self._vsb = ttk.Scrollbar(self, orient='vertical',
                                  command=self._canvas.yview)
        self._canvas.configure(yscrollcommand=self._vsb.set)
        self._vsb.pack(side='right', fill='y')
        self._canvas.pack(side='left', fill='both', expand=True)
        self.inner = None
        self._win  = None
        self._canvas.bind('<Configure>', self._on_canvas_resize)
        # Bind wheel on the canvas itself (covers empty space)
        self._canvas.bind('<MouseWheel>', self._on_wheel)

    def _on_wheel(self, event):
        self._canvas.yview_scroll(int(-1 * (event.delta / 120)), 'units')

    def _bind_wheel_recursive(self, widget):
        """
        Bind <MouseWheel> on every widget in the inner tree so scrolling works
        regardless of which child the cursor is hovering over.
        Treeview widgets are skipped so their own internal scroll still works.
        """
        if not isinstance(widget, ttk.Treeview):
            widget.bind('<MouseWheel>', self._on_wheel)
        for child in widget.winfo_children():
            self._bind_wheel_recursive(child)

    def _on_canvas_resize(self, event):
        if self._win:
            self._canvas.itemconfig(self._win, width=event.width)

    def _on_inner_configure(self, _=None):
        self._canvas.configure(scrollregion=self._canvas.bbox('all'))
        # scroll back to top whenever content is (re)built
        self._canvas.yview_moveto(0)

    def rebuild(self, build_fn):
        """
        Destroy existing inner frame, create a fresh one, call build_fn(inner),
        and re-attach it to the canvas window.
        """
        if self._win:
            self._canvas.delete(self._win)
            self._win = None
        if self.inner and self.inner.winfo_exists():
            self.inner.destroy()

        self.inner = tk.Frame(self._canvas, bg=C['bg'])
        build_fn(self.inner)

        self._win = self._canvas.create_window(
            (0, 0), window=self.inner, anchor='nw')
        self.inner.bind('<Configure>', self._on_inner_configure)
        # Force an immediate layout update
        self.inner.update_idletasks()
        self._on_canvas_resize(type('E', (), {'width': self._canvas.winfo_width()})())
        self._on_inner_configure()
        # Bind scroll wheel on every child widget (except treeviews)
        self._bind_wheel_recursive(self.inner)


# ══════════════════════════════════════════════════════════════════════════════
#  TEAM EDITOR  — builds into whatever frame is passed
# ══════════════════════════════════════════════════════════════════════════════
class TeamEditor:
    """
    Builds all editor widgets into `parent` and exposes .collect().
    Does NOT own a frame — the caller owns it.
    """
    def __init__(self, parent, team_data, on_name_change=None):
        self._t  = copy.deepcopy(team_data)
        self._cb = on_name_change
        self._build(parent)

    def _sep(self, p):
        ttk.Separator(p, orient='horizontal').pack(fill='x', padx=0, pady=(14,6))

    def _build(self, p):
        PAD = dict(padx=22)

        # ── Identity ─────────────────────────────────────────────────────────
        lbl(p, 'Team Identity', head=True).pack(anchor='w', **PAD, pady=(18,8))

        self._name_var = tk.StringVar(value=self._t['name'])
        self._key_var  = tk.StringVar(value=self._t['key'])

        for label_text, var, wid, mono in [
            ('Team Name',    self._name_var, 38, False),
            ('Internal Key', self._key_var,  26, True),
        ]:
            row = tk.Frame(p, bg=C['bg']); row.pack(fill='x', **PAD, pady=2)
            lbl(row, label_text, dim=True, width=14, anchor='w').pack(side='left')
            entry(row, var=var, width=wid, mono=mono).pack(side='left')
            if mono:
                lbl(row, '  camelCase JS key', dim=True).pack(side='left')

        self._name_var.trace_add('write', lambda *_: self._cb and self._cb(self._name_var.get()))

        # ── MF Options ───────────────────────────────────────────────────────
        self._sep(p)
        self._mf = mf_editor(p, self._t['mfOptions'])
        self._mf.pack(fill='x', **PAD)

        # ── Product ──────────────────────────────────────────────────────────
        self._sep(p)
        self._prod = str_editor(p,'Product Options', self._t['productOptions'],
                                height=4, hint='— e.g. DLP, SWG, CASB')
        self._prod.pack(fill='x', **PAD)

        # ── Status ───────────────────────────────────────────────────────────
        self._sep(p)
        self._stat = str_editor(p,'Status Options', self._t['statusOptions'],
                                height=5, hint='— e.g. WIP, Waiting Requester')
        self._stat.pack(fill='x', **PAD)

        # ── Type ─────────────────────────────────────────────────────────────
        self._sep(p)
        self._type = str_editor(p,'Type Options', self._t['typeOptions'],
                                height=9, hint='— e.g. Access, Config, Policy')
        self._type.pack(fill='x', **PAD)

        # ── Complexity ───────────────────────────────────────────────────────
        self._sep(p)
        self._comp = str_editor(p,'Complexity Options', self._t['complexityOptions'],
                                height=3, hint='— typically N/A, 1, 2, 3')
        self._comp.pack(fill='x', **PAD)

        # ── Complexity Note ──────────────────────────────────────────────────
        self._sep(p)
        lbl(p,'Complexity Note', bold=True).pack(anchor='w', **PAD, pady=(2,4))
        self._note_var = tk.StringVar(value=self._t['complexityNote'])
        nf = tk.Frame(p, bg=C['bg']); nf.pack(fill='x', **PAD)
        entry(nf, var=self._note_var, width=60).pack(fill='x')

        # ── Optional fields ──────────────────────────────────────────────────
        self._sep(p)
        lbl(p,'Optional Fields', bold=True).pack(anchor='w', **PAD, pady=(2,6))
        cf = tk.Frame(p, bg=C['bg']); cf.pack(fill='x', **PAD, pady=(0,28))
        self._vendor_var = tk.BooleanVar(value=self._t['showVendor'])
        self._per_var    = tk.BooleanVar(value=self._t['showPER'])
        ttk.Checkbutton(cf, text='Show  Vendor Case  field',
                        variable=self._vendor_var).pack(side='left', padx=(0,28))
        ttk.Checkbutton(cf, text='Show  PER Number  field',
                        variable=self._per_var).pack(side='left')

    def collect(self):
        return {
            'key':               self._key_var.get().strip(),
            'name':              self._name_var.get().strip(),
            'mfOptions':         self._mf.get(),
            'productOptions':    self._prod.get(),
            'statusOptions':     self._stat.get(),
            'typeOptions':       self._type.get(),
            'complexityOptions': self._comp.get(),
            'complexityNote':    self._note_var.get().strip(),
            'showVendor':        self._vendor_var.get(),
            'showPER':           self._per_var.get(),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN APPLICATION
# ══════════════════════════════════════════════════════════════════════════════
class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Short Description Helper — Team Config Editor')
        self.geometry('1180x760'); self.minsize(860, 540)
        self.configure(bg=C['bg'])
        apply_style()

        self._js_path  = None
        self._js_src   = ''
        self._teams    = []
        self._blk_s    = None
        self._blk_e    = None
        self._sel      = None   # selected index
        self._editor   = None  # TeamEditor instance

        self._build_ui()
        self.bind('<Control-s>', lambda _: self._save())

    # ── UI ────────────────────────────────────────────────────────────────────
    def _build_ui(self):
        # Top bar
        top = tk.Frame(self, bg=C['surface'], height=52)
        top.pack(fill='x', side='top'); top.pack_propagate(False)
        btn(top,'📂  Open .js File', self._open,
            bg=C['accent'], hbg=C['accent_h']).pack(side='left', padx=14, pady=10)
        self._path_lbl = tk.Label(top, text='No file loaded.',
                                  bg=C['surface'], fg=C['text_dim'], font=FU, anchor='w')
        self._path_lbl.pack(side='left', padx=6, fill='x', expand=True)

        # Bottom bar
        bot = tk.Frame(self, bg=C['surface'], height=44)
        bot.pack(fill='x', side='bottom'); bot.pack_propagate(False)
        self._status_lbl = tk.Label(bot, text='Open a .js file to begin.',
                                    bg=C['surface'], fg=C['text_dim'], font=FU, anchor='w')
        self._status_lbl.pack(side='left', padx=14, fill='x', expand=True)
        self._save_btn = btn(bot,'💾  Save to File', self._save,
                             bg=C['accent'], hbg=C['accent_h'])
        self._save_btn.pack(side='right', padx=14, pady=7)
        self._save_btn.config(state='disabled', cursor='arrow')

        # Main area
        main = tk.Frame(self, bg=C['bg']); main.pack(fill='both', expand=True)

        # ── Sidebar ───────────────────────────────────────────────────────────
        sb = tk.Frame(main, bg=C['surface'], width=205)
        sb.pack(side='left', fill='y'); sb.pack_propagate(False)

        tk.Label(sb, text='Teams', bg=C['surface'], fg=C['text'],
                 font=FH).pack(anchor='w', padx=14, pady=(14,2))
        tk.Label(sb, text='Click a team to edit.',
                 bg=C['surface'], fg=C['text_dim'], font=FS).pack(anchor='w', padx=14, pady=(0,8))

        # Scrollable team list
        tc = tk.Canvas(sb, bg=C['surface'], bd=0, highlightthickness=0)
        tv = ttk.Scrollbar(sb, orient='vertical', command=tc.yview)
        tc.configure(yscrollcommand=tv.set)
        tv.pack(side='right', fill='y')
        tc.pack(side='top', fill='both', expand=True)
        self._team_frame = tk.Frame(tc, bg=C['surface'])
        _tw = tc.create_window((0,0), window=self._team_frame, anchor='nw')
        self._team_frame.bind('<Configure>',
            lambda _: tc.configure(scrollregion=tc.bbox('all')))
        tc.bind('<Configure>', lambda e: tc.itemconfig(_tw, width=e.width))

        # Sidebar action buttons
        sbf = tk.Frame(sb, bg=C['surface']); sbf.pack(fill='x', padx=8, pady=8)
        btn(sbf,'＋  New Team',   self._new_team,
            bg=C['accent'], hbg=C['accent_h']).pack(fill='x', pady=2)
        btn(sbf,'⧉  Duplicate',  self._dup_team).pack(fill='x', pady=2)
        btn(sbf,'✕  Delete',     self._del_team,
            bg=C['danger'], hbg=C['danger_h']).pack(fill='x', pady=2)

        # ── Content (persistent scroll canvas) ───────────────────────────────
        self._scroll = ScrollCanvas(main)
        self._scroll.pack(side='left', fill='both', expand=True)
        self._show_placeholder('Open a .js file, then select a team from the sidebar.')

    # ── helpers ───────────────────────────────────────────────────────────────
    def _status(self, msg, color=None):
        self._status_lbl.config(text=msg, fg=color or C['text_dim'])

    def _rebuild_sidebar(self):
        for w in self._team_frame.winfo_children(): w.destroy()
        for i, t in enumerate(self._teams):
            selected = (i == self._sel)
            obg = C['sel_bg'] if selected else C['surface']
            ofg = C['white']  if selected else C['text_dim']
            b = tk.Button(self._team_frame, text=t['name'],
                          anchor='w', bg=obg, fg=ofg,
                          activebackground=C['sel_bg'], activeforeground=C['white'],
                          relief='flat', bd=0, padx=14, pady=8, font=FU,
                          cursor='hand2',
                          command=lambda idx=i: self._select(idx))
            b.pack(fill='x')
            b.bind('<Enter>', lambda e, b2=b: b2.config(bg=C['sel_bg'], fg=C['white']))
            b.bind('<Leave>', lambda e, b2=b, bg=obg, fg=ofg: b2.config(bg=bg, fg=fg))

    def _show_placeholder(self, msg):
        def _build(inner):
            tk.Label(inner, text=msg, bg=C['bg'], fg=C['text_dim'],
                     font=('Segoe UI', 13)).pack(expand=True, pady=200)
        self._scroll.rebuild(_build)
        self._editor = None

    def _flush(self):
        """Save current editor state back into self._teams."""
        if self._editor is not None and self._sel is not None:
            self._teams[self._sel] = self._editor.collect()

    # ── file ops ──────────────────────────────────────────────────────────────
    def _open(self, path=None):
        if not path:
            path = filedialog.askopenfilename(
                title='Select the Short Description Helper .js file',
                filetypes=[('JavaScript', '*.js'), ('All files', '*.*')])
        if not path: return
        try:
            with open(path, encoding='utf-8') as f: src = f.read()
        except Exception as e:
            messagebox.showerror('Error', f'Could not read file:\n{e}'); return
        teams, start, end = parse_teams(src)
        if teams is None:
            messagebox.showerror('Parse Error',
                'Could not find  const TEAMS = {...}  in this file.\n'
                'Make sure you selected the correct userscript.'); return
        self._js_path = path; self._js_src = src
        self._teams   = teams; self._blk_s = start; self._blk_e = end
        self._sel = None; self._editor = None
        fname = os.path.basename(path)
        self._path_lbl.config(
            text=f'{fname}   ({len(teams)} team{"s" if len(teams)!=1 else ""} found)',
            fg=C['text'])
        self._save_btn.config(state='normal', cursor='hand2')
        self._status(f'✅  Loaded {fname}', C['success'])
        self._rebuild_sidebar()
        if teams: self._select(0)
        else: self._show_placeholder('No teams found — use "New Team" to create one.')

    def _save(self):
        if not self._js_path: return
        self._flush()
        if not self._teams:
            messagebox.showwarning('Nothing to save','No teams defined.'); return
        try:
            new_src = splice_teams(self._js_src, self._teams, self._blk_s, self._blk_e)
            with open(self._js_path, 'w', encoding='utf-8') as f: f.write(new_src)
            self._js_src = new_src
            _, s, e = parse_teams(new_src)
            if s is not None: self._blk_s, self._blk_e = s, e
            self._status(f'💾  Saved → {os.path.basename(self._js_path)}', C['success'])
        except Exception as e:
            messagebox.showerror('Save Error', f'Could not save:\n{e}')

    # ── team management ───────────────────────────────────────────────────────
    def _select(self, idx):
        self._flush()
        self._sel = idx
        self._rebuild_sidebar()

        team = self._teams[idx]

        def _build(inner):
            # TeamEditor writes all widgets into `inner`
            self._editor = TeamEditor(
                inner, team,
                on_name_change=lambda name: self._on_name_change(idx, name))

        self._scroll.rebuild(_build)

    def _on_name_change(self, idx, name):
        if idx < len(self._teams):
            self._teams[idx]['name'] = name
            self._rebuild_sidebar()

    def _new_team(self):
        if not self._js_path:
            messagebox.showinfo('No File','Open a .js file first.'); return
        self._flush()
        d = StrDialog(self,'New Team — Enter Name', value='New Team',
                      hint='e.g. "APAC Team", "LATAM Team" …')
        d.wait()
        if not d.result: return
        name  = d.result.strip()
        parts = re.sub(r'[^a-zA-Z0-9 ]','',name).split()
        key   = (parts[0].lower()+''.join(p.capitalize() for p in parts[1:])+'Team') if parts else 'newTeam'
        existing = {t['key'] for t in self._teams}
        base,n = key,2
        while key in existing: key=f'{base}{n}'; n+=1
        self._teams.append({'key':key,'name':name,
            'mfOptions':[{'label':'N/A','value':'N/A'}],
            'productOptions':['N/A','DLP','SWG','CASB'],
            'statusOptions':['N/A','Waiting Requester','WIP','Closed'],
            'typeOptions':['N/A','Access','Config','Policy'],
            'complexityOptions':['N/A','1','2','3'],
            'complexityNote':'1 = Low, 2 = Medium, 3 = High',
            'showVendor':True,'showPER':True})
        self._select(len(self._teams)-1)
        self._status(f'➕  Added: {name}')

    def _dup_team(self):
        if self._sel is None: return
        self._flush()
        orig = copy.deepcopy(self._teams[self._sel])
        orig['name'] += ' (Copy)'
        base = orig['key']+'Copy'; existing={t['key'] for t in self._teams}
        key,n = base,2
        while key in existing: key=f'{base}{n}'; n+=1
        orig['key']=key; self._teams.append(orig)
        self._select(len(self._teams)-1)
        self._status(f'⧉  Duplicated as: {orig["name"]}')

    def _del_team(self):
        if self._sel is None:
            messagebox.showinfo('Nothing selected','Select a team first.'); return
        name = self._teams[self._sel]['name']
        if not messagebox.askyesno('Delete',f'Delete  "{name}" ?\n\nThis cannot be undone.'): return
        self._teams.pop(self._sel)
        self._editor = None; self._sel = None
        self._rebuild_sidebar()
        if self._teams: self._select(0)
        else: self._show_placeholder('No teams left — use "New Team" to add one.')
        self._status(f'🗑  Deleted: {name}')


# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    app = App()
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        app.after(150, lambda: app._open(sys.argv[1]))
    app.mainloop()
