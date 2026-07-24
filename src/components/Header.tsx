/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, SystemStats } from '../types';
import { TEST_USERS } from '../mockData';
import { 
  Store, 
  UserCheck, 
  RefreshCw, 
  Layers, 
  Users, 
  Calendar, 
  Clock, 
  Wifi, 
  ShieldCheck, 
  Check, 
  X, 
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface OnlineUserPresence {
  id: string;
  name: string;
  role: string;
  email?: string;
  lastSeen: string;
  status?: string;
}

interface HeaderProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  stats: SystemStats;
  onlineUsers?: OnlineUserPresence[];
  isSyncing?: boolean;
  onForceSync?: () => void;
  lastRemoteUpdateToast?: string | null;
}

export default function Header({ 
  currentUser, 
  onUserChange, 
  stats,
  onlineUsers = [],
  isSyncing = false,
  onForceSync,
  lastRemoteUpdateToast
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'switch' | 'online'>('switch');

  // Password verification state
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

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

  const handleAuthenticateOfficialUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'filial@172') {
      const officialUser: User = {
        id: '1',
        name: 'Atacadão Filial 172 Cascavel',
        role: 'Admin',
        email: 'atacadaocascavel@atacadao.com',
        password: 'filial@172'
      };
      onUserChange(officialUser);
      setPasswordError(null);
      setAuthSuccessMsg("Autenticado com sucesso na Filial 172!");
      setPasswordInput('');
      setTimeout(() => {
        setAuthSuccessMsg(null);
        setIsLoginModalOpen(false);
      }, 1500);
    } else {
      setPasswordError("Senha incorreta! A senha oficial da filial é filial@172");
      setAuthSuccessMsg(null);
    }
  };

  const uniqueOnlineUsers = onlineUsers.length > 0 ? onlineUsers : [
    { id: currentUser.id, name: currentUser.name, role: currentUser.role, email: currentUser.email, lastSeen: new Date().toISOString() }
  ];

  return (
    <header className="bg-white border-b border-gray-200 shadow-xs px-6 py-3.5 flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between z-10 sticky top-0" id="app-header">
      
      {/* Branch Brand Title */}
      <div className="flex items-center gap-3">
        <div className="bg-[#F58220] text-white p-2.5 rounded-xl shadow-xs flex items-center justify-center shrink-0">
          <Store className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-gray-900 font-display">
              ATACADÃO <span className="text-[#F58220] font-bold text-lg">FILIAL 172 - CASCAVEL</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Online Ao Vivo
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
            <RefreshCw className={`w-3 h-3 text-gray-400 ${isSyncing ? 'animate-spin text-[#F58220]' : ''}`} />
            Sincronizado com nuvem em: <span className="text-gray-700 font-semibold">{formatLastUpdate(stats.ultimaAtualizacao)}</span>
          </p>
        </div>
      </div>

      {/* Instant Operations Indicators */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:flex items-center flex-wrap">
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold font-sans">Cadastrados</div>
            <div className="text-xs font-black text-gray-800 font-mono">{stats.totalProdutos} Itens</div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Store className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold font-sans">Indústrias</div>
            <div className="text-xs font-black text-gray-800 font-mono">{stats.totalFornecedores} CNPJs</div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#F58220]" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold font-sans">Agentes</div>
            <div className="text-xs font-black text-gray-800 font-mono">{stats.totalPromotores} Promotores</div>
          </div>
        </div>
      </div>

      {/* Live Sync Controls, Users Online & Active User Badge */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between lg:justify-end gap-2.5 border-t pt-2.5 lg:border-none lg:pt-0">
        
        {/* Date / Time clock */}
        <div className="hidden sm:flex items-center justify-center gap-2.5 bg-[#F3F4F6] px-3 py-1.5 rounded-xl border border-gray-200">
          <div className="flex items-center gap-1 text-gray-600 text-xs font-mono font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>{formattedDate}</span>
          </div>
          <div className="h-3.5 w-px bg-gray-300"></div>
          <div className="flex items-center gap-1 text-gray-800 text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-[#F58220]" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Online Multi-User Presence Pill */}
        <button
          onClick={() => {
            setModalTab('online');
            setIsLoginModalOpen(true);
          }}
          className="bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          title="Ver usuários online sincronizados ao vivo"
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-extrabold text-[11px] uppercase tracking-wide">
              {uniqueOnlineUsers.length} {uniqueOnlineUsers.length === 1 ? 'Usuário Online' : 'Usuários Online'}
            </span>
          </div>
        </button>

        {/* Force Manual Sync Button */}
        {onForceSync && (
          <button
            onClick={onForceSync}
            disabled={isSyncing}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-2 flex items-center justify-center transition-all cursor-pointer border border-gray-200"
            title="Forçar Sincronização Online com Banco Nuvem"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${isSyncing ? 'animate-spin text-[#F58220]' : ''}`} />
          </button>
        )}

        {/* Active Logged-in User Profile Button (Clickable to switch login) */}
        <button
          onClick={() => {
            setModalTab('switch');
            setIsLoginModalOpen(true);
          }}
          className="flex items-center justify-between gap-2.5 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200/80 rounded-xl px-3 py-1.5 transition-all cursor-pointer text-left shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <div className="bg-[#F58220] text-white p-1 rounded-lg shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] text-[#F58220] uppercase font-black tracking-wider leading-none">
                Login Ativo (Clique p/ Trocar)
              </div>
              <div className="text-xs font-black text-gray-900 leading-normal truncate max-w-[150px] sm:max-w-[180px]">
                {currentUser.name}
              </div>
            </div>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${getRoleBadgeColor(currentUser.role)}`}>
            {currentUser.role}
          </span>
        </button>
      </div>

      {/* --- LIVE REMOTE UPDATE FLOATING TOAST NOTIFICATION --- */}
      <AnimatePresence>
        {lastRemoteUpdateToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white border border-orange-500/50 shadow-2xl rounded-2xl p-4 max-w-sm flex items-start gap-3"
          >
            <div className="bg-[#F58220] text-white p-2 rounded-xl shrink-0">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-black text-orange-400 uppercase tracking-wider">Sincronização Online Ao Vivo</div>
              <p className="text-xs text-gray-200 mt-1 font-medium">{lastRemoteUpdateToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MULTI-USER LOGIN & ONLINE SYNC MODAL --- */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-xl w-full overflow-hidden text-left flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#F58220] p-2 rounded-xl text-white">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black font-display tracking-tight text-white">Central de Login & Conexão Online</h3>
                    <p className="text-xs text-gray-300">
                      Sincronização em tempo real entre múltiplos usuários logados na Filial 172
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLoginModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-gray-100 bg-gray-50/80 px-5 pt-3 gap-2">
                <button
                  onClick={() => setModalTab('switch')}
                  className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    modalTab === 'switch'
                      ? 'bg-white text-[#F58220] border-t-2 border-[#F58220] shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F58220]" />
                  Acesso Oficial (Filial 172)
                </button>
                <button
                  onClick={() => setModalTab('online')}
                  className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    modalTab === 'online'
                      ? 'bg-white text-emerald-600 border-t-2 border-emerald-500 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  Usuários Online ({uniqueOnlineUsers.length})
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                
                {/* TAB 1: OFFICIAL USER AUTHENTICATION */}
                {modalTab === 'switch' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Usuário corporativo oficial cadastrado para a Filial 172 Cascavel:
                    </p>

                    <div className="p-4 rounded-2xl bg-orange-50/80 border border-[#F58220]/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#F58220] text-white p-2.5 rounded-xl font-black text-sm">
                            AT
                          </div>
                          <div>
                            <div className="text-xs font-black text-gray-900 flex items-center gap-2">
                              <span>Atacadão Filial 172 Cascavel</span>
                              <span className="bg-[#F58220] text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase">
                                Conta Única
                              </span>
                            </div>
                            <div className="text-xs text-gray-700 font-semibold mt-0.5 font-mono">
                              atacadaocascavel@atacadao.com
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                          Admin / Master
                        </span>
                      </div>

                      <div className="pt-2 border-t border-orange-200/60 text-xs text-gray-600 flex items-center justify-between font-mono">
                        <span>Senha Oficial: <strong className="text-gray-900 font-bold">filial@172</strong></span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">Ativo e Autenticado</span>
                      </div>
                    </div>

                    <form onSubmit={handleAuthenticateOfficialUser} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                      <label className="block text-xs font-bold text-gray-800">
                        Confirmar Senha de Acesso (filial@172)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          required
                          value={passwordInput}
                          onChange={(e) => {
                            setPasswordInput(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Digite a senha: filial@172"
                          className="flex-1 text-xs p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#F58220] focus:outline-none bg-white font-mono"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-[#F58220] hover:bg-[#e07318] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                        >
                          <Check className="w-4 h-4" /> Entrar / Validar
                        </button>
                      </div>

                      {passwordError && (
                        <div className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                          {passwordError}
                        </div>
                      )}

                      {authSuccessMsg && (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>{authSuccessMsg}</span>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* TAB 2: ONLINE ACTIVE USERS LIST */}
                {modalTab === 'online' && (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <span>Sincronização em tempo real habilitada via Firebase Firestore</span>
                      </div>
                      <span className="font-extrabold text-emerald-800 font-mono text-[11px]">{uniqueOnlineUsers.length} Conectados</span>
                    </div>

                    <p className="text-xs text-gray-500">
                      Dispositivos e colaboradores conectados ao vivo nesta filial:
                    </p>

                    <div className="space-y-2">
                      {uniqueOnlineUsers.map((u, i) => (
                        <div key={u.id + '_' + i} className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <div>
                              <div className="text-xs font-extrabold text-gray-900">{u.name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{u.email || 'atacadaocascavel@atacadao.com'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${getRoleBadgeColor(u.role)}`}>
                              {u.role}
                            </span>
                            <div className="text-[9px] text-gray-400 mt-0.5 font-mono">Conectado agora</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Sincronização Online Firebase Ativa
                </span>
                <button
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </header>
  );
}

