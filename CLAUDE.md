# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo contains a single self-contained Pong game: `index.html`. There is no build system, package manager, dependency list, or test suite — HTML, CSS, and JavaScript all live inline in that one file.

## Running the game

There is nothing to build or install. Open `index.html` directly in a browser, or serve it locally, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html`.

There are no lint or test commands configured in this repo.

## Code architecture

Everything is in the `<script>` block of `index.html`, structured as a small game loop:

- **State** — `state` (running/over/scores), `paddles` (two paddle objects with `x`/`y`/`dy`), and `ball` (position/velocity) are plain mutable objects, not classes.
- **Input** — `keydown`/`keyup` listeners populate a `keys` map; SPACE toggles start/pause or triggers `resetGame()` when the game is over. Left paddle uses W/S, right paddle uses Arrow Up/Down.
- **Update loop** (`update()`) — reads `keys` to set paddle velocity, moves paddles and the ball, handles wall/paddle collisions (including spin from paddle movement and a per-hit speed multiplier), and updates scores.
- **Win condition** — `checkWin()` ends the game at `WIN_SCORE` (7) and is checked after each point.
- **Rendering** (`draw()`) — clears the canvas and redraws the center line, scores, win-progress indicator bars, paddles, and ball every frame.
- **Main loop** (`loop()`) — calls `update()` then `draw()` via `requestAnimationFrame`, started once at the bottom of the script alongside `resetGame()`.

Gameplay constants (`PADDLE_W`, `PADDLE_H`, `BALL_SIZE`, `PADDLE_SPEED`, `WIN_SCORE`) are declared at the top of the script — adjust these to tune game feel rather than hardcoding values elsewhere.
