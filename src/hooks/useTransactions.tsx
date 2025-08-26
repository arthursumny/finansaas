import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  category: string;
  status: "paid" | "pending";
  is_recurring?: boolean;
  recurrence_type?: "monthly" | "yearly";
  recurrence_count?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTransactions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          ...transaction,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      setTransactions(prev => [data as Transaction, ...prev]);
      toast({
        title: "Transação adicionada",
        description: "Transação criada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar transação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === id ? data as Transaction : t));
      toast({
        title: "Transação atualizada",
        description: "Transação atualizada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar transação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast({
        title: "Transação excluída",
        description: "Transação removida com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir transação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  };
};