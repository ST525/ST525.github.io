// UI strings. Values are plain strings, HTML strings (keys used with data-i18n-html)
// or functions of a vars object.

const STRINGS = {
  en: {
    appName: 'Scriptwriter',
    untitled: 'Untitled Script',
    docTitleSuffix: ' — Scriptwriter',
    copySuffix: ' (copy)',
    toggleSidebar: 'Toggle sidebar',
    scriptTitle: 'Script title',
    elementType: 'Element type',
    scriptFormat: 'Script format',
    'el.scene': 'Scene Heading',
    'el.action': 'Action',
    'el.character': 'Character',
    'el.parenthetical': 'Parenthetical',
    'el.dialogue': 'Dialogue',
    'el.transition': 'Transition',
    'fmt.hollywood': 'Hollywood',
    'fmt.tw': 'Taiwan (第X場)',
    titlePage: 'Title Page',
    file: 'File',
    'menu.new': 'New script',
    'menu.duplicate': 'Duplicate script',
    'menu.import': 'Import Fountain (.fountain / .txt)',
    'menu.exportFountain': 'Export Fountain',
    'menu.exportJson': 'Export backup (.json)',
    'menu.importJson': 'Import backup (.json)',
    'menu.print': 'Print / Save as PDF',
    'menu.delete': 'Delete script',
    help: 'Keyboard shortcuts',
    theme: 'Toggle light / dark theme',
    switchLang: 'Switch language (繁體中文)',
    langLabel: '中',
    'sidebar.scripts': 'Scripts',
    'sidebar.newScript': '+ New script',
    'sidebar.scenes': 'Scenes',
    'sidebar.noScenes': 'No scenes yet. Start a line with <code>INT.</code> / <code>EXT.</code> or <code>第1場</code>.',
    'status.pages': ({ n }) => `${n} page${n === 1 ? '' : 's'}`,
    'status.words': ({ n }) => `${n} word${n === 1 ? '' : 's'}`,
    'status.scenes': ({ n }) => `${n} scene${n === 1 ? '' : 's'}`,
    'status.hint': '<kbd>Tab</kbd> change element · <kbd>Enter</kbd> next element',
    'status.saved': 'Saved',
    'status.unsaved': 'Unsaved',
    'status.saveFailed': 'Save failed (storage full?)',
    'tp.heading': 'Title Page',
    'tp.format': 'Format',
    'tp.title': 'Title',
    'tp.credit': 'Credit',
    'tp.creditPh': 'Written by',
    'tp.author': 'Author',
    'tp.draft': 'Draft / date',
    'tp.draftPh': 'First Draft — Oct 2026',
    'tp.contact': 'Contact',
    'tp.contactPh': 'email · phone · address',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    'help.heading': 'Shortcuts',
    'help.enter': 'Finish element, start the next one (Character → Dialogue → Character …)',
    'help.tab': 'Cycle the current element\u2019s type',
    'help.shiftEnter': 'Line break inside an element',
    'help.ctrlNum': 'Scene Heading · Action · Character · Parenthetical · Dialogue · Transition',
    'help.ctrlS': 'Save (autosaves anyway)',
    'help.ctrlP': 'Print / Save as PDF',
    'help.autodetect': 'Auto-detect: an Action line starting with <code>INT.</code>/<code>EXT.</code> (or <code>第X場</code>) becomes a Scene Heading; an all-caps line becomes a Character; a line ending in <code>TO:</code> becomes a Transition. In Taiwan format, typing <code>小明：你好</code> splits into Character + Dialogue.',
    'confirm.delete': ({ name }) => `Delete "${name}"? This cannot be undone.`,
    'alert.noScripts': 'No scripts found in that file.',
    'alert.badBackup': 'Could not read that backup file.',
  },
  zh: {
    appName: '劇本編輯器',
    untitled: '未命名劇本',
    docTitleSuffix: ' — 劇本編輯器',
    copySuffix: '（副本）',
    toggleSidebar: '切換側欄',
    scriptTitle: '劇本名稱',
    elementType: '元素類型',
    scriptFormat: '劇本格式',
    'el.scene': '場次',
    'el.action': '動作',
    'el.character': '角色',
    'el.parenthetical': '括註',
    'el.dialogue': '對白',
    'el.transition': '轉場',
    'fmt.hollywood': '好萊塢格式',
    'fmt.tw': '台灣劇本格式',
    titlePage: '封面',
    file: '檔案',
    'menu.new': '新劇本',
    'menu.duplicate': '複製劇本',
    'menu.import': '匯入 Fountain（.fountain / .txt）',
    'menu.exportFountain': '匯出 Fountain',
    'menu.exportJson': '匯出備份（.json）',
    'menu.importJson': '匯入備份（.json）',
    'menu.print': '列印／另存 PDF',
    'menu.delete': '刪除劇本',
    help: '鍵盤快捷鍵',
    theme: '切換深淺色主題',
    switchLang: 'Switch language (English)',
    langLabel: 'EN',
    'sidebar.scripts': '劇本',
    'sidebar.newScript': '＋ 新劇本',
    'sidebar.scenes': '場次',
    'sidebar.noScenes': '尚無場次。以 <code>第1場</code> 或 <code>INT.</code> 開頭即可建立場次。',
    'status.pages': ({ n }) => `${n} 頁`,
    'status.words': ({ n }) => `${n} 字`,
    'status.scenes': ({ n }) => `${n} 場`,
    'status.hint': '<kbd>Tab</kbd> 切換元素 · <kbd>Enter</kbd> 下一元素',
    'status.saved': '已儲存',
    'status.unsaved': '未儲存',
    'status.saveFailed': '儲存失敗（儲存空間已滿？）',
    'tp.heading': '封面',
    'tp.format': '劇本格式',
    'tp.title': '片名',
    'tp.credit': '署名',
    'tp.creditPh': '編劇',
    'tp.author': '作者',
    'tp.draft': '版本／日期',
    'tp.draftPh': '初稿 — 2026 年 10 月',
    'tp.contact': '聯絡方式',
    'tp.contactPh': 'Email · 電話 · 地址',
    cancel: '取消',
    save: '儲存',
    close: '關閉',
    'help.heading': '快捷鍵',
    'help.enter': '結束目前元素並開始下一個（角色 → 對白 → 角色 …）',
    'help.tab': '循環切換目前元素的類型',
    'help.shiftEnter': '元素內換行',
    'help.ctrlNum': '場次 · 動作 · 角色 · 括註 · 對白 · 轉場',
    'help.ctrlS': '儲存（會自動儲存）',
    'help.ctrlP': '列印／另存 PDF',
    'help.autodetect': '自動判斷：以 <code>INT.</code>／<code>EXT.</code>（或 <code>第X場</code>）開頭的動作行會變成場次；全大寫的英文行會變成角色；以 <code>TO:</code> 結尾的一行會變成轉場。台灣格式下，輸入 <code>小明：你好</code> 會自動拆成角色＋對白。',
    'confirm.delete': ({ name }) => `確定刪除「${name}」？此動作無法復原。`,
    'alert.noScripts': '檔案中找不到劇本。',
    'alert.badBackup': '無法讀取備份檔。',
  },
};

const KEY = 'scriptwriter.lang';

export let lang = 'en';

export function detectLang() {
  const saved = localStorage.getItem(KEY);
  if (saved && STRINGS[saved]) return saved;
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
}

export function t(key, vars) {
  const table = STRINGS[lang] || STRINGS.en;
  const v = table[key] ?? STRINGS.en[key] ?? key;
  return typeof v === 'function' ? v(vars || {}) : v;
}

export function setLang(next) {
  lang = STRINGS[next] ? next : 'en';
  localStorage.setItem(KEY, lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  applyTranslations();
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}
