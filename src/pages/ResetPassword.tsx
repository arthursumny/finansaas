import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { passwordSchema, passwordStrength } from "@/lib/validation";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalidToken, setIsInvalidToken] = useState(!token);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { resetPassword, localSignOut } = useAuth();
  const { toast } = useToast();
  const { actualTheme } = useTheme();
  const navigate = useNavigate();

  const strength = passwordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setIsInvalidToken(true);
      return;
    }

    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      setErrorMessage(validation.error.errors[0]?.message || "Senha inválida.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword({ token, password });

      if (error) {
        if (error.message.includes("inválido") || error.message.includes("expirado")) {
          setIsInvalidToken(true);
        } else {
          setErrorMessage(error.message);
          toast({
            title: "Erro na redefinição",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        localSignOut();
        toast({
          title: "Senha redefinida com sucesso.",
          description: "Entre com a nova senha.",
        });
        navigate("/login");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao redefinir a senha.";
      setErrorMessage(message);
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-2 pb-6 text-center">
            <CardTitle className="text-2xl font-medium">Redefinir Senha</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isInvalidToken
                ? "Não foi possível validar o link de recuperação"
                : "Defina uma nova senha segura para sua conta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isInvalidToken ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 rounded-xl border border-destructive/20 text-center space-y-3">
                  <div className="w-12 h-12 bg-destructive/20 text-destructive rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-medium text-foreground">Link inválido ou expirado</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Este link de recuperação de senha não é válido ou já expirou (o link expira em 60 minutos ou após o primeiro uso).
                  </p>
                </div>

                <div className="space-y-3">
                  <Button asChild className="w-full h-11">
                    <Link to="/forgot-password">Solicitar novo link</Link>
                  </Button>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para o login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres (letras e números)"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      required
                      className="h-11 border-secondary focus:border-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {password && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Força da senha:</span>
                        <span className="font-medium">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                        {[0, 1, 2, 3].map((step) => (
                          <div
                            key={step}
                            className={`h-full flex-1 transition-all rounded-full ${
                              strength.score >= step + 1 ? strength.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Digite novamente a nova senha"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      required
                      className="h-11 border-secondary focus:border-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Exibir senha"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-xs text-destructive">{errorMessage}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
                  disabled={isLoading}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {isLoading ? "Salvando nova senha..." : "Redefinir senha"}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para o login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
