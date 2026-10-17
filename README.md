# GameSys

> Recebeu este projeto? Comece pelo [HANDOFF.md](HANDOFF.md).

Sistema de gerenciamento de jogos para um grupo fechado (família/amigos), com login por convite, importação automática da biblioteca da Steam e um catálogo colaborativo de jogos. Construído com Next.js, React e TypeScript, e **independente de provedor**: roda sobre Postgres, MySQL/MariaDB ou SQLite/Turso, com imagens em disco local ou em qualquer storage S3-compatível.

| Camada | Tecnologia | Opções suportadas |
|---|---|---|
| Banco de dados | [Drizzle ORM](https://orm.drizzle.team) | Postgres (Neon, Supabase, RDS, Railway…), MySQL/MariaDB (PlanetScale, RDS, Aiven…), SQLite (arquivo) ou Turso |
| Autenticação | [Better Auth](https://better-auth.com) | Sessões e senhas guardadas no próprio banco |
| Storage de imagens | `lib/storage.ts` | Disco local ou S3-compatível (AWS S3, Cloudflare R2, Backblaze B2, MinIO…) |
| E-mail | SMTP (nodemailer) | Resend, SendGrid, SES, Mailgun… ou log no terminal em dev |

## Requisitos

- Node.js 20 ou superior
- Um banco: nada a instalar para SQLite; ou uma URL de Postgres/MySQL
- Uma [Steam Web API key](https://steamcommunity.com/dev/apikey) gratuita, se for usar a importação da Steam

## Início rápido (SQLite local)

```bash
npm install
cp .env.example .env.local        # já vem com DATABASE_URL=file:./data/gamesys.db
# preencha BETTER_AUTH_SECRET (openssl rand -base64 32)
mkdir data
npm run db:migrate
npm run create-admin -- voce@exemplo.com "Seu Nome" "uma-senha-forte"
npm run dev
```

Acesse `http://localhost:3000` e entre com o admin criado.

## Variáveis de ambiente

Todas estão documentadas em [.env.example](.env.example). As essenciais:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão. O dialeto é detectado pelo prefixo: `postgres://`, `mysql://`, `file:` / `libsql://` |
| `DB_DIALECT` | Opcional: força `pg`, `mysql` ou `sqlite` |
| `DATABASE_AUTH_TOKEN` | Só para Turso |
| `BETTER_AUTH_SECRET` | Chave de assinatura das sessões (obrigatória em produção) |
| `APP_URL` | URL pública do app: links de e-mail e checagem de origem. Lida em runtime, então o mesmo build serve para vários domínios |
| `STORAGE_DRIVER` | `local` (padrão) ou `s3` (+ `S3_*`) |
| `STORAGE_PUBLIC_URL` | Opcional: URL do bucket/CDN público. Sem ela, as imagens são servidas pelo app em `/files/*` |
| `SMTP_*`, `EMAIL_FROM` | Envio de convites e recuperação de senha |
| `STEAM_API_KEY` | Importação da Steam |

## Banco de dados

Os schemas ficam em `lib/db/schema/` (um arquivo por dialeto, com as mesmas tabelas) e as migrações geradas em `drizzle/<dialeto>/`.

```bash
npm run db:migrate     # aplica as migrações pendentes no banco de DATABASE_URL
```

**Para mudar o schema:** edite **os três** arquivos em `lib/db/schema/` (`pg.ts`, `mysql.ts`, `sqlite.ts`) da mesma forma e rode:

```bash
npm run db:generate -- --name descricao-da-mudanca
```

Isso gera uma migração para cada dialeto. Commite as três.

O app inteiro é tipado com o schema Postgres, e em runtime usa o do banco configurado. Para isso funcionar, o código usa só o que é comum aos três dialetos: nada de `.returning()`, `onConflict*`, `ilike` etc. Veja o comentário em `lib/db/index.ts`.

### Primeiro administrador

Não há cadastro público. O primeiro admin é criado pela linha de comando:

```bash
npm run create-admin -- admin@exemplo.com "Nome" "senha"     # define a senha direto
npm run create-admin -- admin@exemplo.com "Nome"             # envia link para definir a senha
```

Se o e-mail já existir, a conta é promovida a admin. Depois disso, novos usuários são convidados pela tela `/admin`.

## Storage de imagens

O banco guarda só a **chave** do arquivo (`game-covers/<usuário>/<uuid>.png`), nunca a URL. Trocar de provedor, bucket ou CDN não quebra imagens já cadastradas: basta copiar os arquivos e mudar as variáveis.

- `STORAGE_DRIVER=local`: grava em `UPLOADS_DIR`. Só serve para servidores com disco persistente (VPS, Docker com volume), **não** para a Vercel.
- `STORAGE_DRIVER=s3`: qualquer serviço S3-compatível. Exemplo com Cloudflare R2:
  ```bash
  STORAGE_DRIVER=s3
  S3_BUCKET=gamesys
  S3_REGION=auto
  S3_ENDPOINT=https://<conta>.r2.cloudflarestorage.com
  S3_ACCESS_KEY_ID=...
  S3_SECRET_ACCESS_KEY=...
  STORAGE_PUBLIC_URL=https://pub-xxxx.r2.dev    # opcional
  ```

Uploads aceitam JPG, PNG, GIF, WEBP e AVIF de até 4 MB.

## Deploy

### Vercel (ou outra plataforma serverless)

1. Use um banco acessível pela internet (Neon, Supabase, PlanetScale, Turso…) e `STORAGE_DRIVER=s3`.
2. Configure as variáveis de ambiente do projeto.
3. Rode as migrações antes de cada deploy. Uma forma é usar o build command `npm run db:migrate && npm run build`.
4. Em serverless, use a URL com pooler do provedor (PgBouncer, Neon pooled etc.) e um `DB_POOL_SIZE` baixo (1–3).

### Servidor próprio / VPS / Docker

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

Com `STORAGE_DRIVER=local`, monte `UPLOADS_DIR` (e `data/`, se usar SQLite) num volume persistente.

### Várias instâncias (outros locais/grupos)

Cada instância é independente: seu próprio `DATABASE_URL`, `APP_URL`, bucket e admin inicial. O mesmo build pode ser reaproveitado, porque nada específico da instância é fixado em tempo de build.

## Testes

```bash
npm run typecheck
npm run lint
npm run test:db -- --reset    # ATENÇÃO: apaga todos os dados. Use só em banco de teste
```

O `test:db` roda contra o banco de `DATABASE_URL` o fluxo de convite → definir senha → login, o bloqueio de cadastro público, a listagem com join, as consultas da sincronização Steam e a exclusão de usuário. Sem `--reset`, ele se recusa a rodar se o banco já tiver usuários.

## Estrutura

```text
gamesys/
├── app/
│   ├── admin/              # Painel admin: convidar/reenviar/listar/remover usuários
│   ├── alterar-senha/      # Definir senha (convite ou recuperação)
│   ├── api/auth/           # Endpoints do Better Auth
│   ├── dashboard/
│   │   ├── actions.ts      # Server Actions: jogos e perfil (com checagem de permissão)
│   │   ├── [id]/editar/    # Editar jogo
│   │   ├── conta/          # Perfil, senha, importação Steam
│   │   └── novo/           # Cadastrar jogo
│   ├── files/              # Serve imagens do storage quando não há CDN
│   ├── recuperar-senha/
│   └── page.tsx            # Login
├── components/              # Formulários e UI compartilhada
├── drizzle/                 # Migrações geradas, uma pasta por dialeto
├── lib/
│   ├── db/                  # Conexão multi-banco + schemas pg/mysql/sqlite
│   ├── data/                # Consultas e regras de permissão
│   ├── auth.ts              # Configuração do Better Auth (convite, e-mails)
│   ├── session.ts           # Usuário logado (base de toda checagem de acesso)
│   ├── storage.ts           # Drivers local/S3
│   ├── email.ts             # SMTP
│   ├── steam.ts             # Integração com a Web API da Steam
│   └── group-games.ts       # Agrupamento de jogos duplicados
├── scripts/                 # migrate, generate, create-admin, smoke-test
└── proxy.ts                 # Redireciona rotas privadas sem sessão
```

## Funcionalidades

**Autenticação**
- Login por e-mail e senha, só por convite do administrador. "Lembrar-me" controla se a sessão sobrevive ao fechar o navegador
- Convite e recuperação de senha por link enviado por e-mail (válido por 24 h, uso único)
- Permissões checadas no servidor em toda página e Server Action (`lib/session.ts`, `lib/data/`)

**Conta do usuário**
- Nickname e foto de perfil
- Alteração de senha (exige a senha atual e encerra as outras sessões)
- Vínculo com a Steam: importa a biblioteca e sincroniza a cada login. A sincronização é incremental: só busca jogos novos, e o "Family Sharing" é checado aos poucos e reaproveitado entre usuários

**Catálogo de jogos**
- Cadastro manual (título, descrição, imagem) ou importado da Steam
- Jogos com o mesmo título viram um único card com todos os nicknames
- Edição e exclusão (dono do jogo ou admin)
- Busca e filtros (família, recentes, por usuário)

**Administração**
- Convite por e-mail, status do convite (pendente/ativo) e reenvio
- Remoção de usuários (remove também os jogos e imagens deles)

## Limitações conhecidas

- O dashboard carrega o catálogo inteiro de uma vez e agrupa em memória. Funciona bem até alguns milhares de jogos; acima disso, o próximo passo é paginação e agrupamento no banco.
- A Steam não expõe a data de aquisição de cada jogo. A data usada é a de cadastro no GameSys.
- A Store API da Steam limita requisições por IP. Bibliotecas grandes podem levar alguns logins até todos os jogos terem o selo de "Family Sharing" checado.
