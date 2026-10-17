"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/alterar-senha`
    });

    setLoading(false);

    if (error) {
      setMessage("Não foi possível enviar o e-mail de recuperação.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <div className="login-card">
          <div className="card-glow" />

          <div className="login-content">
            <div className="welcome">
              <h1>Recuperar senha</h1>
              <p>Informe seu e-mail para receber o link de redefinição</p>
            </div>

            {sent ? (
              <div className="invite-info">
                ⓘ Se o e-mail informado estiver cadastrado, você receberá um
                link para redefinir sua senha.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="email">E-mail</label>

                  <div className="input-wrapper">
                    <input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
              </form>
            )}

            <div className="invite-info">
              <Link href="/">Voltar para o login</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
