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
  const { and, eq, gte, inArray, isNotNull, isNull } = await import("drizzle-orm");
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

  // ── sincronização Steam (lib/steam-sync.ts) com a Steam simulada ──
  {
    const { syncAllUsers, syncUserLibrary, isSyncDue } = await import("../lib/steam-sync");
    const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
    const libraries: Record<string, number[]> = {
      S1: [620, 1145360, ...range(10_000, 200)], // amigo: já tem 620 e 1145360
      S2: [620, 400, ...range(20_000, 99)],
      S3: range(30_000, 100),
      S4: range(40_000, 100)
    };
    const calls: { owned: string[]; store: number } = { owned: [], store: 0 };
    const realFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.includes("GetOwnedGames")) {
        const steamid = url.searchParams.get("steamid")!;
        calls.owned.push(steamid);
        if (!libraries[steamid]) return new Response("erro", { status: 500 });
        return Response.json({ response: { games: libraries[steamid].map((appid) => ({ appid, name: `Jogo ${appid}` })) } });
      }
      if (url.pathname.includes("appdetails")) {
        calls.store++;
        const appid = url.searchParams.get("appids")!;
        const shared = Number(appid) % 2 === 0;
        return Response.json({ [appid]: { success: true, data: { categories: shared ? [{ description: "Family Sharing" }] : [] } } });
      }
      return realFetch(input as RequestInfo);
    }) as typeof fetch;

    process.env.STEAM_API_KEY ??= "chave-simulada";
    const extra: string[] = [];
    try {
      await db.update(users).set({ steamId: "S1", steamSyncedAt: new Date(Date.now() - 86_400_000) }).where(eq(users.id, inviteeId));
      for (const [i, steamId] of ["S2", "S3", "S4", "QUEBRADO"].entries()) {
        const id = crypto.randomUUID();
        extra.push(id);
        await db.insert(users).values({ id, name: "", email: `steam${i}@test.dev`, steamId });
      }

      const first = await syncAllUsers();
      assert.deepEqual([...calls.owned.slice(0, 4)].sort(), ["QUEBRADO", "S2", "S3", "S4"], "nunca sincronizados primeiro");
      assert.equal(calls.owned[4], "S1", "depois o sincronizado há mais tempo");
      assert.equal(first.synced, 4);
      assert.equal(first.failed.length, 1, "perfil com erro não derruba a rotina");
      assert.equal(first.gamesAdded, 101 + 100 + 100 + 200, "S1 só recebe os 200 novos");
      assert.equal(first.familyChecked, 150, "teto de consultas à Store por execução");
      assert.equal(calls.store, 150);
      const [s2game] = await db.select({ shared: games.steamFamilyShared }).from(games)
        .where(and(eq(games.createdBy, extra[0]), eq(games.steamAppid, 620)));
      assert.equal(s2game.shared, true, "Family Sharing do appid 620 reaproveitado de outro usuário");
      const [broken] = await db.select({ at: users.steamSyncedAt }).from(users).where(eq(users.id, extra[3]));
      assert.equal(broken.at, null, "falha não marca como sincronizado");
      console.log("✓ rotina diária: prioridade, incremental, teto da Store, reaproveitamento e falha isolada");

      calls.owned = []; calls.store = 0;
      const second = await syncAllUsers();
      assert.equal(calls.owned[0], "QUEBRADO", "quem falhou vem primeiro na próxima");
      assert.equal(second.gamesAdded, 0, "segunda execução não duplica jogos");
      assert.ok(second.familyChecked > 0 && second.familyChecked <= 150, "continua checando Family Sharing pendente");
      console.log("✓ segunda execução: sem duplicar, continua o Family Sharing pendente");

      const timedOut = await syncAllUsers({ timeBudgetMs: -1 });
      assert.equal(timedOut.synced, 0);
      assert.equal(timedOut.pending, 5, "sem tempo, todos ficam para a próxima");
      console.log("✓ orçamento de tempo: para antes e deixa o resto pendente");

      const single = await syncUserLibrary(inviteeId, "S1", "chave-simulada", { familyLookups: 0 });
      assert.ok("found" in single && single.added === 0 && single.familyChecked === 0);
      assert.equal(isSyncDue(null), true);
      assert.equal(isSyncDue(new Date()), false);
      assert.equal(isSyncDue(new Date(Date.now() - 13 * 3_600_000)), true);
      console.log("✓ sincronização individual e intervalo de 12 h do dashboard");
    } finally {
      globalThis.fetch = realFetch;
      await db.delete(games).where(inArray(games.createdBy, extra));
      await db.delete(games).where(and(eq(games.createdBy, inviteeId), gte(games.steamAppid, 10_000)));
      await db.delete(users).where(inArray(users.id, extra));
    }
  }

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
