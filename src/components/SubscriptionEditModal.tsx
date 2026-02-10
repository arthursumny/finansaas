import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useTags, TagFormData } from '@/hooks/useTags';
import { Subscription, SubscriptionFormData } from '@/hooks/useSubscriptions';
import { TagEditModal } from './TagEditModal';

interface SubscriptionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  subscription?: Subscription | null;
  isEditing?: boolean;
}

export const SubscriptionEditModal = ({
  isOpen,
  onClose,
  onSubmit,
  subscription,
  isEditing = false,
}: SubscriptionEditModalProps) => {
  const { getCategoryNamesByType } = useCategories();
  const { tags, addTag } = useTags();
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    type: 'expense',
    description: '',
    amount: 0,
    category: '',
    status: 'pending',
    charge_day: new Date().getDate(),
    is_active: true,
    tag_ids: [],
  });
  const [amountString, setAmountString] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing && subscription) {
      setFormData({
        type: subscription.type,
        description: subscription.description,
        amount: subscription.amount,
        category: subscription.category,
        status: subscription.status,
        charge_day: subscription.charge_day,
        is_active: subscription.is_active,
        tag_ids: subscription.tags?.map(tag => tag.id) || [],
      });
      setSelectedTagIds(subscription.tags?.map(tag => tag.id) || []);
      setAmountString(String(subscription.amount).replace('.', ','));
    } else {
      const today = new Date();
      setFormData({
        type: 'expense',
        description: '',
        amount: 0,
        category: '',
        status: 'pending',
        charge_day: today.getDate(),
        is_active: true,
        tag_ids: [],
      });
      setSelectedTagIds([]);
      setAmountString('');
    }
  }, [isEditing, subscription, isOpen]);

  const formatAmountForDisplay = (value: string): string => {
    if (!value) return '';

    let cleanValue = value.replace(/[^0-9,.]/g, '');

    if (!cleanValue.includes(',')) {
      const numericValue = cleanValue.replace(/\./g, '');
      if (numericValue && !isNaN(Number(numericValue))) {
        return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
    }

    if (cleanValue.includes(',')) {
      const [integerPart, decimalPart] = cleanValue.split(',');
      const cleanInteger = integerPart.replace(/\./g, '');

      if (cleanInteger && !isNaN(Number(cleanInteger))) {
        const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimalPart !== undefined ? `${formattedInteger},${decimalPart.slice(0, 2)}` : `${formattedInteger},`;
      }
    }

    return cleanValue;
  };

  const parseAmountString = (amountStr: string): number => {
    if (!amountStr) return 0;

    let cleanValue = amountStr.trim();

    if (cleanValue.includes('.') && cleanValue.includes(',')) {
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
      cleanValue = cleanValue.replace(',', '.');
    } else if (cleanValue.includes('.') && !cleanValue.includes(',')) {
      const parts = cleanValue.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
        cleanValue = cleanValue.replace(/\./g, '');
      }
    }

    return parseFloat(cleanValue) || 0;
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = async (tagData: TagFormData) => {
    try {
      const newTag = await addTag(tagData);
      if (newTag) {
        setSelectedTagIds(prev => [...prev, newTag.id]);
        setShowTagModal(false);
      }
    } catch (error) {
      // Erro tratado no hook
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseAmountString(amountString);
    if (!formData.description.trim() || amount <= 0 || !formData.category) return;

    if (formData.charge_day < 1 || formData.charge_day > 31) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        amount,
        tag_ids: selectedTagIds,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Assinatura Mensal' : 'Nova Assinatura Mensal'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Tipo</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={formData.type === 'income' ? 'income' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'income', category: '' }))}
                className="w-full h-11 font-medium"
              >
                Receita
              </Button>
              <Button
                type="button"
                variant={formData.type === 'expense' ? 'expense' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'expense', category: '' }))}
                className="w-full h-11 font-medium"
              >
                Despesa
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">Nome da assinatura</Label>
            <Input
              id="description"
              placeholder="Ex: Netflix, Spotify, Internet..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="h-11"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {getCategoryNamesByType(formData.type).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="amount" className="text-sm font-medium text-foreground">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              placeholder="0,00"
              value={amountString}
              className="h-11"
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9,.]/g, '');
                const formattedValue = formatAmountForDisplay(rawValue);
                setAmountString(formattedValue);
              }}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Dia de cobranca (1-31)</Label>
              <Input
                type="text"
                value={formData.charge_day || ''}
                className="h-11"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  if (numericValue === '') {
                    setFormData(prev => ({ ...prev, charge_day: 1 }));
                    return;
                  }
                  const day = Math.min(31, Math.max(1, parseInt(numericValue)));
                  setFormData(prev => ({ ...prev, charge_day: day }));
                }}
                placeholder="Ex: 10"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'paid' | 'pending') =>
                  setFormData(prev => ({ ...prev, status: value }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="paid">
                      {formData.type === 'income' ? 'Recebido' : 'Pago'}
                    </SelectItem>
                    <SelectItem value="pending">
                      {formData.type === 'income' ? 'A Receber' : 'A Pagar'}
                    </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Tags</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-background">
                {selectedTagIds.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className="cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: tag.color + '20', borderColor: tag.color + '40', color: tag.color }}
                      onClick={() => handleToggleTag(tagId)}
                    >
                      {tag.name}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.filter(tag => !selectedTagIds.includes(tag.id)).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    style={{ borderColor: tag.color + '60' }}
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTagModal(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Nova tag
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <TagEditModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSubmit={handleCreateTag}
        tag={null}
        isEditing={false}
      />
    </Dialog>
  );
};
