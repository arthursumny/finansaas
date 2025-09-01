import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, TrendingDown, ArrowLeft, AlertTriangle, Target } from 'lucide-react';
import { useBudgets, Budget, BudgetFormData, BudgetStatus } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { BudgetEditModal } from './BudgetEditModal';

interface BudgetManagerProps {
  onBack?: () => void;
}

/**
 * Componente para gerenciar orçamentos por categoria
 */
export const BudgetManager = ({ onBack }: BudgetManagerProps) => {
  const {
    budgets,
    loading: budgetsLoading,
    addBudget,
    updateBudget,
    deleteBudget,
    calculateAllBudgetStatuses,
  } = useBudgets();

  const { categories, loading: categoriesLoading } = useCategories();

  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(false);

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    budget?: Budget | null;
    isEditing: boolean;
  }>({ isOpen: false, budget: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    budget?: Budget | null;
  }>({ isOpen: false, budget: null });

  // Carregar status dos orçamentos
  const loadBudgetStatuses = async () => {
    if (budgets.length === 0) return;
    
    setStatusesLoading(true);
    try {
      const statuses = await calculateAllBudgetStatuses();
      setBudgetStatuses(statuses);
    } catch (error) {
      console.error('Erro ao carregar status dos orçamentos:', error);
    } finally {
      setStatusesLoading(false);
    }
  };

  // Recarregar status quando orçamentos mudarem
  useEffect(() => {
    loadBudgetStatuses();
  }, [budgets]);

  /**
   * Abre modal para criar novo orçamento
   */
  const handleCreateBudget = () => {
    setEditModal({
      isOpen: true,
      budget: null,
      isEditing: false,
    });
  };

  /**
   * Abre modal para editar orçamento existente
   */
  const handleEditBudget = (budget: Budget) => {
    setEditModal({
      isOpen: true,
      budget,
      isEditing: true,
    });
  };

  /**
   * Abre dialog de confirmação para deletar orçamento
   */
  const handleDeleteBudget = (budget: Budget) => {
    setDeleteDialog({
      isOpen: true,
      budget,
    });
  };

  /**
   * Confirma a exclusão do orçamento
   */
  const confirmDeleteBudget = async () => {
    if (deleteDialog.budget) {
      await deleteBudget(deleteDialog.budget.id);
      setDeleteDialog({ isOpen: false, budget: null });
    }
  };

  /**
   * Manipula o envio do formulário de orçamento
   */
  const handleSubmitBudget = async (data: BudgetFormData) => {
    if (editModal.isEditing && editModal.budget) {
      await updateBudget(editModal.budget.id, data);
    } else {
      await addBudget(data);
    }
    setEditModal({ isOpen: false, budget: null, isEditing: false });
  };

  /**
   * Formata valor monetário
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  /**
   * Retorna a cor da barra de progresso baseada na porcentagem
   */
  const getProgressColor = (percentage: number, isOverBudget: boolean) => {
    if (isOverBudget) return 'bg-destructive';
    if (percentage >= 80) return 'bg-warning';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-primary';
  };

  /**
   * Renderiza um cartão de orçamento
   */
  const renderBudgetCard = (status: BudgetStatus) => {
    const { budget, spent, remaining, percentage, isOverBudget } = status;
    
    return (
      <Card key={budget.id} className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{budget.category_name}</CardTitle>
              <Badge variant={budget.period === 'monthly' ? 'default' : 'secondary'}>
                {budget.period === 'monthly' ? 'Mensal' : 'Anual'}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditBudget(budget)}
                className="h-8 w-8 p-0"
                title="Editar orçamento"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteBudget(budget)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Excluir orçamento"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Valores */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Orçamento</p>
              <p className="font-semibold">{formatCurrency(budget.amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gasto</p>
              <p className={`font-semibold ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                {formatCurrency(spent)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Restante</p>
              <p className={`font-semibold ${
                remaining < 0 ? 'text-destructive' : 'text-primary'
              }`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <div className="flex items-center gap-1">
                {isOverBudget && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span className={`font-medium ${
                  isOverBudget ? 'text-destructive' : 'text-foreground'
                }`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="relative">
              <Progress 
                value={Math.min(percentage, 100)} 
                className="h-3"
              />
              <div 
                className={`absolute top-0 left-0 h-3 rounded-full transition-all ${
                  getProgressColor(percentage, isOverBudget)
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Alertas */}
          {isOverBudget && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                Orçamento ultrapassado em {formatCurrency(spent - budget.amount)}
              </p>
            </div>
          )}
          
          {!isOverBudget && percentage >= 80 && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-sm text-warning">
                Atenção: Você já gastou {percentage.toFixed(1)}% do orçamento
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const loading = budgetsLoading || categoriesLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciar Orçamentos</h2>
          <p className="text-muted-foreground mt-1">
            Defina limites de gastos por categoria e acompanhe seu progresso.
          </p>
        </div>
        <Button onClick={handleCreateBudget}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Resumo */}
      {budgetStatuses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total de Orçamentos</p>
                  <p className="text-2xl font-bold">{budgetStatuses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Próximos do Limite</p>
                  <p className="text-2xl font-bold text-warning">
                    {budgetStatuses.filter(s => s.percentage >= 80 && !s.isOverBudget).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Ultrapassados</p>
                  <p className="text-2xl font-bold text-destructive">
                    {budgetStatuses.filter(s => s.isOverBudget).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Orçamentos */}
      {statusesLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map(budget => (
            <div key={budget.id} className="h-48 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : budgetStatuses.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum orçamento encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro orçamento para começar a controlar seus gastos por categoria.
            </p>
            <Button onClick={handleCreateBudget}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Orçamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgetStatuses.map(renderBudgetCard)}
        </div>
      )}

      {/* Botão Voltar */}
      {onBack && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={onBack}
            className="px-6 py-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      )}

      {/* Modal de Edição/Criação */}
      <BudgetEditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, budget: null, isEditing: false })}
        onSubmit={handleSubmitBudget}
        budget={editModal.budget}
        isEditing={editModal.isEditing}
        categories={categories.filter(cat => cat.type === 'expense')}
        existingBudgets={budgets}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => 
        !open && setDeleteDialog({ isOpen: false, budget: null })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento para "{deleteDialog.budget?.category_name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBudget}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};