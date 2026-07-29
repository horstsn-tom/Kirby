# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo is a small collection of self-contained single-file browser games. Each game is one `.html` file with HTML, CSS, and JavaScript inline — no build system, package manager, dependency list, or test suite.

- `index.html` — Pong (two-player, W/S and Arrow keys)
- `touch-grass.html` — "Touch Grass": survive at your desk racking up Screen Time while reacting to whoever shows up at the door — Mom (TAB / "Look Busy" to hide), your brother (Y / "Yell At Him" to shoo him off), or Dad (H / "Hide") — within a shrinking reaction window before you're caught; pressing the wrong action for the current visitor also costs a life (3 lives total). Losing your last life teleports you outside into an endless-runner second act: SPACE/tap/JUMP to jump potholes, fire hydrants, and cars as you flee, until you get clipped. Playable on mobile via on-screen buttons and tap-to-start throughout.

## Running a game

There is nothing to build or install. Open the `.html` file directly in a browser, or serve the directory locally, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html` or `http://localhost:8000/touch-grass.html`.

There are no lint or test commands configured in this repo. When making UI/gameplay changes, verify them by loading the page in a browser (or driving it with Playwright, pointed at `/opt/pw-browsers/chromium` per the environment's pre-installed browser) rather than relying on code review alone.

## Code architecture

### `index.html` (Pong)

Everything is in the `<script>` block, structured as a small game loop:

- **State** — `state` (running/over/scores), `paddles` (two paddle objects with `x`/`y`/`dy`), and `ball` (position/velocity) are plain mutable objects, not classes.
- **Input** — `keydown`/`keyup` listeners populate a `keys` map; SPACE toggles start/pause or triggers `resetGame()` when the game is over. Left paddle uses W/S, right paddle uses Arrow Up/Down.
- **Update loop** (`update()`) — reads `keys` to set paddle velocity, moves paddles and the ball, handles wall/paddle collisions (including spin from paddle movement and a per-hit speed multiplier), and updates scores.
- **Win condition** — `checkWin()` ends the game at `WIN_SCORE` (7) and is checked after each point.
- **Rendering** (`draw()`) — clears the canvas and redraws the center line, scores, win-progress indicator bars, paddles, and ball every frame.
- **Main loop** (`loop()`) — calls `update()` then `draw()` via `requestAnimationFrame`, started once at the bottom of the script alongside `resetGame()`.

Gameplay constants (`PADDLE_W`, `PADDLE_H`, `BALL_SIZE`, `PADDLE_SPEED`, `WIN_SCORE`) are declared at the top of the script — adjust these to tune game feel rather than hardcoding values elsewhere.

### `touch-grass.html` (Touch Grass)

Same single-file, `state`-object-plus-`requestAnimationFrame`-loop style as `index.html`, but driven by delta-time (`performance.now()` diffs) rather than fixed per-frame steps:

The game is really two acts sharing one canvas, HUD, and input surface, chained via `state.screen`: `menu` → `playing` (bedroom) → `teleport` → `running` (outside) → `gameover`. `update(dt)` and `draw(now)` both branch on `state.screen` at the top and delegate to per-act functions — extend within the matching act's functions rather than adding more branches to `update`/`draw` themselves.

**Act 1 — bedroom (`state.screen === 'playing'`)**
- **State machine** — `state.visitPhase` (`hidden`/`warning`/`approaching`/`caught`/`leaving`), driven by `updateBedroom(dt)`, is the core loop. `state.visitorType` (`mom`/`brother`/`dad`), chosen randomly each visit in `scheduleNextVisit()` from `VISITOR_TYPES`, decides which sprite/color/required action/copy applies — adding a fourth visitor means adding an entry to `VISITOR_COLOR`, `VISITOR_BTN`, `VISIT_COPY`, and `VISITOR_SPRITE`, plus a button and key binding, rather than touching the state machine itself. `visitor.x` is interpolated between the door and the desk based on `state.phaseTimer` versus `state.reactionWindow`.
- **Difficulty ramp** — each successful reaction increments `state.difficulty`, which shrinks `state.reactionWindow` and the gap between visits (`scheduleNextVisit()`), floored so the game stays playable.
- **Input** — `handleAction(type)` is the single entry point for reacting; it only does anything when `visitPhase === 'approaching'`. A matching `type` succeeds (moves to `leaving`); any other `type` (wrong button for the current visitor) calls `triggerCaught(true)`, the same life-losing transition a timeout uses (`triggerCaught(false)`) — `state.wrongInput` distinguishes the two for the caught-phase message (`VISIT_COPY[type].caughtWrong` vs `.caughtRight`). `keydown` maps `Tab` → `handleAction('mom')`, `KeyY` → `handleAction('brother')`, `KeyH` → `handleAction('dad')` (all `preventDefault`ed so Tab never shifts browser focus), plus `Space` → start/restart or jump depending on screen. The `#tabBtn`/`#yellBtn`/`#hideBtn` on-screen buttons (looked up via `VISITOR_BTN`) and a canvas tap (→ `handleSpace()`) mirror the same handlers for touch devices.
- On the third lost life, `updateBedroom` calls `enterTeleport()` instead of setting `gameover` directly — the bedroom's own `visitPhase` is simply left stale and never drawn/updated again until `startGame()` resets it.
- **Action effects** — `drawActionEffect(now)`, called from `drawRoom()` right after `drawPlayer(now)`, plays a per-`visitorType` flourish for the whole `leaving` phase (typing-motion lines for mom, expanding shout arcs for brother, dash marks for dad), colored to match `VISITOR_COLOR` and fading via the same `phaseTimer`-derived progress the visitor's walk-off animation uses. `drawPlayer(now)` additionally crouches/shrinks the player sprite during dad's `leaving` phase — a new visitor's "success" reaction should extend this pair of functions rather than adding a separate effect system.

**Act 2 — outside (`teleport` → `running` → `gameover`)**
- `enterTeleport()` sets a ~1.1s white full-screen flash (`state.flash`/`state.flashColor`, shared with the bedroom's red catch-flash) and a timer; `updateTeleport(dt)` counts it down into `enterRunning()`.
- `updateRunning(dt)` is a small endless-runner: `state.runDistance`/`state.runSpeed` ramp over time (capped at `RUN_MAX_SPEED`), `state.obstacles` (potholes/hydrants/cars, dimensions in `OBSTACLE_DIMS`) spawn via `spawnObstacle()` on a shrinking `state.spawnTimer` and scroll left; `runner.jumpHeight`/`runner.vy` are simple projectile physics driven by `jumpRunner()` (triggered through `handleSpace()`, same as bedroom start/restart) and `RUN_GRAVITY`/`JUMP_SPEED`. AABB collision against the runner's hitbox calls `endRun(obstacleType)`, which sets `gameover` and saves `state.distanceHighScore` (`touchGrassDistanceHighScore` in `localStorage`) if beaten.
- `updateChrome()` toggles which on-screen buttons are visible (bedroom's three vs. `#jumpBtn`) and rewrites the `#ui` hint text per screen — call it (alongside `updateMessage()`) at every screen transition, not per-frame. **Gotcha**: `#jumpBtn` has a `display: none` CSS rule as its default, so un-hiding it requires `style.display = 'block'` explicitly — setting `style.display = ''` only clears the inline override and falls back to that CSS rule, leaving it hidden.
- **Scoring/persistence** — bedroom `state.score` accrues while `visitPhase === 'hidden'`; both high scores (`touchGrassHighScore`, `touchGrassDistanceHighScore`) go through the shared `loadStoredNumber()`/`saveStoredNumber(key, value)` helpers, guarded with try/catch since some browsers restrict storage on `file://` pages.
- **Rendering** — `draw(now)` picks `drawRoom()`+`drawVisitor()` or `drawOutsideScene()` (parallax houses, scrolling sidewalk cracks, static `STAR_POSITIONS`, obstacles, `drawRunnerSprite()`) based on screen, then always calls the shared `drawHud()`, which itself branches on outside-vs-bedroom for the stats it draws but shares the flash overlay and the `menu`/`gameover`/`teleport` title-card logic ("TOUCH GRASS" / "RUN FROM HOME!", also mirrored in `#message` via `updateMessage()`). The warning-phase "!" glyph stops rendering once `state.score >= WARNING_ICON_HIDE_SCORE` (1000), a late-game bedroom difficulty bump — the door still opens and the warning message still plays, just without the visual heads-up.
