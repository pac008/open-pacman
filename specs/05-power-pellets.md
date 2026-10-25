# SPEC 05 — Power pellets

> **Estado:** aprobado
> **Depende de:** SPEC 04
> **Fecha:** 2026-10-25
> **Objetivo:** Añadir cuatro power pellets que atemoricen a los fantasmas durante 7 segundos y permitan comerlos con puntaje en cadena.

## Por qué existe esta spec

Los power pellets introducen el primer estado temporal que modifica la IA de los cuatro fantasmas. También tocan puntaje, colisiones, reaparición y render, así que conviene fijar las reglas antes de implementar.

## Alcance

**Incluido:**

- Cuatro power pellets en las posiciones clásicas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, reemplazando el dot existente.
- Tile nuevo `4` en `src/js/maze.js` para representar el power pellet.
- `+50` puntos al comerlo y descuento en `dotsRemaining`.
- Estado de susto global de `7000 ms` al comer un power pellet.
- Fantasmas atemorizados: azules, movimiento aleatorio y comestibles.
- Parpadeo blanco durante los últimos `2000 ms` del susto.
- Cadena de puntos `200/400/800/1600` por fantasmas comidos en el mismo susto.
- Fantasma comido: vuelve a su celda inicial de la pen y sale tras `1000 ms`; si el susto sigue activo, sale atemorizado.
- Cancelación del susto, reinicio de la cadena y restauración de la salida escalonada al perder una vida.
- Actualización de `AGENTS.md`.

**Fuera de alcance (para futuras specs):**

- Sonidos.
- Contador de susto en el HUD.
- Niveles, dificultad progresiva o frutas.
- Persistencia.
- Animación de ojos volviendo a la pen.
- Power pellets parpadeantes.
- Velocidades distintas por fantasma.

## Modelo de datos

```js
// maze.js
// '#' pared (1) · '.' dot (2) · ' ' vacío (0) · '-' puerta (3) · 'o' power pellet (4)

// game.js
const POWER_PELLET_SCORE = 50;
const FRIGHTENED_DURATION = 7000; // ms
const FRIGHTENED_BLINK = 2000;    // ms finales de parpadeo
const GHOST_CHAIN_SCORES = [ 200, 400, 800, 1600 ];
const GHOST_EAT_RESPAWN_DELAY = 1000; // ms

// Estado de la partida
{
  frightenedUntil: 0, // ms absolutos de game.elapsed; 0 = inactivo
  ghostChain: 0,      // fantasmas comidos en el susto actual
}
```

El objeto de cada fantasma conserva `startX`, `startY`, `inPen` y `releaseAt`. Al ser comido, `releaseAt` pasa a `game.elapsed + GHOST_EAT_RESPAWN_DELAY`. `resetPositions` debe restaurarlo a `i * GHOST_RELEASE_DELAY`.

No hay flag de susto por fantasma: el temporizador global aplica a todos. Un fantasma que reaparece durante el susto sale atemorizado.

## Plan de implementación

1. **`src/js/maze.js`** — añadir `'o'` al parser como tile `4`; reemplazar los dots de `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`; actualizar el comentario de cabecera.  
   Prueba manual: la página carga sin errores y `MAZE` contiene cuatro celdas con valor `4`.

2. **`src/js/game.js`** — añadir constantes y estado; contar tiles `4` en `dotsRemaining`; al comer un power pellet sumar `+50`, poner `frightenedUntil = game.elapsed + FRIGHTENED_DURATION` y reiniciar `ghostChain`.  
   Prueba manual: comer un pellet suma exactamente 50 y desaparece del tablero.

3. **`src/js/game.js`** — añadir `isFrightened(game)` y el comportamiento atemorizado en `decideGhost`: dirección aleatoria entre las válidas; si el fantasma sigue en la pen, usar `PEN_EXIT_MAP` para que salga.  
   Prueba manual: tras comer un pellet, los cuatro fantasmas se mueven sin perseguir y no atraviesan paredes.

4. **`src/js/game.js`** — cambiar la colisión: si el fantasma está atemorizado, sumar la cadena `200/400/800/1600`, devolverlo a `(startX, startY)`, marcar `inPen = true` y fijar `releaseAt = game.elapsed + 1000`. No se pierde vida.  
   Prueba manual: comer dos fantasmas en el mismo susto suma 200 y luego 400.

5. **`src/js/game.js`** — expirar el susto y reiniciar la cadena; en `resetPositions` poner `frightenedUntil = 0`, `ghostChain = 0` y restaurar el `releaseAt` original de cada fantasma.  
   Prueba manual: al perder una vida, los pellets comidos siguen comidos, el susto termina y los fantasmas vuelven a salir escalonados.

6. **`src/js/render.js`** — dibujar el tile `4` como pellet grande (radio ~6); si el susto está activo, pintar el fantasma de azul `#2121ff`; en los últimos 2 segundos alternar con blanco cada 250 ms.  
   Prueba manual: los fantasmas se ven azules y parpadean al final del susto.

7. **`AGENTS.md`** — documentar el tile `4`, el estado de susto, la cadena de puntos, la reaparición y el reset al perder una vida.

8. **Verificación manual** — recorrer los criterios de aceptación en el navegador.

## Criterios de aceptación

- [ ] El laberinto muestra cuatro pellets grandes en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Comer un power pellet suma exactamente 50 puntos y lo elimina del tablero.
- [ ] Los power pellets cuentan en `dotsRemaining`; comer el último dispara `GANASTE`.
- [ ] Al comer un pellet, todos los fantasmas no comidos se vuelven azules durante 7 segundos.
- [ ] Durante los últimos 2 segundos del susto, los fantasmas parpadean en blanco.
- [ ] Durante el susto, los fantasmas eligen dirección al azar y no usan su IA normal.
- [ ] Los fantasmas atemorizados no atraviesan paredes y usan el túnel correctamente.
- [ ] Un fantasma que aún está en la pen sale atemorizado si el susto sigue activo.
- [ ] Comer fantasmas en el mismo susto suma 200, 400, 800 y 1600 en ese orden.
- [ ] Comer otro power pellet con el susto activo reinicia el temporizador a 7 segundos y la cadena a 200.
- [ ] Un fantasma comido vuelve a su celda inicial y sale tras 1 segundo.
- [ ] Si el susto sigue activo cuando reaparece, el fantasma sale atemorizado.
- [ ] Tocar un fantasma atemorizado nunca cuesta una vida.
- [ ] Tocar un fantasma normal cuesta una vida como antes.
- [ ] Al perder una vida, los power pellets comidos no reaparecen, el susto se cancela y la cadena vuelve a cero.
- [ ] Al perder una vida, los cuatro fantasmas repiten la salida escalonada de 0/1/2/3 segundos.
- [ ] `PERDISTE` y `GANASTE` siguen funcionando.
- [ ] No aparecen errores en la consola del navegador.

## Decisiones tomadas y descartadas

- **Sí:** cuatro posiciones clásicas. Son simétricas y reutilizan dots existentes.
- **Sí:** tile `4` separado del dot `2`. Permite render y lógica distintas sin ambigüedad.
- **Sí:** temporizador global de susto. Evita flags por fantasma y simplifica el reset.
- **Sí:** el fantasma que reaparece durante el susto sale atemorizado. Decisión confirmada por el usuario.
- **Sí:** cadena `200/400/800/1600` que se reinicia con otro pellet o al expirar el susto.
- **Sí:** el fantasma comido se teletransporta a la pen y espera 1 segundo. No se implementa animación de ojos.
- **Sí:** parpadeo calculado con el tiempo restante, alternando cada 250 ms.
- **No:** reintroducir power pellets al perder una vida. Los dots comidos se mantienen.
- **No:** sonidos, HUD de susto, niveles, frutas o velocidades distintas.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Fantasmas atemorizados atrapados en la pen | Usar `PEN_EXIT_MAP` para todos los fantasmas atemorizados que estén dentro. |
| `releaseAt` modificado sobrevive al perder una vida | Restaurar `i * GHOST_RELEASE_DELAY` en `resetPositions`. |
| El temporizador absoluto queda desfasado al reiniciar `elapsed` | Poner `frightenedUntil = 0` en `resetPositions`. |
| Cadena de puntos mal reiniciada | Reiniciar `ghostChain` al comer pellet, al expirar el susto y al perder una vida. |
| Varios fantasmas tocando a Pacman en el mismo frame | Procesar en orden de `game.ghosts`; una colisión atemorizada no cuesta vida. |

## Lo que **no** entra en esta spec

- Sonidos.
- Contador de susto en el HUD.
- Niveles, dificultad progresiva o frutas.
- Persistencia.
- Animación de ojos volviendo a la pen.
- Power pellets parpadeantes.
- Velocidades distintas por fantasma.

Cada uno, si llega, va en su propia spec.
