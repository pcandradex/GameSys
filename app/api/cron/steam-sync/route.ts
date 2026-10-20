import { timingSafeEqual } from "node:crypto";
import { syncAllUsers } from "@/lib/steam-sync";

/**
 * Rotina diária: sincroniza a biblioteca Steam de todos os usuários.
 *
 * Chamada por qualquer agendador com o cabeçalho
 *   Authorization: Bearer <CRON_SECRET>
 * - Vercel Cron (vercel.json) envia esse cabeçalho sozinho quando a
 *   variável CRON_SECRET existe no projeto;
 * - crontab, agendador do painel da hospedagem ou cron-job.org: veja o README.
 *
 * Sem CRON_SECRET configurado a rota fica desligada (nunca aberta).
 */

export const dynamic = "force-dynamic";
// Limite de execução na Vercel; fora dela é ignorado.
export const maxDuration = 60;

// Para de iniciar novos usuários antes do limite acima; os que sobrarem são
// os primeiros da próxima execução.
const TIME_BUDGET_MS = 45_000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";

  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "Rotina desligada: defina CRON_SECRET para habilitar." },
      { status: 503 }
    );
  }

  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.STEAM_API_KEY) {
    return Response.json({ error: "STEAM_API_KEY não configurada." }, { status: 503 });
  }

  try {
    const summary = await syncAllUsers({ timeBudgetMs: TIME_BUDGET_MS });
    console.info("steam-sync:", JSON.stringify(summary));
    return Response.json(summary);
  } catch (err) {
    console.error("steam-sync failed:", err);
    return Response.json({ error: "Falha na sincronização." }, { status: 500 });
  }
}

// Alguns agendadores só fazem POST.
export { GET as POST };
