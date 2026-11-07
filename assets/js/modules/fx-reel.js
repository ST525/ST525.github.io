// Effects page: swap the featured clip when a filmstrip thumbnail is chosen.
export function initFxReel() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-fx-reel]').forEach(function (reel) {
    const feature = reel.querySelector('.fx-feature');
    const video = feature && feature.querySelector('video');
    const num = reel.querySelector('[data-fx-num]');
    const title = reel.querySelector('[data-fx-title]');
    const tags = reel.querySelector('[data-fx-tags]');
    const thumbs = reel.querySelectorAll('.fx-thumb');
    if (!feature || !video) return;

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (thumb.classList.contains('is-active')) return;
        thumbs.forEach(function (other) {
          other.classList.toggle('is-active', other === thumb);
          other.setAttribute('aria-pressed', String(other === thumb));
        });

        const data = thumb.dataset;
        feature.setAttribute('data-src', data.src);
        feature.setAttribute('data-title', data.title);
        feature.setAttribute('data-meta', data.meta);
        feature.setAttribute('aria-label', 'Open ' + data.title + ' in viewer');

        video.poster = data.poster;
        video.dataset.src = data.preview;
        video.src = data.preview;
        video.load();
        if (!reducedMotion) {
          const playback = video.play();
          if (playback && playback.catch) playback.catch(function () {});
        }

        if (num) num.textContent = data.num;
        if (title) title.textContent = data.title;
        if (tags) {
          tags.textContent = '';
          data.meta.split(' · ').forEach(function (tag) {
            const li = document.createElement('li');
            li.textContent = tag;
            tags.appendChild(li);
          });
        }
      });
    });
  });
}
