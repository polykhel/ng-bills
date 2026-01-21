import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  LucideAngularModule, 
  PieChart, 
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target
} from 'lucide-angular';
import { AppStateService, ProfileService } from '@services';
import { 
  MetricCardComponent, 
  QuickActionButtonComponent, 
  SectionHeaderComponent,
  EmptyStateComponent
} from '@components';

/**
 * Budget Page Component
 * Manage monthly budgets and track spending by category
 */
@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    MetricCardComponent,
    QuickActionButtonComponent,
    SectionHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './budget.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BudgetComponent {
  readonly PieChart = PieChart;
  readonly Plus = Plus;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly DollarSign = DollarSign;
  readonly Target = Target;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;

  // Stubbed data - will be from BudgetService in Phase 2
  protected summary = {
    totalBudget: 0,
    totalSpent: 0,
    remaining: 0,
    percentageUsed: 0
  };

  protected budgetCategories: any[] = [];

  protected onCreateBudget(): void {
    console.log('Create budget');
  }

  protected onAddCategory(): void {
    console.log('Add category');
  }
}
