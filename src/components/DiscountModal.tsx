import { useState } from "react";
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
  isRecurring = false
}: DiscountModalProps) => {
  const [originalAmount, setOriginalAmount] = useState(currentAmount);
  const [paidAmount, setPaidAmount] = useState(currentAmount);

  /**
   * Confirma o desconto aplicado
   */
  const handleConfirm = () => {
    // Para transações recorrentes, o valor original é sempre o valor atual
    const finalOriginalAmount = isRecurring ? currentAmount : originalAmount;
    onConfirm(finalOriginalAmount, paidAmount);
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
            {isRecurring ? "Qual foi o valor pago?" : "Teve desconto nesta transação?"}
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
                value={originalAmount}
                onChange={(e) => setOriginalAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="paid">Valor pago com desconto (R$)</Label>
            <Input
              id="paid"
              type="number"
              step="0.01"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          
          {/* Mostra o desconto calculado */}
          {((isRecurring && currentAmount > paidAmount) || (!isRecurring && originalAmount > paidAmount)) && (
            <div className="text-sm text-muted-foreground">
              Desconto: R$ {(isRecurring ? currentAmount - paidAmount : originalAmount - paidAmount).toFixed(2)}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-6">
          {/* Botão "Não houve desconto" apenas para transações não recorrentes */}
          {!isRecurring && (
            <Button variant="outline" onClick={handleNoDiscount} className="flex-1">
              Não houve desconto
            </Button>
          )}
          <Button onClick={handleConfirm} className={isRecurring ? "w-full" : "flex-1"}>
            {isRecurring ? "Confirmar pagamento" : "Confirmar desconto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountModal;