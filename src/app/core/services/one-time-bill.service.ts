import { Injectable, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';
import { ProfileService } from './profile.service';
import type { OneTimeBill } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class OneTimeBillService {
  private oneTimeBillsSignal = signal<OneTimeBill[]>([]);

  // Public signals
  oneTimeBills = this.oneTimeBillsSignal.asReadonly();

  constructor(
    private storageService: StorageService,
    private profileService: ProfileService
  ) {
    this.initializeOneTimeBills();
    this.setupAutoSave();
  }

  private initializeOneTimeBills(): void {
    this.oneTimeBillsSignal.set(this.storageService.getOneTimeBills());
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveOneTimeBills(this.oneTimeBillsSignal());
      }
    });
  }

  addOneTimeBill(bill: Omit<OneTimeBill, 'id'>): void {
    const newBill: OneTimeBill = { ...bill, id: this.generateId() };
    this.oneTimeBillsSignal.update(bills => [...bills, newBill]);
  }

  updateOneTimeBill(id: string, updates: Partial<OneTimeBill>): void {
    this.oneTimeBillsSignal.update(bills =>
      bills.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  }

  deleteOneTimeBill(id: string): boolean {
    if (confirm('Delete this one-time bill?')) {
      this.oneTimeBillsSignal.update(bills => bills.filter(b => b.id !== id));
      return true;
    }
    return false;
  }

  deleteOneTimeBillsForCard(cardId: string): void {
    this.oneTimeBillsSignal.update(bills =>
      bills.filter(b => b.cardId !== cardId)
    );
  }

  getOneTimeBillsForCard(cardId: string): OneTimeBill[] {
    return this.oneTimeBillsSignal().filter(b => b.cardId === cardId);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
