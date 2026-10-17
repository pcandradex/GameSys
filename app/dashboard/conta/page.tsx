import Link from "next/link";
import AccountForm from "@/components/AccountForm";
import PasswordForm from "@/components/PasswordForm";
import SteamImportForm from "@/components/SteamImportForm";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";

export default async function MinhaConta() {
  const user = await requireUser();

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
            email={user.email}
            initialNickname={user.nickname ?? ""}
            initialAvatarUrl={publicUrl(user.image)}
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

          <SteamImportForm initialSteamId={user.steamId ?? ""} />
        </div>
      </section>
    </main>
  );
}
