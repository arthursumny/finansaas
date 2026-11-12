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
import { Card, CardBrand, CardFormData } from '@/hooks/useCards';

interface CardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CardFormData) => Promise<any>;
  card?: Card | null;
  isEditing?: boolean;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Âmbar/Laranja
  '#ef4444', // Vermelho
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#0f172a', // Grafite
];

const BRAND_OPTIONS: { value: CardBrand; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
];

export const CardFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  card,
  isEditing = false,
}: CardFormModalProps) => {
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    brand: 'outro',
    limit_amount: 0,
    closing_day: 1,
    due_day: 10,
    color: '#6366f1',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing && card) {
      setFormData({
        name: card.name,
        brand: card.brand,
        limit_amount: card.limit_amount,
        closing_day: card.closing_day,
        due_day: card.due_day,
        color: card.color || '#6366f1',
        is_active: card.is_active,
      });
    } else {
      setFormData({
        name: '',
        brand: 'mastercard',
        limit_amount: 0,
        closing_day: 1,
        due_day: 10,
        color: '#6366f1',
        is_active: true,
      });
    }
    setErrors({});
  }, [isEditing, card, isOpen]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) {
      errs.name = 'Informe o nome do cartão.';
    }

    if (!formData.limit_amount || formData.limit_amount <= 0) {
      errs.limit_amount = 'O limite deve ser maior que zero.';
    }

    if (!formData.closing_day || formData.closing_day < 1 || formData.closing_day > 31) {
      errs.closing_day = 'O dia de fechamento deve ser entre 1 e 31.';
    }

    if (!formData.due_day || formData.due_day < 1 || formData.due_day > 31) {
      errs.due_day = 'O dia de vencimento deve ser entre 1 e 31.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      // Erro tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome do Cartão */}
          <div className="space-y-2">
            <Label htmlFor="card-name">Nome do Cartão</Label>
            <Input
              id="card-name"
              placeholder="Ex: Nubank Roxinho, Itaú Black..."
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          {/* Bandeira */}
          <div className="space-y-2">
            <Label htmlFor="card-brand">Bandeira</Label>
            <Select
              value={formData.brand}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, brand: value as CardBrand }))}
              disabled={isSubmitting}
            >
              <SelectTrigger id="card-brand">
                <SelectValue placeholder="Selecione a bandeira" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Limite */}
          <div className="space-y-2">
            <Label htmlFor="card-limit">Limite de Crédito</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="card-limit"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="pl-9"
                value={formData.limit_amount || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    limit_amount: parseFloat(e.target.value) || 0,
                  }))
                }
                disabled={isSubmitting}
              />
            </div>
            {errors.limit_amount && <p className="text-sm text-destructive">{errors.limit_amount}</p>}
          </div>

          {/* Dias de Fechamento e Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closing-day">Dia do Fechamento</Label>
              <Input
                id="closing-day"
                type="number"
                min="1"
                max="31"
                placeholder="1"
                value={formData.closing_day || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    closing_day: parseInt(e.target.value, 10) || 1,
                  }))
                }
                disabled={isSubmitting}
              />
              {errors.closing_day && <p className="text-xs text-destructive">{errors.closing_day}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-day">Dia do Vencimento</Label>
              <Input
                id="due-day"
                type="number"
                min="1"
                max="31"
                placeholder="10"
                value={formData.due_day || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    due_day: parseInt(e.target.value, 10) || 10,
                  }))
                }
                disabled={isSubmitting}
              />
              {errors.due_day && <p className="text-xs text-destructive">{errors.due_day}</p>}
            </div>
          </div>

          {/* Cor do Cartão */}
          <div className="space-y-2">
            <Label>Cor do Cartão</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color: col }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === col ? 'scale-110 border-foreground shadow-sm' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                  aria-label={`Cor ${col}`}
                />
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Cartão'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
