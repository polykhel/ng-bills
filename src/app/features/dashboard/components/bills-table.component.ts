
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { format } from 'date-fns';
import { LucideAngularModule, Copy, CheckCircle2, Circle } from 'lucide-angular';
import { UtilsService } from '../../../core/services';
import type { CreditCard, CashInstallment, OneTimeBill, SortConfig, Statement } from '../../../shared/types';

export interface ColumnVisibilityState {
  dueDate: boolean;
  amount: boolean;
  status: boolean;
  billed: boolean;
  copy: boolean;
}

export type DashboardRow =
  | {
      type: 'card';
      card: CreditCard;
      stmt?: Statement;
      displayAmount: number;
      displayDate: Date;
      isPaid: boolean;
      cardInstTotal?: number;
      profileName?: string;
    }
  | {
      type: 'cashInstallment';
      card: CreditCard;
      cashInstallment: CashInstallment;
      displayDate: Date;
      displayAmount: number;
      isPaid: boolean;
      profileName?: string;
    }
  | {
      type: 'oneTimeBill';
      card: CreditCard;
      oneTimeBill: OneTimeBill;
      displayDate: Date;
      displayAmount: number;
      isPaid: boolean;
      profileName?: string;
    };

@Component({
  selector: 'app-bills-table',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr class="text-left text-xs font-semibold text-slate-600 uppercase">
            @if (bulkSelectMode) {
              <th class="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  class="w-4 h-4 text-blue-600"
                  [checked]="allSelected"
                  aria-label="Select all cards"
                  (change)="toggleAllCards.emit()"
                  />
              </th>
            }
            <th class="px-4 py-3">
              <button class="flex items-center gap-1" (click)="onSortClick('bankName')">
                Card
                @if (dashboardSort.key === 'bankName') {
                  <span class="text-[10px] text-blue-600">
                    {{ dashboardSort.direction === 'asc' ? '▲' : '▼' }}
                  </span>
                }
              </button>
            </th>
            @if (columnVisibility.dueDate) {
              <th class="px-4 py-3">
                <button class="flex items-center gap-1" (click)="onSortClick('dueDate')">
                  Due Date
                  @if (dashboardSort.key === 'dueDate') {
                    <span class="text-[10px] text-blue-600">
                      {{ dashboardSort.direction === 'asc' ? '▲' : '▼' }}
                    </span>
                  }
                </button>
              </th>
            }
            @if (columnVisibility.amount) {
              <th class="px-4 py-3">
                <button class="flex items-center gap-1" (click)="onSortClick('amount')">
                  Amount
                  @if (dashboardSort.key === 'amount') {
                    <span class="text-[10px] text-blue-600">
                      {{ dashboardSort.direction === 'asc' ? '▲' : '▼' }}
                    </span>
                  }
                </button>
              </th>
            }
            @if (columnVisibility.status) {
              <th class="px-4 py-3">
                <button class="flex items-center gap-1" (click)="onSortClick('status')">
                  Status
                  @if (dashboardSort.key === 'status') {
                    <span class="text-[10px] text-blue-600">
                      {{ dashboardSort.direction === 'asc' ? '▲' : '▼' }}
                    </span>
                  }
                </button>
              </th>
            }
            @if (columnVisibility.billed) {
              <th class="px-4 py-3">
                <span class="text-xs font-bold text-slate-700 uppercase">Billed</span>
              </th>
            }
            @if (columnVisibility.copy) {
              <th class="px-4 py-3 w-16 text-right">Copy</th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          @for (row of sortedData; track trackRow($index, row)) {
            <tr class="text-sm">
              @if (bulkSelectMode) {
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    class="w-4 h-4 text-blue-600"
                    [checked]="isSelected(row)"
                    [attr.aria-label]="'Select ' + row.card.bankName + ' ' + row.card.cardName"
                    (change)="toggleSelection(row)"
                    />
                </td>
              }
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-7 rounded-md shadow-sm flex items-center justify-center text-[10px] text-white font-bold"
                    [style.backgroundColor]="row.card.color || '#334155'">
                    {{ row.card.bankName.substring(0, 3) }}
                  </div>
                  <div>
                    <p class="font-semibold text-slate-800">
                      @if (row.type === 'card') {
                        {{ row.card.bankName }} {{ row.card.cardName }}
                      } @else if (row.type === 'cashInstallment') {
                        {{ row.cashInstallment.name }}
                      } @else {
                        {{ row.oneTimeBill.name }}
                      }
                    </p>
                    <div class="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{{ row.card.bankName }} {{ row.card.cardName }}</span>
                      @if (row.type === 'cashInstallment') {
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">Cash</span>
                      }
                      @if (row.profileName) {
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">{{ row.profileName }}</span>
                      }
                    </div>
                  </div>
                </div>
              </td>
              @if (columnVisibility.dueDate) {
                <td class="px-4 py-3 text-slate-700">{{ formatDate(row.displayDate) }}</td>
              }
              @if (columnVisibility.amount) {
                <td class="px-4 py-3 font-semibold text-slate-800">
                  ₱{{ rowAmount(row) }}
                </td>
              }
              @if (columnVisibility.status) {
                <td class="px-4 py-3">
                  <button
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                    [class]="row.isPaid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'"
                    (click)="toggleStatus(row)">
                    <lucide-icon [img]="row.isPaid ? CheckCircle2 : Circle" class="w-4 h-4"></lucide-icon>
                    {{ row.isPaid ? 'Paid' : 'Unpaid' }}
                  </button>
                </td>
              }
              @if (columnVisibility.billed) {
                @if (row.type === 'card') {
                  <td class="px-4 py-3">
                    <button
                      class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                      [class]="(row.stmt?.isUnbilled === false) ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
                      (click)="toggleBilledStatus(row)"
                      title="Toggle billed status">
                      {{ row.stmt?.isUnbilled === false ? 'Billed' : 'Unbilled' }}
                    </button>
                  </td>
                } @else {
                  <td class="px-4 py-3 text-slate-400 text-xs italic">-</td>
                }
              }
              @if (columnVisibility.copy) {
                <td class="px-4 py-3 text-right">
                  <button
                    class="text-blue-600 hover:text-blue-800"
                    (click)="copyRow(row)"
                    [disabled]="isCopying === rowId(row)"
                    title="Copy card info"
                    [attr.aria-label]="'Copy info for ' + row.card.bankName + ' ' + row.card.cardName">
                    <lucide-icon [img]="Copy" class="w-4 h-4"></lucide-icon>
                  </button>
                </td>
              }
            </tr>
          }
          @if (sortedData.length === 0) {
            <tr>
              <td [attr.colspan]="visibleColumnsCount" class="text-center text-slate-500 text-sm py-6">
                No bills for this month.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    `
})
export class BillsTableComponent {
  @Input() sortedData: DashboardRow[] = [];
  @Input() bulkSelectMode = false;
  @Input() selectedCards = new Set<string>();
  @Input() dashboardSort: SortConfig = { key: 'dueDate', direction: 'asc' };
  @Input() columnVisibility: ColumnVisibilityState = { dueDate: true, amount: true, status: true, billed: true, copy: true };

  @Input() onCopyCardInfo: (cardName: string, bankName: string, amount: number) => Promise<string> = async () => '';
  @Output() toggleCardSelection = new EventEmitter<string>();
  @Output() toggleAllCards = new EventEmitter<void>();
  @Output() togglePaid = new EventEmitter<string>();
  @Output() toggleCashInstallmentPaid = new EventEmitter<string>();
  @Output() toggleOneTimeBillPaid = new EventEmitter<string>();
  @Output() toggleBilled = new EventEmitter<string>();
  @Output() copied = new EventEmitter<string | null>();
  @Output() sortChange = new EventEmitter<string>();

  readonly Copy = Copy;
  readonly Circle = Circle;
  readonly CheckCircle2 = CheckCircle2;

  isCopying: string | null = null;

  constructor(public utils: UtilsService) {}

  get allSelected(): boolean {
    return this.sortedData.length > 0 && this.sortedData.every(r => this.selectedCards.has(this.rowCardId(r)));
  }

  rowAmount(row: DashboardRow): string {
    if (row.type === 'card') return this.utils.formatCurrency(row.displayAmount);
    if (row.type === 'cashInstallment') return this.utils.formatCurrency(row.displayAmount);
    return this.utils.formatCurrency(row.displayAmount);
  }

  formatDate(date: Date): string {
    return format(date, 'MMM dd');
  }

  rowCardId(row: DashboardRow): string {
    return row.card.id;
  }

  rowId(row: DashboardRow): string {
    if (row.type === 'card') return row.card.id;
    if (row.type === 'cashInstallment') return row.cashInstallment.id;
    return row.oneTimeBill.id;
  }

  isSelected(row: DashboardRow): boolean {
    return this.selectedCards.has(this.rowCardId(row));
  }

  toggleSelection(row: DashboardRow): void {
    this.toggleCardSelection.emit(this.rowCardId(row));
  }

  toggleStatus(row: DashboardRow): void {
    if (row.type === 'card') {
      this.togglePaid.emit(row.card.id);
    } else if (row.type === 'cashInstallment') {
      this.toggleCashInstallmentPaid.emit(row.cashInstallment.id);
    } else {
      this.toggleOneTimeBillPaid.emit(row.oneTimeBill.id);
    }
  }

  toggleBilledStatus(row: DashboardRow): void {
    if (row.type === 'card') {
      this.toggleBilled.emit(row.card.id);
    }
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
}
