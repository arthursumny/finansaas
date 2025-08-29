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
    // Formatar manualmente uma string yyyy-MM-dd para dd/MM/yyyy sem criar Date (evita timezone)
    if (!dateString) return "";
    const [y, m, d] = dateString.split("-");
    if (!y || !m || !d) return dateString;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
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
      <div className="text-center py-12 text-secondary">
        <Calendar className="w-16 h-16 mx-auto mb-6 opacity-40" />
        <p className="text-lg font-medium">Nenhuma transação registrada neste mês</p>
        <p className="text-sm mt-2 opacity-75">Adicione sua primeira transação para começar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className="transition-all hover:shadow-lg border-0 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            {/* Layout Mobile: Stack Vertical */}
            <div className="block sm:hidden">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  transaction.type === "income" 
                    ? "bg-primary/10 text-primary" 
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {transaction.type === "income" ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{transaction.description}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className="text-xs font-medium bg-card text-secondary border-0"
                    >
                      {transaction.category}
                    </Badge>
                    {transaction.is_recurring && (
                      <Badge variant="outline" className="text-xs font-medium border-primary/20 text-primary">
                        Rec.
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    transaction.type === "income" ? "text-primary" : "text-destructive"
                  }`}>
                    {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </div>
                  {transaction.discount_amount && transaction.discount_amount > 0 && (
                    <div className="text-xs text-secondary mt-1">
                      <span className="line-through">{formatCurrency(transaction.original_amount || 0)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-secondary">
                    <Calendar className="w-3 h-3" />
                    {formatDate(transaction.date)}
                  </span>
                  <Badge 
                    variant={transaction.status === "paid" ? "default" : "secondary"}
                    className={`text-xs font-medium ${
                      transaction.status === "paid" 
                        ? "bg-primary text-white"
                        : "bg-secondary/50 text-secondary border-0"
                    }`}
                  >
                    {transaction.status === "paid" 
                      ? (transaction.type === "income" ? "Recebido" : "Pago")
                      : (transaction.type === "income" ? "A Receber" : "A Pagar")
                    }
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMarkAsPaid(transaction)}
                    className="h-8 w-8 hover:bg-card"
                    title={transaction.status === "paid" ? "Marcar como pendente" : "Marcar como pago"}
                  >
                    {transaction.status === "paid" ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Clock className="w-3 h-3 text-secondary" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(transaction)}
                    className="h-8 w-8 hover:bg-card"
                    title="Editar transação"
                  >
                    <Edit className="w-3 h-3 text-secondary hover:text-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(transaction.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Excluir transação"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {transaction.is_recurring && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFullDiscount(transaction)}
                    className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 font-medium flex-1"
                    title="Abater valor inteiro"
                  >
                    Abater
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteAllRecurring(transaction)}
                    className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium flex-1"
                    title="Excluir todas as recorrências"
                  >
                    Excluir Todas
                  </Button>
                </div>
              )}
            </div>

            {/* Layout Desktop: Horizontal */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  transaction.type === "income" 
                    ? "bg-primary/10 text-primary" 
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {transaction.type === "income" ? (
                    <TrendingUp className="w-6 h-6" />
                  ) : (
                    <TrendingDown className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-foreground text-base">{transaction.description}</h4>
                    <Badge 
                      variant="secondary" 
                      className="text-xs font-medium bg-card text-secondary border-0"
                    >
                      {transaction.category}
                    </Badge>
                    {transaction.is_recurring && (
                      <Badge variant="outline" className="text-xs font-medium border-primary/20 text-primary">
                        Recorrente
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-2 text-secondary">
                      <Calendar className="w-4 h-4" />
                      {formatDate(transaction.date)}
                    </span>
                    <Badge 
                      variant={transaction.status === "paid" ? "default" : "secondary"}
                      className={`text-xs font-medium ${
                        transaction.status === "paid" 
                          ? "bg-primary text-white"
                          : "bg-secondary/50 text-secondary border-0"
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
                  <div className={`text-xl font-bold ${
                    transaction.type === "income" ? "text-primary" : "text-destructive"
                  }`}>
                    {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </div>
                  {transaction.discount_amount && transaction.discount_amount > 0 && (
                    <div className="text-xs text-secondary mt-1">
                      <span className="line-through">{formatCurrency(transaction.original_amount || 0)}</span>
                      <span className="ml-2 text-primary font-medium">-{formatCurrency(transaction.discount_amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMarkAsPaid(transaction)}
                  className="h-9 w-9 hover:bg-card"
                  title={transaction.status === "paid" ? "Marcar como pendente" : "Marcar como pago"}
                >
                  {transaction.status === "paid" ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Clock className="w-4 h-4 text-secondary" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(transaction)}
                  className="h-9 w-9 hover:bg-card"
                  title="Editar transação"
                >
                  <Edit className="w-4 h-4 text-secondary hover:text-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(transaction.id)}
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                      className="h-9 text-xs px-3 text-primary hover:text-primary hover:bg-primary/10 font-medium"
                      title="Abater valor inteiro"
                    >
                      Abater
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteAllRecurring(transaction)}
                      className="h-9 text-xs px-3 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
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