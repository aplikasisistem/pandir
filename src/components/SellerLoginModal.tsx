import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X, ShieldAlert, Server } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/authService';

interface SellerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const SellerLoginModal: React.FC<SellerLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    try {
      const result = await authService.login(trimmedUser, trimmedPass);

      if (result.success) {
        setIsSubmitting(false);
        onLoginSuccess();
        onClose();
        // Clear fields from memory
        setUsername('');
        setPassword('');
      } else {
        setIsSubmitting(false);
        setErrorMessage(result.error || 'Username atau Password salah! Akses ditolak.');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Terjadi kesalahan komunikasi dengan server otentikasi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/20 border border-orange-200 dark:border-orange-500/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('seller_login_title')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('seller_login_sub')}</p>
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

        {/* Notice Info */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('seller_info')}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 text-xs animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed font-medium break-words overflow-x-auto w-full">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('seller_username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('seller_password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="w-full pl-3.5 pr-11 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors shadow-2xs"
              />

              {/* Password Eye Toggle Icon */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 transition-colors"
                title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                aria-label={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-orange-500" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Gunakan ikon mata untuk memeriksa ketikan password Anda.
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-md shadow-orange-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? 'Memeriksa Kredensial...' : t('seller_btn')}</span>
          </button>

          {/* Active API Target Server Indicator */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              Target Server:
            </span>
            <span
              className="font-mono text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[210px] bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded"
              title={authService.getActiveApiBase()}
            >
              {authService.getActiveApiBase()}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
