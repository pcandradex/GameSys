"use client";

import { useRouter } from "next/navigation";
import GameForm, { toGameFormData, type GameFormValues } from "@/components/GameForm";
import { updateGame } from "@/app/dashboard/actions";

interface EditGameFormProps {
  game: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
  };
}

export default function EditGameForm({ game }: EditGameFormProps) {
  const router = useRouter();

  async function handleUpdate(values: GameFormValues) {
    const { error } = await updateGame(game.id, toGameFormData(values));

    if (error) {
      return error;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <GameForm
      heading="Editar jogo"
      subheading="Atualize as informações do jogo"
      initialTitle={game.title}
      initialDescription={game.description ?? ""}
      initialImageUrl={game.image_url}
      submitLabel="Salvar alterações"
      loadingLabel="Salvando..."
      onSubmit={handleUpdate}
    />
  );
}
