"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/require-admin";

export type InviteState = {
  error?: string;
  success?: string;
};

export async function inviteUser(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const { user, isAdmin } = await getCurrentProfile();

  if (!user || !isAdmin) {
    return { error: "Apenas administradores podem convidar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName || null,
      invited_by: user.id
    },
    redirectTo: `${siteUrl}/alterar-senha`
  });

  if (error) {
    console.error("inviteUserByEmail failed:", error);

    const message = error.message.toLowerCase();
    const alreadyExists = message.includes("already");
    const rateLimited =
      message.includes("rate limit") || error.code === "over_email_send_rate_limit";

    return {
      error: alreadyExists
        ? "Este e-mail já possui uma conta no GameSys."
        : rateLimited
          ? "Limite de e-mails do Supabase atingido. Espere um pouco e tente de novo (ou configure um SMTP próprio para não depender desse limite)."
          : "Não foi possível enviar o convite. Tente novamente."
    };
  }

  revalidatePath("/admin");

  return { success: `Convite enviado para ${email}.` };
}

export type DeleteUserState = {
  error?: string;
  success?: string;
};

export async function deleteUser(
  _prevState: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  const { user, isAdmin } = await getCurrentProfile();

  if (!user || !isAdmin) {
    return { error: "Apenas administradores podem remover usuários." };
  }

  const targetId = String(formData.get("userId") ?? "");

  if (!targetId) {
    return { error: "Usuário inválido." };
  }

  if (targetId === user.id) {
    return { error: "Você não pode remover a própria conta." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);

  if (error) {
    return { error: "Não foi possível remover o usuário. Tente novamente." };
  }

  revalidatePath("/admin");

  return { success: "Usuário removido." };
}
