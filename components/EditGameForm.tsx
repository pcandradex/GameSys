"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractGameCoverPath } from "@/lib/game-image";
import GameForm, { type GameFormValues } from "@/components/GameForm";

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
  const supabase = createClient();

  async function handleUpdate({
    title,
    description,
    imageFile
  }: GameFormValues) {
    let imageUrl = game.image_url;

    if (imageFile) {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        return "Sessão expirada. Faça login novamente.";
      }

      const extension = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("game-covers")
        .upload(path, imageFile);

      if (uploadError) {
        return "Não foi possível enviar a imagem. Tente novamente.";
      }

      const {
        data: { publicUrl }
      } = supabase.storage.from("game-covers").getPublicUrl(path);

      const oldPath = extractGameCoverPath(game.image_url);

      if (oldPath) {
        await supabase.storage.from("game-covers").remove([oldPath]);
      }

      imageUrl = publicUrl;
    }

    const { error } = await supabase
      .from("games")
      .update({
        title,
        description: description || null,
        image_url: imageUrl
      })
      .eq("id", game.id);

    if (error) {
      return "Não foi possível salvar as alterações. Tente novamente.";
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
