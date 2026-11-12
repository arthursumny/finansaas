import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { passwordSchema, passwordStrength } from "@/lib/validation";

const Login = () => {
  const location = useLocation();
  const initialTab =
    new URLSearchParams(window.location.search || location.search).get("signup") === "1"
      ? "signup"
      : "signin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialTab === "signup");
  const [signUpPasswordError, setSignUpPasswordError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signIn, signUp } = useAuth();
  const { actualTheme } = useTheme();

  useEffect(() => {
    const signupParam = new URLSearchParams(window.location.search || location.search).get("signup");
    if (signupParam === "1") {
      setIsSignUp(true);
    }
  }, [location.search]);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const strength = passwordStrength(password);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpPasswordError(null);

    if (isSignUp) {
      const validation = passwordSchema.safeParse(password);
      if (!validation.success) {
        setSignUpPasswordError(validation.error.errors[0]?.message || "Senha inválida.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        const errorObj = error as { message?: string };
        const msg = errorObj.message || (error instanceof Error ? error.message : "Erro na autenticação.");
        if (isSignUp && msg.toLowerCase().includes("cadastrado")) {
          setSignUpPasswordError(null);
        }
        toast({
          title: `Erro no ${isSignUp ? 'cadastro' : 'login'}`,
          description: msg,
          variant: "destructive",
        });
      } else if (isSignUp) {
        toast({
          title: "Cadastro realizado!",
          description: "Sua conta foi criada com sucesso.",
        });
      } else {
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao seu controle financeiro.",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Algo deu errado.";
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
              src={actualTheme === 'dark' ? '/logo_branca.png' : '/logo_preta.png'} 
              alt="FinanSaaS" 
              className="h-16 w-auto"
            />
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl font-medium text-center">
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {isSignUp 
                ? 'Crie sua conta para começar a usar o controle financeiro'
                : 'Digite suas credenciais para acessar sua conta'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={initialTab}
              value={isSignUp ? "signup" : "signin"}
              onValueChange={(value) => {
                setIsSignUp(value === "signup");
                setSignUpPasswordError(null);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="signin" className="data-[state=active]:bg-background data-[state=active]:text-foreground">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:text-foreground">Criar Conta</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-6 mt-6">
                <form onSubmit={handleAuth} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Digite seu email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 border-secondary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Esqueci minha senha
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 border-secondary focus:border-primary"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg" disabled={isLoading}>
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-6 mt-6">
                <form onSubmit={handleAuth} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Digite seu email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 border-secondary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres (letras e números)"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (signUpPasswordError) setSignUpPasswordError(null);
                      }}
                      required
                      className="h-11 border-secondary focus:border-primary"
                    />

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

                    {signUpPasswordError && (
                      <p className="text-xs text-destructive mt-1">{signUpPasswordError}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg" disabled={isLoading}>
                    {isLoading ? "Criando conta..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
