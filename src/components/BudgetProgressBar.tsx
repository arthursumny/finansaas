import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { BudgetStatus } from '@/hooks/useBudgets';

interface BudgetProgressBarProps {
  status: BudgetStatus;
  categoryName: string;
  budgetAmount: number;
  period: 'monthly' | 'yearly';
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Componente para exibir barra de progresso visual do orçamento
 */
export const BudgetProgressBar = ({
  status,
  categoryName,
  budgetAmount,
  period,
  showDetails = true,
  size = 'md',
}: BudgetProgressBarProps) => {
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
   * Obtém a cor da barra de progresso baseada na porcentagem
   */
  const getProgressColor = () => {
    if (status.isOverBudget) return 'bg-destructive';
    if (status.percentage >= 80) return 'bg-warning';
    if (status.percentage >= 60) return 'bg-yellow-500';
    return 'bg-primary';
  };

  /**
   * Obtém o ícone baseado no status do orçamento
   */
  const getStatusIcon = () => {
    if (status.isOverBudget) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (status.percentage >= 80) {
      return <TrendingUp className="h-4 w-4 text-warning" />;
    }
    if (status.percentage <= 50) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-blue-600" />;
  };

  /**
   * Obtém o texto de status
   */
  const getStatusText = () => {
    if (status.isOverBudget) {
      return 'Excedido';
    }
    if (status.percentage >= 80) {
      return 'Atenção';
    }
    if (status.percentage <= 50) {
      return 'Saudável';
    }
    return 'Moderado';
  };

  /**
   * Obtém a variante do badge baseada no status
   */
  const getBadgeVariant = () => {
    if (status.isOverBudget) return 'destructive';
    if (status.percentage >= 80) return 'secondary';
    return 'default';
  };

  /**
   * Obtém o tamanho da barra baseado na prop size
   */
  const getBarHeight = () => {
    switch (size) {
      case 'sm': return 'h-2';
      case 'lg': return 'h-4';
      default: return 'h-3';
    }
  };

  /**
   * Obtém o tamanho do texto baseado na prop size
   */
  const getTextSize = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  const progressValue = Math.min(status.percentage, 100);
  const overflowPercentage = Math.max(status.percentage - 100, 0);

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Cabeçalho com nome da categoria e status */}
        {showDetails && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-foreground ${getTextSize()}`}>
                {categoryName}
              </span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant()} className="text-xs">
                {status.percentage.toFixed(0)}%
              </Badge>
              <span className={`text-muted-foreground ${getTextSize()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        )}

        {/* Barra de progresso */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`w-full bg-muted rounded-full ${getBarHeight()} overflow-hidden cursor-help`}>
                {/* Barra principal (até 100%) */}
                <div
                  className={`${getBarHeight()} transition-all duration-500 ease-out ${getProgressColor()}`}
                  style={{ width: `${progressValue}%` }}
                />
                
                {/* Barra de overflow (acima de 100%) */}
                {status.isOverBudget && (
                  <div
                    className={`${getBarHeight()} bg-destructive/60 absolute top-0 transition-all duration-500 ease-out`}
                    style={{
                      left: '100%',
                      width: `${Math.min(overflowPercentage, 50)}%`,
                    }}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <div className="font-medium">{categoryName}</div>
                <div>Gasto: {formatCurrency(status.spent)}</div>
                <div>Orçamento: {formatCurrency(budgetAmount)}</div>
                <div className={status.isOverBudget ? 'text-destructive' : 'text-green-600'}>
                  {status.isOverBudget ? 'Excesso' : 'Restante'}: {formatCurrency(Math.abs(status.remaining))}
                </div>
                <div>Período: {period === 'monthly' ? 'Mensal' : 'Anual'}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Detalhes financeiros */}
        {showDetails && (
          <div className="flex items-center justify-between">
            <div className={`text-muted-foreground ${getTextSize()}`}>
              <span className="font-medium text-foreground">
                {formatCurrency(status.spent)}
              </span>
              {' de '}
              <span className="font-medium">
                {formatCurrency(budgetAmount)}
              </span>
            </div>
            <div className={`${getTextSize()} ${
              status.isOverBudget ? 'text-destructive' : 'text-green-600'
            }`}>
              {status.isOverBudget ? (
                <>
                  <span className="font-medium">Excesso: </span>
                  {formatCurrency(Math.abs(status.remaining))}
                </>
              ) : (
                <>
                  <span className="font-medium">Restante: </span>
                  {formatCurrency(status.remaining)}
                </>
              )}
            </div>
          </div>
        )}

        {/* Informação do período */}
        {showDetails && size !== 'sm' && (
          <div className="text-xs text-muted-foreground">
            {period === 'monthly' ? (
              <>
                Orçamento mensal • {new Date().toLocaleDateString('pt-BR', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </>
            ) : (
              <>
                Orçamento anual • {new Date().getFullYear()}
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

/**
 * Componente simplificado para exibir múltiplas barras de progresso
 */
interface BudgetProgressListProps {
  budgets: Array<{
    id: string;
    categoryName: string;
    budgetAmount: number;
    period: 'monthly' | 'yearly';
    status: BudgetStatus;
  }>;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  maxItems?: number;
}

export const BudgetProgressList = ({
  budgets,
  size = 'md',
  showDetails = true,
  maxItems,
}: BudgetProgressListProps) => {
  const displayBudgets = maxItems ? budgets.slice(0, maxItems) : budgets;
  const hasMore = maxItems && budgets.length > maxItems;

  // Ordenar por porcentagem (maior primeiro)
  const sortedBudgets = [...displayBudgets].sort((a, b) => b.status.percentage - a.status.percentage);

  return (
    <div className="space-y-4">
      {sortedBudgets.map((budget) => (
        <BudgetProgressBar
          key={budget.id}
          status={budget.status}
          categoryName={budget.categoryName}
          budgetAmount={budget.budgetAmount}
          period={budget.period}
          showDetails={showDetails}
          size={size}
        />
      ))}
      
      {hasMore && (
        <div className="text-center text-sm text-muted-foreground pt-2">
          +{budgets.length - maxItems!} orçamento(s) adicional(is)
        </div>
      )}
    </div>
  );
};