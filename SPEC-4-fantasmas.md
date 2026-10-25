# Spec: 4 fantasmas con IA distinta

Estado: propuesta para revisión · Sin implementar

## Objetivo

Pasar de 2 fantasmas (`hunter` y `random`) a 4, cada uno con una estrategia de movimiento claramente distinta, y hacer que salgan de la pen escalonados cada 1 segundo.

## Decisiones acordadas

- **Pathfinding:** BFS sobre la grilla (distancias reales), no heurística Manhattan.
- **Salida escalonada:** un fantasma cada 1 segundo, medido en tiempo real (`performance`/timestamp de `requestAnimationFrame`), no en frames.
- **Sin extras adicionales:** no hay velocidades distintas, power pellets ni nombres en el HUD.

## 1. `src/js/maze.js` — datos

`GHOST_STARTS` pasa de 2 a 4 entradas. Las 4 celdas son transitables dentro de la pen (cols 11–16, fila 14) y salen por la puerta ubicada en `(13,12)`–`(14,12)`.

```js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter'    }, // Blinky · rojo    · persigue directo
  { x: 13, y: 14, kind: 'ambusher'  }, // Pinky  · rosa    · corta 4 celdas adelante
  { x: 14, y: 14, kind: 'random'    }, // Inky   · cian    · camina al azar
  { x: 15, y: 14, kind: 'scavenger' }, // Clyde  · naranja · barre los dots restantes
];
```

## 2. `src/js/game.js` — comportamiento

### 2.1 Mapas de distancia (BFS)

- `buildDistanceMap(grid, seeds)`: BFS multi-fuente sobre celdas no-muro (`isWall(..., 'ghost')`), con wrap del túnel en `TUNNEL_ROW`. Devuelve una matriz `dist[y][x]` con `Infinity` en celdas inalcanzables.
- `nearestOpenCell(grid, x, y)`: si el objetivo cae en pared o fuera del mapa, busca en anillos crecientes la celda transitable más cercana. Se usa para el objetivo del ambusher.

### 2.2 Objetivo por tipo

| `kind` | Semillas del BFS | Estrategia |
|---|---|---|
| `hunter` | celda actual de Pacman | persecución directa |
| `ambusher` | 4 celdas delante según `pacman.dir`, ajustadas con `nearestOpenCell` | corte de ruta |
| `scavenger` | todas las celdas con dot (`2`); si no quedan dots, su celda inicial | limpia el laberinto |
| `random` | sin mapa | elección aleatoria en cada cruce |

El uso de todas las semillas de dots permite obtener en un solo BFS la distancia a la comida más cercana desde cualquier celda, sin elegir un dot concreto.

### 2.3 `decideGhost`

- `random`: igual que hoy, elige al azar entre las direcciones válidas.
- Resto: entre las direcciones válidas (sin retroceder, salvo callejón sin salida), elige la celda vecina con menor valor en el mapa de distancias.
- Desempate determinista en orden `up, left, down, right`.
- Si el vecino no tiene valor en el mapa (`Infinity`), cae a la heurística Manhattan actual como respaldo.

### 2.4 Salida escalonada cada 1 segundo

- Constante nueva: `GHOST_RELEASE_DELAY = 1000` (ms).
- `createGame` añade `elapsed: 0` y `releaseAt: i * GHOST_RELEASE_DELAY` a cada fantasma.
- `moveGhost` no mueve al fantasma mientras `game.elapsed < g.releaseAt`; queda quieto en la pen.
- `update(game, dt)` acumula `game.elapsed += dt`.
- `resetPositions` reinicia `elapsed = 0`, de modo que tras perder una vida vuelven a salir escalonados.

### 2.5 Sin cambios

Movimiento fraccionario, túnel, colisiones/vidas, puntaje, consumo de dots y condiciones de victoria/derrota.

## 3. `src/js/render.js` — colores

`GHOST_COLORS` pasa de array indexado por posición a mapa por `kind`:

| `kind` | Color |
|---|---|
| `hunter` | `#ff0000` |
| `ambusher` | `#ffb8ff` |
| `random` | `#00ffff` |
| `scavenger` | `#ffb852` |

`draw` selecciona el color con `GHOST_COLORS[g.kind]` en vez del índice del array.

## 4. `src/js/main.js` — delta time

- `loop(ts)` calcula `dt` entre timestamps de `requestAnimationFrame`.
- `dt` se limita a 100 ms para evitar saltos al volver de otra pestaña.
- Se llama `update(game, dt)`.

## 5. `AGENTS.md` — documentación

Actualizar:

- "two ghost starts" → 4 fantasmas.
- Tabla de IA por tipo.
- Firma `update(game, dt)`.
- Salida escalonada cada 1 s y reinicio del temporizador al perder una vida.

## 6. Criterios de aceptación

1. Se ven 4 fantasmas de colores distintos, posicionados dentro de la pen al iniciar.
2. Salen de la pen uno cada segundo (el primero de inmediato, el último a los 3 s).
3. El rojo persigue a Pacman de forma directa.
4. El rosa se adelanta a la ruta de Pacman (4 celdas por delante).
5. El cian se mueve al azar en cada cruce.
6. El naranja se dirige a los dots restantes.
7. Ningún fantasma atraviesa paredes y todos usan el túnel correctamente.
8. Al colisionar y perder una vida, los 4 vuelven a la pen y repiten la salida escalonada.
9. Al perder la última vida o comer el último dot, las pantallas `PERDISTE` / `GANASTE` funcionan igual que antes.

## 7. Fuera de alcance

- Power pellets / modo asustado.
- Velocidades distintas por fantasma.
- Nombres o etiquetas en el HUD.
- Cambios de dificultad por nivel.
