-- Vínculo com o perfil da Steam (pra reimportar/sincronizar depois)
-- e rastreio de qual appid da Steam originou cada jogo importado,
-- pra não duplicar em reimportações.
alter table public.profiles add column steam_id text;

alter table public.games add column steam_appid integer;

-- NULL não conflita com NULL em unique constraints do Postgres, então
-- jogos cadastrados manualmente (steam_appid = null) não são afetados.
alter table public.games
  add constraint games_owner_steam_appid_key unique (created_by, steam_appid);
