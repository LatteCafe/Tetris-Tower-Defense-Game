// blocks.js — tetromino shapes and physics-body creation.
window.TT = window.TT || {};

TT.Blocks = (function () {
  const { Bodies, Body } = Matter;
  const SIZE = 34;

  // Standard tetromino cell layouts, gem-toned palette.
  const SHAPES = {
    I: { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#4ecdc4' },
    O: { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffd166' },
    T: { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: '#c77dff' },
    S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#06d6a0' },
    Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ef476f' },
    J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#4d96ff' },
    L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#ff9f5a' },
  };

  const TYPES = Object.keys(SHAPES);

  function randomType() {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
  }

  // Builds one tetromino as a single Matter.js compound body (four fused
  // rectangles), so it falls, rotates and collides as one rigid piece.
  // Rectangles tile flush (no gap) to avoid seam-related collision glitches;
  // the grid look comes from stroke lines drawn in render.js instead.
  function createPiece(type, spawnX, spawnY) {
    const shape = SHAPES[type];

    const parts = shape.cells.map(([cx, cy]) =>
      Bodies.rectangle(
        spawnX + cx * SIZE,
        spawnY + cy * SIZE,
        SIZE,
        SIZE,
        {
          friction: 0.95,
          frictionStatic: 6,
          restitution: 0,
        }
      )
    );

    const body = Body.create({
      parts,
      friction: 0.95,
      frictionStatic: 6,
      restitution: 0,
      density: 0.02, // noticeably heavier — resists being knocked around
      // Sleeping is disabled while a piece is falling/under player control —
      // with slow gravity, Matter's motion-bias sleep detector can treat a
      // still-falling piece as "at rest" and freeze it mid-air. Locked
      // pieces re-enable sleep in lockPiece() so the settled stack still
      // goes fully still.
      isSleepingAllowed: false,
      label: 'piece-' + type,
    });

    body.ttColor = shape.color;
    body.ttType = type;
    body.ttLanded = false;
    body.ttSettleTimer = 0;

    // Capture the naturally-computed inertia before freezing it below —
    // this is restored once the piece locks, so the settled stack can
    // still be physically knocked over/toppled later.
    body.ttOriginalInertia = body.inertia;

    // While a piece is falling and under player control, it should only
    // ever rotate in the exact 90° snaps triggered by the rotate key —
    // never from physics (a glancing contact imparting torque, tipping
    // as it lands off-center, etc.). Infinite inertia makes the body
    // immune to angular impulses entirely while still responding normally
    // to linear ones, so it can be pushed/land/collide but never spin on
    // its own. Manual rotation (Body.rotate) is kinematic and unaffected
    // by this. Restored to normal in lockPiece().
    Body.setInertia(body, Infinity);

    return body;
  }

  return { SIZE, SHAPES, TYPES, randomType, createPiece };
})();
