/**
 * Sincroniza a biblioteca Steam de todos os usuários (mesma rotina da rota
 * /api/cron/steam-sync), para servidores onde dá para rodar comandos:
 *   npm run sync:steam              (desenvolvimento: .env.local)
 *   npm run sync:steam -- --prod    (produção: .env.production.local)
 *
 * Exemplo de crontab (todo dia às 4h):
 *   0 4 * * * cd /caminho/do/gamesys && npm run sync:steam -- --prod >> sync.log 2>&1
 */
import { loadScriptEnv } from "./env";

loadScriptEnv();

async function main() {
  const { syncAllUsers } = await import("../lib/steam-sync");
  const summary = await syncAllUsers();

  console.log(
    `Usuários com Steam: ${summary.usersWithSteam} | sincronizados: ${summary.synced} | ` +
      `jogos novos: ${summary.gamesAdded} | Family Sharing checados: ${summary.familyChecked} | ` +
      `falhas: ${summary.failed.length} | ${(summary.durationMs / 1000).toFixed(1)} s`
  );

  for (const failure of summary.failed) {
    console.log(`  ✗ ${failure.userId}: ${failure.error}`);
  }

  process.exit(summary.failed.length && !summary.synced ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
