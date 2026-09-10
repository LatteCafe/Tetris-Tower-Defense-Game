// ui.js — wires the HUD, start/game-over screens, HP/enemy bars, discard
// button, and toast to the DOM.
window.TT = window.TT || {};

TT.UI = (function () {
  let elTimer, elScore, elLines, elLevel, elNextSwatch;
  let elOverlay, elStart, elGameOver, elToast;
  let elHpFill, elHpText, elMobFill, elBossFill;
  let elDiscardBtn, elDiscardFill;
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

    elHpFill = document.getElementById('hp-bar-fill');
    elHpText = document.getElementById('hp-text');
    elMobFill = document.getElementById('mob-bar-fill');
    elBossFill = document.getElementById('boss-bar-fill');

    elDiscardBtn = document.getElementById('btn-discard');
    elDiscardFill = document.getElementById('discard-fill');

    document.getElementById('btn-start').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-retry').addEventListener('click', () => TT.Game.startGame());
    elDiscardBtn.addEventListener('click', () => TT.Game.discardPiece());
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function updateStats(elapsedMs, score, lines, combatState) {
    elTimer.textContent = formatTime(elapsedMs);
    elScore.textContent = score;
    elLines.textContent = lines;
    elLevel.textContent = combatState.level;

    const hpPct = Math.max(0, (combatState.hp / combatState.maxHP) * 100);
    elHpFill.style.width = hpPct + '%';
    elHpText.textContent = `${Math.ceil(combatState.hp)} / ${combatState.maxHP}`;

    const mobPct = Math.max(0, (combatState.mobHP / combatState.mobMaxHP) * 100);
    const bossPct = Math.max(0, (combatState.bossHP / combatState.bossMaxHP) * 100);
    elMobFill.style.width = mobPct + '%';
    elBossFill.style.width = bossPct + '%';
  }

  function updateNext(type) {
    if (!type) return;
    elNextSwatch.style.background = TT.Pieces.colorFor(type);
  }

  function updateDiscardCooldown(remainingMs, totalMs) {
    const ready = remainingMs <= 0;
    elDiscardBtn.disabled = !ready;
    elDiscardBtn.classList.toggle('ready', ready);
    const pct = ready ? 100 : ((totalMs - remainingMs) / totalMs) * 100;
    elDiscardFill.style.width = pct + '%';
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

  function showGameOver(cause, score, lines, level) {
    const title = cause === 'health' ? 'The Castle Has Fallen' : 'No Room Left to Build';
    document.querySelector('#screen-gameover h2').textContent = title;
    document.getElementById('gameover-stats').textContent =
      `Score ${score} · ${lines} line${lines === 1 ? '' : 's'} · reached level ${level}`;
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
    }, 2200);
  }

  return {
    init, updateStats, updateNext, updateDiscardCooldown,
    hideOverlays, showGameOver, showMilestone,
  };
})();
