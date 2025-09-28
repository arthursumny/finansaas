import { ImportedTransaction } from '../hooks/useImport';

export interface OFXTransaction {
  DTPOSTED: string; // Data da transação
  TRNAMT: string;   // Valor da transação
  FITID: string;    // ID único da transação
  NAME?: string;    // Nome/descrição
  MEMO?: string;    // Memo/descrição adicional
  TRNTYPE?: string; // Tipo da transação
}

export interface OFXAccount {
  BANKID?: string;  // ID do banco
  ACCTID: string;   // ID da conta
  ACCTTYPE: string; // Tipo da conta
}

export interface OFXData {
  account: OFXAccount;
  transactions: OFXTransaction[];
  dtstart?: string; // Data de início
  dtend?: string;   // Data de fim
}

/**
 * Função para extrair texto entre tags XML
 */
const extractTagValue = (xml: string, tagName: string): string | null => {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};

/**
 * Função para extrair múltiplos valores de uma tag
 */
const extractMultipleTagValues = (xml: string, tagName: string): string[] => {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'gi');
  const matches = xml.matchAll(regex);
  return Array.from(matches, match => match[1].trim());
};

/**
 * Função para extrair seções XML
 */
const extractSection = (xml: string, sectionName: string): string | null => {
  const regex = new RegExp(`<${sectionName}>(.*?)</${sectionName}>`, 'is');
  const match = xml.match(regex);
  return match ? match[1] : null;
};

/**
 * Função para extrair múltiplas seções XML
 */
const extractMultipleSections = (xml: string, sectionName: string): string[] => {
  const regex = new RegExp(`<${sectionName}>(.*?)</${sectionName}>`, 'gis');
  const matches = xml.matchAll(regex);
  return Array.from(matches, match => match[1]);
};

/**
 * Função para converter data OFX para formato ISO
 */
const convertOFXDate = (ofxDate: string): string => {
  // Formato OFX: YYYYMMDD ou YYYYMMDDHHMMSS
  const dateOnly = ofxDate.substring(0, 8);
  const year = dateOnly.substring(0, 4);
  const month = dateOnly.substring(4, 6);
  const day = dateOnly.substring(6, 8);
  
  return `${year}-${month}-${day}`;
};

/**
 * Função para determinar o tipo de transação baseado no valor
 */
const determineTransactionType = (amount: number, trnType?: string): 'income' | 'expense' => {
  if (trnType) {
    const type = trnType.toLowerCase();
    if (type.includes('credit') || type.includes('dep') || type.includes('int')) {
      return 'income';
    }
    if (type.includes('debit') || type.includes('payment') || type.includes('fee')) {
      return 'expense';
    }
  }
  
  // Se não há tipo específico, usar o sinal do valor
  return amount >= 0 ? 'income' : 'expense';
};

/**
 * Função principal para parsear arquivo OFX
 */
export const parseOFX = (ofxContent: string): OFXData => {
  try {
    // Limpar e normalizar o conteúdo OFX
    let cleanContent = ofxContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    // Remover cabeçalho OFX se presente
    const xmlStart = cleanContent.indexOf('<OFX>');
    if (xmlStart > 0) {
      cleanContent = cleanContent.substring(xmlStart);
    }
    
    // Extrair informações da conta
    const bankmsgsrsv1 = extractSection(cleanContent, 'BANKMSGSRSV1');
    if (!bankmsgsrsv1) {
      throw new Error('Seção BANKMSGSRSV1 não encontrada no arquivo OFX');
    }
    
    const stmtrs = extractSection(bankmsgsrsv1, 'STMTRS');
    if (!stmtrs) {
      throw new Error('Seção STMTRS não encontrada no arquivo OFX');
    }
    
    // Extrair dados da conta
    const bankacctfrom = extractSection(stmtrs, 'BANKACCTFROM');
    if (!bankacctfrom) {
      throw new Error('Informações da conta não encontradas no arquivo OFX');
    }
    
    const account: OFXAccount = {
      BANKID: extractTagValue(bankacctfrom, 'BANKID') || undefined,
      ACCTID: extractTagValue(bankacctfrom, 'ACCTID') || '',
      ACCTTYPE: extractTagValue(bankacctfrom, 'ACCTTYPE') || 'CHECKING'
    };
    
    // Extrair lista de transações
    const banktranlist = extractSection(stmtrs, 'BANKTRANLIST');
    if (!banktranlist) {
      throw new Error('Lista de transações não encontrada no arquivo OFX');
    }
    
    // Extrair datas de início e fim
    const dtstart = extractTagValue(banktranlist, 'DTSTART');
    const dtend = extractTagValue(banktranlist, 'DTEND');
    
    // Extrair transações individuais
    const stmttrnSections = extractMultipleSections(banktranlist, 'STMTTRN');
    
    const transactions: OFXTransaction[] = stmttrnSections.map(section => {
      return {
        DTPOSTED: extractTagValue(section, 'DTPOSTED') || '',
        TRNAMT: extractTagValue(section, 'TRNAMT') || '0',
        FITID: extractTagValue(section, 'FITID') || '',
        NAME: extractTagValue(section, 'NAME') || undefined,
        MEMO: extractTagValue(section, 'MEMO') || undefined,
        TRNTYPE: extractTagValue(section, 'TRNTYPE') || undefined
      };
    });
    
    return {
      account,
      transactions,
      dtstart: dtstart || undefined,
      dtend: dtend || undefined
    };
    
  } catch (error) {
    throw new Error(`Erro ao parsear arquivo OFX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};

/**
 * Função para converter dados OFX para formato de transações importadas
 */
export const convertOFXToImportedTransactions = (ofxData: OFXData): ImportedTransaction[] => {
  return ofxData.transactions.map(transaction => {
    const amount = parseFloat(transaction.TRNAMT);
    const description = transaction.NAME || transaction.MEMO || `Transação ${transaction.FITID}`;
    const type = determineTransactionType(amount, transaction.TRNTYPE);
    
    return {
      date: convertOFXDate(transaction.DTPOSTED),
      description: description.trim(),
      amount: Math.abs(amount),
      type,
      original_data: transaction
    };
  }).filter(transaction => {
    // Filtrar transações com dados válidos
    return transaction.date && transaction.description && !isNaN(transaction.amount);
  });
};

/**
 * Função para validar se um arquivo é OFX válido
 */
export const isValidOFX = (content: string): boolean => {
  try {
    // Verificar se contém tags OFX básicas
    const hasOFXTag = content.includes('<OFX>') || content.includes('<ofx>');
    const hasBankMsgs = content.includes('<BANKMSGSRSV1>') || content.includes('<bankmsgsrsv1>');
    const hasStmt = content.includes('<STMTRS>') || content.includes('<stmtrs>');
    
    return hasOFXTag && hasBankMsgs && hasStmt;
  } catch {
    return false;
  }
};