import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
  Trash2,
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
  TransactionBucketService,
  UtilsService,
  CategoryService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent } from '@components';
import type { Statement, Transaction } from '@shared/types';
import { format, parseISO, subMonths, addMonths, startOfMonth, getDate, lastDayOfMonth } from 'date-fns';

interface BillWithDetails {
  statement: Statement | null;
  cardId: string;
  cardName: string;
  bankName: string;
  color: string;
  dueDate: Date;
  settlementDate: Date; // Calculated settlement date
  paymentDate: Date; // Calculated payment date
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
  readonly CheckCircle2 = CheckCircle2;
  readonly AlertCircle = AlertCircle;
  readonly X = X;
  readonly Plus = Plus;
  readonly Copy = Copy;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;

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
    editingIndex: number | null;
  }>({
    isOpen: false,
    statement: null,
    cardName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    editingIndex: null,
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
    settlementDay: string;
    notes: string;
    isEditing: boolean;
    editingMonthStr: string;
  }>({
    isOpen: false,
    cardId: '',
    amount: '',
    dueDate: '',
    settlementDay: '',
    notes: '',
    isEditing: false,
    editingMonthStr: '',
  });
  // Calculate bills summary
  protected summary = computed(() => {
    const multiMode = this.appState.multiProfileMode();
    const selectedIds = this.appState.selectedProfileIds();
    const activeProfile = this.activeProfile();

    let profileIds: string[] = [];
    if (multiMode && selectedIds.length > 0) {
      profileIds = selectedIds;
    } else if (activeProfile) {
      profileIds = [activeProfile.id];
    } else {
      return {
        totalDue: 0,
        unpaidCount: 0,
        paidCount: 0,
        totalPaid: 0,
      };
    }

    const cards = this.cardService.getCardsForProfiles(profileIds);
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
  private transactionBucketService = inject(TransactionBucketService);
  private categoryService = inject(CategoryService);
  // Get all bills with details for current month
  protected billsWithDetails = computed(() => {
    const multiMode = this.appState.multiProfileMode();
    const selectedIds = this.appState.selectedProfileIds();
    const activeProfile = this.activeProfile();

    let profileIds: string[] = [];
    if (multiMode && selectedIds.length > 0) {
      profileIds = selectedIds;
    } else if (activeProfile) {
      profileIds = [activeProfile.id];
    } else {
      return [];
    }

    const cards = this.cardService.getCardsForProfiles(profileIds);
    const monthStr = format(this.viewDate(), 'yyyy-MM');
    
    return cards
      .map((card) => {
        const statement = this.statementService.getStatementForMonth(card.id, monthStr) || null;

        // Get transactions linked to this statement (settlement-aware, not calendar month)
        // Sort by date (oldest first)
        // Use customCutoffDay for backward compatibility, otherwise use settlementDay
        const settlementDayOverride = statement?.customCutoffDay ?? card.settlementDay;
        const transactions = this.transactionService
          .getTransactionsForStatement(card.id, monthStr, settlementDayOverride)
          .filter((t) => profileIds.includes(t.profileId))
          .sort((a, b) => {
            return parseISO(a.date).getTime() - parseISO(b.date).getTime();
          });

        let dueDate: Date;
        if (statement?.customDueDate) {
            dueDate = parseISO(statement.customDueDate);
        } else {
            dueDate = new Date(`${monthStr}-${String(card.paymentDay).padStart(2, '0')}`);
        }

        let amount = statement?.amount || transactions.reduce((sum, t) => sum + t.amount, 0);

        // Check for overpayment in the previous month
        if (!statement) {
            const prevViewDate = subMonths(this.viewDate(), 1);
            const prevMonthStr = format(prevViewDate, 'yyyy-MM');
            const prevStatement = this.statementService.getStatementForMonth(card.id, prevMonthStr);
            const excessPayment = Math.max(0, (prevStatement?.paidAmount || 0) - (prevStatement?.amount || 0));
            
            if (excessPayment > 0) {
                amount = Math.max(0, amount - excessPayment);
            }
        }

        // Calculate settlement and payment dates
        // Use the first transaction date or current month start as reference
        const referenceDate = transactions.length > 0 
          ? parseISO(transactions[0].date)
          : parseISO(`${monthStr}-01`);
        
        // Get settlement and payment dates using TransactionBucketService
        const settlementDay = card.settlementDay;
        const paymentDay = card.paymentDay;
        
        let settlementDate: Date;
        let paymentDate: Date;
        
        // Check for manual overrides
        if (statement?.manualSettlementDate) {
          settlementDate = parseISO(statement.manualSettlementDate);
        } else {
          // Calculate settlement date based on settlementDay
          const settlementMonth = referenceDate.getDate() > settlementDay
            ? addMonths(startOfMonth(referenceDate), 1)
            : startOfMonth(referenceDate);
          const settlementYear = settlementMonth.getFullYear();
          const settlementMonthIndex = settlementMonth.getMonth();
          const lastDayOfSettlementMonth = getDate(lastDayOfMonth(settlementMonth));
          const sd = Math.min(settlementDay, lastDayOfSettlementMonth);
          settlementDate = new Date(settlementYear, settlementMonthIndex, sd);
        }
        
        if (statement?.manualPaymentDate) {
          paymentDate = parseISO(statement.manualPaymentDate);
        } else {
          // Calculate payment date using TransactionBucketService logic
          paymentDate = this.transactionBucketService.getAssignedPaymentDate(referenceDate, {
            settlementDay: card.settlementDay,
            paymentDay: card.paymentDay,
            id: card.id
          });
        }

        const bill: BillWithDetails = {
          statement,
          cardId: card.id,
          cardName: card.cardName,
          bankName: card.bankName,
          color: card.color,
          dueDate,
          settlementDate,
          paymentDate,
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

  // Bulk selection state
  protected selectedBills = signal<Set<string>>(new Set());
  protected bulkSelectMode = signal(false);
  protected batchCopied = signal(false);
  protected copiedBillId = signal<string | null>(null);

  protected get availableCards() {
    const multiMode = this.appState.multiProfileMode();
    const selectedIds = this.appState.selectedProfileIds();
    const activeProfile = this.activeProfile();

    let profileIds: string[] = [];
    if (multiMode && selectedIds.length > 0) {
      profileIds = selectedIds;
    } else if (activeProfile) {
      profileIds = [activeProfile.id];
    } else {
      return [];
    }
    
    return this.cardService.getCardsForProfiles(profileIds);
  }

  protected toggleExpand(bill: BillWithDetails): void {
    bill.isExpanded = !bill.isExpanded;
  }

  protected openPaymentModal(bill: BillWithDetails, payment?: { amount: number; date: string }, index?: number): void {
    if (!bill.statement) return;

    if (payment && typeof index === 'number') {
      // Editing existing payment
      this.paymentModalState.set({
        isOpen: true,
        statement: bill.statement,
        cardName: `${bill.bankName} ${bill.cardName}`,
        amount: payment.amount.toString(),
        date: payment.date.split('T')[0],
        editingIndex: index,
      });
    } else {
      // New payment
      // Calculate remaining amount to pay
      const remainingAmount = Math.max(0, bill.amount - bill.paidAmount);
      
      this.paymentModalState.set({
        isOpen: true,
        statement: bill.statement,
        cardName: `${bill.bankName} ${bill.cardName}`,
        amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : '',
        date: new Date().toISOString().split('T')[0],
        editingIndex: null,
      });
    }
  }

  protected closePaymentModal(): void {
    this.paymentModalState.update((state) => ({
      ...state,
      isOpen: false,
      editingIndex: null,
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

      if (modal.editingIndex !== null) {
        // Update existing payment
        await this.statementService.updatePayment(
          modal.statement.cardId,
          modal.statement.monthStr,
          modal.editingIndex,
          {
            amount: paidAmount,
            date: modal.date,
          }
        );
      } else {
        // Add new payment
        await this.statementService.addPayment(
          modal.statement.cardId,
          modal.statement.monthStr,
          paidAmount,
          modal.date
        );

        // Only create a transaction record for new payments
        const profile = this.activeProfile();
        if (profile) {
            // Find a suitable category
            const categories = this.categoryService.getCategories();
            // Look for "Credit Card Payment", "Debt Payment", "Payment", or fallback to "Utilities" or "Uncategorized"
            let categoryId = 'uncategorized';
            const paymentCategory = categories.find(c => 
                c.name.toLowerCase().includes('credit card') || 
                c.name.toLowerCase().includes('payment') ||
                c.name.toLowerCase().includes('debt')
            );
            if (paymentCategory) {
                categoryId = paymentCategory.id;
            }

            await this.transactionService.addTransaction({
                id: crypto.randomUUID(),
                profileId: profile.id,
                type: 'expense',
                amount: paidAmount,
                date: modal.date,
                description: `Payment for ${modal.cardName}`,
                categoryId: categoryId,
                paymentMethod: 'bank_transfer', // Default assumption for bill pay
                notes: 'Auto-generated from Bills page',
                isBudgetImpacting: false, // Critical: Don't reduce liquid balance again
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
      }

      // Sync transaction status with statement payment status
      await this.syncTransactionStatus(modal.statement.cardId, modal.statement.monthStr, modal.date);

      this.closePaymentModal();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  }

  protected async deletePayment(bill: BillWithDetails, index: number): Promise<void> {
    if (!bill.statement || !confirm('Are you sure you want to delete this payment?')) return;

    try {
      await this.statementService.removePayment(bill.statement.cardId, bill.statement.monthStr, index);
      // Sync transaction status with statement payment status (using today's date or bill due date as fallback for status update)
      await this.syncTransactionStatus(bill.statement.cardId, bill.statement.monthStr, new Date().toISOString());
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Failed to delete payment');
    }
  }

  private async syncTransactionStatus(cardId: string, monthStr: string, date: string): Promise<void> {
    // Determine if the statement is now fully paid
    const updatedStatement = this.statementService.getStatementForMonth(cardId, monthStr);
    const isFullyPaid = updatedStatement?.isPaid ?? false;

    // Mark all transactions for this statement based on paid status
    await this.transactionService.markStatementTransactionsPaidStatus(
      cardId,
      monthStr,
      isFullyPaid,
      isFullyPaid ? date : undefined, // Only pass date if marking as paid
    );
  }

  protected async markAsUnpaid(bill: BillWithDetails): Promise<void> {
    if (!bill.statement) return;

    try {
      await this.statementService.updateStatement(bill.statement.cardId, bill.statement.monthStr, {
        isPaid: false,
        paidAmount: 0,
      });

      // Mark all transactions for this statement as unpaid
      await this.transactionService.markStatementTransactionsPaidStatus(
        bill.statement.cardId,
        bill.statement.monthStr,
        false,
      );
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
      const dueDate = `${monthStr}-${String(defaultCard.paymentDay).padStart(2, '0')}`;

      this.billFormState.set({
        isOpen: true,
        cardId: defaultCard.id,
        amount: '',
        dueDate,
        settlementDay: defaultCard.settlementDay.toString(),
        notes: '',
        isEditing: false,
        editingMonthStr: '',
      });
    }
  }

  protected openBillFormForEdit(bill: BillWithDetails): void {
    if (!bill.statement) return;

    const card = this.availableCards.find((c) => c.id === bill.cardId);
    const settlementDay = bill.statement.customCutoffDay ?? card?.settlementDay ?? '';

    this.billFormState.set({
      isOpen: true,
      cardId: bill.cardId,
      amount: bill.statement.amount.toString(),
      dueDate: bill.statement.customDueDate || format(bill.dueDate, 'yyyy-MM-dd'),
      settlementDay: settlementDay.toString(),
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
      const settlementDayInput = form.settlementDay;
      const settlementDay = settlementDayInput ? parseInt(settlementDayInput, 10) : undefined;
      const card = this.availableCards.find((c) => c.id === form.cardId);
      
      // Build update object conditionally
      const updates: Partial<Statement> = {
        amount,
        customDueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        isEstimated: true,
      };

      // Handle customCutoffDay (legacy field name, but stores settlementDay override):
      // - If settlement day is provided and differs from card default, save it
      // - If settlement day matches card default or is empty, clear any previous custom value
      if (settlementDay && card) {
        if (settlementDay !== card.settlementDay) {
          updates.customCutoffDay = settlementDay;
        } else {
          // Matches default, clear custom value
          updates.customCutoffDay = undefined;
        }
      } else if (form.isEditing) {
        // Empty input when editing - clear any previous custom value
        updates.customCutoffDay = undefined;
      }
      
      // Update customDueDate based on form input
      if (form.dueDate) {
          updates.customDueDate = form.dueDate;
      } else if (form.isEditing) {
          // If editing and date is cleared, reset to undefined (will fallback to default calc)
          updates.customDueDate = undefined;
      }

      if (form.isEditing) {
        // Update existing statement
        this.statementService.updateStatement(form.cardId, monthStr, updates);
      } else {
        // Create new manual statement
        this.statementService.updateStatement(form.cardId, monthStr, {
          ...updates,
          isPaid: false,
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
    const dueDate = `${monthStr}-${String(card.paymentDay).padStart(2, '0')}`;

    this.billFormState.update((state) => ({
      ...state,
      dueDate,
      settlementDay: card.settlementDay.toString(),
    }));
  }

  // Copy functionality
  protected async copyBillInfo(bill: BillWithDetails): Promise<void> {
    const amountDue = bill.statement?.adjustedAmount ?? bill.amount;
    const text = `${bill.bankName} ${bill.cardName}\t${this.utils.formatCurrency(amountDue)}`;
    await navigator.clipboard.writeText(text);
    this.copiedBillId.set(bill.cardId);
    setTimeout(() => {
      this.copiedBillId.set(null);
    }, 1200);
  }

  protected toggleBillSelection(billId: string): void {
    const current = this.selectedBills();
    const next = new Set(current);
    if (next.has(billId)) {
      next.delete(billId);
    } else {
      next.add(billId);
    }
    this.selectedBills.set(next);
  }

  protected toggleAllBills(): void {
    const bills = this.billsWithDetails();
    const current = this.selectedBills();
    if (current.size === bills.length) {
      this.selectedBills.set(new Set());
    } else {
      this.selectedBills.set(new Set(bills.map((b) => b.cardId)));
    }
  }

  protected async copySelectedBills(): Promise<void> {
    const bills = this.billsWithDetails();
    const selected = this.selectedBills();
    const lines = bills
      .filter((bill) => selected.has(bill.cardId))
      .map((bill) => {
        const amountDue = bill.statement?.adjustedAmount ?? bill.amount;
        return `${bill.bankName} ${bill.cardName}\t${this.utils.formatCurrency(amountDue)}`;
      })
      .filter((line) => line !== '');

    await navigator.clipboard.writeText(lines.join('\n'));
    this.batchCopied.set(true);
    setTimeout(() => {
      this.batchCopied.set(false);
    }, 2000);
  }

  protected setBulkSelectMode(enabled: boolean): void {
    this.bulkSelectMode.set(enabled);
    if (!enabled) {
      this.selectedBills.set(new Set());
    }
  }

  protected isBillSelected(billId: string): boolean {
    return this.selectedBills().has(billId);
  }

  protected get allBillsSelected(): boolean {
    const bills = this.billsWithDetails();
    const selected = this.selectedBills();
    return bills.length > 0 && bills.every((b) => selected.has(b.cardId));
  }

  // Date override modal state
  protected dateOverrideModal = signal<{
    isOpen: boolean;
    statement: Statement | null;
    cardId: string;
    cardName: string;
    settlementDate: string;
    paymentDate: string;
    field: 'settlement' | 'payment' | null;
  }>({
    isOpen: false,
    statement: null,
    cardId: '',
    cardName: '',
    settlementDate: '',
    paymentDate: '',
    field: null,
  });

  protected openDateOverrideModal(bill: BillWithDetails, field: 'settlement' | 'payment'): void {
    if (!bill.statement) return;

    this.dateOverrideModal.set({
      isOpen: true,
      statement: bill.statement,
      cardId: bill.cardId,
      cardName: `${bill.bankName} ${bill.cardName}`,
      settlementDate: bill.statement.manualSettlementDate 
        ? bill.statement.manualSettlementDate.split('T')[0]
        : format(bill.settlementDate, 'yyyy-MM-dd'),
      paymentDate: bill.statement.manualPaymentDate
        ? bill.statement.manualPaymentDate.split('T')[0]
        : format(bill.paymentDate, 'yyyy-MM-dd'),
      field,
    });
  }

  protected closeDateOverrideModal(): void {
    this.dateOverrideModal.update((state) => ({
      ...state,
      isOpen: false,
      field: null,
    }));
  }

  protected async saveDateOverride(): Promise<void> {
    const modal = this.dateOverrideModal();
    if (!modal.statement || !modal.field) return;

    try {
      const updates: Partial<Statement> = {};
      
      if (modal.field === 'settlement') {
        updates.manualSettlementDate = modal.settlementDate || null;
      } else if (modal.field === 'payment') {
        updates.manualPaymentDate = modal.paymentDate || null;
      }

      this.statementService.updateStatement(
        modal.statement.cardId,
        modal.statement.monthStr,
        updates
      );

      this.closeDateOverrideModal();
    } catch (error) {
      console.error('Error saving date override:', error);
      alert('Failed to save date override');
    }
  }

  protected clearDateOverride(bill: BillWithDetails, field: 'settlement' | 'payment'): void {
    if (!bill.statement) return;

    const updates: Partial<Statement> = {};
    if (field === 'settlement') {
      updates.manualSettlementDate = null;
    } else if (field === 'payment') {
      updates.manualPaymentDate = null;
    }

    this.statementService.updateStatement(
      bill.statement.cardId,
      bill.statement.monthStr,
      updates
    );
  }

  protected clearDateOverrideAndClose(): void {
    const modal = this.dateOverrideModal();
    if (!modal.statement || !modal.field) return;

    const bill = this.billsWithDetails().find(b => b.cardId === modal.cardId);
    if (bill) {
      this.clearDateOverride(bill, modal.field);
    }
    this.closeDateOverrideModal();
  }
}
