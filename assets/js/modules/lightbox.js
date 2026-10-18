// Accessible grouped media viewer.
export function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lbVideo = lightbox.querySelector('video');
  const lbImage = lightbox.querySelector('img');
  const lbCaption = lightbox.querySelector('.lightbox-caption');
  const lbPrev = lightbox.querySelector('.lightbox-prev');
  const lbNext = lightbox.querySelector('.lightbox-next');
  const lbClose = lightbox.querySelector('.lightbox-close');
  const items = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
  let currentIndex = -1;
  let lastFocused = null;

  function groupOf(element) {
    return element.getAttribute('data-lightbox') || 'default';
  }

  function siblings(index) {
    const group = groupOf(items[index]);
    return items.filter(function (element) {
      return groupOf(element) === group;
    });
  }

  function show(index) {
    const element = items[index];
    if (!element) return;
    currentIndex = index;

    const src = element.getAttribute('data-src');
    const type = element.getAttribute('data-type') ||
      (/\.(mp4|webm|mov)$/i.test(src) ? 'video' : 'image');
    const title = element.getAttribute('data-title') || '';
    const meta = element.getAttribute('data-meta') || '';

    if (type === 'video') {
      lbImage.hidden = true;
      lbImage.removeAttribute('src');
      lbVideo.hidden = false;
      if (lbVideo.getAttribute('src') !== src) {
        lbVideo.src = src;
        lbVideo.load();
      }
      const playback = lbVideo.play();
      if (playback && playback.catch) playback.catch(function () {});
    } else {
      lbVideo.pause();
      lbVideo.hidden = true;
      lbVideo.removeAttribute('src');
      lbImage.hidden = false;
      lbImage.src = src;
      lbImage.alt = title || 'Enlarged image';
    }

    if (lbCaption) {
      lbCaption.innerHTML = title
        ? '<strong>' + title + '</strong>' + (meta ? ' &nbsp;·&nbsp; ' + meta : '')
        : '';
    }

    const group = siblings(index);
    const multiple = group.length > 1;
    if (lbPrev) lbPrev.hidden = !multiple;
    if (lbNext) lbNext.hidden = !multiple;
  }

  function open(index) {
    lastFocused = document.activeElement;
    show(index);
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    requestAnimationFrame(function () {
      if (lbClose) lbClose.focus();
      if (document.activeElement !== lbClose) lightbox.focus();
    });
  }

  function close() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lbVideo.pause();
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function step(direction) {
    if (currentIndex < 0) return;
    const group = siblings(currentIndex);
    const position = group.indexOf(items[currentIndex]);
    const nextElement = group[(position + direction + group.length) % group.length];
    show(items.indexOf(nextElement));
  }

  items.forEach(function (element, index) {
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '0');
    if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
    if (!element.hasAttribute('aria-label')) {
      element.setAttribute(
        'aria-label',
        'Open ' + (element.getAttribute('data-title') || 'media') + ' in viewer'
      );
    }
    element.addEventListener('click', function () {
      open(index);
    });
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(index);
      }
    });
  });

  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) close();
  });
  if (lbClose) lbClose.addEventListener('click', close);
  if (lbPrev) lbPrev.addEventListener('click', function () {
    step(-1);
  });
  if (lbNext) lbNext.addEventListener('click', function () {
    step(1);
  });

  document.addEventListener('keydown', function (event) {
    if (!lightbox.classList.contains('active')) return;
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'Tab') trapFocus(event);
  }, true);

  function trapFocus(event) {
    const focusable = Array.from(
      lightbox.querySelectorAll('button, video, [tabindex]:not([tabindex="-1"])')
    ).filter(function (element) {
      return !element.hidden && element.getClientRects().length > 0;
    });
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey &&
      (document.activeElement === first || !lightbox.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey &&
      (document.activeElement === last || !lightbox.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
}
