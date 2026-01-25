import { Injectable } from '@angular/core';
import { addMonths, differenceInCalendarMonths, format, parseISO, startOfMonth } from 'date-fns';
import type { Installment, InstallmentStatus, Transaction } from '@shared/types';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
  /**
   * Get installment status for a given date
   */
  getInstallmentStatus(installment: Installment, viewDate: Date): InstallmentStatus {
    const start = parseISO(installment.startDate);
    const currentMonth = startOfMonth(viewDate);
    const startMonth = startOfMonth(start);

    const diff = differenceInCalendarMonths(currentMonth, startMonth);
    const currentTerm = diff + 1;

    const isActive = currentTerm >= 1 && currentTerm <= installment.terms;
    const isFinished = currentTerm > installment.terms;
    const isUpcoming = currentTerm < 1;

    return {
      currentTerm,
      totalTerms: installment.terms,
      monthlyAmount: installment.monthlyAmortization,
      isActive,
      isFinished,
      isUpcoming,
    };
  }

  /**
   * Format a number as currency
   */
  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Format a date string
   */
  formatDate(dateStr: string, formatStr: string = 'MMM dd, yyyy'): string {
    try {
      const date = parseISO(dateStr);
      return format(date, formatStr);
    } catch {
      return dateStr;
    }
  }

  /**
   * Get the payment month date for a transaction based on Settlement Date (SD) and Payment Date (PD) logic
   * Uses postingDate if available, otherwise falls back to transaction date
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param settlementDay The card's settlement day (1-31)
   * @param paymentDay The card's payment day (1-31)
   * @returns Date representing the start of the payment month
   */
  getPaymentMonthForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, settlementDay: number, paymentDay: number): Date {
    // Use postingDate for settlement calculation if available
    const dateToUse = transaction.postingDate ? parseISO(transaction.postingDate) : parseISO(transaction.date);
    const isPostingDate = !!transaction.postingDate;

    if (transaction.recurringRule?.type === 'installment') {
      return startOfMonth(parseISO(transaction.date));
    }

    return this.getPaymentMonth(dateToUse, settlementDay, paymentDay, isPostingDate);
  }

  /**
   * @deprecated Use getPaymentMonthForTransaction instead. This method is kept for backward compatibility.
   * Get the statement month date for a transaction based on settlement-aware logic
   * Uses postingDate if available, otherwise falls back to transaction date
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param settlementDay The card's settlement day (1-31) - replaces cutoffDay
   * @returns Date representing the start of the statement month
   */
  getStatementMonthForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, settlementDay: number): Date {
    // Use postingDate for settlement calculation if available
    if (transaction.postingDate) {
      return this.getStatementMonth(parseISO(transaction.postingDate), settlementDay, true);
    }

    if (transaction.recurringRule?.type === 'installment') {
      return startOfMonth(parseISO(transaction.date));
    }

    return this.getStatementMonth(parseISO(transaction.date), settlementDay, false);
  }

  /**
   * Get the payment month date based on Settlement Date (SD) and Payment Date (PD) logic
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
   * @param dateForSettlement The date to use for settlement calculation (transaction date or posting date)
   * @param settlementDay The card's settlement day (1-31)
   * @param paymentDay The card's payment day (1-31) - required for new logic
   * @param isPostingDate Whether the date is a posting date (affects boundary condition)
   * @returns Date representing the start of the payment month
   */
  getPaymentMonth(dateForSettlement: Date, settlementDay: number, paymentDay: number, isPostingDate: boolean = false): Date {
    const dayOfMonth = dateForSettlement.getDate();
    
    // Determine Cycle Shift: If dayOfMonth >= settlementDay, cycleShift = 1, else cycleShift = 0
    // For posting dates, use > instead of >= (boundary condition)
    const cycleShift = isPostingDate 
      ? (dayOfMonth > settlementDay ? 1 : 0)
      : (dayOfMonth >= settlementDay ? 1 : 0);

    // Determine Payment Offset: If paymentDay < settlementDay, paymentShift = 1, else paymentShift = 0
    const paymentShift = paymentDay < settlementDay ? 1 : 0;

    // Return: addMonths(startOfMonth(date), cycleShift + paymentShift)
    return addMonths(startOfMonth(dateForSettlement), cycleShift + paymentShift);
  }

  /**
   * @deprecated Use getPaymentMonth instead. This method is kept for backward compatibility.
   * Get the statement month date based on settlement-aware logic
   * 
   * Logic:
   * - If transaction day >= settlementDay: belongs to NEXT month's statement (Payment Month logic)
   * - If transaction day < settlementDay: belongs to THIS month's statement (Payment Month logic)
   * 
   * @param dateForSettlement The date to use for settlement calculation (transaction date or posting date)
   * @param settlementDay The card's settlement day (1-31) - replaces cutoffDay
   * @param isPostingDate Whether the date is a posting date (affects boundary condition)
   * @returns Date representing the start of the statement month
   */
  getStatementMonth(dateForSettlement: Date, settlementDay: number, isPostingDate: boolean = false): Date {
    const dayOfMonth = dateForSettlement.getDate();
    
    // Determine if transaction falls into the next billing cycle
    let isNextCycle: boolean;
    
    if (isPostingDate) {
      // If using Posting Date:
      // - Posting Date == Settlement Day -> Included in CURRENT cycle (due next month)
      // - Posting Date > Settlement Day -> Included in NEXT cycle (due in 2 months)
      isNextCycle = dayOfMonth > settlementDay;
    } else {
      // If using Transaction Date (default/fallback):
      // - Transaction Date == Settlement Day -> Assumed to post later -> NEXT cycle (due in 2 months)
      // - Transaction Date < Settlement Day -> Included in CURRENT cycle (due next month)
      isNextCycle = dayOfMonth >= settlementDay;
    }

    if (isNextCycle) {
      // Transaction is at or after settlement (or assumed to be) → belongs to NEXT month's statement (due in 2 months)
      // Example: Dec 22 (settlement 21) -> Bill Period Dec 21-Jan 20 -> Due Feb 10
      // We want to return "Feb" (Payment Month)
      return addMonths(startOfMonth(dateForSettlement), 2);
    } else {
      // Transaction is before settlement → belongs to THIS month's statement (due next month)
      // Example: Jan 10 (settlement 21) -> Bill Period Dec 21-Jan 20 -> Due Feb 10
      // We want to return "Feb" (Payment Month)
      return addMonths(startOfMonth(dateForSettlement), 1);
    }
  }

  /**
   * Get the payment month string (yyyy-MM format) for a transaction
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param settlementDay The card's settlement day (1-31)
   * @param paymentDay The card's payment day (1-31)
   * @returns Payment month string in 'yyyy-MM' format
   */
  getPaymentMonthStrForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, settlementDay: number, paymentDay: number): string {
    const paymentMonth = this.getPaymentMonthForTransaction(transaction, settlementDay, paymentDay);
    return format(paymentMonth, 'yyyy-MM');
  }

  /**
   * @deprecated Use getPaymentMonthStrForTransaction instead. This method is kept for backward compatibility.
   * Get the statement month string (yyyy-MM format) for a transaction
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param settlementDay The card's settlement day (1-31) - replaces cutoffDay
   * @returns Statement month string in 'yyyy-MM' format
   */
  getStatementMonthStrForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, settlementDay: number): string {
    const statementMonth = this.getStatementMonthForTransaction(transaction, settlementDay);
    return format(statementMonth, 'yyyy-MM');
  }
}
