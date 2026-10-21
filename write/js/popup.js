// Small keyboard-driven dropdown shown under the caret (autocomplete and the element picker).

export class Popup {
  constructor() {
    this.el = document.createElement('ul');
    this.el.className = 'ac';
    this.el.setAttribute('role', 'listbox');
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.items = [];
    this.index = 0;
    this.onPick = null;
    this.el.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      e.preventDefault(); // keep focus in the editor
      this.pick(Number(li.dataset.i), 'click');
    });
    window.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
  }

  get open() { return !this.el.hidden; }

  show(items, { onPick, index = 0, anchor }) {
    this.items = items;
    this.index = Math.max(0, Math.min(index, items.length - 1));
    this.onPick = onPick;
    this.el.innerHTML = '';
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.dataset.i = String(i);
      li.setAttribute('role', 'option');
      li.textContent = item.label;
      if (item.hint) {
        const hint = document.createElement('span');
        hint.className = 'ac-hint';
        hint.textContent = item.hint;
        li.appendChild(hint);
      }
      this.el.appendChild(li);
    });
    this.highlight();
    this.el.hidden = false;
    const r = anchor;
    const h = this.el.offsetHeight;
    const top = r.bottom + 4 + h > window.innerHeight ? r.top - h - 4 : r.bottom + 4;
    this.el.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - this.el.offsetWidth - 4))}px`;
    this.el.style.top = `${Math.max(4, top)}px`;
  }

  hide() {
    this.el.hidden = true;
    this.items = [];
    this.onPick = null;
  }

  highlight() {
    Array.from(this.el.children).forEach((li, i) => {
      li.classList.toggle('active', i === this.index);
      li.setAttribute('aria-selected', String(i === this.index));
    });
    const active = this.el.children[this.index];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  pick(i, how) {
    const item = this.items[i];
    const cb = this.onPick;
    this.hide();
    if (item && cb) cb(item, how);
  }

  // Returns true when the key was consumed.
  handleKey(e) {
    if (!this.open || e.ctrlKey || e.metaKey || e.altKey) return false;
    const n = this.items.length;
    switch (e.key) {
      case 'ArrowDown': this.index = (this.index + 1) % n; this.highlight(); break;
      case 'ArrowUp': this.index = (this.index - 1 + n) % n; this.highlight(); break;
      case 'Enter':
      case 'Tab':
        if (e.shiftKey) return false;
        this.pick(this.index, e.key);
        break;
      case 'Escape': this.hide(); break;
      default: {
        const i = this.items.findIndex((item) => item.hint === e.key);
        if (i < 0) return false;
        this.pick(i, 'key');
      }
    }
    e.preventDefault();
    return true;
  }
}
