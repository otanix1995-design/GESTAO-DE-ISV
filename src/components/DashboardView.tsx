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
  Info
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

  // Compute derived products
  const productsDerived = useMemo(() => {
    return products.map(p => computeProductDerived(p, suppliers));
  }, [products, suppliers]);

  // Compute status metrics based on role view filters
  const filteredProducts = useMemo(() => {
    if (isPromotor && currentUser.promoterName) {
      return productsDerived.filter(p => p.promotor.toLowerCase() === currentUser.promoterName?.toLowerCase());
    }
    return productsDerived;
  }, [productsDerived, isPromotor, currentUser.promoterName]);

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
      { name: 'Ruptura', count: dashboardStats.rupturas, color: 'bg-[#F25C54]', barColor: '#F25C54', description: 'Item sem estoque (Emb1 e Emb9 = 0)' },
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
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 transition-all duration-300 md:col-span-2 relative overflow-hidden group"
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
              <span className="text-[10px] text-gray-400 font-medium">Monitoramento instantâneo via planilha diária</span>
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
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/90 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 transition-all duration-300 group"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-sans">Fabricantes Vinculados</span>
              <div className="text-3xl font-black text-[#2F2F2F] tracking-tight mt-2 font-mono">
                {isPromotor ? [...new Set(filteredProducts.map(p => p.cnpjIndustria))].length : stats.totalFornecedores}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 font-sans">CNPJs ativos sob atendimento direto.</p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-gray-400 font-medium font-sans">Indústrias cadastradas</span>
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
            className="bg-[#2F2F2F] text-white p-6 rounded-3xl shadow-lg shadow-gray-900/10 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 group relative overflow-hidden"
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
              <span className="text-[10px] text-gray-400 font-medium">Gestão ativa de canais</span>
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
            className="bg-[#F58220] text-white p-6 rounded-3xl shadow-xl shadow-[#F58220]/15 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group col-span-1 md:col-span-2"
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
              <span className="text-[10px] text-orange-100 font-medium">Requer reposição ou ajuste fiscal urgente</span>
              <AlertOctagon className="w-6 h-6 text-white animate-bounce" />
            </div>
          </motion.div>

          {/* Total de Atenção - Warning Yellow Bento Card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            className="bg-[#FFC72C] text-[#2F2F2F] p-6 rounded-3xl shadow-md shadow-amber-200/10 border-2 border-amber-300/30 flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 group"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-800 uppercase tracking-widest font-sans">Atenção Fracionada</span>
              <div className="text-3xl font-black mt-2 font-mono">{dashboardStats.atencao}</div>
              <p className="text-[11px] text-gray-800 mt-1 font-sans">Fardo fechado zerado, restam apenas unidades avulsas na área de venda.</p>
            </div>
            <div className="flex items-center justify-between border-t border-black/10 pt-4 mt-6">
              <span className="text-[10px] text-gray-700 font-medium">Risco de ruptura iminente</span>
              <AlertTriangle className="w-5 h-5 text-gray-800" />
            </div>
          </motion.div>

          {/* Total de Abastecer - Clean crisp bento card */}
          <motion.div 
            variants={cardVariants} 
            initial="hidden" 
            animate="visible" 
            className="bg-white p-6 rounded-3xl border-2 border-gray-100/95 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#F58220]/25 transition-all duration-300 group"
          >
            <div>
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-sans">Abastecer Gôndola</span>
              <div className="text-3xl font-black text-gray-850 mt-2 font-mono">{dashboardStats.abastecer}</div>
              <p className="text-[11px] text-gray-500 mt-1 font-sans">Fardo com estoque, mas unidade da gôndola está indisponível.</p>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
              <span className="text-[10px] text-gray-400 font-medium">Abastecimento físico solicitado</span>
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
          className="bg-white p-6 rounded-3xl border-2 border-indigo-50/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300 lg:col-span-2 group"
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
            <span className="text-[10px] text-gray-400 font-medium">Ajustes operacionais simplificados</span>
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
            className="bg-gradient-to-br from-[#2F2F2F] to-[#1F1F1F] text-white rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-900/10 lg:col-span-2 relative overflow-hidden group"
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
    </div>
  );
}
