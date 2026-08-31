"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AlterarSenha() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setReady(!!session);
        setChecking(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage("Não foi possível atualizar a senha. Peça um novo link.");
      return;
    }

    setDone(true);
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
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

            {checking && <div className="invite-info">Verificando link...</div>}

            {!checking && !ready && (
              <div className="invite-info">
                ⓘ Link inválido ou expirado. Solicite um novo convite ao
                administrador ou peça a recuperação de senha novamente.
              </div>
            )}

            {!checking && ready && !done && (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="password">Nova senha</label>

                  <div className="input-wrapper">
                    <input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
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
                ⓘ Senha atualizada! Redirecionando para o dashboard...
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
