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
import { UtilsService } from './utils.service';
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
    private utils: UtilsService,
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
   * Update an installment plan
   * Updates the parent transaction and synchronizes all virtual transactions
   * Preserves paid status and notes of existing terms where possible
   */
  async updateInstallmentPlan(
    transactionId: string,
    updates: Partial<Transaction>,
  ): Promise<void> {
    const allTransactions = this.transactionsSignal();
    const original = allTransactions.find((t) => t.id === transactionId);
    if (!original) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // 1. Identify Parent Transaction
    let parentTransaction: Transaction | undefined;
    
    // Check if original is a parent transaction (logic from TransactionBucketService to avoid circular dep)
    const isParent = 
      original.isRecurring === true &&
      original.recurringRule?.type === 'installment' &&
      !original.isVirtual &&
      !original.parentTransactionId &&
      original.isBudgetImpacting === false;

    if (isParent) {
      parentTransaction = original;
    } else if (original.parentTransactionId) {
      parentTransaction = allTransactions.find((t) => t.id === original.parentTransactionId);
    }

    // If no parent found (legacy installment or not an installment), treat as single update
    // But if it's an installment type update, we should probably try to migrate/fix it.
    // For now, if no parent, just update the single transaction or throw error if it's supposed to be a plan.
    if (!parentTransaction) {
      // If the user is trying to convert a single transaction into an installment plan,
      // we need to handle that (create parent + virtuals).
      if (
        updates.isRecurring &&
        updates.recurringRule?.type === 'installment' &&
        !original.parentTransactionId &&
        !original.isVirtual
      ) {
        // This is a conversion from single -> installment
        // Delete original (it will be replaced by parent + virtuals)
        await this.deleteTransaction(original.id);
        // Add as new transaction (addTransaction handles parent/virtual creation)
        await this.addTransaction({ ...original, ...updates, id: original.id });
        return;
      }

      // Otherwise just standard update
      await this.updateTransaction(transactionId, updates);
      return;
    }

    // 2. Update Parent Transaction
    // Merge updates into parent, ensuring recurringRule is fully updated
    const updatedParent = {
      ...parentTransaction,
      ...updates,
      // Ensure we keep the parent flags
      isVirtual: false,
      isBudgetImpacting: false,
      parentTransactionId: undefined,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate monthly amortization if needed
    // Only recalculate if monthlyAmortization is NOT explicitly provided in the update
    // This allows manual overrides (e.g. for rounding)
    const manualAmortization = updates.recurringRule?.monthlyAmortization;
    
    if (
      !manualAmortization &&
      updatedParent.recurringRule?.type === 'installment' &&
      updatedParent.recurringRule.totalPrincipal &&
      updatedParent.recurringRule.totalTerms
    ) {
      updatedParent.recurringRule.monthlyAmortization =
        updatedParent.recurringRule.totalPrincipal / updatedParent.recurringRule.totalTerms;
    }

    // Save updated parent
    this.transactionsSignal.update((prev) =>
      prev.map((t) => (t.id === updatedParent.id ? updatedParent : t)),
    );

    // 3. Sync Virtual Transactions
    if (updatedParent.recurringRule?.type !== 'installment') {
        return; // Should not happen given check above
    }

    const { totalTerms, startDate, monthlyAmortization } = updatedParent.recurringRule;
    if (!totalTerms || !startDate) return;

    const start = parseISO(startDate);
    const existingVirtuals = allTransactions.filter(
      (t) => t.parentTransactionId === updatedParent.id,
    );

    // Process each term
    for (let term = 1; term <= totalTerms; term++) {
      const termDate = addMonths(start, term - 1);
      const dateStr = format(termDate, 'yyyy-MM-dd');
      
      const existingTerm = existingVirtuals.find(
        (t) => t.recurringRule?.currentTerm === term
      );

      // Determine posting date for this term
      // If parent has a postingDate, apply it ONLY to the first term (Term 1)
      // Otherwise, leave undefined (virtual transactions usually use date as posting date implicitly)
      let termPostingDate: string | undefined;
      if (term === 1 && updatedParent.postingDate) {
        termPostingDate = updatedParent.postingDate;
      }

      if (existingTerm) {
        // Update existing term
        const updatedTerm: Transaction = {
          ...existingTerm,
          // Update common fields from parent/form
          type: updatedParent.type,
          categoryId: updatedParent.categoryId,
          subcategoryId: updatedParent.subcategoryId,
          description: `${updatedParent.description} (${term}/${totalTerms})`,
          // Notes: if user edited notes in the form, apply to all. 
          // If updates.notes is present, use it. Otherwise keep existing (or parent's).
          // Strategy: Use parent's notes (which came from form) as the base.
          notes: updatedParent.notes, 
          paymentMethod: updatedParent.paymentMethod,
          cardId: updatedParent.cardId,
          bankId: updatedParent.bankId,
          fromBankId: updatedParent.fromBankId,
          toBankId: updatedParent.toBankId,
          transferFee: updatedParent.transferFee,
          tags: updatedParent.tags,
          isEstimate: updatedParent.isEstimate,
          paidByOther: updatedParent.paidByOther,
          paidByOtherProfileId: updatedParent.paidByOtherProfileId,
          paidByOtherName: updatedParent.paidByOtherName,
          
          // Update schedule fields
          date: dateStr,
          postingDate: termPostingDate, // Apply posting date logic
          amount: monthlyAmortization || 0,
          recurringRule: {
            ...updatedParent.recurringRule,
            currentTerm: term,
          },
          updatedAt: new Date().toISOString(),
        };

        // If card/date changed, we need to handle bill linking (remove from old, add to new)
        const dateChanged = existingTerm.date !== updatedTerm.date;
        const cardChanged = existingTerm.cardId !== updatedTerm.cardId;
        const amountChanged = existingTerm.amount !== updatedTerm.amount;
        // Also check if postingDate changed, as it affects bill cycle
        const postingDateChanged = existingTerm.postingDate !== updatedTerm.postingDate;

        if (existingTerm.paymentMethod === 'card' && existingTerm.cardId && (cardChanged || dateChanged || amountChanged || postingDateChanged)) {
             await this.removeFromBill(existingTerm);
        }

        // Update in signal
        this.transactionsSignal.update((prev) =>
          prev.map((t) => (t.id === existingTerm.id ? updatedTerm : t)),
        );

        // Add to new bill if needed
        if (updatedTerm.paymentMethod === 'card' && updatedTerm.cardId && (cardChanged || dateChanged || amountChanged || postingDateChanged)) {
            await this.autoCreateOrUpdateBill(updatedTerm);
        }

      } else {
        // Create new term (extended plan)
        const newTerm: Transaction = {
          id: crypto.randomUUID(),
          profileId: updatedParent.profileId,
          type: updatedParent.type,
          amount: monthlyAmortization || 0,
          date: dateStr,
          postingDate: termPostingDate, // Apply posting date logic
          categoryId: updatedParent.categoryId,
          subcategoryId: updatedParent.subcategoryId,
          description: `${updatedParent.description} (${term}/${totalTerms})`,
          notes: updatedParent.notes,
          paymentMethod: updatedParent.paymentMethod,
          cardId: updatedParent.cardId,
          bankId: updatedParent.bankId,
          fromBankId: updatedParent.fromBankId,
          toBankId: updatedParent.toBankId,
          transferFee: updatedParent.transferFee,
          tags: updatedParent.tags,
          paidByOther: updatedParent.paidByOther,
          paidByOtherProfileId: updatedParent.paidByOtherProfileId,
          paidByOtherName: updatedParent.paidByOtherName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isRecurring: true,
          recurringRule: {
            ...updatedParent.recurringRule,
            currentTerm: term,
          },
          isEstimate: updatedParent.isEstimate,
          isPaid: false,
          parentTransactionId: updatedParent.id,
          isVirtual: true,
          isBudgetImpacting: true,
        };

        this.transactionsSignal.update((prev) => [...prev, newTerm]);
        
        if (newTerm.paymentMethod === 'card' && newTerm.cardId) {
            await this.autoCreateOrUpdateBill(newTerm);
        }
      }
    }

    // 4. Cleanup Extra Terms (if plan shortened)
    const extraTerms = existingVirtuals.filter(
        (t) => (t.recurringRule?.currentTerm || 0) > totalTerms
    );
    
    for (const extra of extraTerms) {
        // Remove from bill first
        if (extra.paymentMethod === 'card' && extra.cardId) {
            await this.removeFromBill(extra);
        }
        // Remove from signal
        this.transactionsSignal.update((prev) => prev.filter(t => t.id !== extra.id));
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
   * ⭐ IMPORTANT: Uses postingDate for cutoff calculation if available (same logic as autoCreateOrUpdateBill)
   */
  getTransactionsForStatement(cardId: string, monthStr: string, cutoffDayOverride?: number): Transaction[] {
    const card = this.cardService.getCardSync(cardId);
    if (!card) return [];

    // Use override if provided, otherwise card default
    const cutoffDay = cutoffDayOverride ?? card.cutoffDay;

    // Get all card transactions
    const allCardTransactions = this.transactionsSignal().filter(
      (t) => t.paymentMethod === 'card' && t.cardId === cardId,
    );

    // Filter transactions that belong to this statement month based on cutoff logic
    return allCardTransactions.filter((t) => {
      // ⭐ CUTOFF-AWARE: Use shared utility function (matches autoCreateOrUpdateBill logic)
      const transactionMonthStr = this.utils.getStatementMonthStrForTransaction(t, cutoffDay);
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
   * Delete an installment plan (parent and all related virtual transactions)
   */
  async deleteInstallmentPlan(installmentGroupId: string): Promise<void> {
    const allTransactions = this.transactionsSignal();
    const toDelete = allTransactions.filter(
      (t) => t.recurringRule?.installmentGroupId === installmentGroupId,
    );

    for (const t of toDelete) {
      await this.deleteTransaction(t.id);
    }
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
    const targetDate = monthStr ? parseISO(`${monthStr}-01`) : today;
    const monthEnd = endOfMonth(targetDate);
    const targetMonthStr = format(targetDate, 'yyyy-MM');

    // 1. Non-card expenses (Cash, Bank Transfer, etc.)
    const transactions = this.transactionsSignal().filter(
      (t) =>
        t.profileId === profileId &&
        t.type === 'expense' &&
        t.isBudgetImpacting !== false &&
        t.paymentMethod !== 'card', // Exclude card transactions (handled via statements)
    );

    let committedExpenses = 0;
    for (const transaction of transactions) {
      const transactionDate = startOfDay(parseISO(transaction.date));

      // Count future expenses within the month (including virtual transactions)
      if (isAfter(transactionDate, today) && !isAfter(transactionDate, monthEnd)) {
        committedExpenses += transaction.amount;
      }
    }

    // 2. Card Statements (Bills due this month)
    // For forecasting, we care about cash outflow (bill payments), not individual charges
    const cards = this.cardService.getCardsForProfiles([profileId]);
    for (const card of cards) {
      // Get the statement that is due in this month (Payment Month)
      const statement = this.statementService.getStatementForMonth(card.id, targetMonthStr);
      
      if (statement && !statement.isPaid) {
        const amount = statement.amount || 0;
        const paid = statement.paidAmount || 0;
        const remaining = Math.max(0, amount - paid);
        
        if (remaining > 0) {
          committedExpenses += remaining;
        }
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
    // Use shared utility function for consistent cutoff-aware logic
    const statementDate = this.utils.getStatementMonthForTransaction(transaction, card.cutoffDay);
    const monthStr = format(statementDate, 'yyyy-MM');

    // Get existing statement or prepare to create new one
    const existingStatement = this.statementService.getStatementForMonth(cardId, monthStr);

    // For income transactions on cards (refunds), subtract from bill amount
    // For expense transactions on cards, add to bill amount
    const amountToApply = transaction.type === 'income' ? -transaction.amount : transaction.amount;

    if (!existingStatement) {
      // AUTO-CREATE: New monthly bill
      // For refunds (income), start with negative amount; for charges, positive
      const dueDate = new Date(statementDate.getFullYear(), statementDate.getMonth(), card.dueDay);

      this.statementService.updateStatement(cardId, monthStr, {
        amount: amountToApply,
        isPaid: false,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        customDueDate: format(dueDate, 'yyyy-MM-dd'),
      });

      console.log(
        `✅ Bill auto-created: ${card.cardName} - ${monthStr} (cutoff: ${card.cutoffDay}) - $${amountToApply} ${transaction.type === 'income' ? '(refund)' : ''}`,
      );
    } else {
      // UPDATE: Add/subtract from existing bill
      const newAmount = (existingStatement.amount || 0) + amountToApply;
      this.statementService.updateStatement(cardId, monthStr, {
        amount: newAmount,
      });

      console.log(
        `✅ Bill updated: ${card.cardName} - ${monthStr} - New total: $${newAmount} ${transaction.type === 'income' ? '(refund applied)' : ''}`,
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
    // Use shared utility function for consistent cutoff-aware logic
    const statementDate = this.utils.getStatementMonthForTransaction(transaction, card.cutoffDay);
    const monthStr = format(statementDate, 'yyyy-MM');
    const statement = this.statementService.getStatementForMonth(transaction.cardId, monthStr);

    if (statement) {
      // When removing, reverse the effect: income transactions added negative, so subtract negative (add)
      // Expense transactions added positive, so subtract positive
      const amountToReverse = transaction.type === 'income' ? -transaction.amount : transaction.amount;
      const newAmount = Math.max(0, (statement.amount || 0) - amountToReverse);
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
      // Determine posting date for this term
      // If parent has a postingDate, apply it ONLY to the first term (Term 1)
      // Otherwise, leave undefined (virtual transactions usually use date as posting date implicitly)
      let termPostingDate: string | undefined;
      if (term === 1 && parent.postingDate) {
        termPostingDate = parent.postingDate;
      }

      const virtualTx: Transaction = {
        id: crypto.randomUUID(),
        profileId: parent.profileId,
        type: parent.type,
        amount: monthlyAmount,
        date: format(termDate, 'yyyy-MM-dd'),
        postingDate: termPostingDate, // Apply posting date logic
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
        paidByOther: parent.paidByOther,
        paidByOtherProfileId: parent.paidByOtherProfileId,
        paidByOtherName: parent.paidByOtherName,
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
