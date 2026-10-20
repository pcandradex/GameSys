import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  int,
  mysqlTable,
  text,
  unique,
  varchar
} from "drizzle-orm/mysql-core";

// Espelho de pg.ts. No MySQL, colunas indexadas/únicas precisam de tamanho
// fixo (varchar) — por isso ids, e-mail e token não são `text`.

const id = (name: string) => varchar(name, { length: 36 });

// datetime(3) em vez de timestamp: timestamp do MySQL acaba em 2038 e é
// convertido pelo fuso da conexão. Datas sempre geradas no app, em UTC.
const timestamp = (name: string) => datetime(name, { fsp: 3 });
const nowDefault = sql`CURRENT_TIMESTAMP(3)`;
const createdAt = () => timestamp("created_at").notNull().default(nowDefault).$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at").notNull().default(nowDefault).$defaultFn(() => new Date()).$onUpdate(() => new Date());

export const users = mysqlTable("users", {
  id: id("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  nickname: varchar("nickname", { length: 100 }),
  steamId: varchar("steam_id", { length: 32 }),
  invitedBy: id("invited_by"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: id("id").primaryKey(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    userId: id("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = mysqlTable(
  "accounts",
  {
    id: id("id").primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    userId: id("user_id")
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

export const verifications = mysqlTable(
  "verifications",
  {
    id: id("id").primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export const games = mysqlTable(
  "games",
  {
    id: id("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    image: text("image"),
    createdBy: id("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    steamAppid: int("steam_appid"),
    steamFamilyShared: boolean("steam_family_shared"),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    unique("games_owner_steam_appid_key").on(table.createdBy, table.steamAppid),
    index("games_created_at_idx").on(table.createdAt)
  ]
);
