// physics.js — Matter.js engine setup and the build platform.
window.TT = window.TT || {};

TT.Physics = (function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;

  // Tuned so a piece takes ~10s to fall the full height of the play field —
  // slow enough to line up a placement carefully.
  const GRAVITY_Y = 0.055;

  let engine, world;
  let platformY, platformLeft, platformRight, platformWidth;
  let deathY;

  function init(canvasWidth, canvasHeight) {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = GRAVITY_Y;

    // More solver iterations = far less sliding/jitter once pieces are
    // stacked and touching each other.
    engine.positionIterations = 12;
    engine.velocityIterations = 10;

    // Let settled pieces fall fully asleep instead of endlessly
    // micro-vibrating — this is what makes the stack feel "planted".
    engine.enableSleeping = true;

    platformY = canvasHeight - 96;
    platformWidth = Math.min(240, canvasWidth * 0.32);
    platformLeft = canvasWidth / 2 - platformWidth / 2;
    platformRight = canvasWidth / 2 + platformWidth / 2;
    deathY = canvasHeight + 60;

    const platform = Bodies.rectangle(
      canvasWidth / 2,
      platformY + 45,
      platformWidth,
      90,
      {
        isStatic: true,
        friction: 1,
        frictionStatic: 6,
        label: 'platform',
      }
    );
    World.add(world, platform);
  }

  function update(delta) {
    // Sub-step the simulation instead of one big Engine.update call. A
    // fast-moving piece (soft drop, or a quick sideways step right next
    // to a tall column) can otherwise travel far enough in a single step
    // to tunnel partway through a neighbor before collision detection
    // catches it — this is what causes visible clipping. Smaller steps
    // keep each frame's displacement small relative to a block's size.
    const MAX_SUBSTEP_MS = 8;
    const MAX_SUBSTEPS = 8;
    let remaining = delta;
    let steps = 0;
    while (remaining > 0.01 && steps < MAX_SUBSTEPS) {
      const step = Math.min(MAX_SUBSTEP_MS, remaining);
      Engine.update(engine, step);
      remaining -= step;
      steps++;
    }
  }

  return {
    init,
    update,
    get engine() { return engine; },
    get world() { return world; },
    get platformY() { return platformY; },
    get platformLeft() { return platformLeft; },
    get platformRight() { return platformRight; },
    get platformWidth() { return platformWidth; },
    get deathY() { return deathY; },
  };
})();
