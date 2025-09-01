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
  Target
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";
import { CategoryManager } from "@/components/CategoryManager";
import { BudgetManager } from "@/components/BudgetManager";
import MonthlyEvolutionChart from "@/components/charts/MonthlyEvolutionChart";
import CategoryPieChart from "@/components/charts/CategoryPieChart";
import TransactionFiltersComponent from "@/components/filters/TransactionFilters";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTheme } from "@/contexts/ThemeContext";
import ExportModal from "@/components/ExportModal";
import RecurringUpdateModal from "@/components/RecurringUpdateModal";

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
  const [showCharts, setShowCharts] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [recurringUpdateModal, setRecurringUpdateModal] = useState<{
    isOpen: boolean;
    transactionData?: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    fieldName?: string;
  }>({ isOpen: false });

  const { user, signOut } = useAuth();
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction, deleteAllRecurringTransactions, updateAllRecurringTransactions } = useTransactions();
  
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
        
        if (changedFields.length > 0) {
          const fieldName = changedFields.length === 1 
            ? changedFields[0] 
            : changedFields.slice(0, -1).join(', ') + ' e ' + changedFields[changedFields.length - 1];
          
          setRecurringUpdateModal({
            isOpen: true,
            transactionData,
            fieldName
          });
          return;
        }
      }
      
      await updateTransaction(editingTransaction.id, transactionData);
      setEditingTransaction(null);
    }
  };

  const handleRecurringUpdateConfirm = async () => {
    if (editingTransaction && recurringUpdateModal.transactionData) {
      await updateAllRecurringTransactions(editingTransaction, recurringUpdateModal.transactionData);
      setEditingTransaction(null);
      setRecurringUpdateModal({ isOpen: false });
    }
  };

  const handleRecurringUpdateCancel = async () => {
    if (editingTransaction && recurringUpdateModal.transactionData) {
      await updateTransaction(editingTransaction.id, recurringUpdateModal.transactionData);
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

  // Calcular totais
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
              {(showCategoryManager || showBudgetManager) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCategoryManager(false);
                    setShowBudgetManager(false);
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
              ) : (
                <img 
                  src={actualTheme === 'dark' ? '/logo_branca.png' : '/logo_preta.png'} 
                  alt="FinanSaaS Logo" 
                  className="h-10 sm:h-12 w-auto"
                />
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {!showCategoryManager && !showBudgetManager && (
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
              {!showCategoryManager && !showBudgetManager && (
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
              {!showCategoryManager && !showBudgetManager && (
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
              {!showCategoryManager && !showBudgetManager && (
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
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${monthlyBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                <DollarSign className={`h-3 w-3 sm:h-5 sm:w-5 ${monthlyBalance >= 0 ? 'text-primary' : 'text-destructive'}`} />
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
              <div className="w-7 h-7 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <DollarSign className="h-3 w-3 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-base sm:text-2xl font-semibold text-primary">
                {formatCurrency(accumulatedBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

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
        />
      )}

      {/* Modal de Exportação */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        transactions={transactions}
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

      {/* Modal de Confirmação para Transações Recorrentes */}
      <RecurringUpdateModal
        isOpen={recurringUpdateModal.isOpen}
        onConfirm={handleRecurringUpdateConfirm}
        onCancel={handleRecurringUpdateCancel}
        fieldName={recurringUpdateModal.fieldName || ''}
      />
    </div>
  );
};

export default Dashboard;