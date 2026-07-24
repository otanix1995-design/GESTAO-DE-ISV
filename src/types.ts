/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Admin' | 'Gestor' | 'Promotor';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  password?: string;
  promoterName?: string; // Predefined promoter association for 'Promotor' role filtering
}

export interface Product {
  codigo: string;
  descricao: string;
  embalagem: string;
  cnpjIndustria: string;
  nomeIndustria: string;
  
  // Daily inventory indicators
  estoque: number; // Estoque
  estoqueFormatado?: string; // Formato original de estoque (Ex: 126 CXA (4) ou 199 KG (1.000) + 560)
  valorDisponivel: number; // Valor Disponível em R$
  custoMedio: number;
  semVenda: number;    // Dias sem venda
  idade?: number;      // Idade
}

export interface Supplier {
  cnpjIndustria: string;
  nomeIndustria: string;
  promotor: string;
  agencia: string;
  diasAtendimento: string[]; // e.g. ['Segunda', 'Quarta', 'Sexta']
}

export interface Promoter {
  nome: string;
  agencia: string;
  contato?: string;
  ativo: boolean;
}

export interface Agency {
  nome: string;
  cnpj?: string;
  promotoresContados?: number;
}

export interface SupplierHistoryEntry {
  id: string;
  timestamp: string;
  cnpjIndustria: string;
  nomeIndustria: string;
  usuario: string;
  descricaoAlteracao: string; // e.g. "Promotor alterado de Victor para João"
}

export interface ImportHistoryEntry {
  id: string;
  timestamp: string;
  usuario: string;
  tipo: 'BasePrincipal' | 'EstoqueDiario';
  nomeArquivo: string;
  totalLinhas: number;
  sucesso: boolean;
}

// Global System Statistics (Filial 172 - CASCAVEL)
export interface SystemStats {
  filial: string;
  ultimaAtualizacao: string;
  totalProdutos: number;
  totalFornecedores: number;
  totalPromotores: number;
  totalAgencias: number;
  totalRupturas: number;
  totalAtencao: number;
  totalAbastecer: number;
  totalNormais: number;
  totalPossiveisAjustes: number;
  valorTotalEstoque: number;
}
