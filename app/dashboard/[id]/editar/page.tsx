import { notFound, redirect } from "next/navigation";
import EditGameForm from "@/components/EditGameForm";
import { requireUser } from "@/lib/session";
import { canManageGame, getGame } from "@/lib/data/games";
import { publicUrl } from "@/lib/storage";

export default async function EditarJogo({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const game = await getGame(id);

  if (!game) {
    notFound();
  }

  if (!canManageGame(user, game)) {
    redirect("/dashboard");
  }

  return (
    <EditGameForm
      game={{
        id: game.id,
        title: game.title,
        description: game.description,
        image_url: publicUrl(game.image)
      }}
    />
  );
}
