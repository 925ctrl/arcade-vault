# SPEC 08 — TETROMINO: segundo juego (piezas que caen en canvas)

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-24
> **Objetivo:** Hacer jugable TETROMINO (`/games/tetromino/play`) portando a TypeScript el juego de piezas que caen de `references/started-games/03-tetris/`, con estética neón, el HUD extendido con Líneas y sin Vidas, e integrado en el catálogo, el leaderboard y el Salón de la Fama.

## Por qué existe este spec

Hoy `public.games` tiene una sola fila (`asteroides`), y `ENGINES` (`games/registry.ts`) un solo motor (`AsteroidsCanvas`). La referencia `03-tetris` es un juego vanilla de tres archivos (`index.html`, `style.css`, `game.js`, ~300 líneas) y no tiene assets. Su tablero es de 10×20 celdas de 30 px (300×600). La vista de la siguiente pieza y los marcadores van en un panel HTML aparte. Trae 7 tetrominós y una 8.ª pieza, la "tuerca" (anillo de 3×3 con 8 bloques), que no se porta.

Gracias a SPEC 06 y SPEC 07, con el motor registrado y la fila en `public.games` funcionan sin más código:

- El detalle `/games/tetromino`, con leaderboard top 10, "Mejor global", "Partidas" y "TU MEJOR MARCA".
- La tarjeta de `/library`, el chip PUZZLE, la pestaña del Salón de la Fama, la previsualización y el contador de la home.
- `startGame` / `submitScore`, la copia `av_best` y el modal FIN DEL JUEGO con su flujo de guardado.

Hay que construir el motor, su componente y su registro, la migración con la fila y la portada. El juego no tiene vidas y su métrica natural son las líneas, así que también hay que extender el contrato de motor y el HUD de forma genérica.

El título es original. No se usa el nombre comercial del juego en el que se inspira la referencia.

## Alcance

**Dentro:**

- Motor del juego en TypeScript puro, sin React, en `games/tetromino/`:
  - Tablero de 10×20 celdas con los 7 tetrominós (I, O, T, S, Z, J, L). Sin la "tuerca".
  - Siguiente pieza elegida al azar puro, como en la referencia.
  - Rotación horaria con wall kicks `[0, −1, 1, −2, 2]`.
  - Movimiento lateral, soft drop y hard drop.
  - Pieza fantasma.
  - Limpieza de líneas con destello de 150 ms.
  - Puntuación clásica multiplicada por el nivel.
  - Nivel que sube cada 10 líneas y acelera la caída.
  - Fin de partida al no caber la pieza nueva, con relleno del tablero durante 1,5 s.
  - Vista SIGUIENTE dentro del canvas.
- Estética neón con `shadowBlur` y la paleta de la app (ver modelo de datos).
- Pantalla de inicio en el canvas: "TETROMINO" y "PULSA ESPACIO PARA EMPEZAR".
- Controles de teclado: `←` `→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop, `P` / `Escape` pausar y reanudar.
- Componente cliente `components/tetromino-canvas.tsx` registrado en `games/registry.ts`.
- Extensión genérica del contrato de motor y del HUD:
  - `lives` pasa a ser opcional y se añade `lines` opcional a `EngineStats`.
  - El HUD oculta las celdas cuyo valor falte.
  - Cada motor declara sus stats iniciales en el registro.
- Migración `supabase/migrations/<timestamp>_add_tetromino_game.sql` con la fila de `public.games`.
- Portada `public/covers/tetromino.webp`, 800×600.

**Fuera de alcance (para futuros specs):**

- La pieza "tuerca" de la referencia.
- Bolsa de 7 u otro generador de piezas.
- Pieza guardada (hold), varias piezas de vista previa y rotación antihoraria.
- Lock delay, T-spins, combos y bonus por back-to-back.
- Auto-repetición propia (DAS/ARR): se usa la repetición de teclas del sistema.
- Tema claro de la referencia (`theme-toggle`, `tetris-theme` en `localStorage`).
- Controles táctiles y versión móvil jugable.
- Sonido y música.
- Gamepad.
- Tests automatizados.

## Modelo de datos

### API del motor

`games/tetromino/engine.ts`:

```ts
import type { EnginePhase, EngineStats } from "@/games/types";

export type TetrominoCallbacks = {
  onStats(stats: EngineStats): void; // { score, lines, level }, solo cuando algún valor cambia
  onPhase(phase: EnginePhase): void; // en cada cambio de fase
};

export type TetrominoGame = {
  pause(): void; // playing | dead → paused; en otra fase no hace nada
  resume(): void; // paused → la fase anterior
  end(): void; // cualquier fase → over; idempotente
  reset(): void; // → ready, con TETROMINO_INITIAL_STATS
  destroy(): void; // cancela el rAF y quita todos los listeners
};

export function createTetrominoGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrominoCallbacks,
): TetrominoGame;
```

Fases:

- `ready`: pantalla de inicio. Tablero vacío y nada cae.
- `playing`: partida en curso, incluido el destello de limpieza de líneas.
- `dead`: los 1,5 s de relleno del tablero tras perder.
- `paused`: congelado, desde `playing` o `dead`.
- `over`: partida terminada. `onPhase("over")` se emite una sola vez por partida.

Organización de `games/tetromino/`:

- `constants.ts`: tamaño del mundo, del tablero y de las celdas, posiciones en el canvas, tiempos, velocidades, puntos, colores y `TETROMINO_INITIAL_STATS`.
- `board.ts`: funciones puras sin canvas.
  - Tipos: `Board` (matriz `ROWS × COLS`, `0` vacía y `1–7` el tipo de pieza) y `Piece` (`{ type, shape, x, y }`).
  - `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate` (con los kicks), `merge`, `fullRows`, `removeRows` y `ghostY`.
- `engine.ts`: estado, input, bucle `requestAnimationFrame`, fases y dibujo.

No hay `entities.ts`: ninguna entidad tiene `update(dt)` propio.

### Reglas que se mantienen de la referencia

- Tablero de 10 columnas × 20 filas.
- Piezas como matrices cuadradas:
  - I: 4×4, con la segunda fila llena.
  - O: 2×2.
  - T, S, Z, J y L: 3×3, con la fila de abajo vacía.
- Una pieza nueva aparece con `y = 0` y `x = floor(10 / 2) − floor(ancho / 2)`.
- Siguiente pieza al azar entre las 7, con la misma probabilidad y sin memoria.
- `rotateCW` traspone e invierte las filas. Si la pieza rotada choca, se prueban desplazamientos horizontales de 0, −1, +1, −2 y +2 columnas, en ese orden. Si todos chocan, no rota.
- `collide` choca con las paredes laterales, el suelo y los bloques fijados. Las celdas con `y < 0` no chocan con el tablero.
- Caída automática: una fila cada `max(100, 1000 − (nivel − 1) × 90)` ms. Al nivel 1 son 1000 ms, al 2 son 900 ms, y del 11 en adelante 100 ms.
- Si la pieza no puede bajar cuando le toca caer, se fija al instante (sin lock delay).
- Al fijar: `merge`, limpieza de líneas y nueva pieza.
- Puntos por líneas limpiadas a la vez: `[0, 100, 300, 500, 800] × nivel`, con el nivel de antes de sumar las líneas.
- Soft drop: si la pieza puede bajar, baja una fila y suma 1 punto. Si no puede, se fija.
- Hard drop: la pieza baja hasta la posición de la fantasma, suma 2 puntos por fila recorrida y se fija.
- Nivel = `floor(líneas / 10) + 1`.
- Pieza fantasma en la posición de `ghostY`, que baja la pieza hasta justo antes de chocar.
- La partida termina cuando la pieza nueva choca nada más aparecer.

### Reglas nuevas

- Sin la pieza "tuerca": solo 7 tipos (`1–7`).
- El acumulador de caída se pone a 0 cada vez que aparece una pieza nueva. Así la pieza nueva siempre empieza con el intervalo entero.
- Destello de líneas:
  1. Al fijar una pieza que completa filas, esas filas destellan durante 150 ms.
  2. Mientras dura el destello no cae nada y se ignoran las teclas del juego.
  3. Después se eliminan las filas, se suman los puntos y las líneas, y aparece la pieza nueva.
- Final de partida:
  1. La pieza que no cabe no se dibuja. La fase pasa a `dead`.
  2. El tablero se rellena de abajo arriba durante 1,5 s, una fila cada 75 ms.
  3. Después la fase pasa a `over`.
  4. `end()` durante el relleno pasa directo a `over` sin emitirlo dos veces.
- La puntuación se satura en 9.999.999.
- La primera pulsación de `Espacio` en `ready` solo empieza la partida, sin hard drop.

### Mundo y disposición en el canvas

- Mundo lógico de 800×600, el 4:3 de `.crt-screen` y de las portadas. `dt` limitado a 50 ms.
- Celdas de 28 px: el tablero mide 280×560 y su esquina superior izquierda está en (260, 20). Queda centrado en horizontal, con 20 px arriba y abajo.
- Vista SIGUIENTE a la derecha del tablero:
  - Etiqueta "SIGUIENTE" en (580, 44).
  - Caja de 4×4 celdas de 28 px (112×112) con la esquina en (580, 60).
  - La pieza va centrada dentro de la caja.
- El lado izquierdo del tablero queda negro. Las líneas, el nivel y la puntuación los pinta el HUD de React.
- Buffer del canvas `800·dpr × 600·dpr` con `ctx.scale(dpr, dpr)`.

### Stats y HUD

| HUD        | Valor del motor                                |
| ---------- | ---------------------------------------------- |
| Puntuación | `score`                                        |
| Vidas      | no se muestra (`lives` no existe en sus stats) |
| Líneas     | `lines`, líneas limpiadas en total             |
| Nivel      | `level`, con dos dígitos (`01`)                |

`TETROMINO_INITIAL_STATS = { score: 0, lines: 0, level: 1 }`.

### Contrato de motor

`games/types.ts`:

```ts
export type EngineStats = {
  score: number;
  level: number;
  lives?: number; // el HUD muestra la celda Vidas solo si existe
  lines?: number; // el HUD muestra la celda Líneas solo si existe
};
```

`games/registry.ts`:

```ts
export type EngineDefinition = {
  Canvas: ComponentType<EngineCanvasProps>;
  initialStats: EngineStats; // los mismos stats que emite el motor tras reset()
};

export const ENGINES: Record<string, EngineDefinition> = {
  asteroides: {
    Canvas: AsteroidsCanvas,
    initialStats: ASTEROIDS_INITIAL_STATS,
  },
  tetromino: { Canvas: TetrominoCanvas, initialStats: TETROMINO_INITIAL_STATS },
};

export function hasEngine(id: string): boolean; // sin cambios
```

- `ASTEROIDS_INITIAL_STATS = { score: 0, lives: INITIAL_LIVES, level: 1 }` se añade a `games/asteroids/constants.ts`, y el motor de Asteroides la usa como su `lastEmittedStats` inicial. Su comportamiento no cambia.
- `components/game-player.tsx`:
  - Toma `const { Canvas: Engine, initialStats } = ENGINES[game.id]`.
  - Usa `initialStats` como estado inicial de `stats`, en lugar de `INITIAL_STATS`, que se borra.
  - Pinta la celda Vidas solo si `stats.lives !== undefined`, y la celda Líneas (`hud-stat lines`) solo si `stats.lines !== undefined`.
  - Orden de las celdas: Jugador, Puntuación, Vidas, Líneas, Nivel.
  - No contiene ningún `if (game.id === …)`.
- Con esto, ASTEROIDES muestra Jugador, Puntuación, Vidas y Nivel, como hoy. TETROMINO muestra Jugador, Puntuación, Líneas y Nivel.

### Paleta del canvas

Todos los trazos usan `shadowBlur` con su propio color, aplicado por grupo de color, no por bloque. Fondo negro; las scanlines y la viñeta las pone `.crt-screen`.

| Elemento                    | Color                                                   |
| --------------------------- | ------------------------------------------------------- |
| Pieza I y J                 | `#00f5ff` (cian)                                        |
| Pieza O y L                 | `#f5ff00` (amarillo)                                    |
| Pieza T y Z                 | `#ff006e` (magenta)                                     |
| Pieza S                     | `#00ff88` (verde)                                       |
| Bloque (actual y fijado)    | Relleno de su color al 25 %, borde de 2 px de su color  |
| Pieza fantasma              | Solo borde de su color al 35 %, sin `shadowBlur`        |
| Marco del tablero           | `#00f5ff` (cian) de 2 px                                |
| Rejilla del tablero         | `#4a4f70` (tinta tenue) de 0,5 px al 40 %               |
| Filas en destello           | Relleno completo `#00ff88` (verde) con `shadowBlur` 20  |
| Relleno de fin de partida   | `#8a8fb5` (tinta tenue) al 50 %, sin `shadowBlur`       |
| Etiqueta y caja "SIGUIENTE" | `#8a8fb5` (tinta tenue) la etiqueta, `#4a4f70` el borde |
| Textos de inicio            | Cian el título, tinta tenue el subtítulo                |

Los textos del canvas usan la `font-family` computada del canvas (la mono de la app). En la pantalla de inicio el título es de 44 px y el subtítulo de 16 px, centrados en el mundo, sobre el tablero vacío con su marco y su rejilla.

### Fila en `public.games`

```sql
insert into public.games
  (id, title, short_description, long_description, category, color, cover_image, playable, sort_order)
values (
  'tetromino',
  'TETROMINO',
  'Rota y encaja tetrominós antes de que lleguen al techo.',
  'Piezas geométricas de cuatro bloques caen desde lo alto del tablero. Rótalas y acomódalas para completar líneas y hacerlas desaparecer. Cada 10 líneas sube el nivel y la caída se acelera.',
  'PUZZLE',
  'green',
  'tetromino.webp',
  true,
  2
);
```

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de tocar `game-player.tsx` se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.

1. Crear `games/tetromino/constants.ts` y `games/tetromino/board.ts` con las funciones puras del modelo de datos, portadas de `game.js`, sin la "tuerca". Todavía no se usan.
2. Crear `games/tetromino/engine.ts` con `createTetrominoGame`:
   - Bucle `requestAnimationFrame` con `dt` limitado a 50 ms.
   - Fases `ready` / `playing` / `over`, caída automática, fijado, limpieza de líneas, puntos y niveles.
   - Buffer `800·dpr × 600·dpr` con `ctx.scale(dpr, dpr)`.
   - Dibujo del tablero, la pieza actual, la fantasma, la vista SIGUIENTE y la pantalla de inicio.
   - `onStats` solo cuando cambia `score`, `lines` o `level`.
3. Input del motor:
   - Listeners `keydown` / `keyup` en `window`, que `destroy()` elimina.
   - Se ignoran los eventos cuyo `target` es un `input`, `textarea` o `select`.
   - Fuera de `over`, `preventDefault()` en `keydown` y `keyup` de `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space` y `KeyX`.
   - En `ready`, `Espacio` sin `repeat` empieza la partida y no hace nada más.
   - En `playing`, fuera del destello, `←` `→` `↓` aceptan la repetición del sistema (`e.repeat`). `↑`, `X` y `Espacio` la ignoran.
   - `P` / `Escape` sin `repeat` alternan `pause()` / `resume()`.
   - `visibilitychange` a oculto llama a `pause()`.
4. Añadir el destello de 150 ms, la fase `dead` con el relleno de 1,5 s, la fase `paused` y los métodos `pause`, `resume`, `end`, `reset` y `destroy`.
5. Extender el contrato:
   - En `games/types.ts`, `lives` y `lines` pasan a ser opcionales en `EngineStats`.
   - En `games/asteroids/constants.ts`, añadir `ASTEROIDS_INITIAL_STATS`, y usarla en `games/asteroids/engine.ts`.
   - En `games/registry.ts`, `ENGINES` pasa a `Record<string, EngineDefinition>`, con `asteroides: { Canvas: AsteroidsCanvas, initialStats: ASTEROIDS_INITIAL_STATS }`.
   - En `components/game-player.tsx`, usar `Canvas` e `initialStats`, borrar `INITIAL_STATS` y pintar Vidas y Líneas solo si existen. Añadir a `app/globals.css` el estilo de `.hud-stat.lines .v` que decida `/frontend-design`.
   - Comprobar que ASTEROIDES se ve y se juega igual.
6. Crear `components/tetromino-canvas.tsx` con el patrón de `components/asteroids-canvas.tsx` (`aria-label="TETROMINO"`). Añadir `tetromino: { Canvas: TetrominoCanvas, initialStats: TETROMINO_INITIAL_STATS }` a `ENGINES`.
7. Crear `supabase/migrations/<timestamp>_add_tetromino_game.sql` con el `insert` del modelo de datos:
   - Aplicarla con el MCP `apply_migration` (mismo nombre, `add_tetromino_game`).
   - Ejecutar `get_advisors` (security).
   - No hace falta regenerar `lib/supabase/database.types.ts`: el esquema no cambia.
8. Capturar `public/covers/tetromino.webp` con Playwright en `/games/tetromino/play`:
   - Con `npm run dev` en marcha, empezar una partida y jugar unos segundos hasta tener varias piezas fijadas y una pieza cayendo con su fantasma.
   - Ejecutar `canvas.toDataURL("image/webp", 0.9)` sobre el canvas, decodificar el resultado y guardarlo. Si el buffer no es 800×600 por el `dpr`, redibujarlo antes en un canvas auxiliar de 800×600.
   - Comprobar que la imagen mide 800×600. Las capturas auxiliares van en `.playwright-screenshots/`.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/library`, `/games/tetromino`, `/games/tetromino/play` y `/hall-of-fame`.
- [x] `list_migrations` muestra la migración `add_tetromino_game` y `supabase/migrations/` la contiene.
- [x] `public.games` tiene la fila `tetromino` con `playable = true`, `cover_image = 'tetromino.webp'`, `category = 'PUZZLE'`, `color = 'green'` y `sort_order = 2`, y RLS sigue activado.
- [x] `/games/tetromino/play` muestra en el canvas "TETROMINO" y "PULSA ESPACIO PARA EMPEZAR" sobre el tablero vacío. Nada cae hasta pulsar `Espacio`.
- [x] Al pulsar `Espacio` en la pantalla de inicio aparece una pieza arriba y centrada que no cae de golpe. La vista SIGUIENTE muestra otra pieza.
- [x] En el nivel 1 la pieza baja una fila por segundo sin pulsar nada.
- [x] `←` y `→` mueven la pieza una columna, y la pieza nunca sale del tablero.
- [x] `↑` y `X` rotan la pieza en sentido horario. Una pieza I vertical pegada a la pared rota a horizontal desplazándose hacia dentro.
- [x] `↓` baja la pieza una fila y suma 1 al HUD.
- [x] `Espacio` deja la pieza donde estaba la fantasma, suma 2 por fila recorrida y muestra la siguiente pieza.
- [x] La pieza fantasma se ve en la posición de caída de la pieza actual, con su color y más tenue.
- [x] `games/tetromino/board.ts` define exactamente 7 tipos de pieza, y ninguna partida muestra la "tuerca".
- [x] Completar una línea en el nivel 1 la hace destellar en verde, la elimina, suma 100 al HUD y Líneas pasa de `0` a `1`.
- [x] Completar 2 líneas a la vez en el nivel 1 suma 300. Completar 4 a la vez suma 800.
- [x] Al llegar a 10 líneas, el HUD pasa a nivel `02` y la caída pasa a una fila cada 0,9 s.
- [x] El HUD de TETROMINO muestra Jugador, Puntuación, Líneas y Nivel, y no muestra Vidas.
- [x] Pulsar las teclas del juego no hace scroll ni activa botones con foco.
- [x] PAUSA, `P` y `Escape` congelan el canvas y muestran "EN PAUSA". REANUDAR y `P` continúan desde el mismo estado. Cambiar de pestaña deja el juego en pausa.
- [x] Apilar piezas hasta arriba rellena el tablero de abajo arriba durante 1,5 s y luego abre el modal FIN DEL JUEGO con la misma puntuación que el HUD.
- [x] FIN abre el modal con la puntuación actual. FIN durante el relleno final abre el modal una sola vez.
- [x] Con sesión, empezar una partida suma 1 a `games_played` de `tetromino` en `player_stats`. Pausar o reanudar no suma. FIN en la pantalla de inicio no suma ni guarda.
- [x] Con sesión, un récord nuevo muestra "▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_" y actualiza `max_score`. El récord aparece en el leaderboard de `/games/tetromino` y en la pestaña TETROMINO de `/hall-of-fame`.
- [x] Una puntuación menor o igual que `av_best` muestra "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD" sin llamar a `submitScore`.
- [x] Sin sesión, jugar no crea ni modifica filas en `player_stats`.
- [x] JUGAR DE NUEVO vuelve a la pantalla de inicio con el HUD en puntuación 0, líneas 0 y nivel `01`.
- [x] Salir y volver a entrar no deja dos bucles activos: la pieza sigue bajando una fila por segundo en el nivel 1.
- [x] `/library` muestra la tarjeta TETROMINO con su portada y el chip PUZZLE. La home la incluye, y el contador de juegos pasa a "2+ JUEGOS".
- [x] `/games/tetromino` muestra la portada, la descripción de la BD, "SIN PUNTUACIONES TODAVÍA" antes del primer récord, "Mejor global" `—` y "Partidas" `0`.
- [x] `public/covers/tetromino.webp` existe, mide 800×600 y muestra una partida en curso sin HUD.
- [x] ASTEROIDES sigue jugable. Su HUD muestra Jugador, Puntuación, Vidas (3 ♥ al empezar) y Nivel, sin Líneas. Su guardado y su ranking funcionan igual.
- [x] `components/game-player.tsx` no contiene `INITIAL_STATS` ni ninguna comparación con `game.id`.

## Decisiones

- **Sí:** título TETROMINO e id `tetromino`, PUZZLE y verde. **No:** el nombre comercial del juego de la referencia, que es una marca registrada. "Tetrominó" es el nombre genérico de la pieza.
- **Sí:** solo los 7 tetrominós. **No:** la "tuerca" de la referencia, que no es un tetrominó y casi no se puede encajar.
- **Sí:** azar puro, como en la referencia. **No:** bolsa de 7. Es una decisión del usuario y se acepta que haya rachas.
- **Sí:** mundo de 800×600 con el tablero de 280×560 centrado y la vista SIGUIENTE dentro del canvas. **No:** mundo de 300×600 con bandas negras, que dejaría la vista SIGUIENTE sin sitio y obligaría a redibujar la portada.
- **Sí:** vista SIGUIENTE en el canvas. Es parte del campo de juego, no un marcador. **No:** pasarla al HUD de React, que añadiría al contrato un dato que solo usa este juego.
- **Sí:** extensión genérica del contrato, con `lives` y `lines` opcionales e `initialStats` en el registro. **No:** vidas fijas en 1, que mostrarían un ♥ sin significado. **No:** dejar las líneas solo dentro del canvas, porque la referencia las trata como un marcador más.
- **Sí:** `initialStats` en `ENGINES`, tomados de constantes del propio motor. **No:** que el motor emita sus stats al crearse. Hasta ese primer `onStats` el HUD mostraría las celdas de otro juego.
- **Sí:** controles de la referencia, y `Espacio` empieza desde `ready` y luego hace hard drop. **No:** rotación antihoraria con `Z`.
- **Sí:** repetición de teclas del sistema para `←` `→` `↓`. **No:** DAS/ARR propios, que son ajuste fino de otro spec.
- **Sí:** destello de 150 ms al limpiar líneas, y relleno de 1,5 s al perder en fase `dead`. Es el mismo retardo antes de `over` que en Asteroides. **No:** el corte seco de la referencia.
- **Sí:** el acumulador de caída se pone a 0 con cada pieza nueva. **No:** heredar el tiempo acumulado de la pieza anterior, como hace la referencia, porque la pieza nueva podría caer una fila nada más aparecer.
- **Sí:** fijado inmediato al no poder bajar, como en la referencia. **No:** lock delay.
- **Sí:** vectores neón con la paleta de la app, con colores repetidos entre piezas (4 colores para 7 piezas). **No:** los 7 colores pastel de la referencia ni su tema claro.
- **Sí:** catálogo, puntuaciones y leaderboard de SPEC 06 y SPEC 07 sin cambios de esquema. **No:** tablas propias del juego ni un ranking por líneas.
- **Sí:** el HUD lo pinta React con datos del motor. **No:** el HUD dentro del canvas.
- **Sí:** solo teclado. **No:** controles táctiles ahora.
- **Sí:** sin sonido y sin assets: la referencia no los trae.
- **No:** reiniciar desde el juego en game over, como hace el botón "Reiniciar" de la referencia. El modal de la app gestiona el final.

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| El modo estricto monta el efecto dos veces y deja dos bucles                     | `destroy()` cancela el rAF y quita los listeners. Un criterio lo verifica.                              |
| `Espacio` activa PAUSA o FIN si tienen el foco                                   | `preventDefault()` en `keydown` / `keyup` de las teclas del juego fuera de `over`.                      |
| Los listeners capturan el teclado tras el final                                  | Se ignoran `input` / `textarea` / `select`, y en `over` no hay `preventDefault()`.                      |
| Mantener `Espacio` al empezar hace un hard drop inmediato                        | `Espacio` ignora `e.repeat`. La pulsación que empieza la partida no hace nada más.                      |
| `shadowBlur` por bloque baja los fps con el tablero lleno                        | Glow por grupo de color: un `shadowBlur` por color y frame, no por bloque.                              |
| La fuente mono no ha cargado al pintar la pantalla de inicio                     | La pantalla de inicio se redibuja cada frame.                                                           |
| `onPhase("over")` doble abre dos veces el modal o duplica el guardado            | `end()` idempotente y el `ref` de `game-player.tsx`. Además, `submit_score` es idempotente.             |
| La puntuación supera 9.999.999 y `submit_score` la rechaza                       | El motor la satura en 9.999.999.                                                                        |
| Al hacer `lives` opcional, el HUD de Asteroides cambia o parpadea                | `initialStats` de Asteroides incluye `lives: 3`. Un criterio verifica su HUD.                           |
| `initialStats` del registro no coincide con lo que emite el motor tras `reset()` | Las dos cosas usan la misma constante del motor (`ASTEROIDS_INITIAL_STATS`, `TETROMINO_INITIAL_STATS`). |
| La repetición de teclas del sistema varía entre equipos                          | Se acepta. DAS/ARR propios quedan fuera de alcance.                                                     |
| El azar puro da rachas largas sin pieza I                                        | Decisión aceptada. La bolsa de 7 queda para otro spec si hace falta.                                    |
| El tablero centrado deja el lado izquierdo vacío                                 | Es intencional: el HUD está fuera del canvas. La portada se captura igualmente a 800×600.               |
| La migración se aplica antes que el motor                                        | El juego se ve PRÓXIMAMENTE hasta registrar el motor. No rompe nada.                                    |

## Lo que **no** está en este spec

- La "tuerca" y la bolsa de 7.
- Hold, varias vistas previas y rotación antihoraria.
- Lock delay, T-spins, combos y DAS/ARR.
- Tema claro de la referencia.
- Controles táctiles, gamepad y versión móvil.
- Sonido y música.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
