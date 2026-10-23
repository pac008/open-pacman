## Repo
- Pure static HTML/JS/CSS (no build, no package manager, no tests). Open `src/index.html` in a browser.
- Entry point: `src/index.html` loads scripts in order: `js/maze.js`, `js/game.js`, `js/render.js`, `js/main.js`. Globals are attached to `window` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`, `createGame`, `update`, `draw`, `DIRS`).

## Key files
- `src/js/maze.js`: 31x28 string map parsed to numeric grid (1 wall, 2 dot, 0 empty, 3 door). Defines `PACMAN_START` (13,23), tunnel row 14, two ghost starts. Copies maze to `game.grid` per game (original immutable).
- `src/js/game.js`: State machine (`start|playing|won|lost`). Movement is grid-aligned with fractional steps (Pacman 0.125/cell/frame, ghosts 0.1). Pacman can turn on alignment if `nextDir` valid; ghosts use shortest-path-like choice for `hunter`, random for `random`, with 180° fallback in dead-ends. Eating dot (2) sets to 0, +10 score. Collision at distance <0.5 -> lose life (3) or game over; reset positions on hit. Win when `dotsRemaining <= 0`.
- `src/js/render.js`: Canvas 20px tiles, walls drawn by connecting adjacent wall centers, door as pink line, dots small circles, animated Pacman mouth, ghosts with eyes facing direction. HUD shows score/lives.
- `src/js/main.js`: Keyboard arrows set `pacman.nextDir` when playing. `createGame()` on start/restart; loop updates/draws via globals.
- `src/css/style.css`: Overlay with Start/Restart, win/lose states.

## Gotchas
- Script load order matters (maze defines globals used by game/render/main).
- Tunnel: wrap horizontally on `TUNNEL_ROW` (row 14). Pacman blocked by walls (1) and door (3); ghosts blocked only by walls (1).
- Grid is copied per game (`MAZE.map(row=>row.slice())`) and start cell cleared of dot.
- All modules use global functions/vars (no modules/exports).
- UI text is Spanish ("GANASTE"/"PERDISTE", instructions in Spanish).
- Canvas size fixed 560x620 (28*20 x 31*20).
