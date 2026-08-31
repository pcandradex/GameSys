import { redirect } from "next/navigation";
import Link from "next/link";
import AccountForm from "@/components/AccountForm";
import PasswordForm from "@/components/PasswordForm";
import SteamImportForm from "@/components/SteamImportForm";
import { getCurrentProfile } from "@/lib/supabase/require-admin";

export default async function MinhaConta() {
  const { supabase, user } = await getCurrentProfile();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_url, steam_id")
    .eq("id", user.id)
    .single();

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="brand">
          <div className="brand-name">
            Game<span>Sys</span>
          </div>
        </div>

        <Link href="/dashboard" className="forgot-password">
          Voltar ao dashboard
        </Link>
      </header>

      <section className="admin-content account-content">
        <div className="admin-card">
          <h2>Perfil</h2>
          <p className="admin-subtitle">
            Nickname e foto são só de exibição — o login continua sendo
            feito com o e-mail.
          </p>

          <AccountForm
            userId={user.id}
            email={user.email ?? ""}
            initialNickname={profile?.nickname ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? null}
          />
        </div>

        <div className="admin-card">
          <h2>Alterar senha</h2>
          <p className="admin-subtitle">
            Defina uma nova senha de acesso ao GameSys.
          </p>

          <PasswordForm />
        </div>

        <div className="admin-card">
          <h2>Importar da Steam</h2>
          <p className="admin-subtitle">
            Vincule seu perfil Steam pra trazer sua biblioteca de jogos
            automaticamente pro GameSys.
          </p>

          <SteamImportForm initialSteamId={profile?.steam_id ?? ""} />
        </div>
      </section>
    </main>
  );
}
