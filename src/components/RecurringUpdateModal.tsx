import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface RecurringUpdateModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fieldName: string;
}

/**
 * Modal para confirmar atualização de transações recorrentes
 */
const RecurringUpdateModal = ({ isOpen, onConfirm, onCancel, fieldName }: RecurringUpdateModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Atualizar Transações Recorrentes
          </DialogTitle>
          <DialogDescription className="text-left">
            Esta é uma transação recorrente. Deseja atualizar {fieldName} de todas as transações deste grupo recorrente?
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Atenção:</strong> Esta ação irá alterar todas as transações futuras e passadas deste grupo recorrente.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Apenas Esta Transação
          </Button>
          <Button
            onClick={onConfirm}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            Todas as Transações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringUpdateModal;