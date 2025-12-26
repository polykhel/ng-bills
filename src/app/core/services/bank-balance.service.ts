import { effect, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ProfileService } from './profile.service';
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

  constructor(
    private storageService: StorageService,
    private profileService: ProfileService
  ) {
    this.initializeBankBalances();
    this.setupAutoSave();
  }

  setBankBalanceTracking(enabled: boolean): void {
    this.bankBalanceTrackingEnabledSignal.set(enabled);
  }

  updateBankBalance(profileId: string, monthStr: string, balance: number): void {
    this.bankBalancesSignal.update(balances => {
      const existing = balances.find(
        b => b.profileId === profileId && b.monthStr === monthStr
      );

      if (existing) {
        return balances.map(b =>
          b.id === existing.id ? {...b, balance} : b
        );
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

  getBankBalance(profileId: string, monthStr: string): number | null {
    const balance = this.bankBalancesSignal().find(
      b => b.profileId === profileId && b.monthStr === monthStr
    );
    return balance ? balance.balance : null;
  }

  private initializeBankBalances(): void {
    this.bankBalancesSignal.set(this.storageService.getBankBalances());
    this.bankBalanceTrackingEnabledSignal.set(
      this.storageService.getBankBalanceTrackingEnabled()
    );
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveBankBalances(this.bankBalancesSignal());
      }
    });

    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveBankBalanceTrackingEnabled(
          this.bankBalanceTrackingEnabledSignal()
        );
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
