import { Injectable, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';
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
    private storageService: StorageService,
    private profileService: ProfileService
  ) {
    this.initializeInstallments();
    this.setupAutoSave();
  }

  private initializeInstallments(): void {
    this.installmentsSignal.set(this.storageService.getInstallments());
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveInstallments(this.installmentsSignal());
      }
    });
  }

  addInstallment(installment: Omit<Installment, 'id'>): void {
    const newInstallment: Installment = { ...installment, id: this.generateId() };
    this.installmentsSignal.update(installments => [
      ...installments,
      newInstallment,
    ]);
  }

  updateInstallment(id: string, updates: Partial<Installment>): void {
    this.installmentsSignal.update(installments =>
      installments.map(i => (i.id === id ? { ...i, ...updates } : i))
    );
  }

  deleteInstallment(id: string): boolean {
    if (confirm('Delete this installment?')) {
      this.installmentsSignal.update(installments =>
        installments.filter(i => i.id !== id)
      );
      return true;
    }
    return false;
  }

  deleteInstallmentsForCard(cardId: string): void {
    this.installmentsSignal.update(installments =>
      installments.filter(i => i.cardId !== cardId)
    );
  }

  getInstallmentsForCard(cardId: string): Installment[] {
    return this.installmentsSignal().filter(i => i.cardId === cardId);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
