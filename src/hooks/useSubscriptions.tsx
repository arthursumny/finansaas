import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { CARDS_QUERY_KEY } from './useCards';

export interface Subscription {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  status: 'paid' | 'pending';
  charge_day: number;
  is_active: boolean;
  start_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: Array<{ id: string; name: string; color: string }>;
}

export interface SubscriptionFormData {
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  status: 'paid' | 'pending';
  charge_day: number;
  is_active?: boolean;
  tag_ids?: string[];
}

export const useSubscriptions = () => {
  const queryClient = useQueryClient();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSubscriptions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_tags (
            tag:tags (
              id,
              name,
              color
            )
          )
        `)
        .eq('user_id', user.id)
        .order('description', { ascending: true });

      if (error) throw error;

      const subscriptionsWithTags = (data || []).map((subscription: any) => ({
        ...subscription,
        tags: subscription.subscription_tags?.map((st: any) => st.tag) || []
      }));

      const parsed = subscriptionsWithTags as Subscription[];
      setSubscriptions(parsed);
      return parsed;
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar assinaturas',
        description: error.message,
        variant: 'destructive',
      });
      return [] as Subscription[];
    } finally {
      setLoading(false);
    }
  };

  const addSubscription = async (data: SubscriptionFormData) => {
    if (!user) return;

    try {
      const { tag_ids, ...subscriptionData } = data;

      const { data: created, error } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          user_id: user.id,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      if (tag_ids && tag_ids.length > 0 && created) {
        const tagRelations = tag_ids.map(tagId => ({
          subscription_id: created.id,
          tag_id: tagId,
        }));

        const { error: tagError } = await supabase
          .from('subscription_tags')
          .insert(tagRelations);

        if (tagError) {
          console.error('Erro ao associar tags na assinatura:', tagError);
        }
      }

      await fetchSubscriptions();

      toast({
        title: 'Assinatura criada',
        description: 'Assinatura mensal criada com sucesso!'
      });

      return created as Subscription;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar assinatura',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateSubscription = async (id: string, data: SubscriptionFormData) => {
    if (!user) return;

    try {
      const { tag_ids, ...subscriptionData } = data;

      const { data: updated, error } = await supabase
        .from('subscriptions')
        .update({
          ...subscriptionData,
          is_active: data.is_active ?? true,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (tag_ids !== undefined) {
        await supabase
          .from('subscription_tags')
          .delete()
          .eq('subscription_id', id);

        if (tag_ids.length > 0) {
          const tagRelations = tag_ids.map(tagId => ({
            subscription_id: id,
            tag_id: tagId,
          }));

          await supabase
            .from('subscription_tags')
            .insert(tagRelations);
        }
      }

      await fetchSubscriptions();

      toast({
        title: 'Assinatura atualizada',
        description: 'Assinatura mensal atualizada com sucesso!'
      });

      return updated as Subscription;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar assinatura',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteSubscription = async (id: string) => {
    if (!user) return;

    try {
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .match({ user_id: user.id, subscription_id: id });

      if (transactionsError) throw transactionsError;

      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSubscriptions(prev => prev.filter(sub => sub.id !== id));
      toast({
        title: 'Assinatura excluida',
        description: 'Assinatura mensal removida com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir assinatura',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const ensureMonthlyTransactions = useCallback(async (
    targetDate: Date,
    monthsAhead = 36,
    subscriptionsOverride?: Subscription[]
  ) => {
    if (!user) return 0;

    const sourceSubscriptions = subscriptionsOverride || subscriptions;
    const activeSubscriptions = sourceSubscriptions.filter(sub => sub.is_active);
    if (activeSubscriptions.length === 0) return 0;

    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(addMonths(targetDate, monthsAhead - 1));
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

    const subscriptionIds = activeSubscriptions.map(sub => sub.id);

    const { data: existing, error: existingError } = await supabase
      .from('transactions')
      .select('id, subscription_id, date')
      .eq('user_id', user.id)
      .in('subscription_id', subscriptionIds)
      .gte('date', monthStartStr)
      .lte('date', monthEndStr);

    if (existingError) {
      console.error('Erro ao buscar transacoes de assinatura:', existingError);
      toast({
        title: 'Erro ao gerar assinaturas',
        description: existingError.message,
        variant: 'destructive',
      });
      return 0;
    }

    const existingKeys = new Set(
      (existing || []).map((item: any) => `${item.subscription_id}_${item.date}`)
    );

    const inserts: any[] = [];

    for (const sub of activeSubscriptions) {
      for (let offset = 0; offset < monthsAhead; offset += 1) {
        const targetMonth = addMonths(monthStart, offset);
        const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        const day = Math.min(Math.max(sub.charge_day, 1), lastDay);
        const occurrenceDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
        const occurrenceDateStr = format(occurrenceDate, 'yyyy-MM-dd');

        if (sub.start_date) {
          const startDate = new Date(sub.start_date);
          const sameMonth =
            startDate.getFullYear() === occurrenceDate.getFullYear() &&
            startDate.getMonth() === occurrenceDate.getMonth();
          if (startDate > occurrenceDate && !sameMonth) {
            continue;
          }
        }

        const key = `${sub.id}_${occurrenceDateStr}`;
        if (existingKeys.has(key)) {
          continue;
        }

        inserts.push({
          user_id: user.id,
          type: sub.type,
          description: sub.description,
          amount: sub.amount,
          date: occurrenceDateStr,
          category: sub.category,
          status: sub.status,
          is_recurring: false,
          is_subscription: true,
          subscription_id: sub.id,
        });
      }
    }

    if (inserts.length === 0) return 0;

    const { data: createdTransactions, error: insertError } = await supabase
      .from('transactions')
      .insert(inserts, { onConflict: 'subscription_id,date', ignoreDuplicates: true })
      .select();

    if (insertError) {
      console.error('Erro ao criar transacoes de assinatura:', insertError);
      toast({
        title: 'Erro ao gerar assinaturas',
        description: insertError.message,
        variant: 'destructive',
      });
      return 0;
    }

    const tagRelations: Array<{ transaction_id: string; tag_id: string }> = [];
    const subscriptionTagMap = new Map(
      activeSubscriptions.map(sub => [sub.id, sub.tags?.map(tag => tag.id) || []])
    );

    for (const transaction of createdTransactions || []) {
      const tagIds = subscriptionTagMap.get(transaction.subscription_id) || [];
      for (const tagId of tagIds) {
        tagRelations.push({
          transaction_id: transaction.id,
          tag_id: tagId,
        });
      }
    }

    if (tagRelations.length > 0) {
      const supabaseAny = supabase as typeof supabase & {
        from: (table: string) => any;
      };
      const { error: tagError } = await supabaseAny
        .from('transaction_tags')
        .insert(tagRelations);

      if (tagError) {
        console.error('Erro ao associar tags nas transacoes de assinatura:', tagError);
        toast({
          title: 'Aviso ao gerar tags',
          description: tagError.message,
        });
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
    ]);

    return inserts.length;
  }, [subscriptions, user, queryClient]);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  return {
    subscriptions,
    loading,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    ensureMonthlyTransactions,
    refetch: fetchSubscriptions,
  };
};
