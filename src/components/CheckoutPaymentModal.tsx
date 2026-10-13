import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  QrCode,
  Building2,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ShieldCheck,
  MessageCircle,
  Upload,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  AlertOctagon,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { GameAccount, PaymentConfig, OrderTransaction, BankAccount } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { realtimeSync, getActivePaymentMethods } from '../services/realtimeSync';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { compressAndReadImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// Branded Logo Badges for active Banks & E-Wallets
export const BankLogoBadge: React.FC<{ bankName: string; category?: 'bank' | 'ewallet'; size?: 'sm' | 'md' }> = ({
  bankName,
  category,
  size = 'md',
}) => {
  const norm = bankName.toUpperCase().replace(/\s+/g, '');
  if (norm.includes('BCA')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#005baa] text-white tracking-wider text-[10px] shadow-sm">
        BCA
      </span>
    );
  }
  if (norm.includes('BRI')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#00529c] text-white tracking-wider text-[10px] shadow-sm border-r-2 border-orange-500">
        BRI
      </span>
    );
  }
  if (norm.includes('MANDIRI')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#002d62] text-[#f5a623] tracking-wider text-[9px] shadow-sm">
        mandırı
      </span>
    );
  }
  if (norm.includes('BNI')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#005e6a] text-[#f15a24] tracking-wider text-[10px] shadow-sm">
        BNI
      </span>
    );
  }
  if (norm.includes('SEABANK')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#ff5300] text-white tracking-wider text-[9px] shadow-sm">
        SeaBank
      </span>
    );
  }
  if (norm.includes('DANA')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#118eea] text-white tracking-wider text-[10px] shadow-sm">
        DANA
      </span>
    );
  }
  if (norm.includes('GOPAY')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#00aa13] text-white tracking-wider text-[9px] shadow-sm">
        go<span className="text-cyan-300">pay</span>
      </span>
    );
  }
  if (norm.includes('OVO')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#4c3494] text-white tracking-wider text-[10px] shadow-sm">
        OVO
      </span>
    );
  }
  if (norm.includes('SHOPEE')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#ee4d2d] text-white tracking-wider text-[9px] shadow-sm">
        ShopeePay
      </span>
    );
  }
  if (norm.includes('BSI')) {
    return (
      <span className="inline-flex items-center justify-center font-black rounded px-1.5 py-0.5 bg-[#00a39d] text-emerald-100 tracking-wider text-[10px] shadow-sm">
        BSI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center font-bold rounded px-1.5 py-0.5 bg-slate-800 text-slate-200 text-[10px]">
      {bankName}
    </span>
  );
};

interface CheckoutPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: GameAccount | null;
  onProceedWhatsApp?: (waUrl: string) => void;
}

export const CheckoutPaymentModal: React.FC<CheckoutPaymentModalProps> = ({
  isOpen,
  onClose,
  account,
  onProceedWhatsApp,
}) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(realtimeSync.getPaymentConfig());
  const [selectedMethod, setSelectedMethod] = useState<string>('QRIS');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 1. Sistem Kode Unik (3 Digit Acak 100-999) & Total Tagihan
  const [uniqueCode, setUniqueCode] = useState<number>(() => Math.floor(100 + Math.random() * 900));
  const [orderId, setOrderId] = useState<string>(() => `ORD-${Date.now().toString().slice(-6)}`);

  // Confirmation form state
  const [isConfirming, setIsConfirming] = useState(false);
  const [claimedAmountInput, setClaimedAmountInput] = useState<string>('');
  const [senderName, setSenderName] = useState('');
  const [buyerWhatsapp, setBuyerWhatsapp] = useState('');
  const [proofImage, setProofImage] = useState<string>('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderTransaction | null>(null);

  // Subscribe to real-time payment configuration from database
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribePaymentConfig((newConfig) => {
      setPaymentConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  // Single source of truth: Dynamic active payment methods configured by admin in database
  const paymentInfo = useMemo(() => {
    return getActivePaymentMethods(paymentConfig, account?.price);
  }, [paymentConfig, account?.price]);

  const { isQrisAllowed, qrisMerchant, qrisImageUrl: qrisImage, activeBanks, availableMethods } = paymentInfo;
  const basePrice = account?.price || 0;
  const qrisMaxAmount = paymentConfig.qris_max_amount ?? paymentConfig.qris?.maxNominal ?? 500000;

  // Reset order details & generate fresh unique code on open
  useEffect(() => {
    if (isOpen && account) {
      const code = Math.floor(100 + Math.random() * 900);
      setUniqueCode(code);
      const newOrdId = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderId(newOrdId);
      setIsConfirming(false);
      setConfirmedOrder(null);
      setSenderName('');
      setProofImage('');
      setBuyerNotes('');

      // Dynamic default payment method selection strictly based on active methods
      if (isQrisAllowed) {
        setSelectedMethod('QRIS');
      } else if (activeBanks.length > 0) {
        setSelectedMethod(activeBanks[0].bankName);
      } else {
        setSelectedMethod('');
      }

      // Pre-fill claimed amount with exact total amount for convenience
      const total = account.price + code;
      setClaimedAmountInput(String(total));
    }
  }, [isOpen, account?.id, isQrisAllowed, activeBanks]);

  // Auto-switch away from invalid/inactive methods if admin toggles them or price disallows QRIS
  useEffect(() => {
    const isCurrentValid =
      (selectedMethod === 'QRIS' && isQrisAllowed) ||
      activeBanks.some((b) => b.bankName.toUpperCase() === selectedMethod.toUpperCase());

    if (!isCurrentValid) {
      if (isQrisAllowed) {
        setSelectedMethod('QRIS');
      } else if (activeBanks.length > 0) {
        setSelectedMethod(activeBanks[0].bankName);
      } else {
        setSelectedMethod('');
      }
    }
  }, [isQrisAllowed, selectedMethod, activeBanks]);

  // Find currently selected bank account object strictly from active bank accounts
  const currentSelectedBank = useMemo(() => {
    if (selectedMethod === 'QRIS' || !selectedMethod) return null;
    return (
      activeBanks.find((b) => b.bankName.toUpperCase() === selectedMethod.toUpperCase()) ||
      activeBanks[0] ||
      null
    );
  }, [selectedMethod, activeBanks]);

  // Total Tagihan = Harga Produk + Kode Unik
  const totalAmount = useMemo(() => basePrice + uniqueCode, [basePrice, uniqueCode]);

  if (!isOpen || !account) return null;

  const cleanAdminWa = (
    paymentConfig.help_whatsapp ||
    paymentConfig.helpWhatsApp ||
    account.whatsappNumber ||
    '085717046895'
  ).replace(/\D/g, '');

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast({
      type: 'success',
      title: 'Tersalin ke Clipboard!',
      message: `${fieldName} "${text}" berhasil disalin.`,
    });
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadQRIS = () => {
    const link = document.createElement('a');
    link.href = qrisImage;
    link.download = `QRIS-PandirStore-${orderId}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({
      type: 'info',
      title: 'Mengunduh Barcode QRIS',
      message: 'Silakan buka aplikasi M-Banking atau E-Wallet lalu scan dari galeri foto.',
    });
  };

  // Pelaporan Gangguan (WhatsApp Admin Direct Link)
  const handleBankHelp = () => {
    const text = `Halo Admin PandirStore, saya ingin membayar pesanan ${orderId} (${account.title}) senilai ${formatRupiah(
      totalAmount
    )}, tapi metode pembayaran ${selectedMethod} sedang gangguan. Mohon bantuan nomor rekening alternatif.`;
    const waUrl = `https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(text)}`;
    if (onProceedWhatsApp) {
      onProceedWhatsApp(waUrl);
    } else {
      window.open(waUrl, '_blank');
    }
  };

  // Validasi Nominal Sisi Pembeli
  const parsedClaimedAmount = parseInt(claimedAmountInput.replace(/\D/g, '') || '0', 10);
  const isAmountValid = parsedClaimedAmount >= totalAmount;
  const isUnderpaid = claimedAmountInput.trim() !== '' && parsedClaimedAmount < totalAmount;
  const underpaidDifference = totalAmount - parsedClaimedAmount;

  // Handle buyer submitting "Saya Sudah Bayar"
  const handleSubmitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      showToast({
        type: 'info',
        title: 'Nama Pengirim Diperlukan',
        message: 'Mohon masukkan nama pengirim atau nama akun rekening/e-wallet Anda.',
      });
      return;
    }

    if (!isAmountValid) {
      showToast({
        type: 'error',
        title: 'Nominal Kurang!',
        message: 'Nominal transfer kurang dari total tagihan resmi. Mohon transfer sesuai total tagihan.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const confirmation = await realtimeSync.addPaymentConfirmation({
        order_id: orderId,
        product_id: account.idLapak || account.id,
        product_title: account.title,
        game: account.game,
        base_price: basePrice,
        unique_code: uniqueCode,
        total_amount: totalAmount,
        claimed_amount: parsedClaimedAmount,
        payment_method: selectedMethod,
        sender_name: senderName.trim(),
        buyer_whatsapp: buyerWhatsapp.trim() || undefined,
        proof_of_payment_url: proofImage || undefined,
        notes: buyerNotes.trim() || undefined,
        status: 'PENDING',
      });

      setConfirmedOrder(confirmation);
      showToast({
        type: 'success',
        title: 'Konfirmasi Pembayaran Terkirim!',
        message: `Pesanan ${orderId} berhasil dicatat. Penjual telah menerima notifikasi pembayaran.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Mengirim Konfirmasi',
        message: err?.message || 'Terjadi kendala saat mengirim konfirmasi pembayaran.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWaConfirmation = () => {
    const text =
      `Halo Admin PandirStore, saya sudah transfer untuk pesanan:\n\n` +
      `*ID Pesanan:* ${orderId}\n` +
      `*Akun:* ${account.title} (ID: ${account.idLapak || account.id})\n` +
      `*Metode:* ${selectedMethod}\n` +
      `*Nama Pengirim:* ${senderName}\n` +
      `*Total Tagihan:* ${formatRupiah(totalAmount)} (Kode Unik: ${uniqueCode})\n` +
      `*Nominal Ditransfer:* ${formatRupiah(parsedClaimedAmount)}\n\n` +
      `Mohon segera dicek dan dikirimkan data akunnya ya Gan. Terima kasih!`;

    const waUrl = `https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(text)}`;
    if (onProceedWhatsApp) {
      onProceedWhatsApp(waUrl);
    } else {
      window.open(waUrl, '_blank');
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressAndReadImage(file, { maxWidth: 800, quality: 0.8 });
      setProofImage(compressed);
      showToast({
        type: 'success',
        title: 'Bukti Transfer Terlampir',
        message: 'Foto bukti pembayaran berhasil dimuat.',
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Gagal Membaca File',
        message: 'Format foto tidak didukung atau ukuran terlalu besar.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-fadeIn safe-top safe-bottom"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{t('checkout_modal_title')}</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-transparent text-[10px] font-mono font-bold">
                  {t('checkout_unique_code_badge')}
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">{t('checkout_gateway_sub')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Product Summary Card with Unique Code Breakdown */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0">
                  <img
                    src={account.thumbnail}
                    alt={account.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {account.game === 'MLBB' ? (
                      <MLBBLogo className="w-3 h-3" />
                    ) : (
                      <FreeFireLogo className="w-3 h-3" />
                    )}
                    <span>ID: {account.idLapak || account.id}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs mt-0.5">
                    {account.title}
                  </h4>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">{t('checkout_order_id')}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">{orderId}</span>
              </div>
            </div>

            {/* Total Tagihan & Kode Unik Highlight Box */}
            <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-slate-900 border border-amber-300 dark:border-orange-500/30 flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                  <span>{t('checkout_price_base')} {formatRupiah(basePrice)}</span>
                  <span>+</span>
                  <span className="text-amber-800 dark:text-amber-300 font-bold font-mono">{t('checkout_unique_num')} {uniqueCode}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">{t('checkout_total_bill')}</span>
                  <span className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400 font-mono tracking-tight">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(String(totalAmount), 'Total Nominal Tagihan')}
                className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 shrink-0"
                title="Salin total nominal persis dengan kode unik"
              >
                {copiedField === 'Total Nominal Tagihan' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{t('checkout_copy')}</span>
              </button>
            </div>
          </div>

          {/* 3. Peringatan Pembayaran Ketat (Warna Merah / Alert Box) */}
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-500/60 flex items-start gap-2.5 text-red-900 dark:text-red-200 text-[11px] leading-relaxed shadow-sm">
            <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-red-700 dark:text-red-300 uppercase tracking-wide block mb-0.5">
                PERHATIAN PEMBAYARAN KETAT:
              </span>
              Wajib transfer tepat <strong>{formatRupiah(totalAmount)}</strong> (termasuk 3 digit kode unik <strong>{uniqueCode}</strong>). Pembayaran yang kurang atau berlebih tidak akan diproses otomatis dan akun game tidak akan dikirimkan.
            </div>
          </div>

          {/* SCREEN: Confirmed Waiting State */}
          {confirmedOrder ? (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-center space-y-4 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Pembayaran Sedang Diverifikasi!</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                  Terima kasih, <strong>{senderName}</strong>. Data konfirmasi pembayaran pesanan{' '}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{orderId}</span> senilai{' '}
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{formatRupiah(totalAmount)}</span> telah tersimpan di sistem Cloud kami.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-left space-y-1.5 text-[11px] max-w-sm mx-auto shadow-2xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedMethod}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Nama Pengirim:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{senderName}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Nominal Ditransfer:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(parsedClaimedAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Status Approval:</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                    MENUNGGU APPROVAL PENJUAL
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSendWaConfirmation}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 to-green-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Kirim Notifikasi Langsung ke WhatsApp Penjual</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  Kembali ke Katalog
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Method Selector Tabs: QRIS + Dynamic Active Multi-Banks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('checkout_select_method')}
                </label>
                {availableMethods.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs text-center space-y-2">
                    <p>Tidak ada metode pembayaran aktif saat ini.</p>
                    <button
                      type="button"
                      onClick={handleBankHelp}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Hubungi Admin via WhatsApp</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* QRIS Tab Option (Strictly rendered only if isQrisAllowed == true) */}
                    {isQrisAllowed && (
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('QRIS')}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center relative ${
                          selectedMethod === 'QRIS'
                            ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-950 dark:text-white shadow-md ring-2 ring-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100'
                        }`}
                      >
                        <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="font-bold text-[11px] text-slate-900 dark:text-white">QRIS (Semua E-Wallet)</div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">DANA / GoPay / OVO</div>
                        </div>
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 text-[8px] font-bold">
                          Maks {formatNumber(qrisMaxAmount / 1000)}k
                        </span>
                      </button>
                    )}

                    {/* Dynamic Active Multi-Banks & E-Wallets ONLY (configured by admin) */}
                    {activeBanks.map((bank) => {
                      const isSelected = selectedMethod.toUpperCase() === bank.bankName.toUpperCase();
                      return (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setSelectedMethod(bank.bankName)}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center relative ${
                            isSelected
                              ? 'bg-orange-50 dark:bg-orange-950/80 border-orange-500 text-orange-950 dark:text-white shadow-md ring-2 ring-orange-500/20'
                              : 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100'
                          }`}
                        >
                          <BankLogoBadge bankName={bank.bankName} category={bank.category} />
                          <div>
                            <div className="font-bold text-[11px] text-slate-900 dark:text-white mt-0.5">{bank.bankName}</div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                              {bank.accountHolder || 'DARMAN'}
                            </div>
                          </div>
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-mono">
                            {bank.category === 'ewallet' ? 'E-Wallet' : 'Transfer Bank'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notice when QRIS is automatically hidden because price > max nominal (Rule 500k) */}
              {Boolean(
                !isQrisAllowed &&
                  (paymentConfig.qris_is_active ?? paymentConfig.qris?.isActive ?? true) &&
                  basePrice > qrisMaxAmount
              ) && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-900 dark:text-white font-semibold">Aturan Nominal (Rule 500k): </span>
                    Untuk transaksi dengan nominal di atas {formatRupiah(qrisMaxAmount)}, pembayaran otomatis dialihkan ke Transfer Bank demi kelancaran dan batas limit transaksi.
                  </div>
                </div>
              )}

              {/* Dynamic Payment Details Body */}
              {selectedMethod === 'QRIS' && isQrisAllowed ? (
                /* QRIS View */
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px] pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                      <QrCode className="w-4 h-4 text-blue-500" />
                      <span>Scan Barcode QRIS</span>
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      Merchant: {qrisMerchant}
                    </span>
                  </div>

                  {/* QRIS Image Container */}
                  <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center max-w-[220px] mx-auto shadow-md border border-slate-200">
                    <img
                      src={qrisImage}
                      alt={`QRIS ${qrisMerchant}`}
                      className="w-44 h-44 object-contain"
                    />
                    <div className="mt-1 text-center text-slate-900">
                      <span className="text-[10px] font-black tracking-wide block uppercase">
                        {qrisMerchant}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadQRIS}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      <span>Unduh QRIS</span>
                    </button>
                  </div>
                </div>
              ) : currentSelectedBank ? (
                /* Bank Transfer / E-Wallet View with Recipient DARMAN */
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px] pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <BankLogoBadge bankName={currentSelectedBank.bankName} category={currentSelectedBank.category} />
                      <span>Detail Transfer {currentSelectedBank.bankName}</span>
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      Online 24 Jam
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Account Number Box */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-2xs">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                          Nomor Rekening / No HP {currentSelectedBank.bankName}:
                        </span>
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tracking-wider">
                          {currentSelectedBank.accountNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            currentSelectedBank.accountNumber,
                            `Nomor Rekening ${currentSelectedBank.bankName}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 border border-slate-200 dark:border-transparent"
                      >
                        {copiedField === `Nomor Rekening ${currentSelectedBank.bankName}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Salin No Rekening</span>
                      </button>
                    </div>

                    {/* Account Holder Name Box (DARMAN) */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-2xs">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Nama Penerima / Atas Nama:</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                          {currentSelectedBank.accountHolder || 'DARMAN'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-300 dark:border-emerald-500/20">
                        Terverifikasi
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 4. Bank Gangguan? Hubungi Admin */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBankHelp}
                  className="text-[11px] text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1 font-bold underline underline-offset-2 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Bank Gangguan? Hubungi Admin via WhatsApp</span>
                </button>
              </div>

              {/* Form Input Bukti & Nama Pengirim (Konfirmasi Pembeli) */}
              <form onSubmit={handleSubmitConfirmation} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Konfirmasi Pembayaran Anda</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('checkout_sender_name_label')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder={t('checkout_sender_name_placeholder')}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('checkout_claimed_amount_label')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formatNumber(parsedClaimedAmount)}
                      onChange={(e) => setClaimedAmountInput(e.target.value.replace(/\D/g, ''))}
                      placeholder={formatNumber(totalAmount)}
                      className={`w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border text-xs text-slate-900 dark:text-white font-mono focus:outline-none ${
                        isUnderpaid
                          ? 'border-red-500 focus:border-red-500 text-red-600 dark:text-red-300'
                          : 'border-slate-300 dark:border-slate-700 focus:border-orange-500'
                      }`}
                    />
                    {isUnderpaid && (
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-0.5 block">
                        Kurang {formatRupiah(underpaidDifference)} dari total tagihan!
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('checkout_buyer_wa_label')}
                    </label>
                    <input
                      type="text"
                      value={buyerWhatsapp}
                      onChange={(e) => setBuyerWhatsapp(e.target.value)}
                      placeholder="08123456789"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('checkout_proof_label')}
                    </label>
                    <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">
                        {proofImage ? 'Foto Bukti Terlampir ✓' : 'Pilih File Screenshot'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadProof}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Submit Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="submit"
                    disabled={!isAmountValid || isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/20 active:scale-95 transition-all min-h-[38px]"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {isSubmitting
                        ? 'Memproses...'
                        : isUnderpaid
                        ? 'Nominal Kurang (Tombol Dikunci)'
                        : `${t('checkout_confirm_paid_btn')} (Konfirmasi Pesanan)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shrink-0"
                  >
                    Tutup
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

