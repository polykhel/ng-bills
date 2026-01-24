import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import { TransactionService } from './transaction.service';
import { BankAccountService } from './bank-account.service';
import { format, startOfMonth } from 'date-fns';
import type { BankBalance } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class BankBalanceService {
  private bankBalancesSignal = signal<BankBalance[]>([]);
  // Public signals
  bankBalances = this.bankBalancesSignal.asReadonly();
  private bankBalanceTrackingEnabledSignal = signal<boolean>(false);
  bankBalanceTrackingEnabled = this.bankBalanceTrackingEnabledSignal.asReadonly();

  private transactionService = inject(TransactionService);
  private bankAccountService = inject(BankAccountService);

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
  ) {
    void this.initializeBankBalances();
    this.setupAutoSave();
  }

  setBankBalanceTracking(enabled: boolean): void {
    this.bankBalanceTrackingEnabledSignal.set(enabled);
  }

  updateBankBalance(profileId: string, monthStr: string, balance: number): void {
    this.bankBalancesSignal.update((balances) => {
      const existing = balances.find(
        (b) => b.profileId === profileId && b.monthStr === monthStr && !b.bankAccountId,
      );

      if (existing) {
        return balances.map((b) => (b.id === existing.id ? { ...b, balance } : b));
      }

      return [
        ...balances,
        {
          id: this.generateId(),
          profileId,
          monthStr,
          balance,
        },
      ];
    });
  }

  updateBankAccountBalance(
    profileId: string,
    monthStr: string,
    bankAccountId: string,
    balance: number,
  ): void {
    this.bankBalancesSignal.update((balances) => {
      const existing = balances.find(
        (b) =>
          b.profileId === profileId && b.monthStr === monthStr && b.bankAccountId === bankAccountId,
      );

      if (existing) {
        return balances.map((b) => (b.id === existing.id ? { ...b, balance } : b));
      }

      return [
        ...balances,
        {
          id: this.generateId(),
          profileId,
          monthStr,
          bankAccountId,
          balance,
        },
      ];
    });
  }

  /**
   * Get total bank balance for a profile/month
   * Prioritizes summing account balances, falls back to legacy balance if no account balances exist
   */
  getBankBalance(profileId: string, monthStr: string): number | null {
    // First, try to sum all account balances for this profile/month
    const accountBalances = this.bankBalancesSignal().filter(
      (b) => b.profileId === profileId && b.monthStr === monthStr && b.bankAccountId,
    );
    if (accountBalances.length > 0) {
      return accountBalances.reduce((sum, b) => sum + b.balance, 0);
    }

    // For backward compatibility: if there's a legacy balance without bankAccountId, return it
    const legacyBalance = this.bankBalancesSignal().find(
      (b) => b.profileId === profileId && b.monthStr === monthStr && !b.bankAccountId,
    );
    if (legacyBalance) {
      return legacyBalance.balance;
    }

    return null;
  }

  /**
   * Get sum of all account balances for a profile/month (ignores legacy balances)
   */
  getTotalAccountBalances(profileId: string, monthStr: string): number {
    const accountBalances = this.bankBalancesSignal().filter(
      (b) => b.profileId === profileId && b.monthStr === monthStr && b.bankAccountId,
    );
    return accountBalances.reduce((sum, b) => sum + b.balance, 0);
  }

  getBankAccountBalance(profileId: string, monthStr: string, bankAccountId: string): number | null {
    const balance = this.bankBalancesSignal().find(
      (b) =>
        b.profileId === profileId && b.monthStr === monthStr && b.bankAccountId === bankAccountId,
    );
    return balance ? balance.balance : null;
  }

  private async initializeBankBalances(): Promise<void> {
    const db = this.idb.getDB();
    const balances = await db.getAll<BankBalance>(STORES.BANK_BALANCES);
    const trackingSetting = await db.get<{ key: string; value: boolean }>(
      STORES.SETTINGS,
      'bankBalanceTrackingEnabled',
    );
    this.bankBalancesSignal.set(balances);
    this.bankBalanceTrackingEnabledSignal.set(trackingSetting?.value ?? false);
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.BANK_BALANCES, this.bankBalancesSignal());
      }
    });

    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().put(STORES.SETTINGS, {
          key: 'bankBalanceTrackingEnabled',
          value: this.bankBalanceTrackingEnabledSignal(),
        });
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get Projected End of Month Balance
   * Formula: Current Liquid Balance + Projected Income - Committed Expenses
   * This represents the 'True' financial position at the end of the month
   */
  projectedEndOfMonthBalance = computed(() => {
    const activeProfile = this.profileService.activeProfile();
    if (!activeProfile) return 0;

    const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');

    // Get current liquid balance from bank accounts
    const accounts = this.bankAccountService.activeBankAccounts();
    let currentLiquidBalance = 0;
    for (const account of accounts) {
      const storedBalance = this.getBankAccountBalance(account.profileId, monthStr, account.id);
      const accountBalance = storedBalance !== null ? storedBalance : account.initialBalance || 0;
      currentLiquidBalance += accountBalance;
    }

    // Add current liquid balance from transactions (income - expenses up to today)
    const transactionBalance = this.transactionService.getCurrentLiquidBalance(activeProfile.id);
    currentLiquidBalance += transactionBalance;

    // Get projected income (future income this month)
    const projectedIncome = this.transactionService.getProjectedIncome(activeProfile.id, monthStr);

    // Get committed expenses (future expenses this month)
    const committedExpenses = this.transactionService.getCommittedExpenses(
      activeProfile.id,
      monthStr,
    );

    // Calculate projected landing
    return currentLiquidBalance + projectedIncome - committedExpenses;
  });

  /**
   * Get Available Right Now: Current Liquid Balance - Bills Due within 7 days
   * This is the YNAB-style number showing what's available immediately
   */
  getAvailableRightNow(profileId: string, monthStr: string): number {
    // Get current liquid balance from bank accounts
    const allAccounts = this.bankAccountService.bankAccounts();
    const accounts = allAccounts.filter((a) => a.profileId === profileId);
    let currentLiquidBalance = 0;
    for (const account of accounts) {
      const storedBalance = this.getBankAccountBalance(account.profileId, monthStr, account.id);
      const accountBalance = storedBalance !== null ? storedBalance : account.initialBalance || 0;
      currentLiquidBalance += accountBalance;
    }

    // Add current liquid balance from transactions
    const transactionBalance = this.transactionService.getCurrentLiquidBalance(profileId);
    currentLiquidBalance += transactionBalance;

    // Note: Bills due within 7 days are calculated in OverviewComponent
    // This method returns the base current liquid balance
    return currentLiquidBalance;
  }
}
