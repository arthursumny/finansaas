import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("Fluxos de autenticação, recuperação de senha, sessões e rate limit", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-auth-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "auth-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits } = await import(`./index.js?auth-test=${Date.now()}`);
  resetRateLimits();

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    return { response, body: text ? JSON.parse(text) : null };
  }

  // 1) signup com senha fraca → 400
  const weakSignup1 = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fraca@finansaas.local", password: "123" }),
  });
  assert.equal(weakSignup1.response.status, 400);

  const weakSignup2 = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fraca2@finansaas.local", password: "senhasomenteletras" }),
  });
  assert.equal(weakSignup2.response.status, 400);

  const weakSignup3 = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fraca3@finansaas.local", password: "1234567890" }),
  });
  assert.equal(weakSignup3.response.status, 400);

  // 2) signup válido → 200
  const validSignup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "SenhaForte1" }),
  });
  assert.equal(validSignup.response.status, 200);
  assert.ok(validSignup.body.session.access_token);
  assert.equal(validSignup.body.user.email, "usuario@finansaas.local");
  assert.ok(validSignup.body.user.email_verified_at);

  const userId = validSignup.body.user.id;

  // 3) signin errado 5x → 429
  resetRateLimits();
  for (let i = 0; i < 5; i++) {
    const wrong = await request("/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "usuario@finansaas.local", password: "SenhaIncorreta" }),
    });
    assert.equal(wrong.response.status, 401);
  }
  const rateLimited = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "SenhaIncorreta" }),
  });
  assert.equal(rateLimited.response.status, 429);
  assert.equal(rateLimited.body.error.code, "rate_limited");
  assert.ok(rateLimited.response.headers.get("Retry-After"));

  // Limpa rate limits para continuar os testes com o mesmo usuário/IP
  resetRateLimits();

  // 4) forgot-password de email inexistente → 200 e sem token criado
  const tokensBefore = db.prepare("SELECT count(*) as count FROM auth_tokens WHERE type = 'password_reset'").get().count;
  const forgotNonExistent = await request("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "inexistente@finansaas.local" }),
  });
  assert.equal(forgotNonExistent.response.status, 200);
  assert.equal(forgotNonExistent.body.ok, true);
  const tokensAfterNonExistent = db.prepare("SELECT count(*) as count FROM auth_tokens WHERE type = 'password_reset'").get().count;
  assert.equal(tokensAfterNonExistent, tokensBefore);

  // 5) forgot-password existente → token criado
  const forgotExisting = await request("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local" }),
  });
  assert.equal(forgotExisting.response.status, 200);
  assert.equal(forgotExisting.body.ok, true);
  const tokenRow = db.prepare("SELECT * FROM auth_tokens WHERE user_id = ? AND type = 'password_reset' ORDER BY created_at DESC").get(userId);
  assert.ok(tokenRow);
  assert.equal(tokenRow.used_at, null);

  // 6) reset-password com token válido troca a senha, invalida o token e derruba as sessões
  const testResetToken = "test_reset_token_raw_value_123456";
  const testResetHash = createHash("sha256").update(testResetToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, "password_reset", testResetHash, expiresAt, new Date().toISOString());

  // Primeiro testa reset com token inválido
  const invalidReset = await request("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "token_inexistente", password: "NovaSenhaForte2" }),
  });
  assert.equal(invalidReset.response.status, 400);
  assert.equal(invalidReset.body.error.code, "invalid_token");

  // Reset válido
  const validReset = await request("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: testResetToken, password: "NovaSenhaForte2" }),
  });
  assert.equal(validReset.response.status, 200);
  assert.equal(validReset.body.ok, true);

  // Verifica que o token foi marcado como usado
  const usedToken = db.prepare("SELECT * FROM auth_tokens WHERE token_hash = ?").get(testResetHash);
  assert.ok(usedToken.used_at);

  // Verifica que as sessões anteriores foram apagadas
  const sessionCount = db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(userId).count;
  assert.equal(sessionCount, 0);

  // Tentar reutilizar o token deve falhar
  const reusedToken = await request("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: testResetToken, password: "OutraSenhaForte3" }),
  });
  assert.equal(reusedToken.response.status, 400);

  // Login com senha antiga deve falhar
  const oldLogin = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "SenhaForte1" }),
  });
  assert.equal(oldLogin.response.status, 401);

  // Login com a nova senha deve funcionar
  resetRateLimits();
  const newLogin1 = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "NovaSenhaForte2" }),
  });
  assert.equal(newLogin1.response.status, 200);
  const sessionToken1 = newLogin1.body.session.access_token;

  // Cria uma segunda sessão simulando outro dispositivo
  const newLogin2 = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "NovaSenhaForte2" }),
  });
  assert.equal(newLogin2.response.status, 200);
  const sessionToken2 = newLogin2.body.session.access_token;

  assert.equal(db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(userId).count, 2);

  // 7) change-password exige senha atual correta e mantém a sessão atual
  const wrongChange = await request("/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken2}`,
    },
    body: JSON.stringify({ currentPassword: "SenhaIncorreta", newPassword: "TerceiraSenha4" }),
  });
  assert.equal(wrongChange.response.status, 400);

  const validChange = await request("/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken2}`,
    },
    body: JSON.stringify({ currentPassword: "NovaSenhaForte2", newPassword: "TerceiraSenha4" }),
  });
  assert.equal(validChange.response.status, 200);

  // A sessão atual (sessionToken2) ainda existe
  const currentStillExists = db.prepare("SELECT * FROM sessions WHERE token = ?").get(sessionToken2);
  assert.ok(currentStillExists);

  // A outra sessão (sessionToken1) foi derrubada
  const otherSession = db.prepare("SELECT * FROM sessions WHERE token = ?").get(sessionToken1);
  assert.equal(otherSession, undefined);

  // 8) signout-all derruba todas as sessões
  // Cria mais uma sessão para garantir que há múltiplas
  const anotherLogin = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "TerceiraSenha4" }),
  });
  assert.equal(anotherLogin.response.status, 200);
  const sessionToken3 = anotherLogin.body.session.access_token;
  assert.equal(db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(userId).count, 2);

  // 9) GET /auth/sessions identifica a atual
  const sessionsResponse = await request("/auth/sessions", {
    headers: { Authorization: `Bearer ${sessionToken3}` },
  });
  assert.equal(sessionsResponse.response.status, 200);
  assert.ok(Array.isArray(sessionsResponse.body.sessions));
  assert.equal(sessionsResponse.body.sessions.length, 2);
  const currentEntry = sessionsResponse.body.sessions.find((s) => s.current);
  assert.ok(currentEntry);
  assert.ok(currentEntry.id);
  // Garante que o token original não é exposto
  assert.equal(currentEntry.token, undefined);

  // Executa signout-all
  const signoutAll = await request("/auth/signout-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken3}` },
  });
  assert.equal(signoutAll.response.status, 200);
  assert.equal(db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(userId).count, 0);

  // 10) change-email sem RESEND_API_KEY → 503
  // Faz login de novo para ter uma sessão válida
  const sessionAfterSignout = await request("/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "usuario@finansaas.local", password: "TerceiraSenha4" }),
  });
  assert.equal(sessionAfterSignout.response.status, 200);
  const activeToken = sessionAfterSignout.body.session.access_token;

  const changeEmailNoResend = await request("/auth/change-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeToken}`,
    },
    body: JSON.stringify({ password: "TerceiraSenha4", newEmail: "novomail@finansaas.local" }),
  });
  assert.equal(changeEmailNoResend.response.status, 503);
  assert.equal(changeEmailNoResend.body.error.code, "email_disabled");

  // 11) confirm-email atualiza email do usuário e profile
  db.prepare("UPDATE users SET pending_email = ? WHERE id = ?").run("confirmado@finansaas.local", userId);
  const rawConfirmToken = "raw_email_confirm_token_123456";
  const confirmHash = createHash("sha256").update(rawConfirmToken).digest("hex");
  db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, "email_confirm", confirmHash, expiresAt, new Date().toISOString());

  const confirmRes = await request("/auth/confirm-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawConfirmToken }),
  });
  assert.equal(confirmRes.response.status, 200);
  assert.equal(confirmRes.body.ok, true);

  const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  assert.equal(updatedUser.email, "confirmado@finansaas.local");
  assert.equal(updatedUser.pending_email, null);
  assert.ok(updatedUser.email_verified_at);

  const updatedProfile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(userId);
  assert.equal(updatedProfile.email, "confirmado@finansaas.local");
});
