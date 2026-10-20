import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  SteamImportError,
  fetchIsFamilySharing,
  fetchOwnedGames,
  mapWithConcurrency,
  steamHeaderImage
} from "@/lib/steam";

/**
 * Sincronização da biblioteca Steam, usada por três caminhos:
 * - login e botão "Importar" (app/dashboard/conta/steam-actions.ts);
 * - abertura do dashboard, no máximo a cada DASHBOARD_SYNC_INTERVAL_MS;
 * - rotina diária para todos os usuários (rota /api/cron/steam-sync ou
 *   `npm run sync:steam`).
 */

// Lotes pequenos o bastante para o limite de parâmetros de qualquer banco
// (SQLite antigo: 999 parâmetros por query).
const BATCH_SIZE = 90;

// Consultas à Store API ("Family Sharing") por usuário em cada sincronização.
// O resto fica para as próximas: a Store limita ~200 req/5 min por IP.
export const FAMILY_LOOKUPS_PER_USER = 60;

// Teto de consultas à Store API numa execução da rotina diária, somando
// todos os usuários (abaixo do limite da Steam, com folga).
const FAMILY_LOOKUPS_PER_RUN = 150;

export const DASHBOARD_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export type SyncResult =
  | { found: number; added: number; familyChecked: number }
  | { error: string };

/**
 * Sincronização incremental de um usuário: só insere os appids que ele
 * ainda não tem, e só consulta "Family Sharing" de jogos com o dado
 * desconhecido — reaproveitando o que já se sabe do mesmo appid em outros
 * usuários. Em caso de sucesso, registra users.steamSyncedAt.
 */
export async function syncUserLibrary(
  userId: string,
  steamId: string,
  apiKey: string,
  { familyLookups = FAMILY_LOOKUPS_PER_USER }: { familyLookups?: number } = {}
): Promise<SyncResult> {
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

  let familyChecked = 0;

  if (familyLookups > 0) {
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
      .limit(familyLookups);

    const appids = unknown.map((row) => row.appid!);
    const results = await mapWithConcurrency(appids, 8, fetchIsFamilySharing);
    familyChecked = appids.length;

    for (const shared of [true, false]) {
      const ids = appids.filter((_, i) => results[i] === shared);
      if (ids.length === 0) continue;

      await db
        .update(games)
        .set({ steamFamilyShared: shared })
        .where(and(eq(games.createdBy, userId), inArray(games.steamAppid, ids)));
    }
  }

  await db
    .update(schema.users)
    .set({ steamSyncedAt: new Date() })
    .where(eq(schema.users.id, userId));

  return { found: owned.length, added: newGames.length, familyChecked };
}

export interface SyncAllSummary {
  usersWithSteam: number;
  synced: number;
  gamesAdded: number;
  familyChecked: number;
  failed: { userId: string; error: string }[];
  /** Ficaram para a próxima execução (tempo esgotado). */
  pending: number;
  durationMs: number;
}

/**
 * Sincroniza todos os usuários com Steam vinculada, começando pelos que
 * estão há mais tempo sem sincronizar. Para de iniciar novos usuários ao
 * atingir `timeBudgetMs` — os restantes são os primeiros da próxima vez.
 */
export async function syncAllUsers({
  timeBudgetMs = Infinity
}: { timeBudgetMs?: number } = {}): Promise<SyncAllSummary> {
  const started = Date.now();
  const apiKey = process.env.STEAM_API_KEY;

  if (!apiKey) {
    throw new Error("STEAM_API_KEY não configurada.");
  }

  const users = await db
    .select({
      id: schema.users.id,
      steamId: schema.users.steamId,
      steamSyncedAt: schema.users.steamSyncedAt
    })
    .from(schema.users)
    .where(isNotNull(schema.users.steamId));

  // Nunca sincronizados primeiro, depois do mais antigo para o mais recente.
  // (Ordenado aqui: NULLS FIRST não tem a mesma sintaxe nos três bancos.)
  users.sort((a, b) => (a.steamSyncedAt?.getTime() ?? 0) - (b.steamSyncedAt?.getTime() ?? 0));

  const summary: SyncAllSummary = {
    usersWithSteam: users.length,
    synced: 0,
    gamesAdded: 0,
    familyChecked: 0,
    failed: [],
    pending: 0,
    durationMs: 0
  };

  let familyBudget = FAMILY_LOOKUPS_PER_RUN;

  for (const [index, user] of users.entries()) {
    if (Date.now() - started > timeBudgetMs) {
      summary.pending = users.length - index;
      break;
    }

    try {
      const result = await syncUserLibrary(user.id, user.steamId!, apiKey, {
        familyLookups: Math.min(FAMILY_LOOKUPS_PER_USER, familyBudget)
      });

      if ("error" in result) {
        summary.failed.push({ userId: user.id, error: result.error });
        continue;
      }

      summary.synced++;
      summary.gamesAdded += result.added;
      summary.familyChecked += result.familyChecked;
      familyBudget -= result.familyChecked;
    } catch (err) {
      console.error(`steam sync failed for ${user.id}:`, err);
      summary.failed.push({ userId: user.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  summary.durationMs = Date.now() - started;
  return summary;
}

/** O usuário está há mais de DASHBOARD_SYNC_INTERVAL_MS sem sincronizar? */
export function isSyncDue(steamSyncedAt: Date | null, now = Date.now()): boolean {
  return !steamSyncedAt || now - steamSyncedAt.getTime() > DASHBOARD_SYNC_INTERVAL_MS;
}
