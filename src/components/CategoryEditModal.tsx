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
import { Category, CategoryFormData } from '@/hooks/useCategories';

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  category?: Category | null;
  isEditing?: boolean;
}

/**
 * Modal para criar e editar categorias de receitas e despesas
 */
export const CategoryEditModal = ({
  isOpen,
  onClose,
  onSubmit,
  category,
  isEditing = false,
}: CategoryEditModalProps) => {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    type: 'expense',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (isEditing && category) {
      setFormData({
        name: category.name,
        type: category.type,
      });
    } else {
      setFormData({
        name: '',
        type: 'expense',
      });
    }
  }, [isEditing, category, isOpen]);

  /**
   * Manipula o envio do formulário
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      // Erro já tratado no hook useCategories
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome da Categoria */}
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Nome da Categoria
            </Label>
            <Input
              id="name"
              placeholder="Ex: Alimentação, Salário, Transporte..."
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="h-11"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Tipo da Categoria */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Tipo
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'income' | 'expense') => 
                setFormData(prev => ({ ...prev, type: value }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-11"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {isEditing ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                isEditing ? 'Salvar' : 'Criar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};