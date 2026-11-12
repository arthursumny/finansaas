import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { computeClosingInfo } from "./cards.js";

test("server/cards.js — Teste 6: days_until_closing e closing_soon", () => {
  // Fecha hoje (0 dias, true)
  const today = computeClosingInfo(5, new Date(2026, 2, 5)); // 2026-03-05
  assert.equal(today.days_until_closing, 0);
  assert.equal(today.closing_soon, true);
  assert.equal(today.next_closing_date, "2026-03-05");

  // Fecha em 3 dias (3 dias, true)
  const in3Days = computeClosingInfo(5, new Date(2026, 2, 2)); // 2026-03-02
  assert.equal(in3Days.days_until_closing, 3);
  assert.equal(in3Days.closing_soon, true);
  assert.equal(in3Days.next_closing_date, "2026-03-05");

  // Fecha em 5 dias (5 dias, false)
  const in5Days = computeClosingInfo(6, new Date(2026, 2, 1)); // 2026-03-01
  assert.equal(in5Days.days_until_closing, 5);
  assert.equal(in5Days.closing_soon, false);
  assert.equal(in5Days.next_closing_date, "2026-03-06");
});

test("server/cards.js — FASE 5: Testes de 1 a 5 e 7 a 10 (Rotas HTTP e Regras de Negócio)", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-fase5-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "fase5-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits } = await import(`./index.js?fase5-test=${Date.now()}`);
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

  // 1) Criar usuário de teste
  const signup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "fase5-user@finansaas.local", password: "Password123" }),
  });
  assert.equal(signup.response.status, 200);
  const token = signup.body.session.access_token;
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Cadastrar cartão principal para testes 1 a 5
  // Limite 1000, closing_day 10, due_day 20, min_payment_percent 15
  const card1Insert = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Cartão Teste Fase 5",
        brand: "mastercard",
        limit_amount: 1000,
        closing_day: 10,
        due_day: 20,
        color: "#6366f1",
        min_payment_percent: 15,
        is_active: 1,
      },
    }),
  });
  assert.equal(card1Insert.response.status, 200);
  const card1 = card1Insert.body.data[0];
  assert.equal(card1.min_payment_percent, 15);

  // Inserir compra de R$ 250,00 na fatura de 2026-03 (ciclo: 2026-02-10 < data <= 2026-03-10)
  const tx1Insert = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Compra Teste 250",
        amount: 250,
        date: "2026-03-05",
        category: "Outros",
        status: "pending",
        card_id: card1.id,
      },
    }),
  });
  assert.equal(tx1Insert.response.status, 200);

  // =========================================================================
  // TESTE 1: minimum_payment = 15% de 250 = 37.50; pagar mínimo cria registro
  // e pending cai para 212.50, status = partial; minimum_remaining = 0.
  // =========================================================================
  const invBeforePay = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invBeforePay.response.status, 200);
  assert.equal(invBeforePay.body.total, 250);
  assert.equal(invBeforePay.body.minimum_payment, 37.5);
  assert.equal(invBeforePay.body.minimum_remaining, 37.5);
  assert.equal(invBeforePay.body.pending, 250);
  assert.equal(invBeforePay.body.status, "open");

  const payMinRes = await request(`/cards/${card1.id}/invoice/2026-03/pay-minimum`, {
    method: "POST",
    headers: authHeader,
  });
  assert.equal(payMinRes.response.status, 200);
  assert.equal(payMinRes.body.amount, 37.5);
  assert.equal(payMinRes.body.paid, 37.5);
  assert.equal(payMinRes.body.pending, 212.5);

  const invAfterPayMin = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invAfterPayMin.response.status, 200);
  assert.equal(invAfterPayMin.body.paid, 37.5);
  assert.equal(invAfterPayMin.body.pending, 212.5);
  assert.equal(invAfterPayMin.body.status, "partial");
  assert.equal(invAfterPayMin.body.minimum_remaining, 0);
  assert.equal(invAfterPayMin.body.payments.length, 1);
  const payment1Id = invAfterPayMin.body.payments[0].id;

  // =========================================================================
  // TESTE 2: Pagar mínimo duas vezes não passa do pendente (400 acima do pendente).
  // =========================================================================
  const payOverLimit = await request(`/cards/${card1.id}/invoice/2026-03/pay-minimum`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ amount: 300 }),
  });
  assert.equal(payOverLimit.response.status, 400);

  const payNegative = await request(`/cards/${card1.id}/invoice/2026-03/pay-minimum`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ amount: -10 }),
  });
  assert.equal(payNegative.response.status, 400);

  // =========================================================================
  // TESTE 3: Pagar fatura depois de parcial zera o pendente e não duplica valores (pending == 0).
  // =========================================================================
  const payFullRes = await request(`/cards/${card1.id}/invoice/2026-03/pay`, {
    method: "POST",
    headers: authHeader,
  });
  assert.equal(payFullRes.response.status, 200);
  assert.equal(payFullRes.body.pending, 0);

  const invAfterPayFull = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invAfterPayFull.response.status, 200);
  assert.equal(invAfterPayFull.body.pending, 0);
  assert.equal(invAfterPayFull.body.paid, 250);
  assert.equal(invAfterPayFull.body.status, "paid");

  // =========================================================================
  // TESTE 4: Reabrir apaga os pagamentos parciais e volta tudo para pendente.
  // =========================================================================
  const unpayRes = await request(`/cards/${card1.id}/invoice/2026-03/unpay`, {
    method: "POST",
    headers: authHeader,
  });
  assert.equal(unpayRes.response.status, 200);
  assert.equal(unpayRes.body.pending, 250);

  const invAfterUnpay = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invAfterUnpay.response.status, 200);
  assert.equal(invAfterUnpay.body.payments.length, 0);
  assert.equal(invAfterUnpay.body.paid, 0);
  assert.equal(invAfterUnpay.body.pending, 250);
  assert.equal(invAfterUnpay.body.status, "open");
  assert.equal(invAfterUnpay.body.minimum_remaining, 37.5);

  // =========================================================================
  // TESTE 5: Excluir um pagamento parcial específico volta o pendente ao valor anterior.
  // =========================================================================
  // Faz um novo pagamento parcial
  const payPartialRes = await request(`/cards/${card1.id}/invoice/2026-03/pay-minimum`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ amount: 50 }),
  });
  assert.equal(payPartialRes.response.status, 200);
  assert.equal(payPartialRes.body.pending, 200);

  const invWithPartial = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invWithPartial.body.payments.length, 1);
  const pId = invWithPartial.body.payments[0].id;

  // Deleta o pagamento parcial específico
  const deletePaymentRes = await request(`/cards/${card1.id}/invoice/2026-03/payments/${pId}`, {
    method: "DELETE",
    headers: authHeader,
  });
  assert.equal(deletePaymentRes.response.status, 200);
  assert.equal(deletePaymentRes.body.pending, 250);

  const invAfterDeletePay = await request(`/cards/${card1.id}/invoice?month=2026-03`, {
    headers: authHeader,
  });
  assert.equal(invAfterDeletePay.body.payments.length, 0);
  assert.equal(invAfterDeletePay.body.pending, 250);
  assert.equal(invAfterDeletePay.body.paid, 0);

  // =========================================================================
  // TESTE 7: Cartão adicional herda limite/fechamento/vencimento; mudar o titular propaga;
  // adicional de adicional = 400.
  // =========================================================================
  const titularInsert = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Titular Família",
        brand: "visa",
        limit_amount: 3000,
        closing_day: 15,
        due_day: 25,
        min_payment_percent: 20,
        is_active: 1,
      },
    }),
  });
  assert.equal(titularInsert.response.status, 200);
  const titularCard = titularInsert.body.data[0];

  // Cria cartão adicional vinculado ao titular
  const adicionalInsert = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Adicional Filho",
        brand: "visa",
        parent_card_id: titularCard.id,
        is_active: 1,
      },
    }),
  });
  assert.equal(adicionalInsert.response.status, 200);
  const adicionalCard = adicionalInsert.body.data[0];

  // Verifica que herdou do titular
  assert.equal(adicionalCard.limit_amount, 3000);
  assert.equal(adicionalCard.closing_day, 15);
  assert.equal(adicionalCard.due_day, 25);
  assert.equal(adicionalCard.min_payment_percent, 20);
  assert.equal(adicionalCard.parent_card_id, titularCard.id);

  // Tentativa de criar adicional de adicional deve retornar 400
  const subAdicionalInsert = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Neto Adicional",
        brand: "visa",
        parent_card_id: adicionalCard.id,
      },
    }),
  });
  assert.equal(subAdicionalInsert.response.status, 400);

  // Mudar o titular propaga para o adicional
  const updateTitular = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "update",
      filters: [{ column: "id", op: "eq", value: titularCard.id }],
      values: {
        limit_amount: 4000,
        closing_day: 18,
        due_day: 28,
        min_payment_percent: 25,
      },
    }),
  });
  assert.equal(updateTitular.response.status, 200);

  const getAdicional = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "select",
      filters: [{ column: "id", op: "eq", value: adicionalCard.id }],
    }),
  });
  assert.equal(getAdicional.response.status, 200);
  const refreshedAdicional = getAdicional.body.data[0];
  assert.equal(refreshedAdicional.limit_amount, 4000);
  assert.equal(refreshedAdicional.closing_day, 18);
  assert.equal(refreshedAdicional.due_day, 28);
  assert.equal(refreshedAdicional.min_payment_percent, 25);

  // =========================================================================
  // TESTE 8: Fatura do titular com include_additional=1 soma compras do adicional;
  // com 0, não soma.
  // =========================================================================
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Compra no titular: R$ 100
  await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Compra Titular",
        amount: 100,
        date: `${currentMonth}-05`,
        category: "Mercado",
        status: "pending",
        card_id: titularCard.id,
      },
    }),
  });

  // Compra no adicional: R$ 150
  await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Compra Adicional",
        amount: 150,
        date: `${currentMonth}-06`,
        category: "Restaurante",
        status: "pending",
        card_id: adicionalCard.id,
      },
    }),
  });

  // Com include_additional=1 (default)
  const invWithAdditionals = await request(`/cards/${titularCard.id}/invoice?month=${currentMonth}&include_additional=1`, {
    headers: authHeader,
  });
  assert.equal(invWithAdditionals.response.status, 200);
  assert.equal(invWithAdditionals.body.total, 250);
  assert.equal(invWithAdditionals.body.transactions_count, 2);
  assert.equal(invWithAdditionals.body.cards_included.length, 2);

  // Com include_additional=0
  const invWithoutAdditionals = await request(`/cards/${titularCard.id}/invoice?month=${currentMonth}&include_additional=0`, {
    headers: authHeader,
  });
  assert.equal(invWithoutAdditionals.response.status, 200);
  assert.equal(invWithoutAdditionals.body.total, 100);
  assert.equal(invWithoutAdditionals.body.transactions_count, 1);
  assert.equal(invWithoutAdditionals.body.cards_included.length, 1);

  // =========================================================================
  // TESTE 9: Limite compartilhado: compra no adicional reduz o disponível do titular.
  // =========================================================================
  const summaryRes = await request("/cards/summary", {
    headers: authHeader,
  });
  assert.equal(summaryRes.response.status, 200);
  const titularSummary = summaryRes.body.find((c) => c.id === titularCard.id);
  const adicionalSummary = summaryRes.body.find((c) => c.id === adicionalCard.id);

  assert.ok(titularSummary);
  assert.ok(adicionalSummary);
  assert.equal(titularSummary.limit_amount, 4000);
  // Total usado pela família no ciclo: 100 (titular) + 150 (adicional) = 250
  assert.equal(titularSummary.used_amount, 250);
  assert.equal(titularSummary.available_amount, 3750);

  // Para o adicional, o limite é compartilhado
  assert.equal(adicionalSummary.shared_with_parent, true);
  assert.equal(adicionalSummary.limit_amount, 4000);
  assert.equal(adicionalSummary.used_amount, 250);
  assert.equal(adicionalSummary.available_amount, 3750);

  // =========================================================================
  // TESTE 10: Excluir titular deixa o adicional sem pai e as transações intactas.
  // =========================================================================
  const deleteTitular = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "delete",
      filters: [{ column: "id", op: "eq", value: titularCard.id }],
    }),
  });
  assert.equal(deleteTitular.response.status, 200);

  // O cartão adicional continua existindo e parent_card_id passa a ser null
  const getAdicionalAfter = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "cards",
      action: "select",
      filters: [{ column: "id", op: "eq", value: adicionalCard.id }],
    }),
  });
  assert.equal(getAdicionalAfter.response.status, 200);
  assert.equal(getAdicionalAfter.body.data.length, 1);
  assert.equal(getAdicionalAfter.body.data[0].parent_card_id, null);

  // As transações continuam intactas
  const getTxs = await request("/query", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      table: "transactions",
      action: "select",
      filters: [{ column: "category", op: "in", value: ["Mercado", "Restaurante"] }],
    }),
  });
  assert.equal(getTxs.response.status, 200);
  assert.equal(getTxs.body.data.length, 2);
});
