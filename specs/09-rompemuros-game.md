# SPEC 09 — ROMPEMUROS: tercer juego (rompebloques en canvas)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Fecha:** 2026-11-24
> **Objetivo:** Hacer jugable ROMPEMUROS (`/games/rompemuros/play`) portando a TypeScript el rompebloques de `references/started-games/04-arkanoid/`, con estética neón, sus dos sonidos y niveles en ciclo infinito, integrado en el catálogo, el leaderboard y el Salón de la Fama.

## Por qué existe este spec

Hoy `public.games` tiene dos filas (`asteroides` y `tetromino`), y `ENGINES` (`games/registry.ts`) dos motores (`AsteroidsCanvas` y `TetrominoCanvas`).

La referencia `04-arkanoid` es un juego vanilla:

- `game.js` (~250 líneas), `levels.js` (5 patrones) y `index.html` con un canvas de 800×600, el mismo 4:3 que `.crt-screen`.
- `assets/spritesheet-breakout.png` y `assets/spritesheet.js` con los sprites de la paleta, la bola, los bloques y las explosiones.
- `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3`.
- HUD dentro del canvas, overlays blancos de pausa, GAME OVER y victoria, y un selector de nivel en la pausa.

Gracias a SPEC 06, SPEC 07 y SPEC 08, con el motor registrado y la fila en `public.games` funcionan sin más código:

- El detalle `/games/rompemuros`, con leaderboard top 10, "Mejor global", "Partidas" y "TU MEJOR MARCA".
- La tarjeta de `/library`, el chip ARCADE, la pestaña del Salón de la Fama, la previsualización y el contador de la home.
- `startGame` / `submitScore`, la copia `av_best` y el modal FIN DEL JUEGO con su flujo de guardado.

El juego tiene puntuación, vidas y nivel, así que encaja en el contrato que dejó SPEC 08 sin tocarlo. Hay que construir el motor, su componente y su registro, copiar los sonidos, la migración con la fila y la portada.

El título es original. No se usan el nombre comercial del juego en el que se inspira la referencia ni el nombre de su nave.

## Alcance

**Dentro:**

- Motor del juego en TypeScript puro, sin React, en `games/breakout/`:
  - Nave (paleta) que se mueve en horizontal por el fondo de la pantalla.
  - Bola de energía que rebota en las paredes laterales, el techo, la nave y los bloques.
  - Bola pegada a la nave al empezar, al perder una vida y al pasar de nivel; `Espacio` la lanza.
  - Rebote en la nave con ángulo según el punto de impacto.
  - Rebote en los bloques según el lado del impacto.
  - Movimiento de la bola en subpasos para que no atraviese bloques ni la nave.
  - Los 5 patrones de bloques de la referencia, en ciclo infinito, con la bola cada vez más rápida hasta un tope.
  - 3 vidas. Fin de partida al perder la última, con 1,5 s antes de `over`.
  - Destello de 150 ms al romper un bloque.
  - Sonidos de rebote y de rotura, con `M` para silenciar.
- Estética neón con `shadowBlur` y la paleta de la app (ver modelo de datos).
- Pantalla de inicio en el canvas: "ROMPEMUROS" y "PULSA ESPACIO PARA EMPEZAR".
- Controles de teclado: `←` `→` mover la nave, `Espacio` lanzar la bola, `M` silenciar, `P` / `Escape` pausar y reanudar.
- Sonidos copiados a `public/games/rompemuros/`.
- Componente cliente `components/breakout-canvas.tsx` registrado en `games/registry.ts`.
- Migración `supabase/migrations/<timestamp>_add_rompemuros_game.sql` con la fila de `public.games`.
- Portada `public/covers/rompemuros.webp`, 800×600.

**Fuera de alcance (para futuros specs):**

- Control con ratón.
- Selector de nivel en la pausa.
- Pantalla de victoria: el juego no termina al limpiar el nivel 5.
- Power-ups, bloques resistentes o indestructibles y enemigos.
- Animación o rótulo de transición entre niveles.
- Música de fondo, control de volumen y persistir el silencio entre visitas.
- El spritesheet de la referencia.
- Controles táctiles y versión móvil jugable.
- Gamepad.
- Tests automatizados.

## Modelo de datos

### API del motor

`games/breakout/engine.ts`:

```ts
import type { EnginePhase, EngineStats } from "@/games/types";

export type BreakoutCallbacks = {
  onStats(stats: EngineStats): void; // { score, lives, level }, solo cuando algún valor cambia
  onPhase(phase: EnginePhase): void; // en cada cambio de fase
};

export type BreakoutGame = {
  pause(): void; // playing | dead → paused; en otra fase no hace nada
  resume(): void; // paused → la fase anterior
  end(): void; // cualquier fase → over; idempotente
  reset(): void; // → ready, con BREAKOUT_INITIAL_STATS
  destroy(): void; // cancela el rAF, quita todos los listeners y para los sonidos
};

export function createBreakoutGame(
  canvas: HTMLCanvasElement,
  callbacks: BreakoutCallbacks,
): BreakoutGame;
```

Fases:

- `ready`: pantalla de inicio. Muro del nivel 1, nave centrada y bola pegada a ella. Nada se mueve.
- `playing`: partida en curso, con la bola pegada a la nave o en vuelo. Perder una vida sin ser la última no cambia de fase.
- `dead`: los 1,5 s tras perder la última vida. La bola no se dibuja y la nave no se mueve.
- `paused`: congelado, desde `playing` o `dead`.
- `over`: partida terminada. `onPhase("over")` se emite una sola vez por partida.

Organización de `games/breakout/`:

- `constants.ts`: tamaño del mundo, de la nave, de la bola y de los bloques, velocidades, tiempos, puntos, colores, rutas de los sonidos y `BREAKOUT_INITIAL_STATS`.
- `levels.ts`: funciones puras sin canvas.
  - Tipos: `BlockColor` (`"cyan" | "magenta" | "yellow" | "green" | "gray"`) y `Block` (`{ x, y, w, h, color, alive }`).
  - `buildLevel(level: number): Block[]`: el patrón `(level − 1) % 5` en coordenadas del mundo.
  - `levelSpeed(level: number): number`: el multiplicador de velocidad.
- `engine.ts`: estado, input, sonido, bucle `requestAnimationFrame`, física, colisiones, fases y dibujo.

No hay `entities.ts`: la nave, la bola y los bloques son objetos planos que actualiza el motor.

### Reglas que se mantienen de la referencia

- Mundo lógico de 800×600. `dt` limitado a 50 ms.
- Nave de 81×14 px con `y = 560`. Empieza centrada en `x = (800 − 81) / 2`.
- La nave se mueve a 400 px/s con `←` `→` y nunca sale del mundo (`0 ≤ x ≤ 719`).
- Bola de 16×16 px (caja de colisión cuadrada).
- Velocidad de lanzamiento `(vx, vy) = (200, −300) × levelSpeed(nivel)` px/s. Su módulo base es ~360,6 px/s.
- Rebote en la pared izquierda, la derecha y el techo: la bola se recoloca dentro del mundo y se invierte la componente correspondiente.
- Rebote en la nave si `vy > 0`, hay solapamiento horizontal y el borde inferior de la bola está entre `560` y `560 + 14 + 8`. La bola se recoloca en `y = 560 − 16`.
- Muro de 10 columnas × 6 filas de bloques de 64×24 px. La esquina del muro está en (80, 80).
- Como máximo un bloque roto por paso de colisión.
- La bola se pierde cuando su borde superior pasa de `y = 600`.
- 3 vidas. Al perder una con vidas restantes, la bola vuelve a la nave.
- Al no quedar bloques vivos, se carga el nivel siguiente. La puntuación se acumula entre niveles.
- Explosión de un bloque de 150 ms.
- Sonido `ball-bounce.mp3` al rebotar en las paredes, el techo y la nave. Sonido `break-sound.mp3` al romper un bloque. Cada sonido se reproduce sobre un clon del `Audio` para que se puedan solapar.
- Los 5 patrones (columna `c` de 0 a 9, fila `r` de 0 a 5):

| Patrón | Celdas ocupadas                                                                             | Bloques |
| ------ | ------------------------------------------------------------------------------------------- | ------- |
| 1      | Todas                                                                                       | 60      |
| 2      | Pirámide: la fila `r` va de la columna `[4, 3, 2, 1, 0, 0][r]` a la `[5, 6, 7, 8, 9, 9][r]` | 40      |
| 3      | Ajedrez: `(c + r) % 2 === 0`                                                                | 30      |
| 4      | Todas salvo los huecos `[[2,5,8], [0,4,7,9], [1,3,6], [2,5,8,9], [0,4,7], [1,3,6,9]][r]`    | 39      |
| 5      | Marco (`c` 0 o 9, `r` 0 o 5) más cruz (`c === 4` o `r === 2`)                               | 39      |

### Reglas nuevas

- **Bola pegada.** En `ready`, al empezar, al perder una vida y al cargar un nivel nuevo, la bola queda centrada sobre la nave (`x = nave.x + (81 − 16) / 2`, `y = 560 − 16`) y la sigue al moverse. `Espacio` sin `repeat` la lanza con la velocidad de lanzamiento del nivel. La pulsación de `Espacio` que empieza la partida no la lanza.
- **Ángulo en la nave.**
  1. `offset = (centro de la bola − centro de la nave) / (81 / 2)`, limitado a `[−1, 1]`.
  2. `ángulo = offset × 60°`, medido desde la vertical.
  3. `vx = v · sin(ángulo)` y `vy = −v · cos(ángulo)`, con `v = 360,6 × levelSpeed(nivel)`.
  4. En el centro la bola sale vertical. En los extremos sale a 60°.
- **Rebote en bloques.** Al chocar con un bloque se calculan los solapamientos horizontal y vertical entre la bola y el bloque. Si el horizontal es menor, se invierte `vx` y la bola se saca del bloque en x. Si no, se invierte `vy` y se saca en y.
- **Subpasos.** Cada frame divide el movimiento de la bola en `ceil(|v| · dt / 8)` subpasos. En cada subpaso la bola avanza como mucho 8 px y se comprueban paredes, nave, bloques y pérdida, en ese orden.
- **Ciclo infinito.** El nivel `n` usa el patrón `(n − 1) % 5 + 1`. El nivel 6 vuelve al patrón 1, el 7 al 2, y así sin fin.
- **Velocidad.** `levelSpeed(n) = min(2, 1,1^(n − 1))`:

| Nivel | 1    | 2    | 3    | 4    | 5    | 6    | 7    | 8    | 9+   |
| ----- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| ×     | 1,00 | 1,10 | 1,21 | 1,33 | 1,46 | 1,61 | 1,77 | 1,95 | 2,00 |

- **Puntos.** Cada bloque suma `10 × nivel`: 10 en el nivel 1, 20 en el 2, 60 en el 6. La puntuación se satura en 9.999.999.
- **Cambio de nivel.** Al romper el último bloque, en el mismo frame se carga el nivel siguiente, el nivel sube en el HUD y la bola queda pegada a la nave, que no se mueve de sitio. Las explosiones pendientes se descartan.
- **Fin de partida.**
  1. Al perder la última bola, las vidas pasan a 0 y la fase a `dead`.
  2. Tras 1,5 s, la fase pasa a `over`.
  3. `end()` durante esos 1,5 s pasa directo a `over` sin emitirlo dos veces.
- **Explosión neón.** En lugar de los frames del spritesheet, el bloque roto se dibuja 150 ms con relleno completo de su color, crece 4 px por lado y su opacidad baja de 1 a 0.
- **Silencio.** `M` sin `repeat` alterna el silencio en cualquier fase salvo `over`. Empieza con sonido. El estado se conserva tras `reset()` dentro de la misma página, pero no entre visitas.
- **Sonido seguro.** Si `play()` rechaza su promesa (autoplay bloqueado o archivo que no carga), el error se ignora y el juego sigue. En `ready`, `paused`, `dead` y `over` no suena nada.
- **Sin rebote en la parte inferior:** no hay suelo. Es la regla de la referencia y se mantiene.

### Stats y HUD

| HUD        | Valor del motor                   |
| ---------- | --------------------------------- |
| Puntuación | `score`                           |
| Vidas      | `lives`, de 3 a 0 (`♥`)           |
| Líneas     | no se muestra (`lines` no existe) |
| Nivel      | `level`, con dos dígitos (`01`)   |

`BREAKOUT_INITIAL_STATS = { score: 0, lives: 3, level: 1 }`.

No hace falta tocar `games/types.ts` ni `components/game-player.tsx`: el contrato de SPEC 08 ya cubre estos stats.

### Paleta del canvas

Todos los trazos usan `shadowBlur` con su propio color, aplicado por grupo de color, no por bloque. Fondo negro; las scanlines y la viñeta las pone `.crt-screen`.

| Elemento            | Color                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Nave                | `#00f5ff` (cian): relleno al 25 % y borde de 2 px, esquinas de 4 px      |
| Bola                | `#f5ff00` (amarillo): círculo de 8 px de radio, relleno completo         |
| Bloque              | Relleno de su color al 25 % y borde de 2 px, con 2 px de margen interior |
| Explosión de bloque | Relleno completo de su color, opacidad de 1 a 0 en 150 ms                |
| Textos de inicio    | Cian el título, tinta tenue (`#8a8fb5`) el subtítulo                     |

Colores de los bloques (`BlockColor` → hex): `cyan` `#00f5ff`, `magenta` `#ff006e`, `yellow` `#f5ff00`, `green` `#00ff88`, `gray` `#8a8fb5`.

Colores por patrón, que sustituyen al rojo, rosa y blanco de la referencia:

| Patrón | Color de cada fila (0 → 5) o regla            |
| ------ | --------------------------------------------- |
| 1      | magenta, yellow, cyan, green, magenta, yellow |
| 2      | gray, cyan, magenta, yellow, cyan, green      |
| 3      | filas 0–2 yellow, filas 3–5 magenta           |
| 4      | cyan, magenta, green, yellow, cyan, magenta   |
| 5      | marco cyan, cruz magenta                      |

Los textos del canvas usan la `font-family` computada del canvas (la mono de la app). En la pantalla de inicio el título es de 44 px y el subtítulo de 16 px, centrados en `x = 400`, en `y = 330` y `y = 380`, debajo del muro del nivel 1.

### Sonidos

- `references/started-games/04-arkanoid/assets/sounds/ball-bounce.mp3` → `public/games/rompemuros/ball-bounce.mp3`.
- `references/started-games/04-arkanoid/assets/sounds/break-sound.mp3` → `public/games/rompemuros/break-sound.mp3`.
- En `constants.ts`: `SOUND_BOUNCE = "/games/rompemuros/ball-bounce.mp3"` y `SOUND_BREAK = "/games/rompemuros/break-sound.mp3"`.
- El motor crea los dos `Audio` en `createBreakoutGame`, que solo se llama en el cliente (dentro del `useEffect` del componente).

### Fila en `public.games`

```sql
insert into public.games
  (id, title, short_description, long_description, category, color, cover_image, playable, sort_order)
values (
  'rompemuros',
  'ROMPEMUROS',
  'Rebota la bola de energía y derriba muros de ladrillos neón.',
  'Controlas una nave en el fondo de la pantalla. Haz rebotar la bola de energía para destruir cada muro de ladrillos sin dejarla caer. Cada muro superado acelera la bola y hace que cada ladrillo valga más puntos.',
  'ARCADE',
  'cyan',
  'rompemuros.webp',
  true,
  3
);
```

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Este spec no toca `components/game-player.tsx` ni otra UI de React, así que no hace falta `/frontend-design`.

1. Crear `games/breakout/constants.ts` y `games/breakout/levels.ts` con `buildLevel` y `levelSpeed`, los 5 patrones y sus colores. Todavía no se usan.
2. Crear `games/breakout/engine.ts` con `createBreakoutGame`:
   - Bucle `requestAnimationFrame` con `dt` limitado a 50 ms.
   - Buffer `800·dpr × 600·dpr` con `ctx.scale(dpr, dpr)`.
   - Fases `ready` / `playing` / `over`, nave, bola pegada y lanzamiento.
   - Dibujo del muro, la nave, la bola y la pantalla de inicio.
   - `onStats` solo cuando cambia `score`, `lives` o `level`.
3. Física de la bola:
   - Subpasos de 8 px como máximo.
   - Rebotes en paredes y techo, en la nave con ángulo y en los bloques según el lado.
   - Rotura de bloques, puntos `10 × nivel` con saturación y destello de 150 ms.
   - Cambio de nivel en ciclo infinito con `levelSpeed`.
   - Pérdida de la bola y de vidas.
4. Input del motor:
   - Listeners `keydown` / `keyup` en `window`, que `destroy()` elimina.
   - Se ignoran los eventos cuyo `target` es un `input`, `textarea` o `select`.
   - Fuera de `over`, `preventDefault()` en `keydown` y `keyup` de `ArrowLeft`, `ArrowRight` y `Space`.
   - En `ready`, `Espacio` sin `repeat` empieza la partida y no lanza la bola.
   - En `playing`, `Espacio` sin `repeat` lanza la bola si está pegada.
   - `P` / `Escape` sin `repeat` alternan `pause()` / `resume()`.
   - `visibilitychange` a oculto llama a `pause()`.
5. Añadir la fase `dead` con los 1,5 s, la fase `paused` y los métodos `pause`, `resume`, `end`, `reset` y `destroy`.
6. Sonido:
   - Copiar los dos mp3 a `public/games/rompemuros/`.
   - Reproducir `SOUND_BOUNCE` y `SOUND_BREAK` en los eventos del modelo de datos, sobre clones y con la promesa de `play()` capturada.
   - `M` alterna el silencio.
   - `destroy()` pausa los clones que sigan sonando.
7. Crear `components/breakout-canvas.tsx` con el patrón de `components/tetromino-canvas.tsx` (`aria-label="ROMPEMUROS"`). Añadir `rompemuros: { Canvas: BreakoutCanvas, initialStats: BREAKOUT_INITIAL_STATS }` a `ENGINES` en `games/registry.ts`.
8. Crear `supabase/migrations/<timestamp>_add_rompemuros_game.sql` con el `insert` del modelo de datos:
   - Aplicarla con el MCP `apply_migration` (mismo nombre, `add_rompemuros_game`).
   - Ejecutar `get_advisors` (security).
   - No hace falta regenerar `lib/supabase/database.types.ts`: el esquema no cambia.
9. Capturar `public/covers/rompemuros.webp` con Playwright en `/games/rompemuros/play`:
   - Con `npm run dev` en marcha, empezar una partida, lanzar la bola y jugar unos segundos hasta tener varios bloques rotos y la bola en vuelo.
   - Ejecutar `canvas.toDataURL("image/webp", 0.9)` sobre el canvas, decodificar el resultado y guardarlo. Si el buffer no es 800×600 por el `dpr`, redibujarlo antes en un canvas auxiliar de 800×600.
   - Comprobar que la imagen mide 800×600. Las capturas auxiliares van en `.playwright-screenshots/`.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/library`, `/games/rompemuros`, `/games/rompemuros/play` y `/hall-of-fame`.
- [x] `list_migrations` muestra la migración `add_rompemuros_game` y `supabase/migrations/` la contiene.
- [x] `public.games` tiene la fila `rompemuros` con `playable = true`, `cover_image = 'rompemuros.webp'`, `category = 'ARCADE'`, `color = 'cyan'` y `sort_order = 3`, y RLS sigue activado.
- [x] `/games/rompemuros/play` muestra en el canvas "ROMPEMUROS" y "PULSA ESPACIO PARA EMPEZAR" debajo del muro de 60 bloques, con la bola sobre la nave. Nada se mueve hasta pulsar `Espacio`.
- [x] La primera pulsación de `Espacio` empieza la partida y la bola sigue pegada a la nave. `←` `→` mueven la nave con la bola encima. La segunda pulsación la lanza hacia arriba y a la derecha.
- [x] La nave nunca sale del canvas por la izquierda ni por la derecha.
- [x] La bola rebota en las paredes laterales, el techo y la nave, y se oye `ball-bounce.mp3` en cada rebote.
- [x] Una bola que cae sobre el centro de la nave sale casi vertical. Una que cae sobre un extremo sale con un ángulo de unos 60°.
- [x] Una bola que golpea el lateral de un bloque invierte su dirección horizontal y sigue subiendo o bajando.
- [x] Romper un bloque en el nivel 1 lo hace destellar, suena `break-sound.mp3` y el HUD suma 10.
- [x] Al romper los 60 bloques del nivel 1, el HUD pasa a nivel `02`, aparece la pirámide de 40 bloques y la bola vuelve a la nave. Cada bloque del nivel 2 suma 20.
- [x] Al limpiar el nivel 5, el nivel 6 muestra otra vez el muro completo de 60 bloques y cada bloque suma 60.
- [x] `levelSpeed` devuelve 1, 1,1, 1,21, 1,331, 1,4641 para los niveles 1–5 y 2 para el 9 y el 20.
- [x] Con la velocidad en ×2, la bola nunca atraviesa un bloque ni la nave.
- [x] Dejar caer la bola con 3 vidas deja el HUD en 2 ♥ y la bola pegada a la nave, sin cambiar de nivel ni de muro.
- [x] `M` silencia los dos sonidos y otra pulsación los vuelve a activar. El silencio se mantiene tras JUGAR DE NUEVO.
- [x] Si se borran los mp3 de `public/games/rompemuros/`, el juego sigue funcionando sin sonido y sin errores no capturados en la consola.
- [x] Pulsar las teclas del juego no hace scroll ni activa botones con foco.
- [x] El HUD de ROMPEMUROS muestra Jugador, Puntuación, Vidas (3 ♥ al empezar) y Nivel, y no muestra Líneas.
- [x] PAUSA, `P` y `Escape` congelan el canvas y muestran "EN PAUSA". REANUDAR y `P` continúan desde el mismo estado, con la bola a la misma velocidad. Cambiar de pestaña deja el juego en pausa.
- [x] Perder la última vida deja ver el muro 1,5 s sin bola y luego abre el modal FIN DEL JUEGO con la misma puntuación que el HUD.
- [x] FIN abre el modal con la puntuación actual. FIN durante los 1,5 s finales abre el modal una sola vez.
- [x] Con sesión, empezar una partida suma 1 a `games_played` de `rompemuros` en `player_stats`. Lanzar la bola, perder una vida, pausar o reanudar no suma. FIN en la pantalla de inicio no suma ni guarda.
- [x] Con sesión, un récord nuevo muestra "▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_" y actualiza `max_score`. El récord aparece en el leaderboard de `/games/rompemuros` y en la pestaña ROMPEMUROS de `/hall-of-fame`.
- [x] Una puntuación menor o igual que `av_best` muestra "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD" sin llamar a `submitScore`.
- [x] Sin sesión, jugar no crea ni modifica filas en `player_stats`.
- [x] JUGAR DE NUEVO vuelve a la pantalla de inicio con el muro del nivel 1 completo y el HUD en puntuación 0, 3 ♥ y nivel `01`.
- [x] Salir y volver a entrar no deja dos bucles activos: la nave se mueve a la misma velocidad y cada rebote suena una sola vez.
- [x] `/library` muestra la tarjeta ROMPEMUROS con su portada y el chip ARCADE. La home la incluye, y el contador de juegos pasa a "3+ JUEGOS".
- [x] `/games/rompemuros` muestra la portada, la descripción de la BD, "SIN PUNTUACIONES TODAVÍA" antes del primer récord, "Mejor global" `—` y "Partidas" `0`.
- [x] `public/covers/rompemuros.webp` existe, mide 800×600 y muestra una partida en curso sin HUD.
- [x] ASTEROIDES y TETROMINO siguen jugables, y sus HUD, guardado y ranking funcionan igual.
- [x] `components/game-player.tsx` y `games/types.ts` no cambian en este spec.

## Decisiones

- **Sí:** título ROMPEMUROS e id `rompemuros`, ARCADE y cian. **No:** el nombre comercial del juego de la referencia ni el de su nave, que son marcas registradas. Cian es el único color libre junto a magenta.
- **Sí:** carpeta `games/breakout/`, `createBreakoutGame` y `BreakoutCanvas`, en inglés como `games/asteroids/` para `asteroides`. Los assets públicos van por id, en `public/games/rompemuros/`.
- **Sí:** el contrato y el HUD de SPEC 08 sin cambios. **No:** extenderlo: el juego tiene puntuación, vidas y nivel.
- **Sí:** bola pegada a la nave y lanzada con `Espacio`. **No:** salida automática como en la referencia, que no da tiempo a colocarse tras perder una vida o cambiar de nivel.
- **Sí:** perder una vida que no es la última no cambia de fase: la bola vuelve a la nave en `playing`. **No:** una fase `dead` en cada vida, como en Asteroides, porque la bola pegada ya hace de pausa. `dead` solo se usa para los 1,5 s finales.
- **Sí:** solo teclado. **No:** ratón, aunque la referencia lo permite. Queda fuera para mantener el criterio de los otros juegos y no mapear coordenadas con el escalado CSS.
- **Sí:** ángulo según el punto de impacto en la nave, hasta 60°. **No:** el rebote de la referencia, que solo invierte `vy`: el ángulo nunca cambia y el jugador no puede apuntar. Con `|vy| ≥ v · cos 60°` tras cada rebote en la nave, la bola nunca queda en horizontal.
- **Sí:** rebote en bloques según el lado del impacto. **No:** invertir siempre `vy`, que da rebotes falsos al golpear un lateral.
- **Sí:** subpasos de 8 px. **No:** confiar en el paso del frame: a ×2 y con `dt` de 50 ms la bola avanza ~36 px, más que el alto de un bloque (24 px).
- **Sí:** ciclo infinito de los 5 patrones, con la velocidad tope en ×2. **No:** pantalla de victoria tras el nivel 5: la partida solo acaba al perder las vidas, que es lo que necesita un ranking.
- **Sí:** `10 × nivel` por bloque. **No:** 10 fijos, que dan muchos empates. **No:** bonus por nivel limpiado, que no se pidió.
- **Sí:** vectores neón con la paleta de la app. **No:** el spritesheet de la referencia ni sus colores rojo, rosa y blanco.
- **Sí:** los dos sonidos de la referencia en `public/games/rompemuros/`, con `M` para silenciar. **No:** control de volumen, música ni persistir el silencio, que son de otro spec.
- **Sí:** `HTMLAudioElement` con clones, como la referencia. **No:** Web Audio API, que es más de lo que necesitan dos efectos cortos.
- **No:** selector de nivel en la pausa. Permitiría empezar en niveles que puntúan más y falsear el ranking.
- **Sí:** catálogo, puntuaciones y leaderboard de SPEC 06 y SPEC 07 sin cambios de esquema. **No:** tablas propias del juego.
- **Sí:** el HUD lo pinta React con datos del motor. **No:** el HUD dentro del canvas de la referencia.
- **No:** reiniciar desde el canvas en game over. El modal de la app gestiona el final.

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| El modo estricto monta el efecto dos veces y deja dos bucles                     | `destroy()` cancela el rAF, quita los listeners y para los sonidos. Un criterio lo verifica.                                        |
| `Espacio` activa PAUSA o FIN si tienen el foco                                   | `preventDefault()` en `keydown` / `keyup` de las teclas del juego fuera de `over`.                                                  |
| Los listeners capturan el teclado tras el final                                  | Se ignoran `input` / `textarea` / `select`, y en `over` no hay `preventDefault()` ni se procesa `M`.                                |
| Mantener `Espacio` al empezar lanza la bola sin querer                           | `Espacio` ignora `e.repeat`, y la pulsación que empieza la partida no la lanza.                                                     |
| La bola atraviesa bloques o la nave a velocidad alta                             | Subpasos de 8 px como máximo. Un criterio lo verifica a ×2.                                                                         |
| La bola queda atrapada en bucle horizontal                                       | Tras rebotar en la nave, la componente vertical es al menos `v · cos 60°`, y paredes y bloques solo cambian signos.                 |
| La bola se queda dentro de un bloque y rompe varios seguidos                     | Se saca del bloque en el eje del rebote y se rompe como mucho uno por subpaso.                                                      |
| El navegador bloquea el audio o el mp3 no carga                                  | La promesa de `play()` se captura y se ignora. El juego sigue sin sonido. `Espacio` es un gesto de usuario antes del primer sonido. |
| Licencia de los sonidos de la referencia desconocida                             | Se usan porque el usuario lo decidió. Si no se pueden distribuir, se borran los mp3 y el juego sigue sin sonido.                    |
| `shadowBlur` por bloque baja los fps                                             | Glow por grupo de color: un `shadowBlur` por color y frame, no por bloque.                                                          |
| La fuente mono no ha cargado al pintar la pantalla de inicio                     | La pantalla de inicio se redibuja cada frame.                                                                                       |
| `onPhase("over")` doble abre dos veces el modal o duplica el guardado            | `end()` idempotente y el `ref` de `game-player.tsx`. Además, `submit_score` es idempotente.                                         |
| La puntuación supera 9.999.999 y `submit_score` la rechaza                       | El motor la satura en 9.999.999.                                                                                                    |
| `initialStats` del registro no coincide con lo que emite el motor tras `reset()` | Las dos cosas usan `BREAKOUT_INITIAL_STATS`.                                                                                        |
| La migración se aplica antes que el motor                                        | El juego se ve PRÓXIMAMENTE hasta registrar el motor. No rompe nada.                                                                |

## Lo que **no** está en este spec

- Ratón, táctil, gamepad y versión móvil.
- Selector de nivel y pantalla de victoria.
- Power-ups, bloques resistentes y enemigos.
- Transición entre niveles.
- Música, volumen y silencio persistente.
- El spritesheet de la referencia.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
