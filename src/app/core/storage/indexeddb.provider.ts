/**
 * IndexedDBProvider
 * 
 * High-performance storage using IndexedDB.
 * Provides 50MB+ storage capacity with indexed queries for fast lookups.
 * Ideal for handling large datasets (thousands of transactions).
 */

import type {
  BankBalance,
  CashInstallment,
  CreditCard,
  Installment,
  Profile,
  Statement
} from '@shared/types';
import type { StorageProvider } from './storage-provider.interface';

const DB_NAME = 'ng-bills';
const DB_VERSION = 1;

// Object store names
const STORES = {
  PROFILES: 'profiles',
  CARDS: 'cards',
  STATEMENTS: 'statements',
  INSTALLMENTS: 'installments',
  CASH_INSTALLMENTS: 'cashInstallments',
  BANK_BALANCES: 'bankBalances',
  SETTINGS: 'settings',
};

// Settings keys
const SETTING_KEYS = {
  ACTIVE_PROFILE_ID: 'activeProfileId',
  ACTIVE_MONTH: 'activeMonth',
  MULTI_PROFILE_MODE: 'multiProfileMode',
  SELECTED_PROFILE_IDS: 'selectedProfileIds',
  BANK_BALANCE_TRACKING_ENABLED: 'bankBalanceTrackingEnabled',
  COLUMN_LAYOUTS: 'columnLayouts',
};

export class IndexedDBProvider implements StorageProvider {
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

        // Create Cash Installments store with indexes
        if (!db.objectStoreNames.contains(STORES.CASH_INSTALLMENTS)) {
          const cashInstStore = db.createObjectStore(STORES.CASH_INSTALLMENTS, { keyPath: 'id' });
          cashInstStore.createIndex('cardId', 'cardId', { unique: false });
          cashInstStore.createIndex('installmentId', 'installmentId', { unique: false });
        }

        // Create Bank Balances store with indexes
        if (!db.objectStoreNames.contains(STORES.BANK_BALANCES)) {
          const balanceStore = db.createObjectStore(STORES.BANK_BALANCES, { keyPath: 'id' });
          balanceStore.createIndex('profileId', 'profileId', { unique: false });
          balanceStore.createIndex('profileMonth', ['profileId', 'monthStr'], { unique: false });
        }

        // Create Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  isReady(): boolean {
    return this.ready && this.db !== null;
  }

  getProviderName(): string {
    return 'IndexedDB';
  }

  // ==================== Helper Methods ====================

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async get<T>(storeName: string, key: string): Promise<T | null> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async put<T>(storeName: string, data: T): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async delete(storeName: string, key: string): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async clear(storeName: string): Promise<void> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async putAll<T>(storeName: string, data: T[]): Promise<void> {
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

        data.forEach(item => {
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

  private async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: any
  ): Promise<T[]> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Profile Operations ====================

  async getProfiles(): Promise<Profile[]> {
    return this.getAll<Profile>(STORES.PROFILES);
  }

  async saveProfiles(profiles: Profile[]): Promise<void> {
    return this.putAll(STORES.PROFILES, profiles);
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.get<Profile>(STORES.PROFILES, id);
  }

  async saveProfile(profile: Profile): Promise<void> {
    return this.put(STORES.PROFILES, profile);
  }

  async deleteProfile(id: string): Promise<void> {
    return this.delete(STORES.PROFILES, id);
  }

  // ==================== Credit Card Operations ====================

  async getCards(): Promise<CreditCard[]> {
    return this.getAll<CreditCard>(STORES.CARDS);
  }

  async saveCards(cards: CreditCard[]): Promise<void> {
    return this.putAll(STORES.CARDS, cards);
  }

  async getCard(id: string): Promise<CreditCard | null> {
    return this.get<CreditCard>(STORES.CARDS, id);
  }

  async saveCard(card: CreditCard): Promise<void> {
    return this.put(STORES.CARDS, card);
  }

  async deleteCard(id: string): Promise<void> {
    return this.delete(STORES.CARDS, id);
  }

  async getCardsByProfile(profileId: string): Promise<CreditCard[]> {
    return this.getByIndex<CreditCard>(STORES.CARDS, 'profileId', profileId);
  }

  // ==================== Statement Operations ====================

  async getStatements(): Promise<Statement[]> {
    return this.getAll<Statement>(STORES.STATEMENTS);
  }

  async saveStatements(statements: Statement[]): Promise<void> {
    return this.putAll(STORES.STATEMENTS, statements);
  }

  async getStatement(id: string): Promise<Statement | null> {
    return this.get<Statement>(STORES.STATEMENTS, id);
  }

  async saveStatement(statement: Statement): Promise<void> {
    return this.put(STORES.STATEMENTS, statement);
  }

  async deleteStatement(id: string): Promise<void> {
    return this.delete(STORES.STATEMENTS, id);
  }

  async getStatementsByCard(cardId: string): Promise<Statement[]> {
    return this.getByIndex<Statement>(STORES.STATEMENTS, 'cardId', cardId);
  }

  async getStatementsByMonth(monthStr: string): Promise<Statement[]> {
    return this.getByIndex<Statement>(STORES.STATEMENTS, 'monthStr', monthStr);
  }

  // ==================== Installment Operations ====================

  async getInstallments(): Promise<Installment[]> {
    return this.getAll<Installment>(STORES.INSTALLMENTS);
  }

  async saveInstallments(installments: Installment[]): Promise<void> {
    return this.putAll(STORES.INSTALLMENTS, installments);
  }

  async getInstallment(id: string): Promise<Installment | null> {
    return this.get<Installment>(STORES.INSTALLMENTS, id);
  }

  async saveInstallment(installment: Installment): Promise<void> {
    return this.put(STORES.INSTALLMENTS, installment);
  }

  async deleteInstallment(id: string): Promise<void> {
    return this.delete(STORES.INSTALLMENTS, id);
  }

  async getInstallmentsByCard(cardId: string): Promise<Installment[]> {
    return this.getByIndex<Installment>(STORES.INSTALLMENTS, 'cardId', cardId);
  }

  // ==================== Cash Installment Operations ====================

  async getCashInstallments(): Promise<CashInstallment[]> {
    return this.getAll<CashInstallment>(STORES.CASH_INSTALLMENTS);
  }

  async saveCashInstallments(cashInstallments: CashInstallment[]): Promise<void> {
    return this.putAll(STORES.CASH_INSTALLMENTS, cashInstallments);
  }

  async getCashInstallment(id: string): Promise<CashInstallment | null> {
    return this.get<CashInstallment>(STORES.CASH_INSTALLMENTS, id);
  }

  async saveCashInstallment(cashInstallment: CashInstallment): Promise<void> {
    return this.put(STORES.CASH_INSTALLMENTS, cashInstallment);
  }

  async deleteCashInstallment(id: string): Promise<void> {
    return this.delete(STORES.CASH_INSTALLMENTS, id);
  }

  async getCashInstallmentsByCard(cardId: string): Promise<CashInstallment[]> {
    return this.getByIndex<CashInstallment>(STORES.CASH_INSTALLMENTS, 'cardId', cardId);
  }

  async getCashInstallmentsByInstallment(installmentId: string): Promise<CashInstallment[]> {
    return this.getByIndex<CashInstallment>(STORES.CASH_INSTALLMENTS, 'installmentId', installmentId);
  }

  // ==================== Bank Balance Operations ====================

  async getBankBalances(): Promise<BankBalance[]> {
    return this.getAll<BankBalance>(STORES.BANK_BALANCES);
  }

  async saveBankBalances(balances: BankBalance[]): Promise<void> {
    return this.putAll(STORES.BANK_BALANCES, balances);
  }

  async getBankBalance(id: string): Promise<BankBalance | null> {
    return this.get<BankBalance>(STORES.BANK_BALANCES, id);
  }

  async saveBankBalance(balance: BankBalance): Promise<void> {
    return this.put(STORES.BANK_BALANCES, balance);
  }

  async deleteBankBalance(id: string): Promise<void> {
    return this.delete(STORES.BANK_BALANCES, id);
  }

  async getBankBalancesByProfile(profileId: string): Promise<BankBalance[]> {
    return this.getByIndex<BankBalance>(STORES.BANK_BALANCES, 'profileId', profileId);
  }

  async getBankBalanceByMonth(profileId: string, monthStr: string): Promise<BankBalance | null> {
    this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.BANK_BALANCES, 'readonly');
      const store = transaction.objectStore(STORES.BANK_BALANCES);
      const index = store.index('profileMonth');
      const request = index.get([profileId, monthStr]);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Application Settings ====================

  private async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const result = await this.get<{ key: string; value: T }>(STORES.SETTINGS, key);
    return result ? result.value : defaultValue;
  }

  private async saveSetting<T>(key: string, value: T): Promise<void> {
    return this.put(STORES.SETTINGS, { key, value });
  }

  async getActiveProfileId(): Promise<string | null> {
    return this.getSetting<string | null>(SETTING_KEYS.ACTIVE_PROFILE_ID, null);
  }

  async saveActiveProfileId(id: string): Promise<void> {
    return this.saveSetting(SETTING_KEYS.ACTIVE_PROFILE_ID, id);
  }

  async getActiveMonthStr(): Promise<string | null> {
    return this.getSetting<string | null>(SETTING_KEYS.ACTIVE_MONTH, null);
  }

  async saveActiveMonthStr(monthStr: string): Promise<void> {
    return this.saveSetting(SETTING_KEYS.ACTIVE_MONTH, monthStr);
  }

  async getMultiProfileMode(): Promise<boolean> {
    return this.getSetting<boolean>(SETTING_KEYS.MULTI_PROFILE_MODE, false);
  }

  async saveMultiProfileMode(enabled: boolean): Promise<void> {
    return this.saveSetting(SETTING_KEYS.MULTI_PROFILE_MODE, enabled);
  }

  async getSelectedProfileIds(): Promise<string[]> {
    return this.getSetting<string[]>(SETTING_KEYS.SELECTED_PROFILE_IDS, []);
  }

  async saveSelectedProfileIds(ids: string[]): Promise<void> {
    return this.saveSetting(SETTING_KEYS.SELECTED_PROFILE_IDS, ids);
  }

  async getBankBalanceTrackingEnabled(): Promise<boolean> {
    return this.getSetting<boolean>(SETTING_KEYS.BANK_BALANCE_TRACKING_ENABLED, false);
  }

  async saveBankBalanceTrackingEnabled(enabled: boolean): Promise<void> {
    return this.saveSetting(SETTING_KEYS.BANK_BALANCE_TRACKING_ENABLED, enabled);
  }

  async getColumnLayouts(): Promise<Record<string, Record<string, any>>> {
    return this.getSetting<Record<string, Record<string, any>>>(SETTING_KEYS.COLUMN_LAYOUTS, {});
  }

  async saveColumnLayouts(layouts: Record<string, Record<string, any>>): Promise<void> {
    return this.saveSetting(SETTING_KEYS.COLUMN_LAYOUTS, layouts);
  }

  async getColumnLayout(profileId: string, tableId: string): Promise<any> {
    const allLayouts = await this.getColumnLayouts();
    return allLayouts[profileId]?.[tableId] ?? null;
  }

  async saveColumnLayout(profileId: string, tableId: string, layout: any): Promise<void> {
    const allLayouts = await this.getColumnLayouts();
    const profileLayouts = allLayouts[profileId] ?? {};
    profileLayouts[tableId] = layout;
    await this.saveColumnLayouts({ ...allLayouts, [profileId]: profileLayouts });
  }

  // ==================== Utility Operations ====================

  async clearAll(): Promise<void> {
    this.ensureReady();
    
    const stores = [
      STORES.PROFILES,
      STORES.CARDS,
      STORES.STATEMENTS,
      STORES.INSTALLMENTS,
      STORES.CASH_INSTALLMENTS,
      STORES.BANK_BALANCES,
      STORES.SETTINGS,
    ];

    for (const store of stores) {
      await this.clear(store);
    }
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
        percentage: available > 0 ? (used / available) * 100 : 0
      };
    } catch (e) {
      console.error('Error getting storage info:', e);
      return null;
    }
  }

  async exportData(): Promise<string> {
    const data = {
      profiles: await this.getProfiles(),
      cards: await this.getCards(),
      statements: await this.getStatements(),
      installments: await this.getInstallments(),
      cashInstallments: await this.getCashInstallments(),
      bankBalances: await this.getBankBalances(),
      settings: {
        activeProfileId: await this.getActiveProfileId(),
        activeMonthStr: await this.getActiveMonthStr(),
        multiProfileMode: await this.getMultiProfileMode(),
        selectedProfileIds: await this.getSelectedProfileIds(),
        bankBalanceTrackingEnabled: await this.getBankBalanceTrackingEnabled(),
        columnLayouts: await this.getColumnLayouts()
      }
    };

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      // Import all data
      if (data.profiles) await this.saveProfiles(data.profiles);
      if (data.cards) await this.saveCards(data.cards);
      if (data.statements) await this.saveStatements(data.statements);
      if (data.installments) await this.saveInstallments(data.installments);
      if (data.cashInstallments) await this.saveCashInstallments(data.cashInstallments);
      if (data.bankBalances) await this.saveBankBalances(data.bankBalances);

      // Import settings
      if (data.settings) {
        if (data.settings.activeProfileId) {
          await this.saveActiveProfileId(data.settings.activeProfileId);
        }
        if (data.settings.activeMonthStr) {
          await this.saveActiveMonthStr(data.settings.activeMonthStr);
        }
        if (data.settings.multiProfileMode !== undefined) {
          await this.saveMultiProfileMode(data.settings.multiProfileMode);
        }
        if (data.settings.selectedProfileIds) {
          await this.saveSelectedProfileIds(data.settings.selectedProfileIds);
        }
        if (data.settings.bankBalanceTrackingEnabled !== undefined) {
          await this.saveBankBalanceTrackingEnabled(data.settings.bankBalanceTrackingEnabled);
        }
        if (data.settings.columnLayouts) {
          await this.saveColumnLayouts(data.settings.columnLayouts);
        }
      }
    } catch (e) {
      throw new Error(`Failed to import data: ${e}`);
    }
  }
}
