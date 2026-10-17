/**
 * Gera as migrações dos três dialetos a partir de lib/db/schema/*.ts.
 *   npm run db:generate [-- --name descricao]
 * Rode sempre que mudar um schema (e mude os três juntos).
 */
import { spawnSync } from "node:child_process";

const extraArgs = process.argv.slice(2);

for (const dialect of ["pg", "mysql", "sqlite"]) {
  console.log(`\n▶ ${dialect}`);

  const result = spawnSync("npx", ["drizzle-kit", "generate", ...extraArgs], {
    stdio: "inherit",
    shell: true,
    // URL fictícia só para o drizzle.config resolver o dialeto — generate
    // não conecta no banco.
    env: { ...process.env, DB_DIALECT: dialect, DATABASE_URL: "" }
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
