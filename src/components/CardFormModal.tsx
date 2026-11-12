import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardBrand, CardFormData, useCards } from '@/hooks/useCards';

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
  const { cards } = useCards();

  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    brand: 'outro',
    limit_amount: 0,
    closing_day: 1,
    due_day: 10,
    min_payment_percent: 15,
    parent_card_id: null,
    color: '#6366f1',
    is_active: true,
  });

  const [isAdditional, setIsAdditional] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cartões que podem ser titular: não são adicionais e não são o próprio cartão editado
  const eligibleParents = useMemo(() => {
    return cards.filter((c) => !c.parent_card_id && (!card || c.id !== card.id));
  }, [cards, card]);

  // Se o cartão atual já for pai de outros adicionais, ele não pode virar adicional
  const hasChildren = useMemo(() => {
    if (!card) return false;
    return cards.some((c) => c.parent_card_id === card.id);
  }, [cards, card]);

  useEffect(() => {
    if (isEditing && card) {
      const isAdd = Boolean(card.parent_card_id);
      setIsAdditional(isAdd);
      setFormData({
        name: card.name,
        brand: card.brand,
        limit_amount: card.limit_amount,
        closing_day: card.closing_day,
        due_day: card.due_day,
        min_payment_percent: card.min_payment_percent ?? 15,
        parent_card_id: card.parent_card_id || null,
        color: card.color || '#6366f1',
        is_active: card.is_active,
      });
    } else {
      setIsAdditional(false);
      setFormData({
        name: '',
        brand: 'mastercard',
        limit_amount: 0,
        closing_day: 1,
        due_day: 10,
        min_payment_percent: 15,
        parent_card_id: null,
        color: '#6366f1',
        is_active: true,
      });
    }
    setErrors({});
  }, [isEditing, card, isOpen]);

  const clearRelatedErrors = () => {
    setErrors((prev) => {
      const {
        limit_amount,
        closing_day,
        due_day,
        min_payment_percent,
        parent_card_id,
        ...rest
      } = prev;
      return rest;
    });
  };

  const handleToggleAdditional = (checked: boolean) => {
    setIsAdditional(checked);
    clearRelatedErrors();
    if (!checked) {
      setFormData((prev) => ({
        ...prev,
        parent_card_id: null,
      }));
    } else if (eligibleParents.length > 0) {
      const firstParent = eligibleParents[0];
      setFormData((prev) => ({
        ...prev,
        parent_card_id: firstParent.id,
        limit_amount: firstParent.limit_amount,
        closing_day: firstParent.closing_day,
        due_day: firstParent.due_day,
        min_payment_percent: firstParent.min_payment_percent ?? 15,
      }));
    }
  };

  const handleParentSelect = (parentId: string) => {
    clearRelatedErrors();
    const parent = eligibleParents.find((c) => c.id === parentId);
    if (parent) {
      setFormData((prev) => ({
        ...prev,
        parent_card_id: parent.id,
        limit_amount: parent.limit_amount,
        closing_day: parent.closing_day,
        due_day: parent.due_day,
        min_payment_percent: parent.min_payment_percent ?? 15,
      }));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) {
      errs.name = 'Informe o nome do cartão.';
    }

    if (isAdditional) {
      if (!formData.parent_card_id) {
        errs.parent_card_id = 'Selecione o cartão titular.';
      }
    } else {
      if (!formData.limit_amount || formData.limit_amount <= 0) {
        errs.limit_amount = 'O limite deve ser maior que zero.';
      }

      if (!formData.closing_day || formData.closing_day < 1 || formData.closing_day > 31) {
        errs.closing_day = 'O dia de fechamento deve ser entre 1 e 31.';
      }

      if (!formData.due_day || formData.due_day < 1 || formData.due_day > 31) {
        errs.due_day = 'O dia de vencimento deve ser entre 1 e 31.';
      }

      const minPct = Number(formData.min_payment_percent ?? 15);
      if (isNaN(minPct) || minPct < 0 || minPct > 100) {
        errs.min_payment_percent = 'O percentual de pagamento mínimo deve ser entre 0% e 100%.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        parent_card_id: isAdditional ? formData.parent_card_id : null,
      });
      onClose();
    } catch {
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

          {/* Opção Cartão Adicional */}
          {!hasChildren && eligibleParents.length > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-additional"
                  checked={isAdditional}
                  onCheckedChange={(checked) => handleToggleAdditional(Boolean(checked))}
                  disabled={isSubmitting}
                />
                <Label htmlFor="is-additional" className="text-sm font-medium cursor-pointer">
                  Este é um cartão adicional
                </Label>
              </div>

              {isAdditional && (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="parent-card" className="text-xs">
                    Cartão titular
                  </Label>
                  <Select
                    value={formData.parent_card_id || ''}
                    onValueChange={handleParentSelect}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="parent-card" className="h-9">
                      <SelectValue placeholder="Selecione o titular" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name} (Limite: R$ {parent.limit_amount.toLocaleString('pt-BR')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.parent_card_id && (
                    <p className="text-xs text-destructive">{errors.parent_card_id}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Limite */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="card-limit">Limite de Crédito</Label>
              {isAdditional && (
                <span className="text-xs text-muted-foreground font-medium">Herdado do titular</span>
              )}
            </div>
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
                disabled={isSubmitting || isAdditional}
              />
            </div>
            {isAdditional ? (
              <p className="text-xs text-muted-foreground">Herdado do cartão titular</p>
            ) : (
              errors.limit_amount && <p className="text-sm text-destructive">{errors.limit_amount}</p>
            )}
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
                disabled={isSubmitting || isAdditional}
              />
              {isAdditional ? (
                <p className="text-xs text-muted-foreground">Herdado do titular</p>
              ) : (
                errors.closing_day && <p className="text-xs text-destructive">{errors.closing_day}</p>
              )}
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
                disabled={isSubmitting || isAdditional}
              />
              {isAdditional ? (
                <p className="text-xs text-muted-foreground">Herdado do titular</p>
              ) : (
                errors.due_day && <p className="text-xs text-destructive">{errors.due_day}</p>
              )}
            </div>
          </div>

          {/* Pagamento mínimo (%) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="min-payment-percent">Pagamento mínimo (%)</Label>
              {isAdditional && (
                <span className="text-xs text-muted-foreground font-medium">Herdado do titular</span>
              )}
            </div>
            <Input
              id="min-payment-percent"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="15"
              value={formData.min_payment_percent ?? 15}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  min_payment_percent: parseFloat(e.target.value) || 0,
                }))
              }
              disabled={isSubmitting || isAdditional}
            />
            <p className="text-xs text-muted-foreground">
              {isAdditional ? 'Herdado do cartão titular' : 'Padrão dos bancos: 15%'}
            </p>
            {!isAdditional && errors.min_payment_percent && (
              <p className="text-xs text-destructive">{errors.min_payment_percent}</p>
            )}
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
