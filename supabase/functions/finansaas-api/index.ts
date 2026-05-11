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
        summary: "Cria uma transacao",
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
        required: ["type", "description", "amount", "date", "category", "status"],
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

    if (req.method === "GET" && pathname === "/categories") {
      return handleListCategories(auth, url);
    }

    if (req.method === "POST" && pathname === "/categories") {
      return handleCreateCategory(auth, req);
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
    const userId = resolveUserIdFromApiKey(integrationKey);
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

  const { data, error } = await auth.client
    .from("transactions")
    .insert({ ...transaction, user_id: auth.userId })
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
  if (requireAll || body.category !== undefined) {
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

function resolveUserIdFromApiKey(apiKey: string): string | null {
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
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new ApiError(422, "invalid_limit", "limit deve ser um inteiro entre 1 e 100.");
  }
  return parsed;
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
