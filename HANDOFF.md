# Recebendo o GameSys

Guia para quem recebeu uma cópia deste projeto e vai rodar a própria instância. A referência técnica completa está no [README.md](README.md). Este arquivo é o roteiro do primeiro dia.

Você recebe **só o código**. Nenhuma conta, banco, chave ou dado de usuário vem junto: tudo abaixo é criado do seu lado, em contas suas.

## 1. Tenha a sua própria cópia do repositório

O repositório original é privado e o seu acesso a ele pode ser removido depois da entrega. Por isso, crie um repositório seu e mova o código para ele:

```bash
git clone https://github.com/pcandradex/GameSys.git
cd GameSys
# crie um repositório vazio na sua conta do GitHub (sem README) e:
git remote set-url origin https://github.com/<seu-usuario>/<seu-repo>.git
git push -u origin main
```

Não use o botão **Fork**: o fork de um repositório privado é apagado se o seu acesso ao original for removido.

## 2. Rode localmente (cerca de 5 minutos, sem criar conta nenhuma)

Requisito: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env.local
```

Em `.env.local`, preencha só `BETTER_AUTH_SECRET`, gerado com `openssl rand -base64 32` ou qualquer texto aleatório com mais de 32 caracteres. O resto já vem pronto para rodar com SQLite e imagens em disco.

```bash
mkdir data
npm run db:migrate
npm run create-admin -- seu@email.com "Seu Nome" "uma-senha-forte"
npm run dev
```

Abra `http://localhost:3000` e entre com o admin criado. Se o login funcionar e você conseguir cadastrar um jogo com imagem, está tudo certo.

Sem SMTP configurado, os e-mails de convite e de recuperação de senha **não são enviados**: o link aparece no terminal onde está rodando o `npm run dev`.

## 3. Contas que você vai precisar para produção

| Para quê | Sugestões (todas têm plano gratuito) | Variáveis no `.env` |
|---|---|---|
| Banco de dados | [Neon](https://neon.tech) (Postgres), [Turso](https://turso.tech) (SQLite), ou qualquer Postgres/MySQL | `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN` no Turso) |
| Imagens | [Cloudflare R2](https://developers.cloudflare.com/r2/) ou AWS S3 | `STORAGE_DRIVER=s3`, `S3_*`, `STORAGE_PUBLIC_URL` |
| E-mail | [Resend](https://resend.com), SendGrid, Brevo… | `SMTP_*`, `EMAIL_FROM` |
| Steam (opcional) | [Steam Web API key](https://steamcommunity.com/dev/apikey), vinculada à sua conta Steam | `STEAM_API_KEY` |
| Hospedagem | [Vercel](https://vercel.com), ou um VPS/Docker seu | — |

Gere um `BETTER_AUTH_SECRET` **novo** para produção, diferente do usado localmente. Se ele mudar depois, todo mundo é deslogado.

## 4. Publicar

**Na Vercel:**

1. Importe o seu repositório na Vercel.
2. Em Settings → Environment Variables, cadastre as variáveis do passo 3, mais `APP_URL=https://seu-dominio`.
3. Rode as migrações apontando para o banco de produção. Faça isso no seu computador, com a `DATABASE_URL` de produção:
   ```bash
   DATABASE_URL="postgres://..." npm run db:migrate
   DATABASE_URL="postgres://..." npm run create-admin -- seu@email.com "Seu Nome"
   ```
   Sem a senha no comando, você recebe por e-mail um link para defini-la. Por isso o SMTP precisa já estar configurado.
4. Faça o deploy.

Na Vercel, o storage precisa ser S3/R2: o disco de lá não é persistente e as imagens sumiriam.

**Num VPS ou Docker:** veja a seção "Deploy" do README. O storage local funciona, desde que `uploads/` (e `data/`, se usar SQLite) fiquem num volume persistente.

## 5. No dia a dia

- **Novos usuários:** pela tela `/admin`. Não há cadastro público.
- **Mudar o banco (schema):** edite os três arquivos em `lib/db/schema/` e rode `npm run db:generate -- --name descricao`. Depois, `npm run db:migrate` em cada ambiente.
- **Antes de publicar uma mudança:** rode `npm run typecheck`, `npm run lint` e `npm run build`.
- **Testar contra um banco descartável:** `npm run test:db -- --reset`. Ele **apaga todos os dados**, então nunca aponte para produção.

## Checklist

- [ ] Repositório próprio criado e código enviado
- [ ] Rodou localmente e fez login
- [ ] Banco de produção criado e `db:migrate` aplicado
- [ ] Storage S3/R2 configurado (se for usar a Vercel)
- [ ] SMTP configurado e convite de teste recebido
- [ ] `BETTER_AUTH_SECRET` próprio de produção
- [ ] Admin de produção criado
- [ ] Deploy feito e `APP_URL` apontando para o domínio final
