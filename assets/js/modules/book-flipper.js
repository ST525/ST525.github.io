// Picture book: pages turn like leaves of a real book (two-page spreads, one page on phones).
const SINGLE = window.matchMedia('(max-width: 760px)');
const TURN_MS = 900;
const HOLD_MS = 350;
const REPEAT_MS = 160;
const FAST_MS = 320;
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

  const ratio = Number(sources[0].getAttribute('width')) / Number(sources[0].getAttribute('height')) || 1;
  const pages = sources.map(function (img) {
    return { src: img.getAttribute('src'), alt: img.alt };
  });
  list.remove();

  const volume = document.createElement('div');
  volume.className = 'book-volume';
  volume.tabIndex = -1;
  stage.appendChild(volume);
  controls.hidden = false;
  root.classList.add('is-ready');

  const zoomOverlay = document.createElement('div');
  zoomOverlay.className = 'book-zoom';
  zoomOverlay.setAttribute('role', 'dialog');
  zoomOverlay.setAttribute('aria-modal', 'true');
  zoomOverlay.hidden = true;

  const zoomImage = document.createElement('img');
  zoomImage.alt = '';
  zoomImage.draggable = false;
  zoomOverlay.appendChild(zoomImage);

  const zoomClose = document.createElement('button');
  zoomClose.type = 'button';
  zoomClose.className = 'book-btn book-zoom-close';
  zoomClose.setAttribute('aria-label', 'Close');
  zoomClose.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  zoomOverlay.appendChild(zoomClose);
  document.body.appendChild(zoomOverlay);

  let spread = false;
  let leaves = [];
  let images = [];
  let turned = 0;
  let page = 0;
  let timer = 0;
  let fastClassTimer = 0;
  let zoomScale = 1;
  let zoomX = 0;
  let zoomY = 0;
  let zoomFocus = null;
  let lastZoomTap = 0;
  let lastZoomTapX = 0;
  let lastZoomTapY = 0;
  let backdropPointer = null;
  const zoomPointers = new Map();
  let zoomGesture = null;

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
    const turnMs = volume.classList.contains('is-fast') ? FAST_MS : TURN_MS;
    timer = setTimeout(function () {
      leaves.forEach(function (leaf) { leaf.classList.remove('is-moving'); });
      render();
    }, turnMs);
    if (volume.classList.contains('is-fast')) scheduleFastModeRemoval();
  }

  function next() { go(turned + 1); }
  function prev() { go(turned - 1); }

  function setFastMode() {
    clearTimeout(fastClassTimer);
    volume.classList.add('is-fast');
  }

  function scheduleFastModeRemoval() {
    clearTimeout(fastClassTimer);
    fastClassTimer = setTimeout(function () {
      volume.classList.remove('is-fast');
    }, FAST_MS);
  }

  function bindArrow(button, turn) {
    let pressPointer = null;
    let holdTimer = 0;
    let repeatTimer = 0;
    let longPress = false;
    let swallowClick = false;

    function endPress() {
      if (pressPointer === null) return;
      clearTimeout(holdTimer);
      clearInterval(repeatTimer);
      holdTimer = 0;
      repeatTimer = 0;
      pressPointer = null;
      if (longPress) swallowClick = true;
      longPress = false;
    }

    button.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || button.disabled) return;
      endPress();
      swallowClick = false;
      pressPointer = e.pointerId;
      longPress = false;
      holdTimer = setTimeout(function () {
        holdTimer = 0;
        if (pressPointer === null || button.disabled) return;
        longPress = true;
        setFastMode();
        turn();
        if (button.disabled) return;
        repeatTimer = setInterval(function () {
          if (pressPointer === null || button.disabled) {
            clearInterval(repeatTimer);
            repeatTimer = 0;
            return;
          }
          turn();
          if (button.disabled) {
            clearInterval(repeatTimer);
            repeatTimer = 0;
          }
        }, REPEAT_MS);
      }, HOLD_MS);
    });
    button.addEventListener('pointerup', function (e) {
      if (e.pointerId === pressPointer) endPress();
    });
    button.addEventListener('pointerleave', function (e) {
      if (e.pointerId === pressPointer) endPress();
    });
    button.addEventListener('pointercancel', function (e) {
      if (e.pointerId === pressPointer) endPress();
    });
    button.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
    button.addEventListener('click', function (e) {
      if (swallowClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
        swallowClick = false;
        return;
      }
      turn();
    });
    window.addEventListener('blur', endPress);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyZoom() {
    const maxX = Math.max(0, (zoomImage.offsetWidth * zoomScale - window.innerWidth) / 2);
    const maxY = Math.max(0, (zoomImage.offsetHeight * zoomScale - window.innerHeight) / 2);
    zoomX = clamp(zoomX, -maxX, maxX);
    zoomY = clamp(zoomY, -maxY, maxY);
    zoomImage.style.transform = 'translate(' + zoomX + 'px, ' + zoomY + 'px) scale(' + zoomScale + ')';
  }

  function setZoomAt(scale, point) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const worldX = (point.x - centerX - zoomX) / zoomScale;
    const worldY = (point.y - centerY - zoomY) / zoomScale;
    zoomScale = clamp(scale, 1, 4);
    zoomX = point.x - centerX - worldX * zoomScale;
    zoomY = point.y - centerY - worldY * zoomScale;
    applyZoom();
  }

  function beginSingleZoomGesture(pointer, suppressTap) {
    zoomGesture = {
      type: 'single',
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      panX: zoomX,
      panY: zoomY,
      moved: false,
      suppressTap: Boolean(suppressTap)
    };
  }

  function beginPinchZoomGesture() {
    const points = Array.from(zoomPointers.values()).slice(0, 2);
    if (points.length < 2) return;
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    zoomGesture = {
      type: 'pinch',
      distance: Math.max(1, Math.hypot(dx, dy)),
      scale: zoomScale,
      panX: zoomX,
      panY: zoomY,
      midpointX: (points[0].x + points[1].x) / 2,
      midpointY: (points[0].y + points[1].y) / 2
    };
    lastZoomTap = 0;
  }

  function handleZoomTap(x, y) {
    const now = performance.now();
    if (now - lastZoomTap < 300 && Math.hypot(x - lastZoomTapX, y - lastZoomTapY) < 32) {
      lastZoomTap = 0;
      setZoomAt(zoomScale > 1.01 ? 1 : 2.5, { x: x, y: y });
      return;
    }
    lastZoomTap = now;
    lastZoomTapX = x;
    lastZoomTapY = y;
  }

  function onZoomPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    zoomPointers.set(e.pointerId, pointer);
    try {
      zoomImage.setPointerCapture(e.pointerId);
    } catch (err) {
      // Pointer capture may be unavailable for synthetic events.
    }
    if (zoomPointers.size === 1) beginSingleZoomGesture(pointer, false);
    else if (zoomPointers.size === 2) beginPinchZoomGesture();
  }

  function onZoomPointerMove(e) {
    const pointer = zoomPointers.get(e.pointerId);
    if (!pointer) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (zoomPointers.size >= 2) {
      if (!zoomGesture || zoomGesture.type !== 'pinch') beginPinchZoomGesture();
      if (!zoomGesture || zoomGesture.type !== 'pinch') return;
      const points = Array.from(zoomPointers.values()).slice(0, 2);
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const midpointX = (points[0].x + points[1].x) / 2;
      const midpointY = (points[0].y + points[1].y) / 2;
      const nextScale = clamp(zoomGesture.scale * distance / zoomGesture.distance, 1, 4);
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const worldX = (zoomGesture.midpointX - centerX - zoomGesture.panX) / zoomGesture.scale;
      const worldY = (zoomGesture.midpointY - centerY - zoomGesture.panY) / zoomGesture.scale;
      zoomScale = nextScale;
      zoomX = midpointX - centerX - worldX * zoomScale;
      zoomY = midpointY - centerY - worldY * zoomScale;
      applyZoom();
      return;
    }

    if (!zoomGesture || zoomGesture.type !== 'single' || zoomGesture.id !== e.pointerId) return;
    const moveX = e.clientX - zoomGesture.startX;
    const moveY = e.clientY - zoomGesture.startY;
    if (Math.hypot(moveX, moveY) > 8) zoomGesture.moved = true;
    if (zoomScale > 1 && zoomGesture.moved) {
      zoomX = zoomGesture.panX + moveX;
      zoomY = zoomGesture.panY + moveY;
      applyZoom();
    }
  }

  function finishZoomPointer(e, cancelled) {
    const pointer = zoomPointers.get(e.pointerId);
    if (!pointer) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    const wasPinch = zoomGesture && zoomGesture.type === 'pinch';
    let isTap = false;
    if (!wasPinch && zoomGesture && zoomGesture.type === 'single' && zoomGesture.id === e.pointerId) {
      const moveX = e.clientX - zoomGesture.startX;
      const moveY = e.clientY - zoomGesture.startY;
      if (Math.hypot(moveX, moveY) > 8) zoomGesture.moved = true;
      isTap = !cancelled && !zoomGesture.moved && !zoomGesture.suppressTap;
    }
    zoomPointers.delete(e.pointerId);
    if (wasPinch) {
      lastZoomTap = 0;
      if (zoomPointers.size >= 2) beginPinchZoomGesture();
      else if (zoomPointers.size === 1) beginSingleZoomGesture(zoomPointers.values().next().value, true);
      else zoomGesture = null;
      return;
    }
    zoomGesture = null;
    if (isTap) handleZoomTap(e.clientX, e.clientY);
  }

  function closeZoom() {
    if (zoomOverlay.hidden) return;
    zoomOverlay.hidden = true;
    document.body.classList.remove('lightbox-open');
    zoomPointers.clear();
    zoomGesture = null;
    backdropPointer = null;
    zoomScale = 1;
    zoomX = 0;
    zoomY = 0;
    zoomImage.style.transform = '';
    const target = zoomFocus && zoomFocus !== document.body && zoomFocus.isConnected ? zoomFocus : volume;
    zoomFocus = null;
    target.focus({ preventScroll: true });
  }

  function openZoom() {
    if (!SINGLE.matches) return;
    const data = pages[turned];
    if (!data) return;
    const title = (root.getAttribute('aria-label') || 'Picture book').replace(/,\s*picture book$/i, '');
    zoomFocus = document.activeElement;
    zoomImage.src = data.src;
    zoomImage.alt = data.alt;
    zoomImage.setAttribute('aria-label', title + ' page ' + (turned + 1));
    zoomOverlay.setAttribute('aria-label', title + ' page ' + (turned + 1));
    zoomScale = 1;
    zoomX = 0;
    zoomY = 0;
    lastZoomTap = 0;
    zoomImage.style.transform = 'translate(0px, 0px) scale(1)';
    zoomOverlay.hidden = false;
    document.body.classList.add('lightbox-open');
    zoomClose.focus({ preventScroll: true });
  }

  zoomImage.addEventListener('load', function () {
    if (!zoomOverlay.hidden) applyZoom();
  });
  zoomImage.addEventListener('pointerdown', onZoomPointerDown);
  zoomImage.addEventListener('pointermove', onZoomPointerMove);
  zoomImage.addEventListener('pointerup', function (e) { finishZoomPointer(e, false); });
  zoomImage.addEventListener('pointercancel', function (e) { finishZoomPointer(e, true); });
  zoomClose.addEventListener('click', closeZoom);
  zoomOverlay.addEventListener('pointerdown', function (e) {
    if (e.target === zoomOverlay && e.button === 0) {
      backdropPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  });
  zoomOverlay.addEventListener('pointerup', function (e) {
    if (!backdropPointer || backdropPointer.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - backdropPointer.x, e.clientY - backdropPointer.y);
    backdropPointer = null;
    if (moved <= SWIPE && zoomScale === 1) closeZoom();
  });
  zoomOverlay.addEventListener('pointercancel', function (e) {
    if (backdropPointer && backdropPointer.id === e.pointerId) backdropPointer = null;
  });

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

  bindArrow(prevBtn, prev);
  bindArrow(nextBtn, next);

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
    if (SINGLE.matches) {
      openZoom();
      return;
    }
    const box = stage.getBoundingClientRect();
    if (e.clientX - box.left > box.width / 2) next(); else prev();
  });
  volume.addEventListener('pointercancel', function () { startX = null; });

  document.addEventListener('keydown', function (e) {
    if (!zoomOverlay.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeZoom();
      }
      return;
    }
    if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const keys = { ArrowRight: next, ArrowLeft: prev, Home: function () { go(0); }, End: function () { go(maxTurned()); } };
    if (!keys[e.key]) return;
    e.preventDefault();
    if (e.repeat && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) setFastMode();
    keys[e.key]();
    if (e.repeat && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) scheduleFastModeRemoval();
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

  SINGLE.addEventListener('change', function () {
    if (!SINGLE.matches) closeZoom();
    build();
  });
  window.addEventListener('resize', function () {
    size();
    if (!zoomOverlay.hidden) applyZoom();
  });
  build();
}
