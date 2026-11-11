import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Transaction } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Receipt } from 'lucide-react';

interface BalanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'monthly' | 'accumulated';
  transactions: Transaction[];
  currentDate: Date;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBalance: number;
  accumulatedBalance: number;
}

interface TransactionBreakdown {
  category: string;
  amount: number;
  count: number;
  transactions: Transaction[];
}

const BalanceDetailModal: React.FC<BalanceDetailModalProps> = ({
  isOpen,
  onClose,
  type,
  transactions,
  currentDate,
  monthlyIncome,
  monthlyExpenses,
  monthlyBalance,
  accumulatedBalance
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(new Date(date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR });
  };

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const previousMonthBalance = transactions
    .filter(transaction => (
      transaction.status === 'paid' &&
      new Date(transaction.date + 'T00:00:00') < monthStart
    ))
    .reduce((sum, transaction) => (
      transaction.type === 'income'
        ? sum + transaction.amount
        : sum - transaction.amount
    ), 0);

  const monthlyNet = monthlyIncome - monthlyExpenses;

  // Filtrar todas as transações lançadas no mês atual
  const currentMonthTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.date + 'T00:00:00');
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });

  // Calcular breakdown por categoria
  const getBreakdownByCategory = (transactions: Transaction[], transactionType: 'income' | 'expense') => {
    const filtered = transactions.filter(t => t.type === transactionType);
    
    const breakdown: Record<string, TransactionBreakdown> = {};
    
    filtered.forEach(transaction => {
      if (!breakdown[transaction.category]) {
        breakdown[transaction.category] = {
          category: transaction.category,
          amount: 0,
          count: 0,
          transactions: []
        };
      }
      breakdown[transaction.category].amount += transaction.amount;
      breakdown[transaction.category].count += 1;
      breakdown[transaction.category].transactions.push(transaction);
    });

    return Object.values(breakdown).sort((a, b) => b.amount - a.amount);
  };

  const incomeBreakdown = getBreakdownByCategory(currentMonthTransactions, 'income');
  const expenseBreakdown = getBreakdownByCategory(currentMonthTransactions, 'expense');

  // Para saldo atual, calcular histórico mensal com transações confirmadas
  const getMonthlyHistory = () => {
    const allPaidTransactions = transactions.filter(t => t.status === "paid");
    
    // Agrupar transações por mês/ano
    const transactionsByMonth = allPaidTransactions.reduce((acc, transaction) => {
      const transactionDate = new Date(transaction.date + 'T00:00:00');
      const monthKey = format(transactionDate, "yyyy-MM");
      
      if (!acc[monthKey]) {
        acc[monthKey] = { income: 0, expenses: 0, transactions: [] };
      }
      
      if (transaction.type === "income") {
        acc[monthKey].income += transaction.amount;
      } else {
        acc[monthKey].expenses += transaction.amount;
      }
      
      acc[monthKey].transactions.push(transaction);
      
      return acc;
    }, {} as Record<string, { income: number; expenses: number; transactions: Transaction[] }>);
    
    // Ordenar meses e calcular saldo atual progressivo
    const sortedMonths = Object.keys(transactionsByMonth).sort();
    const currentMonthKey = format(currentDate, "yyyy-MM");
    let accumulatedBalance = 0;
    
    return sortedMonths.filter(monthKey => monthKey <= currentMonthKey).map(monthKey => {
      const monthData = transactionsByMonth[monthKey];
      const monthBalance = monthData.income - monthData.expenses;
      accumulatedBalance += monthBalance;
      
      return {
        month: monthKey,
        monthName: format(new Date(monthKey + '-01'), "MMMM 'de' yyyy", { locale: ptBR }),
        income: monthData.income,
        expenses: monthData.expenses,
        balance: monthBalance,
        accumulatedBalance: accumulatedBalance,
        isCurrentMonth: monthKey === currentMonthKey
      };
    }).filter(month => month.accumulatedBalance !== 0 || month.isCurrentMonth);
  };

  const monthlyHistory = getMonthlyHistory();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {type === 'monthly' ? 'Detalhamento do Balanço do Mês' : 'Detalhamento do Saldo Atual'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {type === 'monthly' ? 'Resumo do Mês' : 'Resumo do Saldo Atual'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">Receitas do Mês</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(monthlyIncome)}
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">Despesas do Mês</div>
                  <div className="text-lg font-semibold text-red-600">
                    {formatCurrency(monthlyExpenses)}
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">
                    {type === 'monthly' ? 'Balanço do Mês' : 'Saldo Atual'}
                  </div>
                  <div className={`text-lg font-semibold ${(type === 'monthly' ? monthlyBalance : accumulatedBalance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(type === 'monthly' ? monthlyBalance : accumulatedBalance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {type === 'monthly' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Composição do Balanço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Saldo do Mês Anterior</div>
                      <div className={`font-semibold ${previousMonthBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(previousMonthBalance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Receitas - Despesas</div>
                      <div className={`font-semibold ${monthlyNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(monthlyNet)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Balanço do Mês</div>
                      <div className={`font-semibold ${monthlyBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(monthlyBalance)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown de Receitas */}
              {incomeBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      Receitas por Categoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {incomeBreakdown.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                              {category.count} transação{category.count > 1 ? 'ões' : ''}
                            </Badge>
                            <span className="font-medium">{category.category}</span>
                          </div>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(category.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Breakdown de Despesas */}
              {expenseBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="w-4 h-4" />
                      Despesas por Categoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {expenseBreakdown.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                              {category.count} transação{category.count > 1 ? 'ões' : ''}
                            </Badge>
                            <span className="font-medium">{category.category}</span>
                          </div>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(category.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Transações Detalhadas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Transações do Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {currentMonthTransactions.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Nenhuma transação encontrada para este mês.
                      </div>
                    ) : (
                      currentMonthTransactions
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((transaction, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div>
                                <div className="font-medium">{transaction.description}</div>
                                <div className="text-sm text-muted-foreground">
                                  {transaction.category} • {formatDate(transaction.date)}
                                </div>
                              </div>
                            </div>
                            <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* Histórico mensal para saldo atual */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Histórico Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyHistory.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum histórico encontrado.
                    </div>
                  ) : (
                    monthlyHistory.map((month, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${month.isCurrentMonth ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">{month.monthName}</h4>
                          {month.isCurrentMonth && (
                            <Badge variant="default">Mês Atual</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Receitas</div>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(month.income)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Despesas</div>
                            <div className="font-semibold text-red-600">
                              {formatCurrency(month.expenses)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Balanço</div>
                            <div className={`font-semibold ${month.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(month.balance)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Acumulado</div>
                            <div className={`font-semibold ${month.accumulatedBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(month.accumulatedBalance)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BalanceDetailModal;
