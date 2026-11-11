import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { emailSchema, passwordSchema, passwordStrength } from "@/lib/validation";
import { LocalSessionInfo } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const Settings = () => {
  const {
    user,
    refreshUser,
    changePassword,
    changeEmail,
    confirmEmail,
    resendConfirmation,
    signOutAll,
    listSessions,
    deleteAccount,
  } = useAuth();

  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados para troca de senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Estados para troca de email
  const [emailPassword, setEmailPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Estados para exclusão de conta
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Estados para encerramento de todas as sessões
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);

  const handleResendConfirmation = async () => {
    setIsResendingConfirmation(true);
    try {
      const { error } = await resendConfirmation();
      if (error) {
        toast({
          title: "Erro ao reenviar",
          description: error.message || "Não foi possível reenviar o email de confirmação.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email enviado!",
          description: "Enviamos um novo link de confirmação para o seu email.",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao reenviar email.",
        variant: "destructive",
      });
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  // Estados da aba de segurança (sessões)
  const [sessions, setSessions] = useState<LocalSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Verificação de token de confirmação de email via URL
  const confirmToken = searchParams.get("confirm_email_token");

  const handleConfirmEmailFromUrl = useCallback(async (token: string) => {
    try {
      const { error } = await confirmEmail(token);
      if (error) {
        toast({
          title: "Erro na confirmação",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email confirmado!",
          description: "Seu endereço de email foi atualizado com sucesso.",
        });
        // Remove o query param
        searchParams.delete("confirm_email_token");
        setSearchParams(searchParams, { replace: true });
        await refreshUser();
      }
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao confirmar email.",
        variant: "destructive",
      });
    }
  }, [confirmEmail, refreshUser, searchParams, setSearchParams, toast]);

  useEffect(() => {
    if (confirmToken) {
      handleConfirmEmailFromUrl(confirmToken);
    }
  }, [confirmToken, handleConfirmEmailFromUrl]);

  // Carrega lista de sessões
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const { data, error } = await listSessions();
      if (error) {
        toast({
          title: "Erro ao carregar sessões",
          description: error.message,
          variant: "destructive",
        });
      } else if (data) {
        setSessions(data);
      }
    } finally {
      setIsLoadingSessions(false);
    }
  }, [listSessions, toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const newPasswordStrength = passwordStrength(newPassword);

  // Submissão de troca de senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      setPasswordError(validation.error.errors[0]?.message || "Senha inválida.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("A nova senha e a confirmação não coincidem.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await changePassword({ currentPassword, newPassword });
      if (error) {
        setPasswordError(error.message);
        toast({
          title: "Erro ao alterar senha",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Senha alterada com sucesso!",
          description: "As outras sessões ativas foram desconectadas por segurança.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        await loadSessions();
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Submissão de troca de email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const validation = emailSchema.safeParse(newEmail);
    if (!validation.success) {
      setEmailError(validation.error.errors[0]?.message || "Informe um email válido.");
      return;
    }

    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setEmailError("O novo email deve ser diferente do email atual.");
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await changeEmail({ password: emailPassword, newEmail: newEmail.trim() });
      if (error) {
        setEmailError(error.message);
        toast({
          title: "Não foi possível alterar o email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Confirmação enviada!",
          description: `Um link de confirmação foi enviado para ${newEmail}. Acesse seu novo email para concluir a alteração.`,
        });
        setEmailPassword("");
        setNewEmail("");
        await refreshUser();
      }
    } finally {
      setIsChangingEmail(false);
    }
  };

  // Sair de todos os dispositivos
  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    try {
      const { error } = await signOutAll();
      if (error) {
        toast({
          title: "Erro ao encerrar sessões",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sessões encerradas",
          description: "Você saiu de todos os dispositivos conectados.",
        });
        navigate("/login");
      }
    } finally {
      setIsSigningOutAll(false);
    }
  };

  // Excluir conta
  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!deleteAccountPassword) {
      setDeleteError("Informe sua senha para confirmar a exclusão da conta.");
      return;
    }

    setIsDeletingAccount(true);
    try {
      const { error } = await deleteAccount(deleteAccountPassword);
      if (error) {
        setDeleteError(error.message);
        toast({
          title: "Erro ao excluir conta",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setIsDeleteDialogOpen(false);
        toast({
          title: "Conta excluída",
          description: "Sua conta e todos os dados associados foram excluídos definitivamente.",
        });
        navigate("/login");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Desconhecido";
    try {
      return new Date(dateStr).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header com voltar */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard" aria-label="Voltar para o dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus dados de acesso, preferências e segurança da conta.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Conta / Segurança */}
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="account">Conta</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
          </TabsList>

          {/* ABA CONTA */}
          <TabsContent value="account" className="space-y-6">
            {/* Email Atual */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Email da Conta
                </CardTitle>
                <CardDescription>
                  Endereço utilizado para login e recebimento de notificações do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/40 rounded-lg border">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                      Email principal
                    </span>
                    <span className="font-mono text-base font-medium">{user?.email}</span>
                  </div>
                  <div>
                    {user?.email_verified_at ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Email confirmado
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Email não confirmado
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isResendingConfirmation}
                          onClick={handleResendConfirmation}
                          className="h-7 text-xs"
                        >
                          {isResendingConfirmation ? "Reenviando..." : "Reenviar email"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {user?.pending_email && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        Confirmação pendente
                      </p>
                      <p className="text-muted-foreground">
                        Uma solicitação para alterar seu email para{" "}
                        <strong className="text-foreground font-mono">{user.pending_email}</strong> está aguardando confirmação.
                        Acesse a caixa de entrada do novo email e clique no link de validação.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trocar Email */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium">Trocar Email</CardTitle>
                <CardDescription>
                  Por segurança, informe sua senha atual para solicitar um novo endereço de email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangeEmail} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-email-password">Sua senha atual</Label>
                    <Input
                      id="current-email-password"
                      type="password"
                      placeholder="Digite sua senha"
                      value={emailPassword}
                      onChange={(e) => {
                        setEmailPassword(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-email">Novo email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="novo.email@exemplo.com"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      required
                    />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nota: O novo email só entrará em vigor após a confirmação através do link enviado para ele.
                    Se o envio de email estiver desativado no servidor, uma mensagem clara de erro será apresentada.
                  </p>

                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}

                  <Button type="submit" disabled={isChangingEmail}>
                    {isChangingEmail ? "Solicitando..." : "Solicitar alteração de email"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Trocar Senha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Defina uma nova senha com no mínimo 8 caracteres, contendo letras e números.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="pwd-current">Senha atual</Label>
                    <div className="relative">
                      <Input
                        id="pwd-current"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Digite sua senha atual"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrentPassword ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pwd-new">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="pwd-new"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres (letras e números)"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordError) setPasswordError(null);
                        }}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        aria-label={showNewPassword ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {newPassword && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Força da senha:</span>
                          <span className="font-medium">{newPasswordStrength.label}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                          {[0, 1, 2, 3].map((step) => (
                            <div
                              key={step}
                              className={`h-full flex-1 transition-all rounded-full ${
                                newPasswordStrength.score >= step + 1
                                  ? newPasswordStrength.color
                                  : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pwd-confirm">Confirmar nova senha</Label>
                    <Input
                      id="pwd-confirm"
                      type="password"
                      placeholder="Digite novamente a nova senha"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      required
                    />
                  </div>

                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}

                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? "Atualizando..." : "Atualizar senha"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Sair de todos os dispositivos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <LogOut className="w-5 h-5 text-muted-foreground" />
                  Sessões em outros dispositivos
                </CardTitle>
                <CardDescription>
                  Desconecta sua conta de todos os navegadores e dispositivos atualmente logados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair de todos os dispositivos
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar todos os dispositivos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação encerrará todas as sessões ativas da sua conta, inclusive a atual.
                        Você precisará fazer login novamente para continuar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleSignOutAll}
                        disabled={isSigningOutAll}
                      >
                        {isSigningOutAll ? "Saindo..." : "Sim, desconectar todos"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Área de Perigo / Excluir Conta */}
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-destructive flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Zona de Perigo: Excluir Conta
                </CardTitle>
                <CardDescription>
                  A exclusão da conta é permanente e irreversível. Todas as suas transações, metas,
                  categorias e configurações serão excluídas definitivamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir minha conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Confirmação de exclusão definitiva
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>
                          Esta ação <strong>NÃO PODE</strong> ser desfeita. Todos os seus dados financeiros,
                          histórico de transações e relatórios serão excluídos permanentemente.
                        </p>
                        <p>Para confirmar, digite sua senha de acesso abaixo:</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2 space-y-2">
                      <Label htmlFor="del-password">Sua senha atual</Label>
                      <Input
                        id="del-password"
                        type="password"
                        placeholder="Digite sua senha"
                        value={deleteAccountPassword}
                        onChange={(e) => {
                          setDeleteAccountPassword(e.target.value);
                          if (deleteError) setDeleteError(null);
                        }}
                      />
                      {deleteError && (
                        <p className="text-xs text-destructive">{deleteError}</p>
                      )}
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteError(null)}>
                        Cancelar
                      </AlertDialogCancel>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                      >
                        {isDeletingAccount ? "Excluindo..." : "Excluir definitivamente"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA SEGURANÇA */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-primary" />
                    Sessões Ativas
                  </CardTitle>
                  <CardDescription>
                    Lista de sessões com acesso ativo à sua conta no FinanSaaS.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadSessions}
                  disabled={isLoadingSessions}
                  title="Atualizar sessões"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSessions ? "animate-spin" : ""}`} />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingSessions && sessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Carregando sessões ativas...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Nenhuma sessão encontrada.
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Sessão {sess.id}</span>
                              {sess.current && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                  Esta sessão
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              Iniciada em: {formatDate(sess.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground sm:text-right">
                          <span>Expira em: {formatDate(sess.expires_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-4" />

                {/* Informações adicionais de acesso baseadas nos dados do usuário */}
                <div className="p-4 bg-muted/40 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Informações da Conta
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <span>Conta criada em: </span>
                      <strong className="text-foreground">{formatDate(user?.created_at)}</strong>
                    </div>
                    <div>
                      <span>Email verificado em: </span>
                      <strong className="text-foreground">
                        {user?.email_verified_at ? formatDate(user.email_verified_at) : "Pendente"}
                      </strong>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
