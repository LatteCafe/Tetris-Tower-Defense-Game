// pieces.js — standard tetromino shapes, one explicit cell layout per
// rotation state. No physics, no floating point — every shape is just a
// fixed list of {row, col} offsets within a small local grid, so
// collision and alignment are exact by construction.
window.TT = window.TT || {};

TT.Pieces = (function () {
  // Each entry is 4 rotation states (0, 90, 180, 270). Offsets are
  // {row, col} within the piece's own local bounding box.
  const SHAPES = {
    I: {
      color: '#4ecdc4',
      states: [
        [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }],
        [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 3, c: 2 }],
        [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }, { r: 2, c: 3 }],
        [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }],
      ],
    },
    O: {
      color: '#ffd166',
      states: [
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
      ],
    },
    T: {
      color: '#c77dff',
      states: [
        [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
        [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
        [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
        [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
      ],
    },
    S: {
      color: '#06d6a0',
      states: [
        [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }],
        [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
        [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
        [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
      ],
    },
    Z: {
      color: '#ef476f',
      states: [
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
        [{ r: 0, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }],
        [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
        [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 0 }],
      ],
    },
    J: {
      color: '#4d96ff',
      states: [
        [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
        [{ r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
        [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }],
        [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 0 }, { r: 2, c: 1 }],
      ],
    },
    L: {
      color: '#ff9f5a',
      states: [
        [{ r: 0, c: 2 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }],
        [{ r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
        [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 0 }],
        [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 2, c: 1 }],
      ],
    },
  };

  const TYPES = Object.keys(SHAPES);

  function randomType() {
    return TYPES[Math.floor(Math.random() * TYPES.length)];
  }

  // Simple bag randomizer (each of the 7 pieces once before repeating) —
  // feels much less random-unfair than pure independent randomType() and
  // is the modern standard.
  function createBag() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function cellsFor(type, rotation) {
    return SHAPES[type].states[((rotation % 4) + 4) % 4];
  }

  function colorFor(type) {
    return SHAPES[type].color;
  }

  return { SHAPES, TYPES, randomType, createBag, cellsFor, colorFor };
})();
