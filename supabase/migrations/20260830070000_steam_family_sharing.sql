-- Se o jogo suporta a categoria "Family Sharing" da Steam (dado da própria
-- ficha do jogo na loja, igual pra todo mundo — não depende de quem importou).
-- NULL = não é jogo importado da Steam, ou não foi possível checar ainda.
alter table public.games add column steam_family_shared boolean;
