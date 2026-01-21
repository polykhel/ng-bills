/**
 * LocalStorageProvider
 * 
 * Wraps the existing LocalStorage implementation to conform to the StorageProvider interface.
 * This provides backwards compatibility while enabling migration to IndexedDB.
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

const KEYS = {
  PROFILES: 'bt_profiles',
  CARDS: 'bt_cards',
  STATEMENTS: 'bt_statements',
  INSTALLMENTS: 'bt_installments',
  CASH_INSTALLMENTS: 'bt_cash_installments',
  BANK_BALANCES: 'bt_bank_balances',
  BANK_BALANCE_TRACKING_ENABLED: 'bt_bank_balance_tracking_enabled',
  ACTIVE_PROFILE_ID: 'bt_active_profile_id',
  ACTIVE_MONTH: 'bt_active_month',
  MULTI_PROFILE_MODE: 'bt_multi_profile_mode',
  SELECTED_PROFILE_IDS: 'bt_selected_profile_ids',
  COLUMN_LAYOUTS: 'bt_column_layouts',
};

// Helper functions for LocalStorage operations
const loadJSON = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch (e) {
    console.error('Error loading JSON from key:', key, e);
    return fallback;
  }
};

const saveJSON = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving JSON to key:', key, e);
  }
};

const loadData = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Error loading data from key:', key, e);
    return [];
  }
};

const saveData = <T>(key: string, data: T[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

const loadString = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Error loading string from key:', key, e);
    return null;
  }
};

const saveString = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving string to key:', key, e);
  }
};

const loadBoolean = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : false;
  } catch (e) {
    console.error('Error loading boolean from key:', key, e);
    return false;
  }
};

const saveBoolean = (key: string, value: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving boolean to key:', key, e);
  }
};

const loadStringArray = (key: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Error loading string array from key:', key, e);
    return [];
  }
};

const saveStringArray = (key: string, value: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving string array to key:', key, e);
  }
};

export class LocalStorageProvider implements StorageProvider {
  private ready = false;

  async init(): Promise<void> {
    // LocalStorage is synchronous and always available in browser
    this.ready = typeof window !== 'undefined' && !!window.localStorage;
  }

  isReady(): boolean {
    return this.ready;
  }

  getProviderName(): string {
    return 'LocalStorage';
  }

  // ==================== Profile Operations ====================
  
  async getProfiles(): Promise<Profile[]> {
    return loadData<Profile>(KEYS.PROFILES);
  }

  async saveProfiles(profiles: Profile[]): Promise<void> {
    saveData(KEYS.PROFILES, profiles);
  }

  async getProfile(id: string): Promise<Profile | null> {
    const profiles = await this.getProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  async saveProfile(profile: Profile): Promise<void> {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.push(profile);
    }
    await this.saveProfiles(profiles);
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = await this.getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    await this.saveProfiles(filtered);
  }

  // ==================== Credit Card Operations ====================
  
  async getCards(): Promise<CreditCard[]> {
    return loadData<CreditCard>(KEYS.CARDS);
  }

  async saveCards(cards: CreditCard[]): Promise<void> {
    saveData(KEYS.CARDS, cards);
  }

  async getCard(id: string): Promise<CreditCard | null> {
    const cards = await this.getCards();
    return cards.find(c => c.id === id) || null;
  }

  async saveCard(card: CreditCard): Promise<void> {
    const cards = await this.getCards();
    const index = cards.findIndex(c => c.id === card.id);
    if (index >= 0) {
      cards[index] = card;
    } else {
      cards.push(card);
    }
    await this.saveCards(cards);
  }

  async deleteCard(id: string): Promise<void> {
    const cards = await this.getCards();
    const filtered = cards.filter(c => c.id !== id);
    await this.saveCards(filtered);
  }

  async getCardsByProfile(profileId: string): Promise<CreditCard[]> {
    const cards = await this.getCards();
    return cards.filter(c => c.profileId === profileId);
  }

  // ==================== Statement Operations ====================
  
  async getStatements(): Promise<Statement[]> {
    return loadData<Statement>(KEYS.STATEMENTS);
  }

  async saveStatements(statements: Statement[]): Promise<void> {
    saveData(KEYS.STATEMENTS, statements);
  }

  async getStatement(id: string): Promise<Statement | null> {
    const statements = await this.getStatements();
    return statements.find(s => s.id === id) || null;
  }

  async saveStatement(statement: Statement): Promise<void> {
    const statements = await this.getStatements();
    const index = statements.findIndex(s => s.id === statement.id);
    if (index >= 0) {
      statements[index] = statement;
    } else {
      statements.push(statement);
    }
    await this.saveStatements(statements);
  }

  async deleteStatement(id: string): Promise<void> {
    const statements = await this.getStatements();
    const filtered = statements.filter(s => s.id !== id);
    await this.saveStatements(filtered);
  }

  async getStatementsByCard(cardId: string): Promise<Statement[]> {
    const statements = await this.getStatements();
    return statements.filter(s => s.cardId === cardId);
  }

  async getStatementsByMonth(monthStr: string): Promise<Statement[]> {
    const statements = await this.getStatements();
    return statements.filter(s => s.monthStr === monthStr);
  }

  // ==================== Installment Operations ====================
  
  async getInstallments(): Promise<Installment[]> {
    return loadData<Installment>(KEYS.INSTALLMENTS);
  }

  async saveInstallments(installments: Installment[]): Promise<void> {
    saveData(KEYS.INSTALLMENTS, installments);
  }

  async getInstallment(id: string): Promise<Installment | null> {
    const installments = await this.getInstallments();
    return installments.find(i => i.id === id) || null;
  }

  async saveInstallment(installment: Installment): Promise<void> {
    const installments = await this.getInstallments();
    const index = installments.findIndex(i => i.id === installment.id);
    if (index >= 0) {
      installments[index] = installment;
    } else {
      installments.push(installment);
    }
    await this.saveInstallments(installments);
  }

  async deleteInstallment(id: string): Promise<void> {
    const installments = await this.getInstallments();
    const filtered = installments.filter(i => i.id !== id);
    await this.saveInstallments(filtered);
  }

  async getInstallmentsByCard(cardId: string): Promise<Installment[]> {
    const installments = await this.getInstallments();
    return installments.filter(i => i.cardId === cardId);
  }

  // ==================== Cash Installment Operations ====================
  
  async getCashInstallments(): Promise<CashInstallment[]> {
    return loadData<CashInstallment>(KEYS.CASH_INSTALLMENTS);
  }

  async saveCashInstallments(cashInstallments: CashInstallment[]): Promise<void> {
    saveData(KEYS.CASH_INSTALLMENTS, cashInstallments);
  }

  async getCashInstallment(id: string): Promise<CashInstallment | null> {
    const cashInstallments = await this.getCashInstallments();
    return cashInstallments.find(ci => ci.id === id) || null;
  }

  async saveCashInstallment(cashInstallment: CashInstallment): Promise<void> {
    const cashInstallments = await this.getCashInstallments();
    const index = cashInstallments.findIndex(ci => ci.id === cashInstallment.id);
    if (index >= 0) {
      cashInstallments[index] = cashInstallment;
    } else {
      cashInstallments.push(cashInstallment);
    }
    await this.saveCashInstallments(cashInstallments);
  }

  async deleteCashInstallment(id: string): Promise<void> {
    const cashInstallments = await this.getCashInstallments();
    const filtered = cashInstallments.filter(ci => ci.id !== id);
    await this.saveCashInstallments(filtered);
  }

  async getCashInstallmentsByCard(cardId: string): Promise<CashInstallment[]> {
    const cashInstallments = await this.getCashInstallments();
    return cashInstallments.filter(ci => ci.cardId === cardId);
  }

  async getCashInstallmentsByInstallment(installmentId: string): Promise<CashInstallment[]> {
    const cashInstallments = await this.getCashInstallments();
    return cashInstallments.filter(ci => ci.installmentId === installmentId);
  }

  // ==================== Bank Balance Operations ====================
  
  async getBankBalances(): Promise<BankBalance[]> {
    return loadData<BankBalance>(KEYS.BANK_BALANCES);
  }

  async saveBankBalances(balances: BankBalance[]): Promise<void> {
    saveData(KEYS.BANK_BALANCES, balances);
  }

  async getBankBalance(id: string): Promise<BankBalance | null> {
    const balances = await this.getBankBalances();
    return balances.find(b => b.id === id) || null;
  }

  async saveBankBalance(balance: BankBalance): Promise<void> {
    const balances = await this.getBankBalances();
    const index = balances.findIndex(b => b.id === balance.id);
    if (index >= 0) {
      balances[index] = balance;
    } else {
      balances.push(balance);
    }
    await this.saveBankBalances(balances);
  }

  async deleteBankBalance(id: string): Promise<void> {
    const balances = await this.getBankBalances();
    const filtered = balances.filter(b => b.id !== id);
    await this.saveBankBalances(filtered);
  }

  async getBankBalancesByProfile(profileId: string): Promise<BankBalance[]> {
    const balances = await this.getBankBalances();
    return balances.filter(b => b.profileId === profileId);
  }

  async getBankBalanceByMonth(profileId: string, monthStr: string): Promise<BankBalance | null> {
    const balances = await this.getBankBalances();
    return balances.find(b => b.profileId === profileId && b.monthStr === monthStr) || null;
  }

  // ==================== Application Settings ====================
  
  async getActiveProfileId(): Promise<string | null> {
    return loadString(KEYS.ACTIVE_PROFILE_ID);
  }

  async saveActiveProfileId(id: string): Promise<void> {
    saveString(KEYS.ACTIVE_PROFILE_ID, id);
  }

  async getActiveMonthStr(): Promise<string | null> {
    return loadString(KEYS.ACTIVE_MONTH);
  }

  async saveActiveMonthStr(monthStr: string): Promise<void> {
    saveString(KEYS.ACTIVE_MONTH, monthStr);
  }

  async getMultiProfileMode(): Promise<boolean> {
    return loadBoolean(KEYS.MULTI_PROFILE_MODE);
  }

  async saveMultiProfileMode(enabled: boolean): Promise<void> {
    saveBoolean(KEYS.MULTI_PROFILE_MODE, enabled);
  }

  async getSelectedProfileIds(): Promise<string[]> {
    return loadStringArray(KEYS.SELECTED_PROFILE_IDS);
  }

  async saveSelectedProfileIds(ids: string[]): Promise<void> {
    saveStringArray(KEYS.SELECTED_PROFILE_IDS, ids);
  }

  async getBankBalanceTrackingEnabled(): Promise<boolean> {
    return loadBoolean(KEYS.BANK_BALANCE_TRACKING_ENABLED);
  }

  async saveBankBalanceTrackingEnabled(enabled: boolean): Promise<void> {
    saveBoolean(KEYS.BANK_BALANCE_TRACKING_ENABLED, enabled);
  }

  async getColumnLayouts(): Promise<Record<string, Record<string, any>>> {
    return loadJSON<Record<string, Record<string, any>>>(KEYS.COLUMN_LAYOUTS, {});
  }

  async saveColumnLayouts(layouts: Record<string, Record<string, any>>): Promise<void> {
    saveJSON(KEYS.COLUMN_LAYOUTS, layouts);
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
    if (typeof window === 'undefined') return;
    
    // Clear only our app's keys
    Object.values(KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  async getStorageInfo(): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null> {
    if (typeof window === 'undefined') return null;

    try {
      // Estimate localStorage usage
      let totalSize = 0;
      Object.values(KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length + key.length;
        }
      });

      // LocalStorage limit is typically 5-10MB
      const limit = 5 * 1024 * 1024; // 5MB conservative estimate
      
      return {
        used: totalSize,
        available: limit - totalSize,
        percentage: (totalSize / limit) * 100
      };
    } catch (e) {
      console.error('Error calculating storage info:', e);
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
