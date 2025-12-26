import { Component, EventEmitter, Input, Output } from '@angular/core';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Copy, LucideAngularModule } from 'lucide-angular';
import { UtilsService } from '@services';
import type { CreditCard, SortConfig, Statement } from '@shared/types';

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
  cardInstTotal?: number;
  profileName?: string;
}

@Component({
  selector: 'app-bills-table',
  standalone: true,
  imports: [LucideAngularModule],
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
  readonly Copy = Copy;
  readonly Circle = Circle;
  readonly CheckCircle2 = CheckCircle2;
  isCopying: string | null = null;

  constructor(public utils: UtilsService) {
  }

  get allSelected(): boolean {
    return this.sortedData.length > 0 && this.sortedData.every(r => this.selectedCards.has(this.rowCardId(r)));
  }

  get visibleColumnsCount(): number {
    let count = 1; // Card column
    if (this.bulkSelectMode) count += 1;
    if (this.columnVisibility.dueDate) count += 1;
    if (this.columnVisibility.amount) count += 1;
    if (this.columnVisibility.status) count += 1;
    if (this.columnVisibility.billed) count += 1;
    if (this.columnVisibility.copy) count += 1;
    return count;
  }

  @Input() onCopyCardInfo: (cardName: string, bankName: string, amount: number) => Promise<string> = async () => '';

  rowAmount(row: DashboardRow): string {
    return this.utils.formatCurrency(row.displayAmount);
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
    const amount = row.displayAmount;
    this.isCopying = this.rowId(row);
    await this.onCopyCardInfo(row.card.cardName, row.card.bankName, amount);
    this.copied.emit(this.rowId(row));
    setTimeout(() => {
      this.isCopying = null;
    }, 1200);
  }

  trackRow = (_: number, row: DashboardRow) => this.rowId(row);

  onSortClick(key: string): void {
    this.sortChange.emit(key);
  }
}
