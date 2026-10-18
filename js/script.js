(function () {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Mobile menu ---------- */
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');

    function closeMenu() {
        if (!menuToggle) return;
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('active');
        document.body.classList.remove('menu-open');
    }

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function () {
            const open = !nav.classList.contains('active');
            menuToggle.classList.toggle('active', open);
            menuToggle.setAttribute('aria-expanded', String(open));
            nav.classList.toggle('active', open);
            document.body.classList.toggle('menu-open', open);
        });

        nav.querySelectorAll('.nav-item').forEach(function (item) {
            item.addEventListener('click', closeMenu);
        });

        document.addEventListener('click', function (e) {
            if (nav.classList.contains('active') && !nav.contains(e.target) && !menuToggle.contains(e.target)) {
                closeMenu();
            }
        });
    }

    /* ---------- Lazy, in-view video playback ---------- */
    const lazyVideos = document.querySelectorAll('video[data-src]');

    function loadVideo(video) {
        if (!video.src) {
            video.src = video.dataset.src;
            video.load();
        }
    }

    if (lazyVideos.length) {
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
                    if (entry.isIntersecting) {
                        if (!reducedMotion) {
                            const p = video.play();
                            if (p && p.catch) p.catch(function () {});
                        }
                    } else if (!video.paused) {
                        video.pause();
                    }
                });
            }, { threshold: 0.2 });
            lazyVideos.forEach(function (v) { loader.observe(v); player.observe(v); });
        } else {
            lazyVideos.forEach(function (v) {
                loadVideo(v);
                if (!reducedMotion) v.play().catch(function () {});
            });
        }
    }

    /* ---------- Scroll reveal ---------- */
    const revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length && 'IntersectionObserver' in window && !reducedMotion) {
        const ro = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    ro.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        revealEls.forEach(function (el) { ro.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    /* ---------- Lightbox ---------- */
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

    function groupOf(el) {
        return el.getAttribute('data-lightbox') || 'default';
    }

    function siblings(index) {
        const group = groupOf(items[index]);
        return items.filter(function (el) { return groupOf(el) === group; });
    }

    function show(index) {
        const el = items[index];
        if (!el) return;
        currentIndex = index;

        const src = el.getAttribute('data-src');
        const type = el.getAttribute('data-type') || (/\.(mp4|webm|mov)$/i.test(src) ? 'video' : 'image');
        const title = el.getAttribute('data-title') || '';
        const meta = el.getAttribute('data-meta') || '';

        if (type === 'video') {
            lbImage.hidden = true;
            lbImage.removeAttribute('src');
            lbVideo.hidden = false;
            if (lbVideo.getAttribute('src') !== src) {
                lbVideo.src = src;
                lbVideo.load();
            }
            const p = lbVideo.play();
            if (p && p.catch) p.catch(function () {});
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

    function step(dir) {
        if (currentIndex < 0) return;
        const group = siblings(currentIndex);
        const pos = group.indexOf(items[currentIndex]);
        const nextEl = group[(pos + dir + group.length) % group.length];
        show(items.indexOf(nextEl));
    }

    items.forEach(function (el, i) {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('aria-label')) {
            el.setAttribute('aria-label', 'Open ' + (el.getAttribute('data-title') || 'media') + ' in viewer');
        }
        el.addEventListener('click', function () { open(i); });
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(i);
            }
        });
    });

    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) close();
    });
    if (lbClose) lbClose.addEventListener('click', close);
    if (lbPrev) lbPrev.addEventListener('click', function () { step(-1); });
    if (lbNext) lbNext.addEventListener('click', function () { step(1); });

    document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'Tab') trapFocus(e);
    }, true);

    function trapFocus(e) {
        const focusable = Array.from(
            lightbox.querySelectorAll('button, video, [tabindex]:not([tabindex="-1"])')
        ).filter(function (el) { return !el.hidden && el.getClientRects().length > 0; });
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !lightbox.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !lightbox.contains(document.activeElement))) {
            e.preventDefault();
            first.focus();
        }
    }
})();
