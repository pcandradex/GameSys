"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/supabase/require-admin";
import {
  SteamImportError,
  fetchIsFamilySharing,
  fetchOwnedGames,
  mapWithConcurrency,
  resolveSteamId,
  steamHeaderImage
} from "@/lib/steam";

type SupabaseClientType = Awaited<ReturnType<typeof getCurrentProfile>>["supabase"];

async function syncGamesFromSteam(
  supabase: SupabaseClientType,
  userId: string,
  steamId: string,
  apiKey: string
): Promise<{ imported: number } | { error: string }> {
  let games;

  try {
    games = await fetchOwnedGames(steamId, apiKey);
  } catch (err) {
    if (err instanceof SteamImportError) {
      return { error: "Não foi possível falar com a Steam. Tente de novo." };
    }
    throw err;
  }

  if (games.length === 0) {
    return { imported: 0 };
  }

  const familySharing = await mapWithConcurrency(games, 8, (game) =>
    fetchIsFamilySharing(game.appid)
  );

  const rows = games.map((game, index) => ({
    title: game.name,
    image_url: steamHeaderImage(game.appid),
    created_by: userId,
    steam_appid: game.appid,
    steam_family_shared: familySharing[index]
  }));

  const { error: upsertError } = await supabase
    .from("games")
    .upsert(rows, { onConflict: "created_by,steam_appid", ignoreDuplicates: true });

  if (upsertError) {
    return { error: "Não foi possível importar os jogos. Tente novamente." };
  }

  return { imported: games.length };
}

export type SteamImportState = {
  error?: string;
  success?: string;
};

export async function importSteamGames(
  _prevState: SteamImportState,
  formData: FormData
): Promise<SteamImportState> {
  const { supabase, user } = await getCurrentProfile();

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

  const result = await syncGamesFromSteam(supabase, user.id, steamId, apiKey);

  if ("error" in result) {
    return { error: result.error };
  }

  if (result.imported === 0) {
    return {
      error:
        'Nenhum jogo encontrado. Confira se o perfil e os "Detalhes do jogo" estão marcados como públicos nas configurações de privacidade da Steam.'
    };
  }

  await supabase.from("profiles").update({ steam_id: steamId }).eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/conta");

  return {
    success: `Sincronizado! ${result.imported} jogos encontrados na sua biblioteca Steam.`
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
  const { supabase, user } = await getCurrentProfile();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { error, count } = await supabase
    .from("games")
    .delete({ count: "exact" })
    .eq("created_by", user.id)
    .not("steam_appid", "is", null);

  if (error) {
    return { error: "Não foi possível remover os jogos importados." };
  }

  await supabase.from("profiles").update({ steam_id: null }).eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/conta");

  return {
    success: count
      ? `${count} jogos importados da Steam foram removidos.`
      : "Você não tinha jogos importados da Steam."
  };
}

/**
 * Roda em toda vez que o usuário loga (chamado pelo LoginForm): se a conta
 * já tem um SteamID vinculado, reimporta a biblioteca pra manter os jogos
 * atualizados com a Steam automaticamente. Falha em silêncio — um problema
 * na API da Steam não pode impedir o login.
 */
export async function syncSteamLibraryForCurrentUser(): Promise<void> {
  const { supabase, user } = await getCurrentProfile();

  if (!user) {
    return;
  }

  const apiKey = process.env.STEAM_API_KEY;

  if (!apiKey) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("steam_id")
    .eq("id", user.id)
    .single();

  if (!profile?.steam_id) {
    return;
  }

  await syncGamesFromSteam(supabase, user.id, profile.steam_id, apiKey);

  revalidatePath("/dashboard");
}
