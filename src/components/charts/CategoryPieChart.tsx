import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction } from '@/hooks/useTransactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CategoryPieChartProps {
  transactions: Transaction[];
  type?: 'income' | 'expense';
  title?: string;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

/**
 * Componente de gráfico de pizza mostrando distribuição por categorias
 * Pode exibir receitas ou despesas separadamente
 */
const CategoryPieChart = ({ 
  transactions, 
  type = 'expense',
  title 
}: CategoryPieChartProps) => {
  
  // Cores predefinidas para as categorias
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--destructive))',
    'hsl(220, 70%, 50%)',
    'hsl(280, 70%, 50%)',
    'hsl(160, 70%, 50%)',
    'hsl(30, 70%, 50%)',
    'hsl(200, 70%, 50%)',
    'hsl(320, 70%, 50%)',
    'hsl(60, 70%, 50%)',
    'hsl(120, 70%, 50%)'
  ];

  /**
   * Processa os dados das transações para gerar dados do gráfico
   * Agrupa transações por categoria e calcula totais
   */
  const chartData = useMemo(() => {
    // Filtrar transações pelo tipo e status pago
    const filteredTransactions = transactions.filter(
      transaction => transaction.type === type && transaction.status === 'paid'
    );

    // Agrupar por categoria
    const categoryTotals = filteredTransactions.reduce((acc, transaction) => {
      const category = transaction.category;
      acc[category] = (acc[category] || 0) + transaction.amount;
      return acc;
    }, {} as Record<string, number>);

    // Calcular total geral
    const totalAmount = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);

    // Converter para formato do gráfico
    const data: CategoryData[] = Object.entries(categoryTotals)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
        percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value); // Ordenar por valor decrescente

    return data;
  }, [transactions, type]);

  /**
   * Formata valores monetários para exibição
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
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-1">{data.name}</p>
          <p className="text-sm text-secondary">
            {formatCurrency(data.value)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  /**
   * Componente customizado para renderizar labels no gráfico
   */
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 5) return null; // Não mostrar label para fatias muito pequenas
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${percentage.toFixed(0)}%`}
      </text>
    );
  };

  const chartTitle = title || (type === 'expense' ? 'Distribuição de Despesas' : 'Distribuição de Receitas');
  const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <PieChartIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium text-foreground">
                {chartTitle}
              </CardTitle>
              <CardDescription className="text-sm text-secondary">
                Por categoria
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-secondary">
            <PieChartIcon className="w-16 h-16 mb-4 opacity-40" />
            <p className="text-lg font-medium">Nenhum dado disponível</p>
            <p className="text-sm opacity-75">
              {type === 'expense' ? 'Nenhuma despesa' : 'Nenhuma receita'} registrada
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <PieChartIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-medium text-foreground">
              {chartTitle}
            </CardTitle>
            <CardDescription className="text-sm text-secondary">
              Total: {formatCurrency(totalAmount)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico */}
          <div className="h-64" data-chart="category-pie">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legenda com valores */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground mb-3">Categorias</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {chartData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(item.value)}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryPieChart;