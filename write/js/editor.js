// Contenteditable screenplay editor. The DOM is the model: every direct child of
// the editor is a <p class="el" data-type="..."> block.

import {
  TYPES, PLACEHOLDERS, NEXT_ON_ENTER, ON_EMPTY_ENTER,
  detectType, nextType, prevType, splitSpeaker,
} from './elements.js';

export class Editor {
  constructor(root) {
    this.root = root;
    this.format = 'hollywood';
    this.listeners = { change: [], selection: [] };
    this.root.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.root.addEventListener('input', () => this.onInput());
    this.root.addEventListener('paste', (e) => this.onPaste(e));
    document.addEventListener('selectionchange', () => {
      if (this.root.contains(document.activeElement) || document.activeElement === this.root) {
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
      const converted = ON_EMPTY_ENTER[type];
      if (converted) {
        block.textContent = '';
        this.setType(converted, block);
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
  }

  handleTab(shift) {
    const block = this.currentBlock();
    if (!block) return;
    this.setType(shift ? prevType(block.dataset.type) : nextType(block.dataset.type), block);
  }

  onKeyDown(e) {
    // Enter/Tab that confirm an IME candidate (Zhuyin, Pinyin, Cangjie…) belong to the IME.
    if (e.isComposing || e.keyCode === 229) return;
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

  onInput() {
    this.normalize();
    this.stripActionMarkers();
    this.emit('change');
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
