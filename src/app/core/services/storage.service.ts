import { Injectable } from '@angular/core';
import type {
  BankBalance,
  CashInstallment,
  CreditCard,
  Installment,
  OneTimeBill,
  Profile,
  Statement
} from '@shared/types';

const KEYS = {
  PROFILES: 'bt_profiles',
  CARDS: 'bt_cards',
  STATEMENTS: 'bt_statements',
  INSTALLMENTS: 'bt_installments',
  CASH_INSTALLMENTS: 'bt_cash_installments',
  ONE_TIME_BILLS: 'bt_one_time_bills',
  BANK_BALANCES: 'bt_bank_balances',
  BANK_BALANCE_TRACKING_ENABLED: 'bt_bank_balance_tracking_enabled',
  ACTIVE_PROFILE_ID: 'bt_active_profile_id',
  ACTIVE_MONTH: 'bt_active_month',
  MULTI_PROFILE_MODE: 'bt_multi_profile_mode',
  SELECTED_PROFILE_IDS: 'bt_selected_profile_ids',
  COLUMN_LAYOUTS: 'bt_column_layouts',
};

// Generic JSON helpers for objects (not just arrays)
const loadJSON = <T, >(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch (e) {
    console.error('Error loading JSON from key:', key, e);
    return fallback;
  }
};

const saveJSON = <T, >(key: string, value: T) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving JSON to key:', key, e);
  }
};

const loadData = <T, >(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Error loading data from key:', key, e);
    return [];
  }
};

const saveData = <T, >(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

// Scalar (string) helpers for simple values
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

const saveString = (key: string, value: string) => {
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

const saveBoolean = (key: string, value: boolean) => {
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

const saveStringArray = (key: string, value: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving string array to key:', key, e);
  }
};

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  getProfiles(): Profile[] {
    return loadData<Profile>(KEYS.PROFILES);
  }

  saveProfiles(data: Profile[]): void {
    saveData(KEYS.PROFILES, data);
  }

  getCards(): CreditCard[] {
    return loadData<CreditCard>(KEYS.CARDS);
  }

  saveCards(data: CreditCard[]): void {
    saveData(KEYS.CARDS, data);
  }

  getStatements(): Statement[] {
    return loadData<Statement>(KEYS.STATEMENTS);
  }

  saveStatements(data: Statement[]): void {
    saveData(KEYS.STATEMENTS, data);
  }

  getInstallments(): Installment[] {
    return loadData<Installment>(KEYS.INSTALLMENTS);
  }

  saveInstallments(data: Installment[]): void {
    saveData(KEYS.INSTALLMENTS, data);
  }

  getCashInstallments(): CashInstallment[] {
    return loadData<CashInstallment>(KEYS.CASH_INSTALLMENTS);
  }

  saveCashInstallments(data: CashInstallment[]): void {
    saveData(KEYS.CASH_INSTALLMENTS, data);
  }

  getOneTimeBills(): OneTimeBill[] {
    return loadData<OneTimeBill>(KEYS.ONE_TIME_BILLS);
  }

  saveOneTimeBills(data: OneTimeBill[]): void {
    saveData(KEYS.ONE_TIME_BILLS, data);
  }

  getBankBalances(): BankBalance[] {
    return loadData<BankBalance>(KEYS.BANK_BALANCES);
  }

  saveBankBalances(data: BankBalance[]): void {
    saveData(KEYS.BANK_BALANCES, data);
  }

  getActiveProfileId(): string | null {
    return loadString(KEYS.ACTIVE_PROFILE_ID);
  }

  saveActiveProfileId(id: string): void {
    saveString(KEYS.ACTIVE_PROFILE_ID, id);
  }

  getActiveMonthStr(): string | null {
    return loadString(KEYS.ACTIVE_MONTH);
  }

  saveActiveMonthStr(monthStr: string): void {
    saveString(KEYS.ACTIVE_MONTH, monthStr);
  }

  getMultiProfileMode(): boolean {
    return loadBoolean(KEYS.MULTI_PROFILE_MODE);
  }

  saveMultiProfileMode(enabled: boolean): void {
    saveBoolean(KEYS.MULTI_PROFILE_MODE, enabled);
  }

  getSelectedProfileIds(): string[] {
    return loadStringArray(KEYS.SELECTED_PROFILE_IDS);
  }

  saveSelectedProfileIds(ids: string[]): void {
    saveStringArray(KEYS.SELECTED_PROFILE_IDS, ids);
  }

  getBankBalanceTrackingEnabled(): boolean {
    return loadBoolean(KEYS.BANK_BALANCE_TRACKING_ENABLED);
  }

  saveBankBalanceTrackingEnabled(enabled: boolean): void {
    saveBoolean(KEYS.BANK_BALANCE_TRACKING_ENABLED, enabled);
  }

  getColumnLayouts(): Record<string, Record<string, any>> {
    return loadJSON<Record<string, Record<string, any>>>(KEYS.COLUMN_LAYOUTS, {});
  }

  saveColumnLayouts(layouts: Record<string, Record<string, any>>): void {
    saveJSON(KEYS.COLUMN_LAYOUTS, layouts);
  }

  getColumnLayout(profileId: string, tableId: string): any {
    const allLayouts = this.getColumnLayouts();
    return allLayouts[profileId]?.[tableId] ?? null;
  }

  saveColumnLayout(profileId: string, tableId: string, layout: any): void {
    const allLayouts = this.getColumnLayouts();
    const profileLayouts = allLayouts[profileId] ?? {};
    profileLayouts[tableId] = layout;
    this.saveColumnLayouts({...allLayouts, [profileId]: profileLayouts});
  }
}
