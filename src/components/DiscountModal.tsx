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
}

const DiscountModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentAmount, 
  transactionDescription 
}: DiscountModalProps) => {
  const [originalAmount, setOriginalAmount] = useState(currentAmount);
  const [paidAmount, setPaidAmount] = useState(currentAmount);

  const handleConfirm = () => {
    onConfirm(originalAmount, paidAmount);
    onClose();
  };

  const handleNoDiscount = () => {
    onConfirm(currentAmount, currentAmount);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teve desconto nesta transação?</DialogTitle>
          <DialogDescription>
            {transactionDescription} - Valor atual: R$ {currentAmount.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
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
          
          {originalAmount > paidAmount && (
            <div className="text-sm text-muted-foreground">
              Desconto: R$ {(originalAmount - paidAmount).toFixed(2)}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleNoDiscount} className="flex-1">
            Não houve desconto
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Confirmar desconto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountModal;