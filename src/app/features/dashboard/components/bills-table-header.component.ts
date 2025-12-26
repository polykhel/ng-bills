import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckCircle2, Copy, FileSpreadsheet, LucideAngularModule } from 'lucide-angular';
import { format } from 'date-fns';
import {
  ColumnVisibilityMenuComponent,
  type ColumnVisibilityOption
} from '@components/column-visibility-menu.component';
import type { ColumnVisibilityState } from './bills-table.component';

@Component({
  selector: 'app-bills-table-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ColumnVisibilityMenuComponent],
  templateUrl: './bills-table-header.component.html',
})
export class BillsTableHeaderComponent {
  @Input() viewDate = new Date();
  @Input() bulkSelectMode = false;
  @Input() selectedCardsCount = 0;
  @Input() batchCopied = false;
  @Input() columnVisibility: ColumnVisibilityState = {
    dueDate: true,
    amount: true,
    status: true,
    billed: true,
    copy: true
  };

  @Output() setBulkSelectMode = new EventEmitter<boolean>();
  @Output() copySelected = new EventEmitter<void>();
  @Output() exportCSV = new EventEmitter<void>();
  @Output() columnVisibilityChange = new EventEmitter<ColumnVisibilityState>();

  readonly CheckCircle2 = CheckCircle2;
  readonly Copy = Copy;
  readonly FileSpreadsheet = FileSpreadsheet;

  constructor() {
  }

  get formattedDate(): string {
    return format(this.viewDate, 'MMMM yyyy');
  }

  get visibilityOptions(): ColumnVisibilityOption[] {
    return [
      {key: 'dueDate', label: 'Due Date', visible: this.columnVisibility.dueDate},
      {key: 'amount', label: 'Amount', visible: this.columnVisibility.amount},
      {key: 'status', label: 'Status', visible: this.columnVisibility.status},
      {key: 'billed', label: 'Billed', visible: this.columnVisibility.billed},
      {key: 'copy', label: 'Copy', visible: this.columnVisibility.copy},
    ];
  }

  onToggleColumn(key: string, visible: boolean): void {
    this.columnVisibilityChange.emit({...this.columnVisibility, [key]: visible});
  }

  onResetColumns(): void {
    this.columnVisibilityChange.emit({dueDate: true, amount: true, status: true, billed: true, copy: true});
  }
}
