// Picture book: pages turn like leaves of a real book (two-page spreads, one page on phones).
// One page at a time on phones held upright; sideways they get spreads.
const SINGLE = window.matchMedia('(max-width: 760px) and (orientation: portrait), (max-width: 480px)');
const TURN_MS = 600;
// The hard cover swings a little slower than a page; the volume's slide
// and the left backing's reveal (--cover-ms in CSS) keep step with it.
const COVER_MS = 850;
const HOLD_MS = 300;
const REPEAT_MS = 110;
const FAST_MS = 220;
const PRELOAD = 4;
const SWIPE = 40;
const CURL_STRIPS = 8;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

import { createPeel } from './book-peel.js';

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
  const peel = createPeel(volume);
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
    leaf.classList.remove('is-moving', 'is-turning', 'is-curl-fwd', 'is-curl-back', 'is-fast-turn', 'is-peeling');
    leaf.style.transitionDuration = '';
    if (patch && !volume.querySelector('.book-leaf.is-moving')) patch.classList.remove('is-on');
    if (leaf.isConnected) render();
  }

  // Restart an element's running transform transition from where it is now
  // so it lands within `ms`. A flat turn (the cover, or a fast flip) can be
  // hurried this way; a CSS curl animation would jump, so those are left.
  function hurryTransition(el, ms, target) {
    const now = getComputedStyle(el).transform;
    el.style.transition = 'none';
    el.style.transform = now === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : now;
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transitionDuration = ms + 'ms';
    el.style.transform = target;
  }

  function hurryFlat(leaf, ms) {
    if (!leaf.classList.contains('is-moving') || leaf.classList.contains('is-peeling') ||
      leaf.classList.contains('is-curl-fwd') || leaf.classList.contains('is-curl-back')) return;
    hurryTransition(leaf, ms, '');
    if (leaf === leaves[0]) {
      // The volume's slide and the left backing's reveal follow the cover.
      volume.style.setProperty('--cover-ms', ms + 'ms');
      hurryTransition(volume, ms, volume.style.transform);
      volume.style.transitionDuration = '';
      const back = volume.querySelector('.book-back--left');
      if (back && !volume.classList.contains('is-closed')) {
        back.style.transition = 'none';
        back.style.opacity = '0';
        void back.offsetWidth;
        back.style.transition = '';
        back.style.opacity = '';
      }
    }
  }

  // While a leaf turns, Chrome feathers its edge along the spine, and the
  // resting right leaf's 0.5px face overhang shows through as a hairline on
  // the left page. A 2.5px sliver of the page beside the moving leaf's root
  // sits above the resting leaves (and under the moving one) so the blend is
  // invisible. It reaches half a pixel past the spine so the pixel the spine
  // splits isn't half the resting right page either.
  function showPatch(leftPage) {
    if (!patch || !spread) return;
    const src = pageImage(leftPage);
    if (!src) {
      patch.classList.remove('is-on');
      return;
    }
    patch.style.backgroundImage = 'url("' + src.replace(/["\\]/g, '\\$&') + '")';
    patch.style.width = '2.5px';
    patch.style.backgroundSize = (pageWidth + 1) + 'px 100%';
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
    peel.cancelAll();
    volume.replaceChildren();
    if (peel.canvas) volume.appendChild(peel.canvas);
    volume.classList.toggle('is-spread', spread);
    const back = document.createElement('div');
    back.className = 'book-back';
    volume.appendChild(back);
    const backLeft = document.createElement('div');
    backLeft.className = 'book-back book-back--left';
    volume.appendChild(backLeft);
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
        const topEdge = document.createElement('div');
        topEdge.className = 'book-cover-edge-face book-cover-edge--top';
        const rightEdge = document.createElement('div');
        rightEdge.className = 'book-cover-edge-face book-cover-edge--right';
        const bottomEdge = document.createElement('div');
        bottomEdge.className = 'book-cover-edge-face book-cover-edge--bottom';
        leaf.append(board, edge, topEdge, rightEdge, bottomEdge);
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
    // Each strip runs on under the next one. Three px keeps the hinge pixel
    // covered when the strips are foreshortened, so the two anti-aliased
    // edges there can't leak the page below as a dark seam.
    const overlap = 3;
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
    volume.classList.toggle('is-closed', spread && turned === 0);
    volume.style.transform = shift ? 'translateX(' + shift + '%)' : '';

    const shown = visible().map(function (i) { return i + 1; });
    count.textContent = shown.join('–') + ' / ' + pages.length;
    prevBtn.disabled = turned === 0;
    nextBtn.disabled = turned === maxTurned();
    load();
  }

  function instant() {
    volume.classList.add('no-anim');
    peel.cancelAll();
    leaves.forEach(function (leaf) {
      clearTurnTimer(leaf);
      leaf.classList.remove('is-moving', 'is-turning', 'is-curl-fwd', 'is-curl-back', 'is-fast-turn', 'is-peeling');
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
    let curling = false;
    let peeling = 0;
    // A turn started while another leaf is still in the air flips flat and
    // fast, and hurries the leaves already turning, as a held arrow does;
    // several pages curling at once draw over each other in a tangle.
    const inFlight = leaves.some(function (leaf, i) {
      return (i < lo || i >= hi) && leaf.classList.contains('is-moving');
    });
    if (inFlight) {
      setFastMode();
      if (peel.hurry) peel.hurry(FAST_MS);
      leaves.forEach(function (leaf, i) {
        if (i < lo || i >= hi) hurryFlat(leaf, FAST_MS);
      });
    }
    const fast = volume.classList.contains('is-fast');
    const turnMs = fast ? FAST_MS : (lo === 0 && hi === 1 ? COVER_MS : TURN_MS);
    // The volume's slide and the left backing's reveal keep step with the
    // cover, whichever speed it turns at.
    if (lo === 0) volume.style.setProperty('--cover-ms', fast ? FAST_MS + 'ms' : '');
    // Leaves in motion ride above both stacks until they land. Each keeps
    // the speed it starts with, so a mode change can't jump a running curl.
    for (let i = lo; i < hi; i++) {
      const leaf = leaves[i];
      const retargeted = leaf.classList.contains('is-moving') || leaf.classList.contains('is-turning');
      // Fast flips turn flat: at 0.32s the bend isn't readable, and its 16
      // extra 3D layers per leaf made the first frames of each turn drop.
      const shouldCurl = !leaf.classList.contains('book-leaf--cover') &&
        !retargeted && !fast && !REDUCED_MOTION.matches && jump <= 3;
      leaf.classList.add('is-moving', 'is-turning');
      leaf.classList.remove('is-curl-fwd', 'is-curl-back');
      if (!retargeted) leaf.classList.toggle('is-fast-turn', fast);
      if (retargeted && leaf.classList.contains('is-peeling')) {
        // A peeling leaf is hidden at its destination; show it and let the
        // flat transition carry it back from there.
        peel.cancel(leaf);
        leaf.classList.remove('is-peeling');
        void leaf.offsetWidth;
      }
      if (shouldCurl && peel.available) {
        // The DOM leaf jumps to its destination, hidden, while WebGL draws
        // the page peeling over from the bottom outer corner.
        leaf.classList.add('is-peeling');
        // near: the page facing the reader now; far: the one showing once
        // turned. Single-page leaves have a blank back.
        const front = spread ? i * 2 : i;
        const back = spread ? front + 1 : -1;
        peel.start({
          leaf: leaf,
          forward: forward,
          nearImg: images[forward ? front : back] || null,
          farImg: images[forward ? back : front] || null,
          duration: turnMs,
          onDone: function () { finishTurn(leaf); }
        });
        peeling++;
      } else if (shouldCurl) {
        ensureCurl(i);
        leaf.classList.add(forward ? 'is-curl-fwd' : 'is-curl-back');
        curling = true;
      }
      leaf.style.zIndex = String(n + 2 + (forward ? i : n - i));
    }
    // Until the moving leaf crosses the spine, the page beside its root is
    // still the current left page (either direction); after that it is the
    // left page of the destination spread. Curling turns ease in-out and
    // cross at half time; flat turns use the site ease and cross early.
    const crossMs = turnMs * (curling ? 0.5 : 0.13);
    clearTimeout(patchTimer);
    if (peeling < hi - lo) {
      showPatch(2 * turned - 1);
      patchTimer = setTimeout(function () { showPatch(2 * target - 1); }, crossMs);
    } else {
      // The peeled page's flat part keeps the current left page beside the
      // spine until the fold reaches it at the very end, so the half pixel
      // under its anti-aliased edge must show that page, not the next one.
      showPatch(2 * turned - 1);
    }
    turned = target;
    page = visible()[0];
    render();
    for (let i = lo; i < hi; i++) {
      const leaf = leaves[i];
      clearTurnTimer(leaf);
      // A peeling leaf finishes when its WebGL turn ends, however slow the
      // device; the timer is only a backstop.
      const ms = i === 0 && !fast ? COVER_MS : turnMs;
      const wait = leaf.classList.contains('is-peeling') ? ms * 4 : ms + 100;
      turnTimers.set(leaf, setTimeout(function () { finishTurn(leaf); }, wait));
    }
    if (fast) scheduleFastModeRemoval();
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
    const full = fullElement() === root;
    // Phones held sideways have little height: let the spread use nearly
    // all of it (the header scrolls away) rather than leaving room for it.
    const short = window.innerHeight < 500;
    const slack = full ? 64 : (short ? 24 : 140);
    const chrome = (full || short ? 0 : (header ? header.offsetHeight : 0)) + controls.offsetHeight + slack;
    const maxH = Math.max(220, window.innerHeight - chrome);
    const per = spread ? 2 : 1;
    // Let the stage take its natural width first; otherwise a volume sized
    // for full screen keeps the stage wide after leaving it.
    volume.style.width = '';
    const pageW = Math.floor(Math.min(stage.clientWidth / per, maxH * ratio));
    pageWidth = pageW;
    volume.style.width = pageW * per + 'px';
    volume.style.height = Math.round(pageW / ratio) + 'px';
    peel.resize(pageW, Math.round(pageW / ratio), spread);
    curlStates.forEach(function (_, index) { sizeCurl(index); });
  }

  bindArrow(prevBtn, prev);
  bindArrow(nextBtn, next);

  // Drag to turn: once the pointer moves sideways, the page under it peels
  // with the pointer; release past a third of the way (or with a flick) to
  // finish the turn, earlier to let it fall back.
  let drag = null;
  function dragProgress(e) {
    const dx = (e.clientX - drag.x0) * (drag.forward ? -1 : 1);
    return Math.max(0, Math.min(1, dx / (2 * pageWidth)));
  }
  function startDrag(e, forward, corner) {
    const target = turned + (forward ? 1 : -1);
    if (target < 0 || target > maxTurned()) return false;
    const i = forward ? turned : turned - 1;
    const leaf = leaves[i];
    if (!peel.available || REDUCED_MOTION.matches || leaf.classList.contains('book-leaf--cover') ||
      leaf.classList.contains('is-moving') || volume.querySelector('.book-leaf.is-moving')) return false;
    const from = turned;
    const front = spread ? i * 2 : i;
    const back = spread ? front + 1 : -1;
    leaf.classList.add('is-moving', 'is-turning', 'is-peeling');
    leaf.style.zIndex = String(leaves.length + 2 + (forward ? i : leaves.length - i));
    clearTimeout(patchTimer);
    showPatch(2 * turned - 1);
    peel.drag({
      leaf: leaf,
      forward: forward,
      corner: corner,
      nearImg: images[forward ? front : back] || null,
      farImg: images[forward ? back : front] || null,
      onDone: function () { finishTurn(leaf); },
      onCancel: function () {
        turned = from;
        page = visible()[0];
        // Put the leaf back while it's still hidden and transition-free, or
        // it would visibly flip back flat after the peel has already landed.
        leaf.classList.toggle('is-turned', !forward);
        void leaf.offsetWidth;
        finishTurn(leaf);
      }
    });
    turned = target;
    page = visible()[0];
    render();
    drag = { x0: e.clientX, forward: forward, leaf: leaf, last: e.clientX, lastT: e.timeStamp, speed: 0 };
    try { volume.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    return true;
  }

  let startX = null;
  let startY = null;
  volume.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
  });
  volume.addEventListener('pointermove', function (e) {
    if (drag) {
      const dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.speed = (e.clientX - drag.last) / dt;
      drag.last = e.clientX;
      drag.lastT = e.timeStamp;
      peel.setProgress(drag.leaf, dragProgress(e));
      return;
    }
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // Grab the top or bottom third to lift that corner; the middle third
    // folds the page straight across.
    const box = volume.getBoundingClientRect();
    const third = (startY - box.top) / box.height * 3;
    const corner = third < 1 ? 'top' : (third > 2 ? 'bottom' : 'none');
    if (startDrag(e, dx < 0, corner)) {
      drag.x0 = startX;
      peel.setProgress(drag.leaf, dragProgress(e));
    }
  });
  volume.addEventListener('pointerup', function (e) {
    if (drag) {
      const flick = drag.speed * (drag.forward ? -1 : 1) > 0.5;
      peel.release(drag.leaf, dragProgress(e) > 0.33 || flick);
      drag = null;
      startX = null;
      return;
    }
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
  volume.addEventListener('pointercancel', function () {
    if (drag) peel.release(drag.leaf, false);
    drag = null;
    startX = null;
  });

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

  // Safari before 16.4 only has the webkit-prefixed full-screen API.
  const requestFull = root.requestFullscreen || root.webkitRequestFullscreen;
  function fullElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function exitFull() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  if (fullBtn && requestFull) {
    fullBtn.hidden = false;
    // Browsers scroll the page to the top on entering and leaving full
    // screen, so remember where the reader was and put them back after.
    let scrollBefore = 0;
    fullBtn.addEventListener('click', function () {
      if (fullElement()) {
        exitFull();
      } else {
        scrollBefore = window.scrollY;
        requestFull.call(root);
      }
    });
    function onFullChange() {
      const full = fullElement() === root;
      root.classList.toggle('is-fullscreen', full);
      fullBtn.setAttribute('aria-label', full ? 'Exit full screen' : 'Full screen');
      size();
      requestAnimationFrame(function () {
        size();
        if (!full) window.scrollTo(0, scrollBefore);
      });
    }
    document.addEventListener('fullscreenchange', onFullChange);
    document.addEventListener('webkitfullscreenchange', onFullChange);
  }

  SINGLE.addEventListener('change', build);
  window.addEventListener('resize', function () {
    size();
  });
  build();
}
