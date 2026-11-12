import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardInvoiceDetails, useCards } from '@/hooks/useCards';
import { useToast } from '@/hooks/use-toast';

interface CardInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  initialMonth?: string;
}

export const CardInvoiceModal = ({
  isOpen,
  onClose,
  card,
  initialMonth,
}: CardInvoiceModalProps) => {
  const { fetchInvoice, fetchInvoicesHistory, payInvoice, unpayInvoice } = useCards();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);
  const [invoice, setInvoice] = useState<CardInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPayConfirmOpen, setIsPayConfirmOpen] = useState(false);
  const [isUnpayConfirmOpen, setIsUnpayConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isLoadingRef = useRef(false);
  const inFlightInvoiceKeyRef = useRef<string | null>(null);
  const historyInFlightRef = useRef<string | null>(null);

  const fetchInvoiceRef = useRef(fetchInvoice);
  fetchInvoiceRef.current = fetchInvoice;
  const fetchInvoicesHistoryRef = useRef(fetchInvoicesHistory);
  fetchInvoicesHistoryRef.current = fetchInvoicesHistory;

  // Limpa o estado quando o modal fecha
  useEffect(() => {
    if (!isOpen) {
      setSelectedMonth('');
      setInvoice(null);
      setAvailableMonths([]);
      setLoading(false);
      isLoadingRef.current = false;
      inFlightInvoiceKeyRef.current = null;
      historyInFlightRef.current = null;
    }
  }, [isOpen]);

  // Formata YYYY-MM para label amigável em pt-BR (ex: "Março de 2026")
  const formatMonthLabel = (ym: string) => {
    try {
      const [year, month] = ym.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
    } catch {
      return ym;
    }
  };

  // Formata data ISO YYYY-MM-DD para DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Carrega histórico dos últimos 12 meses para o seletor quando o modal abre
  useEffect(() => {
    if (!isOpen || !card?.id) return;

    let active = true;
    const cardId = card.id;

    if (historyInFlightRef.current === cardId) {
      return;
    }

    const loadHistory = async () => {
      historyInFlightRef.current = cardId;
      try {
        const history = await fetchInvoicesHistoryRef.current(cardId);
        if (!active) return;

        if (history.length > 0) {
          const options = history.map((inv) => ({
            value: inv.reference_month,
            label: formatMonthLabel(inv.reference_month),
          }));
          setAvailableMonths(options);
          const startingMonth = initialMonth || history[0].reference_month;
          setSelectedMonth(startingMonth);
        } else {
          // Fallback para o mês atual
          const now = new Date();
          const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          setAvailableMonths([{ value: fallback, label: formatMonthLabel(fallback) }]);
          setSelectedMonth(initialMonth || fallback);
        }
      } catch (err) {
        console.error('Erro ao buscar histórico de faturas:', err);
        if (active) {
          const now = new Date();
          const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          setAvailableMonths([{ value: fallback, label: formatMonthLabel(fallback) }]);
          setSelectedMonth(initialMonth || fallback);
        }
      } finally {
        historyInFlightRef.current = null;
      }
    };

    loadHistory();
    return () => {
      active = false;
      historyInFlightRef.current = null;
    };
  }, [isOpen, card?.id, initialMonth]);

  const reloadInvoice = useCallback(async () => {
    if (!card?.id || !selectedMonth) return;
    const cardId = card.id;
    const month = selectedMonth;
    const reqKey = `${cardId}:${month}`;

    if (inFlightInvoiceKeyRef.current === reqKey) return;
    inFlightInvoiceKeyRef.current = reqKey;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const data = await fetchInvoiceRef.current(cardId, month);
      setInvoice(data);
    } catch (err) {
      console.error('Erro ao recarregar fatura:', err);
    } finally {
      inFlightInvoiceKeyRef.current = null;
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [card?.id, selectedMonth]);

  // Carrega a fatura sempre que o selectedMonth mudar
  useEffect(() => {
    if (!isOpen || !card?.id || !selectedMonth) return;

    let active = true;
    const cardId = card.id;
    const month = selectedMonth;
    const reqKey = `${cardId}:${month}`;

    if (inFlightInvoiceKeyRef.current === reqKey) return;

    const loadInvoice = async () => {
      inFlightInvoiceKeyRef.current = reqKey;
      isLoadingRef.current = true;
      setLoading(true);
      try {
        const data = await fetchInvoiceRef.current(cardId, month);
        if (active) {
          setInvoice(data);
        }
      } catch (err) {
        console.error('Erro ao buscar fatura:', err);
      } finally {
        if (inFlightInvoiceKeyRef.current === reqKey) {
          inFlightInvoiceKeyRef.current = null;
          isLoadingRef.current = false;
        }
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInvoice();
    return () => {
      active = false;
      if (inFlightInvoiceKeyRef.current === reqKey) {
        inFlightInvoiceKeyRef.current = null;
        isLoadingRef.current = false;
      }
    };
  }, [isOpen, card?.id, selectedMonth]);

  const handleConfirmPay = async () => {
    if (!card || !selectedMonth || !invoice) return;
    setIsActionLoading(true);
    try {
      await payInvoice(card.id, selectedMonth);
      toast({
        title: "Fatura paga",
        description: `Fatura de ${formatMonthLabel(selectedMonth)} paga com sucesso!`,
      });
      setIsPayConfirmOpen(false);
      await reloadInvoice();
    } catch {
      // Toast já tratado no hook
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmUnpay = async () => {
    if (!card || !selectedMonth) return;
    setIsActionLoading(true);
    try {
      await unpayInvoice(card.id, selectedMonth);
      toast({
        title: "Fatura reaberta",
        description: `Fatura de ${formatMonthLabel(selectedMonth)} reaberta com sucesso.`,
      });
      setIsUnpayConfirmOpen(false);
      await reloadInvoice();
    } catch {
      // Toast já tratado no hook
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!card) return null;

  const usagePercent = card.limit_amount > 0 && invoice
    ? Math.min(100, Math.round(((invoice.total / card.limit_amount) * 100) * 10) / 10)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: card.color || '#6366f1' }}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {card.name}
                  <Badge variant="outline" className="capitalize text-xs font-normal">
                    {card.brand}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fechamento todo dia {card.closing_day} • Vencimento todo dia {card.due_day}
                </p>
              </div>
            </div>

            {/* Seletor de Fatura */}
            <div className="w-full sm:w-56">
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                <SelectTrigger className="h-9">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Carregando fatura...
          </div>
        ) : !invoice ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Não foi possível carregar as informações desta fatura.
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Bloco de Resumo da Fatura */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total da Fatura */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Total da Fatura</span>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(invoice.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {invoice.transactions_count} {invoice.transactions_count === 1 ? 'lançamento' : 'lançamentos'}
                </div>
              </div>

              {/* Vencimento e Período */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Vencimento</span>
                <div className="text-lg font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  {formatDateBR(invoice.due_date)}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>{formatDateBR(invoice.cycle_start)}</span>
                  <ArrowRight className="w-3 h-3 inline" />
                  <span>{formatDateBR(invoice.cycle_end)}</span>
                </div>
              </div>

              {/* Status de Pagamento */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Status dos Pagamentos</span>
                <div className="space-y-1 text-xs pt-1">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                    </span>
                    <span className="font-semibold">{formatCurrency(invoice.paid_total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" /> Pendente
                    </span>
                    <span className="font-semibold">{formatCurrency(invoice.pending_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de Limite */}
            <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-muted-foreground">
                  Uso nesta fatura ({usagePercent}%)
                </span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(invoice.total)} de {formatCurrency(card.limit_amount)}
                </span>
              </div>
              <Progress
                value={usagePercent}
                className={`h-2 ${usagePercent >= 80 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Disponível no limite: {formatCurrency(Math.max(0, card.limit_amount - invoice.total))}</span>
                <span>Limite total: {formatCurrency(card.limit_amount)}</span>
              </div>
            </div>

            {/* Lista de Transações da Fatura */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Lançamentos da Fatura
                </h3>
                <span className="text-xs text-muted-foreground">
                  Ordenado por data mais recente
                </span>
              </div>

              {invoice.transactions.length === 0 ? (
                <div className="text-center py-8 border rounded-xl text-muted-foreground text-sm bg-card/40">
                  Nenhuma transação vinculada a este cartão neste ciclo.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-24">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateBR(tx.date)}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {tx.description}
                            {tx.installment_total && tx.installment_total > 1 && !tx.description.includes(`(${tx.installment_number}/${tx.installment_total})`) && (
                              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                                ({tx.installment_number || 1}/{tx.installment_total})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {tx.category}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={tx.status === 'paid' ? 'default' : 'secondary'}
                              className={`text-[10px] uppercase font-semibold ${
                                tx.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {tx.status === 'paid' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm text-foreground">
                            {formatCurrency(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div>
                {invoice.pending_total === 0 && invoice.transactions.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setIsUnpayConfirmOpen(true)}
                    disabled={isActionLoading}
                  >
                    Reabrir fatura
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" onClick={onClose} disabled={isActionLoading}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  disabled={invoice.pending_total <= 0 || isActionLoading}
                  onClick={() => setIsPayConfirmOpen(true)}
                >
                  Pagar fatura
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Confirmação de Pagamento da Fatura */}
      <AlertDialog open={isPayConfirmOpen} onOpenChange={setIsPayConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento da fatura</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o pagamento de <strong className="text-foreground">{invoice ? formatCurrency(invoice.pending_total) : ""}</strong> referente à fatura de <strong className="text-foreground">{formatMonthLabel(selectedMonth)}</strong> do cartão {card.name}?
              Todos os lançamentos pendentes serão marcados como pagos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmPay}
            >
              {isActionLoading ? "Processando..." : "Confirmar Pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Reabertura da Fatura */}
      <AlertDialog open={isUnpayConfirmOpen} onOpenChange={setIsUnpayConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir fatura</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reabrir a fatura de <strong className="text-foreground">{formatMonthLabel(selectedMonth)}</strong> do cartão {card.name}?
              Todos os lançamentos desta fatura voltarão para o status pendente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionLoading}
              onClick={handleConfirmUnpay}
            >
              {isActionLoading ? "Processando..." : "Reabrir Fatura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
