import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { generateRandomString } from "better-auth/crypto";
import { auth, siteUrl } from "@/lib/auth";
import { db, schema } from "@/lib/db";

/**
 * Alternativas ao e-mail para dar acesso a um usuário, usadas pelo admin
 * quando o SMTP não está disponível (ou o e-mail não chega).
 */

// Sem caracteres ambíguos (0/O, 1/l/I) — a senha costuma ser ditada ou
// digitada a partir de uma mensagem.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

/**
 * Link de definição de senha para um usuário, igual ao enviado por e-mail
 * (mesmo token, mesma validade e uso único), mas devolvido para o admin
 * copiar e mandar por outro canal.
 */
export async function createPasswordSetupLink(userId: string): Promise<string> {
  const ctx = await auth().$context;
  const token = generateRandomString(32, "a-z", "A-Z", "0-9");
  const expiresIn = ctx.options.emailAndPassword?.resetPasswordTokenExpiresIn ?? 3600;

  // Mesmo formato que o Better Auth usa em requestPasswordReset, para que o
  // link passe pela validação normal de /api/auth/reset-password/:token.
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + expiresIn * 1000)
  });

  const callbackURL = encodeURIComponent(`${siteUrl()}/alterar-senha`);
  return `${siteUrl()}/api/auth/reset-password/${token}?callbackURL=${callbackURL}`;
}

/**
 * Define uma senha temporária: o usuário entra com ela e é obrigado a trocar
 * antes de usar o app. Encerra as sessões abertas do usuário.
 */
export async function setTemporaryPassword(userId: string, password: string): Promise<void> {
  const ctx = await auth().$context;
  const hash = await ctx.password.hash(password);

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
      .set({ password: hash })
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
    .set({ mustChangePassword: true })
    .where(eq(schema.users.id, userId));

  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
