import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import type { RawGameRow } from "@/lib/group-games";

/** Dono do jogo ou admin pode editar/excluir (antes era a policy de RLS). */
export function canManageGame(user: CurrentUser, game: { createdBy: string }): boolean {
  return game.createdBy === user.id || user.isAdmin;
}

export async function listGames(): Promise<RawGameRow[]> {
  const { games, users } = schema;

  const rows = await db
    .select({
      id: games.id,
      title: games.title,
      description: games.description,
      image: games.image,
      createdAt: games.createdAt,
      createdBy: games.createdBy,
      steamFamilyShared: games.steamFamilyShared,
      creatorNickname: users.nickname,
      creatorName: users.name,
      creatorEmail: users.email
    })
    .from(games)
    .innerJoin(users, eq(games.createdBy, users.id))
    .orderBy(desc(games.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    image_url: publicUrl(row.image),
    created_at: row.createdAt.toISOString(),
    created_by: row.createdBy,
    steam_family_shared: row.steamFamilyShared,
    creator: {
      nickname: row.creatorNickname,
      name: row.creatorName,
      email: row.creatorEmail
    }
  }));
}

export async function getGame(id: string) {
  const [game] = await db
    .select({
      id: schema.games.id,
      title: schema.games.title,
      description: schema.games.description,
      image: schema.games.image,
      createdBy: schema.games.createdBy
    })
    .from(schema.games)
    .where(eq(schema.games.id, id))
    .limit(1);

  return game ?? null;
}
