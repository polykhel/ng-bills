/**
 * Minimal IndexedDB wrapper
 * Provides generic CRUD operations for any object store
 */

const DB_NAME = 'ng-bills';
const DB_VERSION = 5;

export const STORES = {
  PROFILES: 'profiles',
  CARDS: 'cards',
  STATEMENTS: 'statements',
  INSTALLMENTS: 'installments',
  // CASH_INSTALLMENTS removed in Phase 2 - migrated to recurring transactions
  BANK_BALANCES: 'bankBalances',
  BANK_ACCOUNTS: 'bankAccounts',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
  BUDGETS: 'budgets',
  SAVINGS_GOALS: 'savingsGoals',
  PLANNED_PURCHASES: 'plannedPurchases',
  LOAN_PLANS: 'loanPlans',
} as const;

export class IndexedDB {
  private db: IDBDatabase | null = null;
  private ready = false;

  async init(): Promise<void> {
    if (this.ready) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.ready = true;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create Profiles store
        if (!db.objectStoreNames.contains(STORES.PROFILES)) {
          db.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
        }

        // Create Cards store with indexes
        if (!db.objectStoreNames.contains(STORES.CARDS)) {
          const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' });
          cardStore.createIndex('profileId', 'profileId', { unique: false });
        }

        // Create Statements store with indexes
        if (!db.objectStoreNames.contains(STORES.STATEMENTS)) {
          const statementStore = db.createObjectStore(STORES.STATEMENTS, { keyPath: 'id' });
          statementStore.createIndex('cardId', 'cardId', { unique: false });
          statementStore.createIndex('monthStr', 'monthStr', { unique: false });
          statementStore.createIndex('cardMonth', ['cardId', 'monthStr'], { unique: false });
        }

        // Create Installments store with indexes
        if (!db.objectStoreNames.contains(STORES.INSTALLMENTS)) {
          const installmentStore = db.createObjectStore(STORES.INSTALLMENTS, { keyPath: 'id' });
          installmentStore.createIndex('cardId', 'cardId', { unique: false });
        }

        // CASH_INSTALLMENTS store removed in Phase 2 - migrated to recurring transactions
        // If store exists from old version, it will remain but won't be used

        // Create Bank Balances store with indexes
        if (!db.objectStoreNames.contains(STORES.BANK_BALANCES)) {
          const balanceStore = db.createObjectStore(STORES.BANK_BALANCES, { keyPath: 'id' });
          balanceStore.createIndex('profileId', 'profileId', { unique: false });
          balanceStore.createIndex('profileMonth', ['profileId', 'monthStr'], { unique: false });
        }

        // Create Bank Accounts store with indexes
        if (!db.objectStoreNames.contains(STORES.BANK_ACCOUNTS)) {
          const bankAccountStore = db.createObjectStore(STORES.BANK_ACCOUNTS, { keyPath: 'id' });
          bankAccountStore.createIndex('profileId', 'profileId', { unique: false });
        }

        // Create Transactions store with indexes
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const transactionStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
          transactionStore.createIndex('profileId', 'profileId', { unique: false });
          transactionStore.createIndex('cardId', 'cardId', { unique: false });
          transactionStore.createIndex('bankId', 'bankId', { unique: false });
          transactionStore.createIndex('fromBankId', 'fromBankId', { unique: false });
          transactionStore.createIndex('toBankId', 'toBankId', { unique: false });
          transactionStore.createIndex('date', 'date', { unique: false });
        }

        // Create Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        }

        // Create Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // Create Budgets store with indexes
        if (!db.objectStoreNames.contains(STORES.BUDGETS)) {
          const budgetStore = db.createObjectStore(STORES.BUDGETS, { keyPath: 'id' });
          budgetStore.createIndex('profileId', 'profileId', { unique: false });
          budgetStore.createIndex('period', 'period', { unique: false });
          budgetStore.createIndex('startDate', 'startDate', { unique: false });
        }

        // Create Savings Goals store with indexes
        if (!db.objectStoreNames.contains(STORES.SAVINGS_GOALS)) {
          const goalStore = db.createObjectStore(STORES.SAVINGS_GOALS, { keyPath: 'id' });
          goalStore.createIndex('profileId', 'profileId', { unique: false });
          goalStore.createIndex('priority', 'priority', { unique: false });
        }

        // Create Planned Purchases store with indexes
        if (!db.objectStoreNames.contains(STORES.PLANNED_PURCHASES)) {
          const purchaseStore = db.createObjectStore(STORES.PLANNED_PURCHASES, { keyPath: 'id' });
          purchaseStore.createIndex('profileId', 'profileId', { unique: false });
          purchaseStore.createIndex('priority', 'priority', { unique: false });
          purchaseStore.createIndex('isPurchased', 'isPurchased', { unique: false });
          purchaseStore.createIndex('targetDate', 'targetDate', { unique: false });
        }

        // Create Loan Plans store with indexes
        if (!db.objectStoreNames.contains(STORES.LOAN_PLANS)) {
          const loanStore = db.createObjectStore(STORES.LOAN_PLANS, { keyPath: 'id' });
          loanStore.createIndex('profileId', 'profileId', { unique: false });
          loanStore.createIndex('type', 'type', { unique: false });
          loanStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  isReady(): boolean {
    return this.ready && this.db !== null;
  }

  // Generic CRUD operations
  async getAll<T>(storeName: string): Promise<T[]> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putAll<T>(storeName: string, data: T[]): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      // Clear existing data first
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        // Add all new data
        let completed = 0;
        let hasError = false;

        if (data.length === 0) {
          resolve();
          return;
        }

        data.forEach((item) => {
          if (hasError) return;

          const putRequest = store.put(item);

          putRequest.onsuccess = () => {
            completed++;
            if (completed === data.length) {
              resolve();
            }
          };

          putRequest.onerror = () => {
            hasError = true;
            reject(putRequest.error);
          };
        });
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  async getStorageInfo(): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;

      return {
        used,
        available,
        percentage: available > 0 ? (used / available) * 100 : 0,
      };
    } catch (e) {
      console.error('Error getting storage info:', e);
      return null;
    }
  }

  async exportAll(): Promise<string> {
    const data: Record<string, any> = {};

    for (const [key, storeName] of Object.entries(STORES)) {
      try {
        data[key.toLowerCase()] = await this.getAll(storeName);
      } catch (e) {
        console.warn(`Failed to export ${storeName}:`, e);
        data[key.toLowerCase()] = [];
      }
    }

    return JSON.stringify(data, null, 2);
  }

  async importAll(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      for (const [key, storeName] of Object.entries(STORES)) {
        const lowerKey = key.toLowerCase();
        if (data[lowerKey] && Array.isArray(data[lowerKey])) {
          await this.putAll(storeName, data[lowerKey]);
        }
      }
    } catch (e) {
      throw new Error(`Failed to import data: ${e}`);
    }
  }

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }
  }
}
