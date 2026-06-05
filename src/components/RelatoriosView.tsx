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
  FileSpreadsheet
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

type ReportType = 'promotor' | 'industria' | 'agencia' | 'gerencial';

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
  const [activeReport, setActiveReport] = useState<ReportType>(
    isManagerOrAdmin ? 'gerencial' : 'promotor'
  );
  const [selectedDate, setSelectedDate] = useState('2026-06-04');
  
  // Custom Filters for each Report
  const [reportPromoter, setReportPromoter] = useState(
    isPromotor ? currentUser.promoterName || '' : 'todos'
  );
  const [reportIndustry, setReportIndustry] = useState('todos');
  const [reportAgency, setReportAgency] = useState('todos');
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');

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

  // --- REPORT FILTER ENGINE ---
  const reportData = useMemo(() => {
    let result = [...productsDerived];

    if (activeReport === 'promotor') {
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

    return result;
  }, [activeReport, productsDerived, reportPromoter, reportIndustry, reportAgency, isPromotor, currentUser.promoterName]);

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

  // --- EXPORT TO EXCEL/CSV SIMULATOR ---
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `relatorio_${activeReport}_${selectedDate}.csv`;

    if (activeReport === 'promotor') {
      headers = ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE EMB1', 'ESTOQUE EMB9', 'ESTOQUE TOTAL', 'SEM VENDA (DIAS)', 'STATUS'];
      rows = reportData.map(d => [
        d.product.codigo,
        d.product.descricao,
        d.product.embalagem,
        d.product.estoqueEmb1.toString(),
        d.product.estoqueEmb9.toString(),
        d.estoqueTotal.toString(),
        d.product.semVenda.toString(),
        d.classificacao
      ]);
    } else if (activeReport === 'industria') {
      headers = ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE EMB1', 'ESTOQUE EMB9', 'ESTOQUE TOTAL', 'STATUS', 'PROMOTOR', 'AGÊNCIA'];
      rows = reportData.map(d => [
        d.product.codigo,
        d.product.descricao,
        d.product.embalagem,
        d.product.estoqueEmb1.toString(),
        d.product.estoqueEmb9.toString(),
        d.estoqueTotal.toString(),
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
      headers = ['CÓDIGO', 'PRODUTO', 'EMBALAGEM', 'ESTOQUE EMB1', 'ESTOQUE EMB9', 'ESTOQUE TOTAL', 'CUSTO MÉDIO (R$)', 'VALOR ESTOQUE (R$)', 'STATUS', 'PROMOTOR'];
      rows = reportData.map(d => [
        d.product.codigo,
        d.product.descricao,
        d.product.embalagem,
        d.product.estoqueEmb1.toString(),
        d.product.estoqueEmb9.toString(),
        d.estoqueTotal.toString(),
        d.product.custoMedio.toFixed(2),
        d.valorEstoque.toFixed(2),
        d.classificacao,
        d.promotor
      ]);
    }

    // Build delimiter rows
    const csvContent = "\uFEFF" + [
      [`REDE ATACADÃO S.A. - FILIAL 172 CASCAVEL - DATA EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`],
      [`RELATÓRIO OPERACIONAL: ${activeReport.toUpperCase()}`],
      [`Filtros aplicados: Data: ${selectedDate} | Promotor: ${reportPromoter} | Indústria: ${reportIndustry} | Agência: ${reportAgency}`],
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
    <div className="space-y-6" id="relatorios-tab">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-display">Gerador de Relatórios e Exportação</h2>
          <p className="text-xs text-gray-500 mt-1">
            Gere planilhas operacionais e PDFs executivos para auditorias de ruptura de fardo, abastecimento de gôndole e balanços de ISV.
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
        
        {/* Menu/Report Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
          
          <button
            onClick={() => { setActiveReport('promotor'); setReportPromoter(isPromotor ? currentUser.promoterName || '' : 'todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'promotor' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Contact className="w-4 h-4" /> Relatório por Promotor
          </button>

          <button
            onClick={() => { setActiveReport('industria'); setReportIndustry('todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'industria' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building className="w-4 h-4" /> Relatório por Indústria
          </button>

          <button
            onClick={() => { setActiveReport('agencia'); setReportAgency('todos'); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeReport === 'agencia' 
                ? 'bg-[#F58220] text-white shadow-sm font-black' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Relatório por Agência
          </button>

          <button
            onClick={() => { 
              if (!isManagerOrAdmin) {
                alert('Acesso Restrito ao Relatório Gerencial: Somente Administradores ou Gestores possuem acesso aos demonstrativos financeiros de custos de estoque.');
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
            <LineChart className="w-4 h-4" /> Relatório Gerencial
          </button>
        </div>

        {/* Filters according to selected report */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          
          {/* Calendar Picker */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">DATA DE REFERÊNCIA</label>
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

          {/* Promoter Select Option (Relevant to Promotor or Gerencial tabs) */}
          {(activeReport === 'promotor' || activeReport === 'gerencial') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">FILTRAR PROMOTOR</label>
              <select
                disabled={isPromotor}
                value={reportPromoter}
                onChange={(e) => setReportPromoter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F58220] text-gray-700"
              >
                {!isPromotor && <option value="todos">Todos os Promotores</option>}
                {filterList.promoters.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Industry Selection Option (Relevant to Industria or Gerencial tabs) */}
          {(activeReport === 'industria' || activeReport === 'gerencial') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">FILTRAR INDÚSTRIA (CNPJ)</label>
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
          {activeReport === 'agencia' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">SINDICALIZAR AGÊNCIA</label>
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

          {/* Export and Print Buttons */}
          <div className="sm:col-span-2 md:col-span-1 flex items-end gap-2 text-xs">
            <button
              onClick={handleExportCSV}
              className="flex-1 py-2 border border-gray-200 text-gray-650 rounded-xl hover:bg-gray-50 font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Exportar Planilha
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex-1 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-indigo-600" /> Imprimir / PDF
            </button>
          </div>

        </div>

      </div>

      {/* --- FORMAL PREVIEW SHEETS EMBEDDED PREVIEW AREA --- */}
      {/* This area will render a gorgeous professional letter styled container mimicking standard A4 paper boundaries */}
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
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-205 flex flex-wrap justify-between gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-sans">Documento Solicitado</span>
            <span className="font-extrabold text-sm text-gray-850 font-display">
              Relatório {activeReport === 'promotor' ? 'por Promotor de Vendas' 
                       : activeReport === 'industria' ? 'por Indústria Mapeada'
                       : activeReport === 'agencia' ? 'por Agência Licenciada'
                       : 'Gerencial de Auditoria Financeira'}
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
                {activeReport === 'promotor' ? `Promotor: ${reportPromoter}`
                 : activeReport === 'industria' ? `Fabricante Match`
                 : activeReport === 'agencia' ? `Agência: ${reportAgency}`
                 : 'Multifiltro Master'}
              </span>
            </div>
          </div>
        </div>

        {/* SUMMARY BLOCKS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="text-gray-400 text-[10px] font-bold uppercase">Volume Código</div>
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
            {isManagerOrAdmin && activeReport === 'gerencial' ? (
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
        <div className="overflow-hidden border border-gray-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wide">
                <th className="p-3">Cód.</th>
                <th className="p-3">Descrição Mercadoria</th>
                <th className="p-3">Emb.</th>
                
                {/* Specific layouts according to sub-report constraints */}
                {activeReport === 'promotor' && (
                  <>
                    <th className="p-3 text-center">Fardos (Emb1)</th>
                    <th className="p-3 text-center">Unids (Emb9)</th>
                    <th className="p-3 text-center">Estoque Total</th>
                    <th className="p-3 text-center">Inativo (SemVenda)</th>
                    <th className="p-3 text-right">Classificação</th>
                  </>
                )}

                {activeReport === 'industria' && (
                  <>
                    <th className="p-3 text-center">Estoque Emb1</th>
                    <th className="p-3 text-center">Estoque Emb9</th>
                    <th className="p-3 text-center">Total</th>
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
                    <th className="p-3 text-center">Emb1</th>
                    <th className="p-3 text-center">Emb9</th>
                    <th className="p-3 text-right">Custo Unit</th>
                    <th className="p-3 text-right">Valor Ativo</th>
                    <th className="p-3">Promotor</th>
                    <th className="p-3 text-right font-bold">Classificação</th>
                  </>
                )}

              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[11px] font-sans">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400 font-bold">
                    Nenhum registro localizado sob os critérios de filtros indicados.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => {
                  return (
                    <tr key={row.product.codigo} className="hover:bg-gray-55/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-gray-900">{row.product.codigo}</td>
                      <td className="p-3 font-bold text-gray-800 tracking-tight max-w-[200px] truncate">{row.product.descricao}</td>
                      <td className="p-3 text-gray-400 font-mono font-medium">{row.product.embalagem}</td>
                      
                      {/* Promoter Sub-columns with strict hidden financial rule */}
                      {activeReport === 'promotor' && (
                        <>
                          <td className="p-3 text-center font-mono font-bold text-gray-700">{row.product.estoqueEmb1}</td>
                          <td className="p-3 text-center font-mono text-gray-750">{row.product.estoqueEmb9}</td>
                          <td className="p-3 text-center font-mono font-black text-gray-900 bg-gray-50/50">{row.estoqueTotal}</td>
                          <td className="p-3 text-center font-mono text-red-650">{row.product.semVenda} dias</td>
                          <td className="p-3 text-right">
                            <span className="font-extrabold text-[10px] uppercase">{row.classificacao}</span>
                          </td>
                        </>
                      )}

                      {/* Industry Sub-columns */}
                      {activeReport === 'industria' && (
                        <>
                          <td className="p-3 text-center font-mono">{row.product.estoqueEmb1}</td>
                          <td className="p-3 text-center font-mono">{row.product.estoqueEmb9}</td>
                          <td className="p-3 text-center font-mono font-bold text-gray-800">{row.estoqueTotal}</td>
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
                          <td className="p-3 text-center font-mono text-gray-600">{row.product.estoqueEmb1}</td>
                          <td className="p-3 text-center font-mono text-gray-600">{row.product.estoqueEmb9}</td>
                          <td className="p-3 text-right font-mono text-gray-600">R$ {row.product.custoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-mono font-black text-gray-900 bg-orange-50/20">R$ {row.valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
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
