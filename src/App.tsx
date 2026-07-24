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
import { doc, collection, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import Header, { OnlineUserPresence } from './components/Header';
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
  deduplicateProducts,
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
    return deduplicateProducts(rawProds);
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialData.suppliers || []);
  const [promoters, setPromoters] = useState<Promoter[]>(initialData.promoters || []);
  const [agencies, setAgencies] = useState<Agency[]>(initialData.agencies || []);
  const [supHistory, setSupHistory] = useState<SupplierHistoryEntry[]>(initialData.supHistory || []);
  const [impHistory, setImpHistory] = useState<ImportHistoryEntry[]>(initialData.impHistory || []);
  const [currentUser, setCurrentUser] = useState<User>(
    (initialData.currentUser && initialData.currentUser.email === 'atacadaocascavel@atacadao.com')
      ? initialData.currentUser
      : { id: '1', role: 'Admin', name: 'Atacadão Filial 172 Cascavel', email: 'atacadaocascavel@atacadao.com', password: 'filial@172' }
  );
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(initialData.lastUpdateTime || '2026-06-04T07:30:00Z');
  
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastRemoteUpdateToast, setLastRemoteUpdateToast] = useState<string | null>(null);

  // Reference to track the timestamp of the last local change made by this client
  const lastLocalChangeTime = useRef<number>(0);
  const lastUpdateTimeRef = useRef<string>(lastUpdateTime);

  // Sync the ref with the state so our listener closure always has access to the correct local time
  useEffect(() => {
    lastUpdateTimeRef.current = lastUpdateTime;
  }, [lastUpdateTime]);

  // Online User Heartbeat in Firestore (posts current user online status every 15s)
  useEffect(() => {
    if (!currentUser?.id) return;
    const userDocRef = doc(db, 'online_users', currentUser.id);

    const updatePresence = async () => {
      try {
        await setDoc(userDocRef, {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email || '',
          lastSeen: new Date().toISOString(),
          status: 'online'
        }, { merge: true });
      } catch (err) {
        console.warn("Presença de usuário online:", err);
      }
    };

    updatePresence();
    const timer = setInterval(updatePresence, 15000);
    return () => clearInterval(timer);
  }, [currentUser]);

  // Real-time listener for all active online users
  useEffect(() => {
    const colRef = collection(db, 'online_users');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const now = Date.now();
      const active: OnlineUserPresence[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as OnlineUserPresence;
        // Consider active if updated within the last 3 minutes and official account
        if (data.lastSeen && (now - Date.parse(data.lastSeen)) < 180000) {
          if (data.email === 'atacadaocascavel@atacadao.com' || data.name?.includes('Filial 172')) {
            active.push(data);
          }
        }
      });
      setOnlineUsers(active);
    }, (err) => {
      console.warn("Erro ao ouvir usuários online:", err);
    });
    return () => unsubscribe();
  }, []);

  const triggerToast = (msg: string) => {
    setLastRemoteUpdateToast(msg);
    setTimeout(() => {
      setLastRemoteUpdateToast(null);
    }, 5000);
  };

  // Tabs routes & Mobile navigation rails
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // 1. Establish Real-Time Synchronization with Firebase Firestore and Load Initial Data
  useEffect(() => {
    let isMounted = true;

    const currentDocRef = doc(db, 'state', 'current');
    const productsMetaDocRef = doc(db, 'state', 'products_metadata');

    // Boot: Load latest online state from Firestore first
    const loadFromFirestoreOnBoot = async () => {
      try {
        const [currentSnap, metaSnap] = await Promise.all([
          getDoc(currentDocRef),
          getDoc(productsMetaDocRef)
        ]);

        let hasLoadedFirestoreData = false;

        if (currentSnap.exists()) {
          const s = currentSnap.data();
          if (Array.isArray(s.suppliers)) setSuppliers(s.suppliers);
          if (Array.isArray(s.promoters)) setPromoters(s.promoters);
          if (Array.isArray(s.agencies)) setAgencies(s.agencies);
          if (Array.isArray(s.supHistory)) setSupHistory(s.supHistory);
          if (Array.isArray(s.impHistory)) setImpHistory(s.impHistory);
          if (s.lastUpdateTime) {
            setLastUpdateTime(s.lastUpdateTime);
            lastUpdateTimeRef.current = s.lastUpdateTime;
          }
          hasLoadedFirestoreData = true;
        }

        if (metaSnap.exists()) {
          const meta = metaSnap.data();
          const numChunks = meta.numChunks || 0;
          if (numChunks > 0) {
            const chunkPromises = [];
            for (let i = 0; i < numChunks; i++) {
              chunkPromises.push(getDoc(doc(db, 'state', `products_chunk_${i}`)));
            }
            const chunkSnaps = await Promise.all(chunkPromises);
            let combinedProducts: Product[] = [];
            chunkSnaps.forEach(snap => {
              if (snap.exists() && Array.isArray(snap.data().products)) {
                combinedProducts = combinedProducts.concat(snap.data().products);
              }
            });
            if (combinedProducts.length > 0) {
              setProducts(deduplicateProducts(combinedProducts));
              hasLoadedFirestoreData = true;
            }
          }
        }

        // If Firestore had no data, fallback to local Express server or LocalStorage
        if (!hasLoadedFirestoreData) {
          const res = await fetch('/api/data');
          if (res.ok) {
            const resJson = await res.json();
            const s = resJson?.data || initialData;
            if (Array.isArray(s.products) && s.products.length > 0) setProducts(deduplicateProducts(s.products));
            if (Array.isArray(s.suppliers)) setSuppliers(s.suppliers);
            if (Array.isArray(s.promoters)) setPromoters(s.promoters);
            if (Array.isArray(s.agencies)) setAgencies(s.agencies);
            if (Array.isArray(s.supHistory)) setSupHistory(s.supHistory);
            if (Array.isArray(s.impHistory)) setImpHistory(s.impHistory);
            if (s.lastUpdateTime) {
              setLastUpdateTime(s.lastUpdateTime);
              lastUpdateTimeRef.current = s.lastUpdateTime;
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao carregar do Firestore no boot, usando backup local:", err);
        try {
          const res = await fetch('/api/data');
          if (res.ok) {
            const resJson = await res.json();
            const s = resJson?.data || initialData;
            if (Array.isArray(s.products) && s.products.length > 0) setProducts(deduplicateProducts(s.products));
            if (Array.isArray(s.suppliers)) setSuppliers(s.suppliers);
            if (Array.isArray(s.promoters)) setPromoters(s.promoters);
            if (Array.isArray(s.agencies)) setAgencies(s.agencies);
            if (Array.isArray(s.supHistory)) setSupHistory(s.supHistory);
            if (Array.isArray(s.impHistory)) setImpHistory(s.impHistory);
            if (s.lastUpdateTime) {
              setLastUpdateTime(s.lastUpdateTime);
              lastUpdateTimeRef.current = s.lastUpdateTime;
            }
          }
        } catch (_) {}
      } finally {
        if (isMounted) setHasLoadedFromServer(true);
      }
    };

    loadFromFirestoreOnBoot();

    // Subscribe to operational data Firestore changes
    const unsubscribeCurrent = onSnapshot(currentDocRef, (snapshot) => {
      if (!isMounted) return;
      if (snapshot.exists()) {
        if (snapshot.metadata.hasPendingWrites) {
          return; // Ignore optimistic local write in progress
        }

        const s = snapshot.data();
        const localTime = Date.parse(lastUpdateTimeRef.current || '2026-06-04T07:30:00Z');
        const serverTime = s.lastUpdateTime ? Date.parse(s.lastUpdateTime) : 0;

        if (serverTime > 0 && localTime > serverTime) {
          return;
        }

        const isReset = s.lastUpdateTime === '2026-06-04T07:30:00Z';

        if (Array.isArray(s.suppliers) && (s.suppliers.length > 0 || isReset)) {
          setSuppliers(prev => JSON.stringify(prev) === JSON.stringify(s.suppliers) ? prev : s.suppliers);
        }
        if (Array.isArray(s.promoters) && (s.promoters.length > 0 || isReset)) {
          setPromoters(prev => JSON.stringify(prev) === JSON.stringify(s.promoters) ? prev : s.promoters);
        }
        if (Array.isArray(s.agencies) && (s.agencies.length > 0 || isReset)) {
          setAgencies(prev => JSON.stringify(prev) === JSON.stringify(s.agencies) ? prev : s.agencies);
        }
        if (Array.isArray(s.supHistory) && (s.supHistory.length > 0 || isReset)) {
          setSupHistory(prev => JSON.stringify(prev) === JSON.stringify(s.supHistory) ? prev : s.supHistory);
        }
        if (Array.isArray(s.impHistory) && (s.impHistory.length > 0 || isReset)) {
          setImpHistory(prev => JSON.stringify(prev) === JSON.stringify(s.impHistory) ? prev : s.impHistory);
        }
        if (s.lastUpdateTime) {
          setLastUpdateTime(prev => prev === s.lastUpdateTime ? prev : s.lastUpdateTime);
          lastUpdateTimeRef.current = s.lastUpdateTime;
        }
      }
    }, (error) => {
      console.error("Erro no listener em tempo real de metadados operacionais:", error);
    });

    // Subscribe to products metadata Firestore changes
    const unsubscribeProducts = onSnapshot(productsMetaDocRef, (snapshot) => {
      if (!isMounted) return;
      if (snapshot.exists()) {
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        const s = snapshot.data();
        const localTime = Date.parse(lastUpdateTimeRef.current || '2026-06-04T07:30:00Z');
        const serverTime = s.lastUpdateTime ? Date.parse(s.lastUpdateTime) : 0;

        if (serverTime > 0 && localTime > serverTime) {
          return;
        }

        const numChunks = s.numChunks || 0;
        const isReset = s.lastUpdateTime === '2026-06-04T07:30:00Z';

        if (numChunks > 0) {
          const fetchAllChunks = async () => {
            try {
              const chunkPromises = [];
              for (let i = 0; i < numChunks; i++) {
                const chunkDocRef = doc(db, 'state', `products_chunk_${i}`);
                chunkPromises.push(getDoc(chunkDocRef));
              }
              const chunkSnapshots = await Promise.all(chunkPromises);
              let combinedProducts: Product[] = [];
              chunkSnapshots.forEach(snap => {
                if (snap.exists()) {
                  const chunkData = snap.data();
                  if (Array.isArray(chunkData.products)) {
                    combinedProducts = combinedProducts.concat(chunkData.products);
                  }
                }
              });

              if (combinedProducts.length > 0) {
                const cleaned = deduplicateProducts(combinedProducts);
                setProducts(prev => {
                  const isSame = JSON.stringify(prev) === JSON.stringify(cleaned);
                  return isSame ? prev : cleaned;
                });
              }
            } catch (err) {
              console.error("Erro ao carregar chunks de produtos do Firestore:", err);
            }
          };
          fetchAllChunks();
        } else if (isReset) {
          setProducts([]);
        }
        if (s.lastUpdateTime) {
          setLastUpdateTime(prev => prev === s.lastUpdateTime ? prev : s.lastUpdateTime);
          lastUpdateTimeRef.current = s.lastUpdateTime;
        }
      }
    }, (error) => {
      console.error("Erro no listener em tempo real de catálogo de produtos:", error);
    });

    return () => {
      isMounted = false;
      unsubscribeCurrent();
      unsubscribeProducts();
    };
  }, []);

  // 2. Automatically save local changes to LocalStorage (offline), local server, and Firestore (live multiplayer)
  useEffect(() => {
    if (!hasLoadedFromServer || isResetting) return;

    lastLocalChangeTime.current = Date.now();
    const currentTimestamp = new Date().toISOString();

    const payload = {
      products,
      suppliers,
      promoters,
      agencies,
      supHistory,
      impHistory,
      currentUser,
      lastUpdateTime: currentTimestamp
    };

    // Save to LocalStorage
    saveData(payload);

    // Save to local Express backend
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error("Erro ao sincronizar com servidor backup:", err));

    // Helper to run Firestore operations with exponential backoff and jitter
    const setDocWithRetry = async (docRef: any, data: any, maxRetries = 5, initialDelay = 500) => {
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          await setDoc(docRef, data);
          return;
        } catch (err: any) {
          attempt++;
          if (attempt >= maxRetries) {
            throw err;
          }
          const delay = initialDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
          console.warn(`[Firestore Retry] Tentativa falhou (${attempt}/${maxRetries}). Retentando em ${Math.round(delay)}ms. Erro:`, err);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    const syncWithFirestore = async () => {
      setIsSyncing(true);
      try {
        const currentDocRef = doc(db, 'state', 'current');
        const productsMetaDocRef = doc(db, 'state', 'products_metadata');

        // Chunking: Break products list into chunks of 300 to stay safely below 1MB Firestore document limits
        const chunkSize = 300;
        const chunks: Product[][] = [];
        for (let i = 0; i < products.length; i += chunkSize) {
          chunks.push(products.slice(i, i + chunkSize));
        }

        // Upload all product chunks in parallel with individual exponential retry
        const chunkPromises = chunks.map((chunk, index) => {
          const chunkDocRef = doc(db, 'state', `products_chunk_${index}`);
          return setDocWithRetry(chunkDocRef, {
            products: chunk,
            lastUpdateTime: currentTimestamp
          });
        });

        await Promise.all(chunkPromises);

        // Upload metadata regarding product chunks
        await setDocWithRetry(productsMetaDocRef, {
          numChunks: chunks.length,
          lastUpdateTime: currentTimestamp
        });

        // Upload operational collections
        await setDocWithRetry(currentDocRef, {
          suppliers,
          promoters,
          agencies,
          supHistory,
          impHistory,
          lastUpdateTime: currentTimestamp
        });

        console.log(`[Firestore Sync] Sincronização efetuada com sucesso: ${chunks.length} chunks e metadados operacionais gravados.`);
        
        setLastUpdateTime(currentTimestamp);
        lastUpdateTimeRef.current = currentTimestamp;

      } catch (err) {
        console.error("[Firestore Sync] Erro na sincronização com o Firestore:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncWithFirestore();

  }, [products, suppliers, promoters, agencies, supHistory, impHistory, hasLoadedFromServer, isResetting]);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(deduplicateProducts(data.products));
        }
        if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
        if (Array.isArray(data.promoters)) setPromoters(data.promoters);
        if (Array.isArray(data.agencies)) setAgencies(data.agencies);
        triggerToast("Sincronização ao vivo forçada com sucesso!");
      }
    } catch (err) {
      console.warn("Erro ao forçar sincronização:", err);
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

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

      // Reset products metadata to 0 chunks
      const productsMetaDocRef = doc(db, 'state', 'products_metadata');
      await setDoc(productsMetaDocRef, {
        numChunks: 0,
        lastUpdateTime: '2026-06-04T07:30:00Z'
      });

      // Reset operational data in Firestore
      const docRef = doc(db, 'state', 'current');
      await setDoc(docRef, {
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
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            currentUser={currentUser}
            impHistory={impHistory}
            setImpHistory={setImpHistory}
            onUpdateStats={handleUpdateStatsTimeline}
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
          onlineUsers={onlineUsers}
          isSyncing={isSyncing}
          onForceSync={handleForceSync}
          lastRemoteUpdateToast={lastRemoteUpdateToast}
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
