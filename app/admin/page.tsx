import { redirect } from "next/navigation";
import Link from "next/link";
import InviteForm from "@/components/InviteForm";
import DeleteUserButton from "@/components/DeleteUserButton";
import { getCurrentProfile } from "@/lib/supabase/require-admin";
import { resolveDisplayName } from "@/lib/display-name";

export default async function AdminPage() {
  const { supabase, user, isAdmin } = await getCurrentProfile();

  if (!user) {
    redirect("/");
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, nickname, full_name, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="brand">
          <div className="brand-name">
            Game<span>Sys</span> Admin
          </div>
        </div>

        <Link href="/dashboard" className="forgot-password">
          Voltar ao dashboard
        </Link>
      </header>

      <section className="admin-content">
        <div className="admin-card">
          <h2>Convidar novo usuário</h2>
          <p className="admin-subtitle">
            O convidado recebe um e-mail para definir a própria senha.
            Não há cadastro público — só administradores criam contas.
          </p>

          <InviteForm />
        </div>

        <div className="admin-card">
          <h2>Usuários</h2>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nickname</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {profiles?.map((profile) => (
                  <tr key={profile.id}>
                    <td>{resolveDisplayName(profile)}</td>
                    <td>{profile.email}</td>
                    <td>
                      <span
                        className={`role-badge ${
                          profile.role === "admin" ? "role-admin" : ""
                        }`}
                      >
                        {profile.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                    </td>
                    <td>
                      {new Date(profile.created_at).toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                    <td>
                      {profile.id !== user.id && (
                        <DeleteUserButton
                          userId={profile.id}
                          label={resolveDisplayName(profile)}
                        />
                      )}
                    </td>
                  </tr>
                ))}

                {!profiles?.length && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      Nenhum usuário ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="admin-subtitle">
            Status do convite (pendente/aceito) fica visível no painel do
            Supabase em Authentication → Users.
          </p>
        </div>
      </section>
    </main>
  );
}
