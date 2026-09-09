// render.js — hand-rolled canvas renderer for the grid-based board.
window.TT = window.TT || {};

TT.Render = (function () {
  const board = TT.Board;
  const pieces = TT.Pieces;

  let canvas, ctx, width, height;
  let stars = [];
  let frameCount = 0;
  let flashAlpha = 0;

  // Layout, recomputed on init/resize.
  let cellSize = 24;
  let boardPxW = 0;
  let boardPxH = 0;
  let offsetX = 0;
  let offsetY = 0;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();

    stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function resize() {
    width = canvas.width;
    height = canvas.height;

    const maxCellW = (width * 0.62) / board.COLS;
    const maxCellH = (height * 0.86) / board.ROWS;
    cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    boardPxW = cellSize * board.COLS;
    boardPxH = cellSize * board.ROWS;
    offsetX = (width - boardPxW) / 2;
    offsetY = (height - boardPxH) / 2 + height * 0.03;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#120a2e');
    grad.addColorStop(1, '#35216f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(frameCount * 0.03 + s.phase);
      ctx.globalAlpha = 0.25 + tw * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawBoardFrame() {
    // Outer panel behind the playfield.
    ctx.save();
    ctx.fillStyle = 'rgba(18, 10, 46, 0.55)';
    ctx.fillRect(offsetX - 10, offsetY - 10, boardPxW + 20, boardPxH + 20);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 10, offsetY - 10, boardPxW + 20, boardPxH + 20);
    ctx.restore();

    // Faint grid lines.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
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

  function drawCell(r, c, color, alpha) {
    if (r < 0) return; // above the visible board (spawn area) — don't draw
    const { x, y, w, h } = cellRect(r, c);
    const pad = 1.5;

    ctx.save();
    ctx.globalAlpha = alpha !== undefined ? alpha : 1;
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);

    // Gloss highlight along the top edge.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + pad, y + pad, w - pad * 2, Math.max(2, h * 0.22));

    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
    ctx.restore();
  }

  function drawLockedGrid() {
    for (let r = 0; r < board.ROWS; r++) {
      for (let c = 0; c < board.COLS; c++) {
        const color = board.cellAt(r, c);
        if (color) drawCell(r, c, color, 1);
      }
    }
  }

  function computeGhostRow(piece) {
    const cells = pieces.cellsFor(piece.type, piece.rotation);
    let row = piece.row;
    while (board.isValidPosition(cells, row + 1, piece.col)) row++;
    return row;
  }

  function drawGhost(piece) {
    const ghostRow = computeGhostRow(piece);
    if (ghostRow === piece.row) return; // already touching down, skip
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
      drawCell(piece.row + cell.r, piece.col + cell.c, color, 1);
    });
  }

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

  function frame(opts) {
    if (canvas.width !== width || canvas.height !== height) resize();
    frameCount++;

    drawBackground();
    drawBoardFrame();
    drawLockedGrid();

    if (opts.current) {
      drawGhost(opts.current);
      drawActivePiece(opts.current);
    }

    drawFlash();
  }

  return { init, frame, flashClear };
})();
