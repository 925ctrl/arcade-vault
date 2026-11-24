---
name: new-game
description: Genera el spec de un juego nuevo para Arcade Vault (motor canvas, registro, fila en public.games, portada, leaderboard y récords), siguiendo el patrón de SPEC 05–07. El juego puede venir de references/started-games/ o ser una idea nueva. Solo escribe el spec; se implementa después con /spec-impl.
disable-model-invocation: true
argument-hint: "<carpeta de references/started-games> | descripción del juego"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(grep:*), Bash(head:*)
---

# /new-game — Spec de un juego nuevo integrado en la plataforma

## Contexto de sesión

Fecha de hoy (úsala en la cabecera del spec, nunca la inventes):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Juegos ya insertados en `public.games` por migraciones (ids y `sort_order` usados):
!`grep -h -A12 "insert into public.games" supabase/migrations/*.sql 2>/dev/null || echo "Ninguno"`

Motores registrados:
!`cat games/registry.ts 2>/dev/null || echo "No existe games/registry.ts"`

Contrato actual de motor:
!`cat games/types.ts 2>/dev/null || echo "No existe games/types.ts"`

Skill `/spec` instalado (ruta que se lee en la Fase 1):
!`ls .claude/skills/spec/SKILL.md .agents/skills/spec/SKILL.md ~/.claude/skills/spec/SKILL.md ~/.agents/skills/spec/SKILL.md 2>/dev/null | head -1 | grep . || echo "No se encontró el skill /spec"`

---

Este skill produce **un solo archivo**: `specs/NN-<slug>.md`, el spec de un juego nuevo listo para `/spec-impl`. **No escribes código, no creas migraciones y no tocas la base de datos.** Tu trabajo es entender el juego, preguntar lo que no esté claro y escribir un spec con el mismo formato, idioma y rigor que SPEC 05, 06 y 07.

`/new-game` es una especialización de `/spec` para juegos. El skill `/spec` (su `SKILL.md` y su `template.md`) es la **referencia base** del método: fases, forma de preguntar, cuándo parar, estructura del spec, numeración, guardado, `specs/.spec-config.yml` y reglas duras. Este skill solo añade lo específico de integrar un juego en Arcade Vault. Si los dos chocan, gana lo concreto de este skill (p. ej. el estado `Borrador`, los specs de referencia, el checklist de integración); en todo lo demás, se sigue `/spec`.

Archivos de apoyo en este mismo directorio:

- `integration-checklist.md`: qué necesita un juego para integrarse (motor, componente, registro, BD, portada, criterios y riesgos base). Todo spec generado lo cubre entero.
- `spec-skeleton.md`: estructura del spec con marcadores `<…>`.

Responde siempre en español. Archivos, identificadores y código, en inglés (`CLAUDE.md`). Textos de UI, en español.

## Fase 1 — Contexto del proyecto

0. **Lee el skill `/spec` antes que nada.** Lee entero el `SKILL.md` de la ruta que muestra el contexto de sesión y el `template.md` del mismo directorio. Si no se encontró, detente y pide instalarlo (`npx skills@latest add Klerith/fernando-skills`); no generes el spec sin él.
1. Lee `CLAUDE.md`.
2. Lee `specs/05-asteroids-game.md`, `specs/06-supabase-scores.md` y `specs/07-games-catalog-supabase.md`. Son el modelo de formato, de tono y de nivel de detalle. Si hay specs de juegos posteriores a SPEC 07, léelos también: pueden haber extendido el contrato.
3. Lee `integration-checklist.md` y `spec-skeleton.md`.
4. Lee el código del juego ya integrado para usar nombres reales y no inventarlos: la API de `games/asteroids/engine.ts` (tipos y `createAsteroidsGame`), `components/asteroids-canvas.tsx`, `components/game-player.tsx` (HUD y fases) y `lib/games.ts`.

## Fase 2 — Origen del juego

El argumento recibido es: `$ARGUMENTS`

- **Vacío:** pregunta qué juego quieres añadir y ofrece las carpetas de `references/started-games/` del contexto de sesión.
- **Coincide con una carpeta de `references/started-games/`** (por nombre exacto o sin el prefijo numérico, p. ej. `tetris` → `03-tetris`): es un port. Lee de esa carpeta `CLAUDE.md`, `README.md`, todo el JS (`game.js`, `levels.js`, …), sus `specs/` si existen, y lista `assets/`. Extrae y anota:
  - Tamaño del mundo lógico y relación de aspecto.
  - Entidades, constantes (velocidades, tamaños, tiempos) y reglas exactas.
  - Sistema de puntos, vidas, niveles y condición de fin.
  - Controles y estados/pantallas propias.
  - Assets (sprites, sonidos, fuentes) y si el juego depende de ellos.
  - Lo que la referencia hace distinto del contrato de la plataforma (p. ej. reinicio con `Espacio` en game over, HUD dentro del canvas, colores blancos).
- **Cualquier otra cosa:** es un juego nuevo descrito por el usuario. No hay reglas de partida: en la Fase 3 tendrás que preguntar las mecánicas con más detalle.

Si el juego se parece a un título comercial concreto, el spec define un juego **original del mismo género**: título propio en español, sin nombres, personajes, arte ni niveles de ese juego (como ASTEROIDES respecto al clásico).

## Fase 3 — Preguntas

Sigue la "Phase 2 — Clarify through questions" de `/spec` (categorías, cómo formular, cuándo parar). Además de sus categorías, aquí se cubren las de juego que siguen.

Pregunta en bloques de 3 a 5 con `AskUserQuestion`, con la opción recomendada primero y marcada "(Recomendado)". Espera la respuesta antes del siguiente bloque. No preguntes lo que ya responden la referencia, SPEC 05–07 o el checklist.

Cubre siempre:

1. **Identidad:** `id` (kebab-case, `^[a-z0-9-]{1,32}$`, que no esté ya en las migraciones), título en español (1–32 caracteres), `category` (`ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`), `color` (`cyan` | `magenta` | `yellow` | `green`). Propón tú la descripción corta y la larga.
2. **HUD:** ¿el juego tiene vidas y niveles? Si no encaja en `score` / `lives` / `level` (p. ej. Tetris no tiene vidas), propón la extensión genérica del contrato descrita en el checklist, salvo que un spec anterior ya la haya hecho (mira `games/types.ts` en el contexto).
3. **Reglas:** cuáles de la referencia se mantienen tal cual, cuáles cambian y si se añade alguna mecánica (como los OVNIs en SPEC 05). En un juego nuevo: entidades, puntuación, dificultad, condición de fin.
4. **Mundo y aspecto:** tamaño lógico. Recomienda 4:3 (800×600), que es el de `.crt-screen` y de las portadas; si la referencia no lo es, pregunta si se adapta o se encaja con bandas.
5. **Assets y sonido:** si la referencia trae sprites o sonidos, ¿se copian a `public/games/<id>/` o se redibuja en vectores neón? Recomendación por defecto: vectores neón y sonido fuera de alcance (como SPEC 05), salvo que el juego dependa de ellos.
6. **Controles:** solo teclado. `Espacio` empieza desde la pantalla de inicio y `P` / `Escape` pausan; si el juego necesita `Espacio` para otra cosa, decide cómo convive. Táctil y gamepad, fuera de alcance por defecto.

Si alguna respuesta abre algo grande (multijugador, editor de niveles, sonido completo, controles táctiles), propón dejarlo para otro spec.

Para de preguntar cuando puedas responder sin suponer:

- Qué archivos aparecen o cambian.
- Cuál es el primer paso ejecutable y cuál el último.
- Cómo se verifica que el juego está terminado.

## Fase 4 — Escribir y guardar el spec

Antes de crear el archivo, vuelve a repasar "Phase 3 — Write the spec", "Phase 4 — Save the spec" y "Hard rules" del `SKILL.md` de `/spec`, y "Global rules about the whole document" de su `template.md`, y aplícalas junto con lo siguiente. `spec-skeleton.md` es `template.md` adaptado a juegos: la estructura de secciones y su orden salen de `template.md`; los contenidos de juego, del esqueleto y del checklist.

1. Número: el mayor de `specs/` + 1, con dos dígitos. Slug en kebab-case a partir del objetivo (p. ej. `08-tetris-game.md`). Si el archivo ya existe, pregunta.
2. Escribe el spec completo siguiendo `spec-skeleton.md` y cubriendo **todo** `integration-checklist.md`:
   - Cabecera con `**Estado:** Borrador`, la fecha del contexto de sesión y `**Depende de:** SPEC 05, SPEC 06, SPEC 07` (más cualquier spec posterior que extendiera el contrato). Comprueba que cada spec citado existe.
   - Objetivo en una sola frase. Si no cabe, el juego es demasiado grande: propón dividirlo.
   - Reglas de la referencia con valores numéricos concretos, no "como en la referencia".
   - Plan de implementación en pasos que dejan `npm run dev` y `npm run lint` funcionando, en el orden del checklist (motor → componente → registro → contrato si hace falta → migración → portada).
   - Criterios de aceptación booleanos: los base del checklist adaptados al juego, más los propios de sus reglas (con números: "un bloque suma 50", "al limpiar 10 líneas el HUD pasa a nivel `02`").
   - Decisiones **Sí/No** con justificación y riesgos en tabla.
3. Escribe el archivo directamente, sin pedir permiso ni confirmar el nombre. No lo marques como aprobado. Si falta `specs/.spec-config.yml`, créalo como indica `/spec`; si existe, no lo toques.
4. Confirma al usuario:
   - Ruta del archivo.
   - Que está en `Borrador`: cuando lo revise, que cambie el estado a `Aprobado`.
   - Siguiente paso: `/spec-impl NN-<slug>`.
   - **Para aquí.** No propongas implementarlo.

## Reglas duras

- Nunca escribas el spec sin haber leído antes `SKILL.md` y `template.md` de `/spec`. Sus reglas duras también aplican aquí.
- Nunca escribas código, migraciones ni archivos fuera de `specs/`. No llames a herramientas de Supabase ni de Playwright: eso lo hace `/spec-impl` siguiendo el spec.
- Un juego por spec.
- No reabras las decisiones de SPEC 05–07: catálogo en `public.games`, puntuaciones genéricas en `player_stats` con `start_game` / `submit_score`, motor TypeScript sin React, HUD pintado por React, guardado solo con sesión, portada estática en `public/covers/`. La única excepción permitida es la extensión genérica del contrato de motor cuando el juego la necesite.
- El juego nuevo no necesita cambios de esquema en la BD: solo una migración con el `insert` de su fila. Si crees que necesita otra cosa (tabla de niveles, otra métrica de ranking), señálalo y propón un spec aparte.
- La puntuación es siempre un entero entre 0 y 9.999.999 (límite de `submit_score`).
- No inventes nombres de archivos, tipos o funciones del proyecto: usa los que leíste en la Fase 1.
