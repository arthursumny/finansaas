import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";

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
  original_amount?: number;
  discount_amount?: number;
}

interface TransactionFormProps {
  onSubmit: (transaction: TransactionFormData) => void;
  onClose: () => void;
  initialData?: Transaction;
  isEditing?: boolean;
}

const TransactionForm = ({ onSubmit, onClose, initialData, isEditing = false }: TransactionFormProps) => {
  const { getCategoryNamesByType, loading: categoriesLoading } = useCategories();
  const [formData, setFormData] = useState<TransactionFormData>(() => {
    if (initialData) {
      return {
        type: initialData.type,
        description: initialData.description,
        amount: initialData.amount,
        date: initialData.date,
        category: initialData.category,
        status: initialData.status,
        is_recurring: initialData.is_recurring || false,
        recurrence_type: initialData.recurrence_type || "monthly",
        recurrence_count: initialData.recurrence_count || 1,
        original_amount: initialData.original_amount || initialData.amount,
        discount_amount: initialData.discount_amount || 0
      };
    }
    // Criar data atual com formatação manual para evitar problemas de timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    return {
      type: "expense",
      description: "",
      amount: 0,
      date: todayString,
      category: "",
      status: "paid",
      is_recurring: false,
      recurrence_type: "monthly",
      recurrence_count: 1,
      original_amount: 0,
      discount_amount: 0
    };
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialData) {
      // Criar data a partir da string no fuso horário local
      const dateParts = initialData.date.split('-');
      return new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    }
    // Criar data atual no fuso horário local
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  // Estado para controlar o valor como string
  const [amountString, setAmountString] = useState(
    initialData?.amount ? String(initialData.amount).replace('.', ',') : ''
  );

  /**
   * Formata valor para exibição com separadores brasileiros
   * Exemplo: 5000 -> "5.000", 5000.50 -> "5.000,50"
   */
  const formatAmountForDisplay = (value: string): string => {
    if (!value) return '';
    
    // Remove caracteres não numéricos exceto vírgula e ponto
    let cleanValue = value.replace(/[^0-9,.]/g, '');
    
    // Se não há vírgula, trata como número inteiro e adiciona separadores de milhares
    if (!cleanValue.includes(',')) {
      const numericValue = cleanValue.replace(/\./g, ''); // Remove pontos existentes
      if (numericValue && !isNaN(Number(numericValue))) {
        // Adiciona separadores de milhares
        return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
    }
    
    // Se há vírgula, trata a parte antes como inteiros e depois como decimais
    if (cleanValue.includes(',')) {
      const [integerPart, decimalPart] = cleanValue.split(',');
      const cleanInteger = integerPart.replace(/\./g, '');
      
      if (cleanInteger && !isNaN(Number(cleanInteger))) {
        const formattedInteger = cleanInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimalPart !== undefined ? `${formattedInteger},${decimalPart.slice(0, 2)}` : `${formattedInteger},`;
      }
    }
    
    return cleanValue;
  };

  /**
   * Converte string de valor para número, tratando separadores brasileiros
   * Exemplos: "5.000" -> 5000, "5.000,50" -> 5000.50, "5,50" -> 5.50
   */
  const parseAmountString = (amountStr: string): number => {
    if (!amountStr) return 0;
    
    // Remove espaços
    let cleanValue = amountStr.trim();
    
    // Se contém tanto ponto quanto vírgula, trata como separador de milhares + decimal
    if (cleanValue.includes('.') && cleanValue.includes(',')) {
      // Formato: 1.234.567,89 -> remove pontos e substitui vírgula por ponto
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    // Se contém apenas vírgula, trata como separador decimal
    else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
      // Formato: 1234,89 -> substitui vírgula por ponto
      cleanValue = cleanValue.replace(',', '.');
    }
    // Se contém apenas ponto, verifica se é separador de milhares ou decimal
    else if (cleanValue.includes('.') && !cleanValue.includes(',')) {
      const parts = cleanValue.split('.');
      // Se há mais de 2 partes ou a última parte tem mais de 2 dígitos, é separador de milhares
      if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
        // Formato: 1.234.567 -> remove todos os pontos
        cleanValue = cleanValue.replace(/\./g, '');
      }
      // Senão, trata como decimal (ex: 5.50)
      // Mantém como está
    }
    
    return parseFloat(cleanValue) || 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Converte o valor string para número usando a nova lógica
    const amount = parseAmountString(amountString);
    
    if (formData.description && amount > 0 && formData.category) {
      // Se estiver editando, remove os campos de recorrência para evitar duplicação
      const submitData = { ...formData, amount };
      if (isEditing) {
        delete submitData.is_recurring;
        delete submitData.recurrence_type;
        delete submitData.recurrence_count;
      }
      onSubmit(submitData);
    }
  };

  /**
   * Manipula a seleção de data do calendário
   * Garante que a data seja formatada corretamente sem problemas de timezone
   */
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Formatação manual para evitar qualquer problema de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      setFormData(prev => ({ ...prev, date: dateString }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl font-medium text-foreground">
              {isEditing ? "Editar Transação" : "Nova Transação"}
            </CardTitle>
            <CardDescription className="text-sm text-secondary">
              {isEditing ? "Modifique os dados da transação" : "Adicione uma nova receita ou despesa"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0 hover:bg-card"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Tipo</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={formData.type === "income" ? "income" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, type: "income", category: "" }))}
                  className="w-full h-11 font-medium"
                >
                  Receita
                </Button>
                <Button
                  type="button"
                  variant={formData.type === "expense" ? "expense" : "outline"}
                  onClick={() => setFormData(prev => ({ ...prev, type: "expense", category: "" }))}
                  className="w-full h-11 font-medium"
                >
                  Despesa
                </Button>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-3">
              <Label htmlFor="description" className="text-sm font-medium text-foreground">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Salário, Aluguel, Supermercado..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="h-11"
                required
              />
            </div>

            {/* Categoria */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <SelectItem value="loading" disabled>
                      Carregando categorias...
                    </SelectItem>
                  ) : (
                    getCategoryNamesByType(formData.type).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-sm font-medium text-foreground">Valor (R$)</Label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={amountString}
                className="h-11"
                onChange={(e) => {
                  // Permite apenas números, vírgulas e pontos
                  const rawValue = e.target.value.replace(/[^0-9,.]/g, '');
                  // Formata o valor para exibição
                  const formattedValue = formatAmountForDisplay(rawValue);
                  setAmountString(formattedValue);
                }}
                required
              />
            </div>

            {/* Data */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-normal",
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
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "paid" | "pending") => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="h-11">
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
            <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="recurring" className="text-sm font-medium text-foreground">Transação recorrente</Label>
                  <Switch
                    id="recurring"
                    checked={formData.is_recurring}
                    disabled={isEditing && formData.is_recurring}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_recurring: checked }))
                    }
                  />
                </div>

                {formData.is_recurring && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground">Tipo</Label>
                        <Select
                          value={formData.recurrence_type}
                          disabled={isEditing && formData.is_recurring}
                          onValueChange={(value: "monthly" | "yearly") => 
                            setFormData(prev => ({ ...prev, recurrence_type: value }))
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground">Repetir (máximo 96 vezes)</Label>
                        <Input
                          type="text"
                          value={formData.recurrence_count || ''}
                          className="h-11"
                          disabled={isEditing && formData.is_recurring}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Permite entrada vazia temporariamente
                            if (value === '') {
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrence_count: undefined 
                              }));
                              return;
                            }
                            
                            // Remove caracteres não numéricos
                            const numericValue = value.replace(/[^0-9]/g, '');
                            if (numericValue === '') {
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrence_count: undefined 
                              }));
                              return;
                            }
                            
                            const count = parseInt(numericValue);
                            if (!isNaN(count)) {
                              const validCount = Math.min(96, Math.max(1, count));
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrence_count: validCount 
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            // Garante que tem um valor válido ao sair do campo
                            if (!formData.recurrence_count) {
                              setFormData(prev => ({ 
                                ...prev, 
                                recurrence_count: 1 
                              }));
                            }
                          }}
                          placeholder="Ex: 12"
                        />
                        <p className="text-xs text-secondary">
                          A partir da data escolhida acima
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Botões */}
            <div className="flex gap-3 pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 h-11 font-medium"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant={formData.type === "income" ? "income" : "expense"}
                className="flex-1 h-11 font-medium"
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