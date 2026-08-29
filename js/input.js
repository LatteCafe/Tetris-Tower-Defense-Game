// input.js — tracks which keys are currently held, plus single-fire
// "just pressed" edges for discrete actions like rotation.
window.TT = window.TT || {};

TT.Input = (function () {
  const keys = {};
  const justPressed = {};
  const CAPTURED = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyZ'];

  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) justPressed[e.code] = true;
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

  // Returns true once per physical key-press, then resets until the key is
  // released and pressed again. Use for discrete, one-shot actions.
  function consumePressed(code) {
    if (justPressed[code]) {
      justPressed[code] = false;
      return true;
    }
    return false;
  }

  return { isDown, consumePressed };
})();
