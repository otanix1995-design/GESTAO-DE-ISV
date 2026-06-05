/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Supplier, Promoter, Agency, User, SupplierHistoryEntry } from '../types';
import { 
  Plus, 
  Store, 
  UserCheck, 
  Building2, 
  CalendarDays, 
  Edit, 
  Clock, 
  History, 
  X, 
  Check, 
  AlertCircle,
  HelpCircle,
  Search
} from 'lucide-react';
import { motion } from 'motion/react';

interface FornecedoresViewProps {
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
  promoters: Promoter[];
  agencies: Agency[];
  currentUser: User;
  supHistory: SupplierHistoryEntry[];
  setSupHistory: (history: SupplierHistoryEntry[]) => void;
}

export default function FornecedoresView({
  suppliers,
  setSuppliers,
  promoters,
  agencies,
  currentUser,
  supHistory,
  setSupHistory
}: FornecedoresViewProps) {
  const isAdmin = currentUser.role === 'Admin';
  const isPromotor = currentUser.role === 'Promotor';

  // Local States
  const [activeSubTab, setActiveSubTab] = useState<'lista' | 'historico'>('lista');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form States for Add
  const [newCnpj, setNewCnpj] = useState('');
  const [newIndName, setNewIndName] = useState('');
  const [newPromotor, setNewPromotor] = useState('');
  const [newAgencia, setNewAgencia] = useState('');
  const [newDays, setNewDays] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  // Form States for Edit
  const [editPromotor, setEditPromotor] = useState('');
  const [editAgencia, setEditAgencia] = useState('');
  const [editDays, setEditDays] = useState<string[]>([]);

  // List of standard operational days
  const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // Automatically fetch agency when Promoter is selected during ADD
  const handlePromoterChangeAdd = (promoterName: string) => {
    setNewPromotor(promoterName);
    const found = promoters.find(p => p.nome === promoterName);
    if (found) {
      setNewAgencia(found.agencia);
    }
  };

  // Automatically fetch agency when Promoter is selected during EDIT
  const handlePromoterChangeEdit = (promoterName: string) => {
    setEditPromotor(promoterName);
    const found = promoters.find(p => p.nome === promoterName);
    if (found) {
      setEditAgencia(found.agencia);
    }
  };

  // Toggle checkout days for ADD
  const toggleDayAdd = (day: string) => {
    setNewDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Toggle checkout days for EDIT
  const toggleDayEdit = (day: string) => {
    setEditDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Combined Filters and Scope Restrictions
  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers];

    // Role restrictions: Promoters view only their corresponding industrias
    if (isPromotor && currentUser.promoterName) {
      result = result.filter(s => s.promotor.toLowerCase() === currentUser.promoterName?.toLowerCase());
    }

    // Search query matching
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(s => 
        s.nomeIndustria.toLowerCase().includes(q) ||
        s.cnpjIndustria.replace(/[^\d]/g, '').includes(q.replace(/[^\d]/g, '')) ||
        s.promotor.toLowerCase().includes(q) ||
        s.agencia.toLowerCase().includes(q)
      );
    }

    return result;
  }, [suppliers, isPromotor, currentUser.promoterName, searchQuery]);

  // Handle supplier insertion
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newCnpj || !newIndName || !newPromotor || !newAgencia || newDays.length === 0) {
      setAddError('Por favor, preencha todos os campos obrigatórios e ao menos um dia de atendimento.');
      return;
    }

    // Check duplicate
    const exists = suppliers.some(s => s.cnpjIndustria.replace(/[^\d]/g, '') === newCnpj.replace(/[^\d]/g, ''));
    if (exists) {
      setAddError(`O CNPJ [${newCnpj}] já possui cadastro ativo na central Atacadão.`);
      return;
    }

    const newSup: Supplier = {
      cnpjIndustria: newCnpj.trim(),
      nomeIndustria: newIndName.trim().toUpperCase(),
      promotor: newPromotor,
      agencia: newAgencia,
      diasAtendimento: newDays
    };

    const updated = [newSup, ...suppliers];
    setSuppliers(updated);

    // Save operation log entry
    const newLog: SupplierHistoryEntry = {
      id: 'log' + Date.now(),
      timestamp: new Date().toISOString(),
      cnpjIndustria: newSup.cnpjIndustria,
      nomeIndustria: newSup.nomeIndustria,
      usuario: currentUser.name,
      descricaoAlteracao: `Fornecedor cadastrado com Promotor ${newSup.promotor} (${newSup.agencia}) e Atendimentos: ${newSup.diasAtendimento.join(', ')}`
    };
    setSupHistory([newLog, ...supHistory]);

    // Resets
    setNewCnpj('');
    setNewIndName('');
    setNewPromotor('');
    setNewAgencia('');
    setNewDays([]);
    setIsAddModalOpen(false);
  };

  // Handle supplier edit submit
  const handleSaveEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    if (!editPromotor || !editAgencia || editDays.length === 0) {
      alert('Por favor, indique um promotor dador e ao menos um dia de atendimento.');
      return;
    }

    // Draft alteration log details
    const updates: string[] = [];
    if (editingSupplier.promotor !== editPromotor) updates.push(`Promotor alterado de '${editingSupplier.promotor}' para '${editPromotor}'`);
    if (editingSupplier.agencia !== editAgencia) updates.push(`Agência alterada de '${editingSupplier.agencia}' para '${editAgencia}'`);
    const isDaysSame = editingSupplier.diasAtendimento.length === editDays.length && editingSupplier.diasAtendimento.every(d => editDays.includes(d));
    if (!isDaysSame) updates.push(`Atendimento alterado de [${editingSupplier.diasAtendimento.join(', ')}] para [${editDays.join(', ')}]`);

    const updateLabel = updates.length > 0 ? updates.join('; ') : 'Configurações re-salvadas sem alterações';

    const updatedSuppliers = suppliers.map(s => {
      if (s.cnpjIndustria === editingSupplier.cnpjIndustria) {
        return {
          ...s,
          promotor: editPromotor,
          agencia: editAgencia,
          diasAtendimento: editDays
        };
      }
      return s;
    });

    setSuppliers(updatedSuppliers);

    if (updates.length > 0) {
      const newLog: SupplierHistoryEntry = {
        id: 'log' + Date.now(),
        timestamp: new Date().toISOString(),
        cnpjIndustria: editingSupplier.cnpjIndustria,
        nomeIndustria: editingSupplier.nomeIndustria,
        usuario: currentUser.name,
        descricaoAlteracao: updateLabel
      };
      setSupHistory([newLog, ...supHistory]);
    }

    setEditingSupplier(null);
  };

  // Remove Supplier
  const handleDeleteSupplier = (cnpj: string, indName: string) => {
    if (confirm(`Deseja desvincular o fornecedor ${indName}? Todos os produtos remanescentes da Base Principal perderão o promotor e herdarão status 'Sem Cadastro'.`)) {
      setSuppliers(suppliers.filter(s => s.cnpjIndustria !== cnpj));
      const newLog: SupplierHistoryEntry = {
        id: 'log' + Date.now(),
        timestamp: new Date().toISOString(),
        cnpjIndustria: cnpj,
        nomeIndustria: indName,
        usuario: currentUser.name,
        descricaoAlteracao: `Fornecedor excluído e desvinculado dos produtos em loja.`
      };
      setSupHistory([newLog, ...supHistory]);
    }
  };

  return (
    <div className="space-y-6" id="fornecedores-tab">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-display">Cadastro de Fornecedores / ISV</h2>
          <p className="text-xs text-gray-500 mt-1">
            Chave principal baseada no CNPJ da Indústria. A vinculação de promotor aqui propaga dados instantaneamente a todos os itens.
          </p>
        </div>
        
        {/* Sub-tabs header switches */}
        <div className="flex bg-gray-150 p-1 rounded-xl border self-start sm:self-auto text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveSubTab('lista')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'lista' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Store className="w-4 h-4 text-[#F58220]" /> Fornecedores Vinculados
          </button>
          <button
            onClick={() => setActiveSubTab('historico')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'historico' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4 text-[#F58220]" /> Histórico de Alterações
          </button>
        </div>
      </div>

      {activeSubTab === 'lista' ? (
        <>
          {/* SEARCH & ADD TOOLBAR */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquise por nome, CNPJ, promotor ativo ou agência..."
                className="text-xs w-full pl-9 pr-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F58220]/20 text-gray-805"
              />
            </div>
            
            <div className="flex gap-2.5">
              {isAdmin && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2.5 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl text-xs font-black shadow-md shadow-[#F58220]/15 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Registrar Fornecedor
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider select-none">
                    <th className="p-4">Razão / Indústria</th>
                    <th className="p-4">CNPJ Cadastrado</th>
                    <th className="p-4">Promotor Atribuído</th>
                    <th className="p-4">Agência Promotora</th>
                    <th className="p-4">Dias de Atendimento na Loja</th>
                    {isAdmin && <th className="p-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400 font-medium">
                        Nenhum relacionamento industrial e fornecedor encontrado com esta consulta.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s.cnpjIndustria} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-[#F58220]/10 text-[#F58220] p-2 rounded-xl shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-gray-900">{s.nomeIndustria}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-gray-500 font-semibold">{s.cnpjIndustria}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-800">{s.promotor}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-gray-600 bg-gray-150 px-2.5 py-1 rounded-md">
                            {s.agencia}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <CalendarDays className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {s.diasAtendimento.map((day) => (
                              <span key={day} className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100">
                                {day.substring(0, 3)}
                              </span>
                            ))}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingSupplier(s);
                                  setEditPromotor(s.promotor);
                                  setEditAgencia(s.agencia);
                                  setEditDays(s.diasAtendimento);
                                }}
                                className="p-1.5 bg-gray-50 text-gray-600 hover:text-[#F58220] hover:bg-[#F58220]/5 rounded-lg border border-gray-200 transition-all font-bold flex items-center gap-1"
                                title="Editar Vínculos"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSupplier(s.cnpjIndustria, s.nomeIndustria)}
                                className="p-1.5 bg-gray-50 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded-lg border border-gray-200 transition-all"
                                title="Desvincular Fornecedor"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* HISTORY TAB DISPLAY */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
          <div className="flex items-center gap-2 mb-5">
            <History className="w-5 h-5 text-[#F58220]" />
            <h3 className="text-sm font-extrabold uppercase text-gray-405 tracking-wide font-display">Registros Históricos de Gestão</h3>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {supHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Nenhum log de alteração de fornecedor resgatado.</div>
            ) : (
              supHistory.map((item) => (
                <div key={item.id} className="p-4 bg-gray-50 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:border-gray-300 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-gray-900 text-sm font-display font-black">{item.nomeIndustria}</strong>
                      <span className="font-mono text-gray-400 bg-gray-200 px-2 py-0.5 rounded-md text-[10px]">{item.cnpjIndustria}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed font-medium bg-white border p-3 rounded-lg border-gray-200/50">
                      {item.descricaoAlteracao}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-gray-500 bg-white border border-gray-200/80 p-3 rounded-xl">
                    <div className="text-right">
                      <div className="font-bold text-gray-700 flex items-center justify-end gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.usuario.split(' ')[0]}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 font-mono font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.timestamp).toLocaleDateString('pt-BR')} {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
              <Store className="text-[#F58220] w-6 h-6" /> Cadastrar Vínculo de Fornecedor
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Insira o CNPJ da indústria e vincule o promotor e agência correspondentes para herança mestre de dados diários.
            </p>

            <form onSubmit={handleAddSupplier} className="space-y-4 mt-5 text-left text-xs">
              
              {addError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 font-bold leading-tight">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">CNPJ DA INDÚSTRIA (Ex. 02.916.265/0001-60)*</label>
                <input
                  type="text"
                  required
                  value={newCnpj}
                  onChange={(e) => setNewCnpj(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono font-bold"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">RAZÃO SOCIAL / PRODUTORA*</label>
                <input
                  type="text"
                  required
                  value={newIndName}
                  onChange={(e) => setNewIndName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-bold uppercase"
                  placeholder="Ex. BRF S.A (SADIA / PERDIGÃO)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">PROMOTOR RESPONSÁVEL*</label>
                  <select
                    required
                    value={newPromotor}
                    onChange={(e) => handlePromoterChangeAdd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-bold"
                  >
                    <option value="">Selecione...</option>
                    {promoters.map(p => (
                      <option key={p.nome} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">AGÊNCIA PROMOTORA*</label>
                  <input
                    type="text"
                    readOnly
                    value={newAgencia}
                    className="w-full px-3 py-2 bg-gray-100 border rounded-xl focus:outline-none cursor-not-allowed text-gray-500 font-bold"
                    placeholder="Determinada automaticamente"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">DIAS DE ATENDIMENTO NA LOJA*</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {WEEKDAYS.map((day) => {
                    const isChecked = newDays.includes(day);
                    return (
                      <label key={day} className="flex items-center gap-1.5 cursor-pointer font-bold text-gray-700 select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDayAdd(day)}
                          className="rounded text-[#F58220] focus:ring-[#F58220]"
                        />
                        <span>{day}</span>
                      </label>
                    );
                  })}
                </div>
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
                  className="px-5 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md shadow-[#F58220]/15"
                >
                  Vincular Fornecedor
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- EDIT MODAL DIALOG (ADMIN ONLY) --- */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={() => setEditingSupplier(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-2">
              <Edit className="text-[#F58220] w-6 h-6" /> Alterar Dados de Atendimento
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Fabricante: <strong className="font-sans text-[#2F2F2F]">{editingSupplier.nomeIndustria}</strong>
              <span className="block mt-0.5">CNPJ: <strong className="font-mono">{editingSupplier.cnpjIndustria}</strong></span>
            </p>

            <form onSubmit={handleSaveEditSupplier} className="space-y-4 mt-5 text-left text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">PROMOTOR RESPONSÁVEL*</label>
                  <select
                    required
                    value={editPromotor}
                    onChange={(e) => handlePromoterChangeEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-bold"
                  >
                    {promoters.map(p => (
                      <option key={p.nome} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">AGÊNCIA PROMOTORA*</label>
                  <input
                    type="text"
                    readOnly
                    value={editAgencia}
                    className="w-full px-3 py-2 bg-gray-100 border rounded-xl focus:outline-none cursor-not-allowed text-gray-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">DIAS DE ATENDIMENTO NA LOJA*</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 font-medium">
                  {WEEKDAYS.map((day) => {
                    const isChecked = editDays.includes(day);
                    return (
                      <label key={day} className="flex items-center gap-1.5 cursor-pointer font-bold text-gray-700 select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDayEdit(day)}
                          className="rounded text-[#F58220] focus:ring-[#F58220]"
                        />
                        <span>{day}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-[11px] text-orange-800 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#F58220] shrink-0 mt-0.5" />
                <span>
                  <strong>Impacto Direto:</strong> Ao clicar em salvar, todos os produtos da Base Principal cadastrados sob o CNPJ <strong className="font-mono">{editingSupplier.cnpjIndustria}</strong> passarão a exibir as novas coordenadas de atendimento automaticamente.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md shadow-[#F58220]/25"
                >
                  Atualizar Dados
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
