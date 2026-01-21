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
  installmentId: string;
  cardId: string;
  term: number;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  name: string;
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
  isEstimate?: boolean;
}

export interface TransactionFilter {
  profileIds?: string[];
  dateRange?: { start: string; end: string };
  type?: TransactionType | 'all';
  categoryIds?: string[];
  paymentMethod?: PaymentMethod | 'all';
  cardId?: string;
  searchQuery?: string;
}

export interface InstallmentStatus {
  currentTerm: number;
  totalTerms: number;
  monthlyAmount: number;
  isActive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}
