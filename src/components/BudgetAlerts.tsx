import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Eye } from 'lucide-react';
import { Budget, BudgetStatus } from '@/hooks/useBudgets';
import { Category } from '@/hooks/useCategories';

interface BudgetAlertsProps {
  budgets: Budget[];
  budgetStatuses: Record<string, BudgetStatus>;
  categories: Category[];
  onViewBudget?: (budgetId: string) => void;
}

/**
 * Componente para exibir alertas de orçamentos próximos ou acima do limite
 */
export const BudgetAlerts = ({
  budgets,
  budgetStatuses,
  categories,
  onViewBudget,
}: BudgetAlertsProps) => {
  /**
   * Formata valor monetário para exibição
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  /**
   * Obtém o nome da categoria pelo ID
   */
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Categoria não encontrada';
  };

  /**
   * Filtra orçamentos que precisam de alerta
   */
  const getAlertsData = () => {
    const alerts: {
      budget: Budget;
      status: BudgetStatus;
      type: 'exceeded' | 'warning';
      severity: 'high' | 'medium';
    }[] = [];

    budgets.forEach(budget => {
      const status = budgetStatuses[budget.id];
      if (!status) return;

      // Orçamento excedido (acima de 100%)
      if (status.isOverBudget) {
        alerts.push({
          budget,
          status,
          type: 'exceeded',
          severity: 'high',
        });
      }
      // Orçamento próximo do limite (acima de 80%)
      else if (status.percentage >= 80) {
        alerts.push({
          budget,
          status,
          type: 'warning',
          severity: 'medium',
        });
      }
    });

    // Ordenar por severidade e depois por porcentagem
    return alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'high' ? -1 : 1;
      }
      return b.status.percentage - a.status.percentage;
    });
  };

  const alerts = getAlertsData();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h3 className="text-lg font-semibold text-foreground">
          Alertas de Orçamento
        </h3>
        <Badge variant="secondary" className="ml-auto">
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </Badge>
      </div>

      {alerts.map(({ budget, status, type, severity }) => {
        const categoryName = getCategoryName(budget.category_id);
        const isExceeded = type === 'exceeded';
        
        return (
          <Alert
            key={budget.id}
            className={`border-l-4 ${
              isExceeded
                ? 'border-l-destructive bg-destructive/5'
                : 'border-l-warning bg-warning/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {isExceeded ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-warning" />
                  )}
                  <span className="font-medium text-foreground">
                    {categoryName}
                  </span>
                  <Badge
                    variant={isExceeded ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {status.percentage.toFixed(0)}%
                  </Badge>
                </div>

                <AlertDescription className="text-sm">
                  {isExceeded ? (
                    <>
                      <span className="font-medium text-destructive">
                        Orçamento excedido!
                      </span>
                      {' '}Você gastou{' '}
                      <span className="font-medium">
                        {formatCurrency(status.spent)}
                      </span>
                      {' '}de um orçamento de{' '}
                      <span className="font-medium">
                        {formatCurrency(budget.amount)}
                      </span>
                      . Excesso de{' '}
                      <span className="font-medium text-destructive">
                        {formatCurrency(Math.abs(status.remaining))}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-warning">
                        Atenção!
                      </span>
                      {' '}Você já gastou{' '}
                      <span className="font-medium">
                        {formatCurrency(status.spent)}
                      </span>
                      {' '}de{' '}
                      <span className="font-medium">
                        {formatCurrency(budget.amount)}
                      </span>
                      . Restam{' '}
                      <span className="font-medium">
                        {formatCurrency(status.remaining)}
                      </span>
                      .
                    </>
                  )}
                </AlertDescription>

                {/* Barra de progresso */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isExceeded
                        ? 'bg-destructive'
                        : status.percentage >= 80
                        ? 'bg-warning'
                        : 'bg-primary'
                    }`}
                    style={{
                      width: `${Math.min(status.percentage, 100)}%`,
                    }}
                  />
                  {/* Barra adicional para valores acima de 100% */}
                  {status.percentage > 100 && (
                    <div
                      className="h-full bg-destructive/60 absolute top-0"
                      style={{
                        left: '100%',
                        width: `${Math.min(status.percentage - 100, 50)}%`,
                      }}
                    />
                  )}
                </div>

                {/* Informações do período */}
                <div className="text-xs text-muted-foreground">
                  Período: {budget.period === 'monthly' ? 'Mensal' : 'Anual'}
                  {budget.period === 'monthly' && (
                    <span className="ml-2">
                      • {new Date().toLocaleDateString('pt-BR', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Botão para visualizar detalhes */}
              {onViewBudget && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewBudget(budget.id)}
                  className="shrink-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Alert>
        );
      })}

      {/* Resumo dos alertas */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              {alerts.filter(a => a.type === 'exceeded').length} orçamento(s) excedido(s)
            </span>
            <span>
              {alerts.filter(a => a.type === 'warning').length} próximo(s) do limite
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};