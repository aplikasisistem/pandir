import React from 'react';
import { Search, ArrowUpDown, Check, X } from 'lucide-react';
import { FilterState, SortOption } from '../types';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { useLanguage } from '../context/LanguageContext';

interface FilterBarProps {
  filter: FilterState;
  onChangeFilter: (updated: Partial<FilterState>) => void;
  totalFilteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onChangeFilter,
  totalFilteredCount,
}) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border-y border-slate-200 dark:border-slate-800/80 sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:top-[calc(5.75rem+env(safe-area-inset-top,0px))] z-40 backdrop-blur-md py-1.5 sm:py-2.5 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 space-y-1.5 sm:space-y-2.5">
        {/* Row 1: Game Tabs & Search Input */}
        <div className="flex flex-col md:flex-row gap-1.5 sm:gap-2.5 items-stretch md:items-center justify-between">
          {/* Game Category Selector Tabs */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1 p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-950/80 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onChangeFilter({ game: 'ALL' })}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all min-h-[32px] sm:min-h-[38px] ${
                filter.game === 'ALL'
                  ? 'bg-blue-600 dark:bg-slate-800 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{t('filter_all_games')}</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeFilter({ game: 'MLBB' })}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all min-h-[32px] sm:min-h-[38px] ${
                filter.game === 'MLBB'
                  ? 'bg-[#0056B3] dark:bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300'
              }`}
            >
              <MLBBLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t('filter_mlbb')}</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeFilter({ game: 'FREE_FIRE' })}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all min-h-[32px] sm:min-h-[38px] ${
                filter.game === 'FREE_FIRE'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-300'
              }`}
            >
              <FreeFireLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t('filter_ff')}</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filter.searchQuery}
              onChange={(e) => onChangeFilter({ searchQuery: e.target.value })}
              placeholder={t('filter_search_placeholder')}
              className="w-full pl-7 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] sm:text-sm focus:outline-none focus:border-blue-600 dark:focus:border-orange-500 transition-colors shadow-xs"
            />
            {filter.searchQuery && (
              <button
                type="button"
                onClick={() => onChangeFilter({ searchQuery: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5"
                aria-label="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Quick Filters & Sort */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-800/50 text-[10px] sm:text-xs">
          {/* Price Range Pills */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 hidden sm:inline mr-1 text-[11px] font-bold">
              {t('checkout_price_base')}
            </span>

            <button
              type="button"
              onClick={() => onChangeFilter({ priceRange: 'ALL' })}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-colors ${
                filter.priceRange === 'ALL'
                  ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-white border border-blue-200 dark:border-slate-700'
                  : 'bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:text-slate-100'
              }`}
            >
              {t('price_all')}
            </button>

            <button
              type="button"
              onClick={() => onChangeFilter({ priceRange: 'UNDER_100K' })}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-colors ${
                filter.priceRange === 'UNDER_100K'
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/50'
                  : 'bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:text-slate-100'
              }`}
            >
              {t('price_under_100')}
            </button>

            <button
              type="button"
              onClick={() => onChangeFilter({ priceRange: '100K_500K' })}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-colors ${
                filter.priceRange === '100K_500K'
                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600/50'
                  : 'bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:text-slate-100'
              }`}
            >
              {t('price_100_300')}
            </button>

            <button
              type="button"
              onClick={() => onChangeFilter({ priceRange: 'ABOVE_1M' })}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg font-bold transition-colors ${
                filter.priceRange === 'ABOVE_1M'
                  ? 'bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-600/50'
                  : 'bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:text-slate-100'
              }`}
            >
              {t('price_above_500')}
            </button>
          </div>

          {/* Right side: Only Ready toggle + Sort */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            {/* Hanya Ready Toggle */}
            <button
              type="button"
              onClick={() => onChangeFilter({ onlyReady: !filter.onlyReady })}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold border transition-colors ${
                filter.onlyReady
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded flex items-center justify-center border ${
                  filter.onlyReady
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                }`}
              >
                {filter.onlyReady && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
              </div>
              <span>{t('only_ready_label')}</span>
            </button>

            {/* Sort Select */}
            <div className="relative flex items-center">
              <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 absolute left-1.5 sm:left-2 pointer-events-none" />
              <select
                value={filter.sortBy}
                onChange={(e) => onChangeFilter({ sortBy: e.target.value as SortOption })}
                className="pl-5 sm:pl-7 pr-2.5 sm:pr-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-[10px] sm:text-xs text-slate-900 dark:text-slate-200 font-bold focus:outline-none focus:border-blue-600 dark:focus:border-slate-700 cursor-pointer shadow-xs"
                aria-label="Sort Accounts"
              >
                <option value="newest">{t('sort_newest')}</option>
                <option value="cheapest">{t('sort_price_low')}</option>
                <option value="expensive">{t('sort_price_high')}</option>
                <option value="popular">{t('sort_rating')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 pt-0.5 sm:pt-1 font-medium">
          <span>
            {t('showing_accounts', { count: totalFilteredCount })}
          </span>
          {filter.searchQuery && (
            <span className="text-orange-600 dark:text-orange-400 truncate max-w-[150px] sm:max-w-none font-bold">
              Hasil: "{filter.searchQuery}"
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
