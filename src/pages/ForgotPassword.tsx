import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { emailSchema } from "@/lib/validation";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { resetPasswordForEmail } = useAuth();
  const { toast } = useToast();
  const { actualTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || "Informe um email válido.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPasswordForEmail(email.trim());
      if (error) {
        toast({
          title: "Aviso",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setIsSubmitted(true);
        toast({
          title: "Solicitação enviada!",
          description: "Se o email estiver cadastrado, o link foi gerado com sucesso.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao solicitar recuperação de senha.";
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
            <CardTitle className="text-2xl font-medium">Recuperar Senha</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isSubmitted
                ? "Verifique as instruções enviadas para o seu email"
                : "Digite seu email para receber um link de redefinição de senha"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/40 rounded-xl border border-secondary/20 text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-medium text-foreground">Email enviado!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Se o endereço <span className="font-medium text-foreground">{email}</span> estiver cadastrado na plataforma,
                    você receberá um link válido por 60 minutos para redefinir sua senha.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verifique também a caixa de spam ou lixo eletrônico.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail("");
                    }}
                  >
                    Enviar outro email
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
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email cadastrado
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      required
                      autoFocus
                      className="h-11 border-secondary focus:border-primary pl-10"
                    />
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
                  </div>
                  {errorMsg && (
                    <p className="text-xs text-destructive mt-1">{errorMsg}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando link..." : "Enviar link de recuperação"}
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

export default ForgotPassword;
