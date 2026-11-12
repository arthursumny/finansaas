import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, apiFetch } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro';

export interface Card {
  id: string;
  user_id: string;
  name: string;
  brand: CardBrand;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color: string;
  is_active: boolean;
  min_payment_percent?: number;
  parent_card_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardInvoicePayment {
  id: string;
  user_id: string;
  card_id: string;
  reference_month: string;
  amount: number;
  created_at: string;
}

export interface CardInvoiceSummary {
  reference_month: string;
  cycle_start: string;
  cycle_end: string;
  due_date: string;
  total: number;
  paid_total: number;
  pending_total: number;
  paid?: number;
  pending?: number;
  status?: 'paid' | 'partial' | 'open';
  min_payment_percent?: number;
  minimum_payment?: number;
  minimum_remaining?: number;
  transactions_count: number;
}

export interface CardSummary extends Card {
  used_amount: number;
  available_amount: number;
  usage_percent: number;
  current_invoice: CardInvoiceSummary;
  next_invoice_total: number;
  next_closing_date?: string;
  days_until_closing?: number;
  closing_soon?: boolean;
  shared_with_parent?: boolean;
  parent_card_name?: string | null;
}

export interface CardFormData {
  name: string;
  brand: CardBrand;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color?: string;
  is_active?: boolean;
  min_payment_percent?: number;
  parent_card_id?: string | null;
}

export interface InvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  status: 'paid' | 'pending';
  installment_number?: number | null;
  installment_total?: number | null;
  installment_group_id?: string | null;
  card_id?: string | null;
  card_name?: string | null;
}

export interface CardInvoiceDetails extends CardInvoiceSummary {
  card?: Card;
  transactions: InvoiceTransaction[];
  payments?: CardInvoicePayment[];
  cards_included?: { id: string; name: string }[];
}

export const CARDS_QUERY_KEY = ['cards'] as const;

export const useCards = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: cards = [],
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useQuery<Card[]>({
    queryKey: [...CARDS_QUERY_KEY, 'list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar cartões:', error);
        throw error;
      }
      return (data || []) as Card[];
    },
    enabled: !!user,
  });

  const {
    data: summary = [],
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery<CardSummary[]>({
    queryKey: [...CARDS_QUERY_KEY, 'summary', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiFetch<CardSummary[]>('/cards/summary');
      const list = Array.isArray(res) ? res : ((res as any)?.cards || []);
      return list;
    },
    enabled: !!user,
  });

  const loading = (cardsLoading || summaryLoading || authLoading) && !!user;

  const fetchCards = useCallback(async () => {
    const res = await refetchCards();
    return res.data || [];
  }, [refetchCards]);

  const refetch = useCallback(async () => {
    const [cardsRes, summaryRes] = await Promise.all([
      refetchCards(),
      refetchSummary(),
    ]);
    return {
      cards: cardsRes.data || [],
      summary: summaryRes.data || [],
    };
  }, [refetchCards, refetchSummary]);

  const addCard = useCallback(async (cardData: CardFormData): Promise<Card | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          ...cardData,
          user_id: user.id,
          is_active: cardData.is_active !== undefined ? cardData.is_active : true,
          color: cardData.color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);

      toast({
        title: "Cartão adicionado",
        description: `O cartão "${cardData.name}" foi cadastrado com sucesso!`,
      });
      return data as Card;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar cartão",
        description: error.message || "Não foi possível cadastrar o cartão.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, queryClient, toast]);

  const createCard = addCard;

  const updateCard = useCallback(async (id: string, updates: Partial<CardFormData>): Promise<Card | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);

      toast({
        title: "Cartão atualizado",
        description: "As informações do cartão foram atualizadas com sucesso!",
      });
      return data as Card;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar cartão",
        description: error.message || "Não foi possível atualizar o cartão.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, queryClient, toast]);

  const deleteCard = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);

      toast({
        title: "Cartão excluído",
        description: "O cartão foi excluído. Suas transações foram mantidas sem vínculo.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir cartão",
        description: error.message || "Não foi possível excluir o cartão.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, queryClient, toast]);

  const fetchInvoice = useCallback(async (cardId: string, month?: string, includeAdditional?: boolean): Promise<CardInvoiceDetails | null> => {
    try {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (includeAdditional !== undefined) params.set('include_additional', includeAdditional ? '1' : '0');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<CardInvoiceDetails>(`/cards/${cardId}/invoice${query}`);
      return res;
    } catch (error: any) {
      console.error('Erro ao buscar fatura:', error);
      return null;
    }
  }, []);

  const fetchInvoicesHistory = useCallback(async (cardId: string, includeAdditional?: boolean): Promise<CardInvoiceSummary[]> => {
    try {
      const params = new URLSearchParams();
      if (includeAdditional !== undefined) params.set('include_additional', includeAdditional ? '1' : '0');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<CardInvoiceSummary[]>(`/cards/${cardId}/invoices${query}`);
      return Array.isArray(res) ? res : [];
    } catch (error: any) {
      console.error('Erro ao buscar histórico de faturas:', error);
      return [];
    }
  }, []);

  const payInvoice = useCallback(async (cardId: string, month: string) => {
    try {
      const res = await apiFetch<{ updated: number; total_paid: number; reference_month: string; pending: number }>(
        `/cards/${cardId}/invoice/${encodeURIComponent(month)}/pay`,
        { method: 'POST' }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      return res;
    } catch (error: any) {
      toast({
        title: "Erro ao pagar fatura",
        description: error.message || "Não foi possível registrar o pagamento da fatura.",
        variant: "destructive",
      });
      throw error;
    }
  }, [queryClient, toast]);

  const payMinimumInvoice = useCallback(async (cardId: string, month: string, amount?: number) => {
    try {
      const res = await apiFetch<{ paid: number; pending: number; amount: number }>(
        `/cards/${cardId}/invoice/${encodeURIComponent(month)}/pay-minimum`,
        {
          method: 'POST',
          body: amount !== undefined ? JSON.stringify({ amount }) : undefined,
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      return res;
    } catch (error: any) {
      toast({
        title: "Erro ao pagar mínimo da fatura",
        description: error.message || "Não foi possível registrar o pagamento mínimo.",
        variant: "destructive",
      });
      throw error;
    }
  }, [queryClient, toast]);

  const deleteInvoicePayment = useCallback(async (cardId: string, month: string, paymentId: string) => {
    try {
      const res = await apiFetch<{ ok: boolean; deleted: string; pending: number; paid: number }>(
        `/cards/${cardId}/invoice/${encodeURIComponent(month)}/payments/${paymentId}`,
        { method: 'DELETE' }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      return res;
    } catch (error: any) {
      toast({
        title: "Erro ao remover pagamento",
        description: error.message || "Não foi possível remover o pagamento parcial.",
        variant: "destructive",
      });
      throw error;
    }
  }, [queryClient, toast]);

  const unpayInvoice = useCallback(async (cardId: string, month: string) => {
    try {
      const res = await apiFetch<{ updated: number; reverted: number; pending: number }>(
        `/cards/${cardId}/invoice/${encodeURIComponent(month)}/unpay`,
        { method: 'POST' }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
      return res;
    } catch (error: any) {
      toast({
        title: "Erro ao reabrir fatura",
        description: error.message || "Não foi possível reabrir a fatura.",
        variant: "destructive",
      });
      throw error;
    }
  }, [queryClient, toast]);

  return {
    cards,
    summary,
    loading,
    addCard,
    createCard,
    updateCard,
    deleteCard,
    fetchCards,
    fetchInvoice,
    fetchInvoicesHistory,
    payInvoice,
    payMinimumInvoice,
    deleteInvoicePayment,
    unpayInvoice,
    refetch,
  };
};
