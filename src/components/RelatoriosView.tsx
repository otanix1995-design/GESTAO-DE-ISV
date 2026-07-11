/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Supplier, Promoter, Agency, User, SystemStats } from '../types';
import { computeProductDerived } from '../mockData';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  ShieldAlert, 
  Filter, 
  Building2, 
  Contact, 
  Building, 
  LineChart,
  Grid,
  CheckCircle,
  HelpCircle,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';
import { motion } from 'motion/react';

interface RelatoriosViewProps {
  products: Product[];
  suppliers: Supplier[];
  promoters: Promoter[];
  agencies: Agency[];
  currentUser: User;
  stats: SystemStats;
}

type ReportType = 'isv' | 'promotor' | 'industria' | 'agencia' | 'gerencial';

export default function RelatoriosView({
  products,
  suppliers,
  promoters,
  agencies,
  currentUser,
  stats
}: RelatoriosViewProps) {
  const isPromotor = currentUser.role === 'Promotor';
  const isManagerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Gestor';

  // State
  const [activeReport, setActiveReport] = useState<ReportType>('isv');
  const [selectedDate, setSelectedDate] = useState('2026-06-04');
  
  // Custom Filters for each Report
  const [reportPromoter, setReportPromoter] = useState(
    isPromotor ? currentUser.promoterName || '' : 'todos'
  );
  const [reportIndustry, setReportIndustry] = useState('todos');
  const [reportAgency, setReportAgency] = useState('todos');
  const [reportStatus, setReportStatus] = useState('todos');
  const [filterStock, setFilterStock] = useState<'todos' | 'zerado' | 'positivo'>('todos');
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');
  
  // Sorting state: 'none', 'estoqueDesc' (estoque maior para o menor), 'valorDesc' (valor do estoque maior para menor), 'semVendaDesc', 'codigo'
  const [sortBy, setSortBy] = useState<'none' | 'estoqueDesc' | 'valorDesc' | 'semVendaDesc' | 'codigo'>('none');

  // Toggle to hide financial values (R$) for security/privacy.
  const [hideFinancialValues, setHideFinancialValues] = useState(isPromotor || activeReport === 'promotor');

  // Automatically adjust "Ocultar valores em R$" based on active report type, active user role, or promoter filters
  React.useEffect(() => {
    if (isPromotor) {
      setHideFinancialValues(true);
    } else if (activeReport === 'promotor' || (activeReport === 'isv' && reportPromoter !== 'todos')) {
      setHideFinancialValues(true);
    } else {
      setHideFinancialValues(false);
    }
  }, [activeReport, reportPromoter, isPromotor]);

  // Clear success notification after 3 seconds
  const triggerExportNotification = (message: string) => {
    setExportSuccessMessage(message);
    setTimeout(() => setExportSuccessMessage(''), 3000);
  };

  // Pre-calculate derived products
  const productsDerived = useMemo(() => {
    return products.map(p => computeProductDerived(p, suppliers));
  }, [products, suppliers]);

  // Distinct listings for dropdown select options
  const filterList = useMemo(() => {
    // Collect all distinct industries by CNPJ from both products and suppliers
    const industriesMap = new Map<string, string>();
    
    // 1. Load from suppliers list
    suppliers.forEach(s => {
      if (s.cnpjIndustria) {
        industriesMap.set(s.cnpjIndustria.trim(), s.nomeIndustria?.trim() || s.cnpjIndustria.trim());
      }
    });

    // 2. Load from products list (Base Principal) to guarantee all registered products' industries are listed
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
      promoters: [...new Set(productsDerived.map(p => p.promotor))].filter(Boolean),
      industries: listIndustries,
      agencies: agencies.map(a => a.nome)
    };
  }, [products, productsDerived, suppliers, agencies]);

  // Helper to toggle sorting field
  const handleToggleSort = (field: 'estoqueDesc' | 'valorDesc' | 'semVendaDesc' | 'codigo') => {
    if (sortBy === field) {
      setSortBy('none');
    } else {
      setSortBy(field);
    }
  };

  // --- REPORT FILTER ENGINE ---
  const reportData = useMemo(() => {
    let result = [...productsDerived];

    if (activeReport === 'isv') {
      // Detailed ISV report filters
      if (reportPromoter !== 'todos' && reportPromoter !== '') {
        result = result.filter(r => r.promotor.toLowerCase() === reportPromoter.toLowerCase());
      }
      if (reportIndustry !== 'todos') {
        result = result.filter(r => r.product.cnpjIndustria === reportIndustry);
      }
      if (reportAgency !== 'todos') {
        result = result.filter(r => r.agencia === reportAgency);
      }
      if (reportStatus !== 'todos') {
        result = result.filter(r => r.classificacao.toLowerCase() === reportStatus.toLowerCase() || r.status.toLowerCase() === reportStatus.toLowerCase());
      }
    } else if (activeReport === 'promotor') {
      // 1. Filter by Promoter
      if (reportPromoter !== 'todos') {
        result = result.filter(r => r.promotor.toLowerCase() === reportPromoter.toLowerCase());
      } else if (isPromotor && currentUser.promoterName) {
        result = result.filter(r => r.promotor.toLowerCase() === currentUser.promoterName.toLowerCase());
      }
    } else if (activeReport === 'industria') {
      // 2. Filter by Industry CNPJ Match
      if (reportIndustry !== 'todos') {
        result = result.filter(r => r.product.cnpjIndustria === reportIndustry);
      }
    } else if (activeReport === 'agencia') {
      // 3. Filter by Agency Name Match
      if (reportAgency !== 'todos') {
        result = result.filter(r => r.agencia === reportAgency);
      }
    } else if (activeReport === 'gerencial') {
      // 4. Executive Management options (all items or custom filtered)
      if (reportPromoter !== 'todos' && reportPromoter !== '') {
        result = result.filter(r => r.promotor.toLowerCase() === reportPromoter.toLowerCase());
      }
      if (reportIndustry !== 'todos') {
        result = result.filter(r => r.product.cnpjIndustria === reportIndustry);
      }
    }

    // Apply Stock Filter
    if (filterStock === 'zerado') {
      result = result.filter(r => r.estoqueTotal === 0);
    } else if (filterStock === 'positivo') {
      result = result.filter(r => r.estoqueTotal > 0);
    }

    // Apply Sorting Options
    if (sortBy === 'estoqueDesc') {
      result.sort((a, b) => b.estoqueTotal - a.estoqueTotal);
    } else if (sortBy === 'valorDesc') {
      result.sort((a, b) => b.valorEstoque - a.valorEstoque);
    } else if (sortBy === 'semVendaDesc') {
      result.sort((a, b) => b.product.semVenda - a.product.semVenda);
    } else if (sortBy === 'codigo') {
      result.sort((a, b) => a.product.codigo.localeCompare(b.product.codigo));
    }

    return result;
  }, [activeReport, productsDerived, reportPromoter, reportIndustry, reportAgency, reportStatus, filterStock, sortBy, isPromotor, currentUser.promoterName]);

  // Aggregate Metrics for Active Report Layout
  const reportSummary = useMemo(() => {
    const totalItems = reportData.length;
    const ruptures = reportData.filter(r => r.status === 'Ruptura' && !r.isPossivelAjuste).length;
    const attention = reportData.filter(r => r.status === 'Atenção' && !r.isPossivelAjuste).length;
    const replenishment = reportData.filter(r => r.status === 'Abastecer' && !r.isPossivelAjuste).length;
    const normal = reportData.filter(r => r.status === 'Normal' && !r.isPossivelAjuste).length;
    const adjustments = reportData.filter(r => r.isPossivelAjuste).length;
    
    const financialEstoqueValue = reportData.reduce((acc, curr) => acc + curr.valorEstoque, 0);

    return {
      totalItems,
      ruptures,
      attention,
      replenishment,
      normal,
      adjustments,
      financialEstoqueValue
    };
  }, [reportData]);

  // --- EXPORT TO EXCEL/CSV BLOCKS ---
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `relatorio_${activeReport}_${selectedDate}.csv`;

    if (activeReport === 'isv') {
      headers = hideFinancialValues
        ? ['CÓDIGO', 'DESCRIÇÃO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'DIAS SEM VENDA', 'IDADE (DIAS)', 'RAZÃO SOCIAL', 'PROMOTOR RESPONSÁVEL', 'CLASSIFICAÇÃO']
        : ['CÓDIGO', 'DESCRIÇÃO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'DIAS SEM VENDA', 'IDADE (DIAS)', 'VALOR ESTOQUE (R$)', 'RAZÃO SOCIAL', 'PROMOTOR RESPONSÁVEL', 'CLASSIFICAÇÃO'];
      rows = reportData.map(d => hideFinancialValues
        ? [
            d.product.codigo,
            d.product.descricao,
            d.product.embalagem,
            d.estoqueTotal.toString(),
            d.product.semVenda.toString(),
            (d.product.idade || 0).toString(),
            d.nomeIndustria,
            d.promotor,
            d.classificacao
          ]
        : [
            d.product.codigo,
            d.product.descricao,
            d.product.embalagem,
            d.estoqueTotal.toString(),
            d.product.semVenda.toString(),
            (d.product.idade || 0).toString(),
            d.valorEstoque.toFixed(2),
            d.nomeIndustria,
            d.promotor,
            d.classificacao
          ]
      );
    } else if (activeReport === 'promotor') {
      headers = ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'SEM VENDA (DIAS)', 'IDADE (DIAS)', 'STATUS'];
      rows = reportData.map(d => [
        d.product.codigo,
        d.product.descricao,
        d.product.embalagem,
        d.estoqueTotal.toString(),
        d.product.semVenda.toString(),
        (d.product.idade || 0).toString(),
        d.classificacao
      ]);
    } else if (activeReport === 'industria') {
      headers = ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'IDADE (DIAS)', 'STATUS', 'PROMOTOR', 'AGÊNCIA'];
      rows = reportData.map(d => [
        d.product.codigo,
        d.product.descricao,
        d.product.embalagem,
        d.estoqueTotal.toString(),
        (d.product.idade || 0).toString(),
        d.classificacao,
        d.promotor,
        d.agencia
      ]);
    } else if (activeReport === 'agencia') {
      headers = ['AGÊNCIA', 'INDÚSTRIA', 'PROMOTOR', 'DIAS ATENDIMENTO', 'CÓDIGO PRODUTO', 'DESCRIÇÃO', 'STATUS'];
      rows = reportData.map(d => [
        d.agencia,
        d.nomeIndustria,
        d.promotor,
        d.diasAtendimento.join(' | '),
        d.product.codigo,
        d.product.descricao,
        d.classificacao
      ]);
    } else if (activeReport === 'gerencial') {
      headers = hideFinancialValues
        ? ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'IDADE (DIAS)', 'STATUS', 'PROMOTOR']
        : ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE TOTAL', 'IDADE (DIAS)', 'CUSTO MÉDIO (R$)', 'VALOR ESTOQUE (R$)', 'STATUS', 'PROMOTOR'];
      rows = reportData.map(d => hideFinancialValues
        ? [
            d.product.codigo,
            d.product.descricao,
            d.product.embalagem,
            d.estoqueTotal.toString(),
            (d.product.idade || 0).toString(),
            d.classificacao,
            d.promotor
          ]
        : [
            d.product.codigo,
            d.product.descricao,
            d.product.embalagem,
            d.estoqueTotal.toString(),
            (d.product.idade || 0).toString(),
            d.product.custoMedio.toFixed(2),
            d.valorEstoque.toFixed(2),
            d.classificacao,
            d.promotor
          ]
      );
    }

    // Build delimiter rows
    const csvContent = "\uFEFF" + [
      [`REDE ATACADÃO S.A. - FILIAL 172 CASCAVEL - DATA EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`],
      [`RELATÓRIO OPERACIONAL: ${activeReport.toUpperCase()}`],
      [`Filtros aplicados: Data: ${selectedDate} | Promotor: ${reportPromoter} | Indústria: ${reportIndustry} | Agência: ${reportAgency} | Status: ${reportStatus} | Estoque: ${filterStock === 'todos' ? 'Todos' : filterStock === 'zerado' ? 'Apenas Estoque Zerado' : 'Apenas Estoque Disponível'} | Ordenação: ${sortBy}`],
      [],
      headers,
      ...rows
    ].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerExportNotification(`Sucesso! Planilha corporativa [${filename}] baixada com sucesso.`);
  };

  // --- PRINT / SAVE PDF TRIGGER ---
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in" id="relatorios-tab">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-display">Gerador de Relatórios e Auditorias</h2>
          <p className="text-xs text-gray-500 mt-1 font-sans">
            Gere planilhas detalhadas de ISV, acompanhamento de abastecimento e fardo, auditorias financeiras e PDFs prontos para impressão física.
          </p>
        </div>
      </div>

      {/* SUCCESS NOTIFICATION */}
      {exportSuccessMessage && (
        <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-400/20 text-xs font-bold leading-none flex items-center gap-2.5 max-w-lg animate-bounce">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{exportSuccessMessage}</span>
        </div>
      )}

      {/* FILTER CONTROL PANEL */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        
        {/* Menu/Report Selector Tabs - Fully Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
          
          <button
            onClick={() => { setActiveReport('isv'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'isv' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Relatório ISV Detalhado
          </button>

          <button
            onClick={() => { setActiveReport('promotor'); setReportPromoter(isPromotor ? currentUser.promoterName || '' : 'todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'promotor' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Contact className="w-4 h-4" /> Por Promotor
          </button>

          <button
            onClick={() => { setActiveReport('industria'); setReportIndustry('todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'industria' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building className="w-4 h-4" /> Por Indústria
          </button>

          <button
            onClick={() => { setActiveReport('agencia'); setReportAgency('todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'agencia' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Por Agência
          </button>

          <button
            onClick={() => { 
              if (!isManagerOrAdmin) {
                alert('Acesso Restrito ao Relatório Gerencial: Somente Administradores ou Gestores possuem acesso aos demonstrativos de custos e valuation.');
                return;
              }
              setActiveReport('gerencial'); 
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              !isManagerOrAdmin ? 'opacity-40 cursor-not-allowed text-gray-400' : ''
            } ${
              activeReport === 'gerencial' 
                ? 'bg-[#F25C54] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <LineChart className="w-4 h-4" /> Financeiro Gerencial
          </button>
        </div>

        {/* Filters according to selected report */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 pt-2">
          
          {/* Calendar Picker */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">DATA DE REFERÊNCIA</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] select-none text-gray-700"
              />
            </div>
          </div>

          {/* Promoter Select Option */}
          {(activeReport === 'isv' || activeReport === 'promotor' || activeReport === 'gerencial') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">FILTRAR PROMOTOR</label>
              <select
                disabled={isPromotor}
                value={reportPromoter}
                onChange={(e) => setReportPromoter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
              >
                {!isPromotor && <option value="todos">Todos os Promotores</option>}
                <option value="Sem Cadastro">Sem Promotor (Sem Cadastro)</option>
                {filterList.promoters.filter(p => p !== 'Sem Cadastro').map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Industry Selection Option */}
          {(activeReport === 'isv' || activeReport === 'industria' || activeReport === 'gerencial') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">FILTRAR INDÚSTRIA (RAZÃO SOCIAL)</label>
              <select
                value={reportIndustry}
                onChange={(e) => setReportIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
              >
                <option value="todos">Todas as Indústrias</option>
                {filterList.industries.map((ind) => (
                  <option key={ind.cnpj} value={ind.cnpj}>{ind.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Agency Selection Option */}
          {(activeReport === 'isv' || activeReport === 'agencia') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">FILTRAR AGÊNCIA</label>
              <select
                value={reportAgency}
                onChange={(e) => setReportAgency(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
              >
                <option value="todos">Todas as Agências</option>
                {filterList.agencies.map((agency) => (
                  <option key={agency} value={agency}>{agency}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Selection Option */}
          {activeReport === 'isv' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">FILTRAR STATUS / ALERTA</label>
              <select
                value={reportStatus}
                onChange={(e) => setReportStatus(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
              >
                <option value="todos">Todos os Status</option>
                <option value="Ruptura">Ruptura (Sem Estoque)</option>
                <option value="Abastecer">Abastecer (Fardo OK, Gôndola Zerada)</option>
                <option value="Atenção">Atenção (Gôndola OK, Fardo Zerado)</option>
                <option value="Normal">Normal (Ambos Abastecidos)</option>
                <option value="Possível Ajuste">Possível Ajuste (Valor Est. &lt; R$200)</option>
              </select>
            </div>
          )}

          {/* Stock Filter Option */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">FILTRAR ESTOQUE</label>
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700 font-sans"
            >
              <option value="todos">Todos (Zerado + Ativo)</option>
              <option value="zerado">Apenas Estoque Zerado</option>
              <option value="positivo">Apenas Estoque Disponível (&gt; 0)</option>
            </select>
          </div>

          {/* Sorting Option */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 font-sans">ORDENAÇÃO OPERACIONAL</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
            >
              <option value="none">Padrão (Sem Classificação)</option>
              <option value="estoqueDesc">Estoque Total (Maior para Menor)</option>
              <option value="valorDesc">Valor do Estoque (Maior para Menor)</option>
              <option value="semVendaDesc">Dias Sem Venda (Maior para Menor)</option>
              <option value="codigo">Código do Produto (Crescente)</option>
            </select>
          </div>

          {/* Export and Print Action Buttons */}
          <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-7 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-2">
            {/* Privacy toggle on the left */}
            <div className="flex items-center gap-2.5 bg-amber-50/50 border border-amber-200/50 px-4 py-2.5 rounded-xl self-start md:self-auto">
              <input
                type="checkbox"
                id="hide-financial-toggle"
                checked={hideFinancialValues}
                disabled={isPromotor}
                onChange={(e) => setHideFinancialValues(e.target.checked)}
                className="w-4 h-4 text-[#F58220] border-gray-300 rounded focus:ring-[#F58220] accent-[#F58220] cursor-pointer"
              />
              <label htmlFor="hide-financial-toggle" className="text-xs font-bold text-amber-900 cursor-pointer select-none flex flex-col">
                <span>Ocultar valores em R$ (Privacidade do Promotor)</span>
                <span className="text-[10px] font-normal text-amber-700">Recomendado para impressão ou envio ao promotor externo</span>
              </label>
            </div>

            {/* Action Buttons on the right */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="px-5 py-2.5 bg-white border border-gray-250 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Planilha Excel/CSV
              </button>
              <button
                onClick={handlePrintPDF}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 text-white" /> Imprimir Relatório / Gerar PDF
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* --- FORMAL PREVIEW SHEETS EMBEDDED PREVIEW AREA --- */}
      {/* This area renders a gorgeous professional letter-styled container mimicking standard A4 paper boundaries */}
      <div className="bg-white border text-left rounded-3xl p-8 shadow-xs border-gray-100 space-y-6 printable-document relative overflow-hidden" id="report-print-pane">
        
        {/* Printable Watermarked Indicator */}
        <div className="absolute top-5 right-5 text-gray-200 select-none hidden md:block">
          <FileText className="w-24 h-24 rotate-12 opacity-30" />
        </div>

        {/* Corporate Header Block */}
        <div className="border-b-2 border-gray-800 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#F58220] text-white font-black text-2xl px-4 py-1.5 rounded-lg shadow-sm font-display tracking-tight">
              A
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-wider font-display">ATACADÃO S.A</h1>
              <div className="text-[11px] text-gray-500 font-mono font-bold uppercase">FILIAL 172 - CASCAVEL (PARANÁ)</div>
            </div>
          </div>

          <div className="text-right text-[10px] font-mono text-gray-400 space-y-0.5">
            <div>EMISSÃO: <strong className="font-sans text-gray-650 font-black">{new Date().toLocaleString('pt-BR')}</strong></div>
            <div>GERADO POR: <strong className="font-sans text-gray-650 font-black">{currentUser.name}</strong></div>
            <div>STATUS FILIAL: <strong className="font-sans text-emerald-600 font-black">LOJA CONECTADA</strong></div>
            <div className="text-[9px] text-[#F58220] font-sans font-bold uppercase tracking-wider">Documento Operacional Oficial</div>
          </div>
        </div>

        {/* Meta logs of Applied Filters */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-wrap justify-between gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-sans">Documento Solicitado</span>
            <span className="font-extrabold text-sm text-gray-850 font-display">
              {activeReport === 'isv' ? 'Relatório Detalhado de ISV (Estoque e Inatividade)'
               : activeReport === 'promotor' ? 'Relatório por Promotor de Vendas' 
               : activeReport === 'industria' ? 'Relatório por Indústria Mapeada'
               : activeReport === 'agencia' ? 'Relatório por Agência Licenciada'
               : 'Relatório Financeiro Gerencial de Auditoria'}
            </span>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Data Base</span>
              <span className="font-bold text-gray-700 font-mono">{selectedDate.split('-').reverse().join('/')}</span>
            </div>
            <div className="text-right border-l pl-4">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Filtros Ativos</span>
              <span className="font-bold text-gray-700 leading-none">
                {activeReport === 'isv' ? 'Filtro ISV Completo'
                 : activeReport === 'promotor' ? `Promotor: ${reportPromoter}`
                 : activeReport === 'industria' ? `Fabricante CNPJ Match`
                 : activeReport === 'agencia' ? `Agência: ${reportAgency}`
                 : 'Multifiltro Master'}
              </span>
            </div>
          </div>
        </div>

        {/* SUMMARY BLOCKS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="text-gray-400 text-[10px] font-bold uppercase">Volume Total</div>
            <div className="text-lg font-black font-mono mt-0.5 text-gray-800">{reportSummary.totalItems} Itens</div>
          </div>
          <div className="bg-red-50 text-red-900 rounded-lg p-3 border border-red-100">
            <div className="text-red-500 text-[10px] font-bold uppercase">Rupturas de Fardo</div>
            <div className="text-lg font-black font-mono mt-0.5">{reportSummary.ruptures} Zerados</div>
          </div>
          <div className="bg-orange-50 text-orange-950 rounded-lg p-3 border border-orange-100">
            <div className="text-orange-600 text-[10px] font-bold uppercase">Gôndola (Abastecer)</div>
            <div className="text-lg font-black font-mono mt-0.5">{reportSummary.replenishment} Críticos</div>
          </div>
          <div className="bg-indigo-50 text-indigo-950 rounded-lg p-3 border border-indigo-100">
            {isManagerOrAdmin && (activeReport === 'gerencial' || activeReport === 'isv') && !hideFinancialValues ? (
              <>
                <div className="text-indigo-600 text-[10px] font-bold uppercase">Valor total em loja</div>
                <div className="text-lg font-black font-mono mt-0.5">R$ {reportSummary.financialEstoqueValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
              </>
            ) : (
              <>
                <div className="text-indigo-600 text-[10px] font-bold uppercase">Atenção (Unidades)</div>
                <div className="text-lg font-black font-mono mt-0.5">{reportSummary.attention} Itens</div>
              </>
            )}
          </div>
        </div>

        {/* DATA GRID IN TABLE LAYOUT */}
        <div className="overflow-x-auto border border-gray-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wide select-none">
                <th className="p-3 cursor-pointer hover:bg-gray-150 transition-colors" onClick={() => handleToggleSort('codigo')}>
                  <div className="flex items-center gap-1">
                    Cód. {sortBy === 'codigo' && <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" />}
                  </div>
                </th>
                <th className="p-3">Descrição Mercadoria</th>
                <th className="p-3">Emb.</th>
                
                {/* ISV Detailed Columns */}
                {activeReport === 'isv' && (
                  <>
                    <th className="p-3 text-center cursor-pointer hover:bg-gray-150 transition-colors" onClick={() => handleToggleSort('estoqueDesc')}>
                      <div className="flex items-center justify-center gap-1">
                        Estoque Total {sortBy === 'estoqueDesc' && <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" />}
                      </div>
                    </th>
                    <th className="p-3 text-center cursor-pointer hover:bg-gray-150 transition-colors" onClick={() => handleToggleSort('semVendaDesc')}>
                      <div className="flex items-center justify-center gap-1">
                        Dias Sem Venda {sortBy === 'semVendaDesc' && <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" />}
                      </div>
                    </th>
                    <th className="p-3 text-center">
                      Idade (Dias)
                    </th>
                    {!hideFinancialValues && (
                      <th className="p-3 text-right cursor-pointer hover:bg-gray-150 transition-colors" onClick={() => handleToggleSort('valorDesc')}>
                        <div className="flex items-center justify-end gap-1">
                          Valor Estoque {sortBy === 'valorDesc' && <ArrowUpDown className="w-3.5 h-3.5 text-[#F58220]" />}
                        </div>
                      </th>
                    )}
                    <th className="p-3">Razão Social (Indústria)</th>
                    <th className="p-3 font-bold">Promotor Responsável</th>
                    <th className="p-3 text-right font-bold">Classificação</th>
                  </>
                )}

                {/* Specific layouts according to other sub-report constraints */}
                {activeReport === 'promotor' && (
                  <>
                    <th className="p-3 text-center">Estoque Total</th>
                    <th className="p-3 text-center">Inativo (SemVenda)</th>
                    <th className="p-3 text-center">Idade (Dias)</th>
                    <th className="p-3 text-right">Classificação</th>
                  </>
                )}

                {activeReport === 'industria' && (
                  <>
                    <th className="p-3 text-center">Estoque Total</th>
                    <th className="p-3 text-center">Idade (Dias)</th>
                    <th className="p-3">Promotor Autorizado</th>
                    <th className="p-3 text-right font-bold">Classificação</th>
                  </>
                )}

                {activeReport === 'agencia' && (
                  <>
                    <th className="p-3">Indústria Fabricante</th>
                    <th className="p-3">Promotor Relacionado</th>
                    <th className="p-3">Dias Visita</th>
                    <th className="p-3 text-right">Classificação</th>
                  </>
                )}

                {activeReport === 'gerencial' && (
                  <>
                    <th className="p-3 text-center">Estoque Total</th>
                    <th className="p-3 text-center">Idade (Dias)</th>
                    {!hideFinancialValues && <th className="p-3 text-right">Custo Unit</th>}
                    {!hideFinancialValues && <th className="p-3 text-right">Valor Ativo</th>}
                    <th className="p-3">Promotor</th>
                    <th className="p-3 text-right font-bold">Classificação</th>
                  </>
                )}

              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[11px] font-sans">
              {reportData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={
                      activeReport === 'isv' 
                        ? (hideFinancialValues ? 9 : 10) 
                        : (activeReport === 'gerencial' ? (hideFinancialValues ? 7 : 9) : 8)
                    } 
                    className="text-center py-10 text-gray-400 font-bold"
                  >
                    Nenhum registro localizado sob os critérios de filtros indicados. Certifique-se de cadastrar/importar os dados na Base Principal e configurar os Fornecedores.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => {
                  return (
                    <tr key={row.product.codigo} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-gray-900">{row.product.codigo}</td>
                      <td className="p-3 font-bold text-gray-800 tracking-tight max-w-[200px] truncate" title={row.product.descricao}>
                        {row.product.descricao}
                      </td>
                      <td className="p-3 text-gray-500 font-mono font-medium">{row.product.embalagem}</td>
                      
                      {/* ISV Detailed columns render */}
                      {activeReport === 'isv' && (
                        <>
                          <td className="p-3 text-center font-mono font-bold text-gray-700 bg-gray-50/20">{row.product.estoqueFormatado || row.estoqueTotal}</td>
                          <td className="p-3 text-center font-mono text-red-650 font-bold">{row.product.semVenda} dias</td>
                          <td className="p-3 text-center font-mono text-gray-600">{(row.product.idade || 0)} dias</td>
                          {!hideFinancialValues && (
                            <td className="p-3 text-right font-mono font-black text-gray-900">
                              R$ {row.valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                          <td className="p-3 font-semibold text-gray-700 max-w-[150px] truncate" title={row.nomeIndustria}>
                            {row.nomeIndustria}
                          </td>
                          <td className="p-3 font-bold text-[#F58220] max-w-[120px] truncate" title={row.promotor}>
                            {row.promotor}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              row.classificacao === 'Ruptura' ? 'bg-red-100 text-red-800' :
                              row.classificacao === 'Abastecer' ? 'bg-orange-100 text-orange-800' :
                              row.classificacao === 'Atenção' ? 'bg-yellow-100 text-yellow-800' :
                              row.classificacao === 'Normal' ? 'bg-green-100 text-green-800' :
                              'bg-indigo-100 text-indigo-800'
                            }`}>
                              {row.classificacao}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Promoter Sub-columns */}
                      {activeReport === 'promotor' && (
                        <>
                          <td className="p-3 text-center font-mono font-black text-gray-900 bg-gray-50/50">{row.product.estoqueFormatado || row.estoqueTotal}</td>
                          <td className="p-3 text-center font-mono text-red-650 font-bold">{row.product.semVenda} dias</td>
                          <td className="p-3 text-center font-mono text-gray-600">{(row.product.idade || 0)} dias</td>
                          <td className="p-3 text-right">
                            <span className="font-extrabold text-[10px] uppercase text-gray-700">{row.classificacao}</span>
                          </td>
                        </>
                      )}

                      {/* Industry Sub-columns */}
                      {activeReport === 'industria' && (
                        <>
                          <td className="p-3 text-center font-mono font-bold text-gray-800">{row.product.estoqueFormatado || row.estoqueTotal}</td>
                          <td className="p-3 text-center font-mono text-gray-600">{(row.product.idade || 0)} dias</td>
                          <td className="p-3 font-extrabold text-gray-700">{row.promotor}</td>
                          <td className="p-3 text-right font-black uppercase text-[9px]">{row.classificacao}</td>
                        </>
                      )}

                      {/* Agency Sub-columns */}
                      {activeReport === 'agencia' && (
                        <>
                          <td className="p-3 font-bold text-gray-700 max-w-[150px] truncate">{row.nomeIndustria}</td>
                          <td className="p-3 font-extrabold text-[#2F2F2F]">{row.promotor}</td>
                          <td className="p-3 font-bold text-[#F58220] tracking-tight">{row.diasAtendimento.join(', ')}</td>
                          <td className="p-3 text-right font-black text-[9px]">{row.classificacao}</td>
                        </>
                      )}

                      {/* Gerencial layout with average cost and valor total */}
                      {activeReport === 'gerencial' && (
                        <>
                          <td className="p-3 text-center font-mono text-gray-600">{row.product.estoqueFormatado || row.estoqueTotal}</td>
                          <td className="p-3 text-center font-mono text-gray-600">{(row.product.idade || 0)} dias</td>
                          {!hideFinancialValues && <td className="p-3 text-right font-mono text-gray-600">R$ {row.product.custoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>}
                          {!hideFinancialValues && <td className="p-3 text-right font-mono font-black text-gray-900 bg-orange-50/20">R$ {row.valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>}
                          <td className="p-3 font-bold text-gray-700">{row.promotor}</td>
                          <td className="p-3 text-right font-black uppercase text-[9px]">{row.classificacao}</td>
                        </>
                      )}

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Corporate Signatures Footer Block */}
        <div className="border-t border-dashed pt-8 grid grid-cols-2 gap-8 text-center text-[10px] text-gray-400 font-sans tracking-tight">
          <div className="space-y-4">
            <div className="border-b max-w-[200px] mx-auto h-8"></div>
            <div>
              <p className="font-bold uppercase text-gray-500">{currentUser.name}</p>
              <p>Perfil: {currentUser.role} - Emissor</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b max-w-[200px] mx-auto h-8"></div>
            <div>
              <p className="font-bold uppercase text-gray-500">Atacadão Filial 172</p>
              <p>Auditor de Ruptura / Estoque Cascavel</p>
            </div>
          </div>
        </div>

        {/* Formal print page metrics */}
        <div className="flex justify-between items-center text-[9px] text-gray-400 font-mono border-t pt-3 font-bold">
          <span>Relatório ID: RPT-SISTEMA-{activeReport.toUpperCase()}-2026-CASCAVEL</span>
          <span>Página 1 de 1</span>
        </div>

      </div>

    </div>
  );
}
