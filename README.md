# GameSys

Sistema de gerenciamento de jogos para um grupo fechado (família/amigos), com login por convite, importação automática da biblioteca da Steam e um catálogo colaborativo de jogos. Construído com Next.js, React, TypeScript e Supabase.

## Requisitos

- Node.js 20 ou superior
- npm
- Uma conta [Supabase](https://supabase.com) (banco de dados, autenticação e storage)
- [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar as migrações
- Uma [Steam Web API key](https://steamcommunity.com/dev/apikey) gratuita, se for usar a importação da Steam

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz com:

```bash
# Painel do Supabase > Settings > API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Settings > API > service_role — NUNCA usar no client, só em Server Actions
SUPABASE_SERVICE_ROLE_KEY=

# URL pública onde o app está rodando (usada nos links de convite/recuperação de senha)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# https://steamcommunity.com/dev/apikey
STEAM_API_KEY=
```

## Banco de dados (Supabase)

As tabelas, policies de RLS e buckets de storage ficam versionados em `supabase/migrations/`. Para aplicar num projeto Supabase novo:

```bash
supabase login
supabase link --project-ref <ref-do-seu-projeto>
supabase db push
```

Como não há cadastro público, o primeiro administrador precisa ser criado manualmente:

1. No painel do Supabase, em **Authentication → Sign In / Providers → Email**, desative "Allow new users to sign up".
2. Em **Authentication → Users → Add user** (ou **Invite user**), crie a primeira conta.
3. Promova-a a admin rodando no SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
   ```

Daí em diante, novos usuários são sempre criados pela tela `/admin` do próprio app.

## Executar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm start
```

## Deploy

O projeto está hospedado na [Vercel](https://vercel.com). Deploy manual via CLI:

```bash
vercel --prod
```

As mesmas variáveis de ambiente listadas acima precisam estar configuradas no projeto Vercel (Settings → Environment Variables). Depois de configurá-las, também é necessário liberar a URL de produção em **Supabase → Authentication → URL Configuration** (Site URL e Redirect URLs, incluindo `/alterar-senha`).

## Estrutura

```text
gamesys/
├── app/
│   ├── admin/              # Painel admin: convidar/listar/remover usuários
│   ├── alterar-senha/      # Definir senha (convite ou recuperação)
│   ├── dashboard/
│   │   ├── [id]/editar/    # Editar jogo
│   │   ├── conta/          # Perfil, senha, importação Steam
│   │   ├── novo/           # Cadastrar jogo
│   │   └── page.tsx        # Catálogo de jogos
│   ├── recuperar-senha/
│   └── page.tsx            # Login
├── components/              # Formulários e UI compartilhada
├── lib/
│   ├── supabase/            # Clients (browser, server, admin, middleware)
│   ├── steam.ts             # Integração com a Web API da Steam
│   ├── group-games.ts       # Agrupamento/filtragem de jogos duplicados
│   └── display-name.ts      # Nickname > nome > e-mail
├── supabase/
│   └── migrations/          # Schema, RLS e storage buckets versionados
└── middleware.ts             # Proteção de rotas privadas
```

## Funcionalidades

**Autenticação**
- Login por e-mail e senha — sem cadastro público, só por convite do administrador
- Definição de senha via link de convite ou recuperação (`/alterar-senha`)
- Rotas privadas protegidas em duas camadas (middleware + checagem em cada página) além de Row Level Security no banco

**Conta do usuário**
- Nickname e foto de perfil (exibidos em todo o sistema, no lugar do e-mail)
- Alteração de senha
- Vínculo com perfil da Steam: importa a biblioteca, sincroniza automaticamente a cada login, e permite remover os jogos importados

**Catálogo de jogos**
- Cadastro manual (título, descrição, imagem) ou importado da Steam (com capa e detecção de "Family Sharing")
- Jogos com o mesmo título cadastrados por pessoas diferentes viram um único card, listando todos os nicknames
- Edição e exclusão (pelo dono do jogo ou por um admin)
- Busca por título/descrição/quem cadastrou, filtro por "compartilhados pela família", "adicionados recentemente" e por usuário específico, contagem de resultados e ordenação do mais novo para o mais antigo

**Administração**
- Convite de novos usuários por e-mail
- Remoção de usuários (remove também os jogos cadastrados por eles)

**Visual**
- Tema escuro e claro com persistência em `localStorage`
- Layout responsivo, glassmorphism, identidade visual azul inspirada na Steam

## Limitações conhecidas

- Sem um SMTP próprio configurado no Supabase, o envio de e-mails (convite/recuperação de senha) fica limitado à cota baixa do servidor compartilhado da Supabase — soa configurar um SMTP externo (Resend, SendGrid etc.) se isso virar um problema no uso real.
- A Steam não expõe publicamente a data de aquisição de cada jogo — a data usada no sistema é a de cadastro no GameSys, não a de compra na Steam.
- Excluir um usuário pelo painel admin também exclui os jogos que ele cadastrou (relação em cascata no banco).
