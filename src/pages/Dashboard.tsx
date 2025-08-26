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
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  category: string;
  status: "paid" | "pending";
  isRecurring?: boolean;
  recurrenceType?: "monthly" | "yearly";
  recurrenceCount?: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  // Verificar autenticação
  useEffect(() => {
    if (!localStorage.getItem("isAuthenticated")) {
      navigate("/");
    }
  }, [navigate]);

  // Carregar transações mockadas
  useEffect(() => {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        type: "income",
        description: "Salário",
        amount: 5000,
        date: "2024-01-15",
        category: "Salário",
        status: "paid"
      },
      {
        id: "2",
        type: "expense",
        description: "Aluguel",
        amount: 1200,
        date: "2024-01-05",
        category: "Moradia",
        status: "paid"
      },
      {
        id: "3",
        type: "expense",
        description: "Supermercado",
        amount: 300,
        date: "2024-01-10",
        category: "Alimentação",
        status: "paid"
      },
      {
        id: "4",
        type: "expense",
        description: "Conta de Luz",
        amount: 150,
        date: "2024-01-20",
        category: "Contas",
        status: "pending"
      }
    ];
    setTransactions(mockTransactions);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  const addTransaction = (transaction: Omit<Transaction, "id">) => {
    const newTransaction = {
      ...transaction,
      id: Date.now().toString()
    };
    setTransactions(prev => [...prev, newTransaction]);
    setShowTransactionForm(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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
            <TransactionList
              transactions={currentMonthTransactions}
              onDelete={deleteTransaction}
              onUpdate={updateTransaction}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modal de Nova Transação */}
      {showTransactionForm && (
        <TransactionForm
          onSubmit={addTransaction}
          onClose={() => setShowTransactionForm(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;