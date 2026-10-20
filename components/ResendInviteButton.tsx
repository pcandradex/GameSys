"use client";

import { useActionState } from "react";
import { resendInvite, type ResendInviteState } from "@/app/admin/actions";

const initialState: ResendInviteState = {};

export default function ResendInviteButton({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendInvite, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />

      <button type="submit" className="admin-row-action" disabled={pending}>
        {pending ? "Enviando..." : state.success ?? "Reenviar convite"}
      </button>

      {state.error && <div className="admin-row-error">{state.error}</div>}
    </form>
  );
}
