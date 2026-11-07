// Painting page: pan along a looping gallery wall with the floor arrows.
const CLONES = 2;

export function initGalleryRoom() {
  document.querySelectorAll('[data-gallery-room]').forEach(function (section) {
    const room = section.querySelector('.gallery-room');
    const track = section.querySelector('.room-track');
    const floor = section.querySelector('.room-floor');
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
    let steps = 0;

    function logical() { return (pos - CLONES + n) % n; }

    function pan() {
      const slide = slides[pos];
      const w = slide.offsetWidth;
      const centre = room.clientWidth / 2 - w / 2;
      track.style.transform = 'translateX(' + (centre - slide.offsetLeft) + 'px)';
      if (floor) floor.style.backgroundPositionX = (centre - steps * w) + 'px';
    }

    function paint() {
      const current = logical();
      slides.forEach(function (slide, i) {
        const active = Number(slide.dataset.index) === current;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('is-left', i < pos);
        slide.classList.toggle('is-right', i > pos);
        if (slide.classList.contains('is-clone')) return;
        slide.setAttribute('aria-hidden', String(!active));
        const frame = slide.querySelector('[data-lightbox]');
        if (frame) frame.tabIndex = active ? 0 : -1;
      });
    }

    // Swap a clone for its real painting without animating, so the loop is seamless.
    function settle() {
      if (pos >= CLONES && pos < CLONES + n) return;
      pos = CLONES + logical();
      track.classList.add('is-jumping');
      paint();
      pan();
      void track.offsetWidth;
      track.classList.remove('is-jumping');
    }

    function move(delta) {
      settle();
      pos += delta;
      steps += delta;
      paint();
      pan();
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target === track && e.propertyName === 'transform') settle();
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
  });
}
