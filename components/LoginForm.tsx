"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { syncSteamLibraryForCurrentUser } from "@/app/dashboard/conta/steam-actions";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [remember, setRemember] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    if (remember) {
      localStorage.setItem("gamesys-remember", "true");
    } else {
      localStorage.removeItem("gamesys-remember");
    }

    try {
      await syncSteamLibraryForCurrentUser();
    } catch {
      // Falha na sincronização com a Steam não deve impedir o login.
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="login-card">
      <div className="card-glow" />

      <div className="login-content">

        <div className="login-logo">
          <div className="login-logo-icon">
            🎮
          </div>

          <div className="login-logo-text">
            Game<span>Sys</span>
          </div>
        </div>

        <div className="welcome">
          <h1>Bem-vindo de volta!</h1>
          <p>Entre na sua conta para continuar</p>
        </div>

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

          <div className="form-group">
            <label htmlFor="password">Senha</label>

            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <div className="form-options">

            <label className="remember">

              <input
                type="checkbox"
                checked={remember}
                onChange={(e) =>
                  setRemember(e.target.checked)
                }
              />

              <span className="custom-checkbox">
                ✓
              </span>

              <span>Lembrar-me</span>

            </label>

            <Link href="/recuperar-senha" className="forgot-password">
              Esqueceu a senha?
            </Link>

          </div>

          {message && (
            <div className="login-error">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

        </form>

        <div className="invite-info">
          ⓘ O acesso ao GameSys é feito exclusivamente por convite.
        </div>

      </div>
    </div>
  );
}