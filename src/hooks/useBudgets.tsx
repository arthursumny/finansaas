import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetFormData {
  category_id: string;
  amount: number;
  period: 'monthly' | 'yearly';
}

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

/**
 * Hook para gerenciar orçamentos por categoria
 * Fornece funcionalidades para criar, editar, deletar e monitorar orçamentos
 */
export const useBudgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Busca todos os orçamentos do usuário logado
   */
  const fetchBudgets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('budgets')
        .select('*, categories!inner(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Mapear dados para incluir category_name
      const budgetsWithCategoryName = (data || []).map(budget => ({
        ...budget,
        category_name: budget.categories.name
      }));

      setBudgets(budgetsWithCategoryName as Budget[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar orçamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cria um novo orçamento
   */
  const addBudget = async (budgetData: BudgetFormData) => {
    if (!user) return;

    try {
      // Verificar se já existe orçamento para esta categoria
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', budgetData.category_id)
        .single();

      if (existingBudget) {
        toast({
          title: "Orçamento já existe",
          description: "Já existe um orçamento para esta categoria. Edite o existente.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          ...budgetData,
          user_id: user.id,
        })
        .select('*, categories!inner(id, name)')
        .single();

      if (error) throw error;

      const newBudget = {
        ...data,
        category_name: data.categories.name
      } as Budget;

      setBudgets(prev => [newBudget, ...prev]);
      toast({
        title: "Orçamento criado",
        description: `Orçamento para "${newBudget.category_name}" criado com sucesso!`,
      });
      
      return newBudget;
    } catch (error: any) {
      toast({
        title: "Erro ao criar orçamento",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Atualiza um orçamento existente
   */
  const updateBudget = async (id: string, budgetData: Partial<BudgetFormData>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('budgets')
        .update({
          ...budgetData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*, categories!inner(id, name)')
        .single();

      if (error) throw error;

      const updatedBudget = {
        ...data,
        category_name: data.categories.name
      } as Budget;

      setBudgets(prev => 
        prev.map(budget => budget.id === id ? updatedBudget : budget)
      );
      
      toast({
        title: "Orçamento atualizado",
        description: `Orçamento para "${updatedBudget.category_name}" atualizado com sucesso!`,
      });
      
      return updatedBudget;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar orçamento",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Deleta um orçamento
   */
  const deleteBudget = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setBudgets(prev => prev.filter(budget => budget.id !== id));
      toast({
        title: "Orçamento excluído",
        description: "Orçamento removido com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir orçamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Calcula o status de um orçamento baseado nas transações
   */
  const calculateBudgetStatus = async (budget: Budget): Promise<BudgetStatus> => {
    if (!user) {
      return {
        budget,
        spent: 0,
        remaining: budget.amount,
        percentage: 0,
        isOverBudget: false,
      };
    }

    try {
      // Calcular período baseado no tipo de orçamento
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (budget.period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }

      // Buscar transações da categoria no período
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('category', budget.category_name)
        .eq('type', 'expense')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      const spent = transactions?.reduce((total, transaction) => total + Math.abs(transaction.amount), 0) || 0;
      const remaining = budget.amount - spent;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const isOverBudget = spent > budget.amount;

      return {
        budget,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        isOverBudget,
      };
    } catch (error: any) {
      console.error('Erro ao calcular status do orçamento:', error);
      return {
        budget,
        spent: 0,
        remaining: budget.amount,
        percentage: 0,
        isOverBudget: false,
      };
    }
  };

  /**
   * Calcula o status de todos os orçamentos
   */
  const calculateAllBudgetStatuses = async (): Promise<BudgetStatus[]> => {
    const statuses = await Promise.all(
      budgets.map(budget => calculateBudgetStatus(budget))
    );
    return statuses;
  };

  /**
   * Retorna orçamentos que estão próximos do limite (>80%)
   */
  const getBudgetsNearLimit = async (): Promise<BudgetStatus[]> => {
    const statuses = await calculateAllBudgetStatuses();
    return statuses.filter(status => status.percentage >= 80);
  };

  /**
   * Retorna orçamentos que ultrapassaram o limite
   */
  const getOverBudgets = async (): Promise<BudgetStatus[]> => {
    const statuses = await calculateAllBudgetStatuses();
    return statuses.filter(status => status.isOverBudget);
  };

  // Carregar orçamentos quando o usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchBudgets();
    }
  }, [user]);

  return {
    budgets,
    loading,
    addBudget,
    updateBudget,
    deleteBudget,
    calculateBudgetStatus,
    calculateAllBudgetStatuses,
    getBudgetsNearLimit,
    getOverBudgets,
    refetch: fetchBudgets,
  };
};