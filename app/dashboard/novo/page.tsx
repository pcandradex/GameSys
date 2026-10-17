"use client";

import { useRouter } from "next/navigation";
import GameForm, { toGameFormData, type GameFormValues } from "@/components/GameForm";
import { createGame } from "@/app/dashboard/actions";

export default function NovoJogo() {
  const router = useRouter();

  async function handleCreate(values: GameFormValues) {
    const { error } = await createGame(toGameFormData(values));

    if (error) {
      return error;
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
