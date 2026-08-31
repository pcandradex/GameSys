export interface SteamOwnedGame {
  appid: number;
  name: string;
}

export class SteamImportError extends Error {}

const STEAMID_RE = /^\d{17}$/;
const PROFILE_URL_RE = /steamcommunity\.com\/profiles\/(\d{17})/i;
const VANITY_URL_RE = /steamcommunity\.com\/id\/([^/]+)/i;

export async function resolveSteamId(
  input: string,
  apiKey: string
): Promise<string> {
  const trimmed = input.trim();

  if (STEAMID_RE.test(trimmed)) {
    return trimmed;
  }

  const profileMatch = trimmed.match(PROFILE_URL_RE);

  if (profileMatch) {
    return profileMatch[1];
  }

  const vanityMatch = trimmed.match(VANITY_URL_RE);
  const vanity = vanityMatch ? vanityMatch[1] : trimmed;

  const url = new URL(
    "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("vanityurl", vanity);

  const response = await fetch(url);

  if (!response.ok) {
    throw new SteamImportError("steam_api_error");
  }

  const data = await response.json();

  if (data?.response?.success !== 1 || !data.response.steamid) {
    throw new SteamImportError("profile_not_found");
  }

  return data.response.steamid as string;
}

export async function fetchOwnedGames(
  steamId: string,
  apiKey: string
): Promise<SteamOwnedGame[]> {
  const url = new URL(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("format", "json");

  const response = await fetch(url);

  if (!response.ok) {
    throw new SteamImportError("steam_api_error");
  }

  const data = await response.json();

  return (data?.response?.games ?? []) as SteamOwnedGame[];
}

export function steamHeaderImage(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/**
 * Se a ficha do jogo na loja Steam lista a categoria "Family Sharing".
 * Retorna null quando não dá pra checar (timeout, rate limit, appid
 * removido da loja etc) — nesse caso o jogo só fica de fora do filtro.
 */
export async function fetchIsFamilySharing(
  appid: number
): Promise<boolean | null> {
  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", String(appid));
    url.searchParams.set("filters", "categories");

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const entry = data?.[String(appid)];

    if (!entry?.success) {
      return null;
    }

    const categories: { description?: string }[] = entry.data?.categories ?? [];

    return categories.some((category) =>
      category.description?.toLowerCase().includes("family sharing")
    );
  } catch {
    return null;
  }
}

/**
 * Roda `fn` sobre `items` com no máximo `limit` chamadas em paralelo —
 * usado pra consultar a Store API por jogo sem virar uma fila sequencial
 * gigante (nem estourar o tempo de execução da Server Action).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );

  return results;
}
