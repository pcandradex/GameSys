"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";

export interface GameFormValues {
  title: string;
  description: string;
  imageFile: File | null;
}

interface GameFormProps {
  heading: string;
  subheading: string;
  initialTitle?: string;
  initialDescription?: string;
  initialImageUrl?: string | null;
  submitLabel: string;
  loadingLabel: string;
  onSubmit: (values: GameFormValues) => Promise<string | void>;
}

export default function GameForm({
  heading,
  subheading,
  initialTitle = "",
  initialDescription = "",
  initialImageUrl = null,
  submitLabel,
  loadingLabel,
  onSubmit
}: GameFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImageUrl
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : initialImageUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!title.trim()) {
      setMessage("Informe o título do jogo.");
      return;
    }

    setLoading(true);

    const error = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      imageFile
    });

    setLoading(false);

    if (error) {
      setMessage(error);
    }
  }

  return (
    <main className="login-page">
      <section className="login-container">
        <div className="login-card">
          <div className="card-glow" />

          <div className="login-content">
            <div className="welcome">
              <h1>{heading}</h1>
              <p>{subheading}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Título</label>

                <div className="input-wrapper">
                  <input
                    id="title"
                    type="text"
                    placeholder="Nome do jogo"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Descrição</label>

                <textarea
                  id="description"
                  className="game-textarea"
                  placeholder="Sobre o que é o jogo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label htmlFor="image">Imagem de capa</label>

                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="game-file-input"
                />

                {imagePreview && (
                  <div className="game-image-preview">
                    <img src={imagePreview} alt="Pré-visualização" />
                  </div>
                )}
              </div>

              {message && <div className="login-error">{message}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? loadingLabel : submitLabel}
              </button>
            </form>

            <div className="invite-info">
              <Link href="/dashboard">Voltar ao dashboard</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
