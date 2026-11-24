create table public.player_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  max_score integer not null default 0 check (max_score between 0 and 9999999),
  games_played integer not null default 0 check (games_played >= 0),
  max_score_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
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
