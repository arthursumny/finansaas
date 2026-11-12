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
  created_at: string;
  updated_at: string;
}

export interface CardInvoiceSummary {
  reference_month: string;
  cycle_start: string;
  cycle_end: string;
  due_date: string;
  total: number;
  paid_total: number;
  pending_total: number;
  transactions_count: number;
}

export interface CardSummary extends Card {
  used_amount: number;
  available_amount: number;
  usage_percent: number;
  current_invoice: CardInvoiceSummary;
  next_invoice_total: number;
}

export interface CardFormData {
  name: string;
  brand: CardBrand;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color?: string;
  is_active?: boolean;
}

export interface InvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  status: 'paid' | 'pending';
}

export interface CardInvoiceDetails extends CardInvoiceSummary {
  card?: Card;
  transactions: InvoiceTransaction[];
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

  const addCard = async (cardData: CardFormData): Promise<Card | null> => {
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
  };

  const updateCard = async (id: string, updates: Partial<CardFormData>): Promise<Card | null> => {
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
  };

  const deleteCard = async (id: string): Promise<boolean> => {
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
  };

  const fetchInvoice = async (cardId: string, month?: string): Promise<CardInvoiceDetails | null> => {
    try {
      const query = month ? `?month=${encodeURIComponent(month)}` : '';
      const res = await apiFetch<CardInvoiceDetails>(`/cards/${cardId}/invoice${query}`);
      return res;
    } catch (error: any) {
      console.error('Erro ao buscar fatura:', error);
      return null;
    }
  };

  const fetchInvoicesHistory = async (cardId: string): Promise<CardInvoiceSummary[]> => {
    try {
      const res = await apiFetch<CardInvoiceSummary[]>(`/cards/${cardId}/invoices`);
      return Array.isArray(res) ? res : [];
    } catch (error: any) {
      console.error('Erro ao buscar histórico de faturas:', error);
      return [];
    }
  };

  return {
    cards,
    summary,
    loading,
    addCard,
    updateCard,
    deleteCard,
    fetchInvoice,
    fetchInvoicesHistory,
    refetch,
  };
};
