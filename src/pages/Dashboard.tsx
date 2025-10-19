import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  ArrowLeft,
  BarChart3,
  Download,
  Target,
  Menu,
  Upload,
  Info
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";
import { CategoryManager } from "@/components/CategoryManager";
import { BudgetManager } from "@/components/BudgetManager";
import { GoalManager } from "@/components/GoalManager";
import MonthlyEvolutionChart from "@/components/charts/MonthlyEvolutionChart";
import CategoryPieChart from "@/components/charts/CategoryPieChart";
import TransactionFiltersComponent from "@/components/filters/TransactionFilters";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useGoals } from "@/hooks/useGoals";
import { useTheme } from "@/contexts/ThemeContext";
import ExportModal from "@/components/ExportModal";
import RecurringUpdateModal from "@/components/RecurringUpdateModal";
import { ImportModal } from "@/components/ImportModal";
import BalanceDetailModal from "@/components/BalanceDetailModal";

const Dashboard = () => {
  const { theme } = useTheme();
  const actualTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showBudgetManager, setShowBudgetManager] = useState(false);
  const [showGoalManager, setShowGoalManager] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [recurringUpdateModal, setRecurringUpdateModal] = useState<{
    isOpen: boolean;
    transactionData?: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    fieldName?: string;
  }>({ isOpen: false });
  const [balanceDetailModal, setBalanceDetailModal] = useState<{
    isOpen: boolean;
    type: 'monthly' | 'accumulated';
  }>({ isOpen: false, type: 'monthly' });

  const { user, signOut } = useAuth();
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction, deleteMultipleTransactions, deleteAllRecurringTransactions, updateAllRecurringTransactions } = useTransactions();
  const { goals, loading: goalsLoading } = useGoals();
  
  // Hook para filtros avançados
  const {
    filters,
    filteredTransactions,
    isFiltersOpen,
    hasActiveFilters,
    activeFiltersCount,
    filteredStats,
    updateFilters,
    clearFilters,
    toggleFilters
  } = useTransactionFilters(transactions);

  const handleLogout = async () => {
    await signOut();
  };

  const handleAddTransaction = async (transactionData: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await addTransaction(transactionData);
    setShowTransactionForm(false);
  };

  const handleEditTransaction = async (transactionData: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingTransaction) {
      console.log('Editando transação:', {
        editingTransaction,
        transactionData,
        is_recurring: editingTransaction.is_recurring,
        recurrence_group_id: editingTransaction.recurrence_group_id
      });
      
      // Se for uma transação recorrente e algum campo foi alterado, perguntar se quer atualizar todas
      if (editingTransaction.is_recurring && editingTransaction.recurrence_group_id) {
        const changedFields = [];
        
        if (editingTransaction.category !== transactionData.category) {
          changedFields.push('a categoria');
        }
        if (editingTransaction.description !== transactionData.description) {
          changedFields.push('a descrição');
        }
        if (editingTransaction.amount !== transactionData.amount) {
           changedFields.push('o valor');
         }
         if (editingTransaction.type !== transactionData.type) {
           changedFields.push('o tipo');
         }
         if (editingTransaction.date !== transactionData.date) {
           changedFields.push('a data');
         }
         if (editingTransaction.status !== transactionData.status) {
           changedFields.push('o status');
         }
        
        console.log('Campos alterados:', changedFields);
        
        if (changedFields.length > 0) {
          const fieldName = changedFields.length === 1 
            ? changedFields[0] 
            : changedFields.slice(0, -1).join(', ') + ' e ' + changedFields[changedFields.length - 1];
          
          console.log('Abrindo modal para confirmar atualização de todas as transações');
          setRecurringUpdateModal({
            isOpen: true,
            transactionData,
            fieldName
          });
          return;
        }
      }
      
      console.log('Atualizando apenas esta transação');
      // Remove campos de recorrência para evitar duplicação
      const { is_recurring, recurrence_type, recurrence_count, ...cleanData } = transactionData;
      await updateTransaction(editingTransaction.id, cleanData);
      setEditingTransaction(null);
    }
  };

  const handleRecurringUpdateConfirm = async () => {
    if (editingTransaction && recurringUpdateModal.transactionData) {
      console.log('Confirmando atualização de todas as transações recorrentes');
      const old = editingTransaction;
      const newData = recurringUpdateModal.transactionData;
      const updates = {};
      const groupFields = ['type', 'description', 'amount', 'category', 'status'];
      for (let field of groupFields) {
        if (newData[field] !== old[field]) {
          updates[field] = newData[field];
        }
      }
      const dateChanged = newData.date !== old.date;
      // Remove campos de recorrência se presentes
      delete (updates as any).is_recurring;
      delete (updates as any).recurrence_type;
      delete (updates as any).recurrence_count;
      await updateAllRecurringTransactions(editingTransaction, updates);
      if (dateChanged) {
        await updateTransaction(editingTransaction.id, { date: newData.date });
      }
      setEditingTransaction(null);
      setRecurringUpdateModal({ isOpen: false });
    }
  };

  const handleRecurringUpdateCancel = async () => {
    if (editingTransaction && recurringUpdateModal.transactionData) {
      console.log('Cancelando atualização de todas - atualizando apenas esta transação');
      // Remove campos de recorrência para evitar duplicação
      const { is_recurring, recurrence_type, recurrence_count, ...cleanData } = recurringUpdateModal.transactionData;
      console.log('Dados limpos para atualização individual:', cleanData);
      await updateTransaction(editingTransaction.id, cleanData);
      setEditingTransaction(null);
      setRecurringUpdateModal({ isOpen: false });
    }
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  // Filtrar transações do mês atual
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const parseLocalDate = (dateString: string) => {
    // Converte 'yyyy-MM-dd' para Date local sem hora
    const [y, m, d] = dateString.split("-");
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };
  
  // Aplicar filtros avançados primeiro, depois filtro por mês (se não há filtro de data personalizado)
  const currentMonthTransactions = hasActiveFilters && (filters.dateStart || filters.dateEnd) 
    ? filteredTransactions // Se há filtro de data personalizado, usar apenas filtros avançados
    : filteredTransactions.filter(transaction => {
        const transactionDate = parseLocalDate(transaction.date);
        return transactionDate >= monthStart && transactionDate <= monthEnd;
      });

  // Calcular totais do mês (TODAS as transações do mês, pagas e pendentes)
  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = currentMonthTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyBalance = monthlyIncome - monthlyExpenses;

  // Calcular saldo acumulado progressivo mês a mês
  const calculateAccumulatedBalance = () => {
    const allPaidTransactions = transactions.filter(t => t.status === "paid");
    
    // Agrupar transações por mês/ano
    const transactionsByMonth = allPaidTransactions.reduce((acc, transaction) => {
      const transactionDate = parseLocalDate(transaction.date);
      const monthKey = format(transactionDate, "yyyy-MM");
      
      if (!acc[monthKey]) {
        acc[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (transaction.type === "income") {
        acc[monthKey].income += transaction.amount;
      } else {
        acc[monthKey].expenses += transaction.amount;
      }
      
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);
    
    // Ordenar meses e calcular saldo acumulado progressivo
    const sortedMonths = Object.keys(transactionsByMonth).sort();
    const currentMonthKey = format(currentDate, "yyyy-MM");
    let accumulatedBalance = 0;
    
    for (const monthKey of sortedMonths) {
      const monthBalance = transactionsByMonth[monthKey].income - transactionsByMonth[monthKey].expenses;
      accumulatedBalance += monthBalance;
      
      // Parar no mês atual (incluindo o mês atual)
      if (monthKey === currentMonthKey) {
        break;
      }
    }
    
    return accumulatedBalance;
  };

  const accumulatedBalance = calculateAccumulatedBalance();

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => 
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-secondary/20">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              {(showCategoryManager || showBudgetManager || showGoalManager) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCategoryManager(false);
                    setShowBudgetManager(false);
                    setShowGoalManager(false);
                  }}
                  className="h-9"
                >
                  <ArrowLeft className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>
              )}
              {showCategoryManager ? (
                <>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-2xl flex items-center justify-center">
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                      Categorias
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary hidden sm:block">
                      Gerenciar Categorias
                    </p>
                  </div>
                </>
              ) : showBudgetManager ? (
                <>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-2xl flex items-center justify-center">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                      Orçamentos
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary hidden sm:block">
                      Gerenciar Orçamentos por Categoria
                    </p>
                  </div>
                </>
              ) : showGoalManager ? (
                <>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-2xl flex items-center justify-center">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                      Metas de Economia
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary hidden sm:block">
                      Gerenciar Metas de Economia
                    </p>
                  </div>
                </>
              ) : (
                <img 
                  src={actualTheme === 'dark' ? '/logo_branca.png' : '/logo_preta.png'} 
                  alt="FinanSaaS Logo" 
                  className="h-10 sm:h-12 w-auto"
                />
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Menu hambúrguer para dispositivos móveis */}
              <div className="sm:hidden">
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 px-2 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                        title="Menu"
                      >
                        <Menu className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setShowCharts(!showCharts)}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        {showCharts ? "Ocultar Gráficos" : "Mostrar Gráficos"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar Dados
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowGoalManager(true)}>
                        <Target className="w-4 h-4 mr-2" />
                        Gerenciar Metas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowBudgetManager(true)}>
                        <Target className="w-4 h-4 mr-2" />
                        Gerenciar Orçamentos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCategoryManager(true)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Gerenciar Categorias
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Botões individuais para telas maiores */}
              <div className="hidden sm:flex items-center gap-2">
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant={showCharts ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCharts(!showCharts)}
                    className={`h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 ${showCharts ? 'bg-primary text-white' : 'border-secondary/30 hover:bg-card hover:border-secondary'}`}
                    title={showCharts ? "Ocultar gráficos" : "Mostrar gráficos"}
                  >
                    <BarChart3 className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">{showCharts ? "Ocultar" : "Gráficos"}</span>
                  </Button>
                )}
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                    className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                    title="Importar extrato"
                  >
                    <Upload className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Importar</span>
                  </Button>
                )}
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExportModal(true)}
                    className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                    title="Exportar dados"
                  >
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                )}
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGoalManager(true)}
                    className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                    title="Gerenciar metas"
                  >
                    <Target className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Metas</span>
                  </Button>
                )}
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBudgetManager(true)}
                    className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                    title="Gerenciar orçamentos"
                  >
                    <Target className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Orçamentos</span>
                  </Button>
                )}
                {!showCategoryManager && !showBudgetManager && !showGoalManager && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCategoryManager(true)}
                    className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary"
                  >
                    <Settings className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Categorias</span>
                  </Button>
                )}
              </div>

              {/* Botões sempre visíveis */}
              <div className="h-8 sm:h-9">
                <ThemeToggle />
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 sm:h-9 w-8 sm:w-auto px-2 sm:px-3 border-secondary/30 text-secondary hover:bg-card hover:border-secondary">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Navegação do Mês */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 border-secondary/30 hover:bg-card hover:border-secondary"
              >
                <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              <div className="text-center flex-1 mx-2 sm:mx-4">
                <CardTitle className="flex items-center justify-center gap-1 sm:gap-3 text-base sm:text-xl font-medium text-foreground">
                  <Calendar className="w-3 h-3 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-sm sm:text-xl">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 border-secondary/30 hover:bg-card hover:border-secondary"
              >
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Receitas</CardTitle>
              <div className="w-7 h-7 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-3 w-3 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-base sm:text-2xl font-semibold text-foreground">
                {formatCurrency(monthlyIncome)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Despesas</CardTitle>
              <div className="w-7 h-7 sm:w-10 sm:h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-3 w-3 sm:h-5 sm:w-5 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-base sm:text-2xl font-semibold text-foreground">
                {formatCurrency(monthlyExpenses)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">
                Balanço do Mês
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBalanceDetailModal({ isOpen: true, type: 'monthly' })}
                  className="h-6 w-6 p-0 hover:bg-muted/50"
                  title="Ver detalhes do cálculo"
                >
                  <Info className="h-3 w-3" />
                </Button>
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${monthlyBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                  <DollarSign className={`h-3 w-3 sm:h-5 sm:w-5 ${monthlyBalance >= 0 ? 'text-primary' : 'text-destructive'}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className={`text-base sm:text-2xl font-semibold ${monthlyBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(monthlyBalance)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Saldo Acumulado</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBalanceDetailModal({ isOpen: true, type: 'accumulated' })}
                  className="h-6 w-6 p-0 hover:bg-muted/50"
                  title="Ver detalhes do cálculo"
                >
                  <Info className="h-3 w-3" />
                </Button>
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-3 w-3 sm:h-5 sm:w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-base sm:text-2xl font-semibold text-primary">
                {formatCurrency(accumulatedBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo das Metas */}
        {!showCategoryManager && !showBudgetManager && !showGoalManager && goals && goals.filter(goal => goal.status === 'active').length > 0 && (
          <Card className="border-0 shadow-sm bg-card">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-medium text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Metas de Economia
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGoalManager(true)}
                  className="text-xs sm:text-sm"
                >
                  Ver Todas
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4">
              <div className="grid gap-3 sm:gap-4">
                {goals.filter(goal => goal.status === 'active').slice(0, 3).map((goal) => {
                  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                  const progressColor = progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-gray-300';
                  
                  return (
                    <div key={goal.id} className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm sm:text-base text-foreground">{goal.title}</h4>
                        <span className="text-xs sm:text-sm text-secondary">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm text-secondary">
                        <span>{formatCurrency(goal.current_amount)}</span>
                        <span>{formatCurrency(goal.target_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seção de Gráficos */}
        {showCharts && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
              <MonthlyEvolutionChart transactions={transactions} />
              <CategoryPieChart 
                transactions={currentMonthTransactions} 
                type="expense" 
                title="Despesas por Categoria"
              />
            </div>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
              <CategoryPieChart 
                transactions={currentMonthTransactions} 
                type="income" 
                title="Receitas por Categoria"
              />
            </div>
          </div>
        )}

        {/* Botão Adicionar Transação */}
        <div className="flex justify-center mb-4 sm:mb-6 px-3 sm:px-0">
          <Button
            onClick={() => setShowTransactionForm(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 sm:px-8 sm:py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 sm:gap-3 text-sm sm:text-base h-10 sm:h-12 w-full sm:w-auto max-w-xs sm:max-w-none"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Nova Transação
          </Button>
        </div>

        {/* Filtros Avançados */}
        <TransactionFiltersComponent
          filters={filters}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
          isOpen={isFiltersOpen}
          onToggle={toggleFilters}
          activeFiltersCount={activeFiltersCount}
          transactions={transactions}
        />



        {/* Lista de Transações */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-4 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-medium text-foreground">
              {hasActiveFilters ? 'Transações Filtradas' : 'Transações do Mês'}
            </CardTitle>
            <CardDescription className="text-sm text-secondary">
              {currentMonthTransactions.length} transação(ões) {hasActiveFilters ? 'encontrada(s)' : 'registrada(s)'}
              {hasActiveFilters && (
                <span className="ml-2 text-primary font-medium">
                  ({activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <TransactionList
                transactions={currentMonthTransactions}
                onDelete={deleteTransaction}
                onUpdate={updateTransaction}
                onEdit={handleOpenEdit}
                onDeleteAllRecurring={deleteAllRecurringTransactions}
                onDeleteMultiple={deleteMultipleTransactions}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Nova Transação */}
      {showTransactionForm && (
        <TransactionForm
          onSubmit={handleAddTransaction}
          onClose={() => setShowTransactionForm(false)}
        />
      )}

      {/* Modal de Edição de Transação */}
      {editingTransaction && (
        <TransactionForm
          initialData={editingTransaction}
          onSubmit={handleEditTransaction}
          onClose={() => setEditingTransaction(null)}
          isEditing={true}
        />
      )}

      {/* Modal de Exportação */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        transactions={transactions}
      />

      {/* Modal de Importação */}
      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
      />

      {/* Gerenciador de Categorias */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="container mx-auto px-4 sm:px-6 py-6">
            <CategoryManager onBack={() => setShowCategoryManager(false)} />
          </div>
        </div>
      )}

      {/* Gerenciador de Orçamentos */}
      {showBudgetManager && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="container mx-auto px-4 sm:px-6 py-6">
            <BudgetManager onBack={() => setShowBudgetManager(false)} />
          </div>
        </div>
      )}

      {/* Gerenciador de Metas */}
      {showGoalManager && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="container mx-auto px-4 sm:px-6 py-6">
            <GoalManager onBack={() => setShowGoalManager(false)} />
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Transações Recorrentes */}
      <RecurringUpdateModal
        isOpen={recurringUpdateModal.isOpen}
        onConfirm={handleRecurringUpdateConfirm}
        onCancel={handleRecurringUpdateCancel}
        fieldName={recurringUpdateModal.fieldName || ''}
      />

      {/* Modal de Detalhamento do Balanço */}
      <BalanceDetailModal
        isOpen={balanceDetailModal.isOpen}
        onClose={() => setBalanceDetailModal({ isOpen: false, type: 'monthly' })}
        type={balanceDetailModal.type}
        transactions={transactions}
        currentDate={currentDate}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        monthlyBalance={monthlyBalance}
        accumulatedBalance={accumulatedBalance}
      />
    </div>
  );
};

export default Dashboard;