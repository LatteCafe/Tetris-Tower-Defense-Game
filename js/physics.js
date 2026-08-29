// physics.js — Matter.js engine setup, the build platform, and wind forces.
window.TT = window.TT || {};

TT.Physics = (function () {
  const { Engine, World, Bodies, Body, Composite } = Matter;

  let engine, world;
  let platformY, platformLeft, platformRight, platformWidth;
  let deathY;
  let wind = 0;

  function init(canvasWidth, canvasHeight) {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1;

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

  function applyWind() {
    if (Math.abs(wind) < 0.0001) return;
    Composite.allBodies(world).forEach((b) => {
      if (!b.isStatic) {
        Body.applyForce(b, b.position, { x: wind * b.mass * 0.0011, y: 0 });
      }
    });
  }

  function setWind(w) { wind = w; }
  function getWind() { return wind; }

  function update(delta) {
    applyWind();
    Engine.update(engine, delta);
  }

  return {
    init,
    update,
    setWind,
    getWind,
    get engine() { return engine; },
    get world() { return world; },
    get platformY() { return platformY; },
    get platformLeft() { return platformLeft; },
    get platformRight() { return platformRight; },
    get platformWidth() { return platformWidth; },
    get deathY() { return deathY; },
  };
})();
