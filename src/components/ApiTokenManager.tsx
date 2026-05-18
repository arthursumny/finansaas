import { useState } from "react";
import { ArrowLeft, Check, Copy, KeyRound, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useApiTokens } from "@/hooks/useApiTokens";

interface ApiTokenManagerProps {
  onBack: () => void;
}

export const ApiTokenManager = ({ onBack }: ApiTokenManagerProps) => {
  const { tokens, loading, createToken, revokeToken } = useApiTokens();
  const [name, setName] = useState("Hermes Telegram");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeTokens = tokens.filter((token) => !token.revoked_at);
  const revokedTokens = tokens.filter((token) => token.revoked_at);

  const handleCreateToken = async () => {
    const trimmedName = name.trim() || "Hermes Telegram";
    const token = await createToken(trimmedName);
    if (token) {
      setCreatedToken(token);
      setName("Hermes Telegram");
      setCopied(false);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Nunca";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      <Card className="border-0 shadow-sm bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Tokens da API</CardTitle>
              <CardDescription>Gere uma chave por conta para conectar o Hermes Agent, Telegram ou outra automacao.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="api-token-name">Nome do token</Label>
              <Input
                id="api-token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Hermes Telegram"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateToken} className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" />
                Gerar token
              </Button>
            </div>
          </div>

          {createdToken && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Shield className="w-4 h-4 text-primary" />
                Token gerado. Copie agora.
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={createdToken} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={copyToken} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-card">
        <CardHeader>
          <CardTitle>Tokens ativos</CardTitle>
          <CardDescription>{activeTokens.length} token(s) com acesso a API.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeTokens.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum token ativo.
            </div>
          ) : (
            <div className="space-y-3">
              {activeTokens.map((token) => (
                <div key={token.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.name}</span>
                      <Badge variant="secondary">{token.token_prefix}...</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Criado em {formatDate(token.created_at)} · ultimo uso: {formatDate(token.last_used_at)}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => revokeToken(token.id)} className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Revogar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {revokedTokens.length > 0 && (
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader>
            <CardTitle>Tokens revogados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revokedTokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between rounded-lg border p-4 opacity-70">
                <div>
                  <div className="font-medium">{token.name}</div>
                  <p className="text-sm text-muted-foreground">
                    {token.token_prefix}... · revogado em {formatDate(token.revoked_at)}
                  </p>
                </div>
                <Badge variant="outline">Revogado</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
