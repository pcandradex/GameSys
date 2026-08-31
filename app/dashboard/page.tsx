import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import { getCurrentProfile } from "@/lib/supabase/require-admin";
import { resolveDisplayName } from "@/lib/display-name";
import { groupGamesByTitle } from "@/lib/group-games";

export default async function Dashboard() {
  const { supabase, user, isAdmin } = await getCurrentProfile();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: games } = await supabase
    .from("games")
    .select(
      "id, title, description, image_url, created_at, created_by, steam_family_shared, creator:profiles!games_created_by_fkey(nickname, full_name, email)"
    )
    .order("created_at", { ascending: false });

  const rows = (games ?? []).map((game) => ({
    ...game,
    creator: Array.isArray(game.creator) ? game.creator[0] ?? null : game.creator
  }));

  return (
    <DashboardClient
      userEmail={user.email ?? ""}
      userName={resolveDisplayName({ ...profile, email: user.email ?? "" })}
      userAvatarUrl={profile?.avatar_url ?? null}
      isAdmin={isAdmin}
      games={groupGamesByTitle(rows, user.id, isAdmin)}
    />
  );
}
