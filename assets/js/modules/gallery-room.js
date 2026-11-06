// Painting page: step through the gallery wall with the arrow buttons.
export function initGalleryRoom() {
  document.querySelectorAll('[data-gallery-room]').forEach(function (room) {
    const slides = Array.from(room.querySelectorAll('.room-slide'));
    const prevBtn = room.querySelector('[data-room-prev]');
    const nextBtn = room.querySelector('[data-room-next]');
    if (!slides.length) return;
    let current = 0;

    function show(index) {
      const n = slides.length;
      current = (index + n) % n;
      slides.forEach(function (slide, i) {
        const offset = (i - current + n) % n;
        slide.classList.toggle('is-active', offset === 0);
        slide.classList.toggle('is-next', n > 1 && offset === 1);
        slide.classList.toggle('is-prev', n > 2 && offset === n - 1);
        const frame = slide.querySelector('[data-lightbox]');
        if (frame) frame.tabIndex = offset === 0 ? 0 : -1;
        slide.setAttribute('aria-hidden', String(offset !== 0));
      });
    }

    prevBtn && prevBtn.addEventListener('click', function () { show(current - 1); });
    nextBtn && nextBtn.addEventListener('click', function () { show(current + 1); });

    // Clicking a side painting brings it to the centre instead of opening the viewer.
    room.addEventListener('click', function (e) {
      const slide = e.target.closest('.room-slide');
      if (!slide || slide.classList.contains('is-active')) return;
      e.preventDefault();
      e.stopPropagation();
      show(slides.indexOf(slide));
    }, true);

    room.addEventListener('keydown', function (e) {
      if (document.querySelector('.lightbox.active')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    });

    show(0);
  });
}
