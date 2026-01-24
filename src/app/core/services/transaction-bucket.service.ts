import { inject, Injectable } from '@angular/core';
import { TransactionService } from './transaction.service';
import { CardService } from './card.service';
import { StatementService } from './statement.service';
import { BankBalanceService } from './bank-balance.service';
import { ProfileService } from './profile.service';
import type { StatementPeriod, Transaction, TransactionBucket } from '@shared/types';
import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  getDate,
  isAfter,
  isBefore,
  lastDayOfMonth,
  parseISO,
  setDate,
  startOfMonth
} from 'date-fns';

/**
 * Transaction Bucket Service
 * Categorizes transactions into three buckets:
 * 1. Direct Expense: Cash/Debit/One-time CC charges
 * 2. Recurring Bill: Fixed monthly costs (Netflix, Internet)
 * 3. Installment: Long-tail items with terms
 */
@Injectable({
  providedIn: 'root',
})
export class TransactionBucketService {
  private transactionService = inject(TransactionService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  private bankBalanceService = inject(BankBalanceService);
  private profileService = inject(ProfileService);

  /**
   * Categorize a transaction into one of the three buckets
   */
  getTransactionBucket(transaction: Transaction): TransactionBucket {
    // Installment: Has recurring rule with type 'installment'
    if (transaction.isRecurring && transaction.recurringRule?.type === 'installment') {
      return 'installment';
    }

    // Recurring Bill: Has recurring rule but not installment (subscription/custom)
    if (transaction.isRecurring && transaction.recurringRule?.type !== 'installment') {
      return 'recurring';
    }

    // Direct Expense: Everything else (one-time transactions)
    return 'direct';
  }

  /**
   * Get all transactions categorized by bucket
   */
  getTransactionsByBucket(transactions: Transaction[]): {
    direct: Transaction[];
    recurring: Transaction[];
    installment: Transaction[];
  } {
    const buckets = {
      direct: [] as Transaction[],
      recurring: [] as Transaction[],
      installment: [] as Transaction[],
    };

    for (const transaction of transactions) {
      const bucket = this.getTransactionBucket(transaction);
      buckets[bucket].push(transaction);
    }

    return buckets;
  }

  /**
   * Get statement period for a card based on cutoff day
   * Returns the period (start/end dates) for a given month string
   */
  getStatementPeriod(cardId: string, monthStr: string): StatementPeriod | null {
    const card = this.cardService.getCardSync(cardId);
    if (!card) return null;

    // Parse the month string (yyyy-MM)
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);

    // Statement period: from cutoff day of previous month to cutoff day - 1 of current month
    // Example: If cutoff is 20, statement period for Feb is Jan 20 - Feb 19
    const prevMonth = addMonths(monthStart, -1);
    const cutoffDay = card.cutoffDay;

    // Start: cutoff day of previous month
    const periodStart = setDate(prevMonth, Math.min(cutoffDay, getDate(lastDayOfMonth(prevMonth))));

    // End: cutoff day - 1 of current month
    const periodEnd = setDate(
      monthStart,
      Math.min(cutoffDay - 1, getDate(lastDayOfMonth(monthStart))),
    );

    // If cutoff is 1, end should be last day of previous month
    if (cutoffDay === 1) {
      const lastDay = lastDayOfMonth(prevMonth);
      return {
        start: format(setDate(prevMonth, 1), 'yyyy-MM-dd'),
        end: format(lastDay, 'yyyy-MM-dd'),
        monthStr,
      };
    }

    return {
      start: format(periodStart, 'yyyy-MM-dd'),
      end: format(periodEnd, 'yyyy-MM-dd'),
      monthStr,
    };
  }

  /**
   * Get transactions for a statement period (not just calendar month)
   */
  getTransactionsForStatementPeriod(
    cardId: string,
    monthStr: string,
    transactions: Transaction[],
  ): Transaction[] {
    const period = this.getStatementPeriod(cardId, monthStr);
    if (!period) return [];

    return transactions.filter((t) => {
      if (t.paymentMethod !== 'card' || t.cardId !== cardId) return false;

      const transactionDate = t.date;
      return transactionDate >= period.start && transactionDate <= period.end;
    });
  }

  /**
   * Calculate buffer: Total Balance - Total Credit Card Debt
   * Returns negative value if debt exceeds balance (danger zone)
   */
  calculateBuffer(
    profileId: string,
    monthStr: string,
  ): {
    totalBalance: number;
    totalCreditCardDebt: number;
    buffer: number;
    isDangerZone: boolean;
  } {
    // Get total bank balance
    const totalBalance = this.bankBalanceService.getBankBalance(profileId, monthStr) || 0;

    // Get all credit card statements for this month
    const cards = this.cardService.getCardsForProfiles([profileId]);
    let totalCreditCardDebt = 0;

    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement && !statement.isPaid) {
        totalCreditCardDebt += statement.amount || 0;
      }
    }

    const buffer = totalBalance - totalCreditCardDebt;
    const isDangerZone = buffer < 0;

    return {
      totalBalance,
      totalCreditCardDebt,
      buffer,
      isDangerZone,
    };
  }

  /**
   * Auto-increment current term for an installment based on start date
   */
  calculateCurrentTerm(startDate: string, viewDate: Date = new Date()): number {
    try {
      const start = parseISO(startDate);
      const currentMonth = startOfMonth(viewDate);
      const startMonth = startOfMonth(start);

      const diff = differenceInCalendarMonths(currentMonth, startMonth);
      return Math.max(1, diff + 1);
    } catch {
      return 1;
    }
  }

  /**
   * Check if a transaction is a parent transaction (for installments).
   * Only explicit parents (created via new installment flow) have isBudgetImpacting === false.
   * Legacy installment transactions (individual monthly payments) lack this field and must not be hidden.
   */
  isParentTransaction(transaction: Transaction): boolean {
    return (
      transaction.isRecurring === true &&
      transaction.recurringRule?.type === 'installment' &&
      !transaction.isVirtual &&
      !transaction.parentTransactionId &&
      transaction.isBudgetImpacting === false
    );
  }

  /**
   * Check if a transaction is a virtual transaction
   */
  isVirtualTransaction(transaction: Transaction): boolean {
    return Boolean(transaction.isVirtual || transaction.parentTransactionId);
  }

  /**
   * Get virtual transactions for a parent transaction
   */
  getVirtualTransactions(parentId: string, allTransactions: Transaction[]): Transaction[] {
    return allTransactions.filter(
      (t) => t.parentTransactionId === parentId || (t.isVirtual && t.id === parentId),
    );
  }

  /**
   * Check if a transaction belongs to the current month's bucket
   * This ensures future-dated income is included in the current month if date <= endOfMonth
   * Used for forecasting calculations
   */
  belongsToCurrentMonth(transaction: Transaction, monthStr: string): boolean {
    const transactionDate = parseISO(transaction.date);
    const monthStart = startOfMonth(parseISO(`${monthStr}-01`));
    const monthEnd = endOfMonth(monthStart);

    // Transaction belongs to this month if its date is within the month range
    return !isBefore(transactionDate, monthStart) && !isAfter(transactionDate, monthEnd);
  }

  /**
   * Get transactions for a specific month bucket (including future-dated transactions)
   * This ensures future-dated income is included in the current month's calculations
   */
  getTransactionsForMonth(transactions: Transaction[], monthStr: string): Transaction[] {
    return transactions.filter((t) => this.belongsToCurrentMonth(t, monthStr));
  }
}
