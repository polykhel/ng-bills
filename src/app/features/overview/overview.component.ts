import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  LucideAngularModule, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Calendar, 
  PieChart,
  Plus,
  Target
} from 'lucide-angular';
import { startOfDay, differenceInDays, setDate, parseISO, isValid, addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { AppStateService, ProfileService, CardService, StatementService, BankBalanceService, BankAccountService, SavingsGoalService, TransactionService, BudgetService, CategoryService, UtilsService } from '@services';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LucideAngularModule,
    QuickActionButtonComponent,
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
  readonly Target = Target;
  readonly Math = Math;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  private bankBalanceService = inject(BankBalanceService);
  private bankAccountService = inject(BankAccountService);
  private savingsGoalService = inject(SavingsGoalService);
  private transactionService = inject(TransactionService);
  private budgetService = inject(BudgetService);
  private categoryService = inject(CategoryService);
  protected utils = inject(UtilsService);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;

  // Financial Health metrics (Task 5)
  protected financialHealth = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return {
        liquidCash: 0,
        committedFunds: 0,
        trueFreeCash: 0,
        isPositive: true
      };
    }

    // Get bank balance for current month (always use today's month for balances)
    const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
    
    // Liquid Cash: Sum of all Bank Balances
    const accounts = this.bankAccountService.activeBankAccounts();
    let liquidCash = 0;
    for (const account of accounts) {
      const storedBalance = this.bankBalanceService.getBankAccountBalance(account.profileId, monthStr, account.id);
      const accountBalance = storedBalance !== null ? storedBalance : (account.initialBalance || 0);
      liquidCash += accountBalance;
    }
    
    // Committed Funds: Sum of all Unpaid Bills + Unpaid Virtual Transactions due this month
    const cards = this.cardService.getCardsForProfiles([profile.id]);
    let committedFunds = 0;

    // Add unpaid bills
    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement && !statement.isPaid) {
        committedFunds += statement.amount || 0;
      }
    }

    // Add unpaid virtual transactions due this month
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const allTransactions = this.transactionService.transactions();
    
    const unpaidVirtualTransactions = allTransactions.filter(t => {
      if (t.profileId !== profile.id) return false;
      if (!t.isVirtual) return false;
      if (t.isPaid) return false;
      
      const transactionDate = parseISO(t.date);
      return transactionDate >= monthStart && transactionDate <= monthEnd;
    });

    for (const transaction of unpaidVirtualTransactions) {
      committedFunds += transaction.amount;
    }

    // True Free Cash: Liquid Cash - Committed Funds
    const trueFreeCash = liquidCash - committedFunds;
    const isPositive = trueFreeCash >= 0;

    return {
      liquidCash,
      committedFunds,
      trueFreeCash,
      isPositive
    };
  });

  // Legacy metrics (kept for backward compatibility, but simplified)
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

    // Get bank balance for current month (always use today's month for balances)
    const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
    
    // Sum all account balances, including initialBalance for accounts without stored balances
    const accounts = this.bankAccountService.activeBankAccounts();
    let bankBalance = 0;
    for (const account of accounts) {
      const storedBalance = this.bankBalanceService.getBankAccountBalance(account.profileId, monthStr, account.id);
      const accountBalance = storedBalance !== null ? storedBalance : (account.initialBalance || 0);
      bankBalance += accountBalance;
    }
    
    // Calculate total bills due this month (committed balance)
    const cards = this.cardService.getCardsForProfiles([profile.id]);
    let committedBalance = 0;

    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement && !statement.isPaid) {
        committedBalance += statement.amount;
      }
    }

    // Calculate monthly income and expenses from transactions
    const viewDate = this.viewDate();
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    
    const transactions = this.transactionService.getTransactions({
      profileIds: [profile.id],
      dateRange: {
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10)
      }
    });

    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    // Get all cards and statements for checking if credit card statements are paid
    const allCards = this.cardService.cards();
    const statements = this.statementService.statements();

    transactions.forEach(t => {
      // Skip transactions where someone else paid
      if (t.paidByOther) return;
      // Skip transactions where this profile paid for someone else
      if (t.paidByOtherProfileId === profile.id && t.profileId !== profile.id) return;

      if (t.type === 'income') {
        monthlyIncome += t.amount;
      } else {
        // For credit card expenses: only count if statement is paid (cash flow perspective)
        // Other payment methods count immediately
        if (t.paymentMethod === 'card' && t.cardId) {
          const card = allCards.find(c => c.id === t.cardId);
          if (card) {
            // Determine which statement month this transaction belongs to (cutoff-aware)
            const transactionDate = parseISO(t.date);
            const dayOfMonth = transactionDate.getDate();
            
            let statementDate: Date;
            if (dayOfMonth >= card.cutoffDay) {
              // Transaction is at or after cutoff → belongs to NEXT month's statement
              statementDate = addMonths(startOfMonth(transactionDate), 1);
            } else {
              // Transaction is before cutoff → belongs to THIS month's statement
              statementDate = startOfMonth(transactionDate);
            }

            const monthStr = format(statementDate, 'yyyy-MM');
            const statement = statements.find(s => s.cardId === t.cardId && s.monthStr === monthStr);
            
            // Only count if statement exists and is paid
            if (statement && statement.isPaid) {
              monthlyExpenses += t.amount;
            }
            // If no statement or not paid, don't count it
          } else {
            // Card not found, default to counting it
            monthlyExpenses += t.amount;
          }
        } else {
          // For all other payment methods, count immediately
          monthlyExpenses += t.amount;
        }
      }
    });

    const totalBalance = bankBalance !== null ? bankBalance : 0;
    const availableBalance = totalBalance - committedBalance;
    const netCashFlow = monthlyIncome - monthlyExpenses;

    return {
      totalBalance,
      availableBalance,
      committedBalance,
      monthlyIncome,
      monthlyExpenses,
      netCashFlow
    };
  });

  // Upcoming bills (next 7 days)
  protected upcomingBills = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const viewDate = this.viewDate();
    const today = startOfDay(new Date());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const bills: Array<{
      cardName: string;
      amount: number;
      dueDate: Date;
      cardId: string;
    }> = [];

    // Check current month and next month (in case we're near month end)
    const currentMonthStr = format(viewDate, 'yyyy-MM');
    const nextMonthStr = format(addMonths(viewDate, 1), 'yyyy-MM');

    for (const card of cards) {
      // Check current month
      let statement = this.statementService.getStatementForMonth(card.id, currentMonthStr);
      let monthDate = viewDate;
      
      // If no statement in current month or it's paid, check next month
      if (!statement || statement.isPaid) {
        statement = this.statementService.getStatementForMonth(card.id, nextMonthStr);
        monthDate = addMonths(viewDate, 1);
      }

      if (!statement || statement.isPaid) continue;

      // Calculate due date (use custom due date if available, otherwise use card's due day)
      let dueDate: Date;
      if (statement.customDueDate) {
        dueDate = parseISO(statement.customDueDate);
        if (!isValid(dueDate)) {
          // Fallback to default if custom date is invalid
          dueDate = setDate(monthDate, card.dueDay);
        }
      } else {
        dueDate = setDate(monthDate, card.dueDay);
      }

      if (!isValid(dueDate)) continue;

      const dueDateNormalized = startOfDay(dueDate);
      const daysUntilDue = differenceInDays(dueDateNormalized, today);

      // Include bills due today or within the next 7 days
      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        bills.push({
          cardName: `${card.bankName} ${card.cardName}`,
          amount: statement.amount,
          dueDate: dueDateNormalized,
          cardId: card.id
        });
      }
    }

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

  // Savings goals with progress
  protected savingsGoals = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];
    
    return this.savingsGoalService.getGoalsWithProgress(profile.id)
      .filter(g => !g.progress.isCompleted)
      .slice(0, 3); // Show top 3 active goals
  });

  // Recent transactions (last 5)
  protected recentTransactions = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    const transactions = this.transactionService.getTransactions({
      profileIds: [profile.id]
    });

    // Filter out transactions where someone else paid
    const relevantTransactions = transactions.filter(t => {
      if (t.paidByOther) return false;
      if (t.paidByOtherProfileId === profile.id && t.profileId !== profile.id) return false;
      return true;
    });

    // Sort by date (most recent first) and take top 5
    return relevantTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  });

  // Budget summary
  protected budgetSummary = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return null;

    const viewDate = this.viewDate();
    const budget = this.budgetService.getActiveBudget(profile.id, viewDate, 'monthly');
    
    if (!budget) return null;

    const budgetWithSpending = this.budgetService.getBudgetWithSpending(budget, viewDate);
    const categories = this.categoryService.getCategories();

    // Get top 3 categories by spending
    const topCategories = budgetWithSpending.allocations
      .map(alloc => {
        const category = categories.find(c => c.id === alloc.categoryId);
        const percentage = alloc.allocatedAmount > 0 
          ? Math.min((alloc.spent / alloc.allocatedAmount) * 100, 100)
          : 0;
        return {
          categoryId: alloc.categoryId,
          categoryName: category?.name || 'Unknown',
          allocated: alloc.allocatedAmount,
          spent: alloc.spent,
          remaining: alloc.remaining,
          percentage,
          color: category?.color || '#6b7280'
        };
      })
      .filter(alloc => alloc.allocated > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 3);

    return {
      totalBudget: budgetWithSpending.totalAllocated,
      totalSpent: budgetWithSpending.totalSpent,
      remaining: budgetWithSpending.totalRemaining,
      percentageUsed: budgetWithSpending.percentageUsed,
      topCategories,
      hasAlerts: budgetWithSpending.alerts.length > 0
    };
  });

  // Helper methods
  protected getCategoryName(categoryId: string): string {
    const category = this.categoryService.getCategory(categoryId);
    return category?.name || 'Unknown';
  }

  protected formatDate(dateStr: string): string {
    return this.utils.formatDate(dateStr, 'MMM d');
  }

  protected formatCurrency(amount: number): string {
    return this.utils.formatCurrency(amount);
  }
}
