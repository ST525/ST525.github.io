// Lazy-load portfolio videos and play them while visible.
export function initLazyVideo() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lazyVideos = document.querySelectorAll('video[data-src]');

  function loadVideo(video) {
    if (!video.src) {
      video.src = video.dataset.src;
      video.load();
    }
  }

  if (!lazyVideos.length) return;

  if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadVideo(entry.target);
          loader.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px 0px' });

    const player = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          loadVideo(video);
          if (!reducedMotion) {
            const playback = video.play();
            if (playback && playback.catch) playback.catch(function () {});
          }
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: [0, 0.2] });

    lazyVideos.forEach(function (video) {
      loader.observe(video);
      player.observe(video);
    });
  } else {
    lazyVideos.forEach(function (video) {
      loadVideo(video);
      if (!reducedMotion) video.play().catch(function () {});
    });
  }
}
