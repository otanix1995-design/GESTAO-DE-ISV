/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import Header from './components/Header';
import Sidebar, { ActiveTab } from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ImportView from './components/ImportView';
import BasePrincipalView from './components/BasePrincipalView';
import FornecedoresView from './components/FornecedoresView';
import PromotoresAgenciasView from './components/PromotoresAgenciasView';
import RelatoriosView from './components/RelatoriosView';
import ConfigView from './components/ConfigView';

import { 
  getSavedData, 
  saveData, 
  calculateSystemStats,
  normalizeProductCode,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_PROMOTERS,
  INITIAL_AGENCIES,
  INITIAL_SUPPLIER_HISTORY,
  INITIAL_IMPORT_HISTORY,
  TEST_USERS
} from './mockData';
import { 
  Product, 
  Supplier, 
  Promoter, 
  Agency, 
  User, 
  SupplierHistoryEntry, 
  ImportHistoryEntry 
} from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';

export default function App() {
  // Load persistent configurations or defaults
  const initialData = useMemo(() => getSavedData(), []);

  // Application States
  const [products, setProducts] = useState<Product[]>(() => {
    const rawProds = initialData.products || [];
    return rawProds.map(p => ({
      ...p,
      codigo: p.codigo ? normalizeProductCode(p.codigo) : '0'
    }));
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialData.suppliers || []);
  const [promoters, setPromoters] = useState<Promoter[]>(initialData.promoters || []);
  const [agencies, setAgencies] = useState<Agency[]>(initialData.agencies || []);
  const [supHistory, setSupHistory] = useState<SupplierHistoryEntry[]>(initialData.supHistory || []);
  const [impHistory, setImpHistory] = useState<ImportHistoryEntry[]>(initialData.impHistory || []);
  const [currentUser, setCurrentUser] = useState<User>(initialData.currentUser || { id: '1', role: 'Admin', name: 'Filial 172 Cascavel', email: 'danilo.gerencia@atacadao.com.br' });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(initialData.lastUpdateTime || '2026-06-04T07:30:00Z');
  
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Reference to track the timestamp of the last local change made by this client
  const lastLocalChangeTime = useRef<number>(0);

  // Tabs routes & Mobile navigation rails
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // 1. Establish Real-Time Synchronization with Firebase Firestore
  useEffect(() => {
    const docRef = doc(db, 'state', 'current');
    
    // Subscribe to real-time changes
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const s = snapshot.data();
        
        // Skip updating local state if the snapshot contains pending writes from this client.
        // This avoids cursor jumps or overwrite issues during rapid input sessions.
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        // Skip updating local state if a local change was made very recently (to prevent overwriting local edits during sync delays or quota errors)
        if (Date.now() - lastLocalChangeTime.current < 5000) {
          return;
        }

        if (Array.isArray(s.products)) {
          const cleaned = s.products.map((p: any) => ({
            ...p,
            codigo: p.codigo ? normalizeProductCode(p.codigo) : '0'
          }));
          setProducts(prev => {
            const isSame = JSON.stringify(prev) === JSON.stringify(cleaned);
            return isSame ? prev : cleaned;
          });
        }
        if (Array.isArray(s.suppliers)) {
          setSuppliers(prev => JSON.stringify(prev) === JSON.stringify(s.suppliers) ? prev : s.suppliers);
        }
        if (Array.isArray(s.promoters)) {
          setPromoters(prev => JSON.stringify(prev) === JSON.stringify(s.promoters) ? prev : s.promoters);
        }
        if (Array.isArray(s.agencies)) {
          setAgencies(prev => JSON.stringify(prev) === JSON.stringify(s.agencies) ? prev : s.agencies);
        }
        if (Array.isArray(s.supHistory)) {
          setSupHistory(prev => JSON.stringify(prev) === JSON.stringify(s.supHistory) ? prev : s.supHistory);
        }
        if (Array.isArray(s.impHistory)) {
          setImpHistory(prev => JSON.stringify(prev) === JSON.stringify(s.impHistory) ? prev : s.impHistory);
        }
        if (s.lastUpdateTime) {
          setLastUpdateTime(prev => prev === s.lastUpdateTime ? prev : s.lastUpdateTime);
        }
      } else {
        // If the Firestore document does not exist yet, seed it with local/initial data
        console.log("Firestore state empty. Seeding with local or initial mock data.");
        const localDefaults = getSavedData();
        const cleanedDefaultsProducts = (localDefaults.products || []).map((p: any) => ({
          ...p,
          codigo: p.codigo ? normalizeProductCode(p.codigo) : '0'
        }));
        setDoc(docRef, {
          products: cleanedDefaultsProducts,
          suppliers: localDefaults.suppliers || [],
          promoters: localDefaults.promoters || [],
          agencies: localDefaults.agencies || [],
          supHistory: localDefaults.supHistory || [],
          impHistory: localDefaults.impHistory || [],
          lastUpdateTime: localDefaults.lastUpdateTime || '2026-06-04T07:30:00Z'
        }).catch(err => console.error("Erro ao inicializar base no Firestore:", err));
      }
      setHasLoadedFromServer(true);
    }, (error) => {
      console.error("Erro no listener em tempo real do Firestore:", error);
      // Fallback: make sure the app works and can be loaded
      setHasLoadedFromServer(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Automatically save local changes to both LocalStorage (offline) and Firestore (live multiplayer)
  useEffect(() => {
    if (!hasLoadedFromServer || isResetting) return;

    // Track that a local change was just made
    lastLocalChangeTime.current = Date.now();

    const payload = {
      products,
      suppliers,
      promoters,
      agencies,
      supHistory,
      impHistory,
      currentUser,
      lastUpdateTime
    };

    // Save to LocalStorage
    saveData(payload);

    // Save to Firestore
    const docRef = doc(db, 'state', 'current');
    setDoc(docRef, {
      products,
      suppliers,
      promoters,
      agencies,
      supHistory,
      impHistory,
      lastUpdateTime
    }).catch(err => {
      console.error("Erro ao sincronizar dados com o Firestore:", err);
    });

    // Redundant backup to local Express backend
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error("Erro ao sincronizar com servidor backup:", err));

  }, [products, suppliers, promoters, agencies, supHistory, impHistory, lastUpdateTime, hasLoadedFromServer, isResetting]);

  // Handle active role selector changes (ensure safe tab redirects on permission change)
  const handleUserChange = (newUser: User) => {
    setCurrentUser(newUser);
    
    // Safety role checks
    if (newUser.role === 'Promotor') {
      // Redirect promoters away from protected areas like configurations or imports
      if (activeTab === 'importacao' || activeTab === 'configuracoes') {
        setActiveTab('dashboard');
      }
    }
  };

  // Reset database to initials on backend server + browser local storage + Firestore
  const handleResetDatabase = async () => {
    try {
      setIsResetting(true);
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      
      const freshDefaults = {
        products: INITIAL_PRODUCTS,
        suppliers: INITIAL_SUPPLIERS,
        promoters: INITIAL_PROMOTERS,
        agencies: INITIAL_AGENCIES,
        supHistory: INITIAL_SUPPLIER_HISTORY,
        impHistory: INITIAL_IMPORT_HISTORY,
        lastUpdateTime: '2026-06-04T07:30:00Z'
      };

      // Reset on Firestore
      const docRef = doc(db, 'state', 'current');
      await setDoc(docRef, {
        products: INITIAL_PRODUCTS,
        suppliers: INITIAL_SUPPLIERS,
        promoters: INITIAL_PROMOTERS,
        agencies: INITIAL_AGENCIES,
        supHistory: INITIAL_SUPPLIER_HISTORY,
        impHistory: INITIAL_IMPORT_HISTORY,
        lastUpdateTime: '2026-06-04T07:30:00Z'
      });

      await fetch('/api/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freshDefaults)
      });

      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      console.error("Erro ao resetar banco:", err);
      setIsResetting(false);
    }
  };

  // Update the catalog update timeline on imports
  const handleUpdateStatsTimeline = (newTimestamp: string) => {
    setLastUpdateTime(newTimestamp);
  };

  // Calculate live global stats
  const systemStats = useMemo(() => {
    return calculateSystemStats(products, suppliers, promoters, agencies, lastUpdateTime);
  }, [products, suppliers, promoters, agencies, lastUpdateTime]);

  // Active view content router
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            products={products}
            suppliers={suppliers}
            promoters={promoters}
            agencies={agencies}
            currentUser={currentUser}
            stats={systemStats}
          />
        );
      case 'importacao':
        return (
          <ImportView
            products={products}
            setProducts={setProducts}
            currentUser={currentUser}
            impHistory={impHistory}
            setImpHistory={setImpHistory}
            onUpdateStats={handleUpdateStatsTimeline}
            suppliers={suppliers}
          />
        );
      case 'base_principal':
        return (
          <BasePrincipalView
            products={products}
            setProducts={setProducts}
            suppliers={suppliers}
            currentUser={currentUser}
            globalSearchQuery={globalSearchQuery}
          />
        );
      case 'fornecedores':
        return (
          <FornecedoresView
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            promoters={promoters}
            agencies={agencies}
            currentUser={currentUser}
            supHistory={supHistory}
            setSupHistory={setSupHistory}
          />
        );
      case 'promotores':
        return (
          <PromotoresAgenciasView
            viewMode="promotores"
            promoters={promoters}
            setPromoters={setPromoters}
            agencies={agencies}
            setAgencies={setAgencies}
            currentUser={currentUser}
          />
        );
      case 'agencias':
        return (
          <PromotoresAgenciasView
            viewMode="agencias"
            promoters={promoters}
            setPromoters={setPromoters}
            agencies={agencies}
            setAgencies={setAgencies}
            currentUser={currentUser}
          />
        );
      case 'relatorios':
        return (
          <RelatoriosView
            products={products}
            suppliers={suppliers}
            promoters={promoters}
            agencies={agencies}
            currentUser={currentUser}
            stats={systemStats}
          />
        );
      case 'configuracoes':
        return (
          <ConfigView
            currentUser={currentUser}
            onUserChange={handleUserChange}
            onResetDatabase={handleResetDatabase}
            stats={systemStats}
          />
        );
      default:
        return (
          <div className="py-20 text-center text-gray-500">
            Navegação inválida. Selecione uma opção no painel lateral.
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] text-gray-800" id="atacao-root">
      
      {/* 1. SIDE NAVIGATION BAR (Cinza escuro, ícones laranja) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setGlobalSearchQuery(''); // reset global queries on page changes
        }}
        userRole={currentUser.role}
        isOpenMobile={isMobileSidebarOpen}
        setIsOpenMobile={setIsMobileSidebarOpen}
      />

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 3. CORPORATE CABEÇALHO */}
        <Header
          currentUser={currentUser}
          onUserChange={handleUserChange}
          stats={systemStats}
        />

        {/* --- GLOBAL SEARCH EXTRA RAIL BAR (Only showing if tab supports queries) --- */}
        {activeTab === 'base_principal' && (
          <div className="bg-[#EFEFEF] px-6 py-2 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-550">
              <Search className="w-4 h-4 text-[#F58220]" />
              <span>Busca inteligente ativa:</span>
            </div>
            
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Busca global instantânea em todo o catálogo..."
                className="text-xs bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-[#F58220]"
              />
              {globalSearchQuery && (
                <button 
                  onClick={() => setGlobalSearchQuery('')}
                  className="absolute right-2.5 top-2 text-[10px] text-gray-400 hover:text-gray-600 font-bold"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. SCROLLABLE BODY PANELS WITH MOTION TRANSITIONS */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderActiveTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

    </div>
  );
}
