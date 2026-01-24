import { effect, Injectable, signal } from '@angular/core';
import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  getDate,
  isAfter,
  lastDayOfMonth,
  parseISO,
  setDate,
  startOfDay,
  startOfMonth
} from 'date-fns';
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

  private previousCards: Map<string, number> = new Map(); // Track previous dueDay values

  constructor(
    private idb: IndexedDBService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
  ) {
    void this.initializeTransactions();
    this.setupAutoSave();
    this.setupCardChangeWatcher();
  }

  /**
   * Add a new transaction
   * If payment method is 'card', automatically creates/updates the bill
   * If it's an installment, creates parent transaction and generates virtual transactions
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

    // Handle installment parent transaction
    const isInstallmentParent =
      transaction.isRecurring &&
      transaction.recurringRule?.type === 'installment' &&
      !transaction.isVirtual &&
      !transaction.parentTransactionId;

    if (isInstallmentParent) {
      // Mark as parent transaction (non-budget impacting)
      transaction.isBudgetImpacting = false;

      // Generate virtual transactions for each term
      const virtualTransactions = await this.generateVirtualTransactions(transaction);

      // Add parent transaction
      this.transactionsSignal.update((prev) => [...prev, transaction]);

      // Add all virtual transactions
      for (const virtualTx of virtualTransactions) {
        this.transactionsSignal.update((prev) => [...prev, virtualTx]);

        // Auto-link virtual transactions to bills if applicable
        if (virtualTx.paymentMethod === 'card' && virtualTx.cardId) {
          await this.autoCreateOrUpdateBill(virtualTx);
        }
      }
    } else {
      // Regular transaction - mark as budget impacting
      if (transaction.isBudgetImpacting === undefined) {
        transaction.isBudgetImpacting = true;
      }

      // Add to signal
      this.transactionsSignal.update((prev) => [...prev, transaction]);

      // Auto-link to credit card bill if applicable
      if (transaction.paymentMethod === 'card' && transaction.cardId) {
        await this.autoCreateOrUpdateBill(transaction);
      }
    }
  }

  /**
   * Preview orphaned transactions: transactions with cardId that no longer exists
   */
  previewOrphanedTransactions(): {
    total: number;
    orphaned: Array<{ id: string; description: string; cardId: string; date: string }>;
  } {
    const allTransactions = this.transactionsSignal();
    const allCardIds = new Set(this.cardService.cards().map((c) => c.id));

    const orphaned = allTransactions.filter(
      (tx) => tx.cardId !== undefined && !allCardIds.has(tx.cardId),
    );

    return {
      total: orphaned.length,
      orphaned: orphaned.map((tx) => ({
        id: tx.id,
        description: tx.description,
        cardId: tx.cardId!,
        date: tx.date,
      })),
    };
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
   * Get transactions that belong to a specific statement (card + month)
   * Uses cutoff-aware logic to determine which transactions belong to the statement
   */
  getTransactionsForStatement(cardId: string, monthStr: string): Transaction[] {
    const card = this.cardService.getCardSync(cardId);
    if (!card) return [];

    // Get all card transactions
    const allCardTransactions = this.transactionsSignal().filter(
      (t) => t.paymentMethod === 'card' && t.cardId === cardId,
    );

    // Filter transactions that belong to this statement month based on cutoff logic
    return allCardTransactions.filter((t) => {
      const transactionDate = parseISO(t.date);
      const dayOfMonth = transactionDate.getDate();

      // Determine which statement month this transaction belongs to
      let statementDate: Date;
      if (dayOfMonth >= card.cutoffDay) {
        // Transaction is at or after cutoff → belongs to NEXT month's statement
        statementDate = addMonths(startOfMonth(transactionDate), 1);
      } else {
        // Transaction is before cutoff → belongs to THIS month's statement
        statementDate = startOfMonth(transactionDate);
      }

      const transactionMonthStr = format(statementDate, 'yyyy-MM');
      return transactionMonthStr === monthStr;
    });
  }

  /**
   * Mark all transactions for a statement as paid or unpaid
   */
  async markStatementTransactionsPaidStatus(
    cardId: string,
    monthStr: string,
    isPaid: boolean,
    paidDate?: string,
  ): Promise<void> {
    const transactions = this.getTransactionsForStatement(cardId, monthStr);
    const paid = paidDate || new Date().toISOString();

    // Mark all transactions as paid/unpaid
    for (const transaction of transactions) {
      if (isPaid) {
        await this.markTransactionPaid(transaction.id, paid, transaction.amount);
      } else {
        await this.markTransactionUnpaid(transaction.id);
      }
    }
  }

  /**
   * Mark an installment transaction as paid
   * Used for cash installments and other recurring transactions
   * Note: Marking as paid does NOT increment currentTerm - currentTerm is calculated from dates
   */
  async markTransactionPaid(id: string, paidDate?: string, paidAmount?: number): Promise<void> {
    const transaction = this.getTransaction(id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }

    const paid = paidDate || new Date().toISOString();
    const amount = paidAmount ?? transaction.amount;

    await this.updateTransaction(id, {
      isPaid: true,
      paidDate: paid,
      paidAmount: amount,
      updatedAt: new Date().toISOString(),
    });

    // Update lastDate if this is an installment (for tracking purposes only)
    if (transaction.isRecurring && transaction.recurringRule?.type === 'installment') {
      await this.updateTransaction(id, {
        recurringRule: {
          ...transaction.recurringRule,
          lastDate: paid,
        },
      });
    }
  }

  /**
   * Mark an installment transaction as unpaid
   * Note: Marking as unpaid does NOT decrement currentTerm - currentTerm is calculated from dates
   */
  async markTransactionUnpaid(id: string): Promise<void> {
    const transaction = this.getTransaction(id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }

    await this.updateTransaction(id, {
      isPaid: false,
      paidDate: undefined,
      paidAmount: undefined,
      updatedAt: new Date().toISOString(),
    });
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
   * Update all installment transactions for a card when card's due date changes
   * Recalculates startDate and endDate based on new due date, preserving the original month
   */
  async syncInstallmentsForCard(cardId: string, newDueDay: number): Promise<void> {
    const allTransactions = this.transactionsSignal();
    const cardInstallments = allTransactions.filter(
      (t) =>
        t.isRecurring &&
        t.recurringRule?.type === 'installment' &&
        t.cardId === cardId &&
        t.recurringRule.startDate,
    );

    if (cardInstallments.length === 0) {
      return;
    }

    const transactionUpdates: Array<{ id: string; updates: Partial<Transaction> }> = [];

    for (const transaction of cardInstallments) {
      if (!transaction.recurringRule?.startDate) continue;

      const oldStartDate = parseISO(transaction.recurringRule.startDate);

      // Preserve the original month/year, just change the day to the new due day
      const newStartDate = setDate(oldStartDate, newDueDay);

      // Recalculate end date based on total terms
      const totalTerms = transaction.recurringRule.totalTerms || 0;
      const newEndDate = addMonths(newStartDate, totalTerms);

      // Recalculate current term based on new start date and current date
      const currentMonth = startOfMonth(new Date());
      const newStartMonth = startOfMonth(newStartDate);
      const diff = differenceInCalendarMonths(currentMonth, newStartMonth);
      const newCurrentTerm = Math.max(1, diff + 1);

      transactionUpdates.push({
        id: transaction.id,
        updates: {
          date: format(newStartDate, 'yyyy-MM-dd'),
          recurringRule: {
            ...transaction.recurringRule,
            startDate: format(newStartDate, 'yyyy-MM-dd'),
            endDate: format(newEndDate, 'yyyy-MM-dd'),
            currentTerm: newCurrentTerm,
          },
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Apply all updates
    for (const { id, updates } of transactionUpdates) {
      await this.updateTransaction(id, updates);
    }
  }

  /**
   * Migration: Delete all orphaned transactions (transactions with cardId that no longer exists)
   */
  async deleteOrphanedTransactions(): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const preview = this.previewOrphanedTransactions();
    const errors: string[] = [];
    let deleted = 0;

    for (const tx of preview.orphaned) {
      try {
        await this.deleteTransaction(tx.id);
        deleted++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Transaction ${tx.id}: ${msg}`);
      }
    }

    return { deleted, errors };
  }

  /**
   * Get all recurring installment transactions
   */
  getInstallmentTransactions(): Transaction[] {
    return this.transactionsSignal().filter(
      (t) => t.isRecurring && t.recurringRule?.type === 'installment',
    );
  }

  /**
   * Get transactions for a specific installment group
   */
  getTransactionsForInstallmentGroup(installmentGroupId: string): Transaction[] {
    return this.transactionsSignal().filter(
      (t) => t.recurringRule?.installmentGroupId === installmentGroupId,
    );
  }

  /**
   * Get installment progress for a group
   * Returns current term, total terms, and completion status
   */
  getInstallmentProgress(installmentGroupId: string): {
    currentTerm: number;
    totalTerms: number;
    completed: number;
    remaining: number;
    isComplete: boolean;
  } {
    const transactions = this.getTransactionsForInstallmentGroup(installmentGroupId);
    if (transactions.length === 0) {
      return { currentTerm: 0, totalTerms: 0, completed: 0, remaining: 0, isComplete: false };
    }

    const firstTransaction = transactions[0];
    const totalTerms = firstTransaction.recurringRule?.totalTerms || 0;
    const completed = transactions.length;
    const currentTerm = Math.max(...transactions.map((t) => t.recurringRule?.currentTerm || 0));

    return {
      currentTerm,
      totalTerms,
      completed,
      remaining: Math.max(0, totalTerms - completed),
      isComplete: completed >= totalTerms,
    };
  }

  /**
   * Get active installments (not yet complete)
   */
  getActiveInstallments(): Transaction[] {
    const installments = this.getInstallmentTransactions();
    return installments.filter((t) => {
      const progress = this.getInstallmentProgress(t.recurringRule?.installmentGroupId || '');
      return !progress.isComplete;
    });
  }

  /**
   * Check if a transaction is 'Projected' (future-dated)
   * Projected transactions have date > today
   */
  isProjectedTransaction(transaction: Transaction): boolean {
    const today = startOfDay(new Date());
    const transactionDate = startOfDay(parseISO(transaction.date));
    return isAfter(transactionDate, today);
  }

  /**
   * Get installment transactions charged to a card
   * (isRecurring, type installment, paymentMethod card, cardId set)
   */
  getCardInstallmentTransactions(): Transaction[] {
    return this.transactionsSignal().filter(
      (t) =>
        t.isRecurring &&
        t.recurringRule?.type === 'installment' &&
        t.paymentMethod === 'card' &&
        !!t.cardId,
    );
  }

  /**
   * Preview migration: count installment transactions charged to a card
   * whose date would change to the card's due date.
   */
  previewInstallmentDateMigration(): {
    total: number;
    wouldUpdate: number;
    byCard: Array<{ cardId: string; cardName: string; count: number }>;
  } {
    const items = this.getCardInstallmentTransactions();
    const byCard = new Map<string, { cardName: string; count: number }>();
    let wouldUpdate = 0;

    for (const t of items) {
      const card = this.cardService.getCardSync(t.cardId!);
      if (!card) continue;

      const dueDate = this.dueDateForMonth(parseISO(t.date), card.dueDay);
      const newDateStr = format(dueDate, 'yyyy-MM-dd');
      if (t.date !== newDateStr) {
        wouldUpdate++;
        const cur = byCard.get(card.id);
        const name = `${card.bankName} ${card.cardName}`;
        if (cur) {
          byCard.set(card.id, { cardName: name, count: cur.count + 1 });
        } else {
          byCard.set(card.id, { cardName: name, count: 1 });
        }
      }
    }

    return {
      total: items.length,
      wouldUpdate,
      byCard: Array.from(byCard.entries()).map(([cardId, { cardName, count }]) => ({
        cardId,
        cardName,
        count,
      })),
    };
  }

  /**
   * Migration: Update all existing installment transactions charged to a card
   * so their date matches the card's due date for that month.
   */
  async migrateInstallmentDatesToCardDueDate(): Promise<{
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    const items = this.getCardInstallmentTransactions();
    const errors: string[] = [];
    let updated = 0;
    let skipped = 0;

    for (const t of items) {
      const card = this.cardService.getCardSync(t.cardId!);
      if (!card) {
        errors.push(`Transaction ${t.id}: card ${t.cardId} not found`);
        continue;
      }

      const dueDate = this.dueDateForMonth(parseISO(t.date), card.dueDay);
      const newDateStr = format(dueDate, 'yyyy-MM-dd');
      if (t.date === newDateStr) {
        skipped++;
        continue;
      }

      try {
        await this.updateTransaction(t.id, {
          date: newDateStr,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Transaction ${t.id}: ${msg}`);
      }
    }

    return { updated, skipped, errors };
  }

  /**
   * Due date for a given month: same year/month, day = dueDay (clamped to last day of month).
   */
  private dueDateForMonth(monthDate: Date, dueDay: number): Date {
    const start = startOfMonth(monthDate);
    const last = lastDayOfMonth(start);
    const day = Math.min(dueDay, getDate(last));
    return setDate(start, day);
  }

  /**
   * Get Current Liquid Balance: Sum of all Income minus Expense where date <= today
   * This represents money that has actually been received/spent
   */
  getCurrentLiquidBalance(profileId: string): number {
    const today = startOfDay(new Date());
    const transactions = this.transactionsSignal().filter(
      (t) => t.profileId === profileId && !t.isVirtual && t.isBudgetImpacting !== false,
    );

    let balance = 0;
    for (const transaction of transactions) {
      const transactionDate = startOfDay(parseISO(transaction.date));

      // Only count transactions up to today
      if (!isAfter(transactionDate, today)) {
        if (transaction.type === 'income') {
          balance += transaction.amount;
        } else {
          balance -= transaction.amount;
        }
      }
    }

    return balance;
  }

  /**
   * Get Projected Income: Sum of all Income where date > today AND date <= endOfMonth
   * This represents expected future income this month
   */
  getProjectedIncome(profileId: string, monthStr?: string): number {
    const today = startOfDay(new Date());
    const monthEnd = monthStr ? endOfMonth(parseISO(`${monthStr}-01`)) : endOfMonth(today);

    const transactions = this.transactionsSignal().filter(
      (t) =>
        t.profileId === profileId &&
        t.type === 'income' &&
        !t.isVirtual &&
        t.isBudgetImpacting !== false,
    );

    let projectedIncome = 0;
    for (const transaction of transactions) {
      const transactionDate = startOfDay(parseISO(transaction.date));

      // Only count future transactions within the month
      if (isAfter(transactionDate, today) && !isAfter(transactionDate, monthEnd)) {
        projectedIncome += transaction.amount;
      }
    }

    return projectedIncome;
  }

  /**
   * Get Committed Expenses: Sum of all Expenses (including Virtual Installments and Bills)
   * where date > today AND date <= endOfMonth
   * This represents expected future expenses this month
   */
  getCommittedExpenses(profileId: string, monthStr?: string): number {
    const today = startOfDay(new Date());
    const monthEnd = monthStr ? endOfMonth(parseISO(`${monthStr}-01`)) : endOfMonth(today);

    const transactions = this.transactionsSignal().filter(
      (t) => t.profileId === profileId && t.type === 'expense' && t.isBudgetImpacting !== false,
    );

    let committedExpenses = 0;
    for (const transaction of transactions) {
      const transactionDate = startOfDay(parseISO(transaction.date));

      // Count future expenses within the month (including virtual transactions)
      if (isAfter(transactionDate, today) && !isAfter(transactionDate, monthEnd)) {
        committedExpenses += transaction.amount;
      }
    }

    return committedExpenses;
  }

  private async initializeTransactions(): Promise<void> {
    const db = this.idb.getDB();
    const data = await db.getAll<Transaction>(STORES.TRANSACTIONS);
    const migrated = this.migrateTransactionsForParentVirtualFields(data);
    this.transactionsSignal.set(migrated);
    if (migrated !== data) {
      await db.putAll(STORES.TRANSACTIONS, migrated);
    }
  }

  /**
   * Watch for card due date changes and sync installments
   */
  private setupCardChangeWatcher(): void {
    effect(() => {
      const cards = this.cardService.cards();

      // Check each card for dueDay changes
      for (const card of cards) {
        const previousDueDay = this.previousCards.get(card.id);

        // If dueDay changed, sync installments
        if (previousDueDay !== undefined && previousDueDay !== card.dueDay) {
          void this.syncInstallmentsForCard(card.id, card.dueDay);
        }

        // Update tracking
        this.previousCards.set(card.id, card.dueDay);
      }

      // Remove cards that no longer exist
      const currentCardIds = new Set(cards.map((c) => c.id));
      for (const cardId of this.previousCards.keys()) {
        if (!currentCardIds.has(cardId)) {
          this.previousCards.delete(cardId);
        }
      }
    });
  }

  private setupAutoSave(): void {
    effect(() => {
      if (this.profileService.isLoaded()) {
        void this.idb.getDB().putAll(STORES.TRANSACTIONS, this.transactionsSignal());
      }
    });
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
    // Use postingDate for cutoff calculation if available, otherwise use transaction date
    const dateForCutoff = transaction.postingDate
      ? parseISO(transaction.postingDate)
      : parseISO(transaction.date);
    const dayOfMonth = dateForCutoff.getDate();

    // Determine statement month based on cutoff day
    let statementDate: Date;
    if (dayOfMonth >= card.cutoffDay) {
      // Transaction is at or after cutoff → belongs to NEXT month's statement
      statementDate = addMonths(startOfMonth(dateForCutoff), 1);
    } else {
      // Transaction is before cutoff → belongs to THIS month's statement
      statementDate = startOfMonth(dateForCutoff);
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
    // Use postingDate for cutoff calculation if available, otherwise use transaction date
    const dateForCutoff = transaction.postingDate
      ? parseISO(transaction.postingDate)
      : parseISO(transaction.date);
    const dayOfMonth = dateForCutoff.getDate();

    let statementDate: Date;
    if (dayOfMonth >= card.cutoffDay) {
      statementDate = addMonths(startOfMonth(dateForCutoff), 1);
    } else {
      statementDate = startOfMonth(dateForCutoff);
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

  /**
   * Generate virtual transactions for an installment parent transaction
   * Creates one transaction per term, each marked as virtual and budget-impacting
   */
  private async generateVirtualTransactions(parent: Transaction): Promise<Transaction[]> {
    if (!parent.recurringRule || parent.recurringRule.type !== 'installment') {
      return [];
    }

    const { totalTerms, startDate, monthlyAmortization, totalPrincipal } = parent.recurringRule;
    if (!totalTerms || !startDate) {
      return [];
    }

    // Use monthlyAmortization from recurringRule, or calculate from totalPrincipal
    const monthlyAmount =
      monthlyAmortization ||
      (totalPrincipal ? totalPrincipal / totalTerms : parent.amount / totalTerms);
    const start = parseISO(startDate);
    const virtualTransactions: Transaction[] = [];

    for (let term = 1; term <= totalTerms; term++) {
      const termDate = addMonths(start, term - 1);
      const virtualTx: Transaction = {
        id: crypto.randomUUID(),
        profileId: parent.profileId,
        type: parent.type,
        amount: monthlyAmount,
        date: format(termDate, 'yyyy-MM-dd'),
        categoryId: parent.categoryId,
        subcategoryId: parent.subcategoryId,
        description: `${parent.description} (${term}/${totalTerms})`,
        notes: parent.notes,
        paymentMethod: parent.paymentMethod,
        cardId: parent.cardId,
        bankId: parent.bankId,
        fromBankId: parent.fromBankId,
        toBankId: parent.toBankId,
        transferFee: parent.transferFee,
        tags: parent.tags,
        createdAt: parent.createdAt,
        updatedAt: parent.updatedAt,
        isRecurring: true,
        recurringRule: {
          ...parent.recurringRule,
          currentTerm: term,
        },
        isEstimate: parent.isEstimate,
        isPaid: false,
        parentTransactionId: parent.id,
        isVirtual: true,
        isBudgetImpacting: true, // Virtual transactions impact budget
      };

      virtualTransactions.push(virtualTx);
    }

    return virtualTransactions;
  }

  /**
   * Migration: backfill isVirtual and isBudgetImpacting for existing transactions
   * created before the parent/virtual installment model. Ensures legacy installments
   * are not hidden as "parents" and all transactions have explicit flags.
   */
  private migrateTransactionsForParentVirtualFields(transactions: Transaction[]): Transaction[] {
    let changed = false;
    const result = transactions.map((t) => {
      let isVirtual = t.isVirtual;
      let isBudgetImpacting = t.isBudgetImpacting;
      if (isVirtual === undefined) {
        isVirtual = false;
        changed = true;
      }
      if (isBudgetImpacting === undefined) {
        isBudgetImpacting = true;
        changed = true;
      }
      return { ...t, isVirtual, isBudgetImpacting };
    });
    return changed ? result : transactions;
  }
}
