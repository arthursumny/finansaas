import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface ApiToken {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const DEFAULT_SCOPES = [
  "transactions:read",
  "transactions:write",
  "categories:read",
  "categories:write",
  "charts:read",
];

const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `fs_${encoded}`;
};

export const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const errorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Erro inesperado.";
};

export const useApiTokens = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTokens = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("api_tokens")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens((data as ApiToken[]) || []);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar tokens",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  const createToken = async (name: string) => {
    if (!user) return null;

    const token = randomToken();
    const tokenHash = await hashToken(token);

    try {
      const { data, error } = await supabase
        .from("api_tokens")
        .insert({
          user_id: user.id,
          name,
          token_hash: tokenHash,
          token_prefix: token.slice(0, 10),
          scopes: DEFAULT_SCOPES,
        })
        .select()
        .single();

      if (error) throw error;
      setTokens((prev) => [data as ApiToken, ...prev]);
      toast({ title: "Token criado", description: "Copie o token agora. Ele nao sera exibido novamente." });
      return token;
    } catch (error: unknown) {
      toast({
        title: "Erro ao criar token",
        description: errorMessage(error),
        variant: "destructive",
      });
      return null;
    }
  };

  const revokeToken = async (id: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("api_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      setTokens((prev) => prev.map((token) => (token.id === id ? (data as ApiToken) : token)));
      toast({ title: "Token revogado", description: "Esse token nao pode mais acessar a API." });
    } catch (error: unknown) {
      toast({
        title: "Erro ao revogar token",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [fetchTokens, user]);

  return {
    tokens,
    loading,
    createToken,
    revokeToken,
    refetch: fetchTokens,
  };
};
