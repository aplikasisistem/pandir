import React from 'react';
import { ShieldCheck, Zap, HeartHandshake } from 'lucide-react';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { DISPLAY_WA_NUMBER } from '../utils/formatter';
import { useLanguage } from '../context/LanguageContext';

interface HeroBannerProps {
  mlbbReadyCount: number;
  ffReadyCount: number;
  onSelectGame: (game: 'MLBB' | 'FREE_FIRE') => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  mlbbReadyCount,
  ffReadyCount,
  onSelectGame,
}) => {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 transition-colors duration-200">
      {/* Background ambient accents */}
      <div className="absolute top-0 left-0 w-48 sm:w-80 h-48 sm:h-80 bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute top-0 right-0 w-48 sm:w-80 h-48 sm:h-80 bg-orange-600/5 dark:bg-orange-600/10 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5 relative z-10">
        <div className="text-center max-w-2xl mx-auto">
          {/* Trust badge pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 mb-2 shadow-xs">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">WA Seller:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{DISPLAY_WA_NUMBER}</span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{t('nego_available')}</span>
          </div>

          {/* Main Title - Crisp Itemku / Sleek Dark Typography */}
          <h1 className="text-base sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            <span>{t('hero_title_1')} </span>
            <span className="text-blue-600 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-blue-400 dark:via-indigo-300 dark:to-blue-200">
              {t('hero_title_2')}
            </span>
          </h1>

          <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed font-medium">
            {t('hero_desc')}
          </p>

          {/* Category Quick Badges / Live Stock Counters */}
          <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 max-w-md mx-auto">
            {/* MLBB Stock Card */}
            <button
              type="button"
              onClick={() => onSelectGame('MLBB')}
              className="group p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-gradient-to-b dark:from-blue-950/60 dark:to-slate-900/80 border border-blue-200 dark:border-blue-600/30 hover:border-blue-400 dark:hover:border-blue-500/60 text-left transition-all hover:scale-[1.01] active:scale-95 shadow-xs hover:shadow-sm flex items-center justify-between min-h-[42px] sm:min-h-[46px]"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-500/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/80 transition-colors">
                  <MLBBLogo className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="text-[9px] sm:text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider leading-tight">MLBB</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-none">
                    {mlbbReadyCount} {t('stock_ready')}
                  </div>
                </div>
              </div>
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all border border-blue-300 dark:border-transparent">
                {t('filter_mlbb')}
              </span>
            </button>

            {/* Free Fire Stock Card */}
            <button
              type="button"
              onClick={() => onSelectGame('FREE_FIRE')}
              className="group p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-gradient-to-b dark:from-amber-950/60 dark:to-slate-900/80 border border-orange-200 dark:border-orange-600/30 hover:border-orange-400 dark:hover:border-orange-500/60 text-left transition-all hover:scale-[1.01] active:scale-95 shadow-xs hover:shadow-sm flex items-center justify-between min-h-[42px] sm:min-h-[46px]"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-orange-100 dark:bg-orange-900/60 border border-orange-300 dark:border-orange-500/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/80 transition-colors">
                  <FreeFireLogo className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <div className="text-[9px] sm:text-[10px] text-orange-700 dark:text-amber-300 font-bold uppercase tracking-wider leading-tight">Free Fire</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-none">
                    {ffReadyCount} {t('stock_ready')}
                  </div>
                </div>
              </div>
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-amber-300 font-bold group-hover:bg-orange-600 group-hover:text-white transition-all border border-orange-300 dark:border-transparent">
                {t('filter_ff')}
              </span>
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-200/80 dark:border-slate-800/50 flex flex-wrap items-center justify-center gap-2 sm:gap-6 text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{t('feat_fast')}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden xs:inline">•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{t('feat_escrow')}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden xs:inline">•</span>
            <span className="flex items-center gap-1">
              <HeartHandshake className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>{t('feat_verified')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
