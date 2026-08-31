import { notFound, redirect } from "next/navigation";
import EditGameForm from "@/components/EditGameForm";
import { getCurrentProfile } from "@/lib/supabase/require-admin";

export default async function EditarJogo({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, isAdmin } = await getCurrentProfile();

  if (!user) {
    redirect("/");
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, title, description, image_url, created_by")
    .eq("id", id)
    .single();

  if (!game) {
    notFound();
  }

  if (game.created_by !== user.id && !isAdmin) {
    redirect("/dashboard");
  }

  return <EditGameForm game={game} />;
}
