// Persistence in localStorage. Everything lives under one key.

const KEY = 'scriptwriter.v1';

export function newScript(title = '', format = 'hollywood') {
  return {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    format,
    meta: { credit: format === 'tw' ? '編劇' : 'Written by', author: '', draft: '', contact: '' },
    blocks: [{ type: 'scene', text: '' }],
    updated: Date.now(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (Array.isArray(state.scripts) && state.scripts.length) return state;
    }
  } catch (e) {
    console.warn('Could not read saved scripts', e);
  }
  const first = newScript();
  return { scripts: [first], currentId: first.id };
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name, ext) {
  const base = (name || 'untitled').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') || 'untitled';
  return base + ext;
}
