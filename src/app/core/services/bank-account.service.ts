import { computed, effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import type { BankAccount } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class BankAccountService {
  private bankAccountsSignal = signal<BankAccount[]>([]);

  // Public signals
  bankAccounts = this.bankAccountsSignal.asReadonly();

  // Computed active bank accounts (accounts for current profile)
  activeBankAccounts = computed(() => {
    const accounts = this.bankAccountsSignal();
    const activeProfileId = this.profileService.activeProfileId();
    return accounts.filter((a) => a.profileId === activeProfileId);
  });

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
  ) {
    void this.initializeBankAccounts();
    this.setupAutoSave();
  }

  addBankAccount(account: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    const newAccount: BankAccount = {
      ...account,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.bankAccountsSignal.update((accounts) => [...accounts, newAccount]);
  }

  updateBankAccount(id: string, updates: Partial<BankAccount>): void {
    this.bankAccountsSignal.update((accounts) =>
      accounts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a,
      ),
    );
  }

  deleteBankAccount(id: string): boolean {
    if (confirm('Delete this bank account and all its transaction history?')) {
      this.bankAccountsSignal.update((accounts) => accounts.filter((a) => a.id !== id));
      return true;
    }
    return false;
  }

  transferBankAccount(accountId: string, targetProfileId: string): void {
    this.bankAccountsSignal.update((accounts) =>
      accounts.map((a) => (a.id === accountId ? { ...a, profileId: targetProfileId } : a)),
    );
  }

  getBankAccountsForProfiles(profileIds: string[]): BankAccount[] {
    return this.bankAccountsSignal().filter((a) => profileIds.includes(a.profileId));
  }

  getBankAccountById(accountId: string): BankAccount | undefined {
    return this.bankAccountsSignal().find((a) => a.id === accountId);
  }

  /**
   * Synchronous version of getBankAccountById for use in services
   * Returns account from current signal state
   */
  getBankAccountSync(accountId: string): BankAccount | undefined {
    return this.bankAccountsSignal().find((a) => a.id === accountId);
  }

  private async initializeBankAccounts(): Promise<void> {
    const db = this.idb.getDB();
    const loadedAccounts = await db.getAll<BankAccount>(STORES.BANK_ACCOUNTS);
    const activeProfileId = this.profileService.activeProfileId();
    let accountsChanged = false;

    const migratedAccounts = loadedAccounts.map((a) => {
      if (!a.profileId) {
        accountsChanged = true;
        return { ...a, profileId: activeProfileId };
      }
      return a;
    });

    if (accountsChanged) {
      await db.putAll(STORES.BANK_ACCOUNTS, migratedAccounts);
    }

    this.bankAccountsSignal.set(migratedAccounts);
  }

  private setupAutoSave(): void {
    // Auto-save bank accounts when they change
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.BANK_ACCOUNTS, this.bankAccountsSignal());
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
