## Repo
- Pure static HTML/JS/CSS (no build, no package manager, no tests). Open `src/index.html` in a browser.
- Entry point: `src/index.html` loads scripts in order: `js/maze.js`, `js/game.js`, `js/render.js`, `js/main.js`. Globals are attached to `window` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`, `createGame`, `update`, `draw`, `DIRS`).

## Key files
- `src/js/maze.js`: 31x28 string map parsed to numeric grid (1 wall, 2 dot, 0 empty, 3 door). Defines `PACMAN_START` (13,23), tunnel row 14, four ghost starts (`hunter`, `ambusher`, `random`, `scavenger`) inside the pen. Copies maze to `game.grid` per game (original immutable).
- `src/js/game.js`: State machine (`start|playing|won|lost`). Movement is grid-aligned with fractional steps (Pacman 0.125/cell/frame, ghosts 0.1). Pacman can turn on alignment if `nextDir` valid. Ghost AI uses BFS distance maps (`buildDistanceMap`, multi-source, tunnel wrap): `hunter` targets Pacman, `ambusher` targets 4 cells ahead (`nearestOpenCell`), `scavenger` targets all remaining dots, `random` picks randomly at each junction. Tie order `up,left,down,right`; Manhattan fallback when no map value applies. Ghosts are released staggered (`GHOST_RELEASE_DELAY` = 1000 ms via `game.elapsed`/`releaseAt`) and `resetPositions` restarts the timer after a life loss. `update(game, dt)` accumulates elapsed milliseconds. Eating dot (2) sets to 0, +10 score. Collision at distance <0.5 -> lose life (3) or game over. Win when `dotsRemaining <= 0`.
- `src/js/render.js`: Canvas 20px tiles, walls drawn by connecting adjacent wall centers, door as pink line, dots small circles, animated Pacman mouth, ghosts with eyes facing direction. Ghost color selected from `GHOST_COLORS` by `kind` (hunter red, ambusher pink, random cyan, scavenger orange). HUD shows score/lives.
- `src/js/main.js`: Keyboard arrows set `pacman.nextDir` when playing. `createGame()` on start/restart. `requestAnimationFrame` loop computes `dt` between timestamps (capped at 100 ms) and calls `update(game, dt)`; draws via globals.
- `src/css/style.css`: Overlay with Start/Restart, win/lose states.

## Gotchas
- Script load order matters (maze defines globals used by game/render/main).
- Tunnel: wrap horizontally on `TUNNEL_ROW` (row 14). Pacman blocked by walls (1) and door (3); ghosts blocked only by walls (1).
- Pen exit: the only way out for ghosts is the door (row 12). `inPen` starts `true` and flips to `false` at row 11; while inside, the `random` ghost follows `PEN_EXIT_MAP` instead of wandering.
- Ghost release order follows `GHOST_STARTS`: first at 0 ms, last at 3 s. `game.elapsed` is milliseconds, not frames.
- Grid is copied per game (`MAZE.map(row=>row.slice())`) and start cell cleared of dot.
- All modules use global functions/vars (no modules/exports).
- UI text is Spanish ("GANASTE"/"PERDISTE", instructions in Spanish).
- Canvas size fixed 560x620 (28*20 x 31*20).
