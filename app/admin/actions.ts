"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth, siteUrl } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getActiveUser } from "@/lib/session";
import { removeImage } from "@/lib/storage";
import {
  createPasswordSetupLink,
  generateTemporaryPassword,
  setTemporaryPassword
} from "@/lib/access";

/**
 * `secret` é mostrado uma única vez para o admin copiar (link de definição
 * de senha ou senha temporária). Nunca é guardado em texto puro.
 */
export type AccessSecret = { kind: "link" | "password"; value: string };

export type InviteState = {
  error?: string;
  success?: string;
  secret?: AccessSecret;
};

export type InviteDelivery = "email" | "link" | "password";

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
  const user = await getActiveUser();

  if (!user?.isAdmin) {
    return { error: "Apenas administradores podem convidar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 255);
  const deliveryInput = String(formData.get("delivery") ?? "email");
  const delivery: InviteDelivery =
    deliveryInput === "link" || deliveryInput === "password" ? deliveryInput : "email";

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

  const newUserId = crypto.randomUUID();

  try {
    await db.insert(schema.users).values({
      id: newUserId,
      name: fullName,
      email,
      role: "user",
      invitedBy: user.id
    });
  } catch (err) {
    console.error("inviteUser insert failed:", err);
    return { error: "Não foi possível criar o usuário. Tente novamente." };
  }

  revalidatePath("/admin");

  try {
    if (delivery === "link") {
      return {
        success: `Usuário ${email} criado. Envie o link abaixo para ele definir a senha (vale por 24 horas e só pode ser usado uma vez).`,
        secret: { kind: "link", value: await createPasswordSetupLink(newUserId) }
      };
    }

    if (delivery === "password") {
      const password = generateTemporaryPassword();
      await setTemporaryPassword(newUserId, password);
      return {
        success: `Usuário ${email} criado com a senha temporária abaixo. No primeiro acesso ele será obrigado a trocá-la.`,
        secret: { kind: "password", value: password }
      };
    }

    await sendInviteEmail(email);
  } catch (err) {
    console.error("inviteUser delivery failed:", err);
    return {
      error: `Usuário ${email} criado, mas não foi possível ${
        delivery === "email" ? "enviar o e-mail" : "gerar o acesso"
      }. Use “Gerar link” ou “Senha temporária” na lista de usuários.`
    };
  }

  return { success: `Convite enviado para ${email}.` };
}

async function requireAdminTarget(formData: FormData) {
  const admin = await getActiveUser();

  if (!admin?.isAdmin) {
    return { error: "Apenas administradores podem fazer isso." } as const;
  }

  const targetId = String(formData.get("userId") ?? "");

  if (!targetId || targetId === admin.id) {
    return { error: "Usuário inválido." } as const;
  }

  const [target] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, targetId))
    .limit(1);

  if (!target) {
    return { error: "Usuário não encontrado." } as const;
  }

  return { target } as const;
}

export type UserAccessState = InviteState;

/** Link de definição de senha para um usuário escolhido, para copiar. */
export async function generateSetupLink(
  _prevState: UserAccessState,
  formData: FormData
): Promise<UserAccessState> {
  const result = await requireAdminTarget(formData);

  if ("error" in result) {
    return { error: result.error };
  }

  try {
    return {
      success: `Link para ${result.target.email} (24 h, uso único):`,
      secret: { kind: "link", value: await createPasswordSetupLink(result.target.id) }
    };
  } catch (err) {
    console.error("generateSetupLink failed:", err);
    return { error: "Não foi possível gerar o link." };
  }
}

/**
 * Troca a senha do usuário por uma temporária e o desconecta. A senha atual
 * dele deixa de funcionar.
 */
export async function resetToTemporaryPassword(
  _prevState: UserAccessState,
  formData: FormData
): Promise<UserAccessState> {
  const result = await requireAdminTarget(formData);

  if ("error" in result) {
    return { error: result.error };
  }

  try {
    const password = generateTemporaryPassword();
    await setTemporaryPassword(result.target.id, password);
    revalidatePath("/admin");

    return {
      success: `Senha temporária de ${result.target.email} (troca obrigatória no próximo acesso):`,
      secret: { kind: "password", value: password }
    };
  } catch (err) {
    console.error("resetToTemporaryPassword failed:", err);
    return { error: "Não foi possível definir a senha temporária." };
  }
}

export type ResendInviteState = InviteState;

export async function resendInvite(
  _prevState: ResendInviteState,
  formData: FormData
): Promise<ResendInviteState> {
  const user = await getActiveUser();

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
  const user = await getActiveUser();

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
