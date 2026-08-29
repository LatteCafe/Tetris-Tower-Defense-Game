# Tricky Towers Clone

A browser-based, physics-driven tower-stacking game inspired by *Tricky Towers*.
Unlike classic Tetris, blocks are **not grid-locked** — every piece is a real
rigid body simulated with [Matter.js](https://brm.io/matter-js/), so towers
wobble, lean, and can genuinely topple if you stack carelessly.

![gameplay preview](assets/preview-placeholder.txt)

## Gameplay

- Random tetromino-shaped pieces (I, O, T, S, Z, J, L) spawn one at a time and
  fall under gravity.
- Move and rotate the **active** piece to place it on the growing stack.
- Occasional **wind gusts** push every settled piece sideways — the storm
  intensifies the longer you survive, just like the source game's magic storms.
- **Win** by growing the tower past the gold goal line and keeping it standing.
- **Lose** if any block tips off the platform or crashes to the ground below.

## Controls

| Key | Action |
| --- | --- |
| `←` / `→` | Move the active piece left / right |
| `↑` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
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
- Wind is implemented as a slowly-drifting force applied to every dynamic
  body each tick, ramping up with the number of pieces placed.

## Ideas for extending it

- Add spell cards from the original game (haste, slow, boost blocks up).
- Multiplayer via WebSockets, racing to the goal line.
- Difficulty settings that change wind strength / goal height.
- Local high-score leaderboard via `localStorage`.
