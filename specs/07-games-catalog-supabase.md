# SPEC 07 — Catálogo de juegos en Supabase: ASTEROIDES como único juego

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-11-24
> **Objetivo:** Leer el catálogo de juegos desde una tabla `public.games` de Supabase, con ROCAS renombrado a ASTEROIDES (id `asteroides`) como único juego y una captura real del juego como portada, eliminando la constante `GAMES` y los otros 7 juegos del código.

## Por qué existe este spec

Hoy el catálogo es la constante `GAMES` de `lib/games.ts`: 8 juegos, de los que solo ROCAS es jugable. Los otros 7 son portadas CSS y textos que no llevan a ningún juego. SPEC 06 dejó escrito "el catálogo sigue en código; la BD no tiene tabla de juegos". Este spec revierte esa decisión: los juegos pasan a la BD, se empieza solo con el que existe, y se renombra a ASTEROIDES.

Estado actual en Supabase: `public.profiles` y `public.player_stats` (1 fila con `game_id = 'rocas'`, que hay que conservar).

## Alcance

**Dentro:**

- Migración versionada `supabase/migrations/<timestamp>_create_games.sql`, aplicada al remoto con el MCP `apply_migration`. Hace lo siguiente:
  - Crea la tabla `public.games`, con RLS de solo lectura pública.
  - Inserta la fila de ASTEROIDES.
  - Renombra `game_id` `'rocas'` → `'asteroides'` en `player_stats`, conservando récords y partidas.
  - Añade la FK `player_stats.game_id → games.id`.
  - Hace que `start_game` y `submit_score` validen contra `games`: el juego debe existir y tener `playable = true`.
- Tipos regenerados en `lib/supabase/database.types.ts`.
- `lib/games.ts` lee el catálogo de la BD con `"use cache"`, `cacheTag("games")` y `cacheLife("minutes")`. Desaparecen `GAMES`, `CATEGORIES` y los 7 juegos no jugables.
- Registro de motores en código (`games/registry.ts`): id → componente canvas. Un juego es jugable si tiene `playable = true` en la BD **y** un motor registrado. Si no, se ve PRÓXIMAMENTE.
- `GamePlayer` deja de usar `AsteroidsCanvas` de forma fija y toma el motor del registro. Hay un contrato común de motor en `games/types.ts`.
- Portada como imagen estática:
  - `public/covers/asteroides.webp`, 800×600, captura del canvas a mitad de partida (nave, asteroides y disparos), sin HUD.
  - La BD guarda solo el nombre del archivo (`cover_image = 'asteroides.webp'`) y la app arma `/covers/{cover_image}`.
  - Si `cover_image` es `null` o la imagen no carga, se ve un fondo oscuro con el título en pixel font.
- Nuevo componente `components/game-cover.tsx`, usado en la tarjeta de `/library`, la miniatura de la home y la portada del detalle.
- Se borran todas las clases CSS de portada de `app/globals.css` (`.cover-bg`, `.cover-bricks`, `.cover-tetro`, `.cover-snake`, `.cover-glot`, `.cover-invaders`, `.cover-rocas`, `.cover-rana` y sus pseudo-elementos, y cualquier otra `.cover-*` generadora).
- Renombrado visible: título ASTEROIDES en la BD, en el texto de la pantalla de inicio del canvas (`games/asteroids/engine.ts`) y en el `aria-label` del canvas.
- Las URLs pasan a ser `/games/asteroides` y `/games/asteroides/play`. `/games/rocas` da 404.
- Filtros de `/library`: TODOS más las categorías que tienen al menos un juego, en orden de aparición. Hoy serían TODOS y SHOOTER.
- Pestañas de `/hall-of-fame`, previsualización y contador "JUEGOS" de la home: salen de la BD.
- Estados de error de lectura del catálogo:
  - `/library`, `/hall-of-fame` y la sección de juegos de la home muestran "[ERR] NO SE PUDO CARGAR EL CATÁLOGO." y registran el error con `console.error`.
  - `/games/[id]` y `/games/[id]/play` lanzan el error y lo captura `app/games/[id]/error.tsx`.

**Fuera de alcance (para futuros specs):**

- Panel de administración de juegos. El catálogo se edita desde el dashboard o con SQL.
- Volver a añadir los otros 7 juegos (cada uno llegará con su motor).
- Redirección de `/games/rocas` a `/games/asteroides`.
- Subir portadas a Supabase Storage.
- Optimización de imágenes (`images.unoptimized` sigue en `true`).
- Los datos mock de la home (`RECENT_SCORES`, `TOP_PLAYERS`, que mencionan Caída, Glotón, etc.).
- Limpiar la entrada `rocas` que quede en `av_best` del `localStorage` de cada usuario. Es inofensiva: solo hace que la primera partida en `asteroides` consulte la BD.
- Campos de juego que hoy están fijos en el detalle ("1 JUGADOR", "TECLADO", "RETRO 1985").
- Tests automatizados.

## Modelo de datos

### Base de datos

`supabase/migrations/<timestamp>_create_games.sql`:

```sql
create table public.games (
  id text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  title text not null check (char_length(title) between 1 and 32),
  short_description text not null,
  long_description text not null,
  category text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  cover_image text check (cover_image ~ '^[a-z0-9-]{1,64}\.(webp|png|jpg)$'), -- solo el nombre del archivo en public/covers/
  playable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are readable by everyone"
  on public.games for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: el catálogo se edita desde el dashboard o con SQL.

insert into public.games
  (id, title, short_description, long_description, category, color, cover_image, playable, sort_order)
values (
  'asteroides',
  'ASTEROIDES',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir los asteroides en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
  'SHOOTER',
  'yellow',
  'asteroides.webp',
  true,
  1
);

-- Conservar récords y partidas de ROCAS.
update public.player_stats set game_id = 'asteroides' where game_id = 'rocas';

-- El formato del id lo valida ahora games.id.
alter table public.player_stats drop constraint player_stats_game_id_check;

alter table public.player_stats
  add constraint player_stats_game_id_fkey
  foreign key (game_id) references public.games (id)
  on update cascade      -- renombrar un juego arrastra sus puntuaciones
  on delete restrict;    -- no se puede borrar un juego con puntuaciones

create index player_stats_game_id_idx on public.player_stats (game_id);
```

- El `update` corre antes de crear la FK. Si `player_stats` tuviera un `game_id` distinto de `rocas`, la FK fallaría y la migración entera se desharía. Hoy solo existe `rocas`. El nombre real del check se confirma con `list_tables` antes de aplicar.
- `create or replace` de `public.start_game` y `public.submit_score`. Conservan el cuerpo de SPEC 06 (firma, `security definer`, `search_path = ''`, grants) y añaden, justo después de la comprobación de `auth.uid()`:

```sql
  if not exists (
    select 1 from public.games g where g.id = p_game_id and g.playable
  ) then
    raise exception 'invalid game';
  end if;
```

### Catálogo en el servidor

`lib/games.ts`:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string; // short_description
  long: string; // long_description
  category: GameCategory;
  color: GameColor;
  coverImage: string | null; // nombre del archivo, p. ej. "asteroides.webp"
  playable: boolean; // playable de la BD && hasEngine(id)
};

export const GAMES_TAG = "games";

// "use cache" + cacheTag(GAMES_TAG) + cacheLife("minutes"), con createPublicClient().
// Ordenado por sort_order y luego id. Lanza si Supabase falla.
export async function getGames(): Promise<Game[]>;

// Busca en getGames(). undefined si no existe. Lanza si Supabase falla.
export async function getGame(id: string): Promise<Game | undefined>;

export function coverUrl(game: Game): string | null; // "/covers/asteroides.webp" o null

// "TODOS" + categorías presentes, en orden de aparición.
export function categoriesOf(games: Game[]): ("TODOS" | GameCategory)[];
```

- El mapeo descarta las filas con `category` o `color` desconocidos y lo registra con `console.error`. Con los checks de la BD no debería ocurrir.
- `playable` se calcula al mapear: `row.playable && hasEngine(row.id)`. Así el reproductor, la etiqueta PRÓXIMAMENTE y las Server Actions usan la misma regla.

### Registro de motores

`games/types.ts`, el contrato que cumple cualquier motor:

```ts
export type EngineStats = { score: number; lives: number; level: number };
export type EnginePhase = "ready" | "playing" | "dead" | "paused" | "over";
export type EngineHandle = {
  pause(): void;
  resume(): void;
  end(): void;
  reset(): void;
};
export type EngineCanvasProps = {
  ref?: Ref<EngineHandle>;
  onStats: (stats: EngineStats) => void;
  onPhase: (phase: EnginePhase) => void;
};
```

- `AsteroidsStats`, `AsteroidsPhase` y `AsteroidsCanvasHandle` pasan a ser alias de estos tipos.

`games/registry.ts`:

```ts
export const ENGINES: Record<string, ComponentType<EngineCanvasProps>> = {
  asteroides: AsteroidsCanvas,
};

export function hasEngine(id: string): boolean;
```

- `GamePlayer` hace `const Engine = ENGINES[game.id]` y renderiza `<Engine ref={gameRef} onStats={…} onPhase={…} />`. La página `/play` solo monta `GamePlayer` si `game.playable`, así que `Engine` siempre existe ahí.

### Portada

`components/game-cover.tsx` (cliente):

```tsx
export function GameCover({ game }: { game: Game }): JSX.Element;
```

- Con `coverUrl(game)`: `<img src alt="Portada de {title}" loading="lazy">`, que ocupa el contenedor con `object-fit: cover`.
- Sin imagen, o si salta `onError`: un `div` con fondo oscuro y el título centrado en pixel font, con el color del juego (`game.color`).
- La usan `.card .cover` (`game-card.tsx`), `.mini-cover` (`home.tsx`) y `.detail-cover` (`app/games/[id]/page.tsx`). Todos los contenedores son 4:3, igual que la imagen.

Archivo: `public/covers/asteroides.webp`, 800×600. Se obtiene con Playwright en `/games/rocas/play`, antes de la migración. Se empieza una partida, se juega unos segundos hasta que haya asteroides partidos y disparos en pantalla, y se ejecuta `canvas.toDataURL("image/webp", 0.9)` sobre el canvas, que da su resolución interna de 800×600 sin el HUD de React. El resultado se decodifica y se guarda.

## Plan de implementación

Antes de escribir código se leen en `node_modules/next/dist/docs/` la directiva `use cache`, `cacheTag.md`, `cacheLife.md`, `generate-static-params.md` (con Cache Components debe devolver al menos un parámetro) y `03-file-conventions/error.md`. Antes de tocar `game-cover.tsx`, `game-card.tsx`, `home.tsx`, el detalle, `error.tsx` y los estados de error se invoca `/frontend-design` (instrucción de `CLAUDE.md`).

Los pasos 2 a 4 se hacen seguidos: entre la migración y el cambio de código, el juego `rocas` del código ya no existe en la BD y el guardado de puntuaciones falla.

1. Capturar `public/covers/asteroides.webp` como se describe en "Portada". Comprobar que mide 800×600.
2. Crear `supabase/migrations/<timestamp>_create_games.sql`:
   - Confirmar antes con `list_tables` el nombre del check de `player_stats.game_id`.
   - Aplicarla con `apply_migration` (mismo nombre).
   - Ejecutar `get_advisors` (security y performance) y corregir lo que reporte sobre `games`, `player_stats`, `start_game` y `submit_score`.
3. Regenerar `lib/supabase/database.types.ts` con `generate_typescript_types`.
4. Catálogo y motores:
   - Crear `games/types.ts` y `games/registry.ts`, y hacer que los tipos de Asteroids sean alias.
   - Reescribir `lib/games.ts` como en el modelo de datos.
   - Adaptar los consumidores a `await getGames()` / `await getGame(id)`: `app/games/[id]/page.tsx`, `app/games/[id]/play/page.tsx` (incluidos `generateStaticParams` y `generateMetadata`) y `app/games/[id]/play/actions.ts`, que valida con `game?.playable`.
   - `GamePlayer` usa `ENGINES[game.id]`.
5. Renombrar el texto "ROCAS" del canvas (`engine.ts`) y el `aria-label` (`asteroids-canvas.tsx`) a "ASTEROIDES".
6. Crear `components/game-cover.tsx` y usarlo en la tarjeta, la home y el detalle. Borrar de `globals.css` `.cover-bg` y todas las clases `.cover-*` generadoras, y añadir los estilos de la imagen y del fondo de respaldo.
7. Librería: `app/library/page.tsx` lee `getGames()` y `getGameStats()` dentro del `<Suspense>` existente y pasa `games` a `Library`. `Library` filtra sobre `games` y pinta los chips con `categoriesOf(games)`. Si `getGames()` lanza: `console.error` y "[ERR] NO SE PUDO CARGAR EL CATÁLOGO." en lugar de la grilla.
8. Salón de la Fama: `app/hall-of-fame/page.tsx` lee `getGames()` y pasa `games` a `HallOfFame`. Las pestañas y la pestaña inicial (`games[0]`) salen de ahí. Si falla: el mismo mensaje `[ERR]`.
9. Home: `app/page.tsx` lee `getGames()` dentro de un `<Suspense>` y pasa `games` a `Home`. La previsualización usa `games.slice(0, 6)` y el contador muestra `{games.length}+ JUEGOS`. Si falla: la sección de juegos muestra el mensaje `[ERR]` y el contador `—`.
10. Crear `app/games/[id]/error.tsx` (cliente): "[ERR] NO SE PUDO CARGAR EL JUEGO.", botón REINTENTAR (`reset`) y VOLVER AL VAULT. Registra el error con `console.error`.
11. Borrar `GAMES`, `CATEGORIES`, el campo `cover` y cualquier import restante. Comprobar con `grep` que el repo (fuera de `references/` y `specs/`) no contiene `rocas`, `ROCAS`, `GAMES` ni `cover-`.

## Criterios de aceptación

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/library`, `/games/asteroides`, `/games/asteroides/play` y `/hall-of-fame`.
- [x] `list_migrations` muestra la migración de `games` aplicada en el remoto, y `supabase/migrations/` la contiene.
- [x] `public.games` tiene RLS activado y una sola fila (`asteroides`, `playable = true`, `cover_image = 'asteroides.webp'`).
- [x] `get_advisors` (security) no reporta avisos sobre `games`, `player_stats`, `start_game` ni `submit_score`.
- [x] `lib/supabase/database.types.ts` contiene la tabla `games`.
- [x] `player_stats` no tiene filas con `game_id = 'rocas'`. La fila que existía conserva `max_score = 24830` y `games_played` con `game_id = 'asteroides'`.
- [x] Un `insert` en `player_stats` con un `game_id` que no existe en `games` falla por la FK.
- [x] Un `insert`, `update` o `delete` en `games` con la publishable key, con o sin sesión, es rechazado por RLS.
- [x] `start_game('rocas')` y `submit_score('rocas', 100)` con sesión lanzan `invalid game`.
- [x] `/library` muestra una sola tarjeta, ASTEROIDES, con la imagen `/covers/asteroides.webp`, y los chips TODOS y SHOOTER.
- [x] La home muestra solo ASTEROIDES en "JUEGOS DISPONIBLES AHORA" y "1+ JUEGOS" en el contador.
- [x] `/hall-of-fame` muestra una sola pestaña, ASTEROIDES, con el ranking de SPEC 06 (incluido el récord de 24.830).
- [x] `/games/asteroides` muestra la imagen de portada, el título ASTEROIDES, la descripción de la BD, el leaderboard, "Mejor global" y "Partidas".
- [x] `/games/asteroides/play` es jugable. La pantalla de inicio del canvas dice ASTEROIDES. Empezar una partida con sesión suma 1 a `games_played` de `asteroides`, y un récord nuevo actualiza `max_score`.
- [x] `/games/rocas`, `/games/rocas/play`, `/games/caida` y `/games/bloque-buster` devuelven 404.
- [x] `public/covers/asteroides.webp` existe, mide 800×600 y muestra una partida en curso sin HUD.
- [x] Con `cover_image` puesto a `null` en la BD (y la caché caducada), la tarjeta, la home y el detalle muestran el fondo oscuro con el título. Con un nombre de archivo que no existe, también.
- [x] Con `playable = false` en la BD, `/games/asteroides/play` muestra PRÓXIMAMENTE y `submitScore` devuelve "PUNTUACIÓN NO VÁLIDA.". Se restaura a `true` al terminar.
- [x] Un cambio de `title` en la BD aparece en `/library` en, como mucho, unos minutos sin reiniciar el servidor (`cacheLife("minutes")`).
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` vacía (en `npm run dev`), `/library`, `/hall-of-fame` y la home muestran "[ERR] NO SE PUDO CARGAR EL CATÁLOGO.". `/games/asteroides` muestra "[ERR] NO SE PUDO CARGAR EL JUEGO." con REINTENTAR, y el servidor registra el motivo.
- [x] `app/globals.css` no contiene `.cover-bg` ni ninguna clase `.cover-*` generadora.
- [x] Fuera de `references/` y `specs/`, el repo no contiene `rocas`, `ROCAS`, `GAMES` ni `CATEGORIES`.

## Decisiones

- **Sí:** tabla `public.games` como fuente del catálogo. **No:** mantener `GAMES` en código, que era la decisión de SPEC 06 y se revierte aquí.
- **Sí:** solo ASTEROIDES en la BD. **No:** los otros 7 como PRÓXIMAMENTE, ni mezclar fuentes (BD y código). Un juego entra en la tabla cuando tiene motor.
- **Sí:** id `asteroides`, con las filas de `player_stats` renombradas en la misma migración. **No:** dejar el id `rocas` con otro título, que dejaría la URL y el id desalineados con el nombre. **No:** redirección desde `/games/rocas` por ahora.
- **Sí:** FK `player_stats.game_id → games.id` con `on update cascade` y `on delete restrict`. Así renombrar un juego en el futuro no rompe nada, y borrar uno con puntuaciones falla en vez de perderlas.
- **Sí:** `start_game` y `submit_score` validan contra `games` (existe y es jugable). La Server Action también lo valida, ahora con el catálogo de la BD.
- **Sí:** registro de motores en código por id, y jugable = `playable` de la BD **y** motor registrado. **No:** que `GamePlayer` use siempre `AsteroidsCanvas`, porque cargaría Asteroides para cualquier juego marcado como jugable.
- **Sí:** contrato común de motor (`games/types.ts`), con los tipos de Asteroids como alias. Es lo mínimo para que el registro tenga un tipo; no se añaden más capacidades.
- **Sí:** columnas `short_description` y `long_description` en la BD, y `short` / `long` en `Game`. **No:** renombrar los campos de `Game`, que obligaría a tocar todos los componentes sin ganar nada.
- **Sí:** `category` y `color` como `text` con `check`. **No:** enums de Postgres, que son más difíciles de modificar con migraciones.
- **Sí:** `sort_order` para controlar el orden sin depender del id.
- **Sí:** portada como imagen estática en `public/covers/`, con el nombre en `cover_image`. **No:** guardar la ruta completa, que permitiría apuntar a cualquier sitio; el `check` limita el nombre a `[a-z0-9-].(webp|png|jpg)`. **No:** Supabase Storage, por ahora.
- **Sí:** WebP 800×600 sacado con `canvas.toDataURL`, que da la resolución interna exacta y deja fuera el HUD. **No:** captura de pantalla del navegador, que depende del tamaño de la ventana.
- **Sí:** `cover_image` nullable con fondo de respaldo (título en pixel font), también si la imagen falla. **No:** imagen obligatoria, que mostraría una imagen rota.
- **Sí:** borrar todas las portadas CSS. El prototipo de `references/` las conserva.
- **Sí:** `"use cache"` + `cacheTag("games")` + `cacheLife("minutes")` con el cliente sin cookies. Un cambio en la BD tarda como mucho unos minutos en verse. **No:** invalidación manual con `updateTag`, porque no hay panel de administración que la dispare.
- **Sí:** `generateStaticParams` desde la BD. Con Cache Components debe devolver al menos un juego, así que si Supabase falla durante el build, el build falla. **No:** atrapar el error y devolver un parámetro inventado.
- **Sí:** chips de categoría derivados de los juegos presentes. **No:** las 5 categorías fijas, que con un solo juego dejarían 3 chips vacíos.
- **Sí:** en listados, mensaje `[ERR]` en la página. En detalle y reproductor, `error.tsx` con REINTENTAR. **No:** tratar el error como catálogo vacío o 404, que ocultaría la caída de la BD.

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase no responde durante `npm run build` y `generateStaticParams` lanza                                    | El build falla con el motivo y no publica páginas rotas. Se reintenta el build.                                                                                              |
| Entre la migración (paso 2) y el cambio de código (paso 4), el código sigue usando `rocas` y el guardado falla | Los pasos 2 a 4 se hacen seguidos, en la misma sesión. Ningún usuario real usa todavía el entorno.                                                                           |
| Hay filas en `player_stats` con un `game_id` distinto de `rocas` y la FK no se puede crear                     | La migración es transaccional y se deshace entera. Se revisa antes con una consulta y se decide qué hacer con esas filas.                                                    |
| El nombre del check de `player_stats.game_id` no es `player_stats_game_id_check`                               | Se confirma con `list_tables` antes de aplicar (paso 2).                                                                                                                     |
| Un juego con `playable = true` en la BD pero sin motor en el registro                                          | Se calcula como no jugable: muestra PRÓXIMAMENTE y las Server Actions lo rechazan. La función de la BD lo aceptaría, pero solo se llega a ella a través de la Server Action. |
| Un error de lectura queda guardado en la caché                                                                 | `getGames` lanza, y los errores no se cachean. Los consumidores lo capturan fuera de la función cacheada.                                                                    |
| La entrada `rocas` de `av_best` queda en el `localStorage` de cada usuario                                     | Es inofensiva. `asteroides` no tiene copia en caché, así que la primera partida consulta la BD y la crea.                                                                    |

## Lo que **no** está en este spec

- Panel de administración del catálogo.
- Los otros 7 juegos.
- Redirección de `/games/rocas`.
- Portadas en Supabase Storage y optimización de imágenes.
- Datos mock de la home.
- Limpieza de `av_best`.
- Etiquetas fijas del detalle.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
