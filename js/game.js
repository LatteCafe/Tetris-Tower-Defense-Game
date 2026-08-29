// game.js — the main game state machine and update loop.
window.TT = window.TT || {};

TT.Game = (function () {
  const { Body, Composite, Events, Vector } = Matter;
  const blocks = TT.Blocks;
  const input = TT.Input;

  const GOAL_HEIGHT = 620; // px above the platform surface needed to win
  const WIN_HOLD_MS = 2200; // must stay above goal this long, standing, to win
  const LOCK_DELAY_MS = 350; // settle time before a piece is considered placed
  const MOVE_SPEED = 4.6;
  const ROTATE_SPEED = 0.062;

  let canvas, physics;
  let state = 'ready'; // ready | playing | gameover | win
  let activePiece = null;
  let nextType = null;
  let piecesPlaced = 0;
  let startTime = 0;
  let elapsed = 0;
  let windTimer = 0;
  let windTarget = 0;
  let currentWind = 0;
  let goalY = 0;
  let maxHeightReached = 0;
  let stableTimer = 0;
  let lastFrameTime = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      goalY = physics.platformY - GOAL_HEIGHT;
    });

    TT.Physics.init(canvas.width, canvas.height);
    physics = TT.Physics;
    TT.Render.init(canvas);
    goalY = physics.platformY - GOAL_HEIGHT;

    Events.on(physics.engine, 'collisionStart', onCollision);

    nextType = blocks.randomType();
    TT.UI.updateNext(nextType);

    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }

  function onCollision(evt) {
    if (!activePiece) return;
    evt.pairs.forEach((p) => {
      [p.bodyA, p.bodyB].forEach((b) => {
        const parent = b.parent && b.parent !== b ? b.parent : b;
        if (parent === activePiece) activePiece.ttLanded = true;
      });
    });
  }

  function spawnPiece() {
    const type = nextType;
    nextType = blocks.randomType();

    const spawnX = canvas.width / 2 - blocks.SIZE;
    const spawnY = 50;
    activePiece = blocks.createPiece(type, spawnX, spawnY);
    Composite.add(physics.world, activePiece);

    TT.UI.updateNext(nextType);
  }

  function handleInput() {
    if (!activePiece) return;

    let vx = activePiece.velocity.x;
    if (input.isDown('ArrowLeft')) vx = -MOVE_SPEED;
    else if (input.isDown('ArrowRight')) vx = MOVE_SPEED;
    else vx *= 0.9;
    Body.setVelocity(activePiece, { x: vx, y: activePiece.velocity.y });

    let av = activePiece.angularVelocity;
    if (input.isDown('ArrowUp')) av = ROTATE_SPEED;
    else if (input.isDown('KeyZ')) av = -ROTATE_SPEED;
    else av *= 0.85;
    Body.setAngularVelocity(activePiece, av);

    if (input.isDown('ArrowDown')) {
      Body.setVelocity(activePiece, {
        x: activePiece.velocity.x,
        y: Math.max(activePiece.velocity.y, 8),
      });
    }
  }

  function checkLock(delta) {
    if (!activePiece) return;
    const speed = Vector.magnitude(activePiece.velocity);
    const angSpeed = Math.abs(activePiece.angularVelocity);

    if (activePiece.ttLanded && speed < 0.4 && angSpeed < 0.02) {
      activePiece.ttSettleTimer += delta;
      if (activePiece.ttSettleTimer > LOCK_DELAY_MS) lockPiece();
    } else {
      activePiece.ttSettleTimer = 0;
    }
  }

  function lockPiece() {
    activePiece = null;
    piecesPlaced++;
    spawnPiece();
  }

  function updateWind(delta) {
    windTimer -= delta;
    if (windTimer <= 0) {
      const maxGust = 2 + Math.min(piecesPlaced * 0.15, 6);
      windTarget = (Math.random() - 0.5) * 2 * maxGust;
      windTimer = 3000 + Math.random() * 4000;
    }
    currentWind += (windTarget - currentWind) * 0.01;
    physics.setWind(currentWind);
  }

  function computeTowerTop() {
    let minY = physics.platformY;
    Composite.allBodies(physics.world).forEach((b) => {
      if (b.label === 'platform') return;
      b.vertices.forEach((v) => {
        if (v.y < minY) minY = v.y;
      });
    });
    return minY;
  }

  function checkFail() {
    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    for (const b of bodies) {
      if (b.position.y > physics.deathY) return true;
      const offSide = b.position.x < physics.platformLeft - 60 || b.position.x > physics.platformRight + 60;
      if (b.ttLanded && offSide && b.position.y > physics.platformY - 20) return true;
    }
    return false;
  }

  function checkWin(delta) {
    const top = computeTowerTop();
    const height = physics.platformY - top;
    if (height >= GOAL_HEIGHT) {
      stableTimer += delta;
      if (stableTimer > WIN_HOLD_MS) return true;
    } else {
      stableTimer = 0;
    }
    return false;
  }

  function reset() {
    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    Composite.remove(physics.world, bodies);

    activePiece = null;
    piecesPlaced = 0;
    maxHeightReached = 0;
    stableTimer = 0;
    currentWind = 0;
    windTimer = 0;
    physics.setWind(0);

    nextType = blocks.randomType();
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
      handleInput();
      updateWind(delta);
      physics.update(delta);
      checkLock(delta);

      elapsed = now - startTime;
      const top = computeTowerTop();
      const height = Math.max(0, physics.platformY - top);
      maxHeightReached = Math.max(maxHeightReached, height);
      TT.UI.updateStats(elapsed, height, GOAL_HEIGHT, piecesPlaced);

      if (checkFail()) {
        state = 'gameover';
        TT.UI.showGameOver(piecesPlaced, Math.round(maxHeightReached));
      } else if (checkWin(delta)) {
        state = 'win';
        TT.UI.showWin(Math.round(elapsed / 1000), piecesPlaced);
      }
    }

    TT.Render.frame(physics, canvas, { wind: currentWind, goalY, state });
    requestAnimationFrame(loop);
  }

  return {
    init,
    startGame,
    get state() { return state; },
  };
})();
