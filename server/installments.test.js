import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { splitInstallments } from "./installments.js";

test("server/installments.js — splitInstallments função pura", () => {
  // 1) splitInstallments(100, 3) → 3 parcelas somando 100, primeira com o centavo extra (33.34, 33.33, 33.33)
  const p1 = splitInstallments(100, 3, "2026-01-15");
  assert.equal(p1.length, 3);
  assert.equal(p1[0].number, 1);
  assert.equal(p1[0].amount, 33.34);
  assert.equal(p1[1].number, 2);
  assert.equal(p1[1].amount, 33.33);
  assert.equal(p1[2].number, 3);
  assert.equal(p1[2].amount, 33.33);
  const sum1 = Math.round((p1[0].amount + p1[1].amount + p1[2].amount) * 100) / 100;
  assert.equal(sum1, 100.0);

  // 2) Datas: 2026-01-31 em 3x → 2026-01-31, 2026-02-28, 2026-03-31
  const p2 = splitInstallments(300, 3, "2026-01-31");
  assert.equal(p2.length, 3);
  assert.equal(p2[0].date, "2026-01-31");
  assert.equal(p2[1].date, "2026-02-28");
  assert.equal(p2[2].date, "2026-03-31");

  // Ano bissexto (2024-01-31)
  const pLeap = splitInstallments(150, 2, "2024-01-31");
  assert.equal(pLeap[0].date, "2024-01-31");
  assert.equal(pLeap[1].date, "2024-02-29");

  // 3) Validação de limites: deve lançar erro quando fora do intervalo 2..36 ou valor <= 0
  assert.throws(() => splitInstallments(10, 40, "2026-01-15"), /Quantidade de parcelas inválida/);
  assert.throws(() => splitInstallments(10, 1, "2026-01-15"), /Quantidade de parcelas inválida/);
  assert.throws(() => splitInstallments(0, 3, "2026-01-15"), /Valor total inválido/);
  assert.throws(() => splitInstallments(-50, 3, "2026-01-15"), /Valor total inválido/);
});

test("server/installments.js — Rotas HTTP /api/transactions/installments, installment-group e fatura pay/unpay", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-installments-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "installments-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits } = await import(`./index.js?installments-test=${Date.now()}`);
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

  // 1) Criar Usuário A e Usuário B
  const signupA = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user-inst-a@finansaas.local", password: "Password123" }),
  });
  assert.equal(signupA.response.status, 200);
  const tokenA = signupA.body.session.access_token;

  const signupB = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user-inst-b@finansaas.local", password: "Password123" }),
  });
  assert.equal(signupB.response.status, 200);
  const tokenB = signupB.body.session.access_token;

  const authHeaderA = { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" };
  const authHeaderB = { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" };

  // 2) Cadastrar Cartão para Usuário A (fechamento dia 10, vencimento dia 20)
  const cardRes = await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Nubank Teste",
        brand: "mastercard",
        limit_amount: 5000,
        closing_day: 10,
        due_day: 20,
      },
      select: "*",
      single: true,
    }),
  });
  assert.equal(cardRes.response.status, 200);
  const cardA = cardRes.body.data;
  assert.ok(cardA.id);

  // 3) Cadastrar parcelamento via POST /api/transactions/installments
  const createInstRes = await request("/transactions/installments", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      description: "Notebook Dell",
      amount: 1000,
      date: "2026-03-05",
      type: "expense",
      category: "Eletrônicos",
      status: "pending",
      card_id: cardA.id,
      payment_method: "credit",
      installments: 3,
    }),
  });
  assert.equal(createInstRes.response.status, 201);
  const { group_id, created, total, installments } = createInstRes.body;
  assert.ok(group_id);
  assert.equal(created, 3);
  assert.equal(total, 1000);
  assert.equal(installments.length, 3);
  assert.equal(installments[0].amount, 333.34);
  assert.equal(installments[0].description, "Notebook Dell (1/3)");
  assert.equal(installments[0].date, "2026-03-05");
  assert.equal(installments[1].amount, 333.33);
  assert.equal(installments[1].description, "Notebook Dell (2/3)");
  assert.equal(installments[1].date, "2026-04-05");
  assert.equal(installments[2].amount, 333.33);
  assert.equal(installments[2].description, "Notebook Dell (3/3)");
  assert.equal(installments[2].date, "2026-05-05");

  // Verificar isolamento: Usuário B não pode usar o cartão do Usuário A
  const invalidCardRes = await request("/transactions/installments", {
    method: "POST",
    headers: authHeaderB,
    body: JSON.stringify({
      description: "Tentativa B",
      amount: 500,
      date: "2026-03-05",
      category: "Outros",
      card_id: cardA.id,
      installments: 2,
    }),
  });
  assert.equal(invalidCardRes.response.status, 400);

  // 4) Atualizar parcelamento via PATCH /api/transactions/installment-group/:groupId
  const patchRes = await request(`/transactions/installment-group/${group_id}`, {
    method: "PATCH",
    headers: authHeaderA,
    body: JSON.stringify({
      description: "Notebook Dell Inspiron",
      category: "Tecnologia",
    }),
  });
  assert.equal(patchRes.response.status, 200);
  assert.equal(patchRes.body.updated, 3);

  // Conferir no banco
  const dbTxs = db.prepare("SELECT * FROM transactions WHERE installment_group_id = ? ORDER BY installment_number ASC").all(group_id);
  assert.equal(dbTxs.length, 3);
  assert.equal(dbTxs[0].description, "Notebook Dell Inspiron (1/3)");
  assert.equal(dbTxs[0].category, "Tecnologia");

  // 5) Pagar fatura do cartão referente a 2026-03 (fechamento dia 10: abrange compra de 2026-03-05)
  // GET fatura antes do pagamento: deve conter a parcela 1 com installment_number e installment_total
  const invoiceRes = await request(`/cards/${cardA.id}/invoice?month=2026-03`, {
    headers: authHeaderA,
  });
  assert.equal(invoiceRes.response.status, 200);
  assert.equal(invoiceRes.body.transactions.length, 1);
  assert.equal(invoiceRes.body.transactions[0].installment_number, 1);
  assert.equal(invoiceRes.body.transactions[0].installment_total, 3);
  assert.equal(invoiceRes.body.pending_total, 333.34);

  // POST pay
  const payRes = await request(`/cards/${cardA.id}/invoice/2026-03/pay`, {
    method: "POST",
    headers: authHeaderA,
  });
  assert.equal(payRes.response.status, 200);
  assert.equal(payRes.body.updated, 1);
  assert.equal(payRes.body.total_paid, 333.34);
  assert.equal(payRes.body.reference_month, "2026-03");

  // Apenas a parcela 1 deve estar paga; parcelas 2 e 3 continuam pendentes
  const tx1 = db.prepare("SELECT status FROM transactions WHERE id = ?").get(dbTxs[0].id);
  const tx2 = db.prepare("SELECT status FROM transactions WHERE id = ?").get(dbTxs[1].id);
  assert.equal(tx1.status, "paid");
  assert.equal(tx2.status, "pending");

  // Testar PATCH após 1 parcela paga: deve atualizar apenas as 2 pendentes
  const patchPartialRes = await request(`/transactions/installment-group/${group_id}`, {
    method: "PATCH",
    headers: authHeaderA,
    body: JSON.stringify({
      category: "Hardwares",
    }),
  });
  assert.equal(patchPartialRes.response.status, 200);
  assert.equal(patchPartialRes.body.updated, 2);

  // POST unpay: reverter fatura paga
  const unpayRes = await request(`/cards/${cardA.id}/invoice/2026-03/unpay`, {
    method: "POST",
    headers: authHeaderA,
  });
  assert.equal(unpayRes.response.status, 200);
  assert.equal(unpayRes.body.updated, 1);

  const tx1Reverted = db.prepare("SELECT status FROM transactions WHERE id = ?").get(dbTxs[0].id);
  assert.equal(tx1Reverted.status, "pending");

  // 6) Excluir grupo de parcelamento via DELETE /api/transactions/installment-group/:groupId
  const deleteGroupRes = await request(`/transactions/installment-group/${group_id}`, {
    method: "DELETE",
    headers: authHeaderA,
  });
  assert.equal(deleteGroupRes.response.status, 200);
  assert.equal(deleteGroupRes.body.deleted, 3);

  const remainingTxs = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE installment_group_id = ?").get(group_id);
  assert.equal(remainingTxs.count, 0);
});
