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

export interface CashInstallment {
  id: string;
  cardId: string;
  installmentId?: string;
  name: string;
  amount: number;
  dueDate: string;
  term: number | string;
  isPaid: boolean;
}

export interface BankBalance {
  id: string;
  profileId: string;
  monthStr: string;
  balance: number;
}

export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'other';

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
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  isRecurring?: boolean;
  recurringRule?: RecurringRule;
  isEstimate?: boolean;
  
  // Track when another person uses the card but reimburses
  paidByOther?: boolean;           // True if someone else paid this charge
  paidByOtherProfileId?: string;   // Profile ID of who paid (link to other profile)
  paidByOtherName?: string;        // Name of the person who paid (e.g., "John", "Mom") - fallback for non-profile users
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
