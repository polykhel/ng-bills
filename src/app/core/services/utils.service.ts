import { Injectable } from '@angular/core';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInCalendarMonths, parseISO, startOfMonth } from 'date-fns';
import type { Installment, InstallmentStatus } from '../../shared/types';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {
  /**
   * Merge Tailwind CSS classes with clsx
   */
  cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
  }

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
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
