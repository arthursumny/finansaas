import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (originalAmount: number, paidAmount: number) => void;
  currentAmount: number;
  transactionDescription: string;
  isRecurring?: boolean;
  transactionType: 'income' | 'expense';
}

/**
 * Modal para aplicar desconto em transações
 * Para transações recorrentes, mostra apenas o campo de valor pago
 * Para transações normais, mostra ambos os campos (valor original e valor pago)
 */
const DiscountModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentAmount, 
  transactionDescription,
  isRecurring = false,
  transactionType
}: DiscountModalProps) => {
  // Mantemos como string para permitir apagar o zero sem forçar 0
  const [originalAmountInput, setOriginalAmountInput] = useState(currentAmount.toString());
  const [paidAmountInput, setPaidAmountInput] = useState(currentAmount.toString());
  const isIncome = transactionType === 'income';
  const actionVerb = isIncome ? 'recebido' : 'pago';

  // Sempre que abrir o modal ou o valor mudar, reseta os campos para o valor original
  useEffect(() => {
    setOriginalAmountInput(currentAmount.toString());
    setPaidAmountInput(currentAmount.toString());
  }, [isOpen, currentAmount]);

  /**
   * Confirma o desconto aplicado
   */
  const handleConfirm = () => {
    const parsedOriginal = isRecurring ? currentAmount : parseFloat(originalAmountInput || '0');
    const parsedPaid = parseFloat(paidAmountInput || '0');

    // Para transações recorrentes, o valor original é sempre o valor atual
    const finalOriginalAmount = isRecurring ? currentAmount : parsedOriginal;
    onConfirm(finalOriginalAmount, parsedPaid);
    onClose();
  };

  /**
   * Confirma que não houve desconto (apenas para transações não recorrentes)
   */
  const handleNoDiscount = () => {
    onConfirm(currentAmount, currentAmount);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isIncome ? "Qual foi o valor recebido?" : isRecurring ? "Qual foi o valor pago?" : "Teve desconto nesta transação?"}
          </DialogTitle>
          <DialogDescription>
            {transactionDescription} - Valor original: R$ {currentAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Para transações não recorrentes, mostra o campo de valor original */}
          {!isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="original">Valor original (R$)</Label>
              <Input
                id="original"
                type="number"
                step="0.01"
                min="0"
                value={originalAmountInput}
                onChange={(e) => setOriginalAmountInput(e.target.value)}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="paid">{isIncome ? "Valor recebido (R$)" : "Valor pago com desconto (R$)"}</Label>
            <Input
              id="paid"
              type="number"
              step="0.01"
              min="0"
              value={paidAmountInput}
              onChange={(e) => setPaidAmountInput(e.target.value)}
            />
          </div>
          
          {/* Mostra o desconto calculado */}
          {(() => {
            const baseAmount = isRecurring ? currentAmount : parseFloat(originalAmountInput || '0');
            const paidAmount = parseFloat(paidAmountInput || '0');
            const difference = baseAmount - paidAmount;
            if (!Number.isFinite(difference) || difference === 0) return null;
            return (
              <div className="text-sm text-muted-foreground">
                {isIncome ? "Diferença" : "Desconto"}: R$ {difference.toFixed(2)}
              </div>
            );
          })()}
        </div>
        
        <div className="flex gap-2 mt-6">
          {/* Botão "Não houve desconto" apenas para transações não recorrentes */}
          {!isRecurring && (
            <Button variant="outline" onClick={handleNoDiscount} className="flex-1">
              {isIncome ? "Valor integral" : "Não houve desconto"}
            </Button>
          )}
          <Button onClick={handleConfirm} className={isRecurring ? "w-full" : "flex-1"}>
            {isIncome ? "Confirmar recebimento" : (isRecurring ? "Confirmar pagamento" : "Confirmar desconto")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountModal;