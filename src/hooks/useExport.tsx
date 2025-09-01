import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from './useTransactions';
import { useToast } from './use-toast';

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  type: 'transactions' | 'monthly-report';
  dateRange?: {
    start: string;
    end: string;
  };
  includeCharts?: boolean;
}

/**
 * Hook personalizado para gerenciar exportação de dados
 * Fornece funcionalidades para exportar transações em PDF, Excel e CSV
 */
export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  /**
   * Formata valor monetário
   */
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * Formata data para exibição
   */
  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  /**
   * Captura gráficos como imagens para incluir no PDF
   */
  const captureCharts = async () => {
    const charts: { canvas: HTMLCanvasElement; title: string }[] = [];
    
    try {
      // Capturar gráfico de pizza de categorias
      const categoryChart = document.querySelector('[data-chart="category-pie"]') as HTMLElement;
      if (categoryChart) {
        const canvas = await html2canvas(categoryChart, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        charts.push({ canvas, title: 'Distribuição por Categorias' });
      }

      // Capturar gráfico de evolução mensal
      const monthlyChart = document.querySelector('[data-chart="monthly-evolution"]') as HTMLElement;
      if (monthlyChart) {
        const canvas = await html2canvas(monthlyChart, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        charts.push({ canvas, title: 'Evolução Mensal' });
      }

      return charts;
    } catch (error) {
      console.error('Erro ao capturar gráficos:', error);
      return [];
    }
  };

  /**
   * Exporta transações para PDF
   */
  const exportToPDF = async (transactions: Transaction[], options: ExportOptions) => {
    try {
      const doc = new jsPDF();
      
      // Configurações do documento
      doc.setFont('helvetica');
      
      // Título
      doc.setFontSize(20);
      doc.text('Relatório de Transações', 20, 20);
      
      // Período
      if (options.dateRange) {
        doc.setFontSize(12);
        doc.text(
          `Período: ${formatDate(options.dateRange.start)} a ${formatDate(options.dateRange.end)}`,
          20,
          35
        );
      }
      
      // Data de geração
      doc.setFontSize(10);
      doc.text(
        `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
        20,
        45
      );
      
      // Preparar dados para a tabela
      const tableData = transactions.map(transaction => [
        formatDate(transaction.date),
        transaction.description,
        transaction.category || 'Sem categoria',
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        formatCurrency(transaction.amount),
        transaction.status === 'paid' ? 'Pago' : 'Pendente'
      ]);
      
      // Criar tabela de transações usando autoTable
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status']],
        body: tableData,
        startY: 55,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 50 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25 }
        }
      });
      
      // Calcular resumo financeiro
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const balance = totalIncome - totalExpense;
      
      // Adicionar resumo financeiro
      let currentY = (doc as any).lastAutoTable?.finalY || 55;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Financeiro', 20, currentY + 20);
      
      // Tabela de resumo usando autoTable
      autoTable(doc, {
        body: [
          ['Total de Receitas', formatCurrency(totalIncome)],
          ['Total de Despesas', formatCurrency(totalExpense)],
          ['Saldo Final', formatCurrency(balance)]
        ],
        startY: currentY + 30,
        styles: {
          fontSize: 11,
          cellPadding: 4
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right', cellWidth: 60 }
        },
        theme: 'plain'
      });

      // Incluir gráficos se solicitado
      if (options.includeCharts) {
        const charts = await captureCharts();
        
        if (charts.length > 0) {
          currentY = (doc as any).lastAutoTable?.finalY || currentY + 60;
          
          // Adicionar título da seção de gráficos
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Gráficos', 20, currentY + 20);
          
          currentY += 30;
          
          for (const chart of charts) {
            // Verificar se precisa de nova página
            if (currentY + 100 > doc.internal.pageSize.height - 20) {
              doc.addPage();
              currentY = 20;
            }
            
            // Adicionar título do gráfico
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(chart.title, 20, currentY);
            
            // Calcular dimensões da imagem
            const imgWidth = 170; // Largura máxima
            const imgHeight = (chart.canvas.height * imgWidth) / chart.canvas.width;
            
            // Adicionar imagem do gráfico
            const imgData = chart.canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 20, currentY + 10, imgWidth, imgHeight);
            
            currentY += imgHeight + 30;
          }
        }
      }
      
      // Salvar arquivo
      const fileName = `transacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
      doc.save(fileName);
      
      return fileName;
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      throw new Error('Erro ao gerar arquivo PDF');
    }
  };

  /**
   * Exporta transações para Excel
   */
  const exportToExcel = async (transactions: Transaction[], options: ExportOptions) => {
    try {
      // Preparar dados para o Excel
      const excelData = transactions.map(transaction => ({
        'Data': formatDate(transaction.date),
        'Descrição': transaction.description,
        'Categoria': transaction.category,
        'Tipo': transaction.type === 'income' ? 'Receita' : 'Despesa',
        'Valor': transaction.amount,
        'Valor Formatado': formatCurrency(transaction.amount),
        'Status': transaction.status === 'paid' ? 'Pago' : 'Pendente',
        'Recorrente': transaction.is_recurring ? 'Sim' : 'Não',
        'Tipo de Recorrência': transaction.recurrence_type || '',
        'Desconto': transaction.discount_amount || 0,
        'Valor Original': transaction.original_amount || transaction.amount
      }));
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      
      // Criar worksheet com os dados
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Adicionar resumo financeiro
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const balance = totalIncome - totalExpense;
      
      // Adicionar linhas de resumo
      const summaryData = [
        {},
        { 'Data': 'RESUMO FINANCEIRO' },
        { 'Data': 'Total de Receitas', 'Valor Formatado': formatCurrency(totalIncome) },
        { 'Data': 'Total de Despesas', 'Valor Formatado': formatCurrency(totalExpense) },
        { 'Data': 'Saldo', 'Valor Formatado': formatCurrency(balance) }
      ];
      
      XLSX.utils.sheet_add_json(ws, summaryData, { origin: -1, skipHeader: true });
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Transações');
      
      // Salvar arquivo
      const fileName = `transacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      return fileName;
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      throw new Error('Erro ao gerar arquivo Excel');
    }
  };

  /**
   * Exporta transações para CSV
   */
  const exportToCSV = async (transactions: Transaction[], options: ExportOptions) => {
    try {
      // Preparar dados para o CSV
      const csvData = transactions.map(transaction => ({
        'Data': formatDate(transaction.date),
        'Descrição': transaction.description,
        'Categoria': transaction.category,
        'Tipo': transaction.type === 'income' ? 'Receita' : 'Despesa',
        'Valor': transaction.amount,
        'Status': transaction.status === 'paid' ? 'Pago' : 'Pendente',
        'Recorrente': transaction.is_recurring ? 'Sim' : 'Não',
        'Desconto': transaction.discount_amount || 0
      }));
      
      // Criar worksheet
      const ws = XLSX.utils.json_to_sheet(csvData);
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transações');
      
      // Salvar como CSV
      const fileName = `transacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      
      return fileName;
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      throw new Error('Erro ao gerar arquivo CSV');
    }
  };

  /**
   * Função principal de exportação
   */
  const exportData = async (transactions: Transaction[], options: ExportOptions) => {
    setIsExporting(true);
    
    try {
      let fileName: string;
      
      switch (options.format) {
        case 'pdf':
          fileName = await exportToPDF(transactions, options);
          break;
        case 'excel':
          fileName = await exportToExcel(transactions, options);
          break;
        case 'csv':
          fileName = await exportToCSV(transactions, options);
          break;
        default:
          throw new Error('Formato de exportação não suportado');
      }
      
      toast({
        title: 'Exportação concluída',
        description: `Arquivo ${fileName} foi baixado com sucesso!`,
      });
      
      return fileName;
    } catch (error: any) {
      toast({
        title: 'Erro na exportação',
        description: error.message || 'Erro desconhecido ao exportar dados',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportData,
    isExporting
  };
};