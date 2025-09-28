import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useImport, ImportedTransaction } from '@/hooks/useImport';
import { formatCurrency } from '@/lib/utils';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ open, onOpenChange }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isLoading, preview, processFile, importTransactions, clearPreview } = useImport();

  /**
   * Função para lidar com o upload de arquivo
   */
  const handleFileUpload = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.csv', '.ofx', '.qfx'];
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidFile) {
      alert('Por favor, selecione um arquivo CSV, OFX ou QFX.');
      return;
    }

    try {
      await processFile(file);
      setStep('preview');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
    }
  };

  /**
   * Função para lidar com o drop de arquivo
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  /**
   * Função para lidar com o drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  /**
   * Função para lidar com o drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  /**
   * Função para lidar com a seleção de arquivo via input
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  /**
   * Função para confirmar importação
   */
  const handleConfirmImport = async () => {
    if (!preview?.transactions) return;

    setStep('importing');
    try {
      await importTransactions(preview.transactions);
      onOpenChange(false);
      handleReset();
    } catch (error) {
      setStep('preview');
    }
  };

  /**
   * Função para resetar o modal
   */
  const handleReset = () => {
    setStep('upload');
    clearPreview();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Função para fechar o modal
   */
  const handleClose = () => {
    onOpenChange(false);
    handleReset();
  };

  /**
   * Função para renderizar o badge do tipo de transação
   */
  const renderTypeBadge = (type: 'income' | 'expense') => {
    return (
      <Badge variant={type === 'income' ? 'default' : 'destructive'}>
        {type === 'income' ? 'Receita' : 'Despesa'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Importar Extrato Bancário
          </DialogTitle>
          <DialogDescription>
            Importe suas transações a partir de um arquivo CSV ou OFX do seu banco.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {/* Área de Upload */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Arraste seu arquivo aqui</h3>
              <p className="text-muted-foreground mb-4">
                Formatos aceitos: CSV, OFX, QFX
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <FileText className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx,.qfx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Instruções */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">📋 Instruções:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>CSV:</strong> Deve conter colunas Data, Descrição e Valor com cabeçalhos</li>
                <li>• <strong>OFX/QFX:</strong> Formato padrão de extratos bancários (Open Financial Exchange)</li>
                <li>• Formatos de data aceitos: DD/MM/AAAA ou AAAA-MM-DD</li>
                <li>• Valores podem estar em formato brasileiro (R$ 1.234,56) ou internacional (1234.56)</li>
                <li>• O sistema detecta automaticamente o formato e mapeia as categorias</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary">{preview.total_count}</div>
                <div className="text-sm text-muted-foreground">Total de linhas</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{preview.valid_count}</div>
                <div className="text-sm text-muted-foreground">Transações válidas</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{preview.invalid_count}</div>
                <div className="text-sm text-muted-foreground">Linhas com erro</div>
              </div>
            </div>

            <Separator />

            {/* Preview das Transações */}
            <div>
              <h4 className="font-semibold mb-4">Preview das Transações (primeiras 10)</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.transactions.slice(0, 10).map((transaction, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {new Date(transaction.date).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.description}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          {renderTypeBadge(transaction.type)}
                        </TableCell>
                        <TableCell>
                          {transaction.category ? (
                            <Badge variant="outline">{transaction.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem categoria</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.transactions.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ... e mais {preview.transactions.length - 10} transações
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Importando transações...</h3>
            <p className="text-muted-foreground text-center">
              Por favor, aguarde enquanto processamos suas transações.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Voltar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={!preview?.transactions.length}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Importar {preview?.transactions.length} Transações
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};