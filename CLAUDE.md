# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo is a small collection of self-contained single-file browser games. Each game is one `.html` file with HTML, CSS, and JavaScript inline — no build system, package manager, dependency list, or test suite.

- `index.html` — Pong (two-player, W/S and Arrow keys)
- `touch-grass.html` — "Touch Grass": survive at your desk racking up Screen Time while reacting to whoever shows up at the door — Mom (TAB / "Look Busy" to hide), your brother (Y / "Yell At Him" to shoo him off), or Dad (H / "Hide") — within a shrinking reaction window before you're caught; pressing the wrong action for the current visitor also costs a life (3 lives total); playable on mobile via on-screen buttons and tap-to-start

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

- **State machine** — `state.screen` (`menu`/`playing`/`gameover`) gates input and updates; `state.visitPhase` (`hidden`/`warning`/`approaching`/`caught`/`leaving`) drives the door-visit sequence and is the core of the game. `state.visitorType` (`mom`/`brother`/`dad`), chosen randomly each visit in `scheduleNextVisit()` from `VISITOR_TYPES`, decides which sprite/color/required action/copy applies — adding a fourth visitor means adding an entry to `VISITOR_COLOR`, `VISITOR_BTN`, `VISIT_COPY`, and `VISITOR_SPRITE`, plus a button and key binding, rather than touching the state machine itself. `visitor.x` is interpolated between the door and the desk based on `state.phaseTimer` versus `state.reactionWindow`.
- **Difficulty ramp** — each successful reaction increments `state.difficulty`, which shrinks `state.reactionWindow` and the gap between visits (`scheduleNextVisit()`), floored so the game stays playable.
- **Input** — `handleAction(type)` is the single entry point for reacting; it only does anything when `visitPhase === 'approaching'`. A matching `type` succeeds (moves to `leaving`); any other `type` (wrong button for the current visitor) calls `triggerCaught(true)`, the same life-losing transition a timeout uses (`triggerCaught(false)`) — `state.wrongInput` distinguishes the two for the caught-phase message (`VISIT_COPY[type].caughtWrong` vs `.caughtRight`). `keydown` maps `Tab` → `handleAction('mom')`, `KeyY` → `handleAction('brother')`, `KeyH` → `handleAction('dad')` (all `preventDefault`ed so Tab never shifts browser focus), plus `Space` → start/restart. The `#tabBtn`/`#yellBtn`/`#hideBtn` on-screen buttons (looked up via `VISITOR_BTN`) and a canvas tap (→ `Space`) mirror the same handlers for touch devices, so keep new input paths going through `handleAction`/`handleSpace`/`triggerCaught` rather than duplicating state changes.
- **Scoring/persistence** — `state.score` accrues while `visitPhase === 'hidden'`; high score is read/written to `localStorage` under `touchGrassHighScore` (guarded with try/catch since some browsers restrict storage on `file://` pages).
- **Rendering** — `drawRoom()`, `drawVisitor()`, and `drawHud()` are called each frame from `draw()`; `drawVisitor()` dispatches to `VISITOR_SPRITE[visitorType]` (`drawMomSprite()`/`drawBrotherSprite()`/`drawDadSprite()`). The reaction-time bar, warning glyph, and life indicators (grass-blade triangles) are drawn directly on the canvas, colored per `VISITOR_COLOR`, not as DOM/emoji elements.
