import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  FileText,
  LucideAngularModule,
  Plus,
  X,
} from 'lucide-angular';
import {
  AppStateService,
  CardService,
  ProfileService,
  StatementService,
  TransactionService,
  UtilsService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent } from '@components';
import type { Statement, Transaction } from '@shared/types';
import { format, parseISO } from 'date-fns';

interface BillWithDetails {
  statement: Statement | null;
  cardId: string;
  cardName: string;
  color: string;
  dueDate: Date;
  amount: number;
  isPaid: boolean;
  paidAmount: number;
  transactions: Transaction[];
  isExpanded: boolean;
}

/**
 * Bills Page Component
 * Displays credit card statements with linked transactions
 * Shows auto-generated bills from transaction-to-statement linking
 */
@Component({
  selector: 'app-bills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './bills.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .bill-card {
        border-radius: 8px;
        transition: all 0.2s;
      }

      .bill-card:hover {
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      }

      .transaction-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid rgb(226, 232, 240);
      }

      .transaction-item:last-child {
        border-bottom: none;
      }

      .payment-modal {
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
        max-width: 500px;
        width: 90%;
      }
    `,
  ],
})
export class BillsComponent {
  readonly CreditCard = CreditCard;
  readonly Calendar = Calendar;
  readonly DollarSign = DollarSign;
  readonly FileText = FileText;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly CheckCircle = CheckCircle;
  readonly AlertCircle = AlertCircle;
  readonly X = X;
  readonly Plus = Plus;

  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  // Payment modal state
  protected paymentModalState = signal<{
    isOpen: boolean;
    statement: Statement | null;
    cardName: string;
    amount: string;
    date: string;
  }>({
    isOpen: false,
    statement: null,
    cardName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });
  protected paymentModal = this.paymentModalState.asReadonly();

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  // Manual bill creation modal state
  protected billFormState = signal<{
    isOpen: boolean;
    cardId: string;
    amount: string;
    dueDate: string;
    notes: string;
    isEditing: boolean;
    editingMonthStr: string;
  }>({
    isOpen: false,
    cardId: '',
    amount: '',
    dueDate: '',
    notes: '',
    isEditing: false,
    editingMonthStr: '',
  });
  // Calculate bills summary
  protected summary = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return {
        totalDue: 0,
        unpaidCount: 0,
        paidCount: 0,
        totalPaid: 0,
      };
    }

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = format(this.viewDate(), 'yyyy-MM');

    let totalDue = 0;
    let unpaidCount = 0;
    let paidCount = 0;
    let totalPaid = 0;

    for (const card of cards) {
      const statement = this.statementService.getStatementForMonth(card.id, monthStr);
      if (statement) {
        if (statement.isPaid) {
          paidCount++;
          totalPaid += statement.paidAmount || statement.amount;
        } else {
          unpaidCount++;
          totalDue += statement.amount;
        }
      }
    }

    return { totalDue, unpaidCount, paidCount, totalPaid };
  });
  private transactionService = inject(TransactionService);
  // Get all bills with details for current month
  protected billsWithDetails = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = format(this.viewDate(), 'yyyy-MM');

    return cards
      .map((card) => {
        const statement = this.statementService.getStatementForMonth(card.id, monthStr) || null;

        // Get transactions linked to this card for this month
        const transactions = this.transactionService
          .getTransactions({
            profileIds: [profile.id],
            cardId: card.id,
            paymentMethod: 'card',
          })
          .filter((t) => {
            // Filter by month based on transaction date
            const transactionMonth = t.date.substring(0, 7);
            return transactionMonth === monthStr;
          });

        const dueDate = new Date(`${monthStr}-${String(card.dueDay).padStart(2, '0')}`);
        const amount = statement?.amount || transactions.reduce((sum, t) => sum + t.amount, 0);

        const bill: BillWithDetails = {
          statement,
          cardId: card.id,
          cardName: `${card.bankName} ${card.cardName}`,
          color: card.color,
          dueDate,
          amount,
          isPaid: statement?.isPaid || false,
          paidAmount: statement?.paidAmount || 0,
          transactions,
          isExpanded: false,
        };

        return bill;
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  });
  private utils = inject(UtilsService);

  protected get availableCards() {
    const profile = this.activeProfile();
    return profile ? this.cardService.getCardsForProfiles([profile.id]) : [];
  }

  protected toggleExpand(bill: BillWithDetails): void {
    bill.isExpanded = !bill.isExpanded;
  }

  protected openPaymentModal(bill: BillWithDetails): void {
    if (!bill.statement) return;

    this.paymentModalState.set({
      isOpen: true,
      statement: bill.statement,
      cardName: bill.cardName,
      amount: bill.amount.toString(),
      date: new Date().toISOString().split('T')[0],
    });
  }

  protected closePaymentModal(): void {
    this.paymentModalState.update((state) => ({
      ...state,
      isOpen: false,
    }));
  }

  protected async recordPayment(): Promise<void> {
    const modal = this.paymentModal();
    if (!modal.statement || !modal.amount) return;

    try {
      const paidAmount = parseFloat(modal.amount);
      if (isNaN(paidAmount) || paidAmount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      await this.statementService.updateStatement(
        modal.statement.cardId,
        modal.statement.monthStr,
        {
          isPaid: true,
          paidAmount,
          payments: [
            ...(modal.statement.payments || []),
            {
              amount: paidAmount,
              date: modal.date,
            },
          ],
        },
      );

      this.closePaymentModal();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  }

  protected async markAsUnpaid(bill: BillWithDetails): Promise<void> {
    if (!bill.statement) return;

    try {
      await this.statementService.updateStatement(bill.statement.cardId, bill.statement.monthStr, {
        isPaid: false,
        paidAmount: 0,
      });
    } catch (error) {
      console.error('Error marking as unpaid:', error);
      alert('Failed to update payment status');
    }
  }

  protected formatCurrency(amount: number): string {
    return this.utils.formatCurrency(amount);
  }

  protected formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  }

  // Manual bill creation/editing
  protected openBillFormForCreate(): void {
    const profile = this.activeProfile();
    if (!profile) return;

    const cards = this.cardService.getCardsForProfiles([profile.id]);
    const monthStr = format(this.viewDate(), 'yyyy-MM');
    const defaultCard = cards[0];

    if (defaultCard) {
      const dueDate = `${monthStr}-${String(defaultCard.dueDay).padStart(2, '0')}`;

      this.billFormState.set({
        isOpen: true,
        cardId: defaultCard.id,
        amount: '',
        dueDate,
        notes: '',
        isEditing: false,
        editingMonthStr: '',
      });
    }
  }

  protected openBillFormForEdit(bill: BillWithDetails): void {
    if (!bill.statement) return;

    this.billFormState.set({
      isOpen: true,
      cardId: bill.cardId,
      amount: bill.statement.amount.toString(),
      dueDate: bill.statement.customDueDate || format(bill.dueDate, 'yyyy-MM-dd'),
      notes: bill.statement.notes || '',
      isEditing: true,
      editingMonthStr: bill.statement.monthStr,
    });
  }

  protected closeBillForm(): void {
    this.billFormState.update((state) => ({
      ...state,
      isOpen: false,
    }));
  }

  protected async saveBill(): Promise<void> {
    const form = this.billFormState();
    const profile = this.activeProfile();

    if (!profile || !form.cardId || !form.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const monthStr = form.isEditing ? form.editingMonthStr : format(this.viewDate(), 'yyyy-MM');

      if (form.isEditing) {
        // Update existing statement
        this.statementService.updateStatement(form.cardId, monthStr, {
          amount,
          customDueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
          isEstimated: true,
        });
      } else {
        // Create new manual statement
        this.statementService.updateStatement(form.cardId, monthStr, {
          amount,
          isPaid: false,
          customDueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
          isEstimated: true,
        });
      }

      this.closeBillForm();
    } catch (error) {
      console.error('Error saving bill:', error);
      alert('Failed to save bill');
    }
  }

  protected updateDueDateBasedOnCard(cardId: string): void {
    const card = this.availableCards.find((c) => c.id === cardId);
    if (!card) return;

    const monthStr = format(this.viewDate(), 'yyyy-MM');
    const dueDate = `${monthStr}-${String(card.dueDay).padStart(2, '0')}`;

    this.billFormState.update((state) => ({
      ...state,
      dueDate,
    }));
  }
}
