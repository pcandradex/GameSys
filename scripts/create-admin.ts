/**
 * Cria (ou promove) o administrador inicial — como não há cadastro público,
 * é a única forma de entrar num banco recém-criado.
 *
 *   npm run create-admin -- admin@exemplo.com "Nome" [senha]
 *
 * Sem senha, envia o e-mail de convite (ou imprime o link no terminal, se
 * SMTP não estiver configurado).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [rawEmail, name = "", password] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    console.error('Uso: npm run create-admin -- <email> ["Nome"] [senha]');
    process.exit(1);
  }

  const { and, eq } = await import("drizzle-orm");
  const { db, schema } = await import("../lib/db");
  const { auth, siteUrl, MIN_PASSWORD_LENGTH } = await import("../lib/auth");
  const { hashPassword } = await import("better-auth/crypto");

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const userId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    await db
      .update(schema.users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
    console.log(`${email} já existia — promovido a admin.`);
  } else {
    await db.insert(schema.users).values({ id: userId, name, email, role: "admin" });
    console.log(`Admin ${email} criado.`);
  }

  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      process.exit(1);
    }

    const hash = await hashPassword(password);
    const credential = and(
      eq(schema.accounts.userId, userId),
      eq(schema.accounts.providerId, "credential")
    );
    const [account] = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(credential)
      .limit(1);

    if (account) {
      await db
        .update(schema.accounts)
        .set({ password: hash, updatedAt: new Date() })
        .where(eq(schema.accounts.id, account.id));
    } else {
      await db.insert(schema.accounts).values({
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash
      });
    }

    await db
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.id, userId));

    console.log("Senha definida. Já pode entrar pelo app.");
  } else {
    await auth().api.requestPasswordReset({
      body: { email, redirectTo: `${siteUrl()}/alterar-senha` }
    });
    console.log("Link para definir a senha enviado.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
