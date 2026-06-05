/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Supplier, User } from '../types';
import { computeProductDerived } from '../mockData';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  AlertTriangle, 
  Building2, 
  Network,
  Calendar,
  X,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';
import { motion } from 'motion/react';

interface BasePrincipalViewProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  suppliers: Supplier[];
  currentUser: User;
  globalSearchQuery: string;
}

export default function BasePrincipalView({ 
  products, 
  setProducts, 
  suppliers, 
  currentUser,
  globalSearchQuery
}: BasePrincipalViewProps) {
  const isAdmin = currentUser.role === 'Admin';
  const isPromotor = currentUser.role === 'Promotor';

  // State
  const [localSearch, setLocalSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [selectedPromoterFilter, setSelectedPromoterFilter] = useState<string>('todos');
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string>('todos');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('todos');

  // Sorting
  const [sortField, setSortField] = useState<'codigo' | 'descricao' | 'nomeIndustria' | 'custoMedio'>('codigo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // New item modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmb, setNewEmb] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newIndName, setNewIndName] = useState('');
  const [addError, setAddError] = useState('');

  // Editing dialog
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editEmb, setEditEmb] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editIndName, setEditIndName] = useState('');

  // Auto-fill industry name when CNPJ matches existing suppliers
  const handleCnpjChange = (val: string, type: 'add' | 'edit') => {
    const cleanCnpj = val.replace(/[^\d]/g, '');
    const found = suppliers.find(s => s.cnpjIndustria.replace(/[^\d]/g, '') === cleanCnpj);
    if (type === 'add') {
      setNewCnpj(val);
      if (found) {
        setNewIndName(found.nomeIndustria);
      }
    } else {
      setEditCnpj(val);
      if (found) {
        setEditIndName(found.nomeIndustria);
      }
    }
  };

  // Run derived computations once
  const derivedProducts = useMemo(() => {
    return products.map(p => computeProductDerived(p, suppliers));
  }, [products, suppliers]);

  // Combined Search and Filters
  const filteredProducts = useMemo(() => {
    let result = [...derivedProducts];

    // 1. Role Scope Constraints: Promoters can only visualize their products
    if (isPromotor && currentUser.promoterName) {
      result = result.filter(d => d.promotor.toLowerCase() === currentUser.promoterName?.toLowerCase());
    }

    // 2. Global search + Local search aggregation
    const activeQuery = (globalSearchQuery || localSearch).trim().toLowerCase();
    if (activeQuery) {
      result = result.filter(d => {
        return (
          d.product.codigo.toLowerCase().includes(activeQuery) ||
          d.product.descricao.toLowerCase().includes(activeQuery) ||
          d.product.cnpjIndustria.replace(/[^\d]/g, '').includes(activeQuery.replace(/[^\d]/g, '').trim()) ||
          d.nomeIndustria.toLowerCase().includes(activeQuery) ||
          d.promotor.toLowerCase().includes(activeQuery) ||
          d.agencia.toLowerCase().includes(activeQuery)
        );
      });
    }

    // 3. Status Classificação filter
    if (selectedStatusFilter !== 'todos') {
      result = result.filter(d => d.classificacao === selectedStatusFilter);
    }

    // 4. Promoter filter
    if (selectedPromoterFilter !== 'todos') {
      result = result.filter(d => d.promotor === selectedPromoterFilter);
    }

    // 5. Industry filter
    if (selectedIndustryFilter !== 'todos') {
      result = result.filter(d => d.product.cnpjIndustria === selectedIndustryFilter);
    }

    // 6. Agency Filter
    if (selectedAgencyFilter !== 'todos') {
      result = result.filter(d => d.agencia === selectedAgencyFilter);
    }

    // 7. Sort elements
    result.sort((a, b) => {
      let aVal: any = a.product[sortField as keyof Product] || a[sortField as keyof typeof a] || '';
      let bVal: any = b.product[sortField as keyof Product] || b[sortField as keyof typeof b] || '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    derivedProducts,
    isPromotor,
    currentUser.promoterName,
    globalSearchQuery,
    localSearch,
    selectedStatusFilter,
    selectedPromoterFilter,
    selectedIndustryFilter,
    selectedAgencyFilter,
    sortField,
    sortDirection
  ]);

  // List of distinct elements for filter drop-downs
  const filterOptions = useMemo(() => {
    const listPromoters = [...new Set(derivedProducts.map(p => p.promotor))].filter(Boolean);
    const listAgencies = [...new Set(derivedProducts.map(p => p.agencia))].filter(Boolean);
    
    // Collect all distinct industries by CNPJ from both products and suppliers
    const industriesMap = new Map<string, string>();
    
    // 1. Load from suppliers list
    suppliers.forEach(s => {
      if (s.cnpjIndustria) {
        industriesMap.set(s.cnpjIndustria.trim(), s.nomeIndustria?.trim() || s.cnpjIndustria.trim());
      }
    });

    // 2. Load from products list to guarantee all registered products' industries are listed
    products.forEach(p => {
      if (p.cnpjIndustria) {
        industriesMap.set(p.cnpjIndustria.trim(), p.nomeIndustria?.trim() || p.cnpjIndustria.trim());
      }
    });

    // Convert Map into array of CNPJ/Nome objects
    const listIndustries = Array.from(industriesMap.entries()).map(([cnpj, nome]) => ({
      cnpj,
      nome
    }));

    // Sort alphabetically by name
    listIndustries.sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      promoters: listPromoters,
      agencies: listAgencies,
      industries: listIndustries
    };
  }, [products, derivedProducts, suppliers]);

  // Paginated Slicing
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Add Item Handler (restricted to Admin, code validation mandated)
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newCode || !newDesc || !newEmb || !newCnpj || !newIndName) {
      setAddError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Verify code uniqueness: "Inclusão somente para novos itens"
    const codeExists = products.some(p => p.codigo.trim() === newCode.trim());
    if (codeExists) {
      setAddError(`Conflito: O código [${newCode}] já existe na base de dados da filial e não pode ser sobrescrito.`);
      return;
    }

    const newProd: Product = {
      codigo: newCode.trim(),
      descricao: newDesc.trim().toUpperCase(),
      embalagem: newEmb.trim().toUpperCase(),
      cnpjIndustria: newCnpj.trim(),
      nomeIndustria: newIndName.trim(),
      estoqueEmb1: 0,
      estoqueEmb9: 0,
      custoMedio: 0,
      semVenda: 0
    };

    setProducts([newProd, ...products]);
    setNewCode('');
    setNewDesc('');
    setNewEmb('');
    setNewCnpj('');
    setNewIndName('');
    setIsAddModalOpen(false);
  };

  // Edit Item Handler (restricted to Admin)
  const handleEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updated = products.map(p => {
      if (p.codigo === editingProduct.codigo) {
        return {
          ...p,
          descricao: editDesc.trim().toUpperCase(),
          embalagem: editEmb.trim().toUpperCase(),
          cnpjIndustria: editCnpj.trim(),
          nomeIndustria: editIndName.trim()
        };
      }
      return p;
    });

    setProducts(updated);
    setEditingProduct(null);
  };

  // Delete product (with fallback verification)
  const handleDeleteProduct = (codigo: string) => {
    if (confirm('Deseja realmente remover este produto da Base Principal? Esta operação removerá também os registros de estoque associados.')) {
      setProducts(products.filter(p => p.codigo !== codigo));
    }
  };

  return (
    <div className="space-y-6" id="base-principal-tab">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-display">Cadastro da Base Principal</h2>
          <p className="text-xs text-gray-500 mt-1">
            Visualização da Tabela Mestre da filial. Todas as sincronizações diárias herdam a chave do CNPJ Industrial.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="self-start sm:self-auto px-4 py-2.5 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl text-xs font-black shadow-md shadow-[#F58220]/15 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Item Mestre
          </button>
        )}
      </div>

      {/* SEARCH AND FILTERS COMBOBOX PANEL */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Internal search field if global is empty */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Pesquise por código, descrição, CNPJ, indústria..."
              className="text-xs w-full pl-9 pr-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 text-gray-800"
            />
            {localSearch && (
              <button 
                onClick={() => setLocalSearch('')}
                className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600"
              >
                Limpar
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {/* Filter Status */}
            <div>
              <select
                className="text-xs bg-gray-50 border rounded-xl px-3 py-2.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#F58220]"
                value={selectedStatusFilter}
                onChange={(e) => { setSelectedStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="todos">Status: Todos</option>
                <option value="Normal">Normal</option>
                <option value="Abastecer">Abastecer</option>
                <option value="Atenção">Atenção</option>
                <option value="Ruptura">Ruptura</option>
                <option value="Possível Ajuste">Possível Ajuste</option>
              </select>
            </div>

            {/* Filter Promoter */}
            {!isPromotor && (
              <div>
                <select
                  className="text-xs bg-gray-50 border rounded-xl px-3 py-2.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#F58220] max-w-[150px]"
                  value={selectedPromoterFilter}
                  onChange={(e) => { setSelectedPromoterFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="todos">Promotor: Todos</option>
                  {filterOptions.promoters.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter Industry */}
            <div>
              <select
                className="text-xs bg-gray-50 border rounded-xl px-3 py-2.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#F58220] max-w-[150px]"
                value={selectedIndustryFilter}
                onChange={(e) => { setSelectedIndustryFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="todos">Indústria: Todas</option>
                {filterOptions.industries.map(ind => (
                  <option key={ind.cnpj} value={ind.cnpj}>{ind.nome.split('(')[0].trim()}</option>
                ))}
              </select>
            </div>

            {/* Filter Agency */}
            <div>
              <select
                className="text-xs bg-gray-50 border rounded-xl px-3 py-2.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#F58220]"
                value={selectedAgencyFilter}
                onChange={(e) => { setSelectedAgencyFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="todos">Agência: Todas</option>
                {filterOptions.agencies.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Query Matches count */}
        <div className="text-[11px] text-gray-400 font-medium flex items-center justify-between">
          <span>
            Exibindo <strong className="text-[#2F2F2F]">{filteredProducts.length}</strong> de <strong className="text-gray-600">{products.length}</strong> registros encontrados.
          </span>
          {isPromotor && (
            <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md">
              Mapeamento de {currentUser.promoterName}
            </span>
          )}
        </div>
      </div>

      {/* PRODUCTS MASTER DATAGRID */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider select-none">
                <th onClick={() => handleSort('codigo')} className="p-4 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-1">Código <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" /></div>
                </th>
                <th onClick={() => handleSort('descricao')} className="p-4 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-1">Descrição Mercadoria <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" /></div>
                </th>
                <th className="p-4">Embalagem</th>
                <th onClick={() => handleSort('nomeIndustria')} className="p-4 cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-1">Fabricante (CNPJ) <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" /></div>
                </th>
                <th className="p-4">Atendimento Promotor</th>
                <th className="p-4">Status Estoque</th>
                {isAdmin && <th className="p-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                    Nenhum produto atende aos critérios de pesquisa e filtros ativos.
                  </td>
                </tr>
              ) : (
                paginatedData.map((d) => {
                  const hasPromoter = d.promotor && d.promotor !== 'Sem Cadastro';
                  
                  const getStatusBadge = (classification: string) => {
                    switch (classification) {
                      case 'Normal':
                        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      case 'Abastecer':
                        return 'bg-orange-50 text-orange-700 border-orange-100';
                      case 'Atenção':
                        return 'bg-amber-50 text-amber-700 border-amber-100';
                      case 'Ruptura':
                        return 'bg-red-50 text-red-700 border-red-100';
                      case 'Possível Ajuste':
                        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
                      default:
                        return 'bg-gray-50 text-gray-700 border-gray-100';
                    }
                  };

                  return (
                    <tr key={d.product.codigo} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-gray-900">{d.product.codigo}</td>
                      <td className="p-4 font-bold text-gray-800 tracking-tight max-w-[280px] break-words">{d.product.descricao}</td>
                      <td className="p-4 font-medium text-gray-500 font-mono">{d.product.embalagem}</td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-gray-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#F58220] shrink-0" />
                            <span>{d.nomeIndustria}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{d.product.cnpjIndustria}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        {hasPromoter ? (
                          <div className="space-y-0.5">
                            <div className="font-extrabold text-gray-800">{d.promotor}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Network className="w-3 h-3 text-gray-400" />
                              <span>{d.agencia}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">
                            Sem Promotor Ativo
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusBadge(d.classificacao)}`}>
                          {d.classificacao}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingProduct(d.product);
                                setEditDesc(d.product.descricao);
                                setEditEmb(d.product.embalagem);
                                setEditCnpj(d.product.cnpjIndustria);
                                setEditIndName(d.nomeIndustria);
                              }}
                              className="p-1.5 bg-gray-50 text-gray-600 hover:text-[#F58220] hover:bg-[#F58220]/5 rounded-lg border border-gray-200 transition-all"
                              title="Editar Produto"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(d.product.codigo)}
                              className="p-1.5 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition-all"
                              title="Remover Código"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION TOOLBAR */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Linhas por página:</span>
            <select
              className="bg-gray-50 border rounded-lg px-2 py-1 text-gray-700 font-bold text-xs"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border hover:bg-gray-50 font-bold disabled:opacity-40"
            >
              Primeira
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border hover:bg-gray-50 font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            
            <div className="px-3.5 py-1 bg-gray-50 border rounded-lg font-bold font-mono">
              Página {currentPage} de {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded-lg border hover:bg-gray-50 font-bold disabled:opacity-40"
            >
              Próxima
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded-lg border hover:bg-gray-50 font-bold disabled:opacity-40"
            >
              Última
            </button>
          </div>
        </div>
      </div>

      {/* --- ADD MODAL DIALOG (ADMIN ONLY) --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-2">
              <Plus className="text-[#F58220] w-6 h-6" /> Cadastrar Novo Item Mestre
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Adicione um novo produto à Base Principal da filial. Este cadastro é necessário para que as planilhas de estoque cruzem os dados posteriormente.
            </p>

            <form onSubmit={handleAddProduct} className="space-y-4 mt-5 text-left text-xs">
              
              {addError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 font-bold leading-tight">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">CÓDIGO INTERNO (Ex. 100106)*</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">EMBALAGEM (Ex. CX 12 UN)*</label>
                  <input
                    type="text"
                    required
                    value={newEmb}
                    onChange={(e) => setNewEmb(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">DESCRIÇÃO DA MERCADORIA*</label>
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase"
                  placeholder="Ex. NUTELLA RECHEIO CREME AVELA 350G"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">CNPJ DA INDÚSTRIA (Ex. 02.916.265/0001-60)*</label>
                <input
                  type="text"
                  required
                  value={newCnpj}
                  onChange={(e) => handleCnpjChange(e.target.value, 'add')}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono text-xs font-bold"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">NOME DA INDÚSTRIA (FABRICANTE)*</label>
                <input
                  type="text"
                  required
                  value={newIndName}
                  onChange={(e) => setNewIndName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase"
                  placeholder="Ex. JBS S.A"
                />
              </div>

              <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 text-[11px] text-orange-850 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                <span>
                  <strong>Vínculo Automático:</strong> Se o CNPJ inserido já estiver cadastrado na aba "Fornecedores", todos os promotores e agências serão vinculados a este produto de forma automática.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md shadow-[#F58220]/20"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- EDIT MODAL DIALOG (ADMIN ONLY) --- */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={() => setEditingProduct(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-2">
              <Edit3 className="text-[#F58220] w-6 h-6" /> Editar Detalhes do Item Meste
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Código: <strong className="font-mono">{editingProduct.codigo}</strong> (Códigos não podem ser editados, apenas as descrições e CNPJs associados).
            </p>

            <form onSubmit={handleEditProduct} className="space-y-4 mt-5 text-left text-xs">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">DESCRIÇÃO DA MERCADORIA*</label>
                <input
                  type="text"
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">EMBALAGEM (Ex. CX 12 UN)*</label>
                <input
                  type="text"
                  required
                  value={editEmb}
                  onChange={(e) => setEditEmb(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">CNPJ DA INDÚSTRIA*</label>
                <input
                  type="text"
                  required
                  value={editCnpj}
                  onChange={(e) => handleCnpjChange(e.target.value, 'edit')}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">NOME DA INDÚSTRIA (FABRICANTE)*</label>
                <input
                  type="text"
                  required
                  value={editIndName}
                  onChange={(e) => setEditIndName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold uppercase"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md shadow-[#F58220]/20"
                >
                  Salvar Edições
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
