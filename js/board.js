// board.js — the playfield grid and all collision/line-clear logic.
// Everything here is exact integer grid math, no floating point.
window.TT = window.TT || {};

TT.Board = (function () {
  const COLS = 10;
  const ROWS = 20;

  let grid; // grid[row][col] = color string | null

  function init() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // Fills a random, guaranteed-clearable starting stack at the bottom —
  // each of the bottom N rows gets mostly-filled with at least one gap,
  // so every row is still clearable and nothing starts pre-solved.
  function fillRandomStart(rowCount) {
    for (let r = ROWS - rowCount; r < ROWS; r++) {
      const gapCol = Math.floor(Math.random() * COLS);
      for (let c = 0; c < COLS; c++) {
        if (c === gapCol) continue;
        if (Math.random() < 0.78) {
          grid[r][c] = randomStartColor();
        }
      }
    }
  }

  function randomStartColor() {
    const colors = TT.Pieces.TYPES.map((t) => TT.Pieces.colorFor(t));
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function isInsideCols(c) {
    return c >= 0 && c < COLS;
  }

  // A piece position is valid if every cell is within the columns, not
  // below the floor, and (for cells already on the visible grid) not
  // overlapping something already locked. Cells above row 0 are allowed
  // (that's how pieces spawn partially off the top).
  function isValidPosition(cells, row, col) {
    for (const cell of cells) {
      const r = row + cell.r;
      const c = col + cell.c;
      if (!isInsideCols(c)) return false;
      if (r >= ROWS) return false;
      if (r >= 0 && grid[r][c]) return false;
    }
    return true;
  }

  function lockCells(cells, row, col, color) {
    for (const cell of cells) {
      const r = row + cell.r;
      const c = col + cell.c;
      if (r >= 0 && r < ROWS) grid[r][c] = color;
    }
  }

  // Returns the number of rows cleared, and performs the clear (shifting
  // everything above each cleared row down by one, adding a fresh empty
  // row at the top for each one removed).
  function clearFullRows() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((cell) => cell !== null)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // re-check this same index, now occupied by the row above
      }
    }
    return cleared;
  }

  // Highest occupied row across the whole board (for camera / game-over
  // checks). Returns ROWS if the board is empty.
  function highestOccupiedRow() {
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].some((cell) => cell !== null)) return r;
    }
    return ROWS;
  }

  function cellAt(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return grid[r][c];
  }

  return {
    COLS,
    ROWS,
    init,
    fillRandomStart,
    isValidPosition,
    lockCells,
    clearFullRows,
    highestOccupiedRow,
    cellAt,
  };
})();
