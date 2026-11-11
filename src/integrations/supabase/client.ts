export interface LocalUser {
  id: string;
  email?: string;
  created_at?: string;
  email_verified_at?: string | null;
  pending_email?: string | null;
}

export interface LocalSessionInfo {
  id: string;
  created_at: string;
  expires_at: string;
  current: boolean;
}

export interface LocalSession {
  access_token: string;
  token_type: string;
  expires_at?: number;
  user: LocalUser;
}

type AuthListener = (event: string, session: LocalSession | null) => void;

const API_URL = import.meta.env.VITE_API_URL || "/api";
const SESSION_STORAGE_KEY = "finansaas.session";

function getStoredSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: LocalSession | null) {
  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

async function request(path: string, init: RequestInit = {}) {
  const session = getStoredSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Erro na API local.");
  }

  return payload;
}

class LocalAuth {
  private listeners = new Set<AuthListener>();

  private emit(event: string, session: LocalSession | null) {
    for (const listener of this.listeners) listener(event, session);
  }

  onAuthStateChange(listener: AuthListener) {
    this.listeners.add(listener);

    return {
      data: {
        subscription: {
          unsubscribe: () => this.listeners.delete(listener),
        },
      },
    };
  }

  async getSession() {
    const session = getStoredSession();

    if (!session?.access_token) {
      return { data: { session: null }, error: null };
    }

    try {
      const payload = await request("/auth/session");
      let activeSession = payload.session as LocalSession;

      // Se faltar menos de 7 dias para expirar, faz refresh da sessão
      const nowSec = Math.floor(Date.now() / 1000);
      const sevenDaysSec = 7 * 24 * 60 * 60;
      if (activeSession?.expires_at && activeSession.expires_at - nowSec < sevenDaysSec) {
        try {
          const refreshPayload = await request("/auth/refresh", { method: "POST" });
          if (refreshPayload?.session) {
            activeSession = refreshPayload.session as LocalSession;
          }
        } catch {
          // falha no refresh não quebra a sessão se ela ainda for válida
        }
      }

      setStoredSession(activeSession);
      return { data: { session: activeSession }, error: null };
    } catch (error) {
      setStoredSession(null);
      return { data: { session: null }, error };
    }
  }

  async refreshSession(): Promise<{ data: { session: LocalSession | null }; error: Error | null }> {
    try {
      const payload = await request("/auth/refresh", { method: "POST" });
      setStoredSession(payload.session);
      this.emit("TOKEN_REFRESHED", payload.session);
      return { data: { session: payload.session as LocalSession }, error: null };
    } catch (error) {
      return { data: { session: null }, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const payload = await request("/auth/signin", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setStoredSession(payload.session);
      this.emit("SIGNED_IN", payload.session);
      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signUp(input: { email: string; password: string }) {
    try {
      const payload = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      setStoredSession(payload.session);
      this.emit("SIGNED_IN", payload.session);
      return { data: payload, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async signOut() {
    try {
      await request("/auth/signout", { method: "POST" });
    } catch {
      // A local logout should still clear a stale browser session.
    }

    setStoredSession(null);
    this.emit("SIGNED_OUT", null);
  }

  localSignOut() {
    setStoredSession(null);
    this.emit("SIGNED_OUT", null);
  }

  clearSession() {
    this.localSignOut();
  }

  async signOutAll(): Promise<{ error: Error | null }> {
    try {
      await request("/auth/signout-all", { method: "POST" });
    } catch (error) {
      setStoredSession(null);
      this.emit("SIGNED_OUT", null);
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    setStoredSession(null);
    this.emit("SIGNED_OUT", null);
    return { error: null };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    try {
      await request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async resetPassword(payload: { token: string; password: string }): Promise<{ error: Error | null }> {
    try {
      await request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      this.localSignOut();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ error: Error | null }> {
    try {
      await request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async changeEmail(payload: { password: string; newEmail: string }): Promise<{ error: Error | null }> {
    try {
      await request("/auth/change-email", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async confirmEmail(token: string): Promise<{ error: Error | null }> {
    try {
      await request("/auth/confirm-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async listSessions(): Promise<{ data: LocalSessionInfo[] | null; error: Error | null }> {
    try {
      const payload = await request("/auth/sessions");
      return { data: (payload.sessions || []) as LocalSessionInfo[], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async deleteAccount(password: string): Promise<{ error: Error | null }> {
    try {
      await request("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      setStoredSession(null);
      this.emit("SIGNED_OUT", null);
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async resendConfirmation(email?: string): Promise<{ error: Error | null }> {
    try {
      await request("/auth/resend-confirmation", {
        method: "POST",
        body: email ? JSON.stringify({ email }) : undefined,
      });
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async refreshUser(): Promise<{ user: LocalUser | null; error: Error | null }> {
    try {
      const payload = await request("/auth/session");
      setStoredSession(payload.session);
      this.emit("USER_UPDATED", payload.session);
      return { user: payload.user as LocalUser, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}

class QueryBuilder {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private selectExpression = "*";
  private values: unknown;
  private filters: Array<{ column: string; op: string; value: unknown }> = [];
  private orders: Array<{ column: string; ascending?: boolean }> = [];
  private rowLimit?: number;
  private singleResult = false;
  private maybeSingleResult = false;
  private options: Record<string, unknown> = {};

  constructor(private table: string) {}

  select(expression = "*") {
    this.action = this.action || "select";
    this.selectExpression = expression;
    return this;
  }

  insert(values: unknown, options: Record<string, unknown> = {}) {
    this.action = "insert";
    this.values = values;
    this.options = options;
    return this;
  }

  update(values: unknown) {
    this.action = "update";
    this.values = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: "neq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, op: "gt", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, op: "lt", value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }

  match(values: Record<string, unknown>) {
    Object.entries(values).forEach(([column, value]) => this.eq(column, value));
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  async execute() {
    try {
      const payload = await request("/query", {
        method: "POST",
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          values: this.values,
          filters: this.filters,
          orders: this.orders,
          select: this.selectExpression,
          limit: this.rowLimit,
          single: this.singleResult,
          maybeSingle: this.maybeSingleResult,
          options: this.options,
        }),
      });

      return { data: payload.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  then<TResult1 = Awaited<ReturnType<QueryBuilder["execute"]>>, TResult2 = never>(
    onfulfilled?: ((value: Awaited<ReturnType<QueryBuilder["execute"]>>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  auth: new LocalAuth(),
  from(table: string) {
    return new QueryBuilder(table);
  },
};
