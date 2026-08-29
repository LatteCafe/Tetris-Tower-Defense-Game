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

  const MAX_LINEAR_SPEED = 14; // safety clamp: nothing should ever move faster than this
  const MAX_ANGULAR_SPEED = 0.3; // safety clamp for spin

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
  let ghostOffsetY = 0;

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

    // Spawn point rises with the tower so a tall stack never causes a new
    // piece to spawn already overlapping it (which the physics solver
    // would otherwise resolve with a violent shove).
    const towerTop = computeTowerTop();
    const spawnY = Math.min(50, towerTop - 140);
    const spawnX = canvas.width / 2 - blocks.SIZE;

    activePiece = blocks.createPiece(type, spawnX, spawnY);
    Composite.add(physics.world, activePiece);

    TT.UI.updateNext(nextType);
  }

  // --- Overlap-safe movement & rotation -------------------------------
  // All pieces stay axis-aligned (rotation is always a multiple of 90°),
  // so a simple AABB overlap test on each part is exact, not approximate.
  // Moves/rotates that would overlap another body are rejected outright —
  // this is what actually stops the "launch" bug, since the physics
  // solver only ever violently ejects bodies to resolve overlaps *we*
  // created; if we never create one, there's nothing to resolve.

  function aabbOverlap(a, b, eps) {
    return (
      a.min.x < b.max.x - eps &&
      a.max.x > b.min.x + eps &&
      a.min.y < b.max.y - eps &&
      a.max.y > b.min.y + eps
    );
  }

  function wouldOverlap(piece) {
    const obstacles = Composite.allBodies(physics.world).filter((b) => b !== piece);
    const parts = piece.parts.length > 1 ? piece.parts.slice(1) : [piece];
    for (const part of parts) {
      for (const ob of obstacles) {
        if (aabbOverlap(part.bounds, ob.bounds, 0.6)) return true;
      }
    }
    return false;
  }

  // Instantly nudges the active piece sideways by half a block width — a
  // single position snap, rejected if it would overlap anything.
  function tryStepMove(dir) {
    if (!activePiece) return;
    Body.translate(activePiece, { x: dir * halfStep, y: 0 });
    if (wouldOverlap(activePiece)) {
      Body.translate(activePiece, { x: -dir * halfStep, y: 0 });
    } else {
      Body.setVelocity(activePiece, { x: 0, y: activePiece.velocity.y });
    }
  }

  function tryRotate(dir) {
    if (!activePiece) return;
    const delta = dir * (Math.PI / 2);
    Body.rotate(activePiece, delta);
    if (wouldOverlap(activePiece)) {
      Body.rotate(activePiece, -delta);
    } else {
      Body.setAngularVelocity(activePiece, 0);
    }
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
        tryStepMove(dir);
        moveHoldDir = dir;
        moveRepeatTimer = MOVE_REPEAT_DELAY_MS;
      } else {
        moveRepeatTimer -= delta;
        if (moveRepeatTimer <= 0) {
          tryStepMove(dir);
          moveRepeatTimer = MOVE_REPEAT_RATE_MS;
        }
      }
    } else {
      moveHoldDir = 0;
    }

    // Discrete 90-degree rotation, one snap per key press.
    if (input.consumePressed('ArrowUp')) tryRotate(1);
    if (input.consumePressed('KeyZ')) tryRotate(-1);

    // Soft drop only while still airborne — forcing extra fall speed once
    // the piece has already touched the stack is exactly the kind of
    // "fight the solver every frame" pattern that causes launches.
    if (input.isDown('ArrowDown') && !activePiece.ttLanded) {
      Body.setVelocity(activePiece, {
        x: activePiece.velocity.x,
        y: Math.max(activePiece.velocity.y, 8),
      });
    }
  }

  // Safety net: even with overlap-checked input, a stack of many bodies
  // settling at once could in principle produce a brief solver spike.
  // Clamping every body's speed each tick makes that visually a non-event
  // instead of a launch.
  function clampVelocities() {
    Composite.allBodies(physics.world).forEach((b) => {
      if (b.isStatic) return;
      const speed = Vector.magnitude(b.velocity);
      if (speed > MAX_LINEAR_SPEED) {
        const scale = MAX_LINEAR_SPEED / speed;
        Body.setVelocity(b, { x: b.velocity.x * scale, y: b.velocity.y * scale });
      }
      if (Math.abs(b.angularVelocity) > MAX_ANGULAR_SPEED) {
        Body.setAngularVelocity(b, Math.sign(b.angularVelocity) * MAX_ANGULAR_SPEED);
      }
    });
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
    // reads as solidly placed rather than softly settling forever, and
    // now that it's no longer under player control, let it sleep once
    // still (this is what keeps the settled stack from drifting).
    Body.setVelocity(activePiece, { x: 0, y: 0 });
    Body.setAngularVelocity(activePiece, 0);
    activePiece.isSleepingAllowed = true;

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

  // --- Landing indicator ------------------------------------------------
  // For each cell (part) of the active piece, find the nearest obstruction
  // directly below it (another body or the platform) using their axis-
  // aligned bounds — exact, since every piece stays grid-aligned. The
  // smallest clearance across all cells is how far the piece can still
  // fall before it touches down.
  function computeGhostOffset() {
    if (!activePiece) return 0;
    const obstacles = Composite.allBodies(physics.world).filter((b) => b !== activePiece);
    const parts = activePiece.parts.length > 1 ? activePiece.parts.slice(1) : [activePiece];

    let minDrop = physics.deathY;
    parts.forEach((part) => {
      const pMinX = part.bounds.min.x;
      const pMaxX = part.bounds.max.x;
      const pBottom = part.bounds.max.y;
      let floorY = physics.deathY;

      obstacles.forEach((ob) => {
        const overlapsX = ob.bounds.max.x > pMinX + 1 && ob.bounds.min.x < pMaxX - 1;
        if (!overlapsX) return;
        if (ob.bounds.min.y >= pBottom - 0.5 && ob.bounds.min.y < floorY) {
          floorY = ob.bounds.min.y;
        }
      });

      const drop = floorY - pBottom;
      if (drop < minDrop) minDrop = drop;
    });

    return Math.max(0, minDrop);
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
      clampVelocities();
      checkLock(delta);
      cleanupFallenBlocks();
      ghostOffsetY = computeGhostOffset();

      elapsed = now - startTime;
      const top = computeTowerTop();
      const heightPx = Math.max(0, physics.platformY - top);
      maxHeightReached = Math.max(maxHeightReached, heightPx);
      const heightM = heightPx / pxPerMeter;
      const goalM = goalHeightPx / pxPerMeter;
      TT.UI.updateStats(elapsed, heightM, goalM, piecesPlaced);

      checkMilestone(delta);
    }

    TT.Render.frame(physics, canvas, {
      goalY,
      state,
      ghost: activePiece ? { piece: activePiece, offsetY: ghostOffsetY } : null,
    });
    requestAnimationFrame(loop);
  }

  return {
    init,
    startGame,
    get state() { return state; },
  };
})();
