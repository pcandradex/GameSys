"use client";

import { useState } from "react";
import type { AccessSecret } from "@/app/admin/actions";

/** Mostra o link ou a senha temporária uma única vez, com botão de copiar. */
export default function AccessSecretBox({
  label,
  secret
}: {
  label?: string;
  secret: AccessSecret;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard (ex.: http fora de localhost): o campo
      // continua selecionável para copiar manualmente.
    }
  }

  return (
    <div className="access-secret">
      {label && <div className="access-secret-label">{label}</div>}

      <div className="access-secret-row">
        <input
          readOnly
          value={secret.value}
          aria-label={secret.kind === "link" ? "Link de definição de senha" : "Senha temporária"}
          onFocus={(event) => event.target.select()}
        />

        <button type="button" className="admin-row-action" onClick={copy}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <div className="access-secret-hint">
        {secret.kind === "link"
          ? "Envie por um canal privado (WhatsApp, Telegram…). Quem tiver o link define a senha da conta."
          : "Anote agora: esta senha não será mostrada de novo. Envie por um canal privado."}
      </div>
    </div>
  );
}
