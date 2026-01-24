import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Edit2,
  FileText,
  Filter,
  LucideAngularModule,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-angular';
import {
  AppStateService,
  BankAccountService,
  BankBalanceService,
  CardService,
  CategoryService,
  NotificationService,
  ProfileService,
  StatementService,
  TransactionBucketService,
  TransactionService
} from '@services';
import { EmptyStateComponent, MetricCardComponent, ModalComponent, QuickActionButtonComponent } from '@components';
import type { PaymentMethod, Transaction, TransactionType } from '@shared/types';
import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  parseISO,
  setDate,
  startOfMonth,
  subMonths
} from 'date-fns';
import type { Cell, Row } from '@cj-tech-master/excelts';
import { Workbook, Worksheet } from '@cj-tech-master/excelts';

type ExpenseTemplateLists = {
  categories: string[];
  paymentMethods: string[];
  cards: string[];
  bankAccounts: string[];
  profiles: string[];
  paidByOtherOptions: string[];
};

type ImportLookups = {
  categoryMap: Map<string, string>;
  cardMap: Map<string, string>;
  bankMap: Map<string, string>;
  profileMap: Map<string, string>;
};

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
    ModalComponent,
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
        transition:
          color 0.2s,
          background-color 0.2s;
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
  readonly ChevronDown = ChevronDown;
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
  private notificationService = inject(NotificationService);
  protected bankBalanceService = inject(BankBalanceService);
  // Form state - using signals for better change detection
  protected showForm = signal<boolean>(false);
  protected editingTransactionId = signal<string | null>(null);
  protected formData: Partial<Transaction> = this.getEmptyForm();
  protected showBankBalanceManagement = false;
  protected actionsMenuOpen = signal<boolean>(false);
  // Recurring/installment form state
  protected isRecurringTransaction = signal<boolean>(false);
  protected recurringType = signal<'installment' | 'subscription' | 'custom'>('subscription');
  protected installmentMode = signal<'date' | 'term'>('date');
  // Smart installment toggle (only shown when payment method is 'card')
  protected isInstallmentPurchase = signal<boolean>(false);
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

  // Computed: Auto-calculate monthly amortization from total and terms
  protected calculatedMonthlyAmort = computed(() => {
    if (
      this.isInstallmentPurchase() &&
      this.recurringFormData.totalPrincipal &&
      this.recurringFormData.totalTerms
    ) {
      return this.recurringFormData.totalPrincipal / this.recurringFormData.totalTerms;
    }
    return undefined;
  });

  // Computed: Auto-calculate current term from start date
  protected calculatedCurrentTerm = computed(() => {
    if (this.isInstallmentPurchase() && this.recurringFormData.startDate) {
      return this.transactionBucketService.calculateCurrentTerm(
        this.recurringFormData.startDate,
        this.viewDate(),
      );
    }
    return undefined;
  });

  // Computed: Cutoff preview badge info (Task 3)
  // Uses cutoff-aware logic: day >= cutoff → next month's statement, else this month's
  protected cutoffPreview = computed(() => {
    if (this.formData.paymentMethod !== 'card' || !this.formData.cardId || !this.formData.date) {
      return null;
    }

    try {
      const card = this.cardService.getCardById(this.formData.cardId);
      if (!card) return null;

      const transactionDate = parseISO(this.formData.date);
      const dayOfMonth = transactionDate.getDate();

      // Determine statement month from transaction date (cutoff-aware)
      const statementDate =
        dayOfMonth >= card.cutoffDay
          ? addMonths(startOfMonth(transactionDate), 1)
          : startOfMonth(transactionDate);
      const monthStr = format(statementDate, 'yyyy-MM');

      const period = this.transactionBucketService.getStatementPeriod(
        this.formData.cardId,
        monthStr,
      );
      if (!period) return null;

      // Calculate due date for the statement
      const dueDate = new Date(period.monthStr + '-01');
      const statementDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), card.dueDay);
      const isCurrentCycle = period.monthStr === format(this.viewDate(), 'yyyy-MM');

      return {
        period,
        statementMonth: format(parseISO(period.monthStr + '-01'), 'MMM yyyy'),
        dueDate: format(statementDueDate, 'MMM d'),
        isCurrentCycle,
      };
    } catch {
      return null;
    }
  });
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
          const card = cards.find((c) => c.id === t.cardId);
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
          const statement = statements.find(
            (s) => s.cardId === t.cardId && s.monthStr === monthStr,
          );

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
  private transactionBucketService = inject(TransactionBucketService);

  // View mode: 'spending' or 'reconcile'
  protected viewMode = signal<'spending' | 'reconcile'>('spending');

  // Reconcile mode: verified transaction IDs (UI state only, not persisted)
  protected verifiedTransactionIds = signal<Set<string>>(new Set());

  // Buffer calculation
  protected bufferInfo = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return { totalBalance: 0, totalCreditCardDebt: 0, buffer: 0, isDangerZone: false };
    }
    const monthStr = format(this.viewDate(), 'yyyy-MM');
    return this.transactionBucketService.calculateBuffer(profile.id, monthStr);
  });

  // Viewable transactions: filters out parent installment transactions only
  // Shows virtual transactions (monthly payments) and legacy installments; hides explicit parents (total principal)
  protected viewableTransactions = computed(() => {
    const allTransactions = this.transactionService.transactions();
    return allTransactions.filter((t) => !this.transactionBucketService.isParentTransaction(t));
  });

  // Computed filtered transactions
  // Shows transactions where:
  // 1. User owns the transaction (profileId matches)
  // 2. User paid for it (paidByOtherProfileId matches current profile)
  // In multi-profile mode: shows transactions from selected profiles
  // View mode affects what transactions are shown:
  // - Spending Mode: Shows transactions where date <= today (immediate reality)
  // - Reconcile Mode: Shows transactions grouped by statement cycle
  protected filteredTransactions = computed(() => {
    const viewMode = this.viewMode();
    const multiMode = this.multiProfileMode();
    const selectedIds = this.selectedProfileIds();
    const profile = this.activeProfile();

    // Get viewable transactions (excludes parent installment transactions)
    const allTransactions = this.viewableTransactions();

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

    // View mode filtering
    if (viewMode === 'spending') {
      // Spending Mode: Only show transactions where date <= today (immediate reality)
      const today = format(new Date(), 'yyyy-MM-dd');
      relevantTransactions = relevantTransactions.filter((t) => {
        // Only show transactions up to today
        if (t.date > today) return false;
        // Include if it's budget impacting (default true if not set)
        if (t.isBudgetImpacting === false) return false;
        // Exclude parent transactions (they're for net worth tracking only)
        if (this.transactionBucketService.isParentTransaction(t)) return false;
        return true;
      });
    } else {
      // Reconcile Mode: Show transactions grouped by statement cycle
      // Include all transactions, grouping will be done in template
      // Filter by statement period using TransactionBucketService
    }

    // Apply search filter
    const searchQuery = this.searchQuery().trim().toLowerCase();
    if (searchQuery) {
      relevantTransactions = relevantTransactions.filter((t) => {
        const description = t.description.toLowerCase();
        const notes = t.notes?.toLowerCase() || '';
        const amount = t.amount.toString();
        return (
          description.includes(searchQuery) ||
          notes.includes(searchQuery) ||
          amount.includes(searchQuery)
        );
      });
    }

    // Apply sorting
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();
    const sortMultiplier = sortDirection === 'asc' ? 1 : -1;

    relevantTransactions = [...relevantTransactions].sort((a, b) => {
      switch (sortField) {
        case 'date':
          return a.date.localeCompare(b.date) * sortMultiplier;
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
    if (
      this.isInstallmentPurchase() &&
      this.formData.paymentMethod === 'card' &&
      this.formData.cardId
    ) {
      const cardDueDate = this.getCardDueDate(this.formData.cardId);
      if (cardDueDate && !this.recurringFormData.startDate) {
        this.recurringFormData.startDate = cardDueDate;
      }
    }
  }

  /**
   * Handle payment method change - reset installment toggle if not card
   */
  protected onPaymentMethodChange(): void {
    if (this.formData.paymentMethod !== 'card') {
      this.isInstallmentPurchase.set(false);
      this.isRecurringTransaction.set(false);
    }
  }

  /**
   * Handle installment toggle change
   */
  protected onInstallmentToggleChange(checked: boolean): void {
    this.isInstallmentPurchase.set(checked);
    if (checked) {
      this.isRecurringTransaction.set(true);
      this.recurringType.set('installment');
      // Auto-set start date to today if not set
      if (!this.recurringFormData.startDate) {
        this.recurringFormData.startDate = new Date().toISOString().split('T')[0];
      }
      // Auto-set card due date if card is selected
      if (this.formData.cardId) {
        this.onCardChangeForInstallment();
      }
    } else {
      // Reset installment fields
      this.recurringFormData.totalPrincipal = undefined;
      this.recurringFormData.totalTerms = undefined;
      this.recurringFormData.startDate = undefined;
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
    this.cards().forEach((card) => {
      cardsMap.set(card.id, `${card.bankName} ${card.cardName}`);
    });
    return cardsMap;
  });

  private bankAccountNameCache = computed(() => {
    const accountsMap = new Map<string, string>();
    this.bankAccounts().forEach((account) => {
      accountsMap.set(account.id, account.bankName);
    });
    return accountsMap;
  });

  private profileNameCache = computed(() => {
    const profilesMap = new Map<string, string>();
    this.profileService.profiles().forEach((profile) => {
      profilesMap.set(profile.id, profile.name);
    });
    return profilesMap;
  });

  private readonly expenseTemplateHeaders = [
    'date',
    'postingDate',
    'description',
    'amount',
    'categoryName',
    'paymentMethod',
    'cardName',
    'bankAccountName',
    'fromBankAccountName',
    'toBankAccountName',
    'transferFee',
    'paidByOther',
    'paidByOtherProfileName',
    'paidByOtherName',
    'notes',
  ];

  protected async onDownloadExpenseTemplate(): Promise<void> {
    try {
      const workbook = new Workbook();
      const templateSheet = workbook.addWorksheet('Template');
      const listsSheet = workbook.addWorksheet('Lists', { state: 'hidden' });

      const lists = this.buildExpenseTemplateLists();
      const listRanges = this.populateListsSheet(listsSheet, lists);
      this.populateTemplateSheet(templateSheet, listRanges);

      const buffer = await workbook.xlsx.writeBuffer();
      this.downloadExcelFile(buffer, 'expense-template.xlsx');
    } catch (error) {
      console.error('Failed to generate template:', error);
      this.notificationService.error('Template failed', 'Unable to generate expense template.');
    }
  }

  private buildExpenseTemplateLists(): ExpenseTemplateLists {
    const categories = this.categories()
      .filter((category) => category.type === 'expense' || category.type === 'both')
      .map((category) => category.name);

    const paymentMethods = ['cash', 'card', 'bank_transfer', 'bank_to_bank', 'other'];
    const cards = this.cards().map((card) => `${card.bankName} ${card.cardName}`);
    const bankAccounts = this.bankAccounts().map((account) => account.bankName);
    const profiles = this.profileService.profiles().map((profile) => profile.name);
    const paidByOtherOptions = ['TRUE', 'FALSE'];

    return {
      categories: this.ensureList(categories),
      paymentMethods: this.ensureList(paymentMethods),
      cards: this.ensureList(cards),
      bankAccounts: this.ensureList(bankAccounts),
      profiles: this.ensureList(profiles),
      paidByOtherOptions: this.ensureList(paidByOtherOptions),
    };
  }

  private populateListsSheet(
    sheet: Worksheet,
    lists: ExpenseTemplateLists,
  ): Record<string, string> {
    const listConfig = [
      { key: 'categoryName', values: lists.categories },
      { key: 'paymentMethod', values: lists.paymentMethods },
      { key: 'cardName', values: lists.cards },
      { key: 'bankAccountName', values: lists.bankAccounts },
      { key: 'fromBankAccountName', values: lists.bankAccounts },
      { key: 'toBankAccountName', values: lists.bankAccounts },
      { key: 'paidByOtherProfileName', values: lists.profiles },
      { key: 'paidByOther', values: lists.paidByOtherOptions },
    ];

    const ranges: Record<string, string> = {};

    listConfig.forEach((config, index) => {
      const columnIndex = index + 1;
      const columnLetter = this.getColumnLetter(columnIndex);
      config.values.forEach((value, rowIndex) => {
        sheet.getCell(rowIndex + 1, columnIndex).value = value;
      });
      const lastRow = Math.max(config.values.length, 1);
      ranges[config.key] = `'Lists'!$${columnLetter}$1:$${columnLetter}$${lastRow}`;
    });

    return ranges;
  }

  protected async onImportExpensesFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const profile = this.activeProfile();
      if (!profile) {
        this.notificationService.warning('Import blocked', 'Select a profile before importing.');
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = new Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        this.notificationService.error('Import failed', 'No worksheet found in the file.');
        return;
      }

      const headerRow = worksheet.getRow(1);
      const headerMap = new Map<string, number>();
      headerRow.eachCell((cell: Cell, colNumber: number) => {
        const header = this.normalizeHeader(this.cellToString(cell.value));
        if (header) {
          headerMap.set(header, colNumber);
        }
      });

      const requiredHeaders = ['date', 'description', 'amount', 'paymentmethod'];
      const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(header));
      if (missingHeaders.length > 0) {
        this.notificationService.error(
          'Import failed',
          `Missing columns: ${missingHeaders.join(', ')}.`,
        );
        return;
      }

      const lookups = this.buildImportLookups();
      const errors: string[] = [];
      const toImport: { row: Row; rowNumber: number }[] = [];
      const columnIndexes = Array.from(headerMap.values());

      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber < 2) return;
        if (!this.rowHasContent(row, columnIndexes)) return;
        toImport.push({ row, rowNumber });
      });

      const existingTransactions = this.transactionService.transactions();
      const duplicateKeySet = new Set<string>();
      existingTransactions.forEach((t) => {
        if (t.type === 'expense' && t.paymentMethod === 'card' && t.cardId) {
          const key = this.getDuplicateKey(t.date, t.description, t.cardId);
          duplicateKeySet.add(key);
        }
      });

      let importedCount = 0;
      let duplicateCount = 0;
      for (const { row, rowNumber } of toImport) {
        const result = this.parseExpenseRow(row, headerMap, lookups, rowNumber, profile.id);
        if ('error' in result) {
          errors.push(result.error);
          continue;
        }

        const transaction = result.transaction;
        const dateForDuplicate = transaction.postingDate || transaction.date;
        const duplicateKey = this.getDuplicateKey(
          dateForDuplicate,
          transaction.description,
          transaction.cardId,
        );

        if (
          transaction.paymentMethod === 'card' &&
          transaction.cardId &&
          duplicateKeySet.has(duplicateKey)
        ) {
          duplicateCount += 1;
          continue;
        }

        await this.transactionService.addTransaction(transaction);
        if (transaction.paymentMethod === 'card' && transaction.cardId) {
          duplicateKeySet.add(duplicateKey);
        }
        importedCount += 1;
      }

      if (importedCount === 0 && errors.length === 0 && duplicateCount === 0) {
        this.notificationService.warning('Import completed', 'No expense rows found.');
        return;
      }

      const skippedCount = errors.length + duplicateCount;
      if (skippedCount > 0) {
        const parts: string[] = [];
        if (errors.length > 0) parts.push(`${errors.length} errors`);
        if (duplicateCount > 0) parts.push(`${duplicateCount} duplicates`);
        const preview = errors.slice(0, 3).join(' | ');
        const suffix = errors.length > 3 ? ' ...' : '';
        this.notificationService.warning(
          'Import completed with issues',
          `${importedCount} imported, ${skippedCount} skipped (${parts.join(', ')}). ${preview}${suffix}`,
        );
      } else {
        this.notificationService.success('Import completed', `${importedCount} expenses imported.`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      this.notificationService.error('Import failed', 'Unable to read the Excel file.');
    } finally {
      input.value = '';
    }
  }

  private ensureList(values: string[]): string[] {
    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    return unique.length > 0 ? unique : [''];
  }

  private getColumnLetter(columnIndex: number): string {
    let index = columnIndex;
    let letter = '';
    while (index > 0) {
      const remainder = (index - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      index = Math.floor((index - 1) / 26);
    }
    return letter;
  }

  private downloadExcelFile(buffer: ArrayBuffer | Uint8Array, filename: string): void {
    const uint8Array = buffer instanceof Uint8Array ? buffer.slice() : new Uint8Array(buffer);
    const blob = new Blob([uint8Array as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private populateTemplateSheet(sheet: Worksheet, listRanges: Record<string, string>): void {
    sheet.addRow(this.expenseTemplateHeaders);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell: Cell) => {
      cell.font = { ...cell.font, bold: true };
    });

    const headerMap = new Map<string, number>();
    this.expenseTemplateHeaders.forEach((header, index) => {
      headerMap.set(header, index + 1);
    });

    const maxRows = 500;
    const dateColumn = headerMap.get('date') ?? 1;
    const postingDateColumn = headerMap.get('postingDate');
    const amountColumn = headerMap.get('amount');
    const transferFeeColumn = headerMap.get('transferFee');

    const columnWidths: Record<string, number> = {
      date: 14,
      postingDate: 14,
      description: 34,
      amount: 14,
      categoryName: 22,
      paymentMethod: 18,
      cardName: 24,
      bankAccountName: 22,
      fromBankAccountName: 22,
      toBankAccountName: 22,
      transferFee: 14,
      paidByOther: 12,
      paidByOtherProfileName: 22,
      paidByOtherName: 20,
      notes: 28,
    };

    Object.entries(columnWidths).forEach(([key, width]) => {
      const columnIndex = headerMap.get(key);
      if (columnIndex) {
        sheet.getColumn(columnIndex).width = width;
      }
    });

    const listColumns = [
      'categoryName',
      'paymentMethod',
      'cardName',
      'bankAccountName',
      'fromBankAccountName',
      'toBankAccountName',
      'paidByOtherProfileName',
      'paidByOther',
    ];

    listColumns.forEach((key) => {
      const columnIndex = headerMap.get(key);
      const range = listRanges[key];
      if (!columnIndex || !range) return;
      for (let rowIndex = 2; rowIndex <= maxRows; rowIndex += 1) {
        sheet.getCell(rowIndex, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [range],
        };
      }
    });

    for (let rowIndex = 2; rowIndex <= maxRows; rowIndex += 1) {
      sheet.getCell(rowIndex, dateColumn).numFmt = 'yyyy-mm-dd';
      if (postingDateColumn) sheet.getCell(rowIndex, postingDateColumn).numFmt = 'yyyy-mm-dd';
      if (amountColumn) sheet.getCell(rowIndex, amountColumn).numFmt = '#,##0.00';
      if (transferFeeColumn) sheet.getCell(rowIndex, transferFeeColumn).numFmt = '#,##0.00';
    }
  }

  private buildImportLookups(): ImportLookups {
    const categoryMap = new Map<string, string>();
    this.categories()
      .filter((category) => category.type === 'expense' || category.type === 'both')
      .forEach((category) => {
        categoryMap.set(this.normalizeLookup(category.name), category.id);
      });

    const cardMap = new Map<string, string>();
    this.cards().forEach((card) => {
      const name = `${card.bankName} ${card.cardName}`;
      cardMap.set(this.normalizeLookup(name), card.id);
    });

    const bankMap = new Map<string, string>();
    this.bankAccounts().forEach((account) => {
      bankMap.set(this.normalizeLookup(account.bankName), account.id);
    });

    const profileMap = new Map<string, string>();
    this.profileService.profiles().forEach((profile) => {
      profileMap.set(this.normalizeLookup(profile.name), profile.id);
    });

    return { categoryMap, cardMap, bankMap, profileMap };
  }

  private parseExpenseRow(
    row: Row,
    headers: Map<string, number>,
    lookups: ImportLookups,
    rowNumber: number,
    profileId: string,
  ): { transaction: Transaction } | { error: string } {
    const dateValue = this.getCellValue(row, headers.get('date'));
    const postingDateValue = this.getCellValue(row, headers.get('postingdate'));
    const descriptionValue = this.getCellValue(row, headers.get('description'));
    const amountValue = this.getCellValue(row, headers.get('amount'));
    const paymentMethodValue = this.getCellValue(row, headers.get('paymentmethod'));
    const categoryValue = this.getCellValue(row, headers.get('categoryname'));
    const cardValue = this.getCellValue(row, headers.get('cardname'));
    const bankAccountValue = this.getCellValue(row, headers.get('bankaccountname'));
    const fromBankValue = this.getCellValue(row, headers.get('frombankaccountname'));
    const toBankValue = this.getCellValue(row, headers.get('tobankaccountname'));
    const transferFeeValue = this.getCellValue(row, headers.get('transferfee'));
    const paidByOtherValue = this.getCellValue(row, headers.get('paidbyother'));
    const paidByOtherProfileValue = this.getCellValue(row, headers.get('paidbyotherprofilename'));
    const paidByOtherNameValue = this.getCellValue(row, headers.get('paidbyothername'));
    const notesValue = this.getCellValue(row, headers.get('notes'));

    const date = this.parseDateValue(dateValue);
    if (!date) {
      return { error: `Row ${rowNumber}: invalid date.` };
    }

    const postingDate = postingDateValue ? this.parseDateValue(postingDateValue) : null;
    if (postingDateValue && !postingDate) {
      return { error: `Row ${rowNumber}: invalid postingDate.` };
    }

    const description = this.cellToString(descriptionValue);
    if (!description) {
      return { error: `Row ${rowNumber}: missing description.` };
    }

    const amount = this.parseNumberValue(amountValue);
    if (amount === null || amount <= 0) {
      return { error: `Row ${rowNumber}: invalid amount.` };
    }

    const paymentMethod = this.normalizePaymentMethod(this.cellToString(paymentMethodValue));
    if (!paymentMethod) {
      return { error: `Row ${rowNumber}: invalid payment method.` };
    }

    let categoryId = 'uncategorized';
    const categoryName = this.cellToString(categoryValue);
    if (categoryName) {
      const categoryLookup = lookups.categoryMap.get(this.normalizeLookup(categoryName));
      if (!categoryLookup) {
        return { error: `Row ${rowNumber}: unknown category "${categoryName}".` };
      }
      categoryId = categoryLookup;
    }

    let cardId: string | undefined;
    const cardName = this.cellToString(cardValue);
    if (paymentMethod === 'card') {
      if (!cardName) {
        return { error: `Row ${rowNumber}: cardName required for card payments.` };
      }
      const cardLookup = lookups.cardMap.get(this.normalizeLookup(cardName));
      if (!cardLookup) {
        return { error: `Row ${rowNumber}: unknown card "${cardName}".` };
      }
      cardId = cardLookup;
    } else if (cardName) {
      const cardLookup = lookups.cardMap.get(this.normalizeLookup(cardName));
      if (!cardLookup) {
        return { error: `Row ${rowNumber}: unknown card "${cardName}".` };
      }
      cardId = cardLookup;
    }

    let bankId: string | undefined;
    const bankAccountName = this.cellToString(bankAccountValue);
    if (bankAccountName) {
      const bankLookup = lookups.bankMap.get(this.normalizeLookup(bankAccountName));
      if (!bankLookup) {
        return { error: `Row ${rowNumber}: unknown bank account "${bankAccountName}".` };
      }
      bankId = bankLookup;
    }

    let fromBankId: string | undefined;
    let toBankId: string | undefined;
    const fromBankName = this.cellToString(fromBankValue);
    const toBankName = this.cellToString(toBankValue);
    if (paymentMethod === 'bank_to_bank') {
      if (!fromBankName || !toBankName) {
        return { error: `Row ${rowNumber}: from/to bank accounts required for bank_to_bank.` };
      }
      const fromLookup = lookups.bankMap.get(this.normalizeLookup(fromBankName));
      const toLookup = lookups.bankMap.get(this.normalizeLookup(toBankName));
      if (!fromLookup || !toLookup) {
        return { error: `Row ${rowNumber}: unknown bank account in transfer.` };
      }
      fromBankId = fromLookup;
      toBankId = toLookup;
    }

    const transferFee = this.parseNumberValue(transferFeeValue);
    if (transferFee !== null && transferFee < 0) {
      return { error: `Row ${rowNumber}: transfer fee must be positive.` };
    }

    const paidByOtherName = this.cellToString(paidByOtherNameValue);
    const paidByOtherProfileName = this.cellToString(paidByOtherProfileValue);
    let paidByOtherProfileId: string | undefined;
    if (paidByOtherProfileName) {
      const profileLookup = lookups.profileMap.get(this.normalizeLookup(paidByOtherProfileName));
      if (!profileLookup) {
        return { error: `Row ${rowNumber}: unknown profile "${paidByOtherProfileName}".` };
      }
      paidByOtherProfileId = profileLookup;
    }

    const paidByOtherFlag = this.parseBooleanValue(this.cellToString(paidByOtherValue));
    const paidByOther = Boolean(paidByOtherFlag || paidByOtherProfileId || paidByOtherName);

    const notes = this.cellToString(notesValue);

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      profileId,
      type: 'expense',
      amount,
      date,
      categoryId,
      description,
      notes: notes || undefined,
      paymentMethod,
      cardId,
      bankId: paymentMethod === 'bank_transfer' ? bankId : undefined,
      fromBankId,
      toBankId,
      transferFee: transferFee ?? undefined,
      paidByOther,
      paidByOtherProfileId,
      paidByOtherName: paidByOtherName || undefined,
      isRecurring: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postingDate: postingDate || undefined,
    };

    return { transaction };
  }

  private getCellValue(row: Row, columnIndex?: number): unknown {
    if (!columnIndex) return null;
    return row.getCell(columnIndex).value;
  }

  private rowHasContent(row: Row, columnIndexes: number[]): boolean {
    return columnIndexes.some((columnIndex) => {
      const value = this.getCellValue(row, columnIndex);
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'number') return !Number.isNaN(value);
      if (value instanceof Date) return true;
      if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
        return value.text.trim().length > 0;
      }
      return true;
    });
  }

  private normalizeHeader(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  private normalizeLookup(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizePaymentMethod(value: string): PaymentMethod | null {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (!normalized) return null;
    if (normalized === 'cash') return 'cash';
    if (normalized === 'card' || normalized === 'credit_card' || normalized === 'creditcard')
      return 'card';
    if (normalized === 'bank_transfer' || normalized === 'banktransfer') return 'bank_transfer';
    if (
      normalized === 'bank_to_bank' ||
      normalized === 'bank_to_bank_transfer' ||
      normalized === 'banktobank'
    ) {
      return 'bank_to_bank';
    }
    if (normalized === 'other') return 'other';
    return null;
  }

  private parseBooleanValue(value: string): boolean | undefined {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    return undefined;
  }

  private parseNumberValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const asString = this.cellToString(value);
    if (!asString) return null;
    const normalized = asString.replace(/,/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private parseDateValue(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return format(value, 'yyyy-MM-dd');
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const excelEpoch = new Date(Math.round((value - 25569) * 86400 * 1000));
      return format(excelEpoch, 'yyyy-MM-dd');
    }
    const asString = this.cellToString(value);
    if (!asString) return null;
    try {
      return format(parseISO(asString), 'yyyy-MM-dd');
    } catch {
      const fallback = new Date(asString);
      return Number.isNaN(fallback.getTime()) ? null : format(fallback, 'yyyy-MM-dd');
    }
  }

  private cellToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return format(value, 'yyyy-MM-dd');
    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text.trim();
      }
      if ('result' in value) {
        const resultValue = (value as { result?: unknown }).result;
        return resultValue ? String(resultValue).trim() : '';
      }
      if (
        'richText' in value &&
        Array.isArray((value as { richText?: Array<{ text?: string }> }).richText)
      ) {
        return (value as { richText: Array<{ text?: string }> }).richText
          .map((part) => part.text ?? '')
          .join('')
          .trim();
      }
    }
    return '';
  }

  private getDuplicateKey(date: string, description: string, cardId?: string): string {
    const normalizedDesc = description.trim().toLowerCase();
    return `${date}|${normalizedDesc}|${cardId || ''}`;
  }

  protected onAddTransaction(): void {
    this.editingTransactionId.set(null);
    this.formData = this.getEmptyForm();
    this.resetRecurringForm();
    this.showForm.set(true);
  }

  protected closeTransactionModal(): void {
    this.showForm.set(false);
    this.editingTransactionId.set(null);
    this.formData = this.getEmptyForm();
    this.resetRecurringForm();
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

      // Set installment toggle if it's an installment
      if (transaction.recurringRule.type === 'installment') {
        this.isInstallmentPurchase.set(true);
      }

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
            const originalDate = transaction.recurringRule.startDate
              ? parseISO(transaction.recurringRule.startDate)
              : new Date();
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

  /**
   * Get transaction bucket type
   */
  protected getTransactionBucket(transaction: Transaction): 'direct' | 'recurring' | 'installment' {
    return this.transactionBucketService.getTransactionBucket(transaction);
  }

  /**
   * Get bucket badge class
   */
  protected getBucketBadgeClass(bucket: 'direct' | 'recurring' | 'installment'): string {
    switch (bucket) {
      case 'direct':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'recurring':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'installment':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  /**
   * Get bucket label
   */
  protected getBucketLabel(bucket: 'direct' | 'recurring' | 'installment'): string {
    switch (bucket) {
      case 'direct':
        return 'Direct Expense';
      case 'recurring':
        return 'Recurring Bill';
      case 'installment':
        return 'Installment';
      default:
        return '';
    }
  }

  /**
   * Toggle transaction verified state (for reconcile mode)
   */
  protected toggleTransactionVerified(transactionId: string): void {
    const current = this.verifiedTransactionIds();
    const next = new Set(current);
    if (next.has(transactionId)) {
      next.delete(transactionId);
    } else {
      next.add(transactionId);
    }
    this.verifiedTransactionIds.set(next);
  }

  /**
   * Check if transaction is verified
   */
  protected isTransactionVerified(transactionId: string): boolean {
    return this.verifiedTransactionIds().has(transactionId);
  }

  /**
   * Clear all verified transactions
   */
  protected clearVerifiedTransactions(): void {
    this.verifiedTransactionIds.set(new Set());
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
      if (this.recurringType() === 'installment' || this.isInstallmentPurchase()) {
        if (!this.recurringFormData.totalPrincipal || this.recurringFormData.totalPrincipal <= 0) {
          alert('Please enter a valid total amount for the installment');
          return;
        }
        if (!this.recurringFormData.totalTerms || this.recurringFormData.totalTerms <= 0) {
          alert('Please enter a valid number of terms (months) for the installment');
          return;
        }
        if (!this.recurringFormData.startDate) {
          alert('Please enter a start date for the installment');
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
        existingTransaction = this.transactionService
          .transactions()
          .find((t) => t.id === editingId);
      }

      // Calculate recurring rule if this is a recurring transaction
      let recurringRule = undefined;
      let transactionAmount = this.formData.amount || 0;

      if (this.isRecurringTransaction()) {
        if (this.recurringType() === 'installment' || this.isInstallmentPurchase()) {
          // Installment type - use smart form values
          const calculatedStartDate = this.recurringFormData.startDate!;

          // Auto-calculate monthly amortization
          const monthlyAmort =
            this.calculatedMonthlyAmort() ||
            this.recurringFormData.totalPrincipal! / this.recurringFormData.totalTerms!;

          // For parent transaction: use totalPrincipal (for net worth/debt tracking)
          // Virtual transactions will use monthlyAmort
          transactionAmount = this.recurringFormData.totalPrincipal!;

          // Calculate end date
          const startDateObj = parseISO(calculatedStartDate);
          const endDate = format(
            addMonths(startDateObj, this.recurringFormData.totalTerms!),
            'yyyy-MM-dd',
          );

          // Auto-calculate current term from startDate
          const calculatedCurrentTerm = this.calculatedCurrentTerm() || 1;

          // Generate installment group ID (preserve existing if editing, otherwise create new)
          const installmentGroupId =
            editingId && existingTransaction?.recurringRule?.installmentGroupId
              ? existingTransaction.recurringRule.installmentGroupId
              : `installment_${crypto.randomUUID()}`;

          recurringRule = {
            type: 'installment' as const,
            frequency: 'monthly' as const,
            totalPrincipal: this.recurringFormData.totalPrincipal,
            monthlyAmortization: monthlyAmort,
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

      this.closeTransactionModal();
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
      const profile = this.profileService
        .profiles()
        .find((p) => p.id === transaction.paidByOtherProfileId);
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

  protected getBankBalanceForAccount(account: {
    id: string;
    profileId: string;
    initialBalance?: number;
  }): number {
    const profile = this.activeProfile();
    if (!profile) return account.initialBalance || 0;
    const monthStr = this.getCurrentMonthStr();
    return (
      this.bankBalanceService.getBankAccountBalance(account.profileId, monthStr, account.id) ||
      account.initialBalance ||
      0
    );
  }

  protected getTotalBankBalance(): number {
    const profile = this.activeProfile();
    if (!profile) return 0;
    const monthStr = this.getCurrentMonthStr();

    // Sum all account balances, including initialBalance for accounts without stored balances
    let total = 0;
    for (const account of this.bankAccounts()) {
      const storedBalance = this.bankBalanceService.getBankAccountBalance(
        account.profileId,
        monthStr,
        account.id,
      );
      const accountBalance = storedBalance !== null ? storedBalance : account.initialBalance || 0;
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
    if (this.formData.type === 'income' && this.formData.hasDebtObligation) {
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
    this.isInstallmentPurchase.set(false);
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
        this.recurringFormData.nextDate =
          this.formData.date || new Date().toISOString().split('T')[0];
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
   * Check if a transaction is projected (future-dated)
   */
  protected isProjectedTransaction(transaction: Transaction): boolean {
    return this.transactionService.isProjectedTransaction(transaction);
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
   * Format currency for display
   */
  protected formatCurrency(amount: number): string {
    return amount.toLocaleString('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
