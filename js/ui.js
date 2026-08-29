// ui.js — wires the HUD, start screen, and milestone toast to the DOM.
window.TT = window.TT || {};

TT.UI = (function () {
  let elTimer, elHeight, elPieces, elNextSwatch, elOverlay, elStart, elToast;
  let toastHideTimer = null;

  function init() {
    elTimer = document.getElementById('stat-timer');
    elHeight = document.getElementById('stat-height');
    elPieces = document.getElementById('stat-pieces');
    elNextSwatch = document.getElementById('next-swatch');
    elOverlay = document.getElementById('overlay');
    elStart = document.getElementById('screen-start');
    elToast = document.getElementById('toast');

    document.getElementById('btn-start').addEventListener('click', () => TT.Game.startGame());
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

  function hideOverlays() {
    elOverlay.classList.add('transparent');
    elStart.classList.add('hidden');
  }

  // Endless mode has no win/lose screen — reaching a goal just pops a
  // brief, non-blocking toast and play continues.
  function showMilestone(text) {
    elToast.textContent = text;
    elToast.classList.remove('hidden');
    elToast.classList.add('show');

    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      elToast.classList.remove('show');
      setTimeout(() => elToast.classList.add('hidden'), 300);
    }, 2400);
  }

  return { init, updateStats, updateNext, hideOverlays, showMilestone };
})();
