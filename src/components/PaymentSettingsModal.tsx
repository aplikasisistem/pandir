import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  QrCode,
  Save,
  CheckCircle2,
  Upload,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Bell,
  Eye,
  Check,
  Trash2,
  AlertTriangle,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
  Slash,
  Plus,
  Wallet,
} from 'lucide-react';
import { PaymentConfig, OrderTransaction, BankAccount } from '../types';
import { realtimeSync, DEFAULT_BANK_ACCOUNTS } from '../services/realtimeSync';
import { formatRupiah, formatNumber } from '../utils/formatter';
import { compressAndReadImage } from '../utils/imageUpload';
import { useToast } from '../context/ToastContext';

interface PaymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'config' | 'confirmations';
}

export const PaymentSettingsModal: React.FC<PaymentSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'config',
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'config' | 'confirmations'>(defaultTab);

  // Dynamic Multi-Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(DEFAULT_BANK_ACCOUNTS);

  // New Bank Form State
  const [newBankName, setNewBankName] = useState('BCA');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState('DARMAN');
  const [newCategory, setNewCategory] = useState<'bank' | 'ewallet'>('bank');
  const [showAddBankForm, setShowAddBankForm] = useState(false);

  // QRIS State
  const [qrisActive, setQrisActive] = useState(true);
  const [qrisMerchantName, setQrisMerchantName] = useState('PandirStore');
  const [qrisMaxNominal, setQrisMaxNominal] = useState('500000');
  const [qrisImageUrl, setQrisImageUrl] = useState('');

  // Webhook & Help WhatsApp State
  const [helpWhatsApp, setHelpWhatsApp] = useState('085717046895');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [fonnteToken, setFonnteToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [confirmations, setConfirmations] = useState<OrderTransaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // Load and subscribe to real-time payment config and orders
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      const current = realtimeSync.getPaymentConfig();
      setBankAccounts(
        current.bankAccounts && current.bankAccounts.length > 0
          ? current.bankAccounts
          : DEFAULT_BANK_ACCOUNTS
      );

      setQrisActive(current.qris_is_active ?? current.qris?.isActive ?? true);
      setQrisMerchantName(current.qris_merchant_name ?? current.qris?.merchantName ?? 'PandirStore');
      setQrisMaxNominal(String(current.qris_max_amount ?? current.qris?.maxNominal ?? 500000));
      setQrisImageUrl(current.qris_image_url ?? current.qris?.imageUrl ?? '');

      setHelpWhatsApp(current.help_whatsapp || current.helpWhatsApp || '085717046895');
      setTelegramBotToken(current.webhook?.telegramBotToken || '');
      setTelegramChatId(current.webhook?.telegramChatId || '');
      setFonnteToken(current.webhook?.fonnteToken || '');
      setWebhookUrl(current.webhook?.webhookUrl || '');

      setConfirmations(realtimeSync.getPaymentConfirmations());

      const unsubConfig = realtimeSync.subscribePaymentConfig((cfg) => {
        if (cfg.bankAccounts && cfg.bankAccounts.length > 0) {
          setBankAccounts(cfg.bankAccounts);
        }
        setQrisActive(cfg.qris_is_active ?? cfg.qris?.isActive ?? true);
        setQrisMerchantName(cfg.qris_merchant_name ?? cfg.qris?.merchantName ?? 'PandirStore');
        setQrisMaxNominal(String(cfg.qris_max_amount ?? cfg.qris?.maxNominal ?? 500000));
        setQrisImageUrl(cfg.qris_image_url ?? cfg.qris?.imageUrl ?? '');
        setHelpWhatsApp(cfg.help_whatsapp || cfg.helpWhatsApp || '085717046895');
      });

      const unsubConf = realtimeSync.subscribePaymentConfirmations((confs) => {
        setConfirmations(confs);
      });

      return () => {
        unsubConfig();
        unsubConf();
      };
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  // Multi-Bank Handlers
  const handleToggleBank = (id: string) => {
    setBankAccounts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b))
    );
  };

  const handleUpdateBankField = (id: string, field: keyof BankAccount, val: any) => {
    setBankAccounts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  };

  const handleDeleteBank = (id: string) => {
    if (bankAccounts.length <= 1) {
      showToast({
        type: 'info',
        title: 'Minimal 1 Rekening',
        message: 'Harus menyisakan minimal 1 rekening pembayaran.',
      });
      return;
    }
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAddNewBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountNumber.trim()) {
      showToast({
        type: 'info',
        title: 'Nomor Rekening Diperlukan',
        message: 'Masukkan nomor rekening atau nomor e-wallet.',
      });
      return;
    }

    const newBank: BankAccount = {
      id: `${newBankName.toLowerCase().replace(/\s+/g, '')}-${Date.now()}`,
      bankName: newBankName.trim().toUpperCase(),
      accountNumber: newAccountNumber.trim(),
      accountHolder: newAccountHolder.trim() || 'DARMAN',
      isActive: true,
      category: newCategory,
    };

    setBankAccounts((prev) => [...prev, newBank]);
    setNewAccountNumber('');
    setShowAddBankForm(false);
    showToast({
      type: 'success',
      title: 'Rekening Ditambahkan',
      message: `${newBank.bankName} (${newBank.accountNumber}) berhasil ditambahkan ke daftar.`,
    });
  };

  // Upload custom QRIS barcode image
  const handleUploadQRIS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressAndReadImage(file, { maxWidth: 600, quality: 0.85 });
      setQrisImageUrl(base64);
      showToast({
        type: 'success',
        title: 'Foto QRIS Berhasil Diunggah',
        message: 'Barcode QRIS baru siap disimpan ke Cloud Firestore.',
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Gagal Mengunggah QRIS',
        message: 'Format file tidak didukung atau gambar terlalu besar.',
      });
    }
  };

  // Save all payment configurations (Sanitizing all undefined values to empty strings "")
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const maxNom = parseInt(qrisMaxNominal.replace(/\D/g, '') || '500000', 10);
      
      // Determine primary seabank from dynamic bank accounts or fallback
      const seabankEntry = bankAccounts.find((b) => b.bankName.toLowerCase().includes('seabank')) || bankAccounts[0];

      await realtimeSync.updatePaymentConfig({
        bankAccounts,
        seabank_account_number: seabankEntry ? seabankEntry.accountNumber : '901316745804',
        seabank_account_name: seabankEntry ? seabankEntry.accountHolder : 'DARMAN',
        seabank_is_active: seabankEntry ? seabankEntry.isActive : true,
        qris_image_url: qrisImageUrl.trim() || realtimeSync.getPaymentConfig().qris.imageUrl,
        qris_merchant_name: qrisMerchantName.trim() || 'PandirStore',
        qris_max_amount: maxNom > 0 ? maxNom : 500000,
        qris_is_active: qrisActive,
        help_whatsapp: helpWhatsApp.trim() || '085717046895',
        helpWhatsApp: helpWhatsApp.trim() || '085717046895',
        // Strictly sanitize undefined to empty string "" to prevent Firestore setDoc error
        webhook: {
          telegramBotToken: telegramBotToken.trim(),
          telegramChatId: telegramChatId.trim(),
          fonnteToken: fonnteToken.trim(),
          webhookUrl: webhookUrl.trim(),
        },
      });

      showToast({
        type: 'success',
        title: 'Pengaturan Pembayaran Tersimpan!',
        message: 'Pengaturan multi-rekening & QRIS langsung aktif real-time di checkout pembeli.',
      });
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyimpan Pengaturan',
        message: err?.message || 'Kendala koneksi Firestore. Coba periksa koneksi internet.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Order Approval Handlers
  const handleAutoValidate = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    const required = order.total_amount || order.amount;
    const claimed = order.claimed_amount || order.amount;
    const diff = required - claimed;

    if (diff > 0) {
      try {
        await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'REJECTED_UNDERPAID');
        showToast({
          type: 'info',
          title: 'Validasi Cepat: Nominal Kurang Ditolak',
          message: `Pesanan ${orderKey} ditolak (REJECTED_UNDERPAID). Selisih kurang: ${formatRupiah(diff)}.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Mengubah Status',
          message: err?.message || 'Kendala saat update status.',
        });
      }
    } else {
      try {
        await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
        showToast({
          type: 'success',
          title: 'Validasi Cepat: Disetujui Otomatis!',
          message: `Pesanan ${orderKey} disetujui (PAID_APPROVED)! Akun otomatis diset SOLD_OUT dan dicatat ke Buku Penjualan.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Menyetujui',
          message: err?.message || 'Kendala saat update status ke Cloud Firestore.',
        });
      }
    }
  };

  const handleApproveOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
      showToast({
        type: 'success',
        title: 'Pesanan Disetujui (PAID_APPROVED)!',
        message: `Pembayaran pesanan ${orderKey} diverifikasi. Akun game diubah ke SOLD_OUT dan dicatat ke Buku Penjualan.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyetujui',
        message: err?.message || 'Kendala saat update status ke Cloud Firestore.',
      });
    }
  };

  const handleRejectUnderpaid = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'REJECTED_UNDERPAID');
      showToast({
        type: 'info',
        title: 'Pesanan Ditolak (Nominal Kurang)',
        message: `Status pesanan ${orderKey} diubah ke REJECTED_UNDERPAID.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menolak',
        message: err?.message || 'Kendala saat update status.',
      });
    }
  };

  const handleCancelOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'CANCELLED');
      showToast({
        type: 'info',
        title: 'Pesanan Dibatalkan',
        message: `Status pesanan ${orderKey} diubah ke CANCELLED.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Membatalkan',
        message: err?.message || 'Kendala saat update status.',
      });
    }
  };

  const handleChatBuyer = (order: OrderTransaction) => {
    const buyerPhone = (order.buyer_whatsapp || '').replace(/\D/g, '');
    const cleanPhone = buyerPhone.startsWith('0') ? '62' + buyerPhone.slice(1) : buyerPhone;
    const diff = (order.total_amount || 0) - (order.claimed_amount || 0);

    const message =
      `Halo Kak ${order.sender_name}, kami dari Admin PandirStore mengenai pesanan *${order.order_id || order.id}* ` +
      `untuk akun *${order.product_title || order.accountTitle}*.\n\n` +
      `Total tagihan resmi: *${formatRupiah(order.total_amount || order.amount)}* (Kode Unik: ${order.unique_code || '-'})\n` +
      `Nominal yang masuk: *${formatRupiah(order.claimed_amount || order.amount)}*\n` +
      (diff > 0
        ? `⚠️ Terdapat selisih nominal kurang sebesar *${formatRupiah(diff)}*.\n` +
          `Mohon transfer sisa kekurangannya ke rekening kami (a/n DARMAN) atau konfirmasikan jika ingin retur dana.`
        : `Status pesanan Anda telah kami periksa. Mohon tunggu proses pengiriman data akun.`);

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${helpWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const pendingCount = confirmations.filter(
    (c) => c.status === 'PENDING' || c.status === 'MENUNGGU_VERIFIKASI'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-fadeIn safe-top safe-bottom"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
      }}
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pengaturan Rekening &amp; Approval Pesanan</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-mono">
                  Cloud Firestore Real-Time
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kelola multi-bank (BCA, BRI, Mandiri, BNI, Dana, dll a/n DARMAN), QRIS, dan pesanan masuk
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'config'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Pengaturan Multi-Bank &amp; QRIS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('confirmations')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'confirmations'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>Verifikasi &amp; Approval Pesanan</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {pendingCount} Menunggu
              </span>
            )}
          </button>
        </div>

        {/* Body Container */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'config' ? (
            /* TAB 1: FORM PENGATURAN PEMBAYARAN MULTI-BANK & QRIS */
            <form onSubmit={handleSave} className="space-y-4">
              {/* SECTION: Dynamic Multi-Bank & E-Wallet Management */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider block">
                        1. Rekening Bank &amp; E-Wallet Dinamis
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">
                        Default Pemilik Rekening: <strong className="text-emerald-600 dark:text-emerald-400">DARMAN</strong>. Hanya rekening bertanda &quot;Aktif&quot; yang muncul di checkout pembeli.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddBankForm(!showAddBankForm)}
                    className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Bank</span>
                  </button>
                </div>

                {/* Sub-form to Add New Bank Account */}
                {showAddBankForm && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-orange-400 dark:border-orange-500/40 space-y-2.5 animate-fadeIn shadow-xs">
                    <span className="text-[11px] font-bold text-orange-600 dark:text-orange-300 block">
                      Tambah Rekening / E-Wallet Baru:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-0.5 font-medium">Nama Bank / Wallet</label>
                        <select
                          value={newBankName}
                          onChange={(e) => {
                            setNewBankName(e.target.value);
                            if (['DANA', 'GOPAY', 'OVO', 'SHOPEEPAY', 'LINKAJA'].includes(e.target.value)) {
                              setNewCategory('ewallet');
                            } else {
                              setNewCategory('bank');
                            }
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                        >
                          <option value="BCA">BCA</option>
                          <option value="BRI">BRI</option>
                          <option value="MANDIRI">Mandiri</option>
                          <option value="BNI">BNI</option>
                          <option value="SEABANK">SeaBank</option>
                          <option value="BSI">BSI (Syariah)</option>
                          <option value="CIMB">CIMB Niaga</option>
                          <option value="DANA">DANA</option>
                          <option value="GOPAY">GoPay</option>
                          <option value="OVO">OVO</option>
                          <option value="SHOPEEPAY">ShopeePay</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-0.5 font-medium">Nomor Rekening / No HP</label>
                        <input
                          type="text"
                          value={newAccountNumber}
                          onChange={(e) => setNewAccountNumber(e.target.value)}
                          placeholder="Contoh: 8735123456"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-0.5 font-medium">Atas Nama (Default: DARMAN)</label>
                        <input
                          type="text"
                          value={newAccountHolder}
                          onChange={(e) => setNewAccountHolder(e.target.value)}
                          placeholder="DARMAN"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white uppercase focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddBankForm(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-300 dark:hover:bg-slate-700 font-medium"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewBank}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-xs"
                      >
                        Simpan ke Daftar
                      </button>
                    </div>
                  </div>
                )}

                {/* Bank Accounts List Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {bankAccounts.map((bank) => (
                    <div
                      key={bank.id}
                      className={`p-3 rounded-xl border transition-all ${
                        bank.isActive
                          ? 'bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 shadow-xs'
                          : 'bg-slate-100/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              bank.category === 'ewallet'
                                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {bank.bankName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                            {bank.category === 'ewallet' ? 'E-Wallet' : 'Bank Transfer'}
                          </span>
                        </div>

                        {/* Toggle Active Switch */}
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {bank.isActive ? 'Aktif' : 'Off'}
                          </span>
                          <input
                            type="checkbox"
                            checked={bank.isActive}
                            onChange={() => handleToggleBank(bank.id)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {/* Account Number & Holder Fields */}
                      <div className="mt-2 space-y-1.5">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Nomor Rekening / HP:</span>
                          <input
                            type="text"
                            value={bank.accountNumber}
                            onChange={(e) =>
                              handleUpdateBankField(bank.id, 'accountNumber', e.target.value)
                            }
                            className="w-full px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Atas Nama:</span>
                            <input
                              type="text"
                              value={bank.accountHolder}
                              onChange={(e) =>
                                handleUpdateBankField(bank.id, 'accountHolder', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs uppercase text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteBank(bank.id)}
                            className="mt-3 p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
                            title="Hapus rekening ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION: QRIS Barcode Configuration */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                      2. Barcode QRIS Dinamis (All E-Wallet)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {qrisActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <input
                      type="checkbox"
                      checked={qrisActive}
                      onChange={(e) => setQrisActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nama Merchant QRIS (Default: PandirStore) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={qrisMerchantName}
                      onChange={(e) => setQrisMerchantName(e.target.value)}
                      placeholder="PandirStore"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Batas Maksimal Nominal QRIS (Default: Rp 500.000) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formatNumber(parseInt(qrisMaxNominal.replace(/\D/g, '') || '0', 10))}
                      onChange={(e) => setQrisMaxNominal(e.target.value.replace(/\D/g, ''))}
                      placeholder="500.000"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Jika harga &gt; nominal ini, opsi QRIS disembunyikan otomatis &amp; dialihkan ke Bank.
                    </span>
                  </div>
                </div>

                {/* Upload Foto QRIS Baru */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-white rounded-lg p-1 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                    <img
                      src={qrisImageUrl || realtimeSync.getPaymentConfig().qris.imageUrl}
                      alt="Preview QRIS"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Perbarui Gambar Barcode QRIS</span>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">
                      Upload foto barcode QRIS baru. Otomatis tampil di layar scan checkout pembeli.
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors border border-slate-300 dark:border-slate-700 shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Unggah Gambar QRIS Baru</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadQRIS}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION: Layanan Bantuan WhatsApp */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    3. Kontak Bantuan WhatsApp CS
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nomor WhatsApp Resmi Bantuan Transaksi
                  </label>
                  <input
                    type="text"
                    value={helpWhatsApp}
                    onChange={(e) => setHelpWhatsApp(e.target.value)}
                    placeholder="085717046895"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Digunakan saat pembeli menekan tombol &quot;Bank Gangguan? Hubungi Admin&quot;.
                  </span>
                </div>
              </div>

              {/* SECTION: Notifikasi Webhook Otomatis (Telegram & Fonnte WhatsApp) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    4. Notifikasi Webhook (Telegram &amp; WhatsApp Bot - Opsional)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Kirim notifikasi otomatis seketika saat ada pembeli yang melakukan transfer dan konfirmasi pembayaran. Kosongkan jika tidak digunakan.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Telegram Bot Token
                    </label>
                    <input
                      type="text"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="Contoh: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Telegram Chat ID / Channel ID
                    </label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="Contoh: -100123456789 atau 987654321"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Fonnte WhatsApp Token
                    </label>
                    <input
                      type="text"
                      value={fonnteToken}
                      onChange={(e) => setFonnteToken(e.target.value)}
                      placeholder="Token perangkat dari Fonnte.com"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Custom Webhook URL
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://api.domainanda.com/webhook"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Save Button */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-950/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Pembayaran'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: VERIFIKASI & APPROVAL PESANAN PEMBELI */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Daftar Pesanan Masuk ({confirmations.length} Transaksi)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Sinkronisasi Otomatis Cloud Firestore
                </span>
              </div>

              {confirmations.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <CreditCard className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">Belum Ada Pesanan Masuk</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Ketika pembeli melakukan checkout dan menekan &quot;Saya Sudah Bayar&quot;, transaksi akan otomatis muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {confirmations.map((conf) => {
                    const orderKey = conf.order_id || conf.id;
                    const officialTotal = conf.total_amount || conf.amount;
                    const claimed = conf.claimed_amount || conf.amount;
                    const diff = officialTotal - claimed;
                    const hasDiscrepancy = diff > 0;
                    const proofUrl = conf.proof_of_payment_url || conf.proofImageUrl;

                    const isPending = conf.status === 'PENDING' || conf.status === 'MENUNGGU_VERIFIKASI';
                    const isApproved = conf.status === 'PAID_APPROVED' || conf.status === 'TERVERIFIKASI';
                    const isRejected = conf.status === 'REJECTED_UNDERPAID' || conf.status === 'DITOLAK';

                    return (
                      <div
                        key={orderKey}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                      >
                        {/* Order Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{orderKey}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  : isRejected
                                  ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {conf.status}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                              {conf.payment_method}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {new Date(conf.created_at || conf.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Order Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Produk:</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block">
                              {conf.product_title || conf.accountTitle}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Tagihan Resmi:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400 font-mono">
                              {formatRupiah(officialTotal)}
                            </span>
                            {conf.unique_code && (
                              <span className="text-[9px] text-slate-500 block">
                                Kode: {conf.unique_code}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Nominal Masuk:</span>
                            <span
                              className={`font-bold font-mono ${
                                hasDiscrepancy ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {formatRupiah(claimed)}
                            </span>
                            {hasDiscrepancy && (
                              <span className="text-[9px] text-red-600 dark:text-red-400 font-bold block">
                                Kurang {formatRupiah(diff)}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Nama Pengirim:</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate block">{conf.sender_name}</span>
                            {conf.buyer_whatsapp && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono block truncate">
                                WA: {conf.buyer_whatsapp}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                          {proofUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedProof(proofUrl)}
                              className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 text-[11px] font-semibold flex items-center gap-1 border border-blue-300 dark:border-blue-500/30"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat Bukti Foto</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Tanpa screenshot bukti</span>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectUnderpaid(conf)}
                                  className="px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/40 text-[11px] font-bold flex items-center gap-1"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                  <span>Tolak (Kurang)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAutoValidate(conf)}
                                  className="px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs"
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>Validasi Cepat</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleChatBuyer(conf)}
                              className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[11px] font-bold flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Chat WA Pembeli</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Proof Lightbox Modal */}
        {selectedProof && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Bukti Transfer Pembeli</span>
                <button
                  onClick={() => setSelectedProof(null)}
                  className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 max-h-[80vh] overflow-auto flex items-center justify-center">
                <img
                  src={selectedProof}
                  alt="Bukti Transfer Asli"
                  className="max-h-[75vh] w-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
