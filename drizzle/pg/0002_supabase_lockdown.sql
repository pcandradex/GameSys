-- Supabase: fecha o acesso às tabelas pela Data API (PostgREST).
--
-- O Supabase expõe o schema public pela API REST usando os papéis anon e
-- authenticated, que por padrão recebem acesso total a toda tabela nova. A
-- chave "anon" é pública, então sem isto qualquer pessoa poderia ler, por
-- exemplo, os hashes de senha em public.accounts.
--
-- O GameSys não usa essa API: conecta direto no Postgres como dono das
-- tabelas, e o dono não é afetado por RLS nem pelos REVOKE abaixo.
--
-- Fora do Supabase os papéis anon/authenticated não existem e nada é feito.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      -- RLS sem nenhuma policy = nenhuma linha visível para anon/authenticated.
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END LOOP;

    -- Tabelas criadas por migrações futuras também nascem sem acesso.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
