-- O trigger protect_profiles_role bloqueava QUALQUER mudança de role feita por
-- alguém sem auth.uid() (SQL Editor, CLI, service_role) — inclusive a
-- promoção manual do primeiro admin, já que não há admin ainda pra fazer isso
-- pelo próprio app. auth.uid() só existe dentro de requisições autenticadas
-- via PostgREST; fora desse contexto (acesso direto ao Postgres) o acesso já
-- é privilegiado por natureza, então a checagem de admin só se aplica quando
-- há um auth.uid() de fato.
create or replace function public.protect_role_column()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    new.role = old.role;
  end if;
  return new;
end;
$$;
