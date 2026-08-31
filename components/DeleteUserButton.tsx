"use client";

import { useActionState } from "react";
import { deleteUser, type DeleteUserState } from "@/app/admin/actions";

const initialState: DeleteUserState = {};

export default function DeleteUserButton({
  userId,
  label
}: {
  userId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteUser,
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Remover o acesso de "${label}"? Os jogos cadastrados por essa pessoa também serão excluídos. Essa ação não pode ser desfeita.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />

      <button
        type="submit"
        className="admin-row-delete"
        disabled={pending}
      >
        {pending ? "Removendo..." : "Excluir"}
      </button>

      {state.error && <div className="admin-row-error">{state.error}</div>}
    </form>
  );
}
