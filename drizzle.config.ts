import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { resolveDialect, type Dialect } from "./lib/db";

// Modo desenvolvimento: nunca pega o .env.production.local por acidente.
loadEnvConfig(process.cwd(), true);

// Um diretório de migrações por dialeto: drizzle/pg, drizzle/mysql,
// drizzle/sqlite. `npm run db:generate` gera os três a partir dos schemas
// em lib/db/schema; o dialeto deste arquivo vem de DB_DIALECT ou da URL.
const dialect: Dialect = resolveDialect(
  process.env.DATABASE_URL,
  process.env.DB_DIALECT
);

const kitDialect = {
  pg: "postgresql",
  mysql: "mysql",
  sqlite: process.env.DATABASE_URL?.startsWith("libsql://") ? "turso" : "sqlite"
} as const;

export default defineConfig({
  dialect: kitDialect[dialect],
  schema: `./lib/db/schema/${dialect}.ts`,
  out: `./drizzle/${dialect}`,
  dbCredentials: {
    url: process.env.DATABASE_URL?.replace(/^sqlite:/i, "file:") ?? "",
    authToken: process.env.DATABASE_AUTH_TOKEN
  } as never
});
