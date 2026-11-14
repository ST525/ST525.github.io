// Compositing page: one video holds every stage of a shot as tiles; a slider
// picks which tile is drawn, so the stages stay frame-locked.
export function initCompBreakdown() {
  document.querySelectorAll('[data-comp-breakdown]').forEach(setup);
}

function setup(root) {
  const video = root.querySelector('.comp-source');
  const canvas = root.querySelector('.comp-canvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!video || !ctx) return;

  const screen = root.querySelector('.comp-screen');
  const cols = Number(root.dataset.cols) || 1;
  const rows = Number(root.dataset.rows) || 1;
  const stageInput = root.querySelector('[data-comp-stage]');
  const stops = Array.from(root.querySelectorAll('[data-comp-stop]'));
  const count = stops.length;
  const playBtn = root.querySelector('[data-comp-play]');
  const scrub = root.querySelector('[data-comp-scrub]');
  const timeEl = root.querySelector('[data-comp-time]');
  const compareBtn = root.querySelector('[data-comp-compare]');
  const fullBtn = root.querySelector('[data-comp-full]');
  const frame = root.querySelector('[data-comp-frame]');
  const wipe = root.querySelector('[data-comp-wipe]');
  const wipeLine = wipe && wipe.querySelector('.comp-wipe-line');
  const labelLeft = root.querySelector('[data-comp-label-left]');
  const labelRight = root.querySelector('[data-comp-label-right]');
  const num = root.querySelector('[data-comp-num]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let stage = count - 1;
  let compare = false;
  let split = 0.5;
  let tileW = 0;
  let tileH = 0;
  let raf = 0;
  let scrubbing = false;
  let userPaused = reducedMotion;
  if (reducedMotion) video.preload = 'auto';

  function tile(i) {
    return { x: (i % cols) * tileW, y: Math.floor(i / cols) * tileH };
  }

  function leftStage() {
    return stage === count - 1 ? Math.max(0, count - 2) : stage;
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
    if (!compare) {
      const a = tile(stage);
      ctx.drawImage(video, a.x, a.y, tileW, tileH, 0, 0, w, h);
      return;
    }
    const a = tile(leftStage());
    const b = tile(count - 1);
    const cut = Math.round(w * split);
    ctx.drawImage(video, a.x, a.y, tileW, tileH, 0, 0, w, h);
    if (cut < w) {
      ctx.drawImage(video, b.x + (cut / w) * tileW, b.y, tileW - (cut / w) * tileW, tileH, cut, 0, w - cut, h);
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

<<<<<<< ours
  // With reduced motion the video never plays, and preload="metadata" alone
  // gives drawImage() nothing: seeking in place makes the browser decode a frame.
  function ensureFrame() {
    if (video.readyState >= 2 || video.seeking) return;
    if (video.readyState >= 1) video.currentTime = video.currentTime;
    else video.addEventListener('loadedmetadata', ensureFrame, { once: true });
  }

||||||| base
=======
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

>>>>>>> theirs
  function setStage(i, focusStop) {
    i = Math.min(count - 1, Math.max(0, i));
    stage = i;
    stops.forEach(function (stop, k) {
      stop.classList.toggle('is-active', k === i);
      stop.setAttribute('aria-pressed', String(k === i));
    });
    if (stageInput) {
      stageInput.value = String(i);
      stageInput.setAttribute('aria-valuetext', stops[i].dataset.label);
    }
    if (num) num.textContent = String(i + 1).padStart(2, '0');
    if (labelLeft) labelLeft.textContent = compare ? stops[leftStage()].dataset.label : stops[i].dataset.label;
    if (focusStop) stops[i].focus();
    ensureFrame();
    requestDraw();
  }

  function setSplit(v) {
    split = Math.min(1, Math.max(0, v));
    if (wipe) wipe.style.setProperty('--split', (split * 100).toFixed(2) + '%');
    if (wipeLine) wipeLine.setAttribute('aria-valuenow', String(Math.round(split * 100)));
    requestDraw();
  }

  function setCompare(on) {
    compare = on;
    root.classList.toggle('is-compare', on);
    if (compareBtn) compareBtn.setAttribute('aria-pressed', String(on));
    if (wipe) wipe.hidden = !on;
    setStage(stage);
  }

  function setPlaying(on) {
    root.classList.toggle('is-playing', on);
    if (playBtn) playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  function play() {
    const p = video.play();
    if (p && p.catch) p.catch(function () { setPlaying(false); });
  }

  video.addEventListener('loadeddata', function () { requestDraw(); syncTime(); });
<<<<<<< ours
  video.addEventListener('loadedmetadata', ensureFrame);
||||||| base
=======
  video.addEventListener('loadedmetadata', ensureFrame);
  document.addEventListener('fullscreenchange', fitFrame);
  window.addEventListener('resize', fitFrame);
>>>>>>> theirs
  video.addEventListener('seeked', requestDraw);
  video.addEventListener('play', function () {
    setPlaying(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
  video.addEventListener('pause', function () { setPlaying(false); syncTime(); });
  video.addEventListener('ended', function () { setPlaying(false); });

  if (playBtn) {
    playBtn.addEventListener('click', function () {
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
    });
  }

  if (scrub) {
    scrub.addEventListener('pointerdown', function () { scrubbing = true; });
    scrub.addEventListener('input', function () {
      if (video.duration) video.currentTime = (Number(scrub.value) / 1000) * video.duration;
      if (timeEl) timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    });
    scrub.addEventListener('change', function () { scrubbing = false; });
    scrub.addEventListener('pointerup', function () { scrubbing = false; });
  }

  if (stageInput) {
    stageInput.addEventListener('input', function () { setStage(Number(stageInput.value)); });
  }
  stops.forEach(function (stop, i) {
    stop.addEventListener('click', function () { setStage(i); });
  });

  if (compareBtn) {
    compareBtn.addEventListener('click', function () { setCompare(!compare); });
  }

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

  // Keyboard: arrows step the stage (or move the wipe in compare mode), space plays.
  screen.addEventListener('keydown', function (e) {
    const onRange = e.target && e.target.tagName === 'INPUT';
    if (onRange) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (e.target === wipeLine) setSplit(split + dir * 0.05);
      else setStage(stage + dir);
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'k') {
      if (e.target.tagName === 'BUTTON') return;
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
      e.preventDefault();
    }
  });

  // Pointer: drag the wipe line in compare mode; swipe to change stage otherwise.
  let down = null;
  function splitFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  }
  screen.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('.comp-bar')) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    if (compare) {
      setSplit(splitFromEvent(e));
      screen.setPointerCapture(e.pointerId);
    }
  });
  screen.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id) return;
    if (compare) {
      setSplit(splitFromEvent(e));
      down.moved = true;
    } else if (Math.abs(e.clientX - down.x) > 8) {
      down.moved = true;
    }
  });
  function pointerEnd(e) {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!compare && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      setStage(stage + (dx < 0 ? 1 : -1));
    } else if (!down.moved && e.pointerType !== 'mouse' && e.type === 'pointerup' && !compare) {
      if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
    }
    down = null;
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

  setSplit(0.5);
  setStage(stage);
  setPlaying(false);
}
