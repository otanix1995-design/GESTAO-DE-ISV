/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, SystemStats } from '../types';
import { TEST_USERS } from '../mockData';
import { 
  Sliders, 
  UserCheck, 
  RotateCcw, 
  HardDrive, 
  CheckCircle2, 
  Info,
  Server,
  Code2,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';

interface ConfigViewProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  onResetDatabase: () => void;
  stats: SystemStats;
}

export default function ConfigView({
  currentUser,
  onUserChange,
  onResetDatabase,
  stats
}: ConfigViewProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const systemDiagnostics = [
    { name: 'Host do Container', value: 'Google Cloud Run (SANDBOX ENVIRONMENT)', status: 'online' },
    { name: 'Porta de Conexão', value: '3000 (Proxy Ativo)', status: 'online' },
    { name: 'Vite Hot Module Replacement', value: 'DISABLE_HMR (Injetado pelo AI Studio)', status: 'online' },
    { name: 'Indexador Temporal', value: 'JS LocalTime 2026 UTC', status: 'online' },
    { name: 'Módulo de Banco de Dados', value: 'Express Multi-User Backend + Persistência db.json', status: 'online' },
    { name: 'Filial Registrada', value: '172 - CASCAVEL (PARANÁ)', status: 'online' }
  ];

  return (
    <div className="space-y-6" id="config-tab">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 font-display">Configurações e Diagnósticos do Sistema</h2>
        <p className="text-xs text-gray-500 mt-1">
          Gerencie a integridade dos dados compartilhados da filial, confira a telemetria do sistema e limpe bases de teste.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Database Integrity & Reset Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 text-left">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#F58220]" />
            <h3 className="text-sm font-extrabold uppercase text-gray-400 tracking-wide font-display">Segurança de Dados e Resets</h3>
          </div>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            Deseja desfazer todas as modificações efetuadas e restaurar o banco de dados mestre da Filial 172-Cascavel com os produtos e vínculos industriais originais do Atacadão para todos os gestores?
          </p>

          <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 text-[11px] text-red-800 flex gap-2">
            <Lock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>
              <strong>Atenção:</strong> Esta ação limpará todos os cadastros adicionados, estoques modificados e históricos de alterações de forma corporativa para todos os usuários que utilizam a ferramenta. A operação é imediata e irreversível.
            </span>
          </div>

          <div className="pt-2">
            {!confirmingReset ? (
              <button
                onClick={() => setConfirmingReset(true)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-200/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Restaurar Banco de Dados Atacadão
              </button>
            ) : (
              <div className="space-y-2 border border-red-200 rounded-xl p-3.5 bg-red-50/50">
                <div className="flex gap-1.5 text-xs font-bold text-red-900 mb-1.5 items-center">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-600 animate-pulse" />
                  <span>Confirma exclusão e restauração definitiva?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onResetDatabase();
                      setConfirmingReset(false);
                    }}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-black uppercase tracking-wide transition-all text-center cursor-pointer"
                  >
                    Sim, Limpar Tudo
                  </button>
                  <button
                    onClick={() => setConfirmingReset(false)}
                    className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Diagnostics Log diagnostics elements */}
        <div className="bg-[#2F2F2F] p-6 rounded-2xl text-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-[#F58220]">
            <Server className="w-5 h-5" />
            <h3 className="text-xs font-black uppercase tracking-widest font-display">Console Técnico</h3>
          </div>

          <div className="space-y-2.5 font-mono text-[10px]">
            {systemDiagnostics.map((sys) => (
              <div key={sys.name} className="flex justify-between items-start border-b border-[#3F3F3F] pb-2">
                <span className="text-gray-400 font-bold">{sys.name}:</span>
                <span className="text-right text-gray-200 break-all max-w-[200px] font-bold">{sys.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
