import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertCircle,
  DollarSign,
  Edit2,
  LucideAngularModule,
  PieChart,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Calendar,
  Settings,
} from 'lucide-angular';
import {
  AppStateService,
  BudgetService,
  CategoryService,
  ProfileService,
  TransactionService,
  UtilsService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent } from '@components';
import { format } from 'date-fns';
import type { Budget, CategoryAllocation } from '@shared/types';

interface BudgetAllocationDisplay {
  categoryId: string;
  categoryName: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentage: number;
  color: string;
}

/**
 * Budget Page Component
 * Manage budgets with category allocations, rollover, and alert thresholds
 */
@Component({
  selector: 'app-budget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './budget.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .budget-progress {
        height: 8px;
        background: rgb(226, 232, 240);
        border-radius: 4px;
        overflow: hidden;
      }

      .budget-progress-bar {
        height: 100%;
        transition: width 0.3s ease;
      }

      .budget-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }

      .modal-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }

      .category-budget-item {
        padding: 12px;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 6px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .category-budget-item:hover {
        background-color: rgb(248, 250, 252);
      }
    `,
  ],
})
export class BudgetComponent {
  readonly PieChart = PieChart;
  readonly Plus = Plus;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly DollarSign = DollarSign;
  readonly Target = Target;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly AlertCircle = AlertCircle;
  readonly Calendar = Calendar;
  readonly Settings = Settings;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private budgetService = inject(BudgetService);
  private categoryService = inject(CategoryService);
  private transactionService = inject(TransactionService);
  private utils = inject(UtilsService);
  private router = inject(Router);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  protected categories = this.categoryService.categories;

  // Budget period selection
  protected budgetPeriod = signal<'monthly' | 'quarterly' | 'yearly'>('monthly');

  // Current active budget
  protected activeBudget = computed(() => {
    const profile = this.activeProfile();
    const date = this.viewDate();
    const period = this.budgetPeriod();
    
    if (!profile) return null;
    
    return this.budgetService.getActiveBudget(profile.id, date, period);
  });

  // Budget with calculated spending
  protected budgetWithSpending = computed(() => {
    const budget = this.activeBudget();
    const date = this.viewDate();
    
    if (!budget) return null;
    
    return this.budgetService.getBudgetWithSpending(budget, date);
  });

  // Budget allocations for display
  protected budgetAllocations = computed((): BudgetAllocationDisplay[] => {
    const budgetData = this.budgetWithSpending();
    if (!budgetData) return [];

    const cats = this.categories();
    
    return budgetData.allocations.map((alloc) => {
      const category = cats.find((c) => c.id === alloc.categoryId);
      // Calculate percentage if not provided
      const percentage: number = 'percentage' in alloc 
        ? (alloc.percentage as number)
        : alloc.allocatedAmount > 0 
          ? (alloc.spent / alloc.allocatedAmount) * 100 
          : 0;
      
      return {
        categoryId: alloc.categoryId,
        categoryName: category?.name || 'Unknown',
        allocated: alloc.allocatedAmount,
        spent: alloc.spent,
        remaining: alloc.remaining,
        percentage: Math.min(percentage, 100),
        color: category?.color || '#6b7280',
      };
    }).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  });

  // Summary metrics
  protected summary = computed(() => {
    const budgetData = this.budgetWithSpending();
    if (!budgetData) {
      return {
        totalBudget: 0,
        totalSpent: 0,
        remaining: 0,
        percentageUsed: 0,
      };
    }

    return {
      totalBudget: budgetData.totalAllocated,
      totalSpent: budgetData.totalSpent,
      remaining: budgetData.totalRemaining,
      percentageUsed: budgetData.percentageUsed,
    };
  });

  // Modal state
  protected showBudgetModal = signal(false);
  protected showSettingsModal = signal(false);
  protected budgetForm = signal<{ categoryId: string; amount: string }>({
    categoryId: '',
    amount: '',
  });

  // Settings form
  protected settingsForm = signal<{
    rolloverUnspent: boolean;
    alertThreshold: number;
  }>({
    rolloverUnspent: false,
    alertThreshold: 80,
  });

  constructor() {
    // Migrate localStorage budgets on first load
    effect(() => {
      const profile = this.activeProfile();
      if (profile && this.budgetService.isLoaded()) {
        this.migrateLocalStorageBudgets(profile.id);
      }
    });
  }

  protected openBudgetModal(): void {
    this.budgetForm.set({ categoryId: '', amount: '' });
    this.showBudgetModal.set(true);
  }

  protected closeBudgetModal(): void {
    this.showBudgetModal.set(false);
  }

  protected openSettingsModal(): void {
    const budget = this.activeBudget();
    if (budget) {
      this.settingsForm.set({
        rolloverUnspent: budget.rolloverUnspent,
        alertThreshold: budget.alertThreshold,
      });
    }
    this.showSettingsModal.set(true);
  }

  protected closeSettingsModal(): void {
    this.showSettingsModal.set(false);
  }

  protected async addBudgetAllocation(): Promise<void> {
    const form = this.budgetForm();
    if (!form.categoryId || !form.amount) {
      alert('Please select a category and enter an amount');
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const profile = this.activeProfile();
    const date = this.viewDate();
    const period = this.budgetPeriod();
    
    if (!profile) return;

    let budget = this.activeBudget();

    if (!budget) {
      // Create new budget
      const allocations: CategoryAllocation[] = [{
        categoryId: form.categoryId,
        allocatedAmount: amount,
        spent: 0,
        remaining: amount,
      }];

      budget = await this.budgetService.createBudget({
        profileId: profile.id,
        name: `${period.charAt(0).toUpperCase() + period.slice(1)} Budget`,
        period,
        startDate: format(date, 'yyyy-MM-dd'),
        allocations,
        rolloverUnspent: false,
        alertThreshold: 80,
      });
    } else {
      // Update existing budget
      const existingAlloc = budget.allocations.find((a) => a.categoryId === form.categoryId);
      
      if (existingAlloc) {
        // Update existing allocation
        const updatedAllocations = budget.allocations.map((a) =>
          a.categoryId === form.categoryId
            ? { ...a, allocatedAmount: amount, remaining: amount - a.spent }
            : a,
        );
        await this.budgetService.updateBudget(budget.id, {
          allocations: updatedAllocations,
        });
      } else {
        // Add new allocation
        const newAllocation: CategoryAllocation = {
          categoryId: form.categoryId,
          allocatedAmount: amount,
          spent: 0,
          remaining: amount,
        };
        await this.budgetService.updateBudget(budget.id, {
          allocations: [...budget.allocations, newAllocation],
        });
      }
    }

    this.closeBudgetModal();
  }

  protected async removeBudgetAllocation(categoryId: string): Promise<void> {
    if (!confirm('Remove this budget allocation?')) return;

    const budget = this.activeBudget();
    if (!budget) return;

    const updatedAllocations = budget.allocations.filter((a) => a.categoryId !== categoryId);
    await this.budgetService.updateBudget(budget.id, {
      allocations: updatedAllocations,
    });
  }

  protected async saveSettings(): Promise<void> {
    const budget = this.activeBudget();
    if (!budget) return;

    const settings = this.settingsForm();
    await this.budgetService.updateBudget(budget.id, {
      rolloverUnspent: settings.rolloverUnspent,
      alertThreshold: settings.alertThreshold,
    });

    this.closeSettingsModal();
  }

  protected getProgressColor(percentage: number): string {
    if (percentage >= 100) return 'rgb(220, 38, 38)'; // red
    if (percentage >= 80) return 'rgb(251, 146, 60)'; // orange
    if (percentage >= 60) return 'rgb(234, 179, 8)'; // yellow
    return 'rgb(34, 197, 94)'; // green
  }

  protected formatCurrency(amount: number): string {
    return this.utils.formatCurrency(amount);
  }

  protected viewTransactions(categoryId: string): void {
    const profile = this.activeProfile();
    if (!profile) return;

    const date = this.viewDate();
    const period = this.budgetPeriod();
    
    let startDate: Date;
    let endDate: Date;
    
    if (period === 'monthly') {
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    } else if (period === 'quarterly') {
      const quarter = Math.floor(date.getMonth() / 3);
      startDate = new Date(date.getFullYear(), quarter * 3, 1);
      endDate = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
    } else {
      startDate = new Date(date.getFullYear(), 0, 1);
      endDate = new Date(date.getFullYear(), 11, 31);
    }

    // Navigate to transactions with filters
    this.router.navigate(['/transactions'], {
      queryParams: {
        categoryId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      },
    });
  }

  /**
   * Migrate localStorage budgets to IndexedDB
   */
  private async migrateLocalStorageBudgets(profileId: string): Promise<void> {
    // Check if migration already done
    const migrationKey = `budget_migrated_${profileId}`;
    if (localStorage.getItem(migrationKey)) {
      return;
    }

    try {
      // Find all localStorage budget keys for this profile
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`budget_${profileId}_`)) {
          keys.push(key);
        }
      }

      if (keys.length === 0) {
        localStorage.setItem(migrationKey, 'true');
        return;
      }

      // Migrate each budget
      for (const key of keys) {
        const monthStr = key.replace(`budget_${profileId}_`, '');
        const stored = localStorage.getItem(key);
        
        if (stored) {
          try {
            const allocationsObj = JSON.parse(stored);
            const allocations: CategoryAllocation[] = Object.entries(allocationsObj).map(
              ([categoryId, amount]) => ({
                categoryId,
                allocatedAmount: amount as number,
                spent: 0,
                remaining: amount as number,
              }),
            );

            if (allocations.length > 0) {
              const [year, month] = monthStr.split('-');
              const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
              
              await this.budgetService.createBudget({
                profileId,
                name: `Monthly Budget - ${monthStr}`,
                period: 'monthly',
                startDate: format(startDate, 'yyyy-MM-dd'),
                allocations,
                rolloverUnspent: false,
                alertThreshold: 80,
              });
            }
          } catch (e) {
            console.error(`Failed to migrate budget ${key}:`, e);
          }
        }
      }

      // Mark migration as complete
      localStorage.setItem(migrationKey, 'true');
      console.log(`Migrated ${keys.length} budgets from localStorage to IndexedDB`);
    } catch (error) {
      console.error('Failed to migrate budgets:', error);
    }
  }
}
