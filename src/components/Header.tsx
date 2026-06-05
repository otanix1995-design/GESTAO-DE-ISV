/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, SystemStats } from '../types';
import { TEST_USERS } from '../mockData';
import { Store, UserCheck, RefreshCw, Layers, Users, Calendar, Clock, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  stats: SystemStats;
}

export default function Header({ currentUser, onUserChange, stats }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'Gestor':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Promotor':
        return 'bg-green-100 text-green-800 border border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const formattedDate = time.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const formattedTime = time.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formatLastUpdate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '04/06/2026 07:30';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between z-10 sticky top-0" id="app-header">
      {/* Branch Brand Title */}
      <div className="flex items-center gap-3">
        <div className="bg-[#F58220] text-white p-2.5 rounded-lg shadow-md flex items-center justify-center">
          <Store className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display flex items-center gap-2">
            ATACADÃO <span className="text-[#F58220] font-semibold text-lg">FILIAL 172 - CASCAVEL</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
            <RefreshCw className="w-3 h-3 text-gray-400" />
            Lançamento de Estoque atualizado em: <span className="text-gray-700 font-semibold">{formatLastUpdate(stats.ultimaAtualizacao)}</span>
          </p>
        </div>
      </div>

      {/* Instant Operations Indicators */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:flex items-center flex-wrap">
        {/* Total Products Stat */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold font-sans">Cadastrados</div>
            <div className="text-sm font-bold text-gray-800 font-mono">{stats.totalProdutos} Itens</div>
          </div>
        </div>

        {/* Total Suppliers Stat */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Store className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold font-sans">Indústrias</div>
            <div className="text-sm font-bold text-gray-800 font-mono">{stats.totalFornecedores} CNPJs</div>
          </div>
        </div>

        {/* Total Promoters Stat */}
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold font-sans">Agentes</div>
            <div className="text-sm font-bold text-gray-800 font-mono">{stats.totalPromotores} Promotores</div>
          </div>
        </div>
      </div>

      {/* Date, Time and Active Simulation User */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between lg:justify-end gap-3 border-t pt-3 lg:border-none lg:pt-0">
        {/* Date / Time clock */}
        <div className="flex items-center justify-center gap-3 bg-[#F3F4F6] px-3.5 py-1.5 rounded-lg border border-gray-200">
          <div className="flex items-center gap-1 text-gray-600 text-xs font-mono font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>{formattedDate}</span>
          </div>
          <div className="h-4 w-px bg-gray-300"></div>
          <div className="flex items-center gap-1 text-gray-800 text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-[#F58220]" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Gestor Logado */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-1.5">
          <UserCheck className="w-4 h-4 text-[#F58220] shrink-0" />
          <div className="text-left">
            <div className="text-[9px] text-[#F58220] uppercase font-black tracking-wider leading-none">Gestor Ativo</div>
            <div className="text-xs font-extrabold text-gray-800 leading-normal">
              Filial 172 Cascavel
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-sans uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
            GESTOR
          </span>
        </div>
      </div>
    </header>
  );
}
