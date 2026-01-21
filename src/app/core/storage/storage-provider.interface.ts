/**
 * StorageProvider Interface
 * 
 * Abstraction layer for different storage implementations.
 * Allows switching between LocalStorage, IndexedDB, and Firestore
 * while keeping the same API across the application.
 */

import type {
  BankBalance,
  CashInstallment,
  CreditCard,
  Installment,
  Profile,
  Statement
} from '@shared/types';

export interface StorageProvider {
  /**
   * Initialize the storage provider.
   * Must be called before any other operations.
   */
  init(): Promise<void>;

  /**
   * Check if the provider is ready for operations.
   */
  isReady(): boolean;

  /**
   * Get the name/type of this storage provider.
   */
  getProviderName(): string;

  // ==================== Profile Operations ====================
  
  getProfiles(): Promise<Profile[]>;
  saveProfiles(profiles: Profile[]): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  deleteProfile(id: string): Promise<void>;

  // ==================== Credit Card Operations ====================
  
  getCards(): Promise<CreditCard[]>;
  saveCards(cards: CreditCard[]): Promise<void>;
  getCard(id: string): Promise<CreditCard | null>;
  saveCard(card: CreditCard): Promise<void>;
  deleteCard(id: string): Promise<void>;
  getCardsByProfile(profileId: string): Promise<CreditCard[]>;

  // ==================== Statement Operations ====================
  
  getStatements(): Promise<Statement[]>;
  saveStatements(statements: Statement[]): Promise<void>;
  getStatement(id: string): Promise<Statement | null>;
  saveStatement(statement: Statement): Promise<void>;
  deleteStatement(id: string): Promise<void>;
  getStatementsByCard(cardId: string): Promise<Statement[]>;
  getStatementsByMonth(monthStr: string): Promise<Statement[]>;

  // ==================== Installment Operations ====================
  
  getInstallments(): Promise<Installment[]>;
  saveInstallments(installments: Installment[]): Promise<void>;
  getInstallment(id: string): Promise<Installment | null>;
  saveInstallment(installment: Installment): Promise<void>;
  deleteInstallment(id: string): Promise<void>;
  getInstallmentsByCard(cardId: string): Promise<Installment[]>;

  // ==================== Cash Installment Operations ====================
  
  getCashInstallments(): Promise<CashInstallment[]>;
  saveCashInstallments(cashInstallments: CashInstallment[]): Promise<void>;
  getCashInstallment(id: string): Promise<CashInstallment | null>;
  saveCashInstallment(cashInstallment: CashInstallment): Promise<void>;
  deleteCashInstallment(id: string): Promise<void>;
  getCashInstallmentsByCard(cardId: string): Promise<CashInstallment[]>;
  getCashInstallmentsByInstallment(installmentId: string): Promise<CashInstallment[]>;

  // ==================== Bank Balance Operations ====================
  
  getBankBalances(): Promise<BankBalance[]>;
  saveBankBalances(balances: BankBalance[]): Promise<void>;
  getBankBalance(id: string): Promise<BankBalance | null>;
  saveBankBalance(balance: BankBalance): Promise<void>;
  deleteBankBalance(id: string): Promise<void>;
  getBankBalancesByProfile(profileId: string): Promise<BankBalance[]>;
  getBankBalanceByMonth(profileId: string, monthStr: string): Promise<BankBalance | null>;

  // ==================== Application Settings ====================
  
  getActiveProfileId(): Promise<string | null>;
  saveActiveProfileId(id: string): Promise<void>;
  
  getActiveMonthStr(): Promise<string | null>;
  saveActiveMonthStr(monthStr: string): Promise<void>;
  
  getMultiProfileMode(): Promise<boolean>;
  saveMultiProfileMode(enabled: boolean): Promise<void>;
  
  getSelectedProfileIds(): Promise<string[]>;
  saveSelectedProfileIds(ids: string[]): Promise<void>;
  
  getBankBalanceTrackingEnabled(): Promise<boolean>;
  saveBankBalanceTrackingEnabled(enabled: boolean): Promise<void>;
  
  getColumnLayouts(): Promise<Record<string, Record<string, any>>>;
  saveColumnLayouts(layouts: Record<string, Record<string, any>>): Promise<void>;
  getColumnLayout(profileId: string, tableId: string): Promise<any>;
  saveColumnLayout(profileId: string, tableId: string, layout: any): Promise<void>;

  // ==================== Utility Operations ====================
  
  /**
   * Clear all data from storage.
   * Use with caution - this is irreversible!
   */
  clearAll(): Promise<void>;

  /**
   * Get storage usage statistics (if available).
   */
  getStorageInfo(): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null>;

  /**
   * Export all data as JSON for backup.
   */
  exportData(): Promise<string>;

  /**
   * Import data from JSON backup.
   */
  importData(jsonData: string): Promise<void>;
}
