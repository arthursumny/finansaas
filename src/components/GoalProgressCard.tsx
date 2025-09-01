import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Goal } from '@/hooks/useGoals';
import { Edit, Trash2, Target, Calendar, TrendingUp, TrendingDown, Plus } from 'lucide-react';

interface GoalProgressCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onUpdateAmount: (goal: Goal, amount: number) => void;
}

/**
 * Card para exibir o progresso de uma meta de economia
 */
export const GoalProgressCard = ({
  goal,
  onEdit,
  onDelete,
  onUpdateAmount,
}: GoalProgressCardProps) => {
  const [showAddAmountModal, setShowAddAmountModal] = useState(false);
  const [showRemoveAmountModal, setShowRemoveAmountModal] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [amountToRemove, setAmountToRemove] = useState('');

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
   * Formata data para exibição
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  /**
   * Calcula o progresso da meta em porcentagem
   */
  const getProgress = () => {
    if (goal.target_amount <= 0) return 0;
    const progress = (goal.current_amount / goal.target_amount) * 100;
    return Math.min(progress, 100);
  };

  /**
   * Calcula os dias restantes para a meta
   */
  const getDaysRemaining = () => {
    if (!goal.target_date) return null;
    const today = new Date();
    const targetDate = new Date(goal.target_date);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  /**
   * Retorna a variante do badge baseada no status
   */
  const getStatusBadgeVariant = () => {
    switch (goal.status) {
      case 'completed':
        return 'default';
      case 'active':
        return 'secondary';
      case 'paused':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  /**
   * Retorna o texto do status
   */
  const getStatusText = () => {
    switch (goal.status) {
      case 'completed':
        return 'Concluída';
      case 'active':
        return 'Ativa';
      case 'paused':
        return 'Pausada';
      default:
        return 'Ativa';
    }
  };

  /**
   * Abre o modal para adicionar valor
   */
  const handleAddAmount = () => {
    setShowAddAmountModal(true);
  };

  /**
   * Confirma a adição do valor
   */
  const handleConfirmAddAmount = () => {
    const amount = parseFloat(amountToAdd.replace(',', '.'));
    if (!isNaN(amount) && amount > 0) {
      onUpdateAmount(goal, amount);
    }
    setAmountToAdd('');
    setShowAddAmountModal(false);
  };

  /**
   * Cancela a adição do valor
   */
  const handleCancelAddAmount = () => {
    setAmountToAdd('');
    setShowAddAmountModal(false);
  };

  /**
   * Abre o modal para remover valor
   */
  const handleRemoveAmount = () => {
    setShowRemoveAmountModal(true);
  };

  /**
   * Confirma a remoção do valor
   */
  const handleConfirmRemoveAmount = () => {
    const amount = parseFloat(amountToRemove.replace(',', '.'));
    if (!isNaN(amount) && amount > 0) {
      onUpdateAmount(goal, -amount); // Valor negativo para remover
    }
    setAmountToRemove('');
    setShowRemoveAmountModal(false);
  };

  /**
   * Cancela a remoção do valor
   */
  const handleCancelRemoveAmount = () => {
    setAmountToRemove('');
    setShowRemoveAmountModal(false);
  };

  const progress = getProgress();
  const daysRemaining = getDaysRemaining();
  const isCompleted = goal.status === 'completed';
  const isOverdue = daysRemaining !== null && daysRemaining < 0 && !isCompleted;

  return (
    <>
      <Card className={`transition-all duration-200 hover:shadow-md ${
        isCompleted ? 'border-green-200 bg-green-50/50' : 
        isOverdue ? 'border-red-200 bg-red-50/50' : ''
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                {goal.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getStatusBadgeVariant()}>
                  {getStatusText()}
                </Badge>
                {goal.period && (
                  <Badge variant="outline" className="text-xs">
                    {goal.period === 'monthly' ? 'Mensal' : 'Anual'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(goal)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(goal)}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Descrição */}
          {goal.description && (
            <p className="text-sm text-muted-foreground">
              {goal.description}
            </p>
          )}

          {/* Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">
                Progresso
              </span>
              <span className="text-sm text-muted-foreground">
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={progress} 
              className={`h-2 ${
                isCompleted ? '[&>div]:bg-green-500' : 
                isOverdue ? '[&>div]:bg-red-500' : ''
              }`}
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(goal.current_amount)}
              </span>
              <span className="font-medium text-foreground">
                {formatCurrency(goal.target_amount)}
              </span>
            </div>
          </div>

          {/* Data da Meta */}
          {goal.target_date && (
            <div className="flex items-center justify-between text-sm">
              <span className={`font-medium ${
                isOverdue ? 'text-red-600' : 'text-foreground'
              }`}>
                Meta: {formatDate(goal.target_date)}
              </span>
              {daysRemaining !== null && (
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  isOverdue 
                    ? 'bg-red-100 text-red-800' 
                    : daysRemaining <= 7 
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                }`}>
                  {isOverdue 
                    ? `${Math.abs(daysRemaining)} dias em atraso`
                    : `${daysRemaining} dias restantes`
                  }
                </span>
              )}
            </div>
          )}

          {/* Botões de Adicionar e Remover Valor */}
          {!isCompleted && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleAddAmount}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
              {goal.current_amount > 0 && (
                <Button
                  onClick={handleRemoveAmount}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>
          )}

          {/* Mensagem de Conclusão */}
          {isCompleted && goal.completed_at && (
            <div className="bg-green-100 border border-green-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-green-800 font-medium">
                🎉 Meta concluída em {formatDate(goal.completed_at)}!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para Adicionar Valor */}
      <Dialog open={showAddAmountModal} onOpenChange={setShowAddAmountModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Valor à Meta</DialogTitle>
            <DialogDescription>
              Quanto você quer adicionar à meta "{goal.title}"?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Valor
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={amountToAdd}
                onChange={(e) => setAmountToAdd(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelAddAmount}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmAddAmount}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Remover Valor */}
      <Dialog open={showRemoveAmountModal} onOpenChange={setShowRemoveAmountModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Remover Valor da Meta</DialogTitle>
            <DialogDescription>
              Quanto você quer remover da meta "{goal.title}"?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="removeAmount" className="text-right">
                Valor
              </Label>
              <Input
                id="removeAmount"
                type="number"
                step="0.01"
                min="0"
                max={goal.current_amount}
                placeholder="0,00"
                value={amountToRemove}
                onChange={(e) => setAmountToRemove(e.target.value)}
                className="col-span-3"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Valor atual: {formatCurrency(goal.current_amount)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRemoveAmount}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmRemoveAmount} variant="destructive">
              <TrendingDown className="w-4 h-4 mr-2" />
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GoalProgressCard;