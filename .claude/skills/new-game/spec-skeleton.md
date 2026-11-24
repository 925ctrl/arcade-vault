# Esqueleto del spec de un juego

Estructura que sigue `specs/NN-<slug>.md`. Es el `template.md` del skill `/spec` adaptado a juegos: mismo orden de secciones y mismas reglas globales, con las secciones y el estilo que usan SPEC 05–07. Si `template.md` y este esqueleto difieren en la estructura, manda `template.md`; los contenidos de juego salen de aquí y de `integration-checklist.md`. Sustituye cada `<…>` y borra las notas `> NOTA:`. Las secciones que no apliquen (p. ej. "Contrato de motor" si el juego encaja en el HUD) se quitan y se dice en Decisiones.

---

```markdown
# SPEC NN — <TÍTULO>: <subtítulo corto>

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** <fecha del contexto de sesión>
> **Objetivo:** <Una frase: hacer jugable <TÍTULO> (`/games/<id>/play`) portando / creando …, integrado en el catálogo, el leaderboard y el Salón de la Fama.>

## Por qué existe este spec

<Estado actual: qué juegos hay en `public.games` y en `ENGINES`. De dónde sale el juego (`references/started-games/<carpeta>/` o idea nueva) y qué tiene esa referencia (tamaño, archivos, assets). Qué funciona solo gracias a SPEC 06–07 (leaderboard, récord, partidas, salón, tarjeta) y qué hay que construir.>

## Alcance

**Dentro:**

- Motor del juego en TypeScript puro, sin React, en `games/<id>/`:
  - <mecánica 1>
  - <mecánica 2>
  - <…>
- Estética neón con `shadowBlur` y la paleta de la app (ver modelo de datos).
- Pantalla de inicio en el canvas: "<TÍTULO>" y "PULSA ESPACIO PARA EMPEZAR".
- Controles de teclado: <teclas>, `P` / `Escape` pausar y reanudar.
- Componente cliente `components/<id>-canvas.tsx` registrado en `games/registry.ts`.
- <Si aplica: extensión genérica del contrato de motor y del HUD.>
- Migración `supabase/migrations/<timestamp>_add_<id>_game.sql` con la fila de `public.games`.
- Portada `public/covers/<id>.webp`, 800×600.

**Fuera de alcance (para futuros specs):**

- Controles táctiles y versión móvil jugable.
- Sonido y música. <salvo decisión contraria>
- Gamepad.
- <reglas de la referencia que se dejan fuera>
- Tests automatizados.

## Modelo de datos

### API del motor

`games/<id>/engine.ts`:

> NOTA: copia la forma de `integration-checklist.md` §1 con los nombres reales.

Organización de `games/<id>/`:

- `constants.ts`: <…>
- `entities.ts`: <entidades, cada una con `update(dt)`, `draw(ctx)` y `dead`, si aplica>
- `engine.ts`: estado, input, bucle `requestAnimationFrame`, colisiones y dibujo de pantallas.

### Reglas que se mantienen de la referencia

> NOTA: valores numéricos concretos leídos del código de la referencia. Si es un juego nuevo, esta sección se llama "Reglas del juego".

- Mundo lógico de <W>×<H>. `dt` limitado a 50 ms.
- <puntos por acción>
- <vidas / niveles / dificultad>
- <condición de fin>

### Reglas nuevas

> NOTA: solo si se cambia o añade algo respecto a la referencia. Si no, se quita.

### Stats y HUD

| HUD        | Valor del motor       |
| ---------- | --------------------- |
| Puntuación | <…>                   |
| Vidas      | <… o "no se muestra"> |
| Nivel      | <…>                   |

Stats iniciales: <…>.

### Contrato de motor

> NOTA: solo si el juego no encaja en `score` / `lives` / `level`. Tipos nuevos de `games/types.ts` y cómo los usa `game-player.tsx`, sin cambiar Asteroides.

### Paleta del canvas

Todos los trazos usan `shadowBlur` con su propio color. Fondo negro; las scanlines y la viñeta las pone `.crt-screen`.

| Elemento         | Color                                    |
| ---------------- | ---------------------------------------- |
| <…>              | <…>                                      |
| Textos de inicio | Cian el título, tinta tenue el subtítulo |

Los textos del canvas usan la `font-family` computada del canvas (la mono de la app).

### Fila en `public.games`

> NOTA: el `insert` de `integration-checklist.md` §6 con los valores reales y el siguiente `sort_order`.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. <Si se toca UI: antes de tocar `game-player.tsx` se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.>

1. Crear `games/<id>/constants.ts` y `games/<id>/entities.ts` <…>. Todavía no se usan.
2. Crear `games/<id>/engine.ts` con `create<Name>Game`: bucle, input, fases, colisiones, <niveles>, callbacks. Buffer `W·dpr × H·dpr` con `ctx.scale(dpr, dpr)`.
3. Input del motor: <reglas del checklist §1 con las teclas del juego>.
4. Fase `paused` y métodos `pause`, `resume`, `end`, `reset` y `destroy`. Al perder, `over` tras <N> s.
5. <Si aplica: extender `games/types.ts` y `components/game-player.tsx`.>
6. Crear `components/<id>-canvas.tsx` con el patrón de `components/asteroids-canvas.tsx` y añadirlo a `ENGINES` en `games/registry.ts`.
7. Crear `supabase/migrations/<timestamp>_add_<id>_game.sql`, aplicarla con el MCP `apply_migration` (mismo nombre) y ejecutar `get_advisors` (security).
8. Capturar `public/covers/<id>.webp` como en `integration-checklist.md` §7 y comprobar que mide 800×600.

## Criterios de aceptación

> NOTA: los base de `integration-checklist.md` §8 adaptados, más los propios del juego con números concretos.

- [ ] <…>

## Decisiones

- **Sí:** <…>. **No:** <…>. <justificación breve>
- **Sí:** catálogo, puntuaciones y leaderboard de SPEC 06–07 sin cambios de esquema. **No:** tablas propias del juego.
- **Sí:** el HUD lo pinta React con datos del motor. **No:** HUD dentro del canvas.
- **Sí:** solo teclado. **No:** controles táctiles ahora.
- <decisión sobre assets, sonido, aspecto, contrato>

## Riesgos

| Riesgo                                               | Mitigación |
| ---------------------------------------------------- | ---------- |
| <base de `integration-checklist.md` §9 que apliquen> | <…>        |
| <propios del juego>                                  | <…>        |

## Lo que **no** está en este spec

- <repetir "Fuera de alcance" en lista corta>

Cada uno, si llega, va en su propio spec.
```
