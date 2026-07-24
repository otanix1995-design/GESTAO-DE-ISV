/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Supplier, Promoter, Agency, SupplierHistoryEntry, ImportHistoryEntry, Role, User, SystemStats } from './types';
import { saveIDB } from './idb';

// Single official user for Filial 172 Cascavel
export const TEST_USERS: User[] = [
  { 
    id: '1', 
    name: 'Atacadão Filial 172 Cascavel', 
    role: 'Admin', 
    email: 'atacadaocascavel@atacadao.com',
    password: 'filial@172'
  }
];

/// Initial Agencies
export const INITIAL_AGENCIES: Agency[] = [];

// Initial Promoters
export const INITIAL_PROMOTERS: Promoter[] = [];

// Initial Suppliers
export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    cnpjIndustria: '02.916.265/0001-60',
    nomeIndustria: 'JBS S/A',
    promotor: 'Sem Cadastro',
    agencia: 'Sem Cadastro',
    diasAtendimento: ['Segunda', 'Quarta', 'Sexta']
  },
  {
    cnpjIndustria: '03.016.124/0001-50',
    nomeIndustria: 'AMBEV S/A',
    promotor: 'Sem Cadastro',
    agencia: 'Sem Cadastro',
    diasAtendimento: ['Terça', 'Quinta']
  },
  {
    cnpjIndustria: '61.068.276/0001-04',
    nomeIndustria: 'UNILEVER BRASIL',
    promotor: 'Sem Cadastro',
    agencia: 'Sem Cadastro',
    diasAtendimento: ['Segunda', 'Sexta']
  },
  {
    cnpjIndustria: '60.398.369/0001-85',
    nomeIndustria: 'NESTLÉ BRASIL',
    promotor: 'Sem Cadastro',
    agencia: 'Sem Cadastro',
    diasAtendimento: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
  }
];

// Initial Master Product Base (Base Principal)
export const INITIAL_PRODUCTS: Product[] = [];

// Initial Supplier Edit History
export const INITIAL_SUPPLIER_HISTORY: SupplierHistoryEntry[] = [];

// Initial Import History
export const INITIAL_IMPORT_HISTORY: ImportHistoryEntry[] = [];

// LocalStorage key constants
const KEYS = {
  PRODUCTS: 'atacao_products',
  SUPPLIERS: 'atacao_suppliers',
  PROMOTERS: 'atacao_promoters',
  AGENCIES: 'atacao_agencies',
  SUP_HISTORY: 'atacao_sup_history',
  IMP_HISTORY: 'atacao_imp_history',
  CURRENT_USER: 'atacao_current_user',
  LAST_UPDATE_TIME: 'atacao_last_update_time'
};

// State initialization that reads from localStorage or falls back to initials
export function getSavedData() {
  if (typeof window === 'undefined') {
    return {
      products: INITIAL_PRODUCTS,
      suppliers: INITIAL_SUPPLIERS,
      promoters: INITIAL_PROMOTERS,
      agencies: INITIAL_AGENCIES,
      supHistory: INITIAL_SUPPLIER_HISTORY,
      impHistory: INITIAL_IMPORT_HISTORY,
      currentUser: TEST_USERS[0],
      lastUpdateTime: '2026-06-04T07:30:00Z'
    };
  }

  const load = <T>(key: string, backup: T): T => {
    const raw = localStorage.getItem(key);
    try {
      if (!raw || raw === 'undefined' || raw === 'null') return backup;
      const parsed = JSON.parse(raw);
      if (!parsed) return backup;
      return parsed;
    } catch {
      return backup;
    }
  };

  const products = load<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  const suppliers = load<Supplier[]>(KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
  const promoters = load<Promoter[]>(KEYS.PROMOTERS, INITIAL_PROMOTERS);
  const agencies = load<Agency[]>(KEYS.AGENCIES, INITIAL_AGENCIES);
  const supHistory = load<SupplierHistoryEntry[]>(KEYS.SUP_HISTORY, INITIAL_SUPPLIER_HISTORY);
  const impHistory = load<ImportHistoryEntry[]>(KEYS.IMP_HISTORY, INITIAL_IMPORT_HISTORY);
  const currentUser = load<User>(KEYS.CURRENT_USER, TEST_USERS[0]);
  const lastUpdateTime = localStorage.getItem(KEYS.LAST_UPDATE_TIME) || '2026-06-04T07:30:00Z';

  return {
    products: Array.isArray(products) && products.length > 0 ? products : INITIAL_PRODUCTS,
    suppliers: Array.isArray(suppliers) ? suppliers : INITIAL_SUPPLIERS,
    promoters: Array.isArray(promoters) ? promoters : INITIAL_PROMOTERS,
    agencies: Array.isArray(agencies) ? agencies : INITIAL_AGENCIES,
    supHistory: Array.isArray(supHistory) ? supHistory : INITIAL_SUPPLIER_HISTORY,
    impHistory: Array.isArray(impHistory) ? impHistory : INITIAL_IMPORT_HISTORY,
    currentUser: (currentUser && currentUser.email === 'atacadaocascavel@atacadao.com') ? currentUser : TEST_USERS[0],
    lastUpdateTime
  };
}

// Save functions to synchronize with state
export function saveData(data: {
  products?: Product[];
  suppliers?: Supplier[];
  promoters?: Promoter[];
  agencies?: Agency[];
  supHistory?: SupplierHistoryEntry[];
  impHistory?: ImportHistoryEntry[];
  currentUser?: User;
  lastUpdateTime?: string;
}) {
  if (typeof window === 'undefined') return;

  let productsSavedInLS = true;

  if (data.products) {
    // Save to IndexedDB as high-capacity primary browser cache
    saveIDB(KEYS.PRODUCTS, data.products);

    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
    } catch (e) {
      console.warn("Could not save products to localStorage (exceeded quota, relying on Express/Firestore/IndexedDB):", e);
      productsSavedInLS = false;
      try { localStorage.removeItem(KEYS.PRODUCTS); } catch (_) {}
    }
  }

  try {
    if (data.suppliers) localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(data.suppliers));
  } catch (e) {
    console.warn("Could not save suppliers to localStorage:", e);
  }

  try {
    if (data.promoters) localStorage.setItem(KEYS.PROMOTERS, JSON.stringify(data.promoters));
  } catch (e) {
    console.warn("Could not save promoters to localStorage:", e);
  }

  try {
    if (data.agencies) localStorage.setItem(KEYS.AGENCIES, JSON.stringify(data.agencies));
  } catch (e) {
    console.warn("Could not save agencies to localStorage:", e);
  }

  try {
    if (data.supHistory) localStorage.setItem(KEYS.SUP_HISTORY, JSON.stringify(data.supHistory));
  } catch (e) {
    console.warn("Could not save supHistory to localStorage:", e);
  }

  try {
    if (data.impHistory) localStorage.setItem(KEYS.IMP_HISTORY, JSON.stringify(data.impHistory));
  } catch (e) {
    console.warn("Could not save impHistory to localStorage:", e);
  }

  try {
    if (data.currentUser) localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(data.currentUser));
  } catch (e) {
    console.warn("Could not save currentUser to localStorage:", e);
  }

  // Only update LocalStorage timestamp if products were successfully stored locally
  // or if products were not part of this save payload
  if (productsSavedInLS || !data.products) {
    try {
      if (data.lastUpdateTime) {
        localStorage.setItem(KEYS.LAST_UPDATE_TIME, data.lastUpdateTime);
      }
    } catch (e) {
      console.warn("Could not save lastUpdateTime to localStorage:", e);
    }
  }
}

/**
 * Normalizes a product code according to the system rules:
 * - Strip leading zeros
 * - Remove hyphen followed by anything (e.g. -110)
 */
export function normalizeProductCode(code: string): string {
  if (!code) return '';
  let trimmed = String(code).trim();
  trimmed = trimmed.replace(/^0+/, '');
  trimmed = trimmed.split('-')[0];
  return trimmed || '0';
}

/**
 * Parses the complex "Estoque" column format into a total decimal or integer unit count.
 * Examples:
 * - "126 CXA (4)" -> 126 * 4 = 504 units
 * - "96 CXA (24) + 9" -> 96 * 24 + 9 = 2313 units
 * - "111 BDJ (6)" -> 111 * 6 = 666 units
 * - "110 KG (1.000)" -> 110 kg
 * - "199 KG (1.000) + 560" -> 199 + (560 / 1000) = 199.56 kg
 */
export function parseEstoqueString(estoqueStr: string): number {
  if (estoqueStr === undefined || estoqueStr === null) return 0;
  const cleaned = String(estoqueStr).trim().replace(/\s+/g, ' ').toUpperCase();
  if (!cleaned) return 0;

  // Pattern: (Quantity) (Unit) (Multiplier in parens) followed optionally by "+" (Remainder)
  // Group 1: Qty (digits)
  // Group 2: Unit (e.g. CXA, BDJ, KG, FD, PCT, UN)
  // Group 3: Multiplier (digits, can contain dot/comma like 1.000)
  // Group 4: optional "+ Remainder" (digits)
  const regex = /^(\d+)\s+([A-Z]+)\s*\(?([\d.,]+)\)?(?:\s*\+\s*(\d+))?$/;
  const match = cleaned.match(regex);

  if (match) {
    const qty = parseInt(match[1], 10);
    const unit = match[2];
    const multStr = match[3].replace(/[^\d]/g, ''); // "1.000" -> "1000", "24" -> "24"
    const multiplier = parseFloat(multStr) || 1;
    const remainder = match[4] ? parseInt(match[4], 10) : 0;

    if (unit === 'KG') {
      // For KG, the multiplier represents grams in a kg (1000). The remainder is added as a fraction of kg.
      const divisor = multiplier > 1 ? multiplier : 1000;
      return qty + (remainder / divisor);
    } else {
      // For packaged products, total units = quantity of packages * multiplier + remainder units
      return (qty * multiplier) + remainder;
    }
  }

  // Fallback pattern without multiplier or parentheses: "126 CXA" or "199 KG" or "100 UN"
  const regexSimple = /^(\d+)\s*([A-Z]+)$/;
  const matchSimple = cleaned.match(regexSimple);
  if (matchSimple) {
    return parseInt(matchSimple[1], 10);
  }

  // Fallback to standard float parsing
  const sanitized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses a float string formatted in either standard JS format or Brazilian format (comma decimal).
 * Safely handles R$ symbols, spaces, thousands separators, and single decimals.
 */
export function parseBrazilianFloat(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim();
  if (!str) return 0;
  
  // Clean currency symbol and whitespace
  str = str.replace('R$', '').replace(/\s/g, '');
  
  // If there's a comma, it's Brazilian formatting
  if (str.includes(',')) {
    // Remove dots as thousands separators, then replace comma with dot
    str = str.replace(/\./g, '').replace(',', '.');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Business Rules Derived Fields Generator for Products
export interface ProductDerived {
  product: Product;
  estoqueTotal: number;
  valorEstoque: number;
  status: 'Normal' | 'Abastecer' | 'Atenção' | 'Ruptura';
  classificacao: string; // "Normal", "Abastecer", "Atenção", "Ruptura" or "POSSÍVEL AJUSTE"
  isPossivelAjuste: boolean;
  isPrioridadeOperacional: boolean;
  promotor: string;
  agencia: string;
  diasAtendimento: string[];
  cnpjIndustria: string;
  nomeIndustria: string;
}

export function computeProductDerived(product: Product, suppliers: Supplier[], suppliersMap?: Map<string, Supplier>): ProductDerived {
  // Safe string conversion and regex replace
  const productCnpjClean = product && product.cnpjIndustria 
    ? String(product.cnpjIndustria).replace(/[^\d]/g, '') 
    : '';

  // 1. Vincular fornecedor através do CNPJ da Indústria
  let matchedSupplier: Supplier | undefined = undefined;
  if (suppliersMap && productCnpjClean) {
    matchedSupplier = suppliersMap.get(productCnpjClean);
  } else if (Array.isArray(suppliers) && productCnpjClean) {
    matchedSupplier = suppliers.find((s) => {
      if (!s || !s.cnpjIndustria) return false;
      const supplierCnpjClean = String(s.cnpjIndustria).replace(/[^\d]/g, '');
      return supplierCnpjClean !== '' && supplierCnpjClean === productCnpjClean;
    });
  }

  // If not matched by CNPJ, try matching supplier by name if product has a real non-generic name
  if (!matchedSupplier && product && product.nomeIndustria && Array.isArray(suppliers)) {
    const rawIndName = String(product.nomeIndustria).trim().toLowerCase();
    if (rawIndName && !rawIndName.includes('genérica') && !rawIndName.includes('desconhecida') && !rawIndName.includes('não informada')) {
      matchedSupplier = suppliers.find(s => s && s.nomeIndustria && s.nomeIndustria.trim().toLowerCase() === rawIndName);
    }
  }

  const promotor = matchedSupplier ? (matchedSupplier.promotor || 'Sem Cadastro') : 'Sem Cadastro';
  const agencia = matchedSupplier ? (matchedSupplier.agencia || 'Sem Cadastro') : 'Sem Cadastro';
  const diasAtendimento = matchedSupplier ? (matchedSupplier.diasAtendimento || []) : [];

  const cnpjIndustria = product ? (product.cnpjIndustria || (matchedSupplier ? matchedSupplier.cnpjIndustria : '')) : '';

  // Determine industry name dynamically
  let nomeIndustria = '';
  const rawProductInd = product ? String(product.nomeIndustria || '').trim() : '';
  const isGeneric = !rawProductInd || 
    rawProductInd.toLowerCase().includes('genérica') || 
    rawProductInd.toLowerCase().includes('desconhecida') || 
    rawProductInd.toLowerCase().includes('não informada');

  if (matchedSupplier && matchedSupplier.nomeIndustria && matchedSupplier.nomeIndustria.trim()) {
    nomeIndustria = matchedSupplier.nomeIndustria.trim();
  } else if (!isGeneric) {
    nomeIndustria = rawProductInd;
  } else {
    // Fallback mapping for standard CNPJs if supplier record not present
    if (productCnpjClean === '02916265000160') nomeIndustria = 'JBS S/A';
    else if (productCnpjClean === '03016124000150') nomeIndustria = 'AMBEV S/A';
    else if (productCnpjClean === '61068276000104') nomeIndustria = 'UNILEVER BRASIL';
    else if (productCnpjClean === '60398369000185') nomeIndustria = 'NESTLÉ BRASIL';
    else nomeIndustria = 'Indústria Não Cadastrada';
  }

  // 2. Fórmulas de estoque (with default null/undefined checks)
  const estoqueTotal = product && typeof product.estoque === 'number' && !isNaN(product.estoque)
    ? product.estoque
    : (product && product.estoque ? parseFloat(String(product.estoque)) || 0 : 0);

  const valorEstoque = product && typeof product.valorDisponivel === 'number' && !isNaN(product.valorDisponivel)
    ? product.valorDisponivel
    : (product && product.valorDisponivel ? parseFloat(String(product.valorDisponivel)) || 0 : 0);

  const semVendaNum = product && typeof product.semVenda === 'number' && !isNaN(product.semVenda)
    ? product.semVenda
    : (product && product.semVenda ? parseInt(String(product.semVenda)) || 0 : 0);
  
  // 3. Classificações Base
  let status: 'Normal' | 'Abastecer' | 'Atenção' | 'Ruptura' = 'Ruptura';
  if (estoqueTotal > 0) {
    if (semVendaNum >= 5) {
      status = 'Abastecer';
    } else {
      status = 'Normal';
    }
  } else {
    status = 'Ruptura';
  }

  // 4. Regra de Ajuste vs Prioridade
  // Se Valor Estoque < R$ 200,00  => POSSÍVEL AJUSTE (exceto se for Abastecer)
  const isPossivelAjuste = valorEstoque < 200 && status !== 'Abastecer';
  const isPrioridadeOperacional = !isPossivelAjuste;
  const classificacao = isPossivelAjuste ? 'Possível Ajuste' : status;

  const safeProduct: Product = product ? { ...product, cnpjIndustria, nomeIndustria } : { codigo: '?', descricao: 'Inválido', embalagem: '?', cnpjIndustria, nomeIndustria, estoque: 0, valorDisponivel: 0, custoMedio: 0, semVenda: 0 };

  return {
    product: safeProduct,
    estoqueTotal,
    valorEstoque,
    status,
    classificacao,
    isPossivelAjuste,
    isPrioridadeOperacional,
    promotor,
    agencia,
    diasAtendimento,
    cnpjIndustria,
    nomeIndustria
  };
}

// Compute aggregate stats across products
export function calculateSystemStats(products: Product[], suppliers: Supplier[], promoters: Promoter[], agencies: Agency[], lastUpdateTime: string): SystemStats {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safePromoters = Array.isArray(promoters) ? promoters : [];
  const safeAgencies = Array.isArray(agencies) ? agencies : [];

  // Pre-build a cleaned CNPJ Map of suppliers for maximum performance
  const suppliersMap = new Map<string, Supplier>();
  safeSuppliers.forEach(s => {
    if (s && s.cnpjIndustria) {
      const clean = String(s.cnpjIndustria).replace(/[^\d]/g, '');
      if (clean) {
        suppliersMap.set(clean, s);
      }
    }
  });

  const derived = safeProducts.map(p => computeProductDerived(p, safeSuppliers, suppliersMap));

  const totalProdutos = safeProducts.length;
  const totalFornecedores = safeSuppliers.length;
  const totalPromotores = safePromoters.length;
  const totalAgencias = safeAgencies.length;

  const totalRupturas = derived.filter(d => d.status === 'Ruptura' && !d.isPossivelAjuste).length;
  const totalAtencao = derived.filter(d => d.status === 'Atenção' && !d.isPossivelAjuste).length;
  const totalAbastecer = derived.filter(d => d.status === 'Abastecer' && !d.isPossivelAjuste).length;
  const totalNormais = derived.filter(d => d.status === 'Normal' && !d.isPossivelAjuste).length;
  const totalPossiveisAjustes = derived.filter(d => d.isPossivelAjuste).length;

  const valorTotalEstoque = derived.reduce((acc, curr) => acc + (curr.valorEstoque || 0), 0);

  return {
    filial: 'FILIAL 172 - CASCAVEL',
    ultimaAtualizacao: lastUpdateTime || '2026-06-04T07:30:00Z',
    totalProdutos,
    totalFornecedores,
    totalPromotores,
    totalAgencias,
    totalRupturas,
    totalAtencao,
    totalAbastecer,
    totalNormais,
    totalPossiveisAjustes,
    valorTotalEstoque
  };
}

/**
 * Formats a raw input string to a standard Brazilian CNPJ: XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(val: string): string {
  let clean = val.replace(/[^\d]/g, '');
  if (!clean) return '';
  // Pad with leading zeros if truncated by numeric systems (e.g., Excel)
  if (clean.length === 13) {
    clean = '0' + clean;
  } else if (clean.length === 12) {
    clean = '00' + clean;
  }
  clean = clean.slice(0, 14);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  if (clean.length <= 12) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
}

/**
 * Fetches the business name (Razão Social) for a given CNPJ using BrasilAPI.
 */
export async function fetchCnpjData(cnpj: string): Promise<string | null> {
  const clean = cnpj.replace(/[^\d]/g, '');
  if (clean.length !== 14) return null;
  
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!response.ok) {
      throw new Error(`BrasilAPI returned status ${response.status}`);
    }
    const data = await response.json();
    const name = data.razao_social || data.nome_fantasia;
    if (name) {
      return String(name).trim().toUpperCase();
    }
    return null;
  } catch (error) {
    console.warn("Error fetching CNPJ from BrasilAPI:", error);
    
    // Fallback: Minha Receita API (open-source)
    try {
      const response = await fetch(`https://minhareceita.org/${clean}`);
      if (response.ok) {
        const data = await response.json();
        const name = data.razao_social || data.nome_fantasia;
        if (name) {
          return String(name).trim().toUpperCase();
        }
      }
    } catch (fallbackError) {
      console.warn("Error fetching CNPJ from Minha Receita:", fallbackError);
    }
    
    return null;
  }
}
