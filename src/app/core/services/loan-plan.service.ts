import { effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import { TransactionService } from './transaction.service';
import type { LoanPlan, BudgetImpact, Transaction } from '@shared/types';
import { format, parseISO, addMonths } from 'date-fns';

/**
 * Loan Plan Service
 * Manages loan planning with affordability analysis and DTI calculations
 */
@Injectable({
  providedIn: 'root',
})
export class LoanPlanService {
  private loansSignal = signal<LoanPlan[]>([]);
  loans = this.loansSignal.asReadonly();
  private isLoadedSignal = signal(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(
    private idb: IndexedDBService,
    private transactionService: TransactionService,
  ) {
    void this.initializeLoans();
    this.setupAutoSave();
  }

  /**
   * Get all loans for a profile
   */
  getLoans(profileId: string): LoanPlan[] {
    return this.loansSignal().filter((l) => l.profileId === profileId);
  }

  /**
   * Get loan by ID
   */
  getLoan(id: string): LoanPlan | undefined {
    return this.loansSignal().find((l) => l.id === id);
  }

  /**
   * Create a new loan plan
   */
  async createLoanPlan(
    loan: Omit<LoanPlan, 'id' | 'createdAt' | 'updatedAt' | 'monthlyPayment' | 'totalInterest' | 'totalCost' | 'affordabilityScore' | 'monthlyIncomeRequired' | 'debtToIncomeRatio' | 'impactOnBudget'>,
  ): Promise<LoanPlan> {
    // Calculate loan details
    const calculated = this.calculateLoanDetails(loan);
    const affordability = await this.calculateAffordability(
      { ...loan, ...calculated },
      loan.profileId,
    );

    const newLoan: LoanPlan = {
      id: this.generateId(),
      ...loan,
      ...calculated,
      ...affordability,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.loansSignal.update((prev) => [...prev, newLoan]);
    return newLoan;
  }

  /**
   * Update a loan plan
   */
  async updateLoanPlan(id: string, updates: Partial<LoanPlan>): Promise<void> {
    const existing = this.getLoan(id);
    if (!existing) {
      throw new Error(`Loan plan not found: ${id}`);
    }

    // Recalculate if loan details changed
    const needsRecalculation =
      updates.totalAmount !== undefined ||
      updates.downPayment !== undefined ||
      updates.interestRate !== undefined ||
      updates.termMonths !== undefined ||
      updates.propertyTax !== undefined ||
      updates.insurance !== undefined ||
      updates.pmi !== undefined ||
      updates.hoa !== undefined ||
      updates.maintenance !== undefined;

    let calculated = {};
    let affordability = {};

    if (needsRecalculation) {
      const updated = { ...existing, ...updates };
      calculated = this.calculateLoanDetails(updated);
      affordability = await this.calculateAffordability(updated, existing.profileId);
    }

    this.loansSignal.update((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, ...updates, ...calculated, ...affordability, updatedAt: new Date().toISOString() }
          : l,
      ),
    );
  }

  /**
   * Delete a loan plan
   */
  async deleteLoanPlan(id: string): Promise<void> {
    this.loansSignal.update((prev) => prev.filter((l) => l.id !== id));
  }

  /**
   * Calculate loan payment details
   */
  calculateLoanDetails(loan: {
    loanAmount: number;
    interestRate: number;
    termMonths: number;
    propertyTax?: number;
    insurance?: number;
    pmi?: number;
    hoa?: number;
    maintenance?: number;
  }): {
    monthlyPayment: number;
    totalInterest: number;
    totalCost: number;
  } {
    const { loanAmount, interestRate, termMonths } = loan;

    // Calculate monthly interest rate
    const monthlyRate = interestRate / 100 / 12;

    // Calculate monthly payment using amortization formula
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment =
        (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);
    } else {
      // 0% interest - simple division
      monthlyPayment = loanAmount / termMonths;
    }

    // Add additional monthly costs
    monthlyPayment += loan.propertyTax || 0;
    monthlyPayment += loan.insurance || 0;
    monthlyPayment += loan.pmi || 0;
    monthlyPayment += loan.hoa || 0;
    monthlyPayment += loan.maintenance || 0;

    // Calculate total interest
    const totalPaid = monthlyPayment * termMonths;
    const totalInterest = totalPaid - loanAmount;

    // Total cost includes down payment
    const totalCost = loanAmount + totalInterest + (loan.propertyTax || 0) * termMonths + (loan.insurance || 0) * termMonths + (loan.pmi || 0) * termMonths + (loan.hoa || 0) * termMonths + (loan.maintenance || 0) * termMonths;

    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  }

  /**
   * Calculate affordability based on actual financial data
   */
  async calculateAffordability(
    loan: {
      monthlyPayment: number;
      totalAmount: number;
      downPayment: number;
      profileId: string;
    },
    profileId: string,
  ): Promise<{
    affordabilityScore: number;
    monthlyIncomeRequired: number;
    debtToIncomeRatio: number;
    impactOnBudget: BudgetImpact;
  }> {
    // Get financial data from transactions
    const transactions = this.transactionService.getTransactions({
      profileIds: [profileId],
    });

    // Calculate average monthly income (last 6 months)
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const incomeTransactions = transactions.filter(
      (t) => t.type === 'income' && parseISO(t.date) >= sixMonthsAgo && !t.paidByOther,
    );

    let totalIncome = 0;
    const incomeByMonth = new Map<string, number>();
    incomeTransactions.forEach((t) => {
      const monthStr = t.date.slice(0, 7);
      incomeByMonth.set(monthStr, (incomeByMonth.get(monthStr) || 0) + t.amount);
    });

    const monthlyIncomes = Array.from(incomeByMonth.values());
    const averageMonthlyIncome =
      monthlyIncomes.length > 0
        ? monthlyIncomes.reduce((sum, inc) => sum + inc, 0) / monthlyIncomes.length
        : 0;

    // Calculate average monthly expenses
    const expenseTransactions = transactions.filter(
      (t) => t.type === 'expense' && parseISO(t.date) >= sixMonthsAgo && !t.paidByOther,
    );

    const expenseByMonth = new Map<string, number>();
    expenseTransactions.forEach((t) => {
      const monthStr = t.date.slice(0, 7);
      expenseByMonth.set(monthStr, (expenseByMonth.get(monthStr) || 0) + t.amount);
    });

    const monthlyExpenses = Array.from(expenseByMonth.values());
    const averageMonthlyExpenses =
      monthlyExpenses.length > 0
        ? monthlyExpenses.reduce((sum, exp) => sum + exp, 0) / monthlyExpenses.length
        : 0;

    // Calculate current debt payments (recurring installments)
    const recurringExpenses = transactions.filter(
      (t) => t.isRecurring && t.type === 'expense' && !t.paidByOther,
    );
    const currentMonthlyDebt = recurringExpenses.reduce((sum, t) => {
      if (t.recurringRule?.type === 'installment' && t.recurringRule.frequency === 'monthly') {
        return sum + t.amount;
      }
      return sum;
    }, 0);

    // Calculate new DTI
    const newTotalMonthlyDebt = currentMonthlyDebt + loan.monthlyPayment;
    const debtToIncomeRatio =
      averageMonthlyIncome > 0 ? (newTotalMonthlyDebt / averageMonthlyIncome) * 100 : 0;

    // Calculate remaining after loan
    const remainingAfterLoan = averageMonthlyIncome - averageMonthlyExpenses - loan.monthlyPayment;
    const percentageOfIncomeUsed =
      averageMonthlyIncome > 0 ? (loan.monthlyPayment / averageMonthlyIncome) * 100 : 0;

    // Calculate affordability score (0-100)
    let score = 100;

    // DTI penalty (40 points max)
    if (debtToIncomeRatio > 43) {
      score -= 40; // Exceeds typical lender limit
    } else if (debtToIncomeRatio > 36) {
      score -= 30; // High DTI
    } else if (debtToIncomeRatio > 28) {
      score -= 15; // Moderate DTI
    } else if (debtToIncomeRatio > 20) {
      score -= 5; // Low DTI
    }

    // Remaining income penalty (20 points max)
    if (remainingAfterLoan < 0) {
      score -= 20; // Negative cash flow
    } else if (remainingAfterLoan < 500) {
      score -= 15; // Very tight
    } else if (remainingAfterLoan < 1000) {
      score -= 10; // Tight
    } else if (remainingAfterLoan < 2000) {
      score -= 5; // Moderate
    }

    // Payment as % of income penalty (20 points max)
    if (percentageOfIncomeUsed > 50) {
      score -= 20;
    } else if (percentageOfIncomeUsed > 40) {
      score -= 15;
    } else if (percentageOfIncomeUsed > 30) {
      score -= 10;
    } else if (percentageOfIncomeUsed > 20) {
      score -= 5;
    }

    // Emergency fund check (20 points max) - simplified
    // Would need savings goals or bank balance data
    score = Math.max(0, score);

    // Generate recommendations and warnings
    const recommendations: string[] = [];
    const warnings: string[] = [];

    if (debtToIncomeRatio > 43) {
      warnings.push('DTI exceeds typical lender limit (43%). Consider a lower loan amount.');
    } else if (debtToIncomeRatio > 36) {
      warnings.push('DTI is high. Lenders may require additional documentation.');
    }

    if (remainingAfterLoan < 0) {
      warnings.push('This loan would create negative cash flow. Not recommended.');
    } else if (remainingAfterLoan < 1000) {
      warnings.push('Very little remaining income after loan payment. Consider reducing expenses.');
    }

    if (score >= 80) {
      recommendations.push('Excellent affordability. You qualify for this loan.');
    } else if (score >= 60) {
      recommendations.push('Good affordability. Minor improvements could help.');
    } else if (score >= 40) {
      recommendations.push('Fair affordability. Significant planning required.');
      recommendations.push('Consider increasing down payment or reducing loan amount.');
    } else {
      recommendations.push('Poor affordability. Not recommended at this time.');
      recommendations.push('Focus on reducing debt and increasing income first.');
    }

    // Calculate required income (3x monthly payment is a common rule)
    const monthlyIncomeRequired = loan.monthlyPayment * 3;

    const impactOnBudget: BudgetImpact = {
      currentMonthlyIncome: averageMonthlyIncome,
      currentMonthlyExpenses: averageMonthlyExpenses,
      currentMonthlyDebt,
      newMonthlyPayment: loan.monthlyPayment,
      newTotalMonthlyDebt: newTotalMonthlyDebt,
      newDebtToIncomeRatio: debtToIncomeRatio,
      remainingAfterLoan,
      percentageOfIncomeUsed,
      recommendations,
      warnings,
    };

    return {
      affordabilityScore: Math.round(score),
      monthlyIncomeRequired: Math.round(monthlyIncomeRequired * 100) / 100,
      debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
      impactOnBudget,
    };
  }

  /**
   * Convert loan plan to recurring transaction when approved/active
   */
  async convertToTransaction(loanId: string, startDate: string, cardId?: string): Promise<void> {
    const loan = this.getLoan(loanId);
    if (!loan) {
      throw new Error(`Loan plan not found: ${loanId}`);
    }

    // Create recurring transaction for loan payment
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      profileId: loan.profileId,
      type: 'expense',
      amount: loan.monthlyPayment,
      date: startDate,
      categoryId: 'housing', // Default category
      description: `${loan.name} Payment`,
      notes: `Loan: ${loan.name}. Total: $${loan.totalAmount}, Down: $${loan.downPayment}`,
      paymentMethod: cardId ? 'card' : 'bank_transfer',
      cardId,
      isRecurring: true,
      recurringRule: {
        type: 'installment',
        frequency: 'monthly',
        totalPrincipal: loan.loanAmount,
        currentTerm: 1,
        totalTerms: loan.termMonths,
        startDate,
        endDate: format(addMonths(parseISO(startDate), loan.termMonths), 'yyyy-MM-dd'),
        interestRate: loan.interestRate,
        installmentGroupId: `loan_${loanId}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.transactionService.addTransaction(transaction);
    await this.updateLoanPlan(loanId, { status: 'active' });
  }

  /**
   * Initialize loans from IndexedDB
   */
  private async initializeLoans(): Promise<void> {
    try {
      const db = this.idb.getDB();
      const loans = await db.getAll<LoanPlan>(STORES.LOAN_PLANS);
      this.loansSignal.set(loans);
      this.isLoadedSignal.set(true);
    } catch (error) {
      console.error('Failed to initialize loan plans:', error);
      this.loansSignal.set([]);
      this.isLoadedSignal.set(true);
    }
  }

  /**
   * Auto-save loans when signal changes
   */
  private setupAutoSave(): void {
    effect(() => {
      if (this.isLoadedSignal()) {
        const loans = this.loansSignal();
        void this.idb.getDB().putAll(STORES.LOAN_PLANS, loans);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `loan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
