import cors from "cors";
import express from "express";
import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createPublicApiRouter } from "./public-api.js";
import { accountConfirmationTemplate, emailConfirmationTemplate, isEmailEnabled, passwordResetTemplate, sendEmail } from "./email.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || `${__dirname}/../data`;
const dbPath = process.env.DATABASE_PATH || `${dataDir}/finansaas.sqlite`;
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || "http://localhost:8080";

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const app = express();
app.set("trust proxy", 1);

function isOriginAllowed(origin, req) {
  if (!origin) return true;

  const allowedOrigins = new Set([
    "http://localhost:8080",
    "http://localhost:8096",
    "http://127.0.0.1:8096",
  ]);

  if (process.env.APP_PUBLIC_URL) {
    try {
      allowedOrigins.add(new URL(process.env.APP_PUBLIC_URL).origin);
    } catch {
      allowedOrigins.add(process.env.APP_PUBLIC_URL);
    }
  }

  const host = req?.get ? req.get("host") : req?.headers?.host;
  if (host) {
    allowedOrigins.add(`http://${host}`);
    allowedOrigins.add(`https://${host}`);
  }

  try {
    const originUrl = new URL(origin).origin;
    if (allowedOrigins.has(originUrl) || allowedOrigins.has(origin)) {
      return true;
    }
  } catch {
    if (allowedOrigins.has(origin)) return true;
  }

  return false;
}

app.use(cors((req, callback) => {
  const origin = req.get("origin");
  const allowed = isOriginAllowed(origin, req);
  callback(null, {
    origin: allowed,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Finansaas-Api-Key"],
  });
}));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

app.use(express.json({ limit: "2mb" }));

const rateLimits = new Map();

function resetRateLimits() {
  rateLimits.clear();
}

function checkRateLimit(key, maxAttempts, windowMs) {
  const nowMs = Date.now();
  const timestamps = (rateLimits.get(key) || []).filter((ts) => nowMs - ts < windowMs);
  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.max(Math.ceil((oldest + windowMs - nowMs) / 1000), 1);
    const retryAfterMinutes = Math.max(Math.ceil(retryAfterSeconds / 60), 1);
    return {
      limited: true,
      retryAfterSeconds,
      retryAfterMinutes,
    };
  }
  timestamps.push(nowMs);
  rateLimits.set(key, timestamps);
  return { limited: false };
}

function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Informe a senha." };
  }
  if (password.length < 8) {
    return { valid: false, message: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um número." };
  }
  return { valid: true };
}

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

const DUMMY_PASSWORD_HASH = hashPassword("FinanSaaS-dummy-password-timing-mitigation");

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      email_verified_at TEXT,
      pending_email TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_type ON auth_tokens(user_id, type);
  `);

  const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  if (!userColumns.includes("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  }
  if (!userColumns.includes("pending_email")) {
    db.exec("ALTER TABLE users ADD COLUMN pending_email TEXT");
  }
  db.exec("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL");

  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all().map((column) => column.name);
  if (sessionColumns.includes("token")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_migrated (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);
    const oldSessions = db.prepare("SELECT * FROM sessions").all();
    const insertMigrated = db.prepare("INSERT OR IGNORE INTO sessions_migrated (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)");
    for (const s of oldSessions) {
      const th = s.token_hash || hashSessionToken(s.token);
      insertMigrated.run(s.id || randomUUID(), th, s.user_id, s.created_at, s.expires_at);
    }
    db.exec(`
      DROP TABLE sessions;
      ALTER TABLE sessions_migrated RENAME TO sessions;
    `);
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);");

  cleanupExpiredSessions();

  for (const table of [
    "api_tokens", "budgets", "categories", "goals", "profiles", "subscriptions",
    "subscription_tags", "tags", "transactions", "transaction_tags", "users",
  ]) {
    tableColumns.set(table, new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)));
  }
}

function cleanupExpiredSessions() {
  const currentIso = now();
  const result = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(currentIso);
  return result.changes;
}

const cleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
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
  const tokenHash = hashSessionToken(token);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const sessionId = randomUUID();

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(sessionId, tokenHash, user.id, createdAt, expiresAt);

    // Limite de 10 sessões por usuário: apague as mais antigas que excederem
    db.prepare(`
      DELETE FROM sessions
      WHERE id IN (
        SELECT id FROM sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT -1 OFFSET 10
      )
    `).run(user.id);
  });
  tx();

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
    email_verified_at: user.email_verified_at ?? null,
    pending_email: user.pending_email ?? null,
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

  const tokenHash = hashSessionToken(token);
  const session = db.prepare(`
    SELECT sessions.id as session_id, sessions.token_hash, sessions.expires_at, users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: { message: "Sessão inválida ou expirada." } });
  }

  req.user = session;
  req.sessionToken = token;
  req.sessionTokenHash = tokenHash;
  req.sessionExpiresAt = session.expires_at;
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

app.post("/api/auth/signup", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) return res.status(400).json({ error: { message: "Informe email e senha." } });

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: { message: passwordValidation.message } });
  }

  try {
    const createdAt = now();
    const emailEnabled = isEmailEnabled();
    const emailVerifiedAt = emailEnabled ? null : createdAt;
    const user = {
      id: randomUUID(),
      email,
      password_hash: hashPassword(password),
      created_at: createdAt,
      email_verified_at: emailVerifiedAt,
      pending_email: null,
    };

    if (emailEnabled) {
      const rawConfirmToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawConfirmToken).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const tokenId = randomUUID();

      const tx = db.transaction(() => {
        db.prepare("INSERT INTO users (id, email, password_hash, created_at, email_verified_at, pending_email) VALUES (?, ?, ?, ?, ?, ?)")
          .run(user.id, user.email, user.password_hash, user.created_at, user.email_verified_at, user.pending_email);
        db.prepare("INSERT INTO profiles (id, email, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(user.id, user.email, user.email, createdAt, createdAt);
        db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(tokenId, user.id, "email_confirm", tokenHash, expiresAt, createdAt);
        createDefaultCategories(user.id);
      });
      tx();

      const confirmUrl = `${APP_PUBLIC_URL}/confirm-email?token=${rawConfirmToken}`;
      const { subject, text, html } = accountConfirmationTemplate(confirmUrl);
      await sendEmail({ to: user.email, subject, text, html });
    } else {
      const tx = db.transaction(() => {
        db.prepare("INSERT INTO users (id, email, password_hash, created_at, email_verified_at, pending_email) VALUES (?, ?, ?, ?, ?, ?)")
          .run(user.id, user.email, user.password_hash, user.created_at, user.email_verified_at, user.pending_email);
        db.prepare("INSERT INTO profiles (id, email, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(user.id, user.email, user.email, createdAt, createdAt);
        createDefaultCategories(user.id);
      });
      tx();
    }

    res.json({ session: createSession(user), user: toPublicUser(user) });
  } catch (error) {
    const message = String(error.message || error);
    res.status(message.includes("UNIQUE") ? 409 : 500).json({ error: { message: message.includes("UNIQUE") ? "Email já cadastrado." : message } });
  }
});

app.post("/api/auth/signin", (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const rateKeyIp = `signin:${ip}:${email || "none"}`;
  const signinLimit = Number(process.env.AUTH_SIGNIN_LIMIT || 5);
  const rateCheckIp = checkRateLimit(rateKeyIp, signinLimit, 15 * 60 * 1000);
  if (rateCheckIp.limited) {
    res.setHeader("Retry-After", String(rateCheckIp.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheckIp.retryAfterMinutes} minuto${rateCheckIp.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  const signinEmailLimit = Number(process.env.AUTH_SIGNIN_EMAIL_LIMIT || 20);
  const rateKeyEmail = `signin-email:${email || "none"}`;
  const rateCheckEmail = checkRateLimit(rateKeyEmail, signinEmailLimit, 60 * 60 * 1000);
  if (rateCheckEmail.limited) {
    res.setHeader("Retry-After", String(rateCheckEmail.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheckEmail.retryAfterMinutes} minuto${rateCheckEmail.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const passwordMatch = user
    ? verifyPassword(password, user.password_hash)
    : (verifyPassword(password, DUMMY_PASSWORD_HASH), false);

  if (!user || !passwordMatch) {
    return res.status(401).json({ error: { message: "Email ou senha inválidos." } });
  }

  rateLimits.delete(rateKeyIp);
  rateLimits.delete(rateKeyEmail);
  res.json({ session: createSession(user), user: toPublicUser(user) });
});

app.get("/api/auth/session", requireUser, requireSession, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) || req.user;
  res.json({
    session: {
      access_token: req.sessionToken,
      token_type: "bearer",
      expires_at: Math.floor(new Date(req.sessionExpiresAt).getTime() / 1000),
      user: toPublicUser(user),
    },
    user: toPublicUser(user),
  });
});

app.post("/api/auth/refresh", requireUser, requireSession, (req, res) => {
  const oldTokenHash = req.sessionTokenHash;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) || req.user;
  let newSession;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(oldTokenHash);
    newSession = createSession(user);
  });
  tx();
  res.json({ session: newSession, user: toPublicUser(user) });
});

app.post("/api/auth/signout", requireUser, requireSession, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.sessionTokenHash);
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const email = String(req.body?.email || "").trim().toLowerCase();

  const rateKey = `forgot-password:${ip}:${email || "none"}`;
  const rateCheck = checkRateLimit(rateKey, 5, 60 * 60 * 1000);
  if (rateCheck.limited) {
    res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfterMinutes} minuto${rateCheck.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  if (!email) {
    return res.json({ ok: true });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.json({ ok: true });
  }

  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL")
    .run(now(), user.id);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const tokenId = randomUUID();

  db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tokenId, user.id, "password_reset", tokenHash, expiresAt, now());

  const resetUrl = `${APP_PUBLIC_URL}/reset-password?token=${rawToken}`;
  const { subject, text, html } = passwordResetTemplate(resetUrl);
  await sendEmail({ to: user.email, subject, text, html });

  res.json({ ok: true });
});

app.post("/api/auth/reset-password", (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");

  const rateKey = `reset-password:${ip}:${token || "none"}`;
  const rateCheck = checkRateLimit(rateKey, 10, 60 * 60 * 1000);
  if (rateCheck.limited) {
    res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfterMinutes} minuto${rateCheck.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: { message: passwordValidation.message } });
  }

  if (!token) {
    return res.status(400).json({ error: { code: "invalid_token", message: "Link inválido ou expirado." } });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenRow = db.prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND type = 'password_reset'").get(tokenHash);

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: { code: "invalid_token", message: "Link inválido ou expirado." } });
  }

  const newHash = hashPassword(password);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, tokenRow.user_id);
    db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").run(now(), tokenRow.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(tokenRow.user_id);
  });
  tx();

  res.json({ ok: true });
});

app.post("/api/auth/change-password", requireUser, requireSession, (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const rateKey = `change-password:${ip}:${req.user.id}`;
  const rateCheck = checkRateLimit(rateKey, 10, 60 * 60 * 1000);
  if (rateCheck.limited) {
    res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfterMinutes} minuto${rateCheck.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!currentUser || !verifyPassword(currentPassword, currentUser.password_hash)) {
    return res.status(400).json({ error: { message: "Senha atual incorreta." } });
  }

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return res.status(400).json({ error: { message: validation.message } });
  }

  const newHash = hashPassword(newPassword);
  const tx = db.transaction(() => {
    if (!currentUser.email_verified_at) {
      db.prepare("UPDATE users SET password_hash = ?, email_verified_at = ? WHERE id = ?")
        .run(newHash, now(), currentUser.id);
    } else {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .run(newHash, currentUser.id);
    }
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
      .run(currentUser.id, req.sessionTokenHash);
  });
  tx();

  res.json({ ok: true });
});

app.post("/api/auth/change-email", requireUser, requireSession, async (req, res) => {
  if (!isEmailEnabled()) {
    return res.status(503).json({
      error: {
        code: "email_disabled",
        message: "Envio de email não configurado no servidor.",
      },
    });
  }

  const password = String(req.body?.password || "");
  const newEmail = String(req.body?.newEmail || "").trim().toLowerCase();

  const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!currentUser || !verifyPassword(password, currentUser.password_hash)) {
    return res.status(400).json({ error: { message: "Senha incorreta." } });
  }

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ error: { message: "Informe um email válido." } });
  }

  if (newEmail === currentUser.email) {
    return res.status(400).json({ error: { message: "O novo email deve ser diferente do email atual." } });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(newEmail, currentUser.id);
  if (existing) {
    return res.status(409).json({ error: { code: "email_in_use", message: "Email já cadastrado." } });
  }

  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = 'email_confirm' AND used_at IS NULL")
    .run(now(), currentUser.id);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tokenId = randomUUID();

  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET pending_email = ? WHERE id = ?").run(newEmail, currentUser.id);
    db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(tokenId, currentUser.id, "email_confirm", tokenHash, expiresAt, now());
  });
  tx();

  const confirmUrl = `${APP_PUBLIC_URL}/settings?confirm_email_token=${rawToken}`;
  const { subject, text, html } = emailConfirmationTemplate(confirmUrl);
  await sendEmail({ to: newEmail, subject, text, html });

  res.json({ ok: true });
});

function handleConfirmEmail(req, res) {
  const token = String(req.query?.token || req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: { code: "invalid_token", message: "Link de confirmação inválido ou expirado." } });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenRow = db.prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND type = 'email_confirm'").get(tokenHash);

  if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: { code: "invalid_token", message: "Link de confirmação inválido ou expirado." } });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(tokenRow.user_id);
  if (!user) {
    return res.status(400).json({ error: { code: "invalid_token", message: "Usuário não encontrado." } });
  }

  const tx = db.transaction(() => {
    const verifiedAt = now();
    if (user.pending_email) {
      db.prepare("UPDATE users SET email = pending_email, pending_email = NULL, email_verified_at = ? WHERE id = ?")
        .run(verifiedAt, user.id);
      db.prepare("UPDATE profiles SET email = ? WHERE id = ?")
        .run(user.pending_email, user.id);
    } else {
      db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?")
        .run(verifiedAt, user.id);
    }
    db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?")
      .run(verifiedAt, tokenRow.id);
  });
  tx();

  const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json({ ok: true, user: toPublicUser(updatedUser) });
}

app.get("/api/auth/confirm-email", handleConfirmEmail);
app.post("/api/auth/confirm-email", handleConfirmEmail);

app.post("/api/auth/resend-confirmation", requireUser, requireSession, async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const rateKey = `resend-confirmation:${ip}:${req.user.id}`;
  const rateCheck = checkRateLimit(rateKey, 5, 60 * 60 * 1000);
  if (rateCheck.limited) {
    res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfterMinutes} minuto${rateCheck.retryAfterMinutes > 1 ? "s" : ""}.`,
      },
    });
  }

  const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!currentUser) {
    return res.status(404).json({ error: { message: "Usuário não encontrado." } });
  }

  if (currentUser.email_verified_at && !currentUser.pending_email) {
    return res.json({ ok: true, message: "Email já verificado." });
  }

  const targetEmail = currentUser.pending_email || currentUser.email;

  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = 'email_confirm' AND used_at IS NULL")
    .run(now(), currentUser.id);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tokenId = randomUUID();

  db.prepare("INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tokenId, currentUser.id, "email_confirm", tokenHash, expiresAt, now());

  const confirmUrl = `${APP_PUBLIC_URL}/confirm-email?token=${rawToken}`;
  const template = currentUser.pending_email
    ? emailConfirmationTemplate(confirmUrl)
    : accountConfirmationTemplate(confirmUrl);

  await sendEmail({ to: targetEmail, subject: template.subject, text: template.text, html: template.html });

  res.json({ ok: true });
});

app.post("/api/auth/signout-all", requireUser, requireSession, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

app.get("/api/auth/sessions", requireUser, requireSession, (req, res) => {
  const sessions = db.prepare("SELECT id, token_hash, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  const currentTokenHash = req.sessionTokenHash;
  const list = sessions.map((s) => ({
    id: s.token_hash.slice(0, 12),
    created_at: s.created_at,
    expires_at: s.expires_at,
    current: s.token_hash === currentTokenHash,
  }));
  res.json({ sessions: list });
});

app.delete("/api/auth/account", requireUser, requireSession, (req, res) => {
  const password = String(req.body?.password || "");
  const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);

  if (!currentUser || !verifyPassword(password, currentUser.password_hash)) {
    return res.status(400).json({ error: { message: "Senha incorreta." } });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(currentUser.id);
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

export { app, db, resetRateLimits, validatePassword, cleanupExpiredSessions, hashSessionToken };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
