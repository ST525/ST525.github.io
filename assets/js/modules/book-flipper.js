// Picture book: pages turn like leaves of a real book (two-page spreads, one page on phones).
const SINGLE = window.matchMedia('(max-width: 760px)');
const TURN_MS = 900;
const HOLD_MS = 350;
const REPEAT_MS = 160;
const FAST_MS = 320;
const PRELOAD = 4;
const SWIPE = 40;
const CURL_STRIPS = 8;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  let curlStates = [];
  let images = [];
  let turned = 0;
  let page = 0;
  let pageWidth = 0;
  let patch = null;
  let patchTimer = 0;
  let turnTimers = new WeakMap();
  let fastClassTimer = 0;
  let zoomFocus = null;
  let zoomOpenedAt = 0;

  function face(data, side) {
    const el = document.createElement('div');
    el.className = 'book-face book-face--' + side;
    const shade = document.createElement('div');
    shade.className = 'book-face-shade';
    if (!data) {
      el.classList.add('is-blank');
      el.appendChild(shade);
      return el;
    }
    const img = document.createElement('img');
    img.alt = data.alt;
    img.decoding = 'async';
    img.draggable = false;
    img.dataset.src = data.src;
    el.append(img, shade);
    images.push(img);
    return el;
  }

  function clearTurnTimer(leaf) {
    clearTimeout(turnTimers.get(leaf));
    turnTimers.delete(leaf);
  }

  function finishTurn(leaf) {
    clearTurnTimer(leaf);
    leaf.classList.remove('is-moving', 'is-turning', 'is-curl-fwd', 'is-curl-back');
    if (patch && !volume.querySelector('.book-leaf.is-moving')) patch.classList.remove('is-on');
    if (leaf.isConnected) render();
  }

  // While a leaf turns, Chrome feathers its edge along the spine, and the
  // resting right leaf's 0.5px face overhang shows through as a hairline on
  // the left page. A 2px sliver of the page that is under the moving leaf's
  // root sits above the resting leaves (and under the moving one) so the
  // blend is invisible. Going forward that is the current left page until the
  // leaf passes the spine, then the page landing there; the patch also reaches
  // half a pixel past the spine so the pixel the spine splits isn't half next
  // page.
  function showPatch(leftPage, forward) {
    if (!patch || !spread) return;
    const src = pageImage(leftPage);
    if (!src) {
      patch.classList.remove('is-on');
      return;
    }
    patch.style.backgroundImage = 'url("' + src.replace(/["\\]/g, '\\$&') + '")';
    patch.style.width = forward ? '2.5px' : '2px';
    patch.style.backgroundSize = (forward ? pageWidth + 1 : pageWidth) + 'px 100%';
    patch.style.backgroundPositionX = (2 - pageWidth) + 'px';
    patch.style.zIndex = String(leaves.length + 1);
    patch.classList.add('is-on');
  }

  function build() {
    spread = !SINGLE.matches;
    const per = spread ? 2 : 1;
    leaves.forEach(clearTurnTimer);
    leaves = [];
    curlStates = [];
    images = [];
    volume.replaceChildren();
    volume.classList.toggle('is-spread', spread);
    const back = document.createElement('div');
    back.className = 'book-back';
    const backRight = document.createElement('div');
    backRight.className = 'book-cover-edge-face book-cover-edge--right';
    const backBottom = document.createElement('div');
    backBottom.className = 'book-cover-edge-face book-cover-edge--bottom';
    back.append(backRight, backBottom);
    volume.appendChild(back);
    patch = document.createElement('div');
    patch.className = 'book-spine-patch';
    volume.appendChild(patch);
    for (let i = 0; i < pages.length; i += per) {
      const leaf = document.createElement('div');
      leaf.className = 'book-leaf';
      leaf.addEventListener('transitionend', function (event) {
        if (event.target === leaf && event.propertyName === 'transform') finishTurn(leaf);
      });
      if (i === 0) {
        leaf.classList.add('book-leaf--cover');
        const board = document.createElement('div');
        board.className = 'book-cover-board';
        const edge = document.createElement('div');
        edge.className = 'book-cover-edge';
        const rightEdge = document.createElement('div');
        rightEdge.className = 'book-cover-edge-face book-cover-edge--right';
        const bottomEdge = document.createElement('div');
        bottomEdge.className = 'book-cover-edge-face book-cover-edge--bottom';
        leaf.append(board, edge, rightEdge, bottomEdge);
      }
      leaf.appendChild(face(pages[i], 'front'));
      if (spread) leaf.appendChild(face(pages[i + 1], 'back'));
      volume.appendChild(leaf);
      leaves.push(leaf);
      curlStates.push({ root: null, strips: [] });
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

  function pageImage(index) {
    const img = images[index];
    if (!img) return '';
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
    return img.currentSrc || img.src;
  }

  function ensureCurl(index) {
    const state = curlStates[index];
    if (!state || state.root) return;
    const frontIndex = spread ? index * 2 : index;
    const frontSrc = pageImage(frontIndex);
    const backSrc = spread ? pageImage(index * 2 + 1) : '';
    const root = document.createElement('div');
    root.className = 'book-curl';

    let parent = root;
    for (let k = 0; k < CURL_STRIPS; k++) {
      const strip = document.createElement('div');
      strip.className = 'book-curl-strip' + (k === 0 ? ' is-root' : '');

      const front = document.createElement('div');
      front.className = 'book-curl-face book-curl-face--front';
      const back = spread ? document.createElement('div') : null;
      if (back) back.className = 'book-curl-face book-curl-face--back';
      const shade = document.createElement('div');
      shade.className = 'book-curl-shade';

      if (frontSrc) front.style.backgroundImage = 'url("' + frontSrc.replace(/["\\]/g, '\\$&') + '")';
      else front.classList.add('is-blank');
      front.appendChild(shade);
      if (back) {
        if (backSrc) back.style.backgroundImage = 'url("' + backSrc.replace(/["\\]/g, '\\$&') + '")';
        else back.classList.add('is-blank');
        back.appendChild(shade.cloneNode());
      }

      strip.style.setProperty('--curl-k', (45 * k / 28).toFixed(4));
      strip.style.setProperty('--curl-k-fast', (20 * k / 28).toFixed(4));
      strip.style.setProperty('--curl-shade-opacity', (0.25 * k / (CURL_STRIPS - 1)).toFixed(4));
      strip.style.setProperty('--curl-shade-start', (k ? (k - 1) / k : 0).toFixed(4));
      strip.style.setProperty('--curl-shade-end', k ? '1' : '0');
      strip.appendChild(front);
      if (back) strip.appendChild(back);
      parent.appendChild(strip);
      state.strips.push({ element: strip, front: front, back: back });
      parent = strip;
    }

    state.root = root;
    leaves[index].appendChild(root);
    sizeCurl(index);
  }

  function sizeCurl(index) {
    const state = curlStates[index];
    if (!state || !state.root || !pageWidth) return;
    const deviceScale = window.devicePixelRatio || 1;
    const rawStripWidth = pageWidth / CURL_STRIPS;
    const stripWidth = deviceScale > 1
      ? Math.round(rawStripWidth * deviceScale) / deviceScale
      : rawStripWidth;
    const overlap = deviceScale > 1 ? 2 : 1;
    const last = CURL_STRIPS - 1;
    state.strips.forEach(function (strip, k) {
      const width = k === last ? pageWidth - last * stripWidth : stripWidth + overlap;
      strip.element.style.left = (k === 0 ? 0 : stripWidth) + 'px';
      strip.element.style.width = width + 'px';
      strip.front.style.backgroundSize = pageWidth + 'px 100%';
      strip.front.style.backgroundPositionX = (-k * stripWidth) + 'px';
      if (strip.back) {
        strip.back.style.backgroundSize = (k ? pageWidth : pageWidth + 1) + 'px 100%';
        strip.back.style.backgroundPositionX = (-(pageWidth - k * stripWidth - width)) + 'px';
      }
    });
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
    volume.style.transform = shift ? 'translateX(' + shift + '%)' : '';

    const shown = visible().map(function (i) { return i + 1; });
    count.textContent = shown.join('–') + ' / ' + pages.length;
    prevBtn.disabled = turned === 0;
    nextBtn.disabled = turned === maxTurned();
    load();
  }

  function instant() {
    volume.classList.add('no-anim');
    leaves.forEach(function (leaf) {
      clearTurnTimer(leaf);
      leaf.classList.remove('is-moving', 'is-turning', 'is-curl-fwd', 'is-curl-back');
    });
    clearTimeout(patchTimer);
    if (patch) patch.classList.remove('is-on');
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
    const jump = hi - lo;
    // Leaves in motion ride above both stacks until they land.
    for (let i = lo; i < hi; i++) {
      const leaf = leaves[i];
      const retargeted = leaf.classList.contains('is-moving') || leaf.classList.contains('is-turning');
      const shouldCurl = !leaf.classList.contains('book-leaf--cover') &&
        !retargeted && !REDUCED_MOTION.matches && jump <= 3;
      leaf.classList.add('is-moving', 'is-turning');
      leaf.classList.remove('is-curl-fwd', 'is-curl-back');
      if (shouldCurl) {
        ensureCurl(i);
        leaf.classList.add(forward ? 'is-curl-fwd' : 'is-curl-back');
      }
      leaf.style.zIndex = String(n + 2 + (forward ? i : n - i));
    }
    const turnMs = volume.classList.contains('is-fast') ? FAST_MS : TURN_MS;
    clearTimeout(patchTimer);
    showPatch(2 * (forward ? turned : target) - 1, forward);
    if (forward) {
      patchTimer = setTimeout(function () { showPatch(2 * target - 1, true); }, turnMs / 2);
    }
    turned = target;
    page = visible()[0];
    render();
    for (let i = lo; i < hi; i++) {
      const leaf = leaves[i];
      clearTurnTimer(leaf);
      turnTimers.set(leaf, setTimeout(function () { finishTurn(leaf); }, turnMs + 100));
    }
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

  function closeZoom() {
    if (zoomOverlay.hidden) return;
    zoomOverlay.hidden = true;
    document.body.classList.remove('lightbox-open');
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
    zoomOverlay.hidden = false;
    zoomOpenedAt = performance.now();
    document.body.classList.add('lightbox-open');
    zoomClose.focus({ preventScroll: true });
  }

  zoomOverlay.addEventListener('click', function () {
    const fromOpeningTap = zoomOpenedAt && performance.now() - zoomOpenedAt < 500;
    zoomOpenedAt = 0;
    if (fromOpeningTap) return;
    closeZoom();
  });

  function size() {
    const header = document.querySelector('.header');
    const full = document.fullscreenElement === root;
    const chrome = (full ? 0 : (header ? header.offsetHeight : 0)) + controls.offsetHeight + (full ? 64 : 140);
    const maxH = Math.max(220, window.innerHeight - chrome);
    const per = spread ? 2 : 1;
    const pageW = Math.floor(Math.min(stage.clientWidth / per, maxH * ratio));
    pageWidth = pageW;
    volume.style.width = pageW * per + 'px';
    volume.style.height = Math.round(pageW / ratio) + 'px';
    curlStates.forEach(function (_, index) { sizeCurl(index); });
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

  SINGLE.addEventListener('change', build);
  window.addEventListener('resize', function () {
    size();
  });
  build();
}
