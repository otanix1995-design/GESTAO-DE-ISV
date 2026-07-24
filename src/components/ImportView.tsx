/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Supplier, User, ImportHistoryEntry } from '../types';
import { formatCnpj, normalizeProductCode, deduplicateProducts, sanitizeProductIndustry, parseBrazilianFloat, parseEstoqueString } from '../mockData';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  HelpCircle, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Copy,
  PlusCircle,
  FileCheck2,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';

function splitRowColumns(row: string): string[] {
  if (!row) return [];
  const trimmed = row.trim();
  if (!trimmed) return [];

  // If tab-separated (from Excel paste)
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1').trim());
  }

  const delimiter = trimmed.includes(';') ? ';' : trimmed.includes('|') ? '|' : ',';
  
  // Character-by-character parser to avoid regex infinite loops
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '"') {
      if (inQuotes && i + 1 < trimmed.length && trimmed[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"(.*)"$/, '$1').trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"(.*)"$/, '$1').trim());

  return result;
}

interface MappingIndices {
  iCodigo: number;
  iDescricao: number;
  iEmbalagem: number;
  iCnpj: number;
  iNomeIndustria: number;
}

function findHeaderRowInRows(rows: string[][]): { headerRowIndex: number; rawHeaders: string[]; normalizedHeaders: string[] } {
  const headerKeywords = [
    'codigo', 'cod', 'ean', 'produto', 'sku', 'desc', 'descricao', 'descricaomercadoria', 
    'embalagem', 'emb', 'complemento', 'fornecedor', 'razao', 'razaosocial', 'industria', 
    'nomeindustria', 'cnpj', 'custo', 'customedio', 'semvenda', 'valordisponivel', 'estoque', 'idade'
  ];

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols = rows[i] || [];
    const normalized = cols.map(h => 
      String(h || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
    );

    const matches = normalized.filter(col => headerKeywords.some(kw => col.includes(kw)));
    if (matches.length >= 2 || (rows.length === 1 && matches.length >= 1)) {
      return {
        headerRowIndex: i,
        rawHeaders: cols,
        normalizedHeaders: normalized
      };
    }
  }

  return {
    headerRowIndex: -1,
    rawHeaders: [],
    normalizedHeaders: []
  };
}

function detectBasePrincipalColumns(rows: string[][], fallbackIndices: MappingIndices): MappingIndices {
  const numRowsToAnalyze = Math.min(rows.length, 15);
  if (numRowsToAnalyze === 0) return fallbackIndices;

  const numCols = Math.max(...rows.slice(0, numRowsToAnalyze).map(r => r.length));
  if (numCols < 2) return fallbackIndices;

  const scoresByCol = Array.from({ length: numCols }, () => ({
    cnpj: 0,
    codigo: 0,
    embalagem: 0,
    descricao: 0,
    nomeIndustria: 0
  }));

  for (let r = 0; r < numRowsToAnalyze; r++) {
    const cols = rows[r];
    for (let j = 0; j < cols.length; j++) {
      const val = cols[j] ? cols[j].trim() : "";
      if (!val) continue;

      // 1. CNPJ Check (Fornecedor)
      const isFormatCnpj = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(val);
      const cleanDigits = val.replace(/[^\d]/g, "");
      const isCnpjDigits = cleanDigits.length === 14 || cleanDigits.length === 12 || cleanDigits.length === 13;
      
      if (isFormatCnpj) {
        scoresByCol[j].cnpj += 25;
      } else if (isCnpjDigits && (val.includes("/") || val.includes("-"))) {
        scoresByCol[j].cnpj += 18;
      } else if (isCnpjDigits) {
        scoresByCol[j].cnpj += 8;
      }

      // 2. Embalagem check
      const upperVal = val.toUpperCase();
      const isShort = val.length <= 18;
      const hasEmbKeywords = /\b(CX|FD|FDO|UN|PCT|KG|GF|LT|PC|CXA|FD12|FD6|FD24|UNID|UNIDADES|CAIXA|FARDO|GARRAFA|LATA|COPO|PET)\b/i.test(val) || 
                            upperVal.startsWith("CX") || upperVal.startsWith("FD") || upperVal.startsWith("UN") || upperVal.startsWith("PCT") || upperVal.startsWith("PC");
      const hasXMeasure = /\b\d+\s*[xX]\s*\d+\b/.test(val) || /^\d+\s*[xX]/i.test(val);

      if (hasEmbKeywords && isShort) {
        scoresByCol[j].embalagem += 15;
      } else if (hasXMeasure && isShort) {
        scoresByCol[j].embalagem += 10;
      }

      // 3. Código check
      const noSpaces = !/\s/.test(val);
      const isCodeLength = val.length >= 3 && val.length <= 15;
      const isNumeric = /^\d+$/.test(val);
      const isAlphanumericCode = /^[A-Za-z0-9-]+$/.test(val);

      if (noSpaces && isCodeLength && !isFormatCnpj) {
        if (isNumeric) {
          scoresByCol[j].codigo += 18;
        } else if (isAlphanumericCode) {
          scoresByCol[j].codigo += 12;
        }
      }

      // 4. Nome Indústria / Razão Social check
      const hasCompanyIndicators = /\b(S\.?A\.?|LTDA\.?|S\/A|M\.?E\.?|EIRELI|INDUSTRIA|COMERCIO|BRF|JBS|COCA[- ]COLA|MONDELEZ|NESTLE|DANONE|UNILEVER|AMBEV|BEBIDAS|DISTRIBUIDORA)\b/i.test(val);
      const isMediumLength = val.length >= 5 && val.length <= 60;
      const hasSpaces = /\s/.test(val);

      if (hasCompanyIndicators) {
        scoresByCol[j].nomeIndustria += 22;
      } else if (hasSpaces && isMediumLength) {
        scoresByCol[j].nomeIndustria += 6;
      }

      // 5. Descrição check
      const hasProductKeywords = /\b(AGUA|PANO|TAPETE|SABAO|SHAMPOO|CONDICIONADOR|DESODORANTE|LEITE|CHOCOLATE|CEREAL|BOMBOM|CAFESOLUVEL|SUCO|REFRIGERANTE|BISCOITO|REFRESCO|MARGARINA|LASANHA|PRESUNTO|LINGUICA|STEAK|IOGURTE|SOBREMESA|ACTIVIA|MINERAL|PRATO|GAS|REGISTRO|SACOLA|CERVEJA|HAMBURGUER|REFRIGERADO)\b/i.test(val);
      
      if (hasProductKeywords) {
        scoresByCol[j].descricao += 18;
      } else if (hasSpaces && val.length > 10 && !hasCompanyIndicators) {
        scoresByCol[j].descricao += 8;
      }
    }
  }

  const colRoles = new Map<string, number>();
  const used = new Set<number>();

  let bestCnpj = -1, maxCnpj = -1;
  for (let j = 0; j < numCols; j++) {
    if (scoresByCol[j].cnpj > maxCnpj) { maxCnpj = scoresByCol[j].cnpj; bestCnpj = j; }
  }
  if (maxCnpj > 5) { colRoles.set('cnpj', bestCnpj); used.add(bestCnpj); }

  let bestCod = -1, maxCod = -1;
  for (let j = 0; j < numCols; j++) {
    if (used.has(j)) continue;
    if (scoresByCol[j].codigo > maxCod) { maxCod = scoresByCol[j].codigo; bestCod = j; }
  }
  if (maxCod > 5) { colRoles.set('codigo', bestCod); used.add(bestCod); }

  let bestEmb = -1, maxEmb = -1;
  for (let j = 0; j < numCols; j++) {
    if (used.has(j)) continue;
    if (scoresByCol[j].embalagem > maxEmb) { maxEmb = scoresByCol[j].embalagem; bestEmb = j; }
  }
  if (maxEmb > 5) { colRoles.set('embalagem', bestEmb); used.add(bestEmb); }

  let bestInd = -1, maxInd = -1;
  for (let j = 0; j < numCols; j++) {
    if (used.has(j)) continue;
    if (scoresByCol[j].nomeIndustria > maxInd) { maxInd = scoresByCol[j].nomeIndustria; bestInd = j; }
  }
  if (maxInd > 3) { colRoles.set('nomeIndustria', bestInd); used.add(bestInd); }

  let bestDesc = -1, maxDesc = -1;
  for (let j = 0; j < numCols; j++) {
    if (used.has(j)) continue;
    if (scoresByCol[j].descricao > maxDesc) { maxDesc = scoresByCol[j].descricao; bestDesc = j; }
  }
  if (maxDesc > 3) { colRoles.set('descricao', bestDesc); used.add(bestDesc); }

  return {
    iCnpj: colRoles.has('cnpj') ? colRoles.get('cnpj')! : fallbackIndices.iCnpj,
    iNomeIndustria: colRoles.has('nomeIndustria') ? colRoles.get('nomeIndustria')! : fallbackIndices.iNomeIndustria,
    iCodigo: colRoles.has('codigo') ? colRoles.get('codigo')! : fallbackIndices.iCodigo,
    iDescricao: colRoles.has('descricao') ? colRoles.get('descricao')! : fallbackIndices.iDescricao,
    iEmbalagem: colRoles.has('embalagem') ? colRoles.get('embalagem')! : -1
  };
}

interface ImportViewProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  suppliers: Supplier[];
  setSuppliers?: (suppliers: Supplier[]) => void;
  currentUser: User;
  impHistory: ImportHistoryEntry[];
  setImpHistory: (history: ImportHistoryEntry[]) => void;
  onUpdateStats: (newTimestamp: string) => void;
}

export default function ImportView({ 
  products, 
  setProducts, 
  suppliers,
  setSuppliers,
  currentUser, 
  impHistory, 
  setImpHistory, 
  onUpdateStats
}: ImportViewProps) {
  const isAdmin = currentUser.role === 'Admin';
  const [importType, setImportType] = useState<'EstoqueDiario' | 'BasePrincipal'>('EstoqueDiario');
  const [pasteData, setPasteData] = useState('');
  const [importLog, setImportLog] = useState<{ status: 'idle' | 'success' | 'error'; message: string; details?: string[] }>({
    status: 'idle',
    message: ''
  });

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setImportLog({
      status: 'idle',
      message: 'Lendo e processando planilha...'
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      // Use setTimeout to yield execution so React can render the loading message
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Nenhuma aba encontrada no arquivo de planilha.');
          }

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to 2D array of string cells
          const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          
          if (!json || json.length === 0) {
            setImportLog({
              status: 'error',
              message: 'Não foi possível encontrar dados válidos na primeira aba da planilha Excel.'
            });
            return;
          }
          
          const parsedRows: string[][] = json
            .map(row => (Array.isArray(row) ? row : []).map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()))
            .filter(row => row.some(c => c.length > 0));

          if (parsedRows.length === 0) {
            setImportLog({
              status: 'error',
              message: 'A planilha selecionada está vazia.'
            });
            return;
          }

          // Populate pasteData textarea with sample rows (up to 500 lines) for display without DOM lag
          const sampleText = parsedRows.slice(0, 500).map(r => r.join('\t')).join('\n');
          setPasteData(sampleText);

          // Auto detect import type from content
          const sampleFullText = parsedRows.slice(0, 15).map(r => r.join(' ')).join(' ').toLowerCase();
          let targetType = importType;
          
          if (sampleFullText.includes('cnpj') || sampleFullText.includes('razao') || sampleFullText.includes('fornecedor') || sampleFullText.includes('razaosocial')) {
            if (!sampleFullText.includes('dias sem venda') && !sampleFullText.includes('valordisponivel') && !sampleFullText.includes('valor disponivel')) {
              targetType = 'BasePrincipal';
              setImportType('BasePrincipal');
            }
          } else if (sampleFullText.includes('estoque') || sampleFullText.includes('valor disponivel') || sampleFullText.includes('sem venda')) {
            targetType = 'EstoqueDiario';
            setImportType('EstoqueDiario');
          }

          // Execute import directly with 2D array!
          executeImportData(parsedRows, targetType, file.name);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error: any) {
          console.error('File upload error:', error);
          setImportLog({
            status: 'error',
            message: `Erro ao ler a planilha Excel: ${error.message || 'Formato de arquivo corrompido ou incompatível.'}`
          });
        }
      }, 30);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!isAdmin) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'ods') {
        handleFileUpload(file);
      } else {
        setImportLog({
          status: 'error',
          message: 'Tipo de arquivo inválido. Por favor, envie uma planilha do Excel (.xlsx, .xls, .ods) ou arquivo CSV (.csv).'
        });
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Delimited templates that users can easily copy-paste or pre-fill with a button
  const ESTOQUE_TEMPLATE = 
`Código	Descrição Mercadoria	Complemento	Valor Disponível	Estoque	Dias sem venda	Idade
2488	REFRIGERADO HAMBURGUER SEARA BOV 120G	CX 36 UN	R$ 142,50	75	0	12
100103	LASANHA SEARA BOLONHESA 600G	CX 12 UN	R$ 170,25	15	3	5
100104	PRESUNTO SEARA COZIDO RESFRIADO KG	CX 2 PC	R$ 178,20	9	0	2
200203	CERVEJA SPATEN PURO MALTE LT 350ML	FD 12 UN	R$ 1.183,20	348	0	10
300304	SABAO LIQUIDO OMO PROTECAO FRASCO 3L	CX 4 UN	R$ 991,80	29	0	8
999901	NOVO PRODUTO TESTE DE IMPORTACAO	CX 10 UN	R$ 67,50	15	1	15`;

  const BASE_PRINCIPAL_TEMPLATE = 
`Fornecedor	Razão Social	Código	Descrição
02.916.265/0001-60	JBS S.A (Friboi & Seara)	00002488-110	REFRIGERADO HAMBURGUER SEARA BOV 120G
02.916.265/0001-60	JBS S.A (Friboi & Seara)	00001001-030	LASANHA SEARA BOLONHESA 600G
02.916.265/0001-60	JBS S.A (Friboi & Seara)	00001001-040	PRESUNTO SEARA COZIDO RESFRIADO KG
03.016.124/0001-50	Ambev S.A (Bebidas)	00002002-030	CERVEJA SPATEN PURO MALTE LT 350ML
61.068.276/0001-04	Unilever Brasil Ltda	00003003-040	SABAO LIQUIDO OMO PROTECAO FRASCO 3L`;

  const handlePreFill = () => {
    if (importType === 'EstoqueDiario') {
      setPasteData(ESTOQUE_TEMPLATE);
    } else {
      setPasteData(BASE_PRINCIPAL_TEMPLATE);
    }
  };

  const executeImportData = (
    dataToParse: string | string[][], 
    activeImportType: 'EstoqueDiario' | 'BasePrincipal',
    fileNameCustom?: string
  ) => {
    if (!isAdmin) {
      setImportLog({
        status: 'error',
        message: 'Apenas usuários com perfil Administrador podem executar importações no sistema.'
      });
      return;
    }

    let parsedRows: string[][] = [];

    if (Array.isArray(dataToParse)) {
      parsedRows = dataToParse
        .map(row => (Array.isArray(row) ? row : []).map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim()))
        .filter(row => row.some(cell => cell.length > 0));
    } else {
      if (!dataToParse.trim()) {
        setImportLog({
          status: 'error',
          message: 'Área de transferência vazia. Por favor, cole os dados delimitados da planilha ou selecione um arquivo.'
        });
        return;
      }
      const lines = dataToParse.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
      parsedRows = lines.map(line => splitRowColumns(line)).filter(row => row.some(cell => cell.length > 0));
    }

    if (parsedRows.length < 1) {
      setImportLog({
        status: 'error',
        message: 'A planilha enviada não possui dados válidos.'
      });
      return;
    }

    try {
      // Find header row using keyword matching in first 10 lines
      const { headerRowIndex, rawHeaders, normalizedHeaders } = findHeaderRowInRows(parsedRows);
      const hasHeaders = headerRowIndex !== -1;

      const dataRows = hasHeaders ? parsedRows.slice(headerRowIndex + 1) : parsedRows;

      const getColIndex = (aliases: string[], fallbackIndex: number): number => {
        if (!hasHeaders) return fallbackIndex;
        for (const alias of aliases) {
          const index = normalizedHeaders.indexOf(alias);
          if (index !== -1) return index;
        }
        for (const alias of aliases) {
          const index = normalizedHeaders.findIndex(h => h.includes(alias));
          if (index !== -1) return index;
        }
        return fallbackIndex;
      };

      const outputLog: string[] = [];
      let updatedCount = 0;
      let insertedCount = 0;
      
      const updatedProductsList = [...products];

      // Build Map indexes for lightning fast O(1) product lookups (prevents browser freezing on large lists)
      const codeToIndexMap = new Map<string, number>();
      const descToIndexMap = new Map<string, number>();

      updatedProductsList.forEach((p, idx) => {
        if (p.codigo) {
          codeToIndexMap.set(p.codigo, idx);
          const norm = normalizeProductCode(p.codigo);
          if (norm) codeToIndexMap.set(norm, idx);
        }
        if (p.descricao) {
          const normDesc = p.descricao.trim().toLowerCase();
          if (normDesc) descToIndexMap.set(normDesc, idx);
        }
      });

      if (activeImportType === 'EstoqueDiario') {
        const iCodigo = getColIndex(['codigo', 'cod', 'ean', 'produto', 'sku', 'codproduto', 'codigoitem'], 0);
        const iDescricao = getColIndex(['descricaomercadoria', 'descricao', 'mercadoria', 'desc', 'descricaomercadorias', 'nomeproduto'], 1);
        const iEmbalagem = getColIndex(['complemento', 'embalagem', 'emb', 'embalagens', 'compl', 'unidade', 'emb1'], 2);
        const iValorDisponivel = getColIndex(['valordisponivel', 'valor', 'valorestoque', 'preco', 'customedio', 'valordisponvel', 'vlrdisponivel'], 3);
        const iEstoque = getColIndex(['estoque', 'estoquetotal', 'caixa', 'emb1', 'unidade', 'emb9', 'saldo', 'qtd', 'quantidade'], 4);
        const iSemVenda = getColIndex(['diassemvenda', 'semvenda', 'diassemvendas', 'semvendas', 'diassemv'], 5);
        const iIdade = getColIndex(['idade', 'idadeestoque', 'diasestoque', 'idadeemdias'], 6);

        if (hasHeaders) {
          outputLog.push(`Cabeçalhos de Estoque identificados (Linha ${headerRowIndex+1}): Código (Col ${iCodigo+1}), Descrição (Col ${iDescricao+1}), Embalagem (Col ${iEmbalagem+1}), Valor Disponível (Col ${iValorDisponivel+1}), Estoque (Col ${iEstoque+1}), Sem Venda (Col ${iSemVenda+1}), Idade (Col ${iIdade+1}).`);
        } else {
          outputLog.push(`Nenhum cabeçalho explícito encontrado. Usando mapeamento de colunas padrão.`);
        }

        dataRows.forEach((cols) => {
          if (cols.length < 1) return;

          const rawCodigo = cols[iCodigo];
          if (!rawCodigo) return;
          const codigo = normalizeProductCode(rawCodigo);
          if (!codigo) return;

          const descricao = (cols[iDescricao] && cols[iDescricao] !== 'Sem descrição') ? cols[iDescricao] : '';
          const embalagem = cols[iEmbalagem] || 'UN';
          const rawEstoque = cols[iEstoque] || '';
          const estoque = Math.max(0, parseEstoqueString(rawEstoque));
          
          const rawValor = cols[iValorDisponivel] || '0';
          const valorDisponivel = Math.max(0, parseBrazilianFloat(rawValor));
          const custoMedio = estoque > 0 ? (valorDisponivel / estoque) : 0;
          const semVenda = Math.max(0, parseInt(cols[iSemVenda], 10) || 0);
          const idade = Math.max(0, parseInt(cols[iIdade], 10) || 0);

          let existingIndex = codeToIndexMap.get(codigo);
          if (existingIndex === undefined && descricao) {
            existingIndex = descToIndexMap.get(descricao.trim().toLowerCase());
          }

          if (existingIndex !== undefined) {
            const existing = updatedProductsList[existingIndex];
            const updated: Product = sanitizeProductIndustry({
              ...existing,
              codigo: existing.codigo || codigo,
              estoque,
              estoqueFormatado: rawEstoque.trim() || existing.estoqueFormatado,
              valorDisponivel,
              custoMedio,
              semVenda,
              idade,
              descricao: (descricao && (!existing.descricao || existing.descricao === 'Sem descrição' || descricao.length > existing.descricao.length)) ? descricao : existing.descricao,
              embalagem: (embalagem && embalagem !== 'UN') ? embalagem : existing.embalagem
            });
            updatedProductsList[existingIndex] = updated;
            updatedCount++;
          } else {
            // New product in daily sheet not found in Base Principal
            let foundCnpj = '';
            let foundNomeInd = 'Indústria Não Cadastrada';

            // Check if description hints at a known brand
            if (descricao) {
              const descUpper = descricao.toUpperCase();
              if (descUpper.includes('TOZZI')) {
                foundCnpj = '04.476.996/0001-67';
                foundNomeInd = 'TOZZI IND E COM DE ALIMENTOS LTDA';
              } else if (descUpper.includes('CEPERA') || descUpper.includes('CPA') || descUpper.includes('MOLHO INGLES CEPERA')) {
                foundCnpj = '43.208.624/0001-20';
                foundNomeInd = 'CEPERA IND E COM DE ALIMENTOS';
              } else if (descUpper.includes('YOKI')) {
                foundCnpj = '61.156.501/0001-56';
                foundNomeInd = 'YOKI / GENERAL MILLS';
              } else if (descUpper.includes('SEARA') || descUpper.includes('FRIBOI')) {
                foundCnpj = '02.916.265/0001-60';
                foundNomeInd = 'JBS S/A';
              } else if (descUpper.includes('SPATEN') || descUpper.includes('BRAHMA') || descUpper.includes('SKOL') || descUpper.includes('BUDWEISER')) {
                foundCnpj = '03.016.124/0001-50';
                foundNomeInd = 'AMBEV S/A';
              } else {
                const matchedSup = suppliers.find(s => s.nomeIndustria && s.nomeIndustria.length > 3 && descUpper.includes(s.nomeIndustria.split(' ')[0].toUpperCase()));
                if (matchedSup) {
                  foundCnpj = matchedSup.cnpjIndustria;
                  foundNomeInd = matchedSup.nomeIndustria;
                }
              }
            }

            const newProduct: Product = sanitizeProductIndustry({
              codigo,
              descricao: descricao || 'Produto sem descrição',
              embalagem,
              cnpjIndustria: foundCnpj,
              nomeIndustria: foundNomeInd,
              estoque,
              estoqueFormatado: rawEstoque.trim(),
              valorDisponivel,
              custoMedio,
              semVenda,
              idade
            });

            const newIdx = updatedProductsList.length;
            updatedProductsList.push(newProduct);
            codeToIndexMap.set(codigo, newIdx);
            const norm = normalizeProductCode(codigo);
            if (norm) codeToIndexMap.set(norm, newIdx);
            if (descricao) descToIndexMap.set(descricao.trim().toLowerCase(), newIdx);
            insertedCount++;
          }
        });

        outputLog.push(`Processamento de Estoque Diário concluído.`);
        outputLog.push(`Atualizados com sucesso: ${updatedCount} itens.`);
        if (insertedCount > 0) {
          outputLog.push(`Novos produtos catalogados no estoque: ${insertedCount} itens.`);
        }

      } else {
        // Base Principal: Fornecedor, Razão Social, Código, Descrição, Embalagem
        const fallbackMapping: MappingIndices = {
          iCnpj: getColIndex(['fornecedor', 'cnpj', 'cnpjdaindustria', 'cnpjfornecedor', 'forn', 'cnpjind'], 0),
          iNomeIndustria: getColIndex(['razaosocial', 'razao', 'nomedaindustria', 'nomeindustria', 'industria', 'empresa', 'fornecedornome'], 1),
          iCodigo: getColIndex(['codigo', 'cod', 'ean', 'produto', 'sku', 'codproduto'], 2),
          iDescricao: getColIndex(['descricao', 'descricaomercadoria', 'mercadoria', 'desc', 'nomeproduto'], 3),
          iEmbalagem: getColIndex(['embalagem', 'emb', 'embalagens', 'complemento', 'compl'], 4)
        };

        let finalMapping = fallbackMapping;
        if (!hasHeaders) {
          finalMapping = detectBasePrincipalColumns(dataRows, fallbackMapping);
        }

        const iCodigo = finalMapping.iCodigo;
        const iDescricao = finalMapping.iDescricao;
        const iEmbalagem = finalMapping.iEmbalagem;
        const iCnpj = finalMapping.iCnpj;
        const iNomeIndustria = finalMapping.iNomeIndustria;

        outputLog.push(`=> Mapeamento de Colunas da Base Principal:`);
        outputLog.push(`   Código: Coluna ${iCodigo >= 0 ? iCodigo + 1 : 'N/A'}`);
        outputLog.push(`   Descrição: Coluna ${iDescricao >= 0 ? iDescricao + 1 : 'N/A'}`);
        if (iEmbalagem >= 0) outputLog.push(`   Embalagem: Coluna ${iEmbalagem + 1}`);
        outputLog.push(`   CNPJ: Coluna ${iCnpj >= 0 ? iCnpj + 1 : 'N/A'}`);
        outputLog.push(`   Razão Social: Coluna ${iNomeIndustria >= 0 ? iNomeIndustria + 1 : 'N/A'}`);

        const updatedSuppliersList = [...suppliers];
        let newSuppliersCount = 0;

        dataRows.forEach((cols) => {
          if (cols.length < 1) return;

          const rawCodigo = iCodigo >= 0 ? cols[iCodigo] : '';
          if (!rawCodigo) return;
          const codigo = normalizeProductCode(rawCodigo);
          if (!codigo) return;

          const descricao = (iDescricao >= 0 && cols[iDescricao]) ? cols[iDescricao] : '';
          const embalagem = (iEmbalagem >= 0 && cols[iEmbalagem]) ? cols[iEmbalagem] : 'UN';
          const rawCnpj = iCnpj >= 0 ? cols[iCnpj] : '';
          const cnpj = formatCnpj(rawCnpj);
          const nomeIndustria = (iNomeIndustria >= 0 && cols[iNomeIndustria]) ? cols[iNomeIndustria] : 'Indústria Não Informada';

          // Auto register supplier if CNPJ is valid and not yet in suppliers list
          if (cnpj && cnpj.length >= 14 && setSuppliers) {
            const cleanCnpj = cnpj.replace(/[^\d]/g, '');
            const supplierExists = updatedSuppliersList.some(s => s.cnpjIndustria && s.cnpjIndustria.replace(/[^\d]/g, '') === cleanCnpj);
            if (!supplierExists) {
              updatedSuppliersList.push({
                cnpjIndustria: cnpj,
                nomeIndustria: (nomeIndustria && nomeIndustria !== 'Indústria Não Informada') ? nomeIndustria : `Indústria CNPJ ${cnpj}`,
                promotor: 'Sem Cadastro',
                agencia: 'Sem Cadastro',
                diasAtendimento: []
              });
              newSuppliersCount++;
            }
          }

          let existingIndex = codeToIndexMap.get(codigo);
          if (existingIndex === undefined && descricao) {
            existingIndex = descToIndexMap.get(descricao.trim().toLowerCase());
          }

          if (existingIndex !== undefined) {
            const existing = updatedProductsList[existingIndex];
            updatedProductsList[existingIndex] = sanitizeProductIndustry({
              ...existing,
              codigo: codigo,
              cnpjIndustria: (cnpj && cnpj.length >= 14) ? cnpj : (existing.cnpjIndustria || cnpj),
              nomeIndustria: (nomeIndustria && nomeIndustria !== 'Indústria Não Informada') ? nomeIndustria : (existing.nomeIndustria || nomeIndustria),
              descricao: (descricao && (!existing.descricao || existing.descricao === 'Sem descrição' || descricao.length > existing.descricao.length)) ? descricao : existing.descricao,
              embalagem: (embalagem && embalagem !== 'UN') ? embalagem : existing.embalagem
            });
            updatedCount++;
          } else {
            const newProduct: Product = sanitizeProductIndustry({
              codigo,
              descricao,
              embalagem,
              cnpjIndustria: cnpj,
              nomeIndustria,
              estoque: 0,
              valorDisponivel: 0,
              custoMedio: 0,
              semVenda: 0,
              idade: 0
            });

            const newIdx = updatedProductsList.length;
            updatedProductsList.push(newProduct);
            codeToIndexMap.set(codigo, newIdx);
            const norm = normalizeProductCode(codigo);
            if (norm) codeToIndexMap.set(norm, newIdx);
            if (descricao) descToIndexMap.set(descricao.trim().toLowerCase(), newIdx);
            insertedCount++;
          }
        });

        if (newSuppliersCount > 0 && setSuppliers) {
          setSuppliers(updatedSuppliersList);
          outputLog.push(`Fornecedores Mapeados: ${newSuppliersCount} novas indústrias cadastradas.`);
        }

        outputLog.push(`Cadastro Mestre Processado.`);
        outputLog.push(`Sucesso: ${insertedCount} novos produtos inseridos.`);
        if (updatedCount > 0) {
          outputLog.push(`Atualizados: ${updatedCount} produtos existentes com vínculos de CNPJ / Razão Social.`);
        }
      }

      // Save to React State & LocalStorage with deduplication
      setProducts(deduplicateProducts(updatedProductsList));

      const timestamp = new Date().toISOString();
      const fileNameUsed = fileNameCustom || (activeImportType === 'EstoqueDiario' ? 'estoque_venda_diaria.xlsx' : 'cadastro_mestre_produtos.xlsx');
      
      const newImportHistoryEntry: ImportHistoryEntry = {
        id: 'imp' + Date.now(),
        timestamp,
        usuario: currentUser.name,
        tipo: activeImportType,
        nomeArquivo: fileNameUsed,
        totalLinhas: dataRows.length,
        sucesso: true
      };

      setImpHistory([newImportHistoryEntry, ...impHistory]);
      onUpdateStats(timestamp);

      setImportLog({
        status: 'success',
        message: activeImportType === 'EstoqueDiario' 
          ? `Sucesso: Sincronização diária concluída! ${updatedCount} estoques atualizados, ${insertedCount} novos.`
          : `Sucesso: Cadastro mestre processado! ${insertedCount} novos produtos inseridos e ${updatedCount} atualizados.`,
        details: outputLog
      });

      // Clear paste input
      setPasteData('');

    } catch (err: any) {
      console.error('Import error:', err);
      setImportLog({
        status: 'error',
        message: `Falha ao processar a importação: ${err.message || 'Formato de planilha incompreensível'}`
      });
    }
  };

  const handleParseImport = () => {
    executeImportData(pasteData, importType);
  };

  const handleClearHistory = () => {
    if (confirm('Deseja realmente limpar todo o histórico de transações de importação?')) {
      setImpHistory([]);
    }
  };

  return (
    <div className="space-y-6" id="import-tab">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 font-display">Central de Importação de Planilhas</h2>
        <p className="text-xs text-gray-500 mt-1">
          Alimente a Base Principal de produtos ou realize o balanço diário de estoque copiando e colando colunas diretamente do Excel.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Step-by-step & Paste Area */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
          
          {/* Setup selector tab */}
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            <button
              onClick={() => {
                setImportType('EstoqueDiario');
                setImportLog({ status: 'idle', message: '' });
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                importType === 'EstoqueDiario' 
                  ? 'bg-[#F2F2F2] text-[#F58220] shadow-sm font-black' 
                  : 'text-gray-500 hover:text-[#2F2F2F]'
              }`}
            >
              <UploadCloud className="w-4 h-4" /> Importar Estoque Diário
            </button>
            <button
              onClick={() => {
                setImportType('BasePrincipal');
                setImportLog({ status: 'idle', message: '' });
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                importType === 'BasePrincipal' 
                  ? 'bg-[#F2F2F2] text-[#F58220] shadow-sm font-black' 
                  : 'text-gray-500 hover:text-[#2F2F2F]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" /> Importar Base Principal (Catálogo)
            </button>
          </div>

          {/* Admin Block Verification */}
          {!isAdmin && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <div className="text-xs">
                <strong className="font-bold block">Acesso Restrito: Somente Administrador</strong>
                Seu usuário atual possui apenas o papel de <strong>{currentUser.role}</strong>. Você pode simular a consulta de relatórios e dados, mas o processamento de planilhas de importação está desativado para o seu perfil. Utilize o alternador de perfis no cabeçalho.
              </div>
            </div>
          )}

          {/* Active Area explanation alert */}
          <div className="flex gap-3 bg-[#F3F4F6] p-4 rounded-xl text-xs text-gray-600 border">
            <Info className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
            <div>
              {importType === 'EstoqueDiario' ? (
                <span>
                  <strong>Importação Diária de Estoque</strong>: Atualiza as colunas de <strong>Estoque</strong> (com suporte a formatos complexos), <strong>Valor Disponível</strong>, <strong>SemVenda</strong> e <strong>Idade</strong> de códigos existentes. Códigos desconhecidos inseridos herdarão promotores mapeados por indústria automaticamente.
                </span>
              ) : (
                <span>
                  <strong>Importação da Base Principal (Cadastro)</strong>: Adiciona novas linhas de produtos industriais e seus respectivos CNPJs ao catálogo. Conforme as regras operacionais da filial, novos cadastred códigos ID nunca substituem os já existentes.
                </span>
              )}
            </div>
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-[#F58220]" /> Importar de Arquivo de Planilha (Excel ou CSV):
            </label>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => isAdmin && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                dragActive 
                  ? 'border-[#F58220] bg-[#F58220]/5 shadow-inner' 
                  : 'border-gray-200 hover:border-[#F58220]/50 bg-gray-50/50 hover:bg-gray-50'
              } ${!isAdmin ? 'opacity-55 cursor-not-allowed' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInput}
                accept=".xlsx, .xls, .csv"
                className="hidden"
                disabled={!isAdmin}
              />
              
              <div className="p-3 bg-white rounded-full shadow-xs border border-gray-100">
                <FileSpreadsheet className="w-6 h-6 text-[#F58220]" />
              </div>
              
              <div className="text-xs leading-relaxed">
                {isAdmin ? (
                  <>
                    <p className="font-bold text-gray-700">
                      Arraste e solte o arquivo aqui ou <span className="text-[#F58220] underline font-extrabold">clique para selecionar</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">
                      Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou texto formatado (.csv)
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 font-medium">Faça login como Administrador para habilitar a importação de planilhas.</p>
                )}
              </div>
            </div>
          </div>

          {/* Clipboard Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">Cole a tabela copiada do seu Excel:</label>
              <div className="flex gap-2">
                <button
                  onClick={handlePreFill}
                  disabled={!isAdmin}
                  className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 text-[10px] uppercase font-mono font-bold tracking-wider rounded-lg flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3 text-[#F58220]" /> Preencher Exemplo
                </button>
              </div>
            </div>

            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              disabled={!isAdmin}
              rows={8}
              className="w-full font-mono text-[11px] p-4 border rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 disabled:opacity-60 text-gray-800"
              placeholder={
                importType === 'EstoqueDiario'
                  ? 'Abra o Excel, copie colunas Código / Descrição / Embalagem / Estoque / Valor Disponível / SemVenda / Idade e cole aqui...'
                  : 'Abra a listagem de mercadorias no Excel, copie colunas Código / Descrição / Embalagem / CNPJ Indústria / Nome Indústria e cole aqui...'
              }
            />
          </div>

          {/* Run parsing button */}
          <div className="flex justify-end gap-3">
            {pasteData && (
              <button
                onClick={() => setPasteData('')}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
              >
                Limpar Texto
              </button>
            )}
            <button
              onClick={handleParseImport}
              disabled={!isAdmin || !pasteData.trim()}
              className="px-6 py-2.5 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl text-xs font-black shadow-md shadow-[#F58220]/15 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" /> Importar e Sincronizar
            </button>
          </div>

          {/* Dynamic feedback logs alert panel */}
          {importLog.status !== 'idle' && (
            <div className={`p-4 rounded-xl border ${
              importLog.status === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              <div className="flex items-start gap-2.5">
                {importLog.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div className="text-xs space-y-1">
                  <p className="font-bold">{importLog.message}</p>
                  {importLog.details && importLog.details.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5 mt-2 text-[11px] text-gray-600 font-mono">
                      {importLog.details.map((d, index) => (
                        <li key={index}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar help, format specifications and Import History log */}
        <div className="space-y-6">
          
          {/* Delimiter formats helper Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 font-display">
              <HelpCircle className="w-4 h-4 text-[#F58220]" /> Estrutura do Excel
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              O importador reconhecerá automaticamente planilhas do Excel (.xlsx, .xls) e arquivos CSV enviados por drag-and-drop ou selecionados diretamente, além do método tradicional de copiar e colar dados da tabela.
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border text-[11px] font-mono text-gray-600 space-y-1">
              <div className="font-bold text-[#F58220]">Colunas de Estoque:</div>
              <p>Código | Descrição | Embalagem | Estoque | Valor Disponível | SemVenda | Idade</p>
              <div className="mt-2 font-bold text-[#F58220]">Colunas de Cadastro:</div>
              <p>Código | Descrição | Embalagem | CNPJ | Nome Indústria</p>
            </div>
          </div>

          {/* Import Historics Log Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 font-display">
                  <History className="w-4 h-4 text-[#F58220]" /> Log de Operações
                </h3>
                {impHistory.length > 0 && isAdmin && (
                  <button 
                    onClick={handleClearHistory}
                    className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5 font-sans font-bold"
                  >
                    <Trash2 className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {impHistory.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-400">Nenhuma importação registrada.</p>
                ) : (
                  impHistory.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 border rounded-lg hover:border-gray-300 transition-all text-xs">
                      <div className="flex justify-between items-start">
                        <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase rounded-md ${
                          item.tipo === 'EstoqueDiario' ? 'bg-[#F58220]/10 text-[#F58220]' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {item.tipo === 'EstoqueDiario' ? 'Estoque Diário' : 'Base Mestre'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono font-bold">
                          {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-gray-800 mt-1.5 truncate">{item.nomeArquivo}</p>
                      <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                        <span>Lins: <strong className="font-bold text-gray-700 font-mono">{item.totalLinhas}</strong></span>
                        <span className="truncate">Por: <strong className="font-bold font-sans text-gray-600">{item.usuario.split(' ')[0]}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
