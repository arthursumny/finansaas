import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  period: 'monthly' | 'yearly' | 'custom';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  user_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface GoalFormData {
  title: string;
  description?: string;
  target_amount: number;
  target_date?: string;
  period: 'monthly' | 'yearly' | 'custom';
}

export interface GoalProgress {
  goal: Goal;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
  daysRemaining?: number;
  monthlyTarget?: number;
}

/**
 * Hook para gerenciar metas de economia
 * Fornece funcionalidades para criar, editar, deletar e monitorar metas
 */
export const useGoals = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Busca todas as metas do usuário logado
   */
  const fetchGoals = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGoals((data as Goal[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar metas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cria uma nova meta
   */
  const addGoal = async (goalData: GoalFormData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          ...goalData,
          user_id: user.id,
          current_amount: 0,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => [(data as Goal), ...prev]);
      toast({
        title: "Meta criada",
        description: `Meta "${(data as Goal).title}" criada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao criar meta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Atualiza uma meta existente
   */
  const updateGoal = async (id: string, goalData: Partial<GoalFormData>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .update({
          ...goalData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => 
        prev.map(goal => goal.id === id ? (data as Goal) : goal)
      );
      
      toast({
        title: "Meta atualizada",
        description: `Meta "${(data as Goal).title}" atualizada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar meta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Atualiza o valor atual de uma meta (soma o valor ao valor atual)
   */
  const updateGoalAmount = async (id: string, amount: number) => {
    if (!user) return;

    try {
      // Primeiro, busca o valor atual da meta
      const currentGoal = goals.find(g => g.id === id);
      if (!currentGoal) throw new Error('Meta não encontrada');
      
      // Garante que o valor não fique negativo
      const newCurrentAmount = Math.max(0, currentGoal.current_amount + amount);
      
      // Verifica se a meta foi concluída
      const isCompleted = newCurrentAmount >= currentGoal.target_amount;
      const wasCompleted = currentGoal.status === 'completed';
      
      const updateData: any = {
        current_amount: newCurrentAmount,
        updated_at: new Date().toISOString(),
      };
      
      // Se a meta foi concluída e não estava concluída antes, atualiza o status
      if (isCompleted && !wasCompleted) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }
      // Se a meta estava concluída mas agora não está mais, reverte o status
      else if (!isCompleted && wasCompleted) {
        updateData.status = 'active';
        updateData.completed_at = null;
      }
      
      const { data, error } = await supabase
        .from('goals')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => 
        prev.map(goal => goal.id === id ? (data as Goal) : goal)
      );
      
      const goal = goals.find(g => g.id === id);
      if (goal && (data as Goal).status === 'completed' && goal.status !== 'completed') {
        toast({
          title: "🎉 Meta concluída!",
          description: `Parabéns! Você atingiu a meta "${(data as Goal).title}"!`,
        });
      }
      
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar valor da meta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Deleta uma meta
   */
  const deleteGoal = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setGoals(prev => prev.filter(goal => goal.id !== id));
      toast({
        title: "Meta excluída",
        description: "Meta removida com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Calcula o progresso de uma meta
   */
  const calculateGoalProgress = (goal: Goal): GoalProgress => {
    const percentage = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
    const remaining = goal.target_amount - goal.current_amount;
    const isCompleted = goal.status === 'completed' || goal.current_amount >= goal.target_amount;
    
    let daysRemaining: number | undefined;
    let monthlyTarget: number | undefined;
    
    if (goal.target_date) {
      const targetDate = new Date(goal.target_date);
      const today = new Date();
      const diffTime = targetDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30;
        monthlyTarget = remaining / monthsRemaining;
      }
    } else if (goal.period === 'monthly') {
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const diffTime = endOfMonth.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      monthlyTarget = remaining;
    } else if (goal.period === 'yearly') {
      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const diffTime = endOfYear.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const monthsRemaining = daysRemaining / 30;
      monthlyTarget = remaining / monthsRemaining;
    }

    return {
      goal,
      percentage: Math.min(percentage, 100),
      remaining: Math.max(remaining, 0),
      isCompleted,
      daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : undefined,
      monthlyTarget: monthlyTarget && monthlyTarget > 0 ? monthlyTarget : undefined,
    };
  };

  /**
   * Calcula o progresso de todas as metas
   */
  const calculateAllGoalProgress = (): GoalProgress[] => {
    return goals.map(goal => calculateGoalProgress(goal));
  };

  /**
   * Retorna metas ativas
   */
  const getActiveGoals = (): Goal[] => {
    return goals.filter(goal => goal.status === 'active');
  };

  /**
   * Retorna metas concluídas
   */
  const getCompletedGoals = (): Goal[] => {
    return goals.filter(goal => goal.status === 'completed');
  };

  /**
   * Retorna metas próximas do prazo (menos de 30 dias)
   */
  const getGoalsNearDeadline = (): GoalProgress[] => {
    const progress = calculateAllGoalProgress();
    return progress.filter(p => 
      p.daysRemaining !== undefined && 
      p.daysRemaining <= 30 && 
      p.daysRemaining > 0 &&
      !p.isCompleted
    );
  };

  // Carregar metas quando o usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  return {
    goals,
    loading,
    addGoal,
    updateGoal,
    updateGoalAmount,
    deleteGoal,
    calculateGoalProgress,
    calculateAllGoalProgress,
    getActiveGoals,
    getCompletedGoals,
    getGoalsNearDeadline,
    refetch: fetchGoals,
  };
};