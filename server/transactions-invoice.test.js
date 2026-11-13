import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("server/index.js — invoice_month (competência da fatura) em /api/query", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-invoice-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "invoice-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits, computeInvoiceMonth } = await import(
    `./index.js?invoice-test=${Date.now()}`
  );
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

  // 1) Função pura: compra dia 09 com fechamento dia 08 cai na fatura do mês seguinte
  assert.equal(computeInvoiceMonth("2026-11-09", 8), "2026-12");
  // Compra no próprio dia do fechamento permanece no mês
  assert.equal(computeInvoiceMonth("2026-11-08", 8), "2026-11");
  // Virada de ano
  assert.equal(computeInvoiceMonth("2026-12-20", 8), "2027-01");
  // Sem data
  assert.equal(computeInvoiceMonth(null, 8), null);

  // 2) Cenário real: compra openrouter em 2026-11-09 no Nubank (fecha dia 8)
  const signup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invoice-test@finansaas.local", password: "Password123" }),
  });
  assert.equal(signup.response.status, 200);
  const authHeaders = {
    Authorization: `Bearer ${signup.body.session.access_token}`,
    "Content-Type": "application/json",
  };

  const cardRes = await request("/query", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Nubank",
        brand: "mastercard",
        limit_amount: 5000,
        closing_day: 8,
        due_day: 15,
      },
      single: true,
    }),
  });
  assert.equal(cardRes.response.status, 200);
  const card = cardRes.body.data;

  const cardPurchase = await request("/query", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "OpenRouter",
        amount: 64.11,
        date: "2026-11-09",
        category: "Assinaturas",
        status: "paid",
        card_id: card.id,
        payment_method: "credit",
      },
    }),
  });
  assert.equal(cardPurchase.response.status, 200);

  const cashPurchase = await request("/query", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Almoço",
        amount: 30,
        date: "2026-11-09",
        category: "Alimentação",
        status: "paid",
        payment_method: "cash",
      },
    }),
  });
  assert.equal(cashPurchase.response.status, 200);

  // 3) A API retorna invoice_month tanto no caminho com transaction_tags
  //    (early-return do withRelations) quanto no select simples
  for (const select of ["*, transaction_tags", "*"]) {
    const listRes = await request("/query", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ table: "transactions", action: "select", select }),
    });
    assert.equal(listRes.response.status, 200);

    const openrouter = listRes.body.data.find((t) => t.description === "OpenRouter");
    assert.ok(openrouter, "compra do cartão deve existir");
    assert.equal(openrouter.invoice_month, "2026-12");

    const lunch = listRes.body.data.find((t) => t.description === "Almoço");
    assert.ok(lunch, "compra sem cartão deve existir");
    assert.equal(lunch.invoice_month, "2026-11");
  }
});
