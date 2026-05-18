import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

type AuthContext = {
  userId: string;
  client: SupabaseClient;
  mode: "jwt" | "api-key";
};

type TransactionPayload = {
  type?: "income" | "expense";
  description?: string;
  amount?: number;
  date?: string;
  category?: string;
  status?: "paid" | "pending";
  is_recurring?: boolean;
  recurrence_type?: "monthly" | "yearly";
  recurrence_count?: number;
  tag_ids?: string[];
};

type QueryBuilder = {
  gte: (column: string, value: string) => QueryBuilder;
  lte: (column: string, value: string) => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
};

type TransactionRow = Record<string, unknown> & {
  transaction_tags?: Array<{ tag?: unknown }>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-finansaas-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "FinansaaS Agent API",
    version: "1.0.0",
    description: "API para agentes de IA consultarem e alimentarem dados financeiros do FinansaaS.",
  },
  servers: [{ url: "/functions/v1/finansaas-api" }],
  security: [{ bearerAuth: [] }, { integrationKey: [] }],
  tags: [
    { name: "Sistema" },
    { name: "Transacoes" },
    { name: "Categorias" },
    { name: "Tags" },
    { name: "Resumo" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Verifica disponibilidade da API",
        security: [],
        responses: { "200": { description: "API operacional" } },
      },
    },
    "/summary": {
      get: {
        tags: ["Resumo"],
        summary: "Retorna saldo e totais por periodo",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } },
        ],
        responses: { "200": { description: "Resumo financeiro" }, "401": { description: "Nao autenticado" } },
      },
    },
    "/charts/monthly-evolution": {
      get: {
        tags: ["Resumo"],
        summary: "Dados de evolucao mensal para graficos",
        parameters: [
          { name: "months", in: "query", schema: { type: "integer", minimum: 1, maximum: 36, default: 6 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } },
        ],
        responses: { "200": { description: "Series mensais de receitas, despesas e saldo" } },
      },
    },
    "/charts/category-breakdown": {
      get: {
        tags: ["Resumo"],
        summary: "Distribuicao por categoria",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["income", "expense"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } },
        ],
        responses: { "200": { description: "Totais agrupados por categoria" } },
      },
    },
    "/charts/cashflow": {
      get: {
        tags: ["Resumo"],
        summary: "Fluxo de caixa acumulado por dia",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } },
        ],
        responses: { "200": { description: "Serie diaria de saldo acumulado" } },
      },
    },
    "/agent/categorize": {
      post: {
        tags: ["Transacoes"],
        summary: "Sugere categoria para um lancamento",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["description", "type"],
                properties: {
                  description: { type: "string", example: "Uber para reuniao" },
                  type: { type: "string", enum: ["income", "expense"] },
                  amount: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Categoria sugerida" } },
      },
    },
    "/categories": {
      get: {
        tags: ["Categorias"],
        summary: "Lista categorias do usuario",
        parameters: [{ name: "type", in: "query", schema: { type: "string", enum: ["income", "expense"] } }],
        responses: { "200": { description: "Lista de categorias" } },
      },
      post: {
        tags: ["Categorias"],
        summary: "Cria uma categoria",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "type"],
                properties: {
                  name: { type: "string", example: "Mercado" },
                  type: { type: "string", enum: ["income", "expense"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Categoria criada" }, "422": { description: "Dados invalidos" } },
      },
    },
    "/tags": {
      get: {
        tags: ["Tags"],
        summary: "Lista tags do usuario",
        responses: { "200": { description: "Lista de tags" } },
      },
      post: {
        tags: ["Tags"],
        summary: "Cria uma tag",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagInput" },
              examples: {
                default: { value: { name: "trabalho", color: "#2563eb" } },
              },
            },
          },
        },
        responses: { "201": { description: "Tag criada" }, "422": { description: "Dados invalidos" } },
      },
    },
    "/tags/{id}": {
      patch: {
        tags: ["Tags"],
        summary: "Atualiza uma tag",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TagInput" } } },
        },
        responses: { "200": { description: "Tag atualizada" }, "404": { description: "Nao encontrada" } },
      },
      delete: {
        tags: ["Tags"],
        summary: "Remove uma tag sem transacoes associadas",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "204": { description: "Tag removida" },
          "404": { description: "Nao encontrada" },
          "409": { description: "Tag possui transacoes associadas" },
        },
      },
    },
    "/transactions": {
      get: {
        tags: ["Transacoes"],
        summary: "Lista transacoes",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["income", "expense"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "pending"] } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        ],
        responses: { "200": { description: "Lista de transacoes" } },
      },
      post: {
        tags: ["Transacoes"],
        summary: "Cria uma transacao. Se category nao for enviada, a API tenta categorizar automaticamente.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TransactionInput" },
              examples: {
                expense: {
                  value: {
                    type: "expense",
                    description: "Almoco",
                    amount: 42.5,
                    date: "2026-05-07",
                    category: "Alimentacao",
                    status: "paid",
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Transacao criada" }, "422": { description: "Dados invalidos" } },
      },
    },
    "/transactions/{id}": {
      get: {
        tags: ["Transacoes"],
        summary: "Busca uma transacao",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Transacao encontrada" }, "404": { description: "Nao encontrada" } },
      },
      patch: {
        tags: ["Transacoes"],
        summary: "Atualiza uma transacao",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionInput" } } },
        },
        responses: { "200": { description: "Transacao atualizada" }, "404": { description: "Nao encontrada" } },
      },
      delete: {
        tags: ["Transacoes"],
        summary: "Remove uma transacao",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "204": { description: "Transacao removida" }, "404": { description: "Nao encontrada" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
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
          category: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["paid", "pending"] },
          is_recurring: { type: "boolean" },
          recurrence_type: { type: "string", enum: ["monthly", "yearly"] },
          recurrence_count: { type: "integer", minimum: 1, maximum: 120 },
          tag_ids: { type: "array", items: { type: "string", format: "uuid" } },
        },
      },
      TagInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, example: "trabalho" },
          color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", example: "#2563eb" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = normalizePath(url.pathname);

  try {
    if (req.method === "GET" && pathname === "/health") {
      return json({ status: "ok", service: "finansaas-api" });
    }

    if (req.method === "GET" && pathname === "/openapi.json") {
      return json(openApiSpec);
    }

    if (req.method === "GET" && (pathname === "/docs" || pathname === "/")) {
      return html(swaggerHtml());
    }

    const auth = await authenticate(req);

    if (req.method === "GET" && pathname === "/summary") {
      return handleSummary(auth, url);
    }

    if (req.method === "GET" && pathname === "/charts/monthly-evolution") {
      return handleMonthlyEvolution(auth, url);
    }

    if (req.method === "GET" && pathname === "/charts/category-breakdown") {
      return handleCategoryBreakdown(auth, url);
    }

    if (req.method === "GET" && pathname === "/charts/cashflow") {
      return handleCashflow(auth, url);
    }

    if (req.method === "POST" && pathname === "/agent/categorize") {
      return handleCategorize(auth, req);
    }

    if (req.method === "GET" && pathname === "/categories") {
      return handleListCategories(auth, url);
    }

    if (req.method === "POST" && pathname === "/categories") {
      return handleCreateCategory(auth, req);
    }

    if (req.method === "GET" && pathname === "/tags") {
      return handleListTags(auth);
    }

    if (req.method === "POST" && pathname === "/tags") {
      return handleCreateTag(auth, req);
    }

    const tagMatch = pathname.match(/^\/tags\/([0-9a-f-]{36})$/i);
    if (tagMatch) {
      const id = tagMatch[1];
      if (req.method === "PATCH") return handleUpdateTag(auth, req, id);
      if (req.method === "DELETE") return handleDeleteTag(auth, id);
    }

    if (req.method === "GET" && pathname === "/transactions") {
      return handleListTransactions(auth, url);
    }

    if (req.method === "POST" && pathname === "/transactions") {
      return handleCreateTransaction(auth, req);
    }

    const transactionMatch = pathname.match(/^\/transactions\/([0-9a-f-]{36})$/i);
    if (transactionMatch) {
      const id = transactionMatch[1];
      if (req.method === "GET") return handleGetTransaction(auth, id);
      if (req.method === "PATCH") return handleUpdateTransaction(auth, req, id);
      if (req.method === "DELETE") return handleDeleteTransaction(auth, id);
    }

    return errorResponse(404, "not_found", "Rota nao encontrada.");
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.status, error.code, error.message, error.details);
    }

    console.error(error);
    return errorResponse(500, "internal_error", "Erro interno da API.");
  }
});

async function authenticate(req: Request): Promise<AuthContext> {
  const integrationKey = req.headers.get("x-finansaas-api-key") ?? getBearerToken(req);

  if (integrationKey) {
    const tokenAuth = await resolveUserIdFromStoredApiKey(integrationKey);
    if (tokenAuth) {
      return tokenAuth;
    }

    const userId = resolveUserIdFromEnvApiKey(integrationKey);
    if (userId) {
      ensureServiceRoleConfigured();
      return {
        userId,
        mode: "api-key",
        client: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      };
    }
  }

  const token = getBearerToken(req);
  if (!token) {
    throw new ApiError(401, "unauthorized", "Informe Authorization: Bearer <jwt> ou X-Finansaas-Api-Key.");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "unauthorized", "Token invalido ou expirado.");
  }

  return { userId: data.user.id, client, mode: "jwt" };
}

async function resolveUserIdFromStoredApiKey(apiKey: string): Promise<AuthContext | null> {
  ensureServiceRoleConfigured();
  const client = serviceClient();
  const tokenHash = await hashToken(apiKey);

  const { data, error } = await client
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) return null;

  await client
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    userId: data.user_id,
    mode: "api-key",
    client,
  };
}

async function handleSummary(auth: AuthContext, url: URL): Promise<Response> {
  let query = auth.client
    .from("transactions")
    .select("type, amount, status, date, category")
    .eq("user_id", auth.userId);

  query = applyTransactionFilters(query, url);

  const { data, error } = await query;
  if (error) throw dbError(error);

  const transactions = data ?? [];
  const income = sum(transactions.filter((item) => item.type === "income").map((item) => Number(item.amount)));
  const expenses = sum(transactions.filter((item) => item.type === "expense").map((item) => Number(item.amount)));
  const pending = sum(transactions.filter((item) => item.status === "pending").map((item) => Number(item.amount)));

  const byCategory = transactions.reduce<Record<string, { income: number; expense: number }>>((acc, item) => {
    const category = item.category || "Sem categoria";
    acc[category] ??= { income: 0, expense: 0 };
    acc[category][item.type as "income" | "expense"] += Number(item.amount);
    return acc;
  }, {});

  return json({
    income,
    expenses,
    balance: income - expenses,
    pending,
    count: transactions.length,
    by_category: byCategory,
  });
}

async function handleMonthlyEvolution(auth: AuthContext, url: URL): Promise<Response> {
  const months = parseBoundedInteger(url.searchParams.get("months"), "months", 1, 36, 6);
  const monthKeys = lastMonthKeys(months);
  const from = `${monthKeys[0]}-01`;

  let query = auth.client
    .from("transactions")
    .select("type, amount, status, date")
    .eq("user_id", auth.userId)
    .gte("date", from);

  const status = url.searchParams.get("status");
  if (status) query = query.eq("status", assertEnum(status, ["paid", "pending"], "status"));

  const { data, error } = await query;
  if (error) throw dbError(error);

  const series = monthKeys.map((month) => ({
    month,
    income: 0,
    expenses: 0,
    balance: 0,
    count: 0,
  }));
  const byMonth = new Map(series.map((item) => [item.month, item]));

  for (const transaction of data ?? []) {
    const month = String(transaction.date).slice(0, 7);
    const item = byMonth.get(month);
    if (!item) continue;

    const amount = Number(transaction.amount);
    if (transaction.type === "income") item.income += amount;
    if (transaction.type === "expense") item.expenses += amount;
    item.balance = Number((item.income - item.expenses).toFixed(2));
    item.count += 1;
  }

  return json({ data: series });
}

async function handleCategoryBreakdown(auth: AuthContext, url: URL): Promise<Response> {
  let query = auth.client
    .from("transactions")
    .select("type, amount, status, date, category")
    .eq("user_id", auth.userId);

  query = applyTransactionFilters(query, url);

  const { data, error } = await query;
  if (error) throw dbError(error);

  const totals = new Map<string, { category: string; income: number; expenses: number; total: number; count: number }>();

  for (const transaction of data ?? []) {
    const category = transaction.category || "Sem categoria";
    const current = totals.get(category) ?? { category, income: 0, expenses: 0, total: 0, count: 0 };
    const amount = Number(transaction.amount);

    if (transaction.type === "income") current.income += amount;
    if (transaction.type === "expense") current.expenses += amount;
    current.total += amount;
    current.count += 1;
    totals.set(category, current);
  }

  const totalAmount = Array.from(totals.values()).reduce((total, item) => total + item.total, 0);
  const breakdown = Array.from(totals.values())
    .map((item) => ({
      ...item,
      income: Number(item.income.toFixed(2)),
      expenses: Number(item.expenses.toFixed(2)),
      total: Number(item.total.toFixed(2)),
      percentage: totalAmount > 0 ? Number(((item.total / totalAmount) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return json({ data: breakdown });
}

async function handleCashflow(auth: AuthContext, url: URL): Promise<Response> {
  let query = auth.client
    .from("transactions")
    .select("type, amount, status, date")
    .eq("user_id", auth.userId)
    .order("date", { ascending: true });

  query = applyTransactionFilters(query, url);

  const { data, error } = await query;
  if (error) throw dbError(error);

  const totals = new Map<string, { date: string; income: number; expenses: number; balance: number }>();

  for (const transaction of data ?? []) {
    const date = transaction.date;
    const current = totals.get(date) ?? { date, income: 0, expenses: 0, balance: 0 };
    const amount = Number(transaction.amount);

    if (transaction.type === "income") current.income += amount;
    if (transaction.type === "expense") current.expenses += amount;
    current.balance = Number((current.income - current.expenses).toFixed(2));
    totals.set(date, current);
  }

  let cumulative = 0;
  const series = Array.from(totals.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      cumulative += item.balance;
      return {
        ...item,
        income: Number(item.income.toFixed(2)),
        expenses: Number(item.expenses.toFixed(2)),
        balance: Number(item.balance.toFixed(2)),
        cumulative_balance: Number(cumulative.toFixed(2)),
      };
    });

  return json({ data: series });
}

async function handleCategorize(auth: AuthContext, req: Request): Promise<Response> {
  const body = await readJson(req);
  const description = requireString(body.description, "description");
  const type = assertEnum(body.type, ["income", "expense"], "type");
  const suggestion = await suggestCategory(auth, { description, type });

  return json({ data: suggestion });
}

async function handleListCategories(auth: AuthContext, url: URL): Promise<Response> {
  let query = auth.client
    .from("categories")
    .select("id, name, type, created_at")
    .eq("user_id", auth.userId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const type = url.searchParams.get("type");
  if (type) {
    assertEnum(type, ["income", "expense"], "type");
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw dbError(error);

  return json({ data: data ?? [] });
}

async function handleCreateCategory(auth: AuthContext, req: Request): Promise<Response> {
  const body = await readJson(req);
  const name = requireString(body.name, "name");
  const type = assertEnum(body.type, ["income", "expense"], "type");

  const { data, error } = await auth.client
    .from("categories")
    .insert({ name, type, user_id: auth.userId })
    .select("id, name, type, created_at")
    .single();

  if (error) throw dbError(error);
  return json({ data }, 201);
}

async function handleListTags(auth: AuthContext): Promise<Response> {
  const { data, error } = await auth.client
    .from("tags")
    .select("id, name, color, created_at")
    .eq("user_id", auth.userId)
    .order("name", { ascending: true });

  if (error) throw dbError(error);
  return json({ data: data ?? [] });
}

async function handleCreateTag(auth: AuthContext, req: Request): Promise<Response> {
  const body = await readJson(req);
  const name = requireString(body.name, "name");
  const color = body.color === undefined ? "#3b82f6" : requireHexColor(body.color, "color");

  const { data, error } = await auth.client
    .from("tags")
    .insert({ name, color, user_id: auth.userId })
    .select("id, name, color, created_at")
    .single();

  if (error) throw dbError(error);
  return json({ data }, 201);
}

async function handleUpdateTag(auth: AuthContext, req: Request, id: string): Promise<Response> {
  const body = await readJson(req);
  const updates: { name?: string; color?: string } = {};

  if (body.name !== undefined) updates.name = requireString(body.name, "name");
  if (body.color !== undefined) updates.color = requireHexColor(body.color, "color");
  if (Object.keys(updates).length === 0) {
    throw new ApiError(422, "invalid_field", "Informe name ou color para atualizar a tag.");
  }

  const { data, error } = await auth.client
    .from("tags")
    .update(updates)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id, name, color, created_at")
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, "not_found", "Tag nao encontrada.");

  return json({ data });
}

async function handleDeleteTag(auth: AuthContext, id: string): Promise<Response> {
  const { data: tag, error: tagError } = await auth.client
    .from("tags")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (tagError) throw dbError(tagError);
  if (!tag) throw new ApiError(404, "not_found", "Tag nao encontrada.");

  const { data: links, error: linksError } = await auth.client
    .from("transaction_tags")
    .select("id")
    .eq("tag_id", id)
    .limit(1);

  if (linksError) throw dbError(linksError);
  if (links && links.length > 0) {
    throw new ApiError(409, "tag_in_use", "Remova esta tag das transacoes antes de exclui-la.");
  }

  const { error } = await auth.client
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) throw dbError(error);
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handleListTransactions(auth: AuthContext, url: URL): Promise<Response> {
  const limit = parseLimit(url.searchParams.get("limit"));
  let query = auth.client
    .from("transactions")
    .select(`
      *,
      transaction_tags (
        tag:tags (
          id,
          name,
          color
        )
      )
    `)
    .eq("user_id", auth.userId)
    .order("date", { ascending: false })
    .limit(limit);

  query = applyTransactionFilters(query, url);

  const { data, error } = await query;
  if (error) throw dbError(error);

  return json({ data: normalizeTransactions(data ?? []) });
}

async function handleGetTransaction(auth: AuthContext, id: string): Promise<Response> {
  const { data, error } = await auth.client
    .from("transactions")
    .select(`
      *,
      transaction_tags (
        tag:tags (
          id,
          name,
          color
        )
      )
    `)
    .eq("user_id", auth.userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, "not_found", "Transacao nao encontrada.");

  return json({ data: normalizeTransaction(data) });
}

async function handleCreateTransaction(auth: AuthContext, req: Request): Promise<Response> {
  const payload = validateTransactionPayload(await readJson(req), true);
  const { tag_ids, ...transaction } = payload;
  const category = transaction.category ?? (await suggestCategory(auth, {
    description: transaction.description ?? "",
    type: transaction.type ?? "expense",
  })).category;

  const { data, error } = await auth.client
    .from("transactions")
    .insert({ ...transaction, category, user_id: auth.userId })
    .select()
    .single();

  if (error) throw dbError(error);

  if (tag_ids?.length) {
    await replaceTransactionTags(auth, data.id, tag_ids);
  }

  return json({ data: await fetchTransaction(auth, data.id) }, 201);
}

async function handleUpdateTransaction(auth: AuthContext, req: Request, id: string): Promise<Response> {
  const payload = validateTransactionPayload(await readJson(req), false);
  const { tag_ids, ...updates } = payload;

  if (Object.keys(updates).length > 0) {
    const { data, error } = await auth.client
      .from("transactions")
      .update(updates)
      .eq("user_id", auth.userId)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw dbError(error);
    if (!data) throw new ApiError(404, "not_found", "Transacao nao encontrada.");
  }

  if (tag_ids) {
    await replaceTransactionTags(auth, id, tag_ids);
  }

  return json({ data: await fetchTransaction(auth, id) });
}

async function handleDeleteTransaction(auth: AuthContext, id: string): Promise<Response> {
  const { data, error } = await auth.client
    .from("transactions")
    .delete()
    .eq("user_id", auth.userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, "not_found", "Transacao nao encontrada.");

  return new Response(null, { status: 204, headers: corsHeaders });
}

async function fetchTransaction(auth: AuthContext, id: string) {
  const { data, error } = await auth.client
    .from("transactions")
    .select(`
      *,
      transaction_tags (
        tag:tags (
          id,
          name,
          color
        )
      )
    `)
    .eq("user_id", auth.userId)
    .eq("id", id)
    .single();

  if (error) throw dbError(error);
  return normalizeTransaction(data);
}

async function replaceTransactionTags(auth: AuthContext, transactionId: string, tagIds: string[]) {
  const uniqueTagIds = [...new Set(tagIds)];

  const { data: transaction, error: transactionError } = await auth.client
    .from("transactions")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("id", transactionId)
    .maybeSingle();

  if (transactionError) throw dbError(transactionError);
  if (!transaction) throw new ApiError(404, "not_found", "Transacao nao encontrada.");

  if (uniqueTagIds.length > 0) {
    const { data: ownedTags, error: tagError } = await auth.client
      .from("tags")
      .select("id")
      .eq("user_id", auth.userId)
      .in("id", uniqueTagIds);

    if (tagError) throw dbError(tagError);
    if ((ownedTags ?? []).length !== uniqueTagIds.length) {
      throw new ApiError(422, "invalid_tags", "Uma ou mais tags nao pertencem ao usuario autenticado.");
    }
  }

  const { error: deleteError } = await auth.client
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", transactionId);

  if (deleteError) throw dbError(deleteError);

  if (uniqueTagIds.length === 0) return;

  const { error: insertError } = await auth.client
    .from("transaction_tags")
    .insert(uniqueTagIds.map((tagId) => ({ transaction_id: transactionId, tag_id: tagId })));

  if (insertError) throw dbError(insertError);
}

function validateTransactionPayload(body: Record<string, unknown>, requireAll: boolean): TransactionPayload {
  const payload: TransactionPayload = {};

  if (requireAll || body.type !== undefined) {
    payload.type = assertEnum(body.type, ["income", "expense"], "type");
  }
  if (requireAll || body.description !== undefined) {
    payload.description = requireString(body.description, "description");
  }
  if (requireAll || body.amount !== undefined) {
    payload.amount = requirePositiveNumber(body.amount, "amount");
  }
  if (requireAll || body.date !== undefined) {
    payload.date = requireDate(body.date, "date");
  }
  if (body.category !== undefined) {
    payload.category = requireString(body.category, "category");
  }
  if (requireAll || body.status !== undefined) {
    payload.status = assertEnum(body.status, ["paid", "pending"], "status");
  }
  if (body.is_recurring !== undefined) {
    payload.is_recurring = requireBoolean(body.is_recurring, "is_recurring");
  }
  if (body.recurrence_type !== undefined) {
    payload.recurrence_type = assertEnum(body.recurrence_type, ["monthly", "yearly"], "recurrence_type");
  }
  if (body.recurrence_count !== undefined) {
    payload.recurrence_count = requireInteger(body.recurrence_count, "recurrence_count", 1, 120);
  }
  if (body.tag_ids !== undefined) {
    payload.tag_ids = requireStringArray(body.tag_ids, "tag_ids");
  }

  return payload;
}

function applyTransactionFilters<T extends QueryBuilder>(query: T, url: URL): T {
  let filteredQuery = query;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  if (from) filteredQuery = filteredQuery.gte("date", requireDate(from, "from")) as T;
  if (to) filteredQuery = filteredQuery.lte("date", requireDate(to, "to")) as T;
  if (type) filteredQuery = filteredQuery.eq("type", assertEnum(type, ["income", "expense"], "type")) as T;
  if (status) filteredQuery = filteredQuery.eq("status", assertEnum(status, ["paid", "pending"], "status")) as T;
  if (category) filteredQuery = filteredQuery.eq("category", category) as T;

  return filteredQuery;
}

async function suggestCategory(auth: AuthContext, input: { description: string; type: "income" | "expense" }) {
  const { data, error } = await auth.client
    .from("categories")
    .select("id, name, type")
    .eq("user_id", auth.userId)
    .eq("type", input.type)
    .order("name", { ascending: true });

  if (error) throw dbError(error);

  const categories = data ?? [];
  const normalizedDescription = normalizeText(input.description);
  const scored = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      score: categoryScore(category.name, normalizedDescription, input.type),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const fallback = scored.find((category) => normalizeText(category.name) === "outros") ?? scored[0];
  const best = scored[0] && scored[0].score > 0 ? scored[0] : fallback;

  if (!best) {
    return {
      category: input.type === "income" ? "Outros" : "Outros",
      confidence: 0,
      reason: "Nenhuma categoria cadastrada para esse tipo.",
      alternatives: [],
    };
  }

  return {
    category: best.name,
    category_id: best.id,
    confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score / 10) : 0.25,
    reason: best.score > 0 ? "Categoria sugerida por palavras-chave e nomes das categorias cadastradas." : "Categoria padrao usada por falta de correspondencia forte.",
    alternatives: scored
      .filter((category) => category.id !== best.id)
      .slice(0, 3)
      .map((category) => ({ category: category.name, category_id: category.id, score: category.score })),
  };
}

function categoryScore(categoryName: string, normalizedDescription: string, type: "income" | "expense") {
  const normalizedCategory = normalizeText(categoryName);
  let score = normalizedDescription.includes(normalizedCategory) ? 5 : 0;

  const keywords: Record<string, string[]> = {
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

  for (const [categoryKeyword, words] of Object.entries(keywords)) {
    if (!normalizedCategory.includes(categoryKeyword)) continue;
    score += words.filter((word) => normalizedDescription.includes(word)).length * 3;
  }

  if (type === "income" && normalizedDescription.match(/pix recebido|recebido|deposito|transferencia recebida/)) {
    score += normalizedCategory.includes("outros") ? 1 : 0;
  }

  return score;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveUserIdFromEnvApiKey(apiKey: string): string | null {
  const raw = Deno.env.get("FINANSAAS_API_KEYS");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const match = parsed.find((item) => item?.key === apiKey);
      return typeof match?.user_id === "string" ? match.user_id : null;
    }

    if (typeof parsed === "object" && parsed !== null && typeof parsed[apiKey] === "string") {
      return parsed[apiKey];
    }
  } catch {
    throw new ApiError(500, "invalid_api_key_config", "FINANSAAS_API_KEYS deve ser um JSON valido.");
  }

  return null;
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePath(pathname: string) {
  const marker = "/finansaas-api";
  const index = pathname.indexOf(marker);
  const path = index >= 0 ? pathname.slice(index + marker.length) : pathname;
  return path === "" ? "/" : path;
}

function normalizeTransactions(rows: TransactionRow[]) {
  return rows.map(normalizeTransaction);
}

function normalizeTransaction(row: TransactionRow) {
  const { transaction_tags, ...transaction } = row;
  return {
    ...transaction,
    tags: transaction_tags?.map((item) => item.tag).filter(Boolean) ?? [],
  };
}

function parseLimit(value: string | null) {
  return parseBoundedInteger(value, "limit", 1, 100, 50);
}

function parseBoundedInteger(value: string | null, field: string, min: number, max: number, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(422, "invalid_field", `${field} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}

function lastMonthKeys(count: number) {
  const today = new Date();
  const months: string[] = [];

  for (let index = count - 1; index >= 0; index--) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }

  return months;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("invalid");
    }
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "invalid_json", "Envie um JSON valido no corpo da requisicao.");
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(422, "invalid_field", `${field} deve ser um texto preenchido.`);
  }
  return value.trim();
}

function requirePositiveNumber(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(422, "invalid_field", `${field} deve ser um numero maior que zero.`);
  }
  return parsed;
}

function requireBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new ApiError(422, "invalid_field", `${field} deve ser booleano.`);
  }
  return value;
}

function requireInteger(value: unknown, field: string, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(422, "invalid_field", `${field} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}

function requireDate(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(422, "invalid_field", `${field} deve estar no formato YYYY-MM-DD.`);
  }
  return value;
}

function requireStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new ApiError(422, "invalid_field", `${field} deve ser uma lista de textos.`);
  }
  return value.map((item) => item.trim());
}

function requireHexColor(value: unknown, field: string) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new ApiError(422, "invalid_field", `${field} deve ser uma cor hexadecimal no formato #RRGGBB.`);
  }
  return value;
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiError(422, "invalid_field", `${field} deve ser: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function sum(values: number[]) {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(2));
}

function ensureServiceRoleConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiError(500, "missing_service_role", "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function dbError(error: { message: string; code?: string }) {
  return new ApiError(400, error.code ?? "database_error", error.message);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(body: string) {
  return new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return json({ error: { code, message, details } }, status);
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
    <script>
      window.ui = SwaggerUIBundle({
        url: "./openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
