import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { computeInvoiceCycle, isTransactionInCycle } from "./cards.js";

test("server/cards.js — Funções puras de ciclo de fatura", () => {
  // 1) Ciclo: fechamento dia 5, compra no dia 5 entra na fatura do mês; compra no dia 6 vai para a seguinte
  const cycleMarch = computeInvoiceCycle(5, "2026-03", 10);
  assert.equal(cycleMarch.cycleStart, "2026-02-05");
  assert.equal(cycleMarch.cycleEnd, "2026-03-05");
  assert.equal(cycleMarch.dueDate, "2026-03-10");

  // Compra no dia 5 entra na fatura de março
  assert.equal(isTransactionInCycle("2026-03-05", cycleMarch.cycleStart, cycleMarch.cycleEnd), true);
  // Compra no dia 6 NÃO entra na fatura de março
  assert.equal(isTransactionInCycle("2026-03-06", cycleMarch.cycleStart, cycleMarch.cycleEnd), false);

  // Ciclo seguinte (abril)
  const cycleApril = computeInvoiceCycle(5, "2026-04", 10);
  assert.equal(cycleApril.cycleStart, "2026-03-05");
  assert.equal(cycleApril.cycleEnd, "2026-04-05");
  // Compra no dia 6 entra na fatura seguinte (abril)
  assert.equal(isTransactionInCycle("2026-03-06", cycleApril.cycleStart, cycleApril.cycleEnd), true);

  // 2) Fechamento dia 31 em fevereiro: usa o último dia do mês
  const cycleFebNonLeap = computeInvoiceCycle(31, "2026-02", 10);
  assert.equal(cycleFebNonLeap.cycleEnd, "2026-02-28");
  assert.equal(cycleFebNonLeap.cycleStart, "2026-01-31");

  const cycleFebLeap = computeInvoiceCycle(31, "2024-02", 10);
  assert.equal(cycleFebLeap.cycleEnd, "2024-02-29");

  // 3) Vencimento: due_day menor que closing_day cai no mês seguinte
  const cycleNextMonthDue = computeInvoiceCycle(25, "2026-03", 5);
  assert.equal(cycleNextMonthDue.cycleEnd, "2026-03-25");
  assert.equal(cycleNextMonthDue.dueDate, "2026-04-05");

  // Vencimento maior ou igual ao fechamento permanece no mesmo mês
  const cycleSameMonthDue = computeInvoiceCycle(5, "2026-03", 15);
  assert.equal(cycleSameMonthDue.dueDate, "2026-03-15");

  // Virada de ano com due_day menor que closing_day
  const cycleYearTurn = computeInvoiceCycle(25, "2026-12", 5);
  assert.equal(cycleYearTurn.dueDate, "2027-01-05");
});

test("server/cards.js — Rotas HTTP /api/cards/summary, /invoice, /invoices e exclusão com ON DELETE SET NULL", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-cards-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "cards-test.sqlite");
  process.env.APP_PUBLIC_URL = "http://localhost:8080";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;

  const { app, db, resetRateLimits } = await import(`./index.js?cards-test=${Date.now()}`);
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
    body: JSON.stringify({ email: "user-a@finansaas.local", password: "Password123" }),
  });
  assert.equal(signupA.response.status, 200);
  const tokenA = signupA.body.session.access_token;
  const userAId = signupA.body.session.user.id;

  const signupB = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user-b@finansaas.local", password: "Password123" }),
  });
  assert.equal(signupB.response.status, 200);
  const tokenB = signupB.body.session.access_token;

  const authHeaderA = { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" };
  const authHeaderB = { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" };

  // 2) Cadastrar 2 cartões para o Usuário A via /api/query
  const card1Insert = await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Nubank Roxinho",
        brand: "mastercard",
        limit_amount: 5000,
        closing_day: 28,
        due_day: 5,
        color: "#8b5cf6",
        is_active: 1,
      },
    }),
  });
  assert.equal(card1Insert.response.status, 200);
  const card1 = card1Insert.body.data[0];
  assert.ok(card1.id);
  assert.equal(card1.limit_amount, 5000);

  const card2Insert = await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "cards",
      action: "insert",
      values: {
        name: "Visa Platinum",
        brand: "visa",
        limit_amount: 3000,
        closing_day: 28,
        due_day: 10,
        color: "#3b82f6",
        is_active: 1,
      },
    }),
  });
  assert.equal(card2Insert.response.status, 200);
  const card2 = card2Insert.body.data[0];
  assert.ok(card2.id);

  // Determinar o ciclo aberto atual para os cartões (fechamento dia 28)
  const today = new Date();
  const currentOpenMonth = today.getDate() > 28
    ? (today.getMonth() === 11 ? `${today.getFullYear() + 1}-01` : `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, "0")}`)
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const cycleCard1 = computeInvoiceCycle(28, currentOpenMonth, 5);

  // 3) Inserir transações para testar /api/cards/summary
  // Transação 1: despesa PAGA de 200 dentro do ciclo do Cartão 1
  await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Supermercado",
        amount: 200,
        date: cycleCard1.cycleEnd,
        category: "Alimentação",
        status: "paid",
        card_id: card1.id,
        payment_method: "credit",
      },
    }),
  });

  // Transação 2: despesa PENDENTE de 50 dentro do ciclo do Cartão 1
  await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Farmácia",
        amount: 50,
        date: cycleCard1.cycleEnd,
        category: "Saúde",
        status: "pending",
        card_id: card1.id,
        payment_method: "credit",
      },
    }),
  });

  // Transação 3: receita de 1000 com card_id (NÃO deve entrar no limite nem na fatura)
  await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "income",
        description: "Reembolso",
        amount: 1000,
        date: cycleCard1.cycleEnd,
        category: "Outros",
        status: "paid",
        card_id: card1.id,
        payment_method: "credit",
      },
    }),
  });

  // Transação 4: despesa de 80 SEM cartão (card_id = null, NÃO deve entrar)
  await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Almoço avulso",
        amount: 80,
        date: cycleCard1.cycleEnd,
        category: "Alimentação",
        status: "paid",
        payment_method: "cash",
      },
    }),
  });

  // Transação 5: despesa no Cartão 2 de 600
  await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "transactions",
      action: "insert",
      values: {
        type: "expense",
        description: "Notebook parcela",
        amount: 600,
        date: cycleCard1.cycleEnd,
        category: "Eletrônicos",
        status: "paid",
        card_id: card2.id,
        payment_method: "credit",
      },
    }),
  });

  // 4) Testar /api/cards/summary
  const summaryRes = await request("/cards/summary", {
    method: "GET",
    headers: authHeaderA,
  });
  assert.equal(summaryRes.response.status, 200);
  const summaryList = summaryRes.body;
  assert.ok(Array.isArray(summaryList), "O resumo deve retornar uma lista");
  assert.equal(summaryList.length, 2, "Usuário A deve ter 2 cartões ativos");

  const summaryCard1 = summaryList.find((c) => c.id === card1.id);
  assert.ok(summaryCard1);
  assert.equal(summaryCard1.limit_amount, 5000);
  assert.equal(summaryCard1.used_amount, 250); // 200 + 50 (apenas despesas do ciclo)
  assert.equal(summaryCard1.available_amount, 4750); // 5000 - 250
  assert.equal(summaryCard1.usage_percent, 5); // 250 / 5000 = 5%
  assert.equal(summaryCard1.current_invoice.total, 250);
  assert.equal(summaryCard1.current_invoice.paid_total, 200);
  assert.equal(summaryCard1.current_invoice.pending_total, 50);
  assert.equal(summaryCard1.current_invoice.transactions_count, 2);

  const summaryCard2 = summaryList.find((c) => c.id === card2.id);
  assert.ok(summaryCard2);
  assert.equal(summaryCard2.limit_amount, 3000);
  assert.equal(summaryCard2.used_amount, 600);
  assert.equal(summaryCard2.available_amount, 2400);
  assert.equal(summaryCard2.usage_percent, 20); // 600 / 3000 = 20%

  // 5) Testar /api/cards/:id/invoice
  const invoiceRes = await request(`/cards/${card1.id}/invoice?month=${currentOpenMonth}`, {
    method: "GET",
    headers: authHeaderA,
  });
  assert.equal(invoiceRes.response.status, 200);
  assert.equal(invoiceRes.body.total, 250);
  assert.equal(invoiceRes.body.paid_total, 200);
  assert.equal(invoiceRes.body.pending_total, 50);
  assert.equal(invoiceRes.body.transactions.length, 2);
  assert.equal(invoiceRes.body.transactions[0].amount >= invoiceRes.body.transactions[1].amount || invoiceRes.body.transactions[0].date >= invoiceRes.body.transactions[1].date, true);

  // Mês inválido deve retornar 400
  const invalidMonthRes = await request(`/cards/${card1.id}/invoice?month=invalido`, {
    method: "GET",
    headers: authHeaderA,
  });
  assert.equal(invalidMonthRes.response.status, 400);

  // Acesso por outro usuário (Usuário B ao cartão do Usuário A) deve retornar 404
  const forbiddenInvoice = await request(`/cards/${card1.id}/invoice`, {
    method: "GET",
    headers: authHeaderB,
  });
  assert.equal(forbiddenInvoice.response.status, 404);

  // 6) Testar /api/cards/:id/invoices (histórico de 12 ciclos)
  const historyRes = await request(`/cards/${card1.id}/invoices`, {
    method: "GET",
    headers: authHeaderA,
  });
  assert.equal(historyRes.response.status, 200);
  assert.ok(Array.isArray(historyRes.body));
  assert.equal(historyRes.body.length, 12);
  const currentHistory = historyRes.body.find((inv) => inv.reference_month === currentOpenMonth);
  assert.ok(currentHistory);
  assert.equal(currentHistory.total, 250);
  assert.equal(currentHistory.transactions_count, 2);

  // Acesso ao histórico por outro usuário retorna 404
  const forbiddenHistory = await request(`/cards/${card1.id}/invoices`, {
    method: "GET",
    headers: authHeaderB,
  });
  assert.equal(forbiddenHistory.response.status, 404);

  // 7) Exclusão de cartão mantém as transações com card_id = NULL
  const deleteRes = await request("/query", {
    method: "POST",
    headers: authHeaderA,
    body: JSON.stringify({
      table: "cards",
      action: "delete",
      filters: [{ column: "id", op: "eq", value: card1.id }],
    }),
  });
  assert.equal(deleteRes.response.status, 200);

  // Verificar transações no banco
  const remainingTxs = db.prepare("SELECT id, description, card_id FROM transactions WHERE user_id = ?").all(userAId);
  const supermarketTx = remainingTxs.find((t) => t.description === "Supermercado");
  assert.ok(supermarketTx, "A transação de supermercado deve continuar existindo");
  assert.equal(supermarketTx.card_id, null, "card_id da transação deve ter ficado NULL após exclusão do cartão");
});
