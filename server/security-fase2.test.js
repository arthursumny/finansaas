import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("Fase 2: Sessões hasheadas, sem duplicação a cada refresh, rate limit por email, trust proxy, headers e confirmação", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-fase2-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "fase2-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  process.env.AUTH_SIGNIN_LIMIT = "5";
  process.env.AUTH_SIGNIN_EMAIL_LIMIT = "10";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits } = await import(`./index.js?fase2-test=${Date.now()}`);
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
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { response, body };
  }

  // 1. Security Headers e CORS
  const healthRes = await request("/health", {
    headers: { Origin: "http://localhost:8080" },
  });
  assert.equal(healthRes.response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(healthRes.response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(healthRes.response.headers.get("x-frame-options"), "DENY");
  assert.equal(healthRes.response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(healthRes.response.headers.get("access-control-allow-origin"), "http://localhost:8080");

  // Origem não permitida não deve receber header Access-Control-Allow-Origin
  const blockedCors = await request("/health", {
    headers: { Origin: "http://attacker-site.com" },
  });
  assert.equal(blockedCors.response.headers.get("access-control-allow-origin"), null);

  // 2. Cadastro de usuário para testes
  const signupRes = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fase2@finansaas.local", password: "Password123" }),
  });
  assert.equal(signupRes.response.status, 200);
  const initialToken = signupRes.body.session.access_token;
  const initialUserId = signupRes.body.user.id;
  assert.ok(initialToken);

  // 3. Sessão gravada com token hasheado (P2 corrigido)
  const initialTokenHash = createHash("sha256").update(initialToken).digest("hex");
  const sessionRow = db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(initialTokenHash);
  assert.ok(sessionRow, "Sessão deve existir identificada pelo token_hash");
  assert.equal(sessionRow.user_id, initialUserId);

  // Garante que a coluna 'token' com valor em texto puro não existe ou não guarda o token plano
  const tableColumns = db.prepare("PRAGMA table_info(sessions)").all().map((c) => c.name);
  assert.ok(tableColumns.includes("token_hash"));
  assert.ok(!tableColumns.includes("token"), "A coluna de texto puro token não deve existir na tabela final de sessões");

  // Sessão com token inválido retorna 401
  const invalidSessionRes = await request("/auth/session", {
    headers: { Authorization: "Bearer token-completamente-invalido" },
  });
  assert.equal(invalidSessionRes.response.status, 401);

  // 4. GET /auth/session repetido 5x NÃO cria nova sessão e devolve o mesmo token (P1 corrigido)
  const sessionsCountBefore = db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(initialUserId).count;
  assert.equal(sessionsCountBefore, 1);

  for (let i = 0; i < 5; i++) {
    const sessionCheck = await request("/auth/session", {
      headers: { Authorization: `Bearer ${initialToken}` },
    });
    assert.equal(sessionCheck.response.status, 200);
    assert.equal(sessionCheck.body.session.access_token, initialToken);
    assert.equal(sessionCheck.body.user.email, "fase2@finansaas.local");
  }

  const sessionsCountAfter = db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(initialUserId).count;
  assert.equal(sessionsCountAfter, 1, "GET /auth/session não deve criar novas sessões");

  // 5. POST /auth/refresh invalida token antigo e emite novo funcionando (rotação de sessão)
  const refreshRes = await request("/auth/refresh", {
    method: "POST",
    headers: { Authorization: `Bearer ${initialToken}` },
  });
  assert.equal(refreshRes.response.status, 200);
  const refreshedToken = refreshRes.body.session.access_token;
  assert.ok(refreshedToken);
  assert.notEqual(refreshedToken, initialToken);

  // O token antigo deve dar 401
  const oldTokenUse = await request("/auth/session", {
    headers: { Authorization: `Bearer ${initialToken}` },
  });
  assert.equal(oldTokenUse.response.status, 401);

  // O token novo deve funcionar
  const newTokenUse = await request("/auth/session", {
    headers: { Authorization: `Bearer ${refreshedToken}` },
  });
  assert.equal(newTokenUse.response.status, 200);
  assert.equal(newTokenUse.body.session.access_token, refreshedToken);

  // 6. Limite de 10 sessões por usuário ao criar sessões
  resetRateLimits();
  for (let i = 0; i < 15; i++) {
    const login = await request("/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fase2@finansaas.local", password: "Password123" }),
    });
    assert.equal(login.response.status, 200);
  }
  const userSessionsCount = db.prepare("SELECT count(*) as count FROM sessions WHERE user_id = ?").get(initialUserId).count;
  assert.equal(userSessionsCount, 10, "Limite de sessões deve ser 10 no máximo");

  // 7. Rate limit por email sozinho dispara mesmo trocando de IP via trust proxy (X-Forwarded-For)
  resetRateLimits();
  const targetEmail = "alvo-brute-force@finansaas.local";

  // Cria o usuário primeiro
  await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: targetEmail, password: "TargetPassword123" }),
  });
  resetRateLimits();

  // AUTH_SIGNIN_EMAIL_LIMIT é 10. Vamos fazer 10 tentativas com IPs diferentes
  for (let i = 1; i <= 10; i++) {
    const wrongAttempt = await request("/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `192.168.10.${i}`,
      },
      body: JSON.stringify({ email: targetEmail, password: "SenhaIncorreta" }),
    });
    assert.equal(wrongAttempt.response.status, 401);
  }

  // 11ª tentativa de outro IP diferente deve ser bloqueada pelo limite de email (429)
  const blockedAttempt = await request("/auth/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "10.0.0.99",
    },
    body: JSON.stringify({ email: targetEmail, password: "SenhaIncorreta" }),
  });
  assert.equal(blockedAttempt.response.status, 429);
  assert.equal(blockedAttempt.body.error.code, "rate_limited");
  assert.ok(blockedAttempt.response.headers.get("Retry-After"));

  // 8. Confirmação de email: token válido marca email_verified_at; token reaproveitado falha
  resetRateLimits();
  const confirmEmailUser = "precisa-confirmar@finansaas.local";
  const confirmSignup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: confirmEmailUser, password: "Password123" }),
  });
  assert.equal(confirmSignup.response.status, 200);
  const confirmUserId = confirmSignup.body.user.id;
  const confirmTokenAuth = confirmSignup.body.session.access_token;

  // Simula email_verified_at = NULL (como ocorre quando envio de email está ativado)
  db.prepare("UPDATE users SET email_verified_at = NULL WHERE id = ?").run(confirmUserId);

  // Gera token de confirmação de email de cadastro
  const rawConfirmToken = "fase2_raw_confirm_token_1234567890";
  const confirmHash = createHash("sha256").update(rawConfirmToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), confirmUserId, "email_confirm", confirmHash, expiresAt, new Date().toISOString());

  // GET /api/auth/confirm-email?token=... valida e marca email_verified_at
  const confirmGetRes = await request(`/auth/confirm-email?token=${rawConfirmToken}`);
  assert.equal(confirmGetRes.response.status, 200);
  assert.equal(confirmGetRes.body.ok, true);
  assert.ok(confirmGetRes.body.user.email_verified_at);

  const verifiedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(confirmUserId);
  assert.ok(verifiedUser.email_verified_at);

  // Token reaproveitado deve falhar (400)
  const reusedConfirmRes = await request("/auth/confirm-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawConfirmToken }),
  });
  assert.equal(reusedConfirmRes.response.status, 400);
  assert.equal(reusedConfirmRes.body.error.code, "invalid_token");

  // Reenviar confirmação via POST /api/auth/resend-confirmation
  db.prepare("UPDATE users SET email_verified_at = NULL WHERE id = ?").run(confirmUserId);
  const resendRes = await request("/auth/resend-confirmation", {
    method: "POST",
    headers: { Authorization: `Bearer ${confirmTokenAuth}` },
  });
  assert.equal(resendRes.response.status, 200);
  assert.equal(resendRes.body.ok, true);

  const newConfirmTokenRow = db.prepare("SELECT * FROM auth_tokens WHERE user_id = ? AND type = 'email_confirm' AND used_at IS NULL").get(confirmUserId);
  assert.ok(newConfirmTokenRow);
});
