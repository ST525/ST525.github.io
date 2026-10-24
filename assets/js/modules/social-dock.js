// Keep the home social sidebar above the footer line.
export function initSocialDock() {
  const dock = document.querySelector('.home-social-sidebar');
  const footer = document.querySelector('.footer');
  if (!dock || !footer) return;

  let frame = 0;
  function update() {
    frame = 0;
    const overlap = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
    const extraSpace = Math.max(0, 32 - parseFloat(getComputedStyle(dock).bottom));
    const offset = overlap ? overlap + extraSpace : 0;
    dock.style.transform = offset ? 'translateY(' + (-offset) + 'px)' : '';
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}
