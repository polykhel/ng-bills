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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
} from 'lucide-angular';
import {
  AppStateService,
  BankAccountService,
  BankBalanceService,
  CardService,
  CategoryService,
  ProfileService,
  StatementService,
  TransactionService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent, QuickActionButtonComponent } from '@components';
import type { PaymentMethod, Transaction, TransactionFilter, TransactionType } from '@shared/types';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, differenceInCalendarMonths, setDate } from 'date-fns';

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
  readonly Search = Search;
  readonly ArrowUpDown = ArrowUpDown;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly CheckCircle2 = CheckCircle2;
  readonly Circle = Circle;

  private appState = inject(AppStateService);
  protected profileService = inject(ProfileService);
  protected bankAccountService = inject(BankAccountService);
  protected bankBalanceService = inject(BankBalanceService);
  // Form state - using signals for better change detection
  protected showForm = signal<boolean>(false);
  protected editingTransactionId = signal<string | null>(null);
  protected formData: Partial<Transaction> = this.getEmptyForm();
  protected showBankBalanceManagement = false;
  // Recurring/installment form state
  protected isRecurringTransaction = signal<boolean>(false);
  protected recurringType = signal<'installment' | 'subscription' | 'custom'>('subscription');
  protected installmentMode = signal<'date' | 'term'>('date');
  protected recurringFormData = {
    // Installment fields
    totalPrincipal: undefined as number | undefined,
    totalTerms: undefined as number | undefined,
    monthlyAmortization: undefined as number | undefined,
    startDate: undefined as string | undefined,
    currentTerm: undefined as number | undefined,
    interestRate: undefined as number | undefined,
    // Subscription/Custom fields
    frequency: 'monthly' as 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly',
    nextDate: undefined as string | undefined,
  };
  // Filter state - using signals so computed can react to changes
  protected filterType = signal<TransactionType | 'all'>('all');
  protected filterPaymentMethod = signal<PaymentMethod | 'all'>('all');
  protected filterCardId = signal<string | ''>('');
  protected filterRecurring = signal<boolean | 'all'>('all');
  protected showAllTransactions = signal<boolean>(false);
  protected filterFromDate = signal<string | ''>('');
  protected filterToDate = signal<string | ''>('');
  protected hidePaidTransactions = signal<boolean>(false);
  // Search and sort state
  protected searchQuery = signal<string>('');
  protected sortField = signal<'date' | 'amount' | 'description'>('date');
  protected sortDirection = signal<'asc' | 'desc'>('asc');

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  protected multiProfileMode = this.appState.multiProfileMode;
  protected selectedProfileIds = this.appState.selectedProfileIds;
  // Computed summary
  // Credit card expenses only count when the statement is paid (cash flow perspective)
  protected summary = computed(() => {
    const transactions = this.filteredTransactions();
    const cards = this.cardService.cards();
    const statements = this.statementService.statements();

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // For expenses: only count credit card transactions if their statement is paid
    // Other payment methods (cash, bank_transfer, etc.) count immediately
    const totalExpenses = transactions
      .filter((t) => {
        if (t.type !== 'expense') return false;
        
        // For credit card transactions, only count if statement is paid
        if (t.paymentMethod === 'card' && t.cardId) {
          const card = cards.find(c => c.id === t.cardId);
          if (!card) return true; // Card not found, default to counting it
          
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
          
          // If no statement exists yet, it's not paid (don't count it)
          // If statement exists, check if it's paid
          return statement ? statement.isPaid : false;
        }
        
        // For all other payment methods, count immediately
        return true;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      netChange: totalIncome - totalExpenses,
      transactionCount: transactions.length,
    };
  });
  private transactionService = inject(TransactionService);
  private statementService = inject(StatementService);
  

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

    // Filter by date range
    const showAll = this.showAllTransactions();
    const fromDate = this.filterFromDate();
    const toDate = this.filterToDate();
    const currentDate = this.viewDate();
    const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    
    if (fromDate || toDate) {
      // Show transactions within the selected date range, but limited to current month
      const filterStart = fromDate ? (fromDate >= monthStart ? fromDate : monthStart) : monthStart;
      const filterEnd = toDate ? (toDate <= monthEnd ? toDate : monthEnd) : monthEnd;
      
      relevantTransactions = relevantTransactions.filter((t) => {
        return t.date >= filterStart && t.date <= filterEnd;
      });
    } else if (!showAll) {
      // Filter by current month if not showing all transactions
      relevantTransactions = relevantTransactions.filter((t) => {
        return t.date >= monthStart && t.date <= monthEnd;
      });
    }

    // Filter out paid transactions if hidePaidTransactions is enabled
    const hidePaid = this.hidePaidTransactions();
    if (hidePaid) {
      relevantTransactions = relevantTransactions.filter((t) => {
        // Hide if transaction is marked as paid
        if (t.isPaid) return false;
        // Hide if it's a completed installment
        if (this.isInstallment(t) && this.isInstallmentCompleted(t)) return false;
        return true;
      });
    }

    // Apply search filter
    const searchQuery = this.searchQuery().trim().toLowerCase();
    if (searchQuery) {
      relevantTransactions = relevantTransactions.filter((t) => {
        const description = t.description.toLowerCase();
        const notes = t.notes?.toLowerCase() || '';
        const amount = t.amount.toString();
        return description.includes(searchQuery) || 
               notes.includes(searchQuery) || 
               amount.includes(searchQuery);
      });
    }

    // Apply sorting
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();
    const sortMultiplier = sortDirection === 'asc' ? 1 : -1;

    relevantTransactions = [...relevantTransactions].sort((a, b) => {
      switch (sortField) {
        case 'date':
          return (a.date.localeCompare(b.date)) * sortMultiplier;
        case 'amount':
          return (a.amount - b.amount) * sortMultiplier;
        case 'description':
          return a.description.localeCompare(b.description) * sortMultiplier;
        default:
          return 0;
      }
    });

    return relevantTransactions;
  });
  private cardService = inject(CardService);
  
  /**
   * Get card's due date for the current month
   */
  protected getCardDueDate(cardId: string | undefined): string | undefined {
    if (!cardId) return undefined;
    const card = this.cardService.getCardById(cardId);
    if (!card) return undefined;
    const currentMonth = startOfMonth(this.viewDate());
    const dueDate = setDate(currentMonth, card.dueDay);
    return format(dueDate, 'yyyy-MM-dd');
  }
  
  /**
   * When card is selected for an installment, auto-set start date to card's due date
   */
  protected onCardChangeForInstallment(): void {
    if (this.isRecurringTransaction() && 
        this.recurringType() === 'installment' && 
        this.formData.paymentMethod === 'card' && 
        this.formData.cardId) {
      const cardDueDate = this.getCardDueDate(this.formData.cardId);
      if (cardDueDate && !this.recurringFormData.startDate) {
        this.recurringFormData.startDate = cardDueDate;
        this.installmentMode.set('date');
        this.onStartDateChange(); // Recalculate current term
      }
    }
  }
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
      this.resetRecurringForm();
      this.showForm.set(false);
      return;
    }
    // Otherwise toggle the form
    const currentValue = this.showForm();
    this.showForm.set(!currentValue);
    if (!currentValue) {
      this.formData = this.getEmptyForm();
      this.resetRecurringForm();
    } else {
      this.formData = this.getEmptyForm();
      this.resetRecurringForm();
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
      hasDebtObligation: transaction.hasDebtObligation || false,
      debtAmount: transaction.debtAmount,
      debtDueDate: transaction.debtDueDate,
      debtPaid: transaction.debtPaid || false,
      debtPaidDate: transaction.debtPaidDate,
      linkedDebtTransactionId: transaction.linkedDebtTransactionId,
    };
    
    // Load recurring/installment data if present
    if (transaction.isRecurring && transaction.recurringRule) {
      this.isRecurringTransaction.set(true);
      this.recurringType.set(transaction.recurringRule.type || 'subscription');
      
      if (transaction.recurringRule.type === 'installment') {
        // Calculate current term from startDate if available
        let calculatedCurrentTerm = transaction.recurringRule.currentTerm;
        if (transaction.recurringRule.startDate) {
          const startDate = parseISO(transaction.recurringRule.startDate);
          const currentMonth = startOfMonth(this.viewDate());
          const startMonth = startOfMonth(startDate);
          const diff = differenceInCalendarMonths(currentMonth, startMonth);
          calculatedCurrentTerm = Math.max(1, diff + 1);
        }
        
        // If charged to a card, use card's current due date for the start date
        let startDate = transaction.recurringRule.startDate;
        if (transaction.paymentMethod === 'card' && transaction.cardId) {
          const cardDueDate = this.getCardDueDate(transaction.cardId);
          if (cardDueDate) {
            // Preserve the original month but use card's due day
            const originalDate = transaction.recurringRule.startDate ? parseISO(transaction.recurringRule.startDate) : new Date();
            const card = this.cardService.getCardById(transaction.cardId);
            if (card) {
              startDate = format(setDate(originalDate, card.dueDay), 'yyyy-MM-dd');
            }
          }
        }
        
        this.recurringFormData = {
          totalPrincipal: transaction.recurringRule.totalPrincipal,
          totalTerms: transaction.recurringRule.totalTerms,
          monthlyAmortization: transaction.amount, // Use transaction amount as monthly amort
          startDate: startDate,
          currentTerm: calculatedCurrentTerm,
          interestRate: transaction.recurringRule.interestRate,
          frequency: transaction.recurringRule.frequency || 'monthly',
          nextDate: transaction.recurringRule.nextDate,
        };
        // Determine mode based on whether we have startDate or need to calculate from currentTerm
        if (startDate) {
          this.installmentMode.set('date');
        } else if (transaction.recurringRule.currentTerm) {
          this.installmentMode.set('term');
        }
      } else {
        // Subscription or custom
        this.recurringFormData = {
          totalPrincipal: undefined,
          totalTerms: undefined,
          monthlyAmortization: undefined,
          startDate: undefined,
          currentTerm: undefined,
          interestRate: undefined,
          frequency: transaction.recurringRule.frequency || 'monthly',
          nextDate: transaction.recurringRule.nextDate || transaction.date,
        };
      }
    } else {
      this.resetRecurringForm();
    }
    
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
    this.filterFromDate.set('');
    this.filterToDate.set('');
    this.hidePaidTransactions.set(false);
    this.searchQuery.set('');
    this.sortField.set('date');
    this.sortDirection.set('desc');
  }

  /**
   * Get the minimum date for the date pickers (start of current month)
   */
  protected getMinDate(): string {
    const currentDate = this.viewDate();
    return format(startOfMonth(currentDate), 'yyyy-MM-dd');
  }

  /**
   * Get the maximum date for the date pickers (end of current month)
   */
  protected getMaxDate(): string {
    const currentDate = this.viewDate();
    return format(endOfMonth(currentDate), 'yyyy-MM-dd');
  }

  /**
   * Mark a transaction as paid
   */
  protected async onMarkPaid(transaction: Transaction, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      if (transaction.isPaid) {
        await this.transactionService.markTransactionUnpaid(transaction.id);
      } else {
        await this.transactionService.markTransactionPaid(transaction.id);
      }
    } catch (error) {
      console.error('Error marking transaction as paid/unpaid:', error);
      alert('Failed to update transaction status');
    }
  }

  protected onSortChange(field: 'date' | 'amount' | 'description'): void {
    if (this.sortField() === field) {
      // Toggle direction if same field
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default direction
      this.sortField.set(field);
      this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
    }
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
      // Check for specific validation errors
      if (
        this.formData.type === 'income' &&
        this.formData.hasDebtObligation &&
        (!this.formData.debtAmount || this.formData.debtAmount <= 0)
      ) {
        alert('Please enter a valid debt amount');
        return;
      }
      if (
        this.formData.type === 'income' &&
        this.formData.hasDebtObligation &&
        !this.formData.debtDueDate
      ) {
        alert('Please enter a debt due date');
        return;
      }
      alert('Please fill in all required fields');
      return;
    }

    // Validate recurring transaction fields if enabled
    if (this.isRecurringTransaction()) {
      if (this.recurringType() === 'installment') {
        if (!this.recurringFormData.totalPrincipal || this.recurringFormData.totalPrincipal <= 0) {
          alert('Please enter a valid total principal amount for the installment');
          return;
        }
        if (!this.recurringFormData.totalTerms || this.recurringFormData.totalTerms <= 0) {
          alert('Please enter a valid number of terms (months) for the installment');
          return;
        }
        if (this.installmentMode() === 'date' && !this.recurringFormData.startDate) {
          alert('Please enter a start date for the installment');
          return;
        }
        if (this.installmentMode() === 'term' && (!this.recurringFormData.currentTerm || this.recurringFormData.currentTerm <= 0)) {
          alert('Please enter a valid current term number');
          return;
        }
      } else {
        // Subscription or custom
        if (!this.recurringFormData.nextDate) {
          alert('Please enter the next payment date for the recurring transaction');
          return;
        }
      }
    }

    const profile = this.activeProfile();
    if (!profile) return;

    try {
      const editingId = this.editingTransactionId();
      
      // Get existing transaction if editing
      let existingTransaction: Transaction | undefined;
      if (editingId) {
        existingTransaction = this.transactionService.transactions().find(t => t.id === editingId);
      }
      
      // Calculate recurring rule if this is a recurring transaction
      let recurringRule = undefined;
      let transactionAmount = this.formData.amount || 0;
      
      if (this.isRecurringTransaction()) {
        if (this.recurringType() === 'installment') {
          // Installment type
          // Calculate start date based on mode
          let calculatedStartDate = this.recurringFormData.startDate;
          
          // If charged to a card, use card's due date if start date not explicitly set
          if (this.formData.paymentMethod === 'card' && this.formData.cardId) {
            const cardDueDate = this.getCardDueDate(this.formData.cardId);
            if (cardDueDate && (!calculatedStartDate || this.installmentMode() === 'date' && !this.recurringFormData.startDate)) {
              calculatedStartDate = cardDueDate;
            }
          }
          
          if (this.installmentMode() === 'term') {
            const currentTerm = this.recurringFormData.currentTerm || 1;
            const backDate = subMonths(this.viewDate(), currentTerm - 1);
            calculatedStartDate = format(backDate, 'yyyy-MM-dd');
          }
          
          // Calculate monthly amortization if not provided
          const monthlyAmort = this.recurringFormData.monthlyAmortization ||
            (this.recurringFormData.totalPrincipal! / this.recurringFormData.totalTerms!);
          
          // Use monthly amortization as transaction amount
          transactionAmount = monthlyAmort;
          
          // Calculate end date
          const startDateObj = parseISO(calculatedStartDate!);
          const endDate = format(addMonths(startDateObj, this.recurringFormData.totalTerms!), 'yyyy-MM-dd');
          
          // Calculate current term from startDate
          let calculatedCurrentTerm: number;
          if (this.installmentMode() === 'term') {
            // Use the manually entered current term
            calculatedCurrentTerm = this.recurringFormData.currentTerm || 1;
          } else {
            // Calculate from startDate and current viewDate
            const currentMonth = startOfMonth(this.viewDate());
            const startMonth = startOfMonth(startDateObj);
            const diff = differenceInCalendarMonths(currentMonth, startMonth);
            calculatedCurrentTerm = Math.max(1, diff + 1);
          }
          
          // Generate installment group ID (preserve existing if editing, otherwise create new)
          const installmentGroupId = editingId && existingTransaction?.recurringRule?.installmentGroupId
            ? existingTransaction.recurringRule.installmentGroupId
            : `installment_${crypto.randomUUID()}`;
          
          recurringRule = {
            type: 'installment' as const,
            frequency: 'monthly' as const,
            totalPrincipal: this.recurringFormData.totalPrincipal,
            currentTerm: calculatedCurrentTerm,
            totalTerms: this.recurringFormData.totalTerms,
            startDate: calculatedStartDate,
            endDate,
            interestRate: this.recurringFormData.interestRate || 0,
            installmentGroupId,
          };
        } else {
          // Subscription or custom type
          recurringRule = {
            type: this.recurringType() as 'subscription' | 'custom',
            frequency: this.recurringFormData.frequency,
            nextDate: this.recurringFormData.nextDate,
          };
          // For subscription/custom, use the entered amount
          transactionAmount = this.formData.amount || 0;
          // Use nextDate as the transaction date for subscription/custom
          if (this.recurringFormData.nextDate && !editingId) {
            this.formData.date = this.recurringFormData.nextDate;
          }
        }
      }
      
      if (editingId) {
        // Update existing transaction
        await this.transactionService.updateTransaction(editingId, {
          type: (this.formData.type || 'expense') as TransactionType,
          amount: transactionAmount,
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
          isRecurring: this.isRecurringTransaction(),
          recurringRule,
          hasDebtObligation: this.formData.hasDebtObligation || false,
          debtAmount: this.formData.debtAmount,
          debtDueDate: this.formData.debtDueDate,
          debtPaid: this.formData.debtPaid || false,
          debtPaidDate: this.formData.debtPaidDate,
          linkedDebtTransactionId: this.formData.linkedDebtTransactionId,
        });
      } else {
        // Create new transaction
        const transaction: Transaction = {
          id: crypto.randomUUID(),
          profileId: profile.id,
          type: (this.formData.type || 'expense') as TransactionType,
          amount: transactionAmount,
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
          isRecurring: this.isRecurringTransaction(),
          recurringRule,
          hasDebtObligation: this.formData.hasDebtObligation || false,
          debtAmount: this.formData.debtAmount,
          debtDueDate: this.formData.debtDueDate,
          debtPaid: this.formData.debtPaid || false,
          debtPaidDate: this.formData.debtPaidDate,
          linkedDebtTransactionId: this.formData.linkedDebtTransactionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.transactionService.addTransaction(transaction);
      }
      
      this.showForm.set(false);
      this.editingTransactionId.set(null);
      this.formData = this.getEmptyForm();
      this.resetRecurringForm();
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


  protected onAddBankAccount(): void {
    this.appState.openModal('bank-account-form', {});
  }

  protected onEditBankAccount(accountId: string): void {
    this.appState.openModal('bank-account-form', { accountId });
  }

  protected getCurrentMonthStr(): string {
    // For balance management, always use current month (today's date)
    // This ensures balances are always for the current month regardless of viewDate
    return format(new Date(), 'yyyy-MM');
  }

  protected getBankBalanceForAccount(account: { id: string; profileId: string; initialBalance?: number }): number {
    const profile = this.activeProfile();
    if (!profile) return account.initialBalance || 0;
    const monthStr = this.getCurrentMonthStr();
    return this.bankBalanceService.getBankAccountBalance(account.profileId, monthStr, account.id) || account.initialBalance || 0;
  }

  protected getTotalBankBalance(): number {
    const profile = this.activeProfile();
    if (!profile) return 0;
    const monthStr = this.getCurrentMonthStr();
    
    // Sum all account balances, including initialBalance for accounts without stored balances
    let total = 0;
    for (const account of this.bankAccounts()) {
      const storedBalance = this.bankBalanceService.getBankAccountBalance(account.profileId, monthStr, account.id);
      const accountBalance = storedBalance !== null ? storedBalance : (account.initialBalance || 0);
      total += accountBalance;
    }
    
    return total;
  }

  protected async onUpdateBankBalance(bankAccountId: string, value: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) return;

    const balance = parseFloat(value) || 0;
    const monthStr = this.getCurrentMonthStr();
    this.bankBalanceService.updateBankAccountBalance(profile.id, monthStr, bankAccountId, balance);
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
    const hasRequiredFields = !!(
      this.formData.amount &&
      this.formData.amount > 0 &&
      this.formData.description &&
      this.formData.date
    );

    if (!hasRequiredFields) return false;

    // For income transactions with bank_transfer, bankId (destination account) is required
    if (
      this.formData.type === 'income' &&
      this.formData.paymentMethod === 'bank_transfer' &&
      !this.formData.bankId
    ) {
      return false;
    }

    // For bank_to_bank transfers (both income and expense), both accounts are required
    if (
      this.formData.paymentMethod === 'bank_to_bank' &&
      (!this.formData.fromBankId || !this.formData.toBankId)
    ) {
      return false;
    }

    // For income with debt obligation, debt amount and due date are required
    if (
      this.formData.type === 'income' &&
      this.formData.hasDebtObligation
    ) {
      if (!this.formData.debtAmount || this.formData.debtAmount <= 0) {
        return false;
      }
      if (!this.formData.debtDueDate) {
        return false;
      }
    }

    return true;
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
      hasDebtObligation: false,
      debtAmount: undefined,
      debtDueDate: undefined,
      debtPaid: false,
      debtPaidDate: undefined,
      linkedDebtTransactionId: undefined,
    };
  }

  protected resetRecurringForm(): void {
    this.isRecurringTransaction.set(false);
    this.recurringType.set('subscription');
    this.installmentMode.set('date');
    this.recurringFormData = {
      totalPrincipal: undefined,
      totalTerms: undefined,
      monthlyAmortization: undefined,
      startDate: undefined,
      currentTerm: undefined,
      interestRate: undefined,
      frequency: 'monthly',
      nextDate: undefined,
    };
  }

  protected setInstallmentMode(mode: 'date' | 'term'): void {
    this.installmentMode.set(mode);
    // When switching to 'date' mode, calculate currentTerm from startDate if available
    if (mode === 'date' && this.recurringFormData.startDate) {
      this.onStartDateChange();
    }
  }

  protected onRecurringTypeChange(type: 'installment' | 'subscription' | 'custom'): void {
    this.recurringType.set(type);
    // Reset fields that don't apply to the new type
    if (type === 'subscription' || type === 'custom') {
      // Clear installment-specific fields
      this.recurringFormData.totalPrincipal = undefined;
      this.recurringFormData.totalTerms = undefined;
      this.recurringFormData.monthlyAmortization = undefined;
      this.recurringFormData.startDate = undefined;
      this.recurringFormData.currentTerm = undefined;
      this.recurringFormData.interestRate = undefined;
      // Set default nextDate to transaction date if not set
      if (!this.recurringFormData.nextDate) {
        this.recurringFormData.nextDate = this.formData.date || new Date().toISOString().split('T')[0];
      }
    } else {
      // Clear subscription-specific fields
      this.recurringFormData.nextDate = undefined;
    }
  }

  protected getCalculatedStartDate(): string {
    if (this.installmentMode() === 'term' && this.recurringFormData.currentTerm) {
      const backDate = subMonths(this.viewDate(), this.recurringFormData.currentTerm - 1);
      return format(backDate, 'MMMM yyyy');
    }
    return '';
  }

  protected getFormattedViewDate(): string {
    return format(this.viewDate(), 'MMMM yyyy');
  }

  /**
   * Calculate current term from startDate when in 'date' mode
   */
  protected calculateCurrentTermFromStartDate(): number | undefined {
    if (this.installmentMode() === 'date' && this.recurringFormData.startDate) {
      try {
        const startDate = parseISO(this.recurringFormData.startDate);
        const currentMonth = startOfMonth(this.viewDate());
        const startMonth = startOfMonth(startDate);
        const diff = differenceInCalendarMonths(currentMonth, startMonth);
        return Math.max(1, diff + 1);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Update currentTerm when startDate changes in 'date' mode
   */
  protected onStartDateChange(): void {
    if (this.installmentMode() === 'date') {
      const calculatedTerm = this.calculateCurrentTermFromStartDate();
      if (calculatedTerm !== undefined) {
        this.recurringFormData.currentTerm = calculatedTerm;
      }
    }
  }

  /**
   * Check if transaction has debt obligation
   */
  protected hasDebtObligation(transaction: Transaction): boolean {
    return Boolean(transaction.hasDebtObligation && transaction.type === 'income');
  }

  /**
   * Check if debt is overdue
   */
  protected isDebtOverdue(transaction: Transaction): boolean {
    if (!this.hasDebtObligation(transaction) || !transaction.debtDueDate) {
      return false;
    }
    if (transaction.debtPaid) {
      return false;
    }
    const today = new Date();
    const dueDate = parseISO(transaction.debtDueDate);
    return dueDate < today;
  }

  /**
   * Get debt status text
   */
  protected getDebtStatus(transaction: Transaction): string {
    if (!this.hasDebtObligation(transaction)) {
      return '';
    }
    if (transaction.debtPaid) {
      return 'Debt Paid';
    }
    if (this.isDebtOverdue(transaction)) {
      return 'Debt Overdue';
    }
    return 'Debt Pending';
  }

  /**
   * Format debt due date
   */
  protected formatDebtDueDate(transaction: Transaction): string {
    if (!transaction.debtDueDate) return '';
    return this.formatDate(transaction.debtDueDate);
  }

  /**
   * Handle transaction type change - clear debt fields if switching from income to expense
   */
  protected onTransactionTypeChange(newType: TransactionType): void {
    if (newType === 'expense' && this.formData.hasDebtObligation) {
      // Clear debt fields when switching to expense
      this.formData.hasDebtObligation = false;
      this.formData.debtAmount = undefined;
      this.formData.debtDueDate = undefined;
      this.formData.debtPaid = false;
      this.formData.debtPaidDate = undefined;
      this.formData.linkedDebtTransactionId = undefined;
    }
  }

  /**
   * Check if a credit card transaction's statement is paid
   * Uses cutoff-aware logic to determine which statement the transaction belongs to
   */
  private isCreditCardStatementPaid(transaction: Transaction): boolean {
    if (transaction.paymentMethod !== 'card' || !transaction.cardId) {
      return true; // Not a credit card transaction, consider it "paid" (counts immediately)
    }

    const card = this.cardService.getCardById(transaction.cardId);
    if (!card) {
      return true; // Card not found, default to counting it
    }

    // Determine which statement month this transaction belongs to (cutoff-aware)
    const transactionDate = parseISO(transaction.date);
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
    const statement = this.statementService.getStatementForMonth(transaction.cardId, monthStr);
    
    // If no statement exists yet, it's not paid (don't count it)
    // If statement exists, check if it's paid
    return statement ? statement.isPaid : false;
  }
}
