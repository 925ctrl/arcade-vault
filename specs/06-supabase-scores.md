# SPEC 06 — Puntuaciones en Supabase: guardado, rankings y estadísticas reales

> **Estado:** Borrador
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-11-23
> **Objetivo:** Guardar en Supabase las partidas y puntuaciones de los jugadores con sesión, y mostrar desde la base de datos los rankings de `/games/[id]` y `/hall-of-fame`, el "Mejor global", el contador de partidas y el récord de las tarjetas de la librería, eliminando todos los datos mock de puntuación.

## Por qué existe este spec

Hoy todas las puntuaciones que ve el usuario son falsas o locales:

- El leaderboard de `/games/[id]` y el Salón de la Fama usan `seededScores` (`lib/games.ts`), una lista generada con una semilla.
- "Mejor global", "Partidas" y el récord de las tarjetas son los campos fijos `best` y `plays` de `GAMES`.
- GUARDAR PUNTUACIÓN escribe en `localStorage` (`av_scores`, `lib/storage.ts`), y solo "TU MEJOR MARCA" lo lee.

SPEC 04 dejó el usuario verificado y SPEC 05 el primer juego real (ROCAS). Este spec une las dos cosas: cada puntuación pertenece a una cuenta y todos los rankings salen de Supabase.

En Supabase solo existe `public.profiles`.

## Alcance

**Dentro:**

- Migración versionada con las tablas `public.plays` y `public.scores`, sus RLS, y las vistas `public.leaderboard` y `public.game_stats`. Se aplica al remoto con el MCP `apply_migration`.
- Tipos regenerados en `lib/supabase/database.types.ts`.
- Registro de partida: con sesión, al pulsar `Espacio` en la pantalla de inicio (fase `ready` → `playing`) se inserta una fila en `plays`. Los invitados no registran partidas.
- GUARDAR PUNTUACIÓN inserta en `scores` mediante una Server Action, ligada a la partida registrada. Una sola puntuación por partida.
- Protección básica: sesión obligatoria, RLS que solo permite filas con tu propio `user_id`, puntuación entera entre 0 y 9.999.999, y partida propia y del mismo juego.
- Rankings con **la mejor marca de cada jugador** (una fila por jugador y juego), desempate por la fecha más antigua.
- Leaderboard de `/games/[id]`: top 10 real.
- `/hall-of-fame`: podio y tabla top 12 reales por juego, y "TU MEJOR MARCA" con la posición real del usuario.
- "Mejor global" y "Partidas" del detalle, y "MEJOR PUNTUACIÓN" de las tarjetas de `/library`, reales.
- Estados vacíos: sin puntuaciones se muestra "SIN PUNTUACIONES TODAVÍA"; el podio muestra huecos `---`; "Mejor global" y el récord de las tarjetas muestran `—`; "Partidas" muestra `0`.
- Estados de error de lectura y de guardado.
- Se eliminan `seededScores`, `PLAYERS`, `ScoreRow`, los campos `best` y `plays` de `Game`, y `lib/storage.ts` completo (`av_scores`).

**Fuera de alcance (para futuros specs):**

- Anti-trampas real (validar la partida en servidor, replays, tiempos mínimos).
- Migrar las puntuaciones existentes de `av_scores`. Se ignoran.
- Contar partidas de invitados.
- Rankings por periodo (semana, mes), paginación o ver más allá del top.
- Perfil público del jugador o historial de partidas.
- Récord personal en el detalle del juego o en el HUD.
- Tiempo real (suscripciones de Supabase Realtime).
- Rate limit propio para `plays` y `scores`.
- Tests automatizados.

## Modelo de datos

### Base de datos

Migración `supabase/migrations/<timestamp>_create_scores.sql`:

```sql
create table public.plays (
  id uuid primary key default gen_random_uuid(),
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, game_id) -- destino de la FK compuesta de scores
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  play_id uuid not null unique, -- una puntuación por partida
  game_id text not null,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  score integer not null check (score between 0 and 9999999),
  created_at timestamptz not null default now(),
  foreign key (play_id, game_id) references public.plays (id, game_id) on delete cascade
);

create index plays_game_id_idx on public.plays (game_id);
create index scores_game_user_score_idx on public.scores (game_id, user_id, score desc, created_at);

alter table public.plays enable row level security;
alter table public.scores enable row level security;

-- Lectura pública: las vistas usan security_invoker y necesitan leer las tablas.
create policy "plays are readable by everyone"
  on public.plays for select to anon, authenticated using (true);
create policy "scores are readable by everyone"
  on public.scores for select to anon, authenticated using (true);

create policy "users insert their own plays"
  on public.plays for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users insert scores for their own plays"
  on public.scores for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.plays p
      where p.id = play_id and p.user_id = (select auth.uid())
    )
  );

-- Sin políticas de update/delete: las filas son inmutables.

-- Mejor marca de cada jugador por juego, con su posición.
create view public.leaderboard with (security_invoker = true) as
select
  best.game_id,
  best.user_id,
  best.username,
  best.score,
  best.created_at,
  row_number() over (
    partition by best.game_id order by best.score desc, best.created_at asc
  ) as rank
from (
  select distinct on (s.game_id, s.user_id)
    s.game_id, s.user_id, p.username, s.score, s.created_at
  from public.scores s
  join public.profiles p on p.id = s.user_id
  order by s.game_id, s.user_id, s.score desc, s.created_at asc
) best;

-- Partidas jugadas y récord por juego.
create view public.game_stats with (security_invoker = true) as
select
  g.game_id,
  coalesce(pl.plays, 0) as plays,
  sc.best
from (select game_id from public.plays union select game_id from public.scores) g
left join (select game_id, count(*) as plays from public.plays group by game_id) pl using (game_id)
left join (select game_id, max(score) as best from public.scores group by game_id) sc using (game_id);
```

Convenciones:

- `game_id` es el `id` de `GAMES` (`"rocas"`). El catálogo sigue en código; la BD no tiene tabla de juegos.
- La FK compuesta `(play_id, game_id)` garantiza que la puntuación es del mismo juego que la partida.
- `unique (play_id)` garantiza una sola puntuación por partida. Un segundo intento devuelve el error `23505`.
- Desempate: con la misma puntuación va primero quien la consiguió antes.

### Lectura de datos

`lib/supabase/public.ts`: `createPublicClient()` con `createClient<Database>` de `@supabase/supabase-js`, la publishable key y `auth: { persistSession: false }`. No lee cookies, así que se puede usar dentro de `"use cache"`.

`lib/scores.ts`:

```ts
export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
  date: string; // dd/mm/aaaa en UTC
};

export type GameStats = { plays: number; best: number | null };

export const SCORES_TAG = "scores";

// "use cache" + cacheTag(SCORES_TAG) + cacheLife("minutes"). Lanza si Supabase falla.
export async function getTopScores(
  limit: number,
): Promise<Record<string, LeaderboardEntry[]>>;
export async function getGameStats(): Promise<Record<string, GameStats>>;

// Sin caché (depende del usuario). Lee leaderboard con user_id = userId.
export async function getMyBests(
  userId: string,
): Promise<Record<string, LeaderboardEntry>>;

export function formatPlays(n: number): string; // 950 → "950", 1000 → "1K", 15600 → "15.6K", 2_300_000 → "2.3M"
```

- `getTopScores` hace una sola consulta: `leaderboard` con `rank <= limit`, ordenada por `game_id` y `rank`.
- Un juego sin entradas no aparece en el `Record`; los consumidores usan `?? []` o `?? { plays: 0, best: null }`.

### Server Actions

`app/games/[id]/play/actions.ts` (`"use server"`):

```ts
export type StartPlayResult =
  { status: "success"; playId: string } | { status: "error" };

export type SaveScoreResult =
  { status: "success" } | { status: "error"; message: string }; // en español, en mayúsculas

export async function startPlay(gameId: string): Promise<StartPlayResult>;
export async function saveScore(
  playId: string,
  score: number,
): Promise<SaveScoreResult>;
```

- `startPlay`: exige sesión y que `gameId` sea un juego de `GAMES` con `playable: true`. Inserta en `plays` y devuelve el `id`. No invalida la caché (el contador se refresca con `cacheLife`).
- `saveScore`: exige sesión, `playId` con formato UUID y `Number.isInteger(score)` entre 0 y 9.999.999. Lee el `game_id` de la partida e inserta en `scores`. En el éxito llama a `updateTag(SCORES_TAG)`.

Mensajes de `saveScore`:

| Caso                                                 | Mensaje                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Sin sesión                                           | "INICIA SESIÓN PARA GUARDAR."                                             |
| Puntuación o `playId` inválidos, o partida no propia | "PUNTUACIÓN NO VÁLIDA."                                                   |
| Violación de `unique (play_id)` (`23505`)            | "ESTA PARTIDA YA TIENE UNA PUNTUACIÓN GUARDADA."                          |
| Cualquier otro (incluido `startPlay` fallido)        | "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO." + `console.error` |

### Catálogo

`lib/games.ts`: `Game` pierde `best` y `plays`. Se borran `PLAYERS`, `ScoreRow` y `seededScores`.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir código se leen en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/` `cacheTag.md`, `cacheLife.md` y `updateTag.md`, y la directiva `use cache`. Antes de tocar `leaderboard.tsx`, `hall-of-fame.tsx`, `game-card.tsx`, el detalle y `game-player.tsx` se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.

1. Crear `supabase/migrations/<timestamp>_create_scores.sql` con el SQL del modelo de datos y aplicarlo con el MCP `apply_migration` (mismo nombre). Ejecutar `get_advisors` (security y performance) y corregir lo que reporte.
2. Regenerar los tipos con el MCP `generate_typescript_types` en `lib/supabase/database.types.ts`.
3. Crear `lib/supabase/public.ts` y `lib/scores.ts` con `getTopScores`, `getGameStats`, `getMyBests` y `formatPlays`. Todavía no se usan.
4. Crear `app/games/[id]/play/actions.ts` con `startPlay` y `saveScore`.
5. En `components/game-player.tsx`:
   - Con sesión, cuando `onPhase` pasa de `ready` a `playing`, llamar a `startPlay(game.id)` y guardar la promesa en un `ref`. JUGAR DE NUEVO vacía el `ref`.
   - GUARDAR PUNTUACIÓN espera esa promesa y llama a `saveScore(playId, score)` dentro de `useTransition`. Mientras tanto el botón está deshabilitado y dice "GUARDANDO…".
   - En el éxito se muestra el toast actual "▸ PUNTUACIÓN GUARDADA_" y el botón desaparece. En el error se muestra el mensaje en magenta con el prefijo `[ERR]` y el botón vuelve a estar activo.
   - Quitar `appendScore`.
6. Detalle `/games/[id]`:
   - `components/leaderboard.tsx` recibe `entries: LeaderboardEntry[]` (o un estado de error) y muestra "SIN PUNTUACIONES TODAVÍA" si está vacío.
   - La página lee `getTopScores(10)` y `getGameStats()` dentro de un `<Suspense>`. "Mejor global" muestra `best` o `—`; "Partidas" muestra `formatPlays(plays)`.
7. Librería: `app/library/page.tsx` lee `getGameStats()` dentro de un `<Suspense>` y pasa `stats` a `Library`, que lo pasa a `GameCard`. La tarjeta muestra el récord o `—`.
8. Salón de la Fama:
   - `app/hall-of-fame/page.tsx` lee `getTopScores(12)` y, dentro de un `<Suspense>`, `getSessionUser()` y `getMyBests(user.id)`. El fallback renderiza el salón sin "TU MEJOR MARCA".
   - `components/hall-of-fame.tsx` recibe `top` y `myBests` por props y conserva las pestañas en estado local. Deja de usar `useSyncExternalStore` y `localStorage`.
   - Podio con huecos `---` en las posiciones sin jugador. Tabla con las filas reales o "SIN PUNTUACIONES TODAVÍA".
   - "TU MEJOR MARCA EN …" usa `rank`, `score` y `date` de `myBests[tab]`, y solo aparece si existe.
9. Borrar `lib/storage.ts`, `seededScores`, `PLAYERS`, `ScoreRow` y los campos `best` / `plays` de `GAMES`. Ajustar los imports.
10. Error de lectura: si `getTopScores` o `getGameStats` lanzan, el componente que las consume registra el error con `console.error` y muestra "[ERR] NO SE PUDO CARGAR EL RANKING." en el leaderboard y el salón, y `—` en "Mejor global", "Partidas" y las tarjetas.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/library`, `/games/rocas`, `/games/rocas/play`, `/games/caida` y `/hall-of-fame`.
- [ ] `list_migrations` muestra la migración de `scores` aplicada en el remoto, y `supabase/migrations/` la contiene.
- [ ] `plays` y `scores` tienen RLS activado, y `get_advisors` (security) no reporta avisos sobre `plays`, `scores`, `leaderboard` ni `game_stats`.
- [ ] `lib/supabase/database.types.ts` contiene `plays`, `scores`, `leaderboard` y `game_stats`.
- [ ] Con sesión, pulsar `Espacio` en `/games/rocas/play` crea exactamente una fila en `plays` con `game_id = 'rocas'` y el `user_id` del usuario. Pausar, reanudar o perder una vida no crea más.
- [ ] Sin sesión, jugar una partida no crea filas en `plays`.
- [ ] Con sesión, GUARDAR PUNTUACIÓN crea una fila en `scores` con la puntuación del HUD y el `play_id` de esa partida, y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] Mientras se guarda, el botón dice "GUARDANDO…" y no se puede pulsar dos veces.
- [ ] Llamar dos veces a `saveScore` con el mismo `playId` deja una sola fila y la segunda devuelve "ESTA PARTIDA YA TIENE UNA PUNTUACIÓN GUARDADA.".
- [ ] `saveScore` con `-1`, `1.5`, `10000000` o el `playId` de otro usuario devuelve "PUNTUACIÓN NO VÁLIDA." y no inserta nada.
- [ ] Un insert directo con la publishable key y la sesión de un usuario en `scores` con el `user_id` de otro usuario es rechazado por RLS.
- [ ] Tras guardar, `/games/rocas` y `/hall-of-fame` (pestaña ROCAS) muestran la nueva puntuación sin reiniciar el servidor.
- [ ] Si un jugador tiene varias puntuaciones en ROCAS, el leaderboard y el salón muestran solo la mayor, una vez.
- [ ] Con dos jugadores empatados, aparece primero el que guardó antes.
- [ ] El leaderboard de `/games/rocas` muestra como máximo 10 filas, y la tabla del salón como máximo 12, ordenadas de mayor a menor.
- [ ] "TU MEJOR MARCA EN ROCAS" muestra la posición real del usuario en el ranking de mejores marcas, su username y la fecha de esa marca.
- [ ] Sin sesión, o sin puntuaciones en el juego activo, el salón no muestra "TU MEJOR MARCA".
- [ ] "Mejor global" de `/games/rocas` y "MEJOR PUNTUACIÓN" de la tarjeta de ROCAS coinciden con el `#01` del leaderboard.
- [ ] "Partidas" de `/games/rocas` coincide con `select count(*) from plays where game_id = 'rocas'` (con hasta un minuto de retraso), con el formato de `formatPlays`.
- [ ] `/games/caida` muestra "SIN PUNTUACIONES TODAVÍA", "Mejor global" `—` y "Partidas" `0`. Su tarjeta muestra `—`.
- [ ] La pestaña CAÍDA del salón muestra el podio con `---` y "SIN PUNTUACIONES TODAVÍA".
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, el detalle y el salón muestran "[ERR] NO SE PUDO CARGAR EL RANKING." y el servidor registra el motivo.
- [ ] El repo no contiene `seededScores`, `av_scores`, `appendScore` ni `lib/storage.ts`, y `Game` no tiene `best` ni `plays`.

## Decisiones

- **Sí:** guardar en Supabase y borrar `av_scores`. **No:** migrar las puntuaciones locales. No estaban ligadas a ninguna cuenta y se podían editar a mano.
- **Sí:** ranking con la mejor marca de cada jugador. **No:** todas las partidas. Un jugador no puede llenar el top.
- **Sí:** desempate por la fecha más antigua. Premia a quien llegó primero, como en los arcades.
- **Sí:** estados vacíos y fuera todos los mocks, también en los juegos "PRÓXIMAMENTE". **No:** mezclar datos falsos y reales.
- **Sí:** contar partidas jugadas con una tabla `plays`, insertada al pulsar `Espacio` (inicio de partida). Las partidas abandonadas también cuentan. **No:** contar solo las puntuaciones guardadas.
- **Sí:** solo cuentan las partidas con sesión. **No:** inserts anónimos, que cualquiera podría usar para inflar el contador.
- **Sí:** cada puntuación se liga a una partida (`play_id` único, FK compuesta con `game_id`). Es la protección básica: una puntuación por partida iniciada, del mismo juego y del mismo usuario. **No:** anti-trampas real, que va en su propio spec.
- **Sí:** filas inmutables, sin políticas de update ni delete.
- **Sí:** lectura pública de `plays` y `scores` para que las vistas funcionen con `security_invoker`. **No:** vistas `security definer` ni funciones RPC, que saltan RLS y el advisor las marca. Los usernames y puntuaciones ya son públicos; `plays` solo expone qué cuenta jugó y cuándo.
- **Sí:** vistas `leaderboard` y `game_stats` en Postgres. **No:** agregar en Next. PostgREST no tiene agregados activados por defecto, y así la posición (`rank`) se calcula en un solo sitio.
- **Sí:** el catálogo sigue en `GAMES`. **No:** tabla `games`. Los juegos se definen en código junto a su motor; `game_id` se valida en la Server Action y con un `check` de formato.
- **Sí:** lecturas públicas con `"use cache"`, `cacheTag("scores")` y `cacheLife("minutes")`, y `updateTag` al guardar. Los rankings se actualizan al instante tras guardar y no se consulta Supabase en cada visita. **No:** invalidar al registrar una partida. El contador puede ir hasta un minuto atrasado.
- **Sí:** un cliente sin cookies (`createPublicClient`) para las lecturas cacheadas. El cliente con cookies no se puede usar dentro de `"use cache"`.
- **Sí:** "TU MEJOR MARCA" se lee sin caché dentro de un `<Suspense>`, porque depende del usuario.
- **Sí:** `startPlay` se lanza en segundo plano y GUARDAR espera su promesa. El juego no se bloquea esperando a la red.
- **Sí:** fechas en `dd/mm/aaaa` calculadas en UTC. El resultado es el mismo en servidor y cliente; una marca cerca de medianoche puede mostrar el día anterior o siguiente.
- **Sí:** `formatPlays` propio (`15.6K`). **No:** `Intl` compacto de `es-ES`, que da "15,6 mil" y rompe el estilo del prototipo.
- **No:** récord personal en el detalle ni en el HUD. No se pidió y añade una lectura por usuario más.

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Con la protección básica, alguien con sesión puede llamar a `saveScore` con una puntuación inventada | Queda acotada a 0–9.999.999 y a una por partida iniciada. El anti-trampas real queda documentado como fuera de alcance.                                           |
| Un error de Supabase durante el build queda horneado en el HTML estático                             | Las lecturas cacheadas lanzan, los errores no se cachean, y los consumidores están dentro de `<Suspense>`. Se comprueba con los docs de `use cache` en el paso 3. |
| `startPlay` falla o aún no ha terminado cuando el jugador pulsa GUARDAR                              | GUARDAR espera la promesa. Si falló, muestra el error genérico y el servidor lo registra.                                                                         |
| `leaderboard` recorre todas las puntuaciones en cada consulta y se vuelve lenta                      | Índice `(game_id, user_id, score desc, created_at)` y caché de Next. Si crece, se convierte en vista materializada en otro spec.                                  |
| El modo estricto de React emite dos veces `ready` → `playing` y crea dos partidas                    | La llamada se dispara desde el callback `onPhase`, no desde un `useEffect`, y solo si el `ref` está vacío.                                                        |
| Los tipos generados no coinciden con las vistas (columnas nulables)                                  | Los mapeos de `lib/scores.ts` descartan filas con campos nulos. Los tipos se regeneran en el paso 2.                                                              |

## Lo que **no** está en este spec

- Anti-trampas real.
- Migrar `av_scores`.
- Partidas de invitados.
- Rankings por periodo, paginación y perfil público.
- Récord personal en el detalle o el HUD.
- Tiempo real con Supabase Realtime.
- Rate limit propio.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
