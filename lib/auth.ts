import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { db, rawConnection, schema } from "@/lib/db";
import { linkEmail, sendEmail } from "@/lib/email";

// APP_URL (e não NEXT_PUBLIC_*): variáveis NEXT_PUBLIC_ são fixadas no
// bundle durante o build; esta é lida em runtime, então o mesmo build serve
// para qualquer domínio/deploy.
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const MIN_PASSWORD_LENGTH = 8;

async function hasPassword(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, "credential")))
    .limit(1);

  return rows.length > 0;
}

function createAuth() {
  const { dialect, db: database, schema: tables } = rawConnection();

  return betterAuth({
    baseURL: siteUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [siteUrl()],

    database: drizzleAdapter(database, {
      provider: dialect,
      usePlural: true,
      schema: {
        users: tables.users,
        sessions: tables.sessions,
        accounts: tables.accounts,
        verifications: tables.verifications
      }
    }),

    // Contas só existem por convite (app/admin/actions.ts). Convite e
    // recuperação usam o mesmo fluxo de "redefinir senha": o reset cria a
    // credencial quando o usuário ainda não tem senha.
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60 * 24,
      async sendResetPassword({ user, url }) {
        const invite = !(await hasPassword(user.id));

        const content = invite
          ? linkEmail(
              "Você foi convidado para o GameSys",
              "Clique no botão abaixo para definir sua senha e acessar o catálogo de jogos do grupo. O link vale por 24 horas.",
              url,
              "Definir senha"
            )
          : linkEmail(
              "Redefinição de senha",
              "Recebemos um pedido para redefinir sua senha do GameSys. Se não foi você, ignore este e-mail.",
              url,
              "Redefinir senha"
            );

        await sendEmail({
          to: user.email,
          subject: invite ? "Convite para o GameSys" : "Redefinir senha do GameSys",
          ...content
        });
      },
      async onPasswordReset({ user }) {
        // Senha escolhida pelo próprio usuário: libera uma eventual senha
        // temporária pendente. (O link pode ter sido entregue pelo admin por
        // outro canal, então emailVerified é só informativo.)
        await db
          .update(schema.users)
          .set({ emailVerified: true, mustChangePassword: false, updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      }
    },

    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "user", input: false },
        nickname: { type: "string", required: false, input: false },
        steamId: { type: "string", required: false, input: false },
        invitedBy: { type: "string", required: false, input: false }
      }
    },

    session: {
      // Evita uma consulta ao banco por request para validar a sessão.
      cookieCache: { enabled: true, maxAge: 5 * 60 }
    },

    plugins: [nextCookies()]
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { gamesysAuth?: Auth };

/** Lazy, como o db: o build do Next não precisa de DATABASE_URL. */
export function auth(): Auth {
  globalForAuth.gamesysAuth ??= createAuth();
  return globalForAuth.gamesysAuth;
}
