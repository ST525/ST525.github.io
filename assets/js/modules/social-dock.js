// Keep the home social sidebar above the footer line.
export function initSocialDock() {
  const dock = document.querySelector('.home-social-sidebar');
  const footer = document.querySelector('.footer');
  if (!dock || !footer) return;

  let frame = 0;
  function update() {
    frame = 0;
    const overlap = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
    dock.style.transform = overlap ? 'translateY(' + (-overlap) + 'px)' : '';
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}
