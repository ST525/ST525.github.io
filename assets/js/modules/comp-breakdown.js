// Compositing page: one video holds every pass of a shot as tiles. Curtain
// lines across the picture choose which pass shows on either side of them,
// so the passes stay frame-locked while the shot plays.
export function initCompBreakdown() {
  document.querySelectorAll('[data-comp-breakdown]').forEach(setup);
}

function setup(root) {
  const video = root.querySelector('.comp-source');
  const canvas = root.querySelector('.comp-canvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!video || !ctx) return;

  const screen = root.querySelector('.comp-screen');
  const frame = root.querySelector('[data-comp-frame]');
  const cols = Number(root.dataset.cols) || 1;
  const rows = Number(root.dataset.rows) || 1;
  const lines = Array.from(root.querySelectorAll('[data-comp-line]'));
  const count = lines.length + 1;
  const firstTag = root.querySelector('[data-comp-tag-first]');
  const passes = Array.from(root.querySelectorAll('[data-comp-pass]'));
  const spreadBtn = root.querySelector('[data-comp-spread]');
  const playBtn = root.querySelector('[data-comp-play]');
  const scrub = root.querySelector('[data-comp-scrub]');
  const timeEl = root.querySelector('[data-comp-time]');
  const fullBtn = root.querySelector('[data-comp-full]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // pos[i] is where line i sits (0..1); pass i shows left of it, pass i+1 right.
  const pos = lines.map(function (_, i) { return (i + 1) / count; });
  let tileW = 0;
  let tileH = 0;
  let raf = 0;
  let scrubbing = false;
  let userPaused = reducedMotion;
  if (reducedMotion) video.preload = 'auto';

  function tile(i) {
    return { x: (i % cols) * tileW, y: Math.floor(i / cols) * tileH };
  }

  function edges(k) {
    return [k === 0 ? 0 : pos[k - 1], k === count - 1 ? 1 : pos[k]];
  }

  function draw() {
    raf = 0;
    if (video.readyState < 2) return;
    if (!tileW) {
      tileW = video.videoWidth / cols;
      tileH = video.videoHeight / rows;
      canvas.width = tileW;
      canvas.height = tileH;
      fitFrame();
    }
    const w = canvas.width;
    const h = canvas.height;
    let left = 0;
    for (let k = 0; k < count; k++) {
      const right = k < lines.length ? Math.max(left, pos[k]) : 1;
      const x0 = Math.round(left * w);
      const x1 = Math.round(right * w);
      if (x1 > x0) {
        const t = tile(k);
        ctx.drawImage(video, t.x + (x0 / w) * tileW, t.y, ((x1 - x0) / w) * tileW, tileH, x0, 0, x1 - x0, h);
      }
      left = right;
    }
  }

  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function tick() {
    draw();
    syncTime();
    if (!video.paused && !video.ended) raf = requestAnimationFrame(tick);
  }

  function fmt(s) {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function syncTime() {
    if (!video.duration) return;
    if (scrub && !scrubbing) scrub.value = String(Math.round((video.currentTime / video.duration) * 1000));
    if (timeEl) timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
  }

  // With reduced motion the video never plays, and preload="metadata" alone
  // gives drawImage() nothing: seeking in place makes the browser decode a frame.
  function ensureFrame() {
    if (video.readyState >= 2 || video.seeking) return;
    if (video.readyState >= 1) video.currentTime = video.currentTime;
    else video.addEventListener('loadedmetadata', ensureFrame, { once: true });
  }

  // In fullscreen the screen is the viewport, so size the frame to the
  // tile's aspect and let CSS centre it; elsewhere it fills the screen.
  function fitFrame() {
    if (!frame) return;
    if (!document.fullscreenElement || !tileW) {
      frame.style.width = '';
      frame.style.height = '';
      return;
    }
    const s = Math.min(screen.clientWidth / tileW, screen.clientHeight / tileH);
    frame.style.width = Math.round(tileW * s) + 'px';
    frame.style.height = Math.round(tileH * s) + 'px';
  }

  // A pass's tag only shows when its band is wide enough to hold it.
  function fitsTag(tag, k) {
    const e = edges(k);
    const px = canvas.getBoundingClientRect().width || 0;
    return (e[1] - e[0]) * px >= (tag ? tag.offsetWidth : 0) + 24;
  }

  function layout() {
    lines.forEach(function (line, i) {
      line.style.left = (pos[i] * 100).toFixed(3) + '%';
      line.setAttribute('aria-valuenow', String(Math.round(pos[i] * 100)));
      line.classList.toggle('is-narrow', !fitsTag(line.firstElementChild, i + 1));
    });
    if (firstTag) firstTag.classList.toggle('is-narrow', !fitsTag(firstTag, 0));
    passes.forEach(function (btn, k) {
      const e = edges(k);
      btn.classList.toggle('is-visible', e[1] - e[0] > 0.002);
    });
    requestDraw();
  }

  // Moving one line pushes the others ahead of it, like rings on a curtain rail.
  function setLine(i, v) {
    v = Math.min(1, Math.max(0, v));
    pos[i] = v;
    for (let j = 0; j < i; j++) if (pos[j] > v) pos[j] = v;
    for (let j = i + 1; j < pos.length; j++) if (pos[j] < v) pos[j] = v;
    layout();
  }

  function solo(k) {
    pos.forEach(function (_, j) { pos[j] = j < k ? 0 : 1; });
    layout();
  }

  function spread() {
    pos.forEach(function (_, j) { pos[j] = (j + 1) / count; });
    layout();
  }

  function setPlaying(on) {
    root.classList.toggle('is-playing', on);
    if (playBtn) playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  function play() {
    const p = video.play();
    if (p && p.catch) p.catch(function () { setPlaying(false); });
  }

  function togglePlay() {
    if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
  }

  video.addEventListener('loadeddata', function () { requestDraw(); syncTime(); });
  video.addEventListener('loadedmetadata', ensureFrame);
  document.addEventListener('fullscreenchange', fitFrame);
  window.addEventListener('resize', function () { fitFrame(); layout(); });
  video.addEventListener('seeked', requestDraw);
  video.addEventListener('play', function () {
    setPlaying(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
  video.addEventListener('pause', function () { setPlaying(false); syncTime(); });
  video.addEventListener('ended', function () { setPlaying(false); });

  if (playBtn) playBtn.addEventListener('click', togglePlay);

  if (scrub) {
    scrub.addEventListener('pointerdown', function () { scrubbing = true; });
    scrub.addEventListener('input', function () {
      if (video.duration) video.currentTime = (Number(scrub.value) / 1000) * video.duration;
      if (timeEl) timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    });
    scrub.addEventListener('change', function () { scrubbing = false; });
    scrub.addEventListener('pointerup', function () { scrubbing = false; });
  }

  passes.forEach(function (btn, k) {
    btn.addEventListener('click', function () { solo(k); });
  });
  if (spreadBtn) spreadBtn.addEventListener('click', spread);

  if (fullBtn) {
    if (screen.requestFullscreen) {
      fullBtn.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else screen.requestFullscreen().catch(function () {});
      });
    } else {
      fullBtn.hidden = true;
    }
  }

  // Keyboard: a focused line moves with the arrows; space plays and pauses.
  lines.forEach(function (line, i) {
    line.addEventListener('keydown', function (e) {
      const big = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setLine(i, pos[i] - big);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setLine(i, pos[i] + big);
      else if (e.key === 'Home') setLine(i, 0);
      else if (e.key === 'End') setLine(i, 1);
      else return;
      e.preventDefault();
    });
  });
  screen.addEventListener('keydown', function (e) {
    if (e.key !== ' ' && e.key !== 'k') return;
    const tag = e.target && e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT') return;
    togglePlay();
    e.preventDefault();
  });

  // Pointer: grab the nearest line and drag it. Where several lines sit on the
  // same spot, the drag direction decides which one comes away: pulling left
  // takes the lowest (releasing the next pass), pulling right the highest.
  let drag = null;
  function fracFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  }
  function nearest(x) {
    let best = 0;
    pos.forEach(function (p, i) { if (Math.abs(p - x) < Math.abs(pos[best] - x) - 1e-6) best = i; });
    const tied = [];
    pos.forEach(function (p, i) { if (Math.abs(p - pos[best]) < 1e-6) tied.push(i); });
    return tied;
  }
  function grab(i) {
    drag.index = i;
    lines[i].classList.add('is-grab');
    if (lines[i].focus) lines[i].focus({ preventScroll: true });
  }
  screen.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('.comp-bar')) return;
    const tied = nearest(fracFromEvent(e));
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, index: -1, tied: tied, moved: false };
    screen.setPointerCapture(e.pointerId);
    if (tied.length === 1) {
      grab(tied[0]);
      setLine(tied[0], fracFromEvent(e));
    }
    e.preventDefault();
  });
  screen.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (drag.index < 0) {
      if (Math.abs(dx) < 3) return;
      grab(dx < 0 ? Math.min.apply(null, drag.tied) : Math.max.apply(null, drag.tied));
    }
    if (Math.abs(dx) > 3) drag.moved = true;
    setLine(drag.index, fracFromEvent(e));
  });
  function pointerEnd(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.index >= 0) lines[drag.index].classList.remove('is-grab');
    if (!drag.moved && drag.index < 0 && e.pointerType !== 'mouse' && e.type === 'pointerup') togglePlay();
    drag = null;
  }
  screen.addEventListener('pointerup', pointerEnd);
  screen.addEventListener('pointercancel', pointerEnd);

  // Play while on screen, pause when scrolled away.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          if (!userPaused && video.paused) play();
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: [0, 0.2] });
    io.observe(screen);
  } else if (!userPaused) {
    play();
  }

  layout();
  setPlaying(false);
}
