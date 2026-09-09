// ui.js — wires the HUD, start/game-over screens, and toast to the DOM.
window.TT = window.TT || {};

TT.UI = (function () {
  let elTimer, elScore, elLines, elLevel, elNextSwatch, elOverlay, elStart, elGameOver, elToast;
  let toastHideTimer = null;

  function init() {
    elTimer = document.getElementById('stat-timer');
    elScore = document.getElementById('stat-score');
    elLines = document.getElementById('stat-lines');
    elLevel = document.getElementById('stat-level');
    elNextSwatch = document.getElementById('next-swatch');
    elOverlay = document.getElementById('overlay');
    elStart = document.getElementById('screen-start');
    elGameOver = document.getElementById('screen-gameover');
    elToast = document.getElementById('toast');

    document.getElementById('btn-start').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-retry').addEventListener('click', () => TT.Game.startGame());
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function updateStats(elapsedMs, score, lines, level) {
    elTimer.textContent = formatTime(elapsedMs);
    elScore.textContent = score;
    elLines.textContent = lines;
    elLevel.textContent = level;
  }

  function updateNext(type) {
    if (!type) return;
    elNextSwatch.style.background = TT.Pieces.colorFor(type);
  }

  function hideOverlays() {
    elOverlay.classList.add('transparent');
    elStart.classList.add('hidden');
    elGameOver.classList.add('hidden');
  }

  function showScreen(name) {
    elOverlay.classList.remove('transparent');
    elStart.classList.add('hidden');
    elGameOver.classList.add('hidden');
    (name === 'start' ? elStart : elGameOver).classList.remove('hidden');
  }

  function showGameOver(score, lines, level) {
    document.getElementById('gameover-stats').textContent =
      `Score ${score} · ${lines} line${lines === 1 ? '' : 's'} · level ${level}`;
    showScreen('gameover');
  }

  function showMilestone(text) {
    elToast.textContent = text;
    elToast.classList.remove('hidden');
    elToast.classList.add('show');

    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      elToast.classList.remove('show');
      setTimeout(() => elToast.classList.add('hidden'), 300);
    }, 2000);
  }

  return { init, updateStats, updateNext, hideOverlays, showGameOver, showMilestone };
})();
