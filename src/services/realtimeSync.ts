import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { GameAccount, SaleRecord, PaymentConfig, PaymentConfirmation, BankAccount } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_SALES_RECORDS } from '../data/initialAccounts';

const STORAGE_VERSION_KEY = 'pandirstore_clean_slate_production_v1';
const STORAGE_KEY = 'pandirstore_accounts_prod_v1';
const STORAGE_SALES_KEY = 'pandirstore_sales_prod_v1';
const STORAGE_PAYMENT_KEY = 'pandirstore_payment_prod_v1';
const STORAGE_CONFIRMATIONS_KEY = 'pandirstore_confirmations_prod_v1';

const ACCOUNTS_COLLECTION = 'akun_toko_game';
const SALES_COLLECTION = 'catatan_penjualan';
const PAYMENT_CONFIG_COLLECTION = 'pengaturan_pembayaran';
const PAYMENT_CONFIG_DOC = 'utama';
const PAYMENT_CONFIRMATIONS_COLLECTION = 'konfirmasi_pembayaran';

export type SyncMode = 'firebase' | 'broadcast' | 'offline';

type AccountsListener = (accounts: GameAccount[]) => void;
type SalesListener = (sales: SaleRecord[]) => void;
type PaymentConfigListener = (config: PaymentConfig) => void;
type PaymentConfirmationsListener = (confirmations: PaymentConfirmation[]) => void;
type SyncStatusListener = (status: { isConnected: boolean; isInitialLoaded: boolean }) => void;

// Default Multi-Bank & E-Wallet accounts (Nama Penerima Default: DARMAN)
// Only configured accounts appear by default (SeaBank). Any others (BCA, BRI, etc.) only appear if explicitly added/enabled by admin.
export const DEFAULT_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'seabank',
    bankName: 'SeaBank',
    accountNumber: '901316745804',
    accountHolder: 'DARMAN',
    isActive: true,
    category: 'bank',
  },
];

export interface ActivePaymentMethodsInfo {
  isQrisAllowed: boolean;
  qrisMerchant: string;
  qrisImageUrl: string;
  activeBanks: BankAccount[];
  availableMethods: string[];
  triggerButtonLabel: string;
}

/**
 * Single source of truth for active payment methods across buyer checkout and detail triggers.
 */
export function getActivePaymentMethods(config: PaymentConfig, price?: number): ActivePaymentMethodsInfo {
  const qrisActive = config.qris_is_active ?? config.qris?.isActive ?? true;
  const qrisMax = config.qris_max_amount ?? config.qris?.maxNominal ?? 500000;
  const isQrisAllowed = Boolean(qrisActive && (price === undefined || price <= qrisMax));
  const qrisMerchant = config.qris_merchant_name ?? config.qris?.merchantName ?? 'PandirStore';
  const qrisImageUrl = config.qris_image_url ?? config.qris?.imageUrl ?? '';

  const rawBanks =
    Array.isArray(config.bankAccounts) && config.bankAccounts.length > 0
      ? config.bankAccounts
      : config.seabank
      ? [
          {
            id: 'seabank',
            bankName: 'SeaBank',
            accountNumber: config.seabank.accountNumber || config.seabank_account_number || '901316745804',
            accountHolder: config.seabank.accountName || config.seabank_account_name || 'DARMAN',
            isActive: config.seabank.isActive ?? config.seabank_is_active ?? true,
            category: 'bank' as const,
          },
        ]
      : DEFAULT_BANK_ACCOUNTS;

  const activeBanks = rawBanks.filter((b) => b && b.isActive);

  const availableMethods: string[] = [];
  if (isQrisAllowed) {
    availableMethods.push('QRIS');
  }
  activeBanks.forEach((b) => {
    if (!availableMethods.includes(b.bankName)) {
      availableMethods.push(b.bankName);
    }
  });

  let triggerButtonLabel = 'Bayar Sekarang';
  if (availableMethods.length > 0) {
    if (availableMethods.length <= 3) {
      triggerButtonLabel = `Bayar (${availableMethods.join(' / ')})`;
    } else {
      triggerButtonLabel = `Bayar (${availableMethods.slice(0, 2).join(' / ')} +${availableMethods.length - 2})`;
    }
  }

  return {
    isQrisAllowed,
    qrisMerchant,
    qrisImageUrl,
    activeBanks,
    availableMethods,
    triggerButtonLabel,
  };
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  bankAccounts: DEFAULT_BANK_ACCOUNTS,
  seabank_account_number: '901316745804',
  seabank_account_name: 'DARMAN',
  seabank_is_active: true,
  qris_image_url:
    'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=00020101021126590014ID.LINKAJA.WWW011893600914300000000002159013167458045204581253033605802ID5911PANDIRSTORE6007JAKARTA61051011062070703A016304C741',
  qris_merchant_name: 'PandirStore',
  qris_max_amount: 500000,
  qris_is_active: true,
  updated_at: Date.now(),
  help_whatsapp: '085717046895',
  seabank: {
    isActive: true,
    accountNumber: '901316745804',
    accountName: 'DARMAN',
  },
  qris: {
    isActive: true,
    merchantName: 'PandirStore',
    maxNominal: 500000,
    imageUrl:
      'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=00020101021126590014ID.LINKAJA.WWW011893600914300000000002159013167458045204581253033605802ID5911PANDIRSTORE6007JAKARTA61051011062070703A016304C741',
  },
  helpWhatsApp: '085717046895',
  webhook: {
    telegramBotToken: '',
    telegramChatId: '',
    fonnteToken: '',
    webhookUrl: '',
  },
  updatedAt: Date.now(),
};

class RealtimeSyncService {
  private listeners: Set<AccountsListener> = new Set();
  private salesListeners: Set<SalesListener> = new Set();
  private paymentListeners: Set<PaymentConfigListener> = new Set();
  private confirmationListeners: Set<PaymentConfirmationsListener> = new Set();
  private statusListeners: Set<SyncStatusListener> = new Set();

  private broadcastChannel: BroadcastChannel | null = null;
  private unsubscribeFirestoreAccounts: Unsubscribe | null = null;
  private unsubscribeFirestoreSales: Unsubscribe | null = null;
  private unsubscribeFirestorePayment: Unsubscribe | null = null;
  private unsubscribeFirestoreConfirmations: Unsubscribe | null = null;

  private currentMode: SyncMode = 'firebase';
  private currentAccounts: GameAccount[] = [];
  private currentSales: SaleRecord[] = [];
  private currentPaymentConfig: PaymentConfig = DEFAULT_PAYMENT_CONFIG;
  private currentConfirmations: PaymentConfirmation[] = [];

  public isConnected = false;
  public isInitialLoaded = false;

  constructor() {
    this.initBroadcastChannel();
    this.purgeLegacyMockDataAndLoadCache();
    this.initFirestoreSync();
  }

  /**
   * BroadcastChannel allows same-device multi-tab synchronization
   * when offline or during instant optimistic state updates.
   */
  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('pandirstore_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (!this.isConnected) {
            if (event.data?.type === 'ACCOUNTS_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentAccounts = event.data.payload;
              this.notifyListeners(this.currentAccounts);
            } else if (event.data?.type === 'SALES_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentSales = event.data.payload;
              this.notifySalesListeners(this.currentSales);
            } else if (event.data?.type === 'PAYMENT_CONFIG_UPDATED' && event.data.payload) {
              this.currentPaymentConfig = event.data.payload;
              this.notifyPaymentListeners(this.currentPaymentConfig);
            } else if (event.data?.type === 'CONFIRMATIONS_UPDATED' && Array.isArray(event.data.payload)) {
              this.currentConfirmations = event.data.payload;
              this.notifyConfirmationListeners(this.currentConfirmations);
            }
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization skipped:', err);
      }
    }
  }

  /**
   * Purges all old residual mock/dummy data keys from users' browsers
   * ensuring a 100% clean slate for production deployment.
   */
  private purgeLegacyMockDataAndLoadCache() {
    if (typeof window === 'undefined') return;

    try {
      const version = localStorage.getItem(STORAGE_VERSION_KEY);
      if (version !== 'prod_v2') {
        // Remove all legacy keys that may contain mock accounts and old payment config
        const legacyKeys = [
          'gamestore_accounts_data',
          'gamestore_accounts_data_v2',
          'gamestore_accounts_data_v3',
          'pandirstore_sales_records',
          'pandirstore_sales_records_v2',
          'pandirstore_payment_config',
          'pandirstore_payment_config_v2',
          'pandirstore_payment_confirmations',
          'pandirstore_payment_confirmations_v2',
          STORAGE_PAYMENT_KEY,
        ];
        legacyKeys.forEach((key) => localStorage.removeItem(key));
        localStorage.setItem(STORAGE_VERSION_KEY, 'prod_v2');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ACCOUNTS));
        localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(INITIAL_SALES_RECORDS));
        this.currentAccounts = [...INITIAL_ACCOUNTS];
        this.currentSales = [...INITIAL_SALES_RECORDS];
        this.currentPaymentConfig = DEFAULT_PAYMENT_CONFIG;
        return;
      }

      const storedAcc = localStorage.getItem(STORAGE_KEY);
      if (storedAcc) {
        const parsed = JSON.parse(storedAcc);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.currentAccounts = parsed;
        } else if (INITIAL_ACCOUNTS.length > 0) {
          this.currentAccounts = [...INITIAL_ACCOUNTS];
        }
      } else if (INITIAL_ACCOUNTS.length > 0) {
        this.currentAccounts = [...INITIAL_ACCOUNTS];
      }

      const storedSales = localStorage.getItem(STORAGE_SALES_KEY);
      if (storedSales) {
        const parsedSales = JSON.parse(storedSales);
        if (Array.isArray(parsedSales) && parsedSales.length > 0) {
          this.currentSales = parsedSales;
        } else if (INITIAL_SALES_RECORDS.length > 0) {
          this.currentSales = [...INITIAL_SALES_RECORDS];
        }
      } else if (INITIAL_SALES_RECORDS.length > 0) {
        this.currentSales = [...INITIAL_SALES_RECORDS];
      }

      const storedPayment = localStorage.getItem(STORAGE_PAYMENT_KEY);
      if (storedPayment) {
        const parsedPayment = JSON.parse(storedPayment);
        if (parsedPayment) {
          const rawBanks =
            Array.isArray(parsedPayment.bankAccounts) && parsedPayment.bankAccounts.length > 0
              ? parsedPayment.bankAccounts
              : parsedPayment.seabank
              ? [
                  {
                    id: 'seabank',
                    bankName: 'SeaBank',
                    accountNumber: parsedPayment.seabank.accountNumber || '901316745804',
                    accountHolder: parsedPayment.seabank.accountName || 'DARMAN',
                    isActive: parsedPayment.seabank.isActive ?? true,
                    category: 'bank' as const,
                  },
                ]
              : DEFAULT_BANK_ACCOUNTS;

          this.currentPaymentConfig = {
            ...DEFAULT_PAYMENT_CONFIG,
            ...parsedPayment,
            bankAccounts: rawBanks,
          };
        }
      }

      const storedConfirmations = localStorage.getItem(STORAGE_CONFIRMATIONS_KEY);
      if (storedConfirmations) {
        const parsedConfirmations = JSON.parse(storedConfirmations);
        if (Array.isArray(parsedConfirmations)) {
          this.currentConfirmations = parsedConfirmations;
        }
      }
    } catch (err) {
      console.warn('Error during cache loading / migration:', err);
      this.currentAccounts = [];
      this.currentSales = [];
      this.currentPaymentConfig = DEFAULT_PAYMENT_CONFIG;
    }
  }

  private saveToLocalStorage(accounts: GameAccount[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'ACCOUNTS_UPDATED',
          payload: accounts,
        });
      }
    } catch (err) {
      console.error('Error saving accounts to localStorage:', err);
    }
  }

  private saveSalesToLocalStorage(sales: SaleRecord[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(sales));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'SALES_UPDATED',
          payload: sales,
        });
      }
    } catch (err) {
      console.error('Error saving sales to localStorage:', err);
    }
  }

  private savePaymentConfigToLocalStorage(config: PaymentConfig, broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_PAYMENT_KEY, JSON.stringify(config));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'PAYMENT_CONFIG_UPDATED',
          payload: config,
        });
      }
    } catch (err) {
      console.error('Error saving payment config to localStorage:', err);
    }
  }

  private saveConfirmationsToLocalStorage(confirmations: PaymentConfirmation[], broadcast = false) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_CONFIRMATIONS_KEY, JSON.stringify(confirmations));
      if (broadcast && this.broadcastChannel && !this.isConnected) {
        this.broadcastChannel.postMessage({
          type: 'CONFIRMATIONS_UPDATED',
          payload: confirmations,
        });
      }
    } catch (err) {
      console.error('Error saving confirmations to localStorage:', err);
    }
  }

  /**
   * Initialize bidirectional real-time Firestore listeners.
   * Any change made on HP or PC triggers onSnapshot on all other devices in milliseconds.
   */
  private initFirestoreSync() {
    try {
      const accountsCol = collection(db, ACCOUNTS_COLLECTION);
      const salesCol = collection(db, SALES_COLLECTION);
      const paymentDocRef = doc(db, PAYMENT_CONFIG_COLLECTION, PAYMENT_CONFIG_DOC);
      const confirmationsCol = collection(db, PAYMENT_CONFIRMATIONS_COLLECTION);

      if (this.unsubscribeFirestoreAccounts) this.unsubscribeFirestoreAccounts();
      if (this.unsubscribeFirestoreSales) this.unsubscribeFirestoreSales();
      if (this.unsubscribeFirestorePayment) this.unsubscribeFirestorePayment();
      if (this.unsubscribeFirestoreConfirmations) this.unsubscribeFirestoreConfirmations();

      // 1. Real-Time Accounts Listener (akun_toko_game)
      this.unsubscribeFirestoreAccounts = onSnapshot(
        accountsCol,
        (snapshot) => {
          this.isConnected = true;
          this.isInitialLoaded = true;
          this.currentMode = 'firebase';

          if (!snapshot.empty) {
            const remoteAccounts: GameAccount[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as GameAccount;
              if (data && data.id) {
                remoteAccounts.push(data);
              }
            });

            remoteAccounts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            this.currentAccounts = remoteAccounts;
            this.saveToLocalStorage(remoteAccounts, false);
            this.notifyListeners(remoteAccounts);
          } else {
            // Clean slate: 0 accounts in database
            this.currentAccounts = [];
            this.saveToLocalStorage([], false);
            this.notifyListeners([]);
          }

          this.notifyStatusListeners();
        },
        (error) => {
          console.warn('Firestore onSnapshot accounts error, running offline/cached:', error.message);
          this.currentMode = 'broadcast';
          this.isConnected = false;
          this.isInitialLoaded = true;
          this.notifyStatusListeners();
        }
      );

      // 2. Real-Time Sales Ledger Listener (catatan_penjualan)
      this.unsubscribeFirestoreSales = onSnapshot(
        salesCol,
        (snapshot) => {
          this.isConnected = true;
          this.currentMode = 'firebase';

          if (!snapshot.empty) {
            const remoteSales: SaleRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as SaleRecord;
              if (data && data.id) {
                remoteSales.push(data);
              }
            });

            remoteSales.sort((a, b) => (b.date || 0) - (a.date || 0));
            this.currentSales = remoteSales;
            this.saveSalesToLocalStorage(remoteSales, false);
            this.notifySalesListeners(remoteSales);
          } else {
            this.currentSales = [];
            this.saveSalesToLocalStorage([], false);
            this.notifySalesListeners([]);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot sales error, using cache:', error.message);
        }
      );

      // 3. Real-Time Payment Config Listener (pengaturan_pembayaran/utama)
      this.unsubscribeFirestorePayment = onSnapshot(
        paymentDocRef,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as PaymentConfig;
            const rawBanks =
              Array.isArray(data.bankAccounts) && data.bankAccounts.length > 0
                ? data.bankAccounts
                : data.seabank
                ? [
                    {
                      id: 'seabank',
                      bankName: 'SeaBank',
                      accountNumber: data.seabank.accountNumber || '901316745804',
                      accountHolder: data.seabank.accountName || 'DARMAN',
                      isActive: data.seabank.isActive ?? true,
                      category: 'bank' as const,
                    },
                  ]
                : DEFAULT_BANK_ACCOUNTS;

            this.currentPaymentConfig = {
              ...DEFAULT_PAYMENT_CONFIG,
              ...data,
              bankAccounts: rawBanks,
            };
            this.savePaymentConfigToLocalStorage(this.currentPaymentConfig, false);
            this.notifyPaymentListeners(this.currentPaymentConfig);
          } else {
            // First time bootstrap: save default config to Cloud Firestore
            try {
              await setDoc(paymentDocRef, DEFAULT_PAYMENT_CONFIG);
            } catch (err) {
              console.warn('Error saving initial payment config to cloud:', err);
            }
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot payment config error:', error.message);
        }
      );

      // 4. Real-Time Payment Confirmations Listener (konfirmasi_pembayaran)
      this.unsubscribeFirestoreConfirmations = onSnapshot(
        confirmationsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const items: PaymentConfirmation[] = [];
            snapshot.forEach((d) => {
              const conf = d.data() as PaymentConfirmation;
              if (conf && conf.id) items.push(conf);
            });
            items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            this.currentConfirmations = items;
            this.saveConfirmationsToLocalStorage(items, false);
            this.notifyConfirmationListeners(items);
          } else {
            this.currentConfirmations = [];
            this.notifyConfirmationListeners([]);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot payment confirmations error:', error.message);
        }
      );
    } catch (err) {
      console.warn('Failed to attach Firestore listeners, running offline cache:', err);
      this.currentMode = 'broadcast';
      this.isConnected = false;
      this.isInitialLoaded = true;
      this.notifyStatusListeners();
    }
  }

  public getSyncStatus(): {
    mode: SyncMode;
    label: string;
    active: boolean;
    accountsCount: number;
    salesCount: number;
  } {
    if (this.currentMode === 'firebase' || this.isConnected) {
      return {
        mode: 'firebase',
        label: 'Google Cloud Firestore Real-Time Active (Multi-Device Terhubung)',
        active: true,
        accountsCount: this.currentAccounts.length,
        salesCount: this.currentSales.length,
      };
    }
    return {
      mode: 'broadcast',
      label: 'Local & BroadcastChannel Real-Time (Fallback Offline)',
      active: true,
      accountsCount: this.currentAccounts.length,
      salesCount: this.currentSales.length,
    };
  }

  public subscribe(listener: AccountsListener): () => void {
    this.listeners.add(listener);
    listener([...this.currentAccounts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeSales(listener: SalesListener): () => void {
    this.salesListeners.add(listener);
    listener([...this.currentSales]);
    return () => {
      this.salesListeners.delete(listener);
    };
  }

  public subscribePaymentConfig(listener: PaymentConfigListener): () => void {
    this.paymentListeners.add(listener);
    listener({ ...this.currentPaymentConfig });
    return () => {
      this.paymentListeners.delete(listener);
    };
  }

  public subscribePaymentConfirmations(listener: PaymentConfirmationsListener): () => void {
    this.confirmationListeners.add(listener);
    listener([...this.currentConfirmations]);
    return () => {
      this.confirmationListeners.delete(listener);
    };
  }

  public subscribeSyncStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener({ isConnected: this.isConnected, isInitialLoaded: this.isInitialLoaded });
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach((listener) => {
      try {
        listener({ isConnected: this.isConnected, isInitialLoaded: this.isInitialLoaded });
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    });
  }

  private notifyListeners(accounts: GameAccount[]) {
    this.listeners.forEach((listener) => {
      try {
        listener([...accounts]);
      } catch (err) {
        console.error('Error in accounts listener:', err);
      }
    });
  }

  private notifySalesListeners(sales: SaleRecord[]) {
    this.salesListeners.forEach((listener) => {
      try {
        listener([...sales]);
      } catch (err) {
        console.error('Error in sales listener:', err);
      }
    });
  }

  private notifyPaymentListeners(config: PaymentConfig) {
    this.paymentListeners.forEach((listener) => {
      try {
        listener({ ...config });
      } catch (err) {
        console.error('Error in payment listener:', err);
      }
    });
  }

  private notifyConfirmationListeners(confirmations: PaymentConfirmation[]) {
    this.confirmationListeners.forEach((listener) => {
      try {
        listener([...confirmations]);
      } catch (err) {
        console.error('Error in confirmations listener:', err);
      }
    });
  }

  public getAccounts(): GameAccount[] {
    return [...this.currentAccounts];
  }

  public getSalesRecords(): SaleRecord[] {
    return [...this.currentSales];
  }

  public getPaymentConfig(): PaymentConfig {
    return { ...this.currentPaymentConfig };
  }

  public getPaymentConfirmations(): PaymentConfirmation[] {
    return [...this.currentConfirmations];
  }

  /**
   * Updates Payment configuration in Cloud Firestore and broadcasts to all clients.
   * Persists both to pengaturan_pembayaran and payment_settings collections.
   */
  public async updatePaymentConfig(partialConfig: Partial<PaymentConfig>): Promise<PaymentConfig> {
    const seabankActive =
      partialConfig.seabank_is_active ??
      partialConfig.seabank?.isActive ??
      this.currentPaymentConfig.seabank_is_active ??
      true;
    const seabankNumber =
      partialConfig.seabank_account_number ??
      partialConfig.seabank?.accountNumber ??
      this.currentPaymentConfig.seabank_account_number ??
      '901316745804';
    const seabankName =
      partialConfig.seabank_account_name ??
      partialConfig.seabank?.accountName ??
      this.currentPaymentConfig.seabank_account_name ??
      'PandirStore';

    const qrisActive =
      partialConfig.qris_is_active ??
      partialConfig.qris?.isActive ??
      this.currentPaymentConfig.qris_is_active ??
      true;
    const qrisName =
      partialConfig.qris_merchant_name ??
      partialConfig.qris?.merchantName ??
      this.currentPaymentConfig.qris_merchant_name ??
      'PandirStore';
    const qrisMax =
      partialConfig.qris_max_amount ??
      partialConfig.qris?.maxNominal ??
      this.currentPaymentConfig.qris_max_amount ??
      500000;
    const qrisImage =
      partialConfig.qris_image_url ??
      partialConfig.qris?.imageUrl ??
      this.currentPaymentConfig.qris_image_url ??
      this.currentPaymentConfig.qris.imageUrl ??
      '';

    const now = Date.now();

    // Strictly sanitize webhook fields (telegramBotToken, telegramChatId, fonnteToken, webhookUrl) to empty strings ""
    const rawBotToken = partialConfig.webhook?.telegramBotToken ?? this.currentPaymentConfig.webhook?.telegramBotToken ?? '';
    const rawChatId = partialConfig.webhook?.telegramChatId ?? this.currentPaymentConfig.webhook?.telegramChatId ?? '';
    const rawFonnte = partialConfig.webhook?.fonnteToken ?? this.currentPaymentConfig.webhook?.fonnteToken ?? '';
    const rawWebhookUrl = partialConfig.webhook?.webhookUrl ?? this.currentPaymentConfig.webhook?.webhookUrl ?? '';

    const sanitizedWebhook = {
      telegramBotToken: rawBotToken !== undefined && rawBotToken !== null ? String(rawBotToken).trim() : '',
      telegramChatId: rawChatId !== undefined && rawChatId !== null ? String(rawChatId).trim() : '',
      fonnteToken: rawFonnte !== undefined && rawFonnte !== null ? String(rawFonnte).trim() : '',
      webhookUrl: rawWebhookUrl !== undefined && rawWebhookUrl !== null ? String(rawWebhookUrl).trim() : '',
    };

    // Sanitize dynamic bank accounts with default holder DARMAN
    const rawBankAccounts =
      partialConfig.bankAccounts ??
      this.currentPaymentConfig.bankAccounts ??
      DEFAULT_BANK_ACCOUNTS;

    const sanitizedBankAccounts: BankAccount[] = rawBankAccounts.map((b, idx) => ({
      id: b.id || `bank-${idx}-${now}`,
      bankName: String(b.bankName || 'SeaBank').trim(),
      accountNumber: String(b.accountNumber || '').trim(),
      accountHolder: String(b.accountHolder || 'DARMAN').trim() || 'DARMAN',
      isActive: Boolean(b.isActive),
      category: b.category === 'ewallet' ? 'ewallet' : 'bank',
    }));

    const updated: PaymentConfig = {
      ...this.currentPaymentConfig,
      ...partialConfig,
      bankAccounts: sanitizedBankAccounts,
      seabank_account_number: seabankNumber,
      seabank_account_name: seabankName,
      seabank_is_active: seabankActive,
      qris_image_url: qrisImage,
      qris_merchant_name: qrisName,
      qris_max_amount: qrisMax,
      qris_is_active: qrisActive,
      updated_at: now,
      help_whatsapp:
        partialConfig.help_whatsapp ||
        partialConfig.helpWhatsApp ||
        this.currentPaymentConfig.helpWhatsApp ||
        '085717046895',
      webhook: sanitizedWebhook,
      seabank: {
        isActive: seabankActive,
        accountNumber: seabankNumber,
        accountName: seabankName,
      },
      qris: {
        isActive: qrisActive,
        merchantName: qrisName,
        maxNominal: qrisMax,
        imageUrl: qrisImage,
      },
      helpWhatsApp:
        partialConfig.helpWhatsApp ||
        partialConfig.help_whatsapp ||
        this.currentPaymentConfig.helpWhatsApp ||
        '085717046895',
      updatedAt: now,
    };

    // Deep sanitize function to strictly convert undefined values to empty strings or null
    const sanitizeForFirestore = (val: any): any => {
      if (val === undefined) return '';
      if (val === null) return null;
      if (Array.isArray(val)) return val.map((v) => sanitizeForFirestore(v));
      if (typeof val === 'object') {
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
          cleaned[k] = v === undefined ? '' : sanitizeForFirestore(v);
        }
        return cleaned;
      }
      return val;
    };

    const sanitizedPayload = sanitizeForFirestore(updated);

    this.currentPaymentConfig = updated;
    this.savePaymentConfigToLocalStorage(updated, true);
    this.notifyPaymentListeners(updated);

    try {
      const paymentDocRef = doc(db, PAYMENT_CONFIG_COLLECTION, PAYMENT_CONFIG_DOC);
      await setDoc(paymentDocRef, sanitizedPayload, { merge: true });
    } catch (e) {
      console.warn('Firestore setDoc on pengaturan_pembayaran notice:', e);
      handleFirestoreError(e, OperationType.UPDATE, `${PAYMENT_CONFIG_COLLECTION}/${PAYMENT_CONFIG_DOC}`);
      throw e;
    }

    try {
      const paymentSettingsDocRef = doc(db, 'payment_settings', PAYMENT_CONFIG_DOC);
      await setDoc(paymentSettingsDocRef, sanitizedPayload, { merge: true });
    } catch (e) {
      console.warn('Firestore setDoc on payment_settings notice:', e);
    }

    return updated;
  }

  /**
   * Records a payment confirmation / new transaction order from a buyer.
   * Enforces 3-digit unique code, base price, claimed amount, and order_id.
   */
  public async addPaymentConfirmation(
    data: Partial<PaymentConfirmation> & {
      sender_name?: string;
      senderName?: string;
    }
  ): Promise<PaymentConfirmation> {
    const now = Date.now();
    const orderId =
      data.order_id ||
      data.id ||
      `ORD-${now.toString().slice(-6)}`;

    const basePrice = data.base_price || data.amount || 0;
    const uniqueCode = data.unique_code ?? Math.floor(100 + Math.random() * 900);
    const totalAmount = data.total_amount || basePrice + uniqueCode;
    const claimedAmount = data.claimed_amount || data.amount || totalAmount;
    const sender = data.sender_name || data.senderName || 'Pembeli';
    const proofUrl = data.proof_of_payment_url || data.proofImageUrl || '';
    const productId = data.product_id || data.accountId || '';
    const productTitle = data.product_title || data.accountTitle || 'Akun Game';
    const game = data.game || 'MLBB';
    const paymentMethod = data.payment_method || 'QRIS';

    const newConfirmation: PaymentConfirmation = {
      order_id: orderId,
      product_id: productId,
      product_title: productTitle,
      game,
      base_price: basePrice,
      unique_code: uniqueCode,
      total_amount: totalAmount,
      claimed_amount: claimedAmount,
      proof_of_payment_url: proofUrl,
      sender_name: sender,
      buyer_whatsapp: data.buyer_whatsapp,
      payment_method: paymentMethod,
      status: (data.status as any) || 'PENDING',
      notes: data.notes || '',
      created_at: now,
      updated_at: now,
      // Compatibility aliases
      id: orderId,
      amount: claimedAmount,
      accountId: productId,
      accountTitle: productTitle,
      proofImageUrl: proofUrl,
      createdAt: now,
    };

    const updated = [newConfirmation, ...this.currentConfirmations.filter((c) => c.order_id !== orderId && c.id !== orderId)];
    this.currentConfirmations = updated;
    this.saveConfirmationsToLocalStorage(updated, true);
    this.notifyConfirmationListeners(updated);

    try {
      const confDocRef = doc(db, PAYMENT_CONFIRMATIONS_COLLECTION, orderId);
      const ordersDocRef = doc(db, 'orders', orderId);
      await Promise.all([
        setDoc(confDocRef, newConfirmation),
        setDoc(ordersDocRef, newConfirmation),
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${PAYMENT_CONFIRMATIONS_COLLECTION}/${orderId}`);
    }

    // Trigger instant webhook notification (Telegram bot or custom webhook) to seller
    this.triggerWebhookNotification(newConfirmation).catch(() => {});

    return newConfirmation;
  }

  /**
   * Updates payment confirmation / order status (e.g. PAID_APPROVED, REJECTED_UNDERPAID, CANCELLED)
   * When approved (PAID_APPROVED), automatically updates product in catalog to SOLD_OUT
   * and automatically records the sale to the sales ledger (buku penjualan/keuangan).
   */
  public async updatePaymentConfirmationStatus(
    idOrOrderId: string,
    status: PaymentConfirmation['status']
  ): Promise<void> {
    const target = this.currentConfirmations.find(
      (c) => c.id === idOrOrderId || c.order_id === idOrOrderId
    );
    if (!target) return;

    const key = target.order_id || target.id;
    const now = Date.now();
    const updated = this.currentConfirmations.map((c) => {
      if (c.order_id === key || c.id === key) {
        return {
          ...c,
          status,
          updated_at: now,
        };
      }
      return c;
    });

    this.currentConfirmations = updated;
    this.saveConfirmationsToLocalStorage(updated, true);
    this.notifyConfirmationListeners(updated);

    try {
      const confRef = doc(db, PAYMENT_CONFIRMATIONS_COLLECTION, key);
      const orderRef = doc(db, 'orders', key);
      await Promise.all([
        setDoc(confRef, { status, updated_at: now }, { merge: true }),
        setDoc(orderRef, { status, updated_at: now }, { merge: true }),
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${PAYMENT_CONFIRMATIONS_COLLECTION}/${key}`);
      throw e;
    }

    // Auto-actions when order is approved (PAID_APPROVED):
    if (status === 'PAID_APPROVED') {
      try {
        const prodId = target.product_id || target.accountId || '';
        const matchingAccount = this.currentAccounts.find(
          (a) =>
            a.id === prodId ||
            a.idLapak === prodId ||
            a.accountId === prodId ||
            (target.product_title && a.title.toLowerCase() === target.product_title.toLowerCase())
        );

        // 1. Automatically change account status to SOLD_OUT
        if (matchingAccount && matchingAccount.status !== 'SOLD_OUT') {
          await this.updateAccountStock(matchingAccount.id, 0, 'SOLD_OUT');
        } else if (!matchingAccount) {
          // If no matching catalog account found, record in Buku Penjualan directly
          const cost = Math.round((target.base_price || target.amount || 0) * 0.7);
          const selling = target.total_amount || target.amount || 0;
          await this.addSaleRecord({
            accountId: prodId || key,
            accountTitle: target.product_title || target.accountTitle || 'Akun Game',
            game: target.game || 'MLBB',
            sellingPrice: selling,
            costPrice: cost,
            profit: selling - cost,
            date: Date.now(),
            buyerNote: `Auto-recorded dari Pesanan ${key} (${target.payment_method}) - Pengirim: ${target.sender_name}`,
          });
        }
      } catch (postErr) {
        console.warn('Auto-approval side effects completed with warning:', postErr);
      }
    }
  }

  /**
   * Sends instant push notification to Telegram / Fonnte / Webhook when buyer confirms payment.
   */
  private async triggerWebhookNotification(conf: PaymentConfirmation) {
    const webhook = this.currentPaymentConfig.webhook;
    if (!webhook) return;

    const totalFormatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(conf.total_amount || conf.amount);

    const claimedFormatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(conf.claimed_amount || conf.amount);

    const messageText =
      `🔔 *NOTIFIKASI PESANAN PEMBAYARAN PANDIRSTORE*\n\n` +
      `📦 *ID Pesanan:* \`${conf.order_id || conf.id}\`\n` +
      `🎮 *Produk:* ${conf.product_title || conf.accountTitle} (${conf.game})\n` +
      `🏷️ *Total Tagihan Resmi:* ${totalFormatted} (Kode Unik: ${conf.unique_code || '-'})\n` +
      `💵 *Nominal Ditransfer:* ${claimedFormatted}\n` +
      `💳 *Metode Pembayaran:* ${conf.payment_method}\n` +
      `👤 *Nama Pengirim:* ${conf.sender_name}\n` +
      (conf.buyer_whatsapp ? `📱 *WhatsApp Pembeli:* ${conf.buyer_whatsapp}\n` : '') +
      `⏰ *Waktu:* ${new Date(conf.created_at || conf.createdAt).toLocaleString('id-ID')}\n\n` +
      `⚠️ _Silakan periksa mutasi di aplikasi ${
        conf.payment_method === 'QRIS' ? 'DANA/E-Wallet' : 'SeaBank'
      } Anda sekarang!_`;

    // 1. Telegram Bot Notification
    if (webhook.telegramBotToken && webhook.telegramChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${webhook.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: webhook.telegramChatId,
            text: messageText,
            parse_mode: 'Markdown',
          }),
        });
      } catch (err) {
        console.warn('Telegram webhook notification failed:', err);
      }
    }

    // 2. WhatsApp Fonnte Webhook API
    if (webhook.fonnteToken) {
      try {
        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: webhook.fonnteToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: this.currentPaymentConfig.helpWhatsApp || '085717046895',
            message: messageText.replace(/\*/g, '').replace(/`/g, ''),
          }),
        });
      } catch (err) {
        console.warn('Fonnte WhatsApp webhook failed:', err);
      }
    }

    // 3. Custom Webhook
    if (webhook.webhookUrl) {
      try {
        await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conf),
        });
      } catch (err) {
        console.warn('Custom webhook failed:', err);
      }
    }
  }

  /**
   * Adds a new game account to Firestore.
   */
  public async addAccount(newAccount: Omit<GameAccount, 'createdAt' | 'updatedAt'>): Promise<GameAccount> {
    const now = Date.now();
    const created: GameAccount = {
      ...newAccount,
      createdAt: now,
      updatedAt: now,
    };

    const updatedList = [created, ...this.currentAccounts.filter((a) => a.id !== created.id)];
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await setDoc(doc(db, ACCOUNTS_COLLECTION, created.id), created);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${ACCOUNTS_COLLECTION}/${created.id}`);
      throw e;
    }

    return created;
  }

  /**
   * Updates an existing account in Firestore.
   */
  public async updateAccount(account: GameAccount): Promise<GameAccount> {
    const updated: GameAccount = {
      ...account,
      updatedAt: Date.now(),
    };

    const updatedList = this.currentAccounts.map((a) => (a.id === updated.id ? updated : a));
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await setDoc(doc(db, ACCOUNTS_COLLECTION, updated.id), updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${ACCOUNTS_COLLECTION}/${updated.id}`);
      throw e;
    }

    return updated;
  }

  /**
   * Updates stock or changes status between READY and SOLD_OUT.
   */
  public async updateAccountStock(
    id: string,
    stock: number,
    status: GameAccount['status']
  ): Promise<GameAccount | null> {
    const target = this.currentAccounts.find((a) => a.id === id);
    if (!target) return null;

    if (status === 'SOLD_OUT' && target.status !== 'SOLD_OUT') {
      const cost = target.costPrice || Math.round(target.price * 0.7);
      await this.addSaleRecord({
        accountId: target.idLapak || target.accountId || target.id,
        accountTitle: target.title,
        game: target.game,
        sellingPrice: target.price,
        costPrice: cost,
        profit: target.price - cost,
        date: Date.now(),
        buyerNote: 'Status diubah ke Sold Out oleh Penjual',
      });
    }

    const updated: GameAccount = {
      ...target,
      stock,
      status,
      updatedAt: Date.now(),
    };

    return this.updateAccount(updated);
  }

  /**
   * Deletes an account from Firestore.
   */
  public async deleteAccount(id: string): Promise<boolean> {
    const updatedList = this.currentAccounts.filter((a) => a.id !== id);
    this.currentAccounts = updatedList;
    this.saveToLocalStorage(updatedList, false);
    this.notifyListeners(updatedList);

    try {
      await deleteDoc(doc(db, ACCOUNTS_COLLECTION, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${ACCOUNTS_COLLECTION}/${id}`);
      throw e;
    }

    return true;
  }

  /**
   * Adds a transaction record to Firestore 'catatan_penjualan'.
   */
  public async addSaleRecord(record: Omit<SaleRecord, 'id'>): Promise<SaleRecord> {
    const newRecord: SaleRecord = {
      ...record,
      id: `TRX-${Date.now().toString().slice(-6)}`,
    };

    const updated = [newRecord, ...this.currentSales.filter((s) => s.id !== newRecord.id)];
    this.currentSales = updated;
    this.saveSalesToLocalStorage(updated, false);
    this.notifySalesListeners(updated);

    try {
      await setDoc(doc(db, SALES_COLLECTION, newRecord.id), newRecord);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${SALES_COLLECTION}/${newRecord.id}`);
      throw e;
    }

    return newRecord;
  }

  /**
   * Deletes a sale record from Firestore.
   */
  public async deleteSaleRecord(id: string): Promise<boolean> {
    const updated = this.currentSales.filter((s) => s.id !== id);
    this.currentSales = updated;
    this.saveSalesToLocalStorage(updated, false);
    this.notifySalesListeners(updated);

    try {
      await deleteDoc(doc(db, SALES_COLLECTION, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${SALES_COLLECTION}/${id}`);
      throw e;
    }

    return true;
  }

  /**
   * Resets and purges all simulation/mock data across Firestore and localStorage.
   * Ensures an absolute clean slate (0 products, 0 sales, 0 order confirmations).
   */
  public async resetAllSimulationData(): Promise<void> {
    try {
      // 1. Delete all accounts from Firestore
      const accSnap = await getDocs(collection(db, ACCOUNTS_COLLECTION));
      if (!accSnap.empty) {
        const batch1 = writeBatch(db);
        accSnap.forEach((docSnap) => {
          batch1.delete(docSnap.ref);
        });
        await batch1.commit();
      }

      // 2. Delete all sales records from Firestore
      const salesSnap = await getDocs(collection(db, SALES_COLLECTION));
      if (!salesSnap.empty) {
        const batch2 = writeBatch(db);
        salesSnap.forEach((docSnap) => {
          batch2.delete(docSnap.ref);
        });
        await batch2.commit();
      }

      // 3. Delete all payment confirmations from Firestore
      const confSnap = await getDocs(collection(db, PAYMENT_CONFIRMATIONS_COLLECTION));
      if (!confSnap.empty) {
        const batch3 = writeBatch(db);
        confSnap.forEach((docSnap) => {
          batch3.delete(docSnap.ref);
        });
        await batch3.commit();
      }

      // Check legacy collections if present
      try {
        const ordSnap = await getDocs(collection(db, 'orders'));
        if (!ordSnap.empty) {
          const b = writeBatch(db);
          ordSnap.forEach((d) => b.delete(d.ref));
          await b.commit();
        }
      } catch (err) {}

      try {
        const trxSnap = await getDocs(collection(db, 'transactions'));
        if (!trxSnap.empty) {
          const b = writeBatch(db);
          trxSnap.forEach((d) => b.delete(d.ref));
          await b.commit();
        }
      } catch (err) {}
    } catch (e) {
      console.warn('Notice during cloud simulation data purge:', e);
    }

    // 4. Reset local memory & storage
    this.currentAccounts = [];
    this.currentSales = [];
    this.currentConfirmations = [];
    this.saveToLocalStorage([], true);
    this.saveSalesToLocalStorage([], true);
    this.saveConfirmationsToLocalStorage([], true);

    // 5. Broadcast clean state to all listeners
    this.notifyListeners([]);
    this.notifySalesListeners([]);
    this.notifyConfirmationListeners([]);
  }

  /**
   * Manually or automatically trigger full sync from local storage to cloud.
   */
  public async syncLocalToCloudNow(): Promise<{ accountsSynced: number; salesSynced: number }> {
    let accountsSynced = 0;
    let salesSynced = 0;

    try {
      if (this.currentAccounts.length > 0) {
        const batch = writeBatch(db);
        for (const acc of this.currentAccounts) {
          if (acc.id) {
            batch.set(doc(db, ACCOUNTS_COLLECTION, acc.id), acc, { merge: true });
            accountsSynced++;
          }
        }
        await batch.commit();
      }

      if (this.currentSales.length > 0) {
        const batchSales = writeBatch(db);
        for (const sale of this.currentSales) {
          if (sale.id) {
            batchSales.set(doc(db, SALES_COLLECTION, sale.id), sale, { merge: true });
            salesSynced++;
          }
        }
        await batchSales.commit();
      }
    } catch (e) {
      console.error('Error during manual syncLocalToCloudNow:', e);
      throw e;
    }

    return { accountsSynced, salesSynced };
  }
}

export const realtimeSync = new RealtimeSyncService();
