import { Editor } from './editor.js';
import { estimatePages, displayText, FORMATS } from './elements.js';
import { toFountain, fromFountain } from './fountain.js';
import { loadState, saveState, newScript, downloadText, safeFilename } from './storage.js';
import { t, lang, setLang, detectLang } from './i18n.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  editor: $('#editor'),
  title: $('#script-title'),
  type: $('#element-type'),
  format: $('#script-format'),
  sidebar: $('#sidebar'),
  sidebarBtn: $('#btn-sidebar'),
  scriptList: $('#script-list'),
  sceneList: $('#scene-list'),
  sceneEmpty: $('#scene-empty'),
  pages: $('#status-pages'),
  words: $('#status-words'),
  scenes: $('#status-scenes'),
  saved: $('#status-saved'),
  fileBtn: $('#btn-file'),
  fileMenu: $('#file-menu'),
  fileInput: $('#file-input'),
  dlgTitle: $('#dlg-title-page'),
  dlgHelp: $('#dlg-help'),
  pageSize: $('#page-size'),
};

const state = loadState();
const editor = new Editor(els.editor);
let saveTimer = null;
let loaded = false;

function current() {
  return state.scripts.find((s) => s.id === state.currentId) || state.scripts[0];
}

function scriptFormat(s = current()) {
  return FORMATS.includes(s.format) ? s.format : 'hollywood';
}

function defaultFormat() {
  return lang === 'zh' ? 'tw' : 'hollywood';
}

// ---- Loading / saving -----------------------------------------------------

function openScript(id) {
  if (loaded) flushSave();
  state.currentId = id;
  const s = current();
  els.title.value = s.title;
  applyFormat(scriptFormat(s));
  editor.load(s.blocks);
  loaded = true;
  renderScriptList();
  refresh();
  saveState(state);
  updateTitlePagePrint();
  updateDocTitle();
}

function applyFormat(format) {
  editor.setFormat(format);
  els.format.value = format;
  els.pageSize.textContent = format === 'tw'
    ? '@page { size: A4; margin: 25mm 20mm 25mm 25mm; }'
    : '@page { size: letter; margin: 1in; }';
}

function scheduleSave() {
  els.saved.textContent = t('status.unsaved');
  els.saved.classList.add('unsaved');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}

function flushSave() {
  clearTimeout(saveTimer);
  const s = current();
  s.blocks = editor.getBlocks();
  s.title = els.title.value.trim();
  s.updated = Date.now();
  const ok = saveState(state);
  els.saved.textContent = ok ? t('status.saved') : t('status.saveFailed');
  els.saved.classList.toggle('unsaved', !ok);
  updateTitlePagePrint();
}

function updateDocTitle() {
  document.title = (els.title.value.trim() || t('untitled')) + t('docTitleSuffix');
}

// ---- UI rendering ----------------------------------------------------------

function refresh() {
  const blocks = editor.getBlocks();
  const words = blocks.reduce((n, b) => n + (b.text.match(/[\p{L}\p{N}']+|\p{Script=Han}/gu) || []).length, 0);
  const scenes = blocks.filter((b) => b.type === 'scene' && b.text.trim()).length;
  els.pages.textContent = t('status.pages', { n: estimatePages(blocks, scriptFormat()) });
  els.words.textContent = t('status.words', { n: words });
  els.scenes.textContent = t('status.scenes', { n: scenes });
  renderSceneList();
}

function renderSceneList() {
  const sceneBlocks = editor.blocks().filter((b) => b.dataset.type === 'scene' && b.innerText.trim());
  els.sceneList.innerHTML = '';
  els.sceneEmpty.hidden = sceneBlocks.length > 0;
  sceneBlocks.forEach((b, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span class="num">${i + 1}</span>`;
    btn.appendChild(document.createTextNode(b.innerText.trim()));
    btn.title = b.innerText.trim();
    btn.addEventListener('click', () => editor.focusBlock(b));
    li.appendChild(btn);
    els.sceneList.appendChild(li);
  });
}

function renderScriptList() {
  els.scriptList.innerHTML = '';
  [...state.scripts].sort((a, b) => b.updated - a.updated).forEach((s) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = s.title || t('untitled');
    btn.classList.toggle('active', s.id === state.currentId);
    btn.addEventListener('click', () => { openScript(s.id); closeSidebarOnMobile(); });
    li.appendChild(btn);
    els.scriptList.appendChild(li);
  });
}

function syncTypeSelect() {
  const type = editor.currentType();
  if (type) els.type.value = type;
}

function updateTitlePagePrint() {
  const s = current();
  const m = s.meta || {};
  $('#tp-title').textContent = s.title || '';
  $('#tp-credit').textContent = m.author ? (m.credit || t('tp.creditPh')) : '';
  $('#tp-author').textContent = m.author || '';
  $('#tp-draft').textContent = m.draft || '';
  $('#tp-contact').textContent = m.contact || '';
  const empty = !(s.title || m.author || m.draft || m.contact);
  $('#print-title-page').dataset.empty = String(empty);
}

function closeSidebarOnMobile() {
  if (matchMedia('(max-width: 900px)').matches) setSidebar(false);
}

function setSidebar(open) {
  els.sidebar.hidden = !open;
  els.sidebarBtn.setAttribute('aria-expanded', String(open));
  localStorage.setItem('scriptwriter.sidebar', open ? '1' : '0');
}

// ---- File actions ----------------------------------------------------------

function createScript(title = '', format = defaultFormat()) {
  const s = newScript(title, format);
  state.scripts.push(s);
  openScript(s.id);
  els.title.focus();
  return s;
}

const actions = {
  new() { createScript(); },

  duplicate() {
    flushSave();
    const src = current();
    const copy = {
      ...newScript((src.title || t('untitled')) + t('copySuffix'), scriptFormat(src)),
      meta: { ...src.meta },
      blocks: JSON.parse(JSON.stringify(src.blocks)),
    };
    state.scripts.push(copy);
    openScript(copy.id);
  },

  delete() {
    const s = current();
    if (!confirm(t('confirm.delete', { name: s.title || t('untitled') }))) return;
    state.scripts = state.scripts.filter((x) => x.id !== s.id);
    if (!state.scripts.length) state.scripts.push(newScript('', defaultFormat()));
    openScript(state.scripts[0].id);
  },

  import() { els.fileInput.accept = '.fountain,.txt'; els.fileInput.dataset.mode = 'fountain'; els.fileInput.click(); },
  'import-json'() { els.fileInput.accept = '.json'; els.fileInput.dataset.mode = 'json'; els.fileInput.click(); },

  'export-fountain'() {
    flushSave();
    const s = current();
    downloadText(safeFilename(s.title, '.fountain'), toFountain(s));
  },

  'export-json'() {
    flushSave();
    downloadText('scriptwriter-backup.json', JSON.stringify(state, null, 2), 'application/json');
  },

  print() { flushSave(); window.print(); },
};

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files[0];
  els.fileInput.value = '';
  if (!file) return;
  const text = await file.text();
  if (els.fileInput.dataset.mode === 'json') {
    try {
      const data = JSON.parse(text);
      const incoming = Array.isArray(data.scripts) ? data.scripts : [data];
      let added = 0;
      for (const s of incoming) {
        if (!s || !Array.isArray(s.blocks)) continue;
        if (state.scripts.some((x) => x.id === s.id)) s.id = newScript().id;
        state.scripts.push(s);
        added++;
      }
      if (!added) return alert(t('alert.noScripts'));
      openScript(state.scripts[state.scripts.length - 1].id);
    } catch (e) {
      alert(t('alert.badBackup'));
    }
    return;
  }
  const parsed = fromFountain(text);
  const hasZhScene = parsed.blocks.some((b) => b.type === 'scene' && /第.+[場场幕]/.test(b.text));
  const s = createScript(parsed.title || file.name.replace(/\.[^.]+$/, ''), hasZhScene ? 'tw' : defaultFormat());
  s.meta = { ...s.meta, ...parsed.meta };
  s.blocks = parsed.blocks.length ? parsed.blocks : s.blocks;
  openScript(s.id);
});

// ---- Wiring ---------------------------------------------------------------

editor.on('change', () => { scheduleSave(); refresh(); });
editor.on('selection', syncTypeSelect);

els.type.addEventListener('change', () => {
  editor.setType(els.type.value);
  els.editor.focus();
});

els.format.addEventListener('change', () => setFormat(els.format.value));

function setFormat(format) {
  const s = current();
  s.format = FORMATS.includes(format) ? format : 'hollywood';
  applyFormat(s.format);
  flushSave();
  refresh();
}

els.title.addEventListener('input', () => {
  scheduleSave();
  renderScriptList();
  updateDocTitle();
});
els.title.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); els.editor.focus(); }
});

els.sidebarBtn.addEventListener('click', () => setSidebar(els.sidebar.hidden));
$('#btn-new-script').addEventListener('click', () => { createScript(); closeSidebarOnMobile(); });

// File menu
els.fileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = els.fileMenu.hidden;
  els.fileMenu.hidden = !open;
  els.fileBtn.setAttribute('aria-expanded', String(open));
});
els.fileMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-action]');
  if (!item) return;
  els.fileMenu.hidden = true;
  els.fileBtn.setAttribute('aria-expanded', 'false');
  actions[item.dataset.action]?.();
});
document.addEventListener('click', (e) => {
  if (!els.fileMenu.hidden && !e.target.closest('.menu')) {
    els.fileMenu.hidden = true;
    els.fileBtn.setAttribute('aria-expanded', 'false');
  }
});

// Title page / settings dialog
$('#btn-title-page').addEventListener('click', () => {
  const s = current();
  const f = els.dlgTitle.querySelector('form');
  f.format.value = scriptFormat(s);
  f.title.value = s.title || '';
  f.credit.value = s.meta.credit ?? t('tp.creditPh');
  f.author.value = s.meta.author || '';
  f.draft.value = s.meta.draft || '';
  f.contact.value = s.meta.contact || '';
  els.dlgTitle.showModal();
});
els.dlgTitle.querySelector('form').addEventListener('submit', (e) => {
  const f = e.target;
  const s = current();
  s.title = f.title.value.trim();
  els.title.value = s.title;
  s.meta = {
    credit: f.credit.value.trim(),
    author: f.author.value.trim(),
    draft: f.draft.value.trim(),
    contact: f.contact.value.trim(),
  };
  setFormat(f.format.value);
  renderScriptList();
  updateDocTitle();
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$('#btn-help').addEventListener('click', () => els.dlgHelp.showModal());

// Theme
$('#btn-theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('scriptwriter.theme', next);
});

// Language
$('#btn-lang').addEventListener('click', () => {
  setLang(lang === 'zh' ? 'en' : 'zh');
  renderScriptList();
  refresh();
  updateDocTitle();
  els.saved.textContent = els.saved.classList.contains('unsaved') ? t('status.unsaved') : t('status.saved');
});

// Global shortcuts
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 's') { e.preventDefault(); flushSave(); }
  if (e.key === 'p') { e.preventDefault(); actions.print(); }
});

window.addEventListener('beforeprint', () => {
  flushSave();
  // Bake uppercase / parentheses into the DOM text so print matches export.
  const format = scriptFormat();
  editor.blocks().forEach((b) => {
    b.dataset.raw = b.innerText;
    const shown = displayText(b.dataset.type, b.innerText.replace(/\n$/, ''), format);
    if (shown !== b.innerText.replace(/\n$/, '')) b.textContent = shown;
  });
});
window.addEventListener('afterprint', () => {
  editor.blocks().forEach((b) => {
    if (b.dataset.raw !== undefined && b.innerText !== b.dataset.raw) b.textContent = b.dataset.raw.replace(/\n$/, '');
    delete b.dataset.raw;
  });
});
window.addEventListener('beforeunload', flushSave);

// Focus the editor when clicking the empty part of the page
$('.editor-area').addEventListener('mousedown', (e) => {
  if (e.target === e.currentTarget || e.target.classList.contains('page')) {
    const blocks = editor.blocks();
    const last = blocks[blocks.length - 1];
    if (last) { e.preventDefault(); editor.focusBlock(last); }
  }
});

// ---- Boot -----------------------------------------------------------------

setLang(detectLang());
setSidebar(localStorage.getItem('scriptwriter.sidebar') !== '0' && !matchMedia('(max-width: 900px)').matches);
openScript(state.currentId);
