"use client";

import { useActionState } from "react";
import { inviteUser, type InviteState } from "@/app/admin/actions";

const initialState: InviteState = {};

export default function InviteForm() {
  const [state, formAction, pending] = useActionState(
    inviteUser,
    initialState
  );

  return (
    <form action={formAction} className="invite-form">
      <div className="form-group">
        <label htmlFor="fullName">Nome</label>

        <div className="input-wrapper">
          <input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Nome do convidado"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email">E-mail</label>

        <div className="input-wrapper">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="convidado@email.com"
            required
          />
        </div>
      </div>

      {state.error && <div className="login-error">{state.error}</div>}
      {state.success && <div className="invite-success">{state.success}</div>}

      <button type="submit" className="login-button" disabled={pending}>
        {pending ? "Enviando..." : "Enviar convite"}
      </button>
    </form>
  );
}
