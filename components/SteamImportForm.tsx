"use client";

import { useActionState } from "react";
import {
  importSteamGames,
  removeSteamImportedGames,
  type SteamImportState,
  type SteamRemoveState
} from "@/app/dashboard/conta/steam-actions";

const initialImportState: SteamImportState = {};
const initialRemoveState: SteamRemoveState = {};

export default function SteamImportForm({
  initialSteamId
}: {
  initialSteamId: string;
}) {
  const [importState, importAction, importPending] = useActionState(
    importSteamGames,
    initialImportState
  );

  const [removeState, removeAction, removePending] = useActionState(
    removeSteamImportedGames,
    initialRemoveState
  );

  const busy = importPending || removePending;

  return (
    <form action={importAction}>
      <div className="form-group">
        <label htmlFor="steamUrl">URL ou SteamID do perfil</label>

        <div className="input-wrapper">
          <input
            key={initialSteamId}
            id="steamUrl"
            name="steamUrl"
            type="text"
            placeholder="https://steamcommunity.com/id/seuperfil"
            defaultValue={initialSteamId}
          />
        </div>
      </div>

      {importState.error && <div className="login-error">{importState.error}</div>}
      {importState.success && (
        <div className="invite-success">{importState.success}</div>
      )}
      {removeState.error && <div className="login-error">{removeState.error}</div>}
      {removeState.success && (
        <div className="invite-success">{removeState.success}</div>
      )}

      <div className="steam-actions">
        <button type="submit" className="login-button" disabled={busy}>
          {importPending ? "Importando..." : "Importar jogos da Steam"}
        </button>

        <button
          type="submit"
          formAction={removeAction}
          className="steam-remove-button"
          disabled={busy}
          onClick={(event) => {
            const confirmed = window.confirm(
              "Remover todos os jogos importados da Steam? Jogos cadastrados manualmente não são afetados. Essa ação não pode ser desfeita."
            );

            if (!confirmed) {
              event.preventDefault();
            }
          }}
        >
          {removePending ? "Removendo..." : "Remover jogos importados"}
        </button>
      </div>

      <div className="invite-info">
        ⓘ O perfil e os &quot;Detalhes do jogo&quot; precisam estar públicos
        nas configurações de privacidade da Steam.
      </div>
    </form>
  );
}
