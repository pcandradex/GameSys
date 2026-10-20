"use client";

import { useActionState, useState } from "react";
import {
  generateSetupLink,
  resetToTemporaryPassword,
  type UserAccessState
} from "@/app/admin/actions";
import AccessSecretBox from "@/components/AccessSecretBox";

const initialState: UserAccessState = {};

/**
 * Ações de acesso por usuário na tabela do admin: gerar um link de
 * definição de senha ou trocar a senha por uma temporária.
 */
export default function UserAccessActions({
  userId,
  label,
  children
}: {
  userId: string;
  label: string;
  /** Botões extras (ex.: Excluir), mostrados depois das ações de acesso. */
  children?: React.ReactNode;
}) {
  const [linkState, linkAction, linkPending] = useActionState(
    generateSetupLink,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    resetToTemporaryPassword,
    initialState
  );

  // Mostra só o resultado da ação mais recente.
  const [last, setLast] = useState<"link" | "password" | null>(null);

  const busy = linkPending || passwordPending;
  const shown = last === "password" ? passwordState : last === "link" ? linkState : initialState;

  return (
    <>
      <form action={linkAction} onSubmit={() => setLast("link")}>
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" className="admin-row-action" disabled={busy}>
          {linkPending ? "Gerando..." : "Gerar link"}
        </button>
      </form>

      <form
        action={passwordAction}
        onSubmit={(event) => {
          const confirmed = window.confirm(
            `Definir uma senha temporária para "${label}"? A senha atual deixa de funcionar e a pessoa é desconectada.`
          );

          if (!confirmed) {
            event.preventDefault();
            return;
          }

          setLast("password");
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" className="admin-row-action" disabled={busy}>
          {passwordPending ? "Gerando..." : "Senha temporária"}
        </button>
      </form>

      {children}

      {(shown.error || shown.secret) && (
        <div className="admin-row-panel">
          {shown.error && <div className="admin-row-error">{shown.error}</div>}
          {shown.secret && <AccessSecretBox label={shown.success} secret={shown.secret} />}
        </div>
      )}
    </>
  );
}
