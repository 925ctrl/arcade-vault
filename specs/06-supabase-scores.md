# SPEC 06 — Puntuaciones en Supabase: récord y partidas por jugador, rankings reales

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-11-23
> **Objetivo:** Guardar automáticamente en Supabase un único registro por jugador y juego (`max_score`, `games_played`), y mostrar desde la base de datos los rankings de `/games/[id]` y `/hall-of-fame`, el "Mejor global", el contador de partidas y el récord de las tarjetas de la librería, eliminando todos los datos mock de puntuación.

## Por qué existe este spec

Hoy todas las puntuaciones que ve el usuario son falsas o locales:

- El leaderboard de `/games/[id]` y el Salón de la Fama usan `seededScores` (`lib/games.ts`), una lista generada con una semilla.
- "Mejor global", "Partidas" y el récord de las tarjetas son los campos fijos `best` y `plays` de `GAMES`.
- GUARDAR PUNTUACIÓN escribe en `localStorage` (`av_scores`, `lib/storage.ts`), y solo "TU MEJOR MARCA" lo lee.

SPEC 04 dejó el usuario verificado y SPEC 05 el primer juego real (ROCAS). Este spec une las dos cosas: cada jugador tiene un registro por juego con su récord y sus partidas, que se actualiza solo, y todos los rankings salen de Supabase.

En Supabase solo existe `public.profiles`.

## Alcance

**Dentro:**

- Migración versionada con la tabla `public.player_stats`, sus RLS, las funciones `public.start_game` y `public.submit_score`, y las vistas `public.leaderboard` y `public.game_stats`. Se aplica al remoto con el MCP `apply_migration`.
- Tipos regenerados en `lib/supabase/database.types.ts`.
- Un solo registro por jugador y juego: `max_score` solo se actualiza si se supera, y `games_played` suma 1 por partida.
- Guardado automático, solo con sesión:
  - Al pulsar `Espacio` en la pantalla de inicio (fase `ready` → `playing`), una llamada suma 1 a `games_played`.
  - Al llegar a FIN DEL JUEGO, si la puntuación puede ser récord, una llamada actualiza `max_score`.
- Se elimina el botón GUARDAR PUNTUACIÓN. El modal muestra el estado del guardado (ver "Flujo al terminar").
- Copia local del récord del jugador en `localStorage` (`av_best`), solo para la UI: si la puntuación no supera el récord en caché, no se llama a la BD al terminar.
- Protección básica: sesión obligatoria, solo las funciones escriben en la tabla, la puntuación es un entero entre 0 y 9.999.999, y el juego existe y es jugable.
- Rankings ordenados por `max_score`, desempate por la fecha más antigua del récord. Solo aparecen jugadores con `max_score > 0`.
- Leaderboard de `/games/[id]`: top 10 real.
- `/hall-of-fame`: podio y tabla top 12 reales por juego.
- "TU MEJOR MARCA EN …" **sin número de posición**, con sesión y récord en ese juego, esté o no el jugador en el top:
  - En `/hall-of-fame`, debajo de la tabla (como hoy).
  - En `/games/[id]`, debajo del top 10 del leaderboard.
- Si falla el guardado, el modal ofrece REINTENTAR GUARDADO.
- "Mejor global" y "Partidas" del detalle, y "MEJOR PUNTUACIÓN" de las tarjetas de `/library`, reales. "Partidas" es la suma de `games_played` de todos los jugadores.
- Estados vacíos: sin puntuaciones se muestra "SIN PUNTUACIONES TODAVÍA"; el podio muestra huecos `---`; "Mejor global" y el récord de las tarjetas muestran `—`; "Partidas" muestra `0`.
- Estados de error de lectura y de guardado.
- Se eliminan `seededScores`, `PLAYERS`, `ScoreRow`, los campos `best` y `plays` de `Game`, y `lib/storage.ts` actual (`av_scores`).

**Fuera de alcance (para futuros specs):**

- Anti-trampas real (validar la partida en servidor, replays, tiempos mínimos).
- Historial de partidas o puntuaciones individuales.
- Migrar las puntuaciones existentes de `av_scores`. Se ignoran.
- Contar partidas de invitados.
- Rankings por periodo (semana, mes), paginación o ver más allá del top.
- Perfil público del jugador.
- Posición del jugador fuera del top (el `#13` de hoy desaparece).
- Récord personal en el HUD.
- Tiempo real (suscripciones de Supabase Realtime).
- Rate limit propio.
- Tests automatizados.

## Modelo de datos

### Base de datos

Migración `supabase/migrations/<timestamp>_create_player_stats.sql`:

```sql
create table public.player_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  max_score integer not null default 0 check (max_score between 0 and 9999999),
  games_played integer not null default 0 check (games_played >= 0),
  max_score_at timestamptz,            -- cuándo se consiguió el récord (desempate y fecha del ranking)
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)       -- un solo registro por jugador y juego
);

create index player_stats_ranking_idx
  on public.player_stats (game_id, max_score desc, max_score_at);

alter table public.player_stats enable row level security;

-- Lectura pública: las vistas usan security_invoker y necesitan leer la tabla.
create policy "player_stats are readable by everyone"
  on public.player_stats for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: solo escriben las funciones.

-- +1 partida. Crea el registro si no existe.
create function public.start_game(p_game_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.player_stats (user_id, game_id, games_played)
  values (auth.uid(), p_game_id, 1)
  on conflict (user_id, game_id) do update
    set games_played = public.player_stats.games_played + 1,
        updated_at = now();
end;
$$;

-- Actualiza max_score solo si se supera. Devuelve el récord vigente y si es nuevo.
create function public.submit_score(p_game_id text, p_score integer)
returns table (max_score integer, is_record boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_score is null or p_score < 0 or p_score > 9999999 then
    raise exception 'invalid score';
  end if;

  insert into public.player_stats (user_id, game_id, max_score, max_score_at)
  values (auth.uid(), p_game_id, p_score, now())
  on conflict (user_id, game_id) do update
    set max_score = excluded.max_score,
        max_score_at = now(),
        updated_at = now()
    where public.player_stats.max_score < excluded.max_score;

  return query
    select s.max_score, (s.max_score = p_score and s.max_score_at >= now()) as is_record
    from public.player_stats s
    where s.user_id = auth.uid() and s.game_id = p_game_id;
end;
$$;

revoke execute on function public.start_game(text) from anon, public;
revoke execute on function public.submit_score(text, integer) from anon, public;
grant execute on function public.start_game(text) to authenticated;
grant execute on function public.submit_score(text, integer) to authenticated;

-- Ranking por juego, con posición.
create view public.leaderboard with (security_invoker = true) as
select
  s.game_id,
  s.user_id,
  p.username,
  s.max_score,
  s.max_score_at,
  row_number() over (
    partition by s.game_id order by s.max_score desc, s.max_score_at asc
  ) as rank
from public.player_stats s
join public.profiles p on p.id = s.user_id
where s.max_score > 0;

-- Partidas totales y récord por juego.
create view public.game_stats with (security_invoker = true) as
select
  game_id,
  sum(games_played)::bigint as plays,
  nullif(max(max_score), 0) as best
from public.player_stats
group by game_id;
```

Convenciones:

- `game_id` es el `id` de `GAMES` (`"rocas"`). El catálogo sigue en código; la BD no tiene tabla de juegos.
- Las dos escrituras son atómicas en la BD (`on conflict … do update`): no se lee antes de escribir, y dos pestañas o dispositivos no se pisan.
- `now()` es constante dentro de una transacción, así que `max_score_at >= now()` solo es cierto si la propia llamada actualizó el récord.
- `submit_score` no suma partidas: eso lo hace `start_game`.

### Copia local del récord

`lib/best-cache.ts` (cliente):

```ts
// localStorage key "av_best": { userId: string; best: Record<string, number> }
export function readCachedBest(userId: string, gameId: string): number | null; // null si no hay copia o es de otro usuario
export function writeCachedBest(
  userId: string,
  gameId: string,
  maxScore: number,
): void;
```

- Si el `userId` guardado no coincide con el de la sesión, la copia se descarta y se reescribe.
- La copia nunca se envía a la BD. Solo decide si hace falta llamar a `submit_score`.
- No se carga al abrir la página: se rellena con la respuesta de `submit_score`. Como el récord solo sube, una copia desactualizada solo puede ser más baja que el récord real, y en ese caso la BD responde `is_record: false`.

### Lectura de datos

`lib/supabase/public.ts`: `createPublicClient()` con `createClient<Database>` de `@supabase/supabase-js`, la publishable key y `auth: { persistSession: false }`. No lee cookies, así que se puede usar dentro de `"use cache"`.

`lib/scores.ts`:

```ts
export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number; // max_score
  date: string; // max_score_at en dd/mm/aaaa, UTC
};

export type GameStats = { plays: number; best: number | null };

export const SCORES_TAG = "scores";

// "use cache" + cacheTag(SCORES_TAG) + cacheLife("minutes"). Lanzan si Supabase falla.
export async function getTopScores(
  limit: number,
): Promise<Record<string, LeaderboardEntry[]>>;
export async function getGameStats(): Promise<Record<string, GameStats>>;

export type MyBest = { username: string; score: number; date: string }; // sin rank

// Sin caché (depende del usuario). Lee player_stats con user_id = userId y max_score > 0.
export async function getMyBests(
  userId: string,
): Promise<Record<string, MyBest>>;

export function formatPlays(n: number): string; // 950 → "950", 1000 → "1K", 15600 → "15.6K", 2_300_000 → "2.3M"
```

- `getTopScores` hace una sola consulta: `leaderboard` con `rank <= limit`, ordenada por `game_id` y `rank`.
- Un juego sin entradas no aparece en el `Record`; los consumidores usan `?? []` o `?? { plays: 0, best: null }`.

### Server Actions

`app/games/[id]/play/actions.ts` (`"use server"`):

```ts
export type SubmitScoreResult =
  | { status: "success"; maxScore: number; isRecord: boolean }
  | { status: "error"; message: string }; // en español, en mayúsculas

export async function startGame(gameId: string): Promise<void>; // errores: console.error y nada más
export async function submitScore(
  gameId: string,
  score: number,
): Promise<SubmitScoreResult>;
```

- Las dos exigen sesión y que `gameId` sea un juego de `GAMES` con `playable: true`, y llaman a la función de la BD con el cliente con cookies (`lib/supabase/server.ts`).
- `startGame` no invalida la caché: el contador se refresca con `cacheLife`.
- `submitScore` valida `Number.isInteger(score)` entre 0 y 9.999.999. Si `isRecord`, llama a `updateTag(SCORES_TAG)`.

Mensajes de error de `submitScore`:

| Caso                         | Mensaje                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| Sin sesión                   | "INICIA SESIÓN PARA GUARDAR."                                             |
| Juego o puntuación inválidos | "PUNTUACIÓN NO VÁLIDA."                                                   |
| Cualquier otro               | "NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO." + `console.error` |

### Flujo al terminar (modal FIN DEL JUEGO con sesión)

Solo si la partida llegó a empezar (pasó por `playing`):

1. Si `readCachedBest` devuelve un valor y `score <= best`, no se llama a la BD. El modal muestra al momento "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD" y el récord.
2. Si no, el modal muestra "GUARDANDO…" y llama a `submitScore`:
   - `isRecord: true`: "▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_".
   - `isRecord: false`: "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD" y el récord.
   - En los dos casos, `writeCachedBest(user.id, game.id, maxScore)`.
   - Error: el mensaje en magenta con el prefijo `[ERR]` y el botón REINTENTAR GUARDADO, que repite el paso 2 con la misma puntuación. Mientras reintenta, el botón está deshabilitado y el modal muestra "GUARDANDO…".
3. Si la partida no llegó a empezar (FIN en la pantalla de inicio), el modal no muestra estado de guardado.

REINTENTAR GUARDADO tiene el mismo ancho que JUGAR DE NUEVO y VOLVER AL VAULT, y va encima de ellos. El modal conserva JUGAR DE NUEVO y VOLVER AL VAULT. Sin sesión no cambia: aviso e INICIAR SESIÓN.

### Catálogo

`lib/games.ts`: `Game` pierde `best` y `plays`. Se borran `PLAYERS`, `ScoreRow` y `seededScores`.

## Plan de implementación

Cada paso deja `npm run dev` y `npm run lint` funcionando. Antes de escribir código se leen en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/` `cacheTag.md`, `cacheLife.md` y `updateTag.md`, y la directiva `use cache`. Antes de tocar `leaderboard.tsx`, `hall-of-fame.tsx`, `game-card.tsx`, el detalle y `game-player.tsx` se invoca `/frontend-design` (instrucción de `CLAUDE.md`), con `references/templates/` como fuente de verdad visual.

1. Crear `supabase/migrations/<timestamp>_create_player_stats.sql` con el SQL del modelo de datos y aplicarlo con el MCP `apply_migration` (mismo nombre). Ejecutar `get_advisors` (security y performance) y corregir lo que reporte.
2. Regenerar los tipos con el MCP `generate_typescript_types` en `lib/supabase/database.types.ts`.
3. Crear `lib/supabase/public.ts`, `lib/scores.ts` y `lib/best-cache.ts`. Todavía no se usan.
4. Crear `app/games/[id]/play/actions.ts` con `startGame` y `submitScore`.
5. En `components/game-player.tsx`:
   - Con sesión, cuando `onPhase` pasa de `ready` a `playing`, llamar a `startGame(game.id)` sin esperar la respuesta y marcar la partida como empezada en un `ref`. JUGAR DE NUEVO limpia la marca.
   - Al pasar a `over` con la partida empezada, ejecutar el "Flujo al terminar" dentro de `useTransition`. Debe ejecutarse una sola vez por partida.
   - Quitar el botón GUARDAR PUNTUACIÓN, el estado `saved` y `appendScore`.
6. Detalle `/games/[id]`:
   - `components/leaderboard.tsx` recibe `entries: LeaderboardEntry[]` (o un estado de error) y muestra "SIN PUNTUACIONES TODAVÍA" si está vacío.
   - La página lee `getTopScores(10)` y `getGameStats()` dentro de un `<Suspense>`. "Mejor global" muestra `best` o `—`; "Partidas" muestra `formatPlays(plays)`.
   - Debajo del top 10, dentro de otro `<Suspense>` (fallback vacío), un componente servidor lee `getSessionUser()` y `getMyBests(user.id)` y, si hay récord en este juego, pinta "▸ TU MEJOR MARCA EN {TÍTULO}" y una fila amarilla con username, fecha y puntuación, sin número de posición. Mismo estilo que la fila `you` del salón, adaptado a `.lb-row`.
7. Librería: `app/library/page.tsx` lee `getGameStats()` dentro de un `<Suspense>` y pasa `stats` a `Library`, que lo pasa a `GameCard`. La tarjeta muestra el récord o `—`.
8. Salón de la Fama:
   - `app/hall-of-fame/page.tsx` lee `getTopScores(12)` y, dentro de un `<Suspense>`, `getSessionUser()` y `getMyBests(user.id)`. El fallback renderiza el salón sin "TU MEJOR MARCA".
   - `components/hall-of-fame.tsx` recibe `top` y `myBests` por props y conserva las pestañas en estado local. Deja de usar `useSyncExternalStore` y `localStorage`.
   - Podio con huecos `---` en las posiciones sin jugador. Tabla con las filas reales o "SIN PUNTUACIONES TODAVÍA".
   - "TU MEJOR MARCA EN …" usa `username`, `score` y `date` de `myBests[tab]`, y solo aparece si existe, esté o no el jugador en el top 12. La celda de rango queda vacía: no se muestra número de posición.
9. Borrar el `lib/storage.ts` actual, `seededScores`, `PLAYERS`, `ScoreRow` y los campos `best` / `plays` de `GAMES`. Ajustar los imports.
10. Error de lectura: si `getTopScores` o `getGameStats` lanzan, el componente que las consume registra el error con `console.error` y muestra "[ERR] NO SE PUDO CARGAR EL RANKING." en el leaderboard y el salón, y `—` en "Mejor global", "Partidas" y las tarjetas.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/library`, `/games/rocas`, `/games/rocas/play`, `/games/caida` y `/hall-of-fame`.
- [ ] `list_migrations` muestra la migración de `player_stats` aplicada en el remoto, y `supabase/migrations/` la contiene.
- [ ] `player_stats` tiene RLS activado, y `get_advisors` (security) no reporta avisos sobre `player_stats`, `start_game`, `submit_score`, `leaderboard` ni `game_stats`.
- [ ] `lib/supabase/database.types.ts` contiene `player_stats`, `leaderboard`, `game_stats`, `start_game` y `submit_score`.
- [ ] El reproductor no muestra el botón GUARDAR PUNTUACIÓN.
- [ ] Con sesión y sin registro previo, pulsar `Espacio` en `/games/rocas/play` crea una fila en `player_stats` con `game_id = 'rocas'`, `games_played = 1` y `max_score = 0`.
- [ ] Cada nueva partida empezada suma exactamente 1 a `games_played` de esa fila. Pausar, reanudar o perder una vida no suma.
- [ ] Tras varias partidas, `player_stats` tiene una sola fila para ese usuario y `rocas`.
- [ ] Terminar con una puntuación mayor que el récord muestra "GUARDANDO…" y luego "▸ ¡NUEVO RÉCORD! PUNTUACIÓN GUARDADA_", y `max_score` pasa a ser esa puntuación.
- [ ] Terminar con una puntuación menor o igual que el récord en caché muestra "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD", no cambia `max_score` y no hace ninguna petición a `submitScore` (pestaña Network).
- [ ] Con `av_best` borrado de `localStorage` y una puntuación menor que el récord de la BD, se llama a `submitScore`, se muestra "▸ LÁSTIMA, NO SUPERASTE TU RÉCORD", `max_score` no cambia y `av_best` queda con el récord de la BD.
- [ ] Pulsar FIN en la pantalla de inicio no suma partidas ni llama a `submitScore`.
- [ ] Sin sesión, jugar una partida no crea ni modifica filas en `player_stats`.
- [ ] Llamar a `submitScore` con `-1`, `1.5`, `10000000` o `game_id = 'caida'` devuelve "PUNTUACIÓN NO VÁLIDA." y no modifica nada.
- [ ] Un `update` o `insert` directo en `player_stats` con la publishable key y una sesión es rechazado por RLS, y `start_game` / `submit_score` sin sesión fallan.
- [ ] Tras un nuevo récord, `/games/rocas` y `/hall-of-fame` (pestaña ROCAS) lo muestran sin reiniciar el servidor.
- [ ] Con dos jugadores empatados en `max_score`, aparece primero el que lo consiguió antes.
- [ ] Un jugador con `max_score = 0` no aparece en el ranking.
- [ ] El leaderboard de `/games/rocas` muestra como máximo 10 filas, y la tabla del salón como máximo 12, ordenadas de mayor a menor.
- [ ] En `/hall-of-fame` (pestaña ROCAS) y en `/games/rocas`, "TU MEJOR MARCA EN ROCAS" muestra el username, el `max_score` y la fecha del récord, sin número de posición.
- [ ] Un jugador con récord fuera del top (puesto 13 o más en el salón, 11 o más en el detalle) ve igualmente "TU MEJOR MARCA" debajo de la lista.
- [ ] Sin sesión, o sin récord en ese juego, ni el salón ni el detalle muestran "TU MEJOR MARCA".
- [ ] Con el guardado fallando (por ejemplo, red desconectada en DevTools), el modal muestra `[ERR]` y REINTENTAR GUARDADO. Al restaurar la red y pulsarlo, muestra "GUARDANDO…" y luego el resultado, y `max_score` queda actualizado si era récord.
- [ ] "Mejor global" de `/games/rocas` y "MEJOR PUNTUACIÓN" de la tarjeta de ROCAS coinciden con el `#01` del leaderboard.
- [ ] "Partidas" de `/games/rocas` coincide con `select sum(games_played) from player_stats where game_id = 'rocas'` (con hasta un minuto de retraso), con el formato de `formatPlays`.
- [ ] `/games/caida` muestra "SIN PUNTUACIONES TODAVÍA", "Mejor global" `—` y "Partidas" `0`. Su tarjeta muestra `—`.
- [ ] La pestaña CAÍDA del salón muestra el podio con `---` y "SIN PUNTUACIONES TODAVÍA".
- [ ] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, el detalle y el salón muestran "[ERR] NO SE PUDO CARGAR EL RANKING." y el servidor registra el motivo.
- [ ] El repo no contiene `seededScores`, `av_scores` ni `appendScore`, y `Game` no tiene `best` ni `plays`.

## Decisiones

- **Sí:** un registro por jugador y juego con `max_score` y `games_played`. **No:** guardar cada partida con su puntuación. Es lo que pide el ranking y la tabla no crece con cada partida. Se pierde el historial, que queda fuera de alcance.
- **Sí:** guardado automático. **No:** botón GUARDAR PUNTUACIÓN.
- **Sí:** escrituras atómicas en funciones de la BD (`+1` y "el mayor entre el actual y el nuevo"). **No:** que el cliente calcule y envíe `max_score` y `games_played`. Con dos pestañas o dispositivos se perderían partidas, y cualquiera podría escribir el contador que quisiera.
- **Sí:** `localStorage` (`av_best`) como copia del récord solo para la UI: evita llamar a la BD cuando la partida no supera el récord en caché. **No:** cargar la copia desde la BD al abrir la página. Se rellena con la respuesta de `submit_score`, así nunca hace falta una lectura. El peor caso es una copia más baja que el récord real, y entonces la BD responde `is_record: false`.
- **Sí:** dos llamadas por partida: `start_game` al empezar y `submit_score` al terminar, solo si puede ser récord. Así cuentan también las partidas abandonadas.
- **Sí:** solo cuentan las partidas con sesión. **No:** escrituras anónimas, que cualquiera podría usar para inflar el contador.
- **Sí:** solo escriben las funciones `security definer`, con `auth.uid()` y ejecución revocada a `anon`. **No:** políticas de insert/update en la tabla, que permitirían poner cualquier `max_score` o `games_played` con un `update` directo.
- **Sí:** protección básica (sesión, rango 0–9.999.999, juego jugable). **No:** anti-trampas real, que va en su propio spec.
- **Sí:** "LÁSTIMA, NO SUPERASTE TU RÉCORD" cuando no hay récord.
- **Sí:** REINTENTAR GUARDADO si falla `submitScore`. Reenviar es seguro porque `submit_score` es idempotente. **No:** reintentar `startGame`, que se lanza en segundo plano; si falla, `submit_score` crea el registro igualmente.
- **Sí:** "TU MEJOR MARCA" sin número de posición, en el salón y en el detalle, esté o no el jugador en el top. **No:** mostrar la posición. Por eso `getMyBests` lee `player_stats` directamente y no necesita `rank`.
- **Sí:** lectura pública de `player_stats` para que las vistas funcionen con `security_invoker`. **No:** vistas `security definer`, que saltan RLS y el advisor las marca. Los usernames y récords ya son públicos.
- **Sí:** vistas `leaderboard` y `game_stats` en Postgres. **No:** agregar en Next. PostgREST no tiene agregados activados por defecto, y así la posición (`rank`) se calcula en un solo sitio.
- **Sí:** desempate por la fecha del récord (`max_score_at`), primero el más antiguo.
- **Sí:** el ranking excluye `max_score = 0`. Un jugador que solo ha empezado partidas no tiene marca que mostrar.
- **Sí:** el catálogo sigue en `GAMES`. **No:** tabla `games`. Los juegos se definen en código junto a su motor; `game_id` se valida en la Server Action y con un `check` de formato.
- **Sí:** lecturas públicas con `"use cache"`, `cacheTag("scores")` y `cacheLife("minutes")`, y `updateTag` cuando hay récord nuevo. **No:** invalidar en `start_game`. El contador de partidas puede ir hasta un minuto atrasado.
- **Sí:** un cliente sin cookies (`createPublicClient`) para las lecturas cacheadas. El cliente con cookies no se puede usar dentro de `"use cache"`.
- **Sí:** "TU MEJOR MARCA" se lee sin caché dentro de un `<Suspense>`, porque depende del usuario. En el detalle, ese `<Suspense>` es un hueco dinámico aparte: el resto de la página sigue siendo estático.
- **Sí:** fechas en `dd/mm/aaaa` calculadas en UTC. El resultado es el mismo en servidor y cliente; un récord cerca de medianoche puede mostrar el día anterior o siguiente.
- **Sí:** `formatPlays` propio (`15.6K`). **No:** `Intl` compacto de `es-ES`, que da "15,6 mil" y rompe el estilo del prototipo.
- **No:** récord personal en el HUD. No se pidió.

## Riesgos

| Riesgo                                                                                                                                 | Mitigación                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Con la protección básica, alguien con sesión puede llamar a `submit_score` con una puntuación inventada, o a `start_game` muchas veces | Queda acotada a 0–9.999.999 y a su propio registro. El anti-trampas y el rate limit quedan documentados como fuera de alcance.                                    |
| La copia de `localStorage` es de otro usuario del mismo navegador                                                                      | La copia guarda el `userId` y se descarta si no coincide con la sesión.                                                                                           |
| `start_game` falla y la partida no se cuenta                                                                                           | El servidor lo registra. `submit_score` crea el registro igualmente si no existe, así que el récord no se pierde.                                                 |
| El efecto de fin de partida se ejecuta dos veces (modo estricto o doble `onPhase("over")`) y duplica la llamada                        | Un `ref` marca la partida como enviada. Aunque se duplicara, `submit_score` es idempotente.                                                                       |
| Un error de Supabase durante el build queda horneado en el HTML estático                                                               | Las lecturas cacheadas lanzan, los errores no se cachean, y los consumidores están dentro de `<Suspense>`. Se comprueba con los docs de `use cache` en el paso 3. |
| Los tipos generados no coinciden con las vistas (columnas nulables)                                                                    | Los mapeos de `lib/scores.ts` descartan filas con campos nulos. Los tipos se regeneran en el paso 2.                                                              |

## Lo que **no** está en este spec

- Anti-trampas real y rate limit.
- Historial de partidas.
- Migrar `av_scores`.
- Partidas de invitados.
- Rankings por periodo, paginación y perfil público.
- Posición del jugador fuera del top.
- Récord personal en el HUD.
- Tiempo real con Supabase Realtime.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
