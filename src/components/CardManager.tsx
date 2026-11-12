import React, { useState } from 'react';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useCards, Card, CardSummary, CardFormData } from '@/hooks/useCards';
import { CardFormModal } from './CardFormModal';
import { CardInvoiceModal } from './CardInvoiceModal';

interface CardManagerProps {
  onBack?: () => void;
}

export const CardManager = ({ onBack }: CardManagerProps) => {
  const { summary, loading, addCard, updateCard, deleteCard } = useCards();

  const [formModal, setFormModal] = useState<{
    isOpen: boolean;
    card?: Card | null;
    isEditing: boolean;
  }>({ isOpen: false, card: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    card?: Card | null;
  }>({ isOpen: false, card: null });

  const [invoiceModal, setInvoiceModal] = useState<{
    isOpen: boolean;
    card: Card | null;
  }>({ isOpen: false, card: null });

  const handleCreateCard = () => {
    setFormModal({
      isOpen: true,
      card: null,
      isEditing: false,
    });
  };

  const handleEditCard = (card: Card, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormModal({
      isOpen: true,
      card,
      isEditing: true,
    });
  };

  const handleDeleteCard = (card: Card, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({
      isOpen: true,
      card,
    });
  };

  const confirmDelete = async () => {
    if (deleteDialog.card) {
      await deleteCard(deleteDialog.card.id);
      setDeleteDialog({ isOpen: false, card: null });
    }
  };

  const handleFormSubmit = async (data: CardFormData) => {
    if (formModal.isEditing && formModal.card) {
      await updateCard(formModal.card.id, data);
    } else {
      await addCard(data);
    }
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-9">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Cartões de Crédito
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie seus cartões, limites e acompanhe o fechamento das faturas
            </p>
          </div>
        </div>

        <Button onClick={handleCreateCard} className="sm:self-auto self-start">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cartão
        </Button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          Carregando cartões de crédito...
        </div>
      ) : summary.length === 0 ? (
        <UICard className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Nenhum cartão cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Cadastre seus cartões de crédito para acompanhar faturas automáticas e limites de gastos.
            </p>
            <Button onClick={handleCreateCard}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Primeiro Cartão
            </Button>
          </CardContent>
        </UICard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((cardItem) => {
            const usagePercent = cardItem.usage_percent || 0;
            const isHighUsage = usagePercent >= 80;

            return (
              <UICard
                key={cardItem.id}
                onClick={() => setInvoiceModal({ isOpen: true, card: cardItem })}
                className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 relative overflow-hidden group bg-card"
              >
                {/* Faixa colorida decorativa do cartão */}
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: cardItem.color || '#6366f1' }}
                />

                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: cardItem.color || '#6366f1' }}
                      >
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CardTitle className="text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
                            {cardItem.name}
                          </CardTitle>
                          {cardItem.parent_card_id && (
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold text-primary border-primary/30">
                              ADICIONAL
                            </Badge>
                          )}
                          {cardItem.closing_soon && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${
                                cardItem.days_until_closing === 0
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {cardItem.days_until_closing === 0
                                ? 'Fecha hoje'
                                : `Fecha em ${cardItem.days_until_closing} ${cardItem.days_until_closing === 1 ? 'dia' : 'dias'}`}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] uppercase font-medium">
                            {cardItem.brand}
                          </Badge>
                          {cardItem.parent_card_id ? (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              do cartão {cardItem.parent_card_name || 'titular'}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Fecha dia {cardItem.closing_day} • Vence dia {cardItem.due_day}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleEditCard(cardItem, e)}
                        title="Editar cartão"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteCard(cardItem, e)}
                        title="Excluir cartão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5 pt-1 space-y-4">
                  {/* Fatura Atual */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Fatura Atual ({cardItem.current_invoice?.reference_month || 'Aberta'})</span>
                      {cardItem.current_invoice?.due_date && (
                        <span>Vence {formatDateBR(cardItem.current_invoice.due_date)}</span>
                      )}
                    </div>
                    <div className="text-xl font-bold text-foreground mt-1">
                      {formatCurrency(cardItem.current_invoice?.total || 0)}
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
                      <span>{cardItem.current_invoice?.transactions_count || 0} compras</span>
                      {cardItem.next_invoice_total > 0 && (
                        <span>Próx. fatura: {formatCurrency(cardItem.next_invoice_total)}</span>
                      )}
                    </div>
                  </div>

                  {/* Limite e Barra de Progresso */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Limite utilizado ({usagePercent}%)
                        {isHighUsage && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline" />
                        )}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(cardItem.used_amount)} / {formatCurrency(cardItem.limit_amount)}
                      </span>
                    </div>

                    <Progress
                      value={Math.min(100, usagePercent)}
                      className={`h-2 ${isHighUsage ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                    />

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                      <span>Disponível: {formatCurrency(cardItem.available_amount)}</span>
                      <span className="text-primary font-medium flex items-center gap-1 group-hover:underline">
                        <FileText className="w-3 h-3" />
                        Ver fatura
                      </span>
                    </div>
                  </div>
                </CardContent>
              </UICard>
            );
          })}
        </div>
      )}

      {/* Modal de Formulário (Criar / Editar) */}
      <CardFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, card: null, isEditing: false })}
        onSubmit={handleFormSubmit}
        card={formModal.card}
        isEditing={formModal.isEditing}
      />

      {/* Modal de Detalhes da Fatura */}
      <CardInvoiceModal
        isOpen={invoiceModal.isOpen}
        onClose={() => setInvoiceModal({ isOpen: false, card: null })}
        card={invoiceModal.card}
      />

      {/* Confirmação de Exclusão */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, card: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.card?.parent_card_id ? 'Excluir Cartão Adicional' : 'Excluir Cartão de Crédito'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.card?.parent_card_id ? (
                <>
                  Tem certeza que deseja excluir o cartão adicional{' '}
                  <strong>"{deleteDialog.card?.name}"</strong>?
                  <br />
                  <br />
                  As transações vinculadas a este cartão <strong>NÃO</strong> serão apagadas, mas
                  ficarão desvinculadas (sem cartão).
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir o cartão{' '}
                  <strong>"{deleteDialog.card?.name}"</strong>?
                  <br />
                  <br />
                  As transações vinculadas a este cartão <strong>NÃO</strong> serão apagadas, mas
                  ficarão desvinculadas (sem cartão). Cartões adicionais vinculados se tornarão cartões normais independentes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Cartão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
