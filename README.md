# Tetris Clone

A classic, grid-based Tetris — no physics engine, no floating point
positions. Every piece lives on an exact integer grid, so collision,
rotation, and stacking are always precise: no drift, no clipping, no
misalignment.

## Gameplay

- Standard 10×20 board, 7 tetromino types dealt via a "7-bag" randomizer
  (each piece appears exactly once before the bag reshuffles, so you never
  get long unlucky droughts of one shape).
- The game starts with a random pile already filling the bottom 5 rows —
  it's not a clean slate. Every generated row always has at least one gap,
  so nothing starts unclearable.
- Clear full rows to score. Speed increases every level (every 10 lines).
- Game overs when a new piece can't spawn because the stack has reached
  the top.

## Controls

| Key | Action |
| --- | --- |
| `←` / `→` | Move left / right (hold to auto-repeat) |
| `↑` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
| `↓` | Soft drop |
| `Space` | Hard drop |

## Project structure

```
tricky-towers/
├── index.html          # Entry point, canvas + HUD markup
├── css/
│   └── style.css        # Visual theme
├── js/
│   ├── pieces.js         # Tetromino shapes, all 4 rotation states each, 7-bag
│   ├── board.js           # Grid state, collision checks, line clearing
│   ├── input.js            # Keyboard state tracking
│   ├── render.js            # Canvas rendering (board, pieces, ghost piece)
│   ├── ui.js                 # DOM overlay / HUD wiring
│   └── main.js                 # Bootstraps everything on load
├── package.json
└── README.md
```

## Running it

No build step, no dependencies — plain HTML/CSS/JS.

```bash
npx serve .
# or just open index.html directly in a modern browser
```

## Tech notes

- Rotation states are explicit hand-authored tables (not computed via
  matrix rotation), so every shape's 4 orientations are exactly what a
  standard Tetris implementation would produce — no ambiguity, no
  approximation.
- Rotation uses a small set of wall-kick offsets (try the straight
  rotation first, then nudge left/right/up by a cell or two) rather than
  the full SRS kick tables — simpler, and robust enough that a rotation
  near a wall or the floor almost always finds a valid spot.
- Locking uses a standard "lock delay": once a piece can't move down
  further, it has a short grace period (capped number of resets) before
  it actually locks, so sliding a piece under an overhang at the last
  moment still works.
- Because it's a plain grid, there's no camera, no sleep/wake physics
  tuning, no velocity clamping, and no tunneling — the entire class of
  bugs that comes from simulating real physics for something that's
  fundamentally discrete just doesn't apply here.

## Ideas for extending it

- Hold piece (swap the current piece out for later).
- T-spin detection and bonus scoring.
- Ghost piece color options / toggle.
- Local high-score leaderboard via `localStorage`.
- Marathon vs. Sprint (40 lines) vs. Ultra (2-minute score attack) modes.
