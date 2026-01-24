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
   * Round a number to 2 decimal places (for currency)
   * Uses Math.round to avoid floating point precision issues
   */
  roundCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
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
   * Evaluate a mathematical expression (supports +, -, *, /)
   * If the input is just a number, returns that number
   * If the input is an expression like "5000+4000-2000", evaluates it
   */
  evaluateMathExpression(expression: string): number | null {
    // Handle null/undefined input
    if (!expression) {
      return null;
    }
    
    // Remove spaces
    const cleaned = expression.trim().replace(/\s/g, '');
    
    if (!cleaned) {
      return null;
    }

    // Check if it's just a simple number
    const simpleNumber = parseFloat(cleaned);
    if (!isNaN(simpleNumber) && /^-?\d+\.?\d*$/.test(cleaned)) {
      return simpleNumber;
    }

    // Validate expression contains only numbers and operators
    if (!/^[\d+\-*/().]+$/.test(cleaned)) {
      return null;
    }

    try {
      // Use Function constructor for safe evaluation
      // This is safer than eval() as it doesn't have access to local scope
      const result = new Function('return ' + cleaned)();
      
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the statement month date for a transaction based on cutoff-aware logic
   * Uses postingDate if available, otherwise falls back to transaction date
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param cutoffDay The card's cutoff day (1-31)
   * @returns Date representing the start of the statement month
   */
  getStatementMonthForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, cutoffDay: number): Date {
    // Use postingDate for cutoff calculation if available
    if (transaction.postingDate) {
      return this.getStatementMonth(parseISO(transaction.postingDate), cutoffDay, true);
    }

    // For installments, if no posting date is present, treat the transaction date as the posting date.
    // This ensures that if the date equals the cutoff day, it is included in the current billing cycle
    // (similar to how posting dates behave) rather than being pushed to the next cycle.
    if (transaction.recurringRule?.type === 'installment') {
      return startOfMonth(parseISO(transaction.date));
    }

    return this.getStatementMonth(parseISO(transaction.date), cutoffDay, false);
  }

  /**
   * Get the statement month date based on cutoff-aware logic
   * 
   * Logic:
   * - If transaction day >= cutoffDay: belongs to NEXT month's statement (Payment Month logic)
   * - If transaction day < cutoffDay: belongs to THIS month's statement (Payment Month logic)
   * 
   * @param dateForCutoff The date to use for cutoff calculation (transaction date or posting date)
   * @param cutoffDay The card's cutoff day (1-31)
   * @param isPostingDate Whether the date is a posting date (affects boundary condition)
   * @returns Date representing the start of the statement month
   */
  getStatementMonth(dateForCutoff: Date, cutoffDay: number, isPostingDate: boolean = false): Date {
    const dayOfMonth = dateForCutoff.getDate();
    
    // Determine if transaction falls into the next billing cycle
    let isNextCycle: boolean;
    
    if (isPostingDate) {
      // If using Posting Date:
      // - Posting Date == Cutoff Day -> Included in CURRENT cycle (due next month)
      // - Posting Date > Cutoff Day -> Included in NEXT cycle (due in 2 months)
      isNextCycle = dayOfMonth > cutoffDay;
    } else {
      // If using Transaction Date (default/fallback):
      // - Transaction Date == Cutoff Day -> Assumed to post later -> NEXT cycle (due in 2 months)
      // - Transaction Date < Cutoff Day -> Included in CURRENT cycle (due next month)
      isNextCycle = dayOfMonth >= cutoffDay;
    }

    if (isNextCycle) {
      // Transaction is at or after cutoff (or assumed to be) → belongs to NEXT month's statement (due in 2 months)
      // Example: Dec 22 (cutoff 21) -> Bill Period Dec 21-Jan 20 -> Due Feb 10
      // We want to return "Feb" (Payment Month)
      return addMonths(startOfMonth(dateForCutoff), 2);
    } else {
      // Transaction is before cutoff → belongs to THIS month's statement (due next month)
      // Example: Jan 10 (cutoff 21) -> Bill Period Dec 21-Jan 20 -> Due Feb 10
      // We want to return "Feb" (Payment Month)
      return addMonths(startOfMonth(dateForCutoff), 1);
    }
  }

  /**
   * Get the statement month string (yyyy-MM format) for a transaction
   * 
   * @param transaction Transaction with date and optional postingDate
   * @param cutoffDay The card's cutoff day (1-31)
   * @returns Statement month string in 'yyyy-MM' format
   */
  getStatementMonthStrForTransaction(transaction: { description: string, date: string; postingDate?: string; recurringRule?: { type: string } }, cutoffDay: number): string {
    const statementMonth = this.getStatementMonthForTransaction(transaction, cutoffDay);
    return format(statementMonth, 'yyyy-MM');
  }
}
