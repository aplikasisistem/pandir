import React from 'react';
import { Star, Eye, Tag, Sparkles, CreditCard } from 'lucide-react';
import { GameAccount } from '../types';
import { formatRupiah } from '../utils/formatter';
import { GameBadge } from './GameBadges';
import { useLanguage } from '../context/LanguageContext';

interface AccountCardProps {
  account: GameAccount;
  onViewDetail: (account: GameAccount) => void;
  onOpenNego: (account: GameAccount) => void;
  onCheckout?: (account: GameAccount) => void;
  isSellerMode?: boolean;
  onEdit?: (account: GameAccount) => void;
  onDelete?: (account: GameAccount) => void;
  onToggleStatus?: (account: GameAccount) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onViewDetail,
  onOpenNego,
  onCheckout,
  isSellerMode = false,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const { t } = useLanguage();
  const isReady = account.status === 'READY';
  const isML = account.game === 'MLBB';
  const isNegotiable = Boolean(
    account.is_negotiable ?? account.bisa_nego ?? account.isNego
  );

  const cost = account.costPrice || Math.round(account.price * 0.7);
  const margin = account.price - cost;
  const marginPercent = Math.round((margin / (account.price || 1)) * 100);

  return (
    <div className="group relative flex flex-col bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden border border-slate-200 dark:border-[#2A2A2A] hover:border-blue-500 dark:hover:border-neutral-700 transition-all duration-200 shadow-xs hover:shadow-md">
      {/* Compact Thumbnail Container */}
      <div
        className="relative w-full aspect-[16/9] bg-slate-100 dark:bg-[#121212] overflow-hidden cursor-pointer"
        onClick={() => onViewDetail(account)}
      >
        <img
          src={account.thumbnail}
          alt={account.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = isML
              ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'
              : 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Gradient shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

        {/* Top Badges */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
          <GameBadge game={account.game} size="sm" showLabel={false} />

          {isReady ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              {t('stock_ready')}
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white shadow-xs">
              {t('stock_sold')}
            </span>
          )}
        </div>

        {/* Bottom thumbnail tag */}
        <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-mono">
          <span className="px-1 py-0.2 rounded bg-black/75 dark:bg-slate-950/85 border border-white/20 dark:border-slate-800 text-slate-100 dark:text-slate-300 truncate max-w-[110px]">
            ID: {account.idLapak || account.accountId || account.id}
          </span>
          {isNegotiable ? (
            <span className="px-1 py-0.2 rounded bg-amber-500/90 text-slate-950 dark:text-amber-300 dark:bg-amber-500/25 dark:border dark:border-amber-400/40 font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              <span>{t('nego_available')}</span>
            </span>
          ) : (
            <span className="px-1 py-0.2 rounded bg-black/75 dark:bg-slate-900/90 border border-white/10 dark:border-slate-700 text-slate-200 dark:text-slate-400 font-medium">
              Nett
            </span>
          )}
        </div>
      </div>

      {/* Card Content - Crisp Itemku / Sleek Dark Typography */}
      <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
        <div className="space-y-1">
          {/* Title */}
          <h3
            onClick={() => onViewDetail(account)}
            className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-[#0056B3] dark:hover:text-orange-400 transition-colors cursor-pointer leading-tight"
            title={account.title}
          >
            {account.title}
          </h3>

          {/* Compact Horizontal Badges for Specs */}
          <div className="flex items-center gap-1 overflow-x-hidden text-[9px] whitespace-nowrap">
            {isML && account.mlSpecs ? (
              <>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold truncate max-w-[85px]">
                  {account.mlSpecs.rank}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-slate-800 dark:text-neutral-300 font-medium shrink-0">
                  {account.mlSpecs.totalHero}H / {account.mlSpecs.totalSkin}S
                </span>
                {account.mlSpecs.rareSkins?.[0] && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 font-medium truncate max-w-[90px]">
                    ★ {account.mlSpecs.rareSkins[0]}
                  </span>
                )}
              </>
            ) : account.ffSpecs ? (
              <>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold shrink-0">
                  Lv {account.ffSpecs.level}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-slate-800 dark:text-neutral-300 font-medium truncate max-w-[80px]">
                  {account.ffSpecs.elitePass}
                </span>
                {account.ffSpecs.evoGuns?.[0] && (
                  <span className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-300 font-medium truncate max-w-[85px]">
                    🔥 {account.ffSpecs.evoGuns[0]}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-600 dark:text-neutral-400 truncate block">
                {account.notes || 'Spesifikasi akun siap main'}
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Actions Section */}
        {isSellerMode ? (
          /* ADMIN / SELLER MODE: Single inline horizontal row */
          <div className="pt-1.5 border-t border-slate-200 dark:border-[#2A2A2A] flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-baseline gap-1.5 font-mono min-w-0">
              <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400 truncate">
                {formatRupiah(account.price)}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-neutral-400 hidden xs:inline truncate">
                M:{formatRupiah(cost)}
              </span>
              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold hidden sm:inline">
                +{marginPercent}%
              </span>
            </div>

            {/* Inline Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggleStatus?.(account)}
                className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold border transition-colors ${
                  isReady
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100'
                    : 'border-red-500/40 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100'
                }`}
                title={isReady ? 'Ubah ke Sold Out' : 'Ubah ke Ready'}
              >
                {isReady ? 'Ready' : 'Sold'}
              </button>
              <button
                type="button"
                onClick={() => onEdit?.(account)}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-[#2A2A2A] font-semibold text-[9px] transition-colors"
                title="Edit Lapak"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(account)}
                className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[9px] transition-colors"
                title="Hapus Lapak"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          /* BUYER MODE: Price & CTA visible without excessive scrolling */
          <div className="pt-1.5 border-t border-slate-200 dark:border-[#2A2A2A] space-y-1.5">
            <div className="flex items-baseline justify-between gap-1">
              <div>
                <span className="text-sm sm:text-base font-extrabold text-orange-600 dark:text-orange-400 font-mono tracking-tight block">
                  {formatRupiah(account.price)}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400 font-bold shrink-0">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                <span>{account.rating.toFixed(1)}</span>
                <span className="text-slate-500 dark:text-slate-500 font-normal">({account.soldCount})</span>
              </div>
            </div>

            {/* Buyer CTA Buttons */}
            <div className="space-y-1">
              {isReady ? (
                <button
                  type="button"
                  onClick={() => (onCheckout ? onCheckout(account) : onViewDetail(account))}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1 shadow-xs min-h-[30px]"
                >
                  <CreditCard className="w-3 h-3 stroke-[2.5]" />
                  <span>{t('buy_now')}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-[10px] cursor-not-allowed flex items-center justify-center min-h-[30px]"
                >
                  {t('stock_sold')}
                </button>
              )}

              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => onViewDetail(account)}
                  className="py-1 px-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold text-[10px] transition-colors flex items-center justify-center gap-0.5 min-h-[26px] border border-slate-200 dark:border-transparent"
                >
                  <Eye className="w-2.5 h-2.5 text-slate-600 dark:text-slate-400" />
                  <span>{t('detail_account')}</span>
                </button>

                {isNegotiable && isReady ? (
                  <button
                    type="button"
                    onClick={() => onOpenNego(account)}
                    className="py-1 px-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300 dark:border-amber-500/40 font-bold text-[10px] transition-colors flex items-center justify-center gap-0.5 min-h-[26px]"
                  >
                    <Tag className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span>{t('nego_available')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="py-1 px-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600 font-medium text-[10px] cursor-not-allowed flex items-center justify-center min-h-[26px]"
                  >
                    <span>Nett</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
