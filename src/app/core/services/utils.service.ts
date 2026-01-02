import { Injectable } from '@angular/core';
import { differenceInCalendarMonths, parseISO, startOfMonth } from 'date-fns';
import type { Installment, InstallmentStatus } from '@shared/types';

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
}
