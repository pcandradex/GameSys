import { after } from "next/server";
import { eq } from "drizzle-orm";
import DashboardClient from "@/components/DashboardClient";
import { requireUser } from "@/lib/session";
import { resolveDisplayName } from "@/lib/display-name";
import { groupGamesByTitle } from "@/lib/group-games";
import { listGames } from "@/lib/data/games";
import { db, schema } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { isSyncDue, syncUserLibrary } from "@/lib/steam-sync";

export default async function Dashboard() {
  const user = await requireUser();
  const rows = await listGames();

  // Quem fica logado por dias não passa pelo login, que é onde a biblioteca
  // era sincronizada. Aqui ela é atualizada no máximo a cada 12 h, depois
  // que a página já foi entregue (os jogos novos aparecem no próximo acesso).
  const apiKey = process.env.STEAM_API_KEY;

  if (apiKey && user.steamId && isSyncDue(user.steamSyncedAt)) {
    const { id, steamId } = user;

    // Marca antes de começar, para acessos seguidos não dispararem
    // sincronizações em paralelo.
    await db
      .update(schema.users)
      .set({ steamSyncedAt: new Date() })
      .where(eq(schema.users.id, id));

    after(async () => {
      try {
        const result = await syncUserLibrary(id, steamId, apiKey);
        if ("error" in result) console.warn(`dashboard steam sync (${id}): ${result.error}`);
      } catch (err) {
        console.error(`dashboard steam sync (${id}) failed:`, err);
      }
    });
  }

  return (
    <DashboardClient
      userEmail={user.email}
      userName={resolveDisplayName(user)}
      userAvatarUrl={publicUrl(user.image)}
      isAdmin={user.isAdmin}
      games={groupGamesByTitle(rows, user.id, user.isAdmin)}
    />
  );
}
