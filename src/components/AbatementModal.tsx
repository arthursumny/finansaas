import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  category: string;
  status: "paid" | "pending";
  is_recurring?: boolean;
  recurrence_type?: "monthly" | "yearly";
  recurrence_count?: number;
  recurrence_group_id?: string;
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  original_amount?: number;
  discount_amount?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface AbatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totalAmount: number, paidAmount: number, abatementDate: string, futureTransactionIds: string[]) => void;
  transaction: Transaction | null;
}

/**
 * Modal para abatimento de empréstimos/despesas recorrentes
 * Busca todas as parcelas futuras do mesmo grupo e calcula o valor total
 */
const AbatementModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  transaction 
}: AbatementModalProps) => {
  const { user } = useAuth();
  const [paidAmount, setPaidAmount] = useState(0);
  const [abatementDate, setAbatementDate] = useState<Date>(new Date());
  const [futureTransactions, setFutureTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Busca todas as transações futuras (incluindo a atual) do mesmo grupo recorrente
   */
  const fetchFutureTransactions = async () => {
    if (!transaction?.recurrence_group_id || !user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .match({ 
          user_id: user.id,
          recurrence_group_id: transaction.recurrence_group_id 
        })
        .gte('date', today) // Apenas transações de hoje em diante
        .order('date', { ascending: true });

      if (error) throw error;
      
      setFutureTransactions(data as Transaction[] || []);
    } catch (error) {
      console.error('Erro ao buscar transações futuras:', error);
      setFutureTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Busca as transações futuras quando o modal abre
  useEffect(() => {
    if (isOpen && transaction?.recurrence_group_id) {
      fetchFutureTransactions();
    }
  }, [isOpen, transaction?.recurrence_group_id]);

  // Calcula o valor total das parcelas restantes
  const totalAmount = futureTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calcula o desconto
  const discount = totalAmount - paidAmount;

  /**
   * Confirma o abatimento
   */
  const handleConfirm = () => {
    const dateString = format(abatementDate, 'yyyy-MM-dd');
    const futureTransactionIds = futureTransactions.map(t => t.id);
    onConfirm(totalAmount, paidAmount, dateString, futureTransactionIds);
    onClose();
  };

  /**
   * Reseta os valores quando o modal fecha
   */
  const handleClose = () => {
    setPaidAmount(0);
    setAbatementDate(new Date());
    setFutureTransactions([]);
    onClose();
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abater Empréstimo</DialogTitle>
          <DialogDescription>
            {transaction.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Valor total do empréstimo */}
          <div className="space-y-2">
            <Label>Valor total do empréstimo</Label>
            <div className="p-3 bg-muted rounded-md">
              {loading ? (
                <span className="text-sm text-muted-foreground">Carregando...</span>
              ) : (
                <>
                  <span className="text-lg font-semibold">
                    R$ {totalAmount.toFixed(2)}
                  </span>
                  <div className="text-sm text-muted-foreground mt-1">
                    {futureTransactions.length} parcelas restantes
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Valor que será pago */}
          <div className="space-y-2">
            <Label htmlFor="paid">Valor que será pago (R$)</Label>
            <Input
              id="paid"
              type="number"
              step="0.01"
              min="0"
              max={totalAmount}
              value={paidAmount}
              onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
            />
          </div>

          {/* Data do abatimento */}
          <div className="space-y-2">
            <Label>Data do abatimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !abatementDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {abatementDate ? (
                    format(abatementDate, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={abatementDate}
                  onSelect={(date) => date && setAbatementDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Mostra o desconto calculado */}
          {paidAmount > 0 && paidAmount < totalAmount && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                Desconto: R$ {discount.toFixed(2)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                Economia de {((discount / totalAmount) * 100).toFixed(1)}%
              </div>
            </div>
          )}

          {/* Aviso se o valor pago for maior que o total */}
          {paidAmount > totalAmount && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm font-medium text-red-800 dark:text-red-200">
                O valor pago não pode ser maior que o valor total do empréstimo
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="flex-1"
            disabled={paidAmount <= 0 || paidAmount > totalAmount}
          >
            Confirmar Abatimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AbatementModal;