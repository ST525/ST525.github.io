// Painting page: pan along the gallery wall with the floor arrows.
export function initGalleryRoom() {
  document.querySelectorAll('[data-gallery-room]').forEach(function (section) {
    const room = section.querySelector('.gallery-room');
    const track = section.querySelector('.room-track');
    const floor = section.querySelector('.room-floor');
    const slides = Array.from(section.querySelectorAll('.room-slide'));
    const prevBtn = section.querySelector('[data-room-prev]');
    const nextBtn = section.querySelector('[data-room-next]');
    if (!room || !track || !slides.length) return;
    let current = 0;

    function pan() {
      const slide = slides[current];
      const x = room.clientWidth / 2 - (slide.offsetLeft + slide.offsetWidth / 2);
      track.style.transform = 'translateX(' + x + 'px)';
      if (floor) floor.style.backgroundPositionX = x + 'px';
    }

    function show(index) {
      current = Math.max(0, Math.min(slides.length - 1, index));
      slides.forEach(function (slide, i) {
        const active = i === current;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        const frame = slide.querySelector('[data-lightbox]');
        if (frame) frame.tabIndex = active ? 0 : -1;
      });
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === slides.length - 1;
      pan();
    }

    prevBtn && prevBtn.addEventListener('click', function () { show(current - 1); });
    nextBtn && nextBtn.addEventListener('click', function () { show(current + 1); });

    // Clicking a neighbouring painting walks to it instead of opening the viewer.
    track.addEventListener('click', function (e) {
      const slide = e.target.closest('.room-slide');
      if (!slide || slide.classList.contains('is-active')) return;
      e.preventDefault();
      e.stopPropagation();
      show(slides.indexOf(slide));
    }, true);

    section.addEventListener('keydown', function (e) {
      if (document.querySelector('.lightbox.active')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    });

    window.addEventListener('resize', pan);
    window.addEventListener('load', pan);
    show(0);
  });
}
