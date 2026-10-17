import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  image: string | null;
  steamId: string | null;
  isAdmin: boolean;
}

/**
 * Usuário logado, lido do banco a cada request (a sessão em si vem do
 * cookie cache do Better Auth). Ler o registro garante que papel e perfil
 * estão atualizados e que um usuário removido perde o acesso na hora.
 *
 * Toda checagem de permissão do app parte daqui — não há RLS no banco.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // headers() primeiro: marca a rota como dinâmica antes de tocar no banco.
  const requestHeaders = await headers();
  const session = await auth().api.getSession({ headers: requestHeaders });

  if (!session) {
    return null;
  }

  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      nickname: schema.users.nickname,
      image: schema.users.image,
      steamId: schema.users.steamId,
      role: schema.users.role
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!row) {
    return null;
  }

  const { role, ...user } = row;
  return { ...user, isAdmin: role === "admin" };
});

/** Para páginas: redireciona ao login se não houver sessão. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}
