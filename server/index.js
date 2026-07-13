import cors from "cors";
import express from "express";
import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createPublicApiRouter } from "./public-api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || `${__dirname}/../data`;
const dbPath = process.env.DATABASE_PATH || `${dataDir}/finansaas.sqlite`;

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const userScopedTables = new Set([
  "api_tokens",
  "budgets",
  "categories",
  "goals",
  "profiles",
  "subscriptions",
  "tags",
  "transactions",
]);

const clientTables = new Set([
  "api_tokens",
  "budgets",
  "categories",
  "goals",
  "profiles",
  "subscriptions",
  "subscription_tags",
  "tags",
  "transactions",
  "transaction_tags",
]);

const tableColumns = new Map();

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function hashApiToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || (value && typeof value === "object")) return JSON.stringify(value);
  return value;
}

function hydrateRow(row) {
  if (!row) return row;
  const booleanFields = new Set(["is_recurring", "is_subscription", "is_active"]);
  const jsonFields = new Set(["scopes"]);

  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (booleanFields.has(key)) return [key, Boolean(value)];
    if (jsonFields.has(key) && typeof value === "string") {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, []];
      }
    }
    return [key, value];
  }));
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      full_name TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
      is_recurring INTEGER DEFAULT 0,
      recurrence_type TEXT,
      recurrence_count INTEGER DEFAULT 1,
      recurrence_group_id TEXT,
      recurrence_start_date TEXT,
      recurrence_end_date TEXT,
      original_amount REAL,
      discount_amount REAL,
      is_subscription INTEGER DEFAULT 0,
      subscription_day INTEGER,
      subscription_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT,
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS transaction_tags (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TEXT,
      UNIQUE(transaction_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(user_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      target_date TEXT,
      period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly', 'custom')),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
      charge_day INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscription_tags (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TEXT,
      UNIQUE(subscription_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_subscription_date
      ON transactions(subscription_id, date)
      WHERE subscription_id IS NOT NULL;
  `);

  for (const table of [
    "api_tokens", "budgets", "categories", "goals", "profiles", "subscriptions",
    "subscription_tags", "tags", "transactions", "transaction_tags", "users",
  ]) {
    tableColumns.set(table, new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)));
  }
}

function createDefaultCategories(userId) {
  const insert = db.prepare("INSERT INTO categories (id, user_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)");
  const defaults = [
    ["Salário", "income"], ["Freelance", "income"], ["Investimentos", "income"], ["Outros", "income"],
    ["Moradia", "expense"], ["Alimentação", "expense"], ["Transporte", "expense"], ["Saúde", "expense"],
    ["Educação", "expense"], ["Lazer", "expense"], ["Contas", "expense"], ["Outros", "expense"],
  ];
  const createdAt = now();
  for (const [name, type] of defaults) insert.run(randomUUID(), userId, name, type, createdAt);
}

function createSession(user) {
  const token = randomBytes(32).toString("hex");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, user.id, createdAt, expiresAt);

  return {
    access_token: token,
    token_type: "bearer",
    expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
    user: toPublicUser(user),
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
  };
}

function requireUser(req, res, next) {
  const apiKey = req.get("x-finansaas-api-key");
  if (apiKey) {
    const tokenHash = hashApiToken(apiKey);
    const token = db.prepare(`
      SELECT api_tokens.id as api_token_id, api_tokens.scopes, users.*
      FROM api_tokens
      JOIN users ON users.id = api_tokens.user_id
      WHERE api_tokens.token_hash = ?
        AND api_tokens.revoked_at IS NULL
    `).get(tokenHash);

    if (!token) {
      return res.status(401).json({ error: { message: "API key inválida ou revogada." } });
    }

    db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(now(), token.api_token_id);
    req.user = token;
    req.authMode = "api-key";
    req.scopes = hydrateRow(token).scopes;
    return next();
  }

  const auth = req.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: { message: "Sessão ausente." } });

  const session = db.prepare(`
    SELECT sessions.token, sessions.expires_at, users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: { message: "Sessão inválida ou expirada." } });
  }

  req.user = session;
  req.authMode = "session";
  req.scopes = ["*"];
  next();
}

function requireSession(req, res, next) {
  if (req.authMode !== "session") {
    return res.status(403).json({ error: { code: "forbidden", message: "API keys não podem usar /api/query." } });
  }
  next();
}

function parseOrder(order) {
  if (!order?.column) return null;
  const direction = order.ascending === false ? "DESC" : "ASC";
  return `${quoteIdentifier(order.column)} ${direction}`;
}

function quoteIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Identificador inválido: ${value}`);
  return `"${value}"`;
}

function buildWhere(table, filters, params, user) {
  const clauses = [];
  const columns = tableColumns.get(table);

  if (!columns) throw new Error(`Tabela inválida: ${table}`);

  if (userScopedTables.has(table) && columns.has("user_id")) {
    clauses.push('"user_id" = ?');
    params.push(user.id);
  } else if (table === "profiles") {
    clauses.push('"id" = ?');
    params.push(user.id);
  } else if (table === "transaction_tags") {
    clauses.push('EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_tags.transaction_id AND transactions.user_id = ?)');
    params.push(user.id);
  } else if (table === "subscription_tags") {
    clauses.push('EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.id = subscription_tags.subscription_id AND subscriptions.user_id = ?)');
    params.push(user.id);
  }

  for (const filter of filters || []) {
    if (!columns.has(filter.column)) continue;
    const column = quoteIdentifier(filter.column);

    if (filter.op === "eq") {
      clauses.push(`${column} = ?`);
      params.push(normalizeValue(filter.value));
    } else if (filter.op === "neq") {
      clauses.push(`${column} != ?`);
      params.push(normalizeValue(filter.value));
    } else if (["gte", "lte", "gt", "lt"].includes(filter.op)) {
      const operator = { gte: ">=", lte: "<=", gt: ">", lt: "<" }[filter.op];
      clauses.push(`${column} ${operator} ?`);
      params.push(normalizeValue(filter.value));
    } else if (filter.op === "in" && Array.isArray(filter.value)) {
      if (filter.value.length === 0) {
        clauses.push("1 = 0");
      } else {
        clauses.push(`${column} IN (${filter.value.map(() => "?").join(", ")})`);
        params.push(...filter.value.map(normalizeValue));
      }
    }
  }

  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function pickWritable(table, item, mode) {
  const columns = tableColumns.get(table);
  const row = {};

  for (const [key, value] of Object.entries(item || {})) {
    if (columns.has(key)) row[key] = normalizeValue(value);
  }

  if (mode === "insert") {
    if (columns.has("id") && !row.id) row.id = randomUUID();
    if (columns.has("created_at") && !row.created_at) row.created_at = now();
    if (columns.has("updated_at") && !row.updated_at) row.updated_at = now();
    if (table === "subscriptions" && columns.has("start_date") && !row.start_date) {
      row.start_date = new Date().toISOString().slice(0, 10);
    }
  }

  if (mode === "update" && columns.has("updated_at")) row.updated_at = now();

  return row;
}

function assertOwnedRelation(table, row, user) {
  if (table === "transaction_tags") {
    const transaction = db.prepare("SELECT 1 FROM transactions WHERE id = ? AND user_id = ?").get(row.transaction_id, user.id);
    const tag = db.prepare("SELECT 1 FROM tags WHERE id = ? AND user_id = ?").get(row.tag_id, user.id);
    if (!transaction || !tag) throw new Error("Transação ou tag inválida para este usuário.");
  }

  if (table === "subscription_tags") {
    const subscription = db.prepare("SELECT 1 FROM subscriptions WHERE id = ? AND user_id = ?").get(row.subscription_id, user.id);
    const tag = db.prepare("SELECT 1 FROM tags WHERE id = ? AND user_id = ?").get(row.tag_id, user.id);
    if (!subscription || !tag) throw new Error("Assinatura ou tag inválida para este usuário.");
  }
}

function insertRows(table, values, options = {}, user) {
  const rows = Array.isArray(values) ? values : [values];
  const inserted = [];
  const columns = tableColumns.get(table);

  const transaction = db.transaction(() => {
    for (const value of rows) {
      const row = pickWritable(table, value, "insert");
      if (columns.has("user_id")) row.user_id = user.id;
      if (table === "profiles") row.id = user.id;
      assertOwnedRelation(table, row, user);
      const keys = Object.keys(row).filter((key) => columns.has(key));
      const placeholders = keys.map(() => "?").join(", ");
      const conflict = options.ignoreDuplicates ? " OR IGNORE" : "";
      const stmt = db.prepare(`INSERT${conflict} INTO ${quoteIdentifier(table)} (${keys.map(quoteIdentifier).join(", ")}) VALUES (${placeholders})`);
      const result = stmt.run(keys.map((key) => row[key]));
      if (result.changes > 0) inserted.push(hydrateRow(db.prepare(`SELECT * FROM ${quoteIdentifier(table)} WHERE id = ?`).get(row.id)));
    }
  });

  transaction();
  return inserted;
}

function updateRows(table, values, filters, user) {
  const params = [];
  const row = pickWritable(table, values, "update");
  delete row.id;
  delete row.user_id;

  const keys = Object.keys(row);
  if (keys.length === 0) return [];

  const setSql = keys.map((key) => `${quoteIdentifier(key)} = ?`).join(", ");
  const setParams = keys.map((key) => row[key]);
  const where = buildWhere(table, filters, params, user);
  db.prepare(`UPDATE ${quoteIdentifier(table)} SET ${setSql}${where}`).run([...setParams, ...params]);

  return selectRows(table, { filters, orders: [] }, user);
}

function deleteRows(table, filters, user) {
  const rows = selectRows(table, { filters, orders: [] }, user);
  const params = [];
  const where = buildWhere(table, filters, params, user);
  db.prepare(`DELETE FROM ${quoteIdentifier(table)}${where}`).run(params);
  return rows;
}

function selectRows(table, query, user) {
  const params = [];
  const where = buildWhere(table, query.filters, params, user);
  const orderItems = (query.orders || []).map(parseOrder).filter(Boolean);
  const orders = orderItems.length ? ` ORDER BY ${orderItems.join(", ")}` : "";
  const limit = query.limit ? ` LIMIT ${Number(query.limit)}` : "";
  const rows = db.prepare(`SELECT * FROM ${quoteIdentifier(table)}${where}${orders}${limit}`).all(params).map(hydrateRow);
  return withRelations(table, rows, query.select || "");
}

function withRelations(table, rows, select) {
  if (!rows.length) return rows;

  if (table === "transactions" && select.includes("transaction_tags")) {
    const getTags = db.prepare(`
      SELECT transaction_tags.*, tags.id as tag_id_value, tags.name, tags.color
      FROM transaction_tags
      JOIN tags ON tags.id = transaction_tags.tag_id
      WHERE transaction_tags.transaction_id = ?
    `);
    return rows.map((row) => ({
      ...row,
      transaction_tags: getTags.all(row.id).map((tag) => ({
        id: tag.id,
        transaction_id: tag.transaction_id,
        tag_id: tag.tag_id,
        created_at: tag.created_at,
        tag: { id: tag.tag_id_value, name: tag.name, color: tag.color },
      })),
    }));
  }

  if (table === "subscriptions" && select.includes("subscription_tags")) {
    const getTags = db.prepare(`
      SELECT subscription_tags.*, tags.id as tag_id_value, tags.name, tags.color
      FROM subscription_tags
      JOIN tags ON tags.id = subscription_tags.tag_id
      WHERE subscription_tags.subscription_id = ?
    `);
    return rows.map((row) => ({
      ...row,
      subscription_tags: getTags.all(row.id).map((tag) => ({
        id: tag.id,
        subscription_id: tag.subscription_id,
        tag_id: tag.tag_id,
        created_at: tag.created_at,
        tag: { id: tag.tag_id_value, name: tag.name, color: tag.color },
      })),
    }));
  }

  if (table === "budgets" && select.includes("categories")) {
    const getCategory = db.prepare("SELECT id, name FROM categories WHERE id = ?");
    return rows.map((row) => ({ ...row, categories: getCategory.get(row.category_id) }));
  }

  return rows;
}

initSchema();

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", createPublicApiRouter({ db, requireUser, now, randomUUID, hydrateRow }));

app.post("/api/auth/signup", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) return res.status(400).json({ error: { message: "Informe email e senha." } });
  if (password.length < 6) return res.status(400).json({ error: { message: "A senha deve ter pelo menos 6 caracteres." } });

  try {
    const createdAt = now();
    const user = { id: randomUUID(), email, password_hash: hashPassword(password), created_at: createdAt };
    const tx = db.transaction(() => {
      db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(user.id, user.email, user.password_hash, user.created_at);
      db.prepare("INSERT INTO profiles (id, email, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.id, user.email, user.email, createdAt, createdAt);
      createDefaultCategories(user.id);
    });
    tx();
    res.json({ session: createSession(user), user: toPublicUser(user) });
  } catch (error) {
    const message = String(error.message || error);
    res.status(message.includes("UNIQUE") ? 409 : 500).json({ error: { message: message.includes("UNIQUE") ? "Email já cadastrado." : message } });
  }
});

app.post("/api/auth/signin", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: { message: "Email ou senha inválidos." } });
  }

  res.json({ session: createSession(user), user: toPublicUser(user) });
});

app.get("/api/auth/session", requireUser, requireSession, (req, res) => {
  res.json({ session: createSession(req.user), user: toPublicUser(req.user) });
});

app.post("/api/auth/signout", requireUser, requireSession, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(req.get("authorization").replace(/^Bearer\s+/i, ""));
  res.json({ ok: true });
});

app.post("/api/query", requireUser, requireSession, (req, res) => {
  try {
    const { table, action, values, filters = [], orders = [], select = "", single = false, maybeSingle = false, limit, options = {} } = req.body;
    if (!clientTables.has(table)) return res.status(400).json({ error: { message: `Tabela inválida: ${table}` } });

    let data;
    if (action === "select") data = selectRows(table, { filters, orders, select, limit }, req.user);
    else if (action === "insert") data = withRelations(table, insertRows(table, values, options, req.user), select);
    else if (action === "update") data = updateRows(table, values, filters, req.user);
    else if (action === "delete") data = deleteRows(table, filters, req.user);
    else return res.status(400).json({ error: { message: `Ação inválida: ${action}` } });

    if (single || maybeSingle) data = data[0] || null;
    res.json({ data });
  } catch (error) {
    const message = String(error.message || error);
    res.status(message.includes("UNIQUE") ? 409 : 500).json({ error: { message } });
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Rota não encontrada." } });
});

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: { code: "invalid_json", message: "O corpo JSON é inválido." } });
  }
  next(error);
});

const staticDir = process.env.SERVE_STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(resolve(staticDir, "index.html"));
  });
}

const port = Number(process.env.PORT || 3001);

export function startServer(listenPort = port) {
  return app.listen(listenPort, "0.0.0.0", () => {
    console.log(`FinanSaaS API listening on ${listenPort}`);
  });
}

export { app, db };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
