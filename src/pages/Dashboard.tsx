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
  const { user, signOut } = useAuth();
  const { transactions, loading, addTransaction, updateTransaction, deleteTransaction } = useTransactions();

  const handleLogout = async () => {
    await signOut();
  };

  const handleAddTransaction = async (transactionData: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await addTransaction(transactionData);
    setShowTransactionForm(false);
  };

  // Filtrar transações do mês atual
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const currentMonthTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date);
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

  // Calcular saldo acumulado (mockado)
  const accumulatedBalance = 2500 + monthlyBalance;

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
      <div className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">FinanceApp</h1>
                <p className="text-sm text-muted-foreground">Controle Financeiro</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Navegação do Mês */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-income-light border-income/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-income">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-income" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-income">
                {formatCurrency(monthlyIncome)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-expense-light border-expense/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-expense">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-expense" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense">
                {formatCurrency(monthlyExpenses)}
              </div>
            </CardContent>
          </Card>

          <Card className={`${monthlyBalance >= 0 ? 'bg-success-light border-success/20' : 'bg-expense-light border-expense/20'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${monthlyBalance >= 0 ? 'text-success' : 'text-expense'}`}>
                Balanço do Mês
              </CardTitle>
              <DollarSign className={`h-4 w-4 ${monthlyBalance >= 0 ? 'text-success' : 'text-expense'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${monthlyBalance >= 0 ? 'text-success' : 'text-expense'}`}>
                {formatCurrency(monthlyBalance)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary-light border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Saldo Acumulado</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(accumulatedBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botão Adicionar Transação */}
        <div className="flex justify-center">
          <Button 
            onClick={() => setShowTransactionForm(true)}
            size="lg"
            variant="primary"
            className="shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Transação
          </Button>
        </div>

        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações do Mês</CardTitle>
            <CardDescription>
              {currentMonthTransactions.length} transação(ões) registrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <TransactionList
                transactions={currentMonthTransactions}
                onDelete={deleteTransaction}
                onUpdate={updateTransaction}
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
    </div>
  );
};

export default Dashboard;