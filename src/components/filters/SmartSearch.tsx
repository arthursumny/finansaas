import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X, Clock, TrendingUp, TrendingDown, Calendar, Hash } from 'lucide-react';
import { Transaction } from '@/hooks/useTransactions';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SmartSearchProps {
  transactions: Transaction[];
  value: string;
  onChange: (value: string) => void;
  onQuickFilter?: (filterType: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchSuggestion {
  type: 'description' | 'category' | 'amount' | 'recent' | 'date' | 'quick';
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  action?: string; // Para ações rápidas como 'filter:income'
}

/**
 * Componente de busca inteligente com autocomplete
 * Fornece sugestões baseadas no histórico de transações
 */
const SmartSearch = ({
  transactions,
  value,
  onChange,
  onQuickFilter,
  placeholder = "Buscar transações...",
  className = ""
}: SmartSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Carregar buscas recentes do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('FinanSaaS-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar buscas recentes:', error);
      }
    }
  }, []);

  // Salvar buscas recentes no localStorage
  const saveRecentSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;
    
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('FinanSaaS-recent-searches', JSON.stringify(updated));
  };

  /**
   * Gera sugestões baseadas no termo de busca
   */
  const generateSuggestions = (searchTerm: string): SearchSuggestion[] => {
    if (!searchTerm || searchTerm.length < 1) {
      // Mostrar buscas recentes e filtros rápidos quando não há termo
      const quickFilters: SearchSuggestion[] = [
        {
          type: 'quick',
          value: 'receita',
          label: 'Mostrar apenas receitas',
          action: 'filter:income',
          icon: <TrendingUp className="w-4 h-4 text-green-500" />
        },
        {
          type: 'quick',
          value: 'despesa',
          label: 'Mostrar apenas despesas',
          action: 'filter:expense',
          icon: <TrendingDown className="w-4 h-4 text-red-500" />
        },
        {
          type: 'quick',
          value: 'pendente',
          label: 'Mostrar transações pendentes',
          action: 'filter:pending',
          icon: <Clock className="w-4 h-4 text-orange-500" />
        },
        {
          type: 'quick',
          value: 'este mês',
          label: 'Transações deste mês',
          action: 'filter:thisMonth',
          icon: <Calendar className="w-4 h-4 text-blue-500" />
        }
      ];

      const recentSuggestions = recentSearches.map(search => ({
        type: 'recent' as const,
        value: search,
        label: search,
        icon: <Clock className="w-4 h-4 text-muted-foreground" />
      }));

      return [...quickFilters, ...recentSuggestions];
    }

    const term = searchTerm.toLowerCase();
    const newSuggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();

    // Filtros rápidos baseados no termo
    if ('receita'.includes(term) || 'income'.includes(term)) {
      newSuggestions.push({
        type: 'quick',
        value: 'receita',
        label: 'Filtrar por receitas',
        action: 'filter:income',
        icon: <TrendingUp className="w-4 h-4 text-green-500" />
      });
    }
    
    if ('despesa'.includes(term) || 'expense'.includes(term) || 'gasto'.includes(term)) {
      newSuggestions.push({
        type: 'quick',
        value: 'despesa',
        label: 'Filtrar por despesas',
        action: 'filter:expense',
        icon: <TrendingDown className="w-4 h-4 text-red-500" />
      });
    }
    
    if ('pendente'.includes(term) || 'pending'.includes(term)) {
      newSuggestions.push({
        type: 'quick',
        value: 'pendente',
        label: 'Filtrar por pendentes',
        action: 'filter:pending',
        icon: <Clock className="w-4 h-4 text-orange-500" />
      });
    }

    // Sugestões de descrições
    const descriptionMatches = new Map<string, number>();
    transactions.forEach(transaction => {
      const description = transaction.description.toLowerCase();
      if (description.includes(term)) {
        const count = descriptionMatches.get(transaction.description) || 0;
        descriptionMatches.set(transaction.description, count + 1);
      }
    });

    // Adicionar top 3 descrições mais frequentes
    Array.from(descriptionMatches.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([description, count]) => {
        if (!seen.has(description)) {
          newSuggestions.push({
            type: 'description',
            value: description,
            label: description,
            count,
            icon: <Search className="w-4 h-4 text-muted-foreground" />
          });
          seen.add(description);
        }
      });

    // Sugestões de categorias
    const categoryMatches = new Map<string, number>();
    transactions.forEach(transaction => {
      const category = transaction.category.toLowerCase();
      if (category.includes(term)) {
        const count = categoryMatches.get(transaction.category) || 0;
        categoryMatches.set(transaction.category, count + 1);
      }
    });

    // Adicionar top 2 categorias mais frequentes
    Array.from(categoryMatches.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .forEach(([category, count]) => {
        if (!seen.has(category)) {
          newSuggestions.push({
            type: 'category',
            value: category,
            label: `Categoria: ${category}`,
            count,
            icon: <Badge className="w-4 h-4" />
          });
          seen.add(category);
        }
      });

    // Sugestões de data
    const dateMatches = new Map<string, number>();
    transactions.forEach(transaction => {
      const transactionDate = parseISO(transaction.date);
      const formattedDate = format(transactionDate, 'dd/MM/yyyy', { locale: ptBR });
      const monthYear = format(transactionDate, 'MMMM yyyy', { locale: ptBR });
      
      if (formattedDate.includes(term) || monthYear.toLowerCase().includes(term)) {
        const count = dateMatches.get(formattedDate) || 0;
        dateMatches.set(formattedDate, count + 1);
      }
    });

    // Adicionar top 2 datas mais frequentes
    Array.from(dateMatches.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .forEach(([date, count]) => {
        if (!seen.has(date)) {
          newSuggestions.push({
            type: 'date',
            value: date,
            label: `Data: ${date}`,
            count,
            icon: <Calendar className="w-4 h-4 text-blue-500" />
          });
          seen.add(date);
        }
      });

    // Sugestões de valores (busca mais flexível)
    if (/^\d+([.,]\d{0,2})?$/.test(term)) {
      const numericValue = parseFloat(term.replace(',', '.'));
      
      // Busca exata
      const exactMatches = transactions.filter(t => 
        Math.abs(t.amount - numericValue) < 0.01
      );
      
      // Busca aproximada (±10%)
      const approximateMatches = transactions.filter(t => 
        Math.abs(t.amount - numericValue) <= numericValue * 0.1 && 
        Math.abs(t.amount - numericValue) >= 0.01
      );

      if (exactMatches.length > 0) {
        const formattedAmount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(numericValue);

        newSuggestions.push({
          type: 'amount',
          value: numericValue.toString(),
          label: `Valor exato: ${formattedAmount}`,
          count: exactMatches.length,
          icon: exactMatches[0].type === 'income' 
            ? <TrendingUp className="w-4 h-4 text-green-500" />
            : <TrendingDown className="w-4 h-4 text-red-500" />
        });
      }
      
      if (approximateMatches.length > 0) {
        const formattedAmount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(numericValue);

        newSuggestions.push({
          type: 'amount',
          value: `~${numericValue.toString()}`,
          label: `Valores próximos a ${formattedAmount}`,
          count: approximateMatches.length,
          icon: <Hash className="w-4 h-4 text-purple-500" />
        });
      }
    }

    return newSuggestions.slice(0, 6); // Limitar a 6 sugestões
  };

  // Atualizar sugestões quando o valor muda
  useEffect(() => {
    setSuggestions(generateSuggestions(value));
  }, [value, transactions, recentSearches]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset do índice selecionado quando as sugestões mudam
  useEffect(() => {
    setSelectedIndex(-1);
    suggestionRefs.current = suggestionRefs.current.slice(0, suggestions.length);
  }, [suggestions]);

  /**
   * Manipula a navegação por teclado
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
          // Scroll para a sugestão selecionada
          setTimeout(() => {
            suggestionRefs.current[newIndex]?.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth'
            });
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
          // Scroll para a sugestão selecionada
          setTimeout(() => {
            suggestionRefs.current[newIndex]?.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth'
            });
          }, 0);
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  /**
   * Manipula a seleção de uma sugestão
   */
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    // Se for uma ação rápida, aplicar filtro através do callback
    if (suggestion.type === 'quick' && suggestion.action && onQuickFilter) {
      onQuickFilter(suggestion.action);
      setIsOpen(false);
      return;
    }
    
    const searchValue = suggestion.type === 'category' 
      ? suggestion.value // Para categorias, usar apenas o nome
      : suggestion.value;
    
    onChange(searchValue);
    
    // Salvar apenas se não for uma busca recente
    if (suggestion.type !== 'recent') {
      saveRecentSearch(searchValue);
    }
    
    setIsOpen(false);
    inputRef.current?.blur();
  };

  /**
   * Manipula o envio da busca
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      saveRecentSearch(value.trim());
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  /**
   * Limpa o campo de busca
   */
  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  /**
   * Remove uma busca recente
   */
  const removeRecentSearch = (searchTerm: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== searchTerm);
    setRecentSearches(updated);
    localStorage.setItem('FinanSaaS-recent-searches', JSON.stringify(updated));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10"
            autoComplete="off"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Dropdown de sugestões */}
      {isOpen && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto shadow-lg border">
          <CardContent className="p-0">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                ref={(el) => (suggestionRefs.current[index] = el)}
                className={`flex items-center justify-between p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => handleSuggestionSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {suggestion.icon}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{suggestion.label}</div>
                    {suggestion.count && (
                      <div className="text-xs text-muted-foreground">
                        {suggestion.count} transação{suggestion.count > 1 ? 'ões' : ''}
                      </div>
                    )}
                  </div>
                </div>
                
                {suggestion.type === 'recent' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => removeRecentSearch(suggestion.value, e)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartSearch;