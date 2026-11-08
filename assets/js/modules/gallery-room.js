// Painting page: pan along a looping gallery wall with the floor arrows.
const CLONES = 2;
const PLANKS = 1368; // repeat length of the floorboard pattern
const OMEGA = 7;

export function initGalleryRoom() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-gallery-room]').forEach(function (section) {
    const room = section.querySelector('.gallery-room');
    const track = section.querySelector('.room-track');
    const boards = section.querySelector('.room-boards');
    const real = Array.from(section.querySelectorAll('.room-slide'));
    const prevBtn = section.querySelector('[data-room-prev]');
    const nextBtn = section.querySelector('[data-room-next]');
    if (!room || !track || !real.length) return;
    const n = real.length;

    // Copies of the last/first paintings on either end so the wall never shows a bare side.
    function cloneOf(slide) {
      const copy = slide.cloneNode(true);
      copy.classList.add('is-clone');
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('[data-lightbox]').forEach(function (el) {
        el.removeAttribute('data-lightbox');
        el.removeAttribute('tabindex');
      });
      return copy;
    }
    for (let i = 0; i < CLONES; i++) {
      track.insertBefore(cloneOf(real[(n - 1 - i + n * CLONES) % n]), track.firstChild);
      track.appendChild(cloneOf(real[i % n]));
    }
    const slides = Array.from(track.querySelectorAll('.room-slide'));

    let pos = CLONES;
    let moving = false;
    let x = 0;
    let v = 0;
    let target = 0;
    let boardOffset = 0;
    let raf = 0;
    let last = 0;

    function whenLoaded(slide, fn) {
      const img = slide.querySelector('img');
      if (!img || (img.complete && img.naturalWidth)) fn();
      else img.addEventListener('load', fn, { once: true });
    }

    function insets() {
      let baseline = Infinity;
      slides.forEach(function (slide) {
        const img = slide.querySelector('img');
        const hang = slide.querySelector('.room-hang');
        if (!img || !hang || !img.complete || !img.naturalWidth ||
          !img.naturalHeight || img.naturalHeight > img.naturalWidth) return;
        baseline = Math.min(baseline, (slide.offsetWidth - hang.offsetWidth) / 2);
      });

      slides.forEach(function (slide) {
        const img = slide.querySelector('img');
        const hang = slide.querySelector('.room-hang');
        const isPortrait = img && img.complete && img.naturalWidth &&
          img.naturalHeight > img.naturalWidth;
        const inset = isPortrait && hang && Number.isFinite(baseline)
          ? Math.max(0, (slide.offsetWidth - hang.offsetWidth) / 2 - baseline)
          : 0;
        slide.style.setProperty('--inset', inset + 'px');
      });
    }

    slides.forEach(function (slide) {
      whenLoaded(slide, function () {
        slide.classList.add('is-loaded');
        insets();
      });
    });

    // The active painting's light only switches on once it has stopped and its image is loaded
    function light() {
      const slide = slides[pos];
      whenLoaded(slide, function () {
        if (!moving && slides[pos] === slide) slide.classList.add('is-lit');
      });
    }

    function logical() { return (pos - CLONES + n) % n; }

    function mod(value, divisor) {
      return ((value % divisor) + divisor) % divisor;
    }

    function apply() {
      track.style.transform = 'translateX(' + x + 'px)';
      if (boards) {
        boards.style.transform = 'translateX(' + (mod(x + boardOffset, PLANKS) - PLANKS) + 'px)';
      }
    }

    function pan(snap) {
      const slide = slides[pos];
      target = room.clientWidth / 2 - slide.offsetWidth / 2 - slide.offsetLeft;
      if (snap || reducedMotion) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        x = target;
        v = 0;
        apply();
        if (moving) arrive();
        return;
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function frame(t) {
      const dt = Math.min((t - last) / 1000, 1 / 20);
      last = t;
      const e = x - target;
      const k = Math.exp(-OMEGA * dt);
      const c = v + OMEGA * e;
      x = target + (e + c * dt) * k;
      v = (v - OMEGA * c * dt) * k;
      apply();
      if (Math.abs(x - target) < 0.5 && Math.abs(v) < 5) {
        x = target;
        v = 0;
        apply();
        raf = 0;
        arrive();
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function paint() {
      const current = logical();
      slides.forEach(function (slide, i) {
        const active = Number(slide.dataset.index) === current;
        slide.classList.toggle('is-active', active);
        slide.classList.remove('is-lit');
        slide.classList.toggle('is-left', i < pos);
        slide.classList.toggle('is-right', i > pos);
        if (slide.classList.contains('is-clone')) return;
        slide.setAttribute('aria-hidden', String(!active));
        const frame = slide.querySelector('[data-lightbox]');
        if (frame) frame.tabIndex = active ? 0 : -1;
      });
    }

    // Swap a clone for its real painting without animating. The track keeps its
    // on-screen position (even mid-slide), so the loop is seamless.
    function settle() {
      if (pos >= CLONES && pos < CLONES + n) return;
      const from = slides[pos].offsetLeft;
      pos = CLONES + logical();
      const d = from - slides[pos].offsetLeft;
      track.classList.add('is-jumping');
      paint();
      x += d;
      target += d;
      boardOffset -= d;
      apply();
      void track.offsetWidth;
      track.classList.remove('is-jumping');
    }

    function arrive() {
      moving = false;
      settle();
      light();
    }

    function move(delta) {
      if (pos + delta < 0 || pos + delta >= slides.length) settle();
      pos += delta;
      moving = true;
      paint();
      pan();
    }

    prevBtn && prevBtn.addEventListener('click', function () { move(-1); });
    nextBtn && nextBtn.addEventListener('click', function () { move(1); });

    // Clicking a neighbouring painting walks to it instead of opening the viewer.
    track.addEventListener('click', function (e) {
      const slide = e.target.closest('.room-slide');
      if (!slide || slide.classList.contains('is-active')) return;
      e.preventDefault();
      e.stopPropagation();
      move(Math.sign(slides.indexOf(slide) - pos));
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (document.querySelector('.lightbox.active')) return;
      const target = e.target;
      if (target instanceof Element &&
        (target.matches('input, textarea, select') || target.isContentEditable)) return;
      if (section.offsetParent === null) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight ||
        rect.right <= 0 || rect.left >= window.innerWidth) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    });

    window.addEventListener('resize', function () {
      insets();
      pan(true);
    });
    window.addEventListener('load', function () { pan(true); });
    insets();
    paint();
    track.classList.add('is-jumping');
    pan(true);
    void track.offsetWidth;
    track.classList.remove('is-jumping');
    light();
  });
}
