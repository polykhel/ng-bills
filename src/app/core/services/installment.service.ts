import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import type { Installment } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class InstallmentService {
  private installmentsSignal = signal<Installment[]>([]);

  // Public signals
  installments = this.installmentsSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
  ) {
    void this.initializeInstallments();
    this.setupAutoSave();
  }

  addInstallment(installment: Omit<Installment, 'id'>): void {
    const newInstallment: Installment = { ...installment, id: this.generateId() };
    this.installmentsSignal.update((installments) => [...installments, newInstallment]);
  }

  updateInstallment(id: string, updates: Partial<Installment>): void {
    this.installmentsSignal.update((installments) =>
      installments.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    );
  }

  deleteInstallment(id: string): boolean {
    if (confirm('Delete this installment?')) {
      this.installmentsSignal.update((installments) => installments.filter((i) => i.id !== id));
      return true;
    }
    return false;
  }

  deleteInstallmentsForCard(cardId: string): void {
    this.installmentsSignal.update((installments) =>
      installments.filter((i) => i.cardId !== cardId),
    );
  }

  getInstallmentsForCard(cardId: string): Installment[] {
    return this.installmentsSignal().filter((i) => i.cardId === cardId);
  }

  private async initializeInstallments(): Promise<void> {
    const db = this.idb.getDB();
    const data = await db.getAll<Installment>(STORES.INSTALLMENTS);
    this.installmentsSignal.set(data);
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.INSTALLMENTS, this.installmentsSignal());
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
