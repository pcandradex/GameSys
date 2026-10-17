import DashboardClient from "@/components/DashboardClient";
import { requireUser } from "@/lib/session";
import { resolveDisplayName } from "@/lib/display-name";
import { groupGamesByTitle } from "@/lib/group-games";
import { listGames } from "@/lib/data/games";
import { publicUrl } from "@/lib/storage";

export default async function Dashboard() {
  const user = await requireUser();
  const rows = await listGames();

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
