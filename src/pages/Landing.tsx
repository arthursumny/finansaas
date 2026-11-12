import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import {
  Wallet,
  CreditCard,
  CalendarRange,
  Target,
  Upload,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus,
  Smartphone,
  Lock,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Cartões e faturas",
    description:
      "Acompanhe fechamento, vencimento, limite usado e disponível, além do cálculo automático de pagamento mínimo.",
  },
  {
    icon: CalendarRange,
    title: "Compras parceladas",
    description:
      "Divida compras em até 24x e veja cada parcela cair automaticamente na fatura do mês certo.",
  },
  {
    icon: Target,
    title: "Orçamentos e metas",
    description:
      "Defina limites mensais por categoria e acompanhe em tempo real o progresso das suas metas de economia.",
  },
  {
    icon: Upload,
    title: "Importar extrato OFX",
    description:
      "Traga as movimentações do seu banco em poucos cliques sem precisar digitar lançamento por lançamento.",
  },
  {
    icon: BarChart3,
    title: "Relatórios do mês",
    description:
      "Visualize receitas, despesas, balanço mensal e saldo atual consolidados em painéis claros.",
  },
  {
    icon: ShieldCheck,
    title: "Conta segura",
    description:
      "Gerencie sessões ativas, faça troca de senha e email com confirmação e tenha opção de excluir sua conta quando quiser.",
  },
];

const steps = [
  {
    number: "1",
    title: "Crie sua conta",
    description:
      "Entre com seu email e senha em menos de um minuto, sem burocracia e sem precisar cadastrar cartão.",
  },
  {
    number: "2",
    title: "Cadastre seus cartões e categorias",
    description:
      "Defina o dia de fechamento, vencimento, limite de cada cartão e organize suas categorias e orçamentos.",
  },
  {
    number: "3",
    title: "Lance o dia a dia e veja o mês fechar",
    description:
      "Registre receitas, gastos à vista ou parcelados, importe seu OFX e saiba exatamente quanto sobra no fim do mês.",
  },
];

const mockTransactions = [
  {
    id: "tx-1",
    title: "Salário Mensal",
    category: "Salário",
    detail: "Conta corrente • Pago",
    date: "05/11",
    amount: "+ R$ 7.500,00",
    type: "income" as const,
  },
  {
    id: "tx-2",
    title: "Supermercado Central",
    category: "Alimentação",
    detail: "Nubank Platinum • À vista",
    date: "07/11",
    amount: "- R$ 642,30",
    type: "expense" as const,
  },
  {
    id: "tx-3",
    title: "Notebook Trabalho (3/10)",
    category: "Tecnologia",
    detail: "Nubank Platinum • Parcela 3 de 10",
    date: "09/11",
    amount: "- R$ 459,90",
    type: "expense" as const,
  },
];

const Landing = () => {
  const { user, loading } = useAuth();
  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground overflow-x-clip">
      {/* Header fixo/sticky */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-x-clip">
        <div className="w-full container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2.5 sm:gap-3">
          <Link
            to="/"
            aria-label="FinanSaaS - Página inicial"
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              FinanSaaS
            </span>
          </Link>

          <nav
            aria-label="Navegação por seções da página"
            className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground"
          >
            <a
              href="#recursos"
              aria-label="Ir para a seção de recursos"
              className="hover:text-foreground transition-colors py-1"
            >
              Recursos
            </a>
            <a
              href="#cartoes"
              aria-label="Ir para a seção de cartões e faturas"
              className="hover:text-foreground transition-colors py-1"
            >
              Cartões
            </a>
            <a
              href="#como-funciona"
              aria-label="Ir para a seção como funciona"
              className="hover:text-foreground transition-colors py-1"
            >
              Como funciona
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-foreground hover:bg-accent px-2.5 sm:px-3.5 shrink-0 whitespace-nowrap"
            >
              <Link to="/login">Entrar</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3 sm:px-4 shadow-sm shrink-0 whitespace-nowrap"
            >
              <Link to="/login?signup=1">
                <span className="hidden sm:inline">Criar conta grátis</span>
                <span className="sm:hidden">Criar conta</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center justify-center">
                <Badge
                  variant="secondary"
                  className="px-3.5 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Controle total em um só lugar
                </Badge>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.12]">
                Suas finanças descomplicadas, na ponta do lápis.
              </h1>

              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Lance receitas e despesas em segundos, acompanhe cartões e faturas sem planilha e saiba exatamente quanto sobra no fim do mês.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                <Button
                  size="lg"
                  asChild
                  className="h-12 px-7 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-sm"
                >
                  <Link to="/login?signup=1">
                    Começar agora — é grátis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-12 px-7 border-border bg-card hover:bg-accent text-foreground font-medium text-base"
                >
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>

              {/* 3 Micro-provas */}
              <div className="pt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-6 text-xs sm:text-sm text-muted-foreground w-fit mx-auto">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary shrink-0" />
                  <span>Seus dados ficam na sua conta</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary shrink-0" />
                  <span>Funciona no celular</span>
                </div>
              </div>
            </div>

            {/* Preview visual do produto (Mockup do Dashboard em HTML/CSS puro) */}
            <div className="mt-12 sm:mt-16 max-w-5xl mx-auto overflow-hidden">
              <div
                aria-label="Prévia visual do painel FinanSaaS"
                className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
              >
                {/* Barra superior do app mock */}
                <div className="border-b border-border bg-muted/40 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      Painel Mensal
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[11px] border-border bg-background text-muted-foreground hidden sm:inline-flex"
                    >
                      Visão geral
                    </Badge>
                  </div>

                  {/* Navegador de mês igual ao Dashboard real */}
                  <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-1">
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Novembro de 2026
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Transação</span>
                  </div>
                </div>

                {/* Corpo do Dashboard Mock */}
                <div className="p-4 sm:p-6 space-y-5 bg-background/50">
                  {/* Linha superior: Card de Saldo + Resumo do Mês + Card de Fatura com barra de limite */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Card de Saldo e Balanço */}
                    <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="border border-border bg-card shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            Saldo Atual
                          </CardTitle>
                          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-primary" />
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                          <div className="text-2xl font-bold text-primary">
                            R$ 8.420,50
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Saldo acumulado de todas as contas pagas
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border border-border bg-card shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            Resumo de Novembro
                          </CardTitle>
                          <div className="w-8 h-8 bg-success/10 rounded-xl flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-success" />
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-income" />
                              Receitas
                            </span>
                            <span className="font-semibold text-foreground">
                              R$ 7.500,00
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <TrendingDown className="w-3.5 h-3.5 text-expense" />
                              Despesas
                            </span>
                            <span className="font-semibold text-foreground">
                              R$ 3.442,20
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-border flex items-center justify-between">
                            <span className="font-medium text-muted-foreground">
                              Balanço do Mês
                            </span>
                            <span className="font-bold text-primary">
                              + R$ 4.057,80
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Card de Fatura do Cartão com Barra de Limite */}
                    <Card className="lg:col-span-5 border border-border bg-card shadow-sm overflow-hidden">
                      <div className="h-1.5 w-full bg-primary" />
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-foreground">
                              Nubank Platinum
                            </CardTitle>
                            <p className="text-[11px] text-muted-foreground">
                              Fecha dia 05 • Vence dia 12
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-warning/15 text-warning border-warning/30 font-semibold"
                        >
                          Fatura aberta
                        </Badge>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">
                            Fatura atual (Nov/2026)
                          </span>
                          <span className="text-lg font-bold text-foreground">
                            R$ 2.340,80
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] flex-wrap gap-1">
                            <span className="text-muted-foreground">
                              Limite utilizado (47%)
                            </span>
                            <span className="font-semibold text-foreground">
                              R$ 2.340,80 / R$ 5.000,00
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-[47%] rounded-full bg-primary" />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground flex-wrap gap-1">
                            <span>Disponível: R$ 2.659,20</span>
                            <span className="text-primary font-medium">
                              Mínimo: R$ 351,12
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 3 Linhas de Transação com Categoria */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Últimos Lançamentos
                      </span>
                      <span className="text-xs text-muted-foreground">
                        3 transações recentes
                      </span>
                    </div>

                    <div className="divide-y divide-border">
                      {mockTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                tx.type === "income"
                                  ? "bg-income/10 text-income"
                                  : "bg-expense/10 text-expense"
                              }`}
                            >
                              {tx.type === "income" ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {tx.title}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-2 py-0 font-medium bg-muted text-muted-foreground"
                                >
                                  {tx.category}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {tx.detail} • {tx.date}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-sm font-semibold shrink-0 ${
                              tx.type === "income"
                                ? "text-income"
                                : "text-expense"
                            }`}
                          >
                            {tx.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seção #recursos: Grid de 6 Cards */}
        <section
          id="recursos"
          className="py-16 sm:py-20 border-t border-border/60 bg-muted/30 scroll-mt-16 overflow-hidden"
        >
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
              <Badge
                variant="outline"
                className="text-xs font-medium border-primary/30 text-primary bg-primary/5"
              >
                Recursos essenciais
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                Tudo o que você precisa para fechar o mês no azul
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Ferramentas diretas para controlar contas, cartões e metas sem fórmulas quebradas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
                  >
                    <CardHeader className="pb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-foreground">
                        <h3>{feature.title}</h3>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Seção #cartoes: Destaque 2 Colunas */}
        <section
          id="cartoes"
          className="py-16 sm:py-24 border-t border-border/60 bg-background scroll-mt-16 overflow-hidden"
        >
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Coluna 1: Explicação do controle de cartão */}
              <div className="lg:col-span-6 space-y-6">
                <Badge
                  variant="outline"
                  className="text-xs font-medium border-primary/30 text-primary bg-primary/5"
                >
                  Gestão completa de cartões
                </Badge>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  Domine a fatura do cartão antes mesmo de ela fechar
                </h2>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Chega de tomar susto quando a fatura chega. O FinanSaaS acompanha o ciclo real de cada cartão, separa compras pela data de fechamento e mostra quanto do limite já está comprometido.
                </p>

                <ul className="space-y-4 pt-1">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Fatura atual e aviso de próximo fechamento
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Saiba o dia exato da melhor compra e receba alerta quando a fatura estiver prestes a fechar.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Limite compartilhado com cartão adicional
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Vincule cartões adicionais ao cartão titular para enxergar o limite único consumido e filtrar gastos por portador.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Pagamento total, parcial e pagamento mínimo
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Registre o pagamento total da fatura ou abata valores parciais acompanhando quanto falta para cobrir o mínimo.
                      </p>
                    </div>
                  </li>
                </ul>

                <div className="pt-2">
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    <Link to="/login?signup=1">
                      Organizar meus cartões grátis
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Coluna 2: Mock de Fatura detalhado */}
              <div className="lg:col-span-6 overflow-hidden">
                <div
                  aria-label="Demonstração de fatura de cartão de crédito"
                  className="rounded-2xl border border-border bg-card shadow-md p-4 sm:p-6 space-y-5 overflow-hidden"
                >
                  {/* Cabeçalho da Fatura */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-foreground">
                            Itaú Uniclass Visa
                          </h3>
                          <Badge className="bg-warning/15 text-warning border border-warning/30 hover:bg-warning/20 text-[10px] uppercase font-semibold">
                            PARCIAL
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Fechamento todo dia 05 • Vencimento todo dia 12
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-xs font-medium border-border bg-muted/50 text-foreground"
                    >
                      Novembro de 2026
                    </Badge>
                  </div>

                  {/* Resumo: Total, Ciclo e Status (Pago / Pendente / Mínimo) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl border border-border bg-background/60 space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Total da Fatura
                      </span>
                      <div className="text-2xl font-bold text-foreground">
                        R$ 3.480,00
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Vence 12/11/2026</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>Ciclo: 06/10/2026</span>
                        <ArrowRight className="w-3 h-3 inline" />
                        <span>05/11/2026</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-background/60 space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Status dos Pagamentos
                      </span>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5 text-success font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Pago
                          </span>
                          <span className="font-semibold text-foreground">
                            R$ 1.000,00
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5 text-warning font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                          <span className="font-semibold text-foreground">
                            R$ 2.480,00
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-border/70">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <DollarSign className="w-3.5 h-3.5 text-primary" />
                            Pagamento mínimo
                          </span>
                          <span className="font-semibold text-primary">
                            R$ 522,00
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Limite Compartilhado */}
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2 overflow-hidden">
                    <div className="flex justify-between items-center text-xs flex-wrap gap-1">
                      <span className="font-medium text-muted-foreground">
                        Limite compartilhado (Titular + 1 Adicional)
                      </span>
                      <span className="font-semibold text-foreground">
                        43% em uso
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-[43%] rounded-full bg-primary" />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground flex-wrap gap-1">
                      <span>Usado: R$ 3.480,00</span>
                      <span>Disponível: R$ 4.520,00 de R$ 8.000,00</span>
                    </div>
                  </div>

                  {/* Amostra de lançamentos titular + adicional */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border border-border/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground truncate">
                          Passagem Aérea (2/6)
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-border text-muted-foreground"
                        >
                          Viagem
                        </Badge>
                      </div>
                      <span className="font-semibold text-foreground shrink-0">
                        R$ 420,00
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border border-border/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground truncate">
                          Farmácia São João
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-primary/30 text-primary font-semibold"
                        >
                          ADICIONAL
                        </Badge>
                      </div>
                      <span className="font-semibold text-foreground shrink-0">
                        R$ 148,90
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seção #como-funciona: 3 Passos Numerados */}
        <section
          id="como-funciona"
          className="py-16 sm:py-20 border-t border-border/60 bg-muted/30 scroll-mt-16 overflow-hidden"
        >
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
              <Badge
                variant="outline"
                className="text-xs font-medium border-primary/30 text-primary bg-primary/5"
              >
                Simples do início ao fim
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                Como funciona na prática
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Três passos para sair das anotações soltas e ter clareza do seu dinheiro.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {steps.map((step) => (
                <Card
                  key={step.number}
                  className="border border-border bg-card shadow-sm relative overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center mb-3 shadow-sm">
                      {step.number}
                    </div>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      <h3>{step.title}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Seção 7: CTA Final em faixa com fundo bg-primary */}
        <section className="bg-primary text-primary-foreground py-14 sm:py-16 overflow-hidden">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary-foreground">
                  Comece a organizar seu mês hoje
                </h2>
                <p className="text-sm sm:text-base text-primary-foreground/90">
                  Crie sua conta gratuita em segundos e acompanhe cada centavo com tranquilidade.
                </p>
              </div>

              <Button
                size="lg"
                asChild
                className="h-12 px-8 bg-background text-foreground hover:bg-background/90 font-semibold text-base shrink-0 shadow-sm"
              >
                <Link to="/login?signup=1">
                  Criar conta grátis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-foreground">FinanSaaS</span>
            <span>• © {currentYear}</span>
          </div>

          <nav
            aria-label="Links do rodapé"
            className="flex flex-wrap items-center justify-center gap-5 text-sm"
          >
            <Link
              to="/login"
              className="hover:text-foreground transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/login?signup=1"
              className="hover:text-foreground transition-colors"
            >
              Criar conta
            </Link>
            <Link
              to="/forgot-password"
              className="hover:text-foreground transition-colors"
            >
              Esqueci minha senha
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
