// combat.js — health, enemy pools, damage math, the player's dragon
// ally, the horde/boss's counter-attacks, and endless level scaling.
// Pure numeric logic, no rendering or DOM.
//
// Roles (this matters, got corrected once already):
//   - The DRAGON fights FOR the player. It attacks the horde/boss
//     periodically, and every line you clear permanently adds to how
//     much damage it deals per hit.
//   - The HORDE (mobs) and BOSS are the enemy. Together they're a single
//     HP pool per level, split 50/50; mobs soak damage first, boss only
//     takes overflow once mobs are dead. They periodically strike the
//     player's castle back.
//   - Turrets on the castle's own battlements also passively chip away
//     at the horde/boss, scaling with total blocks placed.
window.TT = window.TT || {};

TT.Combat = (function () {
  const BASE_MAX_HP = 100;
  const HP_PER_BLOCK = 2; // castle max HP grows with every block placed

  const BASE_ENEMY_HP = 300; // level 1's total horde+boss pool
  const DAMAGE_PER_BLOCK_TICK = 0.4; // passive turret damage per block, per tick
  const TURRET_TICK_MS = 1000;
  const MULTIPLIER_PER_LINE = 0.03; // +3% permanent damage per line ever cleared, applies to both turrets and the dragon

  const DRAGON_BASE_DAMAGE = 15;
  const DRAGON_DAMAGE_PER_BLOCK_CLEARED = 2; // permanent, added to every future hit
  const DRAGON_ATTACK_INTERVAL_MS = 2200; // fixed — the dragon doesn't get slower as levels get harder, it gets stronger from your line clears instead

  // Tuned deliberately gentler than a first pass that turned out to
  // create an unavoidable death around a specific level regardless of
  // skill — verified across several simulated play paces before shipping.
  const ENEMY_ATTACK_BASE_MS = 7000;
  const ENEMY_ATTACK_MIN_MS = 3000;
  const ENEMY_ATTACK_STEP_MS = 200;
  const ENEMY_DAMAGE_BASE = 5;
  const ENEMY_DAMAGE_PER_LEVEL = 2;

  let maxHP, hp;
  let level, linesRequired, linesThisLevel, totalLinesEver;
  let mobHP, mobMaxHP, bossHP, bossMaxHP;
  let damageMultiplier;
  let dragonDamage;
  let turretTimer, dragonTimer, enemyTimer, enemyAttackInterval;
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
    dragonDamage = DRAGON_BASE_DAMAGE;
    turretTimer = 0;
    dragonTimer = 0;
    enemyTimer = 0;
    enemyAttackInterval = ENEMY_ATTACK_BASE_MS;
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
  // start coming off the boss. Used by both turrets and the dragon.
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
      enemyAttackInterval = Math.max(
        ENEMY_ATTACK_MIN_MS,
        ENEMY_ATTACK_BASE_MS - (level - 1) * ENEMY_ATTACK_STEP_MS
      );
      if (hooks.onLevelComplete) hooks.onLevelComplete(level);
    }
  }

  // Line clears do two things: permanently add to the dragon's own
  // damage (the specific ask — every future dragon hit gets bigger), and
  // raise the broader percentage multiplier that also boosts turret
  // damage, so both scale up as levels get harder.
  function onLinesCleared(numLines, blocksInClear) {
    totalLinesEver += numLines;
    linesThisLevel += numLines;
    damageMultiplier = 1 + totalLinesEver * MULTIPLIER_PER_LINE;
    dragonDamage += blocksInClear * DRAGON_DAMAGE_PER_BLOCK_CLEARED;
  }

  // Called every frame with the current total filled-cell count — drives
  // turret DPS, the dragon's own attack cadence, and the horde/boss's
  // counter-attack on the player.
  function update(delta, filledCellCount) {
    turretTimer += delta;
    while (turretTimer >= TURRET_TICK_MS) {
      turretTimer -= TURRET_TICK_MS;
      if (filledCellCount > 0) {
        dealDamageToEnemy(filledCellCount * DAMAGE_PER_BLOCK_TICK);
      }
    }

    dragonTimer += delta;
    if (dragonTimer >= DRAGON_ATTACK_INTERVAL_MS) {
      dragonTimer = 0;
      dealDamageToEnemy(dragonDamage);
      if (hooks.onDragonAttack) hooks.onDragonAttack();
    }

    enemyTimer += delta;
    if (enemyTimer >= enemyAttackInterval) {
      enemyTimer = 0;
      const dmg = ENEMY_DAMAGE_BASE + (level - 1) * ENEMY_DAMAGE_PER_LEVEL;
      hp = Math.max(0, hp - dmg);
      if (hooks.onPlayerDamaged) hooks.onPlayerDamaged(dmg);
      if (hp <= 0 && hooks.onGameOverHP) hooks.onGameOverHP();
    }
  }

  function getState() {
    return {
      hp, maxHP, level, linesRequired, linesThisLevel, totalLinesEver,
      mobHP, mobMaxHP, bossHP, bossMaxHP, damageMultiplier, dragonDamage,
      enemyTimer, enemyAttackInterval,
    };
  }

  return {
    init, onPieceLocked, onLinesCleared, update, getState,
    linesRequiredForLevel, enemyPoolForLevel,
  };
})();
