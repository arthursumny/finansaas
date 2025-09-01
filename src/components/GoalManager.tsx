import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useGoals, Goal, GoalFormData } from '@/hooks/useGoals';
import { GoalEditModal } from '@/components/GoalEditModal';
import { GoalProgressCard } from '@/components/GoalProgressCard';
import { Plus, Target, ArrowLeft } from 'lucide-react';

interface GoalManagerProps {
  onBack?: () => void;
}

/**
 * Componente para gerenciar metas de economia
 */
export const GoalManager = ({ onBack }: GoalManagerProps) => {
  const {
    goals,
    loading: goalsLoading,
    addGoal,
    updateGoal,
    updateGoalAmount,
    deleteGoal,
    getActiveGoals,
    getCompletedGoals,
  } = useGoals();

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    goal?: Goal | null;
    isEditing: boolean;
  }>({ isOpen: false, goal: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    goal?: Goal | null;
  }>({ isOpen: false, goal: null });

  /**
   * Abre o modal para criar nova meta
   */
  const handleCreateGoal = () => {
    setEditModal({
      isOpen: true,
      goal: null,
      isEditing: false,
    });
  };

  /**
   * Abre o modal para editar meta
   */
  const handleEditGoal = (goal: Goal) => {
    setEditModal({
      isOpen: true,
      goal,
      isEditing: true,
    });
  };

  /**
   * Confirma a exclusão de uma meta
   */
  const confirmDeleteGoal = (goal: Goal) => {
    setDeleteDialog({
      isOpen: true,
      goal,
    });
  };

  /**
   * Manipula o envio do formulário de meta
   */
  const handleSubmitGoal = async (data: GoalFormData) => {
    if (editModal.isEditing && editModal.goal) {
      await updateGoal(editModal.goal.id, data);
    } else {
      await addGoal(data);
    }
  };

  /**
   * Manipula a exclusão de uma meta
   */
  const handleDeleteGoal = async () => {
    if (deleteDialog.goal) {
      await deleteGoal(deleteDialog.goal.id);
      setDeleteDialog({ isOpen: false, goal: null });
    }
  };

  /**
   * Manipula a atualização do valor atual da meta
   */
  const handleUpdateAmount = async (goal: Goal, newAmount: number) => {
    await updateGoalAmount(goal.id, newAmount);
  };

  /**
   * Fecha o modal de edição
   */
  const closeEditModal = () => {
    setEditModal({ isOpen: false, goal: null, isEditing: false });
  };

  /**
   * Obtém as metas baseado na aba ativa
   */
  const getDisplayGoals = () => {
    return activeTab === 'active' ? getActiveGoals() : getCompletedGoals();
  };

  const displayGoals = getDisplayGoals();
  const activeGoals = getActiveGoals();
  const completedGoals = getCompletedGoals();

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-500" />
              Metas de Economia
            </h2>
            <p className="text-muted-foreground">
              Defina e acompanhe suas metas financeiras
            </p>
          </div>
        </div>
        <Button onClick={handleCreateGoal}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metas Ativas</p>
                <p className="text-2xl font-bold text-foreground">
                  {activeGoals.length}
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Metas Concluídas</p>
                <p className="text-2xl font-bold text-green-600">
                  {completedGoals.length}
                </p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Metas</p>
                <p className="text-2xl font-bold text-foreground">
                  {goals.length}
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'active' ? 'default' : 'outline'}
          onClick={() => setActiveTab('active')}
          className="flex items-center gap-2"
        >
          Ativas
          {activeGoals.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeGoals.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'completed' ? 'default' : 'outline'}
          onClick={() => setActiveTab('completed')}
          className="flex items-center gap-2"
        >
          Concluídas
          {completedGoals.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {completedGoals.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Lista de Metas */}
      <div className="space-y-4">
        {displayGoals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {activeTab === 'active' ? 'Nenhuma meta ativa' : 'Nenhuma meta concluída'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === 'active'
                  ? 'Crie sua primeira meta de economia para começar a acompanhar seu progresso.'
                  : 'Você ainda não concluiu nenhuma meta. Continue trabalhando em suas metas ativas!'}
              </p>
              {activeTab === 'active' && (
                <Button onClick={handleCreateGoal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Meta
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                onEdit={handleEditGoal}
                onDelete={confirmDeleteGoal}
                onUpdateAmount={handleUpdateAmount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      <GoalEditModal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        onSubmit={handleSubmitGoal}
        goal={editModal.goal}
        isEditing={editModal.isEditing}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({ isOpen: false, goal: null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta "{deleteDialog.goal?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteDialog({ isOpen: false, goal: null })}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
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