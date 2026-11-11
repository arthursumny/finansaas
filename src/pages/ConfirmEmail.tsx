import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState<string>(
    token ? "" : "Link de confirmação ausente ou inválido."
  );

  const { confirmEmail, user, refreshUser } = useAuth();
  const { actualTheme } = useTheme();

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    (async () => {
      try {
        const { error } = await confirmEmail(token);
        if (!isMounted) return;

        if (error) {
          setStatus("error");
          setErrorMessage(error.message || "Link de confirmação inválido ou expirado.");
        } else {
          setStatus("success");
          await refreshUser();
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Erro ao confirmar email.");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, confirmEmail, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img
              src={actualTheme === "dark" ? "/logo_branca.png" : "/logo_preta.png"}
              alt="FinanSaaS"
              className="h-16 w-auto"
            />
          </div>
        </div>

        <Card className="border-0 shadow-sm text-center">
          <CardHeader className="space-y-2 pb-6">
            {status === "loading" && (
              <>
                <div className="flex justify-center mb-2">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl font-medium">Confirmando seu email</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Aguarde enquanto validamos o seu token de confirmação...
                </CardDescription>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-medium text-foreground">Email confirmado</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Seu endereço de email foi verificado com sucesso. Sua conta está agora totalmente protegida.
                </CardDescription>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-medium text-foreground">Link inválido/expirado</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {errorMessage || "Este link de confirmação não é mais válido ou já foi utilizado."}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {status !== "loading" && (
              <Button asChild className="w-full h-11 font-medium">
                <Link to={user ? "/dashboard" : "/login"}>
                  {user ? "Ir para o Dashboard" : "Ir para o login"}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmEmail;
