"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type ForcedPasswordState = { error?: string };

/** Troca a senha temporária (definida pelo admin) por uma escolhida pelo usuário. */
export async function completeTemporaryPassword(
  _prevState: ForcedPasswordState,
  formData: FormData
): Promise<ForcedPasswordState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (!user.mustChangePassword) {
    redirect("/dashboard");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  if (newPassword !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  if (newPassword === currentPassword) {
    return { error: "Escolha uma senha diferente da temporária." };
  }

  try {
    await auth().api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers()
    });
  } catch (err) {
    const code = (err as { body?: { code?: string } }).body?.code;

    if (code === "INVALID_PASSWORD") {
      return { error: "Senha temporária incorreta." };
    }

    console.error("completeTemporaryPassword failed:", err);
    return { error: "Não foi possível trocar a senha. Tente novamente." };
  }

  await db
    .update(schema.users)
    .set({ mustChangePassword: false })
    .where(eq(schema.users.id, user.id));

  redirect("/dashboard");
}
