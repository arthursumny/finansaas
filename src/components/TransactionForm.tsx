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

interface Transaction {
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

interface TransactionFormProps {
  onSubmit: (transaction: Transaction) => void;
  onClose: () => void;
}

const categories = {
  income: ["Salário", "Freelance", "Investimentos", "Outros"],
  expense: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Contas", "Outros"]
};

const TransactionForm = ({ onSubmit, onClose }: TransactionFormProps) => {
  const [formData, setFormData] = useState<Transaction>({
    type: "expense",
    description: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    status: "paid",
    isRecurring: false,
    recurrenceType: "monthly",
    recurrenceCount: 1
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
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.amount || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>

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
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isRecurring: checked }))
                  }
                />
              </div>

              {formData.isRecurring && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.recurrenceType}
                      onValueChange={(value: "monthly" | "yearly") => 
                        setFormData(prev => ({ ...prev, recurrenceType: value }))
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
                    <Label>Repetições</Label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={formData.recurrenceCount || 1}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        recurrenceCount: parseInt(e.target.value) || 1 
                      }))}
                    />
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