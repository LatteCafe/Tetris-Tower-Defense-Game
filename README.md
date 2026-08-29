# Tricky Towers Clone

A browser-based, physics-driven tower-stacking game inspired by *Tricky Towers*.
Unlike classic Tetris, blocks are **not grid-locked** — every piece is a real
rigid body simulated with [Matter.js](https://brm.io/matter-js/), so towers
wobble, lean, and can genuinely topple if you stack carelessly.

![gameplay preview](assets/preview-placeholder.txt)

## Gameplay

- Random tetromino-shaped pieces (I, O, T, S, Z, J, L) spawn one at a time and
  fall under gravity (tuned to a slow ~10s drop so there's real time to line
  up a placement).
- Move the **active** piece left/right in half-block grid-snap steps (hold
  to auto-repeat) and rotate it a full 90° per key press.
- Pieces have real weight and high friction — once placed, they plant
  firmly and don't slide around.
- Height is shown in metres, where one block = one metre.
- This is **endless**: a piece that falls off the platform is just removed
  and play continues — there's no game-over screen. Reaching a height
  milestone pops a quick banner and raises the bar further, so the climb
  never really ends.
- A landing indicator shows exactly where the active piece will come to
  rest if you stop moving it — a ghost outline plus a wider glowing zone
  under the footprint.

## Controls

| Key | Action |
| --- | --- |
| `←` / `→` | Move the active piece half a block left / right (hold to repeat) |
| `↑` | Rotate 90° clockwise |
| `Z` | Rotate 90° counter-clockwise |
| `↓` | Soft drop (fall faster) |

## Project structure

```
tricky-towers/
├── index.html          # Entry point, canvas + HUD markup
├── css/
│   └── style.css        # Visual design (storm-sky theme)
├── js/
│   ├── physics.js       # Matter.js engine setup, platform, wind forces
│   ├── blocks.js        # Tetromino definitions + compound-body spawning
│   ├── input.js          # Keyboard state tracking
│   ├── render.js         # Canvas rendering (sky, platform, pieces, HUD fx)
│   ├── ui.js              # DOM overlay / HUD wiring
│   └── main.js            # Bootstraps everything on load
├── assets/
├── package.json
└── README.md
```

## Running it

No build step needed — it's plain HTML/CSS/JS plus the Matter.js CDN build.

```bash
npx serve .
# or just open index.html directly in a modern browser
```

## Tech notes

- Physics: [Matter.js](https://brm.io/matter-js/) (loaded from CDN in `index.html`).
- Pieces are Matter.js **compound bodies** — four rectangles fused into one
  rigid body per tetromino, so they rotate and collide as a single unit.
- Rendering is a hand-rolled `<canvas>` renderer (not `Matter.Render`) so the
  art style (gem-toned blocks, stone pedestal, storm sky) is fully custom.
- Gravity is tuned to `0.055` (Matter.js units) — roughly a 10-second fall
  across the full play field height.
- Horizontal movement is position-snapped (`Body.translate`) rather than
  velocity-driven, which avoids the classic Matter.js "compound bodies
  fight the solver" jitter when a piece is pressed against a neighbor.
- Moves and 90° rotations are rejected outright if they'd create an
  overlap (an AABB check against every other body, exact here since all
  pieces stay axis-aligned) — this is what actually stops pieces from
  launching each other, since the physics solver only violently resolves
  overlaps that already exist.
- Pieces disable sleeping while falling/under player control — with slow
  gravity, Matter's motion-bias sleep detector can otherwise mistake a
  still-falling piece for "at rest" and freeze it mid-air. Sleep is
  re-enabled the moment a piece locks, which is what keeps the settled
  stack fully still (planted) instead of drifting.
- The spawn point rises to stay clear of the tower's current height, so a
  tall stack never causes a new piece to spawn already overlapping it.
- A velocity clamp runs every tick as a safety net against any residual
  solver spike, independent of the above.
- The landing indicator projects each cell of the active piece straight
  down against the nearest surface below it (again using axis-aligned
  bounds, exact for this game) to find where it will land.

## Ideas for extending it

- Add spell cards from the original game (haste, slow, boost blocks up).
- Bring back optional wind gusts as a difficulty toggle.
- Multiplayer via WebSockets, racing for height.
- Local high-score leaderboard via `localStorage`.
