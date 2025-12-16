import { useState, useMemo } from 'react';
import { Transaction } from './useTransactions';
import { TransactionFilters } from '@/components/filters/TransactionFilters';

/**
 * Hook personalizado para gerenciar filtros de transações
 * Fornece funcionalidades de filtragem e busca avançada
 */
export const useTransactionFilters = (transactions: Transaction[]) => {
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  /**
   * Aplica todos os filtros às transações
   */
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Filtro por busca de descrição
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const description = transaction.description.toLowerCase();
        if (!description.includes(searchTerm)) {
          return false;
        }
      }

      // Filtro por período
      if (filters.dateStart) {
        if (transaction.date < filters.dateStart) {
          return false;
        }
      }

      if (filters.dateEnd) {
        if (transaction.date > filters.dateEnd) {
          return false;
        }
      }

      // Filtro por categoria
      if (filters.category) {
        if (transaction.category !== filters.category) {
          return false;
        }
      }

      // Filtro por valor mínimo
      if (filters.minAmount !== undefined) {
        if (transaction.amount < filters.minAmount) {
          return false;
        }
      }

      // Filtro por valor máximo
      if (filters.maxAmount !== undefined) {
        if (transaction.amount > filters.maxAmount) {
          return false;
        }
      }

      // Filtro por tipo
      if (filters.type) {
        if (transaction.type !== filters.type) {
          return false;
        }
      }

      // Filtro por status
      if (filters.status) {
        if (transaction.status !== filters.status) {
          return false;
        }
      }

      // Filtro por tags
      if (filters.tagIds && filters.tagIds.length > 0) {
        const transactionTagIds = transaction.tags?.map(tag => tag.id) || [];
        // Verifica se pelo menos uma das tags selecionadas está presente na transação
        const hasMatchingTag = filters.tagIds.some(tagId => transactionTagIds.includes(tagId));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  /**
   * Atualiza os filtros
   */
  const updateFilters = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
  };

  /**
   * Limpa todos os filtros
   */
  const clearFilters = () => {
    setFilters({});
  };

  /**
   * Alterna a visibilidade do painel de filtros
   */
  const toggleFilters = () => {
    setIsFiltersOpen(prev => !prev);
  };

  /**
   * Verifica se há filtros ativos
   */
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'tagIds') {
        return Array.isArray(value) && value.length > 0;
      }
      return value !== undefined && value !== '' && value !== null;
    });
  }, [filters]);

  /**
   * Conta o número de filtros ativos
   */
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'tagIds') {
        // Para tags, conta cada tag selecionada
        if (Array.isArray(value) && value.length > 0) {
          count += value.length;
        }
      } else if (value !== undefined && value !== '' && value !== null) {
        count += 1;
      }
    });
    return count;
  }, [filters]);

  /**
   * Obtém estatísticas das transações filtradas
   */
  const filteredStats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expenses;
    
    const paidTransactions = filteredTransactions.filter(t => t.status === 'paid').length;
    const pendingTransactions = filteredTransactions.filter(t => t.status === 'pending').length;
    
    return {
      total: filteredTransactions.length,
      income,
      expenses,
      balance,
      paid: paidTransactions,
      pending: pendingTransactions
    };
  }, [filteredTransactions]);

  /**
   * Busca inteligente com sugestões
   */
  const getSearchSuggestions = (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const term = searchTerm.toLowerCase();
    const suggestions = new Set<string>();

    transactions.forEach(transaction => {
      const description = transaction.description.toLowerCase();
      if (description.includes(term)) {
        suggestions.add(transaction.description);
      }
    });

    return Array.from(suggestions).slice(0, 5); // Limitar a 5 sugestões
  };

  /**
   * Aplica um filtro rápido predefinido
   */
  const applyQuickFilter = (filterType: 'income' | 'expense' | 'paid' | 'pending' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    switch (filterType) {
      case 'income':
        setFilters({ type: 'income' });
        break;
      case 'expense':
        setFilters({ type: 'expense' });
        break;
      case 'paid':
        setFilters({ status: 'paid' });
        break;
      case 'pending':
        setFilters({ status: 'pending' });
        break;
      case 'thisMonth':
        const thisMonthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
        setFilters({ dateStart: thisMonthStart, dateEnd: thisMonthEnd });
        break;
      case 'lastMonth':
        const lastMonthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
        const lastMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
        setFilters({ dateStart: lastMonthStart, dateEnd: lastMonthEnd });
        break;
    }
  };

  return {
    filters,
    filteredTransactions,
    isFiltersOpen,
    hasActiveFilters,
    activeFiltersCount,
    filteredStats,
    updateFilters,
    clearFilters,
    toggleFilters,
    getSearchSuggestions,
    applyQuickFilter
  };
};