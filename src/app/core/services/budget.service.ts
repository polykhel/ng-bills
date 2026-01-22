import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import type { Budget, CategoryAllocation, Transaction } from '@shared/types';
import { TransactionService } from './transaction.service';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO, addMonths, addQuarters, addYears } from 'date-fns';

/**
 * Budget Service
 * Manages budgets with category allocations, rollover, and alert thresholds
 */
@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  private budgetsSignal = signal<Budget[]>([]);
  budgets = this.budgetsSignal.asReadonly();
  private isLoadedSignal = signal(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private transactionService: TransactionService,
  ) {
    void this.initializeBudgets();
    this.setupAutoSave();
  }

  /**
   * Get all budgets for a profile
   */
  getBudgets(profileId: string): Budget[] {
    return this.budgetsSignal().filter((b) => b.profileId === profileId);
  }

  /**
   * Get active budget for a profile and period
   */
  getActiveBudget(profileId: string, date: Date, period: 'monthly' | 'quarterly' | 'yearly'): Budget | null {
    const budgets = this.getBudgets(profileId).filter((b) => b.period === period);
    
    for (const budget of budgets) {
      const start = parseISO(budget.startDate);
      const end = budget.endDate ? parseISO(budget.endDate) : null;
      
      if (isWithinInterval(date, { start, end: end || new Date(9999, 11, 31) })) {
        return budget;
      }
    }
    
    return null;
  }

  /**
   * Get budget by ID
   */
  getBudget(id: string): Budget | undefined {
    return this.budgetsSignal().find((b) => b.id === id);
  }

  /**
   * Create a new budget
   */
  async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const newBudget: Budget = {
      id: this.generateId(),
      ...budget,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.budgetsSignal.update((prev) => [...prev, newBudget]);
    return newBudget;
  }

  /**
   * Update a budget
   */
  async updateBudget(id: string, updates: Partial<Budget>): Promise<void> {
    this.budgetsSignal.update((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, ...updates, updatedAt: new Date().toISOString() }
          : b,
      ),
    );
  }

  /**
   * Delete a budget
   */
  async deleteBudget(id: string): Promise<void> {
    this.budgetsSignal.update((prev) => prev.filter((b) => b.id !== id));
  }

  /**
   * Calculate spending for a budget period
   */
  calculateSpending(budget: Budget, date: Date): Map<string, number> {
    const profileId = budget.profileId;
    const period = budget.period;
    
    // Determine date range based on period
    let startDate: Date;
    let endDate: Date;
    
    if (period === 'monthly') {
      startDate = startOfMonth(date);
      endDate = endOfMonth(date);
    } else if (period === 'quarterly') {
      startDate = startOfQuarter(date);
      endDate = endOfQuarter(date);
    } else {
      startDate = startOfYear(date);
      endDate = endOfYear(date);
    }

    // Get transactions for this period
    const transactions = this.transactionService.getTransactions({
      profileIds: [profileId],
      type: 'expense',
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
    });

    // Calculate spending by category
    const spending = new Map<string, number>();
    
    transactions.forEach((t) => {
      // Skip transactions where someone else paid
      if (t.paidByOther) {
        return;
      }
      
      // Skip transactions where this profile paid for someone else
      if (t.paidByOtherProfileId === profileId && t.profileId !== profileId) {
        return;
      }

      const current = spending.get(t.categoryId) || 0;
      spending.set(t.categoryId, current + t.amount);
    });

    return spending;
  }

  /**
   * Get budget with calculated spending
   */
  getBudgetWithSpending(budget: Budget, date: Date): Budget & {
    allocations: (CategoryAllocation & { percentage: number })[];
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    percentageUsed: number;
    alerts: string[];
  } {
    const spending = this.calculateSpending(budget, date);
    
    const allocations = budget.allocations.map((alloc) => {
      const spent = spending.get(alloc.categoryId) || 0;
      const remaining = alloc.allocatedAmount - spent;
      const percentage = alloc.allocatedAmount > 0 ? (spent / alloc.allocatedAmount) * 100 : 0;
      
      return {
        ...alloc,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
      };
    });

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const totalSpent = allocations.reduce((sum, a) => sum + a.spent, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const percentageUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    // Check for alerts
    const alerts: string[] = [];
    allocations.forEach((alloc) => {
      if (alloc.percentage >= budget.alertThreshold) {
        alerts.push(
          `${alloc.categoryId} is at ${alloc.percentage.toFixed(0)}% of budget (${budget.alertThreshold}% threshold)`,
        );
      }
    });

    return {
      ...budget,
      allocations,
      totalAllocated,
      totalSpent,
      totalRemaining,
      percentageUsed,
      alerts,
    };
  }

  /**
   * Process rollover for a budget period
   */
  async processRollover(budget: Budget, fromDate: Date): Promise<void> {
    if (!budget.rolloverUnspent) {
      return;
    }

    const spending = this.calculateSpending(budget, fromDate);
    const allocations = budget.allocations.map((alloc) => {
      const spent = spending.get(alloc.categoryId) || 0;
      const remaining = Math.max(0, alloc.allocatedAmount - spent);
      
      return {
        ...alloc,
        spent,
        remaining,
      };
    });

    // Determine next period date
    let nextDate: Date;
    if (budget.period === 'monthly') {
      nextDate = addMonths(fromDate, 1);
    } else if (budget.period === 'quarterly') {
      nextDate = addQuarters(fromDate, 1);
    } else {
      nextDate = addYears(fromDate, 1);
    }

    // Get or create next period budget
    let nextBudget = this.getActiveBudget(budget.profileId, nextDate, budget.period);
    
    if (!nextBudget) {
      // Create new budget for next period with rollover
      const rolledOverAllocations = allocations.map((alloc) => ({
        categoryId: alloc.categoryId,
        allocatedAmount: alloc.allocatedAmount + alloc.remaining,
        spent: 0,
        remaining: alloc.allocatedAmount + alloc.remaining,
      }));

      nextBudget = await this.createBudget({
        profileId: budget.profileId,
        name: budget.name,
        period: budget.period,
        startDate: format(nextDate, 'yyyy-MM-dd'),
        allocations: rolledOverAllocations,
        rolloverUnspent: budget.rolloverUnspent,
        alertThreshold: budget.alertThreshold,
      });
    } else {
      // Update existing budget with rollover amounts
      const updatedAllocations = nextBudget.allocations.map((nextAlloc) => {
        const rollover = allocations.find((a) => a.categoryId === nextAlloc.categoryId);
        if (rollover) {
          return {
            ...nextAlloc,
            allocatedAmount: nextAlloc.allocatedAmount + rollover.remaining,
            remaining: nextAlloc.remaining + rollover.remaining,
          };
        }
        return nextAlloc;
      });

      await this.updateBudget(nextBudget.id, {
        allocations: updatedAllocations,
      });
    }
  }

  /**
   * Initialize budgets from IndexedDB
   */
  private async initializeBudgets(): Promise<void> {
    try {
      const db = this.idb.getDB();
      const budgets = await db.getAll<Budget>(STORES.BUDGETS);
      this.budgetsSignal.set(budgets);
      this.isLoadedSignal.set(true);
    } catch (error) {
      console.error('Failed to initialize budgets:', error);
      this.budgetsSignal.set([]);
      this.isLoadedSignal.set(true);
    }
  }

  /**
   * Auto-save budgets when signal changes
   */
  private setupAutoSave(): void {
    effect(() => {
      if (this.isLoadedSignal()) {
        const budgets = this.budgetsSignal();
        void this.idb.getDB().putAll(STORES.BUDGETS, budgets);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `budget_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
