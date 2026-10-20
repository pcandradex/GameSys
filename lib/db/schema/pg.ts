import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp as pgTimestamp,
  unique
} from "drizzle-orm/pg-core";

// timestamptz: o Postgres guarda em UTC independente do fuso do servidor.
// As datas são geradas no app ($defaultFn); o default do banco é só reserva.
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true });
const createdAt = () => timestamp("created_at").notNull().defaultNow().$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at").notNull().defaultNow().$defaultFn(() => new Date()).$onUpdate(() => new Date());

// Mantenha este arquivo em sincronia com mysql.ts e sqlite.ts: os três
// precisam expor as mesmas tabelas com as mesmas chaves, porque o resto do
// app usa um único conjunto de tipos (ver lib/db/index.ts).

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  nickname: text("nickname"),
  steamId: text("steam_id"),
  invitedBy: text("invited_by"),
  // Senha temporária definida pelo admin: o usuário precisa trocá-la no
  // próximo acesso antes de usar o app (ver lib/session.ts).
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    // URL externa (capa da Steam) ou chave no storage (upload) — ver lib/storage.
    image: text("image"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    steamAppid: integer("steam_appid"),
    steamFamilyShared: boolean("steam_family_shared"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    unique("games_owner_steam_appid_key").on(table.createdBy, table.steamAppid),
    index("games_created_at_idx").on(table.createdAt)
  ]
);
