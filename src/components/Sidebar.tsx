/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Database, 
  Luggage, 
  Contact, 
  Building, 
  FilePieChart, 
  Sliders, 
  Menu, 
  X,
  Store,
  Compass
} from 'lucide-react';
import { Role } from '../types';

export type ActiveTab = 'dashboard' | 'importacao' | 'base_principal' | 'fornecedores' | 'promotores' | 'agencias' | 'relatorios' | 'configuracoes';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userRole: Role;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, userRole, isOpenMobile, setIsOpenMobile }: SidebarProps) {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'importacao', label: 'Importação Diária', icon: UploadCloud, roles: ['Admin', 'Gestor'] }, // Gestor can view history/template, Admin can import
    { id: 'base_principal', label: 'Base Principal', icon: Database, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'fornecedores', label: 'Fornecedores', icon: Store, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'promotores', label: 'Promotores', icon: Contact, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'agencias', label: 'Agências', icon: Building, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'relatorios', label: 'Relatórios', icon: FilePieChart, roles: ['Admin', 'Gestor', 'Promotor'] },
    { id: 'configuracoes', label: 'Configurações', icon: Sliders, roles: ['Admin', 'Gestor', 'Promotor'] }
  ];

  // Filter based on roles
  const filteredItems = menuItems.filter(item => item.roles.includes(userRole));

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId as ActiveTab);
    setIsOpenMobile(false);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#2F2F2F] text-gray-200">
      {/* Brand logo header (Only visible in sidebar context) */}
      <div className="p-6 border-b border-[#3F3F3F] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F58220] flex items-center justify-center font-bold text-white font-display">
            A
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-white">ATACADÃO S.A.</div>
            <div className="text-[10px] text-[#F58220] tracking-widest font-mono">ESTOQUE & ISV MGR</div>
          </div>
        </div>
        {isOpenMobile && (
          <button 
            onClick={() => setIsOpenMobile(false)}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#3F3F3F]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive 
                  ? 'bg-[#F58220] text-white shadow-md shadow-[#F58220]/20' 
                  : 'text-gray-300 hover:bg-[#3F3F3F] hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#F58220]'}`} />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Corporate Footprint */}
      <div className="p-4 border-t border-[#3F3F3F] text-center bg-[#252525]">
        <div className="text-[10px] text-gray-500 font-mono tracking-wide">
          Atacadão S.A. Cascavel (PR)
        </div>
        <div className="text-[9px] text-gray-600 mt-0.5">
          v1.4.0 (Sistema Operacional)
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile absolute trigger (Floating bottom on small screens or top rail helper) */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="bg-[#2F2F2F] text-white p-4 rounded-full shadow-2xl hover:bg-[#3F3F3F] transition-all flex items-center justify-center border border-[#3F3F3F]"
        >
          {isOpenMobile ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-[#F58220]" />}
        </button>
      </div>

      {/* Mobile Sidebar Slide Drawer overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsOpenMobile(false)} />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="relative w-72 max-w-xs h-full"
          >
            {navContent}
          </motion.div>
        </div>
      )}

      {/* Desktop Sidebar Layout */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 shrink-0 select-none z-20 border-r border-[#1D1D1D] shadow-xl">
        {navContent}
      </aside>
    </>
  );
}
