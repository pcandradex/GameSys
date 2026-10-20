"use client";

import { useActionState, useState } from "react";
import {
  inviteUser,
  type InviteDelivery,
  type InviteState
} from "@/app/admin/actions";
import AccessSecretBox from "@/components/AccessSecretBox";

const initialState: InviteState = {};

const DELIVERY_OPTIONS: { value: InviteDelivery; label: string; hint: string }[] = [
  {
    value: "email",
    label: "Enviar convite por e-mail",
    hint: "O usuário recebe um link para definir a própria senha."
  },
  {
    value: "link",
    label: "Gerar link para eu enviar",
    hint: "Sem e-mail: você copia o link e manda por outro canal."
  },
  {
    value: "password",
    label: "Criar com senha temporária",
    hint: "Você repassa a senha; ele troca no primeiro acesso."
  }
];

const SUBMIT_LABEL: Record<InviteDelivery, string> = {
  email: "Enviar convite",
  link: "Criar usuário e gerar link",
  password: "Criar usuário com senha temporária"
};

export default function InviteForm() {
  const [delivery, setDelivery] = useState<InviteDelivery>("email");
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

      <fieldset className="delivery-options">
        <legend>Como entregar o acesso</legend>

        {DELIVERY_OPTIONS.map((option) => (
          <label key={option.value} className="delivery-option">
            {/* defaultChecked (não `checked`): o React reseta o formulário
                após a action, e o reset volta para o defaultChecked — que
                acompanha a última escolha. Assim rádio e botão não divergem. */}
            <input
              type="radio"
              name="delivery"
              value={option.value}
              defaultChecked={delivery === option.value}
              onChange={() => setDelivery(option.value)}
            />
            <span>
              {option.label}
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error && <div className="login-error">{state.error}</div>}
      {state.success && <div className="invite-success">{state.success}</div>}
      {state.secret && <AccessSecretBox secret={state.secret} />}

      <button type="submit" className="login-button" disabled={pending}>
        {pending ? "Criando..." : SUBMIT_LABEL[delivery]}
      </button>
    </form>
  );
}
