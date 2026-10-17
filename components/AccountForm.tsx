"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/dashboard/actions";
import { initialFor } from "@/lib/display-name";

interface AccountFormProps {
  email: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
}

export default function AccountForm({
  email,
  initialNickname,
  initialAvatarUrl
}: AccountFormProps) {
  const router = useRouter();

  const [nickname, setNickname] = useState(initialNickname);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialAvatarUrl
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : initialAvatarUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData();
    formData.set("nickname", nickname);
    if (avatarFile) formData.set("avatar", avatarFile);

    const result = await updateProfile(formData);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setAvatarFile(null);
    setSuccess(result.success ?? "Perfil atualizado!");
    router.refresh();
  }

  const displayNameForInitial = nickname || email;

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="avatar">Foto de perfil</label>

        <div className="avatar-picker">
          <div className="avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Foto de perfil" />
            ) : (
              <span>{initialFor(displayNameForInitial)}</span>
            )}
          </div>

          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="game-file-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">E-mail</label>

        <div className="input-wrapper">
          <input id="email" type="email" value={email} disabled />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="nickname">Nickname</label>

        <div className="input-wrapper">
          <input
            id="nickname"
            type="text"
            placeholder="Como você quer aparecer no GameSys"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={40}
          />
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}
      {success && <div className="invite-success">{success}</div>}

      <button type="submit" className="login-button" disabled={loading}>
        {loading ? "Salvando..." : "Salvar"}
      </button>

      <div className="invite-info">
        ⓘ O login continua sendo feito com o e-mail. Nickname e foto são só
        exibição.
      </div>
    </form>
  );
}
