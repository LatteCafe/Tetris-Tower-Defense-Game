# Castle Siege — Tetris Tower Defense

Classic grid-based Tetris (no physics engine — exact integer grid logic)
fused with a tower-defense layer: every block you place becomes part of
your castle's battlements, automatically firing on the horde and dragon
below, while they periodically strike back.

## A note on interpreting the brief

A couple of the requested mechanics were ambiguous enough that I made an
explicit design call rather than guess silently — flagging it here so
it's easy to adjust if it's not what was meant:

- **"Cleared lines damage is added to the dragon's damage"** — implemented
  as *line clears deal burst damage to the enemy pool* (not that clearing
  lines makes the dragon hit harder).
- **Level progression** — each level has a lines-cleared target (0, 1, 2,
  4, 8, 16... doubling from level 2 on, exactly as specified), but rather
  than being a separate pass/fail gate, that number is used to size the
  level's enemy HP pool (bigger target → tankier enemies). A level is
  actually completed by grinding the mob+boss pool to zero via combat,
  which naturally takes roughly that much cleared-line damage to achieve.

## Gameplay

- Standard 10×20 board, 7-bag piece randomizer, starts with 5 rows of
  random pre-placed blocks (always at least one gap per row, so nothing
  starts unclearable).
- **Castle HP** grows with every block you place (+2 max HP per block,
  and the gain also heals you) — building bigger is itself a survival
  strategy, not just a stacking risk.
- **Turrets**: the topmost block in every column sprouts an archer or
  cannon, and the whole castle passively fires on the enemy pool once a
  second, dealing damage proportional to your total block count.
- **Line clears** deal a direct burst of damage to the enemy pool *and*
  permanently raise a damage multiplier (+3% per line, forever) — this is
  the mechanic that lets your output scale to keep pace with harder
  levels.
- **Enemy pool**: each level has a total HP pool split 50/50 between a
  mob horde and a boss dragon. Mobs absorb damage first; only once
  they're dead does damage start coming off the boss. Clearing the pool
  advances you to the next (larger) level.
- **The dragon** periodically attacks your castle directly regardless of
  what you're doing, with both its damage and attack frequency scaling
  up each level.
- **Discard**: stuck with a piece you have no good spot for? Discard it
  for the next one in queue, on a 10-second cooldown.
- **Game over** two ways: the stack reaches the top (no room left to
  build), or the dragon whittles your castle HP to zero.

## Controls

| Key | Action |
| --- | --- |
| `←` / `→` | Move left / right (hold to auto-repeat) |
| `↑` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
| `↓` | Soft drop |
| `Space` | Hard drop |
| `C` | Discard current piece (on cooldown) |

## Project structure

```
tetris-clone/
├── index.html          # Entry point, canvas + HUD markup
├── css/
│   └── style.css        # Medieval castle-siege visual theme
├── js/
│   ├── pieces.js         # Tetromino shapes, rotation states, 7-bag
│   ├── board.js           # Grid state, collision checks, line clearing
│   ├── combat.js           # HP, enemy pools, damage math, dragon AI, levels
│   ├── input.js             # Keyboard state tracking
│   ├── render.js             # Board, castle blocks, dragon, projectiles
│   ├── ui.js                  # DOM overlay / HUD / HP bars wiring
│   └── main.js                  # Bootstraps everything on load
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

- `combat.js` is pure numeric logic with zero DOM/canvas dependencies —
  it was fully unit-tested headlessly (level scaling, HP growth, mob→boss
  damage overflow, dragon attack cadence, HP-depletion game over) before
  being wired into the game, and the full integration (game.js → board.js
  → combat.js → render.js) was additionally verified end-to-end by
  driving the real game through simulated keyboard input in a jsdom
  environment — including forcing an actual line clear through the real
  `lockPiece()` path and confirming the resulting damage and multiplier
  matched the formula exactly.
- Turret decoration is drawn only on the topmost block of each column
  (the battlements), not every single cell — this keeps the board legible
  and performant while still visually conveying "the whole wall is
  firing."
- The dragon, projectiles, and hit-flash are all pure canvas animation
  driven by combat.js's callback hooks (`onEnemyDamaged`,
  `onPlayerDamaged`, `onLevelComplete`) — render.js has no direct
  knowledge of game rules, just visual reactions to events.

## Ideas for extending it

- Distinct mob "waves" with their own sprites, rather than one HP pool.
- Spell/ability cards purchasable with score (heal, damage boost, freeze).
- Hold piece, T-spin bonus damage.
- Local high-score leaderboard via `localStorage`.
