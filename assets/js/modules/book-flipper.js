// Picture book: pages turn like leaves of a real book (two-page spreads, one page on phones).
const SINGLE = window.matchMedia('(max-width: 760px)');
const TURN_MS = 900;
const PRELOAD = 4;
const SWIPE = 40;

export function initBookFlipper() {
  document.querySelectorAll('[data-book]').forEach(setup);
}

function setup(root) {
  const stage = root.querySelector('.book-stage');
  const list = root.querySelector('.book-pages');
  const controls = root.querySelector('.book-controls');
  const prevBtn = root.querySelector('[data-book-prev]');
  const nextBtn = root.querySelector('[data-book-next]');
  const fullBtn = root.querySelector('[data-book-full]');
  const count = root.querySelector('[data-book-count]');
  const sources = Array.from(list.querySelectorAll('img'));
  if (!sources.length) return;

  const ratio = sources[0].width / sources[0].height || 1;
  const pages = sources.map(function (img) {
    return { src: img.getAttribute('src'), alt: img.alt };
  });
  list.remove();

  const volume = document.createElement('div');
  volume.className = 'book-volume';
  stage.appendChild(volume);
  controls.hidden = false;
  root.classList.add('is-ready');

  let spread = false;
  let leaves = [];
  let images = [];
  let turned = 0;
  let page = 0;
  let timer = 0;

  function face(data, side) {
    const el = document.createElement('div');
    el.className = 'book-face book-face--' + side;
    if (!data) {
      el.classList.add('is-blank');
      return el;
    }
    const img = document.createElement('img');
    img.alt = data.alt;
    img.decoding = 'async';
    img.draggable = false;
    img.dataset.src = data.src;
    el.appendChild(img);
    images.push(img);
    return el;
  }

  function build() {
    spread = !SINGLE.matches;
    const per = spread ? 2 : 1;
    leaves = [];
    images = [];
    volume.replaceChildren();
    volume.classList.toggle('is-spread', spread);
    for (let i = 0; i < pages.length; i += per) {
      const leaf = document.createElement('div');
      leaf.className = 'book-leaf';
      leaf.appendChild(face(pages[i], 'front'));
      if (spread) leaf.appendChild(face(pages[i + 1], 'back'));
      volume.appendChild(leaf);
      leaves.push(leaf);
    }
    turned = spread ? Math.floor((page + 1) / 2) : page;
    instant();
    size();
  }

  function maxTurned() {
    return spread ? Math.floor(pages.length / 2) : pages.length - 1;
  }

  // Indexes of the pages currently facing the reader.
  function visible() {
    if (!spread) return [turned];
    return [2 * turned - 1, 2 * turned].filter(function (i) {
      return i >= 0 && i < pages.length;
    });
  }

  function load() {
    const shown = visible();
    const from = Math.max(0, shown[0] - PRELOAD);
    const to = Math.min(images.length - 1, shown[shown.length - 1] + PRELOAD);
    for (let i = from; i <= to; i++) {
      const img = images[i];
      if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    }
  }

  function render() {
    const n = leaves.length;
    leaves.forEach(function (leaf, i) {
      const isTurned = i < turned;
      leaf.classList.toggle('is-turned', isTurned);
      leaf.style.zIndex = leaf.classList.contains('is-moving') ? leaf.style.zIndex : String(isTurned ? i + 1 : n - i);
    });

    let shift = 0;
    if (spread && turned === 0) shift = -25;
    else if (spread && 2 * turned >= pages.length) shift = 25;
    volume.style.transform = shift ? 'translateX(' + shift + '%)' : '';

    const shown = visible().map(function (i) { return i + 1; });
    count.textContent = shown.join('–') + ' / ' + pages.length;
    prevBtn.disabled = turned === 0;
    nextBtn.disabled = turned === maxTurned();
    load();
  }

  function instant() {
    volume.classList.add('no-anim');
    leaves.forEach(function (leaf) { leaf.classList.remove('is-moving'); });
    render();
    void volume.offsetWidth;
    volume.classList.remove('no-anim');
  }

  function go(target) {
    target = Math.max(0, Math.min(maxTurned(), target));
    if (target === turned) return;
    const n = leaves.length;
    const forward = target > turned;
    const lo = Math.min(target, turned);
    const hi = Math.max(target, turned);
    // Leaves in motion ride above both stacks until they land.
    for (let i = lo; i < hi; i++) {
      leaves[i].classList.add('is-moving');
      leaves[i].style.zIndex = String(n + 1 + (forward ? i : n - i));
    }
    turned = target;
    page = visible()[0];
    render();
    clearTimeout(timer);
    timer = setTimeout(function () {
      leaves.forEach(function (leaf) { leaf.classList.remove('is-moving'); });
      render();
    }, TURN_MS);
  }

  function next() { go(turned + 1); }
  function prev() { go(turned - 1); }

  function size() {
    const header = document.querySelector('.header');
    const full = document.fullscreenElement === root;
    const chrome = (full ? 0 : (header ? header.offsetHeight : 0)) + controls.offsetHeight + (full ? 64 : 140);
    const maxH = Math.max(220, window.innerHeight - chrome);
    const per = spread ? 2 : 1;
    const pageW = Math.floor(Math.min(stage.clientWidth / per, maxH * ratio));
    volume.style.width = pageW * per + 'px';
    volume.style.height = Math.round(pageW / ratio) + 'px';
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  let startX = null;
  volume.addEventListener('pointerdown', function (e) {
    if (e.button === 0) startX = e.clientX;
  });
  volume.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE) {
      if (dx < 0) next(); else prev();
      return;
    }
    const box = stage.getBoundingClientRect();
    if (e.clientX - box.left > box.width / 2) next(); else prev();
  });
  volume.addEventListener('pointercancel', function () { startX = null; });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const keys = { ArrowRight: next, ArrowLeft: prev, Home: function () { go(0); }, End: function () { go(maxTurned()); } };
    if (!keys[e.key]) return;
    e.preventDefault();
    keys[e.key]();
  });

  if (fullBtn && root.requestFullscreen) {
    fullBtn.hidden = false;
    fullBtn.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', function () {
      const full = document.fullscreenElement === root;
      root.classList.toggle('is-fullscreen', full);
      fullBtn.setAttribute('aria-label', full ? 'Exit full screen' : 'Full screen');
      size();
    });
  }

  SINGLE.addEventListener('change', build);
  window.addEventListener('resize', size);
  build();
}
