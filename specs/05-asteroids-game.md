# SPEC 05 — ROCAS: primer juego real (asteroides en canvas)

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-11-23
> **Objetivo:** Hacer jugable ROCAS (`/games/rocas/play`) portando a TypeScript el Asteroids de `references/started-games/02-asteroids/`, con estética neón, HUD y modal de la app, y OVNIs; el resto de juegos pasan a mostrar "PRÓXIMAMENTE".

## Por qué existe este spec

Hoy ningún juego es jugable: `components/game-player.tsx` suma puntos al azar con un `setInterval` y pinta una arena decorativa (`.game-arena`). La entrada `rocas` del catálogo ya describe un Asteroids ("Cuidado con los OVNIs en el horizonte"), y la referencia `02-asteroids` es un canvas de 800×600, el mismo 4:3 que `.crt-screen`. Este spec convierte esa referencia en el primer juego real y define cómo se monta un motor de canvas dentro del reproductor.

Nota de numeración: SPEC 04 menciona "SPEC 05" para las puntuaciones en Supabase. Ese trabajo pasa al siguiente número libre.

## Alcance

**Dentro:**

- Motor del juego en TypeScript puro, sin React, en `games/asteroids/`:
  - Nave con rotación, propulsión, inercia y envolvimiento toroidal.
  - Asteroides de 3 tamaños que se parten al destruirse.
  - Partículas de explosión.
  - 3 vidas con 3 s de invencibilidad parpadeante al reaparecer.
  - Niveles: al limpiar la pantalla empieza el siguiente con `3 + nivel` asteroides grandes.
  - Power-up de disparo triple, con las mismas reglas que la referencia.
  - OVNIs desde el nivel 2 (reglas en el modelo de datos).
- Estética neón con `shadowBlur` y la paleta de la app (ver modelo de datos).
- Pantalla de inicio en el canvas: "ROCAS" y "PULSA ESPACIO PARA EMPEZAR".
- Controles de teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar, `P` / `Escape` pausar y reanudar.
- Componente cliente `components/asteroids-canvas.tsx` que monta el motor y expone sus controles al reproductor.
- `components/game-player.tsx` usa el motor real:
  - El HUD React (`player-hud`) muestra puntuación, vidas y nivel reales.
  - PAUSA / REANUDAR pausan el motor. FIN termina la partida.
  - Perder la última vida abre el modal FIN DEL JUEGO existente.
  - JUGAR DE NUEVO vuelve a la pantalla de inicio.
  - Cambiar de pestaña pausa el juego automáticamente.
- La puntuación se guarda como hoy, con `appendScore` en `av_scores` (`localStorage`), solo con sesión iniciada y siempre con el username. El nombre no se puede editar.
- Sin sesión, el modal FIN DEL JUEGO no ofrece guardar: muestra un aviso y el botón INICIAR SESIÓN (`/auth`).
- Campo `playable` en `Game`. Solo `rocas` es `true`.
- Juegos no jugables:
  - En `/games/[id]`, JUGAR AHORA se sustituye por un botón deshabilitado "PRÓXIMAMENTE".
  - `/games/[id]/play` muestra una pantalla CRT "PRÓXIMAMENTE" con VOLVER AL VAULT.
- Se elimina la puntuación simulada y la arena decorativa.
- La etiqueta "TECLADO / TÁCTIL" del detalle pasa a "TECLADO".

**Fuera de alcance (para futuros specs):**

- Controles táctiles y versión móvil jugable.
- Puntuaciones en Supabase, Salón de la Fama real y anti-trampas.
- El resto de juegos del catálogo.
- OVNI pequeño que apunta a la nave, y cualquier segundo tipo de OVNI.
- Sonido y música.
- Vidas extra por puntuación.
- Gamepad.
- Etiqueta "PRÓXIMAMENTE" en las tarjetas de la librería.
- Récord personal o "mejor global" real en el detalle (sigue siendo mock).
- Tests automatizados.

## Modelo de datos

### Catálogo

`lib/games.ts`:

```ts
export type Game = {
  // ...campos actuales
  playable: boolean; // true solo en "rocas"
};
```

### API del motor

`games/asteroids/engine.ts`:

```ts
export type AsteroidsStats = { score: number; lives: number; level: number };

// ready: pantalla "PULSA ESPACIO"; dead: esperando reaparición (2 s); over: partida terminada.
export type AsteroidsPhase = "ready" | "playing" | "dead" | "paused" | "over";

export type AsteroidsCallbacks = {
  onStats(stats: AsteroidsStats): void; // solo cuando algún valor cambia
  onPhase(phase: AsteroidsPhase): void; // en cada cambio de fase
};

export type AsteroidsGame = {
  pause(): void; // playing | dead → paused; en otra fase no hace nada
  resume(): void; // paused → la fase anterior
  end(): void; // cualquier fase → over (botón FIN)
  reset(): void; // → ready, con score 0, 3 vidas, nivel 1
  destroy(): void; // cancela el rAF y quita todos los listeners
};

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

Organización de `games/asteroids/`:

- `constants.ts`: tamaños, velocidades, puntos, colores y tiempos.
- `entities.ts`: `Ship`, `Bullet`, `Asteroid`, `Particle`, `PowerUp`, `Ufo`. Cada una tiene `update(dt)`, `draw(ctx)` y `dead`.
- `engine.ts`: estado, input, bucle `requestAnimationFrame`, colisiones y dibujo de pantallas.

### Reglas que se mantienen de la referencia

- Mundo lógico de 800×600. `dt` limitado a 50 ms.
- Asteroides: radios `[16, 30, 50]`, velocidades base `[85, 55, 32]` px/s, puntos `[100, 50, 20]` (pequeño, mediano, grande).
- Nave: rotación 3,5 rad/s, empuje 260 px/s², rozamiento 0,987, cooldown de disparo 0,2 s, radio de colisión `radius * 0.82`.
- Balas de la nave: 520 px/s, vida 1,1 s.
- Power-up: 15 % de probabilidad por asteroide destruido, garantizado al quinto, uno por nivel, dura 12 s en pantalla, da 5 s de disparo triple con apertura de 0,18 rad.
- Nivel 1 con 4 asteroides grandes, nivel N con `3 + N`, todos a más de 130 px del centro.

### OVNI (nuevo)

- Aparece desde el nivel 2. Hay como máximo uno a la vez.
- El temporizador de aparición es aleatorio entre 15 y 25 s. Solo avanza en fase `playing`, y se reinicia al cambiar de nivel.
- Entra por el borde izquierdo o derecho, a una altura aleatoria a más de 60 px de los bordes.
- Se mueve en horizontal a 110 px/s. Cada 1,5–3 s elige una velocidad vertical entre −60, 0 y 60 px/s.
- Envuelve en vertical, no en horizontal. Desaparece al salir por el borde opuesto.
- Dispara cada 1,5 s en una dirección aleatoria. Bala a 300 px/s, con 1,2 s de vida.
- Radio de colisión 16. Una bala de la nave lo destruye: 200 puntos y 16 partículas.
- Si choca con la nave, o una de sus balas la alcanza, la nave pierde una vida (salvo invencibilidad).
- Atraviesa los asteroides sin chocar. Sus balas no afectan a los asteroides.
- Al cambiar de nivel, el OVNI activo y sus balas desaparecen.
- Un nivel termina cuando no quedan asteroides, aunque haya un OVNI en pantalla.

### Paleta del canvas

Todos los trazos usan `shadowBlur` con su propio color. Fondo negro; las scanlines y la viñeta las pone `.crt-screen`.

| Elemento            | Color                                    |
| ------------------- | ---------------------------------------- |
| Nave                | `#00f5ff` (cian)                         |
| Llama del propulsor | `#f5ff00` (amarillo)                     |
| Balas de la nave    | `#00f5ff` (cian)                         |
| Asteroides          | `#ff006e` (magenta)                      |
| OVNI                | `#f5ff00` (amarillo)                     |
| Balas del OVNI      | `#ff006e` (magenta)                      |
| Power-up "3x"       | `#00ff88` (verde)                        |
| Partículas          | Color del objeto destruido, con fundido  |
| Textos de inicio    | Cian el título, tinta tenue el subtítulo |

Los textos del canvas usan la `font-family` computada del canvas (la mono de la app).

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de tocar `game-player.tsx`, `coming-soon.tsx` y el detalle, se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.

1. Añadir `playable: boolean` a `Game` en `lib/games.ts`, con `true` solo en `rocas`.
2. Crear `components/coming-soon.tsx`: marco `.crt` con "PRÓXIMAMENTE" en amarillo neón, el título del juego y el botón VOLVER AL VAULT (`/library`). En `app/games/[id]/play/page.tsx`, renderizar `ComingSoon` si `!game.playable` y `GamePlayer` si no.
3. En `app/games/[id]/page.tsx`, si `!game.playable`, sustituir JUGAR AHORA por `<button className="btn xl" disabled>PRÓXIMAMENTE</button>`. Cambiar la etiqueta "TECLADO / TÁCTIL" por "TECLADO".
4. Crear `games/asteroids/constants.ts` y `games/asteroids/entities.ts` con `Ship`, `Bullet`, `Asteroid`, `Particle` y `PowerUp`, portados de la referencia a TypeScript con `draw(ctx)` y la paleta neón. Todavía no se usan.
5. Crear `games/asteroids/engine.ts` con `createAsteroidsGame`: bucle, input, fases `ready` / `playing` / `dead` / `over`, colisiones, niveles, power-up y callbacks. El canvas usa un buffer de `800·dpr × 600·dpr` con `ctx.scale(dpr, dpr)`.
6. Input del motor:
   - Listeners `keydown` / `keyup` en `window`, que `destroy()` elimina.
   - Se ignoran los eventos cuyo `target` es un `input`, `textarea` o `select`.
   - En fases distintas de `over`, se llama a `preventDefault()` en `keydown` y `keyup` de flechas y `Espacio`, para que la página no haga scroll ni se activen botones con foco.
   - `P` / `Escape` alternan `pause()` / `resume()`.
   - `visibilitychange` a oculto llama a `pause()`.
7. Añadir la fase `paused` y los métodos `pause`, `resume`, `end`, `reset` y `destroy`. Al perder la última vida, la fase pasa a `over` tras 1,5 s, para que se vea la explosión.
8. Crear `components/asteroids-canvas.tsx` (`"use client"`): renderiza el `<canvas>`, crea el motor en un `useEffect` y lo destruye al desmontar. Recibe `onStats` y `onPhase`, y expone `pause`, `resume`, `end` y `reset` por `ref` con `useImperativeHandle`. Añadir en `app/globals.css` la regla del canvas (`display: block; width: 100%; height: 100%`).
9. Reescribir `components/game-player.tsx`:
   - Quitar el `setInterval`, `POINTS_PER_LEVEL` y la arena decorativa. Montar `<AsteroidsCanvas>` dentro de `.crt-screen`.
   - `score`, `lives` y `level` vienen de `onStats`. `paused` y `over` se derivan de `onPhase`.
   - PAUSA / REANUDAR llaman a `pause()` / `resume()` y solo están activos en `playing`, `dead` o `paused`. FIN llama a `end()`.
   - El overlay "EN PAUSA" dice "PULSA REANUDAR O P PARA CONTINUAR".
   - JUGAR DE NUEVO llama a `reset()` y limpia el estado del modal.
   - Borrar de `app/globals.css` las reglas `.game-arena` si nada más las usa.
10. Añadir `Ufo` a `entities.ts` y su lógica al motor según las reglas del modelo de datos.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos en `/games/rocas`, `/games/rocas/play` y `/games/caida/play`.
- [x] `/games/rocas/play` muestra en el CRT "ROCAS" y "PULSA ESPACIO PARA EMPEZAR". Ningún asteroide se mueve hasta pulsar `Espacio`.
- [x] Tras pulsar `Espacio`, hay 4 asteroides grandes magenta y una nave cian en el centro, parpadeando durante 3 s.
- [x] `←` `→` rotan la nave, `↑` la propulsa con llama amarilla, y la nave sigue deslizándose al soltar `↑`.
- [x] Salir por un borde hace aparecer la nave, sus balas y los asteroides por el borde opuesto.
- [x] Pulsar flechas o `Espacio` durante la partida no hace scroll en la página.
- [x] Destruir un asteroide grande suma 20 al HUD y deja 2 medianos. Un mediano suma 50 y deja 2 pequeños. Un pequeño suma 100 y no deja fragmentos.
- [x] Chocar con un asteroide fuera de la invencibilidad resta un corazón en el HUD, y la nave reaparece en el centro a los 2 s.
- [x] Limpiar el nivel 1 cambia el HUD a nivel `02` y genera 5 asteroides grandes.
- [x] En el nivel 1 nunca aparece un OVNI.
- [x] En el nivel 2 aparece un OVNI amarillo antes de 25 s de juego, entrando por un lateral, y dispara balas magenta.
- [x] Destruir el OVNI suma exactamente 200 al HUD.
- [x] Una bala del OVNI que alcanza la nave resta una vida.
- [x] Al quinto asteroide destruido sin power-up en el nivel aparece un "3x" verde. Recogerlo hace que cada disparo lance 3 balas durante 5 s.
- [x] PAUSA y `P` congelan el canvas y muestran "EN PAUSA". REANUDAR y `P` lo reanudan desde el mismo estado.
- [x] Cambiar de pestaña durante la partida y volver deja el juego en pausa.
- [x] Perder la tercera vida abre el modal FIN DEL JUEGO con la misma puntuación que el HUD.
- [x] FIN abre el modal con la puntuación actual.
- [x] El modal no muestra ni permite editar el nombre. Con sesión muestra GUARDAR PUNTUACIÓN, JUGAR DE NUEVO y VOLVER AL VAULT en columna y con el mismo ancho.
- [x] Sin sesión, el modal no muestra GUARDAR PUNTUACIÓN, sino un aviso y el botón INICIAR SESIÓN (`/auth`), del mismo ancho que JUGAR DE NUEVO y VOLVER AL VAULT.
- [x] Con sesión, GUARDAR PUNTUACIÓN añade la entrada a `av_scores` con `game: "rocas"` y el username, y el Salón de la Fama la muestra en "TU MEJOR MARCA".
- [x] El HUD muestra el username con sesión iniciada, e "INVITADO" sin sesión.
- [x] JUGAR DE NUEVO vuelve a la pantalla "PULSA ESPACIO" con el HUD en 0, 3 vidas y nivel `01`.
- [x] Navegar a SALIR y volver a entrar no deja dos bucles activos: el juego no va al doble de velocidad.
- [x] `/games/caida` muestra "PRÓXIMAMENTE" deshabilitado en lugar de JUGAR AHORA, y `/games/caida/play` muestra la pantalla CRT "PRÓXIMAMENTE" con VOLVER AL VAULT.
- [x] El detalle de cualquier juego muestra la etiqueta "TECLADO".
- [x] `components/game-player.tsx` no contiene `setInterval` ni `game-arena`.

## Decisiones

- **Sí:** reutilizar la entrada `rocas`. **No:** una entrada nueva ASTEROIDES. La portada, el color y la descripción ya existen.
- **Sí:** los juegos no implementados muestran "PRÓXIMAMENTE" en el detalle y en `/play`. **No:** mantener la simulación. Una puntuación falsa se podría guardar en el Salón de la Fama.
- **No:** etiqueta "PRÓXIMAMENTE" en las tarjetas de la librería. Se deja para otro spec.
- **Sí:** `playable: boolean` en `Game`. Es el dato mínimo para decidir qué mostrar. Cuando llegue un segundo juego, `GamePlayer` elegirá el componente por `id`.
- **Sí:** puntuaciones en `localStorage` con `appendScore`. **No:** Supabase aquí. Las puntuaciones reales necesitan su propio diseño de RLS y anti-trampas.
- **Sí:** solo los jugadores con sesión guardan puntuación, con su username. **No:** guardar como invitado ni editar el nombre. Así cada puntuación pertenece a una cuenta y nadie firma con un nombre ajeno.
- **Sí:** vectores neón con la paleta de la app y glow. **No:** el blanco de la referencia, que no encaja con la estética. **No:** Press Start 2P dentro del canvas.
- **Sí:** el HUD lo pinta React con datos del motor. **No:** HUD dentro del canvas, porque duplicaría la barra `player-hud`. El nivel es el real del juego, no `score / 2500`.
- **Sí:** mecánicas de la referencia más OVNIs, porque la descripción de ROCAS los promete. **Sí:** un solo tipo de OVNI que dispara al azar. **No:** el OVNI pequeño que apunta, que añade IA y balance.
- **Sí:** el OVNI atraviesa los asteroides. Simplifica las colisiones sin cambiar la sensación de juego.
- **Sí:** solo teclado. **No:** controles táctiles ahora. Son un diseño de UI propio.
- **Sí:** pantalla "PULSA ESPACIO" antes de empezar. El jugador no pierde vidas mientras se ubica.
- **No:** reiniciar con `Espacio` en game over, como hace la referencia. El modal de la app gestiona el final.
- **Sí:** auto-pausa al cambiar de pestaña. El `dt` limitado evita saltos, pero el jugador perdería vidas sin estar mirando.
- **Sí:** motor TypeScript sin React en `games/asteroids/`, montado por `components/asteroids-canvas.tsx`. **No:** el motor dentro de un hook. El bucle a 60 fps no debe provocar renders de React. Cada juego futuro tendrá su carpeta en `games/`.
- **Sí:** el motor emite `onStats` solo cuando cambia algún valor. El HUD no se re-renderiza en cada frame.
- **Sí:** el motor es dueño del teclado y de la pausa, y React deriva su estado de `onPhase`. Así hay una sola fuente de verdad para `P`, `Escape`, el botón y la auto-pausa.
- **Sí:** buffer del canvas escalado por `devicePixelRatio`. Los trazos se ven nítidos en pantallas retina sin cambiar las coordenadas lógicas de 800×600.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `Espacio` activa el botón PAUSA o FIN si tiene el foco tras un clic      | El motor llama a `preventDefault()` en `keydown` y `keyup` de `Espacio` fuera de la fase `over`.                       |
| El modo estricto de React monta el efecto dos veces y deja dos bucles    | `destroy()` cancela el `requestAnimationFrame` y quita los listeners. Un criterio de aceptación lo verifica.           |
| Los listeners del motor capturan el teclado de la página tras el final   | El motor ignora eventos de `input`, `textarea` y `select`, y en fase `over` no llama a `preventDefault()`.             |
| `shadowBlur` en muchos trazos baja los fps en equipos lentos             | El glow se aplica por grupo de entidades, no por segmento. Si cae el rendimiento, se reduce el blur de las partículas. |
| La fuente mono aún no ha cargado al dibujar la pantalla de inicio        | La pantalla de inicio se redibuja en cada frame, así que cambia sola cuando la fuente carga.                           |
| Tras la última vida, el jugador pulsa FIN durante los 1,5 s de explosión | `end()` pasa directo a `over`. `onPhase("over")` se emite una sola vez y el modal no se abre dos veces.                |

## Lo que **no** está en este spec

- Controles táctiles y versión móvil jugable.
- Puntuaciones en Supabase y Salón de la Fama real.
- Los otros 7 juegos del catálogo.
- Segundo tipo de OVNI.
- Sonido, vidas extra y gamepad.
- Etiqueta "PRÓXIMAMENTE" en la librería.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
