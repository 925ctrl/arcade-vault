# Checklist de integración de un juego

Lo que necesita un juego para funcionar en Arcade Vault con su leaderboard, extraído de SPEC 05 (motor), SPEC 06 (puntuaciones) y SPEC 07 (catálogo). Todo spec generado por `/new-game` cubre cada punto: en el alcance, en el plan o en los criterios.

`<id>` es el id del juego (`tetris-neon`), `<Name>` su nombre en PascalCase para los identificadores (`TetrisNeon`).

## Lo que ya funciona solo (no se toca)

Con el juego registrado y su fila en `public.games` con `playable = true`, sin escribir más código:

- `/games/<id>` (detalle, leaderboard top 10, "Mejor global", "Partidas", "TU MEJOR MARCA"), `/games/<id>/play` y `generateStaticParams` (`lib/games.ts`, `app/games/[id]/`).
- Tarjeta en `/library`, chip de su categoría (`categoriesOf`), pestaña en `/hall-of-fame`, previsualización y contador de la home.
- `startGame` / `submitScore` (`app/games/[id]/play/actions.ts`), que validan `game?.playable`; `start_game` / `submit_score` en la BD, que validan contra `public.games`.
- Vistas `leaderboard` y `game_stats`, copia local `av_best` (`lib/best-cache.ts`), modal FIN DEL JUEGO y su flujo de guardado (`components/game-player.tsx`).
- `playable` efectivo = `row.playable && hasEngine(row.id)` (`lib/games.ts`): sin motor registrado se ve PRÓXIMAMENTE.

El spec lo menciona en "Por qué existe este spec" o en Decisiones, y lo verifica en los criterios. No lo vuelve a implementar.

## 1. Motor — `games/<id>/`

TypeScript puro, sin React. Archivos: `constants.ts` (tamaños, velocidades, puntos, colores, tiempos), `entities.ts` si hay entidades con `update(dt)` / `draw(ctx)`, `engine.ts`.

```ts
// games/<id>/engine.ts
import type { EnginePhase, EngineStats } from "@/games/types";

export type <Name>Callbacks = {
  onStats(stats: EngineStats): void; // solo cuando algún valor cambia
  onPhase(phase: EnginePhase): void; // en cada cambio de fase
};

export type <Name>Game = {
  pause(): void;   // playing | dead → paused; en otra fase no hace nada
  resume(): void;  // paused → la fase anterior
  end(): void;     // cualquier fase → over; idempotente
  reset(): void;   // → ready, con los stats iniciales
  destroy(): void; // cancela el rAF y quita todos los listeners
};

export function create<Name>Game(
  canvas: HTMLCanvasElement,
  callbacks: <Name>Callbacks,
): <Name>Game;
```

Reglas obligatorias:

- Fases `ready` → `playing` (↔ `dead` si hay vidas) ↔ `paused` → `over`. `ready` es la pantalla de inicio con el título en el canvas y "PULSA ESPACIO PARA EMPEZAR"; nada se mueve hasta pulsar `Espacio`.
- `game-player.tsx` cuenta la partida en la transición `ready` → `playing` (`startGame`) y guarda al llegar a `over` (`submitScore`). El motor debe emitir esas fases exactamente así y `onPhase("over")` una sola vez por partida.
- Al perder, `over` llega tras un retardo (1,5 s en Asteroides) para que se vea el final. `end()` durante ese retardo pasa directo a `over` sin duplicarlo.
- No reiniciar con `Espacio` en `over`: el modal de la app gestiona el final.
- Mundo lógico fijo (`WORLD_W` × `WORLD_H`). Buffer del canvas `WORLD_W·dpr × WORLD_H·dpr` con `ctx.scale(dpr, dpr)`.
- Bucle `requestAnimationFrame` con `dt` limitado a 50 ms. El bucle no provoca renders de React: `onStats` solo cuando cambia un valor.
- Input: `keydown` / `keyup` en `window`; se ignoran eventos con `target` `input`, `textarea` o `select`; fuera de `over`, `preventDefault()` en las teclas del juego (flechas, `Espacio`, …) para que no haya scroll ni se activen botones con foco.
- `P` / `Escape` alternan `pause()` / `resume()`. `visibilitychange` a oculto llama a `pause()`.
- Puntuación entera, entre 0 y 9.999.999. Si el juego pudiera superarla, se satura en 9.999.999.
- Textos del canvas con la `font-family` computada del canvas (la mono de la app). La pantalla de inicio se redibuja cada frame, así que cambia sola cuando carga la fuente.

## 2. Estética del canvas

- Fondo negro; scanlines y viñeta las pone `.crt-screen`. Sin HUD dentro del canvas: lo pinta React.
- Trazos neón con `shadowBlur` del mismo color, aplicado por grupo de entidades, no por segmento.
- Paleta de la app: cian `#00f5ff`, magenta `#ff006e`, amarillo `#f5ff00`, verde `#00ff88`. El spec incluye una tabla "Paleta del canvas" elemento → color. Nada de blanco de la referencia.
- Relación 4:3 recomendada (800×600): es la de `.crt-screen` y la de las portadas. Si el mundo no es 4:3, el spec decide cómo se encaja (bandas negras, escala) y lo anota como riesgo.
- Sprites o sonidos de la referencia solo si el spec lo decide; van en `public/games/<id>/`.

## 3. Componente — `components/<id>-canvas.tsx`

`"use client"`, mismo patrón que `components/asteroids-canvas.tsx`:

- Props `EngineCanvasProps` (`games/types.ts`).
- `callbacksRef` actualizado en un efecto, para que el motor siempre llame a los callbacks actuales.
- Crea el motor en un `useEffect` con `[]` y llama a `destroy()` en el cleanup (el modo estricto monta dos veces).
- Expone `pause`, `resume`, `end` y `reset` con `useImperativeHandle`.
- `<canvas aria-label="<TÍTULO>" style={{ display: "block", width: "100%", height: "100%" }} />`.

## 4. Registro — `games/registry.ts`

Añadir `<id>: <Name>Canvas` a `ENGINES`. Es lo que hace que `hasEngine(<id>)` sea `true` y `GamePlayer` monte el motor con `ENGINES[game.id]`.

## 5. Contrato — solo si el juego lo necesita

El HUD de `components/game-player.tsx` muestra Jugador, Puntuación, Vidas (`♥`) y Nivel, con `INITIAL_STATS = { score: 0, lives: 3, level: 1 }`.

- Si el juego encaja (tiene vidas y niveles), no se toca nada.
- Si no encaja (sin vidas, otra métrica como líneas), el spec incluye un paso que extiende el contrato de forma **genérica** en `games/types.ts` y `game-player.tsx`, p. ej. `lives` opcional y el HUD oculta la celda cuando falta, o stats iniciales declarados por el motor. Requisitos:
  - Asteroides se ve y se comporta igual (criterio de aceptación explícito).
  - Ningún `if (game.id === …)` en `game-player.tsx`.
  - Si un spec anterior ya hizo una extensión, se reutiliza en vez de crear otra.
  - Antes de tocar `game-player.tsx` se invoca `/frontend-design` (`CLAUDE.md`).

## 6. Base de datos — una migración, sin cambios de esquema

`supabase/migrations/<timestamp>_add_<id>_game.sql`:

```sql
insert into public.games
  (id, title, short_description, long_description, category, color, cover_image, playable, sort_order)
values (
  '<id>',
  '<TÍTULO>',            -- 1–32 caracteres
  '<descripción corta>',
  '<descripción larga>',
  '<CATEGORY>',          -- ARCADE | PUZZLE | SHOOTER | VERSUS
  '<color>',             -- cyan | magenta | yellow | green
  '<id>.webp',
  true,
  <siguiente sort_order>
);
```

- Se aplica con el MCP `apply_migration` (mismo nombre) y después `get_advisors` (security). `list_migrations` debe mostrarla.
- No hace falta regenerar `lib/supabase/database.types.ts`: el esquema no cambia.
- Orden seguro: primero el motor y el registro, después la migración. En cualquier orden el sistema es coherente (fila sin motor → PRÓXIMAMENTE; motor sin fila → 404), pero así el juego aparece ya jugable.
- `public.games` no admite escrituras con la publishable key: el `insert` va solo por migración.

## 7. Portada — `public/covers/<id>.webp`

- 800×600, WebP. Con Playwright en `/games/<id>/play` (con `npm run dev` y el juego ya jugable): empezar partida, jugar unos segundos hasta tener una escena representativa, y ejecutar `canvas.toDataURL("image/webp", 0.9)` sobre el canvas. Decodificar y guardar. Si el buffer no es 800×600 (dpr o mundo distinto), redibujarlo en un canvas auxiliar de 800×600 antes de exportar.
- Sin HUD (el HUD es React, fuera del canvas).
- Capturas auxiliares de verificación en `.playwright-screenshots/`.
- Comprobar que mide 800×600.

## 8. Criterios de aceptación base

Se copian al spec adaptando nombres y añadiendo los propios del juego:

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/library`, `/games/<id>`, `/games/<id>/play` y `/hall-of-fame`.
- [ ] `list_migrations` muestra la migración `add_<id>_game` y `supabase/migrations/` la contiene. `public.games` tiene la fila `<id>` con `playable = true` y `cover_image = '<id>.webp'`, y RLS sigue activado.
- [ ] `/games/<id>/play` muestra en el canvas "<TÍTULO>" y "PULSA ESPACIO PARA EMPEZAR". Nada se mueve hasta pulsar `Espacio`.
- [ ] Pulsar las teclas del juego no hace scroll ni activa botones con foco.
- [ ] El HUD muestra puntuación<, vidas y nivel> reales del motor.
- [ ] PAUSA, `P` y `Escape` congelan el canvas y muestran "EN PAUSA"; REANUDAR y `P` continúan desde el mismo estado. Cambiar de pestaña deja el juego en pausa.
- [ ] Perder abre el modal FIN DEL JUEGO con la misma puntuación que el HUD. FIN también.
- [ ] Con sesión, empezar una partida suma 1 a `games_played` de `<id>` en `player_stats`; pausar o reanudar no suma. FIN en la pantalla de inicio no suma ni guarda.
- [ ] Con sesión, un récord nuevo muestra "▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_", actualiza `max_score`, y aparece en el leaderboard de `/games/<id>` y en la pestaña <TÍTULO> de `/hall-of-fame`.
- [ ] Una puntuación menor o igual que `av_best` muestra "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD" sin llamar a `submitScore`.
- [ ] Sin sesión, jugar no crea ni modifica filas en `player_stats`.
- [ ] JUGAR DE NUEVO vuelve a la pantalla de inicio con el HUD en sus valores iniciales.
- [ ] Salir y volver a entrar no deja dos bucles activos (el juego no va al doble de velocidad).
- [ ] `/library` muestra la tarjeta <TÍTULO> con su portada y el chip <CATEGORY>; la home la incluye y el contador de juegos sube en 1.
- [ ] `/games/<id>` muestra la portada, la descripción de la BD, "SIN PUNTUACIONES TODAVÍA" antes del primer récord, "Mejor global" `—` y "Partidas" `0`.
- [ ] `public/covers/<id>.webp` existe, mide 800×600 y muestra una partida en curso sin HUD.
- [ ] ASTEROIDES sigue jugable y su HUD, guardado y ranking funcionan igual.

## 9. Riesgos base

| Riesgo                                                                | Mitigación                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| El modo estricto monta el efecto dos veces y deja dos bucles          | `destroy()` cancela el rAF y quita los listeners; un criterio lo verifica.          |
| `Espacio` activa PAUSA o FIN si tienen el foco                        | `preventDefault()` en `keydown` / `keyup` de las teclas del juego fuera de `over`.  |
| Los listeners capturan el teclado tras el final                       | Se ignoran `input` / `textarea` / `select`, y en `over` no hay `preventDefault()`.  |
| `shadowBlur` baja los fps                                             | Glow por grupo de entidades; si cae el rendimiento, menos blur en partículas.       |
| La fuente mono no ha cargado al pintar la pantalla de inicio          | La pantalla de inicio se redibuja cada frame.                                       |
| `onPhase("over")` doble abre dos veces el modal o duplica el guardado | `end()` idempotente y un `ref` en `game-player.tsx`; `submit_score` es idempotente. |
| La puntuación supera 9.999.999 y `submit_score` la rechaza            | El motor la satura en 9.999.999.                                                    |
| La migración se aplica antes que el motor                             | El juego se ve PRÓXIMAMENTE hasta registrar el motor; no rompe nada.                |
