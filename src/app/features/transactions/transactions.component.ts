import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  LucideAngularModule, 
  Plus, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  FileText
} from 'lucide-angular';
import { AppStateService, ProfileService } from '@services';
import { 
  MetricCardComponent, 
  QuickActionButtonComponent, 
  SectionHeaderComponent,
  EmptyStateComponent
} from '@components';

/**
 * Transactions Page Component
 * Displays all income and expense transactions with filtering
 */
@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    MetricCardComponent,
    QuickActionButtonComponent,
    SectionHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './transactions.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TransactionsComponent {
  readonly Plus = Plus;
  readonly Filter = Filter;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly Wallet = Wallet;
  readonly FileText = FileText;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;

  // Stubbed data - will be from TransactionService in Phase 1
  protected summary = {
    totalIncome: 0,
    totalExpenses: 0,
    netChange: 0,
    transactionCount: 0
  };

  protected transactions: any[] = [];

  protected onAddTransaction(): void {
    console.log('Add transaction');
  }

  protected onFilter(): void {
    console.log('Open filters');
  }
}
