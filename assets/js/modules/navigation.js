// Mobile menu controls.
export function initNavigation() {
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

    document.addEventListener('click', function (event) {
      if (nav.classList.contains('active') && !nav.contains(event.target) &&
        !menuToggle.contains(event.target)) {
        closeMenu();
      }
    });
  }
}
