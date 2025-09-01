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
import { Goal, GoalFormData } from '@/hooks/useGoals';

interface GoalEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => Promise<void>;
  goal?: Goal | null;
  isEditing?: boolean;
}

/**
 * Modal para criar e editar metas de economia
 */
export const GoalEditModal = ({
  isOpen,
  onClose,
  onSubmit,
  goal,
  isEditing = false,
}: GoalEditModalProps) => {
  const [formData, setFormData] = useState<GoalFormData>({
    title: '',
    target_amount: 0,
    target_date: '',
    period: 'monthly',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    target_amount?: string;
    target_date?: string;
  }>({});

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (isEditing && goal) {
      setFormData({
        title: goal.title,
        target_amount: goal.target_amount,
        target_date: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : '',
        period: goal.period,
      });
    } else {
      setFormData({
        title: '',
        target_amount: 0,
        target_date: '',
        period: 'monthly',
      });
    }
    setErrors({});
  }, [isEditing, goal, isOpen]);

  /**
   * Valida o formulário
   */
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Digite um título para a meta';
    }

    if (!formData.target_amount || formData.target_amount <= 0) {
      newErrors.target_amount = 'O valor deve ser maior que zero';
    }

    if (!formData.target_date) {
      newErrors.target_date = 'Selecione uma data limite';
    } else {
      const targetDate = new Date(formData.target_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (targetDate <= today) {
        newErrors.target_date = 'A data limite deve ser futura';
      }
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
      // Erro já tratado no hook useGoals
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
   * Calcula a data mínima (amanhã)
   */
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Meta' : 'Nova Meta de Economia'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título da Meta */}
          <div className="space-y-3">
            <Label htmlFor="title" className="text-sm font-medium text-foreground">
              Título da Meta
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="Ex: Viagem para Europa, Carro novo..."
              value={formData.title}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, title: e.target.value }));
                if (errors.title) {
                  setErrors(prev => ({ ...prev, title: undefined }));
                }
              }}
              className={`h-11 ${
                errors.title ? 'border-destructive' : ''
              }`}
              required
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Valor da Meta */}
          <div className="space-y-3">
            <Label htmlFor="target_amount" className="text-sm font-medium text-foreground">
              Valor da Meta
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="target_amount"
                type="number"
                placeholder="0,00"
                value={formData.target_amount || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, target_amount: value }));
                  if (errors.target_amount) {
                    setErrors(prev => ({ ...prev, target_amount: undefined }));
                  }
                }}
                className={`h-11 pl-10 ${
                  errors.target_amount ? 'border-destructive' : ''
                }`}
                min="0"
                step="0.01"
                required
                disabled={isSubmitting}
              />
            </div>
            {errors.target_amount && (
              <p className="text-sm text-destructive">{errors.target_amount}</p>
            )}
            {formData.target_amount > 0 && (
              <p className="text-sm text-muted-foreground">
                Valor: {formatCurrency(formData.target_amount)}
              </p>
            )}
          </div>

          {/* Data Limite */}
          <div className="space-y-3">
            <Label htmlFor="target_date" className="text-sm font-medium text-foreground">
              Data Limite
            </Label>
            <Input
              id="target_date"
              type="date"
              value={formData.target_date}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, target_date: e.target.value }));
                if (errors.target_date) {
                  setErrors(prev => ({ ...prev, target_date: undefined }));
                }
              }}
              className={`h-11 ${
                errors.target_date ? 'border-destructive' : ''
              }`}
              min={getMinDate()}
              required
              disabled={isSubmitting}
            />
            {errors.target_date && (
              <p className="text-sm text-destructive">{errors.target_date}</p>
            )}
          </div>

          {/* Período de Contribuição */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Período de Contribuição
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
                      Contribuição mensal para a meta
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="yearly">
                  <div className="flex flex-col">
                    <span>Anual</span>
                    <span className="text-xs text-muted-foreground">
                      Contribuição anual para a meta
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
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing ? 'Atualizando...' : 'Criando...'}
                </div>
              ) : (
                isEditing ? 'Atualizar Meta' : 'Criar Meta'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};