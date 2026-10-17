"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await authClient.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: true
    });

    setLoading(false);

    if (updateError) {
      setError(
        updateError.code === "INVALID_PASSWORD"
          ? "Senha atual incorreta."
          : "Não foi possível atualizar a senha. Tente novamente."
      );
      return;
    }

    setSuccess("Senha atualizada!");
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="current-password">Senha atual</label>

        <div className="input-wrapper">
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="new-password">Nova senha</label>

        <div className="input-wrapper">
          <input
            id="new-password"
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
        <label htmlFor="confirm-password">Confirmar nova senha</label>

        <div className="input-wrapper">
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}
      {success && <div className="invite-success">{success}</div>}

      <button type="submit" className="login-button" disabled={loading}>
        {loading ? "Salvando..." : "Alterar senha"}
      </button>
    </form>
  );
}
