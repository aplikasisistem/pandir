import React from 'react';
import { ShieldCheck, MessageCircle, Lock } from 'lucide-react';
import { DISPLAY_WA_NUMBER, OFFICIAL_WA_NUMBER } from '../utils/formatter';
import { PandirStoreEmblem } from './PandirStoreLogo';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onOpenSellerLogin: () => void;
  isSellerAuthenticated: boolean;
  onOpenSellerDashboard: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenSellerLogin,
  isSellerAuthenticated,
  onOpenSellerDashboard,
}) => {
  const { t } = useLanguage();

  return (
    <footer
      className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs mt-12 sm:pb-8 transition-colors duration-200"
      style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-orange-500 p-[2px] flex items-center justify-center shadow-md">
                <div className="w-full h-full bg-[#0056B3] dark:bg-slate-950 rounded-[10px] flex items-center justify-center p-0.5">
                  <PandirStoreEmblem className="w-7 h-7" />
                </div>
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  PANDIRSTORE<span className="text-orange-500">.ID</span>
                </span>
                <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-semibold block -mt-1">
                  {t('brand_sub')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              {t('footer_about_desc')}
            </p>

            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-semibold">{t('hero_badge')}</span>
            </div>
          </div>

          {/* Col 2: Hubungi Kami */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('footer_official_channel')}
            </h4>
            <div className="space-y-2 text-xs">
              <a
                href={`https://wa.me/${OFFICIAL_WA_NUMBER}?text=${encodeURIComponent('Halo Admin PANDIRSTORE.ID, saya ingin tanya informasi akun.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <span className="font-mono">{DISPLAY_WA_NUMBER}</span>
              </a>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Jam Operasional: 24 Jam Non-Stop (Respon Cepat via WhatsApp)
              </p>
            </div>
          </div>

          {/* Col 3: Keamanan & Garansi */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('footer_security_title')}
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <p>• {t('footer_sec_1')}</p>
              <p>• {t('footer_sec_2')}</p>
              <p>• {t('footer_sec_3')}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['SEABANK', 'QRIS', 'BCA', 'BRI', 'MANDIRI', 'DANA'].map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-2xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom copyright & Discreet Seller Login */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            &copy; {new Date().getFullYear()} PANDIRSTORE.ID. {t('footer_rights')}
          </div>

          {/* Discreet Seller Login Link */}
          <div className="flex items-center gap-4">
            <span className="text-slate-300 dark:text-slate-600">•</span>
            {isSellerAuthenticated ? (
              <button
                type="button"
                onClick={onOpenSellerDashboard}
                className="text-orange-600 dark:text-orange-400 hover:text-orange-500 font-semibold flex items-center gap-1 transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>{t('seller_dashboard_btn')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSellerLogin}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 transition-colors font-medium"
                title={t('seller_admin_btn')}
              >
                <Lock className="w-3 h-3" />
                <span>{t('seller_admin_btn')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
