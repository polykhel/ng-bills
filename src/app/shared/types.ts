export interface Profile {
  id: string;
  name: string;
}

export interface CreditCard {
  id: string;
  profileId: string;
  bankName: string;
  cardName: string;
  dueDay: number;
  cutoffDay: number;
  color: string;
  isCashCard?: boolean;
}

export interface Payment {
  amount: number;
  date: string;
}

export interface Statement {
  id: string;
  cardId: string;
  monthStr: string;
  amount: number;
  isPaid: boolean;
  paidAmount?: number;
  payments?: Payment[];
  customDueDate?: string;
  customCutoffDay?: number;
  isUnbilled?: boolean;
  adjustedAmount?: number;
  isEstimated?: boolean;
  notes?: string;
}

export interface Installment {
  id: string;
  cardId: string;
  name: string;
  totalPrincipal: number;
  terms: number;
  monthlyAmortization: number;
  startDate: string;
}

// CashInstallment removed in Phase 2 - migrated to Transaction with paymentMethod: 'cash' and isRecurring: true

export interface BankBalance {
  id: string;
  profileId: string;
  monthStr: string;
  balance: number;
  bankAccountId?: string; // Optional: if provided, balance is for specific account; if not, it's the total for the profile
}

export interface BankAccount {
  id: string;
  profileId: string;
  bankName: string;
  accountNumber?: string;
  accountType: 'checking' | 'savings' | 'other';
  color: string;
  initialBalance?: number;
  // Metadata fields
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  branchName?: string;
  branchAddress?: string;
  phoneNumber?: string;
  email?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'bank_to_bank' | 'other';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  type?: TransactionType | 'both';
}

export interface RecurringRule {
  type: 'installment' | 'subscription' | 'custom';
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';
  
  // Installment-specific fields
  totalPrincipal?: number;      // Total amount financed
  currentTerm?: number;          // Current payment number
  totalTerms?: number;           // Total number of payments
  startDate?: string;            // First payment date
  endDate?: string;              // Last payment date
  interestRate?: number;         // Annual percentage rate (0 for 0% financing)
  installmentGroupId?: string;   // Links all payments in this installment plan
  
  // General recurring fields
  nextDate?: string;             // Next scheduled occurrence
  lastDate?: string;             // Last occurrence (for completed)
}

export interface Transaction {
  id: string;
  profileId: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO string
  categoryId: string;
  subcategoryId?: string;
  description: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  cardId?: string; // when paymentMethod is card
  bankId?: string; // when paymentMethod is bank_transfer or type is income
  fromBankId?: string; // for bank-to-bank transfers (source account)
  toBankId?: string; // for bank-to-bank transfers (destination account)
  transferFee?: number; // optional fee for bank-to-bank transfers
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  isRecurring?: boolean;
  recurringRule?: RecurringRule;
  isEstimate?: boolean;
  
  // Payment tracking (for installments and recurring transactions)
  isPaid?: boolean;                // True if this installment payment has been made
  paidDate?: string;               // Date when payment was made
  paidAmount?: number;             // Amount paid (may be partial)
  
  // Track when another person uses the card but reimburses
  paidByOther?: boolean;           // True if someone else paid this charge
  paidByOtherProfileId?: string;   // Profile ID of who paid (link to other profile)
  paidByOtherName?: string;        // Name of the person who paid (e.g., "John", "Mom") - fallback for non-profile users
  
  // Debt obligation for income (e.g., loan, advance payment that must be repaid)
  hasDebtObligation?: boolean;     // True if this income has a debt that must be paid back
  debtAmount?: number;             // Amount that needs to be paid back
  debtDueDate?: string;            // Date when the debt must be paid (ISO string)
  debtPaid?: boolean;              // True if the debt has been paid
  debtPaidDate?: string;           // Date when the debt was paid (ISO string)
  linkedDebtTransactionId?: string; // ID of the expense transaction created when debt is paid
}

export interface TransactionFilter {
  profileIds?: string[];
  dateRange?: { start: string; end: string };
  type?: TransactionType | 'all';
  categoryIds?: string[];
  paymentMethod?: PaymentMethod | 'all';
  cardId?: string;
  searchQuery?: string;
  isRecurring?: boolean;
  recurringType?: RecurringRule['type'];
  installmentGroupId?: string;
}

export interface InstallmentStatus {
  currentTerm: number;
  totalTerms: number;
  monthlyAmount: number;
  isActive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}

export interface InstallmentProgress {
  installmentGroupId: string;
  name: string;
  cardId?: string;
  profileId: string;
  totalPrincipal?: number;
  totalTerms: number;
  currentTerm: number;
  monthlyAmount: number;
  startDate: string;
  endDate?: string;
  paymentMethod: PaymentMethod;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface CategoryAllocation {
  categoryId: string;
  allocatedAmount: number;
  spent: number;  // Auto-calculated from transactions
  remaining: number;  // Auto-calculated
}

export interface Budget {
  id: string;
  profileId: string;
  name: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;  // null for ongoing budgets
  
  // Category allocations
  allocations: CategoryAllocation[];
  
  // Settings
  rolloverUnspent: boolean;
  alertThreshold: number;  // Percentage (e.g., 80%)
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface SavingsGoal {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  
  // Contribution
  monthlyContribution?: number;
  autoContribute: boolean;
  goalTransactionId?: string;  // Link to recurring transaction for auto-contributions
  
  // Visualization
  icon: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannedPurchase {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  estimatedCost: number;
  priority: 'need' | 'want' | 'wish';
  
  // Timeline
  targetDate?: string;
  isPurchased: boolean;
  purchasedDate?: string;
  actualCost?: number;
  
  // Financing
  paymentMethod?: 'cash' | 'card' | 'installment';
  installmentPlan?: {
    months: number;
    monthlyPayment: number;
    interestRate?: number;
  };
  
  // Research
  links: string[];
  notes: string;
  tags: string[];
  
  // Categorization
  category: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetImpact {
  currentMonthlyIncome: number;
  currentMonthlyExpenses: number;
  currentMonthlyDebt: number;
  
  newMonthlyPayment: number;
  newTotalMonthlyDebt: number;
  newDebtToIncomeRatio: number;
  
  remainingAfterLoan: number;
  percentageOfIncomeUsed: number;
  
  recommendations: string[];
  warnings: string[];
}

export interface LoanPlan {
  id: string;
  profileId: string;
  name: string;
  type: 'mortgage' | 'auto' | 'personal' | 'student' | 'other';
  
  // Loan details
  totalAmount: number;
  downPayment: number;
  loanAmount: number;  // totalAmount - downPayment
  interestRate: number;  // Annual percentage rate
  termMonths: number;
  
  // Calculated values
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  
  // Additional costs (for mortgages/auto)
  propertyTax?: number;  // Monthly
  insurance?: number;  // Monthly
  pmi?: number;  // Private mortgage insurance
  hoa?: number;  // HOA fees
  maintenance?: number;  // Estimated monthly maintenance
  
  // Affordability analysis
  affordabilityScore: number;  // 0-100
  monthlyIncomeRequired: number;
  debtToIncomeRatio: number;
  impactOnBudget: BudgetImpact;
  
  // Status
  status: 'planning' | 'saving_for_down_payment' | 'approved' | 'active' | 'completed';
  targetDate?: string;
  notes: string;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
}
