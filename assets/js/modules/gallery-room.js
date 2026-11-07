// Painting page: pan along a looping gallery wall with the floor arrows.
const CLONES = 2;
const PLANKS = 1368; // repeat length of the floorboard pattern

export function initGalleryRoom() {
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
    let arriveTimer;

    function whenLoaded(slide, fn) {
      const img = slide.querySelector('img');
      if (!img || (img.complete && img.naturalWidth)) fn();
      else img.addEventListener('load', fn, { once: true });
    }

    slides.forEach(function (slide) {
      whenLoaded(slide, function () { slide.classList.add('is-loaded'); });
    });

    // The active painting's light only switches on once it has stopped and its image is loaded
    function light() {
      const slide = slides[pos];
      whenLoaded(slide, function () {
        if (!moving && slides[pos] === slide) slide.classList.add('is-lit');
      });
    }

    function logical() { return (pos - CLONES + n) % n; }

    function pan() {
      const slide = slides[pos];
      const target = room.clientWidth / 2 - slide.offsetWidth / 2 - slide.offsetLeft;
      const delta = target - shiftX(track);
      track.style.transform = 'translateX(' + target + 'px)';
      // The floorboards slide exactly as far as the wall, on the same transition
      if (boards) shiftBoards(shiftX(boards) + delta, track.classList.contains('is-jumping'));
    }

    function shiftBoards(x, jump) {
      if (jump) boards.classList.add('is-jumping');
      boards.style.transform = 'translateX(' + x + 'px)';
      if (!jump) return;
      void boards.offsetWidth;
      boards.classList.remove('is-jumping');
    }

    function shiftX(el) {
      return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
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
      const x = shiftX(track);
      pos = CLONES + logical();
      track.classList.add('is-jumping');
      paint();
      track.style.transform = 'translateX(' + (x + from - slides[pos].offsetLeft) + 'px)';
      void track.offsetWidth;
      track.classList.remove('is-jumping');
      // Restart the boards' slide in step with the wall's
      if (boards) shiftBoards(shiftX(boards), true);
    }

    function arrive() {
      clearTimeout(arriveTimer);
      moving = false;
      settle();
      // At rest, wrap the boards back by whole plank patterns, which looks identical
      if (boards) shiftBoards(shiftX(boards) % PLANKS, true);
      light();
    }

    function move(delta) {
      if (pos + delta < 0 || pos + delta >= slides.length) settle();
      pos += delta;
      moving = true;
      paint();
      pan();
      clearTimeout(arriveTimer);
      arriveTimer = setTimeout(arrive, 1000);
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target === track && e.propertyName === 'transform') arrive();
    });

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

    section.addEventListener('keydown', function (e) {
      if (document.querySelector('.lightbox.active')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    });

    window.addEventListener('resize', pan);
    window.addEventListener('load', pan);
    paint();
    track.classList.add('is-jumping');
    pan();
    void track.offsetWidth;
    track.classList.remove('is-jumping');
    light();
  });
}
