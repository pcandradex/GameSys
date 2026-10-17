import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique
} from "drizzle-orm/sqlite-core";

// Espelho de pg.ts. SQLite não tem boolean/timestamp nativos: ficam como
// integer, e o Drizzle converte de/para boolean e Date automaticamente.

const bool = (name: string) => integer(name, { mode: "boolean" });
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsec') * 1000 as integer))`;
const createdAt = () => timestamp("created_at").notNull().default(now).$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at").notNull().default(now).$defaultFn(() => new Date()).$onUpdate(() => new Date());

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  nickname: text("nickname"),
  steamId: text("steam_id"),
  invitedBy: text("invited_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const sessions = sqliteTable(
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

export const accounts = sqliteTable(
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

export const verifications = sqliteTable(
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

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    image: text("image"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    steamAppid: integer("steam_appid"),
    steamFamilyShared: bool("steam_family_shared"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    unique("games_owner_steam_appid_key").on(table.createdBy, table.steamAppid),
    index("games_created_at_idx").on(table.createdAt)
  ]
);
