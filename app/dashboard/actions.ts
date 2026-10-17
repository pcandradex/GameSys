"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canManageGame, getGame } from "@/lib/data/games";
import { removeImage, uploadImage } from "@/lib/storage";

export type ActionResult = { error?: string; success?: string };

const SESSION_EXPIRED = "Sessão expirada. Faça login novamente.";

function readGameFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 255);
  const description = String(formData.get("description") ?? "").trim() || null;
  const file = formData.get("image");
  const imageFile = file instanceof File && file.size > 0 ? file : null;

  return { title, description, imageFile };
}

export async function createGame(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  const { title, description, imageFile } = readGameFields(formData);

  if (!title) {
    return { error: "Informe o título do jogo." };
  }

  let image: string | null = null;

  if (imageFile) {
    const upload = await uploadImage(imageFile, "game-covers", user.id);

    if ("error" in upload) {
      return { error: upload.error };
    }

    image = upload.key;
  }

  try {
    await db.insert(schema.games).values({
      id: crypto.randomUUID(),
      title,
      description,
      image,
      createdBy: user.id
    });
  } catch (err) {
    console.error("createGame failed:", err);
    await removeImage(image);
    return { error: "Não foi possível cadastrar o jogo. Tente novamente." };
  }

  revalidatePath("/dashboard");
  return { success: "Jogo cadastrado." };
}

export async function updateGame(
  gameId: string,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  const game = await getGame(gameId);

  if (!game || !canManageGame(user, game)) {
    return { error: "Você não pode editar este jogo." };
  }

  const { title, description, imageFile } = readGameFields(formData);

  if (!title) {
    return { error: "Informe o título do jogo." };
  }

  let image = game.image;

  if (imageFile) {
    const upload = await uploadImage(imageFile, "game-covers", user.id);

    if ("error" in upload) {
      return { error: upload.error };
    }

    image = upload.key;
  }

  try {
    await db
      .update(schema.games)
      .set({ title, description, image, updatedAt: new Date() })
      .where(eq(schema.games.id, game.id));
  } catch (err) {
    console.error("updateGame failed:", err);
    if (image !== game.image) await removeImage(image);
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  if (image !== game.image) {
    await removeImage(game.image);
  }

  revalidatePath("/dashboard");
  return { success: "Jogo atualizado." };
}

export async function deleteGame(gameId: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  const game = await getGame(gameId);

  if (!game || !canManageGame(user, game)) {
    return { error: "Você não pode excluir este jogo." };
  }

  try {
    await db.delete(schema.games).where(eq(schema.games.id, game.id));
  } catch (err) {
    console.error("deleteGame failed:", err);
    return { error: "Não foi possível excluir o jogo." };
  }

  await removeImage(game.image);

  revalidatePath("/dashboard");
  return { success: "Jogo excluído." };
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 40) || null;
  const file = formData.get("avatar");
  let image = user.image;

  if (file instanceof File && file.size > 0) {
    const upload = await uploadImage(file, "avatars", user.id);

    if ("error" in upload) {
      return { error: upload.error };
    }

    image = upload.key;
  }

  try {
    await db
      .update(schema.users)
      .set({ nickname, image, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
  } catch (err) {
    console.error("updateProfile failed:", err);
    if (image !== user.image) await removeImage(image);
    return { error: "Não foi possível salvar o perfil. Tente novamente." };
  }

  if (image !== user.image) {
    await removeImage(user.image);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/conta");
  return { success: "Perfil atualizado!" };
}
