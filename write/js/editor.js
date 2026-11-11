// Contenteditable screenplay editor. The DOM is the model: every direct child of
// the editor is a <p class="el" data-type="..."> block.

import {
  TYPES, PLACEHOLDERS, NEXT_ON_ENTER, ON_EMPTY_ENTER, TAB_ON_EMPTY, TAB_AT_END,
  detectType, nextType, prevType, splitSpeaker,
} from './elements.js';
import { suggestionsFor, nextSpeaker } from './suggest.js';
import { Popup } from './popup.js';
import { t } from './i18n.js';

export class Editor {
  constructor(root) {
    this.root = root;
    this.format = 'hollywood';
    this.listeners = { change: [], selection: [] };
    this.root.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('compositionend', () => this.assist());
    this.root.addEventListener('paste', (e) => this.onPaste(e));
    this.root.addEventListener('blur', () => this.popup.hide());
    this.popup = new Popup();
    this.popupBlock = null;
    document.addEventListener('selectionchange', () => {
      if (this.root.contains(document.activeElement) || document.activeElement === this.root) {
        this.onSelectionChange();
        this.emit('selection');
      }
    });
  }

  on(event, fn) { this.listeners[event].push(fn); }
  emit(event) { for (const fn of this.listeners[event]) fn(this); }

  // ---- Model <-> DOM ----------------------------------------------------

  createBlock(type = 'action', text = '') {
    const p = document.createElement('p');
    p.className = 'el';
    this.applyType(p, type);
    if (text) p.textContent = text;
    return p;
  }

  applyType(block, type) {
    if (!TYPES.includes(type)) type = 'action';
    block.dataset.type = type;
    block.dataset.placeholder = (PLACEHOLDERS[this.format] || PLACEHOLDERS.hollywood)[type];
  }

  setFormat(format) {
    this.format = PLACEHOLDERS[format] ? format : 'hollywood';
    document.body.dataset.format = this.format;
    this.blocks().forEach((b) => this.applyType(b, b.dataset.type));
    this.stripActionMarkers();
  }

  // In Taiwan format the leading △ on action lines is drawn by CSS, so a typed
  // or imported △ is removed from the text to avoid showing it twice.
  stripActionMarkers() {
    if (this.format !== 'tw') return;
    const cur = this.currentBlock();
    for (const b of this.blocks()) {
      if (b.dataset.type !== 'action') continue;
      const m = b.textContent.match(/^[△▲]\s*/);
      if (!m) continue;
      const offset = b === cur ? this.caretOffset(b) : -1;
      b.textContent = b.textContent.slice(m[0].length);
      if (offset >= 0) this.placeCaret(b, Math.max(0, offset - m[0].length));
    }
  }

  load(blocks) {
    this.root.innerHTML = '';
    const list = blocks && blocks.length ? blocks : [{ type: 'scene', text: '' }];
    for (const b of list) this.root.appendChild(this.createBlock(b.type, b.text));
    this.stripActionMarkers();
    this.emit('selection');
  }

  getBlocks() {
    return this.blocks().map((b) => ({ type: b.dataset.type, text: blockText(b) }));
  }

  blocks() { return Array.from(this.root.querySelectorAll(':scope > .el')); }

  // ---- Selection helpers -------------------------------------------------

  currentBlock() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node === this.root) {
      const idx = Math.min(sel.getRangeAt(0).startOffset, this.root.childNodes.length - 1);
      node = this.root.childNodes[idx] || null;
    }
    while (node && node.parentNode !== this.root) node = node.parentNode;
    return node && node.classList && node.classList.contains('el') ? node : null;
  }

  placeCaret(block, offset = 0) {
    const range = document.createRange();
    const sel = window.getSelection();
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.length) { range.setStart(node, remaining); break; }
      remaining -= node.length;
      const next = walker.nextNode();
      if (!next) { range.setStart(node, node.length); break; }
      node = next;
    }
    if (!node) range.setStart(block, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    block.scrollIntoView({ block: 'nearest' });
  }

  caretOffset(block) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0).cloneRange();
    range.selectNodeContents(block);
    range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return range.toString().length;
  }

  focusBlock(block) {
    this.root.focus();
    this.placeCaret(block, blockText(block).length);
    block.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---- Commands ---------------------------------------------------------

  setType(type, block = this.currentBlock()) {
    if (!block) return;
    const offset = this.caretOffset(block);
    this.applyType(block, type);
    this.placeCaret(block, offset);
    this.emit('change');
    this.emit('selection');
  }

  currentType() {
    const b = this.currentBlock();
    return b ? b.dataset.type : null;
  }

  splitAtCaret(block) {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const tail = document.createRange();
    tail.setStart(range.endContainer, range.endOffset);
    tail.setEndAfter(block.lastChild || block);
    const after = tail.toString();
    tail.deleteContents();
    return after;
  }

  handleEnter() {
    const block = this.currentBlock();
    if (!block) return;
    const text = blockText(block);
    const type = block.dataset.type;

    if (!text.trim()) {
      if (type === 'character' && block.dataset.suggest) {
        block.textContent = block.dataset.suggest;
        this.placeCaret(block, block.textContent.length);
      } else {
        this.showTypePicker(block);
        return;
      }
    }

    const after = this.splitAtCaret(block);
    let before = blockText(block);
    let detected = detectType(before, type);

    if (this.format === 'tw' && (type === 'action' || type === 'character') && !after) {
      const speaker = splitSpeaker(before);
      if (speaker) {
        block.textContent = speaker.name;
        this.applyType(block, 'character');
        const dlg = this.createBlock('dialogue', speaker.dialogue);
        block.after(dlg);
        const target = speaker.dialogue ? this.createBlock('character') : dlg;
        if (speaker.dialogue) dlg.after(target);
        this.placeCaret(target, 0);
        this.emit('change');
        this.emit('selection');
        this.afterMove(target);
        return;
      }
      if (/^△\s*/.test(before) && type === 'action') {
        before = before.replace(/^△\s*/, '');
        block.textContent = before;
        detected = detectType(before, type);
      }
    }

    if (detected !== type) this.applyType(block, detected);
    if (!before) block.innerHTML = '';

    const next = this.createBlock(NEXT_ON_ENTER[detected] || 'action', after.replace(/^\n/, ''));
    block.after(next);
    this.placeCaret(next, 0);
    this.emit('change');
    this.emit('selection');
    this.afterMove(next);
  }

  // Tab: empty line → change type (Action → Character → Transition …);
  // end of a line → start a new element (Action/Dialogue → Character, Character → Parenthetical);
  // middle of a line → cycle the type. Shift+Tab always cycles backwards.
  handleTab(shift) {
    const block = this.currentBlock();
    if (!block) return;
    const type = block.dataset.type;
    const text = blockText(block);
    if (shift) {
      this.setType(prevType(type), block);
    } else if (!text.trim()) {
      block.textContent = '';
      this.setType(TAB_ON_EMPTY[type], block);
    } else if (this.caretOffset(block) === text.length) {
      const detected = detectType(text, type);
      if (detected !== type) this.applyType(block, detected);
      const next = this.createBlock(TAB_AT_END[detected]);
      block.after(next);
      this.placeCaret(next, 0);
      this.emit('change');
      this.emit('selection');
      this.afterMove(next);
      return;
    } else {
      this.setType(nextType(type), block);
    }
    this.afterMove(block);
  }

  // ---- Suggestions --------------------------------------------------------

  afterMove(block) {
    this.updateGhost();
    this.assist(block);
  }

  caretAtEnd(block) {
    return this.caretOffset(block) === blockText(block).length;
  }

  // Anchor for the popup: caret x, just below the current block.
  caretRect(block) {
    const box = block.getBoundingClientRect();
    let left = box.left;
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const r = sel.getRangeAt(0).cloneRange();
      r.collapse(true);
      const rect = r.getClientRects()[0];
      if (rect && rect.top < box.bottom && rect.bottom > box.top) left = rect.left;
    }
    return { left, top: box.top, bottom: box.bottom };
  }

  context(block) {
    const all = this.blocks();
    const idx = all.indexOf(block);
    const data = all.map((b) => ({ type: b.dataset.type, text: blockText(b) }));
    return {
      format: this.format,
      blocks: data.filter((_, i) => i !== idx),
      before: data.slice(0, idx),
      sceneNumber: data.slice(0, idx).filter((b) => b.type === 'scene').length + 1,
    };
  }

  // Autocomplete for the line being typed (names, INT./EXT., locations, times, transitions).
  assist(block = this.currentBlock()) {
    if (!block || !this.caretAtEnd(block)) { this.popup.hide(); return; }
    const items = suggestionsFor(block.dataset.type, blockText(block), this.context(block));
    if (!items.length) { this.popup.hide(); return; }
    this.popupBlock = block;
    this.popup.show(items, {
      anchor: this.caretRect(block),
      onPick: (item, how) => this.acceptSuggestion(block, item, how),
    });
  }

  acceptSuggestion(block, item, how) {
    if (item.type) this.applyType(block, item.type);
    block.textContent = item.value;
    this.placeCaret(block, item.value.length);
    this.emit('change');
    if (!item.final) this.assist(block);
    else if (how === 'Enter') this.handleEnter();
  }

  // Enter on an empty line: choose what it should become.
  showTypePicker(block) {
    const items = TYPES.map((type, i) => ({ label: t(`el.${type}`), value: type, hint: String(i + 1) }));
    this.popupBlock = block;
    this.popup.show(items, {
      anchor: this.caretRect(block),
      index: TYPES.indexOf(ON_EMPTY_ENTER[block.dataset.type]),
      onPick: (item) => {
        block.textContent = '';
        this.setType(item.value, block);
        this.afterMove(block);
      },
    });
  }

  // An empty Character line shows the likely next speaker; Space, → or Enter accepts it.
  updateGhost() {
    const cur = this.currentBlock();
    for (const b of this.root.querySelectorAll(':scope > .el[data-suggest]')) {
      if (b !== cur) delete b.dataset.suggest;
    }
    if (!cur) return;
    const empty = !blockText(cur);
    if (!empty) delete cur.dataset.nosuggest;
    const name = cur.dataset.type === 'character' && empty && !cur.dataset.nosuggest
      ? nextSpeaker(this.context(cur).before) : null;
    if (name) cur.dataset.suggest = name;
    else delete cur.dataset.suggest;
  }

  acceptGhost(block) {
    block.textContent = block.dataset.suggest;
    delete block.dataset.suggest;
    this.placeCaret(block, block.textContent.length);
    this.popup.hide();
    this.emit('change');
  }

  onSelectionChange() {
    const cur = this.currentBlock();
    if (this.popup.open && (cur !== this.popupBlock || !cur || !this.caretAtEnd(cur))) this.popup.hide();
    this.updateGhost();
  }

  onKeyDown(e) {
    // Enter/Tab that confirm an IME candidate (Zhuyin, Pinyin, Cangjie…) belong to the IME.
    if (e.isComposing || e.keyCode === 229) return;
    if (this.popup.handleKey(e)) return;
    const block = this.currentBlock();
    if (block && block.dataset.suggest && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.acceptGhost(block);
        return;
      }
      if (e.key === 'Escape') {
        block.dataset.nosuggest = '1';
        delete block.dataset.suggest;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.handleEnter();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this.handleTab(e.shiftKey);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[1-6]$/.test(e.key)) {
      e.preventDefault();
      this.setType(TYPES[Number(e.key) - 1]);
    }
  }

  onInput(e) {
    this.normalize();
    this.stripActionMarkers();
    this.autoCapitalize();
    this.emit('change');
    this.updateGhost();
    if (!(e && e.isComposing)) this.assist();
  }

  // Hollywood: capitalize the first letter of Action and Dialogue lines.
  autoCapitalize() {
    if (this.format !== 'hollywood') return;
    const block = this.currentBlock();
    if (!block || !['action', 'dialogue'].includes(block.dataset.type)) return;
    const text = blockText(block);
    if (text.length === 1 && /[a-z]/.test(text)) {
      block.textContent = text.toUpperCase();
      this.placeCaret(block, 1);
    }
  }

  onPaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    const block = this.currentBlock() || this.blocks()[0];
    const lines = text.replace(/\r\n?/g, '\n').split('\n');

    if (lines.length === 1) {
      document.execCommand('insertText', false, text);
      return;
    }

    const after = this.splitAtCaret(block);
    let cursor = block;
    lines.forEach((line, i) => {
      if (i === 0) {
        block.textContent = blockText(block) + line;
        return;
      }
      if (!line.trim()) return;
      const type = detectType(line, 'action');
      const nb = this.createBlock(type, line);
      cursor.after(nb);
      cursor = nb;
    });
    if (after) {
      const nb = this.createBlock(cursor.dataset.type, after);
      cursor.after(nb);
      cursor = nb;
    }
    this.placeCaret(cursor, blockText(cursor).length);
    this.emit('change');
  }

  // Keep the DOM in the shape we expect no matter what the browser did.
  normalize() {
    for (const node of Array.from(this.root.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('el')) {
        if (!node.dataset.placeholder) this.applyType(node, node.dataset.type || 'action');
        if (node.innerHTML === '<br>') node.innerHTML = '';
        continue;
      }
      const text = node.textContent;
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') { node.remove(); continue; }
      const p = this.createBlock('action', text);
      this.root.replaceChild(p, node);
      if (text) this.placeCaret(p, text.length);
    }
    if (!this.root.querySelector(':scope > .el')) {
      const p = this.createBlock('action');
      this.root.appendChild(p);
      this.placeCaret(p, 0);
    }
  }
}

export function blockText(block) {
  // innerText turns <br> into newlines; trim the trailing newline Chrome adds.
  return block.innerText.replace(/\u200b/g, '').replace(/\n$/, '');
}
