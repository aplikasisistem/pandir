import React from 'react';
import { ShieldAlert, CheckCircle2, MessageCircle, AlertTriangle, X } from 'lucide-react';
import { DISPLAY_WA_NUMBER } from '../utils/formatter';
import { useLanguage } from '../context/LanguageContext';

interface AntiFraudModalProps {
  isOpen: boolean;
  onProceed: () => void;
  onClose: () => void;
}

export const AntiFraudModal: React.FC<AntiFraudModalProps> = ({
  isOpen,
  onProceed,
  onClose,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t('antifraud_modal_title')}
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                {t('antifraud_modal_sub')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Checklist */}
        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              {t('antifraud_item_1', { wa: DISPLAY_WA_NUMBER })}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              {t('antifraud_item_2')}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>
              {t('antifraud_item_3')}
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              {t('antifraud_item_4')}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition-colors min-h-[44px]"
          >
            {t('antifraud_cancel_btn')}
          </button>

          <button
            onClick={() => {
              onClose();
              onProceed();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20 active:scale-95 min-h-[44px]"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>{t('antifraud_continue_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
