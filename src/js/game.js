// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
// Orden de desempate determinista al comparar distancias.
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ];

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const GHOST_RELEASE_DELAY = 1000; // ms entre salidas de la pen
const AMBUSH_LEAD = 4;            // celdas de anticipacion del ambusher

const POWER_PELLET_SCORE = 50;
const FRIGHTENED_DURATION = 7000; // ms de susto por power pellet
const FRIGHTENED_BLINK = 2000;    // ms finales de parpadeo blanco
const GHOST_CHAIN_SCORES = [ 200, 400, 800, 1600 ];
const GHOST_EAT_RESPAWN_DELAY = 1000; // ms hasta que el fantasma comido sale

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    elapsed: 0,
    frightenedUntil: 0, // ms absolutos de game.elapsed; 0 = inactivo
    ghostChain: 0,      // fantasmas comidos en el susto actual
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      startX: g.x,
      startY: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: i * GHOST_RELEASE_DELAY,
      inPen: true,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Celda vecina en la direccion dada, aplicando el wrap del tunel.
function neighbor( grid, x, y, dir ) {
  const d = DIRS[ dir ];
  const width = grid[ 0 ].length;
  let nx = x + d.x;
  const ny = y + d.y;
  if ( ny === TUNNEL_ROW ) {
    if ( nx < 0 ) nx += width;
    else if ( nx >= width ) nx -= width;
  }
  return { x: nx, y: ny };
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// BFS multi-fuente sobre celdas transitables para fantasmas.
// Devuelve dist[y][x] con Infinity en celdas inalcanzables.
function buildDistanceMap( grid, seeds ) {
  const height = grid.length;
  const width = grid[ 0 ].length;
  const dist = Array.from( { length: height }, () => new Array( width ).fill( Infinity ) );
  const queue = [];

  for ( const seed of seeds ) {
    const x = Math.round( seed.x );
    const y = Math.round( seed.y );
    if ( isWall( grid, x, y, 'ghost' ) ) continue;
    if ( dist[ y ][ x ] === 0 ) continue;
    dist[ y ][ x ] = 0;
    queue.push( { x, y } );
  }

  for ( let head = 0; head < queue.length; head++ ) {
    const cell = queue[ head ];
    const next = dist[ cell.y ][ cell.x ] + 1;
    for ( const dir of DIR_ORDER ) {
      const n = neighbor( grid, cell.x, cell.y, dir );
      if ( isWall( grid, n.x, n.y, 'ghost' ) ) continue;
      if ( dist[ n.y ][ n.x ] <= next ) continue;
      dist[ n.y ][ n.x ] = next;
      queue.push( n );
    }
  }

  return dist;
}

// Si el objetivo cae en pared o fuera del mapa, busca en anillos crecientes
// la celda transitable mas cercana.
function nearestOpenCell( grid, x, y ) {
  const height = grid.length;
  const width = grid[ 0 ].length;
  const cx = Math.round( x );
  const cy = Math.round( y );
  if ( !isWall( grid, cx, cy, 'ghost' ) ) return { x: cx, y: cy };

  const maxRing = Math.max( width, height );
  for ( let ring = 1; ring <= maxRing; ring++ ) {
    let best = null;
    let bestDist = Infinity;
    for ( let dy = -ring; dy <= ring; dy++ ) {
      for ( let dx = -ring; dx <= ring; dx++ ) {
        if ( Math.abs( dx ) !== ring && Math.abs( dy ) !== ring ) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if ( isWall( grid, nx, ny, 'ghost' ) ) continue;
        const d = dx * dx + dy * dy;
        if ( d < bestDist ) {
          bestDist = d;
          best = { x: nx, y: ny };
        }
      }
    }
    if ( best ) return best;
  }

  // Sin celdas transitables (no ocurre en este laberinto).
  return { x: Math.max( 0, Math.min( width - 1, cx ) ), y: Math.max( 0, Math.min( height - 1, cy ) ) };
}

// Semillas justo fuera de la puerta: guian a los fantasmas fuera de la pen.
function penExitSeeds( grid ) {
  const seeds = [];
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( grid[ y ][ x ] === 3 ) seeds.push( nearestOpenCell( grid, x, y - 1 ) );
    }
  }
  return seeds;
}

const PEN_EXIT_MAP = buildDistanceMap( MAZE, penExitSeeds( MAZE ) );

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.dotsRemaining--;
      game.frightenedUntil = game.elapsed + FRIGHTENED_DURATION;
      game.ghostChain = 0;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Direcciones validas, sin retroceder salvo callejon sin salida.
function ghostChoices( game, g ) {
  const choices = DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( game.grid, g.x, g.y, dir, 'ghost' )
  );
  return choices.length ? choices : [ OPPOSITE[ g.dir ] ];
}

function nearestByManhattan( game, g, choices ) {
  const px = Math.round( game.pacman.x );
  const py = Math.round( game.pacman.y );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const n = neighbor( game.grid, g.x, g.y, dir );
    const dist = Math.abs( n.x - px ) + Math.abs( n.y - py );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function chooseByDistance( game, g, distMap ) {
  const choices = ghostChoices( game, g );
  let best = null;
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const n = neighbor( game.grid, g.x, g.y, dir );
    const value = distMap[ n.y ] ? distMap[ n.y ][ n.x ] : Infinity;
    if ( value < bestDist ) {
      bestDist = value;
      best = dir;
    }
  }
  // Sin valores utiles en el mapa: respaldo por heuristica Manhattan.
  if ( best === null || bestDist === Infinity ) return nearestByManhattan( game, g, choices );
  return best;
}

function randomDir( game, g ) {
  const choices = ghostChoices( game, g );
  return choices[ Math.floor( Math.random() * choices.length ) ];
}

function isFrightened( game ) {
  return game.frightenedUntil > game.elapsed;
}

// Mapa de distancias segun la estrategia del fantasma.
function ghostTargetMap( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  if ( g.kind === 'hunter' ) {
    return buildDistanceMap( grid, [ { x: Math.round( p.x ), y: Math.round( p.y ) } ] );
  }

  if ( g.kind === 'ambusher' ) {
    const step = DIRS[ p.dir ];
    const target = nearestOpenCell(
      grid,
      Math.round( p.x ) + step.x * AMBUSH_LEAD,
      Math.round( p.y ) + step.y * AMBUSH_LEAD
    );
    return buildDistanceMap( grid, [ target ] );
  }

  if ( g.kind === 'scavenger' ) {
    const seeds = [];
    for ( let y = 0; y < grid.length; y++ ) {
      for ( let x = 0; x < grid[ 0 ].length; x++ ) {
        if ( grid[ y ][ x ] === 2 ) seeds.push( { x, y } );
      }
    }
    if ( !seeds.length ) seeds.push( { x: g.startX, y: g.startY } );
    return buildDistanceMap( grid, seeds );
  }

  return null;
}

function decideGhost( game, g ) {
  const frightened = isFrightened( game );
  // Atemorizados: salen de la pen si estan dentro; fuera, deambulan al azar.
  if ( frightened ) {
    g.dir = g.inPen ? chooseByDistance( game, g, PEN_EXIT_MAP ) : randomDir( game, g );
    return;
  }
  if ( g.kind === 'random' ) {
    // Dentro de la pen sigue la salida para no quedarse atrapado.
    g.dir = g.inPen ? chooseByDistance( game, g, PEN_EXIT_MAP ) : randomDir( game, g );
    return;
  }
  g.dir = chooseByDistance( game, g, ghostTargetMap( game, g ) );
}

function moveGhost( game, g ) {
  if ( game.elapsed < g.releaseAt ) return;

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );

  // La pen solo se abandona por la puerta (hacia la fila 11).
  if ( g.inPen && aligned( g.x ) && aligned( g.y ) && Math.round( g.y ) < 12 ) {
    g.inPen = false;
  }
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.elapsed = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.inPen = true;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game, dt = 0 ) {
  game.elapsed += dt;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
