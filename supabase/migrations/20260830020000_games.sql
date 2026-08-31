-- Catálogo de jogos cadastrados pelos usuários convidados.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.games is 'Jogos cadastrados pelos usuários, exibidos como cards no dashboard.';

create trigger set_games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

alter table public.games enable row level security;

-- Qualquer usuário logado (convidado) vê todos os jogos.
create policy "games_select_authenticated"
  on public.games for select
  to authenticated
  using (true);

-- Só cria jogo com created_by = o próprio usuário (o default já cobre isso,
-- o check é contra alguém forçar outro created_by manualmente).
create policy "games_insert_own"
  on public.games for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "games_update_own_or_admin"
  on public.games for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin(auth.uid()))
  with check (created_by = auth.uid() or public.is_admin(auth.uid()));

create policy "games_delete_own_or_admin"
  on public.games for delete
  to authenticated
  using (created_by = auth.uid() or public.is_admin(auth.uid()));

-- O card do jogo mostra quem cadastrou: todo usuário logado precisa
-- enxergar nome/e-mail de qualquer outro perfil (só de dentro do app,
-- é um grupo fechado por convite, não dados sensíveis entre estranhos).
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Bucket de imagens de capa dos jogos.
insert into storage.buckets (id, name, public)
values ('game-covers', 'game-covers', true)
on conflict (id) do nothing;

create policy "game_covers_public_read"
  on storage.objects for select
  using (bucket_id = 'game-covers');

create policy "game_covers_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'game-covers');
