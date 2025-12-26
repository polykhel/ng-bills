
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-bank-balance-toggle',
  standalone: true,
  imports: [],
  template: `
    @if (!enabled) {
      <button
        (click)="enable.emit()"
        class="w-full bg-blue-50 border-2 border-dashed border-blue-200 hover:border-blue-300 hover:bg-blue-100 text-blue-600 px-4 py-3 rounded-xl transition-all text-sm font-medium">
        + Enable Bank Balance Tracking
      </button>
    }
  `
})
export class BankBalanceToggleComponent {
  @Input() enabled = false;
  @Output() enable = new EventEmitter<void>();
}
