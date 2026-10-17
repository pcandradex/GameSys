import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as pgSchema from "./schema/pg";

export type Dialect = "pg" | "mysql" | "sqlite";

/**
 * O dialeto vem de DB_DIALECT ou, se não definido, do esquema da URL:
 *   postgres://… / postgresql://…  → pg
 *   mysql://…                      → mysql
 *   file:… / libsql://… / sqlite:… → sqlite (arquivo local ou Turso)
 */
export function resolveDialect(
  url = process.env.DATABASE_URL,
  explicit = process.env.DB_DIALECT
): Dialect {
  if (explicit === "pg" || explicit === "mysql" || explicit === "sqlite") {
    return explicit;
  }

  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Veja .env.example para os formatos aceitos."
    );
  }

  if (/^postgres(ql)?:\/\//i.test(url)) return "pg";
  if (/^mysql:\/\//i.test(url)) return "mysql";
  if (/^(file:|libsql:\/\/|sqlite:)/i.test(url)) return "sqlite";

  throw new Error(
    `Não foi possível identificar o banco a partir de DATABASE_URL ("${url.split(":")[0]}:"). Defina DB_DIALECT=pg|mysql|sqlite.`
  );
}

/**
 * Os três schemas (schema/pg.ts, mysql.ts, sqlite.ts) têm as mesmas tabelas
 * e chaves, e a API de consulta do Drizzle (select/insert/update/delete) é a
 * mesma entre eles. Por isso o app inteiro é tipado com o dialeto Postgres,
 * enquanto em runtime `db` e `schema` são os do banco configurado.
 *
 * Regra para manter isso funcionando: só usar recursos comuns aos três
 * (nada de .returning(), onConflict*, onDuplicateKey*, ilike etc.).
 */
export type Database = NodePgDatabase<typeof pgSchema>;
export type Schema = typeof pgSchema;

interface Connection {
  dialect: Dialect;
  db: Database;
  schema: Schema;
}

function connect(): Connection {
  const url = process.env.DATABASE_URL!;
  const dialect = resolveDialect(url);

  // require() em vez de import estático: só o driver do banco em uso é
  // carregado (os outros podem nem ter binário nativo disponível no host).
  switch (dialect) {
    case "pg": {
      const { Pool } = require("pg") as typeof import("pg");
      const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
      const pool = new Pool({
        connectionString: url,
        max: Number(process.env.DB_POOL_SIZE ?? 10)
      });
      return { dialect, schema: pgSchema, db: drizzle(pool, { schema: pgSchema }) };
    }

    case "mysql": {
      const mysql = require("mysql2/promise") as typeof import("mysql2/promise");
      const { drizzle } = require("drizzle-orm/mysql2") as typeof import("drizzle-orm/mysql2");
      const schema = require("./schema/mysql") as typeof import("./schema/mysql");
      const pool = mysql.createPool({
        uri: url,
        connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10)
      });
      const db = drizzle(pool, { schema, mode: "default" });
      return { dialect, schema: schema as unknown as Schema, db: db as unknown as Database };
    }

    case "sqlite": {
      const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
      const { drizzle } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
      const schema = require("./schema/sqlite") as typeof import("./schema/sqlite");
      const client = createClient({
        url: url.replace(/^sqlite:/i, "file:"),
        authToken: process.env.DATABASE_AUTH_TOKEN
      });
      // SQLite vem com foreign keys desligadas por padrão.
      void client.execute("PRAGMA foreign_keys = ON").catch(() => {});
      const db = drizzle(client, { schema });
      return { dialect, schema: schema as unknown as Schema, db: db as unknown as Database };
    }
  }
}

// Reaproveita a conexão entre hot reloads do `next dev`.
const globalForDb = globalThis as unknown as { gamesysDb?: Connection };

function connection(): Connection {
  globalForDb.gamesysDb ??= connect();
  return globalForDb.gamesysDb;
}

/** Conexão lazy: só abre quando alguém consulta (o build não precisa de banco). */
export const db = new Proxy({} as Database, {
  get: (_target, prop) => {
    const real = connection().db;
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  }
});

export const schema = new Proxy({} as Schema, {
  get: (_target, prop) => Reflect.get(connection().schema, prop)
});

export function currentDialect(): Dialect {
  return connection().dialect;
}

export function rawConnection(): Connection {
  return connection();
}
