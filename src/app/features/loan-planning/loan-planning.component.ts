import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Plus,
  Calculator,
  Trash2,
  Edit2,
  X,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  LucideAngularModule,
} from 'lucide-angular';
import { ProfileService, LoanPlanService, UtilsService } from '@services';
import { MetricCardComponent, EmptyStateComponent } from '@components';
import type { LoanPlan } from '@shared/types';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-loan-planning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './loan-planning.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .loan-card {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .loan-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .loan-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
      }

      .modal-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 800px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }

      .affordability-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }

      .affordability-excellent {
        background: #dcfce7;
        color: #166534;
      }

      .affordability-good {
        background: #dbeafe;
        color: #1e40af;
      }

      .affordability-fair {
        background: #fef3c7;
        color: #92400e;
      }

      .affordability-poor {
        background: #fee2e2;
        color: #991b1b;
      }
    `,
  ],
})
export class LoanPlanningComponent {
  readonly Plus = Plus;
  readonly Calculator = Calculator;
  readonly Trash2 = Trash2;
  readonly Edit2 = Edit2;
  readonly X = X;
  readonly DollarSign = DollarSign;
  readonly TrendingUp = TrendingUp;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle2 = CheckCircle2;

  private profileService = inject(ProfileService);
  private loanService = inject(LoanPlanService);
  private utils = inject(UtilsService);

  protected activeProfile = this.profileService.activeProfile;

  // Loans
  protected loans = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];
    return this.loanService.getLoans(profile.id);
  });

  // Summary metrics
  protected summary = computed(() => {
    const loans = this.loans();
    const totalLoans = loans.length;
    const totalMonthlyPayments = loans.reduce((sum, l) => sum + l.monthlyPayment, 0);
    const totalLoanAmount = loans.reduce((sum, l) => sum + l.loanAmount, 0);
    const avgAffordability = loans.length > 0
      ? loans.reduce((sum, l) => sum + l.affordabilityScore, 0) / loans.length
      : 0;

    return {
      totalLoans,
      totalMonthlyPayments,
      totalLoanAmount,
      avgAffordability,
    };
  });

  // Modal state
  protected showLoanModal = signal(false);
  protected editingLoan = signal<LoanPlan | null>(null);
  protected loanForm = signal<{
    name: string;
    type: 'mortgage' | 'auto' | 'personal' | 'student' | 'other';
    totalAmount: string;
    downPayment: string;
    interestRate: string;
    termMonths: string;
    propertyTax: string;
    insurance: string;
    pmi: string;
    hoa: string;
    maintenance: string;
    notes: string;
    status: 'planning' | 'saving_for_down_payment' | 'approved' | 'active' | 'completed';
    targetDate: string;
  }>({
    name: '',
    type: 'other',
    totalAmount: '',
    downPayment: '',
    interestRate: '',
    termMonths: '',
    propertyTax: '',
    insurance: '',
    pmi: '',
    hoa: '',
    maintenance: '',
    notes: '',
    status: 'planning',
    targetDate: '',
  });

  protected loanTypeOptions = [
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'auto', label: 'Auto Loan' },
    { value: 'personal', label: 'Personal Loan' },
    { value: 'student', label: 'Student Loan' },
    { value: 'other', label: 'Other' },
  ];

  protected statusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'saving_for_down_payment', label: 'Saving for Down Payment' },
    { value: 'approved', label: 'Approved' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ];

  protected formatCurrency = (amount: number): string => {
    return this.utils.formatCurrency(amount);
  };

  protected getAffordabilityClass(score: number): string {
    if (score >= 80) return 'affordability-excellent';
    if (score >= 60) return 'affordability-good';
    if (score >= 40) return 'affordability-fair';
    return 'affordability-poor';
  }

  protected getAffordabilityLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  protected openLoanModal(loan?: LoanPlan): void {
    if (loan) {
      this.editingLoan.set(loan);
      this.loanForm.set({
        name: loan.name,
        type: loan.type,
        totalAmount: loan.totalAmount.toString(),
        downPayment: loan.downPayment.toString(),
        interestRate: loan.interestRate.toString(),
        termMonths: loan.termMonths.toString(),
        propertyTax: loan.propertyTax?.toString() || '',
        insurance: loan.insurance?.toString() || '',
        pmi: loan.pmi?.toString() || '',
        hoa: loan.hoa?.toString() || '',
        maintenance: loan.maintenance?.toString() || '',
        notes: loan.notes || '',
        status: loan.status,
        targetDate: loan.targetDate || '',
      });
    } else {
      this.editingLoan.set(null);
      this.loanForm.set({
        name: '',
        type: 'other',
        totalAmount: '',
        downPayment: '',
        interestRate: '',
        termMonths: '',
        propertyTax: '',
        insurance: '',
        pmi: '',
        hoa: '',
        maintenance: '',
        notes: '',
        status: 'planning',
        targetDate: '',
      });
    }
    this.showLoanModal.set(true);
  }

  protected closeLoanModal(): void {
    this.showLoanModal.set(false);
    this.editingLoan.set(null);
  }

  protected async saveLoan(): Promise<void> {
    const form = this.loanForm();
    if (!form.name || !form.totalAmount || !form.downPayment || !form.interestRate || !form.termMonths) {
      alert('Please fill in all required fields');
      return;
    }

    const totalAmount = parseFloat(form.totalAmount);
    const downPayment = parseFloat(form.downPayment);
    const loanAmount = totalAmount - downPayment;

    if (loanAmount <= 0) {
      alert('Loan amount must be greater than down payment');
      return;
    }

    const profile = this.activeProfile();
    if (!profile) return;

    const loanData: Omit<LoanPlan, 'id' | 'createdAt' | 'updatedAt' | 'monthlyPayment' | 'totalInterest' | 'totalCost' | 'affordabilityScore' | 'monthlyIncomeRequired' | 'debtToIncomeRatio' | 'impactOnBudget'> = {
      profileId: profile.id,
      name: form.name,
      type: form.type,
      totalAmount,
      downPayment,
      loanAmount,
      interestRate: parseFloat(form.interestRate),
      termMonths: parseInt(form.termMonths, 10),
      propertyTax: form.propertyTax ? parseFloat(form.propertyTax) : undefined,
      insurance: form.insurance ? parseFloat(form.insurance) : undefined,
      pmi: form.pmi ? parseFloat(form.pmi) : undefined,
      hoa: form.hoa ? parseFloat(form.hoa) : undefined,
      maintenance: form.maintenance ? parseFloat(form.maintenance) : undefined,
      notes: form.notes,
      status: form.status,
      targetDate: form.targetDate || undefined,
    };

    if (this.editingLoan()) {
      await this.loanService.updateLoanPlan(this.editingLoan()!.id, loanData);
    } else {
      await this.loanService.createLoanPlan(loanData);
    }

    this.closeLoanModal();
  }

  protected async deleteLoan(loanId: string): Promise<void> {
    if (!confirm('Delete this loan plan?')) return;
    await this.loanService.deleteLoanPlan(loanId);
  }
}
