// ui.js — wires the HUD and overlay screens to the DOM.
window.TT = window.TT || {};

TT.UI = (function () {
  let elTimer, elHeight, elPieces, elNextSwatch, elOverlay;
  let screens = {};

  function init() {
    elTimer = document.getElementById('stat-timer');
    elHeight = document.getElementById('stat-height');
    elPieces = document.getElementById('stat-pieces');
    elNextSwatch = document.getElementById('next-swatch');
    elOverlay = document.getElementById('overlay');

    screens.start = document.getElementById('screen-start');
    screens.gameover = document.getElementById('screen-gameover');
    screens.win = document.getElementById('screen-win');

    document.getElementById('btn-start').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-retry').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-retry-win').addEventListener('click', () => TT.Game.startGame());
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function updateStats(elapsedMs, heightM, goalM, pieces) {
    elTimer.textContent = formatTime(elapsedMs);
    elHeight.textContent = `${heightM.toFixed(1)} / ${goalM.toFixed(0)} m`;
    elPieces.textContent = pieces;
  }

  function updateNext(type) {
    const shape = TT.Blocks.SHAPES[type];
    elNextSwatch.style.background = shape.color;
  }

  function showScreen(name) {
    elOverlay.classList.remove('transparent');
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
  }

  function hideOverlays() {
    elOverlay.classList.add('transparent');
    Object.values(screens).forEach((s) => s.classList.add('hidden'));
  }

  function showGameOver(pieces, heightM) {
    document.getElementById('gameover-stats').textContent =
      `Placed ${pieces} block${pieces === 1 ? '' : 's'} · reached ${heightM}m before it came down.`;
    showScreen('gameover');
  }

  function showWin(seconds, pieces) {
    document.getElementById('win-stats').textContent =
      `Reached the goal in ${seconds}s using ${pieces} block${pieces === 1 ? '' : 's'}.`;
    showScreen('win');
  }

  return { init, updateStats, updateNext, hideOverlays, showGameOver, showWin, showScreen };
})();
