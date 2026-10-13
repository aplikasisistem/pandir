import React from 'react';
import {
  ShieldCheck,
  MessageCircle,
  Lock,
  Sparkles,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import { DISPLAY_WA_NUMBER, OFFICIAL_WA_NUMBER } from '../utils/formatter';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { PandirStoreEmblem } from './PandirStoreLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface NavbarProps {
  onOpenSellerLogin: () => void;
  isSellerAuthenticated: boolean;
  onOpenSellerDashboard: () => void;
  mlbbReadyCount: number;
  ffReadyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSellerLogin,
  isSellerAuthenticated,
  onOpenSellerDashboard,
  mlbbReadyCount,
  ffReadyCount,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full bg-[var(--bg-header)] text-[var(--header-text)] border-b border-black/10 dark:border-slate-800/80 shadow-md safe-top transition-colors duration-200"
      style={{
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Top micro bar for trust & quick stats */}
      <div className="bg-[var(--bg-header-top)] px-3 py-1 text-[11px] text-blue-100 dark:text-slate-300 border-b border-white/10 dark:border-slate-800/60 hidden sm:flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-300 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400 animate-pulse"></span>
            {t('sync_status')}
          </span>
          <span className="opacity-40">|</span>
          <span className="flex items-center gap-1">
            <MLBBLogo className="w-3.5 h-3.5" />
            <span>
              {t('mlbb_ready')} <strong className="text-white font-bold">{mlbbReadyCount}</strong>
            </span>
          </span>
          <span className="opacity-40">|</span>
          <span className="flex items-center gap-1">
            <FreeFireLogo className="w-3.5 h-3.5" />
            <span>
              {t('ff_ready')} <strong className="text-amber-300 font-bold">{ffReadyCount}</strong>
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 opacity-90">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 dark:text-emerald-400" />
            {t('hero_badge')}
          </span>
          <span className="opacity-40">|</span>
          <a
            href={`https://wa.me/${OFFICIAL_WA_NUMBER}?text=${encodeURIComponent(
              'Halo Admin PANDIRSTORE.ID, saya ingin tanya seputar transaksi akun game.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors font-medium"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WA: {DISPLAY_WA_NUMBER}
          </a>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-orange-500 p-[2px] shadow-lg shadow-black/20 shrink-0">
            <div className="w-full h-full bg-[#004494] dark:bg-slate-950 rounded-[9px] sm:rounded-[10px] flex items-center justify-center overflow-hidden p-0.5">
              <PandirStoreEmblem className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 ring-2 ring-blue-700 dark:ring-slate-950 animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 ring-2 ring-blue-700 dark:ring-slate-950"></span>
          </div>

          <div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-sm sm:text-xl font-black tracking-tight text-white whitespace-nowrap">
                PANDIRSTORE<span className="text-amber-300 dark:text-orange-500">.ID</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/20 dark:bg-orange-500/20 text-white dark:text-orange-400 border border-white/30 dark:border-orange-500/30 uppercase tracking-wider hidden xs:inline">
                Official
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-blue-100 dark:text-cyan-400 font-medium -mt-0.5 flex items-center gap-1">
              <span className="truncate max-w-[110px] sm:max-w-none">{t('brand_sub')}</span>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 dark:text-blue-400 shrink-0" />
            </p>
          </div>
        </div>

        {/* Action Controls & Utilities */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Multi-Language Global Selector */}
          <LanguageSelector />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/15 text-white border border-white/20 transition-all text-xs font-semibold min-h-[34px] sm:min-h-[40px] active:scale-95 shadow-xs"
            title={theme === 'light' ? t('theme_dark') : t('theme_light')}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200 fill-amber-200" />
                <span className="hidden md:inline text-[11px] font-bold">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                <span className="hidden md:inline text-[11px] font-bold">Light</span>
              </>
            )}
          </button>

          {/* PWA In-App Install Button */}
          <PWAInstallButton variant="navbar" />

          {/* Quick Direct WA button */}
          <a
            href={`https://wa.me/${OFFICIAL_WA_NUMBER}?text=${encodeURIComponent(
              'Halo Gan, saya ingin berkonsultasi mengenai pembelian akun di PANDIRSTORE.ID.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-95 text-white text-[11px] sm:text-xs font-bold transition-all shadow-md shadow-black/20 min-h-[34px] sm:min-h-[40px]"
            title={`Chat WhatsApp ${DISPLAY_WA_NUMBER}`}
          >
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
            <span className="hidden xs:inline">{t('official_wa_btn')}</span>
            <span className="hidden lg:inline font-mono text-emerald-100 text-xs">
              {DISPLAY_WA_NUMBER}
            </span>
          </a>

          {/* Seller Access / Dashboard Toggle */}
          {isSellerAuthenticated ? (
            <button
              onClick={onOpenSellerDashboard}
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-black/20 active:scale-95 transition-all min-h-[34px] sm:min-h-[40px]"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-100" />
              <span className="hidden xs:inline">{t('seller_dashboard_btn')}</span>
            </button>
          ) : (
            <button
              onClick={onOpenSellerLogin}
              className="p-1.5 sm:px-2.5 sm:py-2 rounded-lg bg-black/10 hover:bg-black/20 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-white/90 hover:text-white border border-white/20 dark:border-slate-800 transition-colors text-xs flex items-center gap-1 min-h-[34px] sm:min-h-[40px] justify-center"
              title={t('seller_admin_btn')}
              aria-label={t('seller_admin_btn')}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">{t('seller_admin_btn')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
