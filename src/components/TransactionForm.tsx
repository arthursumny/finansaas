import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TransactionFormData {
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
}

interface TransactionFormProps {
  onSubmit: (transaction: TransactionFormData) => void;
  onClose: () => void;
}

const categories = {
  income: ["Salário", "Freelance", "Investimentos", "Outros"],
  expense: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Contas", "Outros"]
};

const TransactionForm = ({ onSubmit, onClose }: TransactionFormProps) => {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: "expense",
    description: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    status: "paid",
    is_recurring: false,
    recurrence_type: "monthly",
    recurrence_count: 1,
    recurrence_start_date: format(new Date(), "yyyy-MM-dd"),
    recurrence_end_date: format(new Date(), "yyyy-MM-dd"),
    original_amount: 0,
    discount_amount: 0
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.description && formData.amount > 0 && formData.category) {
      onSubmit(formData);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setFormData(prev => ({ ...prev, date: format(date, "yyyy-MM-dd") }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Nova Transação</CardTitle>
              <CardDescription>Adicione uma receita ou despesa</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "income" | "expense") => 
                  setFormData(prev => ({ ...prev, type: value, category: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Salário, Aluguel, Supermercado..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories[formData.type].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor Pago (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.amount || ""}
                onChange={(e) => {
                  const amount = parseFloat(e.target.value) || 0;
                  setFormData(prev => ({ 
                    ...prev, 
                    amount,
                    original_amount: prev.original_amount || amount
                  }))
                }}
                required
              />
            </div>

            {/* Valor Original e Desconto (apenas para despesas) */}
            {formData.type === "expense" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="original_amount">Valor Original (R$)</Label>
                  <Input
                    id="original_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formData.original_amount || ""}
                    onChange={(e) => {
                      const originalAmount = parseFloat(e.target.value) || 0;
                      const currentAmount = formData.amount || 0;
                      setFormData(prev => ({ 
                        ...prev, 
                        original_amount: originalAmount,
                        discount_amount: originalAmount > currentAmount ? originalAmount - currentAmount : 0
                      }))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_amount">Desconto (R$)</Label>
                  <Input
                    id="discount_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formData.discount_amount || ""}
                    onChange={(e) => {
                      const discount = parseFloat(e.target.value) || 0;
                      const originalAmount = formData.original_amount || 0;
                      setFormData(prev => ({ 
                        ...prev, 
                        discount_amount: discount,
                        amount: originalAmount > discount ? originalAmount - discount : originalAmount
                      }))
                    }}
                  />
                </div>
              </div>
            )}

            {/* Data */}
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "paid" | "pending") => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">
                    {formData.type === "income" ? "Recebido" : "Pago"}
                  </SelectItem>
                  <SelectItem value="pending">
                    {formData.type === "income" ? "A Receber" : "A Pagar"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recorrência */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring">Transação recorrente</Label>
                <Switch
                  id="recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_recurring: checked }))
                  }
                />
              </div>

              {formData.is_recurring && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={formData.recurrence_type}
                        onValueChange={(value: "monthly" | "yearly") => 
                          setFormData(prev => ({ ...prev, recurrence_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantos meses repetir</Label>
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={formData.recurrence_count || 1}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          recurrence_count: parseInt(e.target.value) || 1 
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Número de meses (ou anos) que a transação será repetida
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Data de Início</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_start_date || format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          recurrence_start_date: e.target.value 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Fim</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_end_date || format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          recurrence_end_date: e.target.value 
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant={formData.type === "income" ? "income" : "expense"}
                className="flex-1"
              >
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionForm;