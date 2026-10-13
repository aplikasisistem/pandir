import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  MessageCircle,
  Tag,
  Star,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import { GameAccount, PaymentConfig } from '../types';
import {
  formatRupiah,
  formatNumber,
  buildBuyWaLink,
  buildNegoWaLink,
  validateNegoOffer,
  OFFICIAL_WA_NUMBER,
  DISPLAY_WA_NUMBER,
} from '../utils/formatter';
import { GameBadge } from './GameBadges';
import { realtimeSync, getActivePaymentMethods } from '../services/realtimeSync';
import { useLanguage } from '../context/LanguageContext';

interface AccountDetailModalProps {
  account: GameAccount | null;
  onClose: () => void;
  onOpenAntiFraudWarning: (callback: () => void) => void;
  onCheckout?: (account: GameAccount) => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onOpenAntiFraudWarning,
  onCheckout,
}) => {
  const { t } = useLanguage();
  if (!account) return null;

  const isReady = account.status === 'READY';
  const isML = account.game === 'MLBB';
  const isNegotiable = Boolean(
    account.is_negotiable ?? account.bisa_nego ?? account.isNego
  );

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [negoInput, setNegoInput] = useState<string>('');
  const [negoError, setNegoError] = useState<string | null>(null);
  const [showNegoForm, setShowNegoForm] = useState(false);

  // Synchronized dynamic payment config from real-time database
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(() => realtimeSync.getPaymentConfig());

  useEffect(() => {
    const unsubscribe = realtimeSync.subscribePaymentConfig((newConfig) => {
      setPaymentConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  // Compute exact payment methods and trigger button label (matching checkout modal 1:1)
  const paymentInfo = useMemo(() => {
    return getActivePaymentMethods(paymentConfig, account.price);
  }, [paymentConfig, account.price]);

  const gallery = account.gallery && account.gallery.length > 0
    ? account.gallery
    : [{ category: 'Foto Utama', url: account.thumbnail, label: account.title }];

  const currentPhoto = gallery[activePhotoIndex] || gallery[0];

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % gallery.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const handleNegoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNegoError(null);

    const cleanNum = parseInt(negoInput.replace(/[^0-9]/g, ''), 10);
    const validation = validateNegoOffer(account.price, cleanNum);

    if (!validation.valid) {
      setNegoError(validation.message || 'Penawaran tidak valid.');
      return;
    }

    // Direct to WhatsApp with Nego template after anti-fraud check
    const waUrl = buildNegoWaLink(account, cleanNum);
    onOpenAntiFraudWarning(() => {
      window.open(waUrl, '_blank');
    });
  };

  const handleDirectBuy = () => {
    const waUrl = buildBuyWaLink(account);
    onOpenAntiFraudWarning(() => {
      window.open(waUrl, '_blank');
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto safe-top safe-bottom"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2">
            <GameBadge game={account.game} size="md" />
            <span className="text-xs font-mono text-slate-700 dark:text-slate-400 bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-800 font-semibold">
              ID: {account.idLapak || account.accountId || account.id}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Title & Status Bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {isReady ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                    {t('stock_ready')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/40">
                    {t('stock_sold')}
                  </span>
                )}

                {account.isNego && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    {t('nego_available')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{account.rating.toFixed(1)}</span>
                </span>
                <span>•</span>
                <span>{account.soldCount} {t('successful_deals')}</span>
              </div>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {account.title}
            </h2>
          </div>

          {/* Photo Gallery & Proof Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <span>{t('modal_detail_header')}</span>
                <span className="text-slate-500">
                  ({activePhotoIndex + 1}/{gallery.length})
                </span>
              </span>
              <span className="text-orange-600 dark:text-orange-400 font-bold">
                {t('modal_detail_category')} {currentPhoto.category}
              </span>
            </div>

            {/* Big Preview Frame */}
            <div className="relative w-full aspect-video sm:aspect-[16/9] bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner group">
              <img
                src={currentPhoto.url}
                alt={currentPhoto.label}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = account.thumbnail;
                }}
              />

              {gallery.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 border border-slate-700 transition-colors shadow-lg"
                    aria-label="Foto Sebelumnya"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 border border-slate-700 transition-colors shadow-lg"
                    aria-label="Foto Selanjutnya"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {currentPhoto.label && (
                <div className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-xs text-white text-xs font-semibold flex items-center justify-between">
                  <span className="truncate">{currentPhoto.label}</span>
                  <span className="text-slate-300 font-mono text-[11px] shrink-0">
                    {activePhotoIndex + 1} / {gallery.length}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnails row */}
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {gallery.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      activePhotoIndex === idx
                        ? 'border-orange-500 scale-95 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = account.thumbnail;
                      }}
                    />
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white font-medium truncate bg-slate-950/80 px-1 rounded">
                      {photo.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Specifications Breakdown */}
          <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span>{t('modal_detail_specs')}</span>
            </h3>

            {isML && account.mlSpecs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_current_rank')}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-300 text-sm">{account.mlSpecs.rank}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_total_heroes_skins')}</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {account.mlSpecs.totalHero} {t('heroes')} / {account.mlSpecs.totalSkin} {t('skins')}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_emblem')}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300 text-xs">{account.mlSpecs.emblem}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_bind_status')}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">{account.mlSpecs.bindStatus}</span>
                </div>
                {account.mlSpecs.winrate && (
                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 sm:col-span-2 shadow-2xs">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_account_wr')}</span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{account.mlSpecs.winrate}</span>
                  </div>
                )}
                {account.mlSpecs.rareSkins?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 sm:col-span-2 shadow-2xs">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold mb-1">{t('modal_rare_skins')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {account.mlSpecs.rareSkins.map((skin, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 font-semibold text-[11px]"
                        >
                          {skin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : account.ffSpecs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_level')}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">Level {account.ffSpecs.level}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Elite Pass:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">{account.ffSpecs.elitePass}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_bind_status')}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">{account.ffSpecs.bindStatus}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">{t('modal_vault_count')}</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    {account.ffSpecs.vaultCount || 200}+ Item
                  </span>
                </div>
                {account.ffSpecs.mainBundles?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 sm:col-span-2 shadow-2xs">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold mb-1">{t('modal_main_bundles')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {account.ffSpecs.mainBundles.map((b, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/80 border border-orange-200 dark:border-orange-500/40 text-orange-700 dark:text-amber-300 font-semibold text-[11px]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {account.ffSpecs.evoGuns?.length > 0 && (
                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 sm:col-span-2 shadow-2xs">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold mb-1">{t('modal_evo_guns')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {account.ffSpecs.evoGuns.map((gun, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 font-semibold text-[11px]"
                        >
                          🔥 {gun}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Seller Notes */}
            {account.notes && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[11px] mb-0.5">{t('modal_seller_notes')}</span>
                <p className="bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 italic">
                  "{account.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Anti Fraud Warning Box */}
          <div className="bg-amber-50 dark:bg-gradient-to-r dark:from-red-950/40 dark:via-amber-950/30 dark:to-slate-900 p-3.5 rounded-xl border border-amber-300 dark:border-amber-600/40 flex items-start gap-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-800 dark:text-amber-300">{t('modal_anti_fraud_title')}</div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                {t('modal_anti_fraud_desc', { wa: DISPLAY_WA_NUMBER })}
              </p>
            </div>
          </div>

          {/* Nego Section */}
          {isNegotiable && isReady && (
            <div className="bg-amber-50/50 dark:bg-slate-950/90 rounded-xl border border-amber-300 dark:border-amber-500/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{t('modal_nego_box_title')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNegoForm(!showNegoForm)}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold underline"
                >
                  {showNegoForm ? t('modal_nego_close') : t('modal_nego_open')}
                </button>
              </div>

              {showNegoForm && (
                <form onSubmit={handleNegoSubmit} className="pt-2 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('modal_price_open', {
                      price: formatRupiah(account.price),
                      min: formatRupiah(Math.round(account.price * 0.7)),
                    })}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        Rp
                      </span>
                      <input
                        type="text"
                        value={negoInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setNegoInput(val ? formatNumber(parseInt(val, 10)) : '');
                          setNegoError(null);
                        }}
                        placeholder={`Contoh: ${formatNumber(Math.round(account.price * 0.85))}`}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/20 min-h-[40px]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{t('modal_nego_submit')}</span>
                    </button>
                  </div>

                  {negoError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-500/30">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{negoError}</span>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Pricing & Direct WA */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold">
              {isNegotiable ? 'Harga Buka' : 'Harga Pas (Nett)'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-500 font-mono">
              {formatRupiah(account.price)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isReady ? (
              <>
                {/* Primary: Dynamic Checkout Button (matching active methods in database) */}
                {onCheckout && (
                  <button
                    onClick={() => {
                      onClose();
                      onCheckout(account);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20 min-h-[44px]"
                  >
                    <CreditCard className="w-4 h-4 stroke-[2.5]" />
                    <span>{paymentInfo.triggerButtonLabel}</span>
                  </button>
                )}

                {isNegotiable && !showNegoForm && (
                  <button
                    onClick={() => setShowNegoForm(true)}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 border border-slate-300 dark:border-amber-500/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{t('nego_available')}</span>
                  </button>
                )}

                <button
                  onClick={handleDirectBuy}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>{t('chat_wa_direct')}</span>
                </button>
              </>
            ) : (
              <button
                disabled
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed min-h-[44px]"
              >
                {t('stock_sold')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
