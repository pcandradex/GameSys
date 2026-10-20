"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getActiveUser } from "@/lib/session";
import {
  SteamImportError,
  fetchIsFamilySharing,
  fetchOwnedGames,
  mapWithConcurrency,
  resolveSteamId,
  steamHeaderImage
} from "@/lib/steam";

// Lotes pequenos o bastante para o limite de parâmetros de qualquer banco
// (SQLite antigo: 999 parâmetros por query).
const BATCH_SIZE = 90;

// Quantas consultas à Store API da Steam por sincronização. O resto fica
// para as próximas (a Store limita ~200 req/5 min por IP, e a Server Action
// tem tempo máximo de execução).
const FAMILY_LOOKUPS_PER_SYNC = 60;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/**
 * Sincronização incremental: só insere os appids que o usuário ainda não
 * tem, e só consulta "Family Sharing" de jogos com o dado desconhecido —
 * reaproveitando o que já se sabe sobre o mesmo appid de outros usuários.
 */
async function syncGamesFromSteam(
  userId: string,
  steamId: string,
  apiKey: string
): Promise<{ found: number; added: number } | { error: string }> {
  const { games } = schema;
  let owned;

  try {
    owned = await fetchOwnedGames(steamId, apiKey);
  } catch (err) {
    if (err instanceof SteamImportError) {
      return { error: "Não foi possível falar com a Steam. Tente de novo." };
    }
    throw err;
  }

  if (owned.length === 0) {
    return { found: 0, added: 0 };
  }

  const existing = await db
    .select({ appid: games.steamAppid })
    .from(games)
    .where(and(eq(games.createdBy, userId), isNotNull(games.steamAppid)));

  const existingIds = new Set(existing.map((row) => row.appid));
  const newGames = owned.filter((game) => !existingIds.has(game.appid));

  // Family Sharing é propriedade do appid (igual pra todo mundo): se outro
  // usuário já tem o mesmo jogo checado, reaproveita.
  const known = new Map<number, boolean>();

  for (const ids of chunk(newGames.map((g) => g.appid), BATCH_SIZE)) {
    const rows = await db
      .selectDistinct({ appid: games.steamAppid, shared: games.steamFamilyShared })
      .from(games)
      .where(and(inArray(games.steamAppid, ids), isNotNull(games.steamFamilyShared)));

    for (const row of rows) {
      if (row.appid !== null && row.shared !== null) known.set(row.appid, row.shared);
    }
  }

  try {
    for (const batch of chunk(newGames, BATCH_SIZE)) {
      await db.insert(games).values(
        batch.map((game) => ({
          id: crypto.randomUUID(),
          title: game.name,
          image: steamHeaderImage(game.appid),
          createdBy: userId,
          steamAppid: game.appid,
          steamFamilyShared: known.get(game.appid) ?? null
        }))
      );
    }
  } catch (err) {
    // Provável sincronização concorrente (unique created_by+steam_appid).
    console.error("steam import insert failed:", err);
    return { error: "Não foi possível importar os jogos. Tente novamente." };
  }

  const unknown = await db
    .select({ appid: games.steamAppid })
    .from(games)
    .where(
      and(
        eq(games.createdBy, userId),
        isNotNull(games.steamAppid),
        isNull(games.steamFamilyShared)
      )
    )
    .limit(FAMILY_LOOKUPS_PER_SYNC);

  const appids = unknown.map((row) => row.appid!);
  const results = await mapWithConcurrency(appids, 8, fetchIsFamilySharing);

  for (const shared of [true, false]) {
    const ids = appids.filter((_, i) => results[i] === shared);
    if (ids.length === 0) continue;

    await db
      .update(games)
      .set({ steamFamilyShared: shared })
      .where(and(eq(games.createdBy, userId), inArray(games.steamAppid, ids)));
  }

  return { found: owned.length, added: newGames.length };
}

export type SteamImportState = {
  error?: string;
  success?: string;
};

export async function importSteamGames(
  _prevState: SteamImportState,
  formData: FormData
): Promise<SteamImportState> {
  const user = await getActiveUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const input = String(formData.get("steamUrl") ?? "").trim();

  if (!input) {
    return { error: "Informe a URL ou o SteamID do seu perfil." };
  }

  const apiKey = process.env.STEAM_API_KEY;

  if (!apiKey) {
    return {
      error: "Integração com a Steam não configurada (STEAM_API_KEY ausente)."
    };
  }

  let steamId: string;

  try {
    steamId = await resolveSteamId(input, apiKey);
  } catch {
    return { error: "Não encontrei esse perfil da Steam. Confira a URL." };
  }

  const result = await syncGamesFromSteam(user.id, steamId, apiKey);

  if ("error" in result) {
    return { error: result.error };
  }

  if (result.found === 0) {
    return {
      error:
        'Nenhum jogo encontrado. Confira se o perfil e os "Detalhes do jogo" estão marcados como públicos nas configurações de privacidade da Steam.'
    };
  }

  await db
    .update(schema.users)
    .set({ steamId, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/conta");

  return {
    success: `Sincronizado! ${result.found} jogos na sua biblioteca Steam (${result.added} novos).`
  };
}

export type SteamRemoveState = {
  error?: string;
  success?: string;
};

export async function removeSteamImportedGames(
  _prevState: SteamRemoveState,
  _formData: FormData
): Promise<SteamRemoveState> {
  const user = await getActiveUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const imported = and(
    eq(schema.games.createdBy, user.id),
    isNotNull(schema.games.steamAppid)
  );

  try {
    const rows = await db.select({ id: schema.games.id }).from(schema.games).where(imported);
    await db.delete(schema.games).where(imported);
    await db
      .update(schema.users)
      .set({ steamId: null, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/conta");

    return {
      success: rows.length
        ? `${rows.length} jogos importados da Steam foram removidos.`
        : "Você não tinha jogos importados da Steam."
    };
  } catch (err) {
    console.error("removeSteamImportedGames failed:", err);
    return { error: "Não foi possível remover os jogos importados." };
  }
}

/**
 * Roda em toda vez que o usuário loga (chamado pelo LoginForm): se a conta
 * já tem um SteamID vinculado, traz os jogos novos da biblioteca. Falha em
 * silêncio — um problema na API da Steam não pode impedir o login.
 */
export async function syncSteamLibraryForCurrentUser(): Promise<void> {
  const user = await getActiveUser();
  const apiKey = process.env.STEAM_API_KEY;

  if (!user?.steamId || !apiKey) {
    return;
  }

  await syncGamesFromSteam(user.id, user.steamId, apiKey);

  revalidatePath("/dashboard");
}
