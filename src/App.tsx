import React, { useState, useEffect, useMemo } from 'react';
import { GameAccount, FilterState, GameType, SaleRecord } from './types';
import { realtimeSync } from './services/realtimeSync';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { FilterBar } from './components/FilterBar';
import { AccountCard } from './components/AccountCard';
import { AccountDetailModal } from './components/AccountDetailModal';
import { SellerLoginModal } from './components/SellerLoginModal';
import { SellerDashboard } from './components/SellerDashboard';
import { AddEditAccountModal } from './components/AddEditAccountModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { AntiFraudModal } from './components/AntiFraudModal';
import { NegoModal } from './components/NegoModal';
import { CheckoutPaymentModal } from './components/CheckoutPaymentModal';
import { CloudSyncSettingsModal } from './components/CloudSyncSettingsModal';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import {
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  MessageCircle,
  Gamepad2,
  PackageOpen,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { OFFICIAL_WA_NUMBER, DISPLAY_WA_NUMBER } from './utils/formatter';
import { useToast } from './context/ToastContext';
import { useLanguage } from './context/LanguageContext';
import { authService } from './services/authService';

export default function App() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  // Accounts and sales state synced real-time from database service
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [isSellerAuthenticated, setIsSellerAuthenticated] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'buyer' | 'seller'>('buyer');
  const [isInitialLoaded, setIsInitialLoaded] = useState<boolean>(false);

  // Filter state for buyer catalog
  const [filter, setFilter] = useState<FilterState>({
    game: 'ALL',
    searchQuery: '',
    priceRange: 'ALL',
    onlyReady: false,
    sortBy: 'newest',
  });

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedDetailAccount, setSelectedDetailAccount] = useState<GameAccount | null>(null);
  const [selectedNegoAccount, setSelectedNegoAccount] = useState<GameAccount | null>(null);
  const [selectedCheckoutAccount, setSelectedCheckoutAccount] = useState<GameAccount | null>(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<GameAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<GameAccount | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);

  // Anti-fraud warning gate before WhatsApp redirect
  const [antiFraudModalOpen, setAntiFraudModalOpen] = useState(false);
  const [pendingWaCallback, setPendingWaCallback] = useState<(() => void) | null>(null);

  // Subscribe to Realtime Database / Multi-Device updates on mount
  useEffect(() => {
    const unsubscribeAccounts = realtimeSync.subscribe((latestAccounts) => {
      setAccounts(latestAccounts);
    });

    const unsubscribeSales = realtimeSync.subscribeSales((latestSales) => {
      setSalesRecords(latestSales);
    });

    const unsubscribeStatus = realtimeSync.subscribeSyncStatus((status) => {
      setIsInitialLoaded(status.isInitialLoaded);
    });

    // Verify cryptographic seller session with server
    authService.verifySession().then((isValid) => {
      setIsSellerAuthenticated(isValid);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeSales();
      unsubscribeStatus();
    };
  }, []);

  // Filter handlers
  const handleUpdateFilter = (partial: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
  };

  // Filtered & sorted accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // 1. Filter Game
      if (filter.game !== 'ALL' && acc.game !== filter.game) {
        return false;
      }

      // 2. Filter Status Only Ready
      if (filter.onlyReady && acc.status !== 'READY') {
        return false;
      }

      // 3. Filter Price Range
      if (filter.priceRange === 'UNDER_100K' && acc.price >= 100000) {
        return false;
      }
      if (filter.priceRange === '100K_500K' && (acc.price < 100000 || acc.price > 500000)) {
        return false;
      }
      if (filter.priceRange === 'ABOVE_1M' && acc.price <= 1000000) {
        return false;
      }

      // 4. Filter Search Query
      if (filter.searchQuery.trim()) {
        const query = filter.searchQuery.toLowerCase();
        const titleMatch = acc.title.toLowerCase().includes(query);
        const idMatch = (acc.idLapak || acc.accountId || acc.id).toLowerCase().includes(query);
        const notesMatch = (acc.notes || '').toLowerCase().includes(query);

        // MLBB specs match
        const mlRankMatch = (acc.mlSpecs?.rank || '').toLowerCase().includes(query);
        const mlRareMatch = (acc.mlSpecs?.rareSkins || []).some((s) => s.toLowerCase().includes(query));

        // FF specs match
        const ffBundlesMatch = (acc.ffSpecs?.mainBundles || []).some((b) => b.toLowerCase().includes(query));
        const ffEvoMatch = (acc.ffSpecs?.evoGuns || []).some((g) => g.toLowerCase().includes(query));

        if (!titleMatch && !idMatch && !notesMatch && !mlRankMatch && !mlRareMatch && !ffBundlesMatch && !ffEvoMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (filter.sortBy === 'cheapest') {
        return a.price - b.price;
      }
      if (filter.sortBy === 'expensive') {
        return b.price - a.price;
      }
      if (filter.sortBy === 'popular') {
        return b.soldCount - a.soldCount;
      }
      // default: newest
      return b.createdAt - a.createdAt;
    });
  }, [accounts, filter]);

  // Counters for Ready accounts
  const mlbbReadyCount = useMemo(() => {
    return accounts.filter((a) => a.game === 'MLBB' && a.status === 'READY').length;
  }, [accounts]);

  const ffReadyCount = useMemo(() => {
    return accounts.filter((a) => a.game === 'FREE_FIRE' && a.status === 'READY').length;
  }, [accounts]);

  // Seller auth handlers
  const handleSellerLoginSuccess = () => {
    setIsSellerAuthenticated(true);
    setCurrentView('seller');
  };

  const handleSellerLogout = async () => {
    await authService.logout();
    setIsSellerAuthenticated(false);
    setCurrentView('buyer');
  };

  // CRUD Actions for Seller
  const handleOpenAddAccount = () => {
    setAccountToEdit(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditAccount = (account: GameAccount) => {
    setAccountToEdit(account);
    setIsAddEditModalOpen(true);
  };

  const handleSaveAccount = async (accountData: any) => {
    if (accountToEdit) {
      await realtimeSync.updateAccount(accountData as GameAccount);
    } else {
      await realtimeSync.addAccount(accountData);
    }
  };

  const handlePromptDeleteAccount = (account: GameAccount) => {
    setAccountToDelete(account);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (accountToDelete) {
      await realtimeSync.deleteAccount(accountToDelete.id);
    }
  };

  const handleToggleStatus = async (account: GameAccount) => {
    const nextStatus = account.status === 'READY' ? 'SOLD_OUT' : 'READY';
    const nextStock = nextStatus === 'READY' ? 1 : 0;
    await realtimeSync.updateAccountStock(account.id, nextStock, nextStatus);
    showToast({
      type: 'info',
      title: 'Status Stok Diperbarui',
      message: `Status lapak "${account.title}" (${account.id}) diubah menjadi ${
        nextStatus === 'READY' ? 'Instan Ready' : 'Sold Out'
      }.`,
    });
  };

  // Anti-fraud gate trigger
  const handleTriggerAntiFraudCheck = (actionCallback: () => void) => {
    setPendingWaCallback(() => actionCallback);
    setAntiFraudModalOpen(true);
  };

  const handleProceedAntiFraud = () => {
    if (pendingWaCallback) {
      pendingWaCallback();
      setPendingWaCallback(null);
    }
  };

  // If in seller view and authenticated, render full Seller Dashboard
  if (currentView === 'seller' && isSellerAuthenticated) {
    return (
      <>
        <SellerDashboard
          accounts={accounts}
          salesRecords={salesRecords}
          onBackToKatalog={() => setCurrentView('buyer')}
          onLogout={handleSellerLogout}
          onAddNewAccount={handleOpenAddAccount}
          onEditAccount={handleOpenEditAccount}
          onDeleteAccount={handlePromptDeleteAccount}
          onToggleStatus={handleToggleStatus}
          onViewDetail={(acc) => setSelectedDetailAccount(acc)}
          onOpenSyncSettings={() => setIsSyncSettingsOpen(true)}
        />

        {/* Modals for Seller Operations */}
        <AddEditAccountModal
          isOpen={isAddEditModalOpen}
          initialAccount={accountToEdit}
          onClose={() => setIsAddEditModalOpen(false)}
          onSave={handleSaveAccount}
        />

        <DeleteConfirmModal
          account={accountToDelete}
          isOpen={isDeleteModalOpen}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setIsDeleteModalOpen(false);
            setAccountToDelete(null);
          }}
        />

        <CloudSyncSettingsModal
          isOpen={isSyncSettingsOpen}
          onClose={() => setIsSyncSettingsOpen(false)}
          onSuccess={() => setIsSyncSettingsOpen(false)}
        />

        <AccountDetailModal
          account={selectedDetailAccount}
          onClose={() => setSelectedDetailAccount(null)}
          onOpenAntiFraudWarning={handleTriggerAntiFraudCheck}
        />
      </>
    );
  }

  // Primary Buyer Landing Page
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col selection:bg-orange-500 selection:text-white transition-colors duration-200">
      {/* Fixed Navbar with brand, counters, WA, and discreet lock */}
      <Navbar
        mlbbReadyCount={mlbbReadyCount}
        ffReadyCount={ffReadyCount}
        isSellerAuthenticated={isSellerAuthenticated}
        onOpenSellerLogin={() => setIsLoginModalOpen(true)}
        onOpenSellerDashboard={() => setCurrentView('seller')}
      />

      {/* Spacer to offset fixed header (56px mobile, 92px desktop + safe area top) */}
      <div
        className="h-14 sm:h-[92px] w-full shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        aria-hidden="true"
      />

      {/* Hero Banner with gaming glow & stock statistics */}
      <HeroBanner
        mlbbReadyCount={mlbbReadyCount}
        ffReadyCount={ffReadyCount}
        onSelectGame={(game: GameType) => handleUpdateFilter({ game })}
      />

      {/* Sticky Fast Filter & Search Bar */}
      <FilterBar
        filter={filter}
        onChangeFilter={handleUpdateFilter}
        totalFilteredCount={filteredAccounts.length}
      />

      {/* Main E-Commerce Product Catalog (Itemku Style 2-Column on Mobile) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {/* Section title & quick banner */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-orange-500" />
              <span>
                {filter.game === 'ALL'
                  ? t('catalog_title_all')
                  : filter.game === 'MLBB'
                  ? t('catalog_title_mlbb')
                  : t('catalog_title_ff')}
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {t('catalog_subtitle')}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/30 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
            <span>{t('sync_status')}</span>
          </div>
        </div>

        {/* Loading Skeleton State while connecting to Cloud Firestore */}
        {!isInitialLoaded ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="bg-white dark:bg-slate-900/80 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-pulse flex flex-col shadow-xs"
              >
                <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800/60 w-full" />
                <div className="p-2 sm:p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-2 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
                  </div>
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="h-3.5 bg-orange-100 dark:bg-orange-950/40 rounded w-2/3" />
                    <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          /* 100% Clean Slate Empty State: Database has 0 items */
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-4 max-w-2xl mx-auto shadow-sm">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-orange-50 dark:bg-gradient-to-br dark:from-orange-500/20 dark:via-amber-500/10 dark:to-slate-800/50 border border-orange-200 dark:border-orange-500/30 text-orange-500 dark:text-orange-400 flex items-center justify-center mx-auto shadow-inner">
              <PackageOpen className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500 dark:text-orange-400 stroke-[1.5]" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                Cloud Database Firestore Live
              </span>
              <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                {t('empty_stock_title')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {t('empty_stock_desc')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isSellerAuthenticated) {
                    setCurrentView('seller');
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-orange-950/20 active:scale-95 transition-all min-h-[40px]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{isSellerAuthenticated ? t('seller_dashboard_btn') : t('seller_admin_btn')}</span>
              </button>

              <a
                href={`https://wa.me/${OFFICIAL_WA_NUMBER}?text=${encodeURIComponent('Halo Admin PandirStore, saya ingin tanya ketersediaan stok akun game.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors min-h-[40px]"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <span>{t('direct_order_wa')}</span>
              </a>
            </div>
          </div>
        ) : filteredAccounts.length > 0 ? (
          /* Product Grid: 2-columns on mobile (Itemku standard), 4-5 cols on desktop */
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {filteredAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onViewDetail={(acc) => setSelectedDetailAccount(acc)}
                onOpenNego={(acc) => setSelectedNegoAccount(acc)}
                onCheckout={(acc) => setSelectedCheckoutAccount(acc)}
              />
            ))}
          </div>
        ) : (
          /* Filter Mismatch Empty State */
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t('empty_filter_title')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {t('empty_filter_desc')}
            </p>
            <button
              type="button"
              onClick={() =>
                setFilter({
                  game: 'ALL',
                  searchQuery: '',
                  priceRange: 'ALL',
                  onlyReady: false,
                  sortBy: 'newest',
                })
              }
              className="mt-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shadow-xs"
            >
              {t('reset_all_filters')}
            </button>
          </div>
        )}

        {/* Bottom Fast WA Consultation Card - Compact & Elegant with high contrast */}
        <div className="mt-6 sm:mt-8 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-gradient-to-r dark:from-emerald-950/70 dark:via-slate-900 dark:to-blue-950/70 border border-slate-200 dark:border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shadow-xs">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] sm:text-xs uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('custom_request_badge')}</span>
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white">
              {t('custom_request_title')}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 max-w-xl">
              {t('custom_request_desc', { wa: DISPLAY_WA_NUMBER })}
            </p>
          </div>

          <a
            href={`https://wa.me/${OFFICIAL_WA_NUMBER}?text=${encodeURIComponent('Halo Gan, saya ingin request spek akun MLBB / Free Fire sesuai budget saya.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-950 flex items-center justify-center gap-2 whitespace-nowrap min-h-[40px]"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>{t('chat_wa_direct')}</span>
          </a>
        </div>
      </main>

      {/* Footer */}
      <Footer
        onOpenSellerLogin={() => setIsLoginModalOpen(true)}
        isSellerAuthenticated={isSellerAuthenticated}
        onOpenSellerDashboard={() => setCurrentView('seller')}
      />

      {/* Mobile Bottom Navigation (Smartphones touch-target size >= 44px) */}
      <BottomNav
        activeGame={filter.game}
        onSelectGame={(selected) => handleUpdateFilter({ game: selected })}
        onOpenSellerLogin={() => setIsLoginModalOpen(true)}
        isSellerAuthenticated={isSellerAuthenticated}
        onOpenSellerDashboard={() => setCurrentView('seller')}
      />

      {/* Modals */}
      <AccountDetailModal
        account={selectedDetailAccount}
        onClose={() => setSelectedDetailAccount(null)}
        onOpenAntiFraudWarning={handleTriggerAntiFraudCheck}
        onCheckout={(acc) => setSelectedCheckoutAccount(acc)}
      />

      <CheckoutPaymentModal
        account={selectedCheckoutAccount}
        isOpen={!!selectedCheckoutAccount}
        onClose={() => setSelectedCheckoutAccount(null)}
        onProceedWhatsApp={(waUrl) => {
          handleTriggerAntiFraudCheck(() => {
            window.open(waUrl, '_blank');
          });
        }}
      />

      <NegoModal
        account={selectedNegoAccount}
        isOpen={!!selectedNegoAccount}
        onClose={() => setSelectedNegoAccount(null)}
        onProceedNegoToWa={(waUrl) => {
          handleTriggerAntiFraudCheck(() => {
            window.open(waUrl, '_blank');
          });
        }}
      />

      <SellerLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleSellerLoginSuccess}
      />

      <AntiFraudModal
        isOpen={antiFraudModalOpen}
        onProceed={handleProceedAntiFraud}
        onClose={() => {
          setAntiFraudModalOpen(false);
          setPendingWaCallback(null);
        }}
      />
    </div>
  );
}
