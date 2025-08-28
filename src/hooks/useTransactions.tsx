import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { addMonths, addYears, format, isAfter, isSameDay } from 'date-fns';

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
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  original_amount?: number;
  discount_amount?: number;
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

  const generateRecurringTransactions = (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const transactions = [];
    
    if (!transaction.is_recurring) {
      return [transaction];
    }

    const startDate = new Date(transaction.date);
    let currentDate = new Date(startDate);
    let count = 0;
    const maxCount = transaction.recurrence_count || 1;

    while (count < maxCount) {
      transactions.push({
        ...transaction,
        date: format(currentDate, 'yyyy-MM-dd'),
        // Primeira transação mantém recorrência, demais são únicas
        is_recurring: count === 0 ? true : false,
        recurrence_count: count === 0 ? maxCount : undefined,
        recurrence_type: count === 0 ? transaction.recurrence_type : undefined,
        recurrence_start_date: undefined,
        recurrence_end_date: undefined,
      });

      // Próxima data baseada no tipo de recorrência
      if (transaction.recurrence_type === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      } else if (transaction.recurrence_type === 'yearly') {
        currentDate = addYears(currentDate, 1);
      }
      
      count++;
    }

    return transactions;
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      // Gerar todas as transações (recorrentes ou única)
      const transactionsToInsert = generateRecurringTransactions(transaction);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert.map(t => ({
          ...t,
          user_id: user.id
        })))
        .select();

      if (error) throw error;
      
      setTransactions(prev => [...(data as Transaction[]), ...prev]);
      toast({
        title: "Transação adicionada",
        description: transaction.is_recurring 
          ? `${transactionsToInsert.length} transações recorrentes criadas!`
          : "Transação criada com sucesso!",
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

  const deleteAllRecurringTransactions = async (originalTransaction: Transaction) => {
    if (!user) return;

    try {
      // Busca todas as transações com a mesma descrição, categoria, valor e tipo (grupo recorrente)
      const { data: relatedTransactions, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('description', originalTransaction.description)
        .eq('category', originalTransaction.category)
        .eq('type', originalTransaction.type)
        .gte('date', originalTransaction.date); // Apenas da data atual em diante

      if (fetchError) throw fetchError;

      if (relatedTransactions && relatedTransactions.length > 0) {
        const ids = relatedTransactions.map(t => t.id);
        
        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', ids)
          .eq('user_id', user.id);

        if (error) throw error;
        
        setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
        toast({
          title: "Transações recorrentes excluídas",
          description: `${relatedTransactions.length} transações removidas com sucesso!`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir transações recorrentes",
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
    deleteAllRecurringTransactions,
    refetch: fetchTransactions,
  };
};