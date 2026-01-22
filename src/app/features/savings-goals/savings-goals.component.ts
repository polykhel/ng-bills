import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Plus,
  Target,
  Trash2,
  Edit2,
  X,
  TrendingUp,
  Calendar,
  DollarSign,
} from 'lucide-angular';
import {
  AppStateService,
  ProfileService,
  SavingsGoalService,
  UtilsService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent } from '@components';
import type { SavingsGoal } from '@shared/types';
import { format, parseISO, differenceInDays } from 'date-fns';

/**
 * Savings Goals Component
 * Manage savings goals with progress tracking and contributions
 */
@Component({
  selector: 'app-savings-goals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './savings-goals.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .goal-progress {
        height: 12px;
        background: rgb(226, 232, 240);
        border-radius: 6px;
        overflow: hidden;
      }

      .goal-progress-bar {
        height: 100%;
        transition: width 0.3s ease;
      }

      .goal-modal {
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

      .goal-card {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .goal-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    `,
  ],
})
export class SavingsGoalsComponent {
  readonly Plus = Plus;
  readonly Target = Target;
  readonly Trash2 = Trash2;
  readonly Edit2 = Edit2;
  readonly X = X;
  readonly TrendingUp = TrendingUp;
  readonly Calendar = Calendar;
  readonly DollarSign = DollarSign;

  private profileService = inject(ProfileService);
  private goalService = inject(SavingsGoalService);
  private utils = inject(UtilsService);

  protected activeProfile = this.profileService.activeProfile;

  // Goals with progress
  protected goalsWithProgress = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];
    
    return this.goalService.getGoalsWithProgress(profile.id);
  });

  // Summary metrics
  protected summary = computed(() => {
    const goals = this.goalsWithProgress();
    
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalRemaining = totalTarget - totalCurrent;
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    const completedCount = goals.filter((g) => g.progress.isCompleted).length;

    return {
      totalTarget,
      totalCurrent,
      totalRemaining,
      overallProgress,
      completedCount,
      totalGoals: goals.length,
    };
  });

  // Modal state
  protected showGoalModal = signal(false);
  protected editingGoal = signal<SavingsGoal | null>(null);
  protected goalForm = signal<{
    name: string;
    description: string;
    targetAmount: string;
    deadline: string;
    monthlyContribution: string;
    autoContribute: boolean;
    icon: string;
    color: string;
    priority: 'high' | 'medium' | 'low';
  }>({
    name: '',
    description: '',
    targetAmount: '',
    deadline: '',
    monthlyContribution: '',
    autoContribute: false,
    icon: 'target',
    color: '#3b82f6',
    priority: 'medium',
  });

  // Contribution modal
  protected showContributionModal = signal(false);
  protected contributionAmount = signal<string>('');
  protected contributionGoalId = signal<string>('');

  protected iconOptions = [
    { value: 'target', label: 'Target' },
    { value: 'home', label: 'Home' },
    { value: 'car', label: 'Car' },
    { value: 'plane', label: 'Vacation' },
    { value: 'heart', label: 'Health' },
    { value: 'graduation-cap', label: 'Education' },
    { value: 'gift', label: 'Gift' },
    { value: 'trending-up', label: 'Investment' },
  ];

  protected colorOptions = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
  ];

  protected openGoalModal(goal?: SavingsGoal): void {
    if (goal) {
      this.editingGoal.set(goal);
      this.goalForm.set({
        name: goal.name,
        description: goal.description || '',
        targetAmount: goal.targetAmount.toString(),
        deadline: goal.deadline || '',
        monthlyContribution: goal.monthlyContribution?.toString() || '',
        autoContribute: goal.autoContribute,
        icon: goal.icon,
        color: goal.color,
        priority: goal.priority,
      });
    } else {
      this.editingGoal.set(null);
      this.goalForm.set({
        name: '',
        description: '',
        targetAmount: '',
        deadline: '',
        monthlyContribution: '',
        autoContribute: false,
        icon: 'target',
        color: '#3b82f6',
        priority: 'medium',
      });
    }
    this.showGoalModal.set(true);
  }

  protected closeGoalModal(): void {
    this.showGoalModal.set(false);
    this.editingGoal.set(null);
  }

  protected async saveGoal(): Promise<void> {
    const form = this.goalForm();
    if (!form.name || !form.targetAmount) {
      alert('Please enter a name and target amount');
      return;
    }

    const targetAmount = parseFloat(form.targetAmount);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      alert('Please enter a valid target amount');
      return;
    }

    const profile = this.activeProfile();
    if (!profile) return;

    const goalData: Omit<SavingsGoal, 'id' | 'currentAmount' | 'createdAt' | 'updatedAt'> = {
      profileId: profile.id,
      name: form.name,
      description: form.description || undefined,
      targetAmount,
      deadline: form.deadline || undefined,
      monthlyContribution: form.monthlyContribution ? parseFloat(form.monthlyContribution) : undefined,
      autoContribute: form.autoContribute,
      icon: form.icon,
      color: form.color,
      priority: form.priority,
    };

    if (this.editingGoal()) {
      await this.goalService.updateGoal(this.editingGoal()!.id, goalData);
    } else {
      await this.goalService.createGoal(goalData);
    }

    this.closeGoalModal();
  }

  protected async deleteGoal(goalId: string): Promise<void> {
    if (!confirm('Delete this savings goal?')) return;
    await this.goalService.deleteGoal(goalId);
  }

  protected openContributionModal(goalId: string): void {
    this.contributionGoalId.set(goalId);
    this.contributionAmount.set('');
    this.showContributionModal.set(true);
  }

  protected closeContributionModal(): void {
    this.showContributionModal.set(false);
    this.contributionGoalId.set('');
    this.contributionAmount.set('');
  }

  protected async addContribution(): Promise<void> {
    const amount = parseFloat(this.contributionAmount());
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    await this.goalService.addContribution(this.contributionGoalId(), amount);
    this.closeContributionModal();
  }

  protected formatCurrency(amount: number): string {
    return this.utils.formatCurrency(amount);
  }

  protected formatDate(date: string): string {
    return format(parseISO(date), 'MMM d, yyyy');
  }

  protected getDaysRemaining(deadline: string): number {
    const days = differenceInDays(parseISO(deadline), new Date());
    return Math.max(0, days);
  }

  protected getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#10b981'; // green
    if (percentage >= 75) return '#3b82f6'; // blue
    if (percentage >= 50) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }
}
