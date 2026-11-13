import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, transactionMonth } from '@/hooks/useTransactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface MonthlyEvolutionChartProps {
  transactions: Transaction[];
}

interface ChartData {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

/**
 * Componente de gráfico de evolução mensal mostrando receitas vs despesas
 * Exibe os últimos 6 meses de dados financeiros
 */
const MonthlyEvolutionChart = ({ transactions }: MonthlyEvolutionChartProps) => {
  /**
   * Processa os dados das transações para gerar dados do gráfico
   * Agrupa transações por mês e calcula totais de receitas e despesas
   */
  const chartData = useMemo(() => {
    const data: ChartData[] = [];
    const currentDate = new Date();
    
    // Gerar dados para os últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentDate, i);
      const monthKey = format(monthDate, 'yyyy-MM');
      
      // Filtrar lançamentos pela competência do mês (fatura do cartão quando houver),
      // independente do status
      const monthTransactions = transactions.filter(
        transaction => transactionMonth(transaction) === monthKey
      );
      
      // Calcular totais
      const receitas = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const despesas = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        month: format(monthDate, 'MMM/yy', { locale: ptBR }),
        receitas,
        despesas,
        saldo: receitas - despesas
      });
    }
    
    return data;
  }, [transactions]);

  /**
   * Formata valores monetários para exibição no tooltip
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * Componente customizado para o tooltip do gráfico
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-medium text-foreground">
              Evolução Mensal
            </CardTitle>
            <CardDescription className="text-sm text-secondary">
              Receitas vs Despesas - Últimos 6 meses
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80" data-chart="monthly-evolution">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="month" 
                className="text-xs text-secondary"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                className="text-xs text-secondary"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => 
                  new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(value)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '14px' }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="receitas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                name="Receitas"
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="despesas" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={3}
                name="Despesas"
                dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--destructive))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyEvolutionChart;
