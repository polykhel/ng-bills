import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import type { CashInstallment } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class CashInstallmentService {
  private cashInstallmentsSignal = signal<CashInstallment[]>([]);

  // Public signals
  cashInstallments = this.cashInstallmentsSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
  ) {
    void this.initializeCashInstallments();
    this.setupAutoSave();
  }

  addCashInstallment(cashInstallment: Omit<CashInstallment, 'id'>): void {
    const newCashInstallment: CashInstallment = {
      ...cashInstallment,
      id: this.generateId(),
    };
    this.cashInstallmentsSignal.update((cashInstallments) => [
      ...cashInstallments,
      newCashInstallment,
    ]);
  }

  updateCashInstallment(id: string, updates: Partial<CashInstallment>): void {
    this.cashInstallmentsSignal.update((cashInstallments) =>
      cashInstallments.map((ci) => (ci.id === id ? { ...ci, ...updates } : ci)),
    );
  }

  deleteCashInstallment(id: string): void {
    this.cashInstallmentsSignal.update((cashInstallments) =>
      cashInstallments.filter((ci) => ci.id !== id),
    );
  }

  deleteCashInstallmentsForInstallment(installmentId: string): void {
    this.cashInstallmentsSignal.update((cashInstallments) =>
      cashInstallments.filter((ci) => ci.installmentId !== installmentId),
    );
  }

  deleteCashInstallmentsForCard(cardId: string): void {
    this.cashInstallmentsSignal.update((cashInstallments) =>
      cashInstallments.filter((ci) => ci.cardId !== cardId),
    );
  }

  getCashInstallmentsForCard(cardId: string): CashInstallment[] {
    return this.cashInstallmentsSignal().filter((ci) => ci.cardId === cardId);
  }

  getCashInstallmentsForInstallment(installmentId: string): CashInstallment[] {
    return this.cashInstallmentsSignal().filter((ci) => ci.installmentId === installmentId);
  }

  private async initializeCashInstallments(): Promise<void> {
    const db = this.idb.getDB();
    const data = await db.getAll<CashInstallment>(STORES.CASH_INSTALLMENTS);
    this.cashInstallmentsSignal.set(data);
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.CASH_INSTALLMENTS, this.cashInstallmentsSignal());
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
