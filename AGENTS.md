## Repo
- Pure static HTML/JS/CSS (no build, no package manager, no tests). Open `src/index.html` in a browser.
- Entry point: `src/index.html` loads scripts in order: `js/maze.js`, `js/game.js`, `js/render.js`, `js/main.js`. Globals are attached to `window` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`, `createGame`, `update`, `draw`, `DIRS`).

## Key files
- `src/js/maze.js`: 31x28 string map parsed to numeric grid (1 wall, 2 dot, 4 power pellet, 0 empty, 3 door). Defines `PACMAN_START` (13,23), tunnel row 14, four ghost starts (`hunter`, `ambusher`, `random`, `scavenger`) inside the pen, and four power pellets at `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`. Copies maze to `game.grid` per game (original immutable).
- `src/js/game.js`: State machine (`start|playing|won|lost`). Movement is grid-aligned with fractional steps (Pacman 0.125/cell/frame, ghosts 0.1). Pacman can turn on alignment if `nextDir` valid. Ghost AI uses BFS distance maps (`buildDistanceMap`, multi-source, tunnel wrap): `hunter` targets Pacman, `ambusher` targets 4 cells ahead (`nearestOpenCell`), `scavenger` targets all remaining dots, `random` picks randomly at each junction. Tie order `up,left,down,right`; Manhattan fallback when no map value applies. Ghosts are released staggered (`GHOST_RELEASE_DELAY` = 1000 ms via `game.elapsed`/`releaseAt`) and `resetPositions` restarts the timer after a life loss. `update(game, dt)` accumulates elapsed milliseconds. Eating dot (2) sets to 0, +10 score; eating power pellet (4) sets to 0, +50 score and starts a global fright. Collision at distance <0.5 -> lose life (3) or game over. Win when `dotsRemaining <= 0` (counts tiles 2 and 4).
- `src/js/render.js`: Canvas 20px tiles, walls drawn by connecting adjacent wall centers, door as pink line, dots small circles, power pellets large circles (radius 6), animated Pacman mouth, ghosts with eyes facing direction. Ghost color selected from `GHOST_COLORS` by `kind` (hunter red, ambusher pink, random cyan, scavenger orange); during fright ghosts are blue `#2121ff` and blink white every 250 ms in the last 2 s. HUD shows score/lives.
- `src/js/main.js`: Keyboard arrows set `pacman.nextDir` when playing. `createGame()` on start/restart. `requestAnimationFrame` loop computes `dt` between timestamps (capped at 100 ms) and calls `update(game, dt)`; draws via globals.
- `src/css/style.css`: Overlay with Start/Restart, win/lose states.

## Gotchas
- Script load order matters (maze defines globals used by game/render/main).
- Tunnel: wrap horizontally on `TUNNEL_ROW` (row 14). Pacman blocked by walls (1) and door (3); ghosts blocked only by walls (1).
- Pen exit: the only way out for ghosts is the door (row 12). `inPen` starts `true` and flips to `false` at row 11; while inside, the `random` ghost and any frightened ghost follow `PEN_EXIT_MAP` instead of wandering.
- Fright: eating a power pellet sets `game.frightenedUntil = game.elapsed + 7000` (absolute ms; `0` = inactive) and resets `game.ghostChain`. `isFrightened` drives the AI, render and collisions. Frightened ghosts wander randomly and are edible; contact never costs a life.
- Ghost chain: eaten ghosts in the same fright score `200/400/800/1600` (`GHOST_CHAIN_SCORES`, clamped to the last value). The chain resets on a new pellet, when the fright expires (`expireFright`) or on a life loss.
- Eaten ghost: teleported to `(startX, startY)` with `inPen = true` and `releaseAt = game.elapsed + 1000`; it exits frightened if the timer is still active when released. No eyes-return animation.
- Life loss: `resetPositions` cancels the fright (`frightenedUntil = 0`), resets `ghostChain = 0` and restores staggered release (`releaseAt = i * GHOST_RELEASE_DELAY`). Eaten dots/pellets stay eaten because `game.grid` is not rebuilt.
- Ghost release order follows `GHOST_STARTS`: first at 0 ms, last at 3 s. `game.elapsed` is milliseconds, not frames.
- Grid is copied per game (`MAZE.map(row=>row.slice())`) and start cell cleared of dot.
- All modules use global functions/vars (no modules/exports).
- UI text is Spanish ("GANASTE"/"PERDISTE", instructions in Spanish).
- Canvas size fixed 560x620 (28*20 x 31*20).
