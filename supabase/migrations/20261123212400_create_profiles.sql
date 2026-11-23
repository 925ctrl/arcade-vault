create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Los usernames son públicos (aparecerán en rankings).
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Sin políticas de insert/update/delete: solo el trigger escribe.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
