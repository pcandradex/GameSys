# Recebendo o GameSys

Guia para quem recebeu uma cópia deste projeto e vai rodar a própria instância. A referência técnica completa está no [README.md](README.md). Este arquivo é o roteiro do primeiro dia.

Você recebe **só o código**. Nenhuma conta, banco, chave ou dado de usuário vem junto: tudo abaixo é criado do seu lado, em contas suas.

## 1. Tenha a sua própria cópia do repositório

O repositório original é público. Para ter um repositório seu, use uma destas formas:

- **Fork:** botão **Fork** em <https://github.com/pcandradex/GameSys>, e depois clone o seu fork.
- **Repositório independente** (sem vínculo com o original, inclusive se for privado):
  ```bash
  git clone https://github.com/pcandradex/GameSys.git
  cd GameSys
  # crie um repositório vazio na sua conta do GitHub (sem README) e:
  git remote set-url origin https://github.com/<seu-usuario>/<seu-repo>.git
  git push -u origin main
  ```

## 2. Rode localmente (cerca de 5 minutos, sem criar conta nenhuma)

Requisitos: Node.js 20 ou superior e Git. Os comandos abaixo funcionam no terminal do macOS/Linux, no Git Bash e no PowerShell.

```bash
npm install
cp .env.example .env.local
```

Em `.env.local`, preencha só o `BETTER_AUTH_SECRET` com um texto aleatório longo. Para gerar um:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

O resto já vem pronto para rodar com SQLite e imagens em disco.

```bash
mkdir data
npm run db:migrate
npm run create-admin -- seu@email.com "Seu Nome" "uma-senha-forte"
npm run dev
```

Abra `http://localhost:3000` e entre com o admin criado. Se o login funcionar e você conseguir cadastrar um jogo com imagem, está tudo certo.

Se rodar em outra porta ou endereço, ajuste o `APP_URL` no `.env.local` para o mesmo valor (ex.: `APP_URL=http://localhost:3001`). Caso contrário, o login falha com "Invalid origin".

Sem SMTP configurado, os e-mails de convite e de recuperação de senha **não são enviados**: o link aparece no terminal onde está rodando o `npm run dev`. Em `/admin` você também pode criar usuários com **link para copiar** ou **senha temporária**, sem depender de e-mail.

## 3. Contas que você vai precisar para produção

| Para quê | Sugestões (todas têm plano gratuito) | Variáveis no `.env` |
|---|---|---|
| Banco de dados | [Supabase](https://supabase.com) ou [Neon](https://neon.tech) (Postgres), [Turso](https://turso.tech) (SQLite), ou qualquer Postgres/MySQL | `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN` no Turso) |
| Imagens | O storage do próprio Supabase, [Cloudflare R2](https://developers.cloudflare.com/r2/) ou AWS S3 | `STORAGE_DRIVER=s3`, `S3_*`, `STORAGE_PUBLIC_URL` |
| E-mail (opcional) | [Resend](https://resend.com), SendGrid, Brevo… Sem SMTP, o admin entrega acesso por link ou senha temporária | `SMTP_*`, `EMAIL_FROM` |
| Steam (opcional) | [Steam Web API key](https://steamcommunity.com/dev/apikey), vinculada à sua conta Steam | `STEAM_API_KEY` |
| Hospedagem | [Vercel](https://vercel.com), ou um VPS/Docker seu | — |

Gere um `BETTER_AUTH_SECRET` **novo** para produção, diferente do usado localmente. Se ele mudar depois, todo mundo é deslogado.

## 4. Publicar

**Na Vercel:**

1. **Prepare o banco, da sua máquina.** Crie um arquivo `.env.production.local` (o git já o ignora) com `DATABASE_URL`, `BETTER_AUTH_SECRET` e `APP_URL` de produção. Depois rode com `--prod`:
   ```bash
   npm run db:migrate -- --prod
   npm run create-admin -- seu@email.com "Seu Nome" "uma-senha-forte" --prod
   ```
   Sem `--prod`, os scripts usam o `.env.local` (desenvolvimento). Cada script mostra no início qual banco vai usar. O `test:db` se recusa a rodar com `--prod`, porque apaga dados.
   Guarde uma cópia segura do `.env.production.local`: ele é necessário para as migrações das próximas versões.

   **Usando o Supabase?** Siga também a seção "Usando o Supabase" do README. Ela cobre a URL certa para cada uso (Session × Transaction pooler), o parâmetro de SSL, desligar a Data API e o storage de imagens.
2. **Vincule o projeto:** `npx vercel link`, ou importe o repositório no painel da Vercel.
3. **Cadastre as variáveis** do passo 3 em Settings → Environment Variables, mais `APP_URL=https://seu-dominio` e `DB_POOL_SIZE=1`. Na Vercel, a `DATABASE_URL` deve ser a do pooler (no Supabase, o Transaction pooler, porta 6543).
4. **Região:** o `vercel.json` fixa as funções em São Paulo (`gru1`). Se o seu banco estiver em outra região, troque para a mais próxima dele.
5. **Publique:** `npx vercel --prod`.

Na Vercel, o storage precisa ser S3/R2/Supabase Storage: o disco de lá não é persistente e as imagens sumiriam.

Se algo falhar, a tabela "Problemas comuns" do README lista os erros que já apareceram e a solução de cada um.

**Num VPS ou Docker:** veja a seção "Deploy" do README. O storage local funciona, desde que `uploads/` (e `data/`, se usar SQLite) fiquem num volume persistente.

## 5. No dia a dia

- **Novos usuários:** pela tela `/admin`, com convite por e-mail, link para copiar ou senha temporária. Não há cadastro público.
- **Alguém esqueceu a senha e o e-mail não chega:** em `/admin`, use “Gerar link” ou “Senha temporária” na linha do usuário.
- **Mudar o banco (schema):** edite os três arquivos em `lib/db/schema/` e rode `npm run db:generate -- --name descricao`. Depois, `npm run db:migrate` em cada ambiente.
- **Antes de publicar uma mudança:** rode `npm run typecheck`, `npm run lint` e `npm run build`.
- **Publicar uma nova versão:**
  ```bash
  npm run db:migrate -- --prod   # só se houver migração nova em drizzle/
  git push
  npx vercel --prod
  ```
  O "Instant Rollback" da Vercel só é seguro entre versões sem migração nem mudança de variáveis, porque reaproveita o banco e as variáveis atuais.
- **Testar contra um banco descartável:** `npm run test:db -- --reset`. Ele **apaga todos os dados**, então nunca aponte para produção.

## Checklist

- [ ] Repositório próprio criado e código enviado
- [ ] Rodou localmente e fez login
- [ ] Banco de produção criado e `db:migrate` aplicado
- [ ] Storage S3/R2/Supabase configurado (se for usar a Vercel) e upload de capa testado
- [ ] Se usar Supabase: Data API desligada
- [ ] SMTP configurado e convite de teste recebido (opcional)
- [ ] `BETTER_AUTH_SECRET` próprio de produção
- [ ] Admin de produção criado
- [ ] Região do `vercel.json` próxima ao banco
- [ ] Deploy feito e `APP_URL` apontando para o domínio final
- [ ] Cópia segura do `.env.production.local`
