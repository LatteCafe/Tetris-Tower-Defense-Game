// game.js — the main game state machine and update loop. Pure grid
// logic throughout; no physics engine, no floating point positions.
window.TT = window.TT || {};

TT.Game = (function () {
  const board = TT.Board;
  const pieces = TT.Pieces;
  const input = TT.Input;

  const START_GARBAGE_ROWS = 5; // random pre-filled rows at the bottom on a fresh game
  const LOCK_DELAY_MS = 500; // grace period once grounded before a piece locks
  const MAX_LOCK_RESETS = 12; // caps how long a piece can be "wiggled" to avoid locking forever
  const DAS_MS = 170; // delay before a held move starts auto-repeating
  const ARR_MS = 50; // time between auto-repeated moves while held
  const SOFT_DROP_INTERVAL_MS = 35; // effective drop speed while holding down
  const BASE_DROP_INTERVAL_MS = 800; // level 1 gravity speed
  const MIN_DROP_INTERVAL_MS = 90; // fastest gravity ever gets
  const LINES_PER_LEVEL = 10;

  let canvas;
  let state = 'ready'; // ready | playing | gameover
  let bag = [];
  let nextQueue = [];
  let current = null; // { type, rotation, row, col }
  let dropTimer = 0;
  let lockTimer = 0;
  let lockResets = 0;
  let grounded = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  let startTime = 0;
  let elapsed = 0;
  let lastFrameTime = 0;
  let moveHoldDir = 0;
  let moveRepeatTimer = 0;
  let clearFlashRows = []; // rows to briefly flash before removal (visual only)
  let clearFlashTimer = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    board.init();
    TT.Render.init(canvas);

    refillQueueIfNeeded();
    TT.UI.updateNext(nextQueue[0]);

    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }

  function refillQueueIfNeeded() {
    while (nextQueue.length < 3) {
      if (bag.length === 0) bag = pieces.createBag();
      nextQueue.push(bag.shift());
    }
  }

  function spawnPiece() {
    refillQueueIfNeeded();
    const type = nextQueue.shift();
    refillQueueIfNeeded();
    TT.UI.updateNext(nextQueue[0]);

    const startCol = Math.floor(board.COLS / 2) - 2;
    const spawn = { type, rotation: 0, row: -2, col: startCol };

    if (!board.isValidPosition(pieces.cellsFor(type, 0), spawn.row, spawn.col)) {
      current = spawn;
      gameOver();
      return;
    }

    current = spawn;
    grounded = false;
    lockTimer = 0;
    lockResets = 0;
  }

  function isGrounded(piece) {
    const cells = pieces.cellsFor(piece.type, piece.rotation);
    return !board.isValidPosition(cells, piece.row + 1, piece.col);
  }

  function tryMove(dCol) {
    if (!current) return false;
    const cells = pieces.cellsFor(current.type, current.rotation);
    const newCol = current.col + dCol;
    if (!board.isValidPosition(cells, current.row, newCol)) return false;
    current.col = newCol;
    onSuccessfulAction();
    return true;
  }

  function tryRotate(dir) {
    if (!current) return false;
    const newRotation = current.rotation + dir;
    const cells = pieces.cellsFor(current.type, newRotation);

    // Simple wall-kick attempts: straight rotation first, then nudge
    // left/right/up by a cell or two to fit rotations near walls or the
    // floor. Not full SRS, but robust and always grid-exact.
    const kicks = [
      { dr: 0, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
      { dr: 0, dc: -2 }, { dr: 0, dc: 2 }, { dr: -1, dc: 0 },
    ];

    for (const k of kicks) {
      const row = current.row + k.dr;
      const col = current.col + k.dc;
      if (board.isValidPosition(cells, row, col)) {
        current.rotation = newRotation;
        current.row = row;
        current.col = col;
        onSuccessfulAction();
        return true;
      }
    }
    return false;
  }

  // A successful move/rotate while grounded gives the classic "wiggle
  // room" lock-delay reset, capped so a piece can't be stalled forever.
  function onSuccessfulAction() {
    if (grounded && lockResets < MAX_LOCK_RESETS) {
      lockTimer = 0;
      lockResets++;
    }
  }

  function softDropStep() {
    if (!current) return;
    const cells = pieces.cellsFor(current.type, current.rotation);
    if (board.isValidPosition(cells, current.row + 1, current.col)) {
      current.row++;
      score += 1;
    }
  }

  function hardDrop() {
    if (!current) return;
    const cells = pieces.cellsFor(current.type, current.rotation);
    let dropped = 0;
    while (board.isValidPosition(cells, current.row + 1, current.col)) {
      current.row++;
      dropped++;
    }
    score += dropped * 2;
    lockPiece();
  }

  function lockPiece() {
    const cells = pieces.cellsFor(current.type, current.rotation);
    const color = pieces.colorFor(current.type);
    board.lockCells(cells, current.row, current.col, color);

    const cleared = board.clearFullRows();
    if (cleared > 0) {
      applyScoreForClear(cleared);
      lines += cleared;
      const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
      if (newLevel !== level) {
        level = newLevel;
        TT.UI.showMilestone(`Level ${level}!`);
      }
      TT.Render.flashClear();
    }

    current = null;
    spawnPiece();
  }

  function applyScoreForClear(cleared) {
    const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
    score += (table[cleared] || 0) * level;
  }

  function currentDropInterval() {
    const interval = BASE_DROP_INTERVAL_MS - (level - 1) * 60;
    return Math.max(MIN_DROP_INTERVAL_MS, interval);
  }

  function handleInput(delta) {
    if (!current) return;

    const left = input.isDown('ArrowLeft');
    const right = input.isDown('ArrowRight');
    const dir = left && !right ? -1 : right && !left ? 1 : 0;

    if (dir !== 0) {
      if (dir !== moveHoldDir) {
        tryMove(dir);
        moveHoldDir = dir;
        moveRepeatTimer = DAS_MS;
      } else {
        moveRepeatTimer -= delta;
        if (moveRepeatTimer <= 0) {
          tryMove(dir);
          moveRepeatTimer = ARR_MS;
        }
      }
    } else {
      moveHoldDir = 0;
    }

    if (input.consumePressed('ArrowUp')) tryRotate(1);
    if (input.consumePressed('KeyZ')) tryRotate(-1);
    if (input.consumePressed('Space')) hardDrop();
  }

  function updateGravity(delta) {
    if (!current) return;

    grounded = isGrounded(current);

    if (grounded) {
      lockTimer += delta;
      if (lockTimer >= LOCK_DELAY_MS) {
        lockPiece();
      }
      return;
    }

    const interval = input.isDown('ArrowDown') ? SOFT_DROP_INTERVAL_MS : currentDropInterval();
    dropTimer += delta;
    while (dropTimer >= interval && current && !grounded) {
      dropTimer -= interval;
      current.row++;
      if (input.isDown('ArrowDown')) score += 1;
      grounded = isGrounded(current);
    }
  }

  function gameOver() {
    state = 'gameover';
    TT.UI.showGameOver(score, lines, level);
  }

  function reset() {
    board.init();
    board.fillRandomStart(START_GARBAGE_ROWS);

    bag = [];
    nextQueue = [];
    current = null;
    dropTimer = 0;
    lockTimer = 0;
    lockResets = 0;
    grounded = false;
    score = 0;
    lines = 0;
    level = 1;

    spawnPiece();
  }

  function startGame() {
    reset();
    state = 'playing';
    startTime = performance.now();
    TT.UI.hideOverlays();
  }

  function loop(now) {
    const delta = lastFrameTime ? Math.min(40, now - lastFrameTime) : 16.67;
    lastFrameTime = now;

    if (state === 'playing') {
      handleInput(delta);
      updateGravity(delta);

      elapsed = now - startTime;
      TT.UI.updateStats(elapsed, score, lines, level);
    }

    TT.Render.frame({
      current,
      state,
    });
    requestAnimationFrame(loop);
  }

  return {
    init,
    startGame,
    get state() { return state; },
  };
})();
