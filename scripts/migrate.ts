/**
 * Aplica as migrações pendentes do dialeto configurado em DATABASE_URL.
 *   npm run db:migrate              (desenvolvimento: .env.local)
 *   npm run db:migrate -- --prod    (produção: .env.production.local)
 */
import { loadScriptEnv } from "./env";

loadScriptEnv();

async function main() {
  const { rawConnection } = await import("../lib/db");
  const { dialect, db } = rawConnection();
  const migrationsFolder = `./drizzle/${dialect}`;

  console.log(`Aplicando migrações (${dialect}) de ${migrationsFolder}...`);

  if (dialect === "pg") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  } else if (dialect === "mysql") {
    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    await migrate(db as never, { migrationsFolder });
  }

  console.log("Banco atualizado.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
