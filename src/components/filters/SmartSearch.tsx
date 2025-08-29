import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Transaction } from '@/hooks/useTransactions';

interface SmartSearchProps {
  transactions: Transaction[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchSuggestion {
  type: 'description' | 'category' | 'amount' | 'recent';
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

/**
 * Componente de busca inteligente com autocomplete
 * Fornece sugestões baseadas no histórico de transações
 */
const SmartSearch = ({
  transactions,
  value,
  onChange,
  placeholder = "Buscar transações...",
  className = ""
}: SmartSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carregar buscas recentes do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('financeapp-recent-searches');
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
    localStorage.setItem('financeapp-recent-searches', JSON.stringify(updated));
  };

  /**
   * Gera sugestões baseadas no termo de busca
   */
  const generateSuggestions = (searchTerm: string): SearchSuggestion[] => {
    if (!searchTerm || searchTerm.length < 1) {
      // Mostrar buscas recentes quando não há termo
      return recentSearches.map(search => ({
        type: 'recent',
        value: search,
        label: search,
        icon: <Clock className="w-4 h-4 text-muted-foreground" />
      }));
    }

    const term = searchTerm.toLowerCase();
    const newSuggestions: SearchSuggestion[] = [];
    const seen = new Set<string>();

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

    // Sugestões de valores (se o termo for numérico)
    if (/^\d+([.,]\d{0,2})?$/.test(term)) {
      const numericValue = parseFloat(term.replace(',', '.'));
      const amountMatches = transactions.filter(t => 
        Math.abs(t.amount - numericValue) < 0.01
      );

      if (amountMatches.length > 0) {
        const formattedAmount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(numericValue);

        newSuggestions.push({
          type: 'amount',
          value: numericValue.toString(),
          label: `Valor: ${formattedAmount}`,
          count: amountMatches.length,
          icon: amountMatches[0].type === 'income' 
            ? <TrendingUp className="w-4 h-4 text-green-500" />
            : <TrendingDown className="w-4 h-4 text-red-500" />
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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Manipula a seleção de uma sugestão
   */
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    const searchValue = suggestion.type === 'category' 
      ? suggestion.value // Para categorias, usar apenas o nome
      : suggestion.value;
    
    onChange(searchValue);
    saveRecentSearch(searchValue);
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
    localStorage.setItem('financeapp-recent-searches', JSON.stringify(updated));
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
                className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                onClick={() => handleSuggestionSelect(suggestion)}
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