# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo is a small collection of self-contained single-file browser games. Each game is one `.html` file with HTML, CSS, and JavaScript inline — no build system, package manager, dependency list, or test suite.

- `index.html` — Pong (two-player, W/S and Arrow keys)
- `touch-grass.html` — "Touch Grass": survive at your desk racking up Screen Time while dodging Mom, who periodically appears at the door and must be evaded by pressing TAB within a shrinking reaction window before she catches you (3 lives)

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

- **State machine** — `state.screen` (`menu`/`playing`/`gameover`) gates input and updates; `state.momPhase` (`hidden`/`warning`/`approaching`/`caught`/`leaving`) drives Mom's behavior and is the core of the game. `mom.x` is interpolated between the door and the desk based on `state.phaseTimer` versus `state.reactionWindow`.
- **Difficulty ramp** — each successful dodge increments `state.difficulty`, which shrinks `state.reactionWindow` and the gap between Mom's appearances (`scheduleNextMom()`), floored so the game stays playable.
- **Input** — `keydown` handles `Tab` (only effective during `momPhase === 'approaching'`; always `preventDefault`ed so it never shifts browser focus) and `Space` (start/restart).
- **Scoring/persistence** — `state.score` accrues while `momPhase === 'hidden'`; high score is read/written to `localStorage` under `touchGrassHighScore`.
- **Rendering** — `drawRoom()`, `drawMom()`, and `drawHud()` are called each frame from `draw()`; the reaction-time bar and life indicators (grass-blade triangles) are drawn directly on the canvas, not as DOM/emoji elements.
