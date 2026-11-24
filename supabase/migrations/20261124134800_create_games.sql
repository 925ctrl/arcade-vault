create table public.games (
  id text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  title text not null check (char_length(title) between 1 and 32),
  short_description text not null,
  long_description text not null,
  category text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  cover_image text check (cover_image ~ '^[a-z0-9-]{1,64}\.(webp|png|jpg)$'),
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
  on update cascade
  on delete restrict;

create index player_stats_game_id_idx on public.player_stats (game_id);

-- +1 partida. Valida contra public.games (existe y playable = true).
create or replace function public.start_game(p_game_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.games g where g.id = p_game_id and g.playable
  ) then
    raise exception 'invalid game';
  end if;

  insert into public.player_stats (user_id, game_id, games_played)
  values (auth.uid(), p_game_id, 1)
  on conflict (user_id, game_id) do update
    set games_played = public.player_stats.games_played + 1,
        updated_at = now();
end;
$$;

-- Actualiza max_score solo si se supera. Valida contra public.games (existe y playable = true).
create or replace function public.submit_score(p_game_id text, p_score integer)
returns table (max_score integer, is_record boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.games g where g.id = p_game_id and g.playable
  ) then
    raise exception 'invalid game';
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
