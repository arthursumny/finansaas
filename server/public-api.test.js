import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("API pública cobre autenticação, escopos e CRUD financeiro", async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), "finansaas-api-test-"));
  process.env.DATA_DIR = dataDir;
  process.env.DATABASE_PATH = join(dataDir, "test.sqlite");

  const { app, db } = await import(`./index.js?test=${Date.now()}`);
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

  const today = new Date();
  const currentMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const prevMonthKey = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const lastDayOfCurrentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const currentMonthStart = `${currentMonthKey}-01`;
  const currentMonthEnd = `${currentMonthKey}-${String(lastDayOfCurrentMonth).padStart(2, "0")}`;

  const health = await request("/health");
  assert.equal(health.response.status, 200);

  const signup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "api-test@finansaas.local", password: "senha-segura1" }),
  });
  assert.equal(signup.response.status, 200);
  const sessionToken = signup.body.session.access_token;

  const rawApiKey = "fs_test_public_api_key";
  const tokenHash = createHash("sha256").update(rawApiKey).digest("hex");
  const token = await request("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      table: "api_tokens",
      action: "insert",
      values: {
        name: "Teste",
        token_hash: tokenHash,
        token_prefix: rawApiKey.slice(0, 10),
        scopes: ["transactions:read", "transactions:write", "categories:read", "categories:write", "charts:read"],
      },
      single: true,
    }),
  });
  assert.equal(token.response.status, 200);

  const apiHeaders = { "Content-Type": "application/json", "X-Finansaas-Api-Key": rawApiKey };
  const blockedTable = await request("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ table: "users", action: "select" }),
  });
  assert.equal(blockedTable.response.status, 400);

  const blockedQuery = await request("/query", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ table: "users", action: "select" }),
  });
  assert.equal(blockedQuery.response.status, 403);

  const blockedSessionExchange = await request("/auth/session", { headers: apiHeaders });
  assert.equal(blockedSessionExchange.response.status, 403);

  const limitedApiKey = "fs_test_read_only_key";
  await request("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      table: "api_tokens",
      action: "insert",
      values: {
        name: "Somente leitura",
        token_hash: createHash("sha256").update(limitedApiKey).digest("hex"),
        token_prefix: limitedApiKey.slice(0, 10),
        scopes: ["transactions:read"],
      },
      single: true,
    }),
  });
  const deniedWrite = await request("/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Finansaas-Api-Key": limitedApiKey },
    body: JSON.stringify({ type: "expense", description: "Bloqueada", amount: 1, date: `${currentMonthKey}-10`, status: "paid" }),
  });
  assert.equal(deniedWrite.response.status, 403);

  const docs = await request("/openapi.json");
  assert.equal(docs.response.status, 200);
  assert.equal(docs.body.servers[0].url, "/api");
  assert.ok(docs.body.paths["/monthly-report"]);

  const previousIncome = await request("/transactions", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ type: "income", description: "Salário anterior", amount: 100, date: `${prevMonthKey}-25`, status: "paid" }),
  });
  assert.equal(previousIncome.response.status, 201);

  const categories = await request("/categories?type=expense", { headers: apiHeaders });
  assert.equal(categories.response.status, 200);
  assert.ok(categories.body.data.some((category) => category.name === "Alimentação"));

  const category = await request("/categories", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ name: "Projetos", type: "income" }),
  });
  assert.equal(category.response.status, 201);

  const categorized = await request("/agent/categorize", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ description: "Uber para reunião", type: "expense" }),
  });
  assert.equal(categorized.response.status, 200);
  assert.equal(categorized.body.data.category, "Transporte");

  const tag = await request("/tags", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ name: "trabalho", color: "#2563eb" }),
  });
  assert.equal(tag.response.status, 201);

  const updatedTag = await request(`/tags/${tag.body.data.id}`, {
    method: "PATCH",
    headers: apiHeaders,
    body: JSON.stringify({ name: "cliente" }),
  });
  assert.equal(updatedTag.response.status, 200);
  assert.equal(updatedTag.body.data.name, "cliente");

  const created = await request("/transactions", {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      type: "expense",
      description: "Almoço com cliente",
      amount: 42.5,
      date: `${currentMonthKey}-13`,
      status: "paid",
      tag_ids: [tag.body.data.id],
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.category, "Alimentação");
  assert.equal(created.body.data.tags.length, 1);
  const transactionId = created.body.data.id;

  const fetched = await request(`/transactions/${transactionId}`, { headers: apiHeaders });
  assert.equal(fetched.response.status, 200);
  assert.equal(fetched.body.data.id, transactionId);

  const listed = await request(`/transactions?from=${currentMonthStart}&to=${currentMonthEnd}`, { headers: apiHeaders });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.data.length, 1);

  const summary = await request("/summary?status=paid", { headers: apiHeaders });
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.expenses, 42.5);
  assert.equal(summary.body.balance, 57.5);

  const monthly = await request("/charts/monthly-evolution?months=2&status=paid", { headers: apiHeaders });
  assert.equal(monthly.response.status, 200);
  assert.equal(monthly.body.data.length, 2);
  assert.equal(monthly.body.data.at(-1).expenses, 42.5);

  const breakdown = await request("/charts/category-breakdown?type=expense&status=paid", { headers: apiHeaders });
  assert.equal(breakdown.response.status, 200);
  assert.equal(breakdown.body.data[0].category, "Alimentação");

  const cashflow = await request("/charts/cashflow?status=paid", { headers: apiHeaders });
  assert.equal(cashflow.response.status, 200);
  assert.equal(cashflow.body.data.at(-1).cumulative_balance, 57.5);

  const monthlyReport = await request(`/monthly-report?month=${currentMonthKey}`, { headers: apiHeaders });
  assert.equal(monthlyReport.response.status, 200);
  assert.deepEqual(monthlyReport.body.period, { from: currentMonthStart, to: currentMonthEnd });
  assert.equal(monthlyReport.body.income, 0);
  assert.equal(monthlyReport.body.expenses, 42.5);
  assert.equal(monthlyReport.body.net, -42.5);
  assert.equal(monthlyReport.body.opening_balance, 100);
  assert.equal(monthlyReport.body.monthly_balance, 57.5);
  assert.equal(monthlyReport.body.current_balance, 57.5);
  assert.equal(monthlyReport.body.transaction_count, 1);
  assert.equal(monthlyReport.body.expenses_by_category[0].category, "Alimentação");

  const updated = await request(`/transactions/${transactionId}`, {
    method: "PATCH",
    headers: apiHeaders,
    body: JSON.stringify({ amount: 45.9, status: "pending" }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.amount, 45.9);

  const tagInUse = await request(`/tags/${tag.body.data.id}`, { method: "DELETE", headers: apiHeaders });
  assert.equal(tagInUse.response.status, 409);

  const deleted = await request(`/transactions/${transactionId}`, { method: "DELETE", headers: apiHeaders });
  assert.equal(deleted.response.status, 204);

  const deletedTag = await request(`/tags/${tag.body.data.id}`, { method: "DELETE", headers: apiHeaders });
  assert.equal(deletedTag.response.status, 204);

  const missing = await request(`/transactions/${transactionId}`, { headers: apiHeaders });
  assert.equal(missing.response.status, 404);
});
