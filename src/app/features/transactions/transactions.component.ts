import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Edit2,
  FileText,
  Filter,
  LucideAngularModule,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Building2,
} from 'lucide-angular';
import {
  AppStateService,
  BankAccountService,
  BankBalanceService,
  CardService,
  CategoryService,
  ProfileService,
  TransactionService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent, QuickActionButtonComponent } from '@components';
import type { PaymentMethod, Transaction, TransactionFilter, TransactionType } from '@shared/types';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Transactions Page Component
 * Displays all income and expense transactions with filtering
 * Auto-links credit card transactions to monthly bills
 */
@Component({
  selector: 'app-transactions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    QuickActionButtonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './transactions.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .transaction-form {
        background: rgb(249, 250, 251);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 24px;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-bottom: 12px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group label {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
        color: rgb(71, 85, 105);
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 8px;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 4px;
        font-size: 14px;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 600;
      }

      .btn-primary {
        background: rgb(37, 99, 235);
        color: white;
      }

      .btn-secondary {
        background: white;
        border: 1px solid rgb(226, 232, 240);
        color: rgb(71, 85, 105);
      }

      .transaction-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-bottom: 1px solid rgb(226, 232, 240);
      }

      .transaction-info {
        flex: 1;
      }

      .transaction-description {
        font-weight: 600;
        color: rgb(15, 23, 42);
      }

      .transaction-meta {
        font-size: 12px;
        color: rgb(100, 116, 139);
        margin-top: 4px;
      }

      .transaction-amount {
        font-weight: 700;
        font-size: 16px;
        text-align: right;
        min-width: 100px;
      }

      .amount-expense {
        color: rgb(220, 38, 38);
      }

      .amount-income {
        color: rgb(34, 197, 94);
      }

      .transaction-actions {
        display: flex;
        gap: 8px;
        margin-left: 16px;
      }

      .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: rgb(100, 116, 139);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s, background-color 0.2s;
      }

      .icon-btn:hover {
        color: rgb(15, 23, 42);
        background-color: rgb(241, 245, 249);
        border-radius: 4px;
      }
    `,
  ],
})
export class TransactionsComponent {
  readonly Plus = Plus;
  readonly Filter = Filter;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly Wallet = Wallet;
  readonly FileText = FileText;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly Building2 = Building2;

  private appState = inject(AppStateService);
  protected profileService = inject(ProfileService);
  protected bankAccountService = inject(BankAccountService);
  protected bankBalanceService = inject(BankBalanceService);
  // Form state - using signals for better change detection
  protected showForm = signal<boolean>(false);
  protected editingTransactionId = signal<string | null>(null);
  protected formData: Partial<Transaction> = this.getEmptyForm();
  protected showBankBalanceManagement = false;
  // Filter state - using signals so computed can react to changes
  protected filterType = signal<TransactionType | 'all'>('all');
  protected filterPaymentMethod = signal<PaymentMethod | 'all'>('all');
  protected filterCardId = signal<string | ''>('');
  protected filterRecurring = signal<boolean | 'all'>('all');
  protected showAllTransactions = signal<boolean>(false);

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  protected multiProfileMode = this.appState.multiProfileMode;
  protected selectedProfileIds = this.appState.selectedProfileIds;
  // Computed summary
  protected summary = computed(() => {
    const transactions = this.filteredTransactions();

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      netChange: totalIncome - totalExpenses,
      transactionCount: transactions.length,
    };
  });
  private transactionService = inject(TransactionService);
  private cdr = inject(ChangeDetectorRef);
  
  constructor() {
    // Watch for transaction changes and trigger change detection for OnPush
    effect(() => {
      // Read the transactions signal to establish dependency
      const transactions = this.transactionService.transactions();
      // Also read other signals that might affect the view
      this.activeProfile();
      this.multiProfileMode();
      this.selectedProfileIds();
      // Manually trigger change detection for OnPush
      this.cdr.markForCheck();
    });
  }
  
  // Pre-computed running balances for all transactions (performance optimization)
  // This avoids recalculating running balance for each transaction in the template
  private transactionRunningBalances = computed(() => {
    const transactions = this.filteredTransactions();
    const balances = new Map<string, number>();
    
    // Pre-compute balances for all filtered transactions
    // Use the original getRunningBalance logic but cache results
    transactions.forEach(transaction => {
      balances.set(transaction.id, this.getRunningBalance(transaction.date));
    });
    
    return balances;
  });

  // Computed filtered transactions
  // Shows transactions where:
  // 1. User owns the transaction (profileId matches)
  // 2. User paid for it (paidByOtherProfileId matches current profile)
  // In multi-profile mode: shows transactions from selected profiles
  protected filteredTransactions = computed(() => {
    const multiMode = this.multiProfileMode();
    const selectedIds = this.selectedProfileIds();
    const profile = this.activeProfile();

    // Get all transactions from transaction service signal (required for OnPush)
    const allTransactions = this.transactionService.transactions();

    // Filter to transactions relevant to selected profiles
    let relevantTransactions: Transaction[];
    
    if (multiMode && selectedIds.length > 0) {
      // Multi-profile mode: show transactions from selected profiles
      relevantTransactions = allTransactions.filter((t) => {
        // Include if transaction belongs to one of the selected profiles
        if (selectedIds.includes(t.profileId)) return true;
        // Include if one of the selected profiles paid for it (shared expense)
        if (t.paidByOtherProfileId && selectedIds.includes(t.paidByOtherProfileId)) return true;
        return false;
      });
    } else {
      // Single profile mode: show transactions for active profile
      if (!profile) return [];
      
      relevantTransactions = allTransactions.filter((t) => {
        // Include if this profile owns the transaction
        if (t.profileId === profile.id) return true;
        // Include if this profile paid for it (shared expense)
        if (t.paidByOtherProfileId === profile.id) return true;
        return false;
      });
    }

    // Apply additional filters
    const filterType = this.filterType();
    if (filterType !== 'all') {
      relevantTransactions = relevantTransactions.filter((t) => t.type === filterType);
    }

    const filterPaymentMethod = this.filterPaymentMethod();
    if (filterPaymentMethod !== 'all') {
      relevantTransactions = relevantTransactions.filter(
        (t) => t.paymentMethod === filterPaymentMethod,
      );
    }

    const filterCardId = this.filterCardId();
    if (filterCardId) {
      relevantTransactions = relevantTransactions.filter((t) => t.cardId === filterCardId);
    }

    const filterRecurring = this.filterRecurring();
    if (filterRecurring !== 'all') {
      relevantTransactions = relevantTransactions.filter(
        (t) => Boolean(t.isRecurring) === filterRecurring,
      );
    }

    // Filter by month if not showing all transactions
    const showAll = this.showAllTransactions();
    if (!showAll) {
      const currentDate = this.viewDate();
      const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      relevantTransactions = relevantTransactions.filter((t) => {
        return t.date >= monthStart && t.date <= monthEnd;
      });
    }

    return relevantTransactions;
  });
  private cardService = inject(CardService);
  // Computed cards: show cards for selected profiles in multi-profile mode, otherwise active profile
  protected cards = computed(() => {
    const multiMode = this.multiProfileMode();
    const selectedIds = this.selectedProfileIds();
    
    if (multiMode && selectedIds.length > 0) {
      return this.cardService.getCardsForProfiles(selectedIds);
    }
    return this.cardService.activeCards();
  });
  private categoryService = inject(CategoryService);
  protected categories = this.categoryService.categories;
  // Computed bank accounts: show accounts for selected profiles in multi-profile mode, otherwise active profile
  protected bankAccounts = computed(() => {
    const multiMode = this.multiProfileMode();
    const selectedIds = this.selectedProfileIds();
    
    if (multiMode && selectedIds.length > 0) {
      return this.bankAccountService.getBankAccountsForProfiles(selectedIds);
    }
    return this.bankAccountService.activeBankAccounts();
  });

  // Memoized lookups for performance
  private cardNameCache = computed(() => {
    const cardsMap = new Map<string, string>();
    this.cards().forEach(card => {
      cardsMap.set(card.id, `${card.bankName} ${card.cardName}`);
    });
    return cardsMap;
  });

  private bankAccountNameCache = computed(() => {
    const accountsMap = new Map<string, string>();
    this.bankAccounts().forEach(account => {
      accountsMap.set(account.id, account.bankName);
    });
    return accountsMap;
  });

  private profileNameCache = computed(() => {
    const profilesMap = new Map<string, string>();
    this.profileService.profiles().forEach(profile => {
      profilesMap.set(profile.id, profile.name);
    });
    return profilesMap;
  });

  protected onAddTransaction(): void {
    // If currently editing, clear the form and close it
    if (this.editingTransactionId()) {
      this.editingTransactionId.set(null);
      this.formData = this.getEmptyForm();
      this.showForm.set(false);
      return;
    }
    // Otherwise toggle the form
    const currentValue = this.showForm();
    this.showForm.set(!currentValue);
    if (!currentValue) {
      this.formData = this.getEmptyForm();
    } else {
      this.formData = this.getEmptyForm();
    }
  }

  protected onEditTransaction(transaction: Transaction, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingTransactionId.set(transaction.id);
    this.formData = {
      type: transaction.type,
      amount: transaction.amount,
      date: transaction.date,
      categoryId: transaction.categoryId,
      description: transaction.description,
      notes: transaction.notes,
      paymentMethod: transaction.paymentMethod,
      cardId: transaction.cardId,
      bankId: transaction.bankId,
      fromBankId: transaction.fromBankId,
      toBankId: transaction.toBankId,
      transferFee: transaction.transferFee,
      paidByOther: transaction.paidByOther || false,
      paidByOtherProfileId: transaction.paidByOtherProfileId,
      paidByOtherName: transaction.paidByOtherName,
    };
    this.showForm.set(true);
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onFilter(): void {
    // Reset filters
    this.filterType.set('all');
    this.filterPaymentMethod.set('all');
    this.filterCardId.set('');
    this.filterRecurring.set('all');
    this.showAllTransactions.set(false);
  }

  /**
   * Check if transaction is an installment
   */
  protected isInstallment(transaction: Transaction): boolean {
    return Boolean(transaction.isRecurring && transaction.recurringRule?.type === 'installment');
  }

  /**
   * Get installment progress text (e.g., "5/12")
   */
  protected getInstallmentProgress(transaction: Transaction): string {
    if (!this.isInstallment(transaction)) return '';
    const currentTerm = transaction.recurringRule?.currentTerm || 0;
    const totalTerms = transaction.recurringRule?.totalTerms || 0;
    const percentage = totalTerms > 0 ? Math.round((currentTerm / totalTerms) * 100) : 0;
    return `${currentTerm}/${totalTerms} (${percentage}%)`;
  }

  /**
   * Get installment progress percentage (0-100)
   */
  protected getInstallmentProgressPercentage(transaction: Transaction): number {
    if (!this.isInstallment(transaction)) return 0;
    const currentTerm = transaction.recurringRule?.currentTerm || 0;
    const totalTerms = transaction.recurringRule?.totalTerms || 0;
    return totalTerms > 0 ? Math.round((currentTerm / totalTerms) * 100) : 0;
  }

  /**
   * Check if installment is completed
   */
  protected isInstallmentCompleted(transaction: Transaction): boolean {
    if (!this.isInstallment(transaction)) return false;
    const currentTerm = transaction.recurringRule?.currentTerm || 0;
    const totalTerms = transaction.recurringRule?.totalTerms || 0;
    return currentTerm >= totalTerms;
  }

  /**
   * Get installment status badge color
   */
  protected getInstallmentStatusColor(transaction: Transaction): string {
    if (!this.isInstallment(transaction)) return 'blue';
    if (this.isInstallmentCompleted(transaction)) return 'green';
    if (transaction.isPaid) return 'emerald';
    const percentage = this.getInstallmentProgressPercentage(transaction);
    if (percentage >= 75) return 'yellow';
    return 'blue';
  }

  protected async onSubmitTransaction(): Promise<void> {
    if (!this.validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    const profile = this.activeProfile();
    if (!profile) return;

    try {
      const editingId = this.editingTransactionId();
      if (editingId) {
        // Update existing transaction
        await this.transactionService.updateTransaction(editingId, {
          type: (this.formData.type || 'expense') as TransactionType,
          amount: this.formData.amount || 0,
          date: this.formData.date || new Date().toISOString().split('T')[0],
          categoryId: this.formData.categoryId || 'uncategorized',
          description: this.formData.description || '',
          notes: this.formData.notes,
          paymentMethod: (this.formData.paymentMethod || 'cash') as PaymentMethod,
          cardId: this.formData.cardId,
          bankId: this.formData.bankId,
          fromBankId: this.formData.fromBankId,
          toBankId: this.formData.toBankId,
          transferFee: this.formData.transferFee,
          paidByOther: this.formData.paidByOther || false,
          paidByOtherProfileId: this.formData.paidByOtherProfileId,
          paidByOtherName: this.formData.paidByOtherName,
        });
      } else {
        // Create new transaction
        const transaction: Transaction = {
          id: crypto.randomUUID(),
          profileId: profile.id,
          type: (this.formData.type || 'expense') as TransactionType,
          amount: this.formData.amount || 0,
          date: this.formData.date || new Date().toISOString().split('T')[0],
          categoryId: this.formData.categoryId || 'uncategorized',
          description: this.formData.description || '',
          notes: this.formData.notes,
          paymentMethod: (this.formData.paymentMethod || 'cash') as PaymentMethod,
          cardId: this.formData.cardId,
          bankId: this.formData.bankId,
          fromBankId: this.formData.fromBankId,
          toBankId: this.formData.toBankId,
          transferFee: this.formData.transferFee,
          paidByOther: this.formData.paidByOther || false,
          paidByOtherProfileId: this.formData.paidByOtherProfileId,
          paidByOtherName: this.formData.paidByOtherName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.transactionService.addTransaction(transaction);
      }
      
      this.showForm.set(false);
      this.editingTransactionId.set(null);
      this.formData = this.getEmptyForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    }
  }

  protected async onDeleteTransaction(id: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!confirm('Delete this transaction?')) return;

    try {
      await this.transactionService.deleteTransaction(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  }

  protected formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  }

  protected getCardName(cardId: string | undefined): string {
    if (!cardId) return '-';
    return this.cardNameCache().get(cardId) ?? 'Unknown Card';
  }

  protected getProfileName(profileId: string): string {
    return this.profileNameCache().get(profileId) ?? 'Unknown';
  }

  /**
   * Get the label for who paid for this transaction
   * Shows profile name if linked, otherwise shows manual name
   */
  protected getPaidByLabel(transaction: Transaction): string {
    if (!transaction.paidByOther) return '';

    if (transaction.paidByOtherProfileId) {
      const profile = this.profileService.profiles().find((p) => p.id === transaction.paidByOtherProfileId);
      return profile ? profile.name : 'Unknown Profile';
    }

    return transaction.paidByOtherName || 'Other';
  }

  protected getBankAccountName(bankId: string | undefined): string {
    if (!bankId) return '-';
    return this.bankAccountNameCache().get(bankId) ?? 'Unknown Account';
  }

  /**
   * Calculate running balance for a specific date
   * Includes all transactions up to and including that date, plus scheduled future transactions
   */
  protected getRunningBalance(date: string): number {
    const profile = this.activeProfile();
    if (!profile) return 0;

    // Get starting balance for the month
    const monthStr = date.slice(0, 7); // yyyy-MM
    const startingBalance = this.bankBalanceService.getBankBalance(profile.id, monthStr) || 0;

    // Get all transactions up to this date (use signal for OnPush compatibility)
    const allTransactions = this.transactionService.transactions();
    const profileTransactions = allTransactions.filter((t) => t.profileId === profile.id);
    
    // Filter transactions up to and including the target date
    const transactionsUpToDate = profileTransactions.filter((t) => t.date <= date);
    
    // Also include scheduled/recurring transactions that should have occurred by this date
    const scheduledTransactions = profileTransactions.filter((t) => {
      if (!t.isRecurring || !t.recurringRule) return false;
      if (t.date <= date) return false; // Already included in transactionsUpToDate
      
      // Check if this is a recurring transaction that should have occurred by the target date
      // For recurring transactions with nextDate, include if nextDate <= target date
      if (t.recurringRule.nextDate && t.recurringRule.nextDate <= date) {
        return true;
      }
      
      // For installments, check if they should have occurred by target date
      if (t.recurringRule.type === 'installment' && t.recurringRule.startDate) {
        const startDate = parseISO(t.recurringRule.startDate);
        const targetDate = parseISO(date);
        if (startDate <= targetDate) {
          return true;
        }
      }
      
      return false;
    });

    // Combine all relevant transactions (avoid duplicates)
    const transactionIds = new Set(transactionsUpToDate.map(t => t.id));
    const uniqueScheduled = scheduledTransactions.filter(t => !transactionIds.has(t.id));
    const allRelevantTransactions = [...transactionsUpToDate, ...uniqueScheduled];
    
    // Sort by date
    allRelevantTransactions.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate running balance
    let balance = startingBalance;
    for (const transaction of allRelevantTransactions) {
      if (transaction.type === 'income') {
        // Income adds to balance
        if (transaction.bankId) {
          balance += transaction.amount;
        }
      } else if (transaction.type === 'expense') {
        // Expense subtracts from balance
        if (transaction.paymentMethod === 'bank_transfer' && transaction.bankId) {
          balance -= transaction.amount;
        } else if (transaction.paymentMethod === 'bank_to_bank' && transaction.fromBankId) {
          // Bank-to-bank transfer: subtract from source account
          balance -= transaction.amount;
          if (transaction.transferFee) {
            balance -= transaction.transferFee;
          }
        }
      }
    }

    return Math.round(balance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get running balance for the transaction's date (memoized)
   */
  protected getTransactionRunningBalance(transaction: Transaction): number {
    return this.transactionRunningBalances().get(transaction.id) ?? 0;
  }

  protected onAddBankAccount(): void {
    this.appState.openModal('bank-account-form', {});
  }

  protected onEditBankAccount(accountId: string): void {
    this.appState.openModal('bank-account-form', { accountId });
  }

  protected getCurrentMonthStr(): string {
    return format(new Date(), 'yyyy-MM');
  }

  protected getBankBalanceForAccount(account: { profileId: string; initialBalance?: number }): number {
    const profile = this.activeProfile();
    if (!profile) return account.initialBalance || 0;
    const monthStr = this.getCurrentMonthStr();
    return this.bankBalanceService.getBankBalance(account.profileId, monthStr) || account.initialBalance || 0;
  }

  protected async onUpdateBankBalance(bankId: string, value: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) return;

    const balance = parseFloat(value) || 0;
    const monthStr = this.getCurrentMonthStr();
    this.bankBalanceService.updateBankBalance(profile.id, monthStr, balance);
  }

  /**
   * Get context label for shared transactions
   * Shows different context depending on whether you own it or paid for it
   */
  protected getTransactionContext(transaction: Transaction): string {
    const profile = this.activeProfile();
    if (!profile) return '';

    if (transaction.profileId === profile.id && transaction.paidByOther) {
      // You own it but someone else paid
      const paidBy = this.getPaidByLabel(transaction);
      return `💳 Paid by ${paidBy}`;
    }

    if (transaction.paidByOtherProfileId === profile.id && transaction.profileId !== profile.id) {
      // You paid for someone else's transaction
      const owner = this.profileService.profiles().find((p) => p.id === transaction.profileId);
      return `💳 You paid for ${owner?.name || 'them'}`;
    }

    return '';
  }

  private validateForm(): boolean {
    return !!(
      this.formData.amount &&
      this.formData.amount > 0 &&
      this.formData.description &&
      this.formData.date
    );
  }

  private getEmptyForm(): Partial<Transaction> {
    return {
      type: 'expense',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
      description: '',
      paymentMethod: 'cash',
      categoryId: 'uncategorized',
      paidByOther: false,
      paidByOtherProfileId: undefined,
      paidByOtherName: '',
      bankId: undefined,
      fromBankId: undefined,
      toBankId: undefined,
      transferFee: undefined,
    };
  }
}
