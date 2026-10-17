"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!token) {
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);

    if (error) {
      setMessage("Não foi possível atualizar a senha. Peça um novo link.");
      return;
    }

    setDone(true);
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <div className="login-card">
          <div className="card-glow" />

          <div className="login-content">
            <div className="welcome">
              <h1>Definir senha</h1>
              <p>Escolha a senha de acesso ao GameSys</p>
            </div>

            {!token && (
              <div className="invite-info">
                ⓘ Link inválido ou expirado. Solicite um novo convite ao
                administrador ou peça a recuperação de senha novamente.
              </div>
            )}

            {token && !done && (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="password">Nova senha</label>

                  <div className="input-wrapper">
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirmar senha</label>

                  <div className="input-wrapper">
                    <input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {message && <div className="login-error">{message}</div>}

                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Salvar senha"}
                </button>
              </form>
            )}

            {done && (
              <div className="invite-info">
                ⓘ Senha definida! <Link href="/">Entrar no GameSys</Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
