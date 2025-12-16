import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag, TagFormData } from '@/hooks/useTags';

interface TagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TagFormData) => void;
  tag?: Tag | null;
  isEditing: boolean;
}

/**
 * Modal para criar ou editar uma tag
 */
export const TagEditModal = ({ isOpen, onClose, onSubmit, tag, isEditing }: TagEditModalProps) => {
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: '#3b82f6',
  });

  useEffect(() => {
    if (tag && isEditing) {
      setFormData({
        name: tag.name,
        color: tag.color,
      });
    } else {
      setFormData({
        name: '',
        color: '#3b82f6',
      });
    }
  }, [tag, isEditing, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      onSubmit(formData);
    }
  };

  const presetColors = [
    '#3b82f6', // azul
    '#10b981', // verde
    '#f59e0b', // amarelo/laranja
    '#ef4444', // vermelho
    '#8b5cf6', // roxo
    '#ec4899', // rosa
    '#06b6d4', // ciano
    '#84cc16', // verde limão
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modifique os dados da tag abaixo.'
              : 'Crie uma nova tag para organizar suas transações.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Tag</Label>
              <Input
                id="name"
                placeholder="Ex: Cartão, Viagem, Urgente..."
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      formData.color === color 
                        ? 'border-foreground scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20 h-10"
                />
                <span className="text-sm text-muted-foreground">Ou escolha uma cor personalizada</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

