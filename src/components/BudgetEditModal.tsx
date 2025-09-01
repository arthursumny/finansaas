import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Budget, BudgetFormData } from '@/hooks/useBudgets';
import { Category } from '@/hooks/useCategories';

interface BudgetEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetFormData) => Promise<void>;
  budget?: Budget | null;
  isEditing?: boolean;
  categories: Category[];
  existingBudgets: Budget[];
}

/**
 * Modal para criar e editar orçamentos por categoria
 */
export const BudgetEditModal = ({
  isOpen,
  onClose,
  onSubmit,
  budget,
  isEditing = false,
  categories,
  existingBudgets,
}: BudgetEditModalProps) => {
  const [formData, setFormData] = useState<BudgetFormData>({
    category_id: '',
    amount: 0,
    period: 'monthly',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    category_id?: string;
    amount?: string;
  }>({});

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (isEditing && budget) {
      setFormData({
        category_id: budget.category_id,
        amount: budget.amount,
        period: budget.period,
      });
    } else {
      setFormData({
        category_id: '',
        amount: 0,
        period: 'monthly',
      });
    }
    setErrors({});
  }, [isEditing, budget, isOpen]);

  /**
   * Valida o formulário
   */
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.category_id) {
      newErrors.category_id = 'Selecione uma categoria';
    } else if (!isEditing) {
      // Verificar se já existe orçamento para esta categoria
      const existingBudget = existingBudgets.find(
        b => b.category_id === formData.category_id
      );
      if (existingBudget) {
        newErrors.category_id = 'Já existe um orçamento para esta categoria';
      }
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'O valor deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Manipula o envio do formulário
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      // Erro já tratado no hook useBudgets
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Manipula o fechamento do modal
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  /**
   * Formata valor monetário para exibição
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  /**
   * Filtra categorias disponíveis (remove as que já têm orçamento)
   */
  const getAvailableCategories = () => {
    if (isEditing) {
      return categories;
    }
    
    const usedCategoryIds = existingBudgets.map(b => b.category_id);
    return categories.filter(cat => !usedCategoryIds.includes(cat.id));
  };

  const availableCategories = getAvailableCategories();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Categoria */}
          <div className="space-y-3">
            <Label htmlFor="category" className="text-sm font-medium text-foreground">
              Categoria
            </Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, category_id: value }));
                if (errors.category_id) {
                  setErrors(prev => ({ ...prev, category_id: undefined }));
                }
              }}
              disabled={isSubmitting || isEditing}
            >
              <SelectTrigger className={`h-11 ${
                errors.category_id ? 'border-destructive' : ''
              }`}>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {isEditing 
                      ? 'Nenhuma categoria disponível'
                      : 'Todas as categorias já possuem orçamento'
                    }
                  </div>
                ) : (
                  availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive">{errors.category_id}</p>
            )}
          </div>

          {/* Valor do Orçamento */}
          <div className="space-y-3">
            <Label htmlFor="amount" className="text-sm font-medium text-foreground">
              Valor do Orçamento
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="amount"
                type="number"
                placeholder="0,00"
                value={formData.amount || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, amount: value }));
                  if (errors.amount) {
                    setErrors(prev => ({ ...prev, amount: undefined }));
                  }
                }}
                className={`h-11 pl-10 ${
                  errors.amount ? 'border-destructive' : ''
                }`}
                min="0"
                step="0.01"
                required
                disabled={isSubmitting}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
            {formData.amount > 0 && (
              <p className="text-sm text-muted-foreground">
                Valor: {formatCurrency(formData.amount)}
              </p>
            )}
          </div>

          {/* Período */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Período
            </Label>
            <Select
              value={formData.period}
              onValueChange={(value: 'monthly' | 'yearly') => 
                setFormData(prev => ({ ...prev, period: value }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">
                  <div className="flex flex-col">
                    <span>Mensal</span>
                    <span className="text-xs text-muted-foreground">
                      Orçamento renovado todo mês
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="yearly">
                  <div className="flex flex-col">
                    <span>Anual</span>
                    <span className="text-xs text-muted-foreground">
                      Orçamento renovado todo ano
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || availableCategories.length === 0}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing ? 'Atualizando...' : 'Criando...'}
                </div>
              ) : (
                isEditing ? 'Atualizar Orçamento' : 'Criar Orçamento'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};