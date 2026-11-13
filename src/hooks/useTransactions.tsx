import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, apiFetch } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { format } from 'date-fns';
import { CARDS_QUERY_KEY } from './useCards';

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
  is_subscription?: boolean;
  subscription_day?: number;
  subscription_id?: string | null;
  recurrence_group_id?: string; // ID para agrupar recorrências
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  original_amount?: number;
  discount_amount?: number;
  card_id?: string | null;
  payment_method?: string | null;
  invoice_month?: string | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: Array<{ id: string; name: string; color: string }>; // Tags associadas
}

export interface AddInstallmentsData {
  description: string;
  amount: number;
  date: string;
  type?: "income" | "expense";
  category: string;
  status?: "paid" | "pending";
  card_id: string;
  payment_method?: string;
  installments: number;
}

export const TRANSACTIONS_QUERY_KEY = ['transactions'] as const;

/**
 * Competência em que a transação deve ser contabilizada.
 * Para compras no cartão é a competência da fatura (invoice_month);
 * para as demais, o próprio mês da data.
 */
export const transactionMonth = (transaction: Pick<Transaction, 'invoice_month' | 'date'>) =>
  transaction.invoice_month || (transaction.date ? transaction.date.slice(0, 7) : '');

export const useTransactions = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchQuery,
  } = useQuery<Transaction[]>({
    queryKey: [...TRANSACTIONS_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          transaction_tags (
            tag:tags (
              id,
              name,
              color
            )
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        toast({
          title: "Erro ao carregar transações",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      // Transformar os dados para incluir tags no formato esperado
      const transactionsWithTags = (data || []).map((transaction: any) => ({
        ...transaction,
        tags: transaction.transaction_tags?.map((tt: any) => tt.tag) || []
      }));

      return transactionsWithTags as Transaction[];
    },
    enabled: !!user,
  });

  const loading = (transactionsLoading || authLoading) && !!user;

  const invalidateQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
    ]);
  }, [queryClient]);

  const refetch = useCallback(async () => {
    const [result] = await Promise.all([
      refetchQuery(),
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
    ]);
    return result.data || [];
  }, [refetchQuery, queryClient]);

  const generateRecurringTransactions = (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const list = [];
    
    if (!transaction.is_recurring) {
      return [transaction];
    }

    const recurrenceGroupId = crypto.randomUUID(); // Gera um ID único para o grupo

    // Parse local da data no formato yyyy-MM-dd para evitar timezone
    const [sy, sm, sd] = transaction.date.split('-').map(Number);
    let currentYear = sy;
    let currentMonth = sm; // 1-12
    let currentDay = sd;
    const baseSubscriptionDay = transaction.subscription_day || currentDay;

    const getClampedDay = (year: number, month: number, day: number) => {
      const lastDay = new Date(year, month, 0).getDate();
      return Math.min(Math.max(day, 1), lastDay);
    };

    let count = 0;
    const maxCount = transaction.recurrence_count || 1;

    while (count < maxCount) {
      const y = currentYear;
      const m = String(currentMonth).padStart(2, '0');
      const d = String(currentDay).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      list.push({
        ...transaction,
        date: dateStr,
        is_recurring: true, // Todas são recorrentes
        recurrence_group_id: recurrenceGroupId, // Associa ao mesmo grupo
        // Primeira transação mantém recorrência, demais são únicas
        recurrence_count: count === 0 ? maxCount : undefined,
        recurrence_type: count === 0 ? transaction.recurrence_type : undefined,
        recurrence_start_date: undefined,
        recurrence_end_date: undefined,
      });

      // Próxima data baseada no tipo de recorrência (cuidando de overflow de meses/dias)
      if (transaction.recurrence_type === 'monthly') {
        if (transaction.is_subscription) {
          let nextYear = currentYear;
          let nextMonth = currentMonth + 1;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
          }
          currentYear = nextYear;
          currentMonth = nextMonth;
          currentDay = getClampedDay(nextYear, nextMonth, baseSubscriptionDay);
        } else {
          const next = new Date(currentYear, currentMonth - 1, currentDay);
          next.setMonth(next.getMonth() + 1);
          currentYear = next.getFullYear();
          currentMonth = next.getMonth() + 1;
          currentDay = next.getDate();
        }
      } else if (transaction.recurrence_type === 'yearly') {
        const next = new Date(currentYear, currentMonth - 1, currentDay);
        next.setFullYear(next.getFullYear() + 1);
        currentYear = next.getFullYear();
        currentMonth = next.getMonth() + 1;
        currentDay = next.getDate();
      }
      
      count++;
    }

    return list;
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'tags'> & { tag_ids?: string[] }) => {
    if (!user) return;

    try {
      // Extrair tag_ids do objeto transaction
      const { tag_ids, ...transactionData } = transaction;
      
      // Gerar todas as transações (recorrentes ou única)
      const transactionsToInsert = generateRecurringTransactions(transactionData);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionsToInsert.map(t => ({
          ...t,
          user_id: user.id
        })))
        .select();

      if (error) throw error;
      
      // Associar tags às transações criadas
      if (tag_ids && tag_ids.length > 0 && data) {
        const tagRelations = [];
        for (const transactionData of data) {
          for (const tagId of tag_ids) {
            tagRelations.push({
              transaction_id: transactionData.id,
              tag_id: tagId
            });
          }
        }
        
        if (tagRelations.length > 0) {
          const { error: tagError } = await supabase
            .from('transaction_tags')
            .insert(tagRelations);
          
          if (tagError) {
            console.error('Erro ao associar tags:', tagError);
            // Não falha a criação da transação se houver erro nas tags
          }
        }
      }
      
      // Invalida cache de transações e cartões
      await invalidateQueries();
      
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

  const updateTransaction = async (id: string, updates: Partial<Transaction> & { tag_ids?: string[] }) => {
    if (!user) return;

    try {
      // Extrair tag_ids do objeto updates
      const { tag_ids, ...transactionUpdates } = updates;
      
      const { data, error } = await supabase
        .from('transactions')
        .update(transactionUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      // Atualizar tags se fornecido
      if (tag_ids !== undefined) {
        // Remover todas as tags existentes
        await supabase
          .from('transaction_tags')
          .delete()
          .eq('transaction_id', id);
        
        // Adicionar novas tags
        if (tag_ids.length > 0) {
          const tagRelations = tag_ids.map(tagId => ({
            transaction_id: id,
            tag_id: tagId
          }));
          
          await supabase
            .from('transaction_tags')
            .insert(tagRelations);
        }
      }
      
      // Invalida cache de transações e cartões
      await invalidateQueries();
      
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
      
      await invalidateQueries();
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
    if (!user || !originalTransaction.recurrence_group_id) return;

    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Deleta todas as transações com o mesmo recurrence_group_id
      const { error } = await supabase
        .from('transactions')
        .delete()
        .match({ 
          user_id: user.id,
          recurrence_group_id: originalTransaction.recurrence_group_id 
        })
        .gte('date', todayStr);

      if (error) throw error;

      await invalidateQueries();

      toast({
        title: "Transações recorrentes excluídas",
        description: "Transações futuras removidas; histórico mantido.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir transações",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Atualiza todas as transações de um grupo recorrente
   * IMPORTANTE: Esta função APENAS atualiza transações existentes, NUNCA cria novas
   */
  const updateAllRecurringTransactions = async (originalTransaction: Transaction, updates: Partial<Transaction> & { tag_ids?: string[] }) => {
    if (!user || !originalTransaction.recurrence_group_id) {
      // Se não for recorrente, atualiza apenas a transação individual
      return updateTransaction(originalTransaction.id, updates);
    }

    try {
      const { tag_ids, ...transactionUpdates } = updates;
      // Data atual para comparação
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      console.log('Atualizando transações recorrentes:', {
        recurrence_group_id: originalTransaction.recurrence_group_id,
        todayStr,
        updates: transactionUpdates,
        tag_ids
      });
      
      // VALIDAÇÃO CRÍTICA: Remove campos que poderiam causar criação de novas transações
      const safeUpdates = { ...transactionUpdates };
      delete safeUpdates.is_recurring;
      delete safeUpdates.recurrence_type;
      delete safeUpdates.recurrence_count;
      delete safeUpdates.recurrence_group_id;
      delete safeUpdates.id;
      delete safeUpdates.user_id;
      delete safeUpdates.created_at;
      delete safeUpdates.updated_at;
      
      console.log('Updates seguros (sem campos de recorrência):', safeUpdates);
      
      // Primeiro, busca as transações que serão atualizadas para debug
      const { data: transactionsToUpdate } = await supabase
        .from('transactions')
        .select('*')
        .match({ 
          user_id: user.id,
          recurrence_group_id: originalTransaction.recurrence_group_id 
        })
        .gte('date', todayStr);
      
      console.log('Transações que serão atualizadas:', transactionsToUpdate);
      
      if (!transactionsToUpdate || transactionsToUpdate.length === 0) {
        console.log('Nenhuma transação futura encontrada para atualizar');
        toast({
          title: "Nenhuma transação para atualizar",
          description: "Não foram encontradas transações futuras deste grupo recorrente.",
        });
        return;
      }
      
      let data = transactionsToUpdate;
      const hasTransactionUpdates = Object.keys(safeUpdates).length > 0;

      if (hasTransactionUpdates) {
        // Atualiza apenas as transações futuras (incluindo a atual) com o mesmo recurrence_group_id
        const { data: updatedTransactions, error } = await supabase
          .from('transactions')
          .update(safeUpdates)
          .match({ 
            user_id: user.id,
            recurrence_group_id: originalTransaction.recurrence_group_id 
          })
          .gte('date', todayStr) // Apenas transações de hoje em diante
          .select();

        if (error) {
          console.error('Erro ao atualizar transações:', error);
          throw error;
        }

        data = updatedTransactions;
      }

      const updatedTransactionIds = (data || []).map(transaction => transaction.id);

      if (tag_ids !== undefined && updatedTransactionIds.length > 0) {
        const { error: deleteTagsError } = await supabase
          .from('transaction_tags')
          .delete()
          .in('transaction_id', updatedTransactionIds);

        if (deleteTagsError) throw deleteTagsError;

        if (tag_ids.length > 0) {
          const tagRelations = updatedTransactionIds.flatMap(transactionId =>
            tag_ids.map(tagId => ({
              transaction_id: transactionId,
              tag_id: tagId
            }))
          );

          const { error: insertTagsError } = await supabase
            .from('transaction_tags')
            .insert(tagRelations);

          if (insertTagsError) throw insertTagsError;
        }
      }
      
      console.log('Transações atualizadas:', data);

      // Validação adicional: Verifica se o número de transações atualizadas é igual ao esperado
      if (data && data.length !== transactionsToUpdate.length) {
        console.warn('ATENÇÃO: Número de transações atualizadas difere do esperado', {
          esperado: transactionsToUpdate.length,
          atualizado: data.length
        });
      }

      await invalidateQueries();

      const updatedCount = data?.length || 0;
      toast({
        title: "Transações recorrentes atualizadas",
        description: `${updatedCount} transações futuras do grupo recorrente foram atualizadas.`,
      });
    } catch (error: any) {
      console.error('Erro completo:', error);
      toast({
        title: "Erro ao atualizar transações recorrentes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Deleta múltiplas transações por IDs
   */
  const deleteMultipleTransactions = async (ids: string[]) => {
    if (!user || ids.length === 0) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await invalidateQueries();
      toast({
        title: "Transações excluídas",
        description: `${ids.length} transações foram removidas.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir transações",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addInstallments = async (data: AddInstallmentsData) => {
    if (!user) return;

    try {
      const result = await apiFetch<{
        group_id: string;
        created: number;
        total: number;
        installments: Transaction[];
      }>('/transactions/installments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      await invalidateQueries();

      toast({
        title: "Compra parcelada cadastrada",
        description: `${data.installments} parcelas geradas com sucesso!`,
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar compra parcelada",
        description: error.message || "Não foi possível cadastrar as parcelas.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    if (!user || !groupId) return;

    try {
      const result = await apiFetch<{ deleted: number }>(`/transactions/installment-group/${groupId}`, {
        method: 'DELETE',
      });

      await invalidateQueries();

      toast({
        title: "Parcelamento excluído",
        description: "Todas as parcelas foram removidas com sucesso.",
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir parcelamento",
        description: error.message || "Não foi possível excluir o grupo de parcelas.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateInstallmentGroup = async (
    groupId: string,
    data: { description?: string; category?: string; card_id?: string; payment_method?: string }
  ) => {
    if (!user || !groupId) return;

    try {
      const result = await apiFetch<{ updated: number }>(`/transactions/installment-group/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      await invalidateQueries();

      toast({
        title: "Parcelamento atualizado",
        description: "As parcelas pendentes foram atualizadas com sucesso.",
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar parcelamento",
        description: error.message || "Não foi possível atualizar o grupo de parcelas.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    transactions,
    loading,
    addTransaction,
    addInstallments,
    updateTransaction,
    deleteTransaction,
    deleteMultipleTransactions,
    deleteInstallmentGroup,
    updateInstallmentGroup,
    deleteAllRecurringTransactions,
    updateAllRecurringTransactions,
    refetch,
  };
};
