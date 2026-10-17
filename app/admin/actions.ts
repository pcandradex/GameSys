"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth, siteUrl } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { removeImage } from "@/lib/storage";

export type InviteState = {
  error?: string;
  success?: string;
};

async function sendInviteEmail(email: string) {
  // O mesmo endpoint de "esqueci a senha": o e-mail sai com o texto de
  // convite porque o usuário ainda não tem senha (ver lib/auth.ts).
  await auth().api.requestPasswordReset({
    body: { email, redirectTo: `${siteUrl()}/alterar-senha` }
  });
}

export async function inviteUser(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    return { error: "Apenas administradores podem convidar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 255);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return { error: "Este e-mail já possui uma conta no GameSys." };
  }

  try {
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      name: fullName,
      email,
      role: "user",
      invitedBy: user.id
    });

    await sendInviteEmail(email);
  } catch (err) {
    console.error("inviteUser failed:", err);
    return {
      error:
        "Não foi possível enviar o convite. Confira a configuração de SMTP e use “Reenviar convite”."
    };
  }

  revalidatePath("/admin");
  return { success: `Convite enviado para ${email}.` };
}

export type ResendInviteState = InviteState;

export async function resendInvite(
  _prevState: ResendInviteState,
  formData: FormData
): Promise<ResendInviteState> {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    return { error: "Apenas administradores podem reenviar convites." };
  }

  const email = String(formData.get("email") ?? "");

  try {
    await sendInviteEmail(email);
  } catch (err) {
    console.error("resendInvite failed:", err);
    return { error: "Falha ao reenviar." };
  }

  return { success: "Reenviado." };
}

export type DeleteUserState = {
  error?: string;
  success?: string;
};

export async function deleteUser(
  _prevState: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    return { error: "Apenas administradores podem remover usuários." };
  }

  const targetId = String(formData.get("userId") ?? "");

  if (!targetId) {
    return { error: "Usuário inválido." };
  }

  if (targetId === user.id) {
    return { error: "Você não pode remover a própria conta." };
  }

  const [target] = await db
    .select({ image: schema.users.image })
    .from(schema.users)
    .where(eq(schema.users.id, targetId))
    .limit(1);

  if (!target) {
    return { error: "Usuário não encontrado." };
  }

  const ownedImages = await db
    .select({ image: schema.games.image })
    .from(schema.games)
    .where(eq(schema.games.createdBy, targetId));

  try {
    // Exclusão explícita em vez de depender de ON DELETE CASCADE: nem todo
    // SQLite/Turso está com foreign keys ligadas.
    await db.delete(schema.games).where(eq(schema.games.createdBy, targetId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetId));
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, targetId));
    await db.delete(schema.users).where(eq(schema.users.id, targetId));
  } catch (err) {
    console.error("deleteUser failed:", err);
    return { error: "Não foi possível remover o usuário. Tente novamente." };
  }

  await Promise.all(
    [target.image, ...ownedImages.map((g) => g.image)].map((image) => removeImage(image))
  );

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: "Usuário removido." };
}
