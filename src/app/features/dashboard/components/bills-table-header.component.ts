
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule, FileSpreadsheet, CheckCircle2, Copy } from 'lucide-angular';
import { format } from 'date-fns';
import { UtilsService } from '../../../core/services';
import { ColumnVisibilityMenuComponent, type ColumnVisibilityOption } from '../../../shared/components/column-visibility-menu.component';
import type { ColumnVisibilityState } from './bills-table.component';

@Component({
  selector: 'app-bills-table-header',
  standalone: true,
  imports: [LucideAngularModule, ColumnVisibilityMenuComponent],
  template: `
    <div class="flex flex-wrap gap-2 justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/50">
      <h3 class="font-bold text-slate-700 text-sm sm:text-base">Bills for {{ formattedDate }}</h3>
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
        <app-column-visibility-menu
          [options]="visibilityOptions"
          (toggle)="onToggleColumn($event.key, $event.visible)"
          (reset)="onResetColumns()"
        ></app-column-visibility-menu>
        @if (bulkSelectMode && selectedCardsCount > 0) {
          <button
            (click)="copySelected.emit()"
            [class]="utils.cn('flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition', batchCopied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100')">
            @if (batchCopied) {
              <span class="flex items-center gap-2">
                <lucide-icon [img]="CheckCircle2" class="w-4 h-4"></lucide-icon>
                Copied {{ selectedCardsCount }}!
              </span>
            } @else {
              <span class="flex items-center gap-2">
                <lucide-icon [img]="Copy" class="w-4 h-4"></lucide-icon>
                Copy {{ selectedCardsCount }} Selected
              </span>
            }
          </button>
        }
        @if (bulkSelectMode) {
          <button
            (click)="setBulkSelectMode.emit(false)"
            class="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition">
            Cancel Select
          </button>
        } @else {
          <button
            (click)="setBulkSelectMode.emit(true)"
            class="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition">
            <lucide-icon [img]="Copy" class="w-4 h-4"></lucide-icon>
            Bulk Copy
          </button>
        }
        <button
          (click)="exportCSV.emit()"
          class="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition">
          <lucide-icon [img]="FileSpreadsheet" class="w-4 h-4 text-green-600"></lucide-icon>
          Export CSV
        </button>
      </div>
    </div>
  `
})
export class BillsTableHeaderComponent {
  @Input() viewDate = new Date();
  @Input() bulkSelectMode = false;
  @Input() selectedCardsCount = 0;
  @Input() batchCopied = false;
  @Input() columnVisibility: ColumnVisibilityState = { dueDate: true, amount: true, status: true, billed: true, copy: true };

  @Output() setBulkSelectMode = new EventEmitter<boolean>();
  @Output() copySelected = new EventEmitter<void>();
  @Output() exportCSV = new EventEmitter<void>();
  @Output() columnVisibilityChange = new EventEmitter<ColumnVisibilityState>();

  readonly CheckCircle2 = CheckCircle2;
  readonly Copy = Copy;
  readonly FileSpreadsheet = FileSpreadsheet;
  constructor(public utils: UtilsService) {}

  get formattedDate(): string {
    return format(this.viewDate, 'MMMM yyyy');
  }

  get visibilityOptions(): ColumnVisibilityOption[] {
    return [
      { key: 'dueDate', label: 'Due Date', visible: this.columnVisibility.dueDate },
      { key: 'amount', label: 'Amount', visible: this.columnVisibility.amount },
      { key: 'status', label: 'Status', visible: this.columnVisibility.status },
      { key: 'billed', label: 'Billed', visible: this.columnVisibility.billed },
      { key: 'copy', label: 'Copy', visible: this.columnVisibility.copy },
    ];
  }

  onToggleColumn(key: string, visible: boolean): void {
    this.columnVisibilityChange.emit({ ...this.columnVisibility, [key]: visible });
  }

  onResetColumns(): void {
    this.columnVisibilityChange.emit({ dueDate: true, amount: true, status: true, billed: true, copy: true });
  }
}
