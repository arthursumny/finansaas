import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Calendar as CalendarIcon,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Transaction } from '@/hooks/useTransactions';
import { useExport, ExportOptions } from '@/hooks/useExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

/**
 * Modal para exportação de dados com opções de formato e filtros
 */
const ExportModal = ({ isOpen, onClose, transactions }: ExportModalProps) => {
  const { exportData, isExporting } = useExport();
  
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [exportType, setExportType] = useState<'transactions' | 'monthly-report'>('transactions');
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [dateRange, setDateRange] = useState<{
    start: Date | undefined;
    end: Date | undefined;
  }>({ start: undefined, end: undefined });
  const [includeCharts, setIncludeCharts] = useState(false);

  /**
   * Filtra transações baseado no período selecionado
   */
  const getFilteredTransactions = () => {
    if (!useCustomDateRange || !dateRange.start || !dateRange.end) {
      return transactions;
    }
    
    const startDate = format(dateRange.start, 'yyyy-MM-dd');
    const endDate = format(dateRange.end, 'yyyy-MM-dd');
    
    return transactions.filter(transaction => {
      return transaction.date >= startDate && transaction.date <= endDate;
    });
  };

  /**
   * Executa a exportação com as opções selecionadas
   */
  const handleExport = async () => {
    const filteredTransactions = getFilteredTransactions();
    
    if (filteredTransactions.length === 0) {
      return;
    }
    
    const options: ExportOptions = {
      format: exportFormat,
      type: exportType,
      includeCharts,
      ...(useCustomDateRange && dateRange.start && dateRange.end && {
        dateRange: {
          start: format(dateRange.start, 'yyyy-MM-dd'),
          end: format(dateRange.end, 'yyyy-MM-dd')
        }
      })
    };
    
    try {
      await exportData(filteredTransactions, options);
      onClose();
    } catch (error) {
      console.error('Erro na exportação:', error);
    }
  };

  /**
   * Reseta o formulário ao fechar
   */
  const handleClose = () => {
    setExportFormat('pdf');
    setExportType('transactions');
    setUseCustomDateRange(false);
    setDateRange({ start: undefined, end: undefined });
    setIncludeCharts(false);
    onClose();
  };

  const filteredTransactions = getFilteredTransactions();
  const canExport = filteredTransactions.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Dados
          </DialogTitle>
          <DialogDescription>
            Escolha o formato e as opções para exportar suas transações
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Formato de Exportação */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato de Exportação</Label>
            <div className="grid grid-cols-3 gap-3">
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  exportFormat === 'pdf' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('pdf')}
              >
                <CardContent className="p-4 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm font-medium">PDF</p>
                  <p className="text-xs text-muted-foreground">Relatório formatado</p>
                </CardContent>
              </Card>
              
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  exportFormat === 'excel' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('excel')}
              >
                <CardContent className="p-4 text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Excel</p>
                  <p className="text-xs text-muted-foreground">Planilha editável</p>
                </CardContent>
              </Card>
              
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  exportFormat === 'csv' && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setExportFormat('csv')}
              >
                <CardContent className="p-4 text-center">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm font-medium">CSV</p>
                  <p className="text-xs text-muted-foreground">Dados simples</p>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Tipo de Relatório */}
          <div className="space-y-3">
            <Label htmlFor="export-type" className="text-sm font-medium">
              Tipo de Relatório
            </Label>
            <Select value={exportType} onValueChange={(value: 'transactions' | 'monthly-report') => setExportType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de relatório" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactions">Lista de Transações</SelectItem>
                <SelectItem value="monthly-report">Relatório Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Período Personalizado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Período Personalizado</Label>
              <Switch 
                checked={useCustomDateRange} 
                onCheckedChange={setUseCustomDateRange}
              />
            </div>
            
            {useCustomDateRange && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.start && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.start ? (
                          format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          "Selecionar"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.start}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, start: date }))}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.end && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.end ? (
                          format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          "Selecionar"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.end}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, end: date }))}
                        disabled={(date) => date > new Date() || (dateRange.start && date < dateRange.start)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
          
          {/* Incluir Gráficos (apenas para PDF) */}
          {exportFormat === 'pdf' && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Incluir Gráficos</Label>
                <p className="text-xs text-muted-foreground">Adicionar gráficos ao relatório PDF</p>
              </div>
              <Switch 
                checked={includeCharts} 
                onCheckedChange={setIncludeCharts}
              />
            </div>
          )}
          
          {/* Resumo */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Resumo da Exportação</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Formato: {exportFormat.toUpperCase()}</p>
                <p>• Tipo: {exportType === 'transactions' ? 'Lista de Transações' : 'Relatório Mensal'}</p>
                <p>• Transações: {filteredTransactions.length} registros</p>
                {useCustomDateRange && dateRange.start && dateRange.end && (
                  <p>• Período: {format(dateRange.start, 'dd/MM/yyyy', { locale: ptBR })} a {format(dateRange.end, 'dd/MM/yyyy', { locale: ptBR })}</p>
                )}
                {exportFormat === 'pdf' && includeCharts && (
                  <p>• Gráficos incluídos</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="flex-1"
            disabled={isExporting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleExport}
            className="flex-1"
            disabled={!canExport || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </div>
        
        {!canExport && (
          <p className="text-xs text-destructive text-center">
            Nenhuma transação encontrada para o período selecionado
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportModal;