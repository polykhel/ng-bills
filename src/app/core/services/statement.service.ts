import { effect, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ProfileService } from './profile.service';
import type { Statement } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class StatementService {
  private statementsSignal = signal<Statement[]>([]);

  // Public signals
  statements = this.statementsSignal.asReadonly();

  constructor(
    private storageService: StorageService,
    private profileService: ProfileService
  ) {
    this.initializeStatements();
    this.setupAutoSave();
  }

  updateStatement(
    cardId: string,
    monthStr: string,
    updates: Partial<Statement>
  ): void {
    this.statementsSignal.update(prev => {
      const existing = prev.find(
        s => s.cardId === cardId && s.monthStr === monthStr
      );

      if (existing) {
        return prev.map(s => (s.id === existing.id ? {...s, ...updates} : s));
      }

      return [
        ...prev,
        {
          id: this.generateId(),
          cardId,
          monthStr,
          amount: updates.amount !== undefined ? updates.amount : 0,
          isPaid: false,
          isUnbilled: true,
          ...updates,
        },
      ];
    });
  }

  togglePaid(cardId: string, monthStr: string, installmentTotal: number): void {
    this.statementsSignal.update(prev => {
      const existing = prev.find(
        s => s.cardId === cardId && s.monthStr === monthStr
      );

      if (existing) {
        const newIsPaid = !existing.isPaid;
        const updates = newIsPaid
          ? {isPaid: newIsPaid, isUnbilled: false, paidAmount: existing.amount}
          : {isPaid: newIsPaid, paidAmount: 0};
        return prev.map(s => (s.id === existing.id ? {...s, ...updates} : s));
      }

      return [
        ...prev,
        {
          id: this.generateId(),
          cardId,
          monthStr,
          amount: installmentTotal,
          isPaid: true,
          paidAmount: installmentTotal,
          isUnbilled: false,
        },
      ];
    });
  }

  setPaidAmount(cardId: string, monthStr: string, paidAmount: number): void {
    this.statementsSignal.update(prev => {
      const existing = prev.find(
        s => s.cardId === cardId && s.monthStr === monthStr
      );

      if (existing) {
        const effectiveAmount = existing.adjustedAmount !== undefined ? existing.adjustedAmount : existing.amount;
        const newPaidAmount = Math.max(0, Math.min(paidAmount, effectiveAmount));
        const isPaid = newPaidAmount >= effectiveAmount;
        const updates = {
          paidAmount: newPaidAmount,
          isPaid,
          isUnbilled: isPaid ? false : existing.isUnbilled,
        };
        return prev.map(s => (s.id === existing.id ? {...s, ...updates} : s));
      }

      return prev;
    });
  }

  deleteStatementsForCard(cardId: string): void {
    this.statementsSignal.update(prev => prev.filter(s => s.cardId !== cardId));
  }

  getStatementsForCard(cardId: string): Statement[] {
    return this.statementsSignal().filter(s => s.cardId === cardId);
  }

  getStatementForMonth(cardId: string, monthStr: string): Statement | undefined {
    return this.statementsSignal().find(
      s => s.cardId === cardId && s.monthStr === monthStr
    );
  }

  private initializeStatements(): void {
    this.statementsSignal.set(this.storageService.getStatements());
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        this.storageService.saveStatements(this.statementsSignal());
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
