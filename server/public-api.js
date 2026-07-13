import express from "express";

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const TRANSACTION_FIELDS = new Set([
  "type",
  "description",
  "amount",
  "date",
  "category",
  "status",
  "is_recurring",
  "recurrence_type",
  "recurrence_count",
]);

const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "FinansaaS Agent API",
    version: "1.0.0",
    description: "API para agentes consultarem e alimentarem dados financeiros do FinansaaS.",
  },
  servers: [{ url: "/api" }],
  security: [{ integrationKey: [] }],
  tags: [
    { name: "Sistema" },
    { name: "Transações" },
    { name: "Categorias" },
    { name: "Tags" },
    { name: "Resumo" },
  ],
  paths: {
    "/health": { get: { tags: ["Sistema"], security: [], summary: "Verifica disponibilidade da API", responses: { 200: { description: "API operacional" } } } },
    "/summary": { get: { tags: ["Resumo"], summary: "Saldo e totais por período", parameters: transactionPeriodParameters(), responses: { 200: { description: "Resumo financeiro" } } } },
    "/charts/monthly-evolution": { get: { tags: ["Resumo"], summary: "Evolução mensal", parameters: [
      { name: "months", in: "query", schema: { type: "integer", minimum: 1, maximum: 36, default: 6 } },
      statusParameter(),
    ], responses: { 200: { description: "Série mensal" } } } },
    "/charts/category-breakdown": { get: { tags: ["Resumo"], summary: "Distribuição por categoria", parameters: transactionPeriodParameters(true), responses: { 200: { description: "Totais por categoria" } } } },
    "/charts/cashflow": { get: { tags: ["Resumo"], summary: "Fluxo de caixa acumulado", parameters: transactionPeriodParameters(), responses: { 200: { description: "Série diária" } } } },
    "/agent/categorize": { post: { tags: ["Categorias"], summary: "Sugere uma categoria", requestBody: jsonBody("#/components/schemas/CategorizeInput"), responses: { 200: { description: "Categoria sugerida" } } } },
    "/categories": {
      get: { tags: ["Categorias"], summary: "Lista categorias", parameters: [typeParameter()], responses: { 200: { description: "Categorias" } } },
      post: { tags: ["Categorias"], summary: "Cria uma categoria", requestBody: jsonBody("#/components/schemas/CategoryInput"), responses: { 201: { description: "Categoria criada" } } },
    },
    "/tags": {
      get: { tags: ["Tags"], summary: "Lista tags", responses: { 200: { description: "Tags" } } },
      post: { tags: ["Tags"], summary: "Cria uma tag", requestBody: jsonBody("#/components/schemas/TagInput"), responses: { 201: { description: "Tag criada" } } },
    },
    "/tags/{id}": {
      patch: { tags: ["Tags"], summary: "Atualiza uma tag", parameters: [idParameter()], requestBody: jsonBody("#/components/schemas/TagPatch"), responses: { 200: { description: "Tag atualizada" } } },
      delete: { tags: ["Tags"], summary: "Exclui uma tag", parameters: [idParameter()], responses: { 204: { description: "Tag excluída" }, 409: { description: "Tag em uso" } } },
    },
    "/transactions": {
      get: { tags: ["Transações"], summary: "Lista transações", parameters: [
        ...transactionPeriodParameters(true),
        { name: "category", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
      ], responses: { 200: { description: "Transações" } } },
      post: { tags: ["Transações"], summary: "Cria uma transação", requestBody: jsonBody("#/components/schemas/TransactionInput"), responses: { 201: { description: "Transação criada" } } },
    },
    "/transactions/{id}": {
      get: { tags: ["Transações"], summary: "Busca uma transação", parameters: [idParameter()], responses: { 200: { description: "Transação" } } },
      patch: { tags: ["Transações"], summary: "Atualiza uma transação", parameters: [idParameter()], requestBody: jsonBody("#/components/schemas/TransactionPatch"), responses: { 200: { description: "Transação atualizada" } } },
      delete: { tags: ["Transações"], summary: "Exclui uma transação", parameters: [idParameter()], responses: { 204: { description: "Transação excluída" } } },
    },
  },
  components: {
    securitySchemes: {
      integrationKey: { type: "apiKey", in: "header", name: "X-Finansaas-Api-Key" },
    },
    schemas: {
      TransactionInput: {
        type: "object",
        required: ["type", "description", "amount", "date", "status"],
        properties: {
          type: { type: "string", enum: ["income", "expense"] },
          description: { type: "string", minLength: 1 },
          amount: { type: "number", exclusiveMinimum: 0 },
          date: { type: "string", format: "date" },
          category: { type: "string", minLength: 1, description: "Opcional; quando ausente, a API sugere uma categoria." },
          status: { type: "string", enum: ["paid", "pending"] },
          is_recurring: { type: "boolean" },
          recurrence_type: { type: "string", enum: ["monthly", "yearly"] },
          recurrence_count: { type: "integer", minimum: 1, maximum: 120 },
          tag_ids: { type: "array", items: { type: "string", format: "uuid" } },
        },
      },
      TransactionPatch: {
        type: "object",
        minProperties: 1,
        properties: {
          type: { type: "string", enum: ["income", "expense"] },
          description: { type: "string", minLength: 1 },
          amount: { type: "number", exclusiveMinimum: 0 },
          date: { type: "string", format: "date" },
          category: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["paid", "pending"] },
          is_recurring: { type: "boolean" },
          recurrence_type: { type: "string", enum: ["monthly", "yearly"] },
          recurrence_count: { type: "integer", minimum: 1, maximum: 120 },
          tag_ids: { type: "array", items: { type: "string", format: "uuid" } },
        },
      },
      CategoryInput: {
        type: "object",
        required: ["name", "type"],
        properties: { name: { type: "string", minLength: 1 }, type: { type: "string", enum: ["income", "expense"] } },
      },
      TagInput: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1 }, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
      },
      TagPatch: {
        type: "object",
        minProperties: 1,
        properties: { name: { type: "string", minLength: 1 }, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
      },
      CategorizeInput: {
        type: "object",
        required: ["description", "type"],
        properties: { description: { type: "string", minLength: 1 }, type: { type: "string", enum: ["income", "expense"] }, amount: { type: "number" } },
      },
    },
  },
};

function jsonBody(schemaRef, required = true) {
  return { required, content: { "application/json": { schema: { $ref: schemaRef } } } };
}

function idParameter() {
  return { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
}

function typeParameter() {
  return { name: "type", in: "query", schema: { type: "string", enum: ["income", "expense"] } };
}

function statusParameter() {
  return { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } };
}

function transactionPeriodParameters(includeType = false) {
  const parameters = [
    { name: "from", in: "query", schema: { type: "string", format: "date" } },
    { name: "to", in: "query", schema: { type: "string", format: "date" } },
    statusParameter(),
  ];
  if (includeType) parameters.push(typeParameter());
  return parameters;
}

export function createPublicApiRouter({ db, requireUser, now, randomUUID, hydrateRow }) {
  const router = express.Router();

  function route(handler) {
    return async (req, res) => {
      try {
        await handler(req, res);
      } catch (error) {
        sendError(res, error);
      }
    };
  }

  function requireScope(scope) {
    return (req, res, next) => {
      if (req.scopes?.includes("*") || req.scopes?.includes(scope)) return next();
      return sendError(res, new ApiError(403, "insufficient_scope", `A chave não possui o escopo ${scope}.`));
    };
  }

  function protectedRoute(scope, handler) {
    return [requireUser, requireScope(scope), route(handler)];
  }

  router.get("/openapi.json", (_req, res) => res.json(OPENAPI_SPEC));
  router.get("/docs", (_req, res) => res.type("html").send(swaggerHtml()));

  router.get("/summary", ...protectedRoute("charts:read", (req, res) => {
    const { where, params } = transactionFilterSql(req.user.id, req.query);
    const rows = db.prepare(`SELECT type, amount, status, date, category FROM transactions${where}`).all(params);
    const income = sum(rows.filter((row) => row.type === "income").map((row) => row.amount));
    const expenses = sum(rows.filter((row) => row.type === "expense").map((row) => row.amount));
    const pending = sum(rows.filter((row) => row.status === "pending").map((row) => row.amount));
    const byCategory = {};

    for (const row of rows) {
      const category = row.category || "Sem categoria";
      byCategory[category] ??= { income: 0, expense: 0 };
      byCategory[category][row.type] += Number(row.amount);
    }

    res.json({
      income: money(income),
      expenses: money(expenses),
      balance: money(income - expenses),
      pending: money(pending),
      count: rows.length,
      by_category: byCategory,
    });
  }));

  router.get("/charts/monthly-evolution", ...protectedRoute("charts:read", (req, res) => {
    const months = boundedInteger(req.query.months, "months", 1, 36, 6);
    const status = optionalEnum(req.query.status, ["paid", "pending"], "status");
    const monthKeys = lastMonthKeys(months);
    const params = [req.user.id, `${monthKeys[0]}-01`];
    let sql = "SELECT type, amount, status, date FROM transactions WHERE user_id = ? AND date >= ?";
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const series = monthKeys.map((month) => ({ month, income: 0, expenses: 0, balance: 0, count: 0 }));
    const byMonth = new Map(series.map((item) => [item.month, item]));

    for (const row of db.prepare(sql).all(params)) {
      const item = byMonth.get(String(row.date).slice(0, 7));
      if (!item) continue;
      if (row.type === "income") item.income += Number(row.amount);
      if (row.type === "expense") item.expenses += Number(row.amount);
      item.balance = money(item.income - item.expenses);
      item.count += 1;
    }

    res.json({ data: series.map(roundAggregate) });
  }));

  router.get("/charts/category-breakdown", ...protectedRoute("charts:read", (req, res) => {
    const { where, params } = transactionFilterSql(req.user.id, req.query);
    const totals = new Map();

    for (const row of db.prepare(`SELECT type, amount, category FROM transactions${where}`).all(params)) {
      const category = row.category || "Sem categoria";
      const current = totals.get(category) || { category, income: 0, expenses: 0, total: 0, count: 0 };
      if (row.type === "income") current.income += Number(row.amount);
      if (row.type === "expense") current.expenses += Number(row.amount);
      current.total += Number(row.amount);
      current.count += 1;
      totals.set(category, current);
    }

    const totalAmount = sum([...totals.values()].map((item) => item.total));
    const data = [...totals.values()]
      .map((item) => ({
        ...roundAggregate(item),
        percentage: totalAmount > 0 ? money((item.total / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
    res.json({ data });
  }));

  router.get("/charts/cashflow", ...protectedRoute("charts:read", (req, res) => {
    const { where, params } = transactionFilterSql(req.user.id, req.query);
    const totals = new Map();

    for (const row of db.prepare(`SELECT type, amount, date FROM transactions${where} ORDER BY date ASC`).all(params)) {
      const current = totals.get(row.date) || { date: row.date, income: 0, expenses: 0, balance: 0 };
      if (row.type === "income") current.income += Number(row.amount);
      if (row.type === "expense") current.expenses += Number(row.amount);
      current.balance = current.income - current.expenses;
      totals.set(row.date, current);
    }

    let cumulative = 0;
    const data = [...totals.values()].map((item) => {
      cumulative += item.balance;
      return { ...roundAggregate(item), cumulative_balance: money(cumulative) };
    });
    res.json({ data });
  }));

  router.post("/agent/categorize", ...protectedRoute("categories:read", (req, res) => {
    const body = requireObject(req.body);
    const description = requiredString(body.description, "description");
    const type = requiredEnum(body.type, ["income", "expense"], "type");
    res.json({ data: suggestCategory(db, req.user.id, description, type) });
  }));

  router.get("/categories", ...protectedRoute("categories:read", (req, res) => {
    const type = optionalEnum(req.query.type, ["income", "expense"], "type");
    const rows = type
      ? db.prepare("SELECT id, name, type, created_at FROM categories WHERE user_id = ? AND type = ? ORDER BY type, name").all(req.user.id, type)
      : db.prepare("SELECT id, name, type, created_at FROM categories WHERE user_id = ? ORDER BY type, name").all(req.user.id);
    res.json({ data: rows });
  }));

  router.post("/categories", ...protectedRoute("categories:write", (req, res) => {
    const body = requireObject(req.body);
    const row = {
      id: randomUUID(),
      user_id: req.user.id,
      name: requiredString(body.name, "name"),
      type: requiredEnum(body.type, ["income", "expense"], "type"),
      created_at: now(),
    };
    db.prepare("INSERT INTO categories (id, user_id, name, type, created_at) VALUES (@id, @user_id, @name, @type, @created_at)").run(row);
    res.status(201).json({ data: publicCategory(row) });
  }));

  router.get("/tags", ...protectedRoute("transactions:read", (req, res) => {
    const rows = db.prepare("SELECT id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name").all(req.user.id);
    res.json({ data: rows });
  }));

  router.post("/tags", ...protectedRoute("transactions:write", (req, res) => {
    const body = requireObject(req.body);
    const row = {
      id: randomUUID(),
      user_id: req.user.id,
      name: requiredString(body.name, "name"),
      color: body.color === undefined ? "#3b82f6" : hexColor(body.color, "color"),
      created_at: now(),
    };
    db.prepare("INSERT INTO tags (id, user_id, name, color, created_at) VALUES (@id, @user_id, @name, @color, @created_at)").run(row);
    res.status(201).json({ data: publicTag(row) });
  }));

  router.patch("/tags/:id", ...protectedRoute("transactions:write", (req, res) => {
    const body = requireObject(req.body);
    const existing = ownedTag(db, req.params.id, req.user.id);
    const name = body.name === undefined ? existing.name : requiredString(body.name, "name");
    const color = body.color === undefined ? existing.color : hexColor(body.color, "color");
    if (body.name === undefined && body.color === undefined) throw new ApiError(422, "invalid_field", "Informe name ou color.");
    db.prepare("UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?").run(name, color, existing.id, req.user.id);
    res.json({ data: publicTag({ ...existing, name, color }) });
  }));

  router.delete("/tags/:id", ...protectedRoute("transactions:write", (req, res) => {
    const tag = ownedTag(db, req.params.id, req.user.id);
    const link = db.prepare(`
      SELECT 1 FROM transaction_tags
      JOIN transactions ON transactions.id = transaction_tags.transaction_id
      WHERE transaction_tags.tag_id = ? AND transactions.user_id = ? LIMIT 1
    `).get(tag.id, req.user.id);
    if (link) throw new ApiError(409, "tag_in_use", "Remova esta tag das transações antes de excluí-la.");
    db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(tag.id, req.user.id);
    res.status(204).end();
  }));

  router.get("/transactions", ...protectedRoute("transactions:read", (req, res) => {
    const limit = boundedInteger(req.query.limit, "limit", 1, 100, 50);
    const { where, params } = transactionFilterSql(req.user.id, req.query);
    const rows = db.prepare(`SELECT * FROM transactions${where} ORDER BY date DESC LIMIT ?`).all(...params, limit);
    res.json({ data: rows.map((row) => transactionWithTags(db, hydrateRow(row))) });
  }));

  router.get("/transactions/:id", ...protectedRoute("transactions:read", (req, res) => {
    res.json({ data: ownedTransaction(db, req.params.id, req.user.id, hydrateRow) });
  }));

  router.post("/transactions", ...protectedRoute("transactions:write", (req, res) => {
    const payload = validateTransaction(req.body, true);
    const tagIds = validateTagIds(payload.tag_ids);
    delete payload.tag_ids;
    payload.category ||= suggestCategory(db, req.user.id, payload.description, payload.type).category;

    const row = {
      id: randomUUID(),
      user_id: req.user.id,
      ...payload,
      is_recurring: payload.is_recurring ? 1 : 0,
      recurrence_count: payload.recurrence_count ?? 1,
      created_at: now(),
      updated_at: now(),
    };

    const create = db.transaction(() => {
      insertTransaction(db, row);
      replaceTransactionTags(db, row.id, req.user.id, tagIds, randomUUID, now);
    });
    create();
    res.status(201).json({ data: ownedTransaction(db, row.id, req.user.id, hydrateRow) });
  }));

  router.patch("/transactions/:id", ...protectedRoute("transactions:write", (req, res) => {
    const existing = ownedTransactionRow(db, req.params.id, req.user.id);
    const payload = validateTransaction(req.body, false);
    const hasTagIds = Object.hasOwn(payload, "tag_ids");
    const tagIds = hasTagIds ? validateTagIds(payload.tag_ids) : null;
    delete payload.tag_ids;

    const update = db.transaction(() => {
      const entries = Object.entries(payload);
      if (entries.length > 0) {
        const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
        const values = entries.map(([, value]) => keyValue(value));
        db.prepare(`UPDATE transactions SET ${assignments}, updated_at = ? WHERE id = ? AND user_id = ?`)
          .run(...values, now(), existing.id, req.user.id);
      }
      if (hasTagIds) replaceTransactionTags(db, existing.id, req.user.id, tagIds, randomUUID, now);
    });
    update();
    res.json({ data: ownedTransaction(db, existing.id, req.user.id, hydrateRow) });
  }));

  router.delete("/transactions/:id", ...protectedRoute("transactions:write", (req, res) => {
    const existing = ownedTransactionRow(db, req.params.id, req.user.id);
    db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(existing.id, req.user.id);
    res.status(204).end();
  }));

  return router;
}

function transactionFilterSql(userId, query) {
  const clauses = ["user_id = ?"];
  const params = [userId];
  const from = optionalDate(query.from, "from");
  const to = optionalDate(query.to, "to");
  const type = optionalEnum(query.type, ["income", "expense"], "type");
  const status = optionalEnum(query.status, ["paid", "pending"], "status");
  const category = optionalString(query.category, "category");

  if (from) { clauses.push("date >= ?"); params.push(from); }
  if (to) { clauses.push("date <= ?"); params.push(to); }
  if (type) { clauses.push("type = ?"); params.push(type); }
  if (status) { clauses.push("status = ?"); params.push(status); }
  if (category) { clauses.push("category = ?"); params.push(category); }
  return { where: ` WHERE ${clauses.join(" AND ")}`, params };
}

function validateTransaction(body, requireAll) {
  const input = requireObject(body);
  const payload = {};
  const read = (field, parser) => {
    if (requireAll || input[field] !== undefined) payload[field] = parser(input[field], field);
  };

  read("type", (value, field) => requiredEnum(value, ["income", "expense"], field));
  read("description", requiredString);
  read("amount", positiveNumber);
  read("date", requiredDate);
  if (input.category !== undefined) payload.category = requiredString(input.category, "category");
  read("status", (value, field) => requiredEnum(value, ["paid", "pending"], field));
  if (input.is_recurring !== undefined) payload.is_recurring = requiredBoolean(input.is_recurring, "is_recurring");
  if (input.recurrence_type !== undefined) payload.recurrence_type = requiredEnum(input.recurrence_type, ["monthly", "yearly"], "recurrence_type");
  if (input.recurrence_count !== undefined) payload.recurrence_count = boundedInteger(input.recurrence_count, "recurrence_count", 1, 120);
  if (input.tag_ids !== undefined) payload.tag_ids = input.tag_ids;

  if (!requireAll && Object.keys(payload).length === 0) {
    const providedKnownField = Object.keys(input).some((key) => TRANSACTION_FIELDS.has(key) || key === "tag_ids");
    if (!providedKnownField) throw new ApiError(422, "invalid_field", "Nenhum campo válido foi informado.");
  }
  return payload;
}

function insertTransaction(db, row) {
  db.prepare(`
    INSERT INTO transactions (
      id, user_id, type, description, amount, date, category, status,
      is_recurring, recurrence_type, recurrence_count, created_at, updated_at
    ) VALUES (
      @id, @user_id, @type, @description, @amount, @date, @category, @status,
      @is_recurring, @recurrence_type, @recurrence_count, @created_at, @updated_at
    )
  `).run({ recurrence_type: null, ...row });
}

function replaceTransactionTags(db, transactionId, userId, tagIds, randomUUID, now) {
  if (tagIds === null) return;
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const owned = db.prepare(`SELECT id FROM tags WHERE user_id = ? AND id IN (${placeholders})`).all(userId, ...uniqueIds);
    if (owned.length !== uniqueIds.length) throw new ApiError(422, "invalid_tags", "Uma ou mais tags não pertencem ao usuário.");
  }

  db.prepare("DELETE FROM transaction_tags WHERE transaction_id = ?").run(transactionId);
  const insert = db.prepare("INSERT INTO transaction_tags (id, transaction_id, tag_id, created_at) VALUES (?, ?, ?, ?)");
  for (const tagId of uniqueIds) insert.run(randomUUID(), transactionId, tagId, now());
}

function transactionWithTags(db, row) {
  const tags = db.prepare(`
    SELECT tags.id, tags.name, tags.color
    FROM transaction_tags JOIN tags ON tags.id = transaction_tags.tag_id
    WHERE transaction_tags.transaction_id = ? ORDER BY tags.name
  `).all(row.id);
  return { ...row, tags };
}

function ownedTransaction(db, id, userId, hydrateRow) {
  return transactionWithTags(db, hydrateRow(ownedTransactionRow(db, id, userId)));
}

function ownedTransactionRow(db, id, userId) {
  const row = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) throw new ApiError(404, "not_found", "Transação não encontrada.");
  return row;
}

function ownedTag(db, id, userId) {
  const row = db.prepare("SELECT id, name, color, created_at FROM tags WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) throw new ApiError(404, "not_found", "Tag não encontrada.");
  return row;
}

function suggestCategory(db, userId, description, type) {
  const categories = db.prepare("SELECT id, name, type FROM categories WHERE user_id = ? AND type = ? ORDER BY name").all(userId, type);
  const normalizedDescription = normalizeText(description);
  const scored = categories
    .map((category) => ({ ...category, score: categoryScore(category.name, normalizedDescription) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const fallback = scored.find((item) => normalizeText(item.name) === "outros") || scored[0];
  const best = scored[0]?.score > 0 ? scored[0] : fallback;

  if (!best) return { category: "Outros", confidence: 0, reason: "Nenhuma categoria cadastrada.", alternatives: [] };
  return {
    category: best.name,
    category_id: best.id,
    confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score / 10) : 0.25,
    reason: best.score > 0 ? "Categoria sugerida por palavras-chave." : "Categoria padrão usada por falta de correspondência.",
    alternatives: scored.filter((item) => item.id !== best.id).slice(0, 3).map((item) => ({ category: item.name, category_id: item.id, score: item.score })),
  };
}

function categoryScore(categoryName, description) {
  const name = normalizeText(categoryName);
  let score = description.includes(name) ? 5 : 0;
  const keywords = {
    alimentacao: ["mercado", "supermercado", "restaurante", "ifood", "almoco", "jantar", "lanche", "padaria", "acai"],
    transporte: ["uber", "99", "taxi", "combustivel", "gasolina", "onibus", "metro", "estacionamento"],
    moradia: ["aluguel", "condominio", "energia", "luz", "agua", "internet", "casa", "apartamento"],
    saude: ["farmacia", "medico", "consulta", "exame", "hospital", "dentista", "remedio"],
    educacao: ["curso", "faculdade", "escola", "livro", "mentoria"],
    lazer: ["cinema", "netflix", "spotify", "bar", "show", "viagem", "hotel"],
    contas: ["boleto", "cartao", "fatura", "telefone", "seguro"],
    salario: ["salario", "pagamento", "empresa", "holerite"],
    freelance: ["freela", "freelance", "cliente", "projeto"],
    investimentos: ["dividendo", "rendimento", "investimento", "cdb", "tesouro"],
  };
  for (const [category, words] of Object.entries(keywords)) {
    if (name.includes(category)) score += words.filter((word) => description.includes(word)).length * 3;
  }
  return score;
}

function normalizeText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function lastMonthKeys(count) {
  const keys = [];
  const date = new Date();
  date.setUTCDate(1);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const item = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1));
    keys.push(`${item.getUTCFullYear()}-${String(item.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(422, "invalid_body", "Envie um objeto JSON válido.");
  return value;
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(422, "invalid_field", `${field} deve ser um texto não vazio.`);
  return value.trim();
}

function optionalString(value, field) {
  if (value === undefined) return null;
  return requiredString(value, field);
}

function requiredEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw new ApiError(422, "invalid_field", `${field} deve ser ${allowed.join(" ou ")}.`);
  return value;
}

function optionalEnum(value, allowed, field) {
  if (value === undefined) return null;
  return requiredEnum(value, allowed, field);
}

function positiveNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new ApiError(422, "invalid_field", `${field} deve ser um número positivo.`);
  return value;
}

function requiredBoolean(value, field) {
  if (typeof value !== "boolean") throw new ApiError(422, "invalid_field", `${field} deve ser booleano.`);
  return value;
}

function requiredDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(422, "invalid_field", `${field} deve usar AAAA-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(422, "invalid_field", `${field} contém uma data inválida.`);
  return value;
}

function optionalDate(value, field) {
  if (value === undefined) return null;
  return requiredDate(value, field);
}

function boundedInteger(value, field, min, max, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new ApiError(422, "invalid_field", `${field} deve ser inteiro entre ${min} e ${max}.`);
  return parsed;
}

function validateTagIds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id.trim())) throw new ApiError(422, "invalid_field", "tag_ids deve ser uma lista de UUIDs.");
  return value.map((id) => id.trim());
}

function hexColor(value, field) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new ApiError(422, "invalid_field", `${field} deve usar #RRGGBB.`);
  return value;
}

function keyValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value), 0);
}

function money(value) {
  return Number(Number(value).toFixed(2));
}

function roundAggregate(item) {
  const rounded = { ...item };
  for (const field of ["income", "expenses", "balance", "total"]) {
    if (field in rounded) rounded[field] = money(rounded[field]);
  }
  return rounded;
}

function publicCategory(row) {
  return { id: row.id, name: row.name, type: row.type, created_at: row.created_at };
}

function publicTag(row) {
  return { id: row.id, name: row.name, color: row.color, created_at: row.created_at };
}

function sendError(res, error) {
  if (res.headersSent) return;
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  }

  const message = String(error?.message || error);
  if (message.includes("UNIQUE")) return res.status(409).json({ error: { code: "conflict", message: "Já existe um registro com esses dados." } });
  if (message.includes("CHECK") || message.includes("FOREIGN KEY") || message.includes("NOT NULL")) {
    return res.status(422).json({ error: { code: "invalid_data", message: "Os dados informados são inválidos." } });
  }
  console.error(error);
  return res.status(500).json({ error: { code: "internal_error", message: "Erro interno da API." } });
}

function swaggerHtml() {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FinansaaS Agent API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui", persistAuthorization: true });</script>
  </body>
</html>`;
}
