import type { Transporter } from "nodemailer";

/**
 * Envio de e-mail via SMTP (Resend, SendGrid, SES, Mailgun, Gmail… todos
 * expõem SMTP). Sem SMTP_HOST configurado, o e-mail é só impresso no log do
 * servidor — útil em desenvolvimento para copiar o link de convite.
 */

let transporter: Transporter | undefined;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  if (!transporter) {
    const nodemailer = require("nodemailer") as typeof import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 587);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }

  return transporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const smtp = getTransporter();

  if (!smtp) {
    console.info(`\n[email] SMTP não configurado — e-mail para ${to}\n  Assunto: ${subject}\n  ${text}\n`);
    return;
  }

  await smtp.sendMail({
    from: process.env.EMAIL_FROM ?? "GameSys <no-reply@localhost>",
    to,
    subject,
    text,
    html
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function linkEmail(heading: string, body: string, url: string, cta: string) {
  return {
    text: `${heading}\n\n${body}\n\n${cta}: ${url}`,
    html: `<div style="font-family:sans-serif;max-width:480px">
  <h2>${escapeHtml(heading)}</h2>
  <p>${escapeHtml(body)}</p>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#1a9fff;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(cta)}</a></p>
  <p style="color:#888;font-size:12px">Se o botão não funcionar, copie este link: ${escapeHtml(url)}</p>
</div>`
  };
}
