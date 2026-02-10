import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Subscription, SubscriptionFormData } from '@/hooks/useSubscriptions';
import { SubscriptionEditModal } from './SubscriptionEditModal';

interface SubscriptionManagerProps {
  onBack?: () => void;
  subscriptions: Subscription[];
  loading: boolean;
  addSubscription: (data: SubscriptionFormData) => Promise<Subscription | undefined>;
  updateSubscription: (id: string, data: SubscriptionFormData) => Promise<Subscription | undefined>;
  deleteSubscription: (id: string) => Promise<void>;
}

export const SubscriptionManager = ({
  onBack,
  subscriptions,
  loading,
  addSubscription,
  updateSubscription,
  deleteSubscription,
}: SubscriptionManagerProps) => {

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    subscription?: Subscription | null;
    isEditing: boolean;
  }>({ isOpen: false, subscription: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    subscription?: Subscription | null;
  }>({ isOpen: false, subscription: null });

  const handleCreateSubscription = () => {
    setEditModal({ isOpen: true, subscription: null, isEditing: false });
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditModal({ isOpen: true, subscription, isEditing: true });
  };

  const handleSubmitSubscription = async (data: SubscriptionFormData) => {
    if (editModal.isEditing && editModal.subscription) {
      await updateSubscription(editModal.subscription.id, data);
    } else {
      await addSubscription(data);
    }
    setEditModal({ isOpen: false, subscription: null, isEditing: false });
  };

  const confirmDeleteSubscription = (subscription: Subscription) => {
    setDeleteDialog({ isOpen: true, subscription });
  };

  const handleDeleteSubscription = async () => {
    if (deleteDialog.subscription) {
      await deleteSubscription(deleteDialog.subscription.id);
      setDeleteDialog({ isOpen: false, subscription: null });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Assinaturas Mensais
            </h2>
            <p className="text-muted-foreground">
              Gerencie suas assinaturas e cobrancas mensais.
            </p>
          </div>
        </div>
        <Button onClick={handleCreateSubscription}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Assinatura
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma assinatura cadastrada
            </h3>
            <p className="text-muted-foreground mb-4">
              Cadastre sua primeira assinatura para gerar cobrancas automaticas.
            </p>
            <Button onClick={handleCreateSubscription}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Assinatura
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptions.map((subscription) => (
            <Card key={subscription.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {subscription.description}
                      <Badge variant={subscription.type === 'income' ? 'default' : 'secondary'}>
                        {subscription.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {subscription.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSubscription(subscription)}
                      className="h-8 w-8 p-0"
                      title="Editar assinatura"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirmDeleteSubscription(subscription)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir assinatura"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold">{formatCurrency(subscription.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dia de cobranca</span>
                  <span className="font-semibold">{subscription.charge_day}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={subscription.status === 'paid' ? 'default' : 'secondary'}>
                    {subscription.status === 'paid'
                      ? (subscription.type === 'income' ? 'Recebido' : 'Pago')
                      : (subscription.type === 'income' ? 'A Receber' : 'A Pagar')}
                  </Badge>
                  {!subscription.is_active && (
                    <Badge variant="outline">Pausada</Badge>
                  )}
                </div>
                {subscription.tags && subscription.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {subscription.tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={{
                          backgroundColor: tag.color + '15',
                          borderColor: tag.color + '40',
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {onBack && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={onBack} className="px-6 py-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      )}

      <SubscriptionEditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, subscription: null, isEditing: false })}
        onSubmit={handleSubmitSubscription}
        subscription={editModal.subscription}
        isEditing={editModal.isEditing}
      />

      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, subscription: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a assinatura "{deleteDialog.subscription?.description}"?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubscription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
