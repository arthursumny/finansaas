import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X, Search } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { Transaction } from '@/hooks/useTransactions';
import SmartSearch from './SmartSearch';

export interface TransactionFilters {
  dateStart?: string;
  dateEnd?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: 'income' | 'expense';
  status?: 'paid' | 'pending';
  searchTerm?: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
  onClearFilters: () => void;
  isOpen: boolean;
  onToggle: () => void;
  activeFiltersCount: number;
  transactions: Transaction[];
}

/**
 * Componente de filtros avançados para transações
 * Permite filtrar por período, categoria, valor, tipo, status e busca
 */
const TransactionFiltersComponent = ({
  filters,
  onFiltersChange,
  onClearFilters,
  isOpen,
  onToggle,
  activeFiltersCount,
  transactions
}: TransactionFiltersProps) => {
  const { categories } = useCategories();
  const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters);

  // Sincronizar filtros locais com os filtros externos
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  /**
   * Atualiza um filtro específico
   */
  const updateFilter = (key: keyof TransactionFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  /**
   * Remove um filtro específico
   */
  const removeFilter = (key: keyof TransactionFilters) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  /**
   * Formata a data para exibição
   */
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    return dateString;
  };

  return (
    <div className="space-y-4">
      {/* Botão de toggle dos filtros */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onToggle}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Painel de filtros */}
      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros Avançados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Busca Inteligente */}
            <div className="space-y-2">
              <Label htmlFor="search">Busca Inteligente</Label>
              <SmartSearch
                transactions={transactions}
                value={localFilters.searchTerm || ''}
                onChange={(value) => updateFilter('searchTerm', value)}
                onQuickFilter={(filterType) => {
                  // Aplicar filtros rápidos
                  const [action, value] = filterType.split(':');
                  if (action === 'filter') {
                    switch (value) {
                      case 'income':
                        updateFilter('type', 'income');
                        break;
                      case 'expense':
                        updateFilter('type', 'expense');
                        break;
                      case 'pending':
                        updateFilter('status', 'pending');
                        break;
                      case 'thisMonth':
                        const now = new Date();
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                        updateFilter('dateStart', startOfMonth);
                        updateFilter('dateEnd', endOfMonth);
                        break;
                    }
                  }
                }}
                placeholder="Buscar transações, categorias, valores..."
              />
            </div>

            {/* Filtros de período */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateStart">Data início</Label>
                <Input
                  id="dateStart"
                  type="date"
                  value={formatDateForInput(localFilters.dateStart)}
                  onChange={(e) => updateFilter('dateStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateEnd">Data fim</Label>
                <Input
                  id="dateEnd"
                  type="date"
                  value={formatDateForInput(localFilters.dateEnd)}
                  onChange={(e) => updateFilter('dateEnd', e.target.value)}
                />
              </div>
            </div>

            {/* Filtros de valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minAmount">Valor mínimo</Label>
                <Input
                  id="minAmount"
                  type="number"
                  placeholder="R$ 0,00"
                  value={localFilters.minAmount || ''}
                  onChange={(e) => updateFilter('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAmount">Valor máximo</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  placeholder="R$ 0,00"
                  value={localFilters.maxAmount || ''}
                  onChange={(e) => updateFilter('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            {/* Filtros de categoria, tipo e status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={localFilters.category || 'all'}
                  onValueChange={(value) => updateFilter('category', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={localFilters.type || 'all'}
                  onValueChange={(value) => updateFilter('type', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={localFilters.status || 'all'}
                  onValueChange={(value) => updateFilter('status', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtros ativos */}
            {activeFiltersCount > 0 && (
              <div className="space-y-2">
                <Label>Filtros ativos:</Label>
                <div className="flex flex-wrap gap-2">
                  {localFilters.searchTerm && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Busca: "{localFilters.searchTerm}"
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('searchTerm')}
                      />
                    </Badge>
                  )}
                  {localFilters.dateStart && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Início: {localFilters.dateStart}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('dateStart')}
                      />
                    </Badge>
                  )}
                  {localFilters.dateEnd && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Fim: {localFilters.dateEnd}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('dateEnd')}
                      />
                    </Badge>
                  )}
                  {localFilters.category && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Categoria: {localFilters.category}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('category')}
                      />
                    </Badge>
                  )}
                  {localFilters.type && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Tipo: {localFilters.type === 'income' ? 'Receita' : 'Despesa'}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('type')}
                      />
                    </Badge>
                  )}
                  {localFilters.status && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Status: {localFilters.status === 'paid' ? 'Pago' : 'Pendente'}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('status')}
                      />
                    </Badge>
                  )}
                  {localFilters.minAmount && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Min: R$ {localFilters.minAmount.toFixed(2)}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('minAmount')}
                      />
                    </Badge>
                  )}
                  {localFilters.maxAmount && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Max: R$ {localFilters.maxAmount.toFixed(2)}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeFilter('maxAmount')}
                      />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransactionFiltersComponent;