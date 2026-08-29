// game.js — the main game state machine and update loop.
window.TT = window.TT || {};

TT.Game = (function () {
  const { Body, Composite, Events, Vector } = Matter;
  const blocks = TT.Blocks;
  const input = TT.Input;

  const METERS_PER_BLOCK = 1; // 1 block = 1 metre, for the on-screen height readout
  const GOAL_HEIGHT_M = 18; // first milestone height, in metres
  const GOAL_STEP_M = 8; // once reached, the next goal is this much higher — endless climb
  const MILESTONE_HOLD_MS = 2200; // must stand above the goal this long to bank it
  const LOCK_DELAY_MS = 350; // settle time before a piece is considered placed

  const MOVE_REPEAT_DELAY_MS = 220; // hold time before auto-repeat kicks in
  const MOVE_REPEAT_RATE_MS = 90; // time between repeated steps while held

  let canvas, physics;
  let state = 'ready'; // ready | playing
  let activePiece = null;
  let nextType = null;
  let piecesPlaced = 0;
  let startTime = 0;
  let elapsed = 0;
  let goalY = 0;
  let goalHeightPx = 0;
  let pxPerMeter = 0;
  let halfStep = 0;
  let maxHeightReached = 0;
  let stableTimer = 0;
  let lastFrameTime = 0;

  let moveHoldDir = 0;
  let moveRepeatTimer = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      goalY = physics.platformY - goalHeightPx;
    });

    TT.Physics.init(canvas.width, canvas.height);
    physics = TT.Physics;
    TT.Render.init(canvas);

    pxPerMeter = blocks.SIZE / METERS_PER_BLOCK;
    halfStep = blocks.SIZE / 2;
    goalHeightPx = GOAL_HEIGHT_M * pxPerMeter;
    goalY = physics.platformY - goalHeightPx;

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

  // Instantly nudges the active piece sideways by half a block width — a
  // single position snap rather than a continuous velocity, so it doesn't
  // fight the physics solver when pressed up against another piece.
  function stepMove(dir) {
    if (!activePiece) return;
    Body.translate(activePiece, { x: dir * halfStep, y: 0 });
    Body.setVelocity(activePiece, { x: 0, y: activePiece.velocity.y });
  }

  function handleInput(delta) {
    if (!activePiece) return;

    // Grid-snap horizontal movement, half a block per step, with a short
    // hold-to-repeat (classic DAS-style feel) rather than free sliding.
    const left = input.isDown('ArrowLeft');
    const right = input.isDown('ArrowRight');
    const dir = left && !right ? -1 : right && !left ? 1 : 0;

    if (dir !== 0) {
      if (dir !== moveHoldDir) {
        stepMove(dir);
        moveHoldDir = dir;
        moveRepeatTimer = MOVE_REPEAT_DELAY_MS;
      } else {
        moveRepeatTimer -= delta;
        if (moveRepeatTimer <= 0) {
          stepMove(dir);
          moveRepeatTimer = MOVE_REPEAT_RATE_MS;
        }
      }
    } else {
      moveHoldDir = 0;
    }

    // Discrete 90-degree rotation, one snap per key press.
    if (input.consumePressed('ArrowUp')) {
      Body.rotate(activePiece, Math.PI / 2);
      Body.setAngularVelocity(activePiece, 0);
    }
    if (input.consumePressed('KeyZ')) {
      Body.rotate(activePiece, -Math.PI / 2);
      Body.setAngularVelocity(activePiece, 0);
    }

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
    // "Plant" the piece firmly — kill any residual micro-velocity so it
    // reads as solidly placed rather than softly settling forever.
    Body.setVelocity(activePiece, { x: 0, y: 0 });
    Body.setAngularVelocity(activePiece, 0);

    activePiece = null;
    piecesPlaced++;
    spawnPiece();
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

  // Endless mode: a piece that falls off the platform is simply removed —
  // it never ends the game. If it was the piece under player control, the
  // next one spawns immediately.
  function cleanupFallenBlocks() {
    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    bodies.forEach((b) => {
      if (b.position.y > physics.deathY) {
        const wasActive = b === activePiece;
        Composite.remove(physics.world, b);
        if (wasActive) {
          activePiece = null;
          spawnPiece();
        }
      }
    });
  }

  // Reaching the current goal line banks a milestone and raises the bar —
  // this never stops play, it just keeps the climb going indefinitely.
  function checkMilestone(delta) {
    const top = computeTowerTop();
    const height = physics.platformY - top;
    if (height >= goalHeightPx) {
      stableTimer += delta;
      if (stableTimer > MILESTONE_HOLD_MS) {
        const reachedM = Math.round(goalHeightPx / pxPerMeter);
        TT.UI.showMilestone(`${reachedM}m reached!`);
        goalHeightPx += GOAL_STEP_M * pxPerMeter;
        goalY = physics.platformY - goalHeightPx;
        stableTimer = 0;
      }
    } else {
      stableTimer = 0;
    }
  }

  function reset() {
    const bodies = Composite.allBodies(physics.world).filter((b) => b.label !== 'platform');
    Composite.remove(physics.world, bodies);

    activePiece = null;
    piecesPlaced = 0;
    maxHeightReached = 0;
    stableTimer = 0;
    goalHeightPx = GOAL_HEIGHT_M * pxPerMeter;
    goalY = physics.platformY - goalHeightPx;

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
      handleInput(delta);
      physics.update(delta);
      checkLock(delta);
      cleanupFallenBlocks();

      elapsed = now - startTime;
      const top = computeTowerTop();
      const heightPx = Math.max(0, physics.platformY - top);
      maxHeightReached = Math.max(maxHeightReached, heightPx);
      const heightM = heightPx / pxPerMeter;
      const goalM = goalHeightPx / pxPerMeter;
      TT.UI.updateStats(elapsed, heightM, goalM, piecesPlaced);

      checkMilestone(delta);
    }

    TT.Render.frame(physics, canvas, { goalY, state });
    requestAnimationFrame(loop);
  }

  return {
    init,
    startGame,
    get state() { return state; },
  };
})();
