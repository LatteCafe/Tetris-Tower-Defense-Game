// render.js — hand-rolled canvas renderer: castle-block board, an
// animated dragon in the pit below it, and turret projectile effects.
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
  let dragonCx = 0;
  let dragonCy = 0;

  let flashAlpha = 0; // line-clear board flash
  let dragonHitFlash = 0; // dragon takes-damage flash
  let dragonAttackAnim = 0; // dragon lunges when it attacks the player
  let projectiles = []; // { x, y, targetX, targetY, t, kind }
  let ambientFireTimer = 0;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();

    stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.6,
      r: Math.random() * 1.3 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    embers = Array.from({ length: 24 }, () => spawnEmber());
  }

  function spawnEmber() {
    return {
      x: Math.random() * width,
      y: height * (0.5 + Math.random() * 0.5),
      speed: 0.15 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 0.6,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function resize() {
    width = canvas.width;
    height = canvas.height;

    const dragonPitH = height * 0.16;
    const maxCellW = (width * 0.6) / board.COLS;
    const maxCellH = ((height - dragonPitH) * 0.84) / board.ROWS;
    cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    boardPxW = cellSize * board.COLS;
    boardPxH = cellSize * board.ROWS;
    offsetX = (width - boardPxW) / 2;
    offsetY = (height - dragonPitH) * 0.5 - boardPxH * 0.42;

    dragonCx = width / 2;
    dragonCy = offsetY + boardPxH + dragonPitH * 0.55;
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

  // ---------- Board frame & cells ----------

  function drawBoardFrame() {
    ctx.save();
    ctx.fillStyle = 'rgba(40, 26, 20, 0.6)';
    ctx.fillRect(offsetX - 12, offsetY - 12, boardPxW + 24, boardPxH + 24);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(offsetX - 12, offsetY - 12, boardPxW + 24, boardPxH + 24);
    ctx.restore();

    // Crenellations along the top of the whole castle frame.
    ctx.save();
    ctx.fillStyle = 'rgba(212, 175, 55, 0.28)';
    const merlonW = boardPxW / 12;
    for (let i = 0; i < 12; i += 2) {
      ctx.fillRect(offsetX + i * merlonW, offsetY - 22, merlonW, 12);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= board.COLS; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + boardPxH);
      ctx.stroke();
    }
    for (let r = 0; r <= board.ROWS; r++) {
      const y = offsetY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + boardPxW, y);
      ctx.stroke();
    }
    ctx.restore();
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

  function drawCell(r, c, color, opts) {
    if (r < 0) return; // above the visible board (spawn area)
    const { x, y, w, h } = cellRect(r, c);
    const pad = 1.5;
    const locked = opts && opts.locked;
    const alpha = (opts && opts.alpha) || 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + pad, y + pad, w - pad * 2, Math.max(2, h * 0.2));

    if (locked) {
      // Mortar lines — makes locked cells read as stone blockwork rather
      // than a flat color, distinct from the active falling piece.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + pad, y + h * 0.55);
      ctx.lineTo(x + w - pad, y + h * 0.55);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
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
      // A little hooded figure: round head + triangular body.
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
      // Tiny bow.
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx + w * 0.16, topY + h * 0.28, w * 0.14, -0.9, 0.9);
      ctx.stroke();
    } else {
      // A stubby cannon barrel poking up.
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
    // Battlement turrets along the exposed top edge of the stack.
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

  // ---------- Dragon ----------

  function drawDragon(combatState) {
    if (!combatState) return;
    const bob = Math.sin(clockMs * 0.0025) * 4;
    const lungeT = dragonAttackAnim;
    const lunge = lungeT * 10;
    const cy = dragonCy + bob + lunge;
    const cx = dragonCx;
    const scale = Math.min(width / 500, 1.4);

    const bodyGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70 * scale);
    const flash = dragonHitFlash;
    bodyGrad.addColorStop(0, flash > 0 ? '#fff3c4' : '#ff6b4d');
    bodyGrad.addColorStop(1, flash > 0 ? '#ffb37a' : '#8a1f2b');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Wings
    ctx.fillStyle = 'rgba(120, 30, 40, 0.85)';
    const wingFlap = Math.sin(clockMs * 0.006) * 10;
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.lineTo(-70, -30 - wingFlap);
    ctx.lineTo(-55, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, -6);
    ctx.lineTo(70, -30 - wingFlap);
    ctx.lineTo(55, 4);
    ctx.closePath();
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#8a1f2b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-30, 20);
    ctx.quadraticCurveTo(-60, 30, -80, 10);
    ctx.stroke();

    // Body
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head / neck
    ctx.beginPath();
    ctx.ellipse(38 + lunge, -6, 18, 13, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#4a1013';
    ctx.beginPath();
    ctx.moveTo(44 + lunge, -16);
    ctx.lineTo(50 + lunge, -28);
    ctx.lineTo(46 + lunge, -14);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = flash > 0 ? '#402000' : '#ffe36e';
    ctx.beginPath();
    ctx.arc(44 + lunge, -9, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (flash > 0) dragonHitFlash = Math.max(0, flash - 0.05);
    if (lungeT > 0) dragonAttackAnim = Math.max(0, lungeT - 0.05);
  }

  function flashDragonHit() {
    dragonHitFlash = 1;
  }

  function dragonAttackPulse() {
    dragonAttackAnim = 1;
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

  function spawnProjectiles(blockCount) {
    const count = Math.max(1, Math.min(10, Math.round(blockCount / 4)));
    firePositions(count).forEach((pos, i) => {
      projectiles.push({
        x: pos.x, y: pos.y,
        targetX: dragonCx + (Math.random() - 0.5) * 30,
        targetY: dragonCy,
        t: 0,
        kind: i % 2 === 0 ? 'arrow' : 'ball',
      });
    });
  }

  function updateAndDrawProjectiles(delta) {
    projectiles = projectiles.filter((p) => p.t < 1);
    projectiles.forEach((p) => {
      p.t += delta / 450;
      const x = p.x + (p.targetX - p.x) * p.t;
      const y = p.y + (p.targetY - p.y) * p.t;

      ctx.save();
      if (p.kind === 'ball') {
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
    if (ambientFireTimer >= 1200) {
      ambientFireTimer = 0;
      spawnProjectiles(4);
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
    drawDragon(opts.combat);

    ambientFire(delta || 16.67, board.countFilledCells());
    updateAndDrawProjectiles(delta || 16.67);
  }

  return { init, frame, flashClear, flashDragonHit, dragonAttackPulse, spawnProjectiles };
})();
