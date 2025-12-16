import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Trash2,
  Check,
  Clock,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag as TagIcon
} from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DiscountModal from "./DiscountModal";
import AbatementModal from "./AbatementModal";

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
  tags?: Array<{ id: string; name: string; color: string }>;
}

type SortOption = 
  | "date-desc"      // Data mais recente
  | "date-asc"       // Data mais antiga
  | "income-first"   // Entradas primeiro
  | "expense-first"  // Saídas primeiro
  | "paid-first"     // Pagos primeiro
  | "pending-first"  // Pendentes primeiro
  | "amount-desc"    // Maior valor
  | "amount-asc"     // Menor valor
  | "name-asc"       // A-Z
  | "name-desc";     // Z-A

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onEdit: (transaction: Transaction) => void;
  onDeleteAllRecurring: (transaction: Transaction) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onTagFilter?: (tagId: string | null) => void; // Callback para filtrar por tag
  selectedTagId?: string | null; // Tag selecionada para filtro
}

const TransactionList = ({ transactions, onDelete, onUpdate, onEdit, onDeleteAllRecurring, onDeleteMultiple, onTagFilter, selectedTagId }: TransactionListProps) => {
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const { tags } = useTags();
  
  const [discountModal, setDiscountModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
  }>({ isOpen: false, transaction: null });

  const [abatementModal, setAbatementModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
  }>({ isOpen: false, transaction: null });

  // Lógica de ordenação
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions];
    
    switch (sortOption) {
      case "date-desc":
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      case "date-asc":
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      case "income-first":
        return sorted.sort((a, b) => {
          if (a.type === "income" && b.type === "expense") return -1;
          if (a.type === "expense" && b.type === "income") return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      
      case "expense-first":
        return sorted.sort((a, b) => {
          if (a.type === "expense" && b.type === "income") return -1;
          if (a.type === "income" && b.type === "expense") return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      
      case "paid-first":
        return sorted.sort((a, b) => {
          if (a.status === "paid" && b.status === "pending") return -1;
          if (a.status === "pending" && b.status === "paid") return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      
      case "pending-first":
        return sorted.sort((a, b) => {
          if (a.status === "pending" && b.status === "paid") return -1;
          if (a.status === "paid" && b.status === "pending") return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      
      case "amount-desc":
        return sorted.sort((a, b) => b.amount - a.amount);
      
      case "amount-asc":
        return sorted.sort((a, b) => a.amount - b.amount);
      
      case "name-asc":
        return sorted.sort((a, b) => {
          const nameA = a.description.toLowerCase().trim();
          const nameB = b.description.toLowerCase().trim();
          return nameA.localeCompare(nameB, "pt-BR");
        });
      
      case "name-desc":
        return sorted.sort((a, b) => {
          const nameA = a.description.toLowerCase().trim();
          const nameB = b.description.toLowerCase().trim();
          return nameB.localeCompare(nameA, "pt-BR");
        });
      
      default:
        return sorted;
    }
  }, [transactions, sortOption]);

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

  /**
   * Confirma o abatimento de um empréstimo/despesa recorrente
   * Exclui parcelas futuras e aplica desconto na parcela atual
   */
  const handleAbatementConfirm = async (totalAmount: number, paidAmount: number, abatementDate: string, futureTransactionIds: string[]) => {
    if (abatementModal.transaction) {
      const discountAmount = totalAmount - paidAmount;
      const currentTransaction = abatementModal.transaction;
      
      try {
        // 1. Primeiro, exclui todas as parcelas futuras (exceto a atual)
        const futureIdsToDelete = futureTransactionIds.filter(id => id !== currentTransaction.id);
        
        if (futureIdsToDelete.length > 0) {
          onDeleteMultiple(futureIdsToDelete);
        }
        
        // 2. Atualiza a parcela atual com o desconto e nova data
        onUpdate(currentTransaction.id, {
          status: "paid",
          original_amount: totalAmount,
          discount_amount: discountAmount,
          amount: paidAmount,
          date: abatementDate,
          // Remove campos de recorrência para que não gere mais parcelas
          is_recurring: false,
          recurrence_type: undefined,
          recurrence_count: undefined,
          // recurrence_group_id: undefined // campo não existe no tipo Transaction
        });
        
        // 3. Fecha o modal
        setAbatementModal({ isOpen: false, transaction: null });
        
      } catch (error) {
        console.error('Erro ao processar abatimento:', error);
      }
    }
  };

  /**
   * Abre o modal de abatimento para despesas recorrentes
   */
  const handleAbatement = (transaction: Transaction) => {
    setAbatementModal({ isOpen: true, transaction });
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
      {/* Seletores de Ordenação e Filtro por Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Ordenar por:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
            <SelectTrigger className="w-[200px] flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="date-desc">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3 h-3" />
                Data mais recente
              </div>
            </SelectItem>
            <SelectItem value="date-asc">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-3 h-3" />
                Data mais antiga
              </div>
            </SelectItem>
            <SelectItem value="income-first">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-green-600" />
                Entradas primeiro
              </div>
            </SelectItem>
            <SelectItem value="expense-first">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3 h-3 text-red-600" />
                Saídas primeiro
              </div>
            </SelectItem>
            <SelectItem value="paid-first">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-600" />
                Pagos primeiro
              </div>
            </SelectItem>
            <SelectItem value="pending-first">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-orange-600" />
                Pendentes primeiro
              </div>
            </SelectItem>
            <SelectItem value="amount-desc">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3 h-3" />
                Maior valor
              </div>
            </SelectItem>
            <SelectItem value="amount-asc">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-3 h-3" />
                Menor valor
              </div>
            </SelectItem>
            <SelectItem value="name-asc">
              <div className="flex items-center gap-2">
                <ArrowUp className="w-3 h-3" />
                A-Z
              </div>
            </SelectItem>
            <SelectItem value="name-desc">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3 h-3" />
                Z-A
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        {/* Filtro rápido por Tag - Sempre visível quando há tags e callback */}
        {tags.length > 0 && onTagFilter ? (
          <Select 
            value={selectedTagId || "all"} 
            onValueChange={(value) => onTagFilter(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[180px] sm:w-[200px] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <TagIcon className="w-4 h-4 flex-shrink-0" />
                <SelectValue placeholder="Filtrar por tag" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <TagIcon className="w-3 h-3" />
                  Todas as tags
                </div>
              </SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        </div>
      </div>

      {sortedTransactions.map((transaction) => (
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
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                    {transaction.tags && transaction.tags.length > 0 && (
                      <>
                        {transaction.tags.map(tag => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs font-medium"
                            style={{ 
                              backgroundColor: tag.color + '15', 
                              borderColor: tag.color + '40', 
                              color: tag.color 
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </>
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
                  {transaction.type === "expense" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbatement(transaction)}
                      className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 font-medium flex-1"
                      title="Abater empréstimo"
                    >
                      Abater
                    </Button>
                  )}
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
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                    {transaction.tags && transaction.tags.length > 0 && (
                      <>
                        {transaction.tags.map(tag => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs font-medium"
                            style={{ 
                              backgroundColor: tag.color + '15', 
                              borderColor: tag.color + '40', 
                              color: tag.color 
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </>
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
                    {transaction.type === "expense" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbatement(transaction)}
                        className="h-9 text-xs px-3 text-primary hover:text-primary hover:bg-primary/10 font-medium"
                        title="Abater empréstimo"
                      >
                        Abater
                      </Button>
                    )}
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
        isRecurring={discountModal.transaction?.is_recurring || false}
        transactionType={discountModal.transaction?.type || "expense"}
      />
      
      <AbatementModal
        isOpen={abatementModal.isOpen}
        onClose={() => setAbatementModal({ isOpen: false, transaction: null })}
        onConfirm={handleAbatementConfirm}
        transaction={abatementModal.transaction}
      />
    </div>
  );
};

export default TransactionList;