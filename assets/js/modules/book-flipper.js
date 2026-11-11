// Picture book: pages turn like leaves of a real book (two-page spreads, one page on phones).
const SINGLE = window.matchMedia('(max-width: 760px)');
const TURN_MS = 900;
const HOLD_MS = 350;
const REPEAT_MS = 160;
const FAST_MS = 320;
const PRELOAD = 4;
const SWIPE = 40;
const CURL_STRIPS = 12;
const CURL_DEGREES = 60;
const FAST_CURL_DEGREES = 30;
const STAGGER_MS = 40;
const MAX_STAGGER_MS = 600;
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
  let leafStates = [];
  let images = [];
  let turned = 0;
  let page = 0;
  let frameId = 0;
  let fastClassTimer = 0;
  let zoomFocus = null;
  let zoomOpenedAt = 0;
  let pageWidth = 0;
  let pageHeight = 0;
  let pageGutter = 0;
  let pageTop = 0;
  let maxPageDepth = 14;

  const leftBlock = document.createElement('div');
  leftBlock.className = 'book-page-block book-page-block--left';
  const rightBlock = document.createElement('div');
  rightBlock.className = 'book-page-block book-page-block--right';
  const spineShadow = document.createElement('div');
  spineShadow.className = 'book-spine-shadow';

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
    leafStates = [];
    images = [];
    volume.replaceChildren(leftBlock, rightBlock, spineShadow);
    volume.classList.toggle('is-spread', spread);
    for (let i = 0; i < pages.length; i += per) {
      const leaf = document.createElement('div');
      leaf.className = 'book-leaf';
      const state = {
        angle: 0,
        bend: 0,
        animation: null,
        curlRoot: null,
        strips: [],
        shadow: document.createElement('div')
      };
      state.shadow.className = 'book-turn-shadow';
      leaf.appendChild(state.shadow);
      if (i === 0) {
        leaf.classList.add('book-leaf--cover');
        const board = document.createElement('div');
        board.className = 'book-cover-board';
        const edge = document.createElement('div');
        edge.className = 'book-cover-edge';
        leaf.append(board, edge);
      }
      leaf.appendChild(face(pages[i], 'front'));
      if (spread) leaf.appendChild(face(pages[i + 1], 'back'));
      volume.appendChild(leaf);
      leaves.push(leaf);
      leafStates.push(state);
    }
    turned = spread ? Math.floor((page + 1) / 2) : page;
    volume.classList.add('no-anim');
    size();
    instant();
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
    const state = leafStates[index];
    if (state.curlRoot) return;
    const frontIndex = spread ? index * 2 : index;
    const backIndex = spread ? index * 2 + 1 : index + 1;
    const frontSrc = pageImage(frontIndex);
    const backSrc = pageImage(backIndex);
    const root = document.createElement('div');
    root.className = 'book-curl';
    root.style.transform = leafTransform(state.angle, state.bend, true, index);

    let parent = root;
    for (let k = 0; k < CURL_STRIPS; k++) {
      const strip = document.createElement('div');
      strip.className = 'book-curl-strip' + (k === 0 ? ' is-root' : '');

      const front = document.createElement('div');
      front.className = 'book-curl-face book-curl-face--front';
      const back = document.createElement('div');
      back.className = 'book-curl-face book-curl-face--back';
      const shade = document.createElement('div');
      shade.className = 'book-curl-shade';

      const offset = (k / (CURL_STRIPS - 1)) * 100;
      const backOffset = 100 - offset;
      front.style.backgroundSize = CURL_STRIPS * 100 + '% 100%';
      back.style.backgroundSize = CURL_STRIPS * 100 + '% 100%';
      front.style.backgroundPositionX = offset + '%';
      back.style.backgroundPositionX = backOffset + '%';
      if (frontSrc) front.style.backgroundImage = 'url("' + frontSrc.replace(/["\\]/g, '\\$&') + '")';
      else front.classList.add('is-blank');
      if (backSrc) back.style.backgroundImage = 'url("' + backSrc.replace(/["\\]/g, '\\$&') + '")';
      else back.classList.add('is-blank');

      strip.append(front, back, shade);
      parent.appendChild(strip);
      state.strips.push({
        element: strip,
        shade: shade,
        weight: k / ((CURL_STRIPS * (CURL_STRIPS - 1)) / 2)
      });
      parent = strip;
    }

    state.curlRoot = root;
    leaves[index].appendChild(root);
  }

  function renderCurl(index, angle, bend) {
    const state = leafStates[index];
    state.curlRoot.style.transform = leafTransform(angle, bend, true, index);
    let cumulativeAngle = angle;
    state.strips.forEach(function (strip) {
      const extra = bend * strip.weight;
      strip.element.style.transform = 'rotateY(' + extra + 'deg)';
      cumulativeAngle += extra;
      const facingAway = (1 - Math.cos(cumulativeAngle * Math.PI / 180)) / 2;
      strip.shade.style.opacity = String(0.12 + facingAway * 0.46 + Math.min(0.12, Math.abs(bend) / CURL_DEGREES * 0.12));
    });
    state.shadow.style.opacity = String(Math.max(0, Math.sin(Math.PI * Math.abs(angle) / 180)) * 0.24);
  }

  function leafTransform(angle, bend, moving, index) {
    const offset = spread || !moving ? 0 : Math.max(0, -Math.cos((angle + bend) * Math.PI / 180)) * pageWidth;
    const depth = !moving && index === 0 && angle <= -90 ? 'translateZ(-6px) ' : '';
    return depth + (offset ? 'translateX(' + offset + 'px) ' : '') + 'rotateY(' + angle + 'deg)';
  }

  function blockDepth(count) {
    if (count < 0.01 || !leafStates.length) return 0;
    return Math.max(1.5, Math.min(maxPageDepth, (count / leafStates.length) * maxPageDepth));
  }

  function updateBlocks() {
    let leftCount = 0;
    leafStates.forEach(function (state) {
      leftCount += Math.max(0, Math.min(1, -state.angle / 180));
    });
    const rightCount = leafStates.length - leftCount;
    [
      { element: leftBlock, depth: blockDepth(leftCount) },
      { element: rightBlock, depth: blockDepth(rightCount) }
    ].forEach(function (block) {
      block.element.style.display = block.depth ? 'block' : 'none';
      block.element.style.setProperty('--depth', block.depth + 'px');
    });
  }

  function positionVolume() {
    let shift = 0;
    if (spread && turned === 0) shift = -pageWidth / 2;
    volume.style.transform = shift ? 'translateX(' + shift + 'px)' : '';
  }

  function render() {
    const n = leaves.length;
    leaves.forEach(function (leaf, i) {
      const isTurned = i < turned;
      leaf.classList.toggle('is-turned', isTurned);
      const state = leafStates[i];
      if (!leaf.classList.contains('is-moving')) {
        leaf.style.zIndex = String(state.angle <= -90 ? i + 1 : n - i);
      }
    });

    positionVolume();

    const shown = visible().map(function (i) { return i + 1; });
    count.textContent = shown.join('–') + ' / ' + pages.length;
    prevBtn.disabled = turned === 0;
    nextBtn.disabled = turned === maxTurned();
    load();
    updateBlocks();
  }

  function instant() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    volume.classList.add('no-anim');
    leaves.forEach(function (leaf, i) {
      const state = leafStates[i];
      state.animation = null;
      state.angle = i < turned ? -180 : 0;
      state.bend = 0;
      leaf.classList.remove('is-moving', 'is-curling');
      leaf.style.transform = leafTransform(state.angle, state.bend, leaf.classList.contains('is-moving'), i);
      state.shadow.style.opacity = '0';
    });
    render();
    void volume.offsetWidth;
    volume.classList.remove('no-anim');
  }

  function easeInOutCubic(value) {
    return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function animate(now) {
    frameId = 0;
    let active = false;
    let landed = false;
    leafStates.forEach(function (state, i) {
      const animation = state.animation;
      if (!animation) return;
      if (now < animation.startAt) {
        active = true;
        return;
      }
      const leaf = leaves[i];
      if (!animation.started) {
        animation.started = true;
        leaf.classList.add('is-moving');
        leaf.style.zIndex = String(leaves.length + 1 + (animation.dir < 0 ? i : leaves.length - i));
        if (!animation.reduced && i !== 0) {
          ensureCurl(i);
          leaf.classList.add('is-curling');
          leaf.style.transform = 'none';
        } else {
          leaf.classList.remove('is-curling');
          leaf.style.transform = leafTransform(state.angle, state.bend, true, i);
        }
      }

      const progress = Math.min(1, (now - animation.startAt) / animation.duration);
      const eased = easeInOutCubic(progress);
      state.angle = animation.from + (animation.to - animation.from) * eased;
      const flat = animation.reduced || i === 0;
      state.bend = flat ? 0 : animation.bendFrom * (1 - eased) +
        animation.dir * animation.curlDegrees * Math.sin(Math.PI * eased);
      if (flat) {
        leaf.style.transform = leafTransform(state.angle, state.bend, true, i);
        state.shadow.style.opacity = '0';
      } else {
        renderCurl(i, state.angle, state.bend);
      }

      if (progress >= 1) {
        state.angle = animation.to;
        state.bend = 0;
        state.animation = null;
        leaf.classList.remove('is-moving', 'is-curling');
        leaf.style.transform = leafTransform(state.angle, state.bend, false, i);
        leaf.style.zIndex = String(state.angle <= -90 ? i + 1 : leaves.length - i);
        state.shadow.style.opacity = '0';
        landed = true;
      } else {
        active = true;
      }
    });

    updateBlocks();
    if (landed) render();
    if (active) frameId = window.requestAnimationFrame(animate);
  }

  function go(target) {
    target = Math.max(0, Math.min(maxTurned(), target));
    if (target === turned) return;
    const forward = target > turned;
    const now = performance.now();
    const moving = [];
    leafStates.forEach(function (state, i) {
      const destination = i < target ? -180 : 0;
      if (state.animation && Math.abs(state.animation.to - destination) < 0.01) return;
      if (!state.animation && Math.abs(state.angle - destination) < 0.01) return;
      moving.push({ index: i, destination: destination, wasStarted: Boolean(state.animation && state.animation.started) });
    });
    moving.sort(function (a, b) { return forward ? a.index - b.index : b.index - a.index; });

    turned = target;
    page = visible()[0];
    render();

    const staggerStep = moving.length > 1 ? Math.min(STAGGER_MS, MAX_STAGGER_MS / (moving.length - 1)) : 0;
    moving.forEach(function (item, order) {
      const state = leafStates[item.index];
      const fast = volume.classList.contains('is-fast');
      const reduced = REDUCED_MOTION.matches;
      state.animation = {
        from: state.angle,
        to: item.destination,
        startAt: now + (item.wasStarted ? 0 : order * staggerStep),
        duration: reduced ? 200 : (fast ? FAST_MS : TURN_MS),
        bendFrom: state.bend,
        dir: item.destination < state.angle ? -1 : 1,
        curlDegrees: fast ? FAST_CURL_DEGREES : CURL_DEGREES,
        reduced: reduced,
        started: false
      };
    });

    if (moving.length) {
      if (!frameId) frameId = window.requestAnimationFrame(animate);
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
    const per = spread ? 2 : 1;
    maxPageDepth = SINGLE.matches ? 8 : 14;
    const coverBleed = Math.ceil(Math.min(stage.clientWidth / per, window.innerWidth) * 0.015);
    pageGutter = Math.ceil(maxPageDepth + coverBleed + 2);
    pageTop = coverBleed + 1;
    const pageBottom = maxPageDepth + coverBleed + 2;
    const maxPageHeight = Math.max(160, window.innerHeight - chrome - pageTop - pageBottom);
    pageWidth = Math.max(1, Math.floor(Math.min((stage.clientWidth - 2 * pageGutter) / per, maxPageHeight * ratio)));
    pageHeight = Math.round(pageWidth / ratio);
    volume.style.width = pageWidth * per + pageGutter * 2 + 'px';
    volume.style.height = pageTop + pageHeight + pageBottom + 'px';
    volume.style.setProperty('--page-width', pageWidth + 'px');
    volume.style.setProperty('--page-height', pageHeight + 'px');
    volume.style.setProperty('--page-gutter', pageGutter + 'px');
    volume.style.setProperty('--page-top', pageTop + 'px');

    leaves.forEach(function (leaf) {
      leaf.style.left = pageGutter + (spread ? pageWidth : 0) + 'px';
      leaf.style.top = pageTop + 'px';
      leaf.style.width = pageWidth + 'px';
      leaf.style.height = pageHeight + 'px';
    });
    leafStates.forEach(function (state, i) {
      if (leaves[i].classList.contains('is-curling')) {
        renderCurl(i, state.angle, state.bend);
      } else {
        leaves[i].style.transform = leafTransform(state.angle, state.bend, leaves[i].classList.contains('is-moving'), i);
      }
    });
    [leftBlock, rightBlock].forEach(function (block, i) {
      block.style.left = pageGutter + (i && spread ? pageWidth : 0) + 'px';
      block.style.top = pageTop + 'px';
      block.style.width = pageWidth + 'px';
      block.style.height = pageHeight + 'px';
    });
    spineShadow.style.left = pageGutter + (spread ? pageWidth : 0) - (spread ? 17 : 10) + 'px';
    spineShadow.style.top = pageTop + 'px';
    spineShadow.style.width = (spread ? 34 : 20) + 'px';
    spineShadow.style.height = pageHeight + 'px';
    spineShadow.style.zIndex = String(leaves.length + 1);
    positionVolume();
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
    render();
  });
  build();
}
