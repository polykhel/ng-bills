import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import type { SavingsGoal, Transaction } from '@shared/types';
import { TransactionService } from './transaction.service';
import { format, parseISO, differenceInDays, isAfter, isBefore } from 'date-fns';

/**
 * Savings Goal Service
 * Manages savings goals with progress tracking and contribution management
 */
@Injectable({
  providedIn: 'root',
})
export class SavingsGoalService {
  private goalsSignal = signal<SavingsGoal[]>([]);
  goals = this.goalsSignal.asReadonly();
  private isLoadedSignal = signal(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private transactionService: TransactionService,
  ) {
    void this.initializeGoals();
    this.setupAutoSave();
  }

  /**
   * Get all goals for a profile
   */
  getGoals(profileId: string): SavingsGoal[] {
    return this.goalsSignal().filter((g) => g.profileId === profileId);
  }

  /**
   * Get goal by ID
   */
  getGoal(id: string): SavingsGoal | undefined {
    return this.goalsSignal().find((g) => g.id === id);
  }

  /**
   * Create a new savings goal
   */
  async createGoal(goal: Omit<SavingsGoal, 'id' | 'currentAmount' | 'createdAt' | 'updatedAt'>): Promise<SavingsGoal> {
    const newGoal: SavingsGoal = {
      id: this.generateId(),
      currentAmount: 0,
      ...goal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.goalsSignal.update((prev) => [...prev, newGoal]);
    return newGoal;
  }

  /**
   * Update a goal
   */
  async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<void> {
    this.goalsSignal.update((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, ...updates, updatedAt: new Date().toISOString() }
          : g,
      ),
    );
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<void> {
    this.goalsSignal.update((prev) => prev.filter((g) => g.id !== id));
  }

  /**
   * Add contribution to a goal
   */
  async addContribution(goalId: string, amount: number): Promise<void> {
    const goal = this.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    await this.updateGoal(goalId, {
      currentAmount: goal.currentAmount + amount,
    });
  }

  /**
   * Get goal progress information
   */
  getGoalProgress(goal: SavingsGoal): {
    percentage: number;
    remaining: number;
    isCompleted: boolean;
    isOverdue: boolean;
    daysRemaining: number | null;
    monthlyNeeded: number | null;
    isOnTrack: boolean;
  } {
    const percentage = goal.targetAmount > 0
      ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
      : 0;
    
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const isCompleted = goal.currentAmount >= goal.targetAmount;
    
    let daysRemaining: number | null = null;
    let isOverdue = false;
    
    if (goal.deadline) {
      const deadline = parseISO(goal.deadline);
      const today = new Date();
      daysRemaining = differenceInDays(deadline, today);
      isOverdue = isAfter(today, deadline) && !isCompleted;
    }

    // Calculate monthly contribution needed
    let monthlyNeeded: number | null = null;
    let isOnTrack = true;
    
    if (goal.deadline && daysRemaining !== null && daysRemaining > 0) {
      const monthsRemaining = daysRemaining / 30;
      monthlyNeeded = remaining / monthsRemaining;
      
      // Check if on track (current monthly contribution >= needed)
      if (goal.monthlyContribution) {
        isOnTrack = goal.monthlyContribution >= monthlyNeeded;
      }
    } else if (goal.monthlyContribution) {
      // If no deadline, just check if contribution is set
      isOnTrack = true;
    }

    return {
      percentage,
      remaining,
      isCompleted,
      isOverdue,
      daysRemaining,
      monthlyNeeded,
      isOnTrack,
    };
  }

  /**
   * Get all goals with progress information
   */
  getGoalsWithProgress(profileId: string): (SavingsGoal & {
    progress: {
      percentage: number;
      remaining: number;
      isCompleted: boolean;
      isOverdue: boolean;
      daysRemaining: number | null;
      monthlyNeeded: number | null;
      isOnTrack: boolean;
    };
  })[] {
    return this.getGoals(profileId).map((goal) => ({
      ...goal,
      progress: this.getGoalProgress(goal),
    }));
  }

  /**
   * Link a recurring transaction to a goal for auto-contributions
   */
  async linkRecurringTransaction(goalId: string, transactionId: string): Promise<void> {
    await this.updateGoal(goalId, {
      goalTransactionId: transactionId,
      autoContribute: true,
    });
  }

  /**
   * Process auto-contribution from a transaction
   */
  async processAutoContribution(transaction: Transaction): Promise<void> {
    // Find goals that have this transaction linked
    const goals = this.goalsSignal().filter(
      (g) => g.goalTransactionId === transaction.id && g.autoContribute,
    );

    for (const goal of goals) {
      // Only process income transactions for contributions
      if (transaction.type === 'income' && transaction.amount > 0) {
        await this.addContribution(goal.id, transaction.amount);
      }
    }
  }

  /**
   * Initialize goals from IndexedDB
   */
  private async initializeGoals(): Promise<void> {
    try {
      const db = this.idb.getDB();
      const goals = await db.getAll<SavingsGoal>(STORES.SAVINGS_GOALS);
      this.goalsSignal.set(goals);
      this.isLoadedSignal.set(true);
    } catch (error) {
      console.error('Failed to initialize savings goals:', error);
      this.goalsSignal.set([]);
      this.isLoadedSignal.set(true);
    }
  }

  /**
   * Auto-save goals when signal changes
   */
  private setupAutoSave(): void {
    effect(() => {
      if (this.isLoadedSignal()) {
        const goals = this.goalsSignal();
        void this.idb.getDB().putAll(STORES.SAVINGS_GOALS, goals);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
