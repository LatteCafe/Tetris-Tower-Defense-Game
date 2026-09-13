// render.js — hand-rolled canvas renderer. The blocks themselves carry
// the castle theming (stone texture, battlement turrets); the frame
// around the board is deliberately understated so it doesn't compete
// with them. Below the board: the player's dragon ally on one side, the
// horde it's fighting in the middle, and the boss looming behind them.
window.TT = window.TT || {};

TT.Render = (function () {
  const board = TT.Board;
  const pieces = TT.Pieces;

  let canvas, ctx, width, height;
  let stars = [];
  let embers = [];
  let clockMs = 0;

  // Layout, recomputed on init/resize.
  let cellSize = 24;
  let boardPxW = 0;
  let boardPxH = 0;
  let offsetX = 0;
  let offsetY = 0;
  let pitY = 0;
  let pitH = 0;
  let dragonCx = 0;
  let hordeCx = 0;
  let bossCx = 0;

  let flashAlpha = 0; // line-clear board flash
  let enemyHitFlash = 0; // horde/boss takes-damage flash
  let dragonAttackAnim = 0; // dragon lunges when it fires
  let dragonPowerAnim = 0; // dragon glows when a line clear boosts it
  let castleShake = 0; // brief shake when the horde/boss strikes back
  let projectiles = []; // { x, y, targetX, targetY, t, kind }
  let ambientFireTimer = 0;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();

    stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.55,
      r: Math.random() * 1.3 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    embers = Array.from({ length: 20 }, () => spawnEmber());
  }

  function spawnEmber() {
    return {
      x: Math.random() * width,
      y: height * (0.5 + Math.random() * 0.5),
      speed: 0.15 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.5,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    width = canvas.width;
    height = canvas.height;

    pitH = height * 0.18;
    const maxCellW = (width * 0.6) / board.COLS;
    const maxCellH = ((height - pitH) * 0.84) / board.ROWS;
    cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    boardPxW = cellSize * board.COLS;
    boardPxH = cellSize * board.ROWS;
    offsetX = (width - boardPxW) / 2;
    offsetY = (height - pitH) * 0.5 - boardPxH * 0.42;

    pitY = offsetY + boardPxH;
    dragonCx = width * 0.22;
    hordeCx = width * 0.52;
    bossCx = width * 0.78;
  }

  // ---------- Background ----------

  function drawBackground(delta) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#140a1f');
    grad.addColorStop(0.6, '#2a1230');
    grad.addColorStop(1, '#3d1a1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(clockMs * 0.002 + s.phase);
      ctx.globalAlpha = 0.2 + tw * 0.5;
      ctx.fillStyle = '#ffe9c7';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.save();
    embers.forEach((e) => {
      e.y -= e.speed * (delta / 16.67);
      e.x += e.drift * (delta / 16.67);
      if (e.y < 0) Object.assign(e, spawnEmber(), { y: height + 10 });
      const tw = 0.5 + 0.5 * Math.sin(clockMs * 0.004 + e.phase);
      ctx.globalAlpha = 0.3 + tw * 0.4;
      ctx.fillStyle = '#ff9a4d';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ---------- Board frame (deliberately plain — the blocks carry the theme) ----------

  function drawBoardFrame() {
    const shakeX = castleShake > 0 ? (Math.random() - 0.5) * castleShake * 6 : 0;
    ctx.save();
    ctx.translate(shakeX, 0);

    ctx.fillStyle = 'rgba(30, 20, 16, 0.5)';
    ctx.fillRect(offsetX - 10, offsetY - 10, boardPxW + 20, boardPxH + 20);

    ctx.strokeStyle = castleShake > 0
      ? `rgba(200, 60, 50, ${0.3 + castleShake * 0.5})`
      : 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 10, offsetY - 10, boardPxW + 20, boardPxH + 20);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= board.COLS; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + boardPxH);
      ctx.stroke();
    }
    ctx.restore();

    if (castleShake > 0) castleShake = Math.max(0, castleShake - 0.06);
  }

  function cellRect(r, c) {
    return {
      x: offsetX + c * cellSize,
      y: offsetY + r * cellSize,
      w: cellSize,
      h: cellSize,
    };
  }

  function cellCenter(r, c) {
    return {
      x: offsetX + c * cellSize + cellSize / 2,
      y: offsetY + r * cellSize + cellSize / 2,
    };
  }

  // ---------- Cells: this is where the castle theming actually lives ----------

  function blendWithStone(hex, stoneAmount) {
    const h = parseInt(hex.slice(1), 16);
    const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
    const stoneR = 150, stoneG = 140, stoneB = 122;
    const mix = (a, s) => Math.round(a * (1 - stoneAmount) + s * stoneAmount);
    return `rgb(${mix(r, stoneR)},${mix(g, stoneG)},${mix(b, stoneB)})`;
  }

  function drawCell(r, c, color, opts) {
    if (r < 0) return;
    const { x, y, w, h } = cellRect(r, c);
    const pad = 1.5;
    const locked = opts && opts.locked;
    const fill = locked ? blendWithStone(color, 0.45) : color;

    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);

    // Beveled highlight (top-left) / shadow (bottom-right) for a
    // masonry-block feel rather than a flat tile.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + pad, y + pad, w - pad * 2, Math.max(2, h * 0.16));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + pad, y + h - pad - Math.max(2, h * 0.14), w - pad * 2, Math.max(2, h * 0.14));

    if (locked) {
      // Mortar lines on every edge, splitting the cell into a little
      // brick pattern rather than one flat square — this is what makes
      // locked blocks actually read as castle stonework.
      ctx.strokeStyle = 'rgba(40, 30, 20, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + pad, y + h * 0.5);
      ctx.lineTo(x + w - pad, y + h * 0.5);
      ctx.moveTo(x + w * 0.5, y + pad);
      ctx.lineTo(x + w * 0.5, y + h * 0.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
    ctx.restore();
  }

  function drawTurret(r, c, kind) {
    const { x, y, w, h } = cellRect(r, c);
    const cx = x + w / 2;
    const topY = y - h * 0.32;

    ctx.save();
    if (kind === 'archer') {
      ctx.fillStyle = '#e9dfc9';
      ctx.beginPath();
      ctx.arc(cx, topY + h * 0.1, w * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4b2b';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.14, y - 1);
      ctx.lineTo(cx + w * 0.14, y - 1);
      ctx.lineTo(cx, topY + h * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx + w * 0.16, topY + h * 0.28, w * 0.14, -0.9, 0.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(cx - w * 0.16, topY, w * 0.32, h * 0.42);
      ctx.beginPath();
      ctx.arc(cx, topY, w * 0.17, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(cx, topY, w * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLockedGrid() {
    for (let r = 0; r < board.ROWS; r++) {
      for (let c = 0; c < board.COLS; c++) {
        const color = board.cellAt(r, c);
        if (color) drawCell(r, c, color, { locked: true });
      }
    }
    board.topFilledCellPerColumn().forEach(({ row, col }) => {
      drawTurret(row, col, col % 2 === 0 ? 'archer' : 'cannon');
    });
  }

  function computeGhostRow(piece) {
    const cells = pieces.cellsFor(piece.type, piece.rotation);
    let row = piece.row;
    while (board.isValidPosition(cells, row + 1, piece.col)) row++;
    return row;
  }

  function drawGhost(piece) {
    const ghostRow = computeGhostRow(piece);
    if (ghostRow === piece.row) return;
    const cells = pieces.cellsFor(piece.type, piece.rotation);
    const color = pieces.colorFor(piece.type);

    cells.forEach((cell) => {
      const r = ghostRow + cell.r;
      const c = piece.col + cell.c;
      if (r < 0) return;
      const { x, y, w, h } = cellRect(r, c);
      const pad = 2;
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
      ctx.restore();
    });
  }

  function drawActivePiece(piece) {
    const cells = pieces.cellsFor(piece.type, piece.rotation);
    const color = pieces.colorFor(piece.type);
    cells.forEach((cell) => {
      drawCell(piece.row + cell.r, piece.col + cell.c, color, { locked: false });
    });
  }

  // ---------- The dragon (player's ally) ----------

  function drawDragon() {
    const bob = Math.sin(clockMs * 0.0025) * 4;
    const lunge = dragonAttackAnim * 16;
    const cy = pitY + pitH * 0.55 + bob;
    const cx = dragonCx + lunge;
    const scale = Math.min(width / 600, 1.1);
    const glow = dragonPowerAnim;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const bodyGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    if (glow > 0) {
      bodyGrad.addColorStop(0, '#fff3c4');
      bodyGrad.addColorStop(1, '#f0a83a');
    } else {
      bodyGrad.addColorStop(0, '#5ec9d6');
      bodyGrad.addColorStop(1, '#1c5f73');
    }

    // Tail, curled behind it.
    ctx.strokeStyle = '#1c5f73';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-28, 14);
    ctx.quadraticCurveTo(-55, 26, -50, 4);
    ctx.quadraticCurveTo(-46, -10, -60, -6);
    ctx.stroke();

    // Wings, swept back — smoother membrane shape via quadratic curves.
    const flap = Math.sin(clockMs * 0.005) * 8;
    [-1, 1].forEach((side) => {
      ctx.fillStyle = 'rgba(30, 90, 100, 0.85)';
      ctx.beginPath();
      ctx.moveTo(side * 14, -10);
      ctx.quadraticCurveTo(side * 45, -34 - flap, side * 66, -14 - flap);
      ctx.quadraticCurveTo(side * 44, -4, side * 30, 8);
      ctx.closePath();
      ctx.fill();
    });

    // Spine spikes.
    ctx.fillStyle = '#123a46';
    for (let i = 0; i < 4; i++) {
      const sx = -18 + i * 12;
      ctx.beginPath();
      ctx.moveTo(sx, -18);
      ctx.lineTo(sx + 5, -28 - i);
      ctx.lineTo(sx + 10, -18);
      ctx.closePath();
      ctx.fill();
    }

    // Body.
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck + head, facing right toward the horde.
    ctx.beginPath();
    ctx.ellipse(34, -8, 15, 10, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Snout.
    ctx.beginPath();
    ctx.moveTo(44, -10);
    ctx.quadraticCurveTo(58, -8, 56, -2);
    ctx.quadraticCurveTo(50, -2, 44, -4);
    ctx.closePath();
    ctx.fill();

    // Horns.
    ctx.fillStyle = '#0c2830';
    ctx.beginPath();
    ctx.moveTo(30, -18);
    ctx.lineTo(34, -30);
    ctx.lineTo(32, -16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(38, -18);
    ctx.lineTo(44, -28);
    ctx.lineTo(40, -15);
    ctx.closePath();
    ctx.fill();

    // Eye.
    ctx.fillStyle = glow > 0 ? '#3a1e00' : '#ffe36e';
    ctx.beginPath();
    ctx.arc(40, -10, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Fire breath, only while attacking.
    if (dragonAttackAnim > 0.3) {
      const fireGrad = ctx.createLinearGradient(56, -4, 90, -4);
      fireGrad.addColorStop(0, 'rgba(255,180,60,0.9)');
      fireGrad.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.moveTo(56, -6);
      ctx.lineTo(90, -3);
      ctx.lineTo(56, 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    if (dragonAttackAnim > 0) dragonAttackAnim = Math.max(0, dragonAttackAnim - 0.05);
    if (dragonPowerAnim > 0) dragonPowerAnim = Math.max(0, dragonPowerAnim - 0.02);
  }

  function dragonFires() {
    dragonAttackAnim = 1;
    const target = { x: hordeCx, y: pitY + pitH * 0.5 };
    projectiles.push({
      x: dragonCx + 50, y: pitY + pitH * 0.45,
      targetX: target.x, targetY: target.y, t: 0, kind: 'fireball',
    });
  }

  function dragonPowerUp() {
    dragonPowerAnim = 1;
  }

  // ---------- Horde & boss (the enemy) ----------

  function drawHorde(combatState) {
    if (!combatState) return;
    const pct = Math.max(0, combatState.mobHP / combatState.mobMaxHP);
    const count = Math.max(0, Math.ceil(pct * 6));
    const baseY = pitY + pitH * 0.62;

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 22;
      const jitter = Math.sin(clockMs * 0.006 + i * 1.7) * 2;
      const mx = hordeCx + spread;
      const my = baseY + jitter;
      const hitGlow = enemyHitFlash;

      ctx.save();
      ctx.fillStyle = hitGlow > 0 ? '#ffe9c7' : '#5a3a52';
      ctx.beginPath();
      ctx.ellipse(mx, my, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Two small horns.
      ctx.fillStyle = '#2e1b28';
      ctx.beginPath();
      ctx.moveTo(mx - 5, my - 6);
      ctx.lineTo(mx - 7, my - 12);
      ctx.lineTo(mx - 3, my - 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(mx + 3, my - 6);
      ctx.lineTo(mx + 7, my - 12);
      ctx.lineTo(mx + 5, my - 6);
      ctx.closePath();
      ctx.fill();
      // Eyes.
      ctx.fillStyle = '#ff5a4d';
      ctx.beginPath();
      ctx.arc(mx - 3, my - 1, 1.4, 0, Math.PI * 2);
      ctx.arc(mx + 3, my - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBoss(combatState) {
    if (!combatState) return;
    const mobsAlive = combatState.mobHP > 0;
    const pct = Math.max(0, combatState.bossHP / combatState.bossMaxHP);
    const scale = mobsAlive ? 0.75 : 1;
    const alpha = mobsAlive ? 0.4 : 1;
    const bob = Math.sin(clockMs * 0.0018) * 3;
    const cy = pitY + pitH * 0.55 + bob;
    const hitGlow = enemyHitFlash;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bossCx, cy);
    ctx.scale(scale, scale);

    ctx.fillStyle = hitGlow > 0 ? '#ffd9c4' : '#3a1030';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Large curved horns.
    ctx.strokeStyle = '#150414';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.quadraticCurveTo(-26, -34, -14, -40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -14);
    ctx.quadraticCurveTo(26, -34, 14, -40);
    ctx.stroke();

    // Glowing eyes.
    ctx.fillStyle = '#ff2a2a';
    ctx.beginPath();
    ctx.arc(-8, -4, 3, 0, Math.PI * 2);
    ctx.arc(8, -4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Fading HP-based cracks/damage marks once heavily hurt.
    if (pct < 0.4) {
      ctx.strokeStyle = 'rgba(255,80,60,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(2, 14);
      ctx.moveTo(6, 2);
      ctx.lineTo(12, 12);
      ctx.stroke();
    }

    ctx.restore();
  }

  function flashEnemyHit() {
    enemyHitFlash = 1;
  }

  function castleUnderAttack() {
    castleShake = 1;
  }

  // ---------- Projectiles ----------

  function firePositions(count) {
    const tops = board.topFilledCellPerColumn();
    if (tops.length === 0) return [];
    const positions = [];
    for (let i = 0; i < count; i++) {
      const t = tops[Math.floor(Math.random() * tops.length)];
      positions.push(cellCenter(t.row, t.col));
    }
    return positions;
  }

  function spawnProjectiles(count) {
    const target = { x: hordeCx, y: pitY + pitH * 0.5 };
    firePositions(count).forEach((pos, i) => {
      projectiles.push({
        x: pos.x, y: pos.y,
        targetX: target.x + (Math.random() - 0.5) * 30,
        targetY: target.y,
        t: 0,
        kind: i % 2 === 0 ? 'arrow' : 'ball',
      });
    });
  }

  function updateAndDrawProjectiles(delta) {
    projectiles = projectiles.filter((p) => p.t < 1);
    projectiles.forEach((p) => {
      p.t += delta / (p.kind === 'fireball' ? 300 : 450);
      const x = p.x + (p.targetX - p.x) * p.t;
      const y = p.y + (p.targetY - p.y) * p.t;

      ctx.save();
      if (p.kind === 'fireball') {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, '#fff3c4');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ball') {
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#e9dfc9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#e9dfc9';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(1, -3);
        ctx.lineTo(1, 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function ambientFire(delta, filledCellCount) {
    if (filledCellCount <= 0) return;
    ambientFireTimer += delta;
    if (ambientFireTimer >= 1000) {
      ambientFireTimer = 0;
      spawnProjectiles(Math.max(1, Math.min(6, Math.round(filledCellCount / 8))));
    }
  }

  // ---------- Flash / misc ----------

  function flashClear() {
    flashAlpha = 0.5;
  }

  function drawFlash() {
    if (flashAlpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(offsetX, offsetY, boardPxW, boardPxH);
    ctx.restore();
    flashAlpha *= 0.85;
  }

  function frame(opts, delta) {
    if (canvas.width !== width || canvas.height !== height) resize();
    clockMs += delta || 16.67;

    drawBackground(delta || 16.67);
    drawBoardFrame();
    drawLockedGrid();

    if (opts.current) {
      drawGhost(opts.current);
      drawActivePiece(opts.current);
    }

    drawFlash();
    drawHorde(opts.combat);
    drawBoss(opts.combat);
    drawDragon();

    ambientFire(delta || 16.67, board.countFilledCells());
    updateAndDrawProjectiles(delta || 16.67);

    if (enemyHitFlash > 0) enemyHitFlash = Math.max(0, enemyHitFlash - 0.06);
  }

  return {
    init, frame, flashClear,
    flashEnemyHit, dragonFires, dragonPowerUp, castleUnderAttack,
  };
})();
