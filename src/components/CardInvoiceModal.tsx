import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const { fetchInvoice, fetchInvoicesHistory } = useCards();
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);
  const [invoice, setInvoice] = useState<CardInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!isOpen || !card) return;

    let active = true;
    const loadHistory = async () => {
      const history = await fetchInvoicesHistory(card.id);
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
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [isOpen, card?.id, initialMonth]);

  // Carrega a fatura sempre que o selectedMonth mudar
  useEffect(() => {
    if (!isOpen || !card || !selectedMonth) return;

    let active = true;
    const loadInvoice = async () => {
      setLoading(true);
      const data = await fetchInvoice(card.id, selectedMonth);
      if (active) {
        setInvoice(data);
        setLoading(false);
      }
    };

    loadInvoice();
    return () => {
      active = false;
    };
  }, [isOpen, card?.id, selectedMonth]);

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

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
