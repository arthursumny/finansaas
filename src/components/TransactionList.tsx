import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Trash2,
  Check,
  Clock 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  category: string;
  status: "paid" | "pending";
  isRecurring?: boolean;
  recurrenceType?: "monthly" | "yearly";
  recurrenceCount?: number;
}

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
}

const TransactionList = ({ transactions, onDelete, onUpdate }: TransactionListProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const toggleStatus = (transaction: Transaction) => {
    const newStatus = transaction.status === "paid" ? "pending" : "paid";
    onUpdate(transaction.id, { status: newStatus });
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
                    {transaction.isRecurring && (
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
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStatus(transaction)}
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
                  onClick={() => onDelete(transaction.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Excluir transação"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TransactionList;