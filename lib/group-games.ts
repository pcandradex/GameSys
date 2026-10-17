export const RECENT_DAYS = 14;

export function isRecentlyAdded(addedAt: string): boolean {
  const threshold = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(addedAt).getTime() >= threshold;
}

interface OwnerProfileFields {
  nickname: string | null;
  name: string | null;
  email: string;
}

export interface OwnerProfile extends OwnerProfileFields {
  id: string;
}

export interface RawGameRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  created_by: string;
  creator: OwnerProfileFields | null;
  steam_family_shared: boolean | null;
}

export interface GroupedGame {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  addedAt: string;
  owners: OwnerProfile[];
  manageGameId: string | null;
  familyShared: boolean | null;
}

/**
 * Jogos com o mesmo título (case-insensitive) viram um único card, somando
 * os nicknames de todo mundo que cadastrou — em vez de duplicar no dashboard.
 */
export function groupGamesByTitle(
  rows: RawGameRow[],
  currentUserId: string,
  isAdmin: boolean
): GroupedGame[] {
  const groups = new Map<string, RawGameRow[]>();

  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    const list = groups.get(key);

    if (list) {
      list.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const result: GroupedGame[] = [];

  for (const groupRows of groups.values()) {
    const withImage = groupRows.find((r) => r.image_url) ?? groupRows[0];
    const withDescription =
      groupRows.find((r) => r.description) ?? groupRows[0];

    const manageRow =
      groupRows.find((r) => r.created_by === currentUserId) ??
      (isAdmin ? groupRows[0] : null);

    // Data em que o jogo entrou no sistema pela primeira vez — usa a mais
    // antiga do grupo, então não muda quando alguém sincroniza de novo ou
    // quando outra pessoa adiciona o mesmo título depois.
    const addedAt = groupRows.reduce(
      (earliest, r) => (r.created_at < earliest ? r.created_at : earliest),
      groupRows[0].created_at
    );

    const seen = new Set<string>();
    const owners: OwnerProfile[] = [];

    for (const row of groupRows) {
      if (seen.has(row.created_by)) {
        continue;
      }

      seen.add(row.created_by);
      owners.push({
        id: row.created_by,
        ...(row.creator ?? { nickname: null, name: null, email: "" })
      });
    }

    const familyShared =
      groupRows.find((r) => r.steam_family_shared !== null)
        ?.steam_family_shared ?? null;

    result.push({
      id: groupRows[0].id,
      title: groupRows[0].title,
      description: withDescription.description,
      image_url: withImage.image_url,
      addedAt,
      owners,
      manageGameId: manageRow?.id ?? null,
      familyShared
    });
  }

  return result.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}
