// ui.js — wires the HUD, start/game-over/upgrade screens, HP/enemy bars,
// discard button, and toast to the DOM.
window.TT = window.TT || {};

TT.UI = (function () {
  let elTimer, elScore, elGold, elLines, elLevel, elNextSwatch;
  let elOverlay, elStart, elGameOver, elUpgrades, elToast;
  let elHpFill, elHpText, elMobFill, elBossFill;
  let elDiscardBtn, elDiscardFill;
  let elUpgradeGold, elUpgradeList;
  let toastHideTimer = null;

  function init() {
    elTimer = document.getElementById('stat-timer');
    elScore = document.getElementById('stat-score');
    elGold = document.getElementById('stat-gold');
    elLines = document.getElementById('stat-lines');
    elLevel = document.getElementById('stat-level');
    elNextSwatch = document.getElementById('next-swatch');
    elOverlay = document.getElementById('overlay');
    elStart = document.getElementById('screen-start');
    elGameOver = document.getElementById('screen-gameover');
    elUpgrades = document.getElementById('screen-upgrades');
    elToast = document.getElementById('toast');

    elHpFill = document.getElementById('hp-bar-fill');
    elHpText = document.getElementById('hp-text');
    elMobFill = document.getElementById('mob-bar-fill');
    elBossFill = document.getElementById('boss-bar-fill');

    elDiscardBtn = document.getElementById('btn-discard');
    elDiscardFill = document.getElementById('discard-fill');

    elUpgradeGold = document.getElementById('upgrade-gold');
    elUpgradeList = document.getElementById('upgrade-list');

    document.getElementById('btn-start').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-retry').addEventListener('click', () => TT.Game.startGame());
    document.getElementById('btn-upgrades-close').addEventListener('click', () => TT.Game.toggleUpgradesMenu());
    document.getElementById('btn-upgrades-open').addEventListener('click', () => TT.Game.toggleUpgradesMenu());
    elDiscardBtn.addEventListener('click', () => TT.Game.discardPiece());
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function updateStats(elapsedMs, score, gold, lines, combatState) {
    elTimer.textContent = formatTime(elapsedMs);
    elScore.textContent = score;
    elGold.textContent = gold;
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
    elUpgrades.classList.add('hidden');
  }

  function showScreen(name) {
    elOverlay.classList.remove('transparent');
    elStart.classList.add('hidden');
    elGameOver.classList.add('hidden');
    elUpgrades.classList.add('hidden');
    const map = { start: elStart, gameover: elGameOver, upgrades: elUpgrades };
    map[name].classList.remove('hidden');
  }

  function showGameOver(cause, score, lines, level) {
    const title = cause === 'health' ? 'The Castle Has Fallen' : 'No Room Left to Build';
    document.querySelector('#screen-gameover h2').textContent = title;
    document.getElementById('gameover-stats').textContent =
      `Score ${score} · ${lines} line${lines === 1 ? '' : 's'} · reached level ${level}`;
    showScreen('gameover');
  }

  function showUpgradesMenu(gold, list) {
    elUpgradeGold.textContent = gold;
    elUpgradeList.innerHTML = list.map((u) => {
      const affordable = u.cost !== null && gold >= u.cost;
      const costLabel = u.maxed ? 'MAX' : `${u.cost}g`;
      const btnDisabled = u.maxed || !affordable ? 'disabled' : '';
      return `
        <div class="upgrade-card ${u.maxed ? 'maxed' : ''}">
          <div class="upgrade-icon">${u.icon}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${u.name} <span class="upgrade-level">Lv ${u.level}/${u.maxLevel}</span></div>
            <div class="upgrade-desc">${u.desc}</div>
          </div>
          <button class="upgrade-buy" data-id="${u.id}" ${btnDisabled}>${costLabel}</button>
        </div>
      `;
    }).join('');

    elUpgradeList.querySelectorAll('.upgrade-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const result = TT.Game.purchaseUpgrade(id);
        if (!result.success && result.reason === 'cant-afford') {
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 300);
        }
      });
    });

    showScreen('upgrades');
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
    hideOverlays, showGameOver, showMilestone, showUpgradesMenu,
  };
})();
