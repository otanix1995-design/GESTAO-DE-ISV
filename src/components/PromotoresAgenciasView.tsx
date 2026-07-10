/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Promoter, Agency, User } from '../types';
import { 
  Contact, 
  Building2, 
  Plus, 
  Users, 
  CheckCircle, 
  UserPlus, 
  PhoneCall,
  Search,
  Check,
  X,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';

interface PromotoresAgenciasProps {
  promoters: Promoter[];
  setPromoters: (promoters: Promoter[]) => void;
  agencies: Agency[];
  setAgencies: (agencies: Agency[]) => void;
  currentUser: User;
  viewMode?: 'promotores' | 'agencias';
}

export default function PromotoresAgenciasView({
  promoters,
  setPromoters,
  agencies,
  setAgencies,
  currentUser,
  viewMode
}: PromotoresAgenciasProps) {
  const canManage = currentUser.role === 'Admin' || currentUser.role === 'Gestor';

  const [localActiveTab, setLocalActiveTab] = useState<'promotores' | 'agencias'>('promotores');
  const activeTab = viewMode || localActiveTab;
  const setActiveTab = (tab: 'promotores' | 'agencias') => {
    if (!viewMode) {
      setLocalActiveTab(tab);
    }
  };

  const [search, setSearch] = useState('');

  // Add Promoter Form State
  const [promoterName, setPromoterName] = useState('');
  const [promoterAg, setPromoterAg] = useState('');
  const [promoterPhone, setPromoterPhone] = useState('');
  const [isAddPromoterOpen, setIsAddPromoterOpen] = useState(false);

  // Add Agency Form State
  const [agencyName, setAgencyName] = useState('');
  const [agencyCnpj, setAgencyCnpj] = useState('');
  const [isAddAgencyOpen, setIsAddAgencyOpen] = useState(false);

  // Filter lists
  const filteredPromoters = useMemo(() => {
    return promoters.filter(p => 
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.agencia.toLowerCase().includes(search.toLowerCase())
    );
  }, [promoters, search]);

  const filteredAgencies = useMemo(() => {
    return agencies.filter(a => 
      a.nome.toLowerCase().includes(search.toLowerCase()) ||
      (a.cnpj && a.cnpj.includes(search))
    );
  }, [agencies, search]);

  // Handle add promoter
  const handleAddPromoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoterName || !promoterAg) {
      alert('Por favor, indique o Nome e a Agência do promotor.');
      return;
    }

    const exists = promoters.some(p => p.nome.toLowerCase() === promoterName.toLowerCase().trim());
    if (exists) {
      alert(`O promotor [${promoterName}] já está cadastrado em nosso sistema.`);
      return;
    }

    const newPromoter: Promoter = {
      nome: promoterName.trim(),
      agencia: promoterAg,
      contato: promoterPhone.trim() || '(45) 99999-0000',
      ativo: true
    };

    setPromoters([...promoters, newPromoter]);
    setPromoterName('');
    setPromoterAg('');
    setPromoterPhone('');
    setIsAddPromoterOpen(false);
  };

  // Handle add agency
  const handleAddAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyName) {
      alert('O Nome da agência marca campo obrigatório.');
      return;
    }

    const exists = agencies.some(a => a.nome.toLowerCase() === agencyName.toLowerCase().trim());
    if (exists) {
      alert(`A agência [${agencyName}] já existe nas tabelas.`);
      return;
    }

    const newAgency: Agency = {
      nome: agencyName.trim(),
      cnpj: agencyCnpj.trim() || 'Sem CNPJ'
    };

    setAgencies([...agencies, newAgency]);
    setAgencyName('');
    setAgencyCnpj('');
    setIsAddAgencyOpen(false);
  };

  // Handle delete promoter
  const handleDeletePromoter = (name: string) => {
    if (!canManage) return;
    if (window.confirm(`Deseja realmente excluir o promotor [${name}]?`)) {
      setPromoters(promoters.filter(p => p.nome !== name));
    }
  };

  // Handle delete agency
  const handleDeleteAgency = (name: string) => {
    if (!canManage) return;
    const linkedPromoters = promoters.filter(p => p.agencia.toLowerCase() === name.toLowerCase());
    if (linkedPromoters.length > 0) {
      alert(`Não é possível excluir a agência [${name}] porque ela possui ${linkedPromoters.length} promotor(es) associado(s). Por favor, remova ou transfira os promotores primeiro.`);
      return;
    }
    if (window.confirm(`Deseja realmente excluir a agência [${name}]?`)) {
      setAgencies(agencies.filter(a => a.nome !== name));
    }
  };

  // Toggle promoter status
  const togglePromoterStatus = (name: string) => {
    if (!canManage) return;
    setPromoters(promoters.map(p => {
      if (p.nome === name) {
        return { ...p, ativo: !p.ativo };
      }
      return p;
    }));
  };

  return (
    <div className="space-y-6" id="promotores-agencias-tab">
      
      {/* Tab Switch Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-display">
            {activeTab === 'promotores' ? 'Cadastro de Promotores' : 'Credenciamento de Agências'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'promotores' 
              ? 'Cadastre consultores independentes e promotores ativos de vendas na filial Atacadão.'
              : 'Faça o credenciamento e gestão de agências de publicidade externas autorizadas.'}
          </p>
        </div>

        {/* Tab Selector - only shown when not driven directly by sidebar viewMode */}
        {!viewMode && (
          <div className="flex bg-gray-150 p-1 rounded-xl border text-xs font-bold shrink-0">
            <button
              onClick={() => { setActiveTab('promotores'); setSearch(''); }}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'promotores' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Contact className="w-4 h-4 text-[#F58220]" /> Promotores Cadastrados ({promoters.length})
            </button>
            <button
              onClick={() => { setActiveTab('agencias'); setSearch(''); }}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'agencias' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#F58220]" /> Credenciamento Agências ({agencies.length})
            </button>
          </div>
        )}
      </div>

      {/* FILTER SHEETS BAR */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'promotores' 
                ? "Busque promotores pelo nome ou agência afiliada..."
                : "Busque agências pelo nome ou CNPJ registrado..."
            }
            className="text-xs w-full pl-9 pr-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F58220]/20"
          />
        </div>

        {canManage && (
          <button
            onClick={() => activeTab === 'promotores' ? setIsAddPromoterOpen(true) : setIsAddAgencyOpen(true)}
            className="px-4 py-2.5 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl text-xs font-black shadow-md shadow-[#F58220]/15 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {activeTab === 'promotores' ? 'Novo Promotor' : 'Nova Agência'}
          </button>
        )}
      </div>

      {activeTab === 'promotores' ? (
        /* PROMOTERS GRID GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromoters.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400 text-xs font-medium bg-white rounded-2xl border">
              Nenhum promotor cadastrado corresponde aos filtros ativos.
            </div>
          ) : (
            filteredPromoters.map((p) => {
              return (
                <div key={p.nome} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between h-44">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className={`p-2.5 rounded-xl shrink-0 ${p.ativo ? 'bg-[#F58220]/10 text-[#F58220]' : 'bg-gray-100 text-gray-400'}`}>
                        <Contact className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[#2F2F2F] text-sm truncate">{p.nome}</h4>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block truncate">{p.agencia}</span>
                      </div>
                    </div>
                    
                    {/* Status Toggle Box & Delete button */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        disabled={!canManage}
                        onClick={() => togglePromoterStatus(p.nome)}
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border transition-all ${
                          p.ativo 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                            : 'bg-red-50 border-red-200 text-red-750 hover:bg-red-100'
                        } disabled:opacity-85`}
                      >
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      
                      {canManage && (
                        <button
                          onClick={() => handleDeletePromoter(p.nome)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          title="Apagar Promotor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inner contact information */}
                  <div className="border-t pt-3 flex items-center justify-between text-xs text-gray-500 font-mono">
                    <div className="flex items-center gap-1.5 font-bold">
                      <PhoneCall className="w-3.5 h-3.5 text-gray-400" />
                      <span>{p.contato || '(45) 99831-2911'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* AGENCIES LISTING TABLE */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider select-none">
                  <th className="p-4">Credencial Agência</th>
                  <th className="p-4">CNPJ Declarado</th>
                  <th className="p-4">Consultores Ativos Associados</th>
                  <th className="p-4 text-center">Status</th>
                  {canManage && <th className="p-4 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="text-center py-12 text-gray-400 font-medium">
                      Nenhuma agência credenciada para esta busca.
                    </td>
                  </tr>
                ) : (
                  filteredAgencies.map((a) => {
                    const linkedPromoters = promoters.filter(p => p.agencia.toLowerCase() === a.nome.toLowerCase());
                    return (
                      <tr key={a.nome} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#F58220] shrink-0" />
                          <span>{a.nome}</span>
                        </td>
                        <td className="p-4 font-mono text-gray-500 font-semibold">{a.cnpj || 'Sob-Análise'}</td>
                        <td className="p-4 font-medium text-gray-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-[#2F2F2F] bg-gray-100 px-2 py-0.5 rounded-md text-xs font-mono">{linkedPromoters.length}</span>
                            <span className="text-gray-400 text-[10px]">
                              ({linkedPromoters.map(p => p.nome).join(', ') || 'Nenhum promotor ativado'})
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-100">
                            Autorizada
                          </span>
                        </td>
                        {canManage && (
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteAgency(a.nome)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100 inline-flex items-center"
                              title="Apagar Agência"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ADD PROMOTER MODAL --- */}
      {isAddPromoterOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 relative"
          >
            <button 
              onClick={() => setIsAddPromoterOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-2">
              <UserPlus className="text-[#F58220] w-6 h-6" /> Cadastrar Novo Promotor
            </h3>
            
            <form onSubmit={handleAddPromoter} className="space-y-4 mt-5 text-left text-xs font-medium text-gray-700">
              <div>
                <label className="block font-bold mb-1">NOME DO PROMOTOR*</label>
                <input
                  type="text"
                  required
                  value={promoterName}
                  onChange={(e) => setPromoterName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold"
                  placeholder="Nome completo do agente"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">AGÊNCIA DE AFILIAÇÃO*</label>
                <select
                  required
                  value={promoterAg}
                  onChange={(e) => setPromoterAg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold"
                >
                  <option value="">Selecione a agência...</option>
                  {agencies.map(a => (
                    <option key={a.nome} value={a.nome}>{a.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">CELULAR / CONTATO (Celular PR)</label>
                <input
                  type="text"
                  value={promoterPhone}
                  onChange={(e) => setPromoterPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono text-xs font-bold"
                  placeholder="(45) 99999-0000"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddPromoterOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md shadow-[#F58220]/20"
                >
                  Salvar Promotor
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- ADD AGENCY MODAL --- */}
      {isAddAgencyOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 relative"
          >
            <button 
              onClick={() => setIsAddAgencyOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-2">
              <Building2 className="text-[#F58220] w-6 h-6" /> Credenciar Nova Agência
            </h3>
            
            <form onSubmit={handleAddAgency} className="space-y-4 mt-5 text-left text-xs font-medium text-gray-700">
              <div>
                <label className="block font-bold mb-1">NOME DA AGÊNCIA (REGISTRO)*</label>
                <input
                  type="text"
                  required
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] text-xs font-bold text-gray-900"
                  placeholder="EX. Agência Master Cascavel"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">CNPJ DA AGÊNCIA PROMOTORA</label>
                <input
                  type="text"
                  value={agencyCnpj}
                  onChange={(e) => setAgencyCnpj(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F58220] font-mono text-xs font-bold"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddAgencyOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F58220] hover:bg-[#F58220]/90 text-white rounded-xl font-black shadow-md"
                >
                  Salvar Agência
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
