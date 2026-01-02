import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Copy, LucideAngularModule, MoreVertical } from 'lucide-angular';
import { UtilsService } from '@services';
import type { CreditCard, SortConfig, Statement, Installment } from '@shared/types';

export interface ColumnVisibilityState {
  dueDate: boolean;
  amount: boolean;
  status: boolean;
  billed: boolean;
  copy: boolean;
}

export interface DashboardRow {
  type: 'card';
  card: CreditCard;
  stmt?: Statement;
  displayAmount: number;
  displayDate: Date;
  isPaid: boolean;
  isEstimated?: boolean;
  cardInstTotal?: number;
  profileName?: string;
  activeInstallments?: Installment[];
  amountDue?: number;
  tags?: string[];
}

@Component({
  selector: 'app-bills-table',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './bills-table.component.html',
})
export class BillsTableComponent {
  @Input() sortedData: DashboardRow[] = [];
  @Input() bulkSelectMode = false;
  @Input() selectedCards = new Set<string>();
  @Input() dashboardSort: SortConfig = {key: 'dueDate', direction: 'asc'};
  @Input() columnVisibility: ColumnVisibilityState = {
    dueDate: true,
    amount: true,
    status: true,
    billed: true,
    copy: true
  };
  @Output() toggleCardSelection = new EventEmitter<string>();
  @Output() toggleAllCards = new EventEmitter<void>();
  @Output() togglePaid = new EventEmitter<string>();
  @Output() toggleBilled = new EventEmitter<string>();
  @Output() copied = new EventEmitter<string | null>();
  @Output() sortChange = new EventEmitter<string>();
  @Output() dueDateChanged = new EventEmitter<{ cardId: string; dueDate: string }>();
  @Output() statementBalanceChanged = new EventEmitter<{ cardId: string; amount: number }>();
  @Output() amountDueChanged = new EventEmitter<{ cardId: string; amount: number }>();
  readonly Copy = Copy;
  readonly Circle = Circle;
  readonly CheckCircle2 = CheckCircle2;
  readonly MoreVertical = MoreVertical;
  isCopying: string | null = null;
  editingDueDate: string | null = null;
  editingBalance: string | null = null;
  editingAmountDue: string | null = null;
  tempDueDate = '';
  tempBalance = '';
  tempAmountDue = '';

  constructor(public utils: UtilsService) {
  }

  get allSelected(): boolean {
    return this.sortedData.length > 0 && this.sortedData.every(r => this.selectedCards.has(this.rowCardId(r)));
  }

  get visibleColumnsCount(): number {
    let count = 1; // Card column
    if (this.bulkSelectMode) count += 1;
    if (this.columnVisibility.dueDate) count += 1;
    if (this.columnVisibility.amount) count += 1; // Statement Balance
    count += 1; // Amount Due
    count += 1; // Active Installments
    if (this.columnVisibility.status) count += 1;
    count += 1; // Actions
    return count;
  }

  @Input() onCopyCardInfo: (cardName: string, bankName: string, amount: number) => Promise<string> = async () => '';

  rowAmount(row: DashboardRow): string {
    return this.utils.formatCurrency(row.displayAmount);
  }

  rowAmountDue(row: DashboardRow): string {
    return this.utils.formatCurrency(row.amountDue ?? row.displayAmount);
  }

  formatDate(date: Date): string {
    return format(date, 'MMM dd');
  }

  rowCardId(row: DashboardRow): string {
    return row.card.id;
  }

  rowId(row: DashboardRow): string {
    return row.card.id;
  }

  isSelected(row: DashboardRow): boolean {
    return this.selectedCards.has(this.rowCardId(row));
  }

  toggleSelection(row: DashboardRow): void {
    this.toggleCardSelection.emit(this.rowCardId(row));
  }

  toggleStatus(row: DashboardRow): void {
    this.togglePaid.emit(row.card.id);
  }

  toggleBilledStatus(row: DashboardRow): void {
    this.toggleBilled.emit(row.card.id);
  }

  async copyRow(row: DashboardRow): Promise<void> {
    const amount = row.amountDue ?? row.displayAmount;
    this.isCopying = this.rowId(row);
    await this.onCopyCardInfo(row.card.cardName, row.card.bankName, amount);
    this.copied.emit(this.rowId(row));
    setTimeout(() => {
      this.isCopying = null;
    }, 1200);
  }

  startEditDueDate(row: DashboardRow): void {
    this.editingDueDate = row.card.id;
    this.tempDueDate = format(row.displayDate, 'yyyy-MM-dd');
  }

  saveDueDate(row: DashboardRow): void {
    if (this.tempDueDate && this.editingDueDate === row.card.id) {
      this.dueDateChanged.emit({ cardId: row.card.id, dueDate: this.tempDueDate });
      this.editingDueDate = null;
    }
  }

  cancelEditDueDate(): void {
    this.editingDueDate = null;
    this.tempDueDate = '';
  }

  startEditBalance(row: DashboardRow): void {
    this.editingBalance = row.card.id;
    this.tempBalance = row.displayAmount.toString();
  }

  saveBalance(row: DashboardRow): void {
    if (this.tempBalance !== '' && this.editingBalance === row.card.id) {
      const amount = this.utils.evaluateMathExpression(this.tempBalance);
      if (amount !== null && amount >= 0) {
        this.statementBalanceChanged.emit({ cardId: row.card.id, amount });
        this.editingBalance = null;
        this.tempBalance = '';
      }
    }
  }

  cancelEditBalance(): void {
    this.editingBalance = null;
    this.tempBalance = '';
  }

  startEditAmountDue(row: DashboardRow): void {
    this.editingAmountDue = row.card.id;
    this.tempAmountDue = (row.amountDue ?? row.displayAmount).toString();
  }

  saveAmountDue(row: DashboardRow): void {
    if (this.tempAmountDue !== '' && this.editingAmountDue === row.card.id) {
      const amount = this.utils.evaluateMathExpression(this.tempAmountDue);
      if (amount !== null && amount >= 0) {
        this.amountDueChanged.emit({ cardId: row.card.id, amount });
        this.editingAmountDue = null;
        this.tempAmountDue = '';
      }
    }
  }

  cancelEditAmountDue(): void {
    this.editingAmountDue = null;
    this.tempAmountDue = '';
  }

  getActiveInstallmentCount(row: DashboardRow): number {
    return row.activeInstallments?.length ?? 0;
  }

  getInstallmentSummary(row: DashboardRow): string {
    if (!row.activeInstallments || row.activeInstallments.length === 0) {
      return 'None';
    }
    return `${row.activeInstallments.length} active`;
  }

  trackRow = (_: number, row: DashboardRow) => this.rowId(row);

  onSortClick(key: string): void {
    this.sortChange.emit(key);
  }
}
