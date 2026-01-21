import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  LucideAngularModule, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Calendar, 
  PieChart,
  Plus
} from 'lucide-angular';
import { AppStateService, ProfileService, CardService, StatementService, BankBalanceService } from '@services';
import { 
  MetricCardComponent, 
  QuickActionButtonComponent, 
  SectionHeaderComponent,
  EmptyStateComponent
} from '@components';

/**
 * Overview Page Component
 * Main dashboard showing financial overview and key metrics
 */
@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    MetricCardComponent,
    QuickActionButtonComponent,
    SectionHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './overview.component.html',
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class OverviewComponent {
  readonly Wallet = Wallet;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly CreditCard = CreditCard;
  readonly Calendar = Calendar;
  readonly PieChart = PieChart;
  readonly Plus = Plus;
  readonly Math = Math;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  private bankBalanceService = inject(BankBalanceService);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;

  // Stubbed metrics - will be calculated from real data in Phase 1
  protected metrics = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return {
        totalBalance: 0,
        availableBalance: 0,
        committedBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        netCashFlow: 0
      };
    }

    // Get bank balance for current month
    const monthStr = this.viewDate().toISOString().slice(0, 7);
    const bankBalance = this.bankBalanceService.getBankBalance(profile.id, monthStr);
    
    // Calculate total bills due this month (committed balance)
    const cards = this.cardService.getCardsForProfiles([profile.id]);
    let committedBalance = 0;

    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement && !statement.isPaid) {
        committedBalance += statement.amount;
      }
    }

    const totalBalance = bankBalance !== null ? bankBalance : 0;
    const availableBalance = totalBalance - committedBalance;

    return {
      totalBalance,
      availableBalance,
      committedBalance,
      monthlyIncome: 0, // Stubbed - will be from transactions in Phase 1
      monthlyExpenses: committedBalance, // Approximation for now
      netCashFlow: 0 - committedBalance // Negative for now
    };
  });

  // Upcoming bills (next 7 days)
  protected upcomingBills = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = this.viewDate().toISOString().slice(0, 7);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const bills = cards
      .map(card => {
        const statement = this.statementService.getStatementForMonth(card.id, monthStr);
        if (!statement || statement.isPaid) return null;

        const dueDate = new Date(`${monthStr}-${String(card.dueDay).padStart(2, '0')}`);
        
        if (dueDate >= today && dueDate <= nextWeek) {
          return {
            cardName: `${card.bankName} ${card.cardName}`,
            amount: statement.amount,
            dueDate,
            cardId: card.id
          };
        }
        return null;
      })
      .filter((bill): bill is NonNullable<typeof bill> => bill !== null);

    return bills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  });

  // Quick actions
  protected onAddTransaction(): void {
    // Will be implemented in Phase 1
    console.log('Add transaction');
  }

  protected onPayBill(): void {
    // Open pay bill modal
    console.log('Pay bill');
  }

  protected onViewBudget(): void {
    // Navigate to budget page
    console.log('View budget');
  }
}
