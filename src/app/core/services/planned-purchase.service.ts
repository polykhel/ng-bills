import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { BankBalanceService } from './bank-balance.service';
import { TransactionService } from './transaction.service';
import type { PlannedPurchase, Transaction, PaymentMethod } from '@shared/types';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';

/**
 * Planned Purchase Service
 * Manages planned purchases with affordability checks and conversion to transactions
 */
@Injectable({
  providedIn: 'root',
})
export class PlannedPurchaseService {
  private purchasesSignal = signal<PlannedPurchase[]>([]);
  purchases = this.purchasesSignal.asReadonly();
  private isLoadedSignal = signal(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private bankBalanceService: BankBalanceService,
    private transactionService: TransactionService,
  ) {
    void this.initializePurchases();
    this.setupAutoSave();
  }

  /**
   * Get all purchases for a profile
   */
  getPurchases(profileId: string): PlannedPurchase[] {
    return this.purchasesSignal().filter((p) => p.profileId === profileId);
  }

  /**
   * Get purchases by status
   */
  getPurchasesByStatus(profileId: string, isPurchased: boolean): PlannedPurchase[] {
    return this.getPurchases(profileId).filter((p) => p.isPurchased === isPurchased);
  }

  /**
   * Get purchase by ID
   */
  getPurchase(id: string): PlannedPurchase | undefined {
    return this.purchasesSignal().find((p) => p.id === id);
  }

  /**
   * Create a new planned purchase
   */
  async createPurchase(
    purchase: Omit<PlannedPurchase, 'id' | 'isPurchased' | 'createdAt' | 'updatedAt'>,
  ): Promise<PlannedPurchase> {
    const newPurchase: PlannedPurchase = {
      id: this.generateId(),
      isPurchased: false,
      ...purchase,
      links: purchase.links || [],
      tags: purchase.tags || [],
      notes: purchase.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.purchasesSignal.update((prev) => [...prev, newPurchase]);
    return newPurchase;
  }

  /**
   * Update a purchase
   */
  async updatePurchase(id: string, updates: Partial<PlannedPurchase>): Promise<void> {
    this.purchasesSignal.update((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  }

  /**
   * Delete a purchase
   */
  async deletePurchase(id: string): Promise<void> {
    this.purchasesSignal.update((prev) => prev.filter((p) => p.id !== id));
  }

  /**
   * Check affordability of a purchase
   */
  checkAffordability(
    purchase: PlannedPurchase,
    profileId: string,
  ): {
    canAfford: boolean;
    availableBalance: number;
    shortfall: number;
    monthlyImpact: number;
    recommendations: string[];
  } {
    // Get current available balance
    const today = new Date();
    const monthStr = format(today, 'yyyy-MM');
    const bankBalance = this.bankBalanceService.getBankBalance(profileId, monthStr) || 0;

    // Calculate committed balance (simplified - would need full commitment service)
    // For now, just check against bank balance
    const availableBalance = bankBalance; // Simplified - should subtract commitments

    const canAfford = availableBalance >= purchase.estimatedCost;
    const shortfall = Math.max(0, purchase.estimatedCost - availableBalance);

    // Calculate monthly impact if financed
    let monthlyImpact = 0;
    if (purchase.paymentMethod === 'installment' && purchase.installmentPlan) {
      monthlyImpact = purchase.installmentPlan.monthlyPayment;
    } else if (purchase.paymentMethod === 'card' || purchase.paymentMethod === 'cash') {
      monthlyImpact = purchase.estimatedCost; // One-time payment
    }

    const recommendations: string[] = [];
    if (!canAfford) {
      recommendations.push(`You need $${shortfall.toFixed(2)} more to afford this purchase.`);
      if (purchase.targetDate) {
        const daysUntilTarget = differenceInDays(parseISO(purchase.targetDate), today);
        if (daysUntilTarget > 0) {
          const monthlyNeeded = shortfall / (daysUntilTarget / 30);
          recommendations.push(
            `Save $${monthlyNeeded.toFixed(2)} per month to reach your target.`,
          );
        }
      }
    }

    return {
      canAfford,
      availableBalance,
      shortfall,
      monthlyImpact,
      recommendations,
    };
  }

  /**
   * Mark purchase as purchased and convert to transaction/installment
   */
  async markAsPurchased(
    purchaseId: string,
    actualCost: number,
    purchasedDate: string,
    paymentMethod: PaymentMethod,
    cardId?: string,
  ): Promise<void> {
    const purchase = this.getPurchase(purchaseId);
    if (!purchase) {
      throw new Error(`Purchase not found: ${purchaseId}`);
    }

    // Convert PaymentMethod to PlannedPurchase paymentMethod type
    const purchasePaymentMethod: 'cash' | 'card' | 'installment' | undefined =
      paymentMethod === 'bank_transfer' || paymentMethod === 'bank_to_bank' || paymentMethod === 'other'
        ? 'cash'
        : paymentMethod === 'card'
          ? 'card'
          : paymentMethod === 'cash'
            ? 'cash'
            : undefined;

    // Update purchase
    await this.updatePurchase(purchaseId, {
      isPurchased: true,
      purchasedDate,
      actualCost,
      paymentMethod: purchasePaymentMethod,
    });

    // Create transaction based on payment method
    // Check if purchase has installment plan to determine if it's an installment purchase
    if (purchase.installmentPlan && purchase.paymentMethod === 'installment') {
      // Create recurring transaction for installment
      const installmentGroupId = `installment_${purchaseId}`;
      const startDate = purchasedDate;

      // Calculate end date
      const start = parseISO(startDate);
      const endDate = format(
        new Date(start.getFullYear(), start.getMonth() + purchase.installmentPlan.months, start.getDate()),
        'yyyy-MM-dd',
      );

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        profileId: purchase.profileId,
        type: 'expense',
        amount: purchase.installmentPlan.monthlyPayment,
        date: startDate,
        categoryId: purchase.category || 'shopping',
        description: purchase.name,
        notes: `Purchased: ${purchase.name}. Original cost: $${actualCost}`,
        paymentMethod: cardId ? 'card' : 'cash',
        cardId,
        isRecurring: true,
        recurringRule: {
          type: 'installment',
          frequency: 'monthly',
          totalPrincipal: actualCost,
          currentTerm: 1,
          totalTerms: purchase.installmentPlan.months,
          startDate,
          endDate,
          interestRate: purchase.installmentPlan.interestRate || 0,
          installmentGroupId,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.transactionService.addTransaction(transaction);
    } else {
      // Create one-time transaction
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        profileId: purchase.profileId,
        type: 'expense',
        amount: actualCost,
        date: purchasedDate,
        categoryId: purchase.category || 'shopping',
        description: purchase.name,
        notes: purchase.notes || undefined,
        paymentMethod,
        cardId,
        tags: purchase.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.transactionService.addTransaction(transaction);
    }
  }

  /**
   * Initialize purchases from IndexedDB
   */
  private async initializePurchases(): Promise<void> {
    try {
      const db = this.idb.getDB();
      const purchases = await db.getAll<PlannedPurchase>(STORES.PLANNED_PURCHASES);
      this.purchasesSignal.set(purchases);
      this.isLoadedSignal.set(true);
    } catch (error) {
      console.error('Failed to initialize planned purchases:', error);
      this.purchasesSignal.set([]);
      this.isLoadedSignal.set(true);
    }
  }

  /**
   * Auto-save purchases when signal changes
   */
  private setupAutoSave(): void {
    effect(() => {
      if (this.isLoadedSignal()) {
        const purchases = this.purchasesSignal();
        void this.idb.getDB().putAll(STORES.PLANNED_PURCHASES, purchases);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
