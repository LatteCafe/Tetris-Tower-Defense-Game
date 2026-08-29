// input.js — tracks which keys are currently held.
window.TT = window.TT || {};

TT.Input = (function () {
  const keys = {};
  const CAPTURED = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyZ'];

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (CAPTURED.includes(e.code)) e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    // Prevent "stuck key" bugs when the window loses focus.
    Object.keys(keys).forEach((k) => (keys[k] = false));
  });

  function isDown(code) {
    return !!keys[code];
  }

  return { isDown };
})();
