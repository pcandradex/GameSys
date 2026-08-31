"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { initialFor } from "@/lib/display-name";

interface AccountFormProps {
  userId: string;
  email: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
}

export default function AccountForm({
  userId,
  email,
  initialNickname,
  initialAvatarUrl
}: AccountFormProps) {
  const router = useRouter();
  const supabase = createClient();

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

    let avatarUrl = initialAvatarUrl;

    if (avatarFile) {
      const extension = avatarFile.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });

      if (uploadError) {
        setError("Não foi possível enviar a foto. Tente novamente.");
        setLoading(false);
        return;
      }

      const {
        data: { publicUrl }
      } = supabase.storage.from("avatars").getPublicUrl(path);

      avatarUrl = `${publicUrl}?t=${Date.now()}`;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || null, avatar_url: avatarUrl })
      .eq("id", userId);

    setLoading(false);

    if (updateError) {
      setError("Não foi possível salvar o perfil. Tente novamente.");
      return;
    }

    setSuccess("Perfil atualizado!");
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
