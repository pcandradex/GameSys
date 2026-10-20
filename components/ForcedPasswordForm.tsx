"use client";

import { useActionState, useState } from "react";
import {
  completeTemporaryPassword,
  type ForcedPasswordState
} from "@/app/trocar-senha/actions";
import { authClient } from "@/lib/auth-client";

const initialState: ForcedPasswordState = {};

export default function ForcedPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    completeTemporaryPassword,
    initialState
  );
  const [leaving, setLeaving] = useState(false);

  async function handleLogout() {
    setLeaving(true);
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <div className="login-card">
          <div className="card-glow" />

          <div className="login-content">
            <div className="welcome">
              <h1>Crie sua senha</h1>
              <p>
                Você entrou com uma senha temporária. Escolha uma senha nova
                para continuar.
              </p>
            </div>

            <form action={formAction}>
              {/* Ajuda gerenciadores de senha a salvar para o e-mail certo. */}
              <input type="hidden" name="username" autoComplete="username" value={email} />

              <div className="form-group">
                <label htmlFor="currentPassword">Senha temporária</label>

                <div className="input-wrapper">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">Nova senha</label>

                <div className="input-wrapper">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar nova senha</label>

                <div className="input-wrapper">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    required
                  />
                </div>
              </div>

              {state.error && <div className="login-error">{state.error}</div>}

              <button type="submit" className="login-button" disabled={pending}>
                {pending ? "Salvando..." : "Salvar e continuar"}
              </button>
            </form>

            <div className="invite-info">
              <button
                type="button"
                className="forgot-password"
                onClick={handleLogout}
                disabled={leaving}
                style={{ background: "none", border: 0, cursor: "pointer" }}
              >
                {leaving ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
