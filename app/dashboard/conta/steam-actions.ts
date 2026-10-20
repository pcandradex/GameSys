"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getActiveUser } from "@/lib/session";
import { resolveSteamId } from "@/lib/steam";
import { syncUserLibrary } from "@/lib/steam-sync";

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

  const result = await syncUserLibrary(user.id, steamId, apiKey);

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
 * (Quem fica logado é coberto pelo dashboard e pela rotina diária.)
 */
export async function syncSteamLibraryForCurrentUser(): Promise<void> {
  const user = await getActiveUser();
  const apiKey = process.env.STEAM_API_KEY;

  if (!user?.steamId || !apiKey) {
    return;
  }

  await syncUserLibrary(user.id, user.steamId, apiKey);

  revalidatePath("/dashboard");
}
