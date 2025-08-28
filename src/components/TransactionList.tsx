import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Trash2,
  Check,
  Clock,
  Edit
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DiscountModal from "./DiscountModal";

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
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  original_amount?: number;
  discount_amount?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onEdit: (transaction: Transaction) => void;
  onDeleteAllRecurring: (transaction: Transaction) => void;
}

const TransactionList = ({ transactions, onDelete, onUpdate, onEdit, onDeleteAllRecurring }: TransactionListProps) => {
  const [discountModal, setDiscountModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
  }>({ isOpen: false, transaction: null });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const handleMarkAsPaid = (transaction: Transaction) => {
    // Se for transação recorrente marcando como paga, perguntar sobre desconto
    if (transaction.is_recurring && transaction.status === "pending") {
      setDiscountModal({ isOpen: true, transaction });
    } else {
      const newStatus = transaction.status === "paid" ? "pending" : "paid";
      onUpdate(transaction.id, { status: newStatus });
    }
  };

  const handleDiscountConfirm = (originalAmount: number, paidAmount: number) => {
    if (discountModal.transaction) {
      const discountAmount = originalAmount - paidAmount;
      onUpdate(discountModal.transaction.id, {
        status: "paid",
        original_amount: originalAmount,
        discount_amount: discountAmount,
        amount: paidAmount
      });
    }
    setDiscountModal({ isOpen: false, transaction: null });
  };

  const handleFullDiscount = (transaction: Transaction) => {
    onUpdate(transaction.id, {
      status: "paid",
      original_amount: transaction.amount,
      discount_amount: transaction.amount,
      amount: 0
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação registrada neste mês</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className="transition-all hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  transaction.type === "income" 
                    ? "bg-income-light text-income" 
                    : "bg-expense-light text-expense"
                }`}>
                  {transaction.type === "income" ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{transaction.description}</h4>
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                    >
                      {transaction.category}
                    </Badge>
                    {transaction.is_recurring && (
                      <Badge variant="outline" className="text-xs">
                        Recorrente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(transaction.date)}
                    </span>
                    <Badge 
                      variant={transaction.status === "paid" ? "default" : "secondary"}
                      className={`text-xs ${
                        transaction.status === "paid" 
                          ? (transaction.type === "income" ? "bg-income text-income-foreground" : "bg-success text-success-foreground")
                          : "bg-warning text-warning-foreground"
                      }`}
                    >
                      {transaction.status === "paid" 
                        ? (transaction.type === "income" ? "Recebido" : "Pago")
                        : (transaction.type === "income" ? "A Receber" : "A Pagar")
                      }
                    </Badge>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    transaction.type === "income" ? "text-income" : "text-expense"
                  }`}>
                    {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </div>
                  {transaction.discount_amount && transaction.discount_amount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="line-through">{formatCurrency(transaction.original_amount || 0)}</span>
                      <span className="ml-1 text-success">-{formatCurrency(transaction.discount_amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMarkAsPaid(transaction)}
                  className="h-8 w-8"
                  title={transaction.status === "paid" ? "Marcar como pendente" : "Marcar como pago"}
                >
                  {transaction.status === "paid" ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Clock className="w-4 h-4 text-warning" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(transaction)}
                  className="h-8 w-8"
                  title="Editar transação"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(transaction.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Excluir transação"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                {transaction.is_recurring && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFullDiscount(transaction)}
                      className="h-8 text-xs px-2 text-success hover:text-success"
                      title="Abater valor inteiro"
                    >
                      Abater
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteAllRecurring(transaction)}
                      className="h-8 text-xs px-2 text-destructive hover:text-destructive"
                      title="Excluir todas as recorrências"
                    >
                      Excluir Todas
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <DiscountModal
        isOpen={discountModal.isOpen}
        onClose={() => setDiscountModal({ isOpen: false, transaction: null })}
        onConfirm={handleDiscountConfirm}
        currentAmount={discountModal.transaction?.amount || 0}
        transactionDescription={discountModal.transaction?.description || ""}
      />
    </div>
  );
};

export default TransactionList;