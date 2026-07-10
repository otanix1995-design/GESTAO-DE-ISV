/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Supplier, Promoter, Agency, SupplierHistoryEntry, ImportHistoryEntry, Role, User, SystemStats } from './types';

// Predefined testing users for role selection
export const TEST_USERS: User[] = [
  { id: '1', name: 'Filial 172 Cascavel', role: 'Admin', email: 'danilo.gerencia@atacadao.com.br' }
];

/// Initial Agencies
export const INITIAL_AGENCIES: Agency[] = [];

// Initial Promoters
export const INITIAL_PROMOTERS: Promoter[] = [];

// Initial Suppliers
export const INITIAL_SUPPLIERS: Supplier[] = [];

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
    currentUser: (currentUser && currentUser.id && currentUser.role) ? currentUser : TEST_USERS[0],
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

  try {
    if (data.products) localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
  } catch (e) {
    console.warn("Could not save products to localStorage (probably exceeded storage quota):", e);
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

  try {
    if (data.lastUpdateTime) {
      localStorage.setItem(KEYS.LAST_UPDATE_TIME, data.lastUpdateTime);
    }
  } catch (e) {
    console.warn("Could not save lastUpdateTime to localStorage:", e);
  }
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

export function computeProductDerived(product: Product, suppliers: Supplier[]): ProductDerived {
  // Safe string conversion and regex replace
  const productCnpjClean = product && product.cnpjIndustria 
    ? String(product.cnpjIndustria).replace(/[^\d]/g, '') 
    : '';

  // 1. Vincular fornecedor através do CNPJ da Indústria
  const matchedSupplier = Array.isArray(suppliers) ? suppliers.find((s) => {
    if (!s || !s.cnpjIndustria) return false;
    const supplierCnpjClean = String(s.cnpjIndustria).replace(/[^\d]/g, '');
    return supplierCnpjClean !== '' && productCnpjClean !== '' && supplierCnpjClean === productCnpjClean;
  }) : undefined;

  const promotor = matchedSupplier ? (matchedSupplier.promotor || 'Sem Cadastro') : 'Sem Cadastro';
  const agencia = matchedSupplier ? (matchedSupplier.agencia || 'Sem Cadastro') : 'Sem Cadastro';
  const diasAtendimento = matchedSupplier ? (matchedSupplier.diasAtendimento || []) : [];

  const cnpjIndustria = product ? (product.cnpjIndustria || '') : '';
  const nomeIndustria = product ? (product.nomeIndustria || 'Indústria Desconhecida') : 'Indústria Desconhecida';

  // 2. Fórmulas de estoque (with default null/undefined checks)
  const estEmb1 = product && typeof product.estoqueEmb1 === 'number' ? product.estoqueEmb1 : 0;
  const estEmb9 = product && typeof product.estoqueEmb9 === 'number' ? product.estoqueEmb9 : 0;
  const cMedio = product && typeof product.custoMedio === 'number' ? product.custoMedio : 0;

  const estoqueTotal = estEmb1 + estEmb9;
  const valorEstoque = estoqueTotal * cMedio;

  // 3. Classificações Base
  let status: 'Normal' | 'Abastecer' | 'Atenção' | 'Ruptura' = 'Ruptura';
  if (estEmb1 > 0 && estEmb9 > 0) {
    status = 'Normal';
  } else if (estEmb1 > 0 && estEmb9 === 0) {
    status = 'Abastecer';
  } else if (estEmb1 === 0 && estEmb9 > 0) {
    status = 'Atenção';
  } else {
    status = 'Ruptura';
  }

  // 4. Regra de Ajuste vs Prioridade
  // Se Valor Estoque < R$ 200,00  => POSSÍVEL AJUSTE
  const isPossivelAjuste = valorEstoque < 200;
  const isPrioridadeOperacional = valorEstoque >= 200;
  const classificacao = isPossivelAjuste ? 'Possível Ajuste' : status;

  return {
    product: product || { codigo: '?', descricao: 'Inválido', embalagem: '?', cnpjIndustria: '', nomeIndustria: 'Inválido', estoqueEmb1: 0, estoqueEmb9: 0, custoMedio: 0, semVenda: 0 },
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

  const derived = safeProducts.map(p => computeProductDerived(p, safeSuppliers));

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
