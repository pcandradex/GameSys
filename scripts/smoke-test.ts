/**
 * Smoke test da camada de dados + auth contra o banco em DATABASE_URL.
 *   npm run test:db            (recusa rodar se o banco já tiver usuários)
 *   npm run test:db -- --reset (APAGA todos os dados antes — só em banco de teste!)
 *
 * Roda as mesmas consultas que o app usa (joins, inArray, selectDistinct,
 * isNull, update/delete) e o fluxo completo de convite → definir senha → login.
 */
import assert from "node:assert/strict";
import { loadScriptEnv } from "./env";

// Nunca contra produção: com --reset este teste apaga todos os dados.
loadScriptEnv({ allowProd: false });

async function main() {
  const { and, eq, inArray, isNotNull, isNull } = await import("drizzle-orm");
  const { db, schema, currentDialect } = await import("../lib/db");
  const { auth, siteUrl } = await import("../lib/auth");
  const { listGames } = await import("../lib/data/games");
  const { groupGamesByTitle } = await import("../lib/group-games");

  console.log("dialeto:", currentDialect());
  const { users, games, accounts, sessions, verifications } = schema;

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length && !process.argv.includes("--reset")) {
    console.error("O banco já tem usuários. Use um banco de teste e rode com --reset.");
    process.exit(1);
  }

  await db.delete(games);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(users);
  await db.delete(verifications);

  // ── convite (igual app/admin/actions.ts) ──
  const adminId = crypto.randomUUID();
  await db.insert(users).values({ id: adminId, name: "Admin", email: "admin@test.dev", role: "admin" });
  const inviteeId = crypto.randomUUID();
  await db.insert(users).values({ id: inviteeId, name: "", email: "amigo@test.dev", role: "user", invitedBy: adminId });

  let captured = "";
  const origInfo = console.info;
  console.info = (msg: string) => { captured += msg; };
  await auth().api.requestPasswordReset({ body: { email: "amigo@test.dev", redirectTo: `${siteUrl()}/alterar-senha` } });
  await new Promise((r) => setTimeout(r, 300));
  console.info = origInfo;
  assert.match(captured, /Convite para o GameSys/, "e-mail deveria ser de convite");
  const resetUrl = captured.match(/https?:\/\/\S+/)![0];
  const token = resetUrl.match(/reset-password\/([^?]+)/)![1];
  console.log("✓ convite gerado");

  await auth().api.resetPassword({ body: { token, newPassword: "senha-segura-1" } });
  const [verified] = await db.select({ v: users.emailVerified }).from(users).where(eq(users.id, inviteeId));
  assert.equal(verified.v, true);
  console.log("✓ senha definida pelo link (credencial criada, e-mail verificado)");

  // segundo pedido deve ser "recuperação", não convite
  captured = "";
  console.info = (msg: string) => { captured += msg; };
  await auth().api.requestPasswordReset({ body: { email: "amigo@test.dev", redirectTo: `${siteUrl()}/alterar-senha` } });
  await new Promise((r) => setTimeout(r, 300));
  console.info = origInfo;
  assert.match(captured, /Redefinir senha/);
  console.log("✓ recuperação de senha distingue de convite");

  const signIn = await auth().api.signInEmail({ body: { email: "amigo@test.dev", password: "senha-segura-1" }, asResponse: true });
  assert.equal(signIn.status, 200, "login deveria funcionar");
  let cookie = signIn.headers.get("set-cookie")!;
  const session = await auth().api.getSession({ headers: new Headers({ cookie: cookie.split(";")[0] }) });
  assert.equal(session?.user.id, inviteeId);
  assert.equal((session!.user as { role?: string }).role, "user");
  console.log("✓ login + sessão");

  const bad = await auth().api.signInEmail({ body: { email: "amigo@test.dev", password: "errada123" }, asResponse: true });
  assert.equal(bad.status, 401);
  console.log("✓ senha errada rejeitada");

  const signUp = await auth().api.signUpEmail({ body: { email: "x@test.dev", password: "12345678", name: "x" }, asResponse: true }).catch((e) => e);
  assert.ok(signUp.status !== 200, "cadastro público deveria estar bloqueado");
  console.log("✓ cadastro público bloqueado");

  // ── acesso sem e-mail (lib/access.ts, usado pelo admin) ──
  const { createPasswordSetupLink, generateTemporaryPassword, setTemporaryPassword } =
    await import("../lib/access");

  const linkUserId = crypto.randomUUID();
  await db.insert(users).values({ id: linkUserId, name: "", email: "link@test.dev" });
  const setupLink = await createPasswordSetupLink(linkUserId);
  const linkToken = setupLink.match(/reset-password\/([A-Za-z0-9]+)\?/)![1];
  await auth().api.resetPassword({ body: { token: linkToken, newPassword: "senha-do-link-1" } });
  const viaLink = await auth().api.signInEmail({ body: { email: "link@test.dev", password: "senha-do-link-1" }, asResponse: true });
  assert.equal(viaLink.status, 200, "login após link gerado pelo admin");
  const reused = await auth().api.resetPassword({ body: { token: linkToken, newPassword: "outra-senha-1" } }).catch((e) => e);
  assert.ok(reused instanceof Error, "link gerado não pode ser reutilizado");
  console.log("✓ link de definição gerado pelo admin (uso único)");

  const tempPassword = generateTemporaryPassword();
  assert.match(tempPassword, /^[A-HJ-NP-Za-km-np-z2-9]{12}$/);
  await setTemporaryPassword(inviteeId, tempPassword);
  const [flagged] = await db.select({ must: users.mustChangePassword }).from(users).where(eq(users.id, inviteeId));
  assert.equal(flagged.must, true);
  const oldSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, inviteeId));
  assert.equal(oldSessions.length, 0, "senha temporária encerra as sessões");
  const oldPassword = await auth().api.signInEmail({ body: { email: "amigo@test.dev", password: "senha-segura-1" }, asResponse: true });
  assert.equal(oldPassword.status, 401, "senha anterior deixa de valer");
  const withTemp = await auth().api.signInEmail({ body: { email: "amigo@test.dev", password: tempPassword }, asResponse: true });
  assert.equal(withTemp.status, 200, "login com senha temporária");
  console.log("✓ senha temporária: invalida a anterior, encerra sessões e marca troca obrigatória");

  await setTemporaryPassword(linkUserId, generateTemporaryPassword());
  const recovery = await createPasswordSetupLink(linkUserId);
  await auth().api.resetPassword({
    body: { token: recovery.match(/reset-password\/([A-Za-z0-9]+)\?/)![1], newPassword: "senha-nova-link" }
  });
  const [cleared] = await db.select({ must: users.mustChangePassword }).from(users).where(eq(users.id, linkUserId));
  assert.equal(cleared.must, false, "redefinir pelo link libera a troca obrigatória");
  console.log("✓ redefinição pelo link libera a senha temporária");

  await db.delete(sessions).where(eq(sessions.userId, linkUserId));
  await db.delete(accounts).where(eq(accounts.userId, linkUserId));
  await db.delete(users).where(eq(users.id, linkUserId));

  // a sessão usada no fim do teste precisa ser nova (a temporária derrubou a anterior)
  const relogin = await auth().api.signInEmail({ body: { email: "amigo@test.dev", password: tempPassword }, asResponse: true });
  cookie = relogin.headers.get("set-cookie")!;

  // ── jogos ──
  await db.insert(games).values([
    { id: crypto.randomUUID(), title: "Portal 2", createdBy: adminId, image: "game-covers/a/b.png" },
    { id: crypto.randomUUID(), title: "portal 2 ", createdBy: inviteeId, steamAppid: 620, steamFamilyShared: true, image: "https://cdn.example/620.jpg" },
    { id: crypto.randomUUID(), title: "Hades", createdBy: inviteeId, steamAppid: 1145360 }
  ]);
  const rows = await listGames();
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => typeof r.created_at === "string" && r.creator?.email));
  assert.ok(rows.some((r) => r.image_url === "/files/game-covers/a/b.png"));
  const grouped = groupGamesByTitle(rows, inviteeId, false);
  assert.equal(grouped.length, 2, "Portal 2 deveria agrupar");
  assert.equal(grouped.find((g) => g.title.toLowerCase().startsWith("portal"))!.owners.length, 2);
  console.log("✓ listagem com join + agrupamento");

  // ── consultas da sincronização Steam ──
  const known = await db
    .selectDistinct({ appid: games.steamAppid, shared: games.steamFamilyShared })
    .from(games)
    .where(and(inArray(games.steamAppid, [620, 1145360]), isNotNull(games.steamFamilyShared)));
  assert.deepEqual(known, [{ appid: 620, shared: true }]);

  const unknown = await db
    .select({ appid: games.steamAppid })
    .from(games)
    .where(and(eq(games.createdBy, inviteeId), isNotNull(games.steamAppid), isNull(games.steamFamilyShared)))
    .limit(60);
  assert.deepEqual(unknown, [{ appid: 1145360 }]);

  await db.update(games).set({ steamFamilyShared: false })
    .where(and(eq(games.createdBy, inviteeId), inArray(games.steamAppid, [1145360])));

  let dup: unknown = null;
  try {
    await db.insert(games).values({ id: crypto.randomUUID(), title: "Hades", createdBy: inviteeId, steamAppid: 1145360 });
  } catch (e) { dup = e; }
  assert.ok(dup, "unique (created_by, steam_appid) deveria barrar duplicata");
  console.log("✓ consultas da sincronização Steam + unique");

  // updatedAt automático
  const [before] = await db.select({ u: games.updatedAt, c: games.createdAt }).from(games).where(eq(games.title, "Hades"));
  assert.ok(before.c instanceof Date && Math.abs(before.c.getTime() - Date.now()) < 60_000, "createdAt em UTC correto");
  console.log("✓ datas corretas (sem desvio de fuso)");

  // ── exclusão de usuário (igual deleteUser) ──
  await db.delete(games).where(eq(games.createdBy, inviteeId));
  await db.delete(sessions).where(eq(sessions.userId, inviteeId));
  await db.delete(accounts).where(eq(accounts.userId, inviteeId));
  await db.delete(users).where(eq(users.id, inviteeId));
  assert.equal((await listGames()).length, 1);
  const after = await auth().api.getSession({ headers: new Headers({ cookie: cookie.split(";")[0] }), query: { disableCookieCache: true } });
  assert.equal(after, null, "sessão do usuário removido deveria acabar");
  console.log("✓ exclusão de usuário remove jogos e sessões");

  console.log(`\nTUDO OK (${currentDialect()})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("FALHOU:", err);
  process.exit(1);
});
