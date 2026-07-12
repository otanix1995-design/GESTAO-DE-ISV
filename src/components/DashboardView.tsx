/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Supplier, Promoter, Agency, User, SystemStats } from '../types';
import { computeProductDerived, calculateSystemStats } from '../mockData';
import { 
  Building2, 
  Users2, 
  AlertOctagon, 
  AlertTriangle, 
  PackageSearch,
  CheckCircle, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ArrowDownRight,
  Sparkles,
  Sliders,
  Info,
  Search,
  X,
  Printer,
  Copy,
  FileText,
  Download,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  products: Product[];
  suppliers: Supplier[];
  promoters: Promoter[];
  agencies: Agency[];
  currentUser: User;
  stats: SystemStats;
}

export default function DashboardView({ products, suppliers, promoters, agencies, currentUser, stats }: DashboardProps) {
  const isPromotor = currentUser.role === 'Promotor';

  // State for filtering and modal drilldown
  const [selectedSector, setSelectedSector] = useState<'TODOS' | 'FRIOS' | 'HORT_FRUT' | 'LOJA'>('TODOS');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Compute derived products
  const productsDerived = useMemo(() => {
    return products.map(p => computeProductDerived(p, suppliers));
  }, [products, suppliers]);

  // Pre-calculated sector totals for the filter pill badges
  const sectorCounts = useMemo(() => {
    let list = productsDerived;
    if (isPromotor && currentUser.promoterName) {
      list = list.filter(p => p.promotor.toLowerCase() === currentUser.promoterName?.toLowerCase());
    }
    
    let frios = 0;
    let hortFrut = 0;
    let loja = 0;
    
    list.forEach(p => {
      const desc = (p.product?.descricao || '').toUpperCase();
      if (desc.startsWith('RF.')) {
        frios++;
      } else if (desc.startsWith('HF.')) {
        hortFrut++;
      } else {
        loja++;
      }
    });
    
    return {
      TODOS: list.length,
      FRIOS: frios,
      HORT_FRUT: hortFrut,
      LOJA: loja
    };
  }, [productsDerived, isPromotor, currentUser.promoterName]);

  // Compute status metrics based on role view filters AND active sector filter
  const filteredProducts = useMemo(() => {
    let list = productsDerived;
    if (isPromotor && currentUser.promoterName) {
      list = list.filter(p => p.promotor.toLowerCase() === currentUser.promoterName?.toLowerCase());
    }
    
    if (selectedSector === 'FRIOS') {
      list = list.filter(p => (p.product?.descricao || '').toUpperCase().startsWith('RF.'));
    } else if (selectedSector === 'HORT_FRUT') {
      list = list.filter(p => (p.product?.descricao || '').toUpperCase().startsWith('HF.'));
    } else if (selectedSector === 'LOJA') {
      list = list.filter(p => {
        const desc = (p.product?.descricao || '').toUpperCase();
        return !desc.startsWith('RF.') && !desc.startsWith('HF.');
      });
    }
    
    return list;
  }, [productsDerived, isPromotor, currentUser.promoterName, selectedSector]);

  // Description prefix colorizer
  const formatProductDesc = (desc: string) => {
    const text = desc || '';
    if (text.startsWith('RF.')) {
      return <span className="text-blue-600 font-semibold">{text}</span>;
    } else if (text.startsWith('HF.')) {
      return <span className="text-emerald-600 font-semibold">{text}</span>;
    } else {
      return <span className="text-gray-800 font-medium">{text}</span>;
    }
  };

  // Top 20 products sorted by stock valuation
  const top20ValueProducts = useMemo(() => {
    return [...filteredProducts]
      .sort((a, b) => b.valorEstoque - a.valorEstoque)
      .slice(0, 20);
  }, [filteredProducts]);

  // List of products specifically for Abastecer Gôndola print-only PDF layout
  const printProducts = useMemo(() => {
    let list = filteredProducts.filter(p => p.status === 'Abastecer' && !p.isPossivelAjuste);
    if (selectedCard === 'abastecer' && modalSearch) {
      const s = modalSearch.toLowerCase();
      list = list.filter(p => {
        return (p.product?.codigo || '').toLowerCase().includes(s) ||
               (p.product?.descricao || '').toLowerCase().includes(s) ||
               p.nomeIndustria.toLowerCase().includes(s);
      });
    }
    return list;
  }, [filteredProducts, selectedCard, modalSearch]);

  const handleCopyTop20 = () => {
    let tsv = "Rank\tCódigo\tDescrição\tSetor\tEstoque\tCusto Médio\tValor Estoque\n";
    top20ValueProducts.forEach((p, idx) => {
      const desc = p.product?.descricao || '';
      let sector = 'LOJA';
      if (desc.startsWith('RF.')) sector = 'FRIOS';
      else if (desc.startsWith('HF.')) sector = 'HORT FRUT';
      const custo = p.product?.custoMedio || 0;
      tsv += `${idx + 1}\t${p.product?.codigo || ''}\t${desc}\t${sector}\t${p.estoqueTotal}\tR$ ${custo.toFixed(2)}\tR$ ${p.valorEstoque.toFixed(2)}\n`;
    });
    
    navigator.clipboard.writeText(tsv)
      .then(() => {
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2500);
      })
      .catch(err => console.error("Erro ao copiar:", err));
  };

  // Recalculate operational breakdown for view
  const dashboardStats = useMemo(() => {
    const total = filteredProducts.length;
    const rupturas = filteredProducts.filter(p => p.status === 'Ruptura' && !p.isPossivelAjuste).length;
    const atencao = filteredProducts.filter(p => p.status === 'Atenção' && !p.isPossivelAjuste).length;
    const abastecer = filteredProducts.filter(p => p.status === 'Abastecer' && !p.isPossivelAjuste).length;
    const normais = filteredProducts.filter(p => p.status === 'Normal' && !p.isPossivelAjuste).length;
    const ajustes = filteredProducts.filter(p => p.isPossivelAjuste).length;
    const valorTotal = filteredProducts.reduce((acc, curr) => acc + curr.valorEstoque, 0);

    return {
      total,
      rupturas,
      atencao,
      abastecer,
      normais,
      ajustes,
      valorTotal
    };
  }, [filteredProducts]);

  // --- CHART 1: RUPTURAS POR FORNECEDOR ---
  const rupturasPorFornecedor = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProducts.forEach(p => {
      if (p.status === 'Ruptura') {
        const rawName = p.nomeIndustria || p.product?.nomeIndustria || 'Sem Cadastro';
        const name = String(rawName).split('(')[0].trim() || 'Indefinida';
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredProducts]);

  // --- CHART 2: RUPTURAS POR PROMOTOR ---
  const rupturasPorPromotor = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProducts.forEach(p => {
      if (p.status === 'Ruptura') {
        const name = p.promotor === 'Sem Cadastro' ? 'Sem Promotor' : p.promotor;
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredProducts]);

  // --- CHART 3: RUPTURAS POR AGÊNCIA ---
  const rupturasPorAgencia = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProducts.forEach(p => {
      if (p.status === 'Ruptura') {
        const name = p.agencia === 'Sem Cadastro' ? 'Sem Agência' : p.agencia;
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredProducts]);

  // --- CHART 4: TOP FORNECEDORES ---
  // If Admin/Gestor: Top by Stock Valuation. If Promoter: Top by Product count.
  const topFornecedoresData = useMemo(() => {
    if (isPromotor) {
      // By total catalog count matching
      const counts: Record<string, number> = {};
      filteredProducts.forEach(p => {
        const rawName = p.nomeIndustria || p.product?.nomeIndustria || 'Sem Cadastro';
        const name = String(rawName).split('(')[0].trim() || 'Indefinida';
        counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, val]) => ({ name, value: val, unit: 'itens' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    } else {
      // By stock valuation
      const valMap: Record<string, number> = {};
      filteredProducts.forEach(p => {
        const rawName = p.nomeIndustria || p.product?.nomeIndustria || 'Sem Cadastro';
        const name = String(rawName).split('(')[0].trim() || 'Indefinida';
        valMap[name] = (valMap[name] || 0) + p.valorEstoque;
      });
      return Object.entries(valMap)
        .map(([name, val]) => ({ name, value: val, unit: 'BRL' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    }
  }, [filteredProducts, isPromotor]);

  // --- CHART 5: TOP PROMOTORES ---
  // Grouped by active promoters performance
  const topPromotoresData = useMemo(() => {
    const activeMap: Record<string, { total: number; ruptures: number }> = {};
    filteredProducts.forEach(p => {
      const name = p.promotor === 'Sem Cadastro' ? 'Sem Promotor' : p.promotor;
      if (!activeMap[name]) {
        activeMap[name] = { total: 0, ruptures: 0 };
      }
      activeMap[name].total += 1;
      if (p.status === 'Ruptura') {
        activeMap[name].ruptures += 1;
      }
    });

    return Object.entries(activeMap)
      .map(([name, stats]) => {
        const rate = stats.total > 0 ? (stats.ruptures / stats.total) * 100 : 0;
        // Operational Index: higher is better (e.g. 100 - Rupture Rate)
        const perfIndex = Math.max(0, Math.round(100 - rate));
        return { name, value: perfIndex, suffix: '%' };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredProducts]);

  // --- CHART 6: RANKING DE OCORRÊNCIAS ---
  const occurrencesData = useMemo(() => {
    return [
      { name: 'Normal', count: dashboardStats.normais, color: 'bg-green-500', barColor: '#22c55e', description: 'Estoques em condições saudáveis' },
      { name: 'Ruptura', count: dashboardStats.rupturas, color: 'bg-[#F25C54]', barColor: '#F25C54', description: 'Item sem saldo de estoque (estoque total = 0)' },
      { name: 'Abastecer', count: dashboardStats.abastecer, color: 'bg-[#F58220]', barColor: '#F58220', description: 'Indisponível em unidades avulsas' },
      { name: 'Atenção', count: dashboardStats.atencao, color: 'bg-[#FFC72C]', barColor: '#FFC72C', description: 'Restante apenas em unidades avulsas' },
      { name: 'Ajuste', count: dashboardStats.ajustes, color: 'bg-indigo-400', barColor: '#818cf8', description: 'Valor financeiro baixo (< R$ 200)' }
    ].sort((a, b) => b.count - a.count);
  }, [dashboardStats]);

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-tab">
      {/* Promoter Scope Warning or Success Banner */}
      {isPromotor && (
        <div className="bg-[#FFF8F2] border border-[#F58220]/20 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
          <div className="bg-[#F58220]/10 p-2 rounded-lg text-[#F58220] shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 font-display">Acesso Operacional de Promitente</h4>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed font-sans">
              Você está logado como promotor <strong className="text-[#F58220]">{currentUser.promoterName}</strong>. Os dados exibidos abaixo são automaticamente filtrados para os seus fornecedores atendidos e produtos vinculados. Ativos confidenciais, custos e valores financeiros estão ocultados para segurança de dados.
            </p>
          </div>
        </div>
      )}

      {/* --- DEPARTMENT / SECTOR GLOBAL FILTER --- */}
      <div className="bg-white p-5 rounded-3xl border-2 border-gray-100/90 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-gray-850 font-display flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#F58220]" />
              Filtro por Setor / Departamento
            </h3>
            <p className="text-[11px] text-gray-500 font-sans mt-0.5">
              Filtre instantaneamente todos os painéis, estatísticas de rupturas e rankings da loja.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSector('TODOS')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                selectedSector === 'TODOS'
                  ? 'bg-[#F58220] text-white shadow-md shadow-[#F58220]/15'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200/60'
              }`}
            >
              🏢 Todos os Setores
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${selectedSector === 'TODOS' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {sectorCounts.TODOS}
              </span>
            </button>
            
            <button
              onClick={() => setSelectedSector('FRIOS')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                selectedSector === 'FRIOS'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                  : 'bg-blue-50/50 hover:bg-blue-50 text-blue-700 border border-blue-200/60'
              }`}
            >
              ❄️ FRIOS (RF.)
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${selectedSector === 'FRIOS' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {sectorCounts.FRIOS}
              </span>
            </button>
            
            <button
              onClick={() => setSelectedSector('HORT_FRUT')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                selectedSector === 'HORT_FRUT'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15'
                  : 'bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              }`}
            >
              🥦 HORT FRUT (HF.)
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${selectedSector === 'HORT_FRUT' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                {sectorCounts.HORT_FRUT}
              </span>
            </button>
            
            <button
              onClick={() => setSelectedSector('LOJA')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                selectedSector === 'LOJA'
                  ? 'bg-zinc-700 text-white shadow-md shadow-zinc-700/15'
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/60'
              }`}
            >
              📦 LOJA (Outros)
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${selectedSector === 'LOJA' ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                {sectorCounts.LOJA}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD STATISTICS CARDS GRID --- */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-4 font-display">
          Painel de Indicadores Operacionais {isPromotor && '− Filtrado'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Total de Produtos - Double Width Bento Card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('products'); setModalSearch(''); }}
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 md:col-span-2 relative overflow-hidden group select-none"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#F58220]/5 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-500"></div>
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-sans">Catálogo de Produtos</span>
              <div className="text-4xl font-extrabold text-[#2F2F2F] tracking-tight font-display mt-2 mb-1 flex items-baseline gap-2">
                <span className="font-mono">{dashboardStats.total}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-sans tracking-normal">Ativos</span>
              </div>
              <p className="text-[11px] text-gray-500 font-sans">Mapeamento em vigor na filial Cascavel (F172) sob responsabilidade.</p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-[#F58220] font-bold group-hover:underline">Ver catálogo completo →</span>
              <div className="bg-[#64748b]/10 p-2.5 rounded-2xl text-[#64748b] group-hover:bg-[#64748b]/20 transition-colors">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          {/* Total de Fornecedores - Single Width Bento Card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('suppliers'); setModalSearch(''); }}
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 group select-none"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-sans">Fabricantes Vinculados</span>
              <div className="text-3xl font-black text-[#2F2F2F] tracking-tight mt-2 font-mono">
                {isPromotor ? [...new Set(filteredProducts.map(p => p.cnpjIndustria))].length : stats.totalFornecedores}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 font-sans">CNPJs ativos sob atendimento direto.</p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-[#F58220] font-bold group-hover:underline">Ver indústrias →</span>
              <div className="bg-[#F58220]/10 p-2.5 rounded-2xl text-[#F58220] group-hover:bg-[#F58220]/20 transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </motion.div>

          {/* Organização Operacional (Promotores & Agências) - Single Width Bento Card (Deep Black Theme) */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('promoters'); setModalSearch(''); }}
            className="bg-[#2F2F2F] text-white p-6 rounded-3xl shadow-lg shadow-gray-900/10 flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 group relative overflow-hidden select-none"
          >
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-[#F58220]/15 to-transparent rounded-full -mb-6 -mr-6"></div>
            <div>
              <span className="text-[10px] font-extrabold text-[#F58220] uppercase tracking-widest font-sans">Operações na Filial</span>
              <div className="text-3xl font-extrabold text-white tracking-tight mt-2 font-display">
                <span className="font-mono">{isPromotor ? 1 : stats.totalPromotores}</span> <span className="text-sm text-gray-400 font-medium">Promotores</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 font-sans">
                {isPromotor ? 'Atendimento próprio' : `Distribuídos em ${stats.totalAgencias} agências parceiras.`}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
              <span className="text-[10px] text-[#F58220] font-bold group-hover:underline">Ver equipes →</span>
              <div className="bg-[#F58220] text-white p-2.5 rounded-2xl group-hover:bg-orange-500 transition-colors">
                <Users2 className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* --- INVENTORY ALERT TARGET CARDS GRID --- */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-4 font-display">
          Operação Prioritária (Valor Estoque ≥ R$ 200,00)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total de Rupturas - Double Bento Card in primary brand orange color */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('rupturas'); setModalSearch(''); }}
            className="bg-[#F58220] text-white p-6 rounded-3xl shadow-xl shadow-[#F58220]/15 flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 relative overflow-hidden group col-span-1 md:col-span-2 select-none"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-500"></div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 font-sans">Alerta de Ruptura Crítica</span>
                <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase">Imediato</span>
              </div>
              <div className="text-3xl font-extrabold mt-3 font-display flex items-baseline gap-2">
                <span className="font-mono text-4xl">{dashboardStats.rupturas}</span>
                <span className="text-sm font-medium text-white/90 font-sans tracking-normal">Itens com zero estoque</span>
              </div>
              <p className="text-[11px] text-white/80 mt-1 font-sans">Ambas embalagens (Fardo e Unitário) zeradas na filial Cascavel.</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
              <span className="text-[10px] text-orange-100 font-bold group-hover:underline">Ver rupturas críticas em detalhe →</span>
              <AlertOctagon className="w-6 h-6 text-white animate-bounce" />
            </div>
          </motion.div>

          {/* Total de Atenção - Warning Yellow Bento Card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('atencao'); setModalSearch(''); }}
            className="bg-[#FFC72C] text-[#2F2F2F] p-6 rounded-3xl shadow-md shadow-amber-200/10 border-2 border-amber-300/30 flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 group select-none"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-800 uppercase tracking-widest font-sans">Atenção Fracionada</span>
              <div className="text-3xl font-black mt-2 font-mono">{dashboardStats.atencao}</div>
              <p className="text-[11px] text-gray-800 mt-1 font-sans">Fardo fechado zerado, restam apenas unidades avulsas na área de venda.</p>
            </div>
            <div className="flex items-center justify-between border-t border-black/10 pt-4 mt-6">
              <span className="text-[10px] text-gray-850 font-bold group-hover:underline">Ver itens em alerta →</span>
              <AlertTriangle className="w-5 h-5 text-gray-850" />
            </div>
          </motion.div>

          {/* Total de Abastecer - Clean crisp bento card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            onClick={() => { setSelectedCard('abastecer'); setModalSearch(''); }}
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/95 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 group select-none"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-sans">Abastecer Gôndola</span>
              <div className="text-3xl font-black text-gray-850 mt-2 font-mono">{dashboardStats.abastecer}</div>
              <p className="text-[11px] text-gray-500 mt-1 font-sans">Fardo com estoque, mas unidade da gôndola está indisponível.</p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-[#F58220] font-bold group-hover:underline">Gerar relatórios de valor →</span>
              <div className="bg-orange-50 text-orange-500 p-2 rounded-xl group-hover:bg-orange-100 transition-colors">
                <PackageSearch className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* --- EXTRA COMBINED ROW: POSSÍVEIS AJUSTES & FINANCE (Bento Arrangement) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Possíveis Ajustes - Double Width Bento Card */}
        <motion.div 
          variants={cardVariants} 
          initial="hidden" 
          animate="visible" 
          onClick={() => { setSelectedCard('ajustes'); setModalSearch(''); }}
          className="bg-white p-6 rounded-3xl border-2 border-indigo-50/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 lg:col-span-2 group select-none"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest font-sans">Baixa Relevância Financeira</span>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">Aproveitável</span>
            </div>
            <div className="text-3xl font-black text-[#2F2F2F] tracking-tight mt-2 font-mono">
              {dashboardStats.ajustes} <span className="text-sm text-gray-400 font-sans font-medium">Possíveis Ajustes</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 font-sans leading-relaxed">
              Mapeia itens com estoque de baixo valor absoluto (&lt; R$ 200,00). Focado em otimizar e agilizar o trânsito interno sem onerar o capital de giro geral da loja.
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
            <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">Ver possíveis ajustes em detalhe →</span>
            <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-2xl group-hover:bg-indigo-100 transition-colors">
              <Sliders className="w-5 h-5" />
            </div>
          </div>
        </motion.div>

        {/* --- CONFIDENTIAL FINANCIAL VALUATION DISPLAY (HIDDEN FROM PROMOTOR) --- */}
        {!isPromotor ? (
          <motion.div 
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={() => { setSelectedCard('finance'); setModalSearch(''); }}
            className="bg-gradient-to-br from-[#2F2F2F] to-[#1F1F1F] text-white rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-900/10 lg:col-span-2 relative overflow-hidden hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-300 group select-none"
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-radial from-[#F58220]/10 to-transparent rounded-full -mt-8 -mr-8"></div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-[#F58220]/15 text-[#F58220] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" /> Ativo de Giro de Estoque Confidencial
              </div>
              <h3 className="text-3xl font-black text-white font-display mt-3 tracking-tight">
                R$ {dashboardStats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-gray-400 mt-2 font-sans leading-relaxed">
                Representação do valor financeiro de produtos cadastrados, calculando: <code className="text-gray-300 bg-white/5 px-1 py-0.5 rounded">estoque total × custo médio</code> indexado nas importações Cascavel.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 mt-6">
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase font-black">Saudáveis</div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {Math.round((dashboardStats.normais / (dashboardStats.total || 1)) * 100)}%
                </div>
                <div className="text-[9px] text-gray-450">Fração saídas normais</div>
              </div>

              <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase font-black">Anomalias</div>
                <div className="text-lg font-black text-red-400 font-mono">
                  {Math.round(((dashboardStats.rupturas + dashboardStats.abastecer + dashboardStats.atencao) / (dashboardStats.total || 1)) * 100)}%
                </div>
                <div className="text-[9px] text-gray-450 text-ellipsis overflow-hidden whitespace-nowrap">Rupturas/Abastecimentos</div>
              </div>
            </div>
            
            <div className="text-right text-[10px] text-[#F58220] font-bold mt-4 group-hover:underline">
              Ver ranking financeiro completo →
            </div>
          </motion.div>
        ) : (
          <div className="bg-[#FFF8F2] border-2 border-dashed border-[#F58220]/20 rounded-3xl p-6 lg:col-span-2 flex flex-col justify-center items-center text-center">
            <ShieldAlert className="w-8 h-8 text-[#F58220]/75 mb-2" />
            <span className="text-xs font-bold text-gray-700 font-sans">Bloqueio Operacional de Segurança</span>
            <p className="text-[11px] text-gray-500 mt-1 max-w-xs font-sans">Ativos, relatórios monetários de compra e custos médios ocultos para proteção de dados corporativos da loja.</p>
          </div>
        )}
      </div>

      {/* --- GRAPHICS BENTO GRID --- */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-4 font-display">
          Análises Gráficas de Desempenho e Rupturas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 1. RUPTURAS POR FORNECEDOR */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">Rupturas por Indústria</h3>
                <span className="text-[9px] bg-red-150 text-red-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">Top Alvos</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">Fração absoluta de itens identificados sem estoque na base principal.</p>
            </div>
            
            <div className="space-y-4">
              {rupturasPorFornecedor.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 font-sans">Nenhuma ruptura registrada neste escopo regional.</div>
              ) : (
                rupturasPorFornecedor.map((item, index) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 truncate max-w-[280px] font-sans">{index + 1}. {item.name}</span>
                      <span className="font-mono text-gray-900 font-bold">{item.count} itens</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#F25C54] h-full rounded-full" style={{ width: `${Math.min(100, (item.count / 10) * 100)}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. RUPTURAS POR PROMOTOR */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">Rupturas por Promotor</h3>
                <span className="text-[9px] bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">Atendimento</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">Ocorrências localizadas em roteiro ativo por supervisor.</p>
            </div>

            <div className="space-y-4">
              {rupturasPorPromotor.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-sans">Nenhuma ruptura identificada sob promotores.</div>
              ) : (
                rupturasPorPromotor.map((item, index) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-705 font-sans">{index + 1}. {item.name}</span>
                      <span className="font-mono text-gray-900 font-bold">{item.count} anomalias</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FFC72C] h-full rounded-full" style={{ width: `${Math.min(100, (item.count / 10) * 100)}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. RUPTURAS POR AGÊNCIA */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">Rupturas de Agências</h3>
                <span className="text-[9px] bg-sky-100 text-sky-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans font-sans">Terceirizados</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">Distribuição de ausências registradas por prestador.</p>
            </div>

            <div className="space-y-4">
              {rupturasPorAgencia.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-sans">Sem anomalias sob agências externas.</div>
              ) : (
                rupturasPorAgencia.map((item, index) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 truncate max-w-[150px] font-sans">{index + 1}. {item.name}</span>
                      <span className="font-mono text-gray-900 font-bold">{item.count} itens</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count / 10) * 100)}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. TOP FORNECEDORES */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">
                  {isPromotor ? 'Rank de Itens por Indústria' : 'Top Fornecedores por Valor'}
                </h3>
                <span className="text-[9px] bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">Ativo</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">
                {isPromotor ? 'As indústrias que contêm mais itens cadastrados' : 'Valores somados de estoque de produtos em loja.'}
              </p>
            </div>

            <div className="space-y-4">
              {topFornecedoresData.map((item, index) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-700 truncate max-w-[150px] font-sans">{index + 1}. {item.name}</span>
                    <span className="font-mono text-gray-950 font-bold">
                      {item.unit === 'BRL' ? `R$ ${item.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : `${item.value} Itens`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#F58220] h-full rounded-full" style={{ width: `${Math.min(100, (item.value / (isPromotor ? 10 : 15000)) * 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. TOP PROMOTORES */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">Eficiência de Promotores</h3>
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">Equipes</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">Percentual de gôndolas abastecidas sem rupturas registradas.</p>
            </div>

            <div className="space-y-4">
              {topPromotoresData.map((item, index) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-700 font-sans">{index + 1}. {item.name}</span>
                    <span className="font-mono text-emerald-600 font-bold">{item.value}{item.suffix}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${item.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. RANKING DE OCORRÊNCIAS */}
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:border-[#F58220]/25 transition-all duration-300 lg:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-gray-900 font-display">Ocorrências de Monitoramento</h3>
                <span className="text-[9px] bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">Incidência</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mb-5 font-sans">Geral de estoques da filial agrupados por classificação operacional.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {occurrencesData.map((item) => {
                const pct = dashboardStats.total > 0 ? Math.round((item.count / dashboardStats.total) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between gap-4 bg-gray-50/50 hover:bg-gray-50 p-3 rounded-2xl border transition-all">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${item.color} shrink-0`}></span>
                      <div className="text-left font-sans">
                        <span className="text-xs font-bold text-gray-800">{item.name}</span>
                        <div className="text-[9px] text-gray-450 max-w-[150px] truncate">{item.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-sans font-extrabold text-xs text-gray-900 pr-1">{item.count}</span>
                      <span className="text-[10px] font-mono text-gray-400 font-bold">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {selectedCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-gray-50 border-b border-gray-100 p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#F58220]/10 p-2.5 rounded-2xl text-[#F58220]">
                    {selectedCard === 'products' && <Layers className="w-5 h-5" />}
                    {selectedCard === 'suppliers' && <Building2 className="w-5 h-5" />}
                    {selectedCard === 'promoters' && <Users2 className="w-5 h-5" />}
                    {selectedCard === 'rupturas' && <AlertOctagon className="w-5 h-5" />}
                    {selectedCard === 'atencao' && <AlertTriangle className="w-5 h-5" />}
                    {selectedCard === 'abastecer' && <PackageSearch className="w-5 h-5" />}
                    {selectedCard === 'ajustes' && <Sliders className="w-5 h-5" />}
                    {selectedCard === 'finance' && <DollarSign className="w-5 h-5" />}
                    {selectedCard === 'top20_value' && <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-display">
                      {selectedCard === 'products' && 'Catálogo Completo de Produtos'}
                      {selectedCard === 'suppliers' && 'Cadastro de Fabricantes/Fornecedores'}
                      {selectedCard === 'promoters' && 'Promotores e Agências Cadastrados'}
                      {selectedCard === 'rupturas' && 'Relação de Rupturas Críticas'}
                      {selectedCard === 'atencao' && 'Itens em Atenção Fracionada'}
                      {selectedCard === 'abastecer' && 'Itens para Abastecer Gôndola'}
                      {selectedCard === 'ajustes' && 'Lista de Possíveis Ajustes Operacionais'}
                      {selectedCard === 'finance' && 'Ranking Financeiro de Estoque'}
                      {selectedCard === 'top20_value' && 'Relatório Oficial: Top 20 Maiores Itens por Valor de Estoque'}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-sans">
                      {selectedCard === 'products' && 'Relação completa de todos os SKUs mapeados no sistema.'}
                      {selectedCard === 'suppliers' && 'Indústrias integradas e promotores associados.'}
                      {selectedCard === 'promoters' && 'Gestão de equipes e canais ativos na filial.'}
                      {selectedCard === 'rupturas' && 'Itens com estoque zerado no fardo e na unidade.'}
                      {selectedCard === 'atencao' && 'Risco iminente de ruptura. Fardo zerado na área de venda.'}
                      {selectedCard === 'abastecer' && 'Fardo em estoque. Necessário transporte para a gôndola física.'}
                      {selectedCard === 'ajustes' && 'Itens com estoque de baixo valor financeiro geral (< R$ 200).'}
                      {selectedCard === 'finance' && 'Valores absolutos ordenados do maior para o menor.'}
                      {selectedCard === 'top20_value' && `Exibindo os 20 produtos com maior capital de giro estocado no setor: ${selectedSector}`}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setSelectedCard(null); setModalSearch(''); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Special Actions inside Abastecer Gôndola */}
              {selectedCard === 'abastecer' && (
                <div className="mt-4 bg-orange-50 border border-orange-200/50 rounded-2xl p-3 flex flex-col lg:flex-row items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#F58220] shrink-0" />
                    <span className="text-xs font-bold text-orange-950">Ações de Abastecimento</span>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
                    <button
                      onClick={() => { setSelectedCard('top20_value'); setModalSearch(''); }}
                      className="flex-1 sm:flex-none bg-orange-100 hover:bg-orange-200 text-orange-850 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-orange-300/30 font-sans"
                    >
                      <FileText className="w-4 h-4" />
                      Relatório Top 20 Valor
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex-1 sm:flex-none bg-[#F58220] hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      <Printer className="w-4 h-4 text-white" />
                      Imprimir PDF de Abastecimento
                    </button>
                  </div>
                </div>
              )}

              {/* Special Banner inside top20_value for actions */}
              {selectedCard === 'top20_value' && (
                <div className="mt-4 bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-blue-950">
                      Totalizador do Relatório: R$ {top20ValueProducts.reduce((acc, curr) => acc + curr.valorEstoque, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleCopyTop20}
                      className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-white animate-pulse" />
                          Copiado para Excel!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar Tabela (Excel)
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setSelectedCard('abastecer'); }}
                      className="flex-1 sm:flex-initial bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar ao Abastecimento
                    </button>
                  </div>
                </div>
              )}

              {/* Search Bar (Omit for promoter and top20_value, as it is a structured list) */}
              {selectedCard !== 'top20_value' && selectedCard !== 'promoters' && (
                <div className="relative mt-4">
                  <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por descrição do produto, código ou fabricante..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#F58220] transition-all"
                  />
                  {modalSearch && (
                    <button 
                      onClick={() => setModalSearch('')} 
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-450 hover:text-gray-650 text-xs font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto p-6 flex-1 min-h-0 bg-white">
              
              {/* Conditional Modal Table Content */}

              {/* 1. PRODUCTS */}
              {selectedCard === 'products' && (() => {
                const list = filteredProducts.filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum produto correspondente.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição</th>
                        <th className="pb-3 pr-2">Embalagem</th>
                        <th className="pb-3 pr-4">Indústria/Fornecedor</th>
                        <th className="pb-3 pr-2 text-right">Estoque</th>
                        {!isPromotor && <th className="pb-3 pr-2 text-right">Custo Médio</th>}
                        {!isPromotor && <th className="pb-3 text-right">Val. Estoque</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(p => (
                        <tr key={p.product?.codigo} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-2 text-gray-500">{p.product?.embalagem}</td>
                          <td className="py-3 pr-4 text-gray-600 font-medium truncate max-w-[180px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-semibold text-gray-900">{p.estoqueTotal}</td>
                          {!isPromotor && <td className="py-3 pr-2 text-right text-gray-600 font-mono">R$ {p.product?.custoMedio?.toFixed(2)}</td>}
                          {!isPromotor && <td className="py-3 text-right text-orange-600 font-mono font-semibold">R$ {p.valorEstoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 2. SUPPLIERS */}
              {selectedCard === 'suppliers' && (() => {
                const list = suppliers.filter(s => {
                  const q = modalSearch.toLowerCase();
                  return s.nomeIndustria.toLowerCase().includes(q) ||
                         s.cnpjIndustria.toLowerCase().includes(q) ||
                         s.promotor.toLowerCase().includes(q) ||
                         s.agencia.toLowerCase().includes(q);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum fabricante correspondente.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">CNPJ</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-4">Promotor</th>
                        <th className="pb-3 pr-4">Agência</th>
                        <th className="pb-3 text-right">Atendimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(s => (
                        <tr key={s.cnpjIndustria} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500">{s.cnpjIndustria}</td>
                          <td className="py-3 pr-4 text-gray-800 font-bold">{s.nomeIndustria}</td>
                          <td className="py-3 pr-4 text-gray-600 font-medium">{s.promotor}</td>
                          <td className="py-3 pr-4 text-gray-500">{s.agencia}</td>
                          <td className="py-3 text-right text-orange-600 font-semibold">{s.diasAtendimento?.join(', ') || 'Não definido'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 3. PROMOTERS */}
              {selectedCard === 'promoters' && (() => {
                const list = promoters.length > 0 ? promoters : [
                  ...new Set(suppliers.map(s => JSON.stringify({ nome: s.promotor, agency: s.agencia })))
                ].map(str => JSON.parse(str)).filter(p => p.nome && p.nome !== 'Sem Cadastro');

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum promotor cadastrado na filial.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-4">Nome do Promotor</th>
                        <th className="pb-3 pr-4">Agência Terceirizada</th>
                        <th className="pb-3 text-right">Status na Filial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 pr-4 text-gray-850 font-extrabold flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#F58220] rounded-full"></span>
                            {p.nome}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 font-medium">{p.agencia || p.agency}</td>
                          <td className="py-3 text-right">
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">Ativo</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 4. RUPTURAS */}
              {selectedCard === 'rupturas' && (() => {
                const list = filteredProducts.filter(p => p.status === 'Ruptura' && !p.isPossivelAjuste).filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-455">Nenhuma ruptura crítica identificada no setor/filtro ativo.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição do Produto</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-2 text-right">Dias Sem Venda</th>
                        <th className="pb-3 text-right text-red-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(p => (
                        <tr key={p.product?.codigo} className="hover:bg-red-50/10 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-mono text-gray-700 font-bold">{p.product?.semVenda} dias</td>
                          <td className="py-3 text-right">
                            <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">Ruptura F172</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 5. ATENÇÃO */}
              {selectedCard === 'atencao' && (() => {
                const list = filteredProducts.filter(p => p.status === 'Atenção' && !p.isPossivelAjuste).filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum item em atenção fracionada no filtro ativo.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição do Produto</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-2 text-right">Estoque</th>
                        <th className="pb-3 text-right text-amber-500">Alerta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(p => (
                        <tr key={p.product?.codigo} className="hover:bg-amber-50/10 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-bold text-gray-800">{p.estoqueTotal}</td>
                          <td className="py-3 text-right">
                            <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Apenas Fracionado</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 6. ABASTECER */}
              {selectedCard === 'abastecer' && (() => {
                const list = filteredProducts.filter(p => p.status === 'Abastecer' && !p.isPossivelAjuste).filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum item pendente de abastecimento físico no filtro ativo.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição do Produto</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-2 text-right">Estoque Total</th>
                        <th className="pb-3 pr-2 text-right">Idade Sem Venda</th>
                        <th className="pb-3 text-right text-orange-500 font-bold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(p => (
                        <tr key={p.product?.codigo} className="hover:bg-orange-50/10 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-mono font-bold text-gray-800">{p.estoqueTotal}</td>
                          <td className="py-3 pr-2 text-right text-gray-500">{p.product?.semVenda} dias</td>
                          <td className="py-3 text-right">
                            <span className="bg-orange-50 text-orange-600 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Abastecer Gôndola</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 7. AJUSTES */}
              {selectedCard === 'ajustes' && (() => {
                const list = filteredProducts.filter(p => p.isPossivelAjuste).filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum possível ajuste no filtro ativo.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição do Produto</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-2 text-right">Estoque</th>
                        {!isPromotor && <th className="pb-3 text-right">Valor Financeiro</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map(p => (
                        <tr key={p.product?.codigo} className="hover:bg-indigo-50/10 transition-colors">
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-4 text-gray-600 truncate max-w-[180px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-mono text-gray-600">{p.estoqueTotal}</td>
                          {!isPromotor && (
                            <td className="py-3 text-right text-indigo-500 font-mono font-semibold">
                              R$ {p.valorEstoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 8. FINANCE */}
              {selectedCard === 'finance' && (() => {
                const list = [...filteredProducts].sort((a, b) => b.valorEstoque - a.valorEstoque).filter(p => {
                  const s = modalSearch.toLowerCase();
                  return (p.product?.codigo || '').toLowerCase().includes(s) ||
                         (p.product?.descricao || '').toLowerCase().includes(s) ||
                         p.nomeIndustria.toLowerCase().includes(s);
                });

                if (list.length === 0) return <div className="text-center py-12 text-xs text-gray-450">Nenhum item correspondente no filtro ativo.</div>;

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-450 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                        <th className="pb-3 pr-2 text-center">Rank</th>
                        <th className="pb-3 pr-2">Código</th>
                        <th className="pb-3 pr-4">Descrição</th>
                        <th className="pb-3 pr-4">Indústria / Fabricante</th>
                        <th className="pb-3 pr-2 text-right">Estoque</th>
                        <th className="pb-3 pr-2 text-right">Custo Médio</th>
                        <th className="pb-3 text-right">Val. de Giro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs">
                      {list.map((p, idx) => (
                        <tr key={p.product?.codigo} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-2 text-center font-mono text-gray-400 font-bold">{idx + 1}</td>
                          <td className="py-3 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                          <td className="py-3 pr-4">{formatProductDesc(p.product?.descricao || '')}</td>
                          <td className="py-3 pr-4 text-gray-600 truncate max-w-[150px]">{p.nomeIndustria}</td>
                          <td className="py-3 pr-2 text-right font-mono font-medium text-gray-800">{p.estoqueTotal}</td>
                          <td className="py-3 pr-2 text-right font-mono text-gray-600 font-medium">R$ {p.product?.custoMedio?.toFixed(2)}</td>
                          <td className="py-3 text-right text-emerald-600 font-mono font-extrabold">R$ {p.valorEstoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              {/* 9. TOP 20 VALUE REPORT */}
              {selectedCard === 'top20_value' && (() => {
                if (top20ValueProducts.length === 0) return <div className="text-center py-12 text-xs text-gray-455">Nenhum produto cadastrado no setor/filtro selecionado.</div>;

                return (
                  <div className="space-y-6">
                    {/* Report Info block */}
                    <div className="border border-blue-100 rounded-3xl p-5 bg-blue-50/20 text-xs text-gray-700 leading-relaxed font-sans space-y-2">
                      <p className="font-bold text-blue-900 flex items-center gap-1.5 text-sm">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        Critério de Ordenação e Relevância Comercial:
                      </p>
                      <p>
                        Este documento consolida os <strong>20 maiores SKUs</strong> em valor financeiro absoluto de estoque da filial Cascavel sob as regras vigentes do Atacadão. 
                        A representatividade financeira é calculada pela multiplicação direta entre o estoque unitário total e o custo médio de entrada indexado.
                      </p>
                      <p className="text-[11px] text-gray-505">
                        * Representação dinâmica baseada no filtro de setor ativo: <strong className="text-gray-700">{selectedSector}</strong>.
                      </p>
                    </div>

                    <table className="w-full text-left border-collapse" id="top20-report-print-area">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-[10px] font-extrabold uppercase tracking-widest font-sans">
                          <th className="pb-3 pr-2 text-center w-12">Rank</th>
                          <th className="pb-3 pr-2 w-20">Código</th>
                          <th className="pb-3 pr-4">Descrição do SKU</th>
                          <th className="pb-3 pr-4 w-32">Setor</th>
                          <th className="pb-3 pr-4">Indústria / Fabricante</th>
                          <th className="pb-3 pr-2 text-right w-24">Qtd. Estoque</th>
                          {!isPromotor && <th className="pb-3 pr-2 text-right w-24">Custo Médio</th>}
                          {!isPromotor && <th className="pb-3 text-right w-32">Valor Total Estoque</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {top20ValueProducts.map((p, idx) => {
                          const desc = p.product?.descricao || '';
                          let sectorLabel = 'LOJA';
                          let sectorBadgeColor = 'bg-zinc-50 text-zinc-700 border-zinc-200';
                          if (desc.startsWith('RF.')) {
                            sectorLabel = 'FRIOS';
                            sectorBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                          } else if (desc.startsWith('HF.')) {
                            sectorLabel = 'HORT FRUT';
                            sectorBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          }

                          return (
                            <tr key={p.product?.codigo} className="hover:bg-gray-50/70 transition-colors">
                              <td className="py-3.5 pr-2 text-center font-mono text-gray-500 font-extrabold text-xs">{idx + 1}</td>
                              <td className="py-3.5 pr-2 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                              <td className="py-3.5 pr-4">{formatProductDesc(desc)}</td>
                              <td className="py-3.5 pr-4">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sectorBadgeColor}`}>
                                  {sectorLabel}
                                </span>
                              </td>
                              <td className="py-3.5 pr-4 text-gray-600 truncate max-w-[150px]">{p.nomeIndustria}</td>
                              <td className="py-3.5 pr-2 text-right font-mono font-semibold text-gray-800">{p.estoqueTotal}</td>
                              {!isPromotor && <td className="py-3.5 pr-2 text-right font-mono text-gray-600 font-medium">R$ {p.product?.custoMedio?.toFixed(2)}</td>}
                              {!isPromotor && (
                                <td className="py-3.5 text-right font-mono font-black text-blue-900">
                                  R$ {p.valorEstoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-100 p-4 shrink-0 flex items-center justify-between text-xs text-gray-500 font-sans">
              <span>Cascavel, Filial 172 — Emissor: {currentUser.name} ({currentUser.role})</span>
              <button
                onClick={() => { setSelectedCard(null); setModalSearch(''); }}
                className="bg-gray-900 hover:bg-black text-white font-bold px-5 py-2 rounded-2xl cursor-pointer transition-all"
              >
                Fechar Painel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- FORMAL PRINT PREVIEW SHEET FOR ABASTECER GÔNDOLA (PDF) --- */}
      {/* This renders only on print, with exact matches of the official style from RelatoriosView */}
      <div className="hidden print:block bg-white text-left p-8 print:p-2 shadow-none border-none space-y-6 print:space-y-2 printable-document relative overflow-hidden" id="report-print-pane">
        
        {/* Printable Watermarked Indicator */}
        <div className="absolute top-5 right-5 text-gray-200 select-none">
          <FileText className="w-24 h-24 rotate-12 opacity-30" />
        </div>

        {/* Corporate Header Block */}
        <div className="border-b-2 border-gray-800 pb-5 print:pb-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:gap-1">
          <div className="flex items-center gap-3 print:gap-2">
            <div className="bg-[#F58220] text-white font-black text-2xl print:text-base px-4 print:px-2 py-1.5 print:py-0.5 rounded-lg shadow-sm font-display tracking-tight">
              A
            </div>
            <div>
              <h1 className="text-lg print:text-sm font-black text-gray-900 tracking-wider font-display">ATACADÃO S.A</h1>
              <div className="text-[11px] print:text-[8px] text-gray-500 font-mono font-bold uppercase">FILIAL 172 - CASCAVEL (PARANÁ)</div>
            </div>
          </div>

          <div className="text-right text-[10px] print:text-[8px] font-mono text-gray-400 space-y-0.5 print:space-y-0">
            <div>EMISSÃO: <strong className="font-sans text-gray-650 font-black">{new Date().toLocaleString('pt-BR')}</strong></div>
            <div>GERADO POR: <strong className="font-sans text-gray-650 font-black">{currentUser.name}</strong></div>
            <div>STATUS FILIAL: <strong className="font-sans text-emerald-600 font-black">LOJA CONECTADA</strong></div>
            <div className="text-[9px] print:text-[7px] text-[#F58220] font-sans font-bold uppercase tracking-wider">Documento Operacional Oficial</div>
          </div>
        </div>

        {/* Meta logs of Applied Filters */}
        <div className="bg-gray-50 p-4 print:p-2 print:my-0.5 rounded-xl border border-gray-200 flex flex-wrap justify-between gap-4 print:gap-2 text-xs print:text-[9px]">
          <div className="space-y-1 print:space-y-0">
            <span className="text-[9px] print:text-[7px] font-bold text-gray-400 uppercase tracking-widest block font-sans">Documento Solicitado</span>
            <span className="font-extrabold text-sm print:text-xs text-gray-850 font-display">
              Relatório de Abastecimento de Gôndola
            </span>
          </div>

          <div className="flex gap-4 print:gap-3">
            <div className="text-right">
              <span className="text-[9px] print:text-[7px] font-bold text-gray-400 uppercase tracking-widest block">Data Base</span>
              <span className="font-bold text-gray-700 font-mono">{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="text-right border-l pl-4 print:pl-3">
              <span className="text-[9px] print:text-[7px] font-bold text-gray-400 uppercase tracking-widest block">Filtros Ativos</span>
              <span className="font-bold text-gray-700 leading-none">
                Setor: {selectedSector === 'TODOS' ? 'TODOS' : selectedSector}
                {modalSearch ? ` | Pesquisa: "${modalSearch}"` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* SUMMARY METRICS BLOCK */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-gray-400 text-[10px] font-bold uppercase">Volume Total</div>
            <div className="text-lg font-black font-mono mt-0.5 text-gray-800">{printProducts.length} Itens</div>
          </div>
          <div className="bg-orange-50 text-orange-950 rounded-lg p-3 border border-orange-100">
            <div className="text-orange-600 text-[10px] font-bold uppercase">Valor Financeiro Disponível</div>
            <div className="text-lg font-black font-mono mt-0.5">
              R$ {printProducts.reduce((acc, curr) => acc + curr.valorEstoque, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* DATA GRID IN TABLE LAYOUT */}
        <div className="overflow-x-auto border border-gray-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wide select-none">
                <th className="p-3">Código</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Setor</th>
                <th className="p-3 text-center">Estoque</th>
                <th className="p-3 text-center font-mono">Dias sem venda</th>
                <th className="p-3 text-right">Valor Disponível</th>
                <th className="p-3 text-right">Promotor Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-xs">
              {printProducts.map(p => {
                const desc = p.product?.descricao || '';
                let sectorLabel = 'LOJA';
                if (desc.toUpperCase().startsWith('RF.')) {
                  sectorLabel = 'FRIOS';
                } else if (desc.toUpperCase().startsWith('HF.')) {
                  sectorLabel = 'HORT FRUT';
                }

                return (
                  <tr key={p.product?.codigo} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-mono text-gray-500 font-semibold">{p.product?.codigo}</td>
                    <td className="p-3 font-semibold text-gray-900">{formatProductDesc(desc)}</td>
                    <td className="p-3 text-gray-600">{sectorLabel}</td>
                    <td className="p-3 text-center font-bold text-gray-800">{p.estoqueTotal}</td>
                    <td className="p-3 text-center font-mono text-gray-500">{p.product?.semVenda} dias</td>
                    <td className="p-3 text-right text-[#F58220] font-mono font-semibold">
                      R$ {p.valorEstoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-medium text-gray-700">{p.promotor}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Corporate Footer Metrics */}
        <div className="border-t border-gray-200 pt-4 mt-8 flex justify-between items-center text-[10px] text-gray-400 font-mono">
          <div>ATACADÃO CASCAVEL FILIAL 172</div>
          <div>EMISSOR: {currentUser.name} ({currentUser.role})</div>
          <div>IMPRESSO EM {new Date().toLocaleDateString('pt-BR')}</div>
        </div>

      </div>

    </div>
  );
}
