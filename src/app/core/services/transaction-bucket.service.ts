import { inject, Injectable } from '@angular/core';
import { CardService } from './card.service';
import { StatementService } from './statement.service';
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
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
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
   * Get statement period for a card based on settlement day
   * Returns the period (start/end dates) for a given month string
   */
  getStatementPeriod(cardId: string, monthStr: string): StatementPeriod | null {
    const card = this.cardService.getCardSync(cardId);
    if (!card) return null;

    // Parse the month string (yyyy-MM)
    // monthStr is now the Payment Month (e.g. Feb)
    const [year, month] = monthStr.split('-').map(Number);
    // Shift back to get the Settlement Month (e.g. Jan) logic uses
    const monthStart = addMonths(new Date(year, month - 1, 1), -1);

    // Statement period: from settlement day of previous month to settlement day - 1 of current month
    // Example: If settlement is 20, statement period for Feb is Jan 20 - Feb 19
    const prevMonth = addMonths(monthStart, -1);
    const settlementDay = card.settlementDay;

    // Start: settlement day of previous month
    const periodStart = setDate(prevMonth, Math.min(settlementDay, getDate(lastDayOfMonth(prevMonth))));

    // End: settlement day - 1 of current month
    const periodEnd = setDate(
      monthStart,
      Math.min(settlementDay - 1, getDate(lastDayOfMonth(monthStart))),
    );

    // If settlement is 1, end should be last day of previous month
    if (settlementDay === 1) {
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

  /**
   * Get payment month for a transaction based on Settlement Date (SD) and Payment Date (PD) logic
   * 
   * Logic:
   * 1. Determine Cycle Shift: If dayOfMonth >= settlementDay, cycleShift = 1 (belongs to next month's settlement). Otherwise, cycleShift = 0.
   * 2. Determine Payment Offset: If paymentDay < settlementDay, paymentShift = 1 (pays the following month). Otherwise, paymentShift = 0 (pays the same month).
   * 3. Return Value: addMonths(startOfMonth(date), cycleShift + paymentShift)
   * 
   * Examples:
   * - Card A (SD 21, PD 12): Dec 22 -> (1+1) -> Feb
   * - Card B (SD 9, PD 27): Jan 10 -> (1+0) -> Feb
   * 
   * @param date Transaction date
   * @param card Card with settlementDay and paymentDay
   * @returns Date representing the start of the payment month
   */
  getPaymentMonth(date: Date, card: { settlementDay: number; paymentDay: number }): Date {
    const dayOfMonth = getDate(date);
    const settlementDay = card.settlementDay;
    const paymentDay = card.paymentDay;

    // Determine Cycle Shift: If dayOfMonth >= settlementDay, cycleShift = 1, else cycleShift = 0
    const cycleShift = dayOfMonth >= settlementDay ? 1 : 0;

    // Determine Payment Offset: If paymentDay < settlementDay, paymentShift = 1, else paymentShift = 0
    const paymentShift = paymentDay < settlementDay ? 1 : 0;

    // Return: addMonths(startOfMonth(date), cycleShift + paymentShift)
    return addMonths(startOfMonth(date), cycleShift + paymentShift);
  }

  /**
   * Get assigned payment date for a transaction based on Settlement Date (SD) and Payment Date (PD) model
   * 
   * Step 1: Determine the Settlement Month
   *   - If txnDate.day > card.settlementDay, settlement occurs in txnDate.month + 1
   *   - Otherwise, it's txnDate.month
   * 
   * Step 2: Determine the Payment Month
   *   - If card.paymentDay > card.settlementDay, payment is in the SAME month as settlement
   *   - If card.paymentDay < card.settlementDay, payment is in the month AFTER settlement
   * 
   * Step 3: Check Overrides
   *   - Query StatementService for a manual override for that specific Settlement Month/Year
   *   - If found, return the manualPaymentDate
   * 
   * Step 4: Fallback
   *   - Return the calculated date using the paymentDay and the determined Payment Month/Year
   * 
   * @param txnDate Transaction date
   * @param card Card with settlementDay and paymentDay
   * @returns Date when payment is due (ISO string)
   */
  getAssignedPaymentDate(txnDate: Date, card: { settlementDay: number; paymentDay: number; id: string }): Date {
    // Step 1: Determine Settlement Month
    const txnDay = getDate(txnDate);
    const settlementDay = card.settlementDay;
    let settlementMonth: Date;
    
    if (txnDay > settlementDay) {
      // Settlement occurs in the next month
      settlementMonth = addMonths(startOfMonth(txnDate), 1);
    } else {
      // Settlement occurs in the same month as transaction
      settlementMonth = startOfMonth(txnDate);
    }

    // Step 2: Determine Payment Month
    const paymentDay = card.paymentDay;
    let paymentMonth: Date;
    if (paymentDay > settlementDay) {
      // Payment is in the SAME month as settlement
      paymentMonth = settlementMonth;
    } else {
      // Payment is in the month AFTER settlement
      paymentMonth = addMonths(settlementMonth, 1);
    }

    // Step 3: Check for manual overrides
    const settlementMonthStr = format(settlementMonth, 'yyyy-MM');
    const statement = this.statementService.getStatementForMonth(card.id, settlementMonthStr);
    
    if (statement?.manualPaymentDate) {
      // Use manual override
      return parseISO(statement.manualPaymentDate);
    }

    // Step 4: Calculate payment date using paymentDay and paymentMonth
    const paymentYear = paymentMonth.getFullYear();
    const paymentMonthIndex = paymentMonth.getMonth();
    const lastDayOfPaymentMonth = getDate(lastDayOfMonth(paymentMonth));
    const finalPaymentDay = Math.min(paymentDay, lastDayOfPaymentMonth);
    
    return new Date(paymentYear, paymentMonthIndex, finalPaymentDay);
  }
}
