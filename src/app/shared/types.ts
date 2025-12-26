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

export interface Statement {
  id: string;
  cardId: string;
  monthStr: string;
  amount: number;
  isPaid: boolean;
  customDueDate?: string;
  isUnbilled?: boolean;
  adjustedAmount?: number;
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

export interface OneTimeBill {
  id: string;
  cardId: string;
  name: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
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
