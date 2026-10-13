import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Printer,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  ArrowLeft,
  ShoppingBag,
  RefreshCw,
  Plus,
  Trash2,
  CloudUpload,
  X,
  CreditCard,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Eye,
  AlertTriangle,
  Bell,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { GameAccount, SaleRecord, GameType, OrderTransaction } from '../types';
import { realtimeSync } from '../services/realtimeSync';
import { formatRupiah } from '../utils/formatter';
import { MLBBLogo, FreeFireLogo } from './GameBadges';
import { PandirStoreEmblem } from './PandirStoreLogo';
import { PaymentSettingsModal } from './PaymentSettingsModal';
import { useToast } from '../context/ToastContext';

export type AdminDateRange = 'daily' | 'weekly' | 'monthly' | 'all' | 'custom';

export interface AdminDashboardProps {
  initialAccounts?: GameAccount[];
  initialSalesRecords?: SaleRecord[];
  onBackToKatalog?: () => void;
  onOpenPaymentSettings?: () => void;
  onOpenOrderApproval?: () => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialAccounts,
  initialSalesRecords,
  onBackToKatalog,
  onOpenPaymentSettings,
  onOpenOrderApproval,
}) => {
  const { showToast } = useToast();

  // Real-time state fetched directly from the database service
  const [accounts, setAccounts] = useState<GameAccount[]>(() => {
    if (initialAccounts && initialAccounts.length > 0) return initialAccounts;
    return realtimeSync.getAccounts();
  });
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(() => {
    if (initialSalesRecords && initialSalesRecords.length > 0) return initialSalesRecords;
    return realtimeSync.getSalesRecords();
  });

  const [confirmations, setConfirmations] = useState<OrderTransaction[]>(() =>
    realtimeSync.getPaymentConfirmations()
  );

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Date range and filters
  const [dateRange, setDateRange] = useState<AdminDateRange>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<'ALL' | 'MLBB' | 'FREE_FIRE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Primary Tab: 'sales_ledger' | 'all_accounts' | 'orders_approval'
  const [activeTab, setActiveTab] = useState<'sales_ledger' | 'all_accounts' | 'orders_approval'>('sales_ledger');

  // Internal Payment Settings Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState<'config' | 'confirmations'>('config');
  const [selectedProofLightbox, setSelectedProofLightbox] = useState<string | null>(null);

  // Manual sale record modal state
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  const [newSaleGame, setNewSaleGame] = useState<GameType>('MLBB');
  const [newSaleTitle, setNewSaleTitle] = useState('');
  const [newSaleId, setNewSaleId] = useState('');
  const [newSaleSellingPrice, setNewSaleSellingPrice] = useState('');
  const [newSaleCostPrice, setNewSaleCostPrice] = useState('');
  const [newSaleBuyerNote, setNewSaleBuyerNote] = useState('');

  // Reset simulation data state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (initialAccounts && initialAccounts.length > 0) {
      setAccounts(initialAccounts);
    }
  }, [initialAccounts]);

  useEffect(() => {
    if (initialSalesRecords && initialSalesRecords.length > 0) {
      setSalesRecords(initialSalesRecords);
    }
  }, [initialSalesRecords]);

  // Subscribe directly to real-time Firestore database updates
  useEffect(() => {
    const unsubscribeAccounts = realtimeSync.subscribe((latestAccounts) => {
      setAccounts(latestAccounts);
      setLastUpdated(new Date());
    });

    const unsubscribeSales = realtimeSync.subscribeSales((latestSales) => {
      setSalesRecords(latestSales);
      setLastUpdated(new Date());
    });

    const unsubscribeConfirmations = realtimeSync.subscribePaymentConfirmations((latestConfs) => {
      setConfirmations(latestConfs);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeSales();
      unsubscribeConfirmations();
    };
  }, []);

  const pendingOrdersCount = confirmations.filter(
    (c) => c.status === 'PENDING' || c.status === 'MENUNGGU_VERIFIKASI'
  ).length;

  // Handlers for Order Approval Workflow
  const handleApproveOrder = async (order: OrderTransaction) => {
    const orderKey = order.order_id || order.id;
    try {
      await realtimeSync.updatePaymentConfirmationStatus(orderKey, 'PAID_APPROVED');
      showToast({
        type: 'success',
        title: 'Pesanan Disetujui (PAID_APPROVED)!',
        message: `Pembayaran pesanan ${orderKey} telah diverifikasi. Silakan kirimkan akun ke pembeli.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyetujui',
        message: err?.message || 'Kendala saat update status.',
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
        message: `Status pesanan ${orderKey} diubah ke REJECTED_UNDERPAID. Gunakan tombol Chat WhatsApp untuk hubungi pembeli.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menolak',
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
          `Mohon transfer sisa kekurangannya atau konfirmasikan rekening Anda jika ingin retur dana.`
        : `Status pesanan Anda telah kami periksa. Mohon tunggu proses pengiriman data akun game.`);

    const helpWa = realtimeSync.getPaymentConfig().helpWhatsApp || '085717046895';
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${helpWa.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  // Reset Simulation Data Handler
  const handleExecuteResetData = async () => {
    setIsResetting(true);
    try {
      await realtimeSync.resetAllSimulationData();
      showToast({
        type: 'success',
        title: 'Data Simulasi Berhasil Dikosongkan!',
        message: 'Seluruh katalog produk, transaksi, dan pesanan telah di-reset ke kondisi bersih (0 item).',
      });
      setIsResetConfirmOpen(false);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Mereset Data',
        message: err?.message || 'Kendala saat menghapus data dari Cloud Firestore.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Filter accounts based on date range, game, and search query
  const filteredAccounts = useMemo(() => {
    const now = Date.now();
    return accounts.filter((acc) => {
      const timestamp = acc.updatedAt || acc.createdAt || now;

      if (dateRange === 'daily') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (timestamp < startOfToday.getTime()) return false;
      } else if (dateRange === 'weekly') {
        if (timestamp < now - ONE_DAY_MS * 7) return false;
      } else if (dateRange === 'monthly') {
        if (timestamp < now - ONE_DAY_MS * 30) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate) {
          const startMs = new Date(customStartDate).getTime();
          if (timestamp < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(customEndDate).getTime() + ONE_DAY_MS - 1;
          if (timestamp > endMs) return false;
        }
      }

      if (selectedGame !== 'ALL' && acc.game !== selectedGame) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = acc.title.toLowerCase().includes(q);
        const matchId = acc.id.toLowerCase().includes(q);
        if (!matchTitle && !matchId) return false;
      }

      return true;
    });
  }, [accounts, dateRange, customStartDate, customEndDate, selectedGame, searchQuery]);

  // Filter Sales Records for ledger
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return salesRecords.filter((record) => {
      if (dateRange === 'daily') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (record.date < startOfToday.getTime()) return false;
      } else if (dateRange === 'weekly') {
        if (record.date < now - ONE_DAY_MS * 7) return false;
      } else if (dateRange === 'monthly') {
        if (record.date < now - ONE_DAY_MS * 30) return false;
      } else if (dateRange === 'custom') {
        if (customStartDate) {
          const startMs = new Date(customStartDate).getTime();
          if (record.date < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(customEndDate).getTime() + ONE_DAY_MS - 1;
          if (record.date > endMs) return false;
        }
      }

      if (selectedGame !== 'ALL' && record.game !== selectedGame) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = record.accountTitle.toLowerCase().includes(q);
        const matchId = record.id.toLowerCase().includes(q) || record.accountId.toLowerCase().includes(q);
        if (!matchTitle && !matchId) return false;
      }

      return true;
    });
  }, [salesRecords, dateRange, customStartDate, customEndDate, selectedGame, searchQuery]);

  // Filter Confirmations for approval tab
  const filteredConfirmations = useMemo(() => {
    return confirmations.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = (c.order_id || c.id || '').toLowerCase().includes(q);
        const productMatch = (c.product_title || c.accountTitle || '').toLowerCase().includes(q);
        const buyerMatch = (c.sender_name || '').toLowerCase().includes(q);
        if (!idMatch && !productMatch && !buyerMatch) return false;
      }
      return true;
    });
  }, [confirmations, searchQuery]);

  // Financial Calculations
  const totalRevenue = useMemo(() => {
    const fromAccounts = filteredAccounts.reduce((sum, acc) => {
      const units = acc.soldCount || (acc.status === 'SOLD_OUT' ? 1 : 0);
      return sum + acc.price * units;
    }, 0);

    const fromSalesLedger = filteredSales.reduce((sum, s) => sum + s.sellingPrice, 0);

    if (activeTab === 'sales_ledger') {
      return fromSalesLedger;
    }
    if (activeTab === 'all_accounts') {
      return fromAccounts > 0 ? fromAccounts : fromSalesLedger;
    }
    return Math.max(fromAccounts, fromSalesLedger);
  }, [filteredAccounts, filteredSales, activeTab]);

  const totalCOGS = useMemo(() => {
    const fromAccounts = filteredAccounts.reduce((sum, acc) => {
      const cost = acc.costPrice ?? Math.round(acc.price * 0.7);
      const units = acc.soldCount || (acc.status === 'SOLD_OUT' ? 1 : 0);
      return sum + cost * units;
    }, 0);

    const fromSalesLedger = filteredSales.reduce((sum, s) => sum + s.costPrice, 0);

    if (activeTab === 'sales_ledger') {
      return fromSalesLedger;
    }
    if (activeTab === 'all_accounts') {
      return fromAccounts > 0 ? fromAccounts : fromSalesLedger;
    }
    return Math.max(fromAccounts, fromSalesLedger);
  }, [filteredAccounts, filteredSales, activeTab]);

  const netProfit = totalRevenue - totalCOGS;
  const profitMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Inventory valuation
  const inventoryStats = useMemo(() => {
    const readyAccounts = filteredAccounts.filter((a) => a.status === 'READY');
    const totalReadyValue = readyAccounts.reduce((sum, a) => sum + a.price, 0);
    const totalReadyCost = readyAccounts.reduce(
      (sum, a) => sum + (a.costPrice ?? Math.round(a.price * 0.7)),
      0
    );
    return {
      readyCount: readyAccounts.length,
      totalReadyValue,
      totalReadyCost,
      potentialProfit: totalReadyValue - totalReadyCost,
    };
  }, [filteredAccounts]);

  // Manual sale record submission
  const handleSaveManualSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const sellingPrice = parseInt(newSaleSellingPrice.replace(/\D/g, '') || '0', 10);
    const costPrice = parseInt(newSaleCostPrice.replace(/\D/g, '') || '0', 10);

    if (!newSaleTitle.trim()) {
      showToast({
        type: 'info',
        title: 'Form Belum Lengkap',
        message: 'Mohon isi judul atau deskripsi akun yang terjual.',
      });
      return;
    }
    if (sellingPrice <= 0) {
      showToast({
        type: 'info',
        title: 'Harga Jual Tidak Valid',
        message: 'Mohon masukkan nominal harga jual yang benar.',
      });
      return;
    }

    try {
      const created = await realtimeSync.addSaleRecord({
        accountId: newSaleId.trim() || `ACC-${Date.now().toString().slice(-4)}`,
        accountTitle: newSaleTitle.trim(),
        game: newSaleGame,
        sellingPrice,
        costPrice,
        profit: sellingPrice - costPrice,
        date: Date.now(),
        buyerNote: newSaleBuyerNote.trim() || 'Transaksi kasir manual direct WA',
      });

      showToast({
        type: 'success',
        title: 'Transaksi Berhasil Disimpan',
        message: `Penjualan "${created.accountTitle}" tersimpan dan otomatis tersinkron ke semua perangkat.`,
      });

      setIsAddSaleModalOpen(false);
      setNewSaleTitle('');
      setNewSaleId('');
      setNewSaleSellingPrice('');
      setNewSaleCostPrice('');
      setNewSaleBuyerNote('');
      setActiveTab('sales_ledger');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err?.message || 'Gagal menyimpan transaksi ke Cloud Firestore.',
      });
    }
  };

  // Delete sale record
  const handleDeleteSale = async (sale: SaleRecord) => {
    if (window.confirm(`Hapus catatan transaksi ${sale.id} (${sale.accountTitle})?`)) {
      try {
        await realtimeSync.deleteSaleRecord(sale.id);
        showToast({
          type: 'info',
          title: 'Transaksi Dihapus',
          message: `Catatan transaksi ${sale.id} berhasil dihapus dari cloud.`,
        });
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Gagal Menghapus',
          message: err?.message || 'Gagal menghapus transaksi.',
        });
      }
    }
  };

  // Instant Cloud Sync handler
  const handleSyncCloudNow = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await realtimeSync.syncLocalToCloudNow();
      showToast({
        type: 'success',
        title: 'Sinkronisasi Multi-Device Berhasil!',
        message: `Berhasil mengunggah ${res.salesSynced} transaksi & ${res.accountsSynced} data akun ke Cloud Firestore.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Kendala Sinkronisasi',
        message: err?.message || 'Gagal menghubungkan ke Cloud Firestore.',
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Export CSV
  const handleExportExcelCSV = () => {
    const headers = [
      'ID Transaksi',
      'Game',
      'Judul Akun',
      'Harga Beli Modal (COGS)',
      'Harga Jual (Revenue)',
      'Laba Bersih (Net Profit)',
      'Margin (%)',
      'Tanggal Transaksi',
    ];

    const rows = filteredSales.map((s) => {
      const margin = s.sellingPrice > 0 ? Math.round((s.profit / s.sellingPrice) * 100) : 0;
      return [
        s.id,
        s.game === 'MLBB' ? 'Mobile Legends' : 'Free Fire',
        `"${s.accountTitle.replace(/"/g, '""')}"`,
        s.costPrice,
        s.sellingPrice,
        s.profit,
        `${margin}%`,
        `"${new Date(s.date).toLocaleString('id-ID')}"`,
      ];
    });

    const totalsRow = [
      'TOTAL REKAPITULASI',
      '-',
      `"Periode: ${dateRange.toUpperCase()}"`,
      totalCOGS,
      totalRevenue,
      netProfit,
      `${profitMarginPercent}%`,
      `"${new Date().toLocaleString('id-ID')}"`,
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(',')), totalsRow.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Keuangan_PANDIRSTORE_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. Header: Compact bar featuring store profile, sync status badge, minimalist icon buttons */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
        {/* Left: Store Profile & Live Sync Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToKatalog && (
            <button
              onClick={onBackToKatalog}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-300 transition-colors shrink-0"
              title="Kembali ke Katalog Publik"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
            <PandirStoreEmblem className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                PANDIRSTORE.ID
              </h1>
              <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                Tersinkron
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1.5">
              <span>Seller Center</span>
              <span className="text-slate-400 dark:text-neutral-600">•</span>
              <span className="text-slate-500 dark:text-neutral-400 font-mono text-[10px]">
                Diperbarui {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Minimalist Icon Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 print:hidden">
          {/* Notifications / Orders Approval Badge */}
          <button
            type="button"
            onClick={() => {
              if (onOpenOrderApproval) onOpenOrderApproval();
              else setActiveTab('orders_approval');
            }}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Verifikasi Pesanan Masuk"
          >
            <Bell className="w-4 h-4" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* Payment & QRIS Settings */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPaymentSettings) onOpenPaymentSettings();
              else {
                setPaymentModalTab('config');
                setIsPaymentModalOpen(true);
              }
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Pengaturan QRIS & Rekening Bank"
          >
            <CreditCard className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Financial Summary: Wallet-Style Card displaying Total Balance, Revenue, and Net Profit */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top Wallet Row: Total Saldo / Omset */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2A2A2A]">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 font-medium">
              <span>Total Omset Penjualan</span>
              <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold">
                Revenue
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight mt-1">
              {formatRupiah(totalRevenue)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-semibold gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {profitMarginPercent}% Margin
              </span>
              <span className="text-slate-400 dark:text-neutral-600">•</span>
              <span>{filteredSales.length} Transaksi Terjual</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-neutral-400 font-medium">Laba Bersih</div>
            <div
              className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              }`}
            >
              {netProfit < 0 ? '-' : '+'}
              {formatRupiah(Math.abs(netProfit))}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-neutral-500 mt-0.5">
              (Omset − Modal COGS)
            </div>
          </div>
        </div>

        {/* Bottom Wallet Grid: Modal & Aset Stok */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
          <div className="bg-slate-50 dark:bg-[#252525] rounded-xl p-3 border border-slate-200 dark:border-[#2A2A2A]">
            <span className="text-[11px] text-slate-600 dark:text-neutral-400 block font-medium">Total Modal (COGS)</span>
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono block mt-0.5">
              {formatRupiah(totalCOGS)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-neutral-500 mt-0.5 block">Modal barang terjual</span>
          </div>

          <div className="bg-slate-50 dark:bg-[#252525] rounded-xl p-3 border border-slate-200 dark:border-[#2A2A2A]">
            <span className="text-[11px] text-slate-600 dark:text-neutral-400 block font-medium">Nilai Aset Stok Ready</span>
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono block mt-0.5">
              {formatRupiah(inventoryStats.totalReadyValue)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-neutral-500 mt-0.5 block">
              {inventoryStats.readyCount} Akun Tersedia
            </span>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions: Clean icon grid (icon top, label below) */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2 px-1">
          Aksi Cepat
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {/* 1. Record Sale */}
          <button
            type="button"
            onClick={() => setIsAddSaleModalOpen(true)}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center mb-1.5 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-xs">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              Catat Jual
            </span>
          </button>

          {/* 2. Sync Cloud */}
          <button
            type="button"
            onClick={handleSyncCloudNow}
            disabled={isSyncingCloud}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center mb-1.5 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <CloudUpload className={`w-5 h-5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              {isSyncingCloud ? 'Syncing...' : 'Sync Cloud'}
            </span>
          </button>

          {/* 3. Export CSV */}
          <button
            type="button"
            onClick={handleExportExcelCSV}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-1.5 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              Export CSV
            </span>
          </button>

          {/* 4. Cetak PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center mb-1.5 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              Cetak PDF
            </span>
          </button>

          {/* 5. QRIS & Bank */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPaymentSettings) onOpenPaymentSettings();
              else {
                setPaymentModalTab('config');
                setIsPaymentModalOpen(true);
              }
            }}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mb-1.5 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              QRIS &amp; Bank
            </span>
          </button>

          {/* 6. Reset Data */}
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center mb-1.5 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight">
              Reset Data
            </span>
          </button>
        </div>
      </div>

      {/* 4. Filters & Search: Integrated search bar with horizontal scrollable chips */}
      <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        {/* Integrated Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari transaksi, ID lapak, judul akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] rounded-xl pl-9 pr-9 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Primary View Tabs: Buku Penjualan, Katalog Akun, Pesanan Masuk */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setActiveTab('sales_ledger')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sales_ledger'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            <span>Buku Penjualan</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'sales_ledger' ? 'bg-black/25 text-white' : 'bg-slate-200 dark:bg-[#1E1E1E] text-slate-700 dark:text-neutral-400'
              }`}
            >
              {filteredSales.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all_accounts')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all_accounts'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            <span>Katalog Akun</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'all_accounts' ? 'bg-black/25 text-white' : 'bg-slate-200 dark:bg-[#1E1E1E] text-slate-700 dark:text-neutral-400'
              }`}
            >
              {filteredAccounts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders_approval')}
            className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'orders_approval'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            <span>Pesanan Masuk</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>
        </div>

        {/* Horizontal Scrollable Chips (Period & Categories) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs border-t border-slate-200 dark:border-[#2A2A2A] pt-2.5">
          <span className="text-[11px] text-slate-500 dark:text-neutral-500 font-semibold shrink-0 mr-1">Periode:</span>
          {(['all', 'daily', 'weekly', 'monthly'] as AdminDateRange[]).map((range) => {
            const labels: Record<string, string> = {
              all: 'Semua',
              daily: 'Hari Ini',
              weekly: 'Minggu Ini',
              monthly: 'Bulan Ini',
            };
            const isActive = dateRange === range;
            return (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-slate-900 dark:bg-neutral-200 text-white dark:text-neutral-900 font-bold'
                    : 'bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
                }`}
              >
                {labels[range]}
              </button>
            );
          })}

          <div className="h-4 w-px bg-slate-200 dark:bg-[#2A2A2A] shrink-0 mx-1"></div>

          {/* Game Chips */}
          <button
            type="button"
            onClick={() => setSelectedGame('ALL')}
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
              selectedGame === 'ALL'
                ? 'bg-slate-900 dark:bg-neutral-200 text-white dark:text-neutral-900 font-bold'
                : 'bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            Semua Game
          </button>
          <button
            type="button"
            onClick={() => setSelectedGame('MLBB')}
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
              selectedGame === 'MLBB'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            <MLBBLogo className="w-3 h-3" />
            <span>MLBB</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedGame('FREE_FIRE')}
            className={`h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
              selectedGame === 'FREE_FIRE'
                ? 'bg-orange-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2A2A]'
            }`}
          >
            <FreeFireLogo className="w-3 h-3" />
            <span>Free Fire</span>
          </button>
        </div>
      </div>

      {/* 5. Data List: Mobile Card List replacing rigid desktop tables */}
      <div className="space-y-2.5">
        {/* Tab 1: Buku Penjualan (Sales Ledger Mobile Cards) */}
        {activeTab === 'sales_ledger' && (
          <>
            {filteredSales.length === 0 ? (
              <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-8 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400 dark:text-neutral-500 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">0 Transaksi Ditemukan</h4>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                    Belum ada riwayat penjualan akun untuk filter ini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSaleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Catat Penjualan Pertama</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSales.map((sale) => {
                  const margin =
                    sale.sellingPrice > 0 ? Math.round((sale.profit / sale.sellingPrice) * 100) : 0;

                  return (
                    <div
                      key={sale.id}
                      className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3.5 space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors shadow-xs"
                    >
                      {/* Top Bar: ID, Game, Status Pill, Date */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {sale.game === 'MLBB' ? (
                            <MLBBLogo className="w-3.5 h-3.5" />
                          ) : (
                            <FreeFireLogo className="w-3.5 h-3.5" />
                          )}
                          <span className="font-mono font-bold text-slate-700 dark:text-neutral-300">
                            {sale.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                            Lunas
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono">
                            {new Date(sale.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-2">
                        {sale.accountTitle}
                      </div>

                      {sale.buyerNote && (
                        <div className="text-[11px] text-slate-600 dark:text-neutral-400 italic bg-slate-50 dark:bg-[#252525] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2A2A2A]">
                          &quot;{sale.buyerNote}&quot;
                        </div>
                      )}

                      {/* Financial Metrics Strip */}
                      <div className="pt-2 border-t border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Harga Jual</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono text-sm sm:text-base">
                            {formatRupiah(sale.sellingPrice)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">
                            Modal: {formatRupiah(sale.costPrice)}
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs sm:text-sm">
                            +{formatRupiah(sale.profit)} ({margin}%)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSale(sale)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 dark:bg-[#252525] text-slate-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors ml-1"
                          title="Hapus transaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Katalog Akun (Account Inventory Mobile Cards) */}
        {activeTab === 'all_accounts' && (
          <>
            {filteredAccounts.length === 0 ? (
              <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-8 text-center space-y-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400 dark:text-neutral-500 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">0 Akun Ditemukan</h4>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Belum ada akun di katalog yang cocok dengan filter.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((account) => {
                  const cost = account.costPrice ?? Math.round(account.price * 0.7);
                  const profit = account.price - cost;
                  const margin =
                    account.price > 0 ? Math.round((profit / account.price) * 100) : 0;

                  return (
                    <div
                      key={account.id}
                      className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3.5 space-y-2.5 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors shadow-xs"
                    >
                      {/* Top Bar: ID, Game, Status */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {account.game === 'MLBB' ? (
                            <MLBBLogo className="w-3.5 h-3.5" />
                          ) : (
                            <FreeFireLogo className="w-3.5 h-3.5" />
                          )}
                          <span className="font-mono font-bold text-slate-700 dark:text-neutral-300">
                            {account.id}
                          </span>
                        </div>

                        {account.status === 'READY' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                            Ready ({account.stock})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-bold text-[10px] border border-slate-300 dark:border-neutral-700">
                            Terjual
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-2">
                        {account.title}
                      </div>

                      {/* Specs Badge Strip */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {account.mlSpecs?.rank && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-[#2A2A2A]">
                            Rank: {account.mlSpecs.rank}
                          </span>
                        )}
                        {account.mlSpecs?.totalSkin && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-[#2A2A2A]">
                            {account.mlSpecs.totalSkin} Skins
                          </span>
                        )}
                        {account.ffSpecs?.level && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-[#2A2A2A]">
                            Level: {account.ffSpecs.level}
                          </span>
                        )}
                      </div>

                      {/* Financial Strip */}
                      <div className="pt-2 border-t border-slate-200 dark:border-[#2A2A2A] flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Harga Jual</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                            {formatRupiah(account.price)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">
                            Modal: {formatRupiah(cost)}
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            +{formatRupiah(profit)} ({margin}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Tab 3: Workflow Approval Pesanan (Orders Approval Cards) */}
        {activeTab === 'orders_approval' && (
          <>
            {filteredConfirmations.length === 0 ? (
              <div className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-8 text-center space-y-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#252525] text-slate-400 dark:text-neutral-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">0 Pesanan Menunggu</h4>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Belum ada konfirmasi pembayaran masuk dari pembeli.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredConfirmations.map((conf) => {
                  const orderKey = conf.order_id || conf.id;
                  const officialTotal = conf.total_amount || conf.amount || 0;
                  const claimed = conf.claimed_amount || conf.amount || officialTotal;
                  const diff = officialTotal - claimed;
                  const hasDiscrepancy = claimed < officialTotal;
                  const proofUrl = conf.proof_of_payment_url || conf.proofImageUrl;
                  const isPending =
                    conf.status === 'PENDING' || conf.status === 'MENUNGGU_VERIFIKASI';
                  const isApproved =
                    conf.status === 'PAID_APPROVED' || conf.status === 'TERVERIFIKASI';
                  const isRejected =
                    conf.status === 'REJECTED_UNDERPAID' || conf.status === 'DITOLAK';

                  return (
                    <div
                      key={orderKey}
                      className="bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-3.5 space-y-3 shadow-xs"
                    >
                      {/* Order Header & Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-xs sm:text-sm">
                            {orderKey}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : isRejected
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}
                          >
                            {conf.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono">
                          {new Date(conf.created_at || conf.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Product Name */}
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                        {conf.product_title || conf.accountTitle}
                      </div>

                      {/* Grid info */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-[#252525] p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2A2A]">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Metode</span>
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">
                            {conf.payment_method}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Pengirim</span>
                          <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate block">
                            {conf.sender_name}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Tagihan Resmi</span>
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {formatRupiah(officialTotal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 block font-medium">Ditransfer</span>
                          <span
                            className={`font-mono font-bold ${
                              hasDiscrepancy ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatRupiah(claimed)}
                          </span>
                        </div>
                      </div>

                      {hasDiscrepancy && (
                        <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-500/30 font-semibold">
                          ⚠️ Terdapat kekurangan transfer sebesar {formatRupiah(diff)}.
                        </div>
                      )}

                      {conf.notes && (
                        <div className="text-[11px] text-slate-600 dark:text-neutral-400 italic bg-slate-50 dark:bg-[#252525] p-2 rounded-lg">
                          Catatan: &quot;{conf.notes}&quot;
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-[#2A2A2A]">
                        {proofUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProofLightbox(proofUrl)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#2A2A2A] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Bukti Transfer</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 dark:text-neutral-500 italic">
                            Tanpa screenshot bukti
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRejectUnderpaid(conf)}
                                className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-xs font-bold transition-colors"
                              >
                                Tolak
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(conf)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs"
                              >
                                Setujui
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleChatBuyer(conf)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox Bukti Transfer */}
      {selectedProofLightbox && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-lg w-full bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center text-slate-900 dark:text-white">
              <span className="font-bold text-xs">Foto Bukti Transfer Pembeli</span>
              <button
                onClick={() => setSelectedProofLightbox(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] bg-slate-900 flex items-center justify-center">
              <img
                src={selectedProofLightbox}
                alt="Bukti Transfer"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Settings Modal */}
      <PaymentSettingsModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        defaultTab={paymentModalTab}
      />

      {/* Modal Input Transaksi Penjualan Baru */}
      {isAddSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Catat Penjualan Baru</h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">Tersinkron otomatis ke seluruh perangkat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSaleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualSale} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">Game</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSaleGame('MLBB')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      newSaleGame === 'MLBB'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 border border-slate-200 dark:border-[#2A2A2A]'
                    }`}
                  >
                    <MLBBLogo className="w-4 h-4" />
                    <span>Mobile Legends</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSaleGame('FREE_FIRE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      newSaleGame === 'FREE_FIRE'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] text-slate-700 dark:text-neutral-400 border border-slate-200 dark:border-[#2A2A2A]'
                    }`}
                  >
                    <FreeFireLogo className="w-4 h-4" />
                    <span>Free Fire</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  Judul Akun / Rincian Lapak <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MLBB Mythic Glory 180 Skin Collector"
                  value={newSaleTitle}
                  onChange={(e) => setNewSaleTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  ID Akun / Kode Lapak (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: ML-201 atau ID Akun"
                  value={newSaleId}
                  onChange={(e) => setNewSaleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                    Harga Jual <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 500000"
                    value={newSaleSellingPrice}
                    onChange={(e) => setNewSaleSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-xs text-orange-600 dark:text-orange-400 font-bold font-mono placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                    Harga Modal (COGS)
                  </label>
                  <input
                    type="number"
                    placeholder="Contoh: 350000"
                    value={newSaleCostPrice}
                    onChange={(e) => setNewSaleCostPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-xs text-slate-700 dark:text-neutral-300 font-mono placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">
                  Catatan Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Direct WA Pembeli Depok"
                  value={newSaleBuyerNote}
                  onChange={(e) => setNewSaleBuyerNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#2A2A2A] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSaleModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-300 text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Simulation Data Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-[#2A2A2A] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Semua Data Simulasi?</h3>
              <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
                Tindakan ini akan menghapus dan mengosongkan seluruh akun katalog, transaksi penjualan, dan order masuk yang tersimpan di Cloud Firestore maupun memori lokal.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                Katalog dan laporan keuangan akan kembali ke kondisi bersih 100% (Rp 0 &amp; 0 Transaksi) siap produksi.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                disabled={isResetting}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#252525] dark:hover:bg-[#2F2F2F] text-slate-700 dark:text-neutral-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteResetData}
                disabled={isResetting}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
              >
                {isResetting ? 'Mereset...' : 'Ya, Bersihkan Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
