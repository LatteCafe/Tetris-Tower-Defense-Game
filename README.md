# Castle Siege — Tetris Tower Defense + RPG Upgrades

Classic grid-based Tetris (no physics engine — exact integer grid logic)
fused with a tower-defense layer and a light RPG upgrade tree: every
block you place becomes part of your castle's battlements, automatically
firing on the horde and boss below, while your dragon ally fights beside
you — and every point of score also earns gold you can spend on permanent
upgrades between drops.

## A note on interpreting the brief

A couple of mechanics were ambiguous enough that I made an explicit
design call rather than guess silently:

- **Level progression** — each level has a lines-cleared target (0, 1, 2,
  4, 8, 16... doubling from level 2 on), but rather than being a separate
  pass/fail gate, that number sizes the level's enemy HP pool (bigger
  target → tankier enemies). A level completes by grinding the mob+boss
  pool to zero via combat.
- **The dragon fights for you.** It sits beside your castle and
  periodically attacks the horde/boss on its own; every line you clear
  permanently adds to how much damage it deals per hit. The horde and
  boss are the enemy, and they're the ones periodically striking your
  castle back.
- **Upgrades and gold are persistent meta-progression.** They're saved
  to `localStorage` and survive both death (a new run keeps your gold and
  upgrade levels) and closing the browser entirely. Only board state,
  score, lines, level, and HP reset per run — the earlier version of this
  reset everything including gold on every new game, which is what made
  it look like gold "wasn't being credited" on death; it was being
  earned correctly, just immediately wiped a moment later.

## Gameplay

- Standard 10×20 board, 7-bag piece randomizer, starts with 5 rows of
  random pre-placed blocks (always at least one gap per row, so nothing
  starts unclearable).
- **Castle HP** grows with every block you place (+2 max HP per block,
  and the gain also heals you) — building bigger is itself a survival
  strategy, not just a stacking risk.
- **Turrets**: the topmost block in every column sprouts an archer or
  cannon, and the whole castle passively fires on the horde/boss once a
  second, dealing damage proportional to your total block count.
- **Your dragon** fires on the horde/boss on its own fixed timer. Its
  damage only ever goes up — every line you clear permanently adds to it.
- **Line clears** also permanently raise a separate damage multiplier
  (+3% per line, forever, applies to both turrets and the dragon).
- **Enemy pool**: each level has a total HP pool split 50/50 between the
  mob horde and the boss. Mobs absorb damage first; only once they're
  dead does damage start coming off the boss.
- **Gold & upgrades** persist across deaths and browser sessions
  (`localStorage`). Every point of score also earns gold (both from
  hard-drops and line clears). Press `U` or the Upgrades button to open
  the shop — it pauses the game while open. Seven upgrades, each with
  multiple levels and rising costs:
  - **Vitality** — flat max castle HP
  - **Regeneration** — passive HP/sec regen
  - **Armor** — flat percentage reduction on incoming horde/boss damage
  - **Turret Mastery** — turret damage multiplier
  - **Dragon's Might** — dragon damage multiplier
  - **Treasure Hunter** — more gold earned per point of score
  - **Quick Hands** — shorter discard cooldown
- **Discard**: stuck with a piece you have no good spot for? Discard it
  for the next one in queue, on a cooldown (shortened by Quick Hands).
- **Reset progress**: a small "Reset saved progress" link at the bottom
  of the upgrade shop wipes gold and upgrade levels back to zero, behind
  a confirmation prompt — since this is now real save data, it needs a
  real way to clear it.
- **Game over** two ways: the stack reaches the top, or the horde/boss
  whittles your castle HP to zero. Either way, your gold and upgrade
  levels carry into the next run.

## Controls

| Key | Action |
| --- | --- |
| `←` / `→` | Move left / right (hold to auto-repeat) |
| `↑` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
| `↓` | Soft drop |
| `Space` | Hard drop |
| `C` | Discard current piece (on cooldown) |
| `U` | Open/close the upgrade shop (pauses the game) |

## Project structure

```
tetris-clone/
├── index.html          # Entry point, canvas + HUD + upgrade shop markup
├── css/
│   └── style.css        # Medieval castle-siege visual theme
├── js/
│   ├── pieces.js         # Tetromino shapes, rotation states, 7-bag
│   ├── board.js           # Grid state, collision checks, line clearing
│   ├── upgrades.js         # RPG upgrade tree: costs, levels, effects
│   ├── combat.js            # HP, enemy pools, damage math, dragon, levels
│   ├── input.js               # Keyboard state tracking
│   ├── render.js                # Board, castle blocks, dragon, projectiles
│   ├── ui.js                     # HUD, HP bars, upgrade shop rendering
│   └── main.js                     # Bootstraps everything on load
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

- **Persistence**: gold (`castleSiege.gold.v1`) and upgrade levels
  (`castleSiege.upgrades.v1`) are saved to `localStorage` on every change
  and loaded on startup. Both fail gracefully (silently falling back to
  zero/defaults) if storage is unavailable — private browsing, quota
  exceeded, or corrupt save data won't crash the game. This was verified
  with a test that captures the real localStorage writes from one
  simulated session, seeds a *second, completely fresh* jsdom
  environment with only those captured values, and confirms the new
  session correctly loads the exact gold and upgrade levels — i.e. it
  tests actual persistence, not just that save/load functions don't
  throw. A second test forces a real game over (via genuine stack
  overflow, not a mocked condition) and confirms gold continues
  accumulating through it into the next run rather than resetting, and a
  third exercises the "reset saved progress" button through an actual
  click + confirm-dialog flow and confirms both values return to zero.
- `upgrades.js` and `combat.js` are pure numeric logic with zero
  DOM/canvas dependencies. Every mechanic was unit-tested headlessly
  before being wired in: cost/level scaling and max-level cutoffs, effect
  scaling (including a safety cap on Armor so mitigation can never exceed
  90%), and — critically — that each upgrade's effect actually reaches
  the number it's supposed to modify (e.g., buying one level of Armor
  measurably reduces the very next horde attack by exactly 5%, buying
  Turret Mastery measurably increases the very next turret tick's damage
  by exactly 20%).
- **A bug caught during testing, not shipped**: max HP was originally
  only recalculated inside the piece-lock handler, so buying Vitality
  wouldn't actually raise your HP until the next piece happened to lock.
  Fixed by recomputing max HP every frame instead of reactively — Vitality
  (and any future upgrade like it) now applies the instant you buy it.
  This was caught by a test that bought an upgrade and checked the
  resulting stat immediately afterward, before any other game event could
  mask the bug.
- The full purchase flow (earn gold from real hard-drops → open the
  shop → buy → verify the effect applied and gold was deducted) and the
  pause behavior (menu open blocks all piece control, `U` toggles
  cleanly) were both verified end-to-end by driving the real game through
  simulated keyboard input in a jsdom environment, not just tested as
  isolated units.
- Turret decoration is drawn only on the topmost block of each column
  (the battlements), not every single cell. The castle theming lives in
  the *blocks* (mortar lines, stone-blended fill, beveled masonry edges),
  not the frame around the board.
- The dragon, horde, boss, projectiles, and hit-flash are all pure canvas
  animation driven by combat.js's callback hooks — render.js has no
  direct knowledge of game rules, just visual reactions to events.

## Ideas for extending it

- Distinct mob "waves" with their own sprites, rather than one HP pool.
- More upgrade branches: crit chance, piece-preview extension, a "second
  dragon" unlock, a temporary damage-boost potion bought with gold.
- Hold piece, T-spin bonus damage.
- Local high-score leaderboard via `localStorage` (score/lines/level
  themselves still reset per run, only gold and upgrades persist today).
