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
  LogOut
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";

const Dashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { user, signOut } = useAuth();
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction, deleteAllRecurringTransactions } = useTransactions();

  const handleLogout = async () => {
    await signOut();
  };

  const handleAddTransaction = async (transactionData: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await addTransaction(transactionData);
    setShowTransactionForm(false);
  };

  const handleEditTransaction = async (transactionData: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, transactionData);
      setEditingTransaction(null);
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
  
  const currentMonthTransactions = transactions.filter(transaction => {
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
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-2xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">FinanceApp</h1>
                <p className="text-xs sm:text-sm text-secondary hidden sm:block">Controle Financeiro Pessoal</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="h-9 border-secondary/30 text-secondary hover:bg-card hover:border-secondary">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Navegação do Mês */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-4 px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-9 w-9 p-0 border-secondary/30 hover:bg-card hover:border-secondary"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center flex-1 mx-4">
                <CardTitle className="flex items-center justify-center gap-2 sm:gap-3 text-lg sm:text-xl font-medium text-foreground">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-sm sm:text-xl">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
                className="h-9 w-9 p-0 border-secondary/30 hover:bg-card hover:border-secondary"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Receitas</CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-semibold text-foreground">
                {formatCurrency(monthlyIncome)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Despesas</CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-semibold text-foreground">
                {formatCurrency(monthlyExpenses)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">
                Balanço do Mês
              </CardTitle>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${monthlyBalance >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                <DollarSign className={`h-4 w-4 sm:h-5 sm:w-5 ${monthlyBalance >= 0 ? 'text-primary' : 'text-destructive'}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className={`text-lg sm:text-2xl font-semibold ${monthlyBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(monthlyBalance)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-card col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-secondary">Saldo Acumulado</CardTitle>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-semibold text-primary">
                {formatCurrency(accumulatedBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botão Adicionar Transação */}
        <div className="flex justify-center px-4">
          <Button 
            onClick={() => setShowTransactionForm(true)}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-white shadow-lg px-6 sm:px-8 py-3 h-12 rounded-xl font-medium w-full sm:w-auto transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Transação
          </Button>
        </div>

        {/* Lista de Transações */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="pb-4 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-medium text-foreground">Transações do Mês</CardTitle>
            <CardDescription className="text-sm text-secondary">
              {currentMonthTransactions.length} transação(ões) registrada(s)
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
          isEditing={true}
        />
      )}
    </div>
  );
};

export default Dashboard;