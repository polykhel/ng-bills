import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
} from 'lucide-angular';
import {
  AppStateService,
  CategoryService,
  ProfileService,
  TransactionService,
  UtilsService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent } from '@components';
import { format } from 'date-fns';

interface BudgetAllocation {
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
 * Manage monthly budgets and track spending by category
 */
@Component({
  selector: 'app-budget',
  standalone: true,
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
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }

      .category-budget-item {
        padding: 12px;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 6px;
        margin-bottom: 8px;
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

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  // Modal state
  protected showBudgetModal = signal(false);
  protected budgetForm = signal<{ categoryId: string; amount: string }>({
    categoryId: '',
    amount: '',
  });
  // Summary metrics
  protected summary = computed(() => {
    const allocations = this.budgetAllocations();

    const totalBudget = allocations.reduce((sum, a) => sum + a.allocated, 0);
    const totalSpent = allocations.reduce((sum, a) => sum + a.spent, 0);
    const remaining = totalBudget - totalSpent;
    const percentageUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return {
      totalBudget,
      totalSpent,
      remaining,
      percentageUsed,
    };
  });

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  private transactionService = inject(TransactionService);

  // Budget allocations stored in localStorage for now
  // Calculate spending by category for current month
  protected categorySpending = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return new Map<string, number>();

    const monthStr = format(this.viewDate(), 'yyyy-MM');
    const transactions = this.transactionService.getTransactions({
      profileIds: [profile.id],
      type: 'expense',
    });

    const spending = new Map<string, number>();

    transactions.forEach((t) => {
      if (t.date.startsWith(monthStr)) {
        const current = spending.get(t.categoryId) || 0;
        spending.set(t.categoryId, current + t.amount);
      }
    });

    return spending;
  });
  private categoryService = inject(CategoryService);
  protected categories = this.categoryService.categories;
  private utils = inject(UtilsService);
  // In Phase 2, move to IndexedDB with BudgetService
  private budgetAllocationsSignal = signal<Map<string, number>>(new Map());
  // Budget allocations with spending
  protected budgetAllocations = computed((): BudgetAllocation[] => {
    const allocations = this.budgetAllocationsSignal();
    const spending = this.categorySpending();
    const cats = this.categories();

    const result: BudgetAllocation[] = [];

    allocations.forEach((allocated, categoryId) => {
      const category = cats.find((c) => c.id === categoryId);
      if (!category) return;

      const spent = spending.get(categoryId) || 0;
      const remaining = allocated - spent;
      const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;

      result.push({
        categoryId,
        categoryName: category.name,
        allocated,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        color: category.color || '#6b7280',
      });
    });

    return result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  });

  constructor() {
    this.loadBudgetAllocations();
  }

  protected openBudgetModal(): void {
    this.budgetForm.set({ categoryId: '', amount: '' });
    this.showBudgetModal.set(true);
  }

  protected closeBudgetModal(): void {
    this.showBudgetModal.set(false);
  }

  protected addBudgetAllocation(): void {
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

    const allocations = new Map(this.budgetAllocationsSignal());
    allocations.set(form.categoryId, amount);
    this.budgetAllocationsSignal.set(allocations);
    this.saveBudgetAllocations();
    this.closeBudgetModal();
  }

  protected removeBudgetAllocation(categoryId: string): void {
    if (!confirm('Remove this budget allocation?')) return;

    const allocations = new Map(this.budgetAllocationsSignal());
    allocations.delete(categoryId);
    this.budgetAllocationsSignal.set(allocations);
    this.saveBudgetAllocations();
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

  private loadBudgetAllocations(): void {
    const profile = this.activeProfile();
    if (!profile) return;

    const monthStr = format(this.viewDate(), 'yyyy-MM');
    const key = `budget_${profile.id}_${monthStr}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const obj = JSON.parse(stored);
        this.budgetAllocationsSignal.set(new Map(Object.entries(obj)));
      } catch (e) {
        console.error('Failed to load budget allocations', e);
      }
    }
  }

  private saveBudgetAllocations(): void {
    const profile = this.activeProfile();
    if (!profile) return;

    const monthStr = format(this.viewDate(), 'yyyy-MM');
    const key = `budget_${profile.id}_${monthStr}`;
    const allocations = this.budgetAllocationsSignal();
    const obj = Object.fromEntries(allocations);
    localStorage.setItem(key, JSON.stringify(obj));
  }
}
