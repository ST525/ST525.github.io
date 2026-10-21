// Fountain (fountain.io) import / export.

import { displayText, isSceneHeading, isTransition, looksLikeCharacter } from './elements.js';

export function toFountain(script) {
  const out = [];
  const meta = script.meta || {};
  const header = [];
  if (script.title) header.push(`Title: ${script.title}`);
  if (meta.credit) header.push(`Credit: ${meta.credit}`);
  if (meta.author) header.push(`Author: ${meta.author}`);
  if (meta.draft) header.push(`Draft date: ${meta.draft}`);
  if (meta.contact) header.push('Contact:\n' + meta.contact.split('\n').map((l) => '    ' + l).join('\n'));
  if (header.length) out.push(header.join('\n'), '');

  const format = script.format || 'hollywood';
  let prev = null;
  for (const b of script.blocks) {
    const text = displayText(b.type, b.text, format).trim();
    if (!text) continue;
    const attached = (b.type === 'dialogue' || b.type === 'parenthetical') &&
      (prev === 'character' || prev === 'parenthetical' || prev === 'dialogue');
    if (!attached && out.length && out[out.length - 1] !== '') out.push('');

    switch (b.type) {
      case 'scene':
        out.push(isSceneHeading(text) ? text : '.' + text);
        break;
      case 'character':
        out.push(looksLikeCharacter(text) ? text : '@' + text);
        break;
      case 'transition':
        out.push(/TO:$/.test(text) ? text : '> ' + text);
        break;
      case 'dialogue':
        out.push(text.replace(/\n\s*\n/g, '\n  \n'));
        break;
      case 'parenthetical':
        out.push(text);
        break;
      default: {
        const forced = looksLikeCharacter(text) || isSceneHeading(text) || isTransition(text);
        const line = format === 'tw' && text ? '△' + text : text;
        out.push(forced ? '!' + line : line);
      }
    }
    prev = b.type;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function fromFountain(source) {
  let text = source.replace(/\r\n?/g, '\n');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');      // boneyard
  text = text.replace(/\[\[[\s\S]*?\]\]/g, '');      // notes
  const lines = text.split('\n');

  const script = { title: '', meta: {}, blocks: [] };
  let i = 0;

  // Title page: key: value pairs until the first blank line.
  if (/^[A-Za-z ]+:/.test(lines[0] || '')) {
    let key = null;
    while (i < lines.length && lines[i].trim() !== '') {
      const m = lines[i].match(/^([A-Za-z ]+):\s*(.*)$/);
      if (m && !/^\s/.test(lines[i])) {
        key = m[1].trim().toLowerCase();
        setMeta(script, key, m[2]);
      } else if (key) {
        setMeta(script, key, lines[i].trim(), true);
      }
      i++;
    }
  }

  // Body: paragraphs separated by blank lines.
  const paras = [];
  let cur = [];
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      if (cur.length) paras.push(cur);
      cur = [];
    } else {
      cur.push(lines[i]);
    }
  }
  if (cur.length) paras.push(cur);

  for (const p of paras) {
    const first = p[0].trim();
    if (/^#/.test(first) || /^=/.test(first)) continue; // sections & synopses
    if (/^!/.test(first)) { push('action', [first.slice(1), ...p.slice(1)]); continue; }
    if (/^\.(?!\.)/.test(first)) { push('scene', [first.slice(1)]); pushRest(p.slice(1)); continue; }
    if (/^>/.test(first) && !/<$/.test(first)) { push('transition', [first.slice(1)]); continue; }
    if (/^>.*<$/.test(first)) { push('action', p.map((l) => l.trim().replace(/^>|<$/g, '').trim())); continue; }
    if (/^~/.test(first)) { push('dialogue', p.map((l) => l.replace(/^~/, ''))); continue; }
    if (isSceneHeading(first) && p.length === 1) { push('scene', [first]); continue; }
    if (isTransition(first) && p.length === 1 && first === first.toUpperCase()) { push('transition', [first]); continue; }

    const charName = first.replace(/\^$/, '').trim();
    const bareName = charName.replace(/[(（].*[)）]\s*$/, '').trim();
    const cjkName = /^\p{Script=Han}{1,6}$/u.test(bareName);
    const isChar = /^@/.test(first) || ((looksLikeCharacter(bareName) || cjkName) && p.length > 1);
    if (isChar) {
      push('character', [charName.replace(/^@/, '')]);
      let dlg = [];
      for (const l of p.slice(1)) {
        const t = l.trim();
        if (/^\(.*\)$/.test(t) || /^（.*）$/.test(t)) {
          if (dlg.length) { push('dialogue', dlg); dlg = []; }
          push('parenthetical', [t]);
        } else {
          dlg.push(l.trim() === '' ? '' : l);
        }
      }
      if (dlg.length) push('dialogue', dlg);
      continue;
    }

    push('action', p);
  }

  function push(type, ls) {
    let text = ls.join('\n').replace(/^\s+|\s+$/g, (m) => (m.includes('\n') ? '' : m)).trim();
    if (type === 'action') text = text.replace(/^△\s*/, '');
    script.blocks.push({ type, text });
  }
  function pushRest(ls) { if (ls.length) push('action', ls); }

  return script;
}

function setMeta(script, key, value, append = false) {
  const map = { title: 'title', credit: 'credit', author: 'author', authors: 'author', 'draft date': 'draft', contact: 'contact' };
  const field = map[key];
  if (!field) return;
  if (field === 'title') {
    script.title = append && script.title ? script.title + '\n' + value : value;
    return;
  }
  const prev = script.meta[field];
  script.meta[field] = append && prev ? prev + '\n' + value : (prev && !value ? prev : value);
}
