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
- Pieces sleep (`engine.enableSleeping`) once fully settled, and are
  explicitly zeroed out on lock, so the stack stays visually still instead
  of endlessly micro-vibrating.

## Ideas for extending it

- Add spell cards from the original game (haste, slow, boost blocks up).
- Bring back optional wind gusts as a difficulty toggle.
- Multiplayer via WebSockets, racing for height.
- Local high-score leaderboard via `localStorage`.
