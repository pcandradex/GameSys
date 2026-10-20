import { redirect } from "next/navigation";
import Link from "next/link";
import InviteForm from "@/components/InviteForm";
import DeleteUserButton from "@/components/DeleteUserButton";
import ResendInviteButton from "@/components/ResendInviteButton";
import UserAccessActions from "@/components/UserAccessActions";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { resolveDisplayName } from "@/lib/display-name";

export default async function AdminPage() {
  const user = await requireUser();

  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  const { users, accounts } = schema;

  // Convite pendente = usuário que ainda não definiu senha (sem credencial).
  const profiles = await db
    .select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      mustChangePassword: users.mustChangePassword,
      credentialId: accounts.id
    })
    .from(users)
    .leftJoin(
      accounts,
      and(eq(accounts.userId, users.id), eq(accounts.providerId, "credential"))
    )
    .orderBy(desc(users.createdAt));

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
            Não há cadastro público — só administradores criam contas.
            Se o e-mail estiver indisponível, gere um link ou uma senha
            temporária para enviar por outro canal.
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
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {profiles.map((profile) => (
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
                      {!profile.credentialId
                        ? "Convite pendente"
                        : profile.mustChangePassword
                          ? "Senha temporária"
                          : "Ativo"}
                    </td>
                    <td>
                      {profile.createdAt.toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                    <td>
                      {profile.id !== user.id && (
                        <div className="admin-row-actions">
                          {!profile.credentialId && (
                            <ResendInviteButton email={profile.email} />
                          )}

                          <UserAccessActions
                            userId={profile.id}
                            label={resolveDisplayName(profile)}
                          >
                            <DeleteUserButton
                              userId={profile.id}
                              label={resolveDisplayName(profile)}
                            />
                          </UserAccessActions>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {!profiles.length && (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      Nenhum usuário ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
