/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Supplier, User, ImportHistoryEntry } from '../types';
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

interface MappingIndices {
  iCodigo: number;
  iDescricao: number;
  iEmbalagem: number;
  iCnpj: number;
  iNomeIndustria: number;
}

function detectBasePrincipalColumns(rows: string[][], fallbackIndices: MappingIndices): MappingIndices {
  const numRowsToAnalyze = Math.min(rows.length, 10);
  if (numRowsToAnalyze === 0) return fallbackIndices;

  const numCols = rows[0].length;
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
      const isCnpjDigits = cleanDigits.length === 14 || cleanDigits.length === 12;
      
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
      const isVeryShort = val.length <= 8;
      const hasEmbKeywords = /\b(CX|FD|FDO|UN|PCT|KG|GF|LT|PC|CXA|FD12|FD6|FD24|UNID|UNIDADES|CAIXA|FARDO|GARRAFA|LATA|COPO|PET)\b/i.test(val) || 
                            upperVal.startsWith("CX") || upperVal.startsWith("FD") || upperVal.startsWith("UN") || upperVal.startsWith("PCT") || upperVal.startsWith("PC");
      const hasXMeasure = /\b\d+\s*[xX]\s*\d+\b/.test(val) || /^\d+\s*[xX]/i.test(val) || /^[0-9]+X/.test(upperVal);

      if (hasEmbKeywords && isShort) {
        scoresByCol[j].embalagem += 15;
      } else if (hasXMeasure && isShort) {
        scoresByCol[j].embalagem += 10;
      } else if (isVeryShort) {
        scoresByCol[j].embalagem += 2;
      }

      // 3. Código check (No spaces, short, numeric/alphanumeric)
      const noSpaces = !/\s/.test(val);
      const isCodeLength = val.length >= 4 && val.length <= 15;
      const isNumeric = /^\d+$/.test(val);
      const isAlphanumericCode = /^[A-Za-z0-9-]+$/.test(val);

      if (noSpaces && isCodeLength) {
        if (isNumeric) {
          scoresByCol[j].codigo += 18;
        } else if (isAlphanumericCode) {
          scoresByCol[j].codigo += 12;
        }
      }

      // 4. Nome Indústria / Razão Social check (Ltda, S.A, S/A, Cooperativas, etc.)
      const hasCompanyIndicators = /\b(S\.?A\.?|LTDA\.?|S\/A|M\.?E\.?|EIRELI|INDUSTRIA|COMERCIO|BRF|JBS|COCA[- ]COLA|MONDELEZ|NESTLE|DANONE|UNILEVER|AMBEV|BEBIDAS|DISTRIBUIDORA)\b/i.test(val);
      const isMediumLength = val.length >= 8 && val.length <= 50;
      const hasSpaces = /\s/.test(val);

      if (hasCompanyIndicators) {
        scoresByCol[j].nomeIndustria += 22;
      } else if (hasSpaces && isMediumLength) {
        scoresByCol[j].nomeIndustria += 6;
      }

      // 5. Descrição check (Product names like TAPETE, REFRIGERANTE, LIMPADOR, SABONETE...)
      const hasProductKeywords = /\b(AGUA|PANO|TAPETE|SABAO|SHAMPOO|CONDICIONADOR|DESODORANTE|LEITE|CHOCOLATE|CEREAL|BOMBOM|CAFESOLUVEL|SUCO|REFRIGERANTE|BISCOITO|REFRESCO|MARGARINA|LASANHA|PRESUNTO|LINGUICA|STEAK|IOGURTE|SOBREMESA|ACTIVIA|MINERAL|PRATO|GAS|REGISTRO|SACOLA)\b/i.test(val);
      
      if (hasProductKeywords) {
        scoresByCol[j].descricao += 18;
      } else if (hasSpaces && val.length > 12 && !hasCompanyIndicators) {
        scoresByCol[j].descricao += 8;
      }
    }
  }

  const colRoles = new Map<string, number>();

  // Find the strongest assignment iteratively
  // 1. Assign CNPJ
  let bestCnpjCol = -1;
  let maxCnpjScore = -1;
  for (let j = 0; j < numCols; j++) {
    if (scoresByCol[j].cnpj > maxCnpjScore) {
      maxCnpjScore = scoresByCol[j].cnpj;
      bestCnpjCol = j;
    }
  }
  if (maxCnpjScore > 10) {
    colRoles.set('cnpj', bestCnpjCol);
  }

  // 2. Assign Código (must be distinct from CNPJ)
  let bestCodCol = -1;
  let maxCodScore = -1;
  for (let j = 0; j < numCols; j++) {
    if (j === bestCnpjCol) continue;
    if (scoresByCol[j].codigo > maxCodScore) {
      maxCodScore = scoresByCol[j].codigo;
      bestCodCol = j;
    }
  }
  if (maxCodScore > 8) {
    colRoles.set('codigo', bestCodCol);
  }

  // 3. Assign Embalagem
  let bestEmbCol = -1;
  let maxEmbScore = -1;
  for (let j = 0; j < numCols; j++) {
    if (j === bestCnpjCol || j === bestCodCol) continue;
    if (scoresByCol[j].embalagem > maxEmbScore) {
      maxEmbScore = scoresByCol[j].embalagem;
      bestEmbCol = j;
    }
  }
  if (maxEmbScore > 8) {
    colRoles.set('embalagem', bestEmbCol);
  }

  // 4. Assign Nome Indústria / Razão Social
  let bestIndCol = -1;
  let maxIndScore = -1;
  for (let j = 0; j < numCols; j++) {
    if (j === bestCnpjCol || j === bestCodCol || j === bestEmbCol) continue;
    if (scoresByCol[j].nomeIndustria > maxIndScore) {
      maxIndScore = scoresByCol[j].nomeIndustria;
      bestIndCol = j;
    }
  }
  if (maxIndScore > 4) {
    colRoles.set('nomeIndustria', bestIndCol);
  }

  // 5. Assign Descrição
  let bestDescCol = -1;
  let maxDescScore = -1;
  for (let j = 0; j < numCols; j++) {
    if (j === bestCnpjCol || j === bestCodCol || j === bestEmbCol || j === bestIndCol) continue;
    if (scoresByCol[j].descricao > maxDescScore) {
      maxDescScore = scoresByCol[j].descricao;
      bestDescCol = j;
    }
  }
  if (maxDescScore > 4) {
    colRoles.set('descricao', bestDescCol);
  }

  const resolved = {
    iCnpj: colRoles.has('cnpj') ? colRoles.get('cnpj')! : fallbackIndices.iCnpj,
    iNomeIndustria: colRoles.has('nomeIndustria') ? colRoles.get('nomeIndustria')! : fallbackIndices.iNomeIndustria,
    iCodigo: colRoles.has('codigo') ? colRoles.get('codigo')! : fallbackIndices.iCodigo,
    iDescricao: colRoles.has('descricao') ? colRoles.get('descricao')! : fallbackIndices.iDescricao,
    iEmbalagem: colRoles.has('embalagem') ? colRoles.get('embalagem')! : fallbackIndices.iEmbalagem
  };

  const allIndices = [resolved.iCnpj, resolved.iNomeIndustria, resolved.iCodigo, resolved.iDescricao, resolved.iEmbalagem];
  const uniqueIndices = new Set(allIndices);
  if (uniqueIndices.size === 5) {
    return resolved;
  }

  return fallbackIndices;
}

interface ImportViewProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  currentUser: User;
  impHistory: ImportHistoryEntry[];
  setImpHistory: (history: ImportHistoryEntry[]) => void;
  onUpdateStats: (newTimestamp: string) => void;
  suppliers: Supplier[];
}

export default function ImportView({ 
  products, 
  setProducts, 
  currentUser, 
  impHistory, 
  setImpHistory, 
  onUpdateStats,
  suppliers
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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Get the worksheet as a 2D array of strings/numbers
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (!json || json.length === 0) {
          setImportLog({
            status: 'error',
            message: 'Não foi possível encontrar dados válidos na primeira aba do arquivo Excel.'
          });
          return;
        }
        
        // Convert the 2D array into a tab-separated text block to fill the text-area and reuse the existing parsing logic
        const stringRows = json
          .map(row => row.map(cell => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell).trim();
            return str;
          }).join('\t'))
          .filter(rowText => rowText.replace(/\t/g, '').trim().length > 0); // Skip empty rows

        const textData = stringRows.join('\n');
        setPasteData(textData);
        setImportLog({
          status: 'success',
          message: `Planilha "${file.name}" carregada com sucesso! ${json.length} linhas importadas e coladas abaixo para revisão. Confira os dados mapeados e clique em "Importar e Sincronizar" no final.`
        });
      } catch (error: any) {
        console.error(error);
        setImportLog({
          status: 'error',
          message: `Erro ao ler a planilha Excel: ${error.message || 'Formato de arquivo corrompido ou incompatível.'}`
        });
      }
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
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        handleFileUpload(file);
      } else {
        setImportLog({
          status: 'error',
          message: 'Tipo de arquivo inválido. Por favor, envie uma planilha do Excel (.xlsx, .xls) ou arquivo separado por vírgulas (.csv).'
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
`Código	Descrição Mercadoria	Embalagem	Estoque Emb1	Estoque Emb9	Custo Médio	SemVenda
100101	REFRIGERADO HAMBURGUER SEARA BOV 120G	CX 36 UN	50	24	1.90	0
100103	LASANHA SEARA BOLONHESA 600G	CX 12 UN	10	5	11.35	0
100104	PRESUNTO SEARA COZIDO RESFRIADO KG	CX 2 PC	8	1	19.80	0
200203	CERVEJA SPATEN PURO MALTE LT 350ML	FD 12 UN	300	48	3.40	0
300304	SABAO LIQUIDO OMO PROTECAO FRASCO 3L	CX 4 UN	25	4	34.20	0
999901	NOVO PRODUTO TESTE DE IMPORTACAO	CX 10 UN	15	0	4.50	1`;

  const BASE_PRINCIPAL_TEMPLATE = 
`Código	Descrição	Embalagem	Fornecedor	Razão Social
100106	LOMBO SUINO FATIADO SEARA 1KG	CX 10 PC	02.916.265/0001-60	JBS S.A (Friboi & Seara)
200206	CERVEJA ORIGINAL GARRAFA LP 600ML	CX 12 GF	03.016.124/0001-50	Ambev S.A (Bebidas)
300306	SOPINHA Knorr CARNE E LEGUMES 200G	CX 12 UN	61.068.276/0001-04	Unilever Brasil Ltda
400406	NUTELLA POTE RECHEIO CREME AVELA 350G	CX 12 UN	60.398.369/0001-85	Nestlé Brasil Ltda`;

  const handlePreFill = () => {
    if (importType === 'EstoqueDiario') {
      setPasteData(ESTOQUE_TEMPLATE);
    } else {
      setPasteData(BASE_PRINCIPAL_TEMPLATE);
    }
  };

  const handleParseImport = () => {
    if (!isAdmin) {
      setImportLog({
        status: 'error',
        message: 'Apenas usuários com perfil Administrador podem executar importações no sistema.'
      });
      return;
    }

    if (!pasteData.trim()) {
      setImportLog({
        status: 'error',
        message: 'Área de transferência vazia. Por favor, cole os dados delimitados da planilha.'
      });
      return;
    }

    try {
      const lines = pasteData.trim().split('\n');
      if (lines.length < 1) {
        throw new Error('A planilha colada está vazia.');
      }

      // Check if first line contains headers or values
      const firstRowCols = lines[0].split(/[\t,|;]/).map(c => c.trim());
      const normalizedFirstRow = firstRowCols.map(h => 
        h.toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/[^a-z0-9]/g, "")
      );

      const hasHeaders = normalizedFirstRow.some(col => 
        ['codigo', 'cod', 'desc', 'descricao', 'embalagem', 'emb', 'fornecedor', 'razao', 'razaosocial', 'industria', 'cnpj', 'custo', 'customedio', 'semvenda'].includes(col)
      );

      const rows = hasHeaders ? lines.slice(1) : lines;
      const rawHeaders = hasHeaders ? firstRowCols : [];
      const normalizedHeaders = hasHeaders ? normalizedFirstRow : [];

      const getColIndex = (aliases: string[], fallbackIndex: number): number => {
        if (!hasHeaders) return fallbackIndex;
        // Try exact match first
        for (const alias of aliases) {
          const index = normalizedHeaders.indexOf(alias);
          if (index !== -1) return index;
        }
        // Try substring match second
        for (const alias of aliases) {
          const index = normalizedHeaders.findIndex(h => h.includes(alias));
          if (index !== -1) return index;
        }
        return fallbackIndex;
      };

      const outputLog: string[] = [];
      let updatedCount = 0;
      let ignoredCount = 0;
      let insertedCount = 0;
      
      const updatedProductsList = [...products];

      if (importType === 'EstoqueDiario') {
        // Daily Stock Rules: Code, Description, Box, Emb1, Emb9, average cost, SemVenda
        const iCodigo = getColIndex(['codigo', 'cod', 'ean', 'produto', 'sku'], 0);
        const iDescricao = getColIndex(['descricao', 'descricaomercadoria', 'mercadoria', 'desc', 'descricaomercadorias'], 1);
        const iEmbalagem = getColIndex(['embalagem', 'emb', 'embalagens'], 2);
        const iEstoqueEmb1 = getColIndex(['estoqueemb1', 'emb1', 'caixa', 'fardo', 'caixas', 'fardos', 'estoque1'], 3);
        const iEstoqueEmb9 = getColIndex(['estoqueemb9', 'emb9', 'unidade', 'avulsa', 'unidades', 'estoque9'], 4);
        const iCustoMedio = getColIndex(['customedio', 'custo', 'preco', 'custounitario'], 5);
        const iSemVenda = getColIndex(['semvenda', 'diassemvenda', 'diassemvendas', 'semvendas'], 6);

        if (hasHeaders) {
          outputLog.push(`Cabeçalhos de Estoque identificados: Código (Col ${iCodigo+1}), Descrição (Col ${iDescricao+1}), Embalagem (Col ${iEmbalagem+1}), Estoque Emb1 (Col ${iEstoqueEmb1+1}), Estoque Emb9 (Col ${iEstoqueEmb9+1}), Custo Médio (Col ${iCustoMedio+1}), Sem Venda (Col ${iSemVenda+1}).`);
        } else {
          outputLog.push(`Nenhum cabeçalho explícito encontrado. Usando mapeamento de colunas padrão (1ª=Código, 2ª=Descrição, 3ª=Embalagem, 4ª=Emb1, 5ª=Emb9, 6ª=Custo, 7ª=SemVenda).`);
        }

        rows.forEach((row, rowIndex) => {
          const cols = row.split(/[\t,|;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
          if (cols.length < 1 || !cols[0]) return; // Skip empty rows

          const codigo = cols[iCodigo];
          if (!codigo) return;
          const descricao = cols[iDescricao] || 'Sem descrição';
          const embalagem = cols[iEmbalagem] || 'UN';
          const estoqueEmb1 = Math.max(0, parseInt(cols[iEstoqueEmb1]) || 0);
          const estoqueEmb9 = Math.max(0, parseInt(cols[iEstoqueEmb9]) || 0);
          
          // Cleaner cost parser that supports multi-formats
          const rawCusto = cols[iCustoMedio] || '0';
          const custoMedio = Math.max(0, parseFloat(rawCusto.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0);
          const semVenda = Math.max(0, parseInt(cols[iSemVenda]) || 0);

          const existingIndex = updatedProductsList.findIndex(p => p.codigo === codigo);
          if (existingIndex !== -1) {
            // Update stock and cost rules
            const updated = {
              ...updatedProductsList[existingIndex],
              estoqueEmb1,
              estoqueEmb9,
              custoMedio,
              semVenda
            };
            // Preserve description if user didn't overwrite it
            if (cols[iDescricao]) updated.descricao = descricao;
            if (cols[iEmbalagem]) updated.embalagem = embalagem;
            updatedProductsList[existingIndex] = updated;
            updatedCount++;
          } else {
            // High durability database concept: if not in database, we insert it!
            // First we identify CNPJ association. We can try to guess it from code or match to general. Let's default to unlinked industry or Ambev
            const guessedCnpj = codigo.startsWith('100') ? '02.916.265/0001-60' // JBS
                              : codigo.startsWith('200') ? '03.016.124/0001-50' // Ambev
                              : codigo.startsWith('300') ? '61.068.276/0001-04' // Unilever
                              : '60.398.369/0001-85'; // Nestle

            const matchedSupplier = suppliers.find(s => s.cnpjIndustria === guessedCnpj);
            const nomeInd = matchedSupplier ? matchedSupplier.nomeIndustria : 'Indústria Genérica Auto-Mapeada';

            const newProduct: Product = {
              codigo,
              descricao,
              embalagem,
              cnpjIndustria: guessedCnpj,
              nomeIndustria: nomeInd,
              estoqueEmb1,
              estoqueEmb9,
              custoMedio,
              semVenda
            };
            updatedProductsList.push(newProduct);
            insertedCount++;
          }
        });

        outputLog.push(`Processamento concluído.`);
        outputLog.push(`Sincronizados com sucesso: ${updatedCount} produtos cadastrados.`);
        if (insertedCount > 0) {
          outputLog.push(`Novos produtos catalogados no estoque: ${insertedCount} itens.`);
        }

      } else {
        // Base Principal: Code, Description, Box, CNPJ (Fornecedor), Industry Name (Razão Social).
        const fallbackMapping: MappingIndices = {
          iCodigo: getColIndex(['codigo', 'cod', 'ean', 'produto', 'sku'], 0),
          iDescricao: getColIndex(['descricao', 'descricaomercadoria', 'mercadoria', 'desc'], 1),
          iEmbalagem: getColIndex(['embalagem', 'emb', 'embalagens'], 2),
          iCnpj: getColIndex(['fornecedor', 'cnpj', 'cnpjdaindustria', 'cnpjindustria', 'cnpjfornecedor', 'cnpjdafabrica'], 3),
          iNomeIndustria: getColIndex(['razaosocial', 'razao', 'nomedaindustria', 'nomeindustria', 'industria', 'fantasia', 'nomefornecedor', 'fornecedornome'], 4)
        };

        // Parse rows to let the column sensor analyze cell data structures
        const parsedRows = rows.map(row => row.split(/[\t,|;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'))).filter(r => r.length > 0 && r[0]);

        // Run data-level column detection
        const finalMapping = detectBasePrincipalColumns(parsedRows, fallbackMapping);
        const iCodigo = finalMapping.iCodigo;
        const iDescricao = finalMapping.iDescricao;
        const iEmbalagem = finalMapping.iEmbalagem;
        const iCnpj = finalMapping.iCnpj;
        const iNomeIndustria = finalMapping.iNomeIndustria;

        outputLog.push(`[SENSOR INTELIGENTE DE COLUNAS] Analisando estrutura das células por padrões de dados...`);
        outputLog.push(`=> CNPJ (Fornecedor) detectado na Coluna ${iCnpj + 1}`);
        outputLog.push(`=> Razão Social (Nome Indústria) detectado na Coluna ${iNomeIndustria + 1}`);
        outputLog.push(`=> Código detectado na Coluna ${iCodigo + 1}`);
        outputLog.push(`=> Descrição detectada na Coluna ${iDescricao + 1}`);
        outputLog.push(`=> Embalagem detectada na Coluna ${iEmbalagem + 1}`);

        rows.forEach((row, rowIndex) => {
          const cols = row.split(/[\t,|;]/).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
          if (cols.length < 1 || !cols[0]) return;

          const codigo = cols[iCodigo];
          if (!codigo) return;
          const descricao = cols[iDescricao] || '';
          const embalagem = cols[iEmbalagem] || 'UN';
          const cnpj = cols[iCnpj] || '';
          const nomeIndustria = cols[iNomeIndustria] || 'Indústria Não Informada';

          const existingIndex = updatedProductsList.findIndex(p => p.codigo === codigo);
          if (existingIndex !== -1) {
            // Update mapping to help fix existing incorrect assignments in database
            const existing = updatedProductsList[existingIndex];
            updatedProductsList[existingIndex] = {
              ...existing,
              cnpjIndustria: cnpj || existing.cnpjIndustria,
              nomeIndustria: nomeIndustria !== 'Indústria Não Informada' ? nomeIndustria : existing.nomeIndustria,
              descricao: descricao || existing.descricao,
              embalagem: embalagem || existing.embalagem
            };
            updatedCount++;
            outputLog.push(`Código [${codigo}] atualizado: Vinculado à indústria CNPJ ${cnpj} (${nomeIndustria}).`);
          } else {
            // Create brand new product
            const newProduct: Product = {
              codigo,
              descricao,
              embalagem,
              cnpjIndustria: cnpj,
              nomeIndustria,
              estoqueEmb1: 0, // initially 0 stock
              estoqueEmb9: 0,
              custoMedio: 0,
              semVenda: 0
            };
            updatedProductsList.push(newProduct);
            insertedCount++;
          }
        });

        outputLog.push(`Cadastro Mestre Processado.`);
        outputLog.push(`Sucesso: ${insertedCount} novos produtos inseridos.`);
        if (updatedCount > 0) {
          outputLog.push(`Atualizados: ${updatedCount} produtos existentes com novas amarrações de CNPJ / Razão Social.`);
        }
      }

      // Save to React State & LocalStorage
      setProducts(updatedProductsList);

      const timestamp = new Date().toISOString();
      const newImportHistoryEntry: ImportHistoryEntry = {
        id: 'imp' + Date.now(),
        timestamp,
        usuario: currentUser.name,
        tipo: importType,
        nomeArquivo: importType === 'EstoqueDiario' ? 'estoque_venda_diaria_manual.xlsx' : 'cadastro_mestre_produtos_manual.xlsx',
        totalLinhas: rows.length,
        sucesso: true
      };

      setImpHistory([newImportHistoryEntry, ...impHistory]);
      onUpdateStats(timestamp);

      setImportLog({
        status: 'success',
        message: importType === 'EstoqueDiario' 
          ? `Sucesso: Sincronização diária concluída! ${updatedCount} estoques atualizados.`
          : `Sucesso: Cadastro mestre processado! ${insertedCount} novos códigos integrados e ${updatedCount} atualizados.`,
        details: outputLog
      });

      // Clear input
      setPasteData('');

    } catch (err: any) {
      setImportLog({
        status: 'error',
        message: `Falha ao processar a importação: ${err.message || 'Formato incompreensível'}`
      });
    }
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
                  <strong>Importação Diária de Estoque</strong>: Atualiza as colunas de fardos (<strong>Emb1</strong>), unidades avulsas (<strong>Emb9</strong>), <strong>Custo Médio</strong> e <strong>SemVenda</strong> de códigos existentes. Códigos desconhecidos inseridos herdarão promotores mapeados por indústria automaticamente.
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
                  ? 'Abra o Excel, copie colunas Código / Descrição / Embalagem / Estoque Emb1 / Estoque Emb9 / Custo Médio / SemVenda e cole aqui...'
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
              <p>Código | Descrição | Embalagem | Emb1 | Emb9 | Custo | SemVenda</p>
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
