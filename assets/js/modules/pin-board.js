// Pinterest-style board: deal pins left to right into flex columns.
// Avoids CSS multi-column, where hover transforms can make items vanish.
export function initPinBoard() {
  document.querySelectorAll('[data-pin-board]').forEach(function (board) {
    const pins = Array.from(board.querySelectorAll('.pin'));
    if (!pins.length) return;
    let count = 0;

    function layout() {
      const cols = parseInt(getComputedStyle(board).getPropertyValue('--cols'), 10) || 1;
      if (cols === count) return;
      count = cols;
      const columns = [];
      for (let i = 0; i < cols; i++) {
        const col = document.createElement('div');
        col.className = 'pin-col';
        columns.push(col);
      }
      pins.forEach(function (pin, i) {
        columns[i % cols].appendChild(pin);
      });
      board.replaceChildren.apply(board, columns);
      board.classList.add('is-masonry');
    }

    layout();
    window.addEventListener('resize', layout);
  });
}
