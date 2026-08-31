"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GameForm, { type GameFormValues } from "@/components/GameForm";

export default function NovoJogo() {
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate({
    title,
    description,
    imageFile
  }: GameFormValues) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return "Sessão expirada. Faça login novamente.";
    }

    let imageUrl: string | null = null;

    if (imageFile) {
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

      imageUrl = publicUrl;
    }

    const { error } = await supabase.from("games").insert({
      title,
      description: description || null,
      image_url: imageUrl
    });

    if (error) {
      return "Não foi possível cadastrar o jogo. Tente novamente.";
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <GameForm
      heading="Cadastrar jogo"
      subheading="Preencha as informações do jogo"
      submitLabel="Cadastrar jogo"
      loadingLabel="Cadastrando..."
      onSubmit={handleCreate}
    />
  );
}
