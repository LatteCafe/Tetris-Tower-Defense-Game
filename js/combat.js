// combat.js — health, enemy pools, damage math, dragon attacks, and
// endless level scaling. Pure numeric logic, no rendering or DOM.
window.TT = window.TT || {};

TT.Combat = (function () {
  const BASE_MAX_HP = 100;
  const HP_PER_BLOCK = 2; // castle max HP grows with every block placed

  const BASE_ENEMY_HP = 300; // level 1's total mob+boss pool
  const DAMAGE_PER_BLOCK_CLEAR = 6; // burst damage per block in a cleared line
  const DAMAGE_PER_BLOCK_TICK = 0.4; // passive turret damage per block, per tick
  const TURRET_TICK_MS = 1000;
  const MULTIPLIER_PER_LINE = 0.03; // +3% permanent damage per line ever cleared

  const DRAGON_ATTACK_BASE_MS = 6000; // time between dragon attacks at level 1
  const DRAGON_ATTACK_MIN_MS = 2200; // fastest the dragon ever attacks
  const DRAGON_ATTACK_STEP_MS = 250; // interval shrinks this much per level
  const DRAGON_DAMAGE_BASE = 6;
  const DRAGON_DAMAGE_PER_LEVEL = 3;

  let maxHP, hp;
  let level, linesRequired, linesThisLevel, totalLinesEver;
  let mobHP, mobMaxHP, bossHP, bossMaxHP;
  let damageMultiplier;
  let turretTimer, dragonTimer, dragonAttackInterval;
  let hooks = {};

  // Lines needed to reach this level's "difficulty" from the previous one
  // — 0 for level 1, then 1, 2, 4, 8, 16... doubling from level 2 on.
  function linesRequiredForLevel(lvl) {
    if (lvl <= 1) return 0;
    return Math.round(Math.pow(2, lvl - 2));
  }

  function enemyPoolForLevel(lvl) {
    return BASE_ENEMY_HP * (1 + linesRequiredForLevel(lvl));
  }

  function init(customHooks) {
    hooks = customHooks || {};

    maxHP = BASE_MAX_HP;
    hp = BASE_MAX_HP;
    level = 1;
    linesRequired = linesRequiredForLevel(1);
    linesThisLevel = 0;
    totalLinesEver = 0;
    damageMultiplier = 1;
    turretTimer = 0;
    dragonTimer = 0;
    dragonAttackInterval = DRAGON_ATTACK_BASE_MS;
    setLevelPool(1);
  }

  function setLevelPool(lvl) {
    const total = enemyPoolForLevel(lvl);
    mobMaxHP = total * 0.5;
    bossMaxHP = total * 0.5;
    mobHP = mobMaxHP;
    bossHP = bossMaxHP;
  }

  // Called whenever a piece locks — the castle's max HP (and current HP,
  // by the same amount) grows with the total number of blocks placed.
  function onPieceLocked(filledCellCount) {
    const newMax = BASE_MAX_HP + filledCellCount * HP_PER_BLOCK;
    const gained = newMax - maxHP;
    if (gained > 0) {
      maxHP = newMax;
      hp = Math.min(maxHP, hp + gained);
    }
  }

  // Mobs absorb damage first; only once they're fully dead does damage
  // start coming off the boss.
  function dealDamageToEnemy(rawAmount) {
    const amount = rawAmount * damageMultiplier;
    if (mobHP > 0) {
      const applied = Math.min(mobHP, amount);
      mobHP -= applied;
      const overflow = amount - applied;
      if (overflow > 0) bossHP = Math.max(0, bossHP - overflow);
    } else {
      bossHP = Math.max(0, bossHP - amount);
    }
    if (hooks.onEnemyDamaged) hooks.onEnemyDamaged(amount);
    checkLevelComplete();
  }

  function checkLevelComplete() {
    if (mobHP <= 0 && bossHP <= 0) {
      level++;
      linesRequired = linesRequiredForLevel(level);
      linesThisLevel = 0;
      setLevelPool(level);
      dragonAttackInterval = Math.max(
        DRAGON_ATTACK_MIN_MS,
        DRAGON_ATTACK_BASE_MS - (level - 1) * DRAGON_ATTACK_STEP_MS
      );
      if (hooks.onLevelComplete) hooks.onLevelComplete(level);
    }
  }

  // Line clears both burst-damage the enemy pool AND permanently raise
  // the damage multiplier — the scaling boost mentioned in the brief.
  function onLinesCleared(numLines, blocksInClear) {
    totalLinesEver += numLines;
    linesThisLevel += numLines;
    damageMultiplier = 1 + totalLinesEver * MULTIPLIER_PER_LINE;
    dealDamageToEnemy(blocksInClear * DAMAGE_PER_BLOCK_CLEAR);
  }

  // Called every frame with the current total filled-cell count — drives
  // both the passive turret DPS and the dragon's periodic counter-attack.
  function update(delta, filledCellCount) {
    turretTimer += delta;
    while (turretTimer >= TURRET_TICK_MS) {
      turretTimer -= TURRET_TICK_MS;
      if (filledCellCount > 0) {
        dealDamageToEnemy(filledCellCount * DAMAGE_PER_BLOCK_TICK);
      }
    }

    dragonTimer += delta;
    if (dragonTimer >= dragonAttackInterval) {
      dragonTimer = 0;
      const dmg = DRAGON_DAMAGE_BASE + (level - 1) * DRAGON_DAMAGE_PER_LEVEL;
      hp = Math.max(0, hp - dmg);
      if (hooks.onPlayerDamaged) hooks.onPlayerDamaged(dmg);
      if (hp <= 0 && hooks.onGameOverHP) hooks.onGameOverHP();
    }
  }

  function getState() {
    return {
      hp, maxHP, level, linesRequired, linesThisLevel, totalLinesEver,
      mobHP, mobMaxHP, bossHP, bossMaxHP, damageMultiplier,
      dragonTimer, dragonAttackInterval,
    };
  }

  return {
    init, onPieceLocked, onLinesCleared, update, getState,
    linesRequiredForLevel, enemyPoolForLevel,
  };
})();
