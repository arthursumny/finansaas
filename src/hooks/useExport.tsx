import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
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

  const downloadTextFile = (content: string, fileName: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const escapeHtml = (value: string | number | boolean | null | undefined) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      const headers = [
        'Data',
        'Descrição',
        'Categoria',
        'Tipo',
        'Valor',
        'Valor Formatado',
        'Status',
        'Recorrente',
        'Tipo de Recorrência',
        'Desconto',
        'Valor Original'
      ];

      const rows = transactions.map(transaction => [
        formatDate(transaction.date),
        transaction.description,
        transaction.category,
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        transaction.amount,
        formatCurrency(transaction.amount),
        transaction.status === 'paid' ? 'Pago' : 'Pendente',
        transaction.is_recurring ? 'Sim' : 'Não',
        transaction.recurrence_type || '',
        transaction.discount_amount || 0,
        transaction.original_amount || transaction.amount
      ]);

      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const balance = totalIncome - totalExpense;

      const tableRows = [
        headers,
        ...rows,
        [],
        ['RESUMO FINANCEIRO'],
        ['Total de Receitas', '', '', '', totalIncome, formatCurrency(totalIncome)],
        ['Total de Despesas', '', '', '', totalExpense, formatCurrency(totalExpense)],
        ['Saldo', '', '', '', balance, formatCurrency(balance)]
      ];

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; }
      th, td { border: 1px solid #d0d7de; padding: 6px 8px; }
      th { background: #428bca; color: #ffffff; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      ${tableRows.map((row, rowIndex) => `
        <tr>
          ${row.map((cell) => rowIndex === 0
            ? `<th>${escapeHtml(cell)}</th>`
            : `<td>${escapeHtml(cell)}</td>`
          ).join('')}
        </tr>
      `).join('')}
    </table>
  </body>
</html>`;

      const fileName = `transacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xls`;
      downloadTextFile(html, fileName, 'application/vnd.ms-excel;charset=utf-8');
      
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
      const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', 'Recorrente', 'Desconto'];
      const rows = transactions.map(transaction => [
        formatDate(transaction.date),
        transaction.description,
        transaction.category,
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        transaction.amount,
        transaction.status === 'paid' ? 'Pago' : 'Pendente',
        transaction.is_recurring ? 'Sim' : 'Não',
        transaction.discount_amount || 0
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(escapeCsvValue).join(';'))
        .join('\n');

      const fileName = `transacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      downloadTextFile(`\uFEFF${csv}`, fileName, 'text/csv;charset=utf-8');
      
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
