import { effect, Injectable, signal } from '@angular/core';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { IndexedDBService, STORES } from './indexeddb.service';
import { ProfileService } from './profile.service';
import { CardService } from './card.service';
import { StatementService } from './statement.service';
import type { Transaction, TransactionFilter } from '@shared/types';

/**
 * Transaction Service
 * Manages all transactions and auto-links credit card transactions to statements
 *
 * Core Logic:
 * - When a transaction with paymentMethod='card' is added, it automatically
 *   creates or updates the corresponding credit card statement (bill)
 * - Statement month is determined by cutoff day (cutoff-aware billing cycle)
 * - Transactions are grouped into correct billing cycles automatically
 */
@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private transactionsSignal = signal<Transaction[]>([]);

  // Public signals
  transactions = this.transactionsSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
  ) {
    void this.initializeTransactions();
    this.setupAutoSave();
  }

  /**
   * Add a new transaction
   * If payment method is 'card', automatically creates/updates the bill
   */
  async addTransaction(transaction: Transaction): Promise<void> {
    // Generate ID if not provided
    if (!transaction.id) {
      transaction.id = crypto.randomUUID();
    }

    // Set timestamps
    const now = new Date().toISOString();
    transaction.createdAt = now;
    transaction.updatedAt = now;

    // Add to signal
    this.transactionsSignal.update((prev) => [...prev, transaction]);

    // Auto-link to credit card bill if applicable
    if (transaction.paymentMethod === 'card' && transaction.cardId) {
      await this.autoCreateOrUpdateBill(transaction);
    }
  }

  /**
   * Update an existing transaction
   * If payment method changed or amount changed, updates the linked bill
   */
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const existing = this.transactionsSignal().find((t) => t.id === id);
    if (!existing) {
      throw new Error(`Transaction not found: ${id}`);
    }

    // Prepare updated transaction
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    // If payment method or amount changed, need to update bills
    const paymentMethodChanged = existing.paymentMethod !== updated.paymentMethod;
    const amountChanged = existing.amount !== updated.amount;
    const cardChanged = existing.cardId !== updated.cardId;
    const dateChanged = existing.date !== updated.date;

    // If was card payment, remove from old bill
    if (
      existing.paymentMethod === 'card' &&
      existing.cardId &&
      (paymentMethodChanged || cardChanged)
    ) {
      await this.removeFromBill(existing);
    }

    // Update amount in old bill if needed
    if (
      (amountChanged || dateChanged) &&
      existing.paymentMethod === 'card' &&
      existing.cardId &&
      !cardChanged
    ) {
      // Remove old amount and add new amount
      await this.removeFromBill(existing);
      await this.autoCreateOrUpdateBill(updated);
    }

    // Add to new bill if now a card payment
    if (
      updated.paymentMethod === 'card' &&
      updated.cardId &&
      (paymentMethodChanged || cardChanged || amountChanged || dateChanged)
    ) {
      if (!existing.paymentMethod || existing.paymentMethod !== 'card') {
        await this.autoCreateOrUpdateBill(updated);
      }
    }

    // Update in signal
    this.transactionsSignal.update((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  /**
   * Delete a transaction
   * If it was linked to a card bill, removes it from the bill
   */
  async deleteTransaction(id: string): Promise<void> {
    const transaction = this.transactionsSignal().find((t) => t.id === id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }

    // Remove from bill if applicable
    if (transaction.paymentMethod === 'card' && transaction.cardId) {
      await this.removeFromBill(transaction);
    }

    // Remove from signal
    this.transactionsSignal.update((prev) => prev.filter((t) => t.id !== id));
  }

  /**
   * Get transactions with optional filtering
   */
  getTransactions(filter?: TransactionFilter): Transaction[] {
    let result = [...this.transactionsSignal()];

    if (!filter) {
      return result;
    }

    if (filter.profileIds && filter.profileIds.length > 0) {
      result = result.filter((t) => filter.profileIds!.includes(t.profileId));
    }

    if (filter.type && filter.type !== 'all') {
      result = result.filter((t) => t.type === filter.type);
    }

    if (filter.dateRange) {
      result = result.filter(
        (t) => t.date >= filter.dateRange!.start && t.date <= filter.dateRange!.end,
      );
    }

    if (filter.categoryIds && filter.categoryIds.length > 0) {
      result = result.filter((t) => filter.categoryIds!.includes(t.categoryId));
    }

    if (filter.paymentMethod && filter.paymentMethod !== 'all') {
      result = result.filter((t) => t.paymentMethod === filter.paymentMethod);
    }

    if (filter.cardId) {
      result = result.filter((t) => t.cardId === filter.cardId);
    }

    if (filter.isRecurring !== undefined) {
      result = result.filter((t) => Boolean(t.isRecurring) === filter.isRecurring);
    }

    if (filter.recurringType) {
      result = result.filter((t) => t.recurringRule?.type === filter.recurringType);
    }

    if (filter.installmentGroupId) {
      result = result.filter(
        (t) => t.recurringRule?.installmentGroupId === filter.installmentGroupId,
      );
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(query) || t.notes?.toLowerCase().includes(query),
      );
    }

    return result;
  }

  /**
   * Get a single transaction by ID
   */
  getTransaction(id: string): Transaction | undefined {
    return this.transactionsSignal().find((t) => t.id === id);
  }

  /**
   * Bulk delete helper using a predicate
   */
  async deleteTransactionsWhere(predicate: (t: Transaction) => boolean): Promise<void> {
    const matches = this.transactionsSignal().filter(predicate);
    for (const tx of matches) {
      await this.deleteTransaction(tx.id);
    }
  }

  /**
   * Delete all transactions for a profile (cleanup when deleting profile)
   */
  deleteTransactionsForProfile(profileId: string): void {
    this.transactionsSignal.update((prev) => prev.filter((t) => t.profileId !== profileId));
  }

  /**
   * CORE LOGIC: Auto-create or update bill based on transaction
   * Handles cutoff-aware month calculation
   *
   * Logic:
   * - If transaction day >= cutoffDay: belongs to NEXT month
   * - If transaction day < cutoffDay: belongs to THIS month
   *
   * @param transaction Transaction with paymentMethod='card' and cardId
   */
  private async autoCreateOrUpdateBill(transaction: Transaction): Promise<void> {
    const cardId = transaction.cardId!;

    // Get card for cutoff and due day calculation
    const card = this.cardService.getCardSync(cardId);
    if (!card) {
      console.error(`Card not found: ${cardId}`);
      return;
    }

    // ⭐ CUTOFF-AWARE: Determine which statement month this transaction belongs to
    const transactionDate = parseISO(transaction.date);
    const dayOfMonth = transactionDate.getDate();

    // Determine statement month based on cutoff day
    let statementDate: Date;
    if (dayOfMonth >= card.cutoffDay) {
      // Transaction is at or after cutoff → belongs to NEXT month's statement
      statementDate = addMonths(startOfMonth(transactionDate), 1);
    } else {
      // Transaction is before cutoff → belongs to THIS month's statement
      statementDate = startOfMonth(transactionDate);
    }

    const monthStr = format(statementDate, 'yyyy-MM');

    // Get existing statement or prepare to create new one
    const existingStatement = this.statementService.getStatementForMonth(cardId, monthStr);

    if (!existingStatement) {
      // AUTO-CREATE: New monthly bill
      const dueDate = new Date(statementDate.getFullYear(), statementDate.getMonth(), card.dueDay);

      this.statementService.updateStatement(cardId, monthStr, {
        amount: transaction.amount,
        isPaid: false,
        customDueDate: format(dueDate, 'yyyy-MM-dd'),
      });

      console.log(
        `✅ Bill auto-created: ${card.cardName} - ${monthStr} (cutoff: ${card.cutoffDay}) - $${transaction.amount}`,
      );
    } else {
      // UPDATE: Add to existing bill
      this.statementService.updateStatement(cardId, monthStr, {
        amount: (existingStatement.amount || 0) + transaction.amount,
      });

      console.log(
        `✅ Bill updated: ${card.cardName} - ${monthStr} - New total: $${(existingStatement.amount || 0) + transaction.amount}`,
      );
    }
  }

  /**
   * Remove a transaction from its linked bill
   */
  private async removeFromBill(transaction: Transaction): Promise<void> {
    if (transaction.paymentMethod !== 'card' || !transaction.cardId) {
      return;
    }

    const card = this.cardService.getCardSync(transaction.cardId);
    if (!card) return;

    // Calculate which statement month this belongs to
    const transactionDate = parseISO(transaction.date);
    const dayOfMonth = transactionDate.getDate();

    let statementDate: Date;
    if (dayOfMonth >= card.cutoffDay) {
      statementDate = addMonths(startOfMonth(transactionDate), 1);
    } else {
      statementDate = startOfMonth(transactionDate);
    }

    const monthStr = format(statementDate, 'yyyy-MM');
    const statement = this.statementService.getStatementForMonth(transaction.cardId, monthStr);

    if (statement) {
      const newAmount = Math.max(0, (statement.amount || 0) - transaction.amount);
      this.statementService.updateStatement(transaction.cardId, monthStr, {
        amount: newAmount,
      });
    }
  }

  private async initializeTransactions(): Promise<void> {
    const db = this.idb.getDB();
    const data = await db.getAll<Transaction>(STORES.TRANSACTIONS);
    this.transactionsSignal.set(data);
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.TRANSACTIONS, this.transactionsSignal());
      }
    });
  }
}
