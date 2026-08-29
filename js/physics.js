// physics.js — Matter.js engine setup and the build platform.
window.TT = window.TT || {};

TT.Physics = (function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;

  // Tuned so a piece takes ~3.5-4s to fall the full height of the play
  // field — enough time to actually steer and rotate it before it lands.
  const GRAVITY_Y = 0.22;

  let engine, world;
  let platformY, platformLeft, platformRight, platformWidth;
  let deathY;

  function init(canvasWidth, canvasHeight) {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = GRAVITY_Y;

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
      { isStatic: true, friction: 1, label: 'platform' }
    );
    World.add(world, platform);
  }

  function update(delta) {
    Engine.update(engine, delta);
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
