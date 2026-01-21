import { Injectable } from '@angular/core';
import type {
  BankBalance,
  CashInstallment,
  CreditCard,
  Installment,
  Profile,
  Statement
} from '@shared/types';
import { LocalStorageProvider } from '../storage/local-storage.provider';

/**
 * StorageService
 * 
 * Simple wrapper using LocalStorageProvider directly for now.
 * This maintains backward compatibility while using the new storage abstraction.
 * 
 * In Phase 0.1, we'll add StorageFactory with auto-migration to IndexedDB.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private provider = new LocalStorageProvider();

  constructor() {
    // Initialize provider (LocalStorage init is sync, so it's immediate)
    this.provider.init();
  }

  // ==================== Profile Operations ====================
  
  getProfiles(): Profile[] {
    // Use a cached result pattern for sync compatibility
    let result: Profile[] = [];
    this.provider.getProfiles().then(data => result = data);
    return result.length > 0 ? result : this.getProfilesSync();
  }

  private getProfilesSync(): Profile[] {
    // Fallback to direct localStorage read for immediate availability
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_profiles');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveProfiles(data: Profile[]): void {
    this.provider.saveProfiles(data);
  }

  getCards(): CreditCard[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_cards');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveCards(data: CreditCard[]): void {
    this.provider.saveCards(data);
  }

  getStatements(): Statement[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_statements');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveStatements(data: Statement[]): void {
    this.provider.saveStatements(data);
  }

  getInstallments(): Installment[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_installments');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveInstallments(data: Installment[]): void {
    this.provider.saveInstallments(data);
  }

  getCashInstallments(): CashInstallment[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_cash_installments');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveCashInstallments(data: CashInstallment[]): void {
    this.provider.saveCashInstallments(data);
  }

  getBankBalances(): BankBalance[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_bank_balances');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveBankBalances(data: BankBalance[]): void {
    this.provider.saveBankBalances(data);
  }

  getActiveProfileId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem('bt_active_profile_id');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  saveActiveProfileId(id: string): void {
    this.provider.saveActiveProfileId(id);
  }

  getActiveMonthStr(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem('bt_active_month');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  saveActiveMonthStr(monthStr: string): void {
    this.provider.saveActiveMonthStr(monthStr);
  }

  getMultiProfileMode(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const item = localStorage.getItem('bt_multi_profile_mode');
      return item ? JSON.parse(item) : false;
    } catch {
      return false;
    }
  }

  saveMultiProfileMode(enabled: boolean): void {
    this.provider.saveMultiProfileMode(enabled);
  }

  getSelectedProfileIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const item = localStorage.getItem('bt_selected_profile_ids');
      return item ? JSON.parse(item) : [];
    } catch {
      return [];
    }
  }

  saveSelectedProfileIds(ids: string[]): void {
    this.provider.saveSelectedProfileIds(ids);
  }

  getBankBalanceTrackingEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const item = localStorage.getItem('bt_bank_balance_tracking_enabled');
      return item ? JSON.parse(item) : false;
    } catch {
      return false;
    }
  }

  saveBankBalanceTrackingEnabled(enabled: boolean): void {
    this.provider.saveBankBalanceTrackingEnabled(enabled);
  }

  getColumnLayouts(): Record<string, Record<string, any>> {
    if (typeof window === 'undefined') return {};
    try {
      const item = localStorage.getItem('bt_column_layouts');
      return item ? JSON.parse(item) : {};
    } catch {
      return {};
    }
  }

  saveColumnLayouts(layouts: Record<string, Record<string, any>>): void {
    this.provider.saveColumnLayouts(layouts);
  }

  getColumnLayout(profileId: string, tableId: string): any {
    const allLayouts = this.getColumnLayouts();
    return allLayouts[profileId]?.[tableId] ?? null;
  }

  saveColumnLayout(profileId: string, tableId: string, layout: any): void {
    const allLayouts = this.getColumnLayouts();
    const profileLayouts = allLayouts[profileId] ?? {};
    profileLayouts[tableId] = layout;
    this.saveColumnLayouts({ ...allLayouts, [profileId]: profileLayouts });
  }

  // ==================== Utility Methods ====================

  /**
   * Get access to the underlying storage provider.
   */
  getProvider(): LocalStorageProvider {
    return this.provider;
  }

  /**
   * Export all data as JSON.
   */
  async exportData(): Promise<string> {
    return this.provider.exportData();
  }

  /**
   * Import data from JSON.
   */
  async importData(jsonData: string): Promise<void> {
    return this.provider.importData(jsonData);
  }

  /**
   * Get storage information.
   */
  async getStorageInfo(): Promise<{
    used: number;
    available: number;
    percentage: number;
  } | null> {
    return this.provider.getStorageInfo();
  }
}
