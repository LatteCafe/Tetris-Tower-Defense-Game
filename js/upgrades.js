// upgrades.js — the RPG upgrade tree. Pure logic: costs, levels, and
// effect values. No DOM, no rendering — combat.js reads effects
// directly, ui.js renders the shop from `list()`.
window.TT = window.TT || {};

TT.Upgrades = (function () {
  const DEFS = {
    vitality: {
      name: 'Vitality',
      desc: '+20 max castle HP per level',
      icon: '❤',
      baseCost: 50,
      costGrowth: 1.6,
      maxLevel: 5,
      perLevel: 20, // flat max HP
    },
    regen: {
      name: 'Regeneration',
      desc: '+0.5 HP regen per second, per level',
      icon: '✚',
      baseCost: 60,
      costGrowth: 1.7,
      maxLevel: 5,
      perLevel: 0.5, // HP/sec
    },
    armor: {
      name: 'Armor',
      desc: '-5% incoming damage per level',
      icon: '🛡',
      baseCost: 80,
      costGrowth: 1.9,
      maxLevel: 6, // caps at -30% incoming damage
      perLevel: 0.05,
    },
    turretAttack: {
      name: 'Turret Mastery',
      desc: '+20% turret damage per level',
      icon: '🏹',
      baseCost: 70,
      costGrowth: 1.7,
      maxLevel: 5,
      perLevel: 0.2,
    },
    dragonMight: {
      name: "Dragon's Might",
      desc: '+25% dragon damage per level',
      icon: '🐉',
      baseCost: 90,
      costGrowth: 1.8,
      maxLevel: 5,
      perLevel: 0.25,
    },
    goldGain: {
      name: 'Treasure Hunter',
      desc: '+10% gold earned per level',
      icon: '💰',
      baseCost: 40,
      costGrowth: 1.5,
      maxLevel: 5,
      perLevel: 0.1,
    },
    quickHands: {
      name: 'Quick Hands',
      desc: '-1.5s discard cooldown per level',
      icon: '⟳',
      baseCost: 60,
      costGrowth: 1.6,
      maxLevel: 4, // 10s down to a 4s floor
      perLevel: 1.5,
    },
  };

  const STORAGE_KEY = 'castleSiege.upgrades.v1';

  let levels = {};

  // reset() clears in-memory levels to zero — used internally before
  // loading a save, and available as a genuine "wipe my progress" action.
  // It is NOT called between runs; upgrade levels are meta-progression
  // and persist across deaths/new games by design.
  function reset() {
    levels = {};
    Object.keys(DEFS).forEach((id) => { levels[id] = 0; });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
    } catch (e) {
      // Storage unavailable (private browsing, quota, etc.) — progress
      // just won't persist this session, not worth surfacing to the player.
    }
  }

  function load() {
    reset();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.keys(DEFS).forEach((id) => {
        if (typeof saved[id] === 'number') {
          levels[id] = Math.max(0, Math.min(saved[id], DEFS[id].maxLevel));
        }
      });
    } catch (e) {
      // Corrupt or unavailable save data — fall back to a clean reset()
      // state, which already ran above.
    }
  }

  load();

  function hardResetProgress() {
    reset();
    save();
  }

  function getLevel(id) {
    return levels[id] || 0;
  }

  // Cost of the NEXT purchase, or null if already at max level.
  function getCost(id) {
    const def = DEFS[id];
    const lvl = getLevel(id);
    if (lvl >= def.maxLevel) return null;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, lvl));
  }

  // Total effect value from levels already purchased (0 if none).
  function getEffect(id) {
    const def = DEFS[id];
    if (!def) return 0;
    return getLevel(id) * def.perLevel;
  }

  function purchase(id, gold) {
    const cost = getCost(id);
    if (cost === null) return { success: false, reason: 'maxed', cost: null };
    if (gold < cost) return { success: false, reason: 'cant-afford', cost };
    levels[id]++;
    save();
    return { success: true, cost, newLevel: levels[id] };
  }

  function list() {
    return Object.keys(DEFS).map((id) => ({
      id,
      ...DEFS[id],
      level: getLevel(id),
      cost: getCost(id),
      maxed: getLevel(id) >= DEFS[id].maxLevel,
    }));
  }

  return { reset, hardResetProgress, getLevel, getCost, getEffect, purchase, list, DEFS };
})();
