import { redirect } from "next/navigation";
import ForcedPasswordForm from "@/components/ForcedPasswordForm";
import { getCurrentUser } from "@/lib/session";

// Destino obrigatório de quem entrou com senha temporária do admin
// (requireUser redireciona para cá até a senha ser trocada).
export default async function TrocarSenha() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (!user.mustChangePassword) {
    redirect("/dashboard");
  }

  return <ForcedPasswordForm email={user.email} />;
}
