-- Supabase: schema vazio para a Data API (PostgREST) apontar.
--
-- Com a Data API desligada, o Supabase continua rodando o PostgREST apontado
-- para um schema fictício ("pg_pgrst_no_exposed_schemas"), que gera um erro
-- no log a cada ~30 s. A configuração recomendada é deixar a Data API ligada
-- expondo SOMENTE este schema vazio: o PostgREST carrega sem erro e não há
-- nada para expor. As tabelas do GameSys ficam em public, fora da API (e sem
-- acesso para anon/authenticated, ver 0002_supabase_lockdown).
--
-- Fora do Supabase nada é feito.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    CREATE SCHEMA IF NOT EXISTS api;
    COMMENT ON SCHEMA api IS
      'Vazio de propósito: único schema exposto pela Data API do Supabase. Não crie objetos aqui.';

    -- Nenhuma permissão para os papéis da API, nem agora nem em objetos futuros.
    REVOKE ALL ON SCHEMA api FROM PUBLIC, anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
