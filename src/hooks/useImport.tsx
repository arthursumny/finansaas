import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactions, TRANSACTIONS_QUERY_KEY } from './useTransactions';
import { CARDS_QUERY_KEY } from './useCards';
import { useCategories } from './useCategories';
import { useToast } from './use-toast';
import { Transaction } from './useTransactions';
import { parseOFX, convertOFXToImportedTransactions, isValidOFX } from '../lib/ofxParser';

export interface ImportedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  original_data?: any;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  type?: string;
  category?: string;
}

export interface ImportPreview {
  transactions: ImportedTransaction[];
  total_count: number;
  valid_count: number;
  invalid_count: number;
  errors: string[];
}

export const useImport = () => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const { addTransaction } = useTransactions();
  const { categories } = useCategories();
  const { toast } = useToast();

  /**
   * Função para detectar o separador do CSV
   */
  const detectSeparator = (csvText: string): string => {
    const firstLine = csvText.split('\n')[0];
    const separators = [',', ';', '\t', '|'];
    
    let maxCount = 0;
    let detectedSeparator = ',';
    
    separators.forEach(sep => {
      const count = (firstLine.match(new RegExp(`\\${sep}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedSeparator = sep;
      }
    });
    
    return detectedSeparator;
  };

  /**
   * Função para parsear CSV em array de objetos
   */
  const parseCSV = (csvText: string, separator?: string): any[] => {
    const sep = separator || detectSeparator(csvText);
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Arquivo CSV deve ter pelo menos 2 linhas (cabeçalho + dados)');
    }
    
    const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.trim().replace(/"/g, ''));
      
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }
    
    return data;
  };

  /**
   * Função para mapear dados CSV para transações
   */
  const mapTransactions = (data: any[], mapping: ColumnMapping): ImportedTransaction[] => {
    const transactions: ImportedTransaction[] = [];
    
    data.forEach((row, index) => {
      try {
        // Mapear data
        const dateValue = row[mapping.date];
        if (!dateValue) throw new Error(`Data não encontrada na linha ${index + 2}`);
        
        // Tentar diferentes formatos de data
        let parsedDate: Date;
        if (dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/');
          parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (dateValue.includes('-')) {
          parsedDate = new Date(dateValue);
        } else {
          throw new Error(`Formato de data inválido na linha ${index + 2}: ${dateValue}`);
        }
        
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`Data inválida na linha ${index + 2}: ${dateValue}`);
        }
        
        // Mapear descrição
        const description = row[mapping.description];
        if (!description) throw new Error(`Descrição não encontrada na linha ${index + 2}`);
        
        // Mapear valor
        const amountValue = row[mapping.amount];
        if (!amountValue) throw new Error(`Valor não encontrado na linha ${index + 2}`);
        
        // Limpar e converter valor
        const cleanAmount = amountValue.toString()
          .replace(/[R$\s]/g, '')
          .replace(',', '.')
          .replace(/[^\d.-]/g, '');
        
        const amount = parseFloat(cleanAmount);
        if (isNaN(amount)) {
          throw new Error(`Valor inválido na linha ${index + 2}: ${amountValue}`);
        }
        
        // Determinar tipo (receita/despesa)
        let type: 'income' | 'expense' = 'expense';
        
        if (mapping.type && row[mapping.type]) {
          const typeValue = row[mapping.type].toLowerCase();
          if (typeValue.includes('receita') || typeValue.includes('crédito') || typeValue.includes('entrada')) {
            type = 'income';
          }
        } else {
          // Se não há coluna de tipo, usar valor positivo/negativo
          type = amount > 0 ? 'income' : 'expense';
        }
        
        // Mapear categoria (opcional)
        let category = undefined;
        if (mapping.category && row[mapping.category]) {
          category = row[mapping.category];
        }
        
        transactions.push({
          date: parsedDate.toISOString().split('T')[0],
          description: description.trim(),
          amount: Math.abs(amount),
          type,
          category,
          original_data: row
        });
        
      } catch (error) {
        console.warn(`Erro ao processar linha ${index + 2}:`, error);
        // Continuar processando outras linhas
      }
    });
    
    return transactions;
  };

  /**
   * Função para sugerir mapeamento automático de colunas
   */
  const suggestMapping = (headers: string[]): Partial<ColumnMapping> => {
    const mapping: Partial<ColumnMapping> = {};
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      
      // Mapear data
      if (lowerHeader.includes('data') || lowerHeader.includes('date')) {
        mapping.date = header;
      }
      
      // Mapear descrição
      if (lowerHeader.includes('descrição') || lowerHeader.includes('descricao') || 
          lowerHeader.includes('description') || lowerHeader.includes('histórico') || 
          lowerHeader.includes('historico')) {
        mapping.description = header;
      }
      
      // Mapear valor
      if (lowerHeader.includes('valor') || lowerHeader.includes('amount') || 
          lowerHeader.includes('quantia')) {
        mapping.amount = header;
      }
      
      // Mapear tipo
      if (lowerHeader.includes('tipo') || lowerHeader.includes('type') || 
          lowerHeader.includes('natureza')) {
        mapping.type = header;
      }
      
      // Mapear categoria
      if (lowerHeader.includes('categoria') || lowerHeader.includes('category')) {
        mapping.category = header;
      }
    });
    
    return mapping;
  };

  /**
   * Função para detectar o tipo de arquivo
   */
  const detectFileType = (content: string, fileName: string): 'csv' | 'ofx' => {
    const extension = fileName.toLowerCase().split('.').pop();
    
    // Verificar por extensão
    if (extension === 'ofx' || extension === 'qfx') {
      return 'ofx';
    }
    
    if (extension === 'csv') {
      return 'csv';
    }
    
    // Verificar por conteúdo
    if (isValidOFX(content)) {
      return 'ofx';
    }
    
    // Default para CSV
    return 'csv';
  };

  /**
   * Função para processar arquivo CSV
   */
  const processCSVFile = async (content: string): Promise<ImportedTransaction[]> => {
    const data = parseCSV(content);
    
    if (data.length === 0) {
      throw new Error('Nenhum dado encontrado no arquivo CSV');
    }
    
    // Sugerir mapeamento automático
    const headers = Object.keys(data[0]);
    const suggestedMapping = suggestMapping(headers);
    
    // Verificar se temos os campos obrigatórios
    if (!suggestedMapping.date || !suggestedMapping.description || !suggestedMapping.amount) {
      throw new Error('Não foi possível identificar automaticamente as colunas obrigatórias (data, descrição, valor)');
    }
    
    return mapTransactions(data, suggestedMapping as ColumnMapping);
  };

  /**
   * Função para processar arquivo OFX
   */
  const processOFXFile = async (content: string): Promise<ImportedTransaction[]> => {
    const ofxData = parseOFX(content);
    return convertOFXToImportedTransactions(ofxData);
  };

  /**
   * Função para processar arquivo e gerar preview
   */
  const processFile = async (file: File): Promise<ImportPreview> => {
    setIsLoading(true);
    
    try {
      const text = await file.text();
      const fileType = detectFileType(text, file.name);
      
      let transactions: ImportedTransaction[];
      
      if (fileType === 'ofx') {
        transactions = await processOFXFile(text);
      } else {
        transactions = await processCSVFile(text);
      }
      
      if (transactions.length === 0) {
        throw new Error('Nenhuma transação válida encontrada no arquivo');
      }
      
      const preview: ImportPreview = {
        transactions,
        total_count: transactions.length,
        valid_count: transactions.length,
        invalid_count: 0,
        errors: []
      };
      
      setPreview(preview);
      return preview;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao processar arquivo',
        description: errorMessage,
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Função para importar transações do preview
   */
  const importTransactions = async (transactions: ImportedTransaction[]): Promise<void> => {
    setIsLoading(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const transaction of transactions) {
        try {
          // Mapear categoria se existir
          let categoryId = undefined;
          if (transaction.category) {
            const category = categories.find(c => 
              c.name.toLowerCase() === transaction.category?.toLowerCase()
            );
            categoryId = category?.id;
          }
          
          const newTransaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category: categoryId,
            date: transaction.date,
            status: 'paid'
          };
          
          await addTransaction(newTransaction);
          successCount++;
          
        } catch (error) {
          console.error('Erro ao importar transação:', transaction, error);
          errorCount++;
        }
      }
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
      ]);

      toast({
        title: 'Importação concluída',
        description: `${successCount} transações importadas com sucesso. ${errorCount > 0 ? `${errorCount} erros.` : ''}`,
        variant: successCount > 0 ? 'default' : 'destructive'
      });
      
      setPreview(null);
      
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro durante a importação das transações.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Função para limpar preview
   */
  const clearPreview = () => {
    setPreview(null);
  };

  return {
    isLoading,
    preview,
    processFile,
    importTransactions,
    clearPreview,
    suggestMapping,
    parseCSV
  };
};